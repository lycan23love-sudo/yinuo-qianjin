// src/pages/HomePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { getMyPledges, hasCheckedInToday, getMeritTitle } from '../lib/supabase'
import { differenceInDays } from 'date-fns'

const today = new Date()

function daysLeft(pledge) {
  if (!pledge?.end_date) return null
  return Math.max(0, differenceInDays(new Date(pledge.end_date), today))
}

function progressOf(pledge) {
  const done = pledge?.checkin_count || pledge?.current_days || pledge?.completed_days || 0
  const total = pledge?.duration_days || pledge?.target_days || pledge?.days || 1
  return {
    done,
    total,
    percent: Math.min(100, Math.round((done / Math.max(total, 1)) * 100))
  }
}

function pledgeTitle(pledge) {
  return pledge?.title || pledge?.content || pledge?.description || '未命名诺言'
}

function Seal({ profile }) {
  const name = profile?.nickname || profile?.username || '我'
  const first = String(name).trim().slice(0, 1) || '我'
  return (
    <div className="absolute -right-2 bottom-5 rotate-[-12deg] rounded-full border-2 border-red-700/80 bg-red-50/70 px-4 py-3 text-center font-serif text-red-800 shadow-sm">
      <div className="text-lg font-black leading-none">{first}</div>
      <div className="mt-1 text-[11px] font-bold tracking-widest">守诺印</div>
    </div>
  )
}

export default function HomePage() {
  const { profile, session } = useAuth()
  const nav = useNavigate()
  const [pledges, setPledges] = useState([])
  const [checkedMap, setCheckedMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) load()
  }, [session])

  async function load() {
    setLoading(true)
    try {
      const data = await getMyPledges()
      const list = data || []
      setPledges(list)

      const checks = {}
      await Promise.all(
        list.map(async pledge => {
          checks[pledge.id] = await hasCheckedInToday(pledge.id)
        })
      )
      setCheckedMap(checks)
    } finally {
      setLoading(false)
    }
  }

  const activePledges = pledges.filter(p => p.status === 'active' || p.status === 'ongoing')
  const unfinishedToday = activePledges.filter(p => !checkedMap[p.id])
  const todayPledge = [...(unfinishedToday.length ? unfinishedToday : activePledges)].sort((a, b) => {
    const aLeft = daysLeft(a) ?? 9999
    const bLeft = daysLeft(b) ?? 9999
    return aLeft - bLeft
  })[0]

  const completedToday = activePledges.filter(p => checkedMap[p.id]).length
  const totalCheckins = pledges.reduce((sum, p) => sum + (p.checkin_count || p.current_days || p.completed_days || 0), 0)
  const totalTarget = pledges.reduce((sum, p) => sum + (p.duration_days || p.target_days || p.days || 0), 0)
  const keepRate = totalTarget ? Math.round((totalCheckins / totalTarget) * 100) : 0
  const lockedCoins = activePledges.reduce((sum, p) => sum + Number(p.stake_amount || p.stake || 0), 0)
  const title = getMeritTitle(profile?.merit_score || 0)
  const mainProgress = progressOf(todayPledge)
  const mainChecked = todayPledge ? checkedMap[todayPledge.id] : false
  const mainDaysLeft = daysLeft(todayPledge)

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f8f5ef] px-6 py-10 pb-24">
        <h1 className="font-serif text-3xl font-bold text-[#1d1309]">一诺千金</h1>
        <p className="mt-2 text-sm text-[#8a7b67]">先登录，再立下属于你的第一份诺言。</p>
        <button onClick={() => nav('/auth')} className="mt-8 w-full rounded-lg bg-[#171008] py-3 font-bold text-[#f6d486]">
          去登录
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f5ef] px-5 pb-24 pt-8 text-[#1d1309]">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-normal">一诺千金</h1>
          <p className="mt-1 text-sm text-[#8a7b67]">守住今天，就是守住自己</p>
        </div>
        <button onClick={() => nav('/profile')} className="rounded-full border border-[#dccfb9] px-3 py-1.5 text-sm font-semibold text-[#8a6a2d]">
          {title}
        </button>
      </header>

      <section className="mb-4 grid grid-cols-3 overflow-hidden rounded-lg border border-[#e0d4bf] bg-white/70 text-center shadow-sm">
        <div className="border-r border-[#e8ddcb] px-2 py-3">
          <div className="text-xl font-black text-[#c39a32]">{Math.max(activePledges.length - completedToday, 0)}</div>
          <div className="mt-1 text-xs text-[#8a7b67]">今日待守</div>
        </div>
        <div className="border-r border-[#e8ddcb] px-2 py-3">
          <div className="text-xl font-black text-[#1d1309]">{completedToday}/{activePledges.length || 0}</div>
          <div className="mt-1 text-xs text-[#8a7b67]">今日完成</div>
        </div>
        <div className="px-2 py-3">
          <div className="text-xl font-black text-[#1d1309]">{keepRate}%</div>
          <div className="mt-1 text-xs text-[#8a7b67]">总守约率</div>
        </div>
      </section>

      <main className="relative mb-5 overflow-hidden rounded-lg border border-[#d7c29a] bg-[#fff7df] p-5 shadow-[0_8px_24px_rgba(79,55,20,0.10)]">
        <div className="pointer-events-none absolute inset-x-4 top-3 h-px bg-[#d5ae5c]/60" />
        <div className="pointer-events-none absolute inset-x-4 bottom-3 h-px bg-[#d5ae5c]/60" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.28em] text-[#9a7130]">今日诺言</p>
            <h2 className="mt-2 font-serif text-2xl font-bold leading-snug">
              {loading ? '正在展开契约...' : todayPledge ? pledgeTitle(todayPledge) : '写下你的第一份军令状'}
            </h2>
          </div>
          {todayPledge && <Seal profile={profile} />}
        </div>

        {todayPledge ? (
          <>
            <p className="max-w-[78%] text-sm leading-6 text-[#6f604e]">
              这是一份已经盖印的诺言。今天只需要完成下一次证明，让契约继续有效。
            </p>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm text-[#7c6b57]">
                <span>第 {mainProgress.done} / {mainProgress.total} 天</span>
                <span>{mainProgress.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#eadfc9]">
                <div className="h-full rounded-full bg-[#c99a2e]" style={{ width: mainProgress.percent + '%' }} />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-sm text-[#7c6b57]">
                {mainDaysLeft === null ? '持续守诺中' : mainDaysLeft === 0 ? '今日到期' : '还剩 ' + mainDaysLeft + ' 天'}
              </div>
              <button
                onClick={() => nav(mainChecked ? '/pledge/' + todayPledge.id : '/pledge/' + todayPledge.id + '/checkin')}
                className="rounded-lg bg-[#171008] px-6 py-3 text-sm font-bold text-[#f6d486] shadow-sm"
              >
                {mainChecked ? '查看记录' : '去打卡'}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5">
            <p className="text-sm leading-6 text-[#6f604e]">
              第一份诺言不用复杂，写清楚你每天要守住的一件事，再亲手盖下守诺印。
            </p>
            <button onClick={() => nav('/new')} className="mt-5 w-full rounded-lg bg-[#171008] py-3 font-bold text-[#f6d486]">
              立下第一个誓言
            </button>
          </div>
        )}
      </main>

      <section className="mb-5 rounded-lg border border-[#e0d4bf] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold">我的誓言</h3>
          <button onClick={() => nav('/new')} className="text-sm font-bold text-[#b88923]">立新誓</button>
        </div>
        {activePledges.length ? (
          <div className="space-y-3">
            {activePledges.slice(0, 3).map(pledge => {
              const progress = progressOf(pledge)
              return (
                <button key={pledge.id} onClick={() => nav('/pledge/' + pledge.id)} className="w-full rounded-lg border border-[#eee4d2] bg-[#fffdf8] p-3 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{pledgeTitle(pledge)}</div>
                      <div className="mt-1 text-xs text-[#8a7b67]">押注 {pledge.stake_amount || pledge.stake || 0} 金币 · {checkedMap[pledge.id] ? '今日已打卡' : '今日待打卡'}</div>
                    </div>
                    <div className="text-sm font-bold text-[#c39a32]">{progress.percent}%</div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-[#f8f5ef] px-4 py-5 text-center text-sm text-[#8a7b67]">
            暂无进行中的诺言。让首页从第一份契约开始。
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button onClick={() => nav('/charity')} className="rounded-lg border border-[#e0d4bf] bg-white p-4 text-left shadow-sm">
          <div className="text-xs text-[#8a7b67]">公益金币</div>
          <div className="mt-1 text-xl font-black text-[#1d1309]">{profile?.merit_coins || 0}</div>
        </button>
        <button onClick={() => nav('/square')} className="rounded-lg border border-[#e0d4bf] bg-white p-4 text-left shadow-sm">
          <div className="text-xs text-[#8a7b67]">契约押注中</div>
          <div className="mt-1 text-xl font-black text-[#1d1309]">{lockedCoins}</div>
        </button>
      </section>
    </div>
  )
}
