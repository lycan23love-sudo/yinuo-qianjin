// src/pages/NewPledge.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../App'
import { createPledge } from '../lib/supabase'
import { addDays, format } from 'date-fns'


const PERIODS = [
  { key:'week',   icon:'📅', label:'周誓言',   days:7,   locked:false },
  { key:'month',  icon:'🌙', label:'月誓言',   days:30,  locked:false },
  { key:'season', icon:'🌸', label:'季度誓言', days:90,  locked:true, need:'完成1个解锁' },
  { key:'year',   icon:'🏔️', label:'年度誓言', days:365, locked:true, need:'完成3个解锁' },
]
const STAKES = [200, 500, 1000, 2000]
const CHARITIES = ['🐾 动物保护联盟','📚 山区图书馆','❤️ 儿童健康基金','🌳 绿色公益','🏥 贫困助学基金']
const VERIFY = [
  { key:'screenshot', icon:'📷', label:'截图证明', desc:'上传截图，见证者可质疑' },
  { key:'text',       icon:'✍️', label:'文字日记', desc:'每天写今天的记录' },
]


export default function NewPledge() {
  const { session, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const nav = useNavigate()


  const [form, setForm] = useState({
    title: '', period: 'month', stake: 200,
    charity: '📚 山区图书馆', verify: 'screenshot', isPublic: true, bounty: 0
  })
  const [loading, setLoading] = useState(false)


  useEffect(() => {
    if (!profile) return
    const coins = profile.merit_coins ?? 0
    setForm(f => {
      if (f.stake <= coins) return f
      const affordable = [...STAKES].reverse().find(s => s <= coins) || STAKES[0]
      return { ...f, stake: affordable }
    })
  }, [profile?.merit_coins])


  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }


  const period = PERIODS.find(p => p.key === form.period)
  const endDate = format(addDays(new Date(), period.days - 1), 'yyyy年M月d日')


  // Check quota
  const currentCoins = profile?.merit_coins ?? 0
  const noCoins = currentCoins < form.stake


  async function handleSubmit() {
    if (!form.title.trim()) { showToast('请填写承诺内容'); return }
    if (noCoins) { showToast(`金币不足，需要${form.stake}金币`); return }
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
      showToast('誓言已立！金币已托管 🔒', 'success')
      nav(`/pledge/${pledge.id}`)
    } catch (err) {
      showToast(err.message || '立誓失败', 'error')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={S.title}>立下誓言</div>
        <div style={{ width:32 }} />
      </div>


      <div style={{ padding:'0 16px' }}>
        {/* Pledge content */}
        <div style={S.group}>
          <label style={S.label}>我承诺要做到</label>
          <textarea style={S.textarea} rows={3}
            placeholder="具体的目标更容易坚持&#10;例：每天跑步5公里，不跑完不算数"
            value={form.title} onChange={e => set('title', e.target.value)} />
        </div>


        {/* Period */}
        <div style={S.group}>
          <label style={S.label}>誓言周期</label>
          <div style={S.grid2}>
            {PERIODS.map(p => (
              <button key={p.key} style={{
                  ...S.periodBtn,
                  ...(form.period === p.key ? S.periodOn : {}),
                  ...(p.locked ? { opacity:.5, cursor:'not-allowed' } : {})
                }}
                onClick={() => !p.locked && set('period', p.key)}>
                <div style={{ fontSize:22, marginBottom:4 }}>{p.icon}</div>
                <div style={{ fontSize:13, fontWeight:500 }}>{p.label}</div>
                <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>{p.days}天</div>
                {p.locked && (
                  <div style={{ fontSize:10, color:'#C8922A', marginTop:4,
                    background:'#FDF3E0', padding:'1px 6px', borderRadius:10 }}>
                    {p.need}
                  </div>
                )}
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:'#9A8A70', marginTop:6 }}>
            开始：今天 → 结束：{endDate}
          </div>
        </div>


        {/* Stake */}
        <div style={S.group}>
          <label style={S.label}>赌注金币（失败时捐出）</label>
          <div style={S.stakeRow}>
            {STAKES.map(s => (
              <button key={s} style={{ ...S.stakeBtn, ...(form.stake===s ? S.stakeOn : {}) }}
                onClick={() => set('stake', s)}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ fontSize:11, color:'#9A8A70', marginTop:6 }}>
            当前余额：{currentCoins.toLocaleString()} 金币
            {noCoins && <span style={{ color:'#C84040', marginLeft:8 }}>余额不足</span>}
          </div>
        </div>


        {/* Charity */}
        <div style={S.group}>
          <label style={S.label}>失败时捐给</label>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {CHARITIES.map(c => (
              <button key={c} style={{ ...S.charityBtn, ...(form.charity===c ? S.charityOn : {}) }}
                onClick={() => set('charity', c)}>
                {c}
              </button>
            ))}
          </div>
        </div>


        {/* Verify type */}
        <div style={S.group}>
          <label style={S.label}>打卡验证方式</label>
          {VERIFY.map(v => (
            <div key={v.key} style={{ ...S.verifyOpt, ...(form.verify===v.key ? S.verifyOn : {}) }}
              onClick={() => set('verify', v.key)}>
              <span style={{ fontSize:22 }}>{v.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{v.label}</div>
                <div style={{ fontSize:11, color:'#9A8A70' }}>{v.desc}</div>
              </div>
            </div>
          ))}
        </div>


        {/* Public toggle */}
        <div style={S.group}>
          <label style={S.label}>是否公开到广场</label>
          <div style={{ display:'flex', gap:8 }}>
            {[{v:true,l:'🌐 公开（可招募见证者）'},{v:false,l:'🔒 仅自己可见'}].map(({v,l}) => (
              <button key={String(v)} style={{ ...S.pubBtn, ...(form.isPublic===v ? S.pubOn : {}) }}
                onClick={() => set('isPublic', v)}>
                {l}
              </button>
            ))}
          </div>
        </div>


        {/* 悬赏令（公开时可选） */}
        {form.isPublic && (
          <div style={{ marginBottom:16 }}>
            <label style={S.label}>🏷 悬赏令 <span style={{ color:'#9A8A70', fontWeight:400 }}>（选填）</span></label>
            <div style={{ fontSize:11, color:'#9A8A70', marginBottom:8, lineHeight:1.6 }}>
              自掏腰包设置悬赏广告费，吸引围观者来挑战你的誓言。费用进入公益金库。
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {[0, 10, 30, 50, 100].map(a => (
                <button key={a} style={{ ...S.pubBtn, flex:1, ...(form.bounty===a ? S.pubOn : {}) }}
                  onClick={() => set('bounty', a)}>
                  {a === 0 ? '不设置' : `${a}币`}
                </button>
              ))}
            </div>
          </div>
        )}


        {/* Escrow notice */}
        <div style={S.notice}>
          <div style={{ fontSize:12, fontWeight:600, color:'#7A5A18', marginBottom:4 }}>
            🔒 立誓即托管
          </div>
          <div style={{ fontSize:11, color:'#7A5A18', lineHeight:1.6 }}>
            {form.stake} 金币将在立誓后冻结。成功则解冻回账，失败则捐给「{form.charity}」。
          </div>
        </div>


        <button style={{ ...S.btnGold, width:'100%', padding:14, fontSize:15 }}
          onClick={handleSubmit} disabled={loading || !profile || noCoins}>
          {!profile ? '加载账户中…' : loading ? '立誓中…' : `立下誓言，托管 ${form.stake} 金币`}
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
  title: { fontSize:16, fontWeight:600, fontFamily:'Noto Sans SC,sans-serif' },
  group: { marginBottom:20, marginTop:16 },
  label: { display:'block', fontSize:11, fontWeight:600, color:'#9A8A70',
    letterSpacing:.5, marginBottom:8, textTransform:'uppercase' },
  textarea: { width:'100%', padding:'10px 12px', border:'0.5px solid #E0D5C0',
    borderRadius:10, background:'#fff', fontSize:13, lineHeight:1.6,
    fontFamily:'Noto Sans SC,sans-serif', resize:'none', outline:'none',
    boxSizing:'border-box' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
  periodBtn: { background:'#fff', border:'1.5px solid #E0D5C0', borderRadius:12,
    padding:12, textAlign:'center', cursor:'pointer', transition:'all .2s' },
  periodOn: { borderColor:'#C8922A', background:'#FDF3E0' },
  stakeRow: { display:'flex', gap:8 },
  stakeBtn: { flex:1, background:'#fff', border:'1.5px solid #E0D5C0',
    borderRadius:10, padding:'10px 0', fontSize:14, fontWeight:500,
    cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  stakeOn: { borderColor:'#C8922A', background:'#FDF3E0', color:'#7A5A18', fontWeight:700 },
  charityBtn: { background:'#fff', border:'1px solid #E0D5C0', borderRadius:10,
    padding:'10px 12px', fontSize:13, cursor:'pointer', textAlign:'left',
    fontFamily:'Noto Sans SC,sans-serif' },
  charityOn: { borderColor:'#3B7A4A', background:'#E8F5EC', color:'#1A4A28', fontWeight:500 },
  verifyOpt: { display:'flex', alignItems:'center', gap:12, padding:12,
    border:'1.5px solid #E0D5C0', borderRadius:10, marginBottom:8,
    cursor:'pointer', background:'#fff' },
  verifyOn: { borderColor:'#C8922A', background:'#FDF3E0' },
  pubBtn: { flex:1, padding:'9px 8px', border:'1px solid #E0D5C0',
    borderRadius:20, fontSize:12, cursor:'pointer', background:'#fff',
    fontFamily:'Noto Sans SC,sans-serif' },
  pubOn: { borderColor:'#C8922A', background:'#FDF3E0', color:'#7A5A18', fontWeight:500 },
  notice: { background:'#FDF3E0', border:'1px solid rgba(200,146,42,.3)',
    borderRadius:12, padding:12, marginBottom:16 },
  btnGold: { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff',
    border:'none', borderRadius:12, fontWeight:700, cursor:'pointer',
    fontFamily:'Noto Sans SC,sans-serif', letterSpacing:.5 },
}
