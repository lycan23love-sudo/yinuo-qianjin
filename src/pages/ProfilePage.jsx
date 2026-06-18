// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getCoinLedger, getDonations, getMeritTitle, signOut } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

export default function ProfilePage() {
  const { profile, session, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [ledger, setLedger] = useState([])
  const [donations, setDonations] = useState([])
  const [tab, setTab] = useState('coins')

  useEffect(() => {
    if (session) {
      getCoinLedger(session.user.id, 30).then(setLedger)
      getDonations(session.user.id).then(setDonations)
    }
  }, [session])

  const title = profile ? getMeritTitle(profile.total_merit) : { emoji:'🌱', title:'初心者', next:500 }
  const merit = profile?.total_merit ?? 0
  const progressPct = title.next ? Math.round((merit / title.next) * 100) : 100

  async function handleSignOut() {
    await signOut()
    nav('/auth')
  }

  const TYPE_LABELS = {
    checkin: '打卡奖励', stake: '立誓押注', stake_refund: '誓言完成返还',
    donate: '公益捐款', reward_streak: '连续奖励', reward_milestone: '里程碑奖励',
    reward_team: '团队奖励', gift_register: '注册赠送',
    witness_earn: '见证收益', question_cost: '提问消耗',
  }

  return (
    <div style={{ paddingBottom:80 }}>
      <div style={S.topbar}>
        <button style={S.back} onClick={() => nav(-1)}>←</button>
        <div style={S.title}>个人中心</div>
        <button style={S.logoutBtn} onClick={handleSignOut}>退出</button>
      </div>

      {/* Profile hero */}
      <div style={S.hero}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          <div style={S.avatar}>
            {profile?.nickname?.[0] ?? '?'}
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#fff',
              fontFamily:'Noto Serif SC,serif' }}>{profile?.nickname ?? '立誓者'}</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.55)', marginTop:3 }}>
              {title.emoji} {title.title}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
          {[
            { val: (profile?.merit_coins ?? 0).toLocaleString(), lbl:'公益金币' },
            { val: profile?.completed_count ?? 0, lbl:'完成誓言' },
            { val: merit.toLocaleString(), lbl:'功德值' },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={S.statBox}>
              <div style={{ fontSize:17, fontWeight:700, color:'#E8B84A' }}>{val}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:2 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Merit progress */}
        {title.next && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between',
              fontSize:11, color:'rgba(255,255,255,.45)', marginBottom:5 }}>
              <span>距「{getMeritTitle(title.next + 1).title}」</span>
              <span>{merit} / {title.next}</span>
            </div>
            <div style={{ background:'rgba(255,255,255,.15)', borderRadius:3, height:5, overflow:'hidden' }}>
              <div style={{ width:`${Math.min(100, progressPct)}%`, height:'100%',
                background:'#E8B84A', borderRadius:3, transition:'width .5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabRow}>
        <button style={{ ...S.tab, ...(tab==='coins'?S.tabOn:{}) }} onClick={() => setTab('coins')}>
          金币流水
        </button>
        <button style={{ ...S.tab, ...(tab==='donations'?S.tabOn:{}) }} onClick={() => setTab('donations')}>
          捐款记录
        </button>
        <button style={{ ...S.tab, ...(tab==='certs'?S.tabOn:{}) }} onClick={() => setTab('certs')}>
          证书
        </button>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        {/* Coins ledger */}
        {tab === 'coins' && (
          ledger.length === 0
            ? <div style={S.empty}>暂无金币记录</div>
            : ledger.map(item => (
                <div key={item.id} style={S.ledgerRow}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>
                      {TYPE_LABELS[item.type] ?? item.type}
                    </div>
                    {item.note && (
                      <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>{item.note}</div>
                    )}
                    <div style={{ fontSize:10, color:'#C0B090', marginTop:2 }}>
                      {format(parseISO(item.created_at), 'M月d日 HH:mm')}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:14, fontWeight:700,
                      color: item.amount > 0 ? '#3B7A4A' : '#C84040' }}>
                      {item.amount > 0 ? '+' : ''}{item.amount}
                    </div>
                    <div style={{ fontSize:10, color:'#9A8A70' }}>余额 {item.balance_after}</div>
                  </div>
                </div>
              ))
        )}

        {/* Donations */}
        {tab === 'donations' && (
          donations.length === 0
            ? <div style={S.empty}>暂无捐款记录</div>
            : donations.map(d => (
                <div key={d.id} style={S.ledgerRow}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{d.org_name}</div>
                    {d.message && (
                      <div style={{ fontSize:11, color:'#9A8A70', marginTop:2,
                        fontStyle:'italic' }}>「{d.message}」</div>
                    )}
                    <div style={{ fontSize:10, color:'#C0B090', marginTop:2 }}>
                      {format(parseISO(d.created_at), 'M月d日')} ·
                      {d.source === 'pledge_fail' ? ' 誓言捐出' : ' 主动捐款'}
                    </div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#C84040' }}>
                    -{d.coins}
                  </div>
                </div>
              ))
        )}

        {/* Certs */}
        {tab === 'certs' && (
          <div>
            {[
              { threshold:500,   emoji:'🌿', name:'初级善行证书', desc:'可下载电子版' },
              { threshold:5000,  emoji:'🔵', name:'中级功德证书', desc:'含机构公章' },
              { threshold:50000, emoji:'🪷', name:'至高菩萨证书', desc:'区块链存证' },
            ].map(cert => {
              const earned = merit >= cert.threshold
              return (
                <div key={cert.name} style={{ ...S.certCard, opacity: earned ? 1 : .6 }}>
                  <div style={{ fontSize:28 }}>{cert.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{cert.name}</div>
                    <div style={{ fontSize:11, color:'#9A8A70', marginTop:2 }}>{cert.desc}</div>
                    {!earned && (
                      <div style={{ fontSize:11, color:'#C8922A', marginTop:4 }}>
                        还差 {cert.threshold - merit} 功德值
                      </div>
                    )}
                  </div>
                  {earned && (
                    <div style={{ background:'#E8F5EC', color:'#3B7A4A',
                      fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:20 }}>
                      已获得
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
  logoutBtn: { background:'none', border:'none', color:'#C84040', fontSize:13,
    cursor:'pointer', fontFamily:'Noto Sans SC,sans-serif' },
  hero: { background:'linear-gradient(135deg,#2A1A08,#3A2510)', padding:18, margin:16, borderRadius:16 },
  avatar: { width:56, height:56, borderRadius:'50%',
    background:'linear-gradient(135deg,#C8922A,#E8B84A)',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:22, fontWeight:700, color:'#fff', fontFamily:'Noto Serif SC,serif' },
  statBox: { background:'rgba(255,255,255,.08)', borderRadius:8, padding:'8px 10px', textAlign:'center' },
  tabRow: { display:'flex', borderBottom:'0.5px solid #E0D5C0', background:'#FAF7F2' },
  tab: { flex:1, padding:'10px 0', fontSize:13, fontWeight:500, color:'#9A8A70',
    background:'none', border:'none', borderBottom:'2px solid transparent', cursor:'pointer' },
  tabOn: { color:'#C8922A', borderBottomColor:'#C8922A' },
  ledgerRow: { display:'flex', alignItems:'center', gap:12, padding:'12px 0',
    borderBottom:'0.5px solid #F0EAE0' },
  certCard: { display:'flex', alignItems:'center', gap:12, background:'#fff',
    border:'0.5px solid #E0D5C0', borderRadius:12, padding:14, marginBottom:10 },
  empty: { textAlign:'center', color:'#9A8A70', padding:32 },
}
