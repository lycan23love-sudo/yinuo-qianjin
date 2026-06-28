import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../App'
import { getPendingDisputes, castJuryVote } from '../lib/supabase'

const C = {
  bg: '#f8f4ed',
  panel: '#fffdf8',
  card: '#fff',
  ink: '#1f160d',
  sub: '#7b715f',
  soft: '#eee6d8',
  gold: '#c79a36',
  red: '#b94a48',
  green: '#4d8b61',
}

function fmtDate(value) {
  if (!value) return ''
  try { return format(parseISO(value), 'MM-dd HH:mm') } catch { return '' }
}

function readCharityCases() {
  try {
    const raw = window.localStorage.getItem('charity_jury_cases')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeCharityCases(cases) {
  window.localStorage.setItem('charity_jury_cases', JSON.stringify(cases))
}

export default function JuryPage() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [tab, setTab] = useState('charity')
  const [disputes, setDisputes] = useState([])
  const [charityCases, setCharityCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(null)
  const [toast, setToast] = useState('')

  function showToast(text) {
    setToast(text)
    window.setTimeout(() => setToast(''), 2200)
  }

  async function loadCases() {
    setLoading(true)
    try {
      const disputeRows = await getPendingDisputes()
      setDisputes(disputeRows || [])
    } catch (err) {
      setDisputes([])
    }
    setCharityCases(readCharityCases().filter(item => item.status === 'pending'))
    setLoading(false)
  }

  useEffect(() => { loadCases() }, [])

  async function handleVote(disputeId, vote) {
    if (!userId) return showToast('请先登录')
    setVoting(disputeId + vote)
    try {
      await castJuryVote(disputeId, userId, vote)
      showToast('投票已记录')
      await loadCases()
    } catch (err) {
      showToast(err.message || '投票失败')
    } finally {
      setVoting(null)
    }
  }

  function voteCharity(caseId, vote) {
    if (!userId) return showToast('请先登录')
    const cases = readCharityCases()
    const nextCases = cases.map(item => {
      if (item.id !== caseId) return item
      if (item.applicant_id === userId) {
        showToast('不能确认自己的善行')
        return item
      }
      const voters = item.voters || {}
      if (voters[userId]) {
        showToast('你已经确认过这个案件')
        return item
      }
      const votes = { approve: 0, reject: 0, revise: 0, ...(item.votes || {}) }
      votes[vote] = (votes[vote] || 0) + 1
      const next = { ...item, votes, voters: { ...voters, [userId]: vote } }
      if (votes.approve >= 2) next.status = 'approved'
      if (votes.reject >= 2) next.status = 'rejected'
      if (votes.revise >= 2) next.status = 'needs_revision'
      return next
    })
    writeCharityCases(nextCases)
    setCharityCases(nextCases.filter(item => item.status === 'pending'))
    const current = nextCases.find(item => item.id === caseId)
    if (current?.status === 'approved') showToast('善行已通过确认')
    else if (current?.status === 'rejected') showToast('善行未通过确认')
    else if (current?.status === 'needs_revision') showToast('已退回补充证明')
    else showToast('确认已记录')
  }

  const emptyText = tab === 'charity' ? '暂无待确认的善行' : '暂无待裁定的争议'

  return (
    <div style={S.page}>
      {toast && <div style={S.toast}>{toast}</div>}
      <header style={S.topbar}>
        <button style={S.back} onClick={() => navigate(-1)}>‹</button>
        <h1 style={S.title}>陪审团</h1>
        <span style={S.topHint}>公议</span>
      </header>

      <div style={S.tabs}>
        <button style={{ ...S.tab, ...(tab === 'charity' ? S.tabOn : {}) }} onClick={() => setTab('charity')}>善行确认</button>
        <button style={{ ...S.tab, ...(tab === 'disputes' ? S.tabOn : {}) }} onClick={() => setTab('disputes')}>打卡争议</button>
      </div>

      <main style={S.content}>
        <section style={S.notice}>
          <strong>陪审团确认规则</strong>
          <p>善行与争议都交由同行确认。申请人不能确认自己的案件，2 票同向即可形成初步结论。</p>
        </section>

        {loading ? <div style={S.empty}>加载中...</div> : (
          <>
            {tab === 'charity' && (
              charityCases.length ? charityCases.map(item => <CharityCase key={item.id} item={item} onVote={voteCharity} />) : <div style={S.empty}>{emptyText}</div>
            )}

            {tab === 'disputes' && (
              disputes.length ? disputes.map(dispute => (
                <article key={dispute.id} style={S.card}>
                  <div style={S.cardHead}>
                    <div>
                      <div style={S.kicker}>打卡争议</div>
                      <h2 style={S.cardTitle}>{dispute.contracts?.title || '未命名誓言'}</h2>
                    </div>
                    <span style={S.badge}>{fmtDate(dispute.created_at)}</span>
                  </div>
                  <p style={S.desc}>{dispute.reason || '用户提交了申诉，请根据证明材料判断。'}</p>
                  {dispute.proof_url && <img src={dispute.proof_url} alt="proof" style={S.proofImg} />}
                  <div style={S.actions}>
                    <button style={S.primaryBtn} disabled={voting === dispute.id + 'upheld'} onClick={() => handleVote(dispute.id, 'upheld')}>支持申诉</button>
                    <button style={S.ghostBtn} disabled={voting === dispute.id + 'overturned'} onClick={() => handleVote(dispute.id, 'overturned')}>维持原判</button>
                  </div>
                </article>
              )) : <div style={S.empty}>{emptyText}</div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function CharityCase({ item, onVote }) {
  const votes = { approve: 0, reject: 0, revise: 0, ...(item.votes || {}) }
  return (
    <article style={S.card}>
      <div style={S.cardHead}>
        <div>
          <div style={S.kicker}>善行确认</div>
          <h2 style={S.cardTitle}>{item.type}</h2>
        </div>
        <span style={S.reward}>+{item.reward || 0} 金币</span>
      </div>
      <p style={S.desc}>{item.text}</p>
      <div style={S.proofLine}>证明：{item.proof || '未上传文件名'}</div>
      <div style={S.metaLine}>提交时间 {fmtDate(item.created_at)}</div>
      <div style={S.voteLine}>
        <span>认可 {votes.approve}</span>
        <span>补充 {votes.revise}</span>
        <span>驳回 {votes.reject}</span>
      </div>
      <div style={S.actions}>
        <button style={S.primaryBtn} onClick={() => onVote(item.id, 'approve')}>认可</button>
        <button style={S.ghostBtn} onClick={() => onVote(item.id, 'revise')}>需补充</button>
        <button style={S.dangerBtn} onClick={() => onVote(item.id, 'reject')}>驳回</button>
      </div>
    </article>
  )
}

const S = {
  page: { minHeight: '100vh', background: C.bg, color: C.ink, paddingBottom: 96, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  toast: { position: 'fixed', left: '50%', top: 18, transform: 'translateX(-50%)', zIndex: 20, background: C.ink, color: '#fff', padding: '10px 16px', borderRadius: 18, fontSize: 14, boxShadow: '0 10px 25px rgba(0,0,0,.18)' },
  topbar: { height: 82, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 0', borderBottom: '1px solid #e3d8c8', background: '#fffdf9' },
  back: { border: 0, background: 'transparent', fontSize: 34, lineHeight: 1, color: C.gold, padding: 0 },
  title: { margin: 0, fontSize: 30, letterSpacing: 0, fontWeight: 900 },
  topHint: { color: C.sub, fontSize: 14 },
  tabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e3d8c8', background: '#fffdf9' },
  tab: { height: 58, border: 0, background: 'transparent', color: C.sub, fontSize: 18, fontWeight: 800, borderBottom: '3px solid transparent' },
  tabOn: { color: C.gold, borderBottomColor: C.gold },
  content: { padding: '18px 16px 24px', display: 'grid', gap: 16 },
  notice: { background: '#fff8e8', border: '1px solid #ead6a8', borderRadius: 18, padding: 18, lineHeight: 1.7, color: C.sub },
  card: { background: C.card, border: '1px solid #e3d8c8', borderRadius: 20, padding: 18, boxShadow: '0 10px 24px rgba(50,34,12,.06)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  kicker: { color: C.gold, fontSize: 14, fontWeight: 800, marginBottom: 6 },
  cardTitle: { margin: 0, fontSize: 22, lineHeight: 1.3 },
  badge: { border: '1px solid #e2d5c3', borderRadius: 999, padding: '6px 10px', color: C.sub, fontSize: 12, whiteSpace: 'nowrap' },
  reward: { background: '#edf8ef', color: C.green, borderRadius: 999, padding: '7px 11px', fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' },
  desc: { color: C.ink, fontSize: 16, lineHeight: 1.65, margin: '14px 0 10px' },
  proofLine: { background: '#f5efe4', borderRadius: 12, padding: '10px 12px', color: C.sub, fontSize: 14, overflowWrap: 'anywhere' },
  metaLine: { marginTop: 10, color: C.sub, fontSize: 13 },
  voteLine: { display: 'flex', gap: 14, color: C.sub, fontSize: 13, marginTop: 12 },
  proofImg: { width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 14, marginTop: 12, border: '1px solid #eadfce' },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 },
  primaryBtn: { border: 0, borderRadius: 999, background: C.gold, color: '#fff', padding: '12px 10px', fontWeight: 900, fontSize: 15 },
  ghostBtn: { border: '1px solid #d8ccb8', borderRadius: 999, background: '#fffdf8', color: C.sub, padding: '12px 10px', fontWeight: 900, fontSize: 15 },
  dangerBtn: { border: '1px solid #e0c4c2', borderRadius: 999, background: '#fff7f6', color: C.red, padding: '12px 10px', fontWeight: 900, fontSize: 15 },
  empty: { textAlign: 'center', padding: 36, color: C.sub, background: C.panel, border: '1px dashed #d8ccb8', borderRadius: 18 },
}
