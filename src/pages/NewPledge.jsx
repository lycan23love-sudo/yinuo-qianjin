// src/pages/NewPledge.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../App'
import { createPledge } from '../lib/supabase'
import { addDays, format } from 'date-fns'

const PERIODS = [
  { key:'week', icon:'📅', label:'周誓言', days:7, locked:false },
  { key:'month', icon:'🌙', label:'月誓言', days:30, locked:false },
  { key:'season', icon:'🌸', label:'季度誓言', days:90, locked:true, need:'完成1个解锁' },
  { key:'year', icon:'🏔️', label:'年度誓言', days:365, locked:true, need:'完成3个解锁' },
]
const STAKES = [50, 100, 200, 500]
const CHARITIES = ['🐾 动物保护联盟','📚 山区图书馆','❤️ 儿童健康基金','🌳 绿色公益','🏥 贫困助学基金']
const VERIFY = [
  { key:'screenshot', icon:'📷', label:'截图证明', desc:'上传截图，见证者可质疑' },
  { key:'text', icon:'✍️', label:'文字日记', desc:'每天写今天的记录' },
]

const S = {
  page: { minHeight:'100vh', background:'#f8f5ef', color:'#1d1309', paddingBottom:104 },
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #e0d5c0', background:'#faf7f2', position:'sticky', top:0, zIndex:10 },
  back: { width:34, height:34, border:0, borderRadius:17, background:'rgba(255,255,255,.72)', color:'#1d1309', fontSize:21, cursor:'pointer' },
  pageTitle: { fontFamily:'serif', fontSize:19, fontWeight:900 },
  content: { padding:'16px 16px 0' },
  scroll: { position:'relative', border:'1px solid #d7c29a', borderRadius:8, background:'linear-gradient(180deg,#fff8e3 0%,#fff1c7 100%)', padding:'22px 18px 20px', boxShadow:'0 10px 24px rgba(79,55,20,.11)', overflow:'hidden' },
  lineTop: { position:'absolute', left:16, right:16, top:11, height:1, background:'rgba(213,174,92,.72)' },
  lineBottom: { position:'absolute', left:16, right:16, bottom:11, height:1, background:'rgba(213,174,92,.72)' },
  eyebrow: { margin:0, color:'#9a7130', fontSize:12, fontWeight:900, letterSpacing:3 },
  title: { margin:'8px 0 6px', fontFamily:'serif', fontSize:28, fontWeight:900, lineHeight:1.15 },
  sub: { margin:'0 0 16px', color:'#74644f', fontSize:13, lineHeight:1.7 },
  label: { display:'block', marginBottom:7, color:'#8a6a2d', fontSize:12, fontWeight:900, letterSpacing:1 },
  textarea: { width:'100%', minHeight:110, boxSizing:'border-box', border:'1px solid #d8c497', borderRadius:8, background:'rgba(255,253,246,.86)', padding:'13px 14px', color:'#1d1309', fontSize:17, lineHeight:1.65, fontFamily:'serif', resize:'vertical', outline:'none' },
  seal: { position:'absolute', right:14, bottom:18, width:76, height:76, borderRadius:'50%', border:'2px solid rgba(176,36,24,.86)', background:'rgba(255,239,230,.75)', color:'#9b1f16', transform:'rotate(-12deg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'serif', boxSizing:'border-box', boxShadow:'0 5px 14px rgba(176,36,24,.12)' },
  sealGhost: { position:'absolute', right:18, bottom:20, width:70, height:70, borderRadius:'50%', border:'2px dashed rgba(176,36,24,.35)', color:'rgba(155,31,22,.42)', transform:'rotate(-12deg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, fontFamily:'serif' },
  sealChar: { fontSize:23, lineHeight:1, fontWeight:900 },
  sealText: { marginTop:5, fontSize:11, fontWeight:900, letterSpacing:2 },
  group: { marginTop:16, border:'1px solid #e0d4bf', borderRadius:8, background:'#fff', padding:14, boxShadow:'0 6px 18px rgba(79,55,20,.05)' },
  groupTitle: { margin:'0 0 11px', fontFamily:'serif', fontSize:18, fontWeight:900 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 },
  periodBtn: { border:'1px solid #e0d5c0', borderRadius:8, background:'#fffdf8', padding:'12px 8px', textAlign:'center', cursor:'pointer', color:'#1d1309' },
  periodOn: { border:'2px solid #c8922a', background:'#fdf3e0' },
  row: { display:'flex', gap:8, flexWrap:'wrap' },
  chip: { flex:'1 1 68px', border:'1px solid #e0d5c0', borderRadius:8, background:'#fffdf8', padding:'10px 8px', color:'#1d1309', fontSize:14, fontWeight:800, cursor:'pointer' },
  chipOn: { border:'2px solid #c8922a', background:'#fdf3e0', color:'#7a5a18' },
  charityBtn: { width:'100%', border:'1px solid #e0d5c0', borderRadius:8, background:'#fffdf8', padding:'11px 12px', marginBottom:8, textAlign:'left', color:'#1d1309', fontSize:14, cursor:'pointer' },
  charityOn: { border:'2px solid #3b7a4a', background:'#e8f5ec', color:'#1a4a28', fontWeight:900 },
  verifyOpt: { display:'flex', alignItems:'center', gap:12, border:'1px solid #e0d5c0', borderRadius:8, background:'#fffdf8', padding:12, marginBottom:8, cursor:'pointer' },
  verifyOn: { border:'2px solid #c8922a', background:'#fdf3e0' },
  publicRow: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  publicBtn: { border:'1px solid #e0d5c0', borderRadius:8, background:'#fffdf8', padding:'11px 8px', color:'#1d1309', fontSize:13, cursor:'pointer' },
  notice: { marginTop:16, border:'1px solid rgba(200,146,42,.36)', borderRadius:8, background:'#fdf3e0', padding:13, color:'#7a5a18', fontSize:12, lineHeight:1.7 },
  actionBox: { marginTop:16, border:'1px solid #d7c29a', borderRadius:8, background:'#fffdf8', padding:14 },
  stampBtn: { width:'100%', border:'1px solid rgba(176,36,24,.45)', borderRadius:8, background:'#fff1e9', color:'#9b1f16', padding:'13px 12px', fontSize:15, fontWeight:900, cursor:'pointer' },
  submitBtn: { width:'100%', border:0, borderRadius:8, background:'#171008', color:'#f6d486', padding:'14px 12px', fontSize:15, fontWeight:900, cursor:'pointer', marginTop:10, boxShadow:'0 5px 14px rgba(23,16,8,.18)' },
  disabledBtn: { opacity:.5, cursor:'not-allowed' },
  meta: { marginTop:7, color:'#9a8a70', fontSize:12, lineHeight:1.6 },
  small: { color:'#9a8a70', fontSize:12, lineHeight:1.6 },
  bold: { fontWeight:900 }
}

function userSeal(profile) {
  const name = profile?.nickname || profile?.username || '我'
  return String(name).trim().slice(0, 1) || '我'
}

export default function NewPledge() {
  const { session, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState({
    title: '', period: 'month', stake: 50,
    charity: '📚 山区图书馆', verify: 'screenshot', isPublic: true, bounty: 0
  })
  const [loading, setLoading] = useState(false)
  const [sealed, setSealed] = useState(false)

  useEffect(() => {
    if (!profile) return
    const coins = profile.merit_coins ?? 0
    setForm(f => {
      if (f.stake <= coins) return f
      const affordable = [...STAKES].reverse().find(s => s <= coins) || STAKES[0]
      return { ...f, stake: affordable }
    })
  }, [profile?.merit_coins])

  function set(k, v) {
    setSealed(false)
    setForm(f => ({ ...f, [k]: v }))
  }

  const period = PERIODS.find(p => p.key === form.period)
  const endDate = format(addDays(new Date(), period.days - 1), 'yyyy年M月d日')
  const currentCoins = profile?.merit_coins ?? 0
  const noCoins = currentCoins < form.stake
  const sealChar = userSeal(profile)

  function stamp() {
    if (!form.title.trim()) { showToast('请先写下你的誓言'); return }
    if (noCoins) { showToast('金币不足，需要' + form.stake + '金币'); return }
    setSealed(true)
    showToast('印已落，诺已成。', 'success')
  }

  async function handleSubmit() {
    if (!form.title.trim()) { showToast('请填写承诺内容'); return }
    if (noCoins) { showToast('金币不足，需要' + form.stake + '金币'); return }
    if (!sealed) { showToast('请先盖下守诺印'); return }
    setLoading(true)
    try {
      const pledge = await createPledge(session.user.id, {
        title: form.title,
        period: form.period,
        stakeCoins: form.stake,
        charityTarget: form.charity,
        verifyType: form.verify,
        isPublic: form.isPublic,
      })
      refreshProfile()
      showToast('军令状已立，金币已托管 🔒', 'success')
      nav('/pledge/' + pledge.id)
    } catch (err) {
      showToast(err.message || '立誓失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>‹</button>
        <div style={S.pageTitle}>立下军令状</div>
        <div style={{ width:34 }} />
      </div>

      <div style={S.content}>
        <section style={S.scroll}>
          <div style={S.lineTop} />
          <div style={S.lineBottom} />
          <p style={S.eyebrow}>守诺契约</p>
          <h1 style={S.title}>写下你的军令状</h1>
          <p style={S.sub}>这一页不是普通表单。写下你愿意每天证明的事，再亲手盖下守诺印。</p>
          <label style={S.label}>吾今日立誓</label>
          <textarea
            style={S.textarea}
            rows={4}
            placeholder={'例：每天学习 AI 2 小时，并上传截图证明。'}
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
          {sealed ? (
            <div style={S.seal}>
              <div style={S.sealChar}>{sealChar}</div>
              <div style={S.sealText}>守诺印</div>
            </div>
          ) : (
            <div style={S.sealGhost}>待盖印</div>
          )}
        </section>

        <section style={S.group}>
          <h2 style={S.groupTitle}>期限</h2>
          <div style={S.grid2}>
            {PERIODS.map(p => (
              <button key={p.key} style={{ ...S.periodBtn, ...(form.period === p.key ? S.periodOn : {}), ...(p.locked ? { opacity:.45, cursor:'not-allowed' } : {}) }} onClick={() => !p.locked && set('period', p.key)}>
                <div style={{ fontSize:22 }}>{p.icon}</div>
                <div style={{ marginTop:4, fontWeight:900 }}>{p.label}</div>
                <div style={S.small}>{p.days}天</div>
                {p.locked && <div style={{ marginTop:4, color:'#c8922a', fontSize:11 }}>{p.need}</div>}
              </button>
            ))}
          </div>
          <div style={S.meta}>今日生效，至 {endDate}</div>
        </section>

        <section style={S.group}>
          <h2 style={S.groupTitle}>押注</h2>
          <div style={S.row}>
            {STAKES.map(s => (
              <button key={s} style={{ ...S.chip, ...(form.stake === s ? S.chipOn : {}) }} onClick={() => set('stake', s)}>{s}</button>
            ))}
          </div>
          <div style={S.meta}>当前余额：{currentCoins.toLocaleString()} 金币{noCoins && <span style={{ color:'#c84040', marginLeft:8 }}>余额不足</span>}</div>
        </section>

        <section style={S.group}>
          <h2 style={S.groupTitle}>若失信，捐给</h2>
          {CHARITIES.map(c => (
            <button key={c} style={{ ...S.charityBtn, ...(form.charity === c ? S.charityOn : {}) }} onClick={() => set('charity', c)}>{c}</button>
          ))}
        </section>

        <section style={S.group}>
          <h2 style={S.groupTitle}>每日证明</h2>
          {VERIFY.map(v => (
            <div key={v.key} style={{ ...S.verifyOpt, ...(form.verify === v.key ? S.verifyOn : {}) }} onClick={() => set('verify', v.key)}>
              <span style={{ fontSize:22 }}>{v.icon}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:900 }}>{v.label}</div>
                <div style={S.small}>{v.desc}</div>
              </div>
            </div>
          ))}
        </section>

        <section style={S.group}>
          <h2 style={S.groupTitle}>公开方式</h2>
          <div style={S.publicRow}>
            <button style={{ ...S.publicBtn, ...(form.isPublic ? S.chipOn : {}) }} onClick={() => set('isPublic', true)}>🌐 公开见证</button>
            <button style={{ ...S.publicBtn, ...(!form.isPublic ? S.chipOn : {}) }} onClick={() => set('isPublic', false)}>🔒 仅自己可见</button>
          </div>
        </section>

        <div style={S.notice}>
          <div style={S.bold}>立誓即托管</div>
          <div>{form.stake} 金币将在盖印后冻结。成功返还，失败捐给「{form.charity}」。</div>
        </div>

        <section style={S.actionBox}>
          <button style={{ ...S.stampBtn, ...(loading || !profile || noCoins ? S.disabledBtn : {}) }} onClick={stamp} disabled={loading || !profile || noCoins}>
            {sealed ? '印已落，诺已成' : '盖下守诺印'}
          </button>
          <button style={{ ...S.submitBtn, ...(!sealed || loading || !profile || noCoins ? S.disabledBtn : {}) }} onClick={handleSubmit} disabled={!sealed || loading || !profile || noCoins}>
            {!profile ? '加载账户中…' : loading ? '立誓中…' : '正式立誓，托管 ' + form.stake + ' 金币'}
          </button>
        </section>
      </div>
    </div>
  )
}
