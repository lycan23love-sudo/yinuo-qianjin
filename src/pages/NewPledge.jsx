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
    }, 720)
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
        <p className="stageHint">画轴展开，字落纸上，印落成契。</p>
        <section className={'scrollStage ' + (opened ? 'isOpen' : '')}>
          <div className="paperWrap">
            <div className="writingLayer"><div className="contractMeta">守诺契 · {period.label}</div><h1 className="contractTitle">吾立此诺</h1><label className="fieldLabel">誓言正文</label><textarea className="oathInput" rows={5} disabled={!opened || sealed || sealing} placeholder="例：每日学习 AI 两小时，并以截图为证。" value={form.title} onChange={e => set('title', e.target.value)} /><div className="oathPreview">自今日起，至 {endDate}，每日为证。</div><div className="signatureLine"><span>立约人</span><strong>{profile?.nickname || profile?.username || '我'}</strong></div></div>
            {(sealing || sealed) && <div className={'sealImprint ' + (sealing ? 'isDropping' : 'isSet')}><div className="sealChar">{sealChar}</div><div className="sealText">守诺印</div></div>}
          </div>
          <div className="rod leftRod" /><div className="rod rightRod" />
          {!opened && <div className="closedSeal"><div className="brand">一诺千金</div><h1>展开画轴</h1><p>写下要守住的事，再亲手压印。</p><button className="openBtn" onClick={() => setOpened(true)}>展开</button></div>}
        </section>
        <section className="termsPanel"><div className="termsHead"><h2>契约条款</h2><span>{currentCoins.toLocaleString()} 金币可用</span></div>
          <div className="termGroup"><div className="termLabel">期限</div><div className="optionGrid">{PERIODS.map(p => <button key={p.key} className={'optionBtn ' + (form.period === p.key ? 'active' : '')} disabled={p.locked} onClick={() => !p.locked && set('period', p.key)}><strong>{p.label}</strong><span>{p.days}天{p.locked ? ' · ' + p.need : ''}</span></button>)}</div></div>
          <div className="termGroup"><div className="termLabel">托管金币</div><div className="chipRow">{STAKES.map(s => <button key={s} className={'chipBtn ' + (form.stake === s ? 'active' : '')} onClick={() => set('stake', s)}>{s}</button>)}</div>{noCoins && <div className="dangerText">余额不足，请降低托管额</div>}</div>
          <div className="termGroup"><div className="termLabel">失信去向</div><div className="listOptions">{CHARITIES.map(c => <button key={c} className={'listBtn ' + (form.charity === c ? 'active' : '')} onClick={() => set('charity', c)}>{c}</button>)}</div></div>
          <div className="termGroup"><div className="termLabel">每日证明</div><div className="verifyGrid">{VERIFY.map(v => <button key={v.key} className={'verifyBtn ' + (form.verify === v.key ? 'active' : '')} onClick={() => set('verify', v.key)}><strong>{v.label}</strong><span>{v.desc}</span></button>)}</div></div>
          <div className="termGroup"><div className="termLabel">公开</div><div className="verifyGrid"><button className={'verifyBtn ' + (form.isPublic ? 'active' : '')} onClick={() => set('isPublic', true)}><strong>公开见证</strong><span>进入广场，允许他人见证</span></button><button className={'verifyBtn ' + (!form.isPublic ? 'active' : '')} onClick={() => set('isPublic', false)}><strong>仅自己可见</strong><span>只保留个人契约</span></button></div></div>
        </section>
        <section className="ritualPanel"><p>{form.stake} 金币将在立约后托管。若失败，捐给「{form.charity}」。</p><button className="stampBtn" onClick={stamp} disabled={loading || !profile || noCoins || sealing}>{!opened ? '展开画轴' : sealed ? '印已落，诺已成' : sealing ? '落印中...' : '压上守诺印'}</button><button className="submitBtn" onClick={handleSubmit} disabled={!sealed || loading || !profile || noCoins}>{!profile ? '加载账户中...' : loading ? '立约中...' : '正式立约，托管 ' + form.stake + ' 金币'}</button></section>
      </div>
    </div>
  )
}

const css = "\n.contractPage{min-height:100vh;background:#17120d;color:#24180d;padding-bottom:104px}.contractTopbar{position:sticky;top:0;z-index:10;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid rgba(214,190,145,.24);background:rgba(23,18,13,.94);backdrop-filter:blur(10px);box-sizing:border-box}.backBtn{width:34px;height:34px;border:1px solid rgba(224,203,164,.25);border-radius:50%;background:rgba(255,247,225,.08);color:#ead7ad;font-size:25px;line-height:1}.topTitle{font-family:serif;font-size:19px;font-weight:900;color:#f2ddb0;letter-spacing:2px}.topSpacer{width:34px}.contractBody{padding:18px 16px 0}.stageHint{margin:0 0 14px;color:#bfa77a;font-size:12px;line-height:1.7;text-align:center;letter-spacing:1px}.scrollStage{position:relative;height:330px;margin:0 0 18px;perspective:900px}.paperWrap{position:absolute;left:24px;right:24px;top:28px;height:274px;transform:scaleX(.16);transform-origin:center center;opacity:.62;transition:transform 920ms cubic-bezier(.18,.82,.16,1),opacity 420ms ease;background:#efd79b;border:1px solid #b98d42;box-shadow:0 18px 34px rgba(0,0,0,.38),inset 0 0 32px rgba(122,73,21,.16);overflow:hidden}.scrollStage.isOpen .paperWrap{transform:scaleX(1);opacity:1}.paperWrap:before{content:\"\";position:absolute;inset:0;background:linear-gradient(90deg,rgba(105,61,16,.18),transparent 8%,transparent 92%,rgba(105,61,16,.18)),radial-gradient(circle at 18% 22%,rgba(103,62,22,.10),transparent 20%),radial-gradient(circle at 72% 76%,rgba(103,62,22,.09),transparent 24%),repeating-linear-gradient(0deg,rgba(74,42,10,.045) 0 1px,transparent 1px 24px);pointer-events:none}.paperWrap:after{content:\"\";position:absolute;inset:10px;border:1px solid rgba(126,82,31,.28);pointer-events:none}.rod{position:absolute;top:14px;width:28px;height:302px;border-radius:999px;background:linear-gradient(90deg,#2b170a,#8a5c2a 22%,#d5a857 48%,#573016 72%,#1b0d05);box-shadow:0 18px 28px rgba(0,0,0,.42),inset 0 0 12px rgba(255,228,157,.24);z-index:4;transition:left 920ms cubic-bezier(.18,.82,.16,1),right 920ms cubic-bezier(.18,.82,.16,1),transform 920ms cubic-bezier(.18,.82,.16,1)}.rod:before,.rod:after{content:\"\";position:absolute;left:-5px;width:38px;height:18px;border-radius:50%;background:radial-gradient(circle,#d8b15b 0,#714217 60%,#251106 100%);box-shadow:0 3px 8px rgba(0,0,0,.35)}.rod:before{top:-5px}.rod:after{bottom:-5px}.leftRod{left:calc(50% - 18px)}.rightRod{right:calc(50% - 18px)}.scrollStage.isOpen .leftRod{left:4px}.scrollStage.isOpen .rightRod{right:4px}.closedSeal{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#ecd9ad;transition:opacity 260ms ease,transform 260ms ease}.scrollStage.isOpen .closedSeal{opacity:0;transform:scale(.96);pointer-events:none}.closedSeal .brand{font-family:serif;font-size:13px;letter-spacing:5px;color:#cda75e}.closedSeal h1{margin:8px 0 6px;font-family:serif;font-size:30px;line-height:1;color:#f4e1b9}.closedSeal p{margin:0 0 16px;color:#bfa77a;font-size:13px}.openBtn{border:1px solid rgba(226,197,126,.46);border-radius:999px;background:#ead2a0;color:#27180b;padding:11px 28px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.28)}.writingLayer{position:relative;z-index:2;height:100%;box-sizing:border-box;padding:28px 28px 22px;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity 360ms ease 620ms,transform 360ms ease 620ms}.scrollStage.isOpen .writingLayer{opacity:1;transform:translateY(0);pointer-events:auto}.contractMeta{font-size:12px;letter-spacing:4px;color:#8f6729;font-weight:900}.contractTitle{margin:8px 0 18px;font-family:serif;font-size:30px;line-height:1;color:#23170b}.fieldLabel{display:block;margin-bottom:7px;color:#7d5d2e;font-size:12px;font-weight:900;letter-spacing:2px}.oathInput{width:100%;min-height:122px;box-sizing:border-box;border:0;border-radius:0;border-bottom:1px solid rgba(93,62,24,.35);outline:none;background:transparent;color:#1f1409;font-family:serif;font-size:20px;line-height:1.75;resize:none}.oathInput::placeholder{color:rgba(72,48,20,.4)}.oathInput:disabled{opacity:1;color:#1f1409}.oathPreview{margin-top:10px;color:#6f5630;font-size:12px}.signatureLine{display:flex;justify-content:flex-end;gap:10px;align-items:center;margin-top:16px;padding-right:84px;color:#6f5630;font-size:13px}.signatureLine strong{font-family:serif;font-size:16px;color:#1f1409}.sealImprint{position:absolute;right:34px;bottom:26px;z-index:3;width:78px;height:78px;border-radius:50%;border:2px solid rgba(143,20,14,.86);background:rgba(151,27,18,.07);color:#8f140e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:serif;transform:rotate(-12deg);box-shadow:inset 0 0 0 6px rgba(143,20,14,.045)}.sealImprint.isDropping{animation:stampDrop 720ms cubic-bezier(.18,.82,.2,1) both}.sealImprint.isSet{opacity:.92}.sealChar{font-size:25px;font-weight:900;line-height:1}.sealText{margin-top:5px;font-size:11px;font-weight:900;letter-spacing:2px}@keyframes stampDrop{0%{opacity:0;transform:translateY(-76px) scale(1.38) rotate(-12deg);filter:blur(1px)}52%{opacity:1;transform:translateY(8px) scale(.9) rotate(-12deg)}74%{transform:translateY(-3px) scale(1.04) rotate(-12deg)}100%{opacity:.94;transform:translateY(0) scale(1) rotate(-12deg);filter:blur(0)}}.termsPanel,.ritualPanel{border:1px solid rgba(222,210,191,.88);border-radius:8px;background:#fbf7ef;box-shadow:0 8px 22px rgba(0,0,0,.12);padding:15px;margin-bottom:14px}.termsHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}.termsHead h2{margin:0;font-family:serif;font-size:21px}.termsHead span{color:#8d7a62;font-size:12px}.termGroup{margin-top:15px}.termGroup:first-of-type{margin-top:0}.termLabel{margin-bottom:8px;color:#8a6227;font-size:12px;font-weight:900;letter-spacing:2px}.optionGrid,.verifyGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.optionBtn,.verifyBtn,.chipBtn,.listBtn{border:1px solid #dfd2bd;border-radius:8px;background:#fffdf8;color:#1b1208;cursor:pointer}.optionBtn{min-height:62px;padding:9px 8px;text-align:left}.optionBtn strong,.verifyBtn strong{display:block;font-size:13px}.optionBtn span,.verifyBtn span{display:block;margin-top:4px;color:#8d7a62;font-size:11px;line-height:1.45}.optionBtn.active,.verifyBtn.active,.chipBtn.active{border-color:#9d762c;background:#f4e5c5;box-shadow:inset 0 0 0 1px rgba(157,118,44,.28)}.optionBtn:disabled{opacity:.45;cursor:not-allowed}.chipRow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.chipBtn{padding:10px 6px;font-weight:900}.listOptions{display:grid;gap:7px}.listBtn{padding:11px 12px;text-align:left;font-weight:700}.listBtn.active{border-color:#3b6b4a;background:#e7f0e8;color:#1a4a28}.verifyBtn{padding:11px 10px;text-align:left}.dangerText{margin-top:7px;color:#a93128;font-size:12px}.ritualPanel p{margin:0 0 12px;color:#725f45;font-size:13px;line-height:1.65}.stampBtn,.submitBtn{width:100%;border:0;border-radius:8px;padding:13px 12px;font-size:15px;font-weight:900}.stampBtn{margin-bottom:9px;border:1px solid rgba(143,20,14,.36);background:#f2ded4;color:#8f140e}.submitBtn{background:#1b1208;color:#f6d486;box-shadow:0 5px 14px rgba(27,18,8,.18)}.stampBtn:disabled,.submitBtn:disabled{opacity:.48;cursor:not-allowed}"
