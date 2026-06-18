// src/pages/SquarePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicPledges } from '../lib/supabase'
import { differenceInDays, parseISO } from 'date-fns'

export default function SquarePage() {
  const [pledges, setPledges] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    getPublicPledges().then(data => { setPledges(data); setLoading(false) })
  }, [])

  return (
    <div style={{ paddingBottom:80 }}>
      <div style={S.topbar}>
        <div style={S.logo}>广<em style={{ color:'#C8922A', fontStyle:'normal' }}>场</em></div>
      </div>
      <div style={{ padding:'0 16px' }}>
        <div style={{ fontSize:12, color:'#9A8A70', margin:'12px 0 14px' }}>
          正在进行中的承诺 · {pledges.length} 个
        </div>
        {loading && <div style={S.empty}>加载中…</div>}
        {!loading && pledges.length === 0 && (
          <div style={S.empty}>广场还没有公开的誓言，成为第一个吧！</div>
        )}
        {pledges.map(p => {
          const pct = Math.round((p.checkin_count?.[0]?.count ?? 0) / p.total_days * 100)
          const daysLeft = Math.max(0, differenceInDays(parseISO(p.end_date), new Date()))
          const witnessCount = p.witnesses?.[0]?.count ?? 0
          return (
            <div key={p.id} style={S.card} onClick={() => nav(`/pledge/${p.id}`)}>
              <div style={{ display:'flex', gap:10, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, fontFamily:'Noto Serif SC,serif',
                    marginBottom:4 }}>{p.title}</div>
                  <div style={{ fontSize:11, color:'#9A8A70' }}>
                    {p.profiles?.nickname ?? '立誓者'} · 还剩{daysLeft}天
                  </div>
                </div>
                <div style={{ background:'#FDF3E0', color:'#7A5A18',
                  fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:20,
                  height:'fit-content', flexShrink:0 }}>
                  {p.stake_coins}金币
                </div>
              </div>
              <div style={S.barWrap}>
                <div style={{ ...S.barFill, width:`${pct}%` }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between',
                marginTop:8, fontSize:11, color:'#9A8A70' }}>
                <span>{pct}% 完成</span>
                <span>👥 {witnessCount}人见证</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const S = {
  topbar: { display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px', borderBottom:'0.5px solid #E0D5C0',
    background:'#FAF7F2', position:'sticky', top:0, zIndex:10 },
  logo: { fontFamily:'Noto Serif SC,serif', fontSize:18, fontWeight:700, color:'#1A1208' },
  card: { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:14,
    padding:14, marginBottom:10, cursor:'pointer',
    boxShadow:'0 1px 6px rgba(26,18,8,.06)' },
  barWrap: { height:5, background:'#F0EAE0', borderRadius:3, overflow:'hidden' },
  barFill: { height:'100%', background:'linear-gradient(90deg,#C8922A,#E8B84A)', borderRadius:3 },
  empty: { textAlign:'center', color:'#9A8A70', padding:32 },
}
