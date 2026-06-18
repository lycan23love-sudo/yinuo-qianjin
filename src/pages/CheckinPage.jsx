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

export default function CheckinPage() {
  const { id } = useParams()
  const { session, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const nav = useNavigate()

  const [pledge, setPledge] = useState(null)
  const [alreadyChecked, setAlreadyChecked] = useState(false)
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [note, setNote] = useState('')
  const [mood, setMood] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    try {
      const p = await getPledgeDetail(id)
      setPledge(p)
      const checked = await hasCheckedInToday(id)
      if (checked) {
        showToast('今日已打卡 ✓')
        nav(`/pledge/${id}`)
      }
    } catch (e) {
      showToast('加载失败', 'error')
    }
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('图片不能超过5MB'); return }
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  const dayNum = pledge
    ? Math.floor((new Date() - new Date(pledge.start_date)) / 86400000) + 1
    : 1

  const quote = QUOTES.find(([s, e]) => dayNum >= s && dayNum <= e)?.[2] ?? ''

  // Estimated coins
  const streak = (pledge?.current_streak ?? 0) + 1
  const base = 10
  const streakBonus = streak >= 14 ? 30 : streak >= 7 ? 20 : 0
  const milestoneBonus = [7,14,21,28].includes(dayNum) ? 100 : 0
  const total = base + streakBonus + milestoneBonus

  async function handleSubmit() {
    if (pledge?.verify_type === 'screenshot' && !image) {
      showToast('请上传打卡截图'); return
    }
    if (!note.trim()) { showToast('请写下今天的感受'); return }
    setLoading(true)
    try {
      const result = await submitCheckin(session.user.id, id, {
        imageFile: image,
        note,
        mood,
      })
      refreshProfile()
      nav('/checkin-success', { state: { result, pledge } })
    } catch (err) {
      showToast(err.message || '打卡失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!pledge) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ color:'#9A8A70' }}>加载中…</div>
    </div>
  )

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={S.title}>第 {dayNum} 天打卡</div>
        <div style={{ width:32 }} />
      </div>

      <div style={{ padding:'16px 16px 0' }}>

        {/* Daily quote */}
        <div style={S.quoteBox}>
          <span style={{ marginRight:8 }}>✨</span>
          <span style={{ fontSize:13, lineHeight:1.6, color:'#5A4A30' }}>{quote}</span>
        </div>

        {/* Pledge name */}
        <div style={{ background:'#fff', borderRadius:12, padding:12, marginBottom:16,
          border:'0.5px solid #E0D5C0' }}>
          <div style={{ fontSize:11, color:'#9A8A70', marginBottom:4 }}>今日承诺</div>
          <div style={{ fontSize:14, fontWeight:600, fontFamily:'Noto Serif SC,serif' }}>
            {pledge.title}
          </div>
        </div>

        {/* Image upload */}
        {pledge.verify_type === 'screenshot' && (
          <div style={S.group}>
            <label style={S.label}>上传打卡截图</label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={handleFile} />
            {preview ? (
              <div style={{ position:'relative' }}>
                <img src={preview} alt="preview"
                  style={{ width:'100%', borderRadius:12, maxHeight:200, objectFit:'cover' }} />
                <button style={S.removeBtn} onClick={() => { setImage(null); setPreview(null) }}>
                  ✕
                </button>
              </div>
            ) : (
              <div style={S.uploadBox} onClick={() => fileRef.current.click()}>
                <span style={{ fontSize:32, display:'block', marginBottom:8 }}>📷</span>
                <div style={{ fontSize:13, fontWeight:500, color:'#5A4A30' }}>点击上传截图</div>
                <div style={{ fontSize:11, color:'#9A8A70', marginTop:4 }}>
                  支持 JPG / PNG，最大5MB
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mood */}
        <div style={S.group}>
          <label style={S.label}>今天的状态</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {MOODS.map(m => (
              <button key={m.key}
                style={{ ...S.moodBtn, ...(mood===m.key ? S.moodOn : {}) }}
                onClick={() => setMood(m.key)}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div style={S.group}>
          <label style={S.label}>今天的感悟</label>
          <textarea style={S.textarea} rows={4}
            placeholder="写下今天的感受、收获或困难…"
            value={note} onChange={e => setNote(e.target.value)} />
          <div style={{ fontSize:11, color:'#9A8A70', textAlign:'right', marginTop:4 }}>
            {note.length} 字
          </div>
        </div>

        {/* Reward preview */}
        <div style={S.rewardBox}>
          <div style={{ fontSize:12, fontWeight:600, color:'#7A5A18', marginBottom:8 }}>
            打卡成功预计获得
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <div style={S.rewardItem}>
              <div style={S.rewardVal}>{base}</div>
              <div style={S.rewardLbl}>基础奖励</div>
            </div>
            {streakBonus > 0 && (
              <div style={S.rewardItem}>
                <div style={S.rewardVal}>+{streakBonus}</div>
                <div style={S.rewardLbl}>连续{streak}天</div>
              </div>
            )}
            {milestoneBonus > 0 && (
              <div style={S.rewardItem}>
                <div style={S.rewardVal}>+{milestoneBonus}</div>
                <div style={S.rewardLbl}>里程碑</div>
              </div>
            )}
            <div style={{ ...S.rewardItem, background:'#FDF3E0', border:'1px solid rgba(200,146,42,.3)' }}>
              <div style={{ ...S.rewardVal, color:'#C8922A' }}>={total}</div>
              <div style={S.rewardLbl}>金币</div>
            </div>
          </div>
        </div>

        <button style={{ ...S.btnGold, width:'100%', padding:14, fontSize:15 }}
          onClick={handleSubmit} disabled={loading}>
          {loading ? '提交中…' : '提交打卡'}
        </button>
      </div>
    </div>
  )
}

const S = {
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px', borderBottom:'0.5px solid #E0D5C0',
    background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
  back: { background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#1A1208', padding:4 },
  title: { fontSize:16, fontWeight:600 },
  quoteBox: { background:'#FDF3E0', borderLeft:'3px solid #C8922A',
    borderRadius:'0 10px 10px 0', padding:'10px 14px', marginBottom:16,
    display:'flex', alignItems:'flex-start' },
  group: { marginBottom:18 },
  label: { display:'block', fontSize:11, fontWeight:600, color:'#9A8A70',
    letterSpacing:.5, marginBottom:8, textTransform:'uppercase' },
  uploadBox: { border:'2px dashed #E0D5C0', borderRadius:12, padding:28,
    textAlign:'center', cursor:'pointer', background:'#fff',
    transition:'all .2s' },
  removeBtn: { position:'absolute', top:8, right:8, background:'rgba(0,0,0,.5)',
    color:'#fff', border:'none', borderRadius:'50%', width:28, height:28,
    cursor:'pointer', fontSize:14 },
  moodBtn: { padding:'7px 13px', borderRadius:20, border:'1px solid #E0D5C0',
    background:'#fff', fontSize:12, cursor:'pointer',
    fontFamily:'Noto Sans SC,sans-serif' },
  moodOn: { borderColor:'#C8922A', background:'#FDF3E0', color:'#7A5A18', fontWeight:500 },
  textarea: { width:'100%', padding:'10px 12px', border:'0.5px solid #E0D5C0',
    borderRadius:10, background:'#fff', fontSize:13, lineHeight:1.7,
    fontFamily:'Noto Sans SC,sans-serif', resize:'none', outline:'none',
    boxSizing:'border-box' },
  rewardBox: { background:'#FDF3E0', borderRadius:12, padding:12, marginBottom:16 },
  rewardItem: { background:'#fff', borderRadius:8, padding:'6px 10px',
    textAlign:'center', border:'0.5px solid #E0D5C0' },
  rewardVal: { fontSize:16, fontWeight:700, color:'#3B7A4A' },
  rewardLbl: { fontSize:10, color:'#9A8A70', marginTop:2 },
  btnGold: { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff',
    border:'none', borderRadius:12, fontWeight:700, cursor:'pointer',
    fontFamily:'Noto Sans SC,sans-serif' },
}
