// src/pages/JuryPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getPendingDisputes, castJuryVote } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

export default function JuryPage() {
  const { session } = useAuth()
  const nav = useNavigate()

  const [disputes, setDisputes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [voting, setVoting]     = useState(null)  // disputeId being voted on
  const [toast, setToast]       = useState(null)

  function showToast(msg, type='info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => { loadDisputes() }, [])

  async function loadDisputes() {
    setLoading(true)
    try {
      const data = await getPendingDisputes()
      setDisputes(data)
    } catch {} finally { setLoading(false) }
  }

  async function handleVote(disputeId, vote) {
    if (!session?.user?.id) { showToast('请先登录', 'error'); return }
    setVoting(disputeId)
    try {
      await castJuryVote(session.user.id, disputeId, vote)
      showToast(vote === 'upheld' ? '已投票：打卡有效 ✓' : '已投票：打卡无效 ✗', 'success')
      loadDisputes()
    } catch (err) {
      showToast(err.message || '投票失败', 'error')
    } finally { setVoting(null) }
  }

  return (
    <div style={{ background:'#FAF7F2', minHeight:'100vh',
      paddingBottom:'calc(90px + env(safe-area-inset-bottom))' }}>

      {toast && (
        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
          background: toast.type === 'error' ? '#C84040' : toast.type === 'success' ? '#3B7A4A' : 'rgba(26,18,8,.88)',
          color:'#fff', padding:'9px 20px', borderRadius:20, fontSize:13, zIndex:200 }}>
          {toast.msg}
        </div>
      )}

      {/* 顶栏 */}
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={{ fontSize:16, fontWeight:700 }}>⚖️ 赛博陪审团</div>
        <div style={{ width:32 }} />
      </div>

      {/* 说明 */}
      <div style={{ margin:'0 16px 12px', background:'#FDF3E0', borderRadius:12,
        padding:'10px 14px', border:'1px solid rgba(200,146,42,.2)' }}>
        <div style={{ fontSize:12, color:'#7A5A18', lineHeight:1.7 }}>
          ⚖️ 当有人质疑某次打卡的真实性时，系统将邀请陪审团裁定。
          你的投票将决定该打卡是否有效。请仔细查看证据后投票。
        </div>
      </div>

      <div style={{ padding:'0 16px' }}>
        {loading && <div style={{ textAlign:'center', color:'#9A8A70', padding:40 }}>加载中…</div>}

        {!loading && disputes.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⚖️</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1A1208', marginBottom:6 }}>
              当前没有待裁定的案件
            </div>
            <div style={{ fontSize:12, color:'#9A8A70', lineHeight:1.6 }}>
              当有人质疑他人的打卡真实性时，<br />案件会出现在这里等待你的裁定
            </div>
          </div>
        )}

        {disputes.map(d => {
          const checkin = d.checkins
          const pledgeTitle = checkin?.pledges?.title || '未知誓言'
          const isVoting = voting === d.id

          return (
            <div key={d.id} style={S.caseCard}>
              {/* 案件头部 */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'#FCEBEB',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  ⚠️
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>质疑「{pledgeTitle}」的打卡</div>
                  <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>
                    质疑者：{d.profiles?.nickname || '匿名'} · {format(parseISO(d.created_at), 'M月d日 HH:mm')}
                  </div>
                </div>
                <div style={{ background:'#FDF3E0', color:'#7A5A18', fontSize:10,
                  fontWeight:600, padding:'3px 8px', borderRadius:16, flexShrink:0 }}>
                  待裁定
                </div>
              </div>

              {/* 质疑理由 */}
              {d.reason && (
                <div style={{ background:'#FAF7F2', borderRadius:10, padding:'10px 12px',
                  marginBottom:12, borderLeft:'3px solid #C84040' }}>
                  <div style={{ fontSize:11, color:'#9A8A70', marginBottom:4 }}>质疑理由</div>
                  <div style={{ fontSize:13, color:'#3A2A18', lineHeight:1.6 }}>「{d.reason}」</div>
                </div>
              )}

              {/* 打卡证据 */}
              {checkin && (
                <div style={{ background:'#FAF7F2', borderRadius:10, padding:'10px 12px',
                  marginBottom:12 }}>
                  <div style={{ fontSize:11, color:'#9A8A70', marginBottom:4 }}>
                    被质疑的打卡 · 第{checkin.day_num}天
                  </div>
                  {checkin.image_url && (
                    <img src={checkin.image_url} alt="打卡截图"
                      style={{ width:'100%', borderRadius:8, maxHeight:150, objectFit:'cover', marginBottom:6 }} />
                  )}
                  {checkin.note && (
                    <div style={{ fontSize:12, color:'#5A4A30', fontStyle:'italic' }}>
                      「{checkin.note}」
                    </div>
                  )}
                </div>
              )}

              {/* 投票按钮 */}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => handleVote(d.id, 'upheld')} disabled={isVoting}
                  style={{ flex:1, padding:'11px 0', borderRadius:10, border:'none',
                    background:'#3B7A4A', color:'#fff', fontSize:14, fontWeight:600,
                    cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif',
                    opacity: isVoting ? .6 : 1 }}>
                  ✓ 打卡有效
                </button>
                <button onClick={() => handleVote(d.id, 'overturned')} disabled={isVoting}
                  style={{ flex:1, padding:'11px 0', borderRadius:10, border:'none',
                    background:'#C84040', color:'#fff', fontSize:14, fontWeight:600,
                    cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif',
                    opacity: isVoting ? .6 : 1 }}>
                  ✗ 打卡无效
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const S = {
  topbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px', paddingTop:'calc(12px + env(safe-area-inset-top))',
    background:'#FAF7F2', position:'sticky', top:0, zIndex:10,
    borderBottom:'0.5px solid #E0D5C0',
  },
  back:     { background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#1A1208', padding:4, width:32 },
  caseCard: { background:'#fff', borderRadius:14, padding:16, marginBottom:12,
              border:'0.5px solid #E0D5C0', boxShadow:'0 2px 8px rgba(26,18,8,.06)' },
}
