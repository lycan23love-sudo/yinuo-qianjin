// src/pages/IndexHallPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getIndexFunds, placeIndexBet, getMyIndexBets } from '../lib/supabase'

const DIR_LABEL = { believe:'看多 📈', doubt:'看空 📉' }
const STATUS_LABEL = { active:'进行中', won:'赢了', lost:'输了', settled:'已结算' }
const STATUS_COLOR = { active:'#C8922A', won:'#3B7A4A', lost:'#C84040', settled:'#9A8A70' }

export default function IndexHallPage() {
  const { session, profile } = useAuth()
  const nav = useNavigate()

  const [funds, setFunds]       = useState([])
  const [myBets, setMyBets]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('market')  // market / mybets

  // 下注面板状态
  const [betTarget, setBetTarget]     = useState(null)  // { code, name, emoji }
  const [betDir, setBetDir]           = useState('')    // believe / doubt
  const [betAmount, setBetAmount]     = useState(50)
  const [betting, setBetting]         = useState(false)

  // toast
  const [toast, setToast] = useState(null)
  function showToast(msg, type='info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const f = await getIndexFunds()
      setFunds(f)
      if (session?.user?.id) {
        const b = await getMyIndexBets(session.user.id)
        setMyBets(b)
      }
    } catch {} finally { setLoading(false) }
  }

  function openBet(fund) {
    setBetTarget(fund)
    setBetDir('')
    setBetAmount(50)
  }

  async function handleBet() {
    if (!betDir) { showToast('请选择看多或看空', 'error'); return }
    if (!session?.user?.id) { showToast('请先登录', 'error'); return }
    setBetting(true)
    try {
      await placeIndexBet(session.user.id, betTarget.code, betDir, betAmount)
      showToast(`${betDir === 'believe' ? '看多' : '看空'} ${betTarget.code} 成功！押注${betAmount}金币`, 'success')
      setBetTarget(null)
      loadData()
    } catch (err) {
      showToast(err.message || '下注失败', 'error')
    } finally { setBetting(false) }
  }

  // 涨跌幅
  function change(f) {
    if (!f.prev_ratio || f.prev_ratio === 0) return 0
    return ((f.live_ratio - f.prev_ratio) / f.prev_ratio * 100).toFixed(1)
  }

  return (
    <div style={{ background:'#0D0D12', minHeight:'100vh',
      paddingBottom:'calc(90px + env(safe-area-inset-bottom))' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
          background: toast.type === 'error' ? '#C84040' : toast.type === 'success' ? '#3B7A4A' : 'rgba(255,255,255,.15)',
          color:'#fff', padding:'9px 20px', borderRadius:20, fontSize:13,
          zIndex:300, whiteSpace:'nowrap', backdropFilter:'blur(12px)' }}>
          {toast.msg}
        </div>
      )}

      {/* 下注弹窗 */}
      {betTarget && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex',
          flexDirection:'column', justifyContent:'flex-end' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.6)' }}
            onClick={() => setBetTarget(null)} />
          <div style={{ position:'relative', background:'#1A1A24', borderRadius:'20px 20px 0 0',
            padding:'20px 20px calc(24px + env(safe-area-inset-bottom))' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#fff' }}>
                {betTarget.emoji} {betTarget.name}（{betTarget.code}）
              </div>
              <button onClick={() => setBetTarget(null)}
                style={{ background:'none', border:'none', color:'#666', fontSize:22, cursor:'pointer' }}>×</button>
            </div>

            {/* 方向选择 */}
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <button onClick={() => setBetDir('believe')}
                style={{ ...S.dirBtn,
                  background: betDir === 'believe' ? '#1A3A1A' : '#1A1A24',
                  border: betDir === 'believe' ? '1.5px solid #3B7A4A' : '1px solid #333',
                  color: betDir === 'believe' ? '#5ACA6A' : '#888' }}>
                📈 看多（支持）
              </button>
              <button onClick={() => setBetDir('doubt')}
                style={{ ...S.dirBtn,
                  background: betDir === 'doubt' ? '#3A1A1A' : '#1A1A24',
                  border: betDir === 'doubt' ? '1.5px solid #C84040' : '1px solid #333',
                  color: betDir === 'doubt' ? '#FF6A6A' : '#888' }}>
                📉 看空（质疑）
              </button>
            </div>

            {/* 金额选择 */}
            <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>押注金额</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {[10, 30, 50, 100, 200].map(a => (
                <button key={a} onClick={() => setBetAmount(a)}
                  style={{ padding:'8px 16px', borderRadius:8, fontSize:13, cursor:'pointer',
                    fontFamily:'Noto Sans SC,sans-serif',
                    background: betAmount === a ? '#C8922A' : '#222',
                    color: betAmount === a ? '#fff' : '#aaa',
                    border: betAmount === a ? '1px solid #C8922A' : '1px solid #333' }}>
                  {a}
                </button>
              ))}
            </div>

            {/* 余额提示 */}
            <div style={{ fontSize:12, color:'#666', marginBottom:14 }}>
              当前余额：{profile?.merit_coins ?? 0} 金币
            </div>

            <button onClick={handleBet} disabled={betting || !betDir}
              style={{ width:'100%', padding:'14px 0', borderRadius:12, border:'none',
                background: !betDir ? '#333' : betDir === 'believe'
                  ? 'linear-gradient(135deg,#2A6A2A,#3B9A3B)'
                  : 'linear-gradient(135deg,#8A2A2A,#C84040)',
                color:'#fff', fontSize:15, fontWeight:700, cursor: betting ? 'default' : 'pointer',
                fontFamily:'Noto Sans SC,sans-serif', opacity: betting ? .6 : 1 }}>
              {betting ? '下注中…' : !betDir ? '请先选择方向' : `确认${betDir === 'believe' ? '看多' : '看空'} · ${betAmount}金币`}
            </button>
          </div>
        </div>
      )}

      {/* 顶栏 */}
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={{ fontSize:16, fontWeight:700, color:'#fff' }}>📊 自律指数大厅</div>
        <div style={{ width:32 }} />
      </div>

      {/* Tab */}
      <div style={S.tabRow}>
        <button style={{ ...S.tab, ...(tab === 'market' ? S.tabOn : {}) }}
          onClick={() => setTab('market')}>大盘行情</button>
        <button style={{ ...S.tab, ...(tab === 'mybets' ? S.tabOn : {}) }}
          onClick={() => setTab('mybets')}>我的持仓</button>
      </div>

      <div style={{ padding:'12px 16px' }}>

        {/* ── 大盘行情 ── */}
        {tab === 'market' && (
          <div>
            {/* 说明 */}
            <div style={{ background:'rgba(200,146,42,.1)', borderRadius:12, padding:'10px 14px',
              marginBottom:14, border:'1px solid rgba(200,146,42,.2)' }}>
              <div style={{ fontSize:12, color:'#C8922A', lineHeight:1.7 }}>
                💡 四大自律指数基于全网真实打卡数据计算。看多 = 相信大家能坚持，看空 = 认为坚持率会下降。每日结算。
              </div>
            </div>

            {loading && <div style={{ textAlign:'center', color:'#666', padding:40 }}>加载中…</div>}

            {funds.map(f => {
              const chg = change(f)
              const isUp = chg >= 0
              const bullPool = f.total_bull_pool || 0
              const bearPool = f.total_bear_pool || 0
              const total = bullPool + bearPool
              const bullPct = total > 0 ? Math.round(bullPool / total * 100) : 50

              return (
                <div key={f.code} style={S.fundCard}>
                  {/* 头部 */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ fontSize:28 }}>{f.emoji}</div>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{f.code}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{f.name}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:20, fontWeight:700, fontFamily:'monospace',
                        color: isUp ? '#5ACA6A' : '#FF6A6A' }}>
                        {(f.live_ratio * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize:11, color: isUp ? '#5ACA6A' : '#FF6A6A' }}>
                        {isUp ? '▲' : '▼'} {Math.abs(chg)}%
                      </div>
                    </div>
                  </div>

                  {/* 指标行 */}
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    <div style={S.metric}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#5ACA6A' }}>{bullPool}</div>
                      <div style={{ fontSize:10, color:'#666' }}>多头池</div>
                    </div>
                    <div style={S.metric}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#FF6A6A' }}>{bearPool}</div>
                      <div style={{ fontSize:10, color:'#666' }}>空头池</div>
                    </div>
                    <div style={S.metric}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#C8922A' }}>{f.total_pledges || 0}</div>
                      <div style={{ fontSize:10, color:'#666' }}>成分股</div>
                    </div>
                    <div style={S.metric}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#fff' }}>×{Number(f.bull_odds || 2).toFixed(1)}</div>
                      <div style={{ fontSize:10, color:'#666' }}>赔率</div>
                    </div>
                  </div>

                  {/* 多空比例条 */}
                  <div style={{ display:'flex', height:6, borderRadius:3, overflow:'hidden', background:'#222', marginBottom:12 }}>
                    <div style={{ width:`${bullPct}%`, background:'#3B7A4A', transition:'width .3s' }} />
                    <div style={{ width:`${100 - bullPct}%`, background:'#C84040', transition:'width .3s' }} />
                  </div>

                  {/* 迷你 K 线占位（MVP 用静态色块示意） */}
                  <div style={{ display:'flex', gap:2, height:24, alignItems:'flex-end', marginBottom:12 }}>
                    {Array.from({ length: 14 }).map((_, i) => {
                      const h = 8 + Math.random() * 16
                      return (
                        <div key={i} style={{ flex:1, height:h, borderRadius:2,
                          background: Math.random() > 0.4
                            ? 'rgba(90,202,106,.4)' : 'rgba(255,106,106,.3)' }} />
                      )
                    })}
                  </div>

                  {/* 下注按钮 */}
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => { openBet(f); setBetDir('believe') }}
                      style={{ ...S.betBtn, background:'#1A3A1A', color:'#5ACA6A', border:'1px solid #2A5A2A' }}>
                      📈 看多
                    </button>
                    <button onClick={() => { openBet(f); setBetDir('doubt') }}
                      style={{ ...S.betBtn, background:'#3A1A1A', color:'#FF6A6A', border:'1px solid #5A2A2A' }}>
                      📉 看空
                    </button>
                  </div>
                </div>
              )
            })}

            {/* 说明 */}
            <div style={{ fontSize:11, color:'#555', lineHeight:1.7, marginTop:8, padding:'0 4px' }}>
              * 成活率 = 过去24h该板块打卡成功率<br />
              * 赔率 = (多头池+空头池) / 你的方向池<br />
              * 每日 00:00 结算，猜对方向获得赔率倍数金币<br />
              * 金币不可提现，仅用于功德/称号/慈善
            </div>
          </div>
        )}

        {/* ── 我的持仓 ── */}
        {tab === 'mybets' && (
          <div>
            {loading && <div style={{ textAlign:'center', color:'#666', padding:40 }}>加载中…</div>}

            {!loading && myBets.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📊</div>
                <div style={{ fontSize:14, color:'#888', marginBottom:12 }}>还没有下注记录</div>
                <button onClick={() => setTab('market')}
                  style={{ background:'#C8922A', color:'#fff', border:'none', borderRadius:10,
                    padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  去大盘看看
                </button>
              </div>
            )}

            {myBets.map(b => (
              <div key={b.id} style={S.betRecord}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>
                      {b.index_code}
                      <span style={{ fontSize:11, marginLeft:8,
                        color: b.direction === 'believe' ? '#5ACA6A' : '#FF6A6A' }}>
                        {DIR_LABEL[b.direction]}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:'#666', marginTop:4 }}>
                      押注 {b.amount} 金币 · 赔率 ×{Number(b.odds_at_bet || 2).toFixed(1)} · {b.bet_date}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:20,
                      background: STATUS_COLOR[b.status] + '25',
                      color: STATUS_COLOR[b.status] }}>
                      {STATUS_LABEL[b.status] || b.status}
                    </div>
                    {b.payout > 0 && (
                      <div style={{ fontSize:11, color:'#5ACA6A', marginTop:4 }}>+{b.payout} 金币</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ height:16 }} />
      </div>
    </div>
  )
}

const S = {
  topbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px',
    paddingTop:'calc(12px + env(safe-area-inset-top))',
    background:'#0D0D12', position:'sticky', top:0, zIndex:10,
    borderBottom:'1px solid #222',
  },
  back:     { background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#fff', padding:4, width:32 },
  tabRow:   { display:'flex', background:'#0D0D12', borderBottom:'1px solid #222', position:'sticky', top:52, zIndex:9 },
  tab:      { flex:1, padding:'10px 0', fontSize:13, fontWeight:500, color:'#666',
              background:'none', border:'none', borderBottom:'2px solid transparent',
              cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  tabOn:    { color:'#C8922A', borderBottomColor:'#C8922A', fontWeight:700 },
  fundCard: { background:'#1A1A24', borderRadius:16, padding:16, marginBottom:12,
              border:'1px solid #2A2A34' },
  metric:   { flex:1, background:'#111118', borderRadius:8, padding:'6px 8px', textAlign:'center' },
  betBtn:   { flex:1, padding:'10px 0', borderRadius:10, fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  dirBtn:   { flex:1, padding:'12px 0', borderRadius:10, fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif', textAlign:'center' },
  betRecord:{ background:'#1A1A24', borderRadius:12, padding:14, marginBottom:8,
              border:'1px solid #2A2A34' },
}
