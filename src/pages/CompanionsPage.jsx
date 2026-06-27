// src/pages/CompanionsPage.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getMyPledges, getPublicPledges } from '../lib/supabase'

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

function getHostName(pledge) {
  return pledge.profiles?.nickname || pledge.profiles?.avatar_emoji || '匿名行者'
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

function MyPledgeCard({ pledge, onDetail, onCheckin }) {
  const progress = pct(pledge)
  const left = daysLeft(pledge)
  const witnessCount = countFromRelation(pledge.witnesses)
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={S.emoji}>{pledge.category_icon || '📜'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle}>{pledge.title}</div>
          <div style={S.meta}>已守 {pledge.checkin_count || 0}/{pledge.total_days || 0} 天 · 还差{left}天</div>
        </div>
        <Tag tone={pledge.status === 'active' ? 'green' : 'gold'}>{pledge.status === 'active' ? '进行中' : '已结束'}</Tag>
      </div>
      <div style={S.track}><div style={{ ...S.fill, width: progress + '%' }} /></div>
      <div style={S.cardFoot}>
        <span>{progress}% · {witnessCount}人见证</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btnGhost} onClick={onDetail}>查看</button>
          {pledge.status === 'active' && <button style={S.btnGold} onClick={onCheckin}>去打卡</button>}
        </div>
      </div>
    </div>
  )
}

function PublicPledgeCard({ pledge, onOpen }) {
  const progress = pct(pledge)
  const witnessCount = countFromRelation(pledge.witnesses)
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={S.emoji}>{pledge.category_icon || '🧭'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle}>{pledge.title}</div>
          <div style={S.meta}>{getHostName(pledge)}发起 · 已守 {pledge.checkin_count || countFromRelation(pledge.checkins)}/{pledge.total_days || 0} 天</div>
        </div>
        <Tag>{witnessCount}见证</Tag>
      </div>
      <div style={S.track}><div style={{ ...S.fill, width: progress + '%' }} /></div>
      <div style={S.cardFoot}>
        <span>{progress}% · 可进入详情见证或关注</span>
        <button style={S.btnGold} onClick={onOpen}>查看</button>
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
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [mine, publics] = await Promise.all([
          session?.user?.id ? getMyPledges(session.user.id) : Promise.resolve([]),
          getPublicPledges({ sort: 'created_at' }),
        ])
        if (!alive) return
        const activeMine = (mine || []).filter(p => p.status === 'active')
        setMyPledges(activeMine)
        setPublicPledges((publics || []).filter(p => p.user_id !== session?.user?.id).slice(0, 12))
      } catch (err) {
        if (alive) setError(err.message || '同行数据加载失败')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [session?.user?.id])

  const displayName = profile?.nickname || '行者'
  const totalWitnesses = myPledges.reduce((sum, p) => sum + countFromRelation(p.witnesses), 0)
  const averageProgress = myPledges.length
    ? Math.round(myPledges.reduce((sum, p) => sum + pct(p), 0) / myPledges.length)
    : 0

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
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
            <div style={S.summaryTitle}>{displayName}，这里显示你真实进行中的誓言。</div>
            <div style={S.summaryGrid}>
              <div><b>{myPledges.length}</b><span>进行中</span></div>
              <div><b>{averageProgress}%</b><span>平均进度</span></div>
              <div><b>{totalWitnesses}</b><span>见证者</span></div>
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
              <div style={S.sectionLabel}>我的进行中誓言</div>
              {myPledges.map(pledge => (
                <MyPledgeCard
                  key={pledge.id}
                  pledge={pledge}
                  onDetail={() => nav('/pledge/' + pledge.id)}
                  onCheckin={() => nav('/pledge/' + pledge.id + '/checkin')}
                />
              ))}
            </>
          )}
        </div>
      )}

      {!loading && !error && tab === 'discover' && (
        <div style={S.scrollArea}>
          <div style={S.discoverIntro}>
            <div style={S.kicker}>发现同行</div>
            <div style={S.summaryTitle}>这里展示真实公开誓言。你可以进入详情，成为见证者，或参考他人的守诺方式。</div>
          </div>

          {publicPledges.length === 0 ? (
            <EmptyState
              title="暂时没有可发现的公开誓言"
              text="等更多用户公开自己的誓言后，这里会自动出现同行对象。"
            />
          ) : (
            <>
              <div style={S.sectionLabel}>公开守诺中的行者</div>
              {publicPledges.map(pledge => (
                <PublicPledgeCard key={pledge.id} pledge={pledge} onOpen={() => nav('/pledge/' + pledge.id)} />
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
  kicker: { fontSize: 11, color: C.goldD, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 },
  summaryCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 2px 10px rgba(26,18,8,.06)' },
  discoverIntro: { background: C.goldL, border: '1px solid #E8D4A0', borderRadius: 14, padding: 14, marginBottom: 14 },
  summaryTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 16, lineHeight: 1.45, fontWeight: 900, color: C.ink },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: .5, margin: '4px 0 10px' },
  card: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 2px 10px rgba(26,18,8,.06)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  emoji: { width: 34, height: 34, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: 800, fontFamily: 'Noto Serif SC,serif', color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.45 },
  track: { height: 7, borderRadius: 999, background: C.soft, overflow: 'hidden', marginBottom: 10 },
  fill: { height: '100%', borderRadius: 999, background: C.gold },
  cardFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11, color: C.muted },
  tag: { fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, flexShrink: 0 },
  btnGold: { border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', flexShrink: 0 },
  btnGhost: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', flexShrink: 0 },
  emptyCard: { background: C.surf, border: '1px dashed ' + C.border, borderRadius: 14, padding: '24px 18px', textAlign: 'center', color: C.muted },
  primaryWide: { width: '100%', background: C.gold, border: 'none', color: '#fff', borderRadius: 12, padding: '11px 12px', fontSize: 13, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
}
