// src/lib/supabase.js
// 把下面两行换成你自己的 Supabase 项目地址和 anon key
// 在 Supabase Dashboard → Project Settings → API 里找到
































import { createClient } from '@supabase/supabase-js'
































const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
































export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
































// ============================================================
// AUTH
// ============================================================
export async function signUp({ email, password, nickname }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } }
  })
  if (error) throw error
  return data
}
































export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data
}
































// 游客模式：匿名登录（Supabase 需开启 Anonymous sign-ins）
export async function signInAnonymous() {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data
}
































export async function signOut() {
  await supabase.auth.signOut()
}
































export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
































// ============================================================
// USER PROFILE
// ============================================================
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}
































export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
































// ============================================================
// PLEDGES（誓言）
// ============================================================
export async function createPledge(userId, pledge) {
  const startDate = new Date()
  const endDate = new Date(startDate)
  const days = { week: 7, month: 30, season: 90, year: 365 }
  endDate.setDate(endDate.getDate() + days[pledge.period] - 1)
































  const { data, error } = await supabase
    .from('pledges')
    .insert({
      user_id: userId,
      title: pledge.title,
      period: pledge.period,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_days: days[pledge.period],
      stake_coins: pledge.stakeCoins,
      charity_target: pledge.charityTarget,
      verify_type: pledge.verifyType,
      is_public: pledge.isPublic,
    })
    .select()
    .single()
  if (error) throw error
































  // 扣除押注金币
  await addCoins(userId, -pledge.stakeCoins, 'stake', data.id, `立誓「${pledge.title}」押注`)
































  return data
}
































export async function getMyPledges(userId) {
  const { data, error } = await supabase
    .from('pledges')
    .select('*, checkins(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
































export async function getPledgeDetail(pledgeId) {
  const { data, error } = await supabase
    .from('pledges')
    .select(`
      *,
      profiles:user_id(nickname, avatar_url),
      checkins(*),
      witnesses(*, profiles:user_id(nickname, avatar_url))
    `)
    .eq('id', pledgeId)
    .single()
  if (error) throw error
  return data
}
































export async function getPublicPledges({ category, sort = 'created_at' } = {}) {
  let query = supabase
    .from('pledges')
    .select(`*, profiles:user_id(nickname, avatar_url), witnesses(count), checkins(count)`)
    .eq('is_public', true)
    .eq('status', 'active')
































  if (sort === 'ending_soon') {
    query = query.order('end_date', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }
  query = query.limit(20)
































  const { data, error } = await query
  if (error) throw error
  return data
}
































export async function getCompletedPledges({ limit = 20 } = {}) {
  const { data, error } = await supabase
    .from('pledges')
    .select(`*, profiles:user_id(nickname, avatar_emoji)`)
    .eq('is_public', true)
    .eq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(limit)
  throwIf(error)
  return data
}
































// 完成/失败誓言
// 结算见证者对赌池：成功=支持方赢，失败=质疑方赢
async function settleWitnessPool(pledge, success) {
  const witnesses = (pledge.witnesses || []).filter(w => w.status === 'active')
  if (witnesses.length === 0) return { witnessTotal: 0, charityCoins: 0 }








  const winnerType = success ? 'trust' : 'doubt'
  const winners = witnesses.filter(w => w.type === winnerType)
  const losers = witnesses.filter(w => w.type !== winnerType)
  const winnerPool = winners.reduce((sum, w) => sum + (w.stake_coins || 0), 0)
  const loserPool = losers.reduce((sum, w) => sum + (w.stake_coins || 0), 0)
  const witnessTotal = winnerPool + loserPool








  let paid = 0
  if (winners.length > 0) {
    for (const w of winners) {
      const loserShare = loserPool > 0 && winnerPool > 0
        ? Math.floor(loserPool * (w.stake_coins || 0) / winnerPool)
        : 0
      const payout = (w.stake_coins || 0) + loserShare
      if (payout > 0) {
        await addCoins(w.user_id, payout, 'witness_earn', pledge.id,
          `见证「${pledge.title}」结算收益`)
        paid += payout
      }
    }
  }








  // 更新见证状态。若 RLS 暂时限制他人记录更新，不阻断金币结算。
  await supabase.from('witnesses')
    .update({ status: 'won' })
    .eq('pledge_id', pledge.id)
    .eq('type', winnerType)
    .catch(err => console.warn('更新赢方见证状态失败', err?.message || err))








  await supabase.from('witnesses')
    .update({ status: 'lost' })
    .eq('pledge_id', pledge.id)
    .neq('type', winnerType)
    .catch(err => console.warn('更新输方见证状态失败', err?.message || err))








  const charityCoins = Math.max(0, witnessTotal - paid)
  if (charityCoins > 0) {
    await supabase.from('donations').insert({
      user_id: pledge.user_id,
      coins: charityCoins,
      org_name: pledge.charity_target,
      source: 'witness_pool',
      ref_id: pledge.id,
      message: `誓言「${pledge.title}」见证池结余进入公益`,
    })
  }








  return { witnessTotal, charityCoins }
}








// 完成/失败誓言，并结算押注、见证池和公益记录
export async function completePledge(pledgeId, userId, success) {
  const pledge = await getPledgeDetail(pledgeId)
  if (!pledge) throw new Error('誓言不存在')
  if (pledge.user_id !== userId) throw new Error('只能结算自己的誓言')
  if (pledge.status !== 'active') throw new Error('这个誓言已经结算过了')








  const today = new Date()
  const endDate = new Date(pledge.end_date)
  if (success && (pledge.checkin_count || 0) < pledge.total_days) {
    throw new Error('还没有完成全部打卡，暂不能完成结算')
  }
  if (!success && today <= endDate && (pledge.checkin_count || 0) < pledge.total_days) {
    throw new Error('誓言尚未到期，暂不能失败结算')
  }




  const finalStatus = success ? 'done' : 'cooldown'
  const updatePayload = { status: finalStatus, updated_at: new Date().toISOString() }
  if (!success) {
    const cooldownUntil = new Date()
    cooldownUntil.setDate(cooldownUntil.getDate() + 3)
    updatePayload.cooldown_until = cooldownUntil.toISOString()
  }








  const { error: pledgeError } = await supabase
    .from('pledges')
    .update(updatePayload)
    .eq('id', pledgeId)
    .eq('user_id', userId)
    .eq('status', 'active')
  if (pledgeError) throw new Error(pledgeError.message || '誓言状态更新失败')








  if (success) {
    // 成功：退还发起者押注
    await addCoins(userId, pledge.stake_coins, 'stake_refund', pledgeId, '誓言达成，押注返还')








    // 更新完成计数和额度
    const profile = await getProfile(userId)
    const newCount = (profile.completed_count || 0) + 1
    const newLimit = newCount >= 6 ? 9 : newCount >= 3 ? 7 : newCount >= 1 ? 4 : 3
    await updateProfile(userId, { completed_count: newCount, quota_limit: newLimit })
  } else {
    // 失败：发起者押注进入公益
    await supabase.from('donations').insert({
      user_id: userId,
      coins: pledge.stake_coins,
      org_name: pledge.charity_target,
      source: 'pledge_fail',
      ref_id: pledgeId,
      message: `誓言「${pledge.title}」未完成，押注捐出`,
    })
  }








  const witnessSettlement = await settleWitnessPool(pledge, success)
  return { status: finalStatus, success, witnessSettlement }
}
































// ============================================================
// CHECKINS（打卡）
// ============================================================
export async function submitCheckin(userId, pledgeId, { imageFile, note, mood }) {
  // 1. 上传图片（如果有）
  let imageUrl = null
  if (imageFile) {
    const ext = imageFile.name.split('.').pop()
    const path = `${userId}/${pledgeId}/${Date.now()}.${ext}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('checkins')
      .upload(path, imageFile, { cacheControl: '3600', upsert: false })
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('checkins').getPublicUrl(path)
    imageUrl = urlData.publicUrl
  }
































  // 2. 获取誓言信息和已有打卡
  const pledge = await getPledgeDetail(pledgeId)
  const today = new Date().toISOString().split('T')[0]
  const startDate = new Date(pledge.start_date)
  const todayDate = new Date(today)
  const dayNum = Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24)) + 1
































  // 计算连续天数
  const sortedCheckins = (pledge.checkins || []).sort((a, b) =>
    new Date(b.checkin_date) - new Date(a.checkin_date)
  )
  let streak = 1
  if (sortedCheckins.length > 0) {
    const lastDate = new Date(sortedCheckins[0].checkin_date)
    const expectedYesterday = new Date(todayDate)
    expectedYesterday.setDate(expectedYesterday.getDate() - 1)
    if (lastDate.toISOString().split('T')[0] === expectedYesterday.toISOString().split('T')[0]) {
      streak = (sortedCheckins[0].streak || 1) + 1
    }
  }
































  // 计算奖励金币
  const baseCoins = 10
  const streakBonus = streak >= 14 ? 30 : streak >= 7 ? 20 : 0
  const milestones = [7, 14, 21, 28]
  const milestoneBonus = milestones.includes(dayNum) ? 100 : 0
  const totalCoins = baseCoins + streakBonus + milestoneBonus
































  // 3. 写打卡记录
  const { data: checkin, error } = await supabase
    .from('checkins')
    .insert({
      pledge_id: pledgeId,
      user_id: userId,
      day_num: dayNum,
      checkin_date: today,
      image_url: imageUrl,
      note,
      mood,
      coins_earned: totalCoins,
      streak
    })
    .select()
    .single()
  if (error) throw error
































  // 4. 更新誓言统计
  const newCheckinCount = (pledge.checkin_count || 0) + 1
  const newMaxStreak = Math.max(pledge.max_streak || 0, streak)
  await supabase
    .from('pledges')
    .update({
      checkin_count: newCheckinCount,
      current_streak: streak,
      max_streak: newMaxStreak,
      updated_at: new Date().toISOString()
    })
    .eq('id', pledgeId)
































  // 5. 发放金币
  await addCoins(userId, baseCoins, 'checkin', checkin.id, `第${dayNum}天打卡`)
  if (streakBonus > 0) {
    await addCoins(userId, streakBonus, 'reward_streak', checkin.id, `连续${streak}天奖励`)
  }
  if (milestoneBonus > 0) {
    await addCoins(userId, milestoneBonus, 'reward_milestone', checkin.id, `第${dayNum}天里程碑`)
  }
































  let settlement = null
  if (newCheckinCount >= pledge.total_days && pledge.status === 'active') {
    settlement = await completePledge(pledgeId, userId, true)
  }

  return { checkin, totalCoins, streak, dayNum, settlement }
}
































export async function getCheckins(pledgeId) {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('pledge_id', pledgeId)
    .order('checkin_date', { ascending: true })
  if (error) throw error
  return data
}
































export async function hasCheckedInToday(pledgeId) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('checkins')
    .select('id')
    .eq('pledge_id', pledgeId)
    .eq('checkin_date', today)
    .maybeSingle()
  return !!data
}
































// ============================================================
// COIN LEDGER（金币流水）
// ============================================================
export async function addCoins(userId, amount, type, refId = null, note = null) {
  const { data, error } = await supabase.rpc('add_coins', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_ref_id: refId,
    p_note: note
  })
  if (error) throw error
  return data
}
































export async function getCoinLedger(userId, limit = 20) {
  const { data, error } = await supabase
    .from('coin_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
































// ============================================================
// DONATIONS
// ============================================================
export async function donate(userId, { coins, orgName, message }) {
  // 先扣金币
  await addCoins(userId, -coins, 'donate', null, `捐款给${orgName}`)
































  // 再写记录
  const { data, error } = await supabase
    .from('donations')
    .insert({ user_id: userId, coins, org_name: orgName, source: 'manual', message })
    .select()
    .single()
  if (error) throw error
































  // 更新功德值（total_merit 由 add_coins 函数自动处理收入，捐款是支出不更新，
  // 但为了称号计算，捐出的也要加到功德值）
  await supabase
    .from('profiles')
    .update({ total_merit: supabase.sql`total_merit + ${coins}` })
    .eq('id', userId)
































  return data
}
































export async function getDonations(userId) {
  const { data, error } = await supabase
    .from('donations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
































// ============================================================
// 称号计算
// ============================================================
export function getMeritTitle(totalMerit) {
  if (totalMerit >= 50000) return { emoji: '🪷', title: '菩萨心肠', next: null }
  if (totalMerit >= 15000) return { emoji: '✨', title: '功德大师', next: 50000 }
  if (totalMerit >= 5000)  return { emoji: '🔥', title: '善行者', next: 15000 }
  if (totalMerit >= 2000)  return { emoji: '🌊', title: '护法者', next: 5000 }
  if (totalMerit >= 500)   return { emoji: '🌿', title: '种善者', next: 2000 }
  return { emoji: '🌱', title: '初心者', next: 500 }
}
































// ============================================================
// V2：见证者系统 CRUD
// ============================================================
































// ── 见证者（Witnesses）──
































// 押注见证某个誓言（支持 trust / 质疑 doubt）
export async function addWitness(userId, pledgeId, type, stakeCoins = 100) {
  // 1. 扣金币
  const profile = await getProfile(userId)
  if (profile.merit_coins < stakeCoins) throw new Error('金币不足，无法押注')
































  await supabase
    .from('profiles')
    .update({ merit_coins: profile.merit_coins - stakeCoins, updated_at: new Date().toISOString() })
    .eq('id', userId)
































  // 2. 写 coin_ledger
  await supabase.from('coin_ledger').insert({
    user_id: userId, amount: -stakeCoins, type: 'stake',
    ref_id: pledgeId, note: `见证押注：${type === 'trust' ? '支持' : '质疑'}`,
    balance_after: profile.merit_coins - stakeCoins,
  })
































  // 3. 写 witnesses 记录
  const { data, error } = await supabase
    .from('witnesses')
    .insert({ pledge_id: pledgeId, user_id: userId, type, stake_coins: stakeCoins })
    .select()
    .single()
  if (error) throw new Error(error.message || '押注失败')
































  // 4. 更新 pledges 的 trust_pool / doubt_pool 缓存
  const poolField = type === 'trust' ? 'trust_pool' : 'doubt_pool'
  await supabase.rpc('increment_field', {
    table_name: 'pledges', field_name: poolField,
    row_id: pledgeId, amount: stakeCoins,
  }).catch(() => {
    // rpc 不存在时降级：直接读写
    supabase.from('pledges').select(poolField).eq('id', pledgeId).single()
      .then(({ data: p }) => {
        supabase.from('pledges').update({ [poolField]: (p?.[poolField] || 0) + stakeCoins }).eq('id', pledgeId)
      })
  })
































  return data
}
































// 获取某个誓言的所有见证者
export async function getWitnesses(pledgeId) {
  const { data, error } = await supabase
    .from('witnesses')
    .select('*, profiles:user_id(nickname, avatar_emoji)')
    .eq('pledge_id', pledgeId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || '获取见证者失败')
  return data || []
}
































// 获取当前用户对某个誓言的见证状态
export async function getMyWitness(userId, pledgeId) {
  const { data } = await supabase
    .from('witnesses')
    .select('*')
    .eq('pledge_id', pledgeId)
    .eq('user_id', userId)
    .maybeSingle()
  return data  // null = 未见证
}
































// ── 指数基金（Index Funds）──
































// 获取四大指数
export async function getIndexFunds() {
  const { data, error } = await supabase
    .from('index_funds')
    .select('*')
    .order('code')
  if (error) throw new Error(error.message || '获取指数失败')
  return data || []
}
































// 获取单个指数详情
export async function getIndexFund(code) {
  const { data, error } = await supabase
    .from('index_funds')
    .select('*')
    .eq('code', code)
    .single()
  if (error) throw new Error(error.message || '指数不存在')
  return data
}
































// ── 指数下注（Index Bets）──
































// 对指数下多/空注
export async function placeIndexBet(userId, indexCode, direction, amount) {
  // 1. 校验
  if (amount <= 0) throw new Error('押注金额必须大于0')
  if (!['believe', 'doubt'].includes(direction)) throw new Error('方向错误')
































  const profile = await getProfile(userId)
  if (profile.merit_coins < amount) throw new Error('金币不足')
































  // 2. 获取当前赔率
  const fund = await getIndexFund(indexCode)
  const odds = direction === 'believe' ? fund.bull_odds : fund.bear_odds
































  // 3. 扣金币
  await supabase
    .from('profiles')
    .update({ merit_coins: profile.merit_coins - amount, updated_at: new Date().toISOString() })
    .eq('id', userId)
































  // 4. 写 coin_ledger
  await supabase.from('coin_ledger').insert({
    user_id: userId, amount: -amount, type: 'stake',
    note: `指数下注：${indexCode} ${direction === 'believe' ? '看多' : '看空'}`,
    balance_after: profile.merit_coins - amount,
  })
































  // 5. 写 index_bets
  const { data, error } = await supabase
    .from('index_bets')
    .insert({
      user_id: userId, index_code: indexCode,
      direction, amount, odds_at_bet: odds,
    })
    .select()
    .single()
  if (error) throw new Error(error.message || '下注失败')
































  // 6. 更新 index_funds 的 pool 缓存
  const poolField = direction === 'believe' ? 'total_bull_pool' : 'total_bear_pool'
  await supabase
    .from('index_funds')
    .update({
      [poolField]: (fund[poolField] || 0) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('code', indexCode)
































  return data
}
































// 获取我的指数下注记录
export async function getMyIndexBets(userId, limit = 30) {
  const { data, error } = await supabase
    .from('index_bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message || '获取下注记录失败')
  return data || []
}
































// ── 质疑/仲裁（Disputes）──
































// 质疑某次打卡
export async function disputeCheckin(userId, checkinId, pledgeId, reason = '') {
  // 1. 写 disputes 记录
  const { data, error } = await supabase
    .from('disputes')
    .insert({
      checkin_id: checkinId, pledge_id: pledgeId,
      disputer_id: userId, reason,
    })
    .select()
    .single()
  if (error) throw new Error(error.message || '质疑提交失败')
































  // 2. 标记打卡进入陪审团；当前 checkins 表使用 status 字段
  const { error: updateError } = await supabase
    .from('checkins')
    .update({ status: 'disputed' })
    .eq('id', checkinId)
    .eq('pledge_id', pledgeId)
    .eq('status', 'valid')
  if (updateError) console.warn('打卡状态更新失败', updateError.message)
































  return data
}
































// 获取某次打卡的质疑记录
export async function getDisputesByCheckin(checkinId) {
  const { data, error } = await supabase
    .from('disputes')
    .select('*, profiles:disputer_id(nickname, avatar_emoji)')
    .eq('checkin_id', checkinId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || '获取质疑记录失败')
  return data || []
}
































// ── 慈善总金库（Charity Vault）──
































// 获取金库流水（公开透明）
export async function getCharityVault(limit = 50) {
  const { data, error } = await supabase
    .from('charity_vault')
    .select('*, profiles:user_id(nickname)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message || '获取金库数据失败')
  return data || []
}
































// 获取金库累计总额
export async function getCharityTotal() {
  const { data, error } = await supabase
    .from('charity_vault')
    .select('amount')
  if (error) return 0
  return (data || []).reduce((sum, r) => sum + r.amount, 0)
}
































// ============================================================
// V3：盲盒结缘 + 悬赏令 + 陪审团
// ============================================================
































// ── 盲盒结缘（Blind Bet）──
































// 一键机选结缘：系统自动分配给最冷门的誓言
export async function placeBlindBet(userId, totalAmount) {
  if (totalAmount <= 0) throw new Error('金额必须大于0')
































  const profile = await getProfile(userId)
  if (profile.merit_coins < totalAmount) throw new Error('金币不足')
































  // 找最冷门的 active 誓言（围观人数最少，排除自己的）
  const { data: coldPledges } = await supabase
    .from('pledges')
    .select('id, title, viewer_count, trust_pool, doubt_pool')
    .eq('status', 'active')
    .eq('is_public', true)
    .neq('user_id', userId)
    .order('viewer_count', { ascending: true })
    .limit(5)
































  if (!coldPledges || coldPledges.length === 0) throw new Error('当前没有可结缘的誓言')
































  // 拆分金币分配给冷门誓言（平均分配）
  const count = Math.min(coldPledges.length, 3)  // 最多分给3个
  const perAmount = Math.floor(totalAmount / count)
  const splits = coldPledges.slice(0, count).map(p => ({
    pledge_id: p.id, amount: perAmount, title: p.title,
  }))
































  // 1. 扣金币
  await supabase
    .from('profiles')
    .update({ merit_coins: profile.merit_coins - totalAmount, updated_at: new Date().toISOString() })
    .eq('id', userId)
































  // 2. 写金币流水
  await supabase.from('coin_ledger').insert({
    user_id: userId, amount: -totalAmount, type: 'stake',
    note: `盲盒结缘 · 机选${count}个誓言`,
    balance_after: profile.merit_coins - totalAmount,
  })
































  // 3. 为每个冷门誓言创建 witness 记录（全部为 trust 支持）
  for (const s of splits) {
    await supabase.from('witnesses').insert({
      pledge_id: s.pledge_id, user_id: userId,
      type: 'trust', stake_coins: s.amount,
    })
    // 更新 trust_pool
    const { data: p } = await supabase.from('pledges').select('trust_pool, viewer_count').eq('id', s.pledge_id).single()
    await supabase.from('pledges').update({
      trust_pool: (p?.trust_pool || 0) + s.amount,
      viewer_count: (p?.viewer_count || 0) + 1,
    }).eq('id', s.pledge_id)
  }
































  // 4. 写 blind_bets 记录
  const { data: bet, error } = await supabase
    .from('blind_bets')
    .insert({
      user_id: userId, total_amount: totalAmount,
      split_to: splits, honor_bonus: 1.2,
    })
    .select()
    .single()
  if (error) throw new Error(error.message || '结缘失败')
































  // 5. 加荣誉积分（1.2倍加成）
  const honorGain = Math.round(totalAmount * 0.2)
  await supabase.from('profiles').update({
    honor_points: (profile.honor_points || 0) + honorGain,
  }).eq('id', userId)
































  return { bet, splits, honorGain }
}
































// 获取我的盲盒结缘记录
export async function getMyBlindBets(userId, limit = 20) {
  const { data, error } = await supabase
    .from('blind_bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message || '获取结缘记录失败')
  return data || []
}
































// ── 悬赏令（Bounty）──
































// 立誓者设置悬赏广告费
export async function setBounty(userId, pledgeId, amount) {
  if (amount <= 0) throw new Error('悬赏金额必须大于0')
































  const profile = await getProfile(userId)
  if (profile.merit_coins < amount) throw new Error('金币不足')
































  // 扣金币
  await supabase.from('profiles').update({
    merit_coins: profile.merit_coins - amount, updated_at: new Date().toISOString(),
  }).eq('id', userId)
































  // 写金币流水
  await supabase.from('coin_ledger').insert({
    user_id: userId, amount: -amount, type: 'stake',
    ref_id: pledgeId, note: '悬赏令广告费',
    balance_after: profile.merit_coins - amount,
  })
































  // 更新 pledges 的 bounty_amount
  const { data: pledge } = await supabase.from('pledges').select('bounty_amount').eq('id', pledgeId).single()
  const { error } = await supabase.from('pledges').update({
    bounty_amount: (pledge?.bounty_amount || 0) + amount,
  }).eq('id', pledgeId)
  if (error) throw new Error(error.message || '设置悬赏失败')
































  // 写慈善金库（悬赏费进入金库）
  await supabase.from('charity_vault').insert({
    source_type: 'bounty_fee', source_ref: pledgeId,
    user_id: userId, amount, note: '悬赏令广告费',
  })
































  return { newBounty: (pledge?.bounty_amount || 0) + amount }
}
































// ── 陪审团（Jury）──
































// 陪审团投票（upheld = 维持打卡有效 / overturned = 推翻打卡）
export async function castJuryVote(userId, disputeId, vote) {
  if (!['upheld', 'overturned'].includes(vote)) throw new Error('投票选项无效')
































  // 更新 dispute 的 ruling
  const { data, error } = await supabase
    .from('disputes')
    .update({ ruling: vote, ruled_by: userId, ruled_at: new Date().toISOString() })
    .eq('id', disputeId)
    .eq('ruling', 'pending')  // 只能投票 pending 状态的
    .select()
    .single()
  if (error) throw new Error(error.message || '投票失败')
































  // 当前 checkins 表使用 status 字段：valid / disputed / pending
  if (data) {
    const nextStatus = vote === 'upheld' ? 'valid' : 'pending'
    const { error: checkinError } = await supabase
      .from('checkins')
      .update({ status: nextStatus })
      .eq('id', data.checkin_id)
    if (checkinError) throw new Error(checkinError.message || '打卡状态更新失败')
  }
































  return data
}
































// 获取待裁定的质疑（陪审团待办）
export async function getPendingDisputes(limit = 20) {
  const { data, error } = await supabase
    .from('disputes')
    .select(`*, 
      checkins:checkin_id(*, pledges:pledge_id(title)),
      profiles:disputer_id(nickname, avatar_emoji)`)
    .eq('ruling', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message || '获取待裁定失败')
  return data || []
}
