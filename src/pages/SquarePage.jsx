// src/pages/SquarePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicPledges } from '../lib/supabase'
import { format, differenceInDays } from 'date-fns'

const CATS = ['全部','🏃 健康','🎮 游戏','📚 学习','🌅 生活','❤️ 公益','💰 财务']

const SUCCESS_STORIES = [
  { ava:'静', color:'#3B7A4A', name:'静水', title:'连续冥想30天完成记', time:'5天前', helped:29,
       quote:'第1-7天：脑子根本静不下来。第8天出现了3分钟真正安静的时刻，就像充了电。第16-30天：不冥想会觉得少了什么……',
       tags:['😖 前7天最难','🧠 专注力提升','⏰ 睡前最佳'], likes:47, comments:18 },
  { ava:'清', color:'#3A6A9A', name:'清风', title:'戒烟60天：我是怎么做到的', time:'2周前', helped:156,
       quote:'最危险的是饭后和压力大时。我的方法：饭后立刻去刷牙，压力大时做10次深呼吸。把烟换成别的仪式感……',
       tags:['🍽️ 饭后最危险','🪥 刷牙替代法','💨 深呼吸技巧'], likes:203, comments:67 },
  { ava:'远', color:'#8A5A2A', name:'远航', title:'100天英语打卡全记录', time:'1个月前', helped:94,
       quote:'最重要的建议：不追求完美，漏了一天也继续。我中途漏了3天，但最后还是完成了。完美主义是最大的敌人……',
       tags:['🎯 不追求完美','📱 App推荐','🌙 睡前15分钟'], likes:88, comments:31 },
  ]

const TOPICS = [
  { icon:'🏃', name:'跑步', total:238, done:74, rate:31, active:8 },
  { icon:'📚', name:'读书', total:312, done:142, rate:46, active:15 },
  { icon:'🎮', name:'游戏通关', total:89, done:21, rate:24, active:5 },
  { icon:'🌅', name:'早起', total:178, done:56, rate:31, active:11 },
  { icon:'🧘', name:'冥想', total:145, done:78, rate:54, active:9 },
  { icon:'💪', name:'健身', total:267, done:93, rate:35, active:18 },
  ]

const PERIOD_LABEL = { week:'周', month:'月', season:'季', year:'年' }

export default function SquarePage() {
    const nav = useNavigate()
    const [tab, setTab] = useState('live')
    const [cat, setCat] = useState('全部')
    const [pledges, setPledges] = useState([])
    const [loading, setLoading] = useState(true)
    const [likedStories, setLikedStories] = useState({})

  useEffect(() => {
        getPublicPledges().then(data => {
                setPledges(data || [])
                setLoading(false)
        }).catch(() => setLoading(false))
  }, [])

  function toggleLike(idx) {
        setLikedStories(m => ({ ...m, [idx]: !m[idx] }))
  }

  return (
        <div style={{ background:'#FAF7F2', minHeight:'100vh', paddingBottom:90 }}>
                <div style={S.topbar}>
                          <div style={S.logo}>广<em style={{ color:'#C8922A', fontStyle:'normal' }}>场</em>em></div>div>
                </div>div>
                <div style={S.tabRow}>
                  {[['live','进行中'],['done','✨ 成功经验'],['topic','📌 誓言主题']].map(([k,lbl]) => (
                    <button key={k} style={{ ...S.tab, ...(tab===k ? S.tabOn : {}) }} onClick={() => setTab(k)}>{lbl}</button>button>
                  ))}
                </div>div>

          {tab === 'live' && (
                  <div style={{ padding:'0 16px' }}>
                              <div style={{ display:'flex', gap:7, overflowX:'auto', padding:'12px 0', WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
                                {CATS.map(c => (
                                  <div key={c} style={{ ...S.chip, ...(cat===c ? S.chipOn : {}), whiteSpace:'nowrap', flexShrink:0 }}
                                                    onClick={() => setCat(c)}>{c}</div>div>
                                ))}
                              </div>div>
                    {loading && <div style={S.empty}>加载中…</div>div>}
                    {!loading && pledges.length === 0 && <div style={S.empty}>还没有公开誓言，成为第一个！</div>div>}
                    {pledges.map(p => {
                                const pct = Math.min(100, Math.round((p.checkin_count / p.total_days) * 100))
                                const daysLeft = Math.max(0, differenceInDays(new Date(p.end_date), new Date()))
                                return (
                                                <div key={p.id} style={S.pledgeCard} onClick={() => nav(`/pledge/${p.id}`)}>
                                                                  <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                                                                                      <div style={{ ...S.ava, background:'#C8922A' }}>{(p.profiles?.nickname || '？')[0]}</div>div>
                                                                                      <div style={{ flex:1, minWidth:0 }}>
                                                                                                            <div style={{ fontSize:14, fontWeight:700, fontFamily:'Noto Serif SC,serif', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>div>
                                                                                                            <div style={{ fontSize:11, color:'#9A8A70' }}>{p.profiles?.nickname ?? '匿名'} · {PERIOD_LABEL[p.period]}度誓言 · 押{p.stake_coins}金币</div>div>
                                                                                        </div>div>
                                                                                      <div style={{ ...S.tag, background:'#FDF3E0', color:'#7A5A18', flexShrink:0 }}>进行中</div>div>
                                                                  </div>div>
                                                                  <div style={{ marginBottom:6 }}>
                                                                                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#9A8A70', marginBottom:4 }}>
                                                                                                            <span>第{p.checkin_count}天 / 共{p.total_days}天</span>span>
                                                                                                          <span style={{ color:'#C8922A', fontWeight:600 }}>{pct}%</span>span>
                                                                                        </div>div>
                                                                                    <div style={{ height:5, background:'#F0EAE0', borderRadius:3, overflow:'hidden' }}>
                                                                                                        <div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,#C8922A,#E8B84A)', borderRadius:3 }}/>
                                                                                      </div>div>
                                                                  </div>div>
                                                                <div style={{ fontSize:11, color:'#B8A88A' }}>还剩{daysLeft}天结束</div>div>
                                                </div>div>
                                              )
                    })}
                  </div>div>
              )}
        
          {tab === 'done' && (
                  <div style={{ padding:'0 16px' }}>
                            <div style={S.mentorCard}>
                                        <div style={{ position:'absolute', right:-10, top:-10, fontSize:80, opacity:.07, lineHeight:1, pointerEvents:'none' }}>🏆</div>div>
                                        <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginBottom:8, fontWeight:600, letterSpacing:.5 }}>本周导师推荐</div>div>
                                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                                                      <div style={{ ...S.ava, width:48, height:48, fontSize:20, background:'linear-gradient(135deg,#C8922A,#E8B84A)', flexShrink:0 }}>铁</div>div>
                                                      <div>
                                                                      <div style={{ fontSize:15, fontWeight:700, color:'#fff', fontFamily:'Noto Serif SC,serif' }}>铁汉</div>div>
                                                                      <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:2 }}>健身增肌 · 完成4次 · 帮助了83人</div>div>
                                                      </div>div>
                                                      <div style={{ marginLeft:'auto', textAlign:'center', flexShrink:0 }}>
                                                                      <div style={{ fontSize:18, fontWeight:700, color:'#E8B84A' }}>4.9</div>div>
                                                                      <div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>导师评分</div>div>
                                                      </div>div>
                                        </div>div>
                                        <div style={{ fontSize:12, color:'rgba(255,255,255,.7)', lineHeight:1.7, marginBottom:12, fontStyle:'italic' }}>
                                                      「增肌最难的不是训练，是不看体重秤。前三周身体在适应，不要被数字打败。」
                                        </div>div>
                                        <div style={{ display:'flex', gap:8 }}>
                                                      <button style={S.smBtnLight}>查看主页</button>button>
                                                      <button style={S.smBtnGhost}>向他提问 · 20金币</button>button>
                                        </div>div>
                            </div>div>
                            <div style={{ fontSize:11, color:'#9A8A70', fontWeight:600, marginBottom:10, letterSpacing:.5 }}>🎖 近期成功经验分享</div>div>
                    {SUCCESS_STORIES.map((s, idx) => (
                                <div key={idx} style={S.successCard}>
                                              <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                                                              <div style={{ ...S.ava, background:s.color, flexShrink:0 }}>{s.ava}</div>div>
                                                              <div style={{ flex:1, minWidth:0 }}>
                                                                                <div style={{ fontSize:14, fontWeight:700, fontFamily:'Noto Serif SC,serif' }}>{s.title}</div>div>
                                                                                <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>{s.name} · {s.time} · 已帮助{s.helped}人</div>div>
                                                              </div>div>
                                                              <div style={{ ...S.tag, background:'#E8F5EC', color:'#1A4A28', flexShrink:0 }}>🏆 完成</div>div>
                                              </div>div>
                                              <div style={S.quote}>「{s.quote}」</div>div>
                                              <div style={{ display:'flex', gap:6, margin:'10px 0', flexWrap:'wrap' }}>
                                                {s.tags.map(t => <div key={t} style={S.expTag}>{t}</div>div>)}
                                              </div>div>
                                              <div style={{ display:'flex', alignItems:'center', gap:8, borderTop:'0.5px solid #F0EAE0', paddingTop:10 }}>
                                                              <button style={{ ...S.actionBtn, color: likedStories[idx] ? '#C84040' : '#9A8A70' }} onClick={() => toggleLike(idx)}>
                                                                {likedStories[idx] ? '❤️' : '🤍'} {s.likes + (likedStories[idx] ? 1 : 0)}
                                                              </button>button>
                                                              <button style={S.actionBtn}>💬 {s.comments}条</button>button>
                                                              <button style={S.actionBtn}>❓ 提问</button>button>
                                                              <div style={{ marginLeft:'auto', fontSize:11, color:'#C8922A', fontWeight:600 }}>+20金币/回答</div>div>
                                              </div>div>
                                </div>div>
                              ))}
                  </div>div>
              )}
        
          {tab === 'topic' && (
                  <div style={{ padding:'0 16px' }}>
                            <div style={{ fontSize:12, color:'#9A8A70', margin:'12px 0', lineHeight:1.6, background:'#F5F0E8', borderRadius:10, padding:'10px 12px' }}>
                                        相同目标聚合在一起——看同类人的故事，找到属于自己的方法，避免重复踩坑。
                            </div>div>
                    {TOPICS.map((t, i) => (
                                <div key={i} style={S.topicCard}>
                                              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                                                              <div style={{ fontSize:30, width:44, textAlign:'center', flexShrink:0 }}>{t.icon}</div>div>
                                                              <div style={{ flex:1 }}>
                                                                                <div style={{ fontSize:15, fontWeight:700, fontFamily:'Noto Serif SC,serif' }}>{t.name}</div>div>
                                                                                <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>
                                                                                  {t.total}人立过此誓 · {t.done}人完成 · <b style={{ color:'#3B7A4A' }}>完成率{t.rate}%</b>b>
                                                                                </div>div>
                                                              </div>div>
                                                              <span style={{ fontSize:18, color:'#C0B090' }}>›</span>span>
                                              </div>div>
                                              <div style={{ display:'flex', gap:8 }}>
                                                {[{ val:t.active, lbl:'进行中', color:'#C8922A' },{ val:t.done, lbl:'已完成', color:'#3B7A4A' },{ val:`${t.rate}%`, lbl:'完成率', color:'#3A6A9A' }].map(({ val, lbl, color }) => (
                                                    <div key={lbl} style={{ flex:1, background:'#FAF7F2', borderRadius:8, padding:'8px 6px', textAlign:'center' }}>
                                                                        <div style={{ fontSize:15, fontWeight:700, color }}>{val}</div>div>
                                                                        <div style={{ fontSize:10, color:'#B8A88A', marginTop:2 }}>{lbl}</div>div>
                                                    </div>div>
                                                  ))}
                                              </div>div>
                                </div>div>
                              ))}
                  </div>div>
              )}
        </div>div>
      )
}

const S = {
    topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px 10px', background:'#FAF7F2', borderBottom:'0.5px solid #E0D5C0', position:'sticky', top:0, zIndex:10 },
    logo: { fontFamily:'Noto Serif SC,serif', fontSize:20, fontWeight:900, color:'#1A1208' },
    tabRow: { display:'flex', borderBottom:'0.5px solid #E0D5C0', background:'#FAF7F2', position:'sticky', top:51, zIndex:9 },
    tab: { flex:1, padding:'10px 4px', fontSize:12, fontWeight:500, color:'#9A8A70', background:'none', border:'none', borderBottom:'2px solid transparent', cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
    tabOn: { color:'#C8922A', borderBottomColor:'#C8922A', fontWeight:600 },
    chip: { padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', background:'#fff', border:'0.5px solid #E0D5C0', color:'#7A6A50', fontFamily:'Noto Sans SC,sans-serif' },
    chipOn: { background:'#C8922A', color:'#fff', border:'0.5px solid #C8922A' },
    ava: { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', fontFamily:'Noto Serif SC,serif', flexShrink:0 },
    pledgeCard: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, cursor:'pointer', boxShadow:'0 1px 6px rgba(26,18,8,.05)' },
    tag: { fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20 },
    mentorCard: { background:'linear-gradient(135deg,#2A1A08,#4A2E10)', borderRadius:20, padding:16, margin:'12px 0 16px', position:'relative', overflow:'hidden' },
    smBtnLight: { background:'#C8922A', color:'#fff', border:'none', borderRadius:20, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
    smBtnGhost: { background:'none', border:'1px solid rgba(255,255,255,.3)', color:'rgba(255,255,255,.7)', borderRadius:20, padding:'7px 12px', fontSize:12, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
    successCard: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, boxShadow:'0 1px 6px rgba(26,18,8,.05)' },
    quote: { fontSize:12, color:'#5A4A30', lineHeight:1.7, background:'#FAF7F2', borderRadius:8, padding:'10px 12px', fontStyle:'italic' },
    expTag: { fontSize:11, color:'#7A6A50', background:'#F5F0E8', borderRadius:20, padding:'3px 10px', fontFamily:'Noto Sans SC,sans-serif' },
    actionBtn: { background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#9A8A70', display:'flex', alignItems:'center', gap:4, fontFamily:'Noto Sans SC,sans-serif', padding:'4px 6px' },
    topicCard: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, boxShadow:'0 1px 4px rgba(26,18,8,.04)' },
    empty: { textAlign:'center', color:'#9A8A70', padding:40, fontSize:13 },
}</span>
