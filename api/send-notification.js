import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@yinuo-qianjin.app'

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function sendJson(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json')
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value))
  res.end(JSON.stringify(payload))
}

function getBearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : ''
}

function assertServerConfig() {
  const missing = []
  if (!SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!VAPID_PUBLIC_KEY) missing.push('VAPID_PUBLIC_KEY')
  if (!VAPID_PRIVATE_KEY) missing.push('VAPID_PRIVATE_KEY')
  return missing
}

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value))

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
    return
  }

  const missing = assertServerConfig()
  if (missing.length) {
    sendJson(res, 500, { ok: false, error: 'missing_server_config', missing })
    return
  }

  try {
    const token = getBearerToken(req)
    if (!token) {
      sendJson(res, 401, { ok: false, error: 'missing_auth_token' })
      return
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData?.user) {
      sendJson(res, 401, { ok: false, error: 'invalid_auth_token' })
      return
    }

    const actorId = authData.user.id
    const payload = req.body || {}
    const toUserId = payload.toUserId || payload.user_id || payload.userId
    const title = String(payload.title || '一诺千金').trim()
    const body = String(payload.body || payload.message || '你收到一条新消息').trim()
    const type = String(payload.type || 'system').trim()
    const pledgeId = payload.pledgeId || payload.pledge_id || null
    const url = payload.url || '/notifications'
    const metadata = { ...(payload.metadata || {}), url }

    if (!toUserId || !title) {
      sendJson(res, 400, { ok: false, error: 'missing_required_fields' })
      return
    }

    const { data: notification, error: notificationError } = await admin
      .from('notifications')
      .insert({
        user_id: toUserId,
        actor_id: actorId,
        pledge_id: pledgeId,
        type,
        title,
        body,
        metadata,
      })
      .select()
      .single()

    if (notificationError) throw notificationError

    const { data: subscriptions, error: subscriptionError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', toUserId)
      .eq('enabled', true)

    if (subscriptionError) throw subscriptionError

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const pushPayload = JSON.stringify({
      title,
      body,
      url,
      tag: type,
      data: { url, notificationId: notification.id, type, pledgeId },
    })

    const results = await Promise.allSettled((subscriptions || []).map(async item => {
      const subscription = {
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth },
      }
      try {
        await webpush.sendNotification(subscription, pushPayload)
        return { id: item.id, sent: true }
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await admin
            .from('push_subscriptions')
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq('id', item.id)
        }
        return { id: item.id, sent: false, statusCode: error?.statusCode || null }
      }
    }))

    const sent = results.filter(r => r.status === 'fulfilled' && r.value?.sent).length
    sendJson(res, 200, {
      ok: true,
      notification,
      push: { total: subscriptions?.length || 0, sent },
    })
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: 'send_notification_failed',
      message: error?.message || String(error),
    })
  }
}
