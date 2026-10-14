import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/common/TopBar'
import { Briefing } from '../components/game/Briefing'
import { CaseRunner } from '../components/game/CaseRunner'
import { SolvedScreen } from '../components/game/SolvedScreen'
import { getCase } from '../data/cases'
import { getAchievement } from '../data/achievements'
import { buildAttemptPayload, cloudEnabled, submitAttempt } from '../services/cloud/supabase'
import { isCaseUnlocked, useActivePlayer, usePlayerStore } from '../stores/playerStore'
import { useGameStore } from '../stores/gameStore'
import { useUiStore } from '../stores/uiStore'

function Locked() {
  const push = useUiStore((s) => s.push)
  useEffect(() => { push({ kind: 'info', title: 'Kasus masih terkunci', body: 'Selesaikan kasus sebelumnya dulu.' }) }, [push])
  return <Navigate to="/cases" replace />
}

export function CasePage() {
  const { id } = useParams()
  const def = getCase(id)
  const nav = useNavigate()
  const player = useActivePlayer()
  const settings = usePlayerStore((s) => s.settings)
  const recordResult = usePlayerStore((s) => s.recordResult)
  const session = useGameStore((s) => s.session)
  const startCase = useGameStore((s) => s.startCase)
  const setStage = useGameStore((s) => s.setStage)
  const resume = useGameStore((s) => s.resumeIfMatches)
  const buildResult = useGameStore((s) => s.buildResult)
  const clearSession = useGameStore((s) => s.clearSession)
  const push = useUiStore((s) => s.push)
  const [finished, setFinished] = useState(false)
  const init = useRef(false)

  const unlocked = def && player ? isCaseUnlocked(player, settings, def) : false

  useEffect(() => {
    if (!def || !player || !unlocked || init.current) return
    init.current = true
    if (resume(player.id, def.id)) {
      const s = useGameStore.getState().session
      if (s && s.stage === 'play' && (s.taskIndex > 0 || Object.keys(s.taskStats).length > 0)) push({ kind: 'info', title: 'Melanjutkan investigasi', body: 'Progres kasus dipulihkan.' })
    } else {
      startCase(player.id, def.id)
    }
  }, [def, player, unlocked, resume, startCase, push])

  if (!def) return <Navigate to="/cases" replace />
  if (!unlocked) return <Locked />
  if (!player) return null

  function finish() {
    const liveSession = useGameStore.getState().session
    const partial = buildResult(def!)
    if (!partial) { nav('/cases'); return }

    const { result, newAchievements } = recordResult(partial, def!)

    if (cloudEnabled) {
      const payload = buildAttemptPayload(player!, def!, result, liveSession)
      void submitAttempt(payload).then((synced) => {
        if (!synced) {
          push({
            kind: 'info',
            title: 'Nilai menunggu sinkronisasi',
            body: 'Hasil tetap tersimpan di perangkat dan akan dicoba dikirim lagi saat koneksi tersedia.',
          })
        }
      })
    }

    clearSession()
    newAchievements.forEach((a) => { const d = getAchievement(a); if (d) push({ kind: 'achievement', title: `Pencapaian: ${d.idn}`, ar: d.ar, body: d.desc }) })
    setFinished(true)
  }
  function restart() {
    startCase(player!.id, def!.id)
    setStage('play')
  }

  if (finished) return <SolvedScreen def={def} onContinue={() => nav(`/results/${def.id}`, { replace: true })} />
  if (!session || session.caseId !== def.id) return <div className="p-8 text-center text-cream-300">Memuat berkas kasus…</div>

  if (session.stage === 'briefing') {
    return (
      <>
        <TopBar title={`CASE ${def.number}`} back="/cases" />
        <Briefing def={def} onBack={() => nav('/cases')} onStart={() => setStage('play')} />
      </>
    )
  }
  return <CaseRunner def={def} onFinish={finish} onRestart={restart} />
}
