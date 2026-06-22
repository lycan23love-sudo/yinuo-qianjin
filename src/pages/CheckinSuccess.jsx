// src/pages/CheckinSuccess.jsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

const QUOTES = [
    [1,  7,  '万事开头难，但你已经迈出了最难的一步。'],
    [8,  14, '第二周是最容易放弃的时候，而你没有。'],
    [15, 21, '超过一半了！坚持到这里的人已经不多了。'],
    [22, 28, '最后的冲刺，你已经证明了自己。'],
    [29, 999,'走到这里的旅人，已经超过了95%的人。'],
  ]

function getQuote(day) {
    return QUOTES.find(([a, b]) => day >= a && day <= b)?.[2] ?? '每一天的坚持都是对自己的承诺。'
}

export default function CheckinSuccess() {
    const { state } = useLocation()
    const nav = useNavigate()
    const [show, setShow] = useState(false)
    const [coinsShow, setCoinsShow] = useState(false)

  useEffect(() => {
        if (!state) { nav('/'); return }
        setTimeout(() => setShow(true), 100)
        setTimeout(() => setCoinsShow(true), 600)
  }, [])

  if (!state) return null
    const { result, pledge } = state
    const { totalCoins, streak, dayNum } = result
    const pct = Math.min(100, Math.round((dayNum / (pledge?.total_days || 30)) * 100))
    const isMilestone = [7, 14, 21, 28].includes(dayNum)

  return (
        <div style={{ minHeight:'100vh', background:'#FAF7F2', display:'flex',
                           flexDirection:'column', alignItems:'center', justifyContent:'center',
                           padding:'32px 24px', overflow:'hidden' }}>

                <style>{`
                        @keyframes ringPop {
                                  from { transform:scale(0) rotate(-180deg); opacity:0 }
                                            to   { transform:scale(1) rotate(0deg); opacity:1 }
                                                    }
                                                            @keyframes coinBurst {
                                                                      0%   { transform:translate(0,0) scale(0); opacity:0 }
                                                                                40%  { opacity:1 }
                                                                                          100% { transform:translate(var(--tx,0),var(--ty,-80px)) scale(1); opacity:0 }
                                                                                                  }
                                                                                                          @keyframes fadeUp {
                                                                                                                    from { transform:translateY(20px); opacity:0 }
                                                                                                                              to   { transform:translateY(0); opacity:1 }
                                                                                                                                      }
                                                                                                                                              @keyframes pulse {
                                                                                                                                                        0%,100% { box-shadow:0 0 0 0 rgba(200,146,42,.4) }
                                                                                                                                                                  50%      { box-shadow:0 0 0 16px rgba(200,146,42,0) }
                                                                                                                                                                          }
                                                                                                                                                                                `}
                </style>
        
              <div style={{
                  width:130, height:130, borderRadius:'50%',
                  background:'linear-gradient(135deg,#FDF3E0,#fff)',
                  border:'4px solid #C8922A',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 0 0 10px rgba(200,146,42,.1), 0 12px 40px rgba(200,146,42,.3)',
                  marginBottom:20, position:'relative',
                  animation: show ? 'ringPop .7s cubic-bezier(.34,1.56,.64,1) both, pulse 2s 1s ease-in-out infinite' : 'none',
        }}>
                      <svg style={{ position:'absolute', inset:-8, width:'calc(100% + 16px)', height:'calc(100% + 16px)' }} viewBox="0 0 148 148">
                                <circle cx={74} cy={74} r={68} fill="none" stroke="rgba(200,146,42,.15)" strokeWidth={4}/>
                                <circle cx={74} cy={74} r={68} fill="none" stroke="#E8B84A" strokeWidth={4}
                                              strokeDasharray={`${(pct/100)*427} 427`} strokeLinecap="round" transform="rotate(-90 74 74)"/>
                      </svg>
                      <div style={{ textAlign:'center', zIndex:1 }}>
                                <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:44, fontWeight:900, color:'#C8922A', lineHeight:1 }}>{dayNum}</div>
                                <div style={{ fontSize:13, color:'#9A8A70', marginTop:2 }}>天</div>
                      </div>
                {coinsShow && [0,45,90,135,180,225,270,315].map((angle, i) => {
                    const rad = angle * Math.PI / 180
                                const tx = Math.round(Math.cos(rad) * 70)
                                            const ty = Math.round(Math.sin(rad) * 70)
                                                        return (
                                                                      <div key={i} style={{
                                                                                      position:'absolute', fontSize:16,
                                                                                      '--tx': `${tx}px`, '--ty': `${ty}px`,
                                                                                      animation:`coinBurst .8s ${i * 0.05}s ease-out both`,
                                                                      }}>🪙</div>
                                                                    )
        })}
              </div>
        
              <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:24, fontWeight:900,
                                   color:'#1A1208', marginBottom:6, textAlign:'center',
                                   animation: show ? 'fadeUp .5s .4s ease both' : 'none' }}>
                      第{dayNum}天，打卡成功！
              </div>
              <div style={{ fontSize:13, color:'#9A8A70', textAlign:'center', lineHeight:1.7,
                                   marginBottom:24, animation: show ? 'fadeUp .5s .5s ease both' : 'none' }}>
                {streak > 1 ? `连续${streak}天 🔥 · ` : ''}完成全程的{pct}%
              </div>
        
              <div style={{ background:'#FDF3E0', borderRadius:16, padding:'16px 32px',
                                   marginBottom:20, textAlign:'center',
                                   animation: coinsShow ? 'fadeUp .6s .6s ease both' : 'none', opacity: coinsShow ? 1 : 0 }}>
                      <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:36, fontWeight:900, color:'#C8922A', marginBottom:4 }}>+{totalCoins}</div>
                      <div style={{ fontSize:12, color:'#9A8A70' }}>金币入账 · 已进入公益账户</div>
              </div>
        
              <div style={{ width:'100%', marginBottom:20,
                                   animation: show ? 'fadeUp .5s .7s ease both' : 'none', opacity: show ? 1 : 0 }}>
                {streak > 1 && (
                    <div style={achCard}>
                                <span style={{ fontSize:22 }}>🔥</span>
                                <div style={{ flex:1 }}>
                                              <div style={{ fontSize:13, fontWeight:600 }}>连续打卡 {streak} 天</div>
                                              <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>
                                                {streak >= 7 ? `连续奖励+${streak>=14?30:20}金币` : `再坚持${7-streak}天解锁连续一周`}
                                              </div>
                                </div>
                      {streak >= 7 && <div style={tagGold}>×2奖励</div>}
                    </div>
                      )}
                {isMilestone && (
                    <div style={achCard}>
                                <span style={{ fontSize:22 }}>🏆</span>
                                <div style={{ flex:1 }}>
                                              <div style={{ fontSize:13, fontWeight:600 }}>里程碑达成！</div>
                                              <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>第{dayNum}天里程碑 · 额外奖励+100金币</div>
                                </div>
                                <div style={{ ...tagGold, background:'#E8F5EC', color:'#1A4A28' }}>+100</div>
                    </div>
                      )}
                      <div style={{ background:'rgba(200,146,42,.08)', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:8 }}>
                                <span style={{ fontSize:16 }}>✨</span>
                                <span style={{ fontSize:13, color:'#5A4A30', lineHeight:1.7, fontStyle:'italic' }}>
                                  {getQuote(dayNum)}
                                </span>
                      </div>
              </div>
        
              <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
                      <button style={S.btnGold} onClick={() => nav('/')}>返回首页</button>
                      <button style={S.btnGhost} onClick={() => nav(`/pledge/${result?.checkin?.pledge_id || ''}`)}>
                                查看打卡记录
                      </button>
              </div>
        </div>
      )
}

const achCard = {
    display:'flex', alignItems:'center', gap:12, background:'#fff',
    border:'0.5px solid #E0D5C0', borderRadius:12, padding:12, marginBottom:8, width:'100%'
}
  const tagGold = {
      background:'#FDF3E0', color:'#7A5A18', fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, flexShrink:0
  }
    const S = {
        btnGold: { background:'linear-gradient(135deg,#C8922A,#E8B84A)', color:'#fff', border:'none', borderRadius:12, fontWeight:700, cursor:'pointer', padding:'14px 0', fontSize:15, fontFamily:'Noto Sans SC,sans-serif', width:'100%', letterSpacing:.5 },
        btnGhost: { background:'#fff', color:'#5A4A30', border:'1px solid #E0D5C0', borderRadius:12, fontWeight:500, cursor:'pointer', padding:'14px 0', fontSize:15, fontFamily:'Noto Sans SC,sans-serif', width:'100%' },
    }
