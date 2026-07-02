// src/pages/NotificationsPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification, subscribeToNotifications, savePushSubscription, getPushSubscriptionStatus } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(ch => ch.charCodeAt(0)))
}

const C = { gold:'#C8922A', goldL:'#FDF3E0', ink:'#1A1208', muted:'#7A6A50', hint:'#B8A88A', bg:'#FAF7F2', surf:'#FFFFFF', border:'#E0D5C0', green:'#3B7A4A', greenL:'#E8F5EC' }

function localKey(userId) { return 'ynq_local_notifications_' + (userId || 'guest') }
function deletedKey(userId) { return 'ynq_deleted_notifications_' + (userId || 'guest') }
function readLocal(userId) {
  try { return JSON.parse(localStorage.getItem(localKey(userId)) || '[]') } catch { return [] }
}
function writeLocal(userId, items) { localStorage.setItem(localKey(userId), JSON.stringify(items.slice(0, 80))) }
function readDeleted(userId) {
  try { return JSON.parse(localStorage.getItem(deletedKey(userId)) || '[]') } catch { return [] }
}
function writeDeleted(userId, ids) { localStorage.setItem(deletedKey(userId), JSON.stringify([...new Set(ids)].slice(0, 200))) }
function filterDeleted(userId, items) {
  const deleted = new Set(readDeleted(userId))
  return (items || []).filter(item => !deleted.has(item.id))
}
function fmtTime(value) {
  const d = value ? new Date(value) : new Date()
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.max(1, Math.floor(diff / 60000)) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}
function iconFor(type) {
  if (type === 'companion_nudge') return '⏰'
  if (type === 'companion_echo') return '👏'
  if (type === 'companion_help') return '🫱'
  if (type === 'charity_review' || type === 'good_deed_review') return '❤️'
  if (type === 'pledge_settlement' || type === 'pledge_reminder') return '📜'
  return '🔔'
}
function categoryFor(item) {
  const type = item?.type || 'system'
  if (type.startsWith('companion_')) return 'companion'
  if (type.includes('charity') || type.includes('good_deed') || type.includes('jury')) return 'charity'
  if (type.includes('pledge') || type.includes('checkin') || type.includes('settlement')) return 'pledge'
  return 'system'
}
function labelFor(item) {
  const category = categoryFor(item)
  if (category === 'companion') return '同行'
  if (category === 'charity') return '慈善'
  if (category === 'pledge') return '誓言'
  return '系统'
}
function targetFor(item) {
  const meta = item?.metadata || {}
  const raw = meta.url || meta.target || meta.path || ''
  if (typeof raw === 'string' && raw.startsWith('/')) return raw
  if (item?.pledge_id) return '/pledge/' + item.pledge_id
  if (categoryFor(item) === 'companion') return '/companions'
  if (categoryFor(item) === 'charity') return '/charity'
  return ''
}
function isImportant(item) {
  return !item?.read_at || item?.type === 'companion_nudge' || item?.type === 'pledge_reminder'
}

const FILTERS = [
  ['all', '全部'],
  ['unread', '未读'],
  ['companion', '同行'],
  ['pledge', '誓言'],
  ['charity', '慈善'],
  ['system', '系统'],
]

export default function NotificationsPage() {
  const { session } = useAuth()
  const nav = useNavigate()
  const userId = session?.user?.id
  const [items, setItems] = useState([])
  const [ready, setReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [pushReady, setPushReady] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [filter, setFilter] = useState('all')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2200) }

  async function load() {
    setLoading(true)
    try {
      const res = await getNotifications(userId)
      setReady(res.ready)
      setItems(filterDeleted(userId, res.ready ? res.items : readLocal(userId)))
      const push = await getPushSubscriptionStatus(userId)
      setPushReady(push.ready)
      setPushSubscribed(push.subscribed)
    } catch (err) {
      setReady(false)
      setItems(filterDeleted(userId, readLocal(userId)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (userId) load() }, [userId])
  useEffect(() => {
    if (!userId || !ready) return
    const channel = subscribeToNotifications(userId, item => {
      setItems(list => readDeleted(userId).includes(item.id) ? list : [item, ...list])
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(item.title || '一诺千金', { body: item.body || '你收到一条新消息' })
    })
    return () => { try { channel?.unsubscribe?.() } catch {} }
  }, [userId, ready])

  const unread = useMemo(() => items.filter(item => !item.read_at).length, [items])
  const important = useMemo(() => items.filter(isImportant).length, [items])
  const filteredItems = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'unread') return items.filter(item => !item.read_at)
    return items.filter(item => categoryFor(item) === filter)
  }, [items, filter])

  async function requestPush() {
    if (typeof Notification === 'undefined') return showToast('当前浏览器不支持系统通知')
    const result = await Notification.requestPermission()
    setPermission(result)
    showToast(result === 'granted' ? '已开启本机通知。对方发来新消息时，本机可提醒。' : '通知权限未开启')
  }

  async function markOne(item) {
    if (!item || item.read_at) return item
    const readAt = new Date().toISOString()
    if (ready) await markNotificationRead(userId, item.id)
    const next = items.map(x => x.id === item.id ? { ...x, read_at: readAt } : x)
    setItems(next)
    if (!ready) writeLocal(userId, next)
    window.dispatchEvent(new CustomEvent('ynq:notifications-changed'))
    return { ...item, read_at: readAt }
  }

  async function openItem(item) {
    if (!item) return
    const nextItem = item.read_at ? item : await markOne(item)
    const target = targetFor(nextItem || item)
    if (target) return nav(target)
    showToast('已标记为已读')
  }

  async function markAll() {
    if (ready) await markAllNotificationsRead(userId)
    const now = new Date().toISOString()
    const next = items.map(x => x.read_at ? x : { ...x, read_at: now })
    setItems(next)
    if (!ready) writeLocal(userId, next)
  }

  async function deleteOne(item) {
    if (!item?.id) return
    if (!window.confirm('删除这条消息？')) return

    const now = new Date().toISOString()
    const next = items.filter(x => x.id !== item.id)
    setItems(next)
    writeDeleted(userId, [item.id, ...readDeleted(userId)])
    window.dispatchEvent(new CustomEvent('ynq:notifications-changed'))

    if (!ready) writeLocal(userId, next)
    try {
      if (ready) {
        await markNotificationRead(userId, item.id)
        await deleteNotification(userId, item.id)
      } else if (!item.read_at) {
        writeLocal(userId, items.map(x => x.id === item.id ? { ...x, read_at: now } : x))
      }
      showToast('消息已删除')
    } catch (err) {
      showToast('已从本机消息中心移除')
    } finally {
      window.dispatchEvent(new CustomEvent('ynq:notifications-changed'))
    }
  }

  return (
    <div style={S.page}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.topbar}>
        <button style={S.backBtn} onClick={() => nav(-1)}>‹</button>
        <div style={S.logo}>消息<em style={{ color:C.gold, fontStyle:'normal' }}>中心</em></div>
        <button style={S.readBtn} onClick={markAll} disabled={!unread}>已读</button>
      </div>

      <div style={S.scroll}>
        <div style={S.statusCard}>
          <div>
            <div style={S.statusTitle}>{ready ? '消息表已连接' : '消息表未启用'}</div>
            <div style={S.statusText}>{ready ? '同行提醒、鼓励和求助会进入这里。' : '请在 Supabase 执行通知表 SQL。当前仅显示本机临时消息。'}</div>
          </div>
          <button style={S.pushBtn} onClick={requestPush}>{permission === 'granted' ? '已开启' : '开启通知'}</button>
        </div>

        <div style={S.summary}><b>{unread}</b><span>条未读消息</span><em>{important}条需要处理</em></div>
        <div style={S.filterRow}>
          {FILTERS.map(([key, label]) => {
            const count = key === 'all' ? items.length : key === 'unread' ? unread : items.filter(item => categoryFor(item) === key).length
            return <button key={key} style={{ ...S.filterChip, ...(filter === key ? S.filterChipOn : {}) }} onClick={() => setFilter(key)}>{label}{count > 0 ? ' ' + count : ''}</button>
          })}
        </div>
        {loading ? <div style={S.empty}>正在读取消息...</div> : filteredItems.length === 0 ? <div style={S.empty}>{items.length === 0 ? '暂时没有消息。等同行给你鼓励或提醒时，会出现在这里。' : '这个分类下暂时没有消息。'}</div> : filteredItems.map(item => (
          <div key={item.id} style={{ ...S.item, ...(item.read_at ? {} : S.itemUnread), ...(isImportant(item) ? S.itemImportant : {}) }}>
            <button style={S.itemMain} onClick={() => openItem(item)}>
              <div style={S.itemIcon}>{iconFor(item.type)}</div>
              <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
                <div style={S.itemLine}><span style={S.itemTitle}>{item.title || '一条消息'}</span><span style={S.typePill}>{labelFor(item)}</span></div>
                <div style={S.itemBody}>{item.body || ''}</div>
                <div style={S.itemTime}>{fmtTime(item.created_at)}{item.read_at ? ' · 已读' : ' · 未读'}{targetFor(item) ? ' · 点击前往' : ''}</div>
              </div>
            </button>
            <button style={S.itemDelete} onClick={() => deleteOne(item)}>删除</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const S = {
  page:{ minHeight:'100vh', background:C.bg, paddingBottom:'calc(80px + env(safe-area-inset-bottom))', display:'flex', flexDirection:'column' },
  topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'calc(12px + env(safe-area-inset-top)) 16px 12px', borderBottom:'1px solid ' + C.border, background:C.bg, flexShrink:0 },
  backBtn:{ width:34, height:34, borderRadius:'50%', border:'1px solid ' + C.border, background:C.surf, color:C.ink, fontSize:24, lineHeight:'28px', fontWeight:800 },
  logo:{ fontFamily:'Noto Serif SC,serif', fontSize:20, fontWeight:900, color:C.ink },
  readBtn:{ border:'1px solid ' + C.border, background:C.surf, color:C.muted, borderRadius:999, padding:'7px 12px', fontSize:12, fontWeight:800 },
  scroll:{ flex:1, overflowY:'auto', padding:16 },
  toast:{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)', background:'rgba(26,18,8,.9)', color:'#fff', padding:'9px 18px', borderRadius:999, fontSize:13, zIndex:200, whiteSpace:'nowrap' },
  statusCard:{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'#FFF7E6', border:'1px solid #E6D3A4', borderRadius:16, padding:14, marginBottom:12 },
  statusTitle:{ fontSize:15, fontWeight:900, color:C.ink, marginBottom:4 },
  statusText:{ fontSize:12, color:C.muted, lineHeight:1.5 },
  pushBtn:{ border:'none', background:C.ink, color:'#F6D486', borderRadius:999, padding:'9px 12px', fontSize:12, fontWeight:900, flexShrink:0 },
  summary:{ display:'flex', alignItems:'baseline', gap:6, color:C.muted, fontSize:12, margin:'4px 0 10px' },
  empty:{ background:C.surf, border:'1px dashed ' + C.border, borderRadius:16, padding:'28px 18px', textAlign:'center', color:C.muted, fontSize:13, lineHeight:1.7 },
  item:{ width:'100%', display:'flex', alignItems:'flex-start', gap:10, background:C.surf, border:'1px solid ' + C.border, borderRadius:16, padding:12, marginBottom:10, fontFamily:'Noto Sans SC,sans-serif', color:C.ink, boxShadow:'0 2px 10px rgba(26,18,8,.04)' },
  itemMain:{ flex:1, minWidth:0, display:'flex', alignItems:'flex-start', gap:11, border:'none', background:'transparent', padding:0, fontFamily:'Noto Sans SC,sans-serif', color:C.ink },
  itemDelete:{ border:'1px solid ' + C.border, background:'#FFFCF5', color:C.muted, borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:900, flexShrink:0 },
  itemUnread:{ borderColor:C.gold, background:'#FFFCF5' },
  itemIcon:{ width:36, height:36, borderRadius:'50%', background:C.goldL, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 },
  itemTitle:{ fontSize:14, fontWeight:900, color:C.ink, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  itemBody:{ fontSize:12, color:C.muted, lineHeight:1.55 },
  itemTime:{ fontSize:10, color:C.hint, marginTop:7 }
}
