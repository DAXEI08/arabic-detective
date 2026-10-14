import { useEffect, useRef, useState } from 'react'
import { BookOpenText, Lightbulb, MessageCircleQuestion, ScanSearch, Languages } from 'lucide-react'
import { Sheet } from '../common/Sheet'
import { RichText, Ar } from '../common/RichText'
import { Button } from '../common/Button'
import { aiMode, askDalil } from '../../services/ai'
import type { DalilAction, DalilContext } from '../../services/ai'
import { useGameStore } from '../../stores/gameStore'
import { glossSentence } from '../../data/lexicon'
import { evidenceTotal, getClue } from '../../data/cases'
import type { CaseDefinition, Task } from '../../types'

export function DalilMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <circle cx="24" cy="24" r="23" fill="#11263F" stroke="#F5BF4F" strokeWidth="2" />
      <circle cx="22" cy="22" r="9" fill="none" stroke="#F5BF4F" strokeWidth="3.5" />
      <path d="M29 29 L38 38" stroke="#F5BF4F" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M17 22 q5-6 10 0" stroke="#38BDF8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

interface Props { open: boolean; onClose: () => void; def: CaseDefinition; task: Task }

function buildContext(def: CaseDefinition, task: Task, level: 1 | 2 | 3): DalilContext {
  const g = useGameStore.getState()
  const s = g.session
  const st = s?.taskStats[task.id]
  const ev = (s?.evidence ?? []).map((id) => getClue(def, id)).filter((c): c is NonNullable<typeof c> => Boolean(c && c.isEvidence))
  return {
    caseId: def.id, caseTitleId: def.titleId, taskId: task.id, taskType: task.type,
    taskIndex: s?.taskIndex ?? 0, taskCount: def.tasks.length, instruction: task.instruction, promptAr: task.promptAr,
    focusText: g.focusText ?? task.focusText ?? task.promptAr, hintLevel: level,
    failedAttempts: st?.mistakes ?? 0, hintsUsedOnTask: st?.hints ?? 0,
    evidence: ev.map((c) => ({ id: c.id, ar: c.ar })), evidenceFound: ev.length, evidenceTotal: evidenceTotal(def),
    lastMistake: g.lastMistake && g.lastMistake.taskId === task.id ? { message: g.lastMistake.message, vocab: g.lastMistake.vocab } : undefined,
    authoredHints: task.hints,
  }
}

const ACTIONS: { id: DalilAction | 'pickWord'; label: string; ar: string; icon: React.ReactNode }[] = [
  { id: 'hint', label: 'Beri petunjuk', ar: 'تَلْمِيحٌ', icon: <Lightbulb size={16} /> },
  { id: 'explainSentence', label: 'Jelaskan kalimat', ar: 'اِشْرَحِ الْجُمْلَةَ', icon: <BookOpenText size={16} /> },
  { id: 'pickWord', label: 'Jelaskan kata', ar: 'اِشْرَحِ الْكَلِمَةَ', icon: <Languages size={16} /> },
  { id: 'whyWrong', label: 'Kenapa jawabanku salah?', ar: 'لِمَاذَا أَخْطَأْتُ؟', icon: <MessageCircleQuestion size={16} /> },
  { id: 'analyzeEvidence', label: 'Bantu analisis bukti', ar: 'حَلِّلِ الْأَدِلَّةَ', icon: <ScanSearch size={16} /> },
]

export function DalilPanel({ open, onClose, def, task }: Props) {
  const log = useGameStore((s) => s.dalilLog)
  const push = useGameStore((s) => s.pushDalil)
  const registerHint = useGameStore((s) => s.registerHint)
  const focusText = useGameStore((s) => s.focusText)
  const stat = useGameStore((s) => s.session?.taskStats[task.id])
  const [busy, setBusy] = useState(false)
  const [wordMode, setWordMode] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [log.length, busy, open])

  const hintsUsed = Math.min(3, stat?.hints ?? 0)
  const sentence = focusText ?? task.focusText ?? task.promptAr
  const words = sentence ? glossSentence(sentence).map((g) => g.surface) : []

  async function run(action: DalilAction, userText: string, word?: string) {
    if (busy) return
    setBusy(true)
    setWordMode(false)
    push({ role: 'user', text: userText })
    // Adaptive level: continue the ladder, but jump to level 2 if the student has failed ≥ 3 times.
    const failed = useGameStore.getState().session?.taskStats[task.id]?.mistakes ?? 0
    const used = useGameStore.getState().session?.taskStats[task.id]?.hints ?? 0
    const level = Math.min(3, Math.max(used + 1, failed >= 3 ? 2 : 1)) as 1 | 2 | 3
    const ctx = { ...buildContext(def, task, level), word }
    const reply = await askDalil(action, ctx)
    registerHint(task.id) // every Dalil use counts toward hint usage (scored gently)
    push({ role: 'dalil', text: reply.text, source: reply.source })
    setBusy(false)
  }

  const onAction = (id: (typeof ACTIONS)[number]) => {
    if (id.id === 'pickWord') {
      if (!sentence) { push({ role: 'dalil', text: 'Belum ada kalimat yang sedang kamu baca. Ketuk sebuah petunjuk dulu.' }); return }
      setWordMode((w) => !w)
      return
    }
    void run(id.id, id.label)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Dalil — asisten investigasi"
      footer={
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Button key={a.id} size="sm" className="!min-h-[44px]" icon={a.icon} disabled={busy} onClick={() => onAction(a)}>{a.label}</Button>
          ))}
        </div>
      }>
      <div className="mb-3 flex items-center gap-3">
        <DalilMark size={44} />
        <div>
          <p className="ar text-xl leading-none text-gold-400" lang="ar">دَلِيل</p>
          <p className="text-xs text-cream-300">{aiMode === 'remote' ? 'AI terhubung via proxy server' : 'Mode Demo (offline) — petunjuk tersusun, tanpa internet'}</p>
        </div>
        <div className="ml-auto flex items-center gap-1" aria-label={`Petunjuk terpakai ${hintsUsed} dari 3`}>
          {[0, 1, 2].map((i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < hintsUsed ? 'bg-gold-500' : 'bg-ink-600'}`} />)}
        </div>
      </div>
      <p className="mb-3 rounded-lg bg-ink-700/60 px-3 py-2 text-xs text-cream-300">
        Dalil hanya memberi petunjuk bertahap. Aksi terakhir tetap kamu yang lakukan. Memakai Dalil sedikit mengurangi nilai bintang, tetapi tidak dihukum berat.
      </p>
      <ul className="flex flex-col gap-3" aria-live="polite">
        {log.length === 0 && <li className="text-sm text-cream-300">Halo, Detektif. Ketuk salah satu tombol di bawah kalau kamu butuh bantuan.</li>}
        {log.map((m) => (
          <li key={m.id} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'ml-auto bg-ink-600' : 'mr-auto border border-gold-500/30 bg-ink-900'}`}>
            <RichText text={m.text} />
            {m.source === 'offline-fallback' && <span className="mt-1 block text-[10px] text-cream-400">AI tidak tersedia — memakai mode demo.</span>}
          </li>
        ))}
        {busy && <li className="mr-auto rounded-2xl border border-gold-500/30 bg-ink-900 px-3 py-2 text-sm text-cream-300">Dalil sedang menganalisis…</li>}
        <div ref={endRef} />
      </ul>
      {wordMode && (
        <div className="mt-4 rounded-xl border border-ink-500 p-3">
          <p className="mb-2 text-xs text-cream-300">Pilih kata yang ingin dijelaskan:</p>
          <div className="flex flex-wrap gap-2">
            {words.map((w, i) => (
              <button key={i} onClick={() => run('explainWord', `Jelaskan kata: ${w}`, w)} className="tap rounded-lg bg-cream-100 px-3 text-ink-900"><Ar size="sm">{w}</Ar></button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
