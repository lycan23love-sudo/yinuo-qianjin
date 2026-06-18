// src/components/Toast.jsx
export default function Toast({ msg, type }) {
  const bg = type === 'success' ? '#E8F5EC'
    : type === 'error' ? '#FCEBEB'
    : '#FDF3E0'
  const color = type === 'success' ? '#1A4A28'
    : type === 'error' ? '#8A2020'
    : '#7A5A18'
  return (
    <div style={{
      background: bg, color, borderRadius:12, padding:'12px 16px',
      fontSize:13, fontWeight:500, fontFamily:'Noto Sans SC,sans-serif',
      boxShadow:'0 4px 16px rgba(0,0,0,.12)',
      animation:'toastIn .3s ease both',
      lineHeight:1.5,
    }}>
      {msg}
      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform:translateY(10px) }
          to   { opacity:1; transform:translateY(0) }
        }
      `}</style>
    </div>
  )
}
