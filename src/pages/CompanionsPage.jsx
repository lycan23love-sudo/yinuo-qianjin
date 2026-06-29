// src/pages/CompanionsPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getMyPledges, getPublicPledges, getPledgeDetail, publishCompanionRecruit, joinCompanionTeam, getMyCompanionJoins } from '../lib/supabase'
import { PLEDGE_CATEGORIES, inferPledgeCategory, inferPledgeTag } from '../lib/pledgeCategories'

const TEAM_LIMIT = 5

const C = {
  gold: '#C8922A', goldL: '#FDF3E0', goldD: '#7A5A18', ink: '#1A1208',
  muted: '#7A6A50', hint: '#B8A88A', bg: '#FAF7F2', surf: '#FFFFFF',
  soft: '#F5F0E8', border: '#E0D5C0', red: '#C84040', redL: '#FCEBEB',
  green: '#3B7A4A', greenL: '#E8F5EC', blue: '#3A6A9A', blueL: '#E8F0FA',
  purple: '#6A4A8A', purpleL: '#EFE9F7',
}

const SUPPORT_GROUPS = PLEDGE_CATEGORIES.map(c => ({
  key: c.key,
  emoji: c.emoji,
  name: c.groupName,
  hint: c.hint,
}))
function countFromRelation(value) {
  if (!Array.isArray(value) || value.length === 0) return 0
  return value[0]?.count || value.length || 0
}

function withBumpedWitnessCount(pledge) {
  const current = countFromRelation(pledge.witnesses)
  return { ...pledge, witnesses: [{ count: current + 1 }] }
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

function normalizedTitle(pledge) {
  return String(pledge.title || '').replace(/\s+/g, '').toLowerCase()
}

function groupForPledge(pledge) {
  const category = inferPledgeCategory(pledge)
  return SUPPORT_GROUPS.find(group => group.key === category.key) || SUPPORT_GROUPS[SUPPORT_GROUPS.length - 1]
}

function matchLevel(pledge, myPledges) {
  const title = normalizedTitle(pledge)
  if (title && myPledges.some(p => normalizedTitle(p) === title)) return 0
  const group = groupForPledge(pledge).key
  const tag = inferPledgeTag(pledge)
  if (tag && myPledges.some(p => groupForPledge(p).key === group && inferPledgeTag(p) === tag)) return 1
  if (group && myPledges.some(p => groupForPledge(p).key === group)) return 2
  return 3
}

function groupStats(groupKey, pledges, joinedIds) {
  const items = pledges.filter(p => groupForPledge(p).key === groupKey)
  return {
    teams: items.length,
    open: items.filter(p => teamSlots(p) > 0 && !joinedIds.has(p.id)).length,
    joined: items.filter(p => joinedIds.has(p.id)).length,
  }
}

function Tag({ children, tone = 'gold' }) {
  const map = {
    gold: { bg: C.goldL, color: C.goldD }, green: { bg: C.greenL, color: C.green },
    red: { bg: C.redL, color: C.red }, blue: { bg: C.blueL, color: C.blue },
    purple: { bg: C.purpleL, color: C.purple },
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

function SupportGroupCard({ group, active, stats, onClick }) {
  return (
    <button style={{ ...S.groupCard, ...(active ? S.groupCardOn : {}) }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={S.groupEmoji}>{group.emoji}</div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={S.groupName}>{group.name}</div>
          <div style={S.groupHint}>{group.hint}</div>
        </div>
      </div>
      <div style={S.groupMeta}>{stats.teams}个小队 · {stats.open}个可加入 · {stats.joined}个已加入</div>
    </button>
  )
}

function MyPledgeCard({ pledge, publishing, onRecruit, onRoom, onCheckin }) {
  const progress = pct(pledge)
  const slots = teamSlots(pledge)
  const isRecruiting = !!pledge.is_public
  const group = groupForPledge(pledge)
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={S.emoji}>{group.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle}>{pledge.title}</div>
          <div style={S.meta}>{group.name} · {inferPledgeTag(pledge)} · 已守 {pledge.checkin_count || 0}/{pledge.total_days || 0} 天 · 还差{daysLeft(pledge)}天</div>
        </div>
        <Tag tone={isRecruiting ? 'green' : 'gold'}>{isRecruiting ? '招募中' : '未招募'}</Tag>
      </div>

      <div style={S.teamLine}>
        <span>5人小队 {teamSize(pledge)}/{TEAM_LIMIT}</span>
        <span>{slots > 0 ? '还可加入' + slots + '人' : '已满员'}</span>
      </div>
      <div style={S.track}><div style={{ ...S.fill, width: progress + '%' }} /></div>

      <div style={S.cardFoot}>
        <span>{progress}% · {isRecruiting ? '可进入小队管理' : '发布后可被同类誓言者加入小队'}</span>
        <div style={S.actions}>
          <button style={S.btnGhost} onClick={onRoom}>小队</button>
          <div style={{ width: 52 }} />
          {!isRecruiting && <button style={S.btnGold} onClick={onRecruit} disabled={publishing}>{publishing ? '发布中' : '招募'}</button>}
        </div>
      </div>
    </div>
  )
}

function PublicPledgeCard({ pledge, match, joined, joining, onOpen, onJoin }) {
  const progress = pct(pledge)
  const slots = teamSlots(pledge)
  const full = slots <= 0
  const group = groupForPledge(pledge)
  const tone = joined ? 'green' : match === 0 ? 'blue' : match === 1 ? 'purple' : 'gold'
  const label = joined ? '已加入' : match === 0 ? '同誓言' : match === 1 ? '同互助会' : '可加入'
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={S.emoji}>{group.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle}>{pledge.title}</div>
          <div style={S.meta}>{getHostName(pledge)}发起 · {group.name} · 已守 {pledge.checkin_count || countFromRelation(pledge.checkins)}/{pledge.total_days || 0} 天</div>
        </div>
        <Tag tone={tone}>{label}</Tag>
      </div>

      <div style={S.teamLine}>
        <span>5人小队 {teamSize(pledge)}/{TEAM_LIMIT}</span>
        <span>{full ? '已满员' : '空位' + slots + '个'}</span>
      </div>
      <div style={S.track}><div style={{ ...S.fill, width: progress + '%' }} /></div>

      <div style={S.cardFoot}>
        <span>{progress}% · {joined ? '你已在这个互助小队' : '加入后进入我的团'}</span>
        <div style={S.actions}>
          <button style={S.btnGhost} onClick={onOpen}>{joined ? '小队' : '查看'}</button>
          {joined ? <button style={S.btnDone} disabled>已加入</button> : full ? <button style={S.btnDone} disabled>满员</button> : <button style={S.btnGold} onClick={onJoin} disabled={joining}>{joining ? '加入中' : '加入小队'}</button>}
        </div>
      </div>
    </div>
  )
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function checkedToday(pledge) {
  const today = todayKey()
  return (pledge.checkins || []).some(item => item.checkin_date === today)
}


function memberCheckinLine(member, index) {
  if (member.empty) return '这里还空着，等一个同路人坐下。'
  if (member.doneToday) {
    const lines = ['今天已报到：我守住了这一日。', '今日已守：先把该做的做完。', '已完成今日诺言，给后来的人留一盏灯。']
    return lines[index % lines.length]
  }
  const lines = ['还没报到，可能正在和拖延拉扯。', '今日待守，等一句提醒把他拉回来。', '还没出现，也许需要有人说一句：别一个人扛。']
  return lines[index % lines.length]
}

function getBuddy(activeMembers) {
  if (!activeMembers.length) return null
  return activeMembers.find(member => !member.doneToday) || activeMembers[0]
}

function buildRoomMembers(pledge) {
  const active = (pledge.witnesses || []).filter(item => !item.status || item.status === 'active').slice(0, TEAM_LIMIT - 1)
  const ownerDone = checkedToday(pledge)
  const owner = {
    id: pledge.user_id || 'owner',
    name: getHostName(pledge),
    role: '团长',
    progress: pct(pledge),
    doneToday: ownerDone,
    note: ownerDone ? '今日已守' : '今日待守',
  }
  const friends = active.map((item, index) => ({
    id: item.user_id || item.id || 'friend-' + index,
    name: item.profiles?.nickname || '同行者' + (index + 1),
    role: '团友',
    progress: pct(pledge),
    doneToday: false,
    note: '等待报到',
  }))
  const empty = Array.from({ length: Math.max(TEAM_LIMIT - 1 - friends.length, 0) }, (_, index) => ({
    id: 'empty-' + index,
    empty: true,
    name: '空位',
    role: '待加入',
    progress: 0,
    note: '可邀请同类誓言者',
  }))
  return [owner, ...friends, ...empty].slice(0, TEAM_LIMIT)
}

function HelpGroupPill({ group, active, stats, onClick }) {
  return (
    <button style={{ ...S.helpPill, ...(active ? S.helpPillOn : {}) }} onClick={onClick}>
      <div style={S.helpPillEmoji}>{group.emoji}</div>
      <div style={{ minWidth: 0 }}>
        <div style={S.helpPillName}>{group.name.replace('互助会', '')}</div>
        <div style={S.helpPillMeta}>{stats.open}个可加入</div>
      </div>
    </button>
  )
}

function HelpTeamCard({ pledge, joined, joining, match, onOpen, onJoin }) {
  const group = groupForPledge(pledge)
  const progress = pct(pledge)
  const slots = teamSlots(pledge)
  const full = slots <= 0
  const label = joined ? '已在团中' : match === 0 ? '同誓言' : match === 1 ? '同类型' : '可加入'
  return (
    <div style={S.helpTeamCard}>
      <div style={S.helpTeamMain}>
        <div style={S.helpTeamEmoji}>{group.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.helpTeamTitle}>{pledge.title}</div>
          <div style={S.helpTeamMeta}>{getHostName(pledge)}发起 · {inferPledgeTag(pledge)} · {teamSize(pledge)}/{TEAM_LIMIT}人 · 进度{progress}%</div>
        </div>
        <Tag tone={joined ? 'green' : match <= 1 ? 'blue' : 'gold'}>{label}</Tag>
      </div>
      <div style={S.helpTeamTrack}><div style={{ ...S.helpTeamFill, width: progress + '%' }} /></div>
      <div style={S.helpTeamFoot}>
        <span>{full ? '小队已满' : group.name.replace('互助会', '') + ' · 还可加入' + slots + '人'}</span>
        <div style={S.actions}>
          <button style={S.btnGhost} onClick={onOpen}>{joined ? '小队' : '查看'}</button>
          {!joined && (full ? <button style={S.btnDone} disabled>满员</button> : <button style={S.btnGold} onClick={onJoin} disabled={joining}>{joining ? '加入中' : '加入小队'}</button>)}
        </div>
      </div>
    </div>
  )
}

function recommendationReason(pledge, myPledges) {
  const match = matchLevel(pledge, myPledges)
  const group = groupForPledge(pledge)
  const tag = inferPledgeTag(pledge)
  if (match === 0) return '与你有相同誓言'
  if (match === 1) return '同属' + group.name.replace('互助会', '') + ' · ' + tag
  if (match === 2) return '同属' + group.name.replace('互助会', '')
  return '还有空位，可先观察'
}

function TodayTeamStatus({ featuredTeam, totalTeams, pendingCount, joinedCount, suggestedCount, onPrimary }) {
  const hasTeam = !!featuredTeam
  const pledge = featuredTeam?.pledge
  const members = hasTeam ? buildRoomMembers(pledge).filter(member => !member.empty) : []
  const teamCount = Math.max(members.length, hasTeam ? 1 : 0)
  const doneCount = hasTeam ? members.filter(member => member.doneToday).length : 0
  const userDone = hasTeam ? checkedToday(pledge) : false
  const statusText = !hasTeam
    ? '还没有小队。去互助会找到同类誓言者，让守诺不再只是一个人的事。'
    : userDone
      ? `你已完成今日守诺。小队当前 ${doneCount}/${teamCount} 已守，可以进去给队友一个回应。`
      : `小队当前 ${doneCount}/${teamCount} 已守。先看看队友节奏，再决定今天如何跟上。`
  const feedback = !hasTeam
    ? '找到同类目标后，这里会出现队友报到、掉队提醒和鼓励反馈。'
    : doneCount >= teamCount
      ? '今日全员已守，队伍节奏很好。'
      : doneCount > 0
        ? '已有队友先动起来，你也不会是独行。'
        : '今天还没人报到，等一个人先把节奏带起来。'
  return (
    <div style={S.todayStatusCard}>
      <div style={S.todayStatusHead}>
        <div style={S.todayIcon}>{userDone ? '✓' : hasTeam ? '!' : '+'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.todayTitle}>今日同行反馈</div>
          <div style={S.todayText}>{statusText}</div>
          <div style={S.todayFeedback}>{feedback}</div>
        </div>
      </div>
      <div style={S.todayStats}>
        <div style={S.todayStatBox}><b style={S.todayStatNum}>{totalTeams}</b><span style={S.todayStatLabel}>我的小队</span></div>
        <div style={S.todayStatBox}><b style={S.todayStatNum}>{pendingCount}</b><span style={S.todayStatLabel}>待回应</span></div>
        <div style={S.todayStatBox}><b style={S.todayStatNum}>{joinedCount}</b><span style={S.todayStatLabel}>已加入</span></div>
        <div style={S.todayStatBox}><b style={S.todayStatNum}>{suggestedCount}</b><span style={S.todayStatLabel}>可加入</span></div>
      </div>
      <div style={S.todayActions}>
        <button style={S.primaryTeamBtn} onClick={onPrimary}>{hasTeam ? '进入小队' : '发现小队'}</button>
      </div>
    </div>
  )
}

function CheckinPrompt({ done, lateDays, onClick }) {
  return (
    <button style={S.promptCard} onClick={onClick}>
      <div style={S.promptIcon}>☀️</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={S.promptTitle}>{done ? '今天已守住诺言' : '早安！今天还没打卡'}</div>
        <div style={S.promptText}>{done ? '保持节奏，进小队看看同行者状态' : '同行者都在路上，你落后了 ' + lateDays + ' 天'}</div>
      </div>
      <div style={S.promptArrow}>›</div>
    </button>
  )
}

function TeamProgressCard({ item, publishing, onRecruit, onRoom }) {
  const pledge = item.pledge
  const group = groupForPledge(pledge)
  const members = buildRoomMembers(pledge).filter(member => !member.empty).slice(0, 3)
  const isOwned = item.role === 'owned'
  const doneCount = members.filter(member => member.doneToday).length
  const teamCount = Math.max(members.length, 1)
  const feedback = doneCount >= teamCount
    ? '今日全员已守，节奏很好'
    : doneCount > 0
      ? `${doneCount}位队友已守，队伍正在向前`
      : '今天还没人报到，等一个人先动起来'
  return (
    <div style={S.teamCardLarge}>
      <div style={S.teamCardHead}>
        <div style={S.teamEmoji}>{group.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.teamTitle}>{pledge.title}</div>
          <div style={S.teamSub}>{teamSize(pledge)}人同行 · 今日{doneCount}/{teamCount}已守 · {feedback}</div>
        </div>
        <Tag tone={doneCount >= teamCount ? 'green' : isOwned && !pledge.is_public ? 'gold' : 'blue'}>{doneCount >= teamCount ? '全员完成' : isOwned && !pledge.is_public ? '招募中' : '同行中'}</Tag>
      </div>

      <div style={S.memberProgressList}>
        {members.map((member, index) => (
          <div key={member.id} style={S.memberProgressRow}>
            <div style={{ ...S.memberBubble, background: index === 0 ? C.gold : index === 1 ? C.blue : C.purple }}>{member.name.slice(0, 1)}</div>
            <div style={S.memberBar}><div style={{ ...S.memberBarFill, width: member.progress + '%', background: index === 0 ? C.gold : index === 1 ? C.blue : C.purple }} /></div>
            <div style={S.memberDay}>{member.progress}%</div>
            <div style={S.checkMark}>{member.doneToday ? '✓' : '·'}</div>
          </div>
        ))}
      </div>

      <div style={S.teamFeedbackLine}>{checkedToday(pledge) ? '你今天已守，可以给还没完成的队友一点提醒。' : '你今天还未报到，小队会记录你的节奏变化。'}</div>
      <div style={S.teamActionsRow}>
        <button style={S.primaryTeamBtn} onClick={onRoom}>进入小队</button>
      </div>
      {isOwned && !pledge.is_public && <button style={S.recruitWideBtn} onClick={onRecruit} disabled={publishing}>{publishing ? '发布中' : '发布同行招募'}</button>}
    </div>
  )
}

function SoloRecruitCard({ item, publishing, onRecruit, onRoom }) {
  const pledge = item.pledge
  const group = groupForPledge(pledge)
  return (
    <div style={S.soloCard}>
      <div style={S.teamCardHead}>
        <div style={S.teamEmoji}>{group.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.teamTitle}>{pledge.title}</div>
          <div style={S.teamSub}>独行中 · 还差{daysLeft(pledge)}天</div>
        </div>
        <Tag tone="gold">招募中</Tag>
      </div>
      <div style={S.soloHint}>👥 还没有同行者，发出招募让人陪你走完最后{daysLeft(pledge)}天</div>
      <button style={S.recruitWideBtn} onClick={pledge.is_public ? onRoom : onRecruit} disabled={publishing}>{pledge.is_public ? '进入小队' : publishing ? '发布中' : '发布同行招募'}</button>
    </div>
  )
}

function JoinRecommendationCard({ pledge, joining, reason, onJoin }) {
  const group = groupForPledge(pledge)
  const tag = inferPledgeTag(pledge)
  return (
    <div style={S.joinCard}>
      <div style={S.joinEmoji}>{group.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.joinTitle}>{pledge.title}</div>
        <div style={S.joinMeta}>{reason || group.name + ' · ' + tag} · {teamSize(pledge)}/{TEAM_LIMIT}人 · 空位{teamSlots(pledge)}个</div>
      </div>
      <button style={S.joinBtn} onClick={onJoin} disabled={joining}>{joining ? '加入中' : '加入小队'}</button>
    </div>
  )
}

function TeamListItem({ item, publishing, joining, onRecruit, onRoom, onJoin }) {
  const pledge = item.pledge
  const group = groupForPledge(pledge)
  const progress = pct(pledge)
  const slots = teamSlots(pledge)
  const isOwned = item.role === 'owned'
  const isJoined = item.role === 'joined'
  const isSuggested = item.role === 'suggested'
  const todayLabel = checkedToday(pledge) ? '今日已守' : '今日待回应'
  const status = isOwned ? (pledge.is_public ? '我发起·招募中' : '我发起·未招募') : isJoined ? '我加入' : '推荐'
  return (
    <div style={S.listItem}>
      <div style={S.listIcon}>{group.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.listTitle}>{pledge.title}</div>
        <div style={S.listMeta}>{status} · {group.name} · {teamSize(pledge)}/{TEAM_LIMIT}人 · {todayLabel}</div>
        <div style={S.listTrack}><div style={{ ...S.listFill, width: progress + '%' }} /></div>
      </div>
      <div style={S.listActions}>
        <button style={S.btnGhost} onClick={onRoom}>进入小队</button>
        {isOwned && !pledge.is_public && <button style={S.btnGold} onClick={onRecruit} disabled={publishing}>{publishing ? '发布中' : '招募'}</button>}
        {isSuggested && (slots <= 0 ? <button style={S.btnDone} disabled>满员</button> : <button style={S.btnGold} onClick={onJoin} disabled={joining}>{joining ? '加入中' : '加入小队'}</button>)}
      </div>
    </div>
  )
}

function TeamMemberRow({ member, rank }) {
  if (member.empty) {
    return (
      <div style={{ ...S.memberRow, opacity: .72 }}>
        <div style={{ ...S.memberAvatar, background: C.soft, color: C.hint }}>+</div>
        <div style={{ flex: 1 }}>
          <div style={S.memberName}>{member.name}<span>{member.role}</span></div>
          <div style={S.memberHint}>{member.note}</div>
        </div>
        <Tag tone="gold">席位</Tag>
      </div>
    )
  }
  return (
    <div style={S.memberRow}>
      <div style={S.memberAvatar}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.memberName}>{member.name}<span>{member.role}</span></div>
        <div style={S.memberHint}>{member.note} · 当前誓言进度 {member.progress}%</div>
        <div style={S.miniTrack}><div style={{ ...S.miniFill, width: member.progress + '%' }} /></div>
      </div>
      <Tag tone={member.doneToday ? 'green' : 'red'}>{member.doneToday ? '已守' : '待守'}</Tag>
    </div>
  )
}

function TeamRoom({ pledge, loading, error, toast, onBack, onNudge, onEncourage, onHelp }) {
  const group = groupForPledge(pledge)
  const members = buildRoomMembers(pledge)
  const activeMembers = members.filter(item => !item.empty)
  const doneCount = activeMembers.filter(item => item.doneToday).length
  const progress = pct(pledge)
  const buddy = getBuddy(activeMembers)
  const [echoes, setEchoes] = useState({})
  function sendEcho(member, label) {
    if (!member || member.empty) return
    setEchoes(prev => ({ ...prev, [member.id]: label }))
    onEncourage?.(label, member)
  }
  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.roomTopbar}>
        <button style={S.backBtn} onClick={onBack}>‹</button>
        <div style={S.logo}>小<em style={{ color: C.gold, fontStyle: 'normal' }}>队</em></div>
        <div style={{ width: 52 }} />
      </div>

      <div style={S.scrollArea}>
        {loading && <div style={S.stateText}>正在进入小队...</div>}
        {error && <div style={S.stateText}>{error}</div>}

        <div style={S.roomHero}>
          <div style={S.kicker}>{group.name}</div>
          <div style={S.roomTitle}>{pledge.title}</div>
          <div style={S.roomMeta}>{getHostName(pledge)}发起 · 5人小队 {teamSize(pledge)}/{TEAM_LIMIT} · 还差{daysLeft(pledge)}天</div>
          <div style={S.roomStats}>
            <div><b>{doneCount}/{activeMembers.length || 1}</b><span>今日报到</span></div>
            <div><b>{progress}%</b><span>契约进度</span></div>
            <div><b>{teamSlots(pledge)}</b><span>剩余席位</span></div>
          </div>
        </div>

        <div style={S.meetingCard}>
          <div style={S.meetingTitle}>今日报到圈</div>
          <div style={S.meetingSub}>{doneCount > 0 ? '有人已经先坐下报到。给一个回应，让守诺被看见。' : '今天还没人报到。互助会里，先开口的人会把大家拉回正轨。'}</div>
          {members.map((member, index) => (
            <div key={member.id} style={{ ...S.shareRow, ...(member.empty ? { opacity: .58 } : {}) }}>
              <div style={{ ...S.shareAvatar, background: member.empty ? C.soft : member.doneToday ? C.green : C.gold }}>{member.empty ? '+' : member.name.slice(0, 1)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.shareName}>{member.name}<span>{member.role}</span></div>
                <div style={S.shareText}>{memberCheckinLine(member, index)}</div>
                {!member.empty && (
                  <div style={S.echoRow}>
                    {['看见了', '稳住', '鼓掌', '跟上'].map(label => (
                      <button key={label} style={{ ...S.echoBtn, ...(echoes[member.id] === label ? S.echoBtnOn : {}) }} onClick={() => sendEcho(member, label)}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
              <Tag tone={member.empty ? 'gold' : member.doneToday ? 'green' : 'red'}>{member.empty ? '空位' : member.doneToday ? '已报到' : '待报到'}</Tag>
            </div>
          ))}
        </div>

        {buddy && (
          <div style={S.buddyCard}>
            <div style={S.buddyTop}>
              <div style={S.buddyIcon}>☕</div>
              <div style={{ flex: 1 }}>
                <div style={S.buddyTitle}>今日搭子：{buddy.name}</div>
                <div style={S.buddyText}>{buddy.doneToday ? 'TA已经完成。你可以把这份节奏接过来。' : 'TA今天还没报到。轻轻提醒一句，比沉默更有力量。'}</div>
              </div>
            </div>
            <div style={S.buddyActions}>
              <button style={S.buddyBtn} onClick={() => sendEcho(buddy, '我陪你')}>我陪你</button>
              <button style={S.buddyBtnDark} onClick={onNudge}>提醒报到</button>
            </div>
          </div>
        )}

        <div style={S.sectionLabel}>队内压力</div>
        <div style={S.panelCard}>
          <div style={S.compareRow}><span>今日报到率</span><b>{doneCount}/{activeMembers.length || 1}</b></div>
          <div style={S.compareRow}><span>我的位置</span><b>{checkedToday(pledge) ? '已跟上' : '待跟上'}</b></div>
          <div style={S.compareRow}><span>团队目标</span><b>满5人后开启PK</b></div>
          <div style={S.compareHint}>这里保留一点压力：不是排名羞辱，而是让你清楚自己是否掉队。下一步接入真实团员打卡后，会显示连续天数榜、最早报到和小队PK积分。</div>
        </div>

        <div style={S.sectionLabel}>互助动作</div>
        <div style={S.actionGrid}>
          <button style={S.actionBtn} onClick={onHelp}><b>我卡住了</b><span>向团友发起求助</span></button>
          <button style={S.actionBtn} onClick={onNudge}><b>提醒待守</b><span>给未完成者一次轻提醒</span></button>
          <button style={S.actionBtn} onClick={() => activeMembers[0] && sendEcho(activeMembers[0], '鼓掌')}><b>送出鼓励</b><span>让今天的努力被看见</span></button>
        </div>
      </div>
    </div>
  )
}

export default function CompanionsPage() {
  const { session, profile } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('my')
  const [teamFilter, setTeamFilter] = useState('all')
  const [activeGroup, setActiveGroup] = useState('study')
  const [myPledges, setMyPledges] = useState([])
  const [publicPledges, setPublicPledges] = useState([])
  const [joinedIds, setJoinedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [publishingId, setPublishingId] = useState(null)
  const [joiningId, setJoiningId] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [roomPledge, setRoomPledge] = useState(null)
  const [roomLoading, setRoomLoading] = useState(false)
  const [roomError, setRoomError] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [mine, publics, joins] = await Promise.all([
        session?.user?.id ? getMyPledges(session.user.id) : Promise.resolve([]),
        getPublicPledges({ sort: 'created_at' }),
        session?.user?.id ? getMyCompanionJoins(session.user.id) : Promise.resolve([]),
      ])
      const activeMine = (mine || []).filter(p => !p.status || p.status === 'active' || p.status === 'ongoing')
      const publicList = (publics || []).filter(p => p.user_id !== session?.user?.id).slice(0, 30)
      setMyPledges(activeMine)
      setJoinedIds(new Set(joins || []))
      setPublicPledges(publicList)
      const preferred = activeMine[0] ? groupForPledge(activeMine[0]).key : (publicList[0] ? groupForPledge(publicList[0]).key : 'study')
      setActiveGroup(preferred)
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
      showToast('已发布到互助会，最多5人同行')
      load()
    } catch (err) {
      showToast(err.message || '发布失败，请稍后再试')
    } finally {
      setPublishingId(null)
    }
  }

  async function handleJoin(pledge) {
    if (!session?.user?.id) return nav('/auth')
    setJoiningId(pledge.id)
    try {
      await joinCompanionTeam(session.user.id, pledge.id)
      setJoinedIds(ids => new Set([...ids, pledge.id]))
      setPublicPledges(list => list.map(item => item.id === pledge.id ? withBumpedWitnessCount(item) : item))
      showToast('已加入互助小队')
    } catch (err) {
      showToast(err.message || '加入失败，请稍后再试')
    } finally {
      setJoiningId(null)
    }
  }

  async function openRoom(pledge) {
    setRoomPledge(pledge)
    setRoomLoading(true)
    setRoomError('')
    try {
      const detail = await getPledgeDetail(pledge.id)
      const fallbackWitnesses = detail?.witnesses?.length ? detail.witnesses : pledge.witnesses
      const fallbackCheckins = detail?.checkins?.length ? detail.checkins : pledge.checkins
      setRoomPledge({ ...pledge, ...(detail || {}), witnesses: fallbackWitnesses, checkins: fallbackCheckins })
    } catch (err) {
      setRoomError(err.message || '小队加载失败')
    } finally {
      setRoomLoading(false)
    }
  }

  const displayName = profile?.nickname || '行者'
  const recommended = useMemo(() => {
    return [...publicPledges].sort((a, b) => {
      const am = matchLevel(a, myPledges)
      const bm = matchLevel(b, myPledges)
      if (am !== bm) return am - bm
      if (joinedIds.has(a.id) !== joinedIds.has(b.id)) return joinedIds.has(a.id) ? -1 : 1
      return teamSlots(b) - teamSlots(a)
    })
  }, [publicPledges, myPledges, joinedIds])
  const joinedTeams = recommended.filter(p => joinedIds.has(p.id))
  const activeGroupPledges = recommended.filter(p => groupForPledge(p).key === activeGroup)
  const suggestedForMy = recommended.filter(p => !joinedIds.has(p.id) && matchLevel(p, myPledges) <= 1 && teamSlots(p) > 0).slice(0, 3)
  const ownedMemberCount = myPledges.reduce((sum, p) => sum + teamSize(p), 0)
  const myTeamItemsRaw = [
    ...myPledges.map(pledge => ({ key: 'owned-' + pledge.id, role: 'owned', pledge })),
    ...joinedTeams.map(pledge => ({ key: 'joined-' + pledge.id, role: 'joined', pledge })),
  ]
  const myTeamItems = myTeamItemsRaw.filter(item => teamFilter === 'all' || item.role === teamFilter)
  const allTeamCount = myPledges.length + joinedTeams.length
  const activeTeamItems = myTeamItems.filter(item => item.role === 'joined' || teamSize(item.pledge) > 1 || item.pledge.is_public)
  const soloTeamItems = myTeamItems.filter(item => item.role === 'owned' && teamSize(item.pledge) <= 1 && !item.pledge.is_public)
  const featuredTeam = activeTeamItems[0]
  const secondaryTeams = activeTeamItems.slice(1, 3)
  const pendingTodayCount = myPledges.filter(p => !checkedToday(p)).length
  const suggestedOpenCount = recommended.filter(p => !joinedIds.has(p.id) && teamSlots(p) > 0).length

  if (roomPledge) {
    return (
      <TeamRoom pledge={roomPledge} loading={roomLoading} error={roomError} toast={toast}
        onBack={() => setRoomPledge(null)}
        onHelp={() => showToast('求助入口已打开：下一步会接入团内留言')}
        onNudge={() => showToast('已生成提醒：下一步会推送给待守团友')}
        onEncourage={() => showToast('鼓励已送出：下一步会记录为团内正反馈')} />
    )
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.topbar}><div style={S.logo}>同<em style={{ color: C.gold, fontStyle: 'normal' }}>行</em></div></div>

      <div style={S.tabBar}>
        {[['my','我的团'],['help','互助会']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...S.tabBtn, ...(tab === key ? S.tabBtnOn : {}) }}>{label}</button>
        ))}
      </div>

      {loading && <div style={S.stateText}>正在加载同行数据...</div>}
      {!loading && error && <div style={S.stateText}>{error}</div>}

      {!loading && !error && tab === 'my' && (
        <div style={S.scrollArea}>
          <TodayTeamStatus featuredTeam={featuredTeam} totalTeams={allTeamCount} pendingCount={pendingTodayCount} joinedCount={joinedTeams.length} suggestedCount={suggestedOpenCount}
            onPrimary={() => featuredTeam ? openRoom(featuredTeam.pledge) : setTab('help')} />

          <div style={S.sectionHeadProto}>
            <div style={S.sectionTitle}>我的团</div>
            <div style={S.filterRowInline}>
              {[
                ['all', '全部', allTeamCount],
                ['owned', '我发起', myPledges.length],
                ['joined', '我加入', joinedTeams.length],
              ].map(([key, label, count]) => (
                <button key={key} style={{ ...S.filterPill, ...(teamFilter === key ? S.filterPillOn : {}) }} onClick={() => setTeamFilter(key)}>{label}{count}</button>
              ))}
            </div>
          </div>

          {allTeamCount === 0 ? (
            <EmptyState title="还没有同行小队" text="先立下一份诺言，或去互助会加入同类誓言小队。" action="立下新誓" onAction={() => nav('/new')} />
          ) : myTeamItems.length === 0 ? (
            <EmptyState title="当前筛选下没有小队" text="切换到全部，或去互助会发现更多同类誓言者。" />
          ) : (
            <>
              {featuredTeam && (
                <TeamProgressCard item={featuredTeam} publishing={publishingId === featuredTeam.pledge.id}
                  onRecruit={() => handleRecruit(featuredTeam.pledge)} onRoom={() => openRoom(featuredTeam.pledge)} />
              )}

              {secondaryTeams.map(item => (
                <TeamListItem key={item.key} item={item} publishing={publishingId === item.pledge.id}
                  onRecruit={() => handleRecruit(item.pledge)} onRoom={() => openRoom(item.pledge)} />
              ))}

              {soloTeamItems.slice(0, 2).map(item => (
                <SoloRecruitCard key={item.key} item={item} publishing={publishingId === item.pledge.id}
                  onRecruit={() => handleRecruit(item.pledge)} onRoom={() => openRoom(item.pledge)} />
              ))}
            </>
          )}

          {suggestedForMy.length > 0 && (
            <div style={S.recommendBlock}>
              <div style={S.recommendTitle}>推荐加入</div>
              {suggestedForMy.slice(0, 2).map(pledge => (
                <JoinRecommendationCard key={pledge.id} pledge={pledge} joining={joiningId === pledge.id} reason={recommendationReason(pledge, myPledges)} onJoin={() => handleJoin(pledge)} />
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !error && tab === 'help' && (
        <div style={S.scrollArea}>
          <div style={S.helpPillRow}>
            {SUPPORT_GROUPS.map(group => (
              <HelpGroupPill key={group.key} group={group} active={activeGroup === group.key}
                stats={groupStats(group.key, publicPledges, joinedIds)} onClick={() => setActiveGroup(group.key)} />
            ))}
          </div>

          <div style={S.helpSectionHead}>
            <div>
              <div style={S.sectionTitle}>{SUPPORT_GROUPS.find(g => g.key === activeGroup)?.name || '互助会'}</div>
              <div style={S.sectionHint}>{SUPPORT_GROUPS.find(g => g.key === activeGroup)?.hint || '找到同类誓言者'}</div>
            </div>
            <button style={S.btnGhost} onClick={() => setTab('my')}>我的团</button>
          </div>

          {activeGroupPledges.length === 0 ? (
            <EmptyState title="这个互助会暂时没有公开小队" text="把自己的相关誓言发布招募，就能成为这里的第一个小队。" />
          ) : (
            activeGroupPledges.slice(0, 6).map(pledge => (
              <HelpTeamCard key={pledge.id} pledge={pledge} joined={joinedIds.has(pledge.id)} joining={joiningId === pledge.id}
                match={matchLevel(pledge, myPledges)} onOpen={() => openRoom(pledge)} onJoin={() => handleJoin(pledge)} />
            ))
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
  sectionLabel: { fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: .5, margin: '12px 0 10px' },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '14px 0 10px' },
  sectionHeadCompact: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 900, color: C.ink, fontFamily: 'Noto Serif SC,serif' },
  sectionHint: { fontSize: 11, color: C.hint, marginTop: 3, lineHeight: 1.45 },
  filterRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 },
  filterChip: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '8px 8px', fontSize: 12, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  filterChipOn: { background: C.ink, borderColor: C.ink, color: '#fff' },
  recommendPanel: { marginTop: 14, paddingTop: 2 },
  groupGrid: { display: 'grid', gap: 9, marginBottom: 14 },
  groupCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 12, padding: 12, textAlign: 'left', fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', boxShadow: '0 2px 8px rgba(26,18,8,.04)' },
  groupCardOn: { borderColor: C.gold, background: '#FFFCF5' },
  groupEmoji: { width: 34, height: 34, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  groupName: { fontSize: 14, fontWeight: 900, color: C.ink, marginBottom: 3 },
  groupHint: { fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  groupMeta: { marginTop: 8, fontSize: 11, color: C.goldD, fontWeight: 800 },
  card: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 2px 10px rgba(26,18,8,.06)' },


  helpHero: { background: '#FFF9EA', border: '1px solid #E8D4A0', borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: '0 3px 12px rgba(122,90,24,.05)' },
  helpHeroTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 18, fontWeight: 900, color: C.ink, marginBottom: 5 },
  helpHeroText: { fontSize: 12, color: C.muted, lineHeight: 1.65 },
  helpPillRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: '0 0 10px', marginBottom: 4 },
  helpPill: { minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + C.border, background: C.surf, borderRadius: 12, padding: '7px 8px', textAlign: 'left', fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', overflow: 'hidden' },
  helpPillOn: { borderColor: C.gold, background: '#FFFCF5' },
  helpPillEmoji: { width: 22, height: 22, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 },
  helpPillName: { fontSize: 11, fontWeight: 900, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' },
  helpPillMeta: { fontSize: 9, color: C.goldD, marginTop: 1, fontWeight: 800, whiteSpace: 'nowrap' },
  helpSectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '2px 0 10px' },
  helpTeamCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 15, padding: 12, marginBottom: 10, boxShadow: '0 2px 10px rgba(26,18,8,.04)' },
  helpTeamMain: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  helpTeamEmoji: { width: 36, height: 36, borderRadius: 10, background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 },
  helpTeamTitle: { fontSize: 15, fontWeight: 900, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  helpTeamMeta: { fontSize: 11, color: C.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  helpTeamTrack: { height: 5, borderRadius: 999, background: C.soft, overflow: 'hidden', marginBottom: 9 },
  helpTeamFill: { height: '100%', borderRadius: 999, background: C.gold },
  helpTeamFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11, color: C.muted },
  todayStatusCard: { background: '#FFF7E6', border: '1px solid #E6D3A4', borderRadius: 18, padding: 15, marginBottom: 14, boxShadow: '0 3px 12px rgba(122,90,24,.06)' },
  todayStatusHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  todayIcon: { width: 42, height: 42, borderRadius: '50%', background: C.ink, color: '#F6D486', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, flexShrink: 0 },
  todayTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 17, fontWeight: 900, color: C.ink, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  todayText: { fontSize: 12, color: C.muted, lineHeight: 1.55 },
  todayFeedback: { marginTop: 8, fontSize: 12, color: C.goldD, lineHeight: 1.5, fontWeight: 800 },
  todayStats: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7, marginBottom: 12 },
  todayStatBox: { background: 'rgba(255,255,255,.68)', border: '1px solid rgba(224,213,192,.72)', borderRadius: 12, padding: '8px 4px', textAlign: 'center' },
  todayStatNum: { display: 'block', fontSize: 17, lineHeight: 1, fontWeight: 900, color: C.ink, marginBottom: 5 },
  todayStatLabel: { display: 'block', fontSize: 10, color: C.muted, whiteSpace: 'nowrap' },
  todayActions: { display: 'grid', gridTemplateColumns: '1fr', gap: 8 },
  promptCard: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#FFF7E6', border: '1px solid #E6D3A4', borderRadius: 18, padding: '15px 14px', marginBottom: 18, boxShadow: '0 3px 12px rgba(122,90,24,.06)', fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  promptIcon: { width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  promptTitle: { fontSize: 16, fontWeight: 900, color: C.ink, marginBottom: 4 },
  promptText: { fontSize: 13, color: C.muted },
  promptArrow: { fontSize: 26, color: C.hint, flexShrink: 0 },
  sectionHeadProto: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '2px 0 12px' },
  filterRowInline: { display: 'flex', gap: 6, flexShrink: 0 },
  filterPill: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  filterPillOn: { background: C.ink, color: '#fff', borderColor: C.ink },
  teamCardLarge: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 4px 18px rgba(26,18,8,.07)' },
  teamCardHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  teamEmoji: { width: 42, height: 42, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, flexShrink: 0 },
  teamTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 18, fontWeight: 900, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  teamSub: { fontSize: 12, color: C.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memberProgressList: { display: 'grid', gap: 12, margin: '4px 0 18px' },
  memberProgressRow: { display: 'grid', gridTemplateColumns: '34px 1fr 54px 28px', alignItems: 'center', gap: 10 },
  memberBubble: { width: 32, height: 32, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 },
  memberBar: { height: 8, borderRadius: 999, background: C.soft, overflow: 'hidden' },
  memberBarFill: { height: '100%', borderRadius: 999 },
  memberDay: { textAlign: 'right', fontSize: 12, color: C.muted, fontWeight: 800 },
  checkMark: { width: 24, height: 24, borderRadius: 6, background: C.greenL, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900 },
  teamFeedbackLine: { marginTop: 10, fontSize: 12, color: C.muted, lineHeight: 1.55, background: C.goldL, borderRadius: 10, padding: '8px 10px' },
  teamActionsRow: { display: 'grid', gridTemplateColumns: '1fr', gap: 12 },
  primaryTeamBtn: { border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '12px 14px', fontSize: 15, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  secondaryTeamBtn: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '11px 14px', fontSize: 15, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  soloCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 3px 14px rgba(26,18,8,.05)' },
  soloHint: { background: C.soft, color: C.hint, borderRadius: 10, padding: '11px 12px', fontSize: 13, margin: '4px 0 14px', lineHeight: 1.5 },
  recruitWideBtn: { width: '100%', border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 13, padding: '12px 14px', fontSize: 14, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  recommendBlock: { marginTop: 18 },
  recommendTitle: { fontSize: 14, fontWeight: 900, color: C.muted, margin: '0 0 10px' },
  joinCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 15, padding: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 10px rgba(26,18,8,.04)' },
  joinEmoji: { width: 38, height: 38, borderRadius: 10, background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  joinTitle: { fontSize: 15, fontWeight: 900, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  joinMeta: { fontSize: 12, color: C.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  joinBtn: { border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '10px 16px', fontSize: 14, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', flexShrink: 0 },
  listItem: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 12, padding: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 6px rgba(26,18,8,.04)' },
  listIcon: { width: 32, height: 32, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 },
  listTitle: { fontSize: 13, fontWeight: 900, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  listMeta: { fontSize: 10, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  listTrack: { height: 4, borderRadius: 999, background: C.soft, overflow: 'hidden', marginTop: 6 },
  listFill: { height: '100%', borderRadius: 999, background: C.gold },
  listActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  emoji: { width: 34, height: 34, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: 800, fontFamily: 'Noto Serif SC,serif', color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.45 },
  teamLine: { display: 'flex', justifyContent: 'space-between', color: C.goldD, background: C.goldL, borderRadius: 8, padding: '6px 9px', fontSize: 11, fontWeight: 800, marginBottom: 10 },
  track: { height: 7, borderRadius: 999, background: C.soft, overflow: 'hidden', marginBottom: 10 },
  fill: { height: '100%', borderRadius: 999, background: C.gold },
  cardFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11, color: C.muted },
  actions: { display: 'flex', gap: 8, flexShrink: 0 },
  tag: { fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, flexShrink: 0 },
  btnGold: { border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', flexShrink: 0 },
  btnGhost: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', flexShrink: 0 },
  btnDone: { border: '1px solid ' + C.border, background: C.soft, color: C.hint, borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans SC,sans-serif', flexShrink: 0 },
  emptyCard: { background: C.surf, border: '1px dashed ' + C.border, borderRadius: 14, padding: '24px 18px', textAlign: 'center', color: C.muted },
  primaryWide: { width: '100%', background: C.gold, border: 'none', color: '#fff', borderRadius: 12, padding: '11px 12px', fontSize: 13, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  roomTopbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', background: C.bg, borderBottom: '1px solid ' + C.border, flexShrink: 0 },
  backBtn: { width: 34, height: 34, borderRadius: '50%', border: '1px solid ' + C.border, background: C.surf, color: C.ink, fontSize: 24, lineHeight: '28px', fontWeight: 800, cursor: 'pointer' },
  roomHero: { background: 'linear-gradient(135deg, #FFF9EA 0%, #FFFFFF 58%, #F5F0E8 100%)', border: '1px solid #E8D4A0', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 4px 16px rgba(122,90,24,.08)' },
  roomTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 18, lineHeight: 1.35, fontWeight: 900, color: C.ink, marginBottom: 6 },
  roomMeta: { fontSize: 12, color: C.muted, lineHeight: 1.6 },
  roomStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 },
  panelCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 10, marginBottom: 12, boxShadow: '0 2px 10px rgba(26,18,8,.05)' },
  memberRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid ' + C.soft },
  memberAvatar: { width: 30, height: 30, borderRadius: '50%', background: C.gold, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 },
  memberName: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 900, color: C.ink },
  memberHint: { fontSize: 11, color: C.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  miniTrack: { height: 5, borderRadius: 999, background: C.soft, overflow: 'hidden', marginTop: 6 },
  miniFill: { height: '100%', borderRadius: 999, background: C.gold },
  compareRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 4px', fontSize: 13, color: C.muted, borderBottom: '1px solid ' + C.soft },
  compareHint: { fontSize: 11, color: C.hint, lineHeight: 1.7, padding: '10px 4px 2px' },
  meetingCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 18, padding: 14, marginBottom: 14, boxShadow: '0 4px 16px rgba(26,18,8,.06)' },
  meetingTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 17, fontWeight: 900, color: C.ink, marginBottom: 4 },
  meetingSub: { fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 },
  shareRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderTop: '1px solid ' + C.soft },
  shareAvatar: { width: 34, height: 34, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 },
  shareName: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 900, color: C.ink },
  shareText: { fontSize: 12, color: C.muted, lineHeight: 1.55, marginTop: 4 },
  echoRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  echoBtn: { border: '1px solid ' + C.border, background: '#FFFDF8', color: C.goldD, borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  echoBtnOn: { background: C.ink, borderColor: C.ink, color: '#F6D486' },
  buddyCard: { background: '#FFF7E6', border: '1px solid #E6D3A4', borderRadius: 18, padding: 14, marginBottom: 14, boxShadow: '0 3px 12px rgba(122,90,24,.06)' },
  buddyTop: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 },
  buddyIcon: { width: 40, height: 40, borderRadius: '50%', background: C.ink, color: '#F6D486', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  buddyTitle: { fontSize: 15, fontWeight: 900, color: C.ink, marginBottom: 4 },
  buddyText: { fontSize: 12, color: C.muted, lineHeight: 1.55 },
  buddyActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  buddyBtn: { border: '1px solid ' + C.border, background: C.surf, color: C.goldD, borderRadius: 999, padding: '10px 12px', fontSize: 13, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  buddyBtnDark: { border: 'none', background: C.ink, color: '#F6D486', borderRadius: 999, padding: '10px 12px', fontSize: 13, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  actionGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: 9, marginBottom: 12 },
  actionBtn: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left', fontFamily: 'Noto Sans SC,sans-serif', color: C.ink, cursor: 'pointer', boxShadow: '0 2px 10px rgba(26,18,8,.04)' },
}
