// src/pages/HomePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getMyPledges, hasCheckedInToday, getMeritTitle } from '../lib/supabase'
import { differenceInDays } from 'date-fns'


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


const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8f5ef',
    color: '#1d1309',
    padding: '28px 20px 96px',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20
  },
  title: {
    margin: 0,
    fontFamily: 'serif',
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: 0
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: 14,
    color: '#8a7b67'
  },
  meritButton: {
    border: '1px solid #dccfb9',
    background: 'rgba(255,255,255,0.7)',
    color: '#8a6a2d',
    borderRadius: 999,
    padding: '7px 11px',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap'
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    border: '1px solid #e0d4bf',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.78)',
    overflow: 'hidden',
    boxShadow: '0 6px 18px rgba(79,55,20,0.06)',
    marginBottom: 14
  },
  statItem: {
    padding: '12px 6px',
    textAlign: 'center',
    borderRight: '1px solid #e8ddcb'
  },
  statItemLast: {
    padding: '12px 6px',
    textAlign: 'center'
  },
  statValue: {
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 900,
    color: '#1d1309'
  },
  statLabel: {
    marginTop: 7,
    fontSize: 12,
    color: '#8a7b67'
  },
  scrollCard: {
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid #d7c29a',
    borderRadius: 8,
    background: 'linear-gradient(180deg, #fff8e3 0%, #fff1c7 100%)',
    padding: 20,
    boxShadow: '0 10px 24px rgba(79,55,20,0.11)',
    marginBottom: 16
  },
  scrollLineTop: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 11,
    height: 1,
    background: 'rgba(213,174,92,0.7)'
  },
  scrollLineBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 11,
    height: 1,
    background: 'rgba(213,174,92,0.7)'
  },
  eyebrow: {
    margin: 0,
    color: '#9a7130',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 3
  },
  pledgeName: {
    margin: '8px 0 0',
    maxWidth: '82%',
    fontFamily: 'serif',
    fontSize: 25,
    lineHeight: 1.25,
    fontWeight: 900
  },
  bodyText: {
    maxWidth: '78%',
    margin: '14px 0 0',
    color: '#6f604e',
    fontSize: 14,
    lineHeight: 1.75
  },
  seal: {
    position: 'absolute',
    right: 10,
    bottom: 74,
    width: 70,
    height: 70,
    borderRadius: '50%',
    border: '2px solid rgba(176, 36, 24, 0.82)',
    background: 'rgba(255, 239, 230, 0.72)',
    color: '#9b1f16',
    transform: 'rotate(-12deg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'serif',
    boxSizing: 'border-box'
  },
  sealChar: {
    fontSize: 21,
    lineHeight: 1,
    fontWeight: 900
  },
  sealText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 2
  },
  progressMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    color: '#7c6b57'
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: '#eadfc9',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: '#c99a2e'
  },
  feedbackCard: {
    marginTop: 14,
    border: '1px solid rgba(201,154,46,0.24)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.54)',
    padding: '12px 13px'
  },
  feedbackLabel: {
    color: '#a97922',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.5,
    marginBottom: 6
  },
  feedbackTitle: {
    color: '#1d1309',
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.35,
    marginBottom: 5
  },
  feedbackBody: {
    color: '#6f604e',
    fontSize: 13,
    lineHeight: 1.65
  },
  feedbackNext: {
    marginTop: 8,
    color: '#9a7130',
    fontSize: 12,
    fontWeight: 800
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18
  },
  muted: {
    color: '#7c6b57',
    fontSize: 14
  },
  primaryButton: {
    border: 0,
    borderRadius: 8,
    background: '#171008',
    color: '#f6d486',
    padding: '12px 22px',
    fontSize: 14,
    fontWeight: 900,
    boxShadow: '0 4px 10px rgba(23,16,8,0.16)'
  },
  fullButton: {
    width: '100%',
    border: 0,
    borderRadius: 8,
    background: '#171008',
    color: '#f6d486',
    padding: '13px 16px',
    fontSize: 15,
    fontWeight: 900,
    marginTop: 18
  },
  panel: {
    border: '1px solid #e0d4bf',
    borderRadius: 8,
    background: '#fff',
    padding: 16,
    boxShadow: '0 6px 18px rgba(79,55,20,0.06)',
    marginBottom: 16
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  panelTitle: {
    margin: 0,
    fontFamily: 'serif',
    fontSize: 22,
    fontWeight: 900
  },
  linkButton: {
    border: 0,
    background: 'transparent',
    color: '#b88923',
    fontSize: 14,
    fontWeight: 900,
    padding: 4
  },
  pledgeItem: {
    width: '100%',
    border: '1px solid #eee4d2',
    borderRadius: 8,
    background: '#fffdf8',
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
    fontSize: 15,
    fontWeight: 900,
    color: '#1d1309'
  },
  pledgeMeta: {
    marginTop: 5,
    fontSize: 12,
    color: '#8a7b67',
    lineHeight: 1.45
  },
  empty: {
    borderRadius: 8,
    background: '#f8f5ef',
    color: '#8a7b67',
    padding: '18px 14px',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 1.65
  },
  smallGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12
  },
  smallCard: {
    border: '1px solid #e0d4bf',
    borderRadius: 8,
    background: '#fff',
    padding: 14,
    textAlign: 'left',
    boxShadow: '0 6px 18px rgba(79,55,20,0.05)'
  },
  smallLabel: {
    color: '#8a7b67',
    fontSize: 12
  },
  smallValue: {
    marginTop: 5,
    color: '#1d1309',
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


  useEffect(() => {
    if (session) load()
  }, [session])


  async function load() {
    setLoading(true)
    try {
      const data = await getMyPledges()
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


  const activePledges = pledges.filter(p => p.status === 'active' || p.status === 'ongoing')
  const unfinishedToday = activePledges.filter(p => !checkedMap[p.id])
  const todayPledge = [...(unfinishedToday.length ? unfinishedToday : activePledges)].sort((a, b) => {
    const aLeft = daysLeft(a) ?? 9999
    const bLeft = daysLeft(b) ?? 9999
    return aLeft - bLeft
  })[0]


  const completedToday = activePledges.filter(p => checkedMap[p.id]).length
  const totalCheckins = pledges.reduce((sum, p) => sum + (p.checkin_count || p.current_days || p.completed_days || 0), 0)
  const totalTarget = pledges.reduce((sum, p) => sum + (p.duration_days || p.target_days || p.days || 0), 0)
  const keepRate = totalTarget ? Math.round((totalCheckins / totalTarget) * 100) : 0
  const lockedCoins = activePledges.reduce((sum, p) => sum + Number(p.stake_coins || p.stake_amount || p.stake || 0), 0)
  const merit = getMeritDisplay(profile?.merit_score)
  const mainProgress = progressOf(todayPledge)
  const mainChecked = todayPledge ? checkedMap[todayPledge.id] : false
  const mainDaysLeft = daysLeft(todayPledge)
  const homeFeedback = getHomeFeedback({ pledge: todayPledge, progress: mainProgress, checkedToday: mainChecked, daysLeft: mainDaysLeft })


  if (!session) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>一诺千金</h1>
        <p style={styles.subtitle}>先登录，再立下属于你的第一份诺言。</p>
        <button onClick={() => nav('/auth')} style={styles.fullButton}>去登录</button>
      </div>
    )
  }


  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>一诺千金</h1>
          <p style={styles.subtitle}>守住今天，就是守住自己</p>
        </div>
        <button onClick={() => nav('/profile')} style={styles.meritButton}>
          {merit.emoji} {merit.title}
        </button>
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
            <button onClick={() => nav('/new')} style={styles.fullButton}>立下第一个誓言</button>
          </>
        )}
      </main>


      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h3 style={styles.panelTitle}>我的誓言</h3>
          <button onClick={() => nav('/new')} style={styles.linkButton}>立新誓</button>
        </div>
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
