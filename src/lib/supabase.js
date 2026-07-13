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

  const basePayload = {
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
    status: 'active',
  }

  const categoryPayload = pledge.categoryKey ? {
    category_key: pledge.categoryKey,
    category: pledge.categoryLabel,
    category_tag: pledge.categoryTag,
  } : {}

  let { data, error } = await supabase
    .from('pledges')
    .insert({ ...basePayload, ...categoryPayload })
    .select()
    .single()

  if (error && (String(error.message || '').includes('category') || String(error.code || '').includes('PGRST'))) {
    const retry = await supabase
      .from('pledges')
      .insert(basePayload)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) throw error

  // 扣除押注金币
  await addCoins(userId, -pledge.stakeCoins, 'stake', data.id, `立誓「${pledge.title}」押注`)

  return data
}
































export async function getMyPledges(userId) {
  const resolvedUserId = userId || (await supabase.auth.getUser()).data?.user?.id
  if (!resolvedUserId) return []

  const { data, error } = await supabase
    .from('pledges')
    .select('*, checkins(count), witnesses(count)')
    .eq('user_id', resolvedUserId)
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
































export async function getUserCompanionPledges(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('pledges')
    .select(`*, checkins(*)`)
    .eq('user_id', userId)
    .or('status.eq.active,status.eq.ongoing,status.is.null')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}



export async function getPublicPledges({ category, sort = 'created_at' } = {}) {
  let query = supabase
    .from('pledges')
    .select(`*, profiles:user_id(nickname, avatar_url), witnesses(count), checkins(count)`)
    .eq('is_public', true)
    .or('status.eq.active,status.is.null')
































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














export async function publishCompanionRecruit(pledgeId, userId) {
  const { data, error } = await supabase
    .from('pledges')
    .update({ is_public: true, updated_at: new Date().toISOString() })
    .eq('id', pledgeId)
    .eq('user_id', userId)
    .select('*, checkins(count), witnesses(count)')
    .single()
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
    await recordDonationLedger({
      userId: pledge.user_id,
      coins: charityCoins,
      orgName: pledge.charity_target,
      source: 'witness_pool',
      refId: pledge.id,
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
    await recordDonationLedger({
      userId,
      coins: pledge.stake_coins,
      orgName: pledge.charity_target,
      source: 'pledge_fail',
      refId: pledgeId,
      message: `誓言「${pledge.title}」未完成，押注捐出`,
    })
  }








  const witnessSettlement = await settleWitnessPool(pledge, success)
  return { status: finalStatus, success, witnessSettlement }
}
































// ============================================================
// CHECKINS（打卡）
// ============================================================
function isMissingOptionalCheckinColumn(error) {
  const msg = String(error?.message || '')
  return error?.code === 'PGRST204' || error?.code === '42703' || msg.includes('status') || msg.includes('proof_type') || msg.includes('schema cache')
}

export async function submitCheckin(userId, pledgeId, { imageFile, audioFile, note, mood }) {
  // 1. 上传证明材料（如果有）
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

  let audioUrl = null
  if (audioFile) {
    const ext = (audioFile.name?.split('.').pop() || 'webm').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'webm'
    const path = `${userId}/${pledgeId}/${Date.now()}-voice.${ext}`
    const { error: audioUploadError } = await supabase.storage
      .from('checkins')
      .upload(path, audioFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: audioFile.type || 'audio/webm'
      })
    if (audioUploadError) throw audioUploadError
    const { data: audioData } = supabase.storage.from('checkins').getPublicUrl(path)
    audioUrl = audioData.publicUrl
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
  const finalNote = [note, audioUrl ? `语音证明：${audioUrl}` : ''].filter(Boolean).join('\n')
  const baseCheckinPayload = {
    pledge_id: pledgeId,
    user_id: userId,
    day_num: dayNum,
    checkin_date: today,
    image_url: imageUrl,
    note: finalNote,
    mood,
    coins_earned: totalCoins,
    streak
  }
  const reviewPayload = {
    status: 'valid',
    proof_type: audioUrl ? (imageUrl ? 'mixed' : 'audio') : (imageUrl ? 'image' : 'text')
  }

  let { data: checkin, error } = await supabase
    .from('checkins')
    .insert({ ...baseCheckinPayload, ...reviewPayload })
    .select()
    .single()

  if (error && isMissingOptionalCheckinColumn(error)) {
    const retry = await supabase
      .from('checkins')
      .insert(baseCheckinPayload)
      .select()
      .single()
    checkin = retry.data
    error = retry.error
  }

  if (error) throw error

  if (audioUrl) {
    await supabase
      .from('checkins')
      .update({ audio_url: audioUrl, proof_type: imageUrl ? 'mixed' : 'audio' })
      .eq('id', checkin.id)
      .then(() => null)
  }
































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

  return { checkin: { ...checkin, audio_url: audioUrl }, totalCoins, streak, dayNum, settlement }
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
const COIN_FLOW_TEXT = {
  stake: { from: '用户余额', to: '誓言押注池' },
  stake_refund: { from: '誓言押注池', to: '用户余额' },
  checkin: { from: '守诺奖励池', to: '用户余额' },
  reward_streak: { from: '连续守诺奖励池', to: '用户余额' },
  reward_milestone: { from: '里程碑奖励池', to: '用户余额' },
  witness_stake: { from: '用户余额', to: '见证押注池' },
  witness_earn: { from: '见证押注池', to: '用户余额' },
  index_bet: { from: '用户余额', to: '指数交易池' },
  blind_bet: { from: '用户余额', to: '盲盒结缘池' },
  bounty: { from: '用户余额', to: '悬赏令池' },
  donate: { from: '用户余额', to: '公益项目' },
  charity_reward: { from: '善行奖励池', to: '用户余额' },
}

function buildCoinNote(type, note) {
  const flow = COIN_FLOW_TEXT[type]
  const parts = []
  const hasExplicitFlow = String(note || '').includes('来源：') || String(note || '').includes('去向：')
  if (note) parts.push(note)
  if (flow && !hasExplicitFlow) parts.push('来源：' + flow.from + '；去向：' + flow.to)
  return parts.join(' · ')
}

export async function addCoins(userId, amount, type, refId = null, note = null) {
  const value = Number(amount)
  if (!userId) throw new Error('缺少用户，无法记录金币流水')
  if (!Number.isFinite(value) || value === 0) throw new Error('金币流水金额无效')

  const { data, error } = await supabase.rpc('add_coins', {
    p_user_id: userId,
    p_amount: value,
    p_type: type,
    p_ref_id: refId,
    p_note: buildCoinNote(type, note)
  })
  if (error) throw error
  return data
}

async function recordDonationLedger({ userId, coins, orgName, source, refId = null, message }) {
  const amount = Number(coins || 0)
  if (!userId) throw new Error('缺少用户，无法记录公益去向')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('公益金币金额无效')
  const finalMessage = [message, '来源：金币账本；去向：' + (orgName || '公益项目')].filter(Boolean).join(' · ')
  const { data, error } = await supabase
    .from('donations')
    .insert({ user_id: userId, coins: amount, org_name: orgName, source, ref_id: refId, message: finalMessage })
    .select()
    .single()
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
  const amount = Number(coins)
  if (!userId) throw new Error('请先登录')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('捐赠金额无效')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('merit_coins,total_merit')
    .eq('id', userId)
    .single()
  if (profileError) throw profileError
  if ((profile?.merit_coins || 0) < amount) throw new Error('公益金币不足')

  await addCoins(userId, -amount, 'donate', null, '捐款给' + orgName)

  const data = await recordDonationLedger({
    userId,
    coins: amount,
    orgName,
    source: 'manual',
    message
  })

  await supabase
    .from('profiles')
    .update({ total_merit: (profile?.total_merit || 0) + amount, updated_at: new Date().toISOString() })
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
// CHARITY ACTION JURY
// ============================================================

export async function createCharityAction(userId, { type, text, proof, reward }) {
  if (!userId) throw new Error('请先登录')
  if (!text?.trim()) throw new Error('请写下你做了什么公益行动')
  const coins = Math.max(0, Math.min(100, Number(reward) || 0))
  const { data, error } = await supabase
    .from('charity_actions')
    .insert({
      user_id: userId,
      action_type: type,
      description: text.trim(),
      proof_text: proof || '未上传文件名',
      reward_coins: coins,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return mapCharityAction(data)
}

export async function getMyCharityActions(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('charity_actions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapCharityAction)
}

export async function getPendingCharityActions(limit = 30) {
  const { data, error } = await supabase
    .from('charity_actions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data || []).map(mapCharityAction)
}

function getCharityVerdictText(status, reward) {
  if (status === 'approved') {
    return {
      title: '善行已通过认定',
      body: '你提交的公益行动已通过陪审团确认，' + Number(reward || 0) + ' 公益金币已入账。'
    }
  }
  if (status === 'needs_revision') {
    return {
      title: '善行需要补充证明',
      body: '陪审团认为这次公益行动还需要补充证明。补齐后可以再次提交。'
    }
  }
  if (status === 'rejected') {
    return {
      title: '善行未通过认定',
      body: '这次公益行动暂未通过陪审团确认。你可以换一件更清楚、更可证明的小善行重新提交。'
    }
  }
  return null
}

export async function castCharityJuryVote(userId, actionId, vote) {
  if (!userId) throw new Error('请先登录')
  if (!['approve', 'reject', 'revise'].includes(vote)) throw new Error('确认选项无效')

  const { data: rpcRow, error: rpcError } = await supabase
    .rpc('cast_charity_jury_vote', { p_action_id: actionId, p_vote: vote })

  if (!rpcError) return mapCharityAction(rpcRow)

  const missingRpc = rpcError.code === '42883' || rpcError.code === 'PGRST202' || (rpcError.message || '').includes('cast_charity_jury_vote')
  if (!missingRpc) {
    const message = rpcError.message || '确认失败'
    if (message.includes('duplicate') || rpcError.code === '23505') throw new Error('你已经确认过这个案件')
    throw new Error(message)
  }

  const { data: action, error: actionError } = await supabase
    .from('charity_actions')
    .select('*')
    .eq('id', actionId)
    .single()
  if (actionError) throw actionError
  if (!action) throw new Error('善行案件不存在')
  if (action.user_id === userId) throw new Error('不能确认自己的善行')
  if (action.status !== 'pending') throw new Error('这个案件已经形成结论')

  const { error: voteError } = await supabase
    .from('charity_jury_votes')
    .insert({ action_id: actionId, juror_id: userId, vote })
  if (voteError) {
    if ((voteError.message || '').includes('duplicate') || voteError.code === '23505') throw new Error('你已经确认过这个案件')
    throw voteError
  }

  const { data: votes, error: votesError } = await supabase
    .from('charity_jury_votes')
    .select('vote')
    .eq('action_id', actionId)
  if (votesError) throw votesError

  const counts = { approve: 0, reject: 0, revise: 0 }
  ;(votes || []).forEach(item => { counts[item.vote] = (counts[item.vote] || 0) + 1 })
  let nextStatus = 'pending'
  if (counts.approve >= 2) nextStatus = 'approved'
  if (counts.reject >= 2) nextStatus = 'rejected'
  if (counts.revise >= 2) nextStatus = 'needs_revision'

  const patch = {
    approve_count: counts.approve,
    reject_count: counts.reject,
    revise_count: counts.revise,
    status: nextStatus,
    decided_at: nextStatus === 'pending' ? null : new Date().toISOString(),
  }

  const { data: updated, error: updateError } = await supabase
    .from('charity_actions')
    .update(patch)
    .eq('id', actionId)
    .select()
    .single()
  if (updateError) throw updateError

  if (nextStatus === 'approved' && Number(action.reward_coins || 0) > 0) {
    await addCoins(action.user_id, Number(action.reward_coins || 0), 'charity_reward', actionId, '善行通过陪审团确认')
      .catch(() => null)
  }

  if (nextStatus !== 'pending') {
    const verdict = getCharityVerdictText(nextStatus, action.reward_coins)
    if (verdict) {
      await createNotification({
        userId: action.user_id,
        actorId: userId,
        type: 'charity',
        title: verdict.title,
        body: verdict.body,
        metadata: { url: '/charity', actionId, status: nextStatus }
      }).catch(() => null)
    }
  }

  return mapCharityAction(updated)
}

function mapCharityAction(row) {
  if (!row) return row
  const statusMap = { pending: '待确认', approved: '已通过', rejected: '未通过', needs_revision: '需补充' }
  return {
    id: row.id,
    user_id: row.user_id,
    applicant_id: row.user_id,
    type: row.action_type || row.type,
    text: row.description || row.text,
    proof: row.proof_text || row.proof,
    reward: Number(row.reward_coins ?? row.reward ?? 0),
    status: statusMap[row.status] || row.status || '待确认',
    raw_status: row.status || 'pending',
    votes: {
      approve: Number(row.approve_count || 0),
      reject: Number(row.reject_count || 0),
      revise: Number(row.revise_count || 0),
    },
    created_at: row.created_at,
    decided_at: row.decided_at,
  }
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

  await addCoins(userId, -stakeCoins, 'stake', pledgeId, `见证押注：${type === 'trust' ? '支持' : '质疑'} · 来源：用户余额；去向：见证押注池`)
































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
export async function joinCompanionTeam(userId, pledgeId) {
  const pledge = await getPledgeDetail(pledgeId)
  if (!pledge?.is_public) throw new Error('该誓言还没有公开招募')
  if (pledge.user_id === userId) throw new Error('不能加入自己的誓言团')

  const activeMembers = (pledge.witnesses || []).filter(w => w.status === 'active')
  if (activeMembers.some(w => w.user_id === userId)) return activeMembers.find(w => w.user_id === userId)
  if (activeMembers.length >= 4) throw new Error('这个同行团已满员')

  const { data, error } = await supabase
    .from('witnesses')
    .insert({ pledge_id: pledgeId, user_id: userId, type: 'trust', stake_coins: 0 })
    .select('*, profiles:user_id(nickname, avatar_url)')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('你已经加入过这个同行团')
    throw new Error(error.message || '加入同行团失败')
  }
  return data
}

export async function getMyCompanionJoins(userId) {
  const { data, error } = await supabase
    .from('witnesses')
    .select('pledge_id')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw error
  return (data || []).map(row => row.pledge_id)
}

































// ============================================================
// 同行 V2：独立用户小队。小队不绑定某条誓言，打卡记录即每日落印。
// ============================================================
function isMissingCompanionV2Table(error) {
  const text = String(error?.message || '').toLowerCase()
  return error?.code === '42P01' || error?.code === 'PGRST205' || text.includes('companion_team')
}
function companionDate(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}
function hasDayCheckin(pledge, date) {
  return (pledge.checkins || []).some(item => item.checkin_date === date)
}
function normalizeTeamMember(member, pledges, date, repairs) {
  const active = pledges.filter(item => ['active', 'ongoing', null, undefined].includes(item.status))
  const doneToday = active.length > 0 && active.every(item => hasDayCheckin(item, date))
  const total = active.reduce((sum, item) => sum + Number(item.total_days || 0), 0)
  const finished = active.reduce((sum, item) => sum + Number(item.checkin_count || 0), 0)
  const latestRepair = repairs.find(item => item.user_id === member.user_id && item.status === 'active')
  return {
    ...member,
    name: member.profiles?.nickname || '同行者',
    avatar: member.profiles?.avatar_url || '',
    doneToday,
    activePledges: active,
    progress: total ? Math.min(100, Math.round(finished * 100 / total)) : 0,
    repair: latestRepair || null,
  }
}
export async function getCompanionDashboard(userId) {
  if (!userId) return { ready: true, teams: [], dashboard: null }
  const { data: memberships, error: membershipError } = await supabase
    .from('companion_team_members').select('team_id').eq('user_id', userId)
  if (membershipError) {
    if (isMissingCompanionV2Table(membershipError)) return { ready: false, teams: [], dashboard: null }
    throw membershipError
  }
  const teamIds = [...new Set((memberships || []).map(row => row.team_id))]
  if (!teamIds.length) return { ready: true, teams: [], dashboard: null }
  const { data: teams, error: teamError } = await supabase
    .from('companion_teams').select('*').in('id', teamIds).order('created_at', { ascending: true })
  if (teamError) throw teamError
  const selectedTeam = (teams || [])[0]
  const { data: rawMembers, error: membersError } = await supabase
    .from('companion_team_members')
    .select('team_id,user_id,role,joined_at,profiles:user_id(nickname,avatar_url)')
    .eq('team_id', selectedTeam.id)
    .order('joined_at', { ascending: true })
  if (membersError) throw membersError
  const memberIds = (rawMembers || []).map(row => row.user_id)
  const { data: pledges, error: pledgeError } = await supabase
    .from('pledges')
    .select('id,user_id,title,period,total_days,checkin_count,current_streak,status,category_key,category,category_tag,start_date,end_date,checkins(checkin_date,created_at)')
    .in('user_id', memberIds)
  if (pledgeError) throw pledgeError
  let { data: repairs, error: repairsError } = await supabase
    .from('companion_repairs').select('*').eq('team_id', selectedTeam.id).eq('status', 'active')
  if (repairsError) throw repairsError
  const today = companionDate()
  const byUser = (pledges || []).reduce((result, pledge) => {
    if (!result[pledge.user_id]) result[pledge.user_id] = []
    result[pledge.user_id].push(pledge)
    return result
  }, {})

  const yesterday = companionDate(-1)
  const currentUserPledges = byUser[userId] || []
  const missedYesterday = currentUserPledges.filter(item => ['active', 'ongoing', null, undefined].includes(item.status) && (!item.start_date || item.start_date <= yesterday) && (!item.end_date || item.end_date >= yesterday)).some(item => !hasDayCheckin(item, yesterday))
  const hasOwnRepair = (repairs || []).some(item => item.user_id === userId && item.status === 'active')
  if (missedYesterday && !hasOwnRepair) {
    const { data: createdRepair } = await supabase
      .from('companion_repairs')
      .insert({ team_id: selectedTeam.id, user_id: userId, plan: '补做昨日未完成的诺言', repair_date: today })
      .select().maybeSingle()
    if (createdRepair) repairs = [...(repairs || []), createdRepair]
  }

  const members = (rawMembers || []).map(member => normalizeTeamMember(member, byUser[member.user_id] || [], today, repairs || []))
  const { data: notes, error: notesError } = await supabase
    .from('companion_team_notes')
    .select('*, author:author_id(nickname), recipient:recipient_id(nickname)')
    .eq('team_id', selectedTeam.id)
    .eq('note_date', today)
    .order('created_at', { ascending: false })
    .limit(20)
  if (notesError) throw notesError
  const { data: helpRequests, error: helpError } = await supabase
    .from('companion_help_requests')
    .select('*, requester:requester_id(nickname), responder:responder_id(nickname)')
    .eq('team_id', selectedTeam.id)
    .in('status', ['open', 'accepted'])
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (helpError) throw helpError

  const sevenDays = Array.from({ length: 7 }, (_, index) => companionDate(index - 6)).map(date => {
    const eligible = members.filter(member => member.activePledges.some(pledge => !pledge.start_date || pledge.start_date <= date))
    const seals = eligible.filter(member => member.activePledges.filter(pledge => !pledge.start_date || pledge.start_date <= date).every(pledge => hasDayCheckin(pledge, date))).length
    return { date, seals, total: eligible.length, full: eligible.length > 1 && seals === eligible.length }
  })
  const allCheckins = (pledges || []).flatMap(pledge => (pledge.checkins || []).filter(item => item.checkin_date === today).map(item => ({ ...item, user_id: pledge.user_id })))
  const lastCheckin = [...allCheckins].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
  const ownPledges = byUser[userId] || []
  const ownPrimary = ownPledges.find(item => ['active', 'ongoing', null, undefined].includes(item.status))
  let peerRows = []
  if (ownPrimary?.category_key) {
    const { data } = await supabase
      .from('pledges')
      .select('user_id,total_days,checkin_count,period,checkins(checkin_date)')
      .eq('is_public', true)
      .eq('category_key', ownPrimary.category_key)
      .eq('period', ownPrimary.period)
      .or('status.eq.active,status.eq.ongoing,status.is.null')
      .limit(500)
    peerRows = data || []
  }
  const ownRate = ownPrimary?.total_days ? Number(ownPrimary.checkin_count || 0) / Number(ownPrimary.total_days) : 0
  const comparable = peerRows.filter(row => row.user_id !== userId && Number(row.total_days || 0) > 0)
  const cohortRows = peerRows.filter(row => Number(row.total_days || 0) > 0).slice(0, 30)
  const completedToday = cohortRows.filter(row => (row.checkins || []).some(checkin => checkin.checkin_date === companionDate())).length + (ownPrimary && (ownPrimary.checkins || []).some(checkin => checkin.checkin_date === companionDate()) ? 1 : 0)
  const ahead = comparable.filter(row => Number(row.checkin_count || 0) / Number(row.total_days || 1) > ownRate).length
  const leadPercent = comparable.length ? Math.round((comparable.length - ahead) * 100 / comparable.length) : 0

  return {
    ready: true,
    teams: teams || [],
    dashboard: {
      team: selectedTeam,
      members,
      notes: notes || [],
      repairs: repairs || [],
      helpRequests: helpRequests || [],
      sevenDays,
      lastWriterId: members.length > 0 && members.every(member => member.doneToday) ? lastCheckin?.user_id || null : null,
      ownPledges,
      primaryPledge: ownPrimary || null,
      peer: { population: comparable.length + 1, leadPercent, ahead, cohort: { population: Math.max(1, cohortRows.length + 1), completedToday: Math.min(cohortRows.length + 1, completedToday), remainingToday: Math.max(0, cohortRows.length + 1 - completedToday) } },
    },
  }
}
export async function createCompanionTeam(userId, name = '同行小队') {
  const { data: team, error } = await supabase
    .from('companion_teams').insert({ owner_id: userId, name }).select().single()
  if (error) throw error
  const { error: memberError } = await supabase
    .from('companion_team_members').insert({ team_id: team.id, user_id: userId, role: 'owner' })
  if (memberError) throw memberError
  return team
}
export async function joinCompanionTeamByCode(userId, inviteCode) {
  const code = String(inviteCode || '').trim().toUpperCase()
  if (!code) throw new Error('请输入小队邀请码')
  const { data: team, error } = await supabase
    .from('companion_teams').select('*').eq('invite_code', code).maybeSingle()
  if (error || !team) throw new Error('没有找到这支同行小队')
  const { data: existing } = await supabase
    .from('companion_team_members').select('user_id').eq('team_id', team.id)
  if ((existing || []).some(row => row.user_id === userId)) return team
  if ((existing || []).length >= team.capacity) throw new Error('这支小队已经满员')
  const { error: joinError } = await supabase
    .from('companion_team_members').insert({ team_id: team.id, user_id: userId, role: 'member' })
  if (joinError) throw joinError
  return team
}
export async function leaveCompanionNote(userId, { teamId, recipientId = null, body, kind = 'note' }) {
  const content = String(body || '').trim().slice(0, 50)
  if (!content) throw new Error('留笺内容不能为空')
  const { data, error } = await supabase
    .from('companion_team_notes')
    .insert({ team_id: teamId, author_id: userId, recipient_id: recipientId, body: content, kind, note_date: companionDate() })
    .select().single()
  if (error) throw error
  return data
}
export async function startCompanionRepair(userId, { teamId, plan }) {
  const { data, error } = await supabase
    .from('companion_repairs')
    .insert({ team_id: teamId, user_id: userId, plan: String(plan || '').trim().slice(0, 80), repair_date: companionDate() })
    .select().single()
  if (error) throw error
  return data
}
export async function requestCompanionHelp(userId, { teamId, helpType }) {
  const { data, error } = await supabase
    .from('companion_help_requests')
    .insert({ team_id: teamId, requester_id: userId, help_type: helpType })
    .select().single()
  if (error) throw error
  return data
}
export async function respondToCompanionHelp(userId, requestId) {
  const { data, error } = await supabase
    .from('companion_help_requests')
    .update({ status: 'accepted', responder_id: userId })
    .eq('id', requestId).eq('status', 'open').select().single()
  if (error) throw error
  return data
}

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

// 个人中心“押注记录”使用：只读取当前用户的见证押注。
export async function getMyWitnessBets(userId, limit = 30) {
  const { data, error } = await supabase
    .from('witnesses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message || '获取见证押注记录失败')
  return data || []
}
































// ── 指数基金（Index Funds）──
































// 获取五类誓言指数
export async function getIndexFunds() {
  const order = ['HEALTH', 'STUDY', 'HABIT', 'FINANCE', 'CREATIVE']
  const { data, error } = await supabase
    .from('index_funds')
    .select('*')
    .in('code', order)
  if (error) throw new Error(error.message || '获取指数失败')
  return (data || []).sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code))
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
  // 3. 扣金币并写统一流水
  await addCoins(userId, -amount, 'stake', indexCode, `指数下注：${indexCode} ${direction === 'believe' ? '看多' : '看空'} · 来源：用户余额；去向：指数交易池`)
































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
  // 1. 扣金币并写统一流水
  await addCoins(userId, -totalAmount, 'stake', null, `盲盒结缘：机选${count}个誓言 · 来源：用户余额；去向：盲盒结缘池`)
































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
  // 扣金币并写统一流水
  await addCoins(userId, -amount, 'stake', pledgeId, '悬赏令广告费 · 来源：用户余额；去向：悬赏令池')
































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

// ============================================================
// NOTIFICATIONS（消息中心）
// ============================================================
function isMissingNotificationsTable(error) {
  const msg = String(error?.message || '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || msg.includes('notifications') || msg.includes('schema cache')
}

export async function createNotification({ userId, actorId, pledgeId = null, type = 'system', title, body = '', metadata = {} }) {
  if (!userId || !actorId || userId === actorId) return { delivered: false, reason: 'invalid_recipient' }
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, actor_id: actorId, pledge_id: pledgeId, type, title, body, metadata })
    .select()
    .single()
  if (error) {
    if (isMissingNotificationsTable(error)) return { delivered: false, reason: 'missing_table' }
    throw error
  }
  return { delivered: true, data }
}


export async function sendUserNotification({ userId, actorId, pledgeId = null, type = 'system', title, body = '', metadata = {}, url = '/notifications' }) {
  if (!userId || !actorId || userId === actorId) return { delivered: false, reason: 'invalid_recipient' }

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (token) {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          toUserId: userId,
          pledgeId,
          type,
          title,
          body,
          metadata,
          url: metadata?.url || url,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (response.ok && result?.ok) {
        return { delivered: true, pushed: result.push?.sent > 0, data: result.notification, result }
      }
      if (result?.error && result.error !== 'missing_server_config') {
        console.warn('sendUserNotification failed, falling back to in-app notification:', result)
      }
    }
  } catch (error) {
    console.warn('sendUserNotification fallback:', error)
  }

  return createNotification({ userId, actorId, pledgeId, type, title, body, metadata: { ...metadata, url } })
}

export async function getNotifications(userId) {
  if (!userId) return { items: [], ready: false }
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80)
  if (error) {
    if (isMissingNotificationsTable(error)) return { items: [], ready: false }
    throw error
  }
  return { items: data || [], ready: true }
}

export async function markNotificationRead(userId, notificationId) {
  if (!userId || !notificationId) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
  if (error && !isMissingNotificationsTable(error)) throw error
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error && !isMissingNotificationsTable(error)) throw error
}

export async function deleteNotification(userId, notificationId) {
  if (!userId || !notificationId) return { deleted: false }
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId)
  if (error) {
    if (isMissingNotificationsTable(error)) return { deleted: false, ready: false }
    throw error
  }
  return { deleted: true, ready: true }
}

export function subscribeToNotifications(userId, onInsert) {
  if (!userId) return null
  const channel = supabase
    .channel('notifications:' + userId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, payload => onInsert?.(payload.new))
    .subscribe()
  return channel
}

// ============================================================
// PUSH SUBSCRIPTIONS（浏览器推送订阅）
// ============================================================
function isMissingPushTable(error) {
  const msg = String(error?.message || '').toLowerCase()
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || msg.includes('schema cache')
    || msg.includes('could not find the table')
}

export async function savePushSubscription(userId, subscription, userAgent = '') {
  if (!userId || !subscription?.endpoint) return { saved: false, reason: 'invalid_subscription' }
  const json = subscription.toJSON ? subscription.toJSON() : subscription
  const row = {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: userAgent,
    enabled: true,
    updated_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .rpc('save_push_subscription', {
        p_endpoint: row.endpoint,
        p_p256dh: row.p256dh,
        p_auth: row.auth,
        p_user_agent: row.user_agent,
      })
    if (!error) return { saved: true, data }
    if (!isMissingPushTable(error) && error?.code !== 'PGRST202') throw error
  } catch (error) {
    if (!isMissingPushTable(error) && error?.code !== 'PGRST202') throw error
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select()
    .single()
  if (error) {
    if (isMissingPushTable(error)) return { saved: false, reason: 'missing_table' }
    if (error?.code === '42501' || String(error?.message || '').toLowerCase().includes('row-level security')) {
      return { saved: false, reason: 'subscription_claim_blocked' }
    }
    throw error
  }
  return { saved: true, data }
}

export async function getPushSubscriptionStatus(userId) {
  if (!userId) return { ready: false, subscribed: false }
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, enabled, updated_at')
    .eq('user_id', userId)
    .eq('enabled', true)
    .limit(1)
  if (error) {
    if (isMissingPushTable(error)) return { ready: false, subscribed: false }
    throw error
  }
  return { ready: true, subscribed: (data || []).length > 0, item: data?.[0] || null }
}

export async function disablePushSubscription(userId, endpoint) {
  if (!userId || !endpoint) return
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
  if (error && !isMissingPushTable(error)) throw error
}



async function ensureCanonicalCompanionTeam(userId) {
  const { data: current } = await supabase.from('companion_team_members').select('team_id').eq('user_id', userId).limit(1)
  if (current?.length) return current[0].team_id

  const { data: pledge } = await supabase
    .from('pledges')
    .select('id,title,user_id')
    .eq('user_id', userId)
    .in('status', ['active', 'ongoing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!pledge) return null

  const { data: team, error: teamError } = await supabase
    .from('companion_teams')
    .insert({ owner_id: userId, name: (pledge.title || '同行') + '小队' })
    .select()
    .single()
  if (teamError && teamError.code !== '23505') throw teamError
  if (!team) {
    const { data: retry } = await supabase.from('companion_team_members').select('team_id').eq('user_id', userId).limit(1)
    return retry?.[0]?.team_id || null
  }

  const { data: witnesses } = await supabase
    .from('witnesses')
    .select('user_id')
    .eq('pledge_id', pledge.id)
    .eq('status', 'active')
    .limit(4)
  const memberIds = [...new Set([userId, ...(witnesses || []).map(item => item.user_id).filter(Boolean)])].slice(0, 5)
  const { error: memberError } = await supabase.from('companion_team_members').insert(memberIds.map(memberId => ({
    team_id: team.id, user_id: memberId, role: memberId === userId ? 'owner' : 'member'
  })))
  if (memberError && memberError.code !== '23505') throw memberError
  return team.id
}

export async function getCompanionState(userId) {
  if (!userId) return { team: null, members: [], notes: [], peer: null, primaryPledge: null }
  const teamId = await ensureCanonicalCompanionTeam(userId)
  if (!teamId) return { team: null, members: [], notes: [], peer: null, primaryPledge: null }

  const [{ data: team }, { data: rawMembers }] = await Promise.all([
    supabase.from('companion_teams').select('*').eq('id', teamId).single(),
    supabase.from('companion_team_members').select('team_id,user_id,role,joined_at,profiles:user_id(nickname,avatar_url)').eq('team_id', teamId).order('joined_at', { ascending: true }),
  ])
  const memberIds = (rawMembers || []).map(item => item.user_id)
  const { data: pledges } = await supabase
    .from('pledges')
    .select('id,user_id,title,total_days,checkin_count,current_streak,status,start_date,end_date,category_key,period,checkins(checkin_date,created_at)')
    .in('user_id', memberIds)

  const today = new Date().toISOString().slice(0, 10)
  const activePledges = (pledges || []).filter(item => ['active', 'ongoing', null, undefined].includes(item.status))
  const byUser = activePledges.reduce((map, item) => {
    if (!map[item.user_id]) map[item.user_id] = []
    map[item.user_id].push(item)
    return map
  }, {})
  const members = (rawMembers || []).map(member => {
    const own = byUser[member.user_id] || []
    const doneToday = own.length > 0 && own.every(item => (item.checkins || []).some(checkin => checkin.checkin_date === today))
    const totalDays = own.reduce((sum, item) => sum + Number(item.total_days || 0), 0)
    const completedDays = own.reduce((sum, item) => sum + Number(item.checkin_count || 0), 0)
    return {
      ...member,
      user_id: member.user_id,
      name: member.profiles?.nickname || '同行者',
      doneToday,
      progress: totalDays ? Math.min(100, Math.round(completedDays * 100 / totalDays)) : 0,
      pledges: own,
    }
  })
  const ownPledges = byUser[userId] || []
  const primaryPledge = ownPledges[0] || null
  const self = members.find(member => member.user_id === userId)
  const { data: notes } = await supabase
    .from('companion_team_notes')
    .select('id,team_id,author_id,recipient_id,body,kind,note_date,created_at,author:author_id(nickname),recipient:recipient_id(nickname)')
    .eq('team_id', teamId)
    .eq('note_date', today)
    .order('created_at', { ascending: false })
    .limit(20)

  let peerRows = []
  if (primaryPledge?.category_key) {
    const { data } = await supabase
      .from('pledges')
      .select('user_id,total_days,checkins(checkin_date)')
      .eq('is_public', true)
      .eq('category_key', primaryPledge.category_key)
      .eq('period', primaryPledge.period)
      .in('status', ['active', 'ongoing'])
      .limit(30)
    peerRows = data || []
  }
  const cohort = peerRows.filter(item => item.user_id !== userId)
  const peerCompleted = cohort.filter(item => (item.checkins || []).some(checkin => checkin.checkin_date === today)).length
  const selfCompleted = self?.doneToday ? 1 : 0
  const population = cohort.length + 1

  return {
    team,
    members,
    notes: notes || [],
    primaryPledge,
    lastWriterId: members.length > 0 && members.every(member => member.doneToday) ? members.filter(member => member.doneToday).slice(-1)[0]?.user_id : null,
    peer: { population, completedToday: peerCompleted + selfCompleted, remainingToday: Math.max(0, population - peerCompleted - selfCompleted) },
  }
}

export async function sendCompanionNote(userId, { teamId, recipientId, body }) {
  const content = String(body || '').trim().slice(0, 50)
  if (!teamId || !recipientId || !content) throw new Error('留笺信息不完整')
  const { data, error } = await supabase
    .from('companion_team_notes')
    .insert({ team_id: teamId, author_id: userId, recipient_id: recipientId, body: content, kind: 'note', note_date: new Date().toISOString().slice(0, 10) })
    .select()
    .single()
  if (error) throw error
  try {
    await sendUserNotification({
      userId: recipientId,
      actorId: userId,
      type: 'companion_echo',
      title: '同行者给你留了一笺',
      body: content,
      metadata: { label: content, teamId, url: '/companions' },
      url: '/companions',
    })
  } catch {}
  return data
}
