// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getCoinLedger, getDonations, getMeritTitle, getMyPledges,
         getMyWitnessBets, getMyBlindBets, getMyIndexBets,
         updateProfile, signOut } from '../lib/supabase'
import { format, parseISO, differenceInDays } from 'date-fns'


const DEFAULT_REMINDER = { enabled: true, time: '20:30', style: 'gentle' }

const INDEX_BET_LABELS = {
  HEALTH: '健康运动',
  STUDY: '学习成长',
  HABIT: '生活习惯',
  FINANCE: '财务目标',
  CREATIVE: '创作输出',
}
const INDEX_DIRECTION_LABELS = { believe: '看多', doubt: '看空', up: '看涨', down: '看跌' }
const INDEX_STATUS_LABELS = { active: '持仓中', won: '赢了', lost: '输了', settled: '持平返还' }

function parseBlindSplits(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try { return JSON.parse(value) } catch { return [] }
}

function buildBetRecords(witnessRows, blindRows, indexRows) {
  const safeBlindRows = blindRows || []
  const isBlindWitness = (witness) => safeBlindRows.some((blind) => {
    const timeGap = Math.abs(new Date(blind.created_at).getTime() - new Date(witness.created_at).getTime())
    return timeGap < 90000 && parseBlindSplits(blind.split_to).some((split) =>
      (split.pledge_id === witness.pledge_id || split.pledgeId === witness.pledge_id) &&
      Number(split.amount) === Number(witness.stake_coins)
    )
  })

  const witnessRecords = (witnessRows || [])
    .filter((witness) => !isBlindWitness(witness))
    .map((witness) => ({
      id: `witness-${witness.id}`,
      category: 'witness',
      emoji: witness.type === 'doubt' ? '⚖️' : '👁️',
      title: witness.type === 'doubt' ? '质疑见证押注' : '支持见证押注',
      detail: `押注 ${Number(witness.stake_coins || 0)} 金币`,
      amount: Number(witness.stake_coins || 0),
      createdAt: witness.created_at,
      status: '已押注',
    }))

  const blindRecords = safeBlindRows.map((blind) => ({
    id: `blind-${blind.id}`,
    category: 'blind',
    emoji: '🎁',
    title: '盲盒结缘',
    detail: `${parseBlindSplits(blind.split_to).length || '多'} 份结缘押注`,
    amount: Number(blind.total_amount || 0),
    createdAt: blind.created_at,
    status: '已押注',
  }))

  const indexRecords = (indexRows || []).map((bet) => {
    const settled = (bet.status && bet.status !== 'active') || bet.settled_at
    const payout = Number(bet.payout || 0)
    return {
      id: `index-${bet.id}`,
      category: 'index',
      emoji: '📈',
      title: `${INDEX_BET_LABELS[bet.index_code] || bet.index_code || '自律'}指数`,
      detail: `${INDEX_DIRECTION_LABELS[bet.direction] || bet.direction || '持仓'} · 赔率 ${bet.odds_at_bet || '-'}${settled && payout > 0 ? ` · 返还 ${payout}` : ''}`,
      amount: Number(bet.amount || 0),
      createdAt: bet.created_at,
      status: INDEX_STATUS_LABELS[bet.status] || (settled ? '已结算' : '持仓中'),
    }
  })

  return [...witnessRecords, ...blindRecords, ...indexRecords]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
function reminderStoreKey(userId) { return 'ynq_reminders_' + (userId || 'guest') }
function readReminderStore(userId) {
  if (typeof window === 'undefined') return { global: DEFAULT_REMINDER, pledges: {} }
  try {
    const raw = window.localStorage.getItem(reminderStoreKey(userId))
    const parsed = raw ? JSON.parse(raw) : {}
    return { global: { ...DEFAULT_REMINDER, ...(parsed.global || {}) }, pledges: parsed.pledges || {} }
  } catch {
    return { global: DEFAULT_REMINDER, pledges: {} }
  }
}
function writeReminderStore(userId, store) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(reminderStoreKey(userId), JSON.stringify(store))
}
function getReminderForPledge(userId, pledgeId) {
  const store = readReminderStore(userId)
  return { ...store.global, ...(store.pledges?.[pledgeId] || {}) }
}
function saveReminderForPledge(userId, pledgeId, reminder) {
  const store = readReminderStore(userId)
  const next = { ...store, pledges: { ...(store.pledges || {}), [pledgeId]: { ...reminder } } }
  writeReminderStore(userId, next)
  return next.pledges[pledgeId]
}
function saveGlobalReminder(userId, reminder) {
  const store = readReminderStore(userId)
  const next = { ...store, global: { ...store.global, ...reminder } }
  writeReminderStore(userId, next)
  return next.global
}
function reminderLabel(reminder) {
  if (!reminder?.enabled) return '提醒已关闭'
  return '提醒 ' + (reminder.time || DEFAULT_REMINDER.time)
}

async function syncBrowserReminder(reminder, pledgeTitle) {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return
  if (reminder?.enabled) {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') return
    const [hour, minute] = (reminder.time || DEFAULT_REMINDER.time).split(':').map(Number)
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    ;(reg?.active || navigator.serviceWorker.controller)?.postMessage({
      type: 'SCHEDULE_REMINDER',
      payload: { hour, minute, pledgeTitle }
    })
  } else {
    const reg = await navigator.serviceWorker.ready.catch(() => null)
    ;(reg?.active || navigator.serviceWorker.controller)?.postMessage({ type: 'CANCEL_REMINDER' })
  }
}

/* ── 常量 ── */
const AVA_COLORS = ['#C8922A','#3B7A4A','#3A6A9A','#8A5A2A','#6A4A8A','#C84040','#2A7A7A']
function avaColor(str) {
  if (!str) return AVA_COLORS[0]
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF
  return AVA_COLORS[Math.abs(h) % AVA_COLORS.length]
}

// 可选 emoji 头像
const EMOJI_LIST = [
  '🌱','🌿','🔥','🌊','✨','🪷','🎯','🏆','🎮','📚',
  '🏃','🧘','🌅','💪','🎨','🎵','🦋','🐉','⚡','🌙',
  '🦅','🐺','🌸','🍀','🎸','🏔','🌏','💎','🦁','🐯',
]

// 推荐的一句话签名
const BIO_SUGGESTIONS = [
  '每一天都是新的开始 🌅',
  '言出必行，知行合一 💪',
  '慢慢来，比较快 🌿',
  '只要坚持，就有奇迹 ✨',
  '做自己最好的见证者 👁',
  '用行动证明，而不是语言 🎯',
]

const TYPE_LABELS = {
  checkin:'打卡奖励', stake:'立誓押注', stake_refund:'誓言完成返还',
  donate:'公益捐款', reward_streak:'连续奖励', reward_milestone:'里程碑奖励',
  reward_team:'团队奖励', gift_register:'注册赠送',
  witness_earn:'见证收益', question_cost:'提问消耗',
}
const STATUS_LABEL = { active:'进行中', done:'已完成', fail:'未完成', cooldown:'冷静期', abandoned:'已放弃' }
const STATUS_COLOR = { active:'#C8922A', done:'#3B7A4A', fail:'#C84040', cooldown:'#9A8A70', abandoned:'#B8A88A' }
const PERIOD_LABEL = { week:'周', month:'月', season:'季', year:'年' }

/* ── 编辑弹窗 ── */
function EditSheet({ profile, onSave, onClose }) {
  const [nickname, setNickname] = useState(profile?.nickname || '')
  const [bio,      setBio]      = useState(profile?.bio      || '')
  const [emoji,    setEmoji]    = useState(profile?.avatar_emoji || '🌱')
  const [saving,   setSaving]   = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  async function handleSave() {
    if (!nickname.trim()) return
    setSaving(true)
    await onSave({ nickname: nickname.trim(), bio: bio.trim(), avatar_emoji: emoji })
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', flexDirection:'column',
      justifyContent:'flex-end' }}>
      {/* 遮罩 */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)' }}
        onClick={onClose} />

      {/* 弹窗主体 */}
      <div style={{ position:'relative', background:'#fff', borderRadius:'20px 20px 0 0',
        padding:'20px 20px calc(20px + env(safe-area-inset-bottom))',
        maxHeight:'90vh', overflowY:'auto' }}>

        {/* 标题行 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>编辑个人资料</div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            fontSize:22, color:'#9A8A70', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* 头像选择 */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div onClick={() => setEmojiOpen(!emojiOpen)}
            style={{ width:72, height:72, borderRadius:'50%', background: avaColor(nickname || '🌱'),
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              fontSize:36, cursor:'pointer', position:'relative',
              boxShadow:'0 4px 16px rgba(0,0,0,.12)' }}>
            {emoji}
            <div style={{ position:'absolute', bottom:0, right:0, width:22, height:22,
              borderRadius:'50%', background:'#C8922A', border:'2px solid #fff',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, color:'#fff' }}>✎</div>
          </div>
          <div style={{ fontSize:11, color:'#9A8A70', marginTop:6 }}>点击更换头像</div>

          {/* emoji 选择网格 */}
          {emojiOpen && (
            <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'repeat(6,1fr)',
              gap:8, background:'#FAF7F2', borderRadius:12, padding:12 }}>
              {EMOJI_LIST.map(e => (
                <div key={e} onClick={() => { setEmoji(e); setEmojiOpen(false) }}
                  style={{ fontSize:28, textAlign:'center', padding:'6px 0', borderRadius:8,
                    cursor:'pointer', background: emoji === e ? '#FDF3E0' : 'transparent',
                    border: emoji === e ? '1.5px solid #C8922A' : '1.5px solid transparent' }}>
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 昵称 */}
        <div style={{ marginBottom:16 }}>
          <div style={S.label}>昵称 <span style={{ color:'#C84040' }}>*</span></div>
          <input value={nickname} onChange={e => setNickname(e.target.value)}
            maxLength={12} placeholder="给自己起个名字"
            style={S.input} />
          <div style={{ fontSize:11, color:'#B8A88A', marginTop:4, textAlign:'right' }}>
            {nickname.length}/12
          </div>
        </div>

        {/* 自我介绍 */}
        <div style={{ marginBottom:16 }}>
          <div style={S.label}>一句话介绍</div>
          <textarea value={bio} onChange={e => setBio(e.target.value)}
            maxLength={60} placeholder="用一句话介绍自己，让同行者更了解你…"
            style={{ ...S.input, minHeight:72, resize:'none', lineHeight:1.6 }} />
          <div style={{ fontSize:11, color:'#B8A88A', marginTop:4, textAlign:'right' }}>
            {bio.length}/60
          </div>
          {/* 快捷签名 */}
          <div style={{ fontSize:11, color:'#9A8A70', marginBottom:6 }}>快速选择：</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {BIO_SUGGESTIONS.map(s => (
              <div key={s} onClick={() => setBio(s)}
                style={{ fontSize:11, color: bio === s ? '#7A5A18' : '#7A6A50',
                  background: bio === s ? '#FDF3E0' : '#F5F0E8',
                  border: bio === s ? '1px solid #C8922A' : '1px solid transparent',
                  borderRadius:20, padding:'5px 10px', cursor:'pointer' }}>
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* 保存按钮 */}
        <button onClick={handleSave} disabled={saving || !nickname.trim()}
          style={{ width:'100%', padding:'13px 0', background: saving ? '#E0D5C0' : '#C8922A',
            color:'#fff', border:'none', borderRadius:12, fontSize:15,
            fontWeight:700, cursor: saving ? 'default' : 'pointer',
            fontFamily:'Noto Sans SC,sans-serif',
            boxShadow: saving ? 'none' : '0 4px 16px rgba(200,146,42,.35)' }}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}

/* ── 主页面 ── */
export default function ProfilePage() {
  const { profile, session, refreshProfile } = useAuth()
  const nav = useNavigate()

  const [tab, setTab]             = useState('home')
  const [pledges, setPledges]     = useState([])
  const [ledger, setLedger]       = useState([])
  const [donations, setDonations] = useState([])
  const [betRecords, setBetRecords] = useState([])
  const [betFilter, setBetFilter] = useState('all')
  const [loading, setLoading]     = useState(true)
  const [editOpen, setEditOpen]   = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)
  const [toast, setToast]         = useState(null)
  const userId = session?.user?.id
  const [globalReminder, setGlobalReminder] = useState(DEFAULT_REMINDER)

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    setGlobalReminder(readReminderStore(uid).global)
    setLoading(true)
    Promise.all([getMyPledges(uid), getCoinLedger(uid, 50), getDonations(uid)])
      .then(([p, l, d]) => { setPledges(p || []); setLedger(l || []); setDonations(d || []) })
      .finally(() => setLoading(false))

    Promise.allSettled([
      getMyWitnessBets(uid, 50),
      getMyBlindBets(uid, 50),
      getMyIndexBets(uid, 50),
    ]).then((results) => {
      const [witnesses, blindBets, indexBets] = results.map((result) =>
        result.status === 'fulfilled' ? result.value : []
      )
      setBetRecords(buildBetRecords(witnesses, blindBets, indexBets))
    })
  }, [session])

  const title       = profile ? getMeritTitle(profile.total_merit) : { emoji:'🌱', title:'初心者', next:500 }
  const merit       = profile?.total_merit ?? 0
  const progressPct = title.next ? Math.min(100, Math.round((merit / title.next) * 100)) : 100

  const activePledges  = pledges.filter(p => p.status === 'active')
  const cooldowns      = pledges.filter(p => p.status === 'cooldown')
  const historyPledges = pledges.filter(p => ['done','fail','abandoned'].includes(p.status))
  const totalDays      = pledges.reduce((s, p) => s + (p.checkin_count || 0), 0)
  const visibleBetRecords = betFilter === 'all'
    ? betRecords
    : betRecords.filter((item) => item.category === betFilter)

  const nickDisplay  = profile?.nickname    || '立誓者'
  const emojiDisplay = profile?.avatar_emoji || '🌱'
  const bioDisplay   = profile?.bio          || ''

  function updateGlobalReminder(patch) {
    if (!userId) return
    const next = saveGlobalReminder(userId, { ...globalReminder, ...patch })
    setGlobalReminder(next)
    syncBrowserReminder(next)
    showToast('提醒设置已保存 ✓', 'success')
  }

  async function handleSaveProfile(updates) {
    try {
      await updateProfile(session.user.id, updates)
      await refreshProfile()
      setEditOpen(false)
      showToast('资料已更新 ✓', 'success')
    } catch {
      showToast('保存失败，请重试', 'error')
    }
  }

  async function handleSignOut() {
    await signOut()
    nav('/auth')
  }

    return (
    <div style={{ background:'#F3F0EA', minHeight:'100vh', paddingBottom:'calc(90px + env(safe-area-inset-bottom))' }}>

      {toast && (
        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
          background: toast.type === 'error' ? '#C84040' : toast.type === 'success' ? '#3B7A4A' : 'rgba(26,18,8,.88)',
          color:'#fff', padding:'9px 20px', borderRadius:20, fontSize:13,
          zIndex:600, whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(0,0,0,.2)' }}>
          {toast.msg}
        </div>
      )}

      {editOpen && (
        <EditSheet profile={profile} onSave={handleSaveProfile} onClose={() => setEditOpen(false)} />
      )}

      {confirmOut && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:400,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, margin:24, maxWidth:320, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>确认退出？</div>
            <div style={{ fontSize:13, color:'#9A8A70', marginBottom:20 }}>退出后需要重新登录</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmOut(false)} style={{ flex:1, padding:'10px 0', borderRadius:10, border:'1px solid #E0D5C0', background:'none', fontSize:14, cursor:'pointer' }}>取消</button>
              <button onClick={handleSignOut} style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', background:'#C84040', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>退出</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.topbar}>
        <button style={S.iconBtn} onClick={() => tab === 'home' ? nav(-1) : setTab('home')}>{tab === 'home' ? '←' : '‹'}</button>
        <div style={S.pageTitle}><span>个人</span><span style={S.pageTitleGold}>中心</span></div>
        <button style={{ ...S.iconBtn, fontSize:18 }} onClick={() => setEditOpen(true)}>⚙</button>
      </div>

      {tab === 'home' ? (
        <div style={S.mineWrap}>
          <button style={S.profileEntry} onClick={() => setEditOpen(true)}>
            <div style={{ width:70, height:70, borderRadius:16, background:avaColor(nickDisplay), display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, flexShrink:0 }}>{emojiDisplay}</div>
            <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ fontSize:24, fontWeight:900, color:'#1A1208', fontFamily:'Noto Serif SC,serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nickDisplay}</div>
                <span style={S.levelPill}>{title.emoji} {title.title}</span>
              </div>
              <div style={{ fontSize:14, color:'#7A6A50', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>一诺ID：{(userId || session?.user?.email || '未登录').slice(0, 18)}</div>
              <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                <span style={S.softPill}>🪙 {profile?.merit_coins ?? 0} 金币</span>
                <span style={S.softPill}>守约 {profile?.success_rate ?? 0}%</span>
              </div>
            </div>
            <div style={S.chev}>›</div>
          </button>

          {bioDisplay && <div style={S.bioLine}>「{bioDisplay}」</div>}

          <div style={S.statStrip}>
            <div style={S.statPlain}><b>{pledges.length}</b><span>总誓言</span></div>
            <div style={S.statPlain}><b>{activePledges.length}</b><span>进行中</span></div>
            <div style={S.statPlain}><b>{totalDays}</b><span>打卡天</span></div>
            <div style={S.statPlain}><b>{merit.toLocaleString()}</b><span>功德值</span></div>
          </div>

          <div style={S.listGroup}>
            <MenuRow icon="📜" label="我的誓言" value={activePledges.length + ' 个进行中'} onClick={() => setTab('pledges')} />
            <MenuRow icon="🪙" label="我的金币" value={(profile?.merit_coins ?? 0) + ' 可用'} onClick={() => setTab('coins')} />
            <MenuRow icon="📒" label="押注记录" value="见证 · 盲盒 · 指数" onClick={() => setTab('bets')} />
            <MenuRow icon="✅" label="结算记录" value="完成与失败记录" onClick={() => setTab('pledges')} last />
          </div>

          <div style={S.listGroup}>
            <MenuRow icon="🔔" label="消息中心" value="同行提醒与反馈" onClick={() => nav('/notifications')} />
            <MenuRow icon="⏰" label="提醒设置" value={globalReminder.enabled ? globalReminder.time : '已关闭'} onClick={() => setTab('reminders')} />
            <MenuRow icon="🏅" label="我的证书" value={progressPct + '%'} onClick={() => setTab('certs')} />
            <MenuRow icon="⚙" label="账号设置" value="资料与退出" onClick={() => setEditOpen(true)} last />
          </div>

          <button style={S.signOutRow} onClick={() => setConfirmOut(true)}>退出登录</button>
        </div>
      ) : (
        <div style={{ padding:'0 16px' }}>
          <div style={S.detailHead}>
            <button style={S.detailBack} onClick={() => setTab('home')}>‹ 返回</button>
            <div style={S.detailTitle}>{({ pledges:'我的誓言', reminders:'提醒设置', coins:'我的金币', bets:'押注记录', donations:'公益记录', certs:'我的证书' })[tab]}</div>
          </div>

          {tab === 'pledges' && (
            <div style={{ paddingTop:12 }}>
              {loading && <div style={S.empty}>加载中…</div>}
              {!loading && pledges.length === 0 && (
                <div style={{ textAlign:'center', padding:'40px 24px' }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>🎯</div>
                  <div style={{ fontSize:14, color:'#9A8A70', marginBottom:16 }}>还没有立下誓言</div>
                  <button onClick={() => nav('/new')} style={{ background:'#C8922A', color:'#fff', border:'none', borderRadius:12, padding:'10px 24px', fontSize:14, fontWeight:600, cursor:'pointer' }}>立下第一个誓言</button>
                </div>
              )}
              {activePledges.length > 0 && (<><div style={S.secLabel}>进行中 · {activePledges.length}</div>{activePledges.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}</>)}
              {cooldowns.length > 0 && (<><div style={S.secLabel}>冷静期 · {cooldowns.length}</div>{cooldowns.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}</>)}
              {historyPledges.length > 0 && (<><div style={S.secLabel}>历史记录 · {historyPledges.length}</div>{historyPledges.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}</>)}
            </div>
          )}

          {tab === 'reminders' && (
            <div style={{ paddingTop:12 }}>
              <div style={S.reminderPanel}>
                <div style={S.reminderTitle}>全局提醒</div>
                <div style={S.reminderDesc}>这里是所有新誓言的默认提醒。单个誓言可以在誓言详情页单独覆盖。</div>
                <label style={S.reminderRow}><span>每日打卡提醒</span><input type="checkbox" checked={!!globalReminder.enabled} onChange={e => updateGlobalReminder({ enabled: e.target.checked })} /></label>
                <label style={S.reminderRow}><span>默认时间</span><input type="time" value={globalReminder.time || '20:30'} onChange={e => updateGlobalReminder({ time: e.target.value })} style={S.reminderTimeInput} /></label>
                <div style={{ fontSize:12, color:'#9A8A70', margin:'14px 0 8px' }}>提醒语气</div>
                <div style={S.reminderStyleGrid}>{[[ 'gentle','温和' ],[ 'strict','严厉' ],[ 'ritual','仪式感' ]].map(([key, label]) => <button key={key} onClick={() => updateGlobalReminder({ style: key })} style={{ ...S.reminderStyleBtn, ...(globalReminder.style === key ? S.reminderStyleBtnOn : {}) }}>{label}</button>)}</div>
              </div>
            </div>
          )}

          {tab === 'coins' && (
            <div style={{ paddingTop:4 }}>
              {loading && <div style={S.empty}>加载中…</div>}
              {!loading && ledger.length === 0 && <div style={S.empty}>暂无金币记录</div>}
              {ledger.map(item => (
                <div key={item.id} style={S.ledgerRow}>
                  <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, background: item.amount > 0 ? '#E8F5EC' : '#FCEBEB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{item.amount > 0 ? '🪙' : '💸'}</div>
                  <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:500 }}>{TYPE_LABELS[item.type] ?? item.type}</div>{item.note && <div style={{ fontSize:11, color:'#9A8A70', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.note}</div>}<div style={{ fontSize:10, color:'#C0B090', marginTop:2 }}>{format(parseISO(item.created_at), 'M月d日 HH:mm')}</div></div>
                  <div style={{ textAlign:'right', flexShrink:0 }}><div style={{ fontSize:14, fontWeight:700, color: item.amount > 0 ? '#3B7A4A' : '#C84040' }}>{item.amount > 0 ? '+' : ''}{item.amount}</div><div style={{ fontSize:10, color:'#9A8A70' }}>余额 {item.balance_after}</div></div>
                </div>
              ))}
            </div>
          )}

          {tab === 'bets' && (
            <div style={{ paddingTop:4 }}>
              <div style={{ fontSize:11, color:'#9A8A70', lineHeight:1.55, margin:'0 2px 12px' }}>
                只记录见证押注、盲盒结缘与自律指数。誓言托管金仍在“我的金币”流水中。
              </div>
              <div style={{ display:'flex', gap:7, marginBottom:12, overflowX:'auto', paddingBottom:2 }}>
                {[
                  ['all', '全部'],
                  ['witness', '见证'],
                  ['blind', '盲盒'],
                  ['index', '指数'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setBetFilter(key)}
                    style={{
                      flexShrink:0, border:'1px solid ' + (betFilter === key ? '#1C1208' : '#E0D5C0'),
                      background: betFilter === key ? '#1C1208' : '#FFFDF8',
                      color: betFilter === key ? '#FFF8E8' : '#6B5A3E',
                      borderRadius:999, padding:'6px 13px', fontSize:12, fontWeight:600,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {visibleBetRecords.length === 0 && <div style={S.empty}>暂无押注记录</div>}
              {visibleBetRecords.map((item) => (
                <div key={item.id} style={S.ledgerRow}>
                  <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, background:'#F8EFD9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{item.emoji}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{item.title}</div>
                    <div style={{ fontSize:11, color:'#9A8A70', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.detail}</div>
                    <div style={{ fontSize:10, color:'#C0B090', marginTop:2 }}>{item.createdAt ? format(parseISO(item.createdAt), 'M月d日 HH:mm') : '时间未知'}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:11, color:item.status === '已结算' ? '#3B7A4A' : '#9A8A70', marginBottom:3 }}>{item.status}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#C84040' }}>-{item.amount}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'certs' && (
            <div style={{ paddingTop:12 }}>
              {[
                { threshold:500, emoji:'🌿', name:'初级善行证书', desc:'累计功德500，可下载电子版' },
                { threshold:2000, emoji:'🌊', name:'护法者证书', desc:'累计功德2000达成' },
                { threshold:5000, emoji:'🔥', name:'善行者证书', desc:'累计功德5000，含机构公章' },
                { threshold:15000, emoji:'✨', name:'功德大师证书', desc:'累计功德15000，社会公益认证' },
                { threshold:50000, emoji:'🪷', name:'菩萨心肠证书', desc:'区块链存证 · 终身荣誉' },
              ].map(cert => {
                const earned = merit >= cert.threshold
                return <div key={cert.name} style={{ ...S.certCard, opacity: earned ? 1 : .55, border: earned ? '1px solid #C8922A' : '0.5px solid #E0D5C0' }}><div style={{ fontSize:28 }}>{cert.emoji}</div><div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:600, color: earned ? '#1A1208' : '#9A8A70' }}>{cert.name}</div><div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>{cert.desc}</div>{!earned && <div style={{ fontSize:11, color:'#C8922A', marginTop:4 }}>还差 {(cert.threshold - merit).toLocaleString()} 功德值</div>}</div>{earned ? <button style={{ background:'#E8F5EC', color:'#3B7A4A', border:'none', borderRadius:20, fontSize:11, fontWeight:600, padding:'5px 12px', cursor:'pointer' }}>下载 ⬇</button> : <div style={{ fontSize:10, color:'#B8A88A' }}>🔒 未解锁</div>}</div>
              })}
            </div>
          )}

          <div style={{ height:20 }} />
        </div>
      )}
    </div>
  )
}


function MenuRow({ icon, label, value, onClick, last = false }) {
  return (
    <button onClick={onClick} style={{ ...S.menuRow, ...(last ? { borderBottom:'none' } : {}) }}>
      <span style={S.menuIcon}>{icon}</span>
      <span style={S.menuLabel}>{label}</span>
      {value && <span style={S.menuValue}>{value}</span>}
      <span style={S.chev}>›</span>
    </button>
  )
}

/* ── 誓言行 ── */
function PledgeRow({ p, nav }) {
  const pct      = Math.min(100, Math.round(((p.checkin_count || 0) / p.total_days) * 100))
  const daysLeft = Math.max(0, differenceInDays(new Date(p.end_date), new Date()))
  return (
    <div style={S.pledgeCard} onClick={() => nav(`/pledge/${p.id}`)}>
      <div style={{ display:'flex', alignItems:'center', gap:10,
        marginBottom: p.status === 'active' ? 8 : 0 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, fontFamily:'Noto Serif SC,serif',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
          <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>
            {PERIOD_LABEL[p.period]}度誓言 · 押{p.stake_coins}金币
            {p.status === 'active' && ` · 还剩${daysLeft}天`}
          </div>
        </div>
        <div style={{ fontSize:10, fontWeight:600, padding:'3px 9px', borderRadius:20, flexShrink:0,
          background: STATUS_COLOR[p.status] + '20', color: STATUS_COLOR[p.status] }}>
          {STATUS_LABEL[p.status] || p.status}
        </div>
        <span style={{ color:'#C0B090', fontSize:16 }}>›</span>
      </div>
      {p.status === 'active' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
            color:'#9A8A70', marginBottom:3 }}>
            <span>第{p.checkin_count}天 / {p.total_days}天</span>
            <span style={{ color:'#C8922A', fontWeight:600 }}>{pct}%</span>
          </div>
          <div style={{ height:4, background:'#F0EAE0', borderRadius:2, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', borderRadius:2,
              background:'linear-gradient(90deg,#C8922A,#E8B84A)' }} />
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  topbar:    { display:'flex', alignItems:'center', justifyContent:'space-between',
               padding:'calc(12px + env(safe-area-inset-top)) 16px 12px', borderBottom:'0.5px solid #E0D5C0',
               background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
  iconBtn:   { background:'none', border:'none', fontSize:20, cursor:'pointer',
               color:'#1A1208', padding:4 },
  pageTitle:  { fontSize:16, fontWeight:800, fontFamily:'Noto Serif SC,serif', color:'#1A1208' },
  pageTitleGold: { color:'#C8922A' },
  hero:      { background:'linear-gradient(135deg,#2A1A08,#3A2510)',
               padding:'18px 18px 16px', margin:'0 16px 0',
               borderRadius:'0 0 16px 16px' },
  statBox:   { background:'rgba(255,255,255,.08)', borderRadius:8, padding:'8px 6px', textAlign:'center' },
  tabRow:    { display:'flex', borderBottom:'0.5px solid #E0D5C0', background:'#FAF7F2',
               position:'sticky', top:51, zIndex:9 },
  tab:       { flex:1, padding:'10px 0', fontSize:11, fontWeight:500, color:'#9A8A70',
               background:'none', border:'none', borderBottom:'2px solid transparent',
               cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  tabOn:     { color:'#C8922A', borderBottomColor:'#C8922A', fontWeight:700 },
  secLabel:  { fontSize:11, fontWeight:600, color:'#9A8A70', letterSpacing:.5,
               marginBottom:8, marginTop:14 },
  pledgeCard:{ background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:12,
               padding:'12px 14px', marginBottom:8, cursor:'pointer',
               boxShadow:'0 1px 4px rgba(26,18,8,.04)' },
  ledgerRow: { display:'flex', alignItems:'center', gap:12, padding:'12px 0',
               borderBottom:'0.5px solid #F0EAE0' },
  certCard:  { display:'flex', alignItems:'center', gap:12, background:'#fff',
               borderRadius:12, padding:14, marginBottom:10 },
  label:     { fontSize:12, fontWeight:600, color:'#5A4A30', marginBottom:6 },
  input:     { width:'100%', border:'1px solid #E0D5C0', borderRadius:10, padding:'10px 12px',
               fontSize:14, fontFamily:'Noto Sans SC,sans-serif', color:'#1A1208',
               background:'#FAF7F2', outline:'none', boxSizing:'border-box' },
  reminderPanel: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:16, boxShadow:'0 1px 4px rgba(26,18,8,.04)' },
  reminderTitle: { fontSize:16, fontWeight:800, fontFamily:'Noto Serif SC,serif', marginBottom:6 },
  reminderDesc: { fontSize:12, color:'#9A8A70', lineHeight:1.6, marginBottom:14 },
  reminderRow: { display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:14, fontWeight:700, padding:'12px 0', borderTop:'1px solid #F0EAE0' },
  reminderTimeInput: { border:'1px solid #E0D5C0', borderRadius:10, padding:'8px 10px', background:'#FAF7F2', color:'#1A1208', fontWeight:700 },
  reminderStyleGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 },
  reminderStyleBtn: { border:'1px solid #E0D5C0', borderRadius:999, background:'#fff', color:'#7A6A50', padding:'10px 6px', fontWeight:800 },
  reminderStyleBtnOn: { borderColor:'#C8922A', background:'#FDF3E0', color:'#7A5A18' },
  mineWrap: { padding:'18px 0 0' },
  profileEntry: { width:'100%', display:'flex', alignItems:'center', gap:16, padding:'30px 24px 26px', background:'#fff', border:'none', borderBottom:'1px solid #E8E1D6', fontFamily:'Noto Sans SC,sans-serif' },
  levelPill: { border:'1px solid #E0D5C0', borderRadius:999, padding:'4px 9px', color:'#7A5A18', background:'#FFFCF5', fontSize:12, fontWeight:800, flexShrink:0 },
  softPill: { border:'1px solid #E8E1D6', borderRadius:999, padding:'4px 10px', color:'#7A6A50', background:'#FAF7F2', fontSize:12, fontWeight:700 },
  bioLine: { margin:'10px 18px 0', color:'#7A6A50', background:'#fff', border:'1px solid #E8E1D6', borderRadius:12, padding:'12px 14px', fontSize:13, lineHeight:1.6 },
  statStrip: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', background:'#fff', borderTop:'1px solid #E8E1D6', borderBottom:'1px solid #E8E1D6', margin:'12px 0 10px' },
  statPlain: { textAlign:'center', padding:'14px 4px', borderRight:'1px solid #F0EAE0', display:'flex', flexDirection:'column', gap:4, color:'#7A6A50', fontSize:11 },
  listGroup: { background:'#fff', borderTop:'1px solid #E8E1D6', borderBottom:'1px solid #E8E1D6', margin:'10px 0' },
  menuRow: { width:'100%', display:'flex', alignItems:'center', gap:14, minHeight:58, padding:'0 18px', border:'none', borderBottom:'1px solid #F0EAE0', background:'#fff', fontFamily:'Noto Sans SC,sans-serif', textAlign:'left' },
  menuIcon: { width:26, fontSize:21, textAlign:'center', flexShrink:0 },
  menuLabel: { flex:1, color:'#1A1208', fontSize:16, fontWeight:800 },
  menuValue: { color:'#9A8A70', fontSize:12, maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  chev: { color:'#B8A88A', fontSize:28, lineHeight:1, flexShrink:0 },
  signOutRow: { width:'100%', minHeight:52, margin:'16px 0 0', border:'none', borderTop:'1px solid #E8E1D6', borderBottom:'1px solid #E8E1D6', background:'#fff', color:'#C84040', fontSize:15, fontWeight:800, fontFamily:'Noto Sans SC,sans-serif' },
  detailHead: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0 2px' },
  detailBack: { border:'none', background:'transparent', color:'#7A6A50', fontSize:14, fontWeight:800, padding:'8px 0' },
  detailTitle: { fontFamily:'Noto Serif SC,serif', fontSize:20, fontWeight:900, color:'#1A1208' },
  empty:     { textAlign:'center', color:'#9A8A70', padding:32, fontSize:13 },
}
