// src/pages/CompanionsPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

/* ─── 样式常量 ─── */
const C = {
  gold:    '#C8922A',
  goldL:   '#FDF3E0',
  goldD:   '#7A5A18',
  ink:     '#1A1208',
  muted:   '#7A6A50',
  hint:    '#B8A88A',
  bg:      '#FAF7F2',
  surf:    '#FFFFFF',
  soft:    '#F5F0E8',
  border:  '#E0D5C0',
  red:     '#C84040',
  redL:    '#FCEBEB',
  green:   '#3B7A4A',
  greenL:  '#E8F5EC',
  blue:    '#3A6A9A',
  blueL:   '#E8F0FA',
}

/* ─── 静态 mock 数据（MVP：无 Supabase 同行表时用占位数据） ─── */
const MY_TEAMS = [
  {
    id: 1,
    emoji: '📚',
    title: '30天连续读书',
    members: 3,
    day: 14,
    total: 30,
    allChecked: true,
    unread: 3,
    members_list: [
      { name: '我',  color: C.gold,  pct: 47, done: 14, checked: true },
      { name: '月',  color: C.blue,  pct: 53, done: 16, checked: true },
      { name: '书',  color: '#6A4A8A', pct: 43, done: 13, checked: true },
    ],
  },
  {
    id: 2,
    emoji: '🎮',
    title: '完美世界S通关',
    members: 0,
    day: 24,
    total: 31,
    recruiting: true,
  },
]

const RECOMMEND = [
  { id: 10, emoji: '🌅', title: '每天早起6点 · 30天',   host: '晨光', members: 2, day: 3  },
  { id: 11, emoji: '🏃', title: '每天跑步5公里 · 60天', host: '陈晨', members: 8, day: 32 },
]

const MY_CIRCLES = [
  { id: 1, emoji: '📚', name: '读书圈',    count: 1284, newPosts: 47, unread: 12,
    topics: ['📌 本周挑战：每天读完一章并写摘要', '🔥 热帖：睡前读书 vs 早起读书，哪个更容易坚持？'] },
]

const REC_CIRCLES = [
  { id: 10, emoji: '🏃', name: '跑步圈',    count: 3812, newPosts: 128 },
  { id: 11, emoji: '🧘', name: '冥想打卡圈', count: 892,  newPosts: 23  },
  { id: 12, emoji: '🌅', name: '早起打卡圈', count: 2147, newPosts: 86  },
]

const DAILY_POSTS = [
  { id: 1, ava: '月', color: C.blue,  name: '月影', time: '刚刚',   badge: '同行者', badgeColor: C.greenL, badgeText: C.green,
    tag: '📚 读书打卡 第16天',
    text: '今天读到费曼学习法那一章，越读越觉得和我们做这个誓言的逻辑一样——用输出来检验你有没有真的理解和内化 📖',
    likes: 8, flames: 5, question: false },
  { id: 2, ava: '晨', color: '#4A8A5A', name: '晨光', time: '32分钟前', badge: null,
    tag: '🌅 早起打卡 第3天',
    text: '5点58分睁眼，比闹钟早2分钟！身体已经开始有感觉了。早起的第一杯水，阳光刚刚照进来，这一刻值得所有的赌注 🌅',
    likes: 24, flames: 18, question: false },
  { id: 3, ava: '书', color: '#6A4A8A', name: '书香', time: '1小时前', badge: '同行者', badgeColor: C.goldL, badgeText: C.goldD,
    tag: '📚 读书打卡 第13天',
    text: '今天差点没坚持。工作到9点，脑子都木了，随手拿起书翻了3页就开始开小差。但还是撑着读完了。有时候不是不想读，是太累了，怎么办？',
    likes: 6, flames: 3, question: true },
]

/* ─── 小组件 ─── */
function Ava({ name, color, size = 32, fontSize = 12 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize, flexShrink: 0 }}>
      {name}
    </div>
  )
}

function Tag({ text, bg, color }) {
  return (
    <div style={{ background: bg, color, fontSize: 10, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
      {text}
    </div>
  )
}

function SecLabel({ children, style }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted,
      letterSpacing: .5, marginBottom: 10, ...style }}>
      {children}
    </div>
  )
}

/* ─── 团卡（有团） ─── */
function TeamCard({ team, onEnter, onChat }) {
  return (
    <div style={S.cCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 22 }}>{team.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Noto Serif SC,serif', color: C.ink }}>{team.title}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
            {team.members}人同行 · 第{team.day}天 · 今日{team.members_list.filter(m => m.checked).length}/{team.members}已打卡
          </div>
        </div>
        {team.allChecked && (
          <Tag text="全员完成 ✓" bg={C.greenL} color={C.green} />
        )}
      </div>

      {/* 成员进度条 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
        {team.members_list.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ava name={m.name} color={m.color} size={24} fontSize={10} />
            <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, minWidth: 48, textAlign: 'right' }}>{m.done}/{team.total}天</div>
            <div style={{ fontSize: 13, marginLeft: 2 }}>{m.checked ? '✅' : '⬜'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...S.btnSm, ...S.btnSmOn, flex: 1, textAlign: 'center' }} onClick={onEnter}>进入团室</button>
        <button style={{ ...S.btnSm, flex: 1, textAlign: 'center', position: 'relative' }} onClick={onChat}>
          💬 聊天
          {team.unread > 0 && (
            <span style={{ background: C.red, color: '#fff', fontSize: 10, padding: '1px 5px',
              borderRadius: 10, marginLeft: 4 }}>{team.unread}</span>
          )}
        </button>
      </div>
    </div>
  )
}

/* ─── 团卡（招募中） ─── */
function RecruitCard({ team, onRecruit }) {
  return (
    <div style={{ ...S.cCard, opacity: .88 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 22 }}>{team.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Noto Serif SC,serif', color: C.ink }}>{team.title}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>独行中 · 第{team.day}天 · 还差{team.total - team.day}天</div>
        </div>
        <Tag text="招募中" bg={C.goldL} color={C.goldD} />
      </div>
      <div style={{ fontSize: 12, color: C.hint, textAlign: 'center', padding: '8px 0',
        background: C.soft, borderRadius: 8, marginBottom: 10 }}>
        👥 还没有同行者，发出招募让人陪你走完最后{team.total - team.day}天
      </div>
      <button style={S.btnOutline} onClick={onRecruit}>发布同行招募</button>
    </div>
  )
}

/* ─── DailyPost ─── */
function DailyPost({ post }) {
  const [likes, setLikes] = useState(post.likes)
  const [flames, setFlames] = useState(post.flames)
  const [liked, setLiked] = useState(false)
  const [flamed, setFlamed] = useState(false)
  return (
    <div style={S.dailyPost}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Ava name={post.ava} color={post.color} size={30} fontSize={11} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{post.name}</div>
          <div style={{ fontSize: 10, color: C.hint }}>{post.time} · {post.tag}</div>
        </div>
        {post.badge && <Tag text={post.badge} bg={post.badgeColor} color={post.badgeText} />}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: C.ink, marginBottom: post.question ? 8 : 10 }}>
        {post.text}
      </div>
      {post.question && (
        <div style={{ background: C.soft, borderRadius: 8, padding: '8px 10px',
          marginBottom: 10, fontSize: 12, color: C.muted }}>
          🙋 向同行者提问中…
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <button style={S.logBtn} onClick={() => { setLiked(!liked); setLikes(l => l + (liked ? -1 : 1)) }}>
          <span style={{ fontSize: 14, color: liked ? C.red : C.hint }}>♥</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 3 }}>{likes}</span>
        </button>
        <button style={S.logBtn}>
          <span style={{ fontSize: 14, color: C.hint }}>💬</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 3 }}>回复</span>
        </button>
        <button style={S.logBtn} onClick={() => { setFlamed(!flamed); setFlames(f => f + (flamed ? -1 : 1)) }}>
          <span style={{ fontSize: 14, color: flamed ? '#E84A2A' : C.hint }}>🔥</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 3 }}>燃 {flames}</span>
        </button>
      </div>
    </div>
  )
}

/* ─── 主页面 ─── */
export default function CompanionsPage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('my')           // my | discover
  const [appliedTeams, setAppliedTeams] = useState({})
  const [toast, setToast] = useState(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const activeTeams = MY_TEAMS.filter(team => !team.recruiting)
  const recruitingTeams = MY_TEAMS.filter(team => team.recruiting)
  const unfinishedCount = activeTeams.reduce((sum, team) => sum + Math.max(0, team.members - team.members_list.filter(m => m.checked).length), 0)
  const displayName = profile?.nickname || '行者'

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
      display: 'flex', flexDirection: 'column' }}>

      {toast && (
        <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(26,18,8,.88)', color: '#fff', padding: '9px 20px', borderRadius: 20,
          fontSize: 13, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <div style={S.topbar}>
        <div style={S.logo}>同<em style={{ color: C.gold, fontStyle: 'normal' }}>行</em></div>
        <button style={S.textBtn} onClick={() => setTab('discover')}>发起招募</button>
      </div>

      <div style={S.tabBar}>
        {[['my','我的团'],['discover','发现同行']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            ...S.tabBtn,
            ...(tab === key ? S.tabBtnOn : {})
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'my' && (
        <div style={S.scrollArea}>
          <div style={S.summaryCard}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div>
                <div style={S.kicker}>守诺小队</div>
                <div style={S.summaryTitle}>{displayName}，今天和同行者一起往前走。</div>
              </div>
              <Tag text={unfinishedCount === 0 ? '今日全员完成' : `${unfinishedCount}人待守`} bg={unfinishedCount === 0 ? C.greenL : C.goldL} color={unfinishedCount === 0 ? C.green : C.goldD} />
            </div>
            <div style={S.summaryGrid}>
              <div><b>{activeTeams.length}</b><span>同行团</span></div>
              <div><b>{activeTeams.reduce((n, t) => n + t.members, 0)}</b><span>同行者</span></div>
              <div><b>{recruitingTeams.length}</b><span>招募中</span></div>
            </div>
          </div>

          <div style={S.banner} onClick={() => nav('/')}>
            <span style={{ fontSize: 18, marginRight: 8, flexShrink: 0 }}>☀️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>今日守诺提醒</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>先完成自己的打卡，再回到团里互相鼓励。</div>
            </div>
            <span style={{ fontSize: 16, color: C.hint }}>›</span>
          </div>

          <SecLabel>我的同行团</SecLabel>
          {activeTeams.map(team => (
            <TeamCard key={team.id} team={team}
              onEnter={() => showToast('团室功能即将上线')}
              onChat={() => showToast('聊天功能即将上线')} />
          ))}

          {recruitingTeams.length > 0 && (
            <>
              <SecLabel style={{ marginTop: 6 }}>我发起的招募</SecLabel>
              {recruitingTeams.map(team => (
                <RecruitCard key={team.id} team={team}
                  onRecruit={() => showToast('招募已重新发布，等待同行者加入')} />
              ))}
            </>
          )}

          <button style={S.primaryWide} onClick={() => setTab('discover')}>寻找新的同行者</button>
        </div>
      )}

      {tab === 'discover' && (
        <div style={S.scrollArea}>
          <div style={S.discoverIntro}>
            <div style={S.kicker}>发现同行</div>
            <div style={S.summaryTitle}>找一个正在做同类誓言的人，彼此提醒、彼此看见。</div>
            <button style={{ ...S.primaryWide, marginTop: 12 }} onClick={() => showToast('发起招募功能即将上线')}>发布同行招募</button>
          </div>

          <SecLabel>推荐小队</SecLabel>
          {RECOMMEND.map(r => (
            <div key={r.id} style={S.cCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 24 }}>{r.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    {r.host}发起 · {r.members}人同行 · 进行第{r.day}天
                  </div>
                </div>
                {appliedTeams[r.id] ? (
                  <Tag text="已申请" bg={C.greenL} color={C.green} />
                ) : (
                  <button style={{ ...S.btnSm, ...S.btnSmOn }}
                    onClick={() => { setAppliedTeams(t => ({ ...t, [r.id]: true })); showToast('已申请加入，等待确认') }}>
                    加入
                  </button>
                )}
              </div>
            </div>
          ))}

          <SecLabel style={{ marginTop: 8 }}>同行原则</SecLabel>
          <div style={S.ruleBox}>
            <div>只做轻监督，不做复杂社区。</div>
            <div>只提醒今天的守诺，不制造额外负担。</div>
            <div>先陪用户坚持，再谈内容流和广场化。</div>
          </div>
        </div>
      )}
    </div>
  )
}
/* ─── 样式对象 ─── */
const S = {
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: 'calc(14px + env(safe-area-inset-top)) 16px 12px', background: C.bg, borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  logo: { fontFamily: 'Noto Serif SC,serif', fontSize: 20, fontWeight: 900, color: C.ink, letterSpacing: .5 },
  textBtn: { border: `1px solid ${C.border}`, background: C.surf, color: C.goldD, borderRadius: 999,
    padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, position: 'relative', padding: 2 },
  tabBar: { display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, background: C.bg, flexShrink: 0 },
  tabBtn: { flex: 1, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 500, color: C.muted, borderBottom: '2px solid transparent',
    fontFamily: 'Noto Sans SC,sans-serif' },
  tabBtnOn: { color: C.gold, borderBottom: `2px solid ${C.gold}`, fontWeight: 800 },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '14px 16px' },
  kicker: { fontSize: 11, color: C.goldD, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 },
  summaryCard: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14,
    marginBottom: 12, boxShadow: '0 2px 10px rgba(26,18,8,.06)' },
  summaryTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 16, lineHeight: 1.45, fontWeight: 900, color: C.ink },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 },
  discoverIntro: { background: C.goldL, border: `1px solid #E8D4A0`, borderRadius: 14, padding: 14, marginBottom: 14 },
  ruleBox: { background: C.soft, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px',
    color: C.muted, fontSize: 12, lineHeight: 1.9, marginBottom: 10 },
  primaryWide: { width: '100%', background: C.gold, border: 'none', color: '#fff', borderRadius: 12,
    padding: '11px 12px', fontSize: 13, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  cCard: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 14,
    padding: 14, marginBottom: 10, boxShadow: '0 2px 10px rgba(26,18,8,.06)' },
  banner: { background: C.goldL, border: `1px solid #E8D4A0`, borderRadius: 12, padding: '12px 14px',
    display: 'flex', alignItems: 'center', marginBottom: 12, cursor: 'pointer' },
  btnSm: { background: 'none', border: `1px solid ${C.border}`, borderRadius: 20,
    padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: C.muted,
    fontFamily: 'Noto Sans SC,sans-serif', flexShrink: 0 },
  btnSmOn: { background: C.gold, borderColor: C.gold, color: '#fff' },
  btnOutline: { width: '100%', background: 'none', border: `1px solid ${C.border}`,
    borderRadius: 10, padding: 10, fontSize: 13, cursor: 'pointer', color: C.muted,
    fontFamily: 'Noto Sans SC,sans-serif' },
  dailyPost: { background: C.surf, border: `0.5px solid ${C.border}`, borderRadius: 12,
    padding: '12px 14px', marginBottom: 10 },
  logBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
    alignItems: 'center', padding: '2px 0' },
  bcBtn: { background: C.surf, border: `1px solid ${C.border}`, borderRadius: 20,
    padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: C.ink,
    fontFamily: 'Noto Sans SC,sans-serif' },
}
