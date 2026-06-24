// src/pages/PledgeDetail.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getPledgeDetail, getCheckins, hasCheckedInToday } from '../lib/supabase'
import { format, eachDayOfInterval, parseISO, getDay } from 'date-fns'

const PERIOD_LABEL = { week:'周', month:'月', season:'季', year:'年' }
const MOOD_LABEL = { great:'💪 超级顺利', grind:'😤 咬牙坚持', steady:'😌 平稳推进', danger:'🆘 差点放弃' }

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
                                      const { session } = useAuth()
                                          const nav = useNavigate()
                                              const [pledge, setPledge] = useState(null)
                                                  const [checkins, setCheckins] = useState([])
                                                      const [checkedToday, setCheckedToday] = useState(false)
                                                          const [tab, setTab] = useState('log')
                                                            
                                                              useEffect(() => { load() }, [id])
                                                                
                                                                  async function load() {
                                                                        const [p, cks, checked] = await Promise.all([
                                                                                getPledgeDetail(id), getCheckins(id), hasCheckedInToday(id),
                                                                              ])
                                                                              setPledge(p); setCheckins(cks); setCheckedToday(checked)
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
                                                        
                                                          return (
                                                                <div style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom))', background:'#FAF7F2', minHeight:'100vh' }}>
                                                                      <div style={S.topbar}>
                                                                              <button style={S.back} onClick={() => nav(-1)}>←</button>
                                                                              <div style={S.topbarTitle}>{pledge.title}</div>
                                                                              <div style={{ width:32 }} />
                                                                      </div>
                                                                      <div style={S.tabRow}>
                                                                        {['log','calendar','witness'].map((t,i) => (
                                                                            <button key={t} style={{ ...S.tab, ...(tab===t?S.tabOn:{}) }} onClick={() => setTab(t)}>
                                                                              {['打卡日记','日历','见证者'][i]}
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
                                                                                              {c.note && <div style={{ fontSize:13, lineHeight:1.7, color:'#3A2A18', borderLeft:'3px solid #C8922A', paddingLeft:10, fontStyle:'italic', marginBottom:8 }}>「{c.note}」</div>}
                                                                                              {c.mood && <div style={{ fontSize:11, color:'#9A8A70' }}>{MOOD_LABEL[c.mood]||c.mood}</div>}
                                                                                                              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                                                                                                                                  <div style={{ fontSize:10, fontWeight:600, color:c.status==='valid'?'#3B7A4A':'#9A8A70', background:c.status==='valid'?'#E8F5EC':'#F5F0E8', padding:'2px 8px', borderRadius:20 }}>
                                                                                                                                    {c.status==='valid'?'✓ 已验证':c.status==='pending'?'⏳ 审核中':c.status}
                                                                                                                                    </div>
                                                                                                                </div>
                                                                                              </div>
                                                                                          ))
                                                                              }
                                                                            </div>
                                                                              )}
                                                                        {tab === 'calendar' && <CalendarView checkins={checkins} pledge={pledge} />}
                                                                        {tab === 'witness' && (
                                                                            <div style={{ textAlign:'center', padding:'40px 20px' }}>
                                                                                        <div style={{ fontSize:40, marginBottom:12 }}>👁</div>
                                                                                        <div style={{ fontSize:14, fontWeight:600, color:'#1A1208', marginBottom:6 }}>见证者系统即将上线</div>
                                                                                        <div style={{ fontSize:12, color:'#9A8A70', lineHeight:1.6 }}>邀请朋友押注见证你的誓言</div>
                                                                            </div>
                                                                              )}
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
