import { useEffect, useState } from 'react'
import { useAuth } from '../App'
import { getCompanionState, sendCompanionNote } from '../lib/supabase'

const C = { bg:'#FAF7F2', ink:'#20160D', muted:'#8E816F', gold:'#C9952E', goldLight:'#FFF4D9', border:'#E5D8C3', surface:'#FFFFFF', green:'#3F8B63', repair:'#B77355' }

function Stamp({ done, current, label }) {
  return <span title={label} aria-label={label + (done ? '已完成' : '还在路上')} style={{ width: current ? 30 : 22, height: current ? 30 : 22, display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', background: done ? C.gold : current ? C.goldLight : '#EFE8DC', border: current ? '2px solid ' + C.gold : '1px solid ' + (done ? C.gold : '#DDD0BD'), boxShadow: done ? '0 0 0 3px rgba(201,149,46,.12)' : 'none', flexShrink:0 }}>
    <span style={{ width: done ? 9 : 6, height: done ? 9 : 6, borderRadius:'50%', background: done ? C.ink : current ? C.gold : '#CBBEAA' }} />
  </span>
}

export default function CompanionsPage() {
  const { session } = useAuth()
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [writeOpen, setWriteOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')

  async function load() {
    if (!session?.user?.id) return
    setLoading(true)
    setError('')
    try { setState(await getCompanionState(session.user.id)) }
    catch (err) { setError(err.message || '同行状态加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [session?.user?.id])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [session?.user?.id])

  const members = state?.members || []
  const self = members.find(member => member.user_id === session?.user?.id)
  const target = members.find(member => member.user_id !== session?.user?.id && !member.doneToday) || members.find(member => member.user_id !== session?.user?.id)
  const peer = state?.peer || {}
  const total = Math.max(Number(peer.population || members.length || 1), 1)
  const completed = Math.min(total, Math.max(0, Number(peer.completedToday || (self?.doneToday ? 1 : 0))))
  const remaining = Math.max(0, total - completed)
  const notes = (state?.notes || []).slice(0, 2)
  const allDone = members.length > 0 && members.every(member => member.doneToday)
  const writer = members.find(member => member.user_id === state?.lastWriterId)

  async function submitNote() {
    const content = draft.trim()
    if (!content || !target || !state?.team?.id || sending) return
    setSending(true)
    try {
      await sendCompanionNote(session.user.id, { teamId: state.team.id, recipientId: target.user_id, body: content })
      setDraft('')
      setWriteOpen(false)
      setToast('已把这句话送给 ' + target.name)
      setState(await getCompanionState(session.user.id))
      setTimeout(() => setToast(''), 2200)
    } catch (err) {
      setToast(err.message || '留笺发送失败')
      setTimeout(() => setToast(''), 2200)
    } finally { setSending(false) }
  }

  if (loading) return <div style={{ minHeight:'100vh', background:C.bg, padding:24, color:C.muted, textAlign:'center' }}>正在读取同行状态…</div>
  if (error) return <div style={{ minHeight:'100vh', background:C.bg, padding:24, color:C.repair, textAlign:'center' }}>{error}</div>

  return (
    <div style={{ minHeight:'100vh', padding:'calc(14px + env(safe-area-inset-top)) 16px calc(88px + env(safe-area-inset-bottom))', background:C.bg, color:C.ink }}>
      {toast && <div style={{ position:'fixed', top:56, left:'50%', transform:'translateX(-50%)', zIndex:10, padding:'9px 16px', borderRadius:999, background:C.ink, color:'#F7D67B', fontSize:12, whiteSpace:'nowrap' }}>{toast}</div>}
      <section style={{ padding:20, borderRadius:20, background:'#FFFDF9', border:'1px solid ' + C.border, boxShadow:'0 8px 24px rgba(45,25,8,.06)' }}>
        <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:27, fontWeight:900 }}>同行</div>
        <div style={{ marginTop:8, color:C.muted, fontSize:13 }}>与你同期的 {total} 位践行者</div>
        <div style={{ marginTop:3, color:C.gold, fontSize:12, fontWeight:800 }}>相似诺言 · 相近进度</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:9, margin:'22px 4px 16px', justifyItems:'center' }}>
          {Array.from({ length:total }, (_, index) => {
            const done = index < completed
            const current = index === Math.min(completed, total - 1)
            return <Stamp key={index} done={done && !current} current={current} label={current ? '你' : done ? '同行者' : '践行者'} />
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}><strong style={{ color:C.green, fontSize:15 }}>{completed}人已完成</strong><span style={{ color:C.muted, fontSize:13 }}>{remaining}人还在路上</span></div>
        <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid ' + C.border }}>
          <div style={{ fontSize:16, fontWeight:900 }}>{allDone ? '今天已共同守住' : self?.repair ? '今天正在修复' : self?.doneToday ? '你今天已完成' : '你今天还在路上'}</div>
          <div style={{ marginTop:6, color:C.muted, fontSize:12, lineHeight:1.65 }}>{allDone ? '五印齐成' + (writer ? ' · 今日执笔人：' + writer.name : '') : self?.repair ? self.repair.plan : '已有 ' + completed + ' 位同行者守住了今天。'}</div>
        </div>
      </section>

      <section style={{ marginTop:24 }}>
        <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:19, fontWeight:900 }}>今日共勉</div>
        {notes.length ? <div style={{ marginTop:12, padding: '4px 15px', border: '1px solid ' + C.border, borderRadius:15, background:C.surface, boxShadow:'0 4px 14px rgba(40,25,9,.05)' }}>
          {notes.map(note => {
            const repairing = note.kind === 'repair' || /修诺|补做|修复/.test(note.body || '')
            return <article key={note.id} style={{ padding:'13px 0', borderBottom:'1px solid ' + C.border }}>
              <div style={{ display:'flex', justifyContent:'space-between', color:repairing ? C.repair : C.green, fontSize:11, fontWeight:900 }}><span>● {repairing ? '修复中' : '已完成'}</span><span style={{ color:C.muted }}>{note.author?.nickname || '同行者'}</span></div>
              <div style={{ marginTop:11, fontFamily:'Noto Serif SC,serif', fontSize:15, lineHeight:1.7 }}>“{note.body}”</div>
            </article>
          })}
        </div> : <div style={{ marginTop:12, padding:17, borderRadius:15, border:'1px dashed ' + C.border, color:C.muted, fontSize:12, lineHeight:1.6 }}>今天还没有同行留笺。完成后，留下你的第一句话。</div>}
      </section>

      <section style={{ marginTop:25, paddingTop:18, borderTop:'1px solid ' + C.border }}>
        <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:19, fontWeight:900 }}>给同行留一句</div>
        <div style={{ marginTop:6, color:C.muted, fontSize:12, lineHeight:1.65 }}>你的经验、鼓励或下一步，也许能帮另一个人守住今天。</div>
        <button style={{ width:'100%', marginTop:13, padding:'14px 15px', border:'1px solid ' + C.border, borderRadius:14, background:C.surface, color:C.gold, textAlign:'left', fontSize:13, fontWeight:900 }} onClick={() => setWriteOpen(value => !value)}>写下一句话 <span style={{ float:'right', fontSize:18 }}>›</span></button>
        {writeOpen && <div style={{ marginTop:10, padding:13, border:'1px solid ' + C.border, borderRadius:14, background:C.surface }}>
          <div style={{ color:C.ink, fontSize:12, fontWeight:900 }}>{target ? '写给 ' + target.name : '等待其他同行者加入'}</div>
          <textarea value={draft} maxLength={50} onChange={event => setDraft(event.target.value)} disabled={!target} placeholder={target ? '写下你的经验、鼓励或下一步，50 字以内' : '当前还没有其他同行者'} style={{ width:'100%', minHeight:72, marginTop:9, boxSizing:'border-box', border:'1px solid ' + C.border, borderRadius:10, padding:10, resize:'none', outline:'none', color:C.ink, background:'#FFFDF9', fontSize:12 }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}><span style={{ color:C.muted, fontSize:10 }}>{draft.length}/50</span><button style={{ border:'none', borderRadius:999, background:target ? C.ink : '#D9D0C3', color:target ? '#F4D778' : '#FFF', padding:'8px 14px', fontSize:12, fontWeight:900 }} onClick={submitNote} disabled={!target || sending}>{sending ? '发送中' : '落笺发送'}</button></div>
        </div>}
      </section>
    </div>
  )
}
