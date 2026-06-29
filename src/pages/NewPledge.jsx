// src/pages/NewPledge.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../App'
import { createPledge } from '../lib/supabase'
import { PLEDGE_CATEGORIES, getPledgeCategory } from '../lib/pledgeCategories'
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
  const [form, setForm] = useState({ title: '', categoryKey: 'study', categoryTag: '读书', period: 'month', stake: 10, charity: '山区图书馆', verify: 'screenshot', isPublic: true })
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
    setForm(f => {
      if (k === 'categoryKey') {
        const nextCategory = getPledgeCategory(v)
        return { ...f, categoryKey: nextCategory.key, categoryTag: nextCategory.tags[0] }
      }
      return { ...f, [k]: v }
    })
  }




  const currentCategory = getPledgeCategory(form.categoryKey)
  const period = PERIODS.find(p => p.key === form.period)
  const endDate = format(addDays(new Date(), period.days - 1), 'yyyy年M月d日')
  const currentCoins = profile?.merit_coins ?? 0
  const noCoins = currentCoins < form.stake
  const sealChar = userSeal(profile)




  function stamp() {
    if (!opened) { setOpened(true); return }
    if (!form.title.trim()) { showToast('请先写下誓言'); return }
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
      const pledge = await createPledge(session.user.id, { title: form.title, categoryKey: currentCategory.key, categoryLabel: currentCategory.label, categoryTag: form.categoryTag, period: form.period, stakeCoins: form.stake, charityTarget: form.charity, verifyType: form.verify, isPublic: form.isPublic })
      refreshProfile()
      showToast('契约已立，金币已托管', 'success')
      nav('/', { replace: true, state: { createdPledgeId: pledge.id } })
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
        <section className={'scrollStage ' + (opened ? 'isOpen' : '')}>
          <div className="paperWrap">
            <div className="writingLayer"><div className="contractMeta">守诺契 · {period.label}</div><h1 className="contractTitle">吾立此诺</h1><label className="fieldLabel">誓言正文</label><textarea className="oathInput" rows={5} disabled={!opened || sealed || sealing} placeholder="例：每日学习 AI 两小时，并以截图为证。" value={form.title} onChange={e => set('title', e.target.value)} /><div className="oathPreview">自今日起，至 {endDate}，每日为证。</div><div className="signatureLine"><span>立约人</span><strong>{profile?.nickname || profile?.username || '我'}</strong></div></div>
            {(sealing || sealed) && <div className={'sealImprint ' + (sealing ? 'isDropping' : 'isSet')}><div className="sealChar">{sealChar}</div><div className="sealText">守诺</div></div>}
          </div>
          <div className="rod leftRod" /><div className="rod rightRod" />
          {!opened && <div className="closedSeal"><button className="openBtn ribbonBtn" onClick={() => setOpened(true)}><span className="ribbonSide ribbonLeft" /><span className="ribbonLabel">启誓</span><span className="ribbonSide ribbonRight" /></button></div>}
        </section>
        <section className="termsPanel"><div className="termsHead"><h2>契约条款</h2><span>{currentCoins.toLocaleString()} 金币可用</span></div>
          <div className="termGroup"><div className="termLabel">誓言分类</div><div className="categoryGrid">{PLEDGE_CATEGORIES.map(c => <button key={c.key} className={'categoryBtn ' + (form.categoryKey === c.key ? 'active' : '')} onClick={() => set('categoryKey', c.key)}><strong>{c.emoji} {c.label}</strong><span>{c.hint}</span></button>)}</div></div>
          <div className="termGroup"><div className="termLabel">具体标签</div><div className="tagGrid">{currentCategory.tags.map(t => <button key={t} className={'tagBtn ' + (form.categoryTag === t ? 'active' : '')} onClick={() => set('categoryTag', t)}>{t}</button>)}</div></div>
          <div className="termGroup"><div className="termLabel">期限</div><div className="optionGrid">{PERIODS.map(p => <button key={p.key} className={'optionBtn ' + (form.period === p.key ? 'active' : '')} disabled={p.locked} onClick={() => !p.locked && set('period', p.key)}><strong>{p.label}</strong><span>{p.days}天{p.locked ? ' · ' + p.need : ''}</span></button>)}</div></div>
          <div className="termGroup"><div className="termLabel">托管金币</div><div className="chipRow">{STAKES.map(s => <button key={s} className={'chipBtn ' + (form.stake === s ? 'active' : '')} onClick={() => set('stake', s)}>{s}</button>)}</div>{noCoins && <div className="dangerText">余额不足，请降低托管额</div>}</div>
          <div className="termGroup"><div className="termLabel">失信去向</div><div className="listOptions">{CHARITIES.map(c => <button key={c} className={'listBtn ' + (form.charity === c ? 'active' : '')} onClick={() => set('charity', c)}>{c}</button>)}</div></div>
          <div className="termGroup"><div className="termLabel">每日证明</div><div className="verifyGrid">{VERIFY.map(v => <button key={v.key} className={'verifyBtn ' + (form.verify === v.key ? 'active' : '')} onClick={() => set('verify', v.key)}><strong>{v.label}</strong><span>{v.desc}</span></button>)}</div></div>
          <div className="termGroup"><div className="termLabel">公开</div><div className="verifyGrid"><button className={'verifyBtn ' + (form.isPublic ? 'active' : '')} onClick={() => set('isPublic', true)}><strong>公开见证</strong><span>进入广场，允许他人见证</span></button><button className={'verifyBtn ' + (!form.isPublic ? 'active' : '')} onClick={() => set('isPublic', false)}><strong>仅自己可见</strong><span>只保留个人契约</span></button></div></div>
        </section>
        <section className="ritualPanel"><p>{form.stake} 金币将在立约后托管。若失败，捐给「{form.charity}」。</p><button className="stampBtn" onClick={stamp} disabled={loading || sealing}>{!opened ? '展开画轴' : sealed ? '印已落，诺已成' : sealing ? '落印中...' : '压上守诺印'}</button><button className="submitBtn" onClick={handleSubmit} disabled={!sealed || loading || !profile || noCoins}>{!profile ? '加载账户中...' : loading ? '立约中...' : '正式立约，托管 ' + form.stake + ' 金币'}</button></section>
      </div>
    </div>
  )
}




const css = "\n.contractPage{min-height:100vh;background:radial-gradient(circle at 50% -14%,rgba(190,137,55,.24),transparent 35%),linear-gradient(180deg,#1c130b 0%,#130c06 56%,#0d0804 100%);color:#24180d;padding-bottom:104px}.contractTopbar{position:sticky;top:0;z-index:10;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid rgba(214,190,145,.24);background:rgba(23,18,13,.94);backdrop-filter:blur(10px);box-sizing:border-box}.backBtn{width:34px;height:34px;border:1px solid rgba(224,203,164,.25);border-radius:50%;background:rgba(255,247,225,.08);color:#ead7ad;font-size:25px;line-height:1}.topTitle{font-family:serif;font-size:19px;font-weight:900;color:#f2ddb0;letter-spacing:2px}.topSpacer{width:34px}.contractBody{padding:22px 16px 0}.scrollStage{position:relative;height:334px;margin:0 0 18px;perspective:900px}.paperWrap{position:absolute;left:24px;right:24px;top:28px;height:274px;transform:scaleX(.16);transform-origin:center center;opacity:.62;transition:transform 980ms cubic-bezier(.16,.84,.14,1),opacity 420ms ease;background:linear-gradient(0deg,rgba(118,25,17,.20) 0 13px,rgba(219,167,74,.22) 13px 18px,transparent 18px calc(100% - 18px),rgba(219,167,74,.22) calc(100% - 18px) calc(100% - 13px),rgba(118,25,17,.20) calc(100% - 13px)),linear-gradient(90deg,#a87527 0,#dfb55b 3%,#f8e7ab 8%,#f1d889 24%,#f6e4a4 50%,#f1d889 76%,#f8e7ab 92%,#dfb55b 97%,#a87527 100%);border:1px solid rgba(205,159,72,.78);box-shadow:0 18px 38px rgba(0,0,0,.42),inset 0 0 42px rgba(92,52,12,.18),inset 22px 0 28px rgba(91,49,12,.16),inset -22px 0 28px rgba(91,49,12,.16);overflow:hidden}.scrollStage.isOpen .paperWrap{transform:scaleX(1);opacity:1}.paperWrap:before{content:\"\";position:absolute;inset:0;background:radial-gradient(ellipse at 16% 18%,rgba(108,65,18,.14),transparent 26%),radial-gradient(ellipse at 78% 72%,rgba(108,65,18,.12),transparent 28%),linear-gradient(90deg,rgba(92,48,9,.23),transparent 11%,transparent 89%,rgba(92,48,9,.23)),repeating-linear-gradient(90deg,rgba(112,74,25,.04) 0 1px,transparent 1px 16px),repeating-linear-gradient(0deg,rgba(74,42,10,.045) 0 1px,transparent 1px 22px);pointer-events:none}.paperWrap:after{content:\"\";position:absolute;inset:13px;border:1px solid rgba(126,82,31,.28);box-shadow:inset 0 0 0 1px rgba(255,244,193,.22);pointer-events:none}.rod{position:absolute;top:14px;width:28px;height:302px;border-radius:999px;background:linear-gradient(90deg,#241006,#6f3d18 22%,#d1a04a 48%,#512714 73%,#160803);box-shadow:0 18px 30px rgba(0,0,0,.46),inset 0 0 10px rgba(255,226,142,.20);z-index:4;transition:left 980ms cubic-bezier(.16,.84,.14,1),right 980ms cubic-bezier(.16,.84,.14,1),transform 980ms cubic-bezier(.16,.84,.14,1)}.rod:before,.rod:after{content:\"\";position:absolute;left:-5px;width:38px;height:18px;border-radius:50%;background:radial-gradient(circle,#d8b15b 0,#714217 60%,#251106 100%);box-shadow:0 3px 8px rgba(0,0,0,.35)}.rod:before{top:-5px}.rod:after{bottom:-5px}.leftRod{left:calc(50% - 18px)}.rightRod{right:calc(50% - 18px)}.scrollStage.isOpen .leftRod{left:4px}.scrollStage.isOpen .rightRod{right:4px}.closedSeal{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;text-align:center;color:#ecd9ad;transition:opacity 260ms ease,transform 260ms ease}.scrollStage.isOpen .closedSeal{opacity:0;transform:scale(.96);pointer-events:none}.openBtn{position:relative;border:0;background:transparent;color:#f8e7c0;padding:0;width:236px;height:56px;font-weight:900;letter-spacing:6px;filter:drop-shadow(0 14px 18px rgba(0,0,0,.34));font-family:serif}.ribbonBtn{display:flex;align-items:center;justify-content:center}.ribbonSide{position:absolute;top:8px;width:108px;height:40px;background:linear-gradient(180deg,#9e2317 0%,#73150f 52%,#4c0e0b 100%);border-top:1px solid rgba(255,214,160,.38);border-bottom:1px solid rgba(40,0,0,.42);box-shadow:inset 0 9px 10px rgba(255,190,130,.12),inset 0 -9px 12px rgba(48,0,0,.28);transition:transform 620ms cubic-bezier(.16,.84,.14,1),opacity 420ms ease}.ribbonSide:before{content:'';position:absolute;top:0;width:22px;height:40px;background:linear-gradient(180deg,#7e1811,#4b0c08);clip-path:polygon(0 0,100% 50%,0 100%)}.ribbonLeft{left:6px;border-radius:4px 0 0 4px}.ribbonLeft:before{left:-21px;transform:scaleX(-1)}.ribbonRight{right:6px;border-radius:0 4px 4px 0}.ribbonRight:before{right:-21px}.ribbonLabel{position:relative;z-index:2;min-width:82px;height:42px;line-height:42px;border-radius:999px;background:radial-gradient(circle at 50% 20%,#f7d883,#b98729 62%,#6b310f);color:#321006;text-align:center;text-shadow:0 1px 0 rgba(255,231,170,.35);box-shadow:0 5px 14px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,242,190,.42);transition:transform 420ms ease,opacity 360ms ease}.openBtn:active .ribbonLeft{transform:translateX(-24px) rotate(-3deg)}.openBtn:active .ribbonRight{transform:translateX(24px) rotate(3deg)}.openBtn:active .ribbonLabel{transform:scale(.94)}.scrollStage.isOpen .ribbonLeft{transform:translateX(-92px) rotate(-6deg);opacity:0}.scrollStage.isOpen .ribbonRight{transform:translateX(92px) rotate(6deg);opacity:0}.scrollStage.isOpen .ribbonLabel{opacity:0;transform:scale(.88)}.writingLayer{position:relative;z-index:2;height:100%;box-sizing:border-box;padding:28px 28px 22px;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity 360ms ease 620ms,transform 360ms ease 620ms}.scrollStage.isOpen .writingLayer{opacity:1;transform:translateY(0);pointer-events:auto}.contractMeta{font-size:12px;letter-spacing:4px;color:#8f6729;font-weight:900}.contractTitle{margin:8px 0 18px;font-family:serif;font-size:30px;line-height:1;color:#23170b}.fieldLabel{display:block;margin-bottom:7px;color:#7d5d2e;font-size:12px;font-weight:900;letter-spacing:2px}.oathInput{width:100%;min-height:122px;box-sizing:border-box;border:0;border-radius:0;border-bottom:1px solid rgba(93,62,24,.35);outline:none;background:transparent;color:#1f1409;font-family:serif;font-size:20px;line-height:1.75;resize:none}.oathInput::placeholder{color:rgba(72,48,20,.4)}.oathInput:disabled{opacity:1;color:#1f1409}.oathPreview{margin-top:10px;color:#6f5630;font-size:12px}.signatureLine{display:flex;justify-content:flex-end;gap:10px;align-items:center;margin-top:16px;padding-right:84px;color:#6f5630;font-size:13px}.signatureLine strong{font-family:serif;font-size:16px;color:#1f1409}.sealImprint{position:absolute;right:38px;bottom:34px;z-index:3;width:56px;height:56px;border-radius:2px;border:2px solid rgba(143,20,14,.82);background:rgba(143,20,14,.13);color:#8c120d;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:serif;transform:rotate(-7deg);box-shadow:inset 0 0 0 4px rgba(143,20,14,.06),inset 0 0 14px rgba(143,20,14,.12),0 2px 4px rgba(80,20,12,.06);mix-blend-mode:multiply}.sealImprint:before{content:\"\";position:absolute;inset:5px;border:1px solid rgba(143,20,14,.55)}.sealImprint.isDropping{animation:stampDrop 720ms cubic-bezier(.18,.82,.2,1) both}.sealImprint.isSet{opacity:.92}.sealChar{font-size:20px;font-weight:900;line-height:1}.sealText{margin-top:3px;font-size:11px;font-weight:900;letter-spacing:1px}@keyframes stampDrop{0%{opacity:0;transform:translateY(-70px) scale(1.28) rotate(-8deg);filter:blur(1px)}54%{opacity:1;transform:translateY(6px) scale(.92) rotate(-8deg)}76%{transform:translateY(-2px) scale(1.03) rotate(-8deg)}100%{opacity:.94;transform:translateY(0) scale(1) rotate(-8deg);filter:blur(0)}}.termsPanel,.ritualPanel{border:1px solid rgba(222,210,191,.88);border-radius:8px;background:#fbf7ef;box-shadow:0 8px 22px rgba(0,0,0,.12);padding:15px;margin-bottom:14px}.termsHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}.termsHead h2{margin:0;font-family:serif;font-size:21px}.termsHead span{color:#8d7a62;font-size:12px}.termGroup{margin-top:15px}.termGroup:first-of-type{margin-top:0}.termLabel{margin-bottom:8px;color:#8a6227;font-size:12px;font-weight:900;letter-spacing:2px}.optionGrid,.verifyGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.categoryGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tagGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.optionBtn,.verifyBtn,.chipBtn,.listBtn,.categoryBtn,.tagBtn{border:1px solid #dfd2bd;border-radius:8px;background:#fffdf8;color:#1b1208;cursor:pointer}.categoryBtn{min-height:72px;padding:9px 8px;text-align:left}.categoryBtn strong{display:block;font-size:13px}.categoryBtn span{display:block;margin-top:4px;color:#8d7a62;font-size:11px;line-height:1.45}.tagBtn{padding:9px 6px;font-size:12px;font-weight:800}.optionBtn{min-height:62px;padding:9px 8px;text-align:left}.optionBtn strong,.verifyBtn strong{display:block;font-size:13px}.optionBtn span,.verifyBtn span{display:block;margin-top:4px;color:#8d7a62;font-size:11px;line-height:1.45}.optionBtn.active,.verifyBtn.active,.chipBtn.active,.categoryBtn.active,.tagBtn.active{border-color:#9d762c;background:#f4e5c5;box-shadow:inset 0 0 0 1px rgba(157,118,44,.28)}.optionBtn:disabled{opacity:.45;cursor:not-allowed}.chipRow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.chipBtn{padding:10px 6px;font-weight:900}.listOptions{display:grid;gap:7px}.listBtn{padding:11px 12px;text-align:left;font-weight:700}.listBtn.active{border-color:#3b6b4a;background:#e7f0e8;color:#1a4a28}.verifyBtn{padding:11px 10px;text-align:left}.dangerText{margin-top:7px;color:#a93128;font-size:12px}.ritualPanel p{margin:0 0 12px;color:#725f45;font-size:13px;line-height:1.65}.stampBtn,.submitBtn{width:100%;border:0;border-radius:8px;padding:13px 12px;font-size:15px;font-weight:900}.stampBtn{margin-bottom:9px;border:1px solid rgba(143,20,14,.42);background:linear-gradient(180deg,#f4e2d9,#e8c4b5);color:#8f140e}.submitBtn{background:#1b1208;color:#f6d486;box-shadow:0 5px 14px rgba(27,18,8,.18)}.stampBtn:disabled,.submitBtn:disabled{opacity:.48;cursor:not-allowed}"
