// src/pages/PledgeDetail.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'
import { getPledgeDetail, getCheckins, hasCheckedInToday, getWitnesses, getMyWitness, addWitness, disputeCheckin, completePledge } from '../lib/supabase'
import { format, eachDayOfInterval, parseISO, getDay } from 'date-fns'


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








const PERIOD_LABEL = { week:'周', month:'月', season:'季', year:'年' }
const MOOD_LABEL = { great:'💪 超级顺利', grind:'😤 咬牙坚持', steady:'😌 平稳推进', danger:'🆘 差点放弃' }

function getCheckinAudioUrl(checkin) {
  if (checkin?.audio_url) return checkin.audio_url
  const match = String(checkin?.note || '').match(/语音证明[:：]\s*(https?:\/\/\S+)/)
  return match?.[1] || ''
}
function getCheckinDisplayNote(checkin) {
  return String(checkin?.note || '')
    .split('\n')
    .filter(line => !/^\s*语音证明[:：]\s*https?:\/\//.test(line))
    .join('\n')
    .trim()
}








function ringDash(pct, r = 34) {
    const circ = 2 * Math.PI * r
    return `${(pct / 100) * circ} ${circ}`
}








function WeekHeatmap({ checkinDates, startDate }) {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const dow = (getDay(today) + 6) % 7
    const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today); d.setDate(d.getDate() - dow + i); return d
    })
    const labels = ['一','二','三','四','五','六','日']
    const pledgeStart = parseISO(startDate)
    let streak = 0
    for (let i = dow; i >= 0; i--) {
          const d = new Date(today); d.setDate(d.getDate() - i)
          if (checkinDates.has(format(d, 'yyyy-MM-dd'))) streak++; else break
    }
    return (
          <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginBottom:7, fontWeight:500 }}>本周打卡</div>
                  <div style={{ display:'flex', gap:5, alignItems:'flex-end' }}>
                    {days.map((d, i) => {
                      const str = format(d, 'yyyy-MM-dd')
                      const done = checkinDates.has(str)
                      const isToday = str === todayStr
                      const isFuture = d > today
                      const beforeStart = d < pledgeStart
                      return (
                                    <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flex:1 }}>
                                                    <div style={{
                                                      width:'100%', height:28, borderRadius:6,
                                                      background: beforeStart ? 'transparent' : isFuture ? 'rgba(255,255,255,.08)'
                                                                          : done ? 'linear-gradient(180deg,#E8B84A,#C8922A)'
                                                                          : isToday ? 'rgba(200,146,42,.25)' : 'rgba(255,255,255,.08)',
                                                      border: isToday ? '1.5px solid #C8922A' : '1px solid transparent',
                                    }} />
                                                    <div style={{ fontSize:10, color: isToday ? '#C8922A' : 'rgba(255,255,255,.4)', fontWeight: isToday ? 700 : 400 }}>
                                                      {isToday ? '今' : labels[i]}
                                                    </div>
                                    </div>
                                  )
          })}
                            <div style={{ flex:1.5, marginLeft:4, borderLeft:'1px solid rgba(255,255,255,.1)', paddingLeft:8 }}>
                                        <div style={{ fontSize:11, color:'#3BBA5A', fontWeight:600 }}>
                                          {streak > 0 ? `连续${streak}天 🔥` : '今日待打卡'}
                                        </div>
                            </div>
                  </div>
          </div>
        )
}








function MilestoneAxis({ totalDays, checkinCount }) {
    const milestones = []
        if (totalDays >= 7)  milestones.push({ day:7, label:'1周' })
    if (totalDays >= 14) milestones.push({ day:14, label:'2周' })
    if (totalDays >= 21) milestones.push({ day:21, label:'3周' })
    if (totalDays >= 28) milestones.push({ day:28, label:'4周' })
    milestones.push({ day:totalDays, label:'完成' })
    const pct = Math.min(100, Math.round((checkinCount / totalDays) * 100))
    const all = [{ day:0, label:'出发' }, ...milestones]
    return (
          <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginBottom:8, fontWeight:500 }}>里程碑</div>
                <div style={{ position:'relative', padding:'0 4px' }}>
                        <div style={{ height:4, background:'rgba(255,255,255,.1)', borderRadius:2, margin:'14px 0 22px' }} />
                        <div style={{ height:4, background:'linear-gradient(90deg,#C8922A,#E8B84A)', borderRadius:2,
                                               position:'absolute', top:14, left:4, width:`${pct}%`, transition:'width .5s' }} />
                        <div style={{ display:'flex', justifyContent:'space-between', position:'absolute', top:8, left:4, right:4 }}>
                          {all.map((m) => {
                        const done = checkinCount >= m.day
                                      const isNext = !done && milestones.find(x => x.day > checkinCount)?.day === m.day
                                                    return (
                                                                    <div key={m.day} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                                                                                    <div style={{ width:10, height:10, borderRadius:'50%',
                                                                                                                   background: done ? '#E8B84A' : isNext ? 'rgba(232,184,74,.4)' : 'rgba(255,255,255,.15)',
                                                                                                                   border: isNext ? '1.5px solid #E8B84A' : 'none' }} />
                                                                                    <div style={{ fontSize:9, color: (done||isNext) ? '#E8B84A' : 'rgba(255,255,255,.3)',
                                                                                                                   fontWeight: (done||isNext) ? 600 : 400, whiteSpace:'nowrap' }}>
                                                                                      {m.label}{done && m.day > 0 ? ' ✓' : ''}
                                                                                      </div>
                                                                    </div>
                                                                  )
                          })}
                        </div>
                </div>
          </div>
        )
}








function CalendarView({ checkins, pledge }) {
    const start = parseISO(pledge.start_date)
        const end = parseISO(pledge.end_date)
            const today = new Date()
                const checkinDates = new Set(checkins.map(c => c.checkin_date))
                    const allDays = eachDayOfInterval({ start, end: today < end ? today : end })
                        const startDow = (getDay(start) + 6) % 7
                            return (
                                  <div>
                                        <div style={{ fontSize:12, color:'#9A8A70', marginBottom:10 }}>
                                          {format(start,'M月')} · 共{pledge.total_days}天，已完成{pledge.checkin_count}天
                                        </div>
                                        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:6 }}>
                                          {['一','二','三','四','五','六','日'].map(d => (
                                              <div key={d} style={{ textAlign:'center', fontSize:10, color:'#9A8A70', padding:'3px 0' }}>{d}</div>
                                            ))}
                                        </div>
                                        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
                                          {Array.from({ length: startDow }).map((_,i) => <div key={`p${i}`} />)}
                                          {allDays.map(day => {
                                              const key = format(day, 'yyyy-MM-dd')
                                                          const done = checkinDates.has(key)
                                                                      const isToday = key === format(today, 'yyyy-MM-dd')
                                                                                  return (
                                                                                                <div key={key} style={{ aspectRatio:'1', borderRadius:5, display:'flex',
                                                                                                                                     alignItems:'center', justifyContent:'center', fontSize:10,
                                                                                                                                     background: done ? '#C8922A' : isToday ? '#FDF3E0' : '#F0EAE0',
                                                                                                                                     color: done ? '#fff' : isToday ? '#C8922A' : '#9A8A70',
                                                                                                                                     border: isToday ? '1.5px solid #C8922A' : 'none',
                                                                                                                                     fontWeight: done || isToday ? 600 : 400 }}>
                                                                                                  {format(day, 'd')}
                                                                                                  </div>
                                                                                              )
                                          })}
                                        </div>
                                  </div>
                                )
                              }
                              
                              export default function PledgeDetail() {
                                  const { id } = useParams()
                                      const { session, refreshProfile } = useAuth()
                                          const nav = useNavigate()
                                          const [searchParams] = useSearchParams()
                                              const [pledge, setPledge] = useState(null)
                                                  const [checkins, setCheckins] = useState([])
                                                      const [checkedToday, setCheckedToday] = useState(false)
                                                          const [tab, setTab] = useState(searchParams.get('tab') || 'log')
                                                          const [witnesses, setWitnesses] = useState([])
                                                          const [myWitness, setMyWitness] = useState(null)
                                                          const [witnessLoading, setWitnessLoading] = useState(false)
                                                          const [settlementLoading, setSettlementLoading] = useState(false)
                                                          const [betAmount, setBetAmount] = useState(50)
                                                          const [showBetPanel, setShowBetPanel] = useState(false)
                                                          const [disputeTarget, setDisputeTarget] = useState(null)
                                                          const [disputeReason, setDisputeReason] = useState('')
                                                          const [toast, setToast] = useState(null)
                                                          const userId = session?.user?.id
                                                          const [reminder, setReminder] = useState(DEFAULT_REMINDER)








                                                          function showToast(msg, type='info') {
                                                            setToast({ msg, type })
                                                            setTimeout(() => setToast(null), 2500)
                                                          }
                                                            
                                                              useEffect(() => { load() }, [id])

                                                          useEffect(() => {
                                                            if (userId && id) setReminder(getReminderForPledge(userId, id))
                                                          }, [userId, id])
                                                                
                                                                  function updateReminder(patch) {
                                                            if (!userId) { showToast('请先登录', 'error'); return }
                                                            const next = saveReminderForPledge(userId, id, { ...reminder, ...patch })
                                                            setReminder(next)
                                                            syncBrowserReminder(next, pledge?.title)
                                                            showToast('提醒已保存 ✓', 'success')
                                                          }
                                                            
                                                                  async function load() {
                                                                        const [p, cks, checked] = await Promise.all([
                                                                                getPledgeDetail(id), getCheckins(id), hasCheckedInToday(id),
                                                                              ])
                                                                              setPledge(p); setCheckins(cks); setCheckedToday(checked)
                                                                              // 加载见证者数据
                                                                              getWitnesses(id).then(w => setWitnesses(w)).catch(() => {})
                                                                              if (session?.user?.id) {
                                                                                getMyWitness(session.user.id, id).then(w => setMyWitness(w)).catch(() => {})
                                                                              }
                                                                  }
                                
                                                                  async function handleDispute(checkin, reason) {
                                                                        if (!session?.user?.id) { showToast('请先登录', 'error'); return }
                                                                        if (session.user.id === pledge.user_id) { showToast('不能质疑自己的打卡', 'error'); return }
                                                                        if (checkin.status === 'disputed') { showToast('这条打卡已进入陪审团', 'info'); return }
                                                                        const finalReason = reason.trim() || '请求陪审团复核此打卡证据'
                                                                        setWitnessLoading(true)
                                                                        try {
                                                                          await disputeCheckin(session.user.id, checkin.id, pledge.id, finalReason)
                                                                          showToast('质疑已提交，等待陪审团裁定', 'success')
                                                                          setDisputeTarget(null)
                                                                          setDisputeReason('')
                                                                          load()
                                                                        } catch (err) {
                                                                          showToast(err.message || '质疑提交失败', 'error')
                                                                        } finally {
                                                                          setWitnessLoading(false)
                                                                        }
                                                                  }








                                                                  async function handleSettlement(success) {
                                                                        if (!session?.user?.id) { showToast('请先登录', 'error'); return }
                                                                        if (!pledge || session.user.id !== pledge.user_id) { showToast('只能结算自己的誓言', 'error'); return }
                                                                        const ok = window.confirm(success
                                                                          ? '确认誓言已完成并开始结算？'
                                                                          : '确认誓言失败，将押注捐出并进入冷静期？')
                                                                        if (!ok) return
                                                                        setSettlementLoading(true)
                                                                        try {
                                                                          await completePledge(pledge.id, session.user.id, success)
                                                                          showToast(success ? '誓言已完成，结算成功' : '誓言已失败，押注已进入公益', 'success')
                                                                          refreshProfile?.()
                                                                          load()
                                                                        } catch (err) {
                                                                          showToast(err.message || '结算失败', 'error')
                                                                        } finally {
                                                                          setSettlementLoading(false)
                                                                        }
                                                                  }


                                  if (!pledge) return (
                                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
                                              <div style={{ color:'#9A8A70' }}>加载中…</div>
                                        </div>
                                      )
                                    
                                      const pct = Math.min(100, Math.round((pledge.checkin_count / pledge.total_days) * 100))
                                          const daysLeft = Math.max(0, Math.ceil((new Date(pledge.end_date) - new Date()) / 86400000))
                                              const checkinDates = new Set(checkins.map(c => c.checkin_date))
                                                  const isOwner = session?.user?.id === pledge.user_id
                                                      const canCheckin = isOwner && pledge.status === 'active' && !checkedToday
                                                      const canSettleSuccess = isOwner && pledge.status === 'active' && pledge.checkin_count >= pledge.total_days
                                                      const canSettleFailure = isOwner && pledge.status === 'active' && daysLeft <= 0 && pledge.checkin_count < pledge.total_days
                                                        
                                                          return (
                                                                <div style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom))', background:'#FAF7F2', minHeight:'100vh' }}>
                                                                      {toast && (
                                                                        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
                                                                          background: toast.type === 'error' ? '#C84040' : toast.type === 'success' ? '#3B7A4A' : 'rgba(26,18,8,.88)',
                                                                          color:'#fff', padding:'9px 20px', borderRadius:20, fontSize:13,
                                                                          zIndex:200, whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(0,0,0,.2)' }}>
                                                                          {toast.msg}
                                                                        </div>
                                                                      )}
                                                                      <div style={S.topbar}>
                                                                              <button style={S.back} onClick={() => nav(-1)}>←</button>
                                                                              <div style={S.topbarTitle}>{pledge.title}</div>
                                                                              <div style={{ width:32 }} />
                                                                      </div>
                                                                      <div style={S.tabRow}>
                                                                        {['log','calendar','witness','settings'].map((t,i) => (
                                                                            <button key={t} style={{ ...S.tab, ...(tab===t?S.tabOn:{}) }} onClick={() => setTab(t)}>
                                                                              {['打卡日记','日历','见证者','提醒'][i]}
                                                                            </button>
                                                                          ))}
                                                                      </div>
                                                                      <div style={{ padding:'0 16px' }}>
                                                                              <div style={S.hero}>
                                                                                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
                                                                                                    <div style={{ flex:1 }}>
                                                                                                                  <div style={{ fontSize:16, fontWeight:700, fontFamily:'Noto Serif SC,serif', color:'#fff', marginBottom:4 }}>{pledge.title}</div>
                                                                                                                  <div style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>
                                                                                                                    {PERIOD_LABEL[pledge.period]}度誓言 · 押注{pledge.stake_coins}金币 · 失败捐给{pledge.charity_target}
                                                                                                                    </div>
                                                                                                      </div>
                                                                                                    <div style={S.statusBadge}>{pledge.status==='active'?'进行中':pledge.status==='done'?'已完成':'已结束'}</div>
                                                                                        </div>
                                                                                        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
                                                                                                    <div style={{ position:'relative', flexShrink:0 }}>
                                                                                                                  <svg width={80} height={80} viewBox="0 0 80 80">
                                                                                                                                  <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={7}/>
                                                                                                                                  <circle cx={40} cy={40} r={34} fill="none" stroke="#E8B84A" strokeWidth={7}
                                                                                                                                                      strokeDasharray={ringDash(pct)} strokeLinecap="round" transform="rotate(-90 40 40)"/>
                                                                                                                    </svg>
                                                                                                                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                                                                                                                                  <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:20, fontWeight:900, color:'#E8B84A', lineHeight:1 }}>
                                                                                                                                    {pct}<span style={{ fontSize:11 }}>%</span>
                                                                                                                                    </div>
                                                                                                                    </div>
                                                                                                      </div>
                                                                                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, flex:1 }}>
                                                                                                      {[
                                                                  { val:pledge.checkin_count, lbl:'已打卡天' },
                                                                  { val:daysLeft, lbl:'还剩天数', color:'#FF9090' },
                                                                  { val:`🔥 ${pledge.max_streak}`, lbl:'最长连续' },
                                                                  { val:pledge.current_streak, lbl:'当前连续' },
                                                                                ].map(({ val, lbl, color }) => (
                                                                                                  <div key={lbl} style={S.statBox}>
                                                                                                                    <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:16, fontWeight:700, color:color||'#E8B84A', lineHeight:1.3 }}>{val}</div>
                                                                                                                    <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:3 }}>{lbl}</div>
                                                                                                    </div>
                                                                                                ))}
                                                                                                      </div>
                                                                                        </div>
                                                                                        <WeekHeatmap checkinDates={checkinDates} startDate={pledge.start_date} />
                                                                                        <MilestoneAxis totalDays={pledge.total_days} checkinCount={pledge.checkin_count} />
                                                                                        {isOwner && pledge.status === 'active' && (canSettleSuccess || canSettleFailure) && (
                                                                                          <div style={{ marginTop:14, background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', borderRadius:12, padding:12 }}>
                                                                                            <div style={{ fontSize:12, fontWeight:700, color:'#E8B84A', marginBottom:6 }}>结算中心</div>
                                                                                            <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', lineHeight:1.6, marginBottom:10 }}>
                                                                                              完成后返还你的押注，并结算支持方；失败后你的押注进入公益，并结算质疑方。
                                                                                            </div>
                                                                                            <div style={{ display:'flex', gap:8 }}>
                                                                                              <button onClick={() => handleSettlement(true)} disabled={!canSettleSuccess || settlementLoading}
                                                                                                style={{ flex:1, border:'none', borderRadius:10, background: canSettleSuccess ? '#3B7A4A' : 'rgba(255,255,255,.12)', color:'#fff', padding:'9px 0', fontSize:12, fontWeight:700, opacity: canSettleSuccess ? 1 : .55, fontFamily:'Noto Sans SC,sans-serif' }}>
                                                                                                完成并结算
                                                                                              </button>
                                                                                              <button onClick={() => handleSettlement(false)} disabled={!canSettleFailure || settlementLoading}
                                                                                                style={{ flex:1, border:'none', borderRadius:10, background: canSettleFailure ? '#C84040' : 'rgba(255,255,255,.12)', color:'#fff', padding:'9px 0', fontSize:12, fontWeight:700, opacity: canSettleFailure ? 1 : .55, fontFamily:'Noto Sans SC,sans-serif' }}>
                                                                                                失败并捐出
                                                                                              </button>
                                                                                            </div>
                                                                                          </div>
                                                                                        )}
                                                                              </div>
                                                                        {tab === 'log' && (
                                                                            <div>
                                                                              {canCheckin && (
                                                                                            <div style={S.todayPrompt}>
                                                                                                            <div>
                                                                                                                              <div style={{ fontSize:13, fontWeight:700, color:'#7A5A18' }}>📸 今日还未打卡</div>
                                                                                                                              <div style={{ fontSize:11, color:'rgba(122,90,24,.7)', marginTop:2 }}>见证者都在等你今天的进展</div>
                                                                                                              </div>
                                                                                                            <button style={S.smBtnGold} onClick={() => nav(`/pledge/${id}/checkin`)}>去打卡</button>
                                                                                              </div>
                                                                                        )}
                                                                              {checkedToday && pledge.status==='active' && isOwner && (
                                                                                            <div style={{ ...S.todayPrompt, background:'#E8F5EC', border:'1.5px solid #3B7A4A' }}>
                                                                                                            <div style={{ fontSize:13, fontWeight:700, color:'#1A4A28' }}>✓ 今日已打卡！继续保持</div>
                                                                                              </div>
                                                                                        )}
                                                                              {checkins.length === 0
                                                                                              ? <div style={{ textAlign:'center', color:'#9A8A70', padding:40 }}>{isOwner ? '还没有打卡记录，快去打卡吧！' : '暂无打卡记录'}</div>
                                                                                          : [...checkins].reverse().map(c => (
                                                                                            <div key={c.id} style={S.diaryCard}>
                                                                                                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                                                                                                                  <div style={S.dayBadge}>第{c.day_num}天</div>
                                                                                                                                  <div style={{ fontSize:11, color:'#9A8A70' }}>{format(parseISO(c.checkin_date),'M月d日')}{c.is_makeup?' · 补卡':''}</div>
                                                                                                                {c.coins_earned > 0 && <div style={{ marginLeft:'auto', fontSize:11, color:'#C8922A', fontWeight:600 }}>+{c.coins_earned}金币</div>}
                                                                                                                </div>
                                                                                              {c.image_url && <img src={c.image_url} alt="打卡" style={{ width:'100%', borderRadius:10, maxHeight:180, objectFit:'cover', marginBottom:8 }} />}
                                                                                              {getCheckinAudioUrl(c) && (
                                                                                                <div style={{ background:'#FFF8E8', border:'1px solid rgba(200,146,42,.28)', borderRadius:12, padding:10, marginBottom:8 }}>
                                                                                                  <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, fontWeight:800, color:'#7A5A18', marginBottom:8 }}>
                                                                                                    <span>🎧</span><span>语音证明</span>
                                                                                                  </div>
                                                                                                  <audio controls src={getCheckinAudioUrl(c)} preload="metadata" style={{ width:'100%', height:36 }} />
                                                                                                </div>
                                                                                              )}
                                                                                              {getCheckinDisplayNote(c) && <div style={{ fontSize:13, lineHeight:1.7, color:'#3A2A18', borderLeft:'3px solid #C8922A', paddingLeft:10, fontStyle:'italic', marginBottom:8, whiteSpace:'pre-wrap' }}>「{getCheckinDisplayNote(c)}」</div>}
                                                                                              {c.mood && <div style={{ fontSize:11, color:'#9A8A70' }}>{MOOD_LABEL[c.mood]||c.mood}</div>}
                                                                                                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginTop:8 }}>
                                                                                                                {!isOwner && c.status === 'valid' ? (
                                                                                                                  <button onClick={() => { setDisputeTarget(c.id); setDisputeReason('') }} disabled={witnessLoading}
                                                                                                                    style={{ border:'1px solid #E0D5C0', background:'#fff', color:'#7A5A18', borderRadius:20, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' }}>
                                                                                                                    质疑此打卡
                                                                                                                  </button>
                                                                                                                ) : <div />}
                                                                                                                                  <div style={{ fontSize:10, fontWeight:600, color:c.status==='valid'?'#3B7A4A':c.status==='disputed'?'#C84040':'#9A8A70', background:c.status==='valid'?'#E8F5EC':c.status==='disputed'?'#FCEBEB':'#F5F0E8', padding:'2px 8px', borderRadius:20 }}>
                                                                                                                                    {c.status==='valid'?'✓ 已验证':c.status==='disputed'?'⚖️ 已质疑':c.status==='pending'?'⏳ 审核中':c.status}
                                                                                                                                    </div>
                                                                                                                </div>
                                                                                                              {disputeTarget === c.id && (
                                                                                                                <div style={{ marginTop:10, padding:10, borderRadius:10, background:'#FDF3E0', border:'1px solid rgba(200,146,42,.35)' }}>
                                                                                                                  <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                                                                                                                    placeholder="写下质疑理由，例如：截图不清晰、内容与誓言不符"
                                                                                                                    rows={2}
                                                                                                                    style={{ width:'100%', boxSizing:'border-box', border:'1px solid #E0D5C0', borderRadius:8, padding:8, fontSize:12, fontFamily:'Noto Sans SC,sans-serif', resize:'none', outline:'none' }} />
                                                                                                                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                                                                                                                    <button onClick={() => handleDispute(c, disputeReason)} disabled={witnessLoading}
                                                                                                                      style={{ flex:1, border:'none', borderRadius:8, background:'#C84040', color:'#fff', padding:'8px 0', fontSize:12, fontWeight:700, fontFamily:'Noto Sans SC,sans-serif' }}>
                                                                                                                      提交质疑
                                                                                                                    </button>
                                                                                                                    <button onClick={() => setDisputeTarget(null)}
                                                                                                                      style={{ flex:1, border:'1px solid #E0D5C0', borderRadius:8, background:'#fff', color:'#7A5A18', padding:'8px 0', fontSize:12, fontWeight:600, fontFamily:'Noto Sans SC,sans-serif' }}>
                                                                                                                      取消
                                                                                                                    </button>
                                                                                                                  </div>
                                                                                                                </div>
                                                                                                              )}
                                                                                              </div>
                                                                                          ))
                                                                              }
                                                                            </div>
                                                                              )}
                                                                        {tab === 'calendar' && <CalendarView checkins={checkins} pledge={pledge} />}
                                                                        {tab === 'settings' && (
                                                                          <div style={S.settingsCard}>
                                                                            <div style={S.settingsTitle}>誓言提醒</div>
                                                                            <div style={S.settingsDesc}>只管理这一个誓言。首页会显示这里的提醒时间。</div>
                                                                            <label style={S.switchRow}>
                                                                              <span>每日打卡提醒</span>
                                                                              <input type="checkbox" checked={!!reminder.enabled} onChange={e => updateReminder({ enabled: e.target.checked })} />
                                                                            </label>
                                                                            <label style={S.formRow}>
                                                                              <span>提醒时间</span>
                                                                              <input type="time" value={reminder.time || '20:30'} onChange={e => updateReminder({ time: e.target.value })} style={S.timeInput} />
                                                                            </label>
                                                                            <div style={S.styleGrid}>
                                                                              {[['gentle','温和'],['strict','严厉'],['ritual','仪式感']].map(([key, label]) => (
                                                                                <button key={key} onClick={() => updateReminder({ style: key })} style={{ ...S.styleBtn, ...(reminder.style === key ? S.styleBtnOn : {}) }}>
                                                                                  {label}
                                                                                </button>
                                                                              ))}
                                                                            </div>
                                                                          </div>
                                                                        )}
                                                                        {tab === 'witness' && (() => {
                                                                            const trustCount = witnesses.filter(w => w.type === 'trust').length
                                                                            const doubtCount = witnesses.filter(w => w.type === 'doubt').length
                                                                            const trustPool  = witnesses.filter(w => w.type === 'trust').reduce((s,w) => s + w.stake_coins, 0)
                                                                            const doubtPool  = witnesses.filter(w => w.type === 'doubt').reduce((s,w) => s + w.stake_coins, 0)
                                                                            const totalPool  = trustPool + doubtPool
                                                                            const trustPct   = totalPool > 0 ? Math.round(trustPool / totalPool * 100) : 50








                                                                            async function handleBet(type) {
                                                                              if (!session?.user?.id) { showToast('请先登录', 'error'); return }
                                                                              if (isOwner) { showToast('不能见证自己的誓言', 'error'); return }
                                                                              if (myWitness) { showToast('你已经押注过了', 'error'); return }
                                                                              setWitnessLoading(true)
                                                                              try {
                                                                                await addWitness(session.user.id, id, type, betAmount)
                                                                                showToast(`${type === 'trust' ? '支持' : '质疑'}成功！押注${betAmount}金币`, 'success')
                                                                                setShowBetPanel(false)
                                                                                load()
                                                                              } catch (err) {
                                                                                showToast(err.message || '押注失败', 'error')
                                                                              } finally { setWitnessLoading(false) }
                                                                            }








                                                                            return (
                                                                            <div>
                                                                              {/* 对赌池统计 */}
                                                                              <div style={{ background:'#fff', borderRadius:14, padding:16, marginBottom:12, border:'0.5px solid #E0D5C0' }}>
                                                                                <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>⚡ 对赌池</div>
                                                                                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                                                                                  <div style={{ flex:1, textAlign:'center' }}>
                                                                                    <div style={{ fontSize:18, fontWeight:700, color:'#3B7A4A' }}>{trustPool}</div>
                                                                                    <div style={{ fontSize:11, color:'#9A8A70' }}>支持方 · {trustCount}人</div>
                                                                                  </div>
                                                                                  <div style={{ fontSize:14, color:'#C8922A', fontWeight:700 }}>VS</div>
                                                                                  <div style={{ flex:1, textAlign:'center' }}>
                                                                                    <div style={{ fontSize:18, fontWeight:700, color:'#C84040' }}>{doubtPool}</div>
                                                                                    <div style={{ fontSize:11, color:'#9A8A70' }}>质疑方 · {doubtCount}人</div>
                                                                                  </div>
                                                                                </div>
                                                                                {/* 比例条 */}
                                                                                <div style={{ display:'flex', height:8, borderRadius:4, overflow:'hidden', background:'#F0EAE0' }}>
                                                                                  <div style={{ width:`${trustPct}%`, background:'#3B7A4A', transition:'width .3s' }} />
                                                                                  <div style={{ width:`${100 - trustPct}%`, background:'#C84040', transition:'width .3s' }} />
                                                                                </div>
                                                                                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9A8A70', marginTop:4 }}>
                                                                                  <span>支持 {trustPct}%</span>
                                                                                  <span>质疑 {100 - trustPct}%</span>
                                                                                </div>
                                                                              </div>








                                                                              {/* 我的押注状态 / 押注按钮 */}
                                                                              {myWitness ? (
                                                                                <div style={{ background: myWitness.type === 'trust' ? '#E8F5EC' : '#FCEBEB',
                                                                                  borderRadius:14, padding:14, marginBottom:12, textAlign:'center',
                                                                                  border: `1px solid ${myWitness.type === 'trust' ? '#3B7A4A' : '#C84040'}` }}>
                                                                                  <div style={{ fontSize:14, fontWeight:600,
                                                                                    color: myWitness.type === 'trust' ? '#3B7A4A' : '#C84040' }}>
                                                                                    {myWitness.type === 'trust' ? '✊ 你支持了这个誓言' : '🤔 你质疑了这个誓言'}
                                                                                  </div>
                                                                                  <div style={{ fontSize:12, color:'#9A8A70', marginTop:4 }}>
                                                                                    押注 {myWitness.stake_coins} 金币 · {myWitness.status === 'active' ? '等待结算' : myWitness.status === 'won' ? '已赢' : myWitness.status === 'lost' ? '已输' : myWitness.status}
                                                                                  </div>
                                                                                </div>
                                                                              ) : isOwner ? (
                                                                                <div style={{ background:'#FDF3E0', borderRadius:14, padding:14, marginBottom:12, textAlign:'center' }}>
                                                                                  <div style={{ fontSize:13, color:'#7A5A18' }}>分享给朋友，邀请他们来见证你的誓言 💪</div>
                                                                                </div>
                                                                              ) : pledge.status === 'active' ? (
                                                                                <div>
                                                                                  {!showBetPanel ? (
                                                                                    <button onClick={() => setShowBetPanel(true)}
                                                                                      style={{ width:'100%', background:'linear-gradient(135deg,#C8922A,#E8B84A)',
                                                                                        color:'#fff', border:'none', borderRadius:12, padding:'13px 0',
                                                                                        fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:12,
                                                                                        fontFamily:'Noto Sans SC,sans-serif',
                                                                                        boxShadow:'0 4px 16px rgba(200,146,42,.3)' }}>
                                                                                      参与见证 · 押注支持或质疑
                                                                                    </button>
                                                                                  ) : (
                                                                                    <div style={{ background:'#fff', borderRadius:14, padding:16, marginBottom:12,
                                                                                      border:'1.5px solid #C8922A' }}>
                                                                                      <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>选择押注金额</div>
                                                                                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                                                                                        {[10, 30, 50, 100, 200].map(a => (
                                                                                          <button key={a} onClick={() => setBetAmount(a)}
                                                                                            style={{ padding:'7px 14px', borderRadius:20, fontSize:13, cursor:'pointer',
                                                                                              fontFamily:'Noto Sans SC,sans-serif',
                                                                                              background: betAmount === a ? '#C8922A' : '#FAF7F2',
                                                                                              color: betAmount === a ? '#fff' : '#5A4A30',
                                                                                              border: betAmount === a ? '1px solid #C8922A' : '1px solid #E0D5C0' }}>
                                                                                            {a} 金币
                                                                                          </button>
                                                                                        ))}
                                                                                      </div>
                                                                                      <div style={{ display:'flex', gap:10 }}>
                                                                                        <button onClick={() => handleBet('trust')} disabled={witnessLoading}
                                                                                          style={{ flex:1, padding:'11px 0', borderRadius:10, border:'none',
                                                                                            background:'#3B7A4A', color:'#fff', fontSize:14, fontWeight:600,
                                                                                            cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif',
                                                                                            opacity: witnessLoading ? .6 : 1 }}>
                                                                                          ✊ 支持 Ta
                                                                                        </button>
                                                                                        <button onClick={() => handleBet('doubt')} disabled={witnessLoading}
                                                                                          style={{ flex:1, padding:'11px 0', borderRadius:10, border:'none',
                                                                                            background:'#C84040', color:'#fff', fontSize:14, fontWeight:600,
                                                                                            cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif',
                                                                                            opacity: witnessLoading ? .6 : 1 }}>
                                                                                          🤔 质疑 Ta
                                                                                        </button>
                                                                                      </div>
                                                                                      <button onClick={() => setShowBetPanel(false)}
                                                                                        style={{ width:'100%', marginTop:8, background:'none', border:'none',
                                                                                          color:'#9A8A70', fontSize:12, cursor:'pointer' }}>
                                                                                        取消
                                                                                      </button>
                                                                                    </div>
                                                                                  )}
                                                                                </div>
                                                                              ) : null}








                                                                              {/* 见证者列表 */}
                                                                              {witnesses.length > 0 ? (
                                                                                <div>
                                                                                  <div style={{ fontSize:12, fontWeight:600, color:'#9A8A70', marginBottom:8 }}>
                                                                                    见证者 · {witnesses.length}人
                                                                                  </div>
                                                                                  {witnesses.map(w => (
                                                                                    <div key={w.id} style={{ display:'flex', alignItems:'center', gap:10,
                                                                                      padding:'10px 0', borderBottom:'0.5px solid #F0EAE0' }}>
                                                                                      <div style={{ width:34, height:34, borderRadius:'50%',
                                                                                        background: w.type === 'trust' ? '#E8F5EC' : '#FCEBEB',
                                                                                        display:'flex', alignItems:'center', justifyContent:'center',
                                                                                        fontSize:16, flexShrink:0 }}>
                                                                                        {w.profiles?.avatar_emoji || (w.type === 'trust' ? '✊' : '🤔')}
                                                                                      </div>
                                                                                      <div style={{ flex:1, minWidth:0 }}>
                                                                                        <div style={{ fontSize:13, fontWeight:500 }}>
                                                                                          {w.profiles?.nickname || '匿名'}
                                                                                        </div>
                                                                                        <div style={{ fontSize:11, color:'#9A8A70' }}>
                                                                                          {w.type === 'trust' ? '支持' : '质疑'} · 押注{w.stake_coins}金币{w.status === 'won' ? ' · 已赢' : w.status === 'lost' ? ' · 已输' : ''}
                                                                                        </div>
                                                                                      </div>
                                                                                      <div style={{ fontSize:11, fontWeight:600, padding:'3px 9px',
                                                                                        borderRadius:20, flexShrink:0,
                                                                                        background: w.type === 'trust' ? '#E8F5EC' : '#FCEBEB',
                                                                                        color: w.type === 'trust' ? '#3B7A4A' : '#C84040' }}>
                                                                                        {w.type === 'trust' ? '支持方' : '质疑方'}
                                                                                      </div>
                                                                                    </div>
                                                                                  ))}
                                                                                </div>
                                                                              ) : (
                                                                                <div style={{ textAlign:'center', padding:'30px 20px' }}>
                                                                                  <div style={{ fontSize:32, marginBottom:8 }}>👁</div>
                                                                                  <div style={{ fontSize:13, color:'#9A8A70' }}>还没有人见证这个誓言</div>
                                                                                  <div style={{ fontSize:12, color:'#B8A88A', marginTop:4 }}>
                                                                                    {isOwner ? '分享给朋友来押注见证吧' : '成为第一个见证者'}
                                                                                  </div>
                                                                                </div>
                                                                              )}
                                                                            </div>
                                                                            )
                                                                          })()}
                                                                              <div style={{ height:20 }} />
                                                                      </div>
                                                                  {pledge.status==='active' && isOwner && (
                                                                          <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', width:'calc(100% - 32px)', maxWidth:358 }}>
                                                                                    <button style={{ ...S.btnGold, width:'100%', padding:14, fontSize:15, opacity:checkedToday?.6:1 }}
                                                                                      disabled={checkedToday} onClick={() => !checkedToday && nav(`/pledge/${id}/checkin`)}>
                                                                            {checkedToday ? '✓ 今日已打卡' : '今日打卡'}
                                                                          </button>
                                                                  </div>
                                                                        )}
                                                                  </div>
                                                                  )
                                                                  }
                                                                
                                                                const S = {
                                                                    topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'0.5px solid #E0D5C0', background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
                                                                  back: { background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#1A1208', padding:4, width:32 },
                                                                  topbarTitle: { fontSize:14, fontWeight:600, fontFamily:'Noto Serif SC,serif', flex:1, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'0 8px' },
                                                                  tabRow: { display:'flex', borderBottom:'0.5px solid #E0D5C0', background:'#FAF7F2', flexShrink:0 },
                                                                  tab: { flex:1, padding:'10px 0', fontSize:13, fontWeight:500, color:'#9A8A70', background:'none', border:'none', borderBottom:'2px solid transparent', cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
                                                                  tabOn: { color:'#C8922A', borderBottomColor:'#C8922A', fontWeight:600 },
                                                                  hero: { background:'linear-gradient(135deg,#2A1A08 0%,#3A2510 60%,#4A2E18 100%)', borderRadius:20, padding:18, margin:'16px 0', boxShadow:'0 8px 32px rgba(26,18,8,.2)' },
                                                                  statusBadge: { background:'rgba(200,146,42,.25)', color:'#E8B84A', fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:20, flexShrink:0, marginLeft:8 },
                                                                  statBox: { background:'rgba(255,255,255,.08)', borderRadius:8, padding:'8px 10px' },
                                                                  todayPrompt: { background:'#FDF3E0', border:'1.5px solid #C8922A', borderRadius:14, padding:14, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' },
                                                                  smBtnGold: { background:'#C8922A', color:'#fff', border:'none', borderRadius:20, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif', flexShrink:0 },
                                                                  diaryCard: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10 },
                                                                  dayBadge: { background:'#FDF3E0', color:'#7A5A18', fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20 },
                                                                  btnGold: { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff', border:'none', borderRadius:12, fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
                                                                  }
