// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getCoinLedger, getDonations, getMeritTitle, getMyPledges,
         updateProfile, signOut } from '../lib/supabase'
import { format, parseISO, differenceInDays } from 'date-fns'

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

  const [tab, setTab]             = useState('pledges')
  const [pledges, setPledges]     = useState([])
  const [ledger, setLedger]       = useState([])
  const [donations, setDonations] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editOpen, setEditOpen]   = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)
  const [toast, setToast]         = useState(null)

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  useEffect(() => {
    if (!session) return
    const uid = session.user.id
    setLoading(true)
    Promise.all([getMyPledges(uid), getCoinLedger(uid, 50), getDonations(uid)])
      .then(([p, l, d]) => { setPledges(p || []); setLedger(l || []); setDonations(d || []) })
      .finally(() => setLoading(false))
  }, [session])

  const title       = profile ? getMeritTitle(profile.total_merit) : { emoji:'🌱', title:'初心者', next:500 }
  const merit       = profile?.total_merit ?? 0
  const progressPct = title.next ? Math.min(100, Math.round((merit / title.next) * 100)) : 100

  const activePledges  = pledges.filter(p => p.status === 'active')
  const cooldowns      = pledges.filter(p => p.status === 'cooldown')
  const historyPledges = pledges.filter(p => ['done','fail','abandoned'].includes(p.status))
  const totalDays      = pledges.reduce((s, p) => s + (p.checkin_count || 0), 0)

  const nickDisplay  = profile?.nickname    || '立誓者'
  const emojiDisplay = profile?.avatar_emoji || '🌱'
  const bioDisplay   = profile?.bio          || ''

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
    <div style={{ background:'#FAF7F2', minHeight:'100vh', paddingBottom: 'calc(90px + env(safe-area-inset-bottom))' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
          background: toast.type === 'error' ? '#C84040' : toast.type === 'success' ? '#3B7A4A' : 'rgba(26,18,8,.88)',
          color:'#fff', padding:'9px 20px', borderRadius:20, fontSize:13,
          zIndex:600, whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(0,0,0,.2)' }}>
          {toast.msg}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editOpen && (
        <EditSheet
          profile={profile}
          onSave={handleSaveProfile}
          onClose={() => setEditOpen(false)}
        />
      )}

      {/* 退出确认 */}
      {confirmOut && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:400,
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
        <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:16 }}>

          {/* 头像 + 编辑按钮 */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ width:64, height:64, borderRadius:'50%',
              background: avaColor(nickDisplay),
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:34, boxShadow:'0 4px 16px rgba(0,0,0,.2)' }}>
              {emojiDisplay}
            </div>
            <div onClick={() => setEditOpen(true)}
              style={{ position:'absolute', bottom:0, right:0, width:22, height:22,
                borderRadius:'50%', background:'#C8922A', border:'2px solid rgba(42,26,8,1)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, color:'#fff', cursor:'pointer' }}>✎</div>
          </div>

          {/* 昵称 + bio + 编辑按钮 */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <div style={{ fontSize:18, fontWeight:700, color:'#fff',
                fontFamily:'Noto Serif SC,serif' }}>{nickDisplay}</div>
              <button onClick={() => setEditOpen(true)}
                style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:6,
                  padding:'2px 8px', color:'rgba(255,255,255,.65)', fontSize:11,
                  cursor:'pointer', flexShrink:0 }}>编辑</button>
            </div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', marginBottom: bioDisplay ? 8 : 0 }}>
              {title.emoji} {title.title}
              {profile?.merit_coins != null && ` · 🪙 ${profile.merit_coins.toLocaleString()}`}
            </div>

            {/* 自我介绍 */}
            {bioDisplay ? (
              <div style={{ fontSize:12, color:'rgba(255,255,255,.75)', lineHeight:1.6,
                background:'rgba(255,255,255,.08)', borderRadius:8, padding:'7px 10px',
                fontStyle:'italic' }}>
                「{bioDisplay}」
              </div>
            ) : (
              <div onClick={() => setEditOpen(true)}
                style={{ fontSize:11, color:'rgba(255,255,255,.35)', cursor:'pointer',
                  borderBottom:'1px dashed rgba(255,255,255,.2)', paddingBottom: 'calc(2px + env(safe-area-inset-bottom))',
                  display:'inline-block' }}>
                + 添加一句话介绍
              </div>
            )}
          </div>
        </div>

        {/* 四格统计 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:7, marginBottom:14 }}>
          {[
            { val: pledges.length,                 lbl:'总誓言' },
            { val: profile?.completed_count ?? 0,  lbl:'已完成' },
            { val: totalDays,                      lbl:'打卡天' },
            { val: merit.toLocaleString(),         lbl:'功德值' },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={S.statBox}>
              <div style={{ fontSize:15, fontWeight:700, color:'#E8B84A' }}>{val}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginTop:2 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* 称号进度 */}
        {title.next && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between',
              fontSize:11, color:'rgba(255,255,255,.45)', marginBottom:5 }}>
              <span>距「{getMeritTitle(title.next).title}」</span>
              <span>{merit.toLocaleString()} / {title.next.toLocaleString()}</span>
            </div>
            <div style={{ background:'rgba(255,255,255,.15)', borderRadius:3, height:5, overflow:'hidden' }}>
              <div style={{ width:`${progressPct}%`, height:'100%', borderRadius:3,
                background:'linear-gradient(90deg,#C8922A,#E8B84A)', transition:'width .5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabRow}>
        {[['pledges','我的誓言'],['coins','金币流水'],['donations','捐款'],['certs','证书']].map(([k, lbl]) => (
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
            {activePledges.length > 0 && (<>
              <div style={S.secLabel}>进行中 · {activePledges.length}</div>
              {activePledges.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}
            </>)}
            {cooldowns.length > 0 && (<>
              <div style={S.secLabel}>冷静期 · {cooldowns.length}</div>
              {cooldowns.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}
            </>)}
            {historyPledges.length > 0 && (<>
              <div style={S.secLabel}>历史记录 · {historyPledges.length}</div>
              {historyPledges.map(p => <PledgeRow key={p.id} p={p} nav={nav} />)}
            </>)}
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
                <div style={{ fontSize:14, color:'#9A8A70' }}>还没有捐款记录</div>
                <div style={{ fontSize:12, color:'#B8A88A', marginTop:6 }}>完成或失败誓言后金币会流向公益</div>
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
                    <div style={{ fontSize:11, color:'#9A8A70', marginTop:2, fontStyle:'italic',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
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
              { threshold:500,   emoji:'🌿', name:'初级善行证书', desc:'累计功德500，可下载电子版' },
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
                  {earned
                    ? <button style={{ background:'#E8F5EC', color:'#3B7A4A', border:'none',
                        borderRadius:20, fontSize:11, fontWeight:600, padding:'5px 12px', cursor:'pointer' }}>
                        下载 ⬇
                      </button>
                    : <div style={{ fontSize:10, color:'#B8A88A' }}>🔒 未解锁</div>
                  }
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
  empty:     { textAlign:'center', color:'#9A8A70', padding:32, fontSize:13 },
}
