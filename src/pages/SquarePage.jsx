// src/pages/SquarePage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getPublicPledges } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import IndexHallPage from './IndexHallPage'
import { CATEGORY_OPTIONS, categoryFilterMatches, inferPledgeCategory, inferPledgeTag } from '../lib/pledgeCategories'

const PERIOD_LABEL = { week:'周', month:'月', season:'季', year:'年' }

// 头像颜色池
const AVA_COLORS = ['#C8922A','#3B7A4A','#3A6A9A','#8A5A2A','#6A4A8A','#C84040','#2A7A7A']
function avaColor(str) {
  if (!str) return AVA_COLORS[0]
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFFFF
  return AVA_COLORS[Math.abs(h) % AVA_COLORS.length]
}

function Ava({ name, size = 36 }) {
  const ch = (name || '？')[0]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avaColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0,
      fontFamily: 'Noto Serif SC,serif' }}>
      {ch}
    </div>
  )
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
      <div style={{ fontSize: 14, color: '#9A8A70' }}>{text}</div>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E0D5C0', borderRadius: 14,
      padding: 14, marginBottom: 10 }}>
      {[1,2].map(i => (
        <div key={i} style={{ height: 14, background: '#F0EAE0', borderRadius: 7,
          marginBottom: 8, width: i === 1 ? '70%' : '40%', animation: 'pulse 1.5s infinite' }} />
      ))}
      <div style={{ height: 5, background: '#F0EAE0', borderRadius: 3 }} />
    </div>
  )
}

// ── 进行中 tab
function LiveTab({ pledges, loading, cat, setCat, sort, setSort }) {
  const nav = useNavigate()
  const [batch, setBatch] = useState(0)
  const witnessCountOf = (p) => p.witnesses?.[0]?.count ?? p.witnesses?.length ?? 0
  const progressOf = (p) => p.total_days ? (p.checkin_count || 0) / p.total_days : 0
  const daysLeftOf = (p) => Math.max(0, differenceInDays(new Date(p.end_date), new Date()))
  const stakeOf = (p) => Number(p.stake_coins || 0)
  const createdAtOf = (p) => new Date(p.created_at || p.start_date || 0).getTime()

  useEffect(() => { setBatch(0) }, [cat, sort, pledges.length])

  const filtered = pledges.filter(p => categoryFilterMatches(p, cat))
  const ordered = [...filtered].sort((a, b) => {
    if (sort === 'ending_soon') return daysLeftOf(a) - daysLeftOf(b)
    if (sort === 'stake') return stakeOf(b) - stakeOf(a)
    if (sort === 'witnesses') return witnessCountOf(b) - witnessCountOf(a)
    if (sort === 'progress') return progressOf(b) - progressOf(a)
    return createdAtOf(b) - createdAtOf(a)
  })
  const batchCount = Math.max(1, Math.ceil(ordered.length / 5))
  const visible = ordered.slice((batch % batchCount) * 5, (batch % batchCount) * 5 + 5)

  const nextBatch = () => setBatch(v => (v + 1) % batchCount)

  const renderCard = (p) => {
    const pct = Math.min(100, Math.round(((p.checkin_count || 0) / Math.max(1, p.total_days || 1)) * 100))
    const daysLeft = daysLeftOf(p)
    const name = p.profiles?.nickname || '匿名'
    const witnessCount = witnessCountOf(p)
    const category = inferPledgeCategory(p)
    const tag = inferPledgeTag(p)
    return (
      <div key={p.id} style={S.pledgeCard} onClick={() => nav(`/pledge/${p.id}`)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <Ava name={name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Noto Serif SC,serif',
              marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.title}
            </div>
            <div style={{ fontSize: 11, color: '#9A8A70', lineHeight: 1.5 }}>
              {category.emoji} {category.label} · {tag} · {PERIOD_LABEL[p.period] || ''}度誓言 · 押{p.stake_coins}金币
              {witnessCount > 0 && ` · ${witnessCount}人见证`}
            </div>
          </div>
          <div style={{ ...S.tag, background: daysLeft <= 3 ? '#FCEBEB' : '#F7EED8', color: daysLeft <= 3 ? '#C84040' : '#C8922A' }}>
            {daysLeft <= 0 ? '今日结束' : `剩${daysLeft}天`}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9A8A70', marginBottom: 4 }}>
            <span>进度 {p.checkin_count || 0}/{p.total_days || 0} 天</span>
            <span style={{ color: '#C8922A', fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 5, background: '#F0EAE0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3,
              background: pct >= 80 ? 'linear-gradient(90deg,#3B7A4A,#5AAA6A)' : 'linear-gradient(90deg,#C8922A,#E8B84A)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#B8A88A' }}>
            {p.verify_type === 'screenshot' ? '📸 截图打卡' : p.verify_type === 'text' ? '✏️ 文字打卡' : '📍 定位打卡'}
          </div>
          <div style={S.cardActions}>
            <button onClick={e => { e.stopPropagation(); nav(`/pledge/${p.id}?tab=witness`) }} style={S.witnessBtn}>👁 去见证</button>
            <button onClick={e => { e.stopPropagation(); nav(`/pledge/${p.id}`) }} style={S.detailBtn}>查看 ›</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={S.filterBar}>
        <label style={S.selectBox}>
          <span style={S.selectLabel}>分类</span>
          <select value={cat} onChange={e => setCat(e.target.value)} style={S.select}>
            {CATEGORY_OPTIONS.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
          </select>
        </label>
        <label style={S.selectBox}>
          <span style={S.selectLabel}>排序</span>
          <select value={sort} onChange={e => setSort(e.target.value)} style={S.select}>
            <option value="created_at">最新发布</option>
            <option value="ending_soon">即将结束</option>
            <option value="stake">押注最高</option>
            <option value="witnesses">热门见证</option>
            <option value="progress">完成率高</option>
          </select>
        </label>
      </div>

      <div style={S.batchHead}>
        <div style={S.batchText}>每次显示 5 条誓言</div>
        {ordered.length > 5 && <button style={S.refreshBtn} onClick={nextBatch}>换一批</button>}
      </div>

      {loading && [1,2,3].map(i => <Skeleton key={i} />)}
      {!loading && filtered.length === 0 && (
        <Empty text={cat === 'all' ? '还没有公开誓言，成为第一个！' : `暂无「${CATEGORY_OPTIONS.find(c => c.key === cat)?.label || '该'}」类誓言`} />
      )}
      {!loading && visible.map(renderCard)}
    </div>
  )
}

function PoolTab() {
  const nav = useNavigate()
  const cards = [
    { title: '盲盒结缘', desc: '把善意押进未知池，随机结缘正在坚持的人。', icon: '🎲', path: '/blind-bet', color: '#6A3ACA' },
    { title: '赛博陪审团', desc: '进入争议打卡现场，帮助共同判定誓言证据。', icon: '⚖️', path: '/jury', color: '#C8922A' },
  ]

  return (
    <div style={{ padding: '14px 16px 0' }}>
      {cards.map(card => (
        <button key={card.path} onClick={() => nav(card.path)} style={S.poolCard}>
          <div style={{ ...S.poolIcon, background: card.color }}>{card.icon}</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1208', marginBottom: 4 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: '#7A6A50', lineHeight: 1.55 }}>{card.desc}</div>
          </div>
          <span style={{ fontSize: 18, color: '#C0B090' }}>›</span>
        </button>
      ))}
    </div>
  )
}


// ── 主组件
export default function SquarePage() {
  const nav = useNavigate()
  const location = useLocation()
  const section = location.pathname.startsWith('/square/index')
    ? 'index'
    : location.pathname.startsWith('/square/pool')
      ? 'pool'
      : 'oath'
  const goSection = (next) => {
    const path = next === 'index' ? '/square/index' : next === 'pool' ? '/square/pool' : '/square'
    if (location.pathname !== path) nav(path)
  }
  const [cat, setCat]         = useState('all')
  const [sort, setSort]       = useState('created_at')
  const [pledges, setPledges] = useState([])
  const [loading, setLoading] = useState(true)

  const loadLive = useCallback(() => {
    setLoading(true)
    getPublicPledges({ sort })
      .then(data => setPledges(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sort])

  useEffect(() => { loadLive() }, [loadLive])

  return (
    <div style={{ background: '#FAF7F2', minHeight: '100vh', paddingBottom: 'calc(90px + env(safe-area-inset-bottom))' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>

      {/* 顶栏 */}
      <div style={S.topbar}>
        <div style={S.logo}>广<em style={{ color: '#C8922A', fontStyle: 'normal' }}>场</em></div>
      </div>


      {/* 广场二级导航 */}
      <div style={S.squareNav}>
        {[
          ['oath', '行者林', '誓言大厅'],
          ['index', '众生相', '自律指数'],
          ['pool', '洗心池', '盲盒与审判'],
        ].map(([k, prefix, suffix]) => (
          <button key={k} onClick={() => goSection(k)}
            style={{ ...S.squareNavBtn, ...(section === k ? S.squareNavBtnOn : {}) }}>
            <span style={S.navPrimary}>{prefix}</span><span style={S.navSub}>{suffix}</span>
          </button>
        ))}
      </div>


      {section === 'oath' && (
        <LiveTab pledges={pledges} loading={loading} cat={cat} setCat={setCat} sort={sort} setSort={setSort} />
      )}
      {section === 'index' && <IndexHallPage embedded />}
      {section === 'pool' && <PoolTab />}
    </div>
  )
}

const S = {
  topbar:    { display:'flex', alignItems:'center', justifyContent:'flex-start', padding:'calc(10px + env(safe-area-inset-top)) 30px 8px', background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
  logo:      { fontFamily:'Noto Serif SC,serif', fontSize:19, fontWeight:900, color:'#1A1208', letterSpacing:1 },
  squareNav: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:0, padding:'0 18px', background:'#FAF7F2', borderBottom:'0.5px solid #E0D5C0', position:'sticky', top:46, zIndex:9 },
  squareNavBtn:{ minHeight:58, border:'none', borderRadius:0, background:'transparent', color:'#7A6A50', fontSize:12, fontWeight:700, lineHeight:1.2, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 2px 10px', position:'relative' },
  squareNavBtnOn:{ color:'#C8922A', boxShadow:'inset 0 -3px 0 #C8922A' },
  navPrimary:{ fontSize:13, fontWeight:800 },
  navSub:    { fontSize:11, opacity:.72, marginTop:2 },
  curatedHead: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, margin:'12px 0 10px' },
  curatedTitle:{ fontFamily:'Noto Serif SC,serif', fontSize:17, fontWeight:900, color:'#1A1208' },
  curatedHint: { fontSize:11, color:'#9A8A70', marginTop:2, lineHeight:1.5 },
  refreshBtn:  { border:'0.5px solid #D9C79D', background:'#fff', color:'#9A6A10', borderRadius:18, padding:'7px 14px', fontSize:12, fontWeight:800, fontFamily:'Noto Sans SC,sans-serif', cursor:'pointer', flexShrink:0 },
  featureCard: { borderColor:'#E3C576', background:'linear-gradient(180deg,#FFFDF8,#FFFFFF)' },
  entryGrid:  { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:7, margin:'4px 0 14px' },
  entryBtn:   { minWidth:0, border:'0.5px solid #E0D5C0', background:'#fff', borderRadius:12, padding:'9px 4px', color:'#6A5A40', fontFamily:'Noto Sans SC,sans-serif', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 },
  categoryPanel:{ background:'#FFFDF8', border:'0.5px solid #E6DCCB', borderRadius:14, padding:12, margin:'0 0 14px' },
  panelTitle: { fontFamily:'Noto Serif SC,serif', fontSize:15, fontWeight:900, color:'#1A1208' },
  categoryGrid:{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginTop:10 },
  categoryBtn:{ minWidth:0, border:'0.5px solid #E0D5C0', background:'#fff', color:'#6A5A40', borderRadius:12, padding:'9px 4px', fontFamily:'Noto Sans SC,sans-serif', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4 },
  categoryBtnOn:{ borderColor:'#C8922A', background:'#1A1208', color:'#F6D486' },
  browseHead: { display:'flex', alignItems:'flex-end', justifyContent:'space-between', margin:'2px 0 8px' },
  batchHead: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, margin:'2px 0 10px' },
  batchText: { fontSize:11, color:'#9A8A70', fontWeight:700 },
  filterBar: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'10px 0 12px' },
  selectBox: { minWidth:0, display:'flex', alignItems:'center', gap:6, border:'0.5px solid #E0D5C0', borderRadius:12, background:'#fff', padding:'7px 10px' },
  selectLabel:{ fontSize:10, color:'#B09A72', fontWeight:700, flexShrink:0 },
  select:    { minWidth:0, flex:1, border:'none', outline:'none', background:'transparent', color:'#4A3A24', fontSize:12, fontWeight:700, fontFamily:'Noto Sans SC,sans-serif' },
  pledgeCard:{ background:'#fff', border:'0.5px solid #E6DCCB', borderRadius:13, padding:13, marginBottom:10, cursor:'pointer', boxShadow:'0 1px 4px rgba(26,18,8,.035)' },
  cardActions:{ display:'flex', gap:8, alignItems:'center' },
  witnessBtn:{ background:'#C89A32', color:'#fff', border:'none', borderRadius:18, padding:'6px 14px', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif', minWidth:88 },
  detailBtn: { background:'#fff', color:'#9A7A3A', border:'0.5px solid #E0D5C0', borderRadius:18, padding:'5px 12px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  tag:       { fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20 },
  secLabel:  { fontSize:11, fontWeight:600, color:'#9A8A70', letterSpacing:.5, marginBottom:10, marginTop:4 },
  successCard:{ background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, boxShadow:'0 1px 6px rgba(26,18,8,.05)' },
  quote:     { fontSize:12, color:'#5A4A30', lineHeight:1.7, background:'#FAF7F2', borderRadius:8, padding:'10px 12px', fontStyle:'italic' },
  expTag:    { fontSize:11, color:'#7A6A50', background:'#F5F0E8', borderRadius:20, padding:'3px 10px' },
  actionBtn: { background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#9A8A70', display:'flex', alignItems:'center', gap:4, fontFamily:'Noto Sans SC,sans-serif', padding:'4px 6px' },
  topicCard: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, boxShadow:'0 1px 4px rgba(26,18,8,.04)' },
  poolCard:  { width:'100%', display:'flex', alignItems:'center', gap:12, background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif', boxShadow:'0 1px 6px rgba(26,18,8,.05)' },
  poolIcon:  { width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:22, flexShrink:0 },
}
