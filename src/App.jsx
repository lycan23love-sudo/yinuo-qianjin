// src/App.jsx
import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, getProfile } from './lib/supabase'

import AuthPage    from './pages/AuthPage'
import HomePage    from './pages/HomePage'
import NewPledge   from './pages/NewPledge'
import PledgeDetail from './pages/PledgeDetail'
import CheckinPage from './pages/CheckinPage'
import CheckinSuccess from './pages/CheckinSuccess'
import ProfilePage from './pages/ProfilePage'
import SquarePage       from './pages/SquarePage'
import CompanionsPage  from './pages/CompanionsPage'
import CharityPage     from './pages/CharityPage'
import IndexHallPage   from './pages/IndexHallPage'
import BlindBetPage    from './pages/BlindBetPage'
import JuryPage        from './pages/JuryPage'
import BottomNav       from './components/BottomNav'
import Toast       from './components/Toast'

// Global auth context
export const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// Global toast context
export const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [toasts, setToasts] = useState([])

  const showToast = (msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    try {
      const p = await getProfile(userId)
      setProfile(p)
    } catch (e) {
      console.error('loadProfile error', e)
    }
  }

  function refreshProfile() {
    if (session) loadProfile(session.user.id)
  }

  if (session === undefined) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        height:'100vh', background:'#FAF7F2', flexDirection:'column', gap:16 }}>
        <div style={{ fontSize:48, fontFamily:'Noto Serif SC, serif', fontWeight:900, color:'#C8922A' }}>誓</div>
        <div style={{ fontSize:13, color:'#9A8A70' }}>加载中…</div>
      </div>
    )
  }

  const PAGED_ROUTES = ['/', '/square', '/square/index', '/square/pool', '/companions', '/charity', '/profile', '/new']
  const showNav = session && PAGED_ROUTES.includes(location.pathname)

  return (
    <AuthCtx.Provider value={{ session, userId: session?.user?.id, profile, refreshProfile }}>
    <ToastCtx.Provider value={{ showToast }}>
    <BrowserRouter>
      <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh',
        background: '#FAF7F2', position: 'relative', fontFamily: 'Noto Sans SC, sans-serif' }}>

        <Routes>
          {/* 未登录 */}
          <Route path="/auth"  element={!session ? <AuthPage /> : <Navigate to="/" />} />

          {/* 需要登录 */}
          <Route path="/"       element={session ? <HomePage /> : <Navigate to="/auth" />} />
          <Route path="/square"      element={session ? <SquarePage /> : <Navigate to="/auth" />} />
          <Route path="/square/index" element={session ? <SquarePage /> : <Navigate to="/auth" />} />
          <Route path="/square/pool"  element={session ? <SquarePage /> : <Navigate to="/auth" />} />
          <Route path="/companions"  element={session ? <CompanionsPage /> : <Navigate to="/auth" />} />
          <Route path="/charity"     element={session ? <CharityPage /> : <Navigate to="/auth" />} />
          <Route path="/index-hall"  element={session ? <Navigate to="/square/index" /> : <Navigate to="/auth" />} />
          <Route path="/blind-bet"  element={session ? <BlindBetPage /> : <Navigate to="/auth" />} />
          <Route path="/jury"       element={session ? <JuryPage /> : <Navigate to="/auth" />} />
          <Route path="/new"         element={session ? <NewPledge /> : <Navigate to="/auth" />} />
          <Route path="/pledge/:id"         element={session ? <PledgeDetail /> : <Navigate to="/auth" />} />
          <Route path="/pledge/:id/checkin" element={session ? <CheckinPage /> : <Navigate to="/auth" />} />
          <Route path="/checkin-success"    element={session ? <CheckinSuccess /> : <Navigate to="/auth" />} />
          <Route path="/profile" element={session ? <ProfilePage /> : <Navigate to="/auth" />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to={session ? "/" : "/auth"} />} />
        </Routes>

        {/* Bottom nav for main pages */}
        {session && <BottomNav />}

        {/* Toast notifications */}
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          display:'flex', flexDirection:'column', gap:8, zIndex:9999, maxWidth:360, width:'100%', padding:'0 16px' }}>
          {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
        </div>
      </div>
    </BrowserRouter>
    </ToastCtx.Provider>
    </AuthCtx.Provider>
  )
}

export default App
