// src/pages/CharityPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../App'
import { donate, getCharityTotal, getDonations } from '../lib/supabase'

const C = {
  gold: '#C8922A', goldL: '#FDF3E0', goldD: '#7A5A18', ink: '#1A1208',
  muted: '#7A6A50', hint: '#B8A88A', bg: '#FAF7F2', surf: '#FFFFFF',
  soft: '#F5F0E8', border: '#E0D5C0', green: '#3B7A4A', greenL: '#E8F5EC',
  red: '#C84040', redL: '#FCEBEB', blue: '#3A6A9A', blueL: '#E8F0FA',
}

const ORGS = [
  { id: 'library', emoji: '📚', name: '山区图书馆计划', desc: '为偏远地区儿童补充阅读资源', total: 28400 },
  { id: 'child', emoji: '❤️', name: '儿童健康基金', desc: '儿童医疗援助、营养与心理关怀', total: 67200 },
  { id: 'study', emoji: '🎓', name: '贫困助学基金', desc: '资助寒门学子完成学业', total: 31000 },
  { id: 'env', emoji: '🌳', name: '公益绿色行动', desc: '植树、环保教育与减碳倡导', total: 19600 },
  { id: 'animal', emoji: '🐾', name: '流浪动物救助', desc: '救助、绝育与领养支持', total: 42800 },
]

const AMOUNTS = [50, 100, 200, 500]

function orgEmoji(name = '') {
  const org = ORGS.find(item => name.includes(item.name) || item.name.includes(name))
  if (org) return org.emoji
  if (name.includes('图书') || name.includes('书')) return '📚'
  if (name.includes('儿童') || name.includes('健康')) return '❤️'
  if (name.includes('助学') || name.includes('贫困')) return '🎓'
  if (name.includes('绿') || name.includes('环保')) return '🌳'
  if (name.includes('动物')) return '🐾'
  return '🪷'
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function sourceLabel(source) {
  if (source === 'manual') return '主动捐赠'
  if (source === 'pledge_fail') return '誓言结算'
  if (source === 'witness_pool') return '见证池结余'
  return '公益入账'
}

function SectionTitle({ title, action }) {
  return <div style={S.sectionHead}><div style={S.sectionTitle}>{title}</div>{action}</div>
}

export default function CharityPage() {
  const { profile, session } = useAuth()
  const [tab, setTab] = useState('projects')
  const [selectedOrg, setSelectedOrg] = useState(ORGS[0].id)
  const [amount, setAmount] = useState(100)
  const [message, setMessage] = useState('')
  const [records, setRecords] = useState([])
  const [vaultTotal, setVaultTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [donating, setDonating] = useState(false)
  const [toast, setToast] = useState('')
  const [localBalance, setLocalBalance] = useState(profile?.merit_coins || 0)

  useEffect(() => setLocalBalance(profile?.merit_coins || 0), [profile?.merit_coins])

  const userId = session?.user?.id
  const selected = ORGS.find(item => item.id === selectedOrg) || ORGS[0]
  const donated = records.reduce((sum, item) => sum + Number(item.coins || 0), 0)
  const projectTotals = useMemo(() => {
    const totals = Object.fromEntries(ORGS.map(item => [item.name, item.total]))
    records.forEach(item => {
      totals[item.org_name] = (totals[item.org_name] || 0) + Number(item.coins || 0)
    })
    return totals
  }, [records])
  const certLevel = donated >= 2000 ? '护法者' : donated >= 500 ? '种善者' : '初心善行'
  const nextNeed = donated >= 2000 ? 5000 : donated >= 500 ? 2000 : 500
  const progress = Math.min(100, Math.round((donated / nextNeed) * 100))

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  async function load() {
    if (!userId) return
    setLoading(true)
    try {
      const [donations, total] = await Promise.all([getDonations(userId), getCharityTotal()])
      setRecords(donations || [])
      setVaultTotal(total || 0)
    } catch (err) {
      showToast(err.message || '公益数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [userId])

  async function handleDonate() {
    if (!userId) return showToast('请先登录')
    const coins = Number(amount)
    if (!Number.isFinite(coins) || coins <= 0) return showToast('请输入有效金额')
    if (coins > localBalance) return showToast('公益金币不足')
    setDonating(true)
    try {
      const row = await donate(userId, { coins, orgName: selected.name, message: message.trim() || '愿这份善意抵达需要的人' })
      setRecords(list => [row, ...list])
      setLocalBalance(value => Math.max(0, value - coins))
      setMessage('')
      showToast('已捐出 ' + coins + ' 公益金币')
    } catch (err) {
      showToast(err.message || '捐赠失败，请稍后再试')
    } finally {
      setDonating(false)
    }
  }

  return (
    <div style={S.page}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.topbar}><div style={S.logo}>慈<em style={{ color: C.gold, fontStyle: 'normal' }}>善</em></div></div>
      <div style={S.tabs}>{[['projects','公益项目'],['records','我的善行']].map(([key, label]) => <button key={key} style={{ ...S.tab, ...(tab === key ? S.tabOn : {}) }} onClick={() => setTab(key)}>{label}</button>)}</div>

      {tab === 'projects' && (
        <div style={S.content}>
          <div style={S.walletCard}>
            <div><div style={S.kicker}>公益金币余额</div><div style={S.balance}>{localBalance.toLocaleString()}</div></div>
            <div style={{ textAlign: 'right' }}><div style={S.kicker}>平台金库</div><div style={S.vault}>{vaultTotal.toLocaleString()}</div></div>
          </div>

          <SectionTitle title="选择公益项目" />
          <div style={S.orgGrid}>{ORGS.map(org => {
            const active = selectedOrg === org.id
            return <button key={org.id} style={{ ...S.orgCard, ...(active ? S.orgCardOn : {}) }} onClick={() => setSelectedOrg(org.id)}>
              <div style={S.orgEmoji}>{org.emoji}</div>
              <div style={S.orgName}>{org.name}</div>
              <div style={S.orgDesc}>{org.desc}</div>
              <div style={S.orgMeta}>累计 {Number(projectTotals[org.name] || org.total).toLocaleString()} 金币</div>
            </button>
          })}</div>

          <div style={S.donatePanel}>
            <div style={S.panelTitle}>{selected.emoji} 捐给 {selected.name}</div>
            <div style={S.amountGrid}>{AMOUNTS.map(value => <button key={value} style={{ ...S.amountBtn, ...(amount === value ? S.amountBtnOn : {}) }} onClick={() => setAmount(value)}>{value}</button>)}</div>
            <input style={S.input} type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="自定义公益金币" />
            <textarea style={S.textarea} value={message} onChange={e => setMessage(e.target.value)} placeholder="给受益者留一句话，选填" />
            <button style={{ ...S.primaryBtn, opacity: donating ? .7 : 1 }} onClick={handleDonate} disabled={donating}>{donating ? '捐赠中...' : '确认捐赠 ' + Number(amount || 0).toLocaleString() + ' 金币'}</button>
          </div>
        </div>
      )}

      {tab === 'records' && (
        <div style={S.content}>
          <div style={S.meritCard}>
            <div><div style={S.kicker}>当前称号</div><div style={S.certTitle}>{certLevel}</div></div>
            <div style={S.meritNum}>{donated.toLocaleString()}</div>
            <div style={S.track}><div style={{ ...S.fill, width: progress + '%' }} /></div>
            <div style={S.meritHint}>距下一阶段 {Math.max(0, nextNeed - donated).toLocaleString()} 公益金币</div>
          </div>

          <SectionTitle title="捐赠记录" action={loading && <span style={S.loading}>加载中</span>} />
          {records.length === 0 && !loading ? <div style={S.empty}>还没有公益记录。第一次捐赠会从这里开始留下痕迹。</div> : records.map(item => <div key={item.id || item.created_at} style={S.recordCard}>
            <div style={S.recordEmoji}>{orgEmoji(item.org_name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.recordTitle}>{item.org_name || '公益项目'}</div>
              <div style={S.recordMeta}>{sourceLabel(item.source)} · {formatDate(item.created_at)}</div>
              {item.message && <div style={S.recordMsg}>{item.message}</div>}
            </div>
            <div style={S.recordCoins}>{Number(item.coins || 0).toLocaleString()}</div>
          </div>)}
        </div>
      )}
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: C.bg, color: C.ink, paddingBottom: 'calc(76px + env(safe-area-inset-bottom))' },
  topbar: { padding: 'calc(16px + env(safe-area-inset-top)) 16px 16px', borderBottom: '1px solid ' + C.border, background: C.bg },
  logo: { fontFamily: 'Noto Serif SC,serif', fontSize: 24, fontWeight: 900, color: C.ink },
  tabs: { display: 'flex', borderBottom: '1px solid ' + C.border, background: C.bg },
  tab: { flex: 1, border: 'none', background: 'none', padding: '13px 0', fontSize: 15, fontWeight: 800, color: C.muted, fontFamily: 'Noto Sans SC,sans-serif' },
  tabOn: { color: C.gold, borderBottom: '3px solid ' + C.gold },
  content: { padding: 16 },
  toast: { position: 'fixed', top: 66, left: '50%', transform: 'translateX(-50%)', background: 'rgba(26,18,8,.9)', color: '#fff', padding: '9px 16px', borderRadius: 999, fontSize: 13, zIndex: 20, whiteSpace: 'nowrap' },
  walletCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surf, border: '1px solid ' + C.border, borderRadius: 16, padding: 14, marginBottom: 16, boxShadow: '0 2px 10px rgba(26,18,8,.05)' },
  kicker: { fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 800 },
  balance: { fontFamily: 'Noto Serif SC,serif', fontSize: 26, color: C.goldD, fontWeight: 900 },
  vault: { fontSize: 20, color: C.green, fontWeight: 900 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 10px' },
  sectionTitle: { fontSize: 15, fontWeight: 900, color: C.ink, fontFamily: 'Noto Serif SC,serif' },
  orgGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 },
  orgCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 12, textAlign: 'left', fontFamily: 'Noto Sans SC,sans-serif' },
  orgCardOn: { borderColor: C.gold, background: '#FFFCF4', boxShadow: '0 2px 10px rgba(200,146,42,.12)' },
  orgEmoji: { fontSize: 24, marginBottom: 6 },
  orgName: { fontSize: 14, fontWeight: 900, color: C.ink, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  orgDesc: { fontSize: 11, color: C.muted, lineHeight: 1.5, minHeight: 34 },
  orgMeta: { marginTop: 8, fontSize: 10, color: C.goldD, fontWeight: 800 },
  donatePanel: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 16, padding: 14, boxShadow: '0 2px 10px rgba(26,18,8,.05)' },
  panelTitle: { fontSize: 16, fontWeight: 900, color: C.ink, marginBottom: 12 },
  amountGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 },
  amountBtn: { border: '1px solid ' + C.border, background: C.surf, color: C.muted, borderRadius: 999, padding: '9px 0', fontSize: 13, fontWeight: 900 },
  amountBtnOn: { background: C.ink, borderColor: C.ink, color: '#fff' },
  input: { boxSizing: 'border-box', width: '100%', border: '1px solid ' + C.border, borderRadius: 12, padding: '11px 12px', fontSize: 14, marginBottom: 10, background: C.bg },
  textarea: { boxSizing: 'border-box', width: '100%', minHeight: 66, border: '1px solid ' + C.border, borderRadius: 12, padding: '10px 12px', fontSize: 13, fontFamily: 'Noto Sans SC,sans-serif', resize: 'none', background: C.bg, marginBottom: 12 },
  primaryBtn: { width: '100%', border: 'none', background: C.gold, color: '#fff', borderRadius: 999, padding: '13px 14px', fontSize: 15, fontWeight: 900, fontFamily: 'Noto Sans SC,sans-serif' },
  meritCard: { background: 'linear-gradient(135deg,#FFF8E8,#FFFFFF)', border: '1px solid #E8D4A0', borderRadius: 16, padding: 14, marginBottom: 16 },
  certTitle: { fontFamily: 'Noto Serif SC,serif', fontSize: 22, fontWeight: 900, color: C.goldD },
  meritNum: { position: 'absolute', opacity: 0 },
  track: { height: 8, borderRadius: 999, background: C.soft, overflow: 'hidden', margin: '12px 0 6px' },
  fill: { height: '100%', borderRadius: 999, background: C.gold },
  meritHint: { fontSize: 11, color: C.muted },
  loading: { fontSize: 11, color: C.hint },
  empty: { background: C.surf, border: '1px dashed ' + C.border, borderRadius: 14, padding: 22, textAlign: 'center', color: C.muted, fontSize: 13, lineHeight: 1.7 },
  recordCard: { background: C.surf, border: '1px solid ' + C.border, borderRadius: 14, padding: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 },
  recordEmoji: { width: 36, height: 36, borderRadius: 10, background: C.goldL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 },
  recordTitle: { fontSize: 14, fontWeight: 900, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  recordMeta: { fontSize: 11, color: C.muted, marginTop: 3 },
  recordMsg: { fontSize: 11, color: C.hint, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  recordCoins: { color: C.goldD, fontSize: 15, fontWeight: 900, flexShrink: 0 },
}
