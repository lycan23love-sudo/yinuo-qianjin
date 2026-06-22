// src/pages/CharityPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

const C = {
  gold:'#C8922A', goldL:'#FDF3E0', goldD:'#7A5A18',
  ink:'#1A1208', muted:'#7A6A50', hint:'#B8A88A',
  bg:'#FAF7F2', surf:'#FFFFFF', soft:'#F5F0E8', soft2:'#EDE6D8',
  border:'#E0D5C0',
  red:'#C84040', redL:'#FCEBEB', redD:'#8A2020',
  green:'#3B7A4A', greenL:'#E8F5EC', greenD:'#1A4A28',
  blue:'#3A6A9A', blueL:'#E8F0FA',
}

const ORGS = [
  { id:'animal',  emoji:'🐾', name:'中国动物保护联盟', desc:'救助流浪动物、反虐待倡导、野生动物保育',   total: 42800 },
  { id:'library', emoji:'📚', name:'山区图书馆计划',   desc:'为偏远山区儿童建立图书室，捐书捐课',       total: 28400 },
  { id:'child',   emoji:'❤️', name:'儿童健康基金',     desc:'贫困儿童医疗援助、营养干预、心理关怀',     total: 67200 },
  { id:'env',     emoji:'🌳', name:'公益绿色行动',     desc:'植树造林、减碳倡导、环保教育',             total: 19600 },
  { id:'poverty', emoji:'🏥', name:'贫困助学基金',     desc:'资助寒门学子完成学业，改变命运',           total: 31000 },
]

const AMOUNTS = [200, 500, 1000, '全部']

const RECORDS = [
  { emoji:'🐾', org:'中国动物保护联盟', reason:'冥想30天完成',         date:'2025年4月', coins:500,  type:'gain', note:'「希望每只小动物都能被温柔对待」' },
  { emoji:'📚', org:'山区图书馆计划',   reason:'阅读21天失败捐出',     date:'2025年3月', coins:300,  type:'loss', note:'失败的代价流向了有意义的地方' },
  { emoji:'❤️', org:'儿童健康基金',     reason:'见证他人誓言失败分得', date:'2025年2月', coins:240,  type:'gain', note:'押对了，这笔钱由我来决定去向' },
]

const CERTS = [
  { emoji:'🌿', name:'初级善行证书',  need:500,   done:500,  color:C.green,  earned:true,  date:'2025年4月', desc:'累计捐出 500 金币达成' },
  { emoji:'🔵', name:'中级功德证书',  need:5000,  done:500,  color:C.blue,   earned:false, desc:'含机构公章，可用于个人简历' },
  { emoji:'🟡', name:'高级行善证书',  need:20000, done:500,  color:C.gold,   earned:false, desc:'社会公益影响力认证' },
  { emoji:'🪷', name:'至高菩萨证书',  need:50000, done:500,  color:'#7F77DD',earned:false, desc:'区块链存证 · 终身荣誉' },
]

function SecLabel({ children, style }) {
  return <div style={{ fontSize:11, fontWeight:600, color:C.muted, letterSpacing:.5, marginBottom:10, ...style }}>{children}</div>
}

function Tag({ text, bg, color }) {
  return <div style={{ background:bg, color, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, flexShrink:0 }}>{text}</div>
}

export default function CharityPage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [tab, setTab]         = useState('donate')
  const [selOrg, setSelOrg]   = useState('animal')
  const [selAmt, setSelAmt]   = useState(500)
  const [message, setMessage] = useState('')
  const [toast, setToast]     = useState(null)
  const [joined, setJoined]   = useState({})

  const coins   = profile?.merit_coins  ?? 1240
  const merit   = profile?.total_merit  ?? 3800
  const donated = 4300   // mock累计捐出

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  function doDonate() {
    const amt = selAmt === '全部' ? coins : selAmt
    showToast(`❤️ 已捐出 ${amt} 金币，感谢你的善行！`)
  }

  // ─── 捐款 Tab ───
  const DonateTab = () => (
    <div style={{ padding:'14px 16px', paddingBottom:80 }}>

      {/* 钱包条 */}
      <div style={{ ...S.walletStrip, cursor:'pointer' }} onClick={() => showToast('功德详情即将上线')}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:22, color:C.gold }}>🪙</span>
          <div>
            <div style={{ fontSize:11, color:C.muted }}>公益金币余额</div>
            <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:18, fontWeight:900, color:C.goldD }}>
              🪙 {coins.toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:C.muted }}>功德值</div>
          <div style={{ fontSize:16, fontWeight:500, color:C.greenD }}>{merit.toLocaleString()}</div>
        </div>
      </div>

      {/* 称号进度 */}
      <div style={{ ...S.card, marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <span style={{ fontSize:22 }}>🌿</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.greenD }}>种善者</div>
            <div style={{ fontSize:11, color:C.muted }}>距「护法者」还需 760 金币</div>
          </div>
          <button style={S.btnSm} onClick={() => showToast('称号详情即将上线')}>称号详情</button>
        </div>
        <div style={{ background:C.soft2, borderRadius:3, height:7, overflow:'hidden' }}>
          <div style={{ width:'62%', height:'100%', background:C.green, borderRadius:3 }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:C.hint, marginTop:4 }}>
          <span>500</span><span>1,240 / 2,000</span><span>2,000</span>
        </div>
      </div>

      <SecLabel>选择捐款机构</SecLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
        {ORGS.map(org => (
          <div key={org.id}
            onClick={() => setSelOrg(org.id)}
            style={{ ...S.orgCard, ...(selOrg === org.id ? S.orgCardOn : {}) }}>
            <div style={{ fontSize:28, marginBottom:6 }}>{org.emoji}</div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:2, color:C.ink }}>{org.name}</div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:8, lineHeight:1.5 }}>{org.desc}</div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
              <span style={{ color:C.muted }}>平台已捐 <b style={{ color:C.ink }}>{org.total.toLocaleString()}</b> 金币</span>
              {selOrg === org.id && <span style={{ color:C.greenD, fontWeight:500 }}>已选 ✓</span>}
            </div>
          </div>
        ))}
      </div>

      <SecLabel>捐出金额</SecLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:10 }}>
        {AMOUNTS.map(a => (
          <div key={a} onClick={() => setSelAmt(a)}
            style={{ ...S.amtOpt, ...(selAmt === a ? S.amtOptOn : {}) }}>
            {a}
          </div>
        ))}
      </div>

      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>留言给受益者（选填）</div>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="写下你想说的话，与受益者分享…"
          style={{ width:'100%', minHeight:56, border:`1px solid ${C.border}`, borderRadius:10,
            padding:'10px 12px', fontSize:13, fontFamily:'Noto Sans SC,sans-serif',
            color:C.ink, background:C.surf, outline:'none', resize:'none' }} />
      </div>

      <button style={S.btnGold} onClick={doDonate}>
        ❤️ 捐出 {selAmt === '全部' ? coins.toLocaleString() : selAmt} 金币
      </button>
      <div style={{ fontSize:11, color:C.hint, textAlign:'center', marginTop:8, lineHeight:1.7 }}>
        金币不可提现 · 平台代为转交合规公益机构<br />捐款后自动生成公益记录，累计功德值
      </div>
      <div style={{ height:16 }} />
    </div>
  )

  // ─── 公益活动 Tab ───
  const ActivityTab = () => (
    <div style={{ padding:'14px 16px', paddingBottom:80 }}>
      <div style={{ ...S.notice, marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.goldD, marginBottom:4 }}>✨ 公益活动</div>
        <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>参与平台发起或用户发起的公益行动，完成誓言即是最好的公益贡献。</div>
      </div>

      <SecLabel>平台发起</SecLabel>

      {/* 活动卡1 */}
      <div style={S.actCard}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
          <span style={{ fontSize:28, flexShrink:0 }}>🌿</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:2, color:C.ink }}>「一人一树」环保誓言月</div>
            <div style={{ fontSize:11, color:C.muted }}>5月1日 — 5月31日 · 平台赞助</div>
          </div>
          <Tag text="进行中" bg={C.greenL} color={C.green} />
        </div>
        <div style={{ fontSize:12, color:C.muted, lineHeight:1.6, marginBottom:10 }}>
          立下「减少碳足迹」类誓言，完成后平台代你种一棵树。已有 1,284 人参与，共种 847 棵。
        </div>
        <div style={{ background:C.soft2, borderRadius:3, height:5, overflow:'hidden', marginBottom:6 }}>
          <div style={{ width:'66%', height:'100%', background:C.green, borderRadius:3 }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted }}>
          <span>🌱 847 棵已种</span><span>目标 1280 棵</span>
        </div>
      </div>

      {/* 活动卡2 */}
      <div style={S.actCard}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
          <span style={{ fontSize:28, flexShrink:0 }}>📚</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:2, color:C.ink }}>「书香送山区」读书马拉松</div>
            <div style={{ fontSize:11, color:C.muted }}>常设活动 · 山区图书馆计划</div>
          </div>
          <Tag text="常设" bg={C.goldL} color={C.goldD} />
        </div>
        <div style={{ fontSize:12, color:C.muted, lineHeight:1.6, marginBottom:10 }}>
          每完成一个读书类誓言，捐出10%赌注给山区图书馆。本月已有 328 人参与，共捐出 84,200 金币。
        </div>
        <button style={{ ...S.btnSm, ...S.btnSmOn }}
          onClick={() => showToast('已加入书香计划！')}>加入活动</button>
      </div>

      <SecLabel style={{ marginTop:4 }}>用户发起</SecLabel>

      <div style={S.actCard}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:C.green,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, color:'#fff', fontWeight:700, flexShrink:0 }}>铁</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>铁汉发起 · 「健身公益跑」</div>
            <div style={{ fontSize:11, color:C.muted }}>每完成一周健身誓言，捐出50金币给残疾人体育基金</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>24人参与 · 共捐出 12,400 金币</div>
        <button style={{ ...S.btnSm, ...S.btnSmOn }}
          onClick={() => showToast('已加入健身公益跑！')}>加入</button>
      </div>

      <div style={{ marginTop:16 }}>
        <button style={S.btnOutline} onClick={() => showToast('需达到功德大师称号才能发起活动')}>
          ＋ 发起公益活动（功德大师以上）
        </button>
      </div>
      <div style={{ height:16 }} />
    </div>
  )

  // ─── 我的记录 Tab ───
  const RecordTab = () => (
    <div style={{ padding:'14px 16px', paddingBottom:80 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
        {[['4,300','累计捐出金币'],['3','参与机构数'],['68','受益人次'],['3,800','累计功德值']].map(([v,l]) => (
          <div key={l} style={S.statBox}>
            <div style={{ fontFamily:'Noto Serif SC,serif', fontSize:20, fontWeight:700, color:C.ink }}>{v}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      <SecLabel>捐款记录</SecLabel>
      {RECORDS.map((r, i) => (
        <div key={i} style={S.recItem}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:18 }}>{r.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>{r.org}</div>
              <div style={{ fontSize:11, color:C.muted }}>{r.reason} · {r.date}</div>
            </div>
            <div style={{ fontSize:14, fontWeight:600,
              color: r.type === 'gain' ? C.greenD : C.redD }}>
              {r.type === 'gain' ? '+' : ''}{r.coins}金币
            </div>
          </div>
          <div style={{ fontSize:12, color:C.hint, fontStyle:'italic', marginLeft:28 }}>
            {r.note}
          </div>
        </div>
      ))}
      <div style={{ height:16 }} />
    </div>
  )

  // ─── 证书 Tab ───
  const CertTab = () => (
    <div style={{ padding:'14px 16px', paddingBottom:80 }}>
      <div style={{ fontSize:12, color:C.muted, lineHeight:1.7, marginBottom:16,
        background:C.soft, borderRadius:10, padding:'10px 12px' }}>
        慈善证书是你公益行动的凭证，可下载、分享、用于简历。累计捐出金币越多，证书等级越高。
      </div>

      {CERTS.map((cert, i) => cert.earned ? (
        /* 已获得证书 */
        <div key={i} style={S.certCard}>
          <div style={{ fontSize:11, color:'rgba(128,224,160,.6)', marginBottom:4, letterSpacing:.5 }}>
            已获得 · {cert.date}
          </div>
          <div style={{ fontSize:16, fontWeight:600, color:'#80E0A0', marginBottom:4 }}>
            {cert.emoji} {cert.name}
          </div>
          <div style={{ fontSize:12, color:'rgba(128,224,160,.6)', marginBottom:12 }}>{cert.desc}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={S.certBtn} onClick={() => showToast('证书下载中…')}>⬇ 下载证书</button>
            <button style={S.certBtn} onClick={() => showToast('已分享到社区')}>↗ 分享展示</button>
          </div>
        </div>
      ) : (
        /* 未解锁证书 */
        <div key={i} style={S.certLocked}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:22, opacity: .4 + i * .05 }}>{cert.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.ink }}>{cert.name}</div>
              <div style={{ fontSize:11, color:C.muted }}>需累计捐出 {cert.need.toLocaleString()} 金币</div>
            </div>
            <div style={{ fontSize:12, color:C.muted }}>
              差 <b style={{ color:C.ink }}>{(cert.need - cert.done).toLocaleString()}</b>
            </div>
          </div>
          <div style={{ background:C.soft2, borderRadius:3, height:5, overflow:'hidden' }}>
            <div style={{ width:`${Math.round(cert.done/cert.need*100)}%`, height:'100%',
              background:cert.color, borderRadius:3 }} />
          </div>
          <div style={{ fontSize:11, color:C.hint, marginTop:4 }}>{cert.desc}</div>
        </div>
      ))}

      <div style={{ height:16 }} />
    </div>
  )

  return (
    <div style={{ background:C.bg, minHeight:'100vh', display:'flex', flexDirection:'column' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)',
          background:'rgba(26,18,8,.88)', color:'#fff', padding:'9px 20px',
          borderRadius:20, fontSize:13, zIndex:200, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}

      {/* 顶栏 */}
      <div style={S.topbar}>
        <div style={S.logo}>公<em style={{ color:C.gold, fontStyle:'normal' }}>益</em></div>
        <button style={S.iconBtn} onClick={() => showToast('功德账户即将上线')}>🪙</button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, background:C.bg, flexShrink:0 }}>
        {[['donate','捐款'],['activity','公益活动'],['record','我的记录'],['cert','证书']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex:1, padding:'10px 0', background:'none', border:'none', cursor:'pointer',
            fontSize:12, fontWeight: tab===key ? 700 : 400,
            color: tab===key ? C.gold : C.muted,
            borderBottom: tab===key ? `2px solid ${C.gold}` : '2px solid transparent',
            fontFamily:'Noto Sans SC,sans-serif', transition:'all .15s',
          }}>{label}</button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {tab === 'donate'   && <DonateTab />}
        {tab === 'activity' && <ActivityTab />}
        {tab === 'record'   && <RecordTab />}
        {tab === 'cert'     && <CertTab />}
      </div>
    </div>
  )
}

const S = {
  topbar:    { display:'flex', alignItems:'center', justifyContent:'space-between',
               padding:'14px 16px 12px', background:'#FAF7F2',
               borderBottom:`1px solid #E0D5C0`, flexShrink:0 },
  logo:      { fontFamily:'Noto Serif SC,serif', fontSize:20, fontWeight:900,
               color:'#1A1208', letterSpacing:.5 },
  iconBtn:   { background:'none', border:'none', cursor:'pointer', fontSize:22 },
  walletStrip:{ background:'#FDF3E0', border:'1px solid #E8D4A0', borderRadius:12,
                padding:'12px 14px', display:'flex', alignItems:'center',
                justifyContent:'space-between', marginBottom:12 },
  card:      { background:'#fff', border:'1px solid #E0D5C0', borderRadius:14,
               padding:14, boxShadow:'0 2px 10px rgba(26,18,8,.06)' },
  orgCard:   { background:'#fff', border:`1px solid #E0D5C0`, borderRadius:12,
               padding:14, cursor:'pointer', transition:'all .15s' },
  orgCardOn: { borderColor:'#C8922A', background:'#FFFAF0',
               boxShadow:'0 0 0 2px rgba(200,146,42,.15)' },
  amtOpt:    { background:'#F5F0E8', border:'1.5px solid #E0D5C0', borderRadius:10,
               padding:'10px 0', textAlign:'center', fontSize:14, fontWeight:600,
               color:'#7A6A50', cursor:'pointer' },
  amtOptOn:  { background:'#FDF3E0', borderColor:'#C8922A', color:'#7A5A18' },
  btnGold:   { width:'100%', background:'linear-gradient(135deg,#C8922A,#E8B84A)',
               color:'#fff', border:'none', borderRadius:12, padding:'14px 0',
               fontSize:15, fontWeight:700, cursor:'pointer',
               fontFamily:'Noto Sans SC,sans-serif',
               boxShadow:'0 4px 16px rgba(200,146,42,.35)' },
  btnSm:     { background:'none', border:'1px solid #E0D5C0', borderRadius:20,
               padding:'5px 12px', fontSize:12, cursor:'pointer', color:'#7A6A50',
               fontFamily:'Noto Sans SC,sans-serif', flexShrink:0 },
  btnSmOn:   { background:'#C8922A', borderColor:'#C8922A', color:'#fff' },
  btnOutline:{ width:'100%', background:'none', border:'1px solid #E0D5C0',
               borderRadius:10, padding:10, fontSize:13, cursor:'pointer',
               color:'#7A6A50', fontFamily:'Noto Sans SC,sans-serif' },
  notice:    { background:'#FDF3E0', border:'1px solid #E8D4A0', borderRadius:12, padding:'12px 14px' },
  actCard:   { background:'#fff', border:'1px solid #E0D5C0', borderRadius:14,
               padding:14, marginBottom:10, boxShadow:'0 2px 8px rgba(26,18,8,.05)' },
  statBox:   { background:'#fff', border:'1px solid #E0D5C0', borderRadius:12,
               padding:'12px 14px', textAlign:'center', boxShadow:'0 1px 4px rgba(26,18,8,.04)' },
  recItem:   { background:'#fff', border:'0.5px solid #E0D5C0', borderRadius:12,
               padding:'12px 14px', marginBottom:8 },
  certCard:  { background:'linear-gradient(135deg,#1A4A28,#2A6A38)', borderRadius:16,
               padding:18, marginBottom:12 },
  certLocked:{ background:'#fff', border:'1px solid #E0D5C0', borderRadius:14,
               padding:14, marginBottom:10 },
  certBtn:   { background:'none', border:'1px solid rgba(255,255,255,.25)',
               borderRadius:20, padding:'5px 12px', fontSize:12,
               color:'rgba(255,255,255,.7)', cursor:'pointer',
               fontFamily:'Noto Sans SC,sans-serif' },
}
