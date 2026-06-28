// public/sw.js — 一诺千金 Service Worker
// v4 — 提醒设置与页面缓存刷新
const CACHE_VERSION = 'yinuo-v4'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  // 清除所有旧版本缓存，强制客户端刷新
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

let reminderTimer = null

// ── 接收页面消息
self.addEventListener('message', e => {
  const { type, payload } = e.data || {}
  if (type === 'SCHEDULE_REMINDER') scheduleDaily(payload)
  if (type === 'CANCEL_REMINDER')   cancelReminder()
  if (type === 'TEST_NOTIFICATION') showReminder(
    payload?.title || '一诺千金', payload?.body || '通知测试成功 ✓'
  )
})

function showReminder(title, body) {
  self.registration.showNotification(title, {
    body,
    icon:     '/icon-192.png',
    badge:    '/icon-192.png',
    tag:      'checkin-reminder',
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url: '/' },
    actions:  [
      { action: 'checkin', title: '去打卡 ✓' },
      { action: 'dismiss', title: '稍后' },
    ],
  })
}

function getDelayMs(hour, minute) {
  const now  = new Date()
  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

function scheduleDaily({ hour, minute, pledgeTitle }) {
  cancelReminder()
  function fire() {
    const body = pledgeTitle
      ? `「${pledgeTitle}」今天还没打卡，坚持就是胜利 💪`
      : '你有誓言今天还没打卡，快来完成！'
    showReminder('📌 该打卡了！', body)
    reminderTimer = setTimeout(fire, 24 * 60 * 60 * 1000)
  }
  reminderTimer = setTimeout(fire, getDelayMs(hour, minute))
  // 通知页面
  self.clients.matchAll().then(cs =>
    cs.forEach(c => c.postMessage({
      type: 'REMINDER_SCHEDULED',
      payload: { hour, minute }
    }))
  )
}

function cancelReminder() {
  if (reminderTimer) { clearTimeout(reminderTimer); reminderTimer = null }
}

// ── 点击通知
self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (e.action === 'dismiss') return
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const w = wins.find(w => w.url.includes('yinuo-qianjin') || w.url.includes('localhost'))
      if (w) { w.focus(); w.navigate?.('/') }
      else clients.openWindow('/')
    })
  )
})
