// src/pages/PledgeDetail.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPledgeDetail, getCheckins, hasCheckedInToday } from '../lib/supabase'
import { format, eachDayOfInterval, parseISO } from 'date-fns'

export default function PledgeDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [pledge, setPledge] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [checkedToday, setCheckedToday] = useState(false)
  const [tab, setTab] = useState('log') // log | calendar

  useEffect(() => { load() }, [id])

  async function load() {
    const [p, cks, checked] = await Promise.all([
      getPledgeDetail(id),
      getCheckins(id),
      hasCheckedInToday(id)
    ])
    setPledge(p)
    setCheckins(cks)
    setCheckedToday(checked)
  }

  if (!pledge) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ color:'#9A8A70' }}>加载中…</div>
    </div>
  )

  const pct = Math.round((pledge.checkin_count / pledge.total_days) * 100)
  const daysLeft = Math.max(0, Math.ceil((new Date(pledge.end_date) - new Date()) / 86400000))

  // Build heatmap
  const allDays = eachDayOfInterval({ start: parseISO(pledge.start_date), end: new Date() })
  const checkinDates = new Set(checkins.map(c => c.checkin_date))

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={S.title}>承诺详情</div>
        <div style={{ width:32 }} />
      </div>

      {/* Hero */}
      <div style={S.hero}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:'Noto Serif SC,serif',
              color:'#fff', marginBottom:4 }}>{pledge.title}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>
              {pledge.period === 'week' ? '周' : pledge.period === 'month' ? '月' :
               pledge.period === 'season' ? '季' : '年'}度誓言 · 押注{pledge.stake_coins}金币
            </div>
          </div>
          <div style={{ background:'rgba(200,146,42,.3)', color:'#E8B84A',
            fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:20, flexShrink:0 }}>
            {pledge.status === 'active' ? '进行中' : pledge.status === 'done' ? '已完成' : '已结束'}
          </div>
        </div>

        {/* Ring + stats */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14 }}>
          {/* Mini ring */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <svg width={80} height={80} viewBox="0 0 80 80">
              <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={7}/>
              <circle cx={40} cy={40} r={34} fill="none" stroke="#E8B84A" strokeWidth={7}
                strokeDasharray={`${(pct/100)*213.6} 213.6`} strokeLinecap="round"
                transform="rotate(-90 40 40)"/>
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center' }}>
              <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:18, fontWeight:900,
                color:'#E8B84A', lineHeight:1 }}>{pct}<span style={{ fontSize:11 }}>%</span></div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, flex:1 }}>
            {[
              { val: pledge.checkin_count, lbl:'已打卡天' },
              { val: daysLeft, lbl:'还剩天数', color:'#FF8080' },
              { val: `🔥${pledge.max_streak}`, lbl:'最长连续' },
              { val: (pledge.witnesses || []).length, lbl:'见证人数' },
            ].map(({ val, lbl, color }) => (
              <div key={lbl} style={S.statBox}>
                <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:17, fontWeight:700,
                  color: color || '#E8B84A', lineHeight:1.2 }}>{val}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:3 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background:'rgba(255,255,255,.15)', borderRadius:3, height:5, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%',
            background:'linear-gradient(90deg,#C8922A,#E8B84A)', borderRadius:3 }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabRow}>
        <button style={{ ...S.tab, ...(tab==='log'?S.tabOn:{}) }} onClick={() => setTab('log')}>
          打卡日志
        </button>
        <button style={{ ...S.tab, ...(tab==='calendar'?S.tabOn:{}) }} onClick={() => setTab('calendar')}>
          日历
        </button>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        {/* Log tab */}
        {tab === 'log' && (
          checkins.length === 0
            ? <div style={{ textAlign:'center', color:'#9A8A70', padding:32 }}>
                还没有打卡记录，快去打卡吧！
              </div>
            : [...checkins].reverse().map(c => (
                <div key={c.id} style={S.logCard}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={S.dayBadge}>第{c.day_num}天</div>
                    <div style={{ fontSize:11, color:'#9A8A70' }}>
                      {format(parseISO(c.checkin_date), 'M月d日')}
                      {c.is_makeup && ' · 补卡'}
                    </div>
                    <div style={{ marginLeft:'auto', fontSize:11, color:'#C8922A', fontWeight:600 }}>
                      +{c.coins_earned}金币
                    </div>
                  </div>
                  {c.image_url && (
                    <img src={c.image_url} alt="打卡截图"
                      style={{ width:'100%', borderRadius:10, maxHeight:180,
                        objectFit:'cover', marginBottom:8 }} />
                  )}
                  {c.note && (
                    <div style={{ fontSize:13, lineHeight:1.7, color:'#3A2A18',
                      borderLeft:'3px solid #C8922A', paddingLeft:10, fontStyle:'italic' }}>
                      「{c.note}」
                    </div>
                  )}
                  {c.mood && (
                    <div style={{ fontSize:11, color:'#9A8A70', marginTop:6 }}>
                      {{great:'💪 超级顺利', grind:'😤 咬牙坚持',
                        steady:'😌 平稳推进', danger:'🆘 差点放弃'}[c.mood]}
                    </div>
                  )}
                </div>
              ))
        )}

        {/* Calendar tab */}
        {tab === 'calendar' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
              {['一','二','三','四','五','六','日'].map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:10, color:'#9A8A70', padding:'4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
              {allDays.map(day => {
                const key = format(day, 'yyyy-MM-dd')
                const done = checkinDates.has(key)
                const isToday = key === format(new Date(), 'yyyy-MM-dd')
                return (
                  <div key={key} style={{
                    aspectRatio:'1', borderRadius:6, display:'flex',
                    alignItems:'center', justifyContent:'center', fontSize:11,
                    background: done ? '#C8922A' : isToday ? '#FDF3E0' : '#F0EAE0',
                    color: done ? '#fff' : isToday ? '#C8922A' : '#9A8A70',
                    border: isToday ? '2px solid #C8922A' : 'none',
                    fontWeight: done || isToday ? 600 : 400,
                  }}>
                    {format(day, 'd')}
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:12, fontSize:11, color:'#9A8A70' }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:'#C8922A' }}/>已打卡
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:'#F0EAE0' }}/>未打卡
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkin button */}
      {pledge.status === 'active' && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          width:'calc(100% - 32px)', maxWidth:358 }}>
          <button style={{ ...S.btnGold, width:'100%', padding:14, fontSize:15 }}
            disabled={checkedToday}
            onClick={() => !checkedToday && nav(`/pledge/${id}/checkin`)}>
            {checkedToday ? '✓ 今日已打卡' : '今日打卡'}
          </button>
        </div>
      )}
    </div>
  )
}

const S = {
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px', borderBottom:'0.5px solid #E0D5C0',
    background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
  back: { background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#1A1208', padding:4 },
  title: { fontSize:16, fontWeight:600 },
  hero: { background:'linear-gradient(135deg,#2A1A08,#3A2510)',
    padding:18, margin:16, borderRadius:16 },
  statBox: { background:'rgba(255,255,255,.08)', borderRadius:8, padding:'8px 10px' },
  tabRow: { display:'flex', borderBottom:'0.5px solid #E0D5C0', background:'#FAF7F2' },
  tab: { flex:1, padding:'10px 0', fontSize:13, fontWeight:500, color:'#9A8A70',
    background:'none', border:'none', borderBottom:'2px solid transparent', cursor:'pointer' },
  tabOn: { color:'#C8922A', borderBottomColor:'#C8922A' },
  logCard: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:12,
    padding:14, marginBottom:10 },
  dayBadge: { background:'#FDF3E0', color:'#7A5A18', fontSize:11, fontWeight:600,
    padding:'2px 8px', borderRadius:20 },
  btnGold: { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff',
    border:'none', borderRadius:12, fontWeight:700, cursor:'pointer',
    fontFamily:'Noto Sans SC,sans-serif' },
}
