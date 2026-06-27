// src/pages/NewPledge.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../App'
import { createPledge } from '../lib/supabase'
import { addDays, format } from 'date-fns'

const PERIODS = [
  { key:'week', label:'七日令', days:7, locked:false },
  { key:'month', label:'三十日令', days:30, locked:false },
  { key:'season', label:'九十日令', days:90, locked:true, need:'完成1个解锁' },
  { key:'year', label:'三百六十五日令', days:365, locked:true, need:'完成3个解锁' },
]
const STAKES = [10, 30, 50, 100]
const CHARITIES = ['动物保护联盟','山区图书馆','儿童健康基金','绿色公益','贫困助学基金']
const VERIFY = [
  { key:'screenshot', label:'截图为证', desc:'上传截图，见证者可质疑' },
  { key:'text', label:'文字为证', desc:'每天写下践诺记录' },
]

function userSeal(profile) {
  const name = profile?.nickname || profile?.username || '我'
  return String(name).trim().slice(0, 1) || '我'
}

export default function NewPledge() {
  const { session, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState({ title: '', period: 'month', stake: 10, charity: '山区图书馆', verify: 'screenshot', isPublic: true })
  const [loading, setLoading] = useState(false)
  const [opened, setOpened] = useState(false)
  const [sealing, setSealing] = useState(false)
  const [sealed, setSealed] = useState(false)

  useEffect(() => {
    if (!profile) return
    const coins = profile.merit_coins ?? 0
    setForm(f => {
      if (f.stake <= coins) return f
      const affordable = [...STAKES].reverse().find(s => s <= coins) || STAKES[0]
      return { ...f, stake: affordable }
    })
  }, [profile?.merit_coins])

  function set(k, v) {
    setSealed(false)
    setSealing(false)
    setForm(f => ({ ...f, [k]: v }))
  }

  const period = PERIODS.find(p => p.key === form.period)
  const endDate = format(addDays(new Date(), period.days - 1), 'yyyy年M月d日')
  const currentCoins = profile?.merit_coins ?? 0
  const noCoins = currentCoins < form.stake
  const sealChar = userSeal(profile)

  function stamp() {
    if (!opened) { setOpened(true); return }
    if (!form.title.trim()) { showToast('请先写下誓言'); return }
    if (noCoins) { showToast('金币不足，需要' + form.stake + '金币'); return }
    setSealing(true)
    setTimeout(() => {
      setSealed(true)
      setSealing(false)
      showToast('印已落，诺已成。', 'success')
    }, 680)
  }

  async function handleSubmit() {
    if (!form.title.trim()) { showToast('请填写承诺内容'); return }
    if (noCoins) { showToast('金币不足，需要' + form.stake + '金币'); return }
    if (!sealed) { showToast('请先压上守诺印'); return }
    setLoading(true)
    try {
      const pledge = await createPledge(session.user.id, { title: form.title, period: form.period, stakeCoins: form.stake, charityTarget: form.charity, verifyType: form.verify, isPublic: form.isPublic })
      refreshProfile()
      showToast('契约已立，金币已托管', 'success')
      nav('/pledge/' + pledge.id)
    } catch (err) {
      showToast(err.message || '立誓失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="contractPage">
      <style>{css}</style>
      <div className="contractTopbar"><button className="backBtn" onClick={() => nav(-1)}>‹</button><div className="topTitle">立下契约</div><div className="topSpacer" /></div>
      <div className="contractBody">
        <section className={'scrollScene ' + (opened ? 'isOpen' : '')}>
          <div className="rod rodTop" /><div className="rod rodBottom" />
          <div className="paperSurface"><div className="paperTexture" />
            {!opened && <div className="closedIntro"><div className="introMark">一诺千金</div><h1>展开契约</h1><p>写下要守住的事，再亲手压印。</p><button className="darkBtn" onClick={() => setOpened(true)}>展开卷轴</button></div>}
            <div className="writingLayer"><div className="contractMeta">守诺契 · {period.label}</div><h1 className="contractTitle">吾立此诺</h1><label className="fieldLabel">誓言正文</label><textarea className="oathInput" rows={5} disabled={!opened || sealed || sealing} placeholder="例：每日学习 AI 两小时，并以截图为证。" value={form.title} onChange={e => set('title', e.target.value)} /><div className="oathPreview"><span>自今日起，至 {endDate}，每日为证。</span></div><div className="signatureLine"><span>立约人</span><strong>{profile?.nickname || profile?.username || '我'}</strong></div></div>
            {(sealing || sealed) && <div className={'sealImprint ' + (sealing ? 'isDropping' : 'isSet')}><div className="sealChar">{sealChar}</div><div className="sealText">守诺印</div></div>}
          </div>
        </section>
        <section className="termsPanel"><div className="termsHead"><h2>契约条款</h2><span>{currentCoins.toLocaleString()} 金币可用</span></div>
          <div className="termGroup"><div className="termLabel">期限</div><div className="optionGrid">{PERIODS.map(p => <button key={p.key} className={'optionBtn ' + (form.period === p.key ? 'active' : '')} disabled={p.locked} onClick={() => !p.locked && set('period', p.key)}><strong>{p.label}</strong><span>{p.days}天{p.locked ? ' · ' + p.need : ''}</span></button>)}</div></div>
          <div className="termGroup"><div className="termLabel">托管金币</div><div className="chipRow">{STAKES.map(s => <button key={s} className={'chipBtn ' + (form.stake === s ? 'active' : '')} onClick={() => set('stake', s)}>{s}</button>)}</div>{noCoins && <div className="dangerText">余额不足，请降低托管额</div>}</div>
          <div className="termGroup"><div className="termLabel">失信去向</div><div className="listOptions">{CHARITIES.map(c => <button key={c} className={'listBtn ' + (form.charity === c ? 'active' : '')} onClick={() => set('charity', c)}>{c}</button>)}</div></div>
          <div className="termGroup"><div className="termLabel">每日证明</div><div className="verifyGrid">{VERIFY.map(v => <button key={v.key} className={'verifyBtn ' + (form.verify === v.key ? 'active' : '')} onClick={() => set('verify', v.key)}><strong>{v.label}</strong><span>{v.desc}</span></button>)}</div></div>
          <div className="termGroup lastGroup"><div className="termLabel">公开</div><div className="verifyGrid"><button className={'verifyBtn ' + (form.isPublic ? 'active' : '')} onClick={() => set('isPublic', true)}><strong>公开见证</strong><span>进入广场，允许他人见证</span></button><button className={'verifyBtn ' + (!form.isPublic ? 'active' : '')} onClick={() => set('isPublic', false)}><strong>仅自己可见</strong><span>只保留个人契约</span></button></div></div>
        </section>
        <section className="ritualPanel"><p>{form.stake} 金币将在立约后托管。若失败，捐给「{form.charity}」。</p><button className="stampBtn" onClick={stamp} disabled={loading || !profile || noCoins || sealing}>{!opened ? '展开卷轴' : sealed ? '印已落，诺已成' : sealing ? '落印中...' : '压上守诺印'}</button><button className="submitBtn" onClick={handleSubmit} disabled={!sealed || loading || !profile || noCoins}>{!profile ? '加载账户中...' : loading ? '立约中...' : '正式立约，托管 ' + form.stake + ' 金币'}</button></section>
      </div>
    </div>
  )
}

const css = ".contractPage{min-height:100vh;background:#f3eee6;color:#1b1208;padding-bottom:104px}.contractTopbar{position:sticky;top:0;z-index:10;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #ded2bf;background:rgba(248,245,239,.96);backdrop-filter:blur(8px);box-sizing:border-box}.backBtn{width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.72);color:#1b1208;font-size:25px;line-height:1}.topTitle{font-family:serif;font-size:19px;font-weight:900}.topSpacer{width:34px}.contractBody{padding:16px}.scrollScene{position:relative;margin:4px 0 16px;min-height:154px;perspective:900px}.rod{position:absolute;left:12px;right:12px;height:15px;border-radius:999px;background:linear-gradient(90deg,#5b3218,#9b6934 18%,#3a1d0e 50%,#9b6934 82%,#5b3218);box-shadow:0 5px 10px rgba(45,25,10,.28);z-index:2}.rodTop{top:0}.rodBottom{bottom:0;transform:translateY(0);transition:transform 800ms cubic-bezier(.2,.75,.18,1)}.paperSurface{position:relative;min-height:130px;overflow:hidden;border:1px solid #cdb07a;border-radius:8px;background:#f9edcf;box-shadow:0 14px 30px rgba(55,35,14,.16);transform-origin:top center;transition:min-height 760ms cubic-bezier(.2,.75,.18,1),background 400ms ease}.scrollScene.isOpen .paperSurface{min-height:408px;background:#fbf0d4}.scrollScene.isOpen .rodBottom{transform:translateY(276px)}.paperTexture{position:absolute;inset:0;pointer-events:none;opacity:.56;background:radial-gradient(circle at 12% 16%,rgba(125,82,30,.10),transparent 22%),radial-gradient(circle at 76% 24%,rgba(125,82,30,.08),transparent 24%),linear-gradient(90deg,rgba(120,72,20,.13),transparent 8%,transparent 92%,rgba(120,72,20,.12)),repeating-linear-gradient(0deg,rgba(70,42,12,.035) 0 1px,transparent 1px 22px)}.closedIntro{z-index:4;position:absolute;inset:22px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:opacity 240ms ease,transform 240ms ease}.scrollScene.isOpen .closedIntro{opacity:0;transform:translateY(-10px);pointer-events:none}.introMark{font-size:12px;font-weight:900;letter-spacing:4px;color:#8a6227}.closedIntro h1{margin:8px 0 4px;font-family:serif;font-size:28px;line-height:1}.closedIntro p{margin:0 0 14px;color:#76644d;font-size:13px}.darkBtn{border:0;border-radius:8px;background:#1b1208;color:#f6d486;padding:10px 22px;font-weight:900}.writingLayer{pointer-events:none;position:relative;z-index:1;opacity:0;transform:translateY(14px);padding:36px 18px 22px;transition:opacity 360ms ease 420ms,transform 360ms ease 420ms}.scrollScene.isOpen .writingLayer{opacity:1;transform:translateY(0);pointer-events:auto}.contractMeta{font-size:12px;letter-spacing:3px;color:#8a6227;font-weight:900}.contractTitle{margin:8px 0 20px;font-family:serif;font-size:31px;line-height:1}.fieldLabel{display:block;margin-bottom:8px;color:#7d6238;font-size:12px;font-weight:900;letter-spacing:2px}.oathInput{width:100%;min-height:132px;box-sizing:border-box;border:0;border-bottom:1px solid rgba(104,75,36,.42);border-radius:0;outline:none;background:transparent;color:#1b1208;font-family:serif;font-size:20px;line-height:1.8;resize:none}.oathInput::placeholder{color:rgba(72,55,32,.42)}.oathInput:disabled{color:#1b1208;opacity:1}.oathPreview{margin-top:12px;color:#6e5b42;font-size:13px}.signatureLine{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:22px;padding-right:92px;color:#6e5b42;font-size:13px}.signatureLine strong{color:#1b1208;font-size:16px;font-family:serif}.sealImprint{position:absolute;right:26px;bottom:30px;z-index:3;width:82px;height:82px;border-radius:50%;border:2px solid rgba(144,22,16,.88);background:rgba(158,28,18,.08);color:#921610;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:serif;transform:rotate(-12deg);box-shadow:inset 0 0 0 6px rgba(144,22,16,.05)}.sealImprint.isDropping{animation:stampDrop 680ms cubic-bezier(.18,.82,.2,1) both}.sealImprint.isSet{opacity:.92}.sealChar{font-size:26px;font-weight:900;line-height:1}.sealText{margin-top:5px;font-size:11px;font-weight:900;letter-spacing:2px}@keyframes stampDrop{0%{opacity:0;transform:translateY(-90px) scale(1.35) rotate(-12deg);filter:blur(1px)}55%{opacity:1;transform:translateY(8px) scale(.9) rotate(-12deg)}74%{transform:translateY(-4px) scale(1.04) rotate(-12deg)}100%{opacity:.94;transform:translateY(0) scale(1) rotate(-12deg);filter:blur(0)}}.termsPanel,.ritualPanel{border:1px solid #ded2bf;border-radius:8px;background:rgba(255,255,255,.84);box-shadow:0 8px 22px rgba(55,35,14,.07);padding:15px;margin-bottom:14px}.termsHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}.termsHead h2{margin:0;font-family:serif;font-size:21px}.termsHead span{color:#8d7a62;font-size:12px}.termGroup{margin-top:15px}.termGroup:first-of-type{margin-top:0}.lastGroup{margin-bottom:2px}.termLabel{margin-bottom:8px;color:#8a6227;font-size:12px;font-weight:900;letter-spacing:2px}.optionGrid,.verifyGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.optionBtn,.verifyBtn,.chipBtn,.listBtn{border:1px solid #dfd2bd;border-radius:8px;background:#fffdf8;color:#1b1208;cursor:pointer}.optionBtn{min-height:62px;padding:9px 8px;text-align:left}.optionBtn strong,.verifyBtn strong{display:block;font-size:13px}.optionBtn span,.verifyBtn span{display:block;margin-top:4px;color:#8d7a62;font-size:11px;line-height:1.45}.optionBtn.active,.verifyBtn.active,.chipBtn.active{border-color:#b88923;background:#f8ecd0;box-shadow:inset 0 0 0 1px rgba(184,137,35,.28)}.optionBtn:disabled{opacity:.45;cursor:not-allowed}.chipRow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.chipBtn{padding:10px 6px;font-weight:900}.listOptions{display:grid;gap:7px}.listBtn{padding:11px 12px;text-align:left;font-weight:700}.listBtn.active{border-color:#3b7a4a;background:#e8f2eb;color:#1a4a28}.verifyBtn{padding:11px 10px;text-align:left}.dangerText{margin-top:7px;color:#b6352c;font-size:12px}.ritualPanel p{margin:0 0 12px;color:#725f45;font-size:13px;line-height:1.65}.stampBtn,.submitBtn{width:100%;border:0;border-radius:8px;padding:13px 12px;font-size:15px;font-weight:900}.stampBtn{margin-bottom:9px;border:1px solid rgba(144,22,16,.36);background:#f6e3dc;color:#921610}.submitBtn{background:#1b1208;color:#f6d486;box-shadow:0 5px 14px rgba(27,18,8,.18)}.stampBtn:disabled,.submitBtn:disabled{opacity:.48;cursor:not-allowed}"
