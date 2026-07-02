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


const QUICK_NOTES = [
  '今天按计划完成。',
  '过程有点难，但我没有中断。',
  '完成得不完美，但我守住了承诺。'
]

const MOOD_FEEDBACK = {
  great:  { title:'今天很顺，记住这种手感。', body:'顺利不是理所当然，它说明你的节奏正在形成。' },
  grind:  { title:'咬牙完成的这一天，更值得被记住。', body:'不是每一天都有热情，但你还是把该做的做完了。' },
  steady: { title:'平稳推进，就是最可靠的力量。', body:'真正的改变往往不轰烈，只是每天稳定地多做一点。' },
  danger: { title:'差点放弃却仍然完成，这很重要。', body:'今天的价值不在轻松，而在你没有让诺言断掉。' },
}


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

function getCheckinPrompt(dayNum, progressPct, needsImage) {
  if (dayNum <= 1) return '第一天，把誓言从纸面带进生活。'
  if (progressPct >= 80) return '已经接近终点，今天这一次很有分量。'
  if (progressPct >= 50) return '过半之后，稳定比热血更重要。'
  return needsImage ? '留下证据，让今天的努力有据可查。' : '写下今天做到了什么，让承诺留下痕迹。'
}


function getProofHint(needsImage, image, note, audioFile) {
  const hasNote = note.trim()
  const parts = [image && '截图', audioFile && '语音', hasNote && '文字'].filter(Boolean)
  if (parts.length >= 2) return parts.join(' + ') + '已准备好，今天的证明很完整。'
  if (audioFile) return '语音已录好，可以补一句文字让记录更清楚。'
  if (image) return '截图已附上，可以补一句今天的情况。'
  if (hasNote) return needsImage ? '已写下文字记录；补截图或语音会更有说服力。' : '文字记录已准备好，可以提交。'
  return needsImage ? '建议上传截图；也可以用语音说明今天完成了什么。' : '写一句、上传图，或录一段语音，都可以完成今天的守诺。'
}

function formatRecordTime(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, '0')
  const sec = String(seconds % 60).padStart(2, '0')
  return min + ':' + sec
}

export default function CheckinPage() {
  const { id } = useParams()
  const { session, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const nav = useNavigate()


  const [pledge, setPledge]       = useState(null)
  const [image, setImage]         = useState(null)
  const [preview, setPreview]     = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl]   = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [note, setNote]           = useState('')
  const [mood, setMood]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadStep, setLoadStep]   = useState('')   // 上传进度提示
  const [compressing, setCompressing] = useState(false)
  const fileRef = useRef()
  const recorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioTimerRef = useRef(null)

  useEffect(() => { load() }, [id])

  useEffect(() => {
    return () => {
      if (audioTimerRef.current) clearInterval(audioTimerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (recorderRef.current?.stream) {
        recorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [audioUrl])

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


  async function startRecording() {
    if (loading || recording) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showToast('当前浏览器不支持录音', 'error')
      return
    }
    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioFile(null)
      setAudioUrl(null)
      setRecordSeconds(0)
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = e => {
        if (e.data?.size) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type })
        const ext = type.includes('mp4') ? 'm4a' : 'webm'
        const file = new File([blob], 'checkin-voice-' + Date.now() + '.' + ext, { type })
        setAudioFile(file)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setRecording(true)
      audioTimerRef.current = setInterval(() => {
        setRecordSeconds(sec => {
          if (sec >= 59) {
            setTimeout(stopRecording, 0)
            return 60
          }
          return sec + 1
        })
      }, 1000)
    } catch {
      showToast('无法启动录音，请检查麦克风权限', 'error')
    }
  }

  function stopRecording() {
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current)
      audioTimerRef.current = null
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    setRecording(false)
  }

  function removeAudio() {
    stopRecording()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioFile(null)
    setAudioUrl(null)
    setRecordSeconds(0)
    audioChunksRef.current = []
  }

  const dayNum = pledge
    ? Math.floor((new Date() - new Date(pledge.start_date)) / 86400000) + 1
    : 1


  const progressDone = pledge?.checkin_count || 0
  const progressTotal = pledge?.total_days || 1
  const progressPct = Math.min(100, Math.round((progressDone / Math.max(progressTotal, 1)) * 100))
  const needsImage = pledge?.verify_type === 'screenshot'
  const quote = QUOTES.find(([s, e]) => dayNum >= s && dayNum <= e)?.[2] ?? ''
  const prompt = getCheckinPrompt(dayNum, progressPct, needsImage)
  const proofHint = getProofHint(needsImage, image, note, audioFile)


  const streak = (pledge?.current_streak ?? 0) + 1
  const base = 10
  const streakBonus = streak >= 14 ? 30 : streak >= 7 ? 20 : 0
  const milestoneBonus = [7,14,21,28].includes(dayNum) ? 100 : 0
  const total = base + streakBonus + milestoneBonus
  const selectedMood = MOODS.find(item => item.key === mood)
  const feedback = MOOD_FEEDBACK[mood] || { title:'今天你没有把诺言留在嘴上。', body:'提交之后，这一笔会进入你的守诺日记。' }


  async function handleSubmit() {
    // 图片：screenshot 模式建议上传，但不强制
    // 感悟：选填，不再强制
    setLoading(true)
    try {
      setLoadStep(image ? '上传图片中…' : audioFile ? '上传语音中…' : '提交中…')
      const result = await submitCheckin(session.user.id, id, {
        imageFile: image || null,
        audioFile: audioFile || null,
        note: note.trim(),
        mood: mood || null,
      })
      setLoadStep('打卡成功！')
      refreshProfile()
      nav('/checkin-success', { state: { result, pledge, mood, moodLabel: selectedMood?.label || '', note: note.trim() } })
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


  return (
    <div style={{ background:'#FAF7F2', minHeight:'100vh', paddingBottom: 'calc(132px + env(safe-area-inset-bottom))' }}>
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={S.title}>第 {dayNum} 天打卡</div>
        <div style={{ width:32 }} />
      </div>


      <div style={{ padding:'16px 16px calc(96px + env(safe-area-inset-bottom))' }}>


        <section style={S.heroCard}>
          <div style={S.heroTop}>
            <div>
              <div style={S.kicker}>今日守诺</div>
              <div style={S.heroTitle}>{pledge.title}</div>
            </div>
            <div style={S.dayBadge}>第{dayNum}天</div>
          </div>
          <div style={S.promptLine}>{prompt}</div>
          <div style={S.progressMeta}>
            <span>已完成 {progressDone} / {progressTotal}</span>
            <span>{progressPct}%</span>
          </div>
          <div style={S.progressTrack}><div style={{ ...S.progressFill, width: progressPct + '%' }} /></div>
          <div style={S.quoteBox}>
            <span style={{ marginRight:8, flexShrink:0 }}>✨</span>
            <span style={{ fontSize:13, lineHeight:1.6, color:'#5A4A30' }}>{quote}</span>
          </div>
        </section>


        {/* 打卡图片 */}
        <div style={S.group}>
          <label style={S.label}>
            打卡截图
            {needsImage
              ? <span style={{ color:'#C84040', marginLeft:4 }}>（建议上传）</span>
              : <span style={{ color:'#B8A88A', marginLeft:4 }}>（选填）</span>
            }
          </label>
          <div style={S.proofHint}>{proofHint}</div>
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


        {/* 语音说明 */}
        <div style={S.group}>
          <label style={S.label}>语音说明 <span style={{ color:'#B8A88A' }}>（选填）</span></label>
          <div style={S.audioBox}>
            <div style={S.audioTop}>
              <div style={{ minWidth:0 }}>
                <div style={S.audioTitle}>{recording ? '正在录音' : audioFile ? '语音已录好' : '录一段今日说明'}</div>
                <div style={S.audioHint}>30-60秒，说清今天完成了什么。</div>
              </div>
              <button
                style={{ ...S.audioBtn, ...(recording ? S.audioBtnStop : {}) }}
                onClick={recording ? stopRecording : startRecording}
                disabled={loading}>
                {recording ? '停止' : audioFile ? '重录' : '录音'}
              </button>
            </div>
            {(recording || recordSeconds > 0) && (
              <div style={S.audioMeter}>
                <span style={{ ...S.recordDot, opacity: recording ? 1 : .35 }} />
                <span>{formatRecordTime(recordSeconds)}</span>
              </div>
            )}
            {audioUrl && (
              <div style={S.audioPreview}>
                <audio controls src={audioUrl} style={{ width:'100%' }} />
                <button style={S.audioRemove} onClick={removeAudio}>删除语音</button>
              </div>
            )}
          </div>
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
          <div style={S.quickRow}>
            {QUICK_NOTES.map(text => (
              <button key={text} style={S.quickBtn} onClick={() => setNote(note ? note + ' ' + text : text)}>
                {text}
              </button>
            ))}
          </div>
        </div>


        <div style={S.echoPreview}>
          <div style={S.echoKicker}>守诺回响</div>
          <div style={S.echoTitle}>{feedback.title}</div>
          <div style={S.echoBody}>{feedback.body}</div>
          <div style={S.echoMeta}>{selectedMood ? selectedMood.emoji + ' ' + selectedMood.label + ' · ' : ''}{note.trim() ? '你的记录会进入打卡日记' : '写一句记录，明天回看会更有力量'}</div>
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


        <div style={S.submitDock}>
          <div style={S.submitHint}>{proofHint}</div>
          <button style={{ ...S.btnGold, width:'100%', padding:15, fontSize:15, opacity: loading ? .75 : 1 }}
            onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <span>{loadStep || '提交中…'}</span>
            ) : (
              <span>✓ 今日已守，提交证明</span>
            )}
          </button>
        </div>
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
  heroCard:{ background:'linear-gradient(180deg,#fff8e8,#fff)', border:'1px solid #E0D5C0', borderRadius:14,
             padding:'15px 15px 14px', marginBottom:16, boxShadow:'0 8px 22px rgba(79,55,20,.08)' },
  heroTop:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:10 },
  kicker:{ fontSize:11, color:'#9A7130', fontWeight:800, letterSpacing:2, marginBottom:5 },
  heroTitle:{ fontFamily:'Noto Serif SC,serif', fontSize:18, lineHeight:1.35, fontWeight:900, color:'#1A1208' },
  dayBadge:{ flexShrink:0, border:'1px solid rgba(200,146,42,.34)', background:'#FDF3E0', color:'#7A5A18',
            borderRadius:999, padding:'5px 10px', fontSize:12, fontWeight:800 },
  promptLine:{ color:'#5A4A30', fontSize:13, lineHeight:1.65, marginBottom:10 },
  progressMeta:{ display:'flex', justifyContent:'space-between', color:'#9A8A70', fontSize:11, marginBottom:6 },
  progressTrack:{ height:7, borderRadius:999, background:'#EDE6D8', overflow:'hidden', marginBottom:12 },
  progressFill:{ height:'100%', borderRadius:999, background:'#C8922A' },
  quoteBox:{ background:'#FDF3E0', borderLeft:'3px solid #C8922A', borderRadius:'0 10px 10px 0',
             padding:'10px 14px', marginBottom:0, display:'flex', alignItems:'flex-start' },
  group:   { marginBottom:18 },
  label:   { display:'block', fontSize:12, fontWeight:600, color:'#5A4A30', marginBottom:8 },
  proofHint:{ background:'#fff', border:'1px solid #EDE6D8', borderRadius:10, padding:'9px 11px',
              color:'#7A6A50', fontSize:12, lineHeight:1.55, marginBottom:10 },
  uploadBox:{ border:'2px dashed #E0D5C0', borderRadius:12, padding:28, textAlign:'center',
              cursor:'pointer', background:'#fff', transition:'all .2s' },
  removeBtn:{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.5)', color:'#fff',
              border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', fontSize:15,
              display:'flex', alignItems:'center', justifyContent:'center' },
  audioBox:{ background:'#fff', border:'1px solid #E0D5C0', borderRadius:12, padding:12,
             boxShadow:'0 6px 18px rgba(79,55,20,.04)' },
  audioTop:{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 },
  audioTitle:{ fontSize:13, fontWeight:800, color:'#1A1208', marginBottom:4 },
  audioHint:{ fontSize:11, color:'#9A8A70', lineHeight:1.5 },
  audioBtn:{ flexShrink:0, border:'none', borderRadius:999, padding:'8px 16px', background:'#1A1208',
             color:'#E8B84A', fontSize:12, fontWeight:800, fontFamily:'Noto Sans SC,sans-serif', cursor:'pointer' },
  audioBtnStop:{ background:'#C84040', color:'#fff' },
  audioMeter:{ display:'flex', alignItems:'center', gap:7, marginTop:10, color:'#7A5A18', fontSize:12,
               fontWeight:800, letterSpacing:.3 },
  recordDot:{ width:8, height:8, borderRadius:'50%', background:'#C84040', display:'inline-block' },
  audioPreview:{ marginTop:10, display:'grid', gap:8 },
  audioRemove:{ justifySelf:'start', border:'1px solid #E0D5C0', background:'#FAF7F2', color:'#7A6A50',
                borderRadius:999, padding:'5px 10px', fontSize:11, fontFamily:'Noto Sans SC,sans-serif', cursor:'pointer' },
  moodBtn: { padding:'8px 14px', borderRadius:20, border:'1px solid #E0D5C0', background:'#fff',
             fontSize:12, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  moodOn:  { borderColor:'#C8922A', background:'#FDF3E0', color:'#7A5A18', fontWeight:600 },
  textarea:{ width:'100%', padding:'10px 12px', border:'0.5px solid #E0D5C0', borderRadius:10,
             background:'#fff', fontSize:13, lineHeight:1.7, fontFamily:'Noto Sans SC,sans-serif',
             resize:'none', outline:'none', boxSizing:'border-box' },
  quickRow:{ display:'flex', gap:7, flexWrap:'wrap', marginTop:10 },
  quickBtn:{ border:'1px solid #E0D5C0', background:'#fff', color:'#7A6A50', borderRadius:999,
             padding:'6px 10px', fontSize:11, fontFamily:'Noto Sans SC,sans-serif', cursor:'pointer' },
  echoPreview:{ background:'#FFF7E6', border:'1px solid #E6D3A4', borderRadius:14, padding:'14px 15px', marginBottom:14, boxShadow:'0 3px 12px rgba(122,90,24,.06)' },
  echoKicker:{ fontSize:11, color:'#C8922A', fontWeight:900, letterSpacing:1.5, marginBottom:6 },
  echoTitle:{ fontFamily:'Noto Serif SC,serif', fontSize:16, fontWeight:900, color:'#1A1208', lineHeight:1.45, marginBottom:6 },
  echoBody:{ fontSize:13, color:'#5A4A30', lineHeight:1.7 },
  echoMeta:{ marginTop:8, fontSize:12, color:'#7A5A18', fontWeight:800 },
  rewardBox:{ background:'#FDF3E0', borderRadius:12, padding:'12px 14px', marginBottom:16 },
  rewardItem:{ background:'#fff', borderRadius:8, padding:'7px 12px', textAlign:'center',
               border:'0.5px solid #E0D5C0' },
  rewardVal:{ fontSize:16, fontWeight:700, color:'#3B7A4A' },
  rewardLbl:{ fontSize:10, color:'#9A8A70', marginTop:2 },
  submitDock:{ position:'sticky', bottom:'calc(82px + env(safe-area-inset-bottom))', zIndex:30,
              background:'linear-gradient(180deg,rgba(250,247,242,0),#FAF7F2 18%)',
              padding:'16px 0 10px', marginTop:4 },
  submitHint:{ textAlign:'center', fontSize:11, color:'#9A8A70', lineHeight:1.5, marginBottom:8 },
  btnGold: { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff', border:'none',
             borderRadius:12, fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif',
             boxShadow:'0 4px 16px rgba(200,146,42,.35)', letterSpacing:.3 },
}
