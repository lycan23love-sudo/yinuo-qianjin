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
        const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { if (session) load() }, [session])

  async function load() {
            setLoading(true)
            try {
                        const data = await getMyPledges(session.user.id)
                        setPledges(data)
                        const map = {}
                                    for (const p of data.filter(p => p.status === 'active')) {
                                                  map[p.id] = await hasCheckedInToday(p.id)
                                    }
                        setCheckedMap(map)
            } finally { setLoading(false) }
  }

  const title = profile ? getMeritTitle(profile.total_merit) : { emoji: '🌱', title: '初心者' }
        const active = pledges.filter(p => p.status === 'active')
        const cooldown = pledges.filter(p => p.status === 'cooldown')
        const history = pledges.filter(p => ['done','fail','abandoned'].includes(p.status))
        const used = active.length + cooldown.length
        const limit = profile?.quota_limit ?? 3
        const totalCheckinDays = active.reduce((s, p) => s + p.checkin_count, 0)

  function cooldownDays(p) {
            if (!p.cooldown_until) return 0
            return Math.max(0, differenceInDays(new Date(p.cooldown_until), new Date()) + 1)
  }

  function progress(p) {
            return { pct: Math.round((p.checkin_count / p.total_days) * 100), done: p.checkin_count }
  }

  const topPledge = active[0]
        const topChecked = topPledge ? checkedMap[topPledge.id] : false

  return (
            <div style={{ paddingBottom: 90, background: '#FAF7F2', minHeight: '100vh' }}>
                        <div style={S.topbar}>
                                      <div style={S.logo}>一诺<em style={{ color: '#C8922A', fontStyle: 'normal' }}>千金</em>em></div>
                                      <button style={S.iconBtn} onClick={() => nav('/profile')}>
                                                      <span style={{ fontSize: 22 }}>👤</span>span>
                                      </button>button>
                        </div>
                        <div style={{ padding: '0 16px' }}>
                                      <div style={S.headerCard}>
                                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                                            <span style={{ fontSize: 20, color: '#E8B84A' }}>🪙</span>span>
                                                                                            <div>
                                                                                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1 }}>公益金币</div>
                                                                                                            <div style={{ fontFamily: 'Noto Serif SC,serif', fontSize: 20, fontWeight: 700, color: '#E8B84A', lineHeight: 1.3 }}>
                                                                                                                  {(profile?.merit_coins ?? 0).toLocaleString()}
                                                                                                                  </div>
                                                                                                  </div>
                                                                        </div>
                                                                  <div style={{ display: 'flex', gap: 6 }}>
                                                                                <div style={S.statBox}>
                                                                                                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{totalCheckinDays}
                                                                                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>打卡天</div>
                                                                                </div>
                                                                                <div style={S.statBox}>
                                                                                                <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{profile?.completed_count ?? 0}
                                                                                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>已完成</div>
                                                                                </div>
                                                                                <div style={{ ...S.statBox, background: 'rgba(59,122,74,.3)', cursor: 'pointer' }} onClick={() => nav('/profile')}>
                                                                                                <div style={{ fontSize: 15 }}>{title.emoji}
                                                                                                <div style={{ fontSize: 10, color: 'rgba(128,224,160,.7)', marginTop: 1 }}>{title.title}
                                                                                </div>
                                                                  </div>
                                                      </div>
                                                <div style={{ borderTop: '0.5px solid rgba(255,255,255,.1)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => nav('/new')}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' }}>立誓额度</span>span>
                                                                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                                {Array.from({ length: limit }).map((_, i) => (
                                    <span key={i} style={{ display: 'inline-block', width: 30, height: 9, borderRadius: 5, background: i < active.length ? '#C8922A' : i < used ? 'rgba(200,64,64,.7)' : 'rgba(255,255,255,.15)' }} />
                                  ))}
                                                                          </div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' }}>进行中 {active.length} / 上限 {limit}</span>span>
                                                                  {used < limit && <span style={{ fontSize: 11, color: '#E8B84A', fontWeight: 500, whiteSpace: 'nowrap' }}>完成解锁 +1 →</span>span>}
                                                            </div>
                                                </div>
                                      </div>
                              {topPledge && (() => {
                            const { pct, done } = progress(topPledge)
                                            const daysLeft = Math.max(0, differenceInDays(new Date(topPledge.end_date), new Date()))
                                                            return (
                                                                              <div style={S.heroCard} onClick={() => nav(`/pledge/${topPledge.id}`)}>
                                                                                            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Noto Serif SC,serif', color: '#fff', marginBottom: 4 }}>{topPledge.title}
                                                                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 14 }}>
                                                                                                  {format(new Date(topPledge.start_date), 'M月d日')}—{format(new Date(topPledge.end_date), 'M月d日')} · 押注{topPledge.stake_coins}金币
                                                                                                  </div>
                                                                                            <div style={S.pbarWrap}><div style={{ ...S.pbarFill, width: `${pct}%` }} /></div>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                                                                                            <div style={{ fontFamily: 'Noto Serif SC,serif', fontSize: 15, fontWeight: 700, color: '#E8B84A' }}>第 {done} / {topPledge.total_days} 天</div>
                                                                                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>还剩 {daysLeft} 天</div>
                                                                                                  </div>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                                                                                            <button style={topChecked ? S.btnChecked : S.btnCheckin} onClick={e => { e.stopPropagation(); !topChecked && nav(`/pledge/${topPledge.id}/checkin`) }}>
                                                                                                                  {topChecked ? '✓ 今日已打卡' : '今日打卡'}
                                                                                                                  </button>button>
                                                                                                  </div>
                                                                              </div>
                                                                            )
                              })()}
                              {loading && <div style={S.empty}>加载中…</div>}
                              {(active.length > 0 || cooldown.length > 0) && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: topPledge ? 6 : 0 }}>
                                        <div style={S.secLabel}>我的承诺</div>
                                  {used < limit && <button style={S.smBtn} onClick={() => nav('/new')}>+ 新立誓</button>button>}
                            </div>
                                )}
                              {active.map(p => {
                            const { pct, done } = progress(p)
                                            const daysLeft = Math.max(0, differenceInDays(new Date(p.end_date), new Date()))
                                                            return (
                                                                              <div key={p.id} style={S.listItem} onClick={() => nav(`/pledge/${p.id}`)}>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                                                            <div style={S.activeDot} />
                                                                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                                                                              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Noto Serif SC,serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}
                                                                                                                              <div style={{ fontSize: 11, color: '#9A8A70', marginTop: 2 }}>进行中 · 第{done}天 · {daysLeft}天后结束</div>
                                                                                                                  </div>
                                                                                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                                                                                              <div style={{ fontSize: 13, fontWeight: 700, color: '#C8922A' }}>{pct}%</div>
                                                                                                                              <div style={{ fontSize: 10, color: '#B8A88A' }}>完成度</div>
                                                                                                                  </div>
                                                                                                            <span style={{ fontSize: 16, color: '#C0B090' }}>›</span>span>
                                                                                                  </div>
                                                                              </div>
                                                                            )
                              })}
                              {cooldown.map(p => (
                            <div key={p.id} style={S.listItem}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                      <div style={S.cooldownDot} />
                                                      <div style={{ flex: 1 }}>
                                                                      <div style={{ fontSize: 13, color: '#9A8A70', fontFamily: 'Noto Serif SC,serif' }}>{p.title}
                                                                      <div style={{ fontSize: 11, color: '#C84040', marginTop: 2 }}>冷静期 · {cooldownDays(p)}天后可重立</div>
                                                      </div>
                                                      <div style={S.tagRed}>{cooldownDays(p)}天</div>
                                        </div>
                            </div>
                          ))}
                              {!loading && Array.from({ length: Math.max(0, limit - used) }).map((_, i) => (
                            <div key={`e${i}`} style={{ ...S.listItem, cursor: 'pointer', borderStyle: 'dashed' }} onClick={() => nav('/new')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                      <div style={S.emptyDot} />
                                                      <div>
                                                                      <div style={{ fontSize: 13, color: '#B8A88A' }}>空余槽位</div>
                                                                      <div style={{ fontSize: 11, color: '#C0B090' }}>点击立下新誓言</div>
                                                      </div>
                                                      <span style={{ marginLeft: 'auto', fontSize: 20, color: '#C0B090' }}>+</span>span>
                                        </div>
                            </div>
                          ))}
                              {!loading && pledges.length === 0 && (
                            <div style={S.emptyCard} onClick={() => nav('/new')}>
                                        <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, fontFamily: 'Noto Serif SC,serif' }}>立下你的第一个誓言</div>
                                        <div style={{ fontSize: 12, color: '#9A8A70' }}>押注金币，邀人见证，坚持到底</div>
                            </div>
                                )}
                              {history.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                        <button onClick={() => setShowHistory(h => !h)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', fontFamily: 'Noto Sans SC,sans-serif' }}>
                                                      <span style={{ fontSize: 12, color: '#9A8A70' }}>历史承诺（{history.length}条）</span>span>
                                                      <span style={{ fontSize: 16, color: '#B8A88A', transition: 'transform .2s', transform: showHistory ? 'rotate(180deg)' : 'none' }}>⌄</span>span>
                                        </button>button>
                                  {showHistory && history.map(p => (
                                                <div key={p.id} style={S.listItem} onClick={() => nav(`/pledge/${p.id}`)}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                                  <div style={p.status === 'done' ? S.doneDot : S.failDot} />
                                                                                  <div style={{ flex: 1 }}>
                                                                                                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.title}
                                                                                                      <div style={{ fontSize: 11, color: '#9A8A70', marginTop: 2 }}>
                                                                                                            {format(new Date(p.start_date), 'yyyy年M月')} ·{p.status === 'done' ? ` 已完成 · +${p.stake_coins}金币` : ` 未完成 · 捐出${p.stake_coins}金币`}
                                                                                                            </div>
                                                                                        </div>
                                                                                  <div style={p.status === 'done' ? S.tagGreen : S.tagRed}>{p.status === 'done' ? '达成' : '捐出'}
                                                                </div>
                                                </div>
                                              ))}
                            </div>
                                )}
                                <div style={{ height: 16 }} />
                        </div>
            </div>
          )
}

const S = {
        topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', position: 'sticky', top: 0, background: '#FAF7F2', zIndex: 10, borderBottom: '0.5px solid #E0D5C0' },
        logo: { fontFamily: 'Noto Serif SC,serif', fontSize: 20, fontWeight: 900, color: '#1A1208', letterSpacing: .5 },
        iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
        headerCard: { background: 'linear-gradient(135deg,#2A1A08 0%,#3A2510 60%,#4A2E18 100%)', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 4px 24px rgba(26,18,8,.18)' },
        statBox: { textAlign: 'center', background: 'rgba(255,255,255,.08)', borderRadius: 8, padding: '6px 10px' },
        heroCard: { background: 'linear-gradient(135deg,#2A1A08 0%,#4A2E10 60%,#6A4020 100%)', borderRadius: 20, padding: 20, marginBottom: 14, position: 'relative', overflow: 'hidden', boxShadow: '0 6px 28px rgba(26,18,8,.22)', cursor: 'pointer' },
        pbarWrap: { background: 'rgba(255,255,255,.15)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 6 },
        pbarFill: { height: '100%', background: 'linear-gradient(90deg,#C8922A,#E8B84A)', borderRadius: 4, transition: 'width .5s cubic-bezier(.4,0,.2,1)' },
        secLabel: { fontSize: 11, fontWeight: 600, color: '#9A8A70', letterSpacing: .5 },
        listItem: { background: '#fff', border: '0.5px solid #E0D5C0', borderRadius: 14, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', boxShadow: '0 1px 4px rgba(26,18,8,.05)' },
        activeDot: { width: 10, height: 10, borderRadius: '50%', background: '#C8922A', boxShadow: '0 0 0 3px #FDF3E0', flexShrink: 0 },
        cooldownDot: { width: 10, height: 10, borderRadius: '50%', background: '#C84040', opacity: .7, flexShrink: 0 },
        emptyDot: { width: 10, height: 10, borderRadius: '50%', background: '#E0D5C0', flexShrink: 0 },
        doneDot: { width: 10, height: 10, borderRadius: '50%', background: '#3B7A4A', flexShrink: 0 },
        failDot: { width: 10, height: 10, borderRadius: '50%', background: '#C84040', opacity: .4, flexShrink: 0 },
        emptyCard: { background: '#fff', border: '1.5px dashed #E0D5C0', borderRadius: 16, padding: 32, textAlign: 'center', cursor: 'pointer', marginTop: 8 },
        empty: { textAlign: 'center', color: '#9A8A70', padding: 32, fontSize: 13 },
        tagGreen: { background: '#E8F5EC', color: '#3B7A4A', fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
        tagRed: { background: '#FCEBEB', color: '#C84040', fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0 },
        smBtn: { background: 'none', border: '1px solid #C8922A', color: '#C8922A', borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'Noto Sans SC,sans-serif' },
        btnCheckin: { background: '#C8922A', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans SC,sans-serif' },
        btnChecked: { background: 'rgba(59,122,74,.3)', color: 'rgba(128,220,160,.9)', border: 'none', borderRadius: 20, padding: '8px 18px', fontSize: 12, fontWeight: 600, fontFamily: 'Noto Sans SC,sans-serif' },
}
