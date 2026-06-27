// src/pages/CompanionsPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getMyPledges, getPublicPledges, publishCompanionRecruit } from '../lib/supabase'

const TEAM_LIMIT = 5

const C = {
  gold: '#C8922A',
  goldL: '#FDF3E0',
  goldD: '#7A5A18',
  ink: '#1A1208',
  muted: '#7A6A50',
  hint: '#B8A88A',
  bg: '#FAF7F2',
  surf: '#FFFFFF',
  soft: '#F5F0E8',
  border: '#E0D5C0',
  red: '#C84040',
  redL: '#FCEBEB',
  green: '#3B7A4A',
  greenL: '#E8F5EC',
}

function countFromRelation(value) {
  if (!Array.isArray(value) || value.length === 0) return 0
  return value[0]?.count || value.length || 0
}

function pct(pledge) {
  const total = Math.max(pledge.total_days || 1, 1)
  return Math.min(100, Math.round(((pledge.checkin_count || countFromRelation(pledge.checkins)) / total) * 100))
}

function daysLeft(pledge) {
  const total = Math.max(pledge.total_days || 0, 0)
  const done = pledge.checkin_count || countFromRelation(pledge.checkins)
  return Math.max(total - done, 0)
}

function teamSize(pledge) {
  return Math.min(TEAM_LIMIT, 1 + countFromRelation(pledge.witnesses))
}

function teamSlots(pledge) {
  return Math.max(TEAM_LIMIT - teamSize(pledge), 0)
}

function getHostName(pledge) {
  return pledge.profiles?.nickname || pledge.profiles?.avatar_emoji || '匿名行者'
}

function categoryKey(pledge) {
  return pledge.category || pledge.category_key || pledge.type || pledge.verify_type || ''
}

function Tag({ children, tone = 'gold' }) {
  const map = {
    gold: { bg: C.goldL, color: C.goldD },
    green: { bg: C.greenL, color: C.green },
    red: { bg: C.redL, color: C.red },
  }
  const t = map[tone] || map.gold
  return <span style={{ ...S.tag, background: t.bg, color: t.color }}>{children}</span>
}

function EmptyState({ title, text, action, onAction }) {
  return (
    <div style={S.emptyCard}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: action ? 12 : 0 }}>{text}</div>
      {action && <button style={S.primaryWide} onClick={onAction}>{action}</button>}
    </div>
  )
}

function MyPledgeCard({ pledge, publishing, onRecruit, onDetail, onCheckin }) {
  const progress = pct(pledge)
  const slots = teamSlots(pledge)
  const isRecruiting = !!pledge.is_public
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={S.emoji}>{pledge.category_icon || '📜'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle}>{pledge.title}</div>
          <div style={S.meta}>已守 {pledge.checkin_count || 0}/{pledge.total_days || 0} 天 · 还差{daysLeft(pledge)}天</div>
        </div>
        <Tag tone={isRecruiting ? 'green' : 'gold'}>{isRecruiting ? '招募中' : '未招募'}</Tag>
      </div>

      <div style={S.teamLine}>
        <span>同行团 {teamSize(pledge)}/{TEAM_LIMIT}</span>
        <span>{slots > 0 ? '还可邀请' + slots + '人' : '已满员'}</span>
      </div>
      <div style={S.track}><div style={{ ...S.fill, width: progress + '%' }} /></div>

      <div style={S.cardFoot}>
        <span>{progress}% · {isRecruiting ? '正在广场等待同行者' : '发布后同类行者可发现'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btnGhost} onClick={onDetail}>查看</button>
          <button style={S.btnGhost} onClick={onCheckin}>打卡</button>
          {!isRecruiting && (
            <button style={S.btnGold} onClick={onRecruit} disabled={publishing}>
              {publishing ? '发布中' : '招募'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PublicPledgeCard({ pledge, sameKind, onOpen }) {
  const progress = pct(pledge)
  const slots = teamSlots(pledge)
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={S.emoji}>{pledge.category_icon || '🧭'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle}>{pledge.title}</div>
          <div style={S.meta}>{getHostName(pledge)}发起 · 已守 {pledge.checkin_count || countFromRelation(pledge.checkins)}/{pledge.total_days || 0} 天</div>
        </div>
        <Tag tone={sameKind ? 'green' : 'gold'}>{sameKind ? '同类' : '可加入'}</Tag>
      </div>

      <div style={S.teamLine}>
        <span>同行团 {teamSize(pledge)}/{TEAM_LIMIT}</span>
        <span>{slots > 0 ? '空位' + slots + '个' : '已满员'}</span>
      </div>
      <div style={S.track}><div style={{ ...S.fill, width: progress + '%' }} /></div>

      <div style={S.cardFoot}>
        <span>{progress}% · 进入详情后可见证同行</span>
        <button style={S.btnGold} onClick={onOpen}>{slots > 0 ? '推荐加入' : '查看'}</button>
      </div>
    </div>
  )
}

export default function CompanionsPage() {
  const { session, profile } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('my')
  const [myPledges, setMyPledges] = useState([])
  const [publicPledges, setPublicPledges] = useState([])
  const [loading, setLoading] = useState(true)
  const [publishingId, setPublishingId] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [mine, publics] = await Promise.all([
        session?.user?.id ? getMyPledges(session.user.id) : Promise.resolve([]),
        getPublicPledges({ sort: 'created_at' }),
      ])
      const activeMine = (mine || []).filter(p => p.status === 'active')
      setMyPledges(activeMine)
      setPublicPledges((publics || []).filter(p => p.user_id !== session?.user?.id).slice(0, 20))
    } catch (err) {
      setError(err.message || '同行数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [session?.user?.id])

  async function handleRecruit(pledge) {
    if (!session?.user?.id) return nav('/auth')
    setPublishingId(pledge.id)
    try {
      const updated = await publishCompanionRecruit(pledge.id, session.user.id)
      setMyPledges(list => list.map(item => item.id === pledge.id ? { ...item, ...updated, is_public: true } : item))
      showToast('已发布同行招募，最多5人同行')
      load()
    } catch (err) {
      showToast(err.message || '发布失败，请稍后再试')
    } finally {
      setPublishingId(null)
    }
  }

  const displayName = profile?.nickname || '行者'
  const myCategories = useMemo(() => new Set(myPledges.map(categoryKey).filter(Boolean)), [myPledges])
  const recommended = useMemo(() => {
    return [...publicPledges].sort((a, b) => {
      const as = myCategories.has(categoryKey(a)) ? 0 : 1
      const bs = myCategories.has(categoryKey(b)) ? 0 : 1
      if (as !== bs) return as - bs
      return teamSlots(b) - teamSlots(a)
    })
  }, [publicPledges, myCategories])
  const sameKindRecommended = recommended.filter(p => myCategories.has(categoryKey(p))).slice(0, 3)
  const totalMembers = myPledges.reduce((sum, p) => sum + teamSize(p), 0)
  const recruitingCount = myPledges.filter(p => p.is_public).length

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.topbar}>
        <div style={S.logo}>同<em style={{ color: C.gold, fontStyle: 'normal' }}>行</em></div>
      </div>

      <div style={S.tabBar}>
        {[['my','我的团'],['discover','发现同行']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...S.tabBtn, ...(tab === key ? S.tabBtnOn : {}) }}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={S.stateText}>正在加载同行数据...</div>}
      {!loading && error && <div style={S.stateText}>{error}</div>}

      {!loading && !error && tab === 'my' && (
        <div style={S.scrollArea}>
          <div style={S.summaryCard}>
            <div style={S.kicker}>守诺小队</div>
            <div style={S.summaryTitle}>{displayName}，每份誓言都可以招募最多5位同行者。</div>
            <div style={S.summaryGrid}>
              <div><b>{myPledges.length}</b><span>进行中</span></div>
              <div><b>{recruitingCount}</b><span>招募中</span></div>
              <div><b>{totalMembers}</b><span>同行人数</span></div>
            </div>
          </div>

          {myPledges.length === 0 ? (
            <EmptyState
              title="还没有进行中的誓言"
              text="先立下一份诺言，同行板块会自动把它变成你的守诺小队入口。"
              action="立下新誓"
              onAction={() => nav('/new')}
            />
          ) : (
            <>
              <div style={S.sectionLabel}>我的誓言团</div>
              {myPledges.map(pledge => (
                <MyPledgeCard
                  key={pledge.id}
                  pledge={pledge}
                  publishing={publishingId === pledge.id}
                  onRecruit={() => handleRecruit(pledge)}
                  onDetail={() => nav('/pledge/' + pledge.id)}
                  onCheckin={() => nav('/pledge/' + pledge.id + '/checkin')}
                />
              ))}
            </>
          )}

          {sameKindRecommended.length > 0 && (
            <>
              <div style={S.sectionLabel}>推荐加入</div>
              {sameKindRecommended.map(pledge => (
                <PublicPledgeCard key={pledge.id} pledge={pledge} sameKind onOpen={() => nav('/pledge/' + pledge.id)} />
              ))}
            </>
          )}
        </div>
      )}

      {!loading && !error && tab === 'discover' && (
        <div style={S.scrollArea}>
          <div style={S.discoverIntro}>
            <div style={S.kicker}>发现同行</div>
            <div style={S.summaryTitle}>优先推荐与你誓言类型相近的公开招募。每个同行团最多5人，满员后只可查看。</div>
          </div>

          {recommended.length === 0 ? (
            <EmptyState title="暂时没有可发现的公开誓言" text="发布同行招募后，你的公开誓言也会出现在这里。" />
          ) : (
            <>
              <div style={S.sectionLabel}>推荐加入</div>
              {recommended.map(pledge => (
                <PublicPledgeCard
                  key={pledge.id}
                  pledge={pledge}
                  sameKind={myCategories.has(categoryKey(pledge))}
                  onOpen={() => nav('/pledge/' + pledge.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const S = {
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(14px + env(safe-area-inset-top)) 16px 12px', background: C.bg, borderBottom: '1px solid ' + C.border, flexShrink: 0 },
  logo: { fontFamily: 'Noto Serif SC,serif', fontSize: 20, fontWeight: 900, color: C.ink, letterSpacing: .5 },
  tabBar: { display: 'flex', borderBottom: '1px solid ' + C.border, background: C.bg, flexShrink: 0 },
  tabBtn: { flex: 1, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: C.muted, borderBottom: '2px solid transparent', fontFamily: 'Noto Sans SC,sans-serif' },
  tabBtnOn: { color: C.gold, borderBottom: '2px solid ' + C.gold, fontWeight: 800 },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '14px 16px' },
  stateText: { padding: '28px 16px', textAlign: 'center', color: C.muted, fontSize: 13 },
  toast: { position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(26,18,8,.9)', color: '#fff', padding: '9px 18px', borderRadius: 999, fontSize: 13, zIndex: 200, whiteSpace: 'nowrap' },
  kicker: { fontSize: 11, color: C.goldD, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 },
  summaryCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 2px 10px rgba(26,18,8,.06)' },
  discoverIntro: { background: C.goldL, border: '1px solid #E8D4A0', borderRadius: 14, padding: 14, marginBottom: 14 },
  summaryTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 16, lineHeight: 1.45, fontWeight: 900, color: C.ink },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: .5, margin: '10px 0 10px' },
  card: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 2px 10px rgba(26,18,8,.06)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  emoji: { width: 34, height: 34, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: 800, fontFamily: 'Noto Serif SC,serif', color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.45 },
  teamLine: { display: 'flex', justifyContent: 'space-between', color: C.goldD, background: C.goldL, borderRadius: 8, padding: '6px 9px', fontSize: 11, fontWeight: 800, marginBottom: 10 },
  track: { height: 7, borderRadius: 999, background: C.soft, overflow: 'hidden', marginBottom: 10 },
  fill: { height: '100%', borderRadius: 999, background: C.gold },
  cardFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11, color: C.muted },
  tag: { fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, flexShrink: 0 },
  btnGold: { border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', flexShrink: 0 },
  btnGhost: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', flexShrink: 0 },
  emptyCard: { background: C.surf, border: '1px dashed ' + C.border, borderRadius: 14, padding: '24px 18px', textAlign: 'center', color: C.muted },
  primaryWide: { width: '100%', background: C.gold, border: 'none', color: '#fff', borderRadius: 12, padding: '11px 12px', fontSize: 13, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
}
