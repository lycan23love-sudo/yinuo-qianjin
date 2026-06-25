// src/pages/SquarePage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicPledges, getCompletedPledges } from '../lib/supabase'
import { differenceInDays } from 'date-fns'

// ── 分类映射（title 关键词 → 分类）
const CAT_LIST = ['全部','健康运动','学习成长','游戏目标','生活习惯','财务目标','创作']
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

  return (
    <div style={{ padding: '0 16px' }}>
      {/* 分类 chips */}
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '12px 0',
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {CAT_LIST.map(c => (
          <div key={c} onClick={() => setCat(c)}
            style={{ ...S.chip, whiteSpace: 'nowrap', flexShrink: 0,
              ...(cat === c ? S.chipOn : {}) }}>
            {CAT_ICONS[c]} {c}
          </div>
        ))}
      </div>

      {/* 排序 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['created_at','最新发布'],['ending_soon','即将结束'],['stake','押注最高']].map(([k, lbl]) => (
          <button key={k} onClick={() => setSort(k)}
            style={{ ...S.sortBtn, ...(sort === k ? S.sortBtnOn : {}) }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && [1,2,3].map(i => <Skeleton key={i} />)}
      {!loading && filtered.length === 0 && (
        <Empty text={cat === '全部' ? '还没有公开誓言，成为第一个！' : `暂无「${cat}」类誓言`} />
      )}

      {filtered.map(p => {
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
              <div style={{ fontSize: 11, color: '#C8922A' }}>查看 ›</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 成功经验 tab（真实完成数据 + mock 精华帖）
function DoneTab({ donePledges, loading }) {
  const [likedIdx, setLikedIdx] = useState({})
  const MOCK_STORIES = [
    { ava:'静', name:'静水', title:'连续冥想30天完成记', time:'5天前', helped:29,
      quote:'第1-7天：脑子根本静不来。第8天出现了3分钟真正安静的时刻。第16-30天：不冥想会觉得少了什么……',
      tags:['😖 前7天最难','🧠 专注力提升','⏰ 睡前最佳'], likes:47, comments:18 },
    { ava:'清', name:'清风', title:'戒烟60天：我是怎么做到的', time:'2周前', helped:156,
      quote:'最危险的是饭后和压力大时。饭后立刻去刷牙，把烟换成别的仪式感……',
      tags:['🍽️ 饭后最危险','🪥 刷牙替代法','💨 深呼吸技巧'], likes:203, comments:67 },
  ]

  return (
    <div style={{ padding: '0 16px' }}>
      {/* 真实完成数据 */}
      {!loading && donePledges.length > 0 && (
        <>
          <div style={S.secLabel}>🎖 最近达成</div>
          {donePledges.slice(0, 5).map(p => {
            const name = p.profiles?.nickname || '匿名'
            return (
              <div key={p.id} style={{ ...S.pledgeCard, borderLeft: '3px solid #3B7A4A' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Ava name={name} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Noto Serif SC,serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#9A8A70', marginTop: 2 }}>
                      {name} · 坚持了{p.total_days}天 · 押注{p.stake_coins}金币
                    </div>
                  </div>
                  <div style={{ ...S.tag, background: '#E8F5EC', color: '#1A4A28' }}>🏆 达成</div>
                </div>
              </div>
            )
          })}
        </>
      )}
      {loading && [1,2].map(i => <Skeleton key={i} />)}

      {/* 精华经验帖 */}
      <div style={S.secLabel}>📖 精华经验分享</div>
      {MOCK_STORIES.map((s, idx) => (
        <div key={idx} style={S.successCard}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <Ava name={s.ava} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Noto Serif SC,serif' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#9A8A70', marginTop: 2 }}>{s.name} · {s.time} · 已帮助{s.helped}人</div>
            </div>
            <div style={{ ...S.tag, background: '#E8F5EC', color: '#1A4A28', flexShrink: 0 }}>🏆 完成</div>
          </div>
          <div style={S.quote}>「{s.quote}」</div>
          <div style={{ display: 'flex', gap: 6, margin: '10px 0', flexWrap: 'wrap' }}>
            {s.tags.map(t => <div key={t} style={S.expTag}>{t}</div>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            borderTop: '0.5px solid #F0EAE0', paddingTop: 10 }}>
            <button style={{ ...S.actionBtn, color: likedIdx[idx] ? '#C84040' : '#9A8A70' }}
              onClick={() => setLikedIdx(m => ({ ...m, [idx]: !m[idx] }))}>
              {likedIdx[idx] ? '❤️' : '🤍'} {s.likes + (likedIdx[idx] ? 1 : 0)}
            </button>
            <button style={S.actionBtn}>💬 {s.comments}条</button>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: '#C8922A', fontWeight: 600 }}>分享经验 +20金币</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 誓言主题 tab（基于真实数据统计）
function TopicTab({ pledges, donePledges }) {
  const allPledges = [...pledges, ...donePledges]

  const stats = CAT_LIST.filter(c => c !== '全部').map(cat => {
    const map = { '健康运动':['跑','健身','运动','锻炼','瑜伽','游泳'],'学习成长':['读','学','英语','考','练','写作'],'游戏目标':['游戏','通关','段位','cs','王者','s级'],'生活习惯':['早起','冥想','睡','戒','打卡','习惯'],'财务目标':['存钱','理财','收入','副业','赚'],'创作':['创作','拍','绘','画','写','视频'] }
    const kws = map[cat] || []
    const matched = allPledges.filter(p => kws.some(kw => (p.title || '').toLowerCase().includes(kw)))
    const done = matched.filter(p => p.status === 'done').length
    const active = matched.filter(p => p.status === 'active').length
    const rate = matched.length > 0 ? Math.round((done / matched.length) * 100) : 0
    return { cat, icon: CAT_ICONS[cat], total: matched.length, done, active, rate }
  }).sort((a, b) => b.total - a.total)

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ fontSize: 12, color: '#9A8A70', margin: '12px 0', lineHeight: 1.6,
        background: '#F5F0E8', borderRadius: 10, padding: '10px 12px' }}>
        相同目标聚合在一起——看同类人的故事，找到方法，避免重复踩坑。
        {allPledges.length > 0 && <b style={{ color: '#C8922A' }}> 当前共 {allPledges.length} 条真实誓言数据。</b>}
      </div>
      {stats.map((t, i) => (
        <div key={i} style={S.topicCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 30, width: 44, textAlign: 'center', flexShrink: 0 }}>{t.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Noto Serif SC,serif' }}>{t.cat}</div>
              <div style={{ fontSize: 11, color: '#9A8A70', marginTop: 2 }}>
                {t.total > 0
                  ? <>{t.total}人立过此誓 · {t.done}人完成 · <b style={{ color: '#3B7A4A' }}>完成率{t.rate}%</b></>
                  : '暂无相关誓言数据'}
              </div>
            </div>
            <span style={{ fontSize: 18, color: '#C0B090' }}>›</span>
          </div>
          {t.total > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ val: t.active, lbl: '进行中', color: '#C8922A' },
                { val: t.done, lbl: '已完成', color: '#3B7A4A' },
                { val: `${t.rate}%`, lbl: '完成率', color: '#3A6A9A' }].map(({ val, lbl, color }) => (
                <div key={lbl} style={{ flex: 1, background: '#FAF7F2', borderRadius: 8,
                  padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: 10, color: '#B8A88A', marginTop: 2 }}>{lbl}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 主组件
export default function SquarePage() {
  const [tab, setTab]         = useState('live')
  const [cat, setCat]         = useState('全部')
  const [sort, setSort]       = useState('created_at')
  const [pledges, setPledges] = useState([])
  const [donePledges, setDonePledges] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingDone, setLoadingDone] = useState(false)

  const loadLive = useCallback(() => {
    setLoading(true)
    getPublicPledges({ sort })
      .then(data => setPledges(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sort])

  const loadDone = useCallback(() => {
    if (donePledges.length > 0) return
    setLoadingDone(true)
    getCompletedPledges()
      .then(data => setDonePledges(data || []))
      .catch(() => {})
      .finally(() => setLoadingDone(false))
  }, [donePledges.length])

  useEffect(() => { loadLive() }, [loadLive])

  useEffect(() => {
    if (tab === 'done' || tab === 'topic') loadDone()
  }, [tab, loadDone])

  return (
    <div style={{ background: '#FAF7F2', minHeight: '100vh', paddingBottom: 'calc(90px + env(safe-area-inset-bottom))' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>

      {/* 顶栏 */}
      <div style={S.topbar}>
        <div style={S.logo}>广<em style={{ color: '#C8922A', fontStyle: 'normal' }}>场</em></div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => nav('/index-hall')}
            style={{ background:'#1A1208', color:'#E8B84A', border:'none', borderRadius:20,
              padding:'5px 12px', fontSize:11, fontWeight:600, cursor:'pointer',
              fontFamily:'Noto Sans SC,sans-serif' }}>
            📊 指数大厅
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={S.tabRow}>
        {[['live','进行中'],['done','✨ 成功经验'],['topic','📌 主题榜']].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'live'  && <LiveTab pledges={pledges} loading={loading} cat={cat} setCat={setCat} sort={sort} setSort={setSort} />}
      {tab === 'done'  && <DoneTab donePledges={donePledges} loading={loadingDone} />}
      {tab === 'topic' && <TopicTab pledges={pledges} donePledges={donePledges} />}
    </div>
  )
}

const S = {
  topbar:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'calc(12px + env(safe-area-inset-top)) 16px 10px', background:'#FAF7F2', borderBottom:'0.5px solid #E0D5C0', position:'sticky', top:0, zIndex:10 },
  logo:      { fontFamily:'Noto Serif SC,serif', fontSize:20, fontWeight:900, color:'#1A1208' },
  tabRow:    { display:'flex', borderBottom:'0.5px solid #E0D5C0', background:'#FAF7F2', position:'sticky', top:51, zIndex:9 },
  tab:       { flex:1, padding:'10px 4px', fontSize:12, fontWeight:500, color:'#9A8A70', background:'none', border:'none', borderBottom:'2px solid transparent', cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  tabOn:     { color:'#C8922A', borderBottomColor:'#C8922A', fontWeight:700 },
  chip:      { padding:'6px 12px', borderRadius:20, fontSize:12, cursor:'pointer', background:'#fff', border:'0.5px solid #E0D5C0', color:'#7A6A50', fontFamily:'Noto Sans SC,sans-serif' },
  chipOn:    { background:'#C8922A', color:'#fff', border:'0.5px solid #C8922A' },
  sortBtn:   { background:'none', border:'0.5px solid #E0D5C0', borderRadius:20, padding:'4px 12px', fontSize:11, color:'#9A8A70', cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  sortBtnOn: { background:'#1A1208', color:'#fff', borderColor:'#1A1208' },
  pledgeCard:{ background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, cursor:'pointer', boxShadow:'0 1px 6px rgba(26,18,8,.05)' },
  tag:       { fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20 },
  secLabel:  { fontSize:11, fontWeight:600, color:'#9A8A70', letterSpacing:.5, marginBottom:10, marginTop:4 },
  successCard:{ background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, boxShadow:'0 1px 6px rgba(26,18,8,.05)' },
  quote:     { fontSize:12, color:'#5A4A30', lineHeight:1.7, background:'#FAF7F2', borderRadius:8, padding:'10px 12px', fontStyle:'italic' },
  expTag:    { fontSize:11, color:'#7A6A50', background:'#F5F0E8', borderRadius:20, padding:'3px 10px' },
  actionBtn: { background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#9A8A70', display:'flex', alignItems:'center', gap:4, fontFamily:'Noto Sans SC,sans-serif', padding:'4px 6px' },
  topicCard: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14, padding:14, marginBottom:10, boxShadow:'0 1px 4px rgba(26,18,8,.04)' },
}
