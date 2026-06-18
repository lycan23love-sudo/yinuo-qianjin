// src/components/BottomNav.jsx
import { useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  { path:'/',        icon:'🏠', label:'我的' },
  { path:'/square',  icon:'🌐', label:'广场' },
  { path:'/new',     icon:'✨', label:'立誓', gold:true },
  { path:'/profile', icon:'👤', label:'我的' },
]

export default function BottomNav() {
  const loc = useLocation()
  const nav = useNavigate()
  return (
    <nav style={{
      position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
      width:'100%', maxWidth:390, background:'#fff',
      borderTop:'0.5px solid #E0D5C0',
      display:'flex', alignItems:'center',
      padding:'8px 0 calc(8px + env(safe-area-inset-bottom))',
      zIndex:100,
    }}>
      {TABS.map(t => {
        const active = loc.pathname === t.path
        return (
          <button key={t.path}
            onClick={() => nav(t.path)}
            style={{
              flex:1, background:'none', border:'none', cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              padding:'4px 0',
            }}>
            {t.gold ? (
              <div style={{
                width:44, height:44, borderRadius:'50%',
                background:'linear-gradient(135deg,#C8922A,#E8B84A)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20, marginBottom:2,
                boxShadow:'0 3px 12px rgba(200,146,42,.4)',
              }}>
                {t.icon}
              </div>
            ) : (
              <span style={{ fontSize:20 }}>{t.icon}</span>
            )}
            {!t.gold && (
              <span style={{
                fontSize:10, fontFamily:'Noto Sans SC,sans-serif',
                color: active ? '#C8922A' : '#9A8A70',
                fontWeight: active ? 600 : 400,
              }}>{t.label}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
