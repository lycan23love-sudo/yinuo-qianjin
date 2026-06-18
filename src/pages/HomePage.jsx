// src/pages/HomePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getMyPledges, hasCheckedInToday, getMeritTitle } from '../lib/supabase'
import { format, differenceInDays } from 'date-fns'

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
      const data = await getMyPledges(session.user.id)
      setPledges(data)
      // check today status for each active pledge
      const map = {}
      for (const p of data.filter(p => p.status === 'active')) {
        map[p.id] = await hasCheckedInToday(p.id)
      }
      setCheckedMap(map)
    } finally {
      setLoading(false)
    }
  }

  const title = profile ? getMeritTitle(profile.total_merit) : { emoji:'🌱', title:'初心者' }
  const active = pledges.filter(p => p.status === 'active')
  const cooldown = pledges.filter(p => p.status === 'cooldown')
  const history = pledges.filter(p => ['done','fail','abandoned'].includes(p.status))
  const used = active.length + cooldown.length
  const limit = profile?.quota_limit ?? 3

  function cooldownDays(p) {
    if (!p.cooldown_until) return 0
    return Math.max(0, differenceInDays(new Date(p.cooldown_until), new Date()) + 1)
  }

  function progress(p) {
    const total = p.total_days
    const done = p.checkin_count
    return { pct: Math.round((done / total) * 100), done, total }
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Topbar */}
      <div style={S.topbar}>
        <div style={S.logo}>一诺<em style={{ color:'#C8922A', fontStyle:'normal' }}>千金</em></div>
        <button style={S.iconBtn} onClick={() => nav('/profile')}>
          <span style={{ fontSize:22 }}>👤</span>
        </button>
      </div>

      <div style={{ padding:'0 16px' }}>
        {/* Header card */}
        <div style={S.headerCard}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>🪙</span>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>公益金币</div>
                <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:18, fontWeight:700, color:'#E8B84A' }}>
                  {(profile?.merit_coins ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {[
                { val: profile?.completed_count ?? 0, lbl:'已完成' },
                { val: active.reduce((s,p)=>s+p.checkin_count,0), lbl:'打卡天' },
              ].map(({ val, lbl }) => (
                <div key={lbl} style={S.statBox}>
                  <div style={{ fontSize:15, fontWeight:600, color:'#fff' }}>{val}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.45)', marginTop:1 }}>{lbl}</div>
                </div>
              ))}
              <div style={{ ...S.statBox, background:'rgba(59,122,74,.3)', cursor:'pointer' }}
                onClick={() => nav('/profile')}>
                <div style={{ fontSize:15 }}>{title.emoji}</div>
                <div style={{ fontSize:10, color:'rgba(128,224,160,.7)', marginTop:1 }}>{title.title}</div>
              </div>
            </div>
          </div>

          {/* Quota slots */}
          <div style={{ borderTop:'0.5px solid rgba(255,255,255,.12)', paddingTop:10,
            display:'flex', alignItems:'center', justifyContent:'space-between',
            cursor:'pointer' }} onClick={() => nav('/new')}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.4)', whiteSpace:'nowrap' }}>立誓额度</span>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {Array.from({ length: limit }).map((_, i) => (
                  <span key={i} style={{
                    display:'inline-block', width:28, height:9, borderRadius:5,
                    background: i < active.length ? '#C8922A'
                      : i < active.length + cooldown.length ? '#C84040'
                      : 'rgba(255,255,255,.15)'
                  }} />
                ))}
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.4)', whiteSpace:'nowrap' }}>
                在途 {active.length} / 共 {limit}
              </span>
              <span style={{ fontSize:11, color:'#E8B84A', fontWeight:500, whiteSpace:'nowrap' }}>
                {used < limit ? '+ 新立誓' : '额度已满'}
              </span>
            </div>
          </div>
        </div>

        {loading && <div style={S.empty}>加载中…</div>}

        {/* Active pledges */}
        {active.length > 0 && (
          <>
            <div style={S.secRow}>
              <div style={S.secLabel}>我的承诺</div>
              {used < limit && (
                <button style={S.smBtn} onClick={() => nav('/new')}>+ 新立誓</button>
              )}
            </div>
            {active.map(p => {
              const { pct, done, total } = progress(p)
              const daysLeft = differenceInDays(new Date(p.end_date), new Date())
              const checked = checkedMap[p.id]
              return (
                <div key={p.id} style={S.pledgeCard} onClick={() => nav(`/pledge/${p.id}`)}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                    <div style={S.activeDot} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600,
                        fontFamily:'Noto Serif SC,serif', marginBottom:2,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize:11, color:'#9A8A70' }}>
                        第{done}天 · 还剩{Math.max(0,daysLeft)}天 · {p.stake_coins}金币押注
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#C8922A' }}>{pct}%</div>
                    </div>
                  </div>
                  <div style={S.barWrap}>
                    <div style={{ ...S.barFill, width:`${pct}%` }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                    <button style={checked ? S.btnDone : S.btnGold}
                      onClick={e => { e.stopPropagation(); !checked && nav(`/pledge/${p.id}/checkin`) }}>
                      {checked ? '✓ 今日已打卡' : '今日打卡'}
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Cooldown slots */}
        {cooldown.map(p => (
          <div key={p.id} style={{ ...S.pledgeCard, opacity:.75 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={S.cooldownDot} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:'#9A8A70' }}>{p.title}</div>
                <div style={{ fontSize:11, color:'#C84040', marginTop:2 }}>
                  冷静期 · {cooldownDays(p)}天后可重新立誓
                </div>
              </div>
              <div style={{ background:'#FCEBEB', color:'#C84040',
                fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20 }}>
                {cooldownDays(p)}天
              </div>
            </div>
          </div>
        ))}

        {/* Empty state */}
        {!loading && active.length === 0 && cooldown.length === 0 && (
          <div style={S.emptyCard} onClick={() => nav('/new')}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>立下你的第一个誓言</div>
            <div style={{ fontSize:12, color:'#9A8A70' }}>押注金币，邀人见证，坚持到底</div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <div style={S.secLabel}>历史承诺</div>
            {history.map(p => (
              <div key={p.id} style={{ ...S.pledgeCard, opacity:.7 }}
                onClick={() => nav(`/pledge/${p.id}`)}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={p.status==='done' ? S.doneDot : S.failDot} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{p.title}</div>
                    <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>
                      {format(new Date(p.start_date), 'yyyy年M月')} ·
                      {p.status==='done' ? ` 已完成 · +${p.stake_coins}金币` : ` 未完成 · 捐出${p.stake_coins}金币`}
                    </div>
                  </div>
                  <div style={p.status==='done' ? S.tagGreen : S.tagRed}>
                    {p.status==='done' ? '达成' : '捐出'}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px', position:'sticky', top:0, background:'#FAF7F2', zIndex:10,
    borderBottom:'0.5px solid #E0D5C0' },
  logo: { fontFamily:'Noto Serif SC,serif', fontSize:18, fontWeight:700, color:'#1A1208' },
  iconBtn: { background:'none', border:'none', cursor:'pointer', padding:4 },
  headerCard: { background:'linear-gradient(135deg,#2A1A08,#3A2510)',
    borderRadius:16, padding:16, marginBottom:14 },
  statBox: { textAlign:'center', background:'rgba(255,255,255,.08)',
    borderRadius:8, padding:'6px 10px' },
  secLabel: { fontSize:11, fontWeight:600, color:'#9A8A70', letterSpacing:.5,
    marginBottom:8, marginTop:16 },
  secRow: { display:'flex', alignItems:'center', justifyContent:'space-between',
    marginTop:16, marginBottom:8 },
  pledgeCard: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14,
    padding:14, marginBottom:10, cursor:'pointer',
    boxShadow:'0 1px 6px rgba(26,18,8,.06)' },
  activeDot: { width:10, height:10, borderRadius:'50%', background:'#C8922A',
    boxShadow:'0 0 0 3px #FDF3E0', flexShrink:0, marginTop:4 },
  cooldownDot: { width:10, height:10, borderRadius:'50%', background:'#C84040',
    flexShrink:0 },
  doneDot: { width:10, height:10, borderRadius:'50%', background:'#3B7A4A', flexShrink:0 },
  failDot: { width:10, height:10, borderRadius:'50%', background:'#C84040',
    opacity:.5, flexShrink:0 },
  barWrap: { height:5, background:'#F0EAE0', borderRadius:3, overflow:'hidden' },
  barFill: { height:'100%', background:'linear-gradient(90deg,#C8922A,#E8B84A)',
    borderRadius:3, transition:'width .5s' },
  btnGold: { background:'#C8922A', color:'#fff', border:'none', borderRadius:20,
    padding:'7px 16px', fontSize:12, fontWeight:600, cursor:'pointer',
    fontFamily:'Noto Sans SC,sans-serif' },
  btnDone: { background:'#E8F5EC', color:'#3B7A4A', border:'none', borderRadius:20,
    padding:'7px 16px', fontSize:12, fontWeight:600,
    fontFamily:'Noto Sans SC,sans-serif' },
  smBtn: { background:'none', border:'0.5px solid #C8922A', color:'#C8922A',
    borderRadius:20, padding:'5px 12px', fontSize:12, cursor:'pointer',
    fontFamily:'Noto Sans SC,sans-serif' },
  emptyCard: { background:'#fff', border:'1.5px dashed #E0D5C0', borderRadius:14,
    padding:28, textAlign:'center', cursor:'pointer', marginTop:8 },
  empty: { textAlign:'center', color:'#9A8A70', padding:32, fontSize:13 },
  tagGreen: { background:'#E8F5EC', color:'#3B7A4A', fontSize:10, fontWeight:600,
    padding:'2px 8px', borderRadius:20, flexShrink:0 },
  tagRed: { background:'#FCEBEB', color:'#C84040', fontSize:10, fontWeight:600,
    padding:'2px 8px', borderRadius:20, flexShrink:0 },
}
