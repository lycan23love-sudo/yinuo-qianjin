// src/pages/AuthPage.jsx
import { useState } from 'react'
import { signUp, signIn } from '../lib/supabase'
import { useToast } from '../App'
import styles from '../styles/auth.module.css'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // login | register | guest
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const [form, setForm] = useState({
    email: '', password: '', nickname: '', interest: []
  })

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  const INTERESTS = ['🏃 健康运动','📚 学习成长','🎮 游戏目标','🌅 生活习惯','💰 财务目标','✍️ 创作']

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.email || !form.password) { showToast('请填写邮箱和密码'); return }
    if (!isValidEmail(form.email)) { showToast('请输入正确的邮箱格式'); return }
    setLoading(true)
    try {
      await signIn({ email: form.email, password: form.password })
      showToast('登录成功！', 'success')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('Invalid login')) showToast('邮箱或密码错误', 'error')
      else if (msg.includes('Email not confirmed')) showToast('请先验证邮箱', 'error')
      else showToast(msg || '登录失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (step === 1) {
      if (!form.email || !form.password) { showToast('请填写邮箱和密码'); return }
      if (!isValidEmail(form.email)) { showToast('请输入正确的邮箱格式'); return }
      if (form.password.length < 8) { showToast('密码至少8位'); return }
      setStep(2); return
    }
    if (!form.nickname.trim()) { showToast('请输入昵称'); return }
    setLoading(true)
    try {
      await signUp({
        email: form.email,
        password: form.password,
        nickname: form.nickname
      })
      showToast('注册成功！已赠送500善缘 🎉', 'success')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('already registered')) showToast('该邮箱已注册，请直接登录', 'error')
      else showToast(msg || '注册失败', 'error')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      {/* Splash header */}
      <div className={styles.header}>
        <div className={styles.logo}>誓</div>
        <div className={styles.brand}>一诺千金</div>
        <div className={styles.tagline}>PLEDGE · GROW · GIVE</div>
      </div>

      <div className={styles.card}>
        {/* Mode tabs */}
        <div className={styles.tabs}>
          <button className={mode==='login'?styles.tabOn:styles.tab}
            onClick={() => { setMode('login'); setStep(1) }}>登录</button>
          <button className={mode==='register'?styles.tabOn:styles.tab}
            onClick={() => { setMode('register'); setStep(1) }}>注册</button>
        </div>

        {/* Login */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <label className={styles.label}>邮箱</label>
            <input className={styles.inp} type="email" placeholder="your@email.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
            <label className={styles.label}>密码</label>
            <input className={styles.inp} type="password" placeholder="请输入密码"
              value={form.password} onChange={e => set('password', e.target.value)} />
            <button className={styles.btnGold} disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </button>

            {/* Guest mode */}
            <div className={styles.divider}><span>或者</span></div>
            <button type="button" className={styles.btnGuest}
              onClick={() => setMode('guest')}>
              👀 游客模式体验
            </button>
            <p className={styles.guestHint}>无需注册，直接浏览公开誓言广场</p>
          </form>
        )}

        {/* Register step 1 */}
        {mode === 'register' && step === 1 && (
          <form onSubmit={handleRegister}>
            <div className={styles.steps}>
              <div className={`${styles.stepDot} ${styles.active}`}/>
              <div className={styles.stepLine}/>
              <div className={styles.stepDot}/>
            </div>
            <p className={styles.stepHint}>第1步：创建账号</p>
            <label className={styles.label}>邮箱</label>
            <input className={styles.inp} type="email" placeholder="your@email.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
            <label className={styles.label}>密码（至少8位）</label>
            <input className={styles.inp} type="password" placeholder="字母+数字组合更安全"
              value={form.password} onChange={e => set('password', e.target.value)} />
            {form.password.length > 0 && (
              <div className={styles.pwdBar}>
                {[1,2,3,4].map(i => {
                  const strength = Math.min(4,
                    Math.floor(form.password.length / 3) +
                    (form.password.length >= 8 ? 1 : 0)
                  )
                  const color = form.password.length >= 12 ? '#3B7A4A'
                    : form.password.length >= 8 ? '#C8922A' : '#C84040'
                  return <div key={i} className={styles.pwdSeg}
                    style={{ background: i <= strength ? color : '#E0D5C0' }} />
                })}
              </div>
            )}
            <button className={styles.btnGold} type="submit">下一步 →</button>
          </form>
        )}

        {/* Register step 2 */}
        {mode === 'register' && step === 2 && (
          <form onSubmit={handleRegister}>
            <div className={styles.steps}>
              <div className={`${styles.stepDot} ${styles.done}`}/>
              <div className={`${styles.stepLine} ${styles.done}`}/>
              <div className={`${styles.stepDot} ${styles.active}`}/>
            </div>
            <p className={styles.stepHint}>第2步：完善信息</p>

            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ width:64, height:64, borderRadius:'50%',
                background:'linear-gradient(135deg,#C8922A,#E8B84A)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:26, fontWeight:700, color:'#fff',
                margin:'0 auto 8px', fontFamily:'Noto Serif SC,serif' }}>
                {form.nickname ? form.nickname[0] : '?'}
              </div>
            </div>

            <label className={styles.label}>昵称</label>
            <input className={styles.inp} placeholder="给自己起个名字" maxLength={12}
              value={form.nickname} onChange={e => set('nickname', e.target.value)} />

            <label className={styles.label}>最想实现的目标（选填）</label>
            <div className={styles.chips}>
              {INTERESTS.map(tag => (
                <button key={tag} type="button"
                  className={form.interest.includes(tag) ? styles.chipOn : styles.chip}
                  onClick={() => set('interest', form.interest.includes(tag)
                    ? form.interest.filter(x => x !== tag)
                    : [...form.interest, tag])}>
                  {tag}
                </button>
              ))}
            </div>

            <button className={styles.btnGold} disabled={loading}>
              {loading ? '注册中…' : '完成注册，赠送500善缘'}
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => setStep(1)}>← 上一步</button>
          </form>
        )}

        {/* Guest mode */}
        {mode === 'guest' && (
          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👀</div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>游客体验模式</div>
            <div style={{ fontSize:12, color:'#9A8A70', lineHeight:1.7, marginBottom:20 }}>
              你可以浏览所有公开的誓言<br/>
              但无法创建承诺或打卡<br/>
              注册后解锁完整功能
            </div>

            {/* Feature preview */}
            {[
              { icon:'🎯', text:'创建自己的承诺，押注金币' },
              { icon:'🔥', text:'每日打卡，连续奖励翻倍' },
              { icon:'🏆', text:'见证他人，赢得公益金币' },
              { icon:'🌱', text:'金币全部捐公益，0提现' },
            ].map(f => (
              <div key={f.text} style={{ display:'flex', alignItems:'center', gap:10,
                padding:'8px 12px', background:'#FAF7F2', borderRadius:10,
                marginBottom:8, textAlign:'left' }}>
                <span style={{ fontSize:18 }}>{f.icon}</span>
                <span style={{ fontSize:12, color:'#5A4A30' }}>{f.text}</span>
              </div>
            ))}

            <GuestSquarePreview />

            <button className={styles.btnGold} style={{ marginTop:16, width:'100%', padding:13 }}
              onClick={() => setMode('register')}>
              立即注册，解锁全部功能
            </button>
            <button className={styles.btnGhost} style={{ width:'100%', padding:12, marginTop:8 }}
              onClick={() => setMode('login')}>
              已有账号，去登录
            </button>
          </div>
        )}
      </div>

      <p style={{ textAlign:'center', fontSize:11, color:'#9A8A70', marginTop:16, padding:'0 32px' }}>
        继续即表示同意《用户协议》和《隐私政策》
      </p>
    </div>
  )
}

// 游客模式下的公开誓言预览卡片
function GuestSquarePreview() {
  const demos = [
    { title:'每天跑步5公里', days:12, total:30, user:'小明', coins:500 },
    { title:'坚持读书30分钟', days:21, total:30, user:'Anna', coins:1000 },
    { title:'戒糖21天挑战', days:7, total:21, user:'健身er', coins:200 },
  ]
  return (
    <div style={{ marginTop:16, textAlign:'left' }}>
      <div style={{ fontSize:11, color:'#9A8A70', fontWeight:600,
        letterSpacing:.5, marginBottom:8 }}>公开誓言广场预览</div>
      {demos.map((d, i) => (
        <div key={i} style={{ background:'#fff', border:'0.5px solid #E0D5C0',
          borderRadius:12, padding:12, marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:6 }}>
            <div style={{ fontSize:13, fontWeight:600,
              fontFamily:'Noto Serif SC,serif' }}>{d.title}</div>
            <div style={{ background:'#FDF3E0', color:'#7A5A18',
              fontSize:11, padding:'2px 8px', borderRadius:20 }}>{d.coins}金币</div>
          </div>
          <div style={{ height:4, background:'#F0EAE0', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
            <div style={{ width:`${Math.round(d.days/d.total*100)}%`, height:'100%',
              background:'linear-gradient(90deg,#C8922A,#E8B84A)', borderRadius:3 }} />
          </div>
          <div style={{ fontSize:11, color:'#9A8A70' }}>
            {d.user} · 第{d.days}天 / 共{d.total}天
          </div>
        </div>
      ))}
    </div>
  )
}
