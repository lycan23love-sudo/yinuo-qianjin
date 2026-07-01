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
  return '🔔'
}

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

  async function requestPush() {
    if (typeof Notification === 'undefined') return showToast('当前浏览器不支持系统通知')
    const result = await Notification.requestPermission()
    setPermission(result)
    showToast(result === 'granted' ? '已开启本机通知。对方发来新消息时，本机可提醒。' : '通知权限未开启')
  }

  async function markOne(item) {
    if (!item || item.read_at) return
    if (ready) await markNotificationRead(userId, item.id)
    const next = items.map(x => x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x)
    setItems(next)
    if (!ready) writeLocal(userId, next)
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
    const next = items.filter(x => x.id !== item.id)
    setItems(next)
    writeDeleted(userId, [item.id, ...readDeleted(userId)])
    if (!ready) writeLocal(userId, next)
    try {
      if (ready) await deleteNotification(userId, item.id)
      showToast('消息已删除')
    } catch (err) {
      showToast('已从本机消息中心移除')
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

        <div style={S.summary}><b>{unread}</b><span>条未读消息</span></div>
        {loading ? <div style={S.empty}>正在读取消息...</div> : items.length === 0 ? <div style={S.empty}>暂时没有消息。等同行给你鼓励或提醒时，会出现在这里。</div> : items.map(item => (
          <div key={item.id} style={{ ...S.item, ...(item.read_at ? {} : S.itemUnread) }}>
            <button style={S.itemMain} onClick={() => markOne(item)}>
              <div style={S.itemIcon}>{iconFor(item.type)}</div>
              <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
                <div style={S.itemTitle}>{item.title || '一条消息'}</div>
                <div style={S.itemBody}>{item.body || ''}</div>
                <div style={S.itemTime}>{fmtTime(item.created_at)}{item.read_at ? ' · 已读' : ' · 未读'}</div>
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
