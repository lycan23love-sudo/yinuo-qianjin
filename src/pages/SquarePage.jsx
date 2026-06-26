// src/pages/SquarePage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getPublicPledges } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import IndexHallPage from './IndexHallPage'

// ── 分类映射（title 关键词 → 分类）
const CAT_LIST = ['全部','健康运动','学习成长','生活习惯','财务目标','创作']
const CAT_ICONS = { '健康运动':'🏃','学习成长':'📚','游戏目标':'🎮','生活习惯':'🌅','财务目标':'💰','创作':'🎨','全部':'🌐' }
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
  const filtered = cat === '全部' ? pledges : pledges.filter(p => {
    const t = p.title?.toLowerCase() || ''
    const map = { '健康运动':['跑','健身','运动','锻炼','瑜伽','游泳'],'学习成长':['读','学','英语','考','练','写作'],'游戏目标':['游戏','通关','段位','cs','王者','s级'],'生活习惯':['早起','冥想','睡','戒','打卡','习惯'],'财务目标':['存钱','理财','收入','副业','赚'],'创作':['创作','拍','绘','画','写','视频'] }
    return (map[cat] || []).some(kw => t.includes(kw))
  })
  const ordered = [...filtered].sort((a, b) => {
    if (sort === 'witnesses') {
      const aw = a.witnesses?.[0]?.count ?? a.witnesses?.length ?? 0
      const bw = b.witnesses?.[0]?.count ?? b.witnesses?.length ?? 0
      return bw - aw
    }
    if (sort === 'progress') {
      const ap = a.total_days ? a.checkin_count / a.total_days : 0
      const bp = b.total_days ? b.checkin_count / b.total_days : 0
      return bp - ap
    }
    return 0
  })

  return (
    <div style={{ padding: '0 16px' }}>
      {/* 筛选工具条 */}
      <div style={S.filterBar}>
        <label style={S.selectBox}>
          <span style={S.selectLabel}>分类</span>
          <select value={cat} onChange={e => setCat(e.target.value)} style={S.select}>
            {CAT_LIST.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
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

      {loading && [1,2,3].map(i => <Skeleton key={i} />)}
      {!loading && filtered.length === 0 && (
        <Empty text={cat === '全部' ? '还没有公开誓言，成为第一个！' : `暂无「${cat}」类誓言`} />
      )}

      {ordered.map(p => {
        const pct = Math.min(100, Math.round((p.checkin_count / p.total_days) * 100))
        const daysLeft = Math.max(0, differenceInDays(new Date(p.end_date), new Date()))
        const name = p.profiles?.nickname || '匿名'
        const witnessCount = p.witnesses?.[0]?.count ?? p.witnesses?.length ?? 0
        return (
          <div key={p.id} style={S.pledgeCard} onClick={() => nav(`/pledge/${p.id}`)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <Ava name={name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Noto Serif SC,serif',
                  marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 11, color: '#9A8A70' }}>
                  {name} · {PERIOD_LABEL[p.period] || ''}度誓言 · 押{p.stake_coins}金币
                  {witnessCount > 0 && ` · ${witnessCount}人见证`}
                </div>
              </div>
              <div style={{ ...S.tag, background: daysLeft <= 3 ? '#FCEBEB' : '#FDF3E0',
                color: daysLeft <= 3 ? '#C84040' : '#7A5A18', flexShrink: 0 }}>
                {daysLeft <= 3 ? `⚡ 还剩${daysLeft}天` : '进行中'}
              </div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 11, color: '#9A8A70', marginBottom: 4 }}>
                <span>第{p.checkin_count}天 / 共{p.total_days}天</span>
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
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={e => { e.stopPropagation(); nav(`/pledge/${p.id}?tab=witness`) }}
                  style={{ background:'#1A1208', color:'#E8B84A', border:'none', borderRadius:16,
                    padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer',
                    fontFamily:'Noto Sans SC,sans-serif' }}>
                  👁 去见证
                </button>
                <div style={{ fontSize: 11, color: '#C8922A' }}>查看 ›</div>
              </div>
            </div>
          </div>
        )
      })}
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
  const [cat, setCat]         = useState('全部')
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
  topbar:    { display:'flex', alignItems:'center', justifyContent:'center', padding:'calc(10px + env(safe-area-inset-top)) 16px 8px', background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
  logo:      { fontFamily:'Noto Serif SC,serif', fontSize:19, fontWeight:900, color:'#1A1208', letterSpacing:1 },
  squareNav: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:4, padding:'6px 14px 8px', background:'#FAF7F2', borderBottom:'0.5px solid #E8DDC8', position:'sticky', top:46, zIndex:9 },
  squareNavBtn:{ minHeight:34, border:'none', borderRadius:18, background:'transparent', color:'#7A6A50', fontSize:11, fontWeight:700, lineHeight:1.2, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4px 2px' },
  squareNavBtnOn:{ background:'#1A1208', color:'#E8B84A', boxShadow:'0 2px 8px rgba(26,18,8,.10)' },
  navPrimary:{ fontSize:11, fontWeight:800 },
  navSub:    { fontSize:10, opacity:.78, marginTop:1 },
  filterBar: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'10px 0 12px' },
  selectBox: { minWidth:0, display:'flex', alignItems:'center', gap:6, border:'0.5px solid #E0D5C0', borderRadius:12, background:'#fff', padding:'7px 10px' },
  selectLabel:{ fontSize:10, color:'#B09A72', fontWeight:700, flexShrink:0 },
  select:    { minWidth:0, flex:1, border:'none', outline:'none', background:'transparent', color:'#4A3A24', fontSize:12, fontWeight:700, fontFamily:'Noto Sans SC,sans-serif' },
  pledgeCard:{ background:'#fff', border:'0.5px solid #E6DCCB', borderRadius:13, padding:13, marginBottom:10, cursor:'pointer', boxShadow:'0 1px 4px rgba(26,18,8,.035)' },
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
