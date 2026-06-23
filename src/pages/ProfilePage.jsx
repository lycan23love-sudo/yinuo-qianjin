// src/pages/ProfilePage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getCoinLedger, getDonations, getMeritTitle, getMyPledges,
         updateProfile, signOut, supabase } from '../lib/supabase'
import { format, parseISO, differenceInDays } from 'date-fns'

const AVA_COLORS = ['#C8922A','#3B7A4A','#3A6A9A','#8A5A2A','#6A4A8A','#C84040','#2A7A7A']
function avaColor(str) {
  if (!str) return AVA_COLORS[0]
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF
  return AVA_COLORS[Math.abs(h) % AVA_COLORS.length]
}

const TYPE_LABELS = {
  checkin:'打卡奖励', stake:'立誓押注', stake_refund:'誓言完成返还',
  donate:'公益捐款', reward_streak:'连续奖励', reward_milestone:'里程碑奖励',
  reward_team:'团队奖励', gift_register:'注册赠送',
  witness_earn:'见证收益', question_cost:'提问消耗',
}

const STATUS_LABEL = { active:'进行中', done:'已完成', fail:'未完成', cooldown:'冷静期', abandoned:'已放弃' }
const STATUS_COLOR = { active:'#C8922A', done:'#3B7A4A', fail:'#C84040', cooldown:'#9A8A70', abandoned:'#B8A88A' }
const PERIOD_LABEL = { week:'周', month:'月', season:'季', year:'年' }

export default function ProfilePage() {
  const { profile, session, refreshProfile } = useAuth()
  const nav = useNavigate()
  const fileRef = useRef()

  const [tab, setTab]             = useState('pledges')
  const [pledges, setPledges]     = useState([])
  const [ledger, setLedger]       = useState([])
  const [donations, setDonations] = useState([])
  const [loading, setLoading]     = useState(true)

  // 编辑状态
  const [editing, setEditing]     = useState(false)
  const [nickname, setNickname]   = useState('')
  const [saving, setSaving]       = useState(false)

  // 退出确认
  const [confirmOut, setConfirmOut] = useState(false)

  // toast
  const [toast, setToast] = useState(null)
  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    setLoading(true)
    Promise.all([
      getMyPledges(uid),
      getCoinLedger(uid, 50),
      getDonations(uid),
    ]).then(([p, l, d]) => {
      setPledges(p || [])
      setLedger(l || [])
      setDonations(d || [])
    }).finally(() => setLoading(false))
  }, [session])

  const title       = profile ? getMeritTitle(profile.total_merit) : { emoji:'🌱', title:'初心者', next:500 }
  const merit       = profile?.total_merit ?? 0
  const progressPct = title.next ? Math.min(100, Math.round((merit / title.next) * 100)) : 100

  // 誓言分组
  const activePledges   = pledges.filter(p => p.status === 'active')
  const cooldowns       = pledges.filter(p => p.status === 'cooldown')
  const historyPledges  = pledges.filter(p => ['done','fail','abandoned'].includes(p.status))

  // 统计
  const totalDays      = pledges.reduce((s, p) => s + (p.checkin_count || 0), 0)
  const totalStake     = pledges.filter(p => p.status === 'done').reduce((s, p) => s + (p.stake_coins || 0), 0)

  async function handleSaveNickname() {
    if (!nickname.trim()) return
    setSaving(true)
    try {
      await updateProfile(session.user.id, { nickname: nickname.trim() })
      await refreshProfile()
      setEditing(false)
      showToast('昵称已更新 ✓', 'success')
    } catch {
      showToast('保存失败，请重试', 'error')
    } finally { setSaving(false) }
  }

  async function handleSignOut() {
    await signOut()
    nav('/auth')
  }

  const nickDisplay = profile?.nickname || '立誓者'
  const color = avaColor(nickDisplay)

  return (
    <div style={{ background:'#FAF7F2', minHeight:'100vh', paddingBottom:90 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
          background: toast.type === 'error' ? '#C84040' : toast.type === 'success' ? '#3B7A4A' : 'rgba(26,18,8,.88)',
          color:'#fff', padding:'9px 20px', borderRadius:20, fontSize:13, zIndex:200, whiteSpace:'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* 退出确认弹窗 */}
      {confirmOut && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:24, margin:24, maxWidth:320, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>确认退出？</div>
            <div style={{ fontSize:13, color:'#9A8A70', marginBottom:20 }}>退出后需要重新登录</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmOut(false)}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'1px solid #E0D5C0',
                  background:'none', fontSize:14, cursor:'pointer' }}>取消</button>
              <button onClick={handleSignOut}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none',
                  background:'#C84040', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>退出</button>
            </div>
          </div>
        </div>
      )}

      {/* 顶栏 */}
      <div style={S.topbar}>
        <button style={S.iconBtn} onClick={() => nav(-1)}>←</button>
        <div style={{ fontSize:16, fontWeight:600 }}>个人中心</div>
        <button style={{ ...S.iconBtn, color:'#C84040', fontSize:13 }}
          onClick={() => setConfirmOut(true)}>退出</button>
      </div>

      {/* Hero 卡片 */}
      <div style={S.hero}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          {/* 头像 */}
          <div style={{ ...S.avatar, background: color, position:'relative', cursor:'pointer' }}>
            {nickDisplay[0]}
          </div>

          {/* 昵称区 */}
          <div style={{ flex:1 }}>
            {editing ? (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={12}
                  autoFocus
                  style={{ background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)',
                    borderRadius:8, padding:'6px 10px', color:'#fff', fontSize:15,
                    fontFamily:'Noto Serif SC,serif', outline:'none', width:120 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname() }}
                />
                <button onClick={handleSaveNickname} disabled={saving}
                  style={{ background:'#C8922A', border:'none', borderRadius:8, padding:'6px 12px',
                    color:'#fff', fontSize:12, cursor:'pointer' }}>
                  {saving ? '…' : '保存'}
                </button>
                <button onClick={() => setEditing(false)}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,.5)', fontSize:18, cursor:'pointer' }}>
                  ×
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontSize:18, fontWeight:700, color:'#fff',
                  fontFamily:'Noto Serif SC,serif' }}>{nickDisplay}</div>
                <button onClick={() => { setNickname(nickDisplay); setEditing(true) }}
                  style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:6,
                    padding:'2px 8px', color:'rgba(255,255,255,.6)', fontSize:11, cursor:'pointer' }}>
                  编辑
                </button>
              </div>
            )}
            <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', marginTop:4 }}>
              {title.emoji} {title.title}
              {profile?.merit_coins != null && ` · 🪙 ${profile.merit_coins.toLocaleString()} 金币`}
            </div>
          </div>
        </div>

        {/* 四格统计 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:7, marginBottom:14 }}>
          {[
            { val: pledges.length,                   lbl:'总誓言数' },
            { val: profile?.completed_count ?? 0,    lbl:'已完成' },
            { val: totalDays,                        lbl:'累计打卡' },
            { val: merit.toLocaleString(),           lbl:'功德值' },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={S.statBox}>
              <div style={{ fontSize:15, fontWeight:700, color:'#E8B84A' }}>{val}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginTop:2 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* 称号进度条 */}
        {title.next && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between',
              fontSize:11, color:'rgba(255,255,255,.45)', marginBottom:5 }}>
              <span>距「{getMeritTitle(title.next).title}」</span>
              <span>{merit.toLocaleString()} / {title.next.toLocaleString()}</span>
            </div>
            <div style={{ background:'rgba(255,255,255,.15)', borderRadius:3, height:5, overflow:'hidden' }}>
              <div style={{ width:`${progressPct}%`, height:'100%',
                background:'linear-gradient(90deg,#C8922A,#E8B84A)', borderRadius:3, transition:'width .5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      <div style={S.tabRow}>
        {[['pledges','我的誓言'],['coins','金币流水'],['donations','捐款记录'],['certs','证书']].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{ padding:'0 16px' }}>

        {/* ── 我的誓言 ── */}
        {tab === 'pledges' && (
          <div style={{ paddingTop:12 }}>
            {loading && <div style={S.empty}>加载中…</div>}

            {!loading && pledges.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 24px' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🎯</div>
                <div style={{ fontSize:14, color:'#9A8A70', marginBottom:16 }}>还没有立下誓言</div>
                <button onClick={() => nav('/new')}
                  style={{ background:'#C8922A', color:'#fff', border:'none', borderRadius:12,
                    padding:'10px 24px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                  立下第一个誓言
                </button>
              </div>
            )}

            {activePledges.length > 0 && (
              <>
                <div style={S.secLabel}>进行中 · {activePledges.length}</div>
                {activePledges.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}
              </>
            )}
            {cooldowns.length > 0 && (
              <>
                <div style={S.secLabel}>冷静期 · {cooldowns.length}</div>
                {cooldowns.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}
              </>
            )}
            {historyPledges.length > 0 && (
              <>
                <div style={S.secLabel}>历史记录 · {historyPledges.length}</div>
                {historyPledges.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}
              </>
            )}
          </div>
        )}

        {/* ── 金币流水 ── */}
        {tab === 'coins' && (
          <div style={{ paddingTop:4 }}>
            {loading && <div style={S.empty}>加载中…</div>}
            {!loading && ledger.length === 0 && <div style={S.empty}>暂无金币记录</div>}
            {ledger.map(item => (
              <div key={item.id} style={S.ledgerRow}>
                <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0,
                  background: item.amount > 0 ? '#E8F5EC' : '#FCEBEB',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                  {item.amount > 0 ? '🪙' : '💸'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </div>
                  {item.note && (
                    <div style={{ fontSize:11, color:'#9A8A70', marginTop:2,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {item.note}
                    </div>
                  )}
                  <div style={{ fontSize:10, color:'#C0B090', marginTop:2 }}>
                    {format(parseISO(item.created_at), 'M月d日 HH:mm')}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:700,
                    color: item.amount > 0 ? '#3B7A4A' : '#C84040' }}>
                    {item.amount > 0 ? '+' : ''}{item.amount}
                  </div>
                  <div style={{ fontSize:10, color:'#9A8A70' }}>余额 {item.balance_after}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 捐款记录 ── */}
        {tab === 'donations' && (
          <div style={{ paddingTop:4 }}>
            {loading && <div style={S.empty}>加载中…</div>}
            {!loading && donations.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 24px' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>❤️</div>
                <div style={{ fontSize:14, color:'#9A8A70' }}>还没有捐款记录<br/>完成或失败誓言后金币会流向公益</div>
              </div>
            )}
            {donations.map(d => (
              <div key={d.id} style={S.ledgerRow}>
                <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0,
                  background:'#FCEBEB', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:16 }}>❤️</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{d.org_name}</div>
                  {d.message && (
                    <div style={{ fontSize:11, color:'#9A8A70', marginTop:2,
                      fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      「{d.message}」
                    </div>
                  )}
                  <div style={{ fontSize:10, color:'#C0B090', marginTop:2 }}>
                    {format(parseISO(d.created_at), 'M月d日')} ·
                    {d.source === 'pledge_fail' ? ' 誓言捐出' : d.source === 'manual' ? ' 主动捐款' : ' 见证分配'}
                  </div>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:'#C84040', flexShrink:0 }}>
                  -{d.coins}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 证书 ── */}
        {tab === 'certs' && (
          <div style={{ paddingTop:12 }}>
            {[
              { threshold:500,   emoji:'🌿', name:'初级善行证书', desc:'累计功德500达成，可下载电子版' },
              { threshold:2000,  emoji:'🌊', name:'护法者证书',   desc:'累计功德2000达成' },
              { threshold:5000,  emoji:'🔥', name:'善行者证书',   desc:'累计功德5000，含机构公章' },
              { threshold:15000, emoji:'✨', name:'功德大师证书', desc:'累计功德15000，社会公益认证' },
              { threshold:50000, emoji:'🪷', name:'菩萨心肠证书', desc:'区块链存证 · 终身荣誉' },
            ].map(cert => {
              const earned = merit >= cert.threshold
              return (
                <div key={cert.name} style={{ ...S.certCard,
                  opacity: earned ? 1 : .55,
                  border: earned ? '1px solid #C8922A' : '0.5px solid #E0D5C0' }}>
                  <div style={{ fontSize:28 }}>{cert.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color: earned ? '#1A1208' : '#9A8A70' }}>
                      {cert.name}
                    </div>
                    <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>{cert.desc}</div>
                    {!earned && (
                      <div style={{ fontSize:11, color:'#C8922A', marginTop:4 }}>
                        还差 {(cert.threshold - merit).toLocaleString()} 功德值
                      </div>
                    )}
                  </div>
                  {earned ? (
                    <button style={{ background:'#E8F5EC', color:'#3B7A4A',
                      border:'none', borderRadius:20, fontSize:11, fontWeight:600,
                      padding:'5px 12px', cursor:'pointer' }}
                      onClick={() => showToast('证书下载功能即将上线')}>
                      下载 ⬇
                    </button>
                  ) : (
                    <div style={{ ...S.lockTag }}>🔒 未解锁</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ height:20 }} />
      </div>
    </div>
  )
}

// 誓言行组件
function PledgeRow({ p, nav }) {
  const pct = Math.min(100, Math.round(((p.checkin_count || 0) / p.total_days) * 100))
  const daysLeft = Math.max(0, differenceInDays(new Date(p.end_date), new Date()))
  return (
    <div style={S.pledgeCard} onClick={() => nav(`/pledge/${p.id}`)}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: p.status === 'active' ? 8 : 0 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, fontFamily:'Noto Serif SC,serif',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {p.title}
          </div>
          <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>
            {PERIOD_LABEL[p.period]}度誓言 · 押{p.stake_coins}金币
            {p.status === 'active' && ` · 还剩${daysLeft}天`}
          </div>
        </div>
        <div style={{ ...S.statusTag,
          background: STATUS_COLOR[p.status] + '20',
          color: STATUS_COLOR[p.status] }}>
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
               padding:'12px 16px', borderBottom:'0.5px solid #E0D5C0',
               background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
  iconBtn:   { background:'none', border:'none', fontSize:20, cursor:'pointer',
               color:'#1A1208', padding:4, fontFamily:'Noto Sans SC,sans-serif' },
  hero:      { background:'linear-gradient(135deg,#2A1A08,#3A2510)', padding:18,
               margin:'0 16px 0', borderRadius:'0 0 16px 16px' },
  avatar:    { width:54, height:54, borderRadius:'50%', display:'flex', alignItems:'center',
               justifyContent:'center', fontSize:22, fontWeight:700, color:'#fff',
               fontFamily:'Noto Serif SC,serif', flexShrink:0 },
  statBox:   { background:'rgba(255,255,255,.08)', borderRadius:8, padding:'8px 6px', textAlign:'center' },
  tabRow:    { display:'flex', borderBottom:'0.5px solid #E0D5C0', background:'#FAF7F2',
               position:'sticky', top:51, zIndex:9 },
  tab:       { flex:1, padding:'10px 0', fontSize:11, fontWeight:500, color:'#9A8A70',
               background:'none', border:'none', borderBottom:'2px solid transparent', cursor:'pointer' },
  tabOn:     { color:'#C8922A', borderBottomColor:'#C8922A', fontWeight:700 },
  secLabel:  { fontSize:11, fontWeight:600, color:'#9A8A70', letterSpacing:.5,
               marginBottom:8, marginTop:14 },
  pledgeCard:{ background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:12,
               padding:'12px 14px', marginBottom:8, cursor:'pointer',
               boxShadow:'0 1px 4px rgba(26,18,8,.04)' },
  statusTag: { fontSize:10, fontWeight:600, padding:'3px 9px', borderRadius:20, flexShrink:0 },
  ledgerRow: { display:'flex', alignItems:'center', gap:12, padding:'12px 0',
               borderBottom:'0.5px solid #F0EAE0' },
  certCard:  { display:'flex', alignItems:'center', gap:12, background:'#fff',
               borderRadius:12, padding:14, marginBottom:10 },
  lockTag:   { fontSize:10, color:'#B8A88A', whiteSpace:'nowrap' },
  empty:     { textAlign:'center', color:'#9A8A70', padding:32, fontSize:13 },
}
