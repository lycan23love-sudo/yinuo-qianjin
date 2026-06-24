// src/components/ReminderSetup.jsx
// 打卡提醒设置浮层 — 基于 Service Worker 本地定时通知
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'yinuo_reminder'

function swSend(msg) {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage(msg)
    return true
  }
  // SW 还未激活时，等待后重试一次
  return navigator.serviceWorker?.ready?.then(reg => {
    reg.active?.postMessage(msg)
  })
}

export default function ReminderSetup({ pledgeTitle, onClose }) {
  const saved     = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  const [hour,    setHour]    = useState(saved?.hour    ?? 21)
  const [minute,  setMinute]  = useState(saved?.minute  ?? 0)
  const [status,  setStatus]  = useState(saved ? 'on' : 'off')  // off | requesting | on | denied
  const [toast,   setToast]   = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // 监听 SW 确认消息
  useEffect(() => {
    function onMsg(e) {
      if (e.data?.type === 'REMINDER_SCHEDULED') {
        const { hour: h, minute: m } = e.data.payload
        showToast(`✓ 提醒已设置：每天 ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [])

  async function handleEnable() {
    // 检查支持
    if (!('serviceWorker' in navigator)) {
      showToast('你的浏览器不支持 Service Worker，请使用 Chrome/Edge')
      return
    }
    if (!('Notification' in window)) {
      showToast('你的浏览器不支持通知，请使用 Chrome/Edge')
      return
    }
    // iOS Safari 提示
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIOS && !navigator.standalone) {
      showToast('iOS 请先将网页添加到主屏幕，再开启提醒')
      setStatus('off')
      return
    }
    setStatus('requesting')
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      setStatus('denied')
      showToast('通知权限被拒绝，请在浏览器设置中开启')
      return
    }
    // 保存设置
    const cfg = { hour, minute, pledgeTitle }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
    setStatus('on')
    // 发给 SW
    swSend({ type: 'SCHEDULE_REMINDER', payload: cfg })
  }

  function handleDisable() {
    localStorage.removeItem(STORAGE_KEY)
    setStatus('off')
    swSend({ type: 'CANCEL_REMINDER' })
    showToast('打卡提醒已关闭')
  }

  async function handleTest() {
    if (Notification.permission !== 'granted') {
      showToast('请先开启提醒')
      return
    }
    swSend({ type: 'TEST_NOTIFICATION', payload: {
      title: '📌 该打卡了！',
      body:  pledgeTitle ? `「${pledgeTitle}」今天还没打卡，坚持就是胜利 💪` : '测试通知 ✓'
    }})
    showToast('测试通知已发送，请查看通知栏')
  }

  const hh = String(hour).padStart(2,'0')
  const mm  = String(minute).padStart(2,'0')

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex',
      flexDirection:'column', justifyContent:'flex-end' }}>
      {/* 遮罩 */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)' }}
        onClick={onClose} />

      {/* 弹窗 */}
      <div style={{ position:'relative', background:'#fff',
        borderRadius:'20px 20px 0 0',
        padding:'20px 20px calc(24px + env(safe-area-inset-bottom))' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position:'absolute', top:-44, left:'50%', transform:'translateX(-50%)',
            background:'rgba(26,18,8,.88)', color:'#fff', padding:'8px 18px',
            borderRadius:20, fontSize:13, whiteSpace:'nowrap', zIndex:10 }}>
            {toast}
          </div>
        )}

        {/* 标题 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>🔔 打卡提醒</div>
          <button onClick={onClose}
            style={{ background:'none', border:'none', fontSize:22, color:'#9A8A70', cursor:'pointer' }}>×</button>
        </div>

        {/* 说明 */}
        <div style={{ fontSize:12, color:'#9A8A70', lineHeight:1.7, marginBottom:16,
          background:'#FAF7F2', borderRadius:10, padding:'10px 12px' }}>
          每天在你设定的时间发送提醒，帮你记得打卡。<br />
          提醒存储在本设备，<b style={{ color:'#5A4A30' }}>无需网络</b>，关闭 app 后也能收到。
        </div>

        {/* 时间选择器 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
          gap:12, marginBottom:20 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:'#9A8A70', marginBottom:4 }}>时</div>
            <input type="number" min={0} max={23} value={hour}
              onChange={e => setHour(Math.min(23, Math.max(0, +e.target.value)))}
              style={S.timeInput} />
          </div>
          <div style={{ fontSize:28, fontWeight:700, color:'#C8922A', marginTop:16 }}>:</div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, color:'#9A8A70', marginBottom:4 }}>分</div>
            <input type="number" min={0} max={59} value={minute}
              onChange={e => setMinute(Math.min(59, Math.max(0, +e.target.value)))}
              style={S.timeInput} />
          </div>
          <div style={{ fontSize:14, color:'#5A4A30', marginTop:16 }}>
            每天 {hh}:{mm} 提醒
          </div>
        </div>

        {/* 快捷时间 */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {[[8,0,'早8点'],[12,0,'午12点'],[19,0,'晚7点'],[21,0,'晚9点'],[22,30,'晚10:30']].map(([h,m,lbl]) => (
            <div key={lbl} onClick={() => { setHour(h); setMinute(m) }}
              style={{ fontSize:12, padding:'5px 12px', borderRadius:20, cursor:'pointer',
                background: hour===h && minute===m ? '#C8922A' : '#F5F0E8',
                color:      hour===h && minute===m ? '#fff'     : '#7A6A50',
                border:     hour===h && minute===m ? '1px solid #C8922A' : '1px solid transparent' }}>
              {lbl}
            </div>
          ))}
        </div>

        {/* 状态 & 按钮 */}
        {status === 'denied' && (
          <div style={{ background:'#FCEBEB', borderRadius:10, padding:'10px 12px',
            fontSize:12, color:'#C84040', marginBottom:12 }}>
            ⚠️ 通知权限已拒绝。请在浏览器地址栏左侧的🔒图标 → 网站设置 → 通知 → 允许
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          {status === 'on' ? (<>
            <button onClick={handleTest}
              style={{ ...S.btnGhost, flex:1 }}>发送测试</button>
            <button onClick={handleDisable}
              style={{ ...S.btnRed, flex:1 }}>关闭提醒</button>
          </>) : (
            <button onClick={handleEnable}
              disabled={status === 'requesting'}
              style={{ ...S.btnGold, width:'100%',
                opacity: status === 'requesting' ? .7 : 1 }}>
              {status === 'requesting' ? '请求权限中…' : '开启提醒'}
            </button>
          )}
        </div>

        {status === 'on' && (
          <div style={{ textAlign:'center', fontSize:11, color:'#9A8A70', marginTop:10 }}>
            已开启 · 每天 {hh}:{mm} 提醒打卡
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  timeInput: {
    width:64, textAlign:'center', fontSize:28, fontWeight:700,
    fontFamily:'Noto Serif SC,serif', color:'#1A1208',
    border:'1.5px solid #E0D5C0', borderRadius:10, padding:'8px 4px',
    outline:'none', background:'#FAF7F2',
  },
  btnGold:  { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff',
              border:'none', borderRadius:12, padding:'13px 0', fontSize:14,
              fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif',
              boxShadow:'0 4px 16px rgba(200,146,42,.3)' },
  btnGhost: { background:'#fff', color:'#5A4A30', border:'1px solid #E0D5C0',
              borderRadius:12, padding:'12px 0', fontSize:13, cursor:'pointer',
              fontFamily:'Noto Sans SC,sans-serif' },
  btnRed:   { background:'#FCEBEB', color:'#C84040', border:'1px solid #FCEBEB',
              borderRadius:12, padding:'12px 0', fontSize:13, cursor:'pointer',
              fontFamily:'Noto Sans SC,sans-serif' },
}
