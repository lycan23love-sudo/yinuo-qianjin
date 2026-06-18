// src/pages/CheckinSuccess.jsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function CheckinSuccess() {
  const { state } = useLocation()
  const nav = useNavigate()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!state) { nav('/'); return }
    setTimeout(() => setShow(true), 100)
  }, [])

  if (!state) return null
  const { result, pledge } = state
  const { totalCoins, streak, dayNum } = result

  return (
    <div style={{ minHeight:'100vh', background:'#FAF7F2', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'32px 24px' }}>

      {/* Ring */}
      <div style={{
        width:120, height:120, borderRadius:'50%',
        background:'linear-gradient(135deg,#FDF3E0,#fff)',
        border:'4px solid #C8922A',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 0 0 8px #FDF3E0, 0 8px 32px rgba(200,146,42,.25)',
        marginBottom:20,
        animation: show ? 'ringPop .6s cubic-bezier(.34,1.56,.64,1) both' : 'none',
      }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:40,
            fontWeight:900, color:'#C8922A', lineHeight:1 }}>
            {dayNum}
          </div>
          <div style={{ fontSize:12, color:'#9A8A70', marginTop:2 }}>天</div>
        </div>
      </div>

      <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:22, fontWeight:900,
        color:'#1A1208', marginBottom:6, textAlign:'center' }}>
        第{dayNum}天，打卡成功！
      </div>
      <div style={{ fontSize:13, color:'#9A8A70', textAlign:'center',
        lineHeight:1.6, marginBottom:28 }}>
        {streak > 1 ? `连续${streak}天 🔥 · ` : ''}今日获得 {totalCoins} 金币
      </div>

      {/* Coins */}
      <div style={{ background:'#FDF3E0', borderRadius:14, padding:'14px 24px',
        marginBottom:24, textAlign:'center' }}>
        <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:32, fontWeight:900,
          color:'#C8922A', marginBottom:4 }}>
          +{totalCoins}
        </div>
        <div style={{ fontSize:12, color:'#9A8A70' }}>金币入账 · 已进入公益账户</div>
      </div>

      {/* Achievements */}
      {streak >= 7 && (
        <div style={achCard}>
          <span style={{ fontSize:20 }}>🔥</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>连续{streak}天达成</div>
            <div style={{ fontSize:11, color:'#9A8A70' }}>连续奖励+{streak>=14?30:20}金币</div>
          </div>
        </div>
      )}
      {[7,14,21,28].includes(dayNum) && (
        <div style={achCard}>
          <span style={{ fontSize:20 }}>🏆</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>里程碑达成！</div>
            <div style={{ fontSize:11, color:'#9A8A70' }}>额外奖励+100金币</div>
          </div>
        </div>
      )}

      <button style={{ ...S.btnGold, width:'100%', padding:14, fontSize:15, marginBottom:10 }}
        onClick={() => nav('/')}>
        返回首页
      </button>
      <button style={{ ...S.btnGhost, width:'100%', padding:14, fontSize:15 }}
        onClick={() => nav(`/pledge/${state.result?.checkin?.pledge_id}`)}>
        查看打卡记录
      </button>

      <style>{`
        @keyframes ringPop {
          from { transform:scale(0); opacity:0 }
          to   { transform:scale(1); opacity:1 }
        }
      `}</style>
    </div>
  )
}

const achCard = {
  display:'flex', alignItems:'center', gap:12, background:'#fff',
  border:'0.5px solid #E0D5C0', borderRadius:12, padding:12,
  marginBottom:8, width:'100%'
}

const S = {
  btnGold: { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff',
    border:'none', borderRadius:12, fontWeight:700, cursor:'pointer',
    fontFamily:'Noto Sans SC,sans-serif' },
  btnGhost: { background:'#fff', color:'#5A4A30', border:'1px solid #E0D5C0',
    borderRadius:12, fontWeight:500, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
}
