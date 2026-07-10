// src/pages/CompanionsPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getMyPledges, getPublicPledges, getPledgeDetail, getUserCompanionPledges, publishCompanionRecruit, joinCompanionTeam, getMyCompanionJoins, sendUserNotification, savePushSubscription, getPushSubscriptionStatus } from '../lib/supabase'
import { PLEDGE_CATEGORIES, inferPledgeCategory, inferPledgeTag } from '../lib/pledgeCategories'

const TEAM_LIMIT = 5

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function canUsePushNotifications() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

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

const ENCOURAGE_LINES = ['看见你今天这一步了，别小看它。', '稳住，我们只守今天这一日。', '你已经在路上了，继续往前一点点。', '别急着证明全部，先完成眼前这一件。', '今天能回来守诺，就已经很不容易。']
const ENCOURAGE_CHOICES = [...ENCOURAGE_LINES, '👏 看见了', '🔥 跟上', '🌱 慢慢来', '🤝 我陪你']

function userTeamKey(pledge) {
  return pledge?.user_id || pledge?.profiles?.id || pledge?.id
}

function groupPledgesByUser(pledges) {
  const teams = new Map()
  ;(pledges || []).forEach(pledge => {
    const key = userTeamKey(pledge)
    if (!key) return
    const current = teams.get(key)
    if (!current) {
      teams.set(key, { ...pledge, teamPledges: [pledge] })
      return
    }
    current.teamPledges.push(pledge)
    const currentSlots = teamSlots(current)
    const nextSlots = teamSlots(pledge)
    if (nextSlots > currentSlots || (!current.is_public && pledge.is_public)) {
      teams.set(key, { ...pledge, teamPledges: current.teamPledges })
    }
  })
  return Array.from(teams.values())
}

function indexPledgesByUser(pledges) {
  return (pledges || []).reduce((map, pledge) => {
    const key = userTeamKey(pledge)
    if (!key) return map
    map[key] = [...(map[key] || []), pledge]
    return map
  }, {})
}

function aggregatePledges(pledges, fallbackPledge) {
  const list = (pledges && pledges.length ? pledges : (fallbackPledge ? [fallbackPledge] : [])).filter(Boolean)
  const total = list.reduce((sum, item) => sum + Math.max(item.total_days || 0, 0), 0)
  const done = list.reduce((sum, item) => sum + (item.checkin_count || countFromRelation(item.checkins)), 0)
  const progress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  return {
    progress,
    done,
    total,
    doneToday: list.length > 0 && list.every(checkedToday),
    titles: list.map(item => item.title).filter(Boolean),
  }
}

function teamHasGroup(pledge, groupKey) {
  return (pledge.teamPledges || [pledge]).some(item => groupForPledge(item).key === groupKey)
}

function normalizedTitle(pledge) {
  return String(pledge.title || '').replace(/\s+/g, '').toLowerCase()
}

function groupForPledge(pledge) {
  const category = inferPledgeCategory(pledge)
  return SUPPORT_GROUPS.find(group => group.key === category.key) || SUPPORT_GROUPS[SUPPORT_GROUPS.length - 1]
}

function matchLevel(pledge, myPledges) {
  const teamPledges = pledge.teamPledges || [pledge]
  if (teamPledges.some(teamPledge => {
    const group = groupForPledge(teamPledge).key
    const tag = inferPledgeTag(teamPledge)
    return tag && myPledges.some(p => groupForPledge(p).key === group && inferPledgeTag(p) === tag)
  })) return 1
  if (teamPledges.some(teamPledge => myPledges.some(p => groupForPledge(p).key === groupForPledge(teamPledge).key))) return 2
  return 3
}

function groupStats(groupKey, pledges, joinedIds) {
  const items = pledges.filter(p => teamHasGroup(p, groupKey))
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
  const shortName = group.name.replace('互助会', '')
  return (
    <button style={{ ...S.groupPill, ...(active ? S.groupPillOn : {}) }} onClick={onClick}>
      <span style={S.groupPillEmoji}>{group.emoji}</span>
      <span style={S.groupPillName}>{shortName}</span>
      <span style={S.groupPillMeta}>{stats.open}可加</span>
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
          <div style={S.meta}>{group.name} · {inferPledgeTag(pledge)} · 已落印 {pledge.checkin_count || 0}/{pledge.total_days || 0} 天 · 还差{daysLeft(pledge)}天</div>
        </div>
        <Tag tone={isRecruiting ? 'green' : 'gold'}>{isRecruiting ? '招募中' : '未招募'}</Tag>
      </div>

      <div style={S.teamLine}>
        <span>5人同践小队 {teamSize(pledge)}/{TEAM_LIMIT}</span>
        <span>{slots > 0 ? '还可加入' + slots + '人' : '已满员'}</span>
      </div>
      <div style={S.track}><div style={{ ...S.fill, width: progress + '%' }} /></div>

      <div style={S.cardFoot}>
        <span>{progress}% · {isRecruiting ? '可进入小队管理' : '发布后可被同诺者加入小队'}</span>
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
  const label = joined ? '已加入' : match === 1 ? '同类诺言' : match === 2 ? '同互助会' : '可加入'
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div style={S.emoji}>{group.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle}>{pledge.title}</div>
          <div style={S.meta}>{getHostName(pledge)}发起 · {group.name} · 已落印 {pledge.checkin_count || countFromRelation(pledge.checkins)}/{pledge.total_days || 0} 天</div>
        </div>
        <Tag tone={tone}>{label}</Tag>
      </div>

      <div style={S.teamLine}>
        <span>5人同践小队 {teamSize(pledge)}/{TEAM_LIMIT}</span>
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
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

function checkedToday(pledge) {
  const today = todayKey()
  return (pledge.checkins || []).some(item => {
    const date = item?.checkin_date || item?.created_at || item?.date
    return typeof date === 'string' && date.slice(0, 10) === today
  })
}


function memberCheckinLine(member, index) {
  if (member.empty) return '这里还空着，等一个同诺者坐下。'
  if (member.doneToday) {
    const lines = ['今天已落印：我守住了这一日。', '今日已落印：先把该做的做完。', '已完成今日诺言，给后来的人留一盏灯。']
    return lines[index % lines.length]
  }
  const lines = ['今日待落印，可能正在和拖延拉扯。', '今日待落印，等一句提醒把他拉回来。', '还没出现，也许需要有人说一句：别一个人扛。']
  return lines[index % lines.length]
}

function getBuddy(activeMembers, currentUserId) {
  const candidates = activeMembers.filter(member => member.id !== currentUserId)
  if (!candidates.length) return null
  return candidates.find(member => !member.doneToday) || candidates[0]
}

function buildRoomMembers(pledge) {
  const knownByUser = pledge.knownPledgesByUser || {}
  const active = (pledge.witnesses || []).filter(item => !item.status || item.status === 'active').slice(0, TEAM_LIMIT - 1)
  const ownerStats = aggregatePledges(pledge.teamPledges || knownByUser[pledge.user_id], pledge)
  const owner = {
    id: pledge.user_id || 'owner',
    name: getHostName(pledge),
    role: '团长',
    progress: ownerStats.progress,
    doneToday: ownerStats.doneToday,
    note: ownerStats.doneToday ? '今日已落印' : '今日待落印',
    statText: ownerStats.done + '/' + ownerStats.total + ' 天',
  }
  const friends = active.map((item, index) => {
    const id = item.user_id || item.id || 'friend-' + index
    const stats = aggregatePledges(knownByUser[id], null)
    return {
      id,
      name: item.profiles?.nickname || '同行者' + (index + 1),
      role: '团友',
      progress: stats.total ? stats.progress : Math.max(0, Math.min(100, pct(pledge) - 8 - index * 7)),
      doneToday: stats.total ? stats.doneToday : false,
      note: stats.total ? (stats.doneToday ? '今日已落印' : '今日待落印') : '已入队，等待同步打卡数据',
      statText: stats.total ? stats.done + '/' + stats.total + ' 天' : '暂无公开誓言数据',
    }
  })
  const empty = Array.from({ length: Math.max(TEAM_LIMIT - 1 - friends.length, 0) }, (_, index) => ({
    id: 'empty-' + index,
    empty: true,
    name: '空位',
    role: '待加入',
    progress: 0,
    note: '可邀请同诺者加入',
  }))
  return [owner, ...friends, ...empty].slice(0, TEAM_LIMIT)
}

function HelpGroupPill({ group, active, stats, onClick }) {
  return (
    <button style={{ ...S.helpPill, ...(active ? S.helpPillOn : {}) }} onClick={onClick}>
      <div style={S.helpPillEmoji}>{group.emoji}</div>
      <div style={{ minWidth: 0 }}>
        <div style={S.helpPillName}>{group.name.replace('互助会', '')}</div>
        <div style={S.helpPillMeta}>{stats.open}支可加入</div>
      </div>
    </button>
  )
}

function HelpTeamCard({ pledge, joined, joining, match, onOpen, onJoin }) {
  const group = groupForPledge(pledge)
  const progress = pct(pledge)
  const slots = teamSlots(pledge)
  const full = slots <= 0
  const label = joined ? '已在团中' : match === 1 ? '同类诺言' : match === 2 ? '同互助会' : '可加入'
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
  if (match === 1) return '同类诺言 · ' + tag
  if (match === 2) return '同属' + group.name.replace('互助会', '')
  return '按行者推荐，可先观察'
}

function TodayTeamStatus({ featuredTeam, totalTeams, pendingCount, joinedCount, onPrimary }) {
  const hasTeam = !!featuredTeam
  const pledge = featuredTeam?.pledge
  const members = hasTeam ? buildRoomMembers(pledge).filter(member => !member.empty) : []
  const teamCount = Math.max(members.length, hasTeam ? 1 : 0)
  const doneCount = hasTeam ? members.filter(member => member.doneToday).length : 0
  const userDone = hasTeam ? checkedToday(pledge) : false
  const statusText = !hasTeam
    ? '先求同行，再进小队。让今天的诺言有人看见、有人回应。'
    : userDone
      ? `你已完成今日落印，小队当前 ${doneCount}/${teamCount} 已落印。`
      : `小队当前 ${doneCount}/${teamCount} 已落印，进去给队友留一笺。`
  const feedback = !hasTeam
    ? '从“求同行”进来，先找到愿意和你一起落印的人。'
    : doneCount >= teamCount
      ? '五印齐成。今天不是排名，而是彼此没有掉队。'
      : doneCount > 0
        ? '有人先落印了。看见节奏，也把自己的这一笔补上。'
        : '还没人先落印。你可以成为今天的执笔人。'
  return (
    <div style={S.todayStatusCard}>
      <div style={S.todayStatusHead}>
        <div style={S.todayIcon}>{userDone ? '✓' : hasTeam ? '!' : '+'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.todayTitle}>今日共践</div>
          <div style={S.todayText}>{statusText}</div>
        </div>
        <button style={S.primaryTeamBtnSmall} onClick={onPrimary}>{hasTeam ? '进入小队' : '求同行'}</button>
      </div>
      <div style={S.todayMetaRow}>
        <span>{feedback}</span>
        <span>{hasTeam ? '同践 ' + teamCount + ' 人' : totalTeams + ' 支小队等待相遇'}</span>
      </div>
    </div>
  )
}

function CheckinPrompt({ done, lateDays, onClick }) {
  return (
    <button style={S.promptCard} onClick={onClick}>
      <div style={S.promptIcon}>☀️</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={S.promptTitle}>{done ? '今天已落印' : '早安！今天还没打卡'}</div>
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
    ? '今日全员已落印，节奏很好'
    : doneCount > 0
      ? `${doneCount}位队友已落印，队伍正在向前`
      : '今天还没人守诺，等一个人先动起来'
  return (
    <div style={S.teamCardLarge}>
      <div style={S.teamCardHead}>
        <div style={S.teamEmoji}>{group.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.teamTitle}>{pledge.title}</div>
          <div style={S.teamSub}>守诺季进行中 · {teamSize(pledge)}人同践 · 今日{doneCount}/{teamCount}已落印</div>
        </div>
        <Tag tone={doneCount >= teamCount ? 'green' : isOwned && !pledge.is_public ? 'gold' : 'blue'}>{doneCount >= teamCount ? '五印齐成' : isOwned && !pledge.is_public ? '招募中' : '同践中'}</Tag>
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

      <div style={S.teamRecordRow}>
        <span>同践纪录</span>
        <b>{doneCount >= teamCount ? '五印齐成' : feedback}</b>
      </div>
      <div style={S.teamActionsRow}>
        <button style={S.primaryTeamBtn} onClick={onRoom}>进入同践</button>
      </div>
      {isOwned && !pledge.is_public && <button style={S.recruitWideBtn} onClick={onRecruit} disabled={publishing}>{publishing ? '发布中' : '发布同践招募'}</button>}
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
          <div style={S.teamSub}>独践中 · 还差{daysLeft(pledge)}天</div>
        </div>
        <Tag tone="gold">招募中</Tag>
      </div>
      <div style={S.soloHint}>👥 还没有同行者，发出招募让人陪你走完最后{daysLeft(pledge)}天</div>
      <button style={S.recruitWideBtn} onClick={pledge.is_public ? onRoom : onRecruit} disabled={publishing}>{pledge.is_public ? '进入小队' : publishing ? '发布中' : '发布同践招募'}</button>
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
  const todayLabel = checkedToday(pledge) ? '今日已落印' : '今日待回应'
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
        <div style={S.memberHint}>{member.note} · 打卡 {member.statText || member.progress + '%'}</div>
        <div style={S.miniTrack}><div style={{ ...S.miniFill, width: member.progress + '%' }} /></div>
      </div>
      <Tag tone={member.doneToday ? 'green' : 'red'}>{member.doneToday ? '已落印' : '待落印'}</Tag>
    </div>
  )
}


function PushNotice({ state, busy, onEnable }) {
  if (state.subscribed || state.checking) return null
  const unsupported = state.reason === 'unsupported'
  const blocked = state.permission === 'denied'
  return (
    <div style={S.pushNotice}>
      <div style={S.pushCopy}>
        <b>{blocked ? '手机提醒被系统拦截' : unsupported ? '当前浏览器不支持手机提醒' : '同行手机提醒未开启'}</b>
        <span>{blocked ? '请在浏览器或手机设置里允许通知，否则队友提醒只能进消息中心。' : unsupported ? '手机顶部通知需要支持推送的浏览器；iPhone 需先把网页添加到主屏幕。' : '开启后，队友的陪他完成和鼓励会尝试出现在手机通知栏。'}</span>
      </div>
      {!unsupported && !blocked && <button style={S.pushBtn} onClick={onEnable} disabled={busy}>{busy ? '开启中' : '开启'}</button>}
    </div>
  )
}

function TeamRoom({ pledge, loading, error, toast, currentUserId, onBack, onNudge, onEncourage, onHelp }) {
  const group = groupForPledge(pledge)
  const members = buildRoomMembers(pledge)
  const activeMembers = members.filter(item => !item.empty)
  const doneCount = activeMembers.filter(item => item.doneToday).length
  const pendingCount = Math.max(activeMembers.length - doneCount, 0)
  const progress = pct(pledge)
  const buddy = getBuddy(activeMembers, currentUserId)
  const selfMember = activeMembers.find(item => item.id === currentUserId)
  const sortedMembers = [...activeMembers].sort((a, b) => {
    if (a.doneToday !== b.doneToday) return a.doneToday ? -1 : 1
    return (b.progress || 0) - (a.progress || 0)
  })
  const topMember = sortedMembers[0]
  const teamMood = doneCount === 0
    ? '今天还没人先迈步。谁先守住，谁就把小队拉回正轨。'
    : doneCount === activeMembers.length
      ? '今天五印齐成，队伍节奏很稳。'
      : doneCount + '位队友已经落印，还差' + pendingCount + '位。'
  const [showNudgeBox, setShowNudgeBox] = useState(false)
  const [showEncourageBox, setShowEncourageBox] = useState(false)
  const [nudgeDraft, setNudgeDraft] = useState('今天还没守诺，我在小队等你。')
  function sendNudgeMessage() {
    if (!buddy) return onEncourage?.('empty')
    const message = nudgeDraft.trim().slice(0, 50) || '今天还没守诺，我在小队等你。'
    setShowNudgeBox(false)
    onNudge?.(buddy, message)
  }
  function sendEcho(member, label) {
    if (!member || member.empty) return
    if (member.id === currentUserId) return onEncourage?.('self', member)
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
          <div style={S.roomTitle}>{getHostName(pledge)}的小队</div>
          <div style={S.roomMeta}>守诺季进行中 · {getHostName(pledge)}发起 · 5人同践 {teamSize(pledge)}/{TEAM_LIMIT}</div>
          <div style={S.roomStats}>
            <div><b>{doneCount}/{activeMembers.length || 1}</b><span>今日已落印</span></div>
            <div><b>{progress}%</b><span>契约进度</span></div>
            <div><b>{teamSlots(pledge)}</b><span>剩余席位</span></div>
          </div>
        </div>

        <div style={S.buddyCard}>
          <div style={S.buddyTop}>
            <div style={S.buddyIcon}>☕</div>
            <div style={{ flex: 1 }}>
              <div style={S.buddyTitle}>{buddy ? '今日留笺：' + buddy.name : '今日留笺：暂无其他团友'}</div>
              <div style={S.buddyText}>{buddy ? (buddy.doneToday ? 'TA已经落印。你可以留笺回应，让守诺被看见。' : 'TA今天还没落印。轻轻留一笺，比沉默更有力量。') : '留笺对象只能是其他用户。等有人加入小队后，这里才会出现真正的同行。'}</div>
            </div>
            {buddy && <Tag tone={buddy.doneToday ? 'green' : 'red'}>{buddy.doneToday ? '已落印' : '待落印'}</Tag>}
          </div>
          <div style={S.buddyActions}>
            <button style={S.buddyBtn} onClick={() => buddy ? setShowEncourageBox(v => !v) : onEncourage?.('empty')} disabled={!buddy}>留笺</button>
            <button style={S.buddyBtnDark} onClick={() => buddy ? setShowNudgeBox(v => !v) : onEncourage?.('empty')} disabled={!buddy}>陪他完成</button>
          </div>
          {showNudgeBox && (
            <div style={S.inlinePanel}>
              <div style={S.inlinePanelTitle}>提醒{buddy?.name || '今日搭子'}</div>
              <textarea style={S.messageInput} maxLength={50} value={nudgeDraft} onChange={e => setNudgeDraft(e.target.value.slice(0, 50))} placeholder="写一句不超过50字的落印提醒" />
              <div style={S.panelFoot}>
                <span style={S.charCount}>{nudgeDraft.length}/50</span>
                <div style={S.panelActions}>
                  <button style={S.panelCancelBtn} onClick={() => setShowNudgeBox(false)}>取消</button>
                  <button style={S.panelSendBtn} onClick={sendNudgeMessage}>送出提醒</button>
                </div>
              </div>
            </div>
          )}
          {showEncourageBox && (
            <div style={S.inlinePanel}>
              <div style={S.inlinePanelTitle}>给{buddy?.name || '同行'}留一笺</div>
              <div style={S.choiceGrid}>
                {ENCOURAGE_CHOICES.map(label => <button key={label} style={S.choiceBtn} onClick={() => { setShowEncourageBox(false); sendEcho(buddy, label) }}>{label}</button>)}
              </div>
            </div>
          )}
        </div>

        <div style={S.panelCard}>
          <div style={S.meetingTitle}>同践纪录</div>
          <div style={S.meetingSub}>{teamMood}</div>
          <div style={S.compareRow}><span>我的状态</span><b>{selfMember?.doneToday ? '今日已落印' : '今日待落印'}</b></div>
          <div style={S.compareRow}><span>领跑队友</span><b>{topMember ? topMember.name : '暂无'}</b></div>
          <div style={S.compareRow}><span>今天的节奏</span><b>{pendingCount > 0 ? pendingCount + '人待落印' : '全员跟上'}</b></div>
          <div style={S.compareRow}><span>修诺入口</span><b>{selfMember?.doneToday ? '无需修诺' : '落后一笔，也可以回来补上'}</b></div>
          <div style={S.compareHint}>这里不是排名榜。看见差距，是为了把自己带回节奏；队友的回应，则让这件事不必一个人扛。</div>
        </div>

        <div style={S.sectionLabel}>队友进度对比</div>
        <div style={S.panelCard}>
          {sortedMembers.map((member, index) => {
            const isSelf = member.id === currentUserId
            return (
              <div key={member.id} style={S.memberRow}>
                <div style={{ ...S.memberAvatar, background: member.doneToday ? C.green : C.gold }}>{index + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.memberName}>{member.name}<span>{isSelf ? '我' : member.role}</span></div>
                  <div style={S.memberHint}>{memberCheckinLine(member, index)} · 完成度 {member.progress}%</div>
                  <div style={S.miniTrack}><div style={{ ...S.miniFill, width: member.progress + '%', background: member.doneToday ? C.green : C.gold }} /></div>
                </div>
                <Tag tone={member.doneToday ? 'green' : 'red'}>{member.doneToday ? '已落印' : '待落印'}</Tag>
              </div>
            )
          })}
          {members.filter(item => item.empty).map(member => (
            <div key={member.id} style={{ ...S.memberRow, opacity: .62 }}>
              <div style={{ ...S.memberAvatar, background: C.soft, color: C.hint }}>+</div>
              <div style={{ flex: 1 }}>
                <div style={S.memberName}>{member.name}<span>{member.role}</span></div>
                <div style={S.memberHint}>空位留给下一位同行者</div>
              </div>
              <Tag tone="gold">空位</Tag>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


function TodayActionPage({ featuredTeam, currentUserId, onOpenTeam, onCheckin, onSendNote, onFindCompanion, nav }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [note, setNote] = useState('')
  const [needOpen, setNeedOpen] = useState(false)
  const [need, setNeed] = useState('陪我专注 15 分钟')
  const [repairOpen, setRepairOpen] = useState(false)

  const pledge = featuredTeam?.pledge
  const members = pledge ? buildRoomMembers(pledge).filter(member => !member.empty) : []
  const me = members.find(member => member.id === currentUserId)
  const doneCount = members.filter(member => member.doneToday).length
  const teamSizeNow = Math.max(members.length, pledge ? teamSize(pledge) : 0, 1)
  const selfDone = pledge ? checkedToday(pledge) : false
  const isRepairing = pledge && ['failed', 'broken', 'expired'].includes(String(pledge.status || '').toLowerCase())
  const target = members.find(member => member.id !== currentUserId && !member.doneToday) || members.find(member => member.id !== currentUserId)
  const progress = pledge ? pct(pledge) : 0
  const leadPercent = Math.min(86, Math.max(18, Math.round(progress * .7 + doneCount * 9)))
  const peopleAhead = Math.max(1, Math.round((100 - leadPercent) / 5))
  const sealsComplete = doneCount >= Math.min(TEAM_LIMIT, teamSizeNow) && teamSizeNow > 1
  const primaryLabel = isRepairing ? '修诺' : selfDone ? '留笺给同行' : '去践诺'
  const teammateName = target?.name || '同行者'
  const noteOptions = ['我先做到了，你也来。', '今天别拼状态，先开始。', '我刚刚也卡住了。', '明天我陪你一起修。']
  const needOptions = ['陪我专注 15 分钟', '我不知道怎么继续', '陪我完成一次修诺', '给我一次外部监督']

  async function submitNote() {
    const text = note.trim()
    if (!target) return
    await onSendNote(target, text || '我先做到了，你也来。')
    setNote('')
    setComposerOpen(false)
  }

  function primaryAction() {
    if (!pledge) return nav('/new')
    if (isRepairing) return setRepairOpen(value => !value)
    if (selfDone) return setComposerOpen(value => !value)
    onCheckin(pledge)
  }

  return (
    <div style={S.actionPage}>
      {!pledge ? (
        <div style={S.actionEmpty}>
          <div style={S.actionEyebrow}>同行从一份誓言开始</div>
          <div style={S.actionEmptyTitle}>先写下今天愿意守住的事</div>
          <div style={S.actionEmptyText}>当你有了正在践行的诺言，才会遇见愿意同行的人。</div>
          <button style={S.actionPrimary} onClick={() => nav('/new')}>立下一誓</button>
        </div>
      ) : (
        <>
          <section style={S.coPracticeHero}>
            <div style={S.coPracticeTop}>
              <div>
                <div style={S.actionEyebrow}>今日共践</div>
                <div style={S.coPracticeCount}>{doneCount}<span> / {teamSizeNow} 人已落印</span></div>
              </div>
              <div style={{ ...S.sealBadge, ...(sealsComplete ? S.sealBadgeFull : {}) }}>{sealsComplete ? '五印齐成' : '共践中'}</div>
            </div>

            <div style={S.coPracticeQuote}>
              <span style={S.quoteMark}>“</span>
              {selfDone ? '你已落印，留一句话让同行者知道你在。' : (doneCount ? teammateName + ' 已先一步落印。今天，你也值得把这一印落下。' : '今天还没有人先落印。你可以成为把队伍带回正轨的人。')}
            </div>

            <button style={S.coPracticeMainAction} onClick={primaryAction}>{primaryLabel}</button>

            <button style={S.sealRow} onClick={() => onOpenTeam(pledge)} aria-label="查看同行小队">
              {members.slice(0, TEAM_LIMIT).map(member => (
                <span key={member.id} style={{ ...S.memberSeal, ...(member.doneToday ? S.memberSealDone : {}), ...(member.id === currentUserId ? S.memberSealSelf : {}) }}>
                  {member.name?.slice(0, 1) || '行'}
                </span>
              ))}
              {Array.from({ length: Math.max(0, TEAM_LIMIT - members.length) }).map((_, index) => <span key={'empty-' + index} style={S.memberSealEmpty}>○</span>)}
              <span style={S.teamLink}>查看同行小队 ›</span>
            </button>

            {composerOpen && (
              <div style={S.noteComposer}>
                <div style={S.noteComposerTitle}>留笺给 {teammateName}</div>
                <div style={S.quickNotes}>
                  {noteOptions.map(option => <button key={option} style={S.quickNote} onClick={() => setNote(option)}>{option}</button>)}
                </div>
                <textarea value={note} maxLength={50} onChange={event => setNote(event.target.value)} placeholder="写一句给同行者的话，50 字以内" style={S.noteInput} />
                <div style={S.composerFoot}>
                  <span>{note.length}/50</span>
                  <button style={S.noteSendBtn} onClick={submitNote}>落笺发送</button>
                </div>
              </div>
            )}

            {repairOpen && (
              <div style={S.repairPanel}>
                <div style={S.repairTitle}>今日未能落印，但仍可修诺</div>
                <div style={S.repairText}>选一件此刻能兑现的补救行动，让同行者看见你没有离场。</div>
                <div style={S.repairChoices}>
                  <button style={S.repairChoice} onClick={() => { setRepairOpen(false); setComposerOpen(true); setNote('我会在明早 7:30 补做，欢迎陪我完成。') }}>明早补做</button>
                  <button style={S.repairChoice} onClick={() => { setRepairOpen(false); setNeedOpen(true); setNeed('陪我完成一次修诺') }}>现在陪修</button>
                </div>
              </div>
            )}
          </section>

          <section style={S.referenceLine}>
            <div>
              <div style={S.referenceTitle}>同诺行列</div>
              <div style={S.referenceMain}>你领先 {leadPercent}% 的同诺者</div>
              <div style={S.referenceHint}>今天已有 {peopleAhead} 人走在你前面</div>
            </div>
            <button style={S.referenceLink} onClick={() => onOpenTeam(pledge)}>看队伍 ›</button>
          </section>

          <section style={S.findCompanion}>
            <button style={S.findCompanionHeader} onClick={() => setNeedOpen(value => !value)}>
              <span>
                <span style={S.findCompanionTitle}>求同行</span>
                <span style={S.findCompanionHint}>卡住时，找一个人陪你把下一步做完。</span>
              </span>
              <span style={S.findCompanionArrow}>{needOpen ? '⌃' : '›'}</span>
            </button>
            {needOpen && (
              <div style={S.needBody}>
                <div style={S.needOptions}>
                  {needOptions.map(option => <button key={option} style={{ ...S.needOption, ...(need === option ? S.needOptionOn : {}) }} onClick={() => setNeed(option)}>{option}</button>)}
                </div>
                <button style={S.needSubmit} onClick={() => onFindCompanion(need)}>查看可同行的小队</button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default function CompanionsPage() {
  const { session, profile } = useAuth()
  const nav = useNavigate()
  const [companionView, setCompanionView] = useState('teams')
  const [showAllTeams, setShowAllTeams] = useState(false)
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
  const [pushState, setPushState] = useState({ checking: true, subscribed: false, permission: 'default' })
  const [pushBusy, setPushBusy] = useState(false)

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

  useEffect(() => {
    let alive = true
    async function checkPush() {
      if (!session?.user?.id) {
        setPushState({ checking: false, subscribed: false, permission: 'default' })
        return
      }
      if (!canUsePushNotifications()) {
        setPushState({ checking: false, subscribed: false, reason: 'unsupported', permission: 'default' })
        return
      }
      try {
        const status = await getPushSubscriptionStatus(session.user.id)
        if (!alive) return
        setPushState({ checking: false, subscribed: !!status.subscribed, ready: status.ready, permission: Notification.permission })
      } catch {
        if (alive) setPushState({ checking: false, subscribed: false, reason: 'check_failed', permission: Notification.permission })
      }
    }
    checkPush()
    return () => { alive = false }
  }, [session?.user?.id])

  async function enablePushReminders() {
    if (!session?.user?.id) return nav('/auth')
    if (!canUsePushNotifications()) {
      showToast('当前浏览器暂不支持手机推送；iPhone 请先添加到主屏幕')
      return
    }
    if (!VAPID_PUBLIC_KEY) {
      showToast('推送密钥还未配置，暂时只能进入消息中心')
      return
    }
    setPushBusy(true)
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushState({ checking: false, subscribed: false, permission })
        showToast('未开启通知权限，队友提醒仍会进入消息中心')
        return
      }
      const registration = await getServiceWorkerRegistration()
      if (!registration?.pushManager) throw new Error('当前浏览器没有推送能力')
      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      const saved = await savePushSubscription(session.user.id, subscription, navigator.userAgent || '')
      if (!saved.saved) {
        showToast(saved.reason === 'missing_table' ? '推送订阅表未启用，请先执行数据库 SQL' : '通知订阅保存失败')
        setPushState({ checking: false, subscribed: false, permission })
        return
      }
      setPushState({ checking: false, subscribed: true, ready: true, permission })
      showToast('已开启同行手机提醒')
    } catch (err) {
      showToast(err.message || '开启手机提醒失败')
      setPushState({ checking: false, subscribed: false, reason: 'save_failed', permission: Notification.permission })
    } finally {
      setPushBusy(false)
    }
  }


  async function handleRecruit(pledge) {
    if (!session?.user?.id) return nav('/auth')
    setPublishingId(pledge.id)
    try {
      const updated = await publishCompanionRecruit(pledge.id, session.user.id)
      setMyPledges(list => list.map(item => item.id === pledge.id ? { ...item, ...updated, is_public: true } : item))
      showToast('已发布到互助会，最多5人同践')
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
    const knownPledgesByUser = indexPledgesByUser([...publicPledges, ...myPledges, ...(pledge.teamPledges || [pledge])])
    setRoomPledge({ ...pledge, knownPledgesByUser })
    setRoomLoading(true)
    setRoomError('')
    try {
      const detail = await getPledgeDetail(pledge.id)
      const fallbackWitnesses = detail?.witnesses?.length ? detail.witnesses : pledge.witnesses
      const fallbackCheckins = detail?.checkins?.length ? detail.checkins : pledge.checkins
      const baseHostPledges = knownPledgesByUser[pledge.user_id] || pledge.teamPledges || [pledge]
      const hostPledges = await Promise.all(baseHostPledges.map(async item => {
        if (item.id === pledge.id) return { ...item, ...(detail || {}), checkins: fallbackCheckins }
        try {
          const itemDetail = await getPledgeDetail(item.id)
          return { ...item, ...(itemDetail || {}), checkins: itemDetail?.checkins || item.checkins }
        } catch {
          return item
        }
      }))
      const activeWitnesses = (fallbackWitnesses || []).filter(item => !item.status || item.status === 'active')
      const memberUserIds = [...new Set(activeWitnesses.map(item => item.user_id).filter(Boolean))]
      const memberEntries = await Promise.all(memberUserIds.map(async userId => {
        try {
          const pledges = await getUserCompanionPledges(userId)
          return [userId, pledges]
        } catch {
          return [userId, knownPledgesByUser[userId] || []]
        }
      }))
      const memberPledgesByUser = memberEntries.reduce((map, [userId, pledges]) => {
        if (userId && pledges?.length) map[userId] = pledges
        return map
      }, {})
      const enrichedKnownPledgesByUser = { ...knownPledgesByUser, ...memberPledgesByUser, [pledge.user_id]: hostPledges }
      setRoomPledge({ ...pledge, ...(detail || {}), witnesses: fallbackWitnesses, checkins: fallbackCheckins, teamPledges: hostPledges, knownPledgesByUser: enrichedKnownPledgesByUser })
    } catch (err) {
      setRoomError(err.message || '小队加载失败')
    } finally {
      setRoomLoading(false)
    }
  }

  async function sendCompanionNotification(member, kind, label) {
    if (!session?.user?.id) return nav('/auth')
    if (!member || member.empty) return showToast('暂无其他团友可通知')
    if (member.id === session.user.id) return showToast('不能给自己发送小队通知')
    const title = kind === 'nudge' ? '同行团友提醒你守诺' : '同行团友给了你回应'
    const body = kind === 'nudge'
      ? '有人在「' + (roomPledge?.title || '小队') + '」里提醒你：' + (label || '今天别一个人扛。')
      : '有人在「' + (roomPledge?.title || '小队') + '」里对你说：' + label
    try {
      const result = await sendUserNotification({
        userId: member.id,
        actorId: session.user.id,
        pledgeId: roomPledge?.id,
        type: kind === 'nudge' ? 'companion_nudge' : 'companion_echo',
        title,
        body,
        metadata: { label, teamTitle: roomPledge?.title || '', url: '/companions' },
        url: '/companions'
      })
      showToast(result.delivered ? '已送达' + member.name + (result.pushed ? '，会尝试弹到手机' : '的消息中心；对方未开启手机提醒') : '消息中心通知表未启用，请先执行数据库 SQL')
    } catch (err) {
      showToast(err.message || '通知发送失败')
    }
  }

  const displayName = profile?.nickname || '行者'
  const publicTeams = useMemo(() => groupPledgesByUser(publicPledges), [publicPledges])
  const recommended = useMemo(() => {
    return [...publicTeams].sort((a, b) => {
      const am = matchLevel(a, myPledges)
      const bm = matchLevel(b, myPledges)
      if (am !== bm) return am - bm
      if (joinedIds.has(a.id) !== joinedIds.has(b.id)) return joinedIds.has(a.id) ? -1 : 1
      return teamSlots(b) - teamSlots(a)
    })
  }, [publicTeams, myPledges, joinedIds])
  const joinedTeams = recommended.filter(p => joinedIds.has(p.id))
  const myOwnedTeams = useMemo(() => groupPledgesByUser(myPledges), [myPledges])
  const activeGroupPledges = recommended.filter(p => teamHasGroup(p, activeGroup))
  const activeSupportGroup = SUPPORT_GROUPS.find(g => g.key === activeGroup) || SUPPORT_GROUPS[0]
  const activeGroupOpenTeams = activeGroupPledges.filter(p => !joinedIds.has(p.id) && teamSlots(p) > 0)
  const activeGroupJoinedTeams = activeGroupPledges.filter(p => joinedIds.has(p.id))
  function handleAutoMatchActiveGroup() {
    const target = [...activeGroupOpenTeams].sort((a, b) => matchLevel(a, myPledges) - matchLevel(b, myPledges) || teamSlots(b) - teamSlots(a))[0]
    if (!target) {
      showToast('这个互助会暂时没有可加入小队，可以先发布自己的招募')
      return
    }
    openRoom(target)
  }
  const suggestedForMy = recommended.filter(p => !joinedIds.has(p.id) && matchLevel(p, myPledges) <= 1 && teamSlots(p) > 0).slice(0, 3)
  const ownedMemberCount = myPledges.reduce((sum, p) => sum + teamSize(p), 0)
  const myTeamItemsRaw = [
    ...myOwnedTeams.map(pledge => ({ key: 'owned-' + userTeamKey(pledge), role: 'owned', pledge })),
    ...joinedTeams.map(pledge => ({ key: 'joined-' + userTeamKey(pledge), role: 'joined', pledge })),
  ]
  const myTeamItems = myTeamItemsRaw
  const allTeamCount = myOwnedTeams.length + joinedTeams.length
  const activeTeamItems = myTeamItems.filter(item => item.role === 'joined' || teamSize(item.pledge) > 1 || item.pledge.is_public)
  const featuredTeam = activeTeamItems[0] || myTeamItems[0]
  const otherTeamItems = myTeamItems.filter(item => item.key !== featuredTeam?.key)
  const visibleOtherTeams = showAllTeams ? otherTeamItems : otherTeamItems.slice(0, 2)
  const pendingTodayCount = myPledges.filter(p => !checkedToday(p)).length
  const suggestedOpenCount = recommended.filter(p => !joinedIds.has(p.id) && teamSlots(p) > 0).length

  if (roomPledge) {
    return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.topbar}>
        <div style={S.logo}>同<em style={{ color: C.gold, fontStyle: 'normal' }}>行</em></div>
        <div style={{ width: 52 }} />
      </div>

      {loading && <div style={S.stateText}>正在加载今日共践...</div>}
      {!loading && error && <div style={S.stateText}>{error}</div>}

      {!loading && !error && (
        <TodayActionPage
          featuredTeam={featuredTeam}
          currentUserId={session?.user?.id}
          nav={nav}
          onOpenTeam={openRoom}
          onCheckin={pledge => nav('/pledge/' + pledge.id + '/checkin')}
          onSendNote={(member, text) => sendCompanionNotification(member, 'echo', text)}
          onFindCompanion={need => {
            const target = recommended.find(item => !joinedIds.has(item.id) && teamSlots(item) > 0)
            if (!target) return showToast('暂时没有可响应的小队，晚些再来看看。')
            showToast('已按“' + need + '”为你筛出可同行的小队')
            openRoom(target)
          }}
        />
      )}
    </div>
  )
}

const S = {
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(14px + env(safe-area-inset-top)) 16px 12px', background: C.bg, borderBottom: '1px solid ' + C.border, flexShrink: 0 },
  logo: { fontFamily: 'Noto Serif SC,serif', fontSize: 20, fontWeight: 900, color: C.ink, letterSpacing: .5 },
  messageBtn: { border:'1px solid ' + C.border, background:C.surf, color:C.goldD, borderRadius:999, padding:'7px 12px', fontSize:12, fontWeight:900, fontFamily:'Noto Sans SC,sans-serif' },
  tabBar: { display: 'flex', borderBottom: '1px solid ' + C.border, background: C.bg, flexShrink: 0 },
  viewTabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, marginBottom: 14, background: C.soft, border: '1px solid ' + C.border, borderRadius: 12 },
  viewTab: { border: 'none', background: 'transparent', color: C.muted, borderRadius: 9, padding: '9px 8px', fontSize: 13, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  viewTabOn: { background: C.surf, color: C.ink, boxShadow: '0 1px 5px rgba(26,18,8,.10)' },
  tabBtn: { flex: 1, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: C.muted, borderBottom: '2px solid transparent', fontFamily: 'Noto Sans SC,sans-serif' },
  tabBtnOn: { color: C.gold, borderBottom: '2px solid ' + C.gold, fontWeight: 800 },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '14px 16px' },
  stateText: { padding: '28px 16px', textAlign: 'center', color: C.muted, fontSize: 13 },

  actionPage: { flex: 1, overflowY: 'auto', padding: '18px 16px 28px' },
  actionEmpty: { marginTop: 34, padding: '30px 22px', border: '1px solid ' + C.border, borderRadius: 18, background: C.surf, textAlign: 'center', boxShadow: '0 8px 24px rgba(34,22,8,.05)' },
  actionEmptyTitle: { marginTop: 8, color: C.ink, fontFamily: 'Noto Serif SC,serif', fontSize: 24, fontWeight: 900 },
  actionEmptyText: { margin: '11px 0 22px', color: C.muted, fontSize: 13, lineHeight: 1.7 },
  actionPrimary: { border: 'none', borderRadius: 999, background: C.ink, color: '#F6D486', padding: '12px 25px', fontSize: 14, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },
  coPracticeHero: { padding: 18, borderRadius: 18, background: 'linear-gradient(135deg,#211308 0%,#573214 100%)', color: '#FFF8E9', boxShadow: '0 10px 26px rgba(51,28,8,.16)' },
  coPracticeTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  actionEyebrow: { color: C.gold, fontSize: 12, fontWeight: 900, letterSpacing: 1.2 },
  coPracticeCount: { marginTop: 7, color: '#FFF9EB', fontFamily: 'Noto Serif SC,serif', fontSize: 27, fontWeight: 900 },
  sealBadge: { border: '1px solid rgba(240,192,89,.45)', background: 'rgba(207,151,39,.22)', color: '#F7D875', borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' },
  sealBadgeFull: { background: 'rgba(76,152,96,.3)', borderColor: 'rgba(164,222,167,.5)', color: '#D7F0D4' },
  coPracticeQuote: { margin: '17px 0 15px', minHeight: 44, padding: '10px 0 0', borderTop: '1px solid rgba(255,245,218,.16)', color: '#E7D3B0', fontSize: 14, lineHeight: 1.6 },
  quoteMark: { color: C.gold, fontSize: 21, fontFamily: 'Noto Serif SC,serif', marginRight: 4 },
  coPracticeMainAction: { width: '100%', border: '1px solid #E9BA51', borderRadius: 999, padding: '12px 14px', background: '#F5D377', color: '#32200C', fontSize: 15, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55)' },
  sealRow: { width: '100%', marginTop: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#F9E5B6', fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', textAlign: 'left' },
  memberSeal: { width: 29, height: 29, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(255,241,204,.35)', background: 'rgba(255,255,255,.10)', color: '#E5CFA1', fontSize: 12, fontWeight: 900, flexShrink: 0 },
  memberSealDone: { background: '#D9A62C', borderColor: '#F4D778', color: '#392108' },
  memberSealSelf: { boxShadow: '0 0 0 2px rgba(255,244,215,.28)' },
  memberSealEmpty: { width: 29, height: 29, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px dashed rgba(255,241,204,.28)', color: 'rgba(255,240,210,.45)', fontSize: 12, flexShrink: 0 },
  teamLink: { marginLeft: 5, color: '#F8E2AE', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' },
  noteComposer: { marginTop: 14, padding: 13, borderRadius: 12, background: 'rgba(255,250,238,.96)', color: C.ink },
  noteComposerTitle: { fontSize: 13, fontWeight: 900, marginBottom: 9 },
  quickNotes: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9 },
  quickNote: { border: '1px solid ' + C.border, borderRadius: 999, background: '#FFF', color: C.goldD, padding: '6px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'Noto Sans SC,sans-serif' },
  noteInput: { width: '100%', minHeight: 58, resize: 'none', boxSizing: 'border-box', border: '1px solid ' + C.border, borderRadius: 9, padding: 9, outline: 'none', color: C.ink, background: '#FFFDF8', fontSize: 12, fontFamily: 'Noto Sans SC,sans-serif' },
  composerFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, color: C.muted, fontSize: 11 },
  noteSendBtn: { border: 'none', borderRadius: 999, background: C.ink, color: '#F4D778', padding: '7px 12px', fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },
  repairPanel: { marginTop: 14, padding: 13, borderRadius: 12, background: 'rgba(255,248,225,.96)', border: '1px solid rgba(231,195,108,.55)', color: C.ink },
  repairTitle: { fontSize: 14, fontWeight: 900 },
  repairText: { marginTop: 5, color: C.muted, fontSize: 12, lineHeight: 1.55 },
  repairChoices: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 11 },
  repairChoice: { border: '1px solid ' + C.border, borderRadius: 9, background: '#FFFDF8', color: C.goldD, padding: '9px 7px', fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },
  referenceLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 3px 18px', borderBottom: '1px solid ' + C.border },
  referenceTitle: { color: C.goldD, fontSize: 12, fontWeight: 900, letterSpacing: 1 },
  referenceMain: { marginTop: 5, color: C.ink, fontFamily: 'Noto Serif SC,serif', fontSize: 19, fontWeight: 900 },
  referenceHint: { marginTop: 4, color: C.muted, fontSize: 12 },
  referenceLink: { border: 'none', background: 'transparent', color: C.goldD, fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },
  findCompanion: { borderBottom: '1px solid ' + C.border },
  findCompanionHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 15, padding: '18px 3px', border: 'none', background: 'transparent', color: C.ink, textAlign: 'left', fontFamily: 'Noto Sans SC,sans-serif' },
  findCompanionTitle: { display: 'block', fontFamily: 'Noto Serif SC,serif', fontSize: 19, fontWeight: 900 },
  findCompanionHint: { display: 'block', marginTop: 4, color: C.muted, fontSize: 12, lineHeight: 1.5 },
  findCompanionArrow: { color: C.goldD, fontSize: 23, lineHeight: 1 },
  needBody: { padding: '0 0 17px' },
  needOptions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  needOption: { minHeight: 46, border: '1px solid ' + C.border, borderRadius: 10, background: C.surf, color: C.muted, padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif' },
  needOptionOn: { borderColor: C.gold, background: C.goldL, color: C.ink },
  needSubmit: { width: '100%', marginTop: 10, border: '1px solid ' + C.gold, borderRadius: 999, background: 'transparent', color: C.goldD, padding: '10px 14px', fontSize: 13, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },

  pushNotice: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '10px 16px 0', padding: '11px 12px', border: '1px solid #E8D4A0', borderRadius: 14, background: '#FFF9EA', boxShadow: '0 2px 10px rgba(122,90,24,.05)' },
  pushCopy: { display: 'flex', flexDirection: 'column', gap: 3, color: C.muted, fontSize: 11, lineHeight: 1.45, minWidth: 0 },
  pushBtn: { border: 'none', background: C.ink, color: '#F6D486', borderRadius: 999, padding: '8px 14px', fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', whiteSpace: 'nowrap' },
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
  compactListLabel: { margin: '2px 0 8px', color: C.muted, fontSize: 12, fontWeight: 900 },
  expandTeamsBtn: { width: '100%', border: '1px solid ' + C.border, background: C.surf, color: C.goldD, borderRadius: 999, padding: '10px 12px', marginTop: 2, fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  filterChip: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '8px 8px', fontSize: 12, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  filterChipOn: { background: C.ink, borderColor: C.ink, color: '#fff' },
  recommendPanel: { marginTop: 14, paddingTop: 2 },
  groupGrid: { display: 'flex', gap: 8, margin: '0 -16px 12px', padding: '0 16px 2px', overflowX: 'auto', scrollbarWidth: 'none' },
  groupPill: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '7px 10px', fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', boxShadow: '0 2px 8px rgba(26,18,8,.04)' },
  groupPillOn: { borderColor: C.gold, background: C.ink, color: '#F6D486' },
  groupPillEmoji: { width: 22, height: 22, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 },
  groupPillName: { fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' },
  groupPillMeta: { fontSize: 10, fontWeight: 800, opacity: .78, whiteSpace: 'nowrap' },
  card: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 2px 10px rgba(26,18,8,.06)' },


  companionDivider: { height: 1, background: C.border, margin: '16px 0 14px' },
  helpHubBadge: { alignSelf: 'flex-start', fontSize: 12, color: C.gold, border: '1px solid ' + C.line, borderRadius: 999, padding: '6px 10px', background: C.surf },
  matchDivider: { height: 1, background: C.line, margin: '14px 0 12px' },
  matchListHead: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
  matchListTitle: { fontSize: 17, fontWeight: 800, color: C.ink },
  matchListHint: { fontSize: 12, color: C.hint, lineHeight: 1.55, marginTop: 3 },
  matchEmpty: { fontSize: 13, color: C.hint, lineHeight: 1.65, padding: '8px 0 2px' },
  teamRecordRow: { display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: C.hint, borderTop: '1px solid ' + C.line, paddingTop: 10, marginTop: 8 },
  helpHubIntro: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, borderTop: '1px solid ' + C.border, padding: '12px 0 6px', marginTop: 2, marginBottom: 4 },
  matchPanel: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 16, padding: 12, margin: '10px 0 12px', boxShadow: '0 3px 12px rgba(26,18,8,.045)' },
  matchHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  matchEmoji: { width: 42, height: 42, borderRadius: '50%', background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  matchStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 },
  matchStatBox: { background: '#FAF7F2', border: '1px solid #EDE6D8', borderRadius: 12, padding: '9px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: C.muted, fontSize: 10 },
  matchActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  matchActionsCompact: { display: 'grid', gridTemplateColumns: '1fr', gap: 9 },
  btnGoldWide: { border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '10px 8px', fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },
  btnGhostWide: { border: '1px solid ' + C.border, background: C.surf, color: C.goldD, borderRadius: 999, padding: '10px 8px', fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },

  helpHero: { background: '#FFF9EA', border: '1px solid #E8D4A0', borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: '0 3px 12px rgba(122,90,24,.05)' },
  helpHeroTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 16, fontWeight: 900, color: C.ink, marginBottom: 0 },
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
  todayStatusCard: { background: 'linear-gradient(135deg, #2A1708, #4A2C12)', border: '1px solid rgba(200,146,42,.32)', borderRadius: 18, padding: 14, marginBottom: 12, boxShadow: '0 8px 22px rgba(26,18,8,.16)' },
  todayStatusHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  todayIcon: { width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,248,232,.12)', border: '1px solid rgba(246,212,134,.42)', color: '#F6D486', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, flexShrink: 0 },
  todayTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 18, fontWeight: 900, color: '#FFF8E8', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  todayText: { fontSize: 12, color: 'rgba(255,248,232,.76)', lineHeight: 1.55 },
  todayFeedback: { display: 'none' },
  todayMetaRow: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 2, color: 'rgba(255,248,232,.58)', fontSize: 11, fontWeight: 700, lineHeight: 1.45 },
  todayStats: { display: 'none' },
  todayStatBox: {},
  todayStatNum: {},
  todayStatLabel: {},
  todayActions: { display: 'grid', gridTemplateColumns: '1fr', gap: 8 },
  promptCard: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#FFF7E6', border: '1px solid #E6D3A4', borderRadius: 18, padding: '15px 14px', marginBottom: 18, boxShadow: '0 3px 12px rgba(122,90,24,.06)', fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  promptIcon: { width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  promptTitle: { fontSize: 16, fontWeight: 900, color: C.ink, marginBottom: 4 },
  promptText: { fontSize: 13, color: C.muted },
  promptArrow: { fontSize: 26, color: C.hint, flexShrink: 0 },
  sectionHeadProto: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, margin: '2px 0 12px' },
  filterRowInline: { display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 190 },
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
  teamFeedbackLine: { display: 'none' },
  teamActionsRow: { display: 'grid', gridTemplateColumns: '1fr', gap: 12 },
  primaryTeamBtn: { border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '12px 14px', fontSize: 15, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  primaryTeamBtnSmall: { border: 'none', background: C.ink, color: '#F6D486', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
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
  compareGraphRow: { display: 'grid', gridTemplateColumns: '64px 1fr 42px', alignItems: 'center', gap: 8, padding: '8px 4px' },
  compareName: { fontSize: 12, color: C.ink, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  compareBar: { height: 8, borderRadius: 999, background: C.soft, overflow: 'hidden' },
  compareFill: { height: '100%', borderRadius: 999 },
  compareValue: { textAlign: 'right', fontSize: 12, color: C.goldD },
  compareHint: { fontSize: 11, color: C.hint, lineHeight: 1.7, padding: '10px 4px 2px' },
  meetingCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 18, padding: 14, marginBottom: 14, boxShadow: '0 4px 16px rgba(26,18,8,.06)' },
  meetingTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 17, fontWeight: 900, color: C.ink, marginBottom: 4 },
  meetingSub: { fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 },
  shareRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderTop: '1px solid ' + C.soft },
  shareAvatar: { width: 34, height: 34, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 },
  shareName: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 900, color: C.ink },
  shareText: { fontSize: 12, color: C.muted, lineHeight: 1.55, marginTop: 4 },
  buddyCard: { background: '#FFF7E6', border: '1px solid #E6D3A4', borderRadius: 18, padding: 14, marginBottom: 14, boxShadow: '0 3px 12px rgba(122,90,24,.06)' },
  buddyTop: { display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 },
  buddyIcon: { width: 40, height: 40, borderRadius: '50%', background: C.ink, color: '#F6D486', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  buddyTitle: { fontSize: 15, fontWeight: 900, color: C.ink, marginBottom: 4 },
  buddyText: { fontSize: 12, color: C.muted, lineHeight: 1.55 },
  buddyActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  inlinePanel: { marginTop: 12, background: 'rgba(255,255,255,.76)', border: '1px solid ' + C.border, borderRadius: 14, padding: 12 },
  inlinePanelTitle: { fontSize: 13, fontWeight: 900, color: C.ink, marginBottom: 8 },
  messageInput: { width: '100%', minHeight: 72, boxSizing: 'border-box', border: '1px solid ' + C.border, borderRadius: 12, background: C.surf, color: C.ink, padding: '10px 11px', fontSize: 13, lineHeight: 1.5, resize: 'none', outline: 'none', fontFamily: 'Noto Sans SC,sans-serif' },
  panelFoot: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 9 },
  charCount: { fontSize: 11, color: C.hint },
  panelActions: { display: 'flex', gap: 8 },
  panelCancelBtn: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif' },
  panelSendBtn: { border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '7px 13px', fontSize: 12, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },
  choiceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  choiceBtn: { border: '1px solid ' + C.border, background: C.surf, color: C.ink, borderRadius: 999, padding: '8px 9px', fontSize: 12, fontWeight: 800, fontFamily: 'Noto Sans SC,sans-serif', textAlign: 'center', cursor: 'pointer' },
  buddyBtn: { border: '1px solid ' + C.border, background: C.surf, color: C.goldD, borderRadius: 999, padding: '10px 12px', fontSize: 13, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
  buddyBtnDark: { border: 'none', background: C.ink, color: '#F6D486', borderRadius: 999, padding: '10px 12px', fontSize: 13, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif', cursor: 'pointer' },
}

