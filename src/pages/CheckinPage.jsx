// src/pages/CheckinPage.jsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth, useToast } from '../App'
import { submitCheckin, getPledgeDetail, hasCheckedInToday } from '../lib/supabase'

const MOODS = [
  { key:'great',  emoji:'💪', label:'超级顺利' },
  { key:'grind',  emoji:'😤', label:'咬牙坚持' },
  { key:'steady', emoji:'😌', label:'平稳推进' },
  { key:'danger', emoji:'🆘', label:'差点放弃' },
]

const QUOTES = [
  [1,  7,  '万事开头难，但你已经迈出了最难的一步。'],
  [8,  14, '第二周是最容易放弃的时候，而你没有。'],
  [15, 21, '超过一半了！坚持到这里的人已经不多了。'],
  [22, 28, '最后的冲刺，你已经证明了自己。'],
  [29, 999,'走到这里的旅人，已经超过了95%的人。'],
]

// ── 图片压缩：压到最大 1200px、质量 0.75，减小上传体积
async function compressImage(file, maxPx = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const ratio = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width  * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
        'image/jpeg', quality)
    }
    img.src = url
  })
}

export default function CheckinPage() {
  const { id } = useParams()
  const { session, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const nav = useNavigate()

  const [pledge, setPledge]       = useState(null)
  const [image, setImage]         = useState(null)
  const [preview, setPreview]     = useState(null)
  const [note, setNote]           = useState('')
  const [mood, setMood]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadStep, setLoadStep]   = useState('')   // 上传进度提示
  const [compressing, setCompressing] = useState(false)
  const fileRef = useRef()

  useEffect(() => { load() }, [id])

  async function load() {
    try {
      const p = await getPledgeDetail(id)
      setPledge(p)
      const checked = await hasCheckedInToday(id)
      if (checked) {
        showToast('今日已打卡 ✓')
        nav(`/pledge/${id}`)
      }
    } catch {
      showToast('加载失败', 'error')
    }
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return

    // 超过 500KB 才压缩，小图直接用
    if (file.size > 500 * 1024) {
      setCompressing(true)
      try {
        const compressed = await compressImage(file)
        setImage(compressed)
        setPreview(URL.createObjectURL(compressed))
        const savedKB = Math.round((file.size - compressed.size) / 1024)
        if (savedKB > 100) showToast(`图片已压缩，节省 ${savedKB}KB ✓`)
      } catch {
        // 压缩失败就直接用原图（限5MB）
        if (file.size > 5 * 1024 * 1024) { showToast('图片太大，请选择小于5MB的图片'); return }
        setImage(file)
        setPreview(URL.createObjectURL(file))
      } finally {
        setCompressing(false)
      }
    } else {
      setImage(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const dayNum = pledge
    ? Math.floor((new Date() - new Date(pledge.start_date)) / 86400000) + 1
    : 1

  const quote = QUOTES.find(([s, e]) => dayNum >= s && dayNum <= e)?.[2] ?? ''

  const streak = (pledge?.current_streak ?? 0) + 1
  const base = 10
  const streakBonus = streak >= 14 ? 30 : streak >= 7 ? 20 : 0
  const milestoneBonus = [7,14,21,28].includes(dayNum) ? 100 : 0
  const total = base + streakBonus + milestoneBonus

  async function handleSubmit() {
    // 图片：screenshot 模式建议上传，但不强制
    // 感悟：选填，不再强制
    setLoading(true)
    try {
      setLoadStep(image ? '压缩图片中…' : '提交中…')
      if (image) setLoadStep('上传图片中…')
      const result = await submitCheckin(session.user.id, id, {
        imageFile: image || null,
        note: note.trim(),
        mood: mood || null,
      })
      setLoadStep('打卡成功！')
      refreshProfile()
      nav('/checkin-success', { state: { result, pledge } })
    } catch (err) {
      showToast(err.message || '打卡失败，请重试', 'error')
    } finally {
      setLoading(false)
      setLoadStep('')
    }
  }

  if (!pledge) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ color:'#9A8A70' }}>加载中…</div>
    </div>
  )

  const needsImage = pledge.verify_type === 'screenshot'

  return (
    <div style={{ background:'#FAF7F2', minHeight:'100vh', paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={S.title}>第 {dayNum} 天打卡</div>
        <div style={{ width:32 }} />
      </div>

      <div style={{ padding:'16px 16px 0' }}>

        {/* 每日金句 */}
        <div style={S.quoteBox}>
          <span style={{ marginRight:8, flexShrink:0 }}>✨</span>
          <span style={{ fontSize:13, lineHeight:1.6, color:'#5A4A30' }}>{quote}</span>
        </div>

        {/* 誓言标题 */}
        <div style={{ background:'#fff', borderRadius:12, padding:'12px 14px',
          marginBottom:16, border:'0.5px solid #E0D5C0', boxShadow:'0 1px 4px rgba(26,18,8,.04)' }}>
          <div style={{ fontSize:11, color:'#9A8A70', marginBottom:4 }}>今日承诺</div>
          <div style={{ fontSize:15, fontWeight:700, fontFamily:'Noto Serif SC,serif' }}>
            {pledge.title}
          </div>
          <div style={{ fontSize:11, color:'#B8A88A', marginTop:4 }}>
            第{pledge.checkin_count + 1}天 / 共{pledge.total_days}天
            {streakBonus > 0 && <span style={{ color:'#C8922A', marginLeft:8 }}>🔥 连续{streak}天</span>}
          </div>
        </div>

        {/* 打卡图片 */}
        <div style={S.group}>
          <label style={S.label}>
            打卡截图
            {needsImage
              ? <span style={{ color:'#C84040', marginLeft:4 }}>（建议上传）</span>
              : <span style={{ color:'#B8A88A', marginLeft:4 }}>（选填）</span>
            }
          </label>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
            onChange={handleFile} />
          {compressing && (
            <div style={{ ...S.uploadBox, cursor:'default' }}>
              <span style={{ fontSize:24 }}>⏳</span>
              <div style={{ fontSize:13, color:'#9A8A70', marginTop:8 }}>图片压缩中…</div>
            </div>
          )}
          {!compressing && (preview ? (
            <div style={{ position:'relative' }}>
              <img src={preview} alt="preview"
                style={{ width:'100%', borderRadius:12, maxHeight:220, objectFit:'cover',
                  boxShadow:'0 2px 12px rgba(0,0,0,.1)' }} />
              <button style={S.removeBtn}
                onClick={() => { setImage(null); setPreview(null) }}>✕</button>
              <div style={{ position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,.45)',
                color:'#fff', fontSize:11, borderRadius:8, padding:'3px 8px' }}>
                点击✕更换图片
              </div>
            </div>
          ) : (
            <div style={S.uploadBox} onClick={() => fileRef.current.click()}>
              <span style={{ fontSize:36, display:'block', marginBottom:8 }}>📷</span>
              <div style={{ fontSize:13, fontWeight:500, color:'#5A4A30' }}>点击上传截图</div>
              <div style={{ fontSize:11, color:'#9A8A70', marginTop:4 }}>
                自动压缩 · 支持 JPG / PNG
              </div>
              {!needsImage && (
                <div style={{ fontSize:11, color:'#C8922A', marginTop:6 }}>不上传也可以打卡</div>
              )}
            </div>
          ))}
        </div>

        {/* 心情状态 */}
        <div style={S.group}>
          <label style={S.label}>今天的状态 <span style={{ color:'#B8A88A' }}>（选填）</span></label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {MOODS.map(m => (
              <button key={m.key}
                style={{ ...S.moodBtn, ...(mood === m.key ? S.moodOn : {}) }}
                onClick={() => setMood(mood === m.key ? '' : m.key)}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 感悟 */}
        <div style={S.group}>
          <label style={S.label}>今天的感悟 <span style={{ color:'#B8A88A' }}>（选填）</span></label>
          <textarea style={S.textarea} rows={3}
            placeholder="写下今天的感受、收获或困难…（不写也可以提交）"
            value={note} onChange={e => setNote(e.target.value)} />
          <div style={{ display:'flex', justifyContent:'space-between',
            fontSize:11, color:'#9A8A70', marginTop:4 }}>
            <span>记录让坚持更有意义</span>
            <span>{note.length} 字</span>
          </div>
        </div>

        {/* 奖励预览 */}
        <div style={S.rewardBox}>
          <div style={{ fontSize:12, fontWeight:600, color:'#7A5A18', marginBottom:8 }}>
            🪙 打卡成功预计获得
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <div style={S.rewardItem}>
              <div style={S.rewardVal}>{base}</div>
              <div style={S.rewardLbl}>基础</div>
            </div>
            {streakBonus > 0 && (
              <div style={S.rewardItem}>
                <div style={S.rewardVal}>+{streakBonus}</div>
                <div style={S.rewardLbl}>连续{streak}天</div>
              </div>
            )}
            {milestoneBonus > 0 && (
              <div style={{ ...S.rewardItem, background:'#E8F5EC', borderColor:'rgba(59,122,74,.3)' }}>
                <div style={{ ...S.rewardVal, color:'#3B7A4A' }}>+{milestoneBonus}</div>
                <div style={S.rewardLbl}>里程碑🏆</div>
              </div>
            )}
            <div style={{ ...S.rewardItem, background:'#FDF3E0', borderColor:'rgba(200,146,42,.3)', marginLeft:'auto' }}>
              <div style={{ ...S.rewardVal, color:'#C8922A', fontSize:18 }}>={total}</div>
              <div style={S.rewardLbl}>金币</div>
            </div>
          </div>
        </div>

        {/* 提交按钮 */}
        <button style={{ ...S.btnGold, width:'100%', padding:15, fontSize:15,
          opacity: loading ? .75 : 1, position:'relative' }}
          onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <span>{loadStep || '提交中…'}</span>
          ) : (
            <span>✓ 提交打卡</span>
          )}
        </button>

        {/* 提示 */}
        {!image && needsImage && !loading && (
          <div style={{ textAlign:'center', fontSize:11, color:'#9A8A70', marginTop:10, lineHeight:1.6 }}>
            没有截图也可以提交，但上传截图让见证者更有信服力
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  topbar:  { display:'flex', alignItems:'center', justifyContent:'space-between',
             padding:'12px 16px', borderBottom:'0.5px solid #E0D5C0',
             background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
  back:    { background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#1A1208', padding:4 },
  title:   { fontSize:16, fontWeight:600 },
  quoteBox:{ background:'#FDF3E0', borderLeft:'3px solid #C8922A', borderRadius:'0 10px 10px 0',
             padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'flex-start' },
  group:   { marginBottom:18 },
  label:   { display:'block', fontSize:12, fontWeight:600, color:'#5A4A30', marginBottom:8 },
  uploadBox:{ border:'2px dashed #E0D5C0', borderRadius:12, padding:28, textAlign:'center',
              cursor:'pointer', background:'#fff', transition:'all .2s' },
  removeBtn:{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.5)', color:'#fff',
              border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', fontSize:15,
              display:'flex', alignItems:'center', justifyContent:'center' },
  moodBtn: { padding:'8px 14px', borderRadius:20, border:'1px solid #E0D5C0', background:'#fff',
             fontSize:12, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  moodOn:  { borderColor:'#C8922A', background:'#FDF3E0', color:'#7A5A18', fontWeight:600 },
  textarea:{ width:'100%', padding:'10px 12px', border:'0.5px solid #E0D5C0', borderRadius:10,
             background:'#fff', fontSize:13, lineHeight:1.7, fontFamily:'Noto Sans SC,sans-serif',
             resize:'none', outline:'none', boxSizing:'border-box' },
  rewardBox:{ background:'#FDF3E0', borderRadius:12, padding:'12px 14px', marginBottom:16 },
  rewardItem:{ background:'#fff', borderRadius:8, padding:'7px 12px', textAlign:'center',
               border:'0.5px solid #E0D5C0' },
  rewardVal:{ fontSize:16, fontWeight:700, color:'#3B7A4A' },
  rewardLbl:{ fontSize:10, color:'#9A8A70', marginTop:2 },
  btnGold: { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff', border:'none',
             borderRadius:12, fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif',
             boxShadow:'0 4px 16px rgba(200,146,42,.35)', letterSpacing:.3 },
}
