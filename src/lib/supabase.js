// src/lib/supabase.js
// 把下面两行换成你自己的 Supabase 项目地址和 anon key
// 在 Supabase Dashboard → Project Settings → API 里找到

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dqohpzvwjgiagxfnlice.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxb2hwenZ3amdpYWd4Zm5saWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjAwMzAsImV4cCI6MjA5NzMzNjAzMH0.GQQXIR_5AD1qUW2rjS5I0Hg-EAoDNpuCPXkW9tXP8d8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================================
// 错误标准化 —— Supabase 错误对象有时是 AuthApiError，有时是普通对象
// 统一转成带 message 的标准 Error，保证 catch(err) { err.message } 始终有值
// ============================================================
function toError(error) {
  if (!error) return new Error('未知错误')
  if (error instanceof Error) return error
  const msg = error.message || error.msg || error.error_description
    || error.error || JSON.stringify(error)
  const e = new Error(msg)
  e.status  = error.status  || error.code
  e.code    = error.code    || error.error_code
  return e
}

function throwIf(error) {
  if (error) throw toError(error)
}

// ============================================================
// AUTH
// ============================================================
export async function signUp({ email, password, nickname }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } }
  })
  throwIf(error)
  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  throwIf(error)
  return data
}

// 游客模式：匿名登录（Supabase 需开启 Anonymous sign-ins）
export async function signInAnonymous() {
  const { data, error } = await supabase.auth.signInAnonymously()
  throwIf(error)
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
  throwIf(error)
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  throwIf(error)
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
  throwIf(error)

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
  throwIf(error)
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
  throwIf(error)
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
  throwIf(error)
  return data
}

// 广场：已完成的公开誓言（用于成功经验 tab）
export async function getCompletedPledges({ limit = 20 } = {}) {
  const { data, error } = await supabase
    .from('pledges')
    .select(`*, profiles:user_id(nickname, avatar_url)`)
    .eq('is_public', true)
    .eq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(limit)
  throwIf(error)
  return data
}
export async function completePledge(pledgeId, userId, success) {
  const pledge = await getPledgeDetail(pledgeId)
  const status = success ? 'done' : 'fail'

  await supabase
    .from('pledges')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', pledgeId)

  if (success) {
    // 成功：退还押注
    await addCoins(userId, pledge.stake_coins, 'stake_refund', pledgeId, `誓言达成，押注返还`)
    // 更新完成计数和额度
    const profile = await getProfile(userId)
    const newCount = profile.completed_count + 1
    const newLimit = newCount >= 6 ? 9 : newCount >= 3 ? 7 : newCount >= 1 ? 4 : 3
    await updateProfile(userId, {
      completed_count: newCount,
      quota_limit: newLimit
    })
  } else {
    // 失败：押注捐出
    await supabase.from('donations').insert({
      user_id: userId,
      coins: pledge.stake_coins,
      org_name: pledge.charity_target,
      source: 'pledge_fail',
      ref_id: pledgeId,
      message: `誓言「${pledge.title}」未完成，押注捐出`
    })
    // 冷静期3天
    const cooldownUntil = new Date()
    cooldownUntil.setDate(cooldownUntil.getDate() + 3)
    await supabase
      .from('pledges')
      .update({ status: 'cooldown', cooldown_until: cooldownUntil.toISOString() })
      .eq('id', pledgeId)
  }
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
  throwIf(error)

  // 4. 更新誓言统计
  const newCheckinCount = pledge.checkin_count + 1
  const newMaxStreak = Math.max(pledge.max_streak, streak)
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

  return { checkin, totalCoins, streak, dayNum }
}

export async function getCheckins(pledgeId) {
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('pledge_id', pledgeId)
    .order('checkin_date', { ascending: true })
  throwIf(error)
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
  throwIf(error)
  return data
}

export async function getCoinLedger(userId, limit = 20) {
  const { data, error } = await supabase
    .from('coin_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  throwIf(error)
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
  throwIf(error)

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
  throwIf(error)
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
