// src/pages/AuthPage.jsx
import { useState } from 'react'
import { signUp, signIn } from '../lib/supabase'
import { useToast } from '../App'
import styles from '../styles/auth.module.css'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // login | register
  const [step, setStep] = useState(1)       // register steps 1|2
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const [form, setForm] = useState({
    phone: '', password: '', nickname: '', interest: []
  })

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  const INTERESTS = ['🏃 健康运动','📚 学习成长','🎮 游戏目标','🌅 生活习惯','💰 财务目标','✍️ 创作']

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.phone || !form.password) { showToast('请填写手机号和密码'); return }
    setLoading(true)
    try {
      await signIn({ phone: '+86' + form.phone, password: form.password })
      showToast('登录成功！', 'success')
    } catch (err) {
      showToast(err.message || '登录失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (step === 1) {
      if (!form.phone || !form.password) { showToast('请填写手机号和密码'); return }
      if (form.password.length < 8) { showToast('密码至少8位'); return }
      setStep(2); return
    }
    if (!form.nickname) { showToast('请输入昵称'); return }
    setLoading(true)
    try {
      await signUp({
        phone: '+86' + form.phone,
        password: form.password,
        nickname: form.nickname
      })
      showToast('注册成功！已赠送500善缘 🎉', 'success')
    } catch (err) {
      showToast(err.message || '注册失败', 'error')
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
            <label className={styles.label}>手机号</label>
            <div className={styles.phoneRow}>
              <span className={styles.areaCode}>+86</span>
              <input className={styles.inp} type="tel" placeholder="11位手机号"
                value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={11} />
            </div>
            <label className={styles.label}>密码</label>
            <input className={styles.inp} type="password" placeholder="请输入密码"
              value={form.password} onChange={e => set('password', e.target.value)} />
            <div style={{ textAlign:'right', marginBottom:16 }}>
              <button type="button" className={styles.link}>忘记密码？</button>
            </div>
            <button className={styles.btnGold} disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </button>
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
            <label className={styles.label}>手机号</label>
            <div className={styles.phoneRow}>
              <span className={styles.areaCode}>+86</span>
              <input className={styles.inp} type="tel" placeholder="11位手机号"
                value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={11} />
            </div>
            <label className={styles.label}>密码（至少8位）</label>
            <input className={styles.inp} type="password" placeholder="字母+数字组合更安全"
              value={form.password} onChange={e => set('password', e.target.value)} />
            {form.password.length > 0 && (
              <div className={styles.pwdBar}>
                {[1,2,3,4].map(i => (
                  <div key={i} className={styles.pwdSeg}
                    style={{ background: i <= Math.min(4, Math.floor(form.password.length/3)) + (form.password.length>=8?1:0)
                      ? (form.password.length >= 12 ? '#3B7A4A' : form.password.length >= 8 ? '#C8922A' : '#C84040')
                      : '#E0D5C0' }} />
                ))}
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

            {/* Avatar preview */}
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
      </div>

      <p style={{ textAlign:'center', fontSize:11, color:'#9A8A70', marginTop:16, padding:'0 32px' }}>
        继续即表示同意《用户协议》和《隐私政策》
      </p>
    </div>
  )
}
