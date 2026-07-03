// src/pages/HomePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getMyPledges, hasCheckedInToday, getMeritTitle, getNotifications, subscribeToNotifications } from '../lib/supabase'
import { differenceInDays } from 'date-fns'


const DEFAULT_REMINDER = { enabled: true, time: '20:30', style: 'gentle' }
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




function daysLeft(pledge) {
  if (!pledge?.end_date) return null
  return Math.max(0, differenceInDays(new Date(pledge.end_date), new Date()))
}




function progressOf(pledge) {
  const done = pledge?.checkin_count || pledge?.current_days || pledge?.completed_days || 0
  const total = pledge?.total_days || pledge?.duration_days || pledge?.target_days || pledge?.days || 1
  return {
    done,
    total,
    percent: Math.min(100, Math.round((done / Math.max(total, 1)) * 100))
  }
}




function pledgeTitle(pledge) {
  return pledge?.title || pledge?.content || pledge?.description || '未命名诺言'
}




function getMeritDisplay(score) {
  const merit = getMeritTitle(score || 0)
  if (typeof merit === 'string') return { emoji: '', title: merit }
  return { emoji: merit?.emoji || '', title: merit?.title || '初心者' }
}




function getHomeFeedback({ pledge, progress, checkedToday, daysLeft }) {
  if (!pledge) {
    return {
      label: '第一份契约',
      title: '先写下一件每天能守住的小事',
      body: '诺言不必宏大，真正改变人的，是每天都能重复一次的行动。',
      next: '立下誓言后，首页会每天陪你守住它。'
    }
  }


  const left = Math.max(0, progress.total - progress.done)
  const nextMilestone = [7, 14, 21, 30, 60, 90, 365].find(day => day > progress.done && day <= progress.total)
  if (checkedToday) {
    return {
      label: '今日回响',
      title: '今天已经守住了',
      body: '不用再证明给任何人看，今天这一笔已经写进你的契约。',
      next: left <= 0 ? '这份契约已经走到终点，等待结算。' : '明天继续，还差 ' + left + ' 次完成全程。'
    }
  }
  if (progress.percent >= 80) {
    return {
      label: '临近圆满',
      title: '最后这段最有分量',
      body: '很多诺言不是败在开始，而是败在接近完成时。今天守住，它就更像真的了。',
      next: daysLeft === 0 ? '今日到期，完成这次证明。' : '还剩 ' + left + ' 次，别让前面的努力断在这里。'
    }
  }
  if (progress.done === 0) {
    return {
      label: '起誓之后',
      title: '第一天不是仪式的结束',
      body: '盖印只是开始，第一次打卡才是你真正把诺言带进生活。',
      next: '完成今天这一次，契约就开始有重量。'
    }
  }
  return {
    label: '守诺回响',
    title: nextMilestone ? '向第 ' + nextMilestone + ' 天靠近' : '稳稳推进中',
    body: '你不需要每天都很热血，只要在该做的时候继续做。',
    next: daysLeft === 0 ? '今日到期，完成最后的证明。' : '已完成 ' + progress.done + ' 次，今天再添一笔。'
  }
}

const MAX_ACTIVE_PLEDGES = 3
const COMPLETION_RATE_TARGET = 90

function getNewPledgeLimitCopy(activeCount) {
  if (activeCount < MAX_ACTIVE_PLEDGES) return ''
  return '同时守太多诺，容易散。先完成一个，再开启下一份。'
}

function getDashboardBrief({ loading, activeCount, completedToday, unfinishedCount }) {
  if (loading) return { title: '正在校准今日契约', body: '稍等一下，正在取回你的守诺进度。' }
  if (!activeCount) return { title: '今天从第一份誓言开始', body: '写下一件能重复的小事，首页会每天替你守着这份契约。' }
  if (unfinishedCount === 0) return { title: '今日已全部守住', body: '你今天没有把诺言留到明天。可以安心收工，也可以回看日记。' }
  if (completedToday > 0) return { title: '已经守住一部分', body: '还差 ' + unfinishedCount + ' 个诺言。先完成最容易开始的那个。' }
  return { title: '今日还未开局', body: '不要等状态变好。先交出今天第一笔证明，节奏就会回来。' }
}





const styles = {
  page: {
    minHeight: '100vh',
    background: '#FAF7F2',
    color: '#1A1208',
    padding: '0 16px calc(96px + env(safe-area-inset-bottom))',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    margin: '0 -16px 14px',
    padding: 'calc(14px + env(safe-area-inset-top)) 16px 12px',
    borderBottom: '1px solid #E0D5C0',
    background: '#FAF7F2'
  },
  title: {
    margin: 0,
    fontFamily: 'Noto Serif SC, serif',
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: .5,
    color: '#1A1208'
  },
  titleGold: { color: '#C8922A' },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#7A6A50'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0
  },
  noticeButton: {
    position: 'relative',
    width: 38,
    height: 38,
    border: '1px solid #E0D5C0',
    background: '#FFFFFF',
    color: '#7A5A18',
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(26,18,8,.05)'
  },
  noticeIcon: {
    fontSize: 17,
    lineHeight: 1
  },
  noticeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    padding: '0 4px',
    borderRadius: 999,
    background: '#C84040',
    color: '#FFFFFF',
    border: '2px solid #FAF7F2',
    fontSize: 10,
    lineHeight: '17px',
    fontWeight: 900,
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  meritButton: {
    border: '1px solid #E0D5C0',
    background: '#FFFFFF',
    color: '#7A5A18',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap'
  },
  dashboardCard: {
    border: '1px solid #E0D5C0',
    borderRadius: 14,
    background: '#FFFFFF',
    padding: 14,
    boxShadow: '0 2px 10px rgba(26,18,8,.05)',
    marginBottom: 14
  },
  dashboardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10
  },
  dashboardTitle: {
    margin: 0,
    fontFamily: 'Noto Serif SC, serif',
    fontSize: 18,
    lineHeight: 1.35,
    fontWeight: 900
  },
  dashboardSub: {
    margin: '5px 0 0',
    color: '#7A6A50',
    fontSize: 12,
    lineHeight: 1.6
  },
  queueList: {
    display: 'grid',
    gap: 9
  },
  queueItem: {
    width: '100%',
    border: '1px solid #EDE6D8',
    borderRadius: 12,
    background: '#FFFCF6',
    padding: 11,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left'
  },
  queueIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: '#F5E8C9',
    color: '#9A6A10',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    flexShrink: 0
  },
  queueMain: {
    flex: 1,
    minWidth: 0
  },
  queueTitle: {
    color: '#1A1208',
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  queueMeta: {
    marginTop: 4,
    color: '#7A6A50',
    fontSize: 11,
    lineHeight: 1.35
  },
  queueAction: {
    border: 0,
    borderRadius: 999,
    background: '#1A1208',
    color: '#F6D486',
    padding: '8px 13px',
    fontSize: 12,
    fontWeight: 900,
    flexShrink: 0
  },
  donePill: {
    borderRadius: 999,
    background: '#E7F6EC',
    color: '#2F7A4D',
    padding: '7px 11px',
    fontSize: 12,
    fontWeight: 900,
    flexShrink: 0
  },
  allDoneCard: {
    borderRadius: 12,
    background: '#EAF6EF',
    color: '#2F6F49',
    padding: '12px 13px',
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.6
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    border: '1px solid #E0D5C0',
    borderRadius: 12,
    background: '#FFFFFF',
    overflow: 'hidden',
    boxShadow: '0 2px 10px rgba(26,18,8,.05)',
    marginBottom: 12
  },
  statItem: {
    padding: '11px 6px',
    textAlign: 'center',
    borderRight: '1px solid #EDE6D8'
  },
  statItemLast: {
    padding: '11px 6px',
    textAlign: 'center'
  },
  statValue: {
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 900,
    color: '#1A1208'
  },
  statLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#7A6A50'
  },
  scrollCard: {
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid #E0D5C0',
    borderRadius: 14,
    background: '#FFFFFF',
    padding: 16,
    boxShadow: '0 2px 10px rgba(26,18,8,.06)',
    marginBottom: 14
  },
  scrollLineTop: {
    display: 'none'
  },
  scrollLineBottom: {
    display: 'none'
  },
  eyebrow: {
    margin: 0,
    color: '#C8922A',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.5
  },
  pledgeName: {
    margin: '7px 0 0',
    maxWidth: '80%',
    fontFamily: 'Noto Serif SC, serif',
    fontSize: 20,
    lineHeight: 1.35,
    fontWeight: 900
  },
  bodyText: {
    maxWidth: '100%',
    margin: '12px 0 0',
    color: '#7A6A50',
    fontSize: 13,
    lineHeight: 1.7
  },
  seal: {
    position: 'absolute',
    right: 14,
    top: 18,
    width: 54,
    height: 54,
    borderRadius: 4,
    border: '2px solid rgba(176,36,24,.72)',
    background: 'rgba(176,36,24,.08)',
    color: '#9B1F16',
    transform: 'rotate(-8deg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Noto Serif SC, serif',
    boxSizing: 'border-box'
  },
  sealChar: {
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 900
  },
  sealText: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1
  },
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 7,
    fontSize: 12,
    color: '#7A6A50'
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    background: '#EDE6D8',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: '#C8922A'
  },
  feedbackCard: {
    marginTop: 12,
    border: '1px solid #E8D4A0',
    borderRadius: 12,
    background: '#FDF3E0',
    padding: '11px 12px'
  },
  feedbackLabel: {
    color: '#7A5A18',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.2,
    marginBottom: 5
  },
  feedbackTitle: {
    color: '#1A1208',
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.4,
    marginBottom: 5
  },
  feedbackBody: {
    color: '#5A4A30',
    fontSize: 12,
    lineHeight: 1.65
  },
  feedbackNext: {
    marginTop: 7,
    color: '#7A5A18',
    fontSize: 12,
    fontWeight: 800
  },
  reminderStrip: {
    marginTop: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    color: '#5A4A30',
    fontSize: 13
  },
  reminderButton: {
    border: 0,
    borderRadius: 999,
    background: '#F2EEE6',
    color: '#7A6A50',
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 800
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14
  },
  muted: {
    color: '#7A6A50',
    fontSize: 13
  },
  primaryButton: {
    border: 0,
    borderRadius: 999,
    background: '#1A1208',
    color: '#F6D486',
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 900,
    boxShadow: '0 4px 12px rgba(26,18,8,.14)'
  },
  fullButton: {
    width: '100%',
    border: 0,
    borderRadius: 12,
    background: '#1A1208',
    color: '#F6D486',
    padding: '13px 16px',
    fontSize: 14,
    fontWeight: 900,
    marginTop: 14
  },
  panel: {
    border: '1px solid #E0D5C0',
    borderRadius: 14,
    background: '#FFFFFF',
    padding: 14,
    boxShadow: '0 2px 10px rgba(26,18,8,.05)',
    marginBottom: 14
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  panelTitle: {
    margin: 0,
    fontFamily: 'Noto Serif SC, serif',
    fontSize: 18,
    fontWeight: 900
  },
  linkButton: {
    border: '1px solid #E0D5C0',
    borderRadius: 999,
    background: '#FFFFFF',
    color: '#9A6A10',
    fontSize: 13,
    fontWeight: 900,
    padding: '8px 18px',
    minWidth: 86,
    boxShadow: '0 2px 8px rgba(26,18,8,.04)',
    fontFamily: 'Noto Sans SC, sans-serif'
  },
  linkButtonDisabled: {
    color: '#B8AA91',
    background: '#F5F0E8',
    boxShadow: 'none'
  },
  ruleHint: {
    margin: '-4px 0 12px',
    color: '#8A7A62',
    background: '#FFF8E8',
    border: '1px solid rgba(200,146,42,.22)',
    borderRadius: 12,
    padding: '9px 11px',
    fontSize: 11,
    lineHeight: 1.55
  },
  pledgeItem: {
    width: '100%',
    border: '1px solid #EDE6D8',
    borderRadius: 12,
    background: '#FFFCF6',
    padding: 12,
    textAlign: 'left',
    marginBottom: 10
  },
  pledgeItemTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  pledgeItemTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: '#1A1208'
  },
  pledgeMeta: {
    marginTop: 5,
    fontSize: 11,
    color: '#7A6A50',
    lineHeight: 1.45
  },
  empty: {
    borderRadius: 12,
    background: '#F5F0E8',
    color: '#7A6A50',
    padding: '18px 14px',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 1.65
  },
  smallGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10
  },
  smallCard: {
    border: '1px solid #E0D5C0',
    borderRadius: 14,
    background: '#FFFFFF',
    padding: 14,
    textAlign: 'left',
    boxShadow: '0 2px 10px rgba(26,18,8,.04)'
  },
  smallLabel: {
    color: '#7A6A50',
    fontSize: 12
  },
  smallValue: {
    marginTop: 5,
    color: '#1A1208',
    fontSize: 22,
    fontWeight: 900
  }
}


function Seal({ profile }) {
  const name = profile?.nickname || profile?.username || '我'
  const first = String(name).trim().slice(0, 1) || '我'
  return (
    <div style={styles.seal}>
      <div style={styles.sealChar}>{first}</div>
      <div style={styles.sealText}>守诺印</div>
    </div>
  )
}




export default function HomePage() {
  const { profile, session } = useAuth()
  const nav = useNavigate()
  const [pledges, setPledges] = useState([])
  const [checkedMap, setCheckedMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const userId = session?.user?.id




  useEffect(() => {
    if (userId) {
      load()
    } else {
      setPledges([])
      setCheckedMap({})
      setUnreadCount(0)
      setLoading(false)
    }
  }, [userId])




  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      return undefined
    }

    let mounted = true

    async function loadUnread() {
      try {
        const result = await getNotifications(userId)
        if (!mounted) return
        const items = result?.items || []
        setUnreadCount(items.filter(item => !item.read_at).length)
      } catch (error) {
        if (mounted) setUnreadCount(0)
      }
    }

    function refreshUnread() {
      loadUnread()
    }

    loadUnread()
    window.addEventListener('focus', loadUnread)
    window.addEventListener('ynq:notifications-changed', refreshUnread)

    const channel = subscribeToNotifications(userId, item => {
      if (!item?.read_at) setUnreadCount(count => count + 1)
    })

    return () => {
      mounted = false
      window.removeEventListener('focus', loadUnread)
      window.removeEventListener('ynq:notifications-changed', refreshUnread)
      channel?.unsubscribe?.()
    }
  }, [userId])




  async function load() {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getMyPledges(userId)
      const list = data || []
      setPledges(list)




      const checks = {}
      await Promise.all(
        list.map(async pledge => {
          checks[pledge.id] = await hasCheckedInToday(pledge.id)
        })
      )
      setCheckedMap(checks)
    } finally {
      setLoading(false)
    }
  }




  const activePledges = pledges.filter(p => !p.status || p.status === 'active' || p.status === 'ongoing')
  const unfinishedToday = activePledges.filter(p => !checkedMap[p.id])
  const todayQueue = [...activePledges].sort((a, b) => {
    const aChecked = checkedMap[a.id] ? 1 : 0
    const bChecked = checkedMap[b.id] ? 1 : 0
    if (aChecked !== bChecked) return aChecked - bChecked
    const aLeft = daysLeft(a) ?? 9999
    const bLeft = daysLeft(b) ?? 9999
    return aLeft - bLeft
  })
  const todayPledge = (unfinishedToday.length ? todayQueue.find(p => !checkedMap[p.id]) : todayQueue[0])




  const completedToday = activePledges.filter(p => checkedMap[p.id]).length
  const totalCheckins = pledges.reduce((sum, p) => sum + (p.checkin_count || p.current_days || p.completed_days || 0), 0)
  const totalTarget = pledges.reduce((sum, p) => sum + (p.total_days || p.duration_days || p.target_days || p.days || 0), 0)
  const keepRate = totalTarget ? Math.round((totalCheckins / totalTarget) * 100) : 0
  const lockedCoins = activePledges.reduce((sum, p) => sum + Number(p.stake_coins || p.stake_amount || p.stake || 0), 0)
  const merit = getMeritDisplay(profile?.merit_score)
  const mainProgress = progressOf(todayPledge)
  const mainChecked = todayPledge ? checkedMap[todayPledge.id] : false
  const mainDaysLeft = daysLeft(todayPledge)
  const homeFeedback = getHomeFeedback({ pledge: todayPledge, progress: mainProgress, checkedToday: mainChecked, daysLeft: mainDaysLeft })
  const mainReminder = todayPledge ? getReminderForPledge(userId, todayPledge.id) : readReminderStore(userId).global
  const dashboardBrief = getDashboardBrief({
    loading,
    activeCount: activePledges.length,
    completedToday,
    unfinishedCount: Math.max(activePledges.length - completedToday, 0)
  })
  const canCreateNewPledge = activePledges.length < MAX_ACTIVE_PLEDGES
  const pledgeLimitCopy = getNewPledgeLimitCopy(activePledges.length)
  function handleCreatePledge() {
    if (!canCreateNewPledge) {
      window.alert(pledgeLimitCopy)
      return
    }
    nav('/new')
  }




  if (!session) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}><span>一诺</span><span style={styles.titleGold}>千金</span></h1>
        <p style={styles.subtitle}>先登录，再立下属于你的第一份诺言。</p>
        <button onClick={() => nav('/auth')} style={styles.fullButton}>去登录</button>
      </div>
    )
  }




  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}><span>一诺</span><span style={styles.titleGold}>千金</span></h1>
          <p style={styles.subtitle}>守住今天，就是守住自己</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => nav('/notifications')} style={styles.noticeButton} aria-label="消息中心">
            <span style={styles.noticeIcon}>🔔</span>
            {unreadCount > 0 && (
              <span style={styles.noticeBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
          <button onClick={() => nav('/profile')} style={styles.meritButton}>
            {merit.emoji} {merit.title}
          </button>
        </div>
      </header>




      <section style={styles.stats}>
        <div style={styles.statItem}>
          <div style={{ ...styles.statValue, color: '#c39a32' }}>{Math.max(activePledges.length - completedToday, 0)}</div>
          <div style={styles.statLabel}>今日待守</div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statValue}>{completedToday}/{activePledges.length || 0}</div>
          <div style={styles.statLabel}>今日完成</div>
        </div>
        <div style={styles.statItemLast}>
          <div style={styles.statValue}>{keepRate}%</div>
          <div style={styles.statLabel}>总守约率</div>
        </div>
      </section>




      <section style={styles.dashboardCard}>
        <div style={styles.dashboardHeader}>
          <div>
            <h2 style={styles.dashboardTitle}>{dashboardBrief.title}</h2>
            <p style={styles.dashboardSub}>{dashboardBrief.body}</p>
          </div>
        </div>
        {activePledges.length ? (
          unfinishedToday.length ? (
            <div style={styles.queueList}>
              {todayQueue.slice(0, 4).map(pledge => {
                const progress = progressOf(pledge)
                const checked = checkedMap[pledge.id]
                const left = daysLeft(pledge)
                return (
                  <button
                    key={pledge.id}
                    onClick={() => nav(checked ? '/pledge/' + pledge.id : '/pledge/' + pledge.id + '/checkin')}
                    style={styles.queueItem}
                  >
                    <div style={styles.queueIcon}>{checked ? '✓' : '守'}</div>
                    <div style={styles.queueMain}>
                      <div style={styles.queueTitle}>{pledgeTitle(pledge)}</div>
                      <div style={styles.queueMeta}>{progress.done}/{progress.total} 天 · {left === null ? '持续守诺' : left === 0 ? '今日到期' : '还剩 ' + left + ' 天'}</div>
                    </div>
                    {checked ? <span style={styles.donePill}>已守</span> : <span style={styles.queueAction}>打卡</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={styles.allDoneCard}>✓ 今日全部完成。你已经把今天的诺言守住了，明天再继续。</div>
          )
        ) : (
          <div style={styles.empty}>暂无进行中的诺言。先立下一件每天能守住的小事。</div>
        )}
      </section>




      <main style={styles.scrollCard}>
        <div style={styles.scrollLineTop} />
        <div style={styles.scrollLineBottom} />
        <p style={styles.eyebrow}>今日诺言</p>
        <h2 style={styles.pledgeName}>
          {loading ? '正在展开契约...' : todayPledge ? pledgeTitle(todayPledge) : '写下你的第一份军令状'}
        </h2>
        {todayPledge && <Seal profile={profile} />}




        {todayPledge ? (
          <>
            <p style={styles.bodyText}>这是一份已经盖印的诺言。今天只需要完成下一次证明，让契约继续有效。</p>
            <div style={styles.progressMeta}>
              <span>第 {mainProgress.done} / {mainProgress.total} 天</span>
              <span>{mainProgress.percent}%</span>
            </div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: mainProgress.percent + '%' }} />
            </div>
            <div style={styles.feedbackCard}>
              <div style={styles.feedbackLabel}>{homeFeedback.label}</div>
              <div style={styles.feedbackTitle}>{homeFeedback.title}</div>
              <div style={styles.feedbackBody}>{homeFeedback.body}</div>
              <div style={styles.feedbackNext}>{homeFeedback.next}</div>
            </div>
            <div style={styles.reminderStrip}>
              <span>{reminderLabel(mainReminder)}</span>
              <button onClick={() => nav('/pledge/' + todayPledge.id + '?tab=settings')} style={styles.reminderButton}>修改</button>
            </div>
            <div style={styles.actionRow}>
              <div style={styles.muted}>
                {mainDaysLeft === null ? '持续守诺中' : mainDaysLeft === 0 ? '今日到期' : '还剩 ' + mainDaysLeft + ' 天'}
              </div>
              <button
                onClick={() => nav(mainChecked ? '/pledge/' + todayPledge.id : '/pledge/' + todayPledge.id + '/checkin')}
                style={styles.primaryButton}
              >
                {mainChecked ? '查看记录' : '去打卡'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={styles.bodyText}>第一份诺言不用复杂，写清楚你每天要守住的一件事，再亲手盖下守诺印。</p>
            <div style={styles.feedbackCard}>
              <div style={styles.feedbackLabel}>{homeFeedback.label}</div>
              <div style={styles.feedbackTitle}>{homeFeedback.title}</div>
              <div style={styles.feedbackBody}>{homeFeedback.body}</div>
              <div style={styles.feedbackNext}>{homeFeedback.next}</div>
            </div>
            <button onClick={handleCreatePledge} style={styles.fullButton}>立下第一个誓言</button>
          </>
        )}
      </main>




      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>我的誓言</h3>
          {activePledges.length > 0 && (
            <button
              onClick={handleCreatePledge}
              aria-disabled={!canCreateNewPledge}
              style={{ ...styles.linkButton, ...(!canCreateNewPledge ? styles.linkButtonDisabled : {}) }}
            >
              {canCreateNewPledge ? '立新誓' : '已满3誓'}
            </button>
          )}
        </div>
        <div style={styles.ruleHint}>进行中的誓言最多 {MAX_ACTIVE_PLEDGES} 个；到期后守诺率达到 {COMPLETION_RATE_TARGET}% 即视为完成。</div>
        {activePledges.length ? (
          <div>
            {activePledges.slice(0, 3).map(pledge => {
              const progress = progressOf(pledge)
              return (
                <button key={pledge.id} onClick={() => nav('/pledge/' + pledge.id)} style={styles.pledgeItem}>
                  <div style={styles.pledgeItemTop}>
                    <div>
                      <div style={styles.pledgeItemTitle}>{pledgeTitle(pledge)}</div>
                      <div style={styles.pledgeMeta}>押注 {pledge.stake_coins || pledge.stake_amount || pledge.stake || 0} 金币 · {checkedMap[pledge.id] ? '今日已打卡' : '今日待打卡'}</div>
                    </div>
                    <div style={{ color: '#c39a32', fontSize: 14, fontWeight: 900 }}>{progress.percent}%</div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={styles.empty}>暂无进行中的诺言。让首页从第一份契约开始。</div>
        )}
      </section>




      <section style={styles.smallGrid}>
        <button onClick={() => nav('/charity')} style={styles.smallCard}>
          <div style={styles.smallLabel}>公益金币</div>
          <div style={styles.smallValue}>{profile?.merit_coins || 0}</div>
        </button>
        <button onClick={() => nav('/square')} style={styles.smallCard}>
          <div style={styles.smallLabel}>契约押注中</div>
          <div style={styles.smallValue}>{lockedCoins}</div>
        </button>
      </section>
    </div>
  )
}
