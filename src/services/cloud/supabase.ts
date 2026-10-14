import type { CaseDefinition, CaseResult, PlayerProfile } from '../../types'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const AUTH_KEY = 'arabic-detective:v1:teacher-auth'
const QUEUE_KEY = 'arabic-detective:v1:cloud-queue'

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

interface TeacherSession {
  access_token: string
  refresh_token?: string
  expires_at?: number
  user?: { id?: string; email?: string }
}

export interface AttemptPayload {
  clientAttemptId: string
  studentClientId: string
  studentName: string
  className: string
  caseId: string
  caseNumber: number
  caseTitle: string
  attemptNumber: number
  score: number
  accuracy: number
  correct: number
  mistakes: number
  hints: number
  xp: number
  stars: number
  evidenceFound: number
  evidenceTotal: number
  durationMs: number
  startedAt: string
  finishedAt: string
  details: Record<string, unknown>
}

export interface TeacherAttempt {
  id: string
  client_attempt_id: string
  case_id: string
  case_number: number
  case_title: string
  attempt_number: number
  score: number
  accuracy: number
  correct_count: number
  mistake_count: number
  hint_count: number
  xp: number
  stars: number
  evidence_found: number
  evidence_total: number
  duration_ms: number
  started_at: string
  finished_at: string
  details: Record<string, unknown>
  students: { id: string; name: string; class_name: string; client_id: string } | null
}

function headers(token?: string): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}

function readSession(): TeacherSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) as TeacherSession : null
  } catch {
    return null
  }
}

export function teacherSession(): TeacherSession | null {
  return readSession()
}

export async function signInTeacher(email: string, password: string): Promise<TeacherSession> {
  if (!cloudEnabled) throw new Error('Supabase belum dikonfigurasi.')
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error_description || data?.msg || 'Login gagal.')
  const session: TeacherSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined,
    user: data.user ? { id: data.user.id, email: data.user.email } : undefined,
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
  return session
}

export function signOutTeacher(): void {
  localStorage.removeItem(AUTH_KEY)
}

export async function fetchTeacherAttempts(): Promise<TeacherAttempt[]> {
  const session = readSession()
  if (!session?.access_token) throw new Error('Silakan login sebagai guru.')
  const select = encodeURIComponent('id,client_attempt_id,case_id,case_number,case_title,attempt_number,score,accuracy,correct_count,mistake_count,hint_count,xp,stars,evidence_found,evidence_total,duration_ms,started_at,finished_at,details,students(id,name,class_name,client_id)')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/attempts?select=${select}&order=finished_at.desc`, {
    headers: headers(session.access_token),
  })
  const data = await res.json()
  if (!res.ok) {
    if (res.status === 401) signOutTeacher()
    throw new Error(data?.message || data?.hint || 'Gagal mengambil data siswa.')
  }
  return data as TeacherAttempt[]
}

async function sendAttempt(payload: AttemptPayload): Promise<void> {
  if (!cloudEnabled) return
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_attempt`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      p_client_attempt_id: payload.clientAttemptId,
      p_student_client_id: payload.studentClientId,
      p_student_name: payload.studentName,
      p_class_name: payload.className,
      p_case_id: payload.caseId,
      p_case_number: payload.caseNumber,
      p_case_title: payload.caseTitle,
      p_attempt_number: payload.attemptNumber,
      p_score: payload.score,
      p_accuracy: payload.accuracy,
      p_correct_count: payload.correct,
      p_mistake_count: payload.mistakes,
      p_hint_count: payload.hints,
      p_xp: payload.xp,
      p_stars: payload.stars,
      p_evidence_found: payload.evidenceFound,
      p_evidence_total: payload.evidenceTotal,
      p_duration_ms: payload.durationMs,
      p_started_at: payload.startedAt,
      p_finished_at: payload.finishedAt,
      p_details: payload.details,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.message || data?.hint || 'Gagal menyinkronkan nilai.')
  }
}

function readQueue(): AttemptPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) as AttemptPayload[] : []
  } catch {
    return []
  }
}
function writeQueue(items: AttemptPayload[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50))) } catch { /* non-fatal */ }
}

export async function flushAttemptQueue(): Promise<void> {
  if (!cloudEnabled || !navigator.onLine) return
  const queue = readQueue()
  if (!queue.length) return
  const remaining: AttemptPayload[] = []
  for (const item of queue) {
    try { await sendAttempt(item) } catch { remaining.push(item) }
  }
  writeQueue(remaining)
}

export async function submitAttempt(payload: AttemptPayload): Promise<boolean> {
  if (!cloudEnabled) return false
  try {
    await flushAttemptQueue()
    await sendAttempt(payload)
    return true
  } catch {
    const queue = readQueue()
    if (!queue.some((x) => x.clientAttemptId === payload.clientAttemptId)) queue.push(payload)
    writeQueue(queue)
    return false
  }
}

export function buildAttemptPayload(
  player: PlayerProfile,
  def: CaseDefinition,
  result: CaseResult,
  session: {
    elapsedMs: number
    lastTick: number
    evidence: string[]
    revealed: string[]
    learned: string[]
    taskStats: Record<string, unknown>
    vocabC: Record<string, number>
    vocabW: Record<string, number>
  } | null,
): AttemptPayload {
  const finished = result.at
  const durationMs = result.timeMs
  const started = finished - durationMs
  return {
    clientAttemptId: `${player.id}:${def.id}:${result.at}`,
    studentClientId: player.id,
    studentName: player.name,
    className: player.className,
    caseId: def.id,
    caseNumber: def.number,
    caseTitle: def.titleId,
    attemptNumber: (player.progress[def.id]?.attempts ?? 0) + 1,
    score: Math.round(result.accuracy * 100),
    accuracy: result.accuracy,
    correct: result.correct,
    mistakes: result.mistakes,
    hints: result.hints,
    xp: result.xp,
    stars: result.stars,
    evidenceFound: result.evidenceFound,
    evidenceTotal: result.evidenceTotal,
    durationMs,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    details: {
      firstClear: result.firstClear,
      vocab: result.vocab,
      session: session ? {
        evidence: session.evidence,
        revealed: session.revealed,
        learned: session.learned,
        taskStats: session.taskStats,
        vocabCorrect: session.vocabC,
        vocabWrong: session.vocabW,
      } : null,
    },
  }
}
