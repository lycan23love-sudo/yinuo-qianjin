// src/pages/BlindBetPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { placeBlindBet, getMyBlindBets } from '../lib/supabase'

export default function BlindBetPage() {
  const { session, profile, refreshProfile } = useAuth()
  const nav = useNavigate()

  const [amount, setAmount]     = useState(50)
  const [betting, setBetting]   = useState(false)
  const [result, setResult]     = useState(null)
  const [myBets, setMyBets]     = useState([])
  const [tab, setTab]           = useState('bet')
  const [toast, setToast]       = useState(null)

  function showToast(msg, type='info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    if (session?.user?.id) {
      getMyBlindBets(session.user.id).then(setMyBets).catch(() => {})
    }
  }, [session])

  async function handleBet() {
    if (!session?.user?.id) { showToast('请先登录', 'error'); return }
    setBetting(true)
    setResult(null)
    try {
      const res = await placeBlindBet(session.user.id, amount)
      setResult(res)
      refreshProfile()
      showToast(`结缘成功！匹配了${res.splits.length}个誓言，额外获得${res.honorGain}荣誉积分 ✨`, 'success')
      getMyBlindBets(session.user.id).then(setMyBets).catch(() => {})
    } catch (err) {
      showToast(err.message || '结缘失败', 'error')
    } finally { setBetting(false) }
  }

  return (
    <div style={{ background:'linear-gradient(180deg,#1A0A2A,#0D0D18)',
      minHeight:'100vh', paddingBottom:'calc(90px + env(safe-area-inset-bottom))' }}>

      {toast && (
        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
          background: toast.type === 'error' ? '#C84040' : toast.type === 'success' ? '#3B7A4A' : 'rgba(255,255,255,.12)',
          color:'#fff', padding:'9px 20px', borderRadius:20, fontSize:13,
          zIndex:200, whiteSpace:'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* 顶栏 */}
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={{ fontSize:16, fontWeight:700, color:'#fff' }}>🎲 盲盒结缘</div>
        <div style={{ width:32 }} />
      </div>

      {/* Tab */}
      <div style={S.tabRow}>
        <button style={{ ...S.tab, ...(tab === 'bet' ? S.tabOn : {}) }}
          onClick={() => setTab('bet')}>一键结缘</button>
        <button style={{ ...S.tab, ...(tab === 'history' ? S.tabOn : {}) }}
          onClick={() => setTab('history')}>结缘记录</button>
      </div>

      <div style={{ padding:'16px' }}>

        {tab === 'bet' && (
          <div>
            {/* 说明卡片 */}
            <div style={S.infoCard}>
              <div style={{ fontSize:32, textAlign:'center', marginBottom:12 }}>🎲</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#E8B84A',
                textAlign:'center', marginBottom:8 }}>功德盲盒 · 机选结缘</div>
              <div style={{ fontSize:12, color:'#aaa', lineHeight:1.7, textAlign:'center' }}>
                系统自动匹配全网最冷门、最需要支持的誓言，<br />
                你的金币将拆分给他们，默默为陌生人加油。<br />
                <span style={{ color:'#E8B84A' }}>机选用户享 1.2 倍荣誉积分加成 ✨</span>
              </div>
            </div>

            {/* 金额选择 */}
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>选择结缘金额</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                {[30, 50, 100, 200, 500].map(a => (
                  <button key={a} onClick={() => setAmount(a)}
                    style={{ flex:1, padding:'12px 0', borderRadius:10, fontSize:14,
                      fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif',
                      background: amount === a ? 'linear-gradient(135deg,#6A3ACA,#9A5AFA)' : '#222',
                      color: amount === a ? '#fff' : '#aaa',
                      border: amount === a ? '1px solid #9A5AFA' : '1px solid #333',
                      minWidth:56 }}>
                    {a}
                  </button>
                ))}
              </div>

              <div style={{ fontSize:12, color:'#666', marginBottom:20 }}>
                当前余额：{profile?.merit_coins ?? 0} 金币 · 荣誉积分：{profile?.honor_points ?? 0}
              </div>

              {/* 结缘按钮 */}
              <button onClick={handleBet} disabled={betting}
                style={{ width:'100%', padding:'16px 0', borderRadius:14, border:'none',
                  background: betting ? '#444' : 'linear-gradient(135deg,#6A3ACA,#9A5AFA,#E8B84A)',
                  color:'#fff', fontSize:16, fontWeight:700, cursor: betting ? 'default' : 'pointer',
                  fontFamily:'Noto Sans SC,sans-serif', letterSpacing:1,
                  boxShadow: betting ? 'none' : '0 6px 24px rgba(154,90,250,.4)',
                  opacity: betting ? .7 : 1 }}>
                {betting ? '🎲 匹配中…' : '🎲 一键结缘'}
              </button>
            </div>

            {/* 结缘结果 */}
            {result && (
              <div style={{ marginTop:20, background:'rgba(154,90,250,.1)',
                border:'1px solid rgba(154,90,250,.3)', borderRadius:14, padding:16 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#E8B84A', marginBottom:12 }}>
                  🎉 结缘成功！匹配了{result.splits.length}个誓言
                </div>
                {result.splits.map((s, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
                    padding:'8px 0', borderBottom: i < result.splits.length - 1 ? '0.5px solid rgba(255,255,255,.1)' : 'none' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'#2A1A3A',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                      🤝
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:'#fff', overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                        支持 {s.amount} 金币
                      </div>
                    </div>
                    <button onClick={() => nav(`/pledge/${s.pledge_id}?tab=witness`)}
                      style={{ background:'rgba(154,90,250,.2)', color:'#9A5AFA', border:'none',
                        borderRadius:16, padding:'4px 10px', fontSize:11, cursor:'pointer' }}>
                      查看 ›
                    </button>
                  </div>
                ))}
                <div style={{ textAlign:'center', fontSize:12, color:'#E8B84A', marginTop:10 }}>
                  +{result.honorGain} 荣誉积分（1.2倍加成）
                </div>
              </div>
            )}
          </div>
        )}

        {/* 结缘记录 */}
        {tab === 'history' && (
          <div>
            {myBets.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>🎲</div>
                <div style={{ fontSize:13, color:'#888' }}>还没有结缘记录</div>
                <button onClick={() => setTab('bet')}
                  style={{ marginTop:12, background:'#9A5AFA', color:'#fff', border:'none',
                    borderRadius:10, padding:'8px 16px', fontSize:13, cursor:'pointer' }}>
                  去结缘
                </button>
              </div>
            ) : myBets.map(b => (
              <div key={b.id} style={S.historyCard}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>
                      🎲 机选结缘 · {b.total_amount} 金币
                    </div>
                    <div style={{ fontSize:11, color:'#666', marginTop:4 }}>
                      匹配 {(b.split_to || []).length} 个誓言 · {new Date(b.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'#E8B84A' }}>
                    +{Math.round(b.total_amount * 0.2)} 荣誉
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  topbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px', paddingTop:'calc(12px + env(safe-area-inset-top))',
    background:'transparent', position:'sticky', top:0, zIndex:10,
  },
  back:     { background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#fff', padding:4, width:32 },
  tabRow:   { display:'flex', borderBottom:'1px solid #222' },
  tab:      { flex:1, padding:'10px 0', fontSize:13, fontWeight:500, color:'#666',
              background:'none', border:'none', borderBottom:'2px solid transparent',
              cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  tabOn:    { color:'#9A5AFA', borderBottomColor:'#9A5AFA', fontWeight:700 },
  infoCard: { background:'rgba(154,90,250,.08)', border:'1px solid rgba(154,90,250,.2)',
              borderRadius:16, padding:20 },
  historyCard: { background:'#1A1A24', borderRadius:12, padding:14, marginBottom:8,
                 border:'1px solid #2A2A34' },
}
