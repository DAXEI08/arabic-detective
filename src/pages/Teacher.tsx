import { useEffect, useMemo, useState } from 'react'
import { Download, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { Button } from '../components/common/Button'
import { TopBar } from '../components/common/TopBar'
import {
  cloudEnabled,
  fetchTeacherAttempts,
  signInTeacher,
  signOutTeacher,
  teacherSession,
  type TeacherAttempt,
} from '../services/cloud/supabase'
import { formatDuration } from '../utils/format'

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function attemptsToCsv(rows: TeacherAttempt[]): string {
  const head = ['Nama', 'Kelas', 'Kasus', 'Percobaan', 'Nilai', 'Akurasi (%)', 'Benar', 'Salah', 'Hint', 'XP', 'Bintang', 'Bukti', 'Durasi (detik)', 'Mulai', 'Selesai']
  const body = rows.map((r) => [
    r.students?.name ?? '',
    r.students?.class_name ?? '',
    `${r.case_number}. ${r.case_title}`,
    r.attempt_number,
    r.score,
    Math.round(r.accuracy * 100),
    r.correct_count,
    r.mistake_count,
    r.hint_count,
    r.xp,
    r.stars,
    `${r.evidence_found}/${r.evidence_total}`,
    Math.round(r.duration_ms / 1000),
    r.started_at,
    r.finished_at,
  ])
  return [head, ...body].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function Teacher() {
  const [session, setSession] = useState(() => teacherSession())
  const [attempts, setAttempts] = useState<TeacherAttempt[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const classes = useMemo(
    () => Array.from(new Set(attempts.map((x) => x.students?.class_name).filter((x): x is string => Boolean(x)))).sort(),
    [attempts],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id-ID')
    return attempts.filter((a) => {
      if (classFilter !== 'all' && (a.students?.class_name || '') !== classFilter) return false
      if (!q) return true
      return [a.students?.name, a.students?.class_name, a.case_title, a.case_id]
        .filter(Boolean)
        .some((v) => String(v).toLocaleLowerCase('id-ID').includes(q))
    })
  }, [attempts, classFilter, query])

  const selected = attempts.find((x) => x.id === selectedId) ?? null

  async function load() {
    setLoading(true)
    setError('')
    try {
      const rows = await fetchTeacherAttempts()
      setAttempts(rows)
      if (!selectedId && rows[0]) setSelectedId(rows[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.')
      if (!teacherSession()) setSession(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session && cloudEnabled) void load()
  }, []) // intentionally load once from persisted teacher session

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const s = await signInTeacher(email.trim(), password)
      setSession(s)
      setPassword('')
      const rows = await fetchTeacherAttempts()
      setAttempts(rows)
      if (rows[0]) setSelectedId(rows[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login gagal.')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    signOutTeacher()
    setSession(null)
    setAttempts([])
    setSelectedId(null)
  }

  function exportCsv() {
    const blob = new Blob(['\ufeff' + attemptsToCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'arabic-detective-nilai.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!cloudEnabled) {
    return (
      <>
        <TopBar title="Dashboard Guru" back="/" />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <section className="panel p-6">
            <h1 className="text-xl font-bold">Supabase belum diaktifkan</h1>
            <p className="mt-2 text-sm text-cream-300">Tambahkan <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di Environment Variables Vercel, lalu redeploy. Skema database tersedia di <code>supabase/schema.sql</code>.</p>
          </section>
        </main>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <TopBar title="Login Guru" back="/" />
        <main className="mx-auto max-w-md px-4 py-10">
          <form onSubmit={login} className="panel p-6">
            <div className="mb-5 flex items-center gap-3"><LogIn className="text-gold-400" /><div><h1 className="text-xl font-bold">Dashboard Guru</h1><p className="text-xs text-cream-300">Masuk dengan akun guru Supabase.</p></div></div>
            <label htmlFor="teacher-email" className="mb-1 block text-sm font-medium">Email</label>
            <input id="teacher-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
              className="tap mb-4 w-full rounded-lg border border-ink-500 bg-ink-900 px-3 text-cream-100" />
            <label htmlFor="teacher-password" className="mb-1 block text-sm font-medium">Password</label>
            <input id="teacher-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="tap mb-2 w-full rounded-lg border border-ink-500 bg-ink-900 px-3 text-cream-100" />
            {error && <p className="mb-3 text-sm text-bad" role="alert">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>{loading ? 'Memeriksa…' : 'Masuk'}</Button>
          </form>
        </main>
      </>
    )
  }

  return (
    <>
      <TopBar
        title="Dashboard Guru"
        back="/"
        right={<div className="flex gap-2">
          <Button size="sm" icon={<RefreshCw size={16} />} onClick={() => void load()} disabled={loading}>Refresh</Button>
          <Button size="sm" icon={<LogOut size={16} />} onClick={logout}>Keluar</Button>
        </div>}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, kelas, atau kasus…"
            className="tap rounded-lg border border-ink-500 bg-ink-900 px-3 text-cream-100 placeholder:text-ink-400" />
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
            className="tap rounded-lg border border-ink-500 bg-ink-900 px-3 text-cream-100">
            <option value="all">Semua kelas</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button icon={<Download size={16} />} onClick={exportCsv} disabled={!filtered.length}>Ekspor CSV</Button>
        </div>

        {error && <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-bad" role="alert">{error}</p>}

        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="panel p-4"><p className="text-xs text-cream-400">Pengerjaan</p><p className="text-2xl font-bold">{filtered.length}</p></div>
          <div className="panel p-4"><p className="text-xs text-cream-400">Siswa unik</p><p className="text-2xl font-bold">{new Set(filtered.map((x) => x.students?.client_id).filter(Boolean)).size}</p></div>
          <div className="panel p-4"><p className="text-xs text-cream-400">Rata-rata nilai</p><p className="text-2xl font-bold">{filtered.length ? Math.round(filtered.reduce((n, x) => n + x.score, 0) / filtered.length) : '—'}</p></div>
          <div className="panel p-4"><p className="text-xs text-cream-400">Rata-rata durasi</p><p className="text-2xl font-bold">{filtered.length ? formatDuration(filtered.reduce((n, x) => n + x.duration_ms, 0) / filtered.length) : '—'}</p></div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <section className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-700 text-xs text-cream-300">
                  <tr><th className="p-3">Siswa</th><th className="p-3">Kasus</th><th className="p-3 text-right">Nilai</th><th className="p-3 text-right">Benar/Salah</th><th className="p-3 text-right">Durasi</th><th className="p-3">Selesai</th></tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className={`border-t border-ink-700 ${selectedId === a.id ? 'bg-ink-700/60' : ''}`}>
                      <td className="p-0"><button className="tap w-full px-3 py-2 text-left" onClick={() => setSelectedId(a.id)}><span className="block font-semibold">{a.students?.name || '—'}</span><span className="text-xs text-cream-400">{a.students?.class_name || 'Tanpa kelas'}</span></button></td>
                      <td className="p-3"><span className="font-medium">{a.case_number}. {a.case_title}</span><span className="block text-xs text-cream-400">Percobaan ke-{a.attempt_number}</span></td>
                      <td className="p-3 text-right text-lg font-bold text-gold-400">{a.score}</td>
                      <td className="p-3 text-right tabular-nums"><span className="text-good">{a.correct_count}</span> / <span className="text-bad">{a.mistake_count}</span></td>
                      <td className="p-3 text-right tabular-nums">{formatDuration(a.duration_ms)}</td>
                      <td className="p-3 text-xs text-cream-300">{new Date(a.finished_at).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={6} className="p-8 text-center text-cream-300">{loading ? 'Memuat data…' : 'Belum ada data yang cocok.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="panel p-4">
            {!selected ? <p className="text-sm text-cream-300">Pilih satu pengerjaan untuk melihat detail.</p> : (
              <>
                <h2 className="text-lg font-bold">{selected.students?.name}</h2>
                <p className="text-sm text-cream-300">{selected.students?.class_name || 'Tanpa kelas'} · CASE {selected.case_number}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-cream-400">Nilai</dt><dd className="text-xl font-bold text-gold-400">{selected.score}</dd></div>
                  <div><dt className="text-xs text-cream-400">Akurasi</dt><dd className="text-xl font-bold">{Math.round(selected.accuracy * 100)}%</dd></div>
                  <div><dt className="text-xs text-cream-400">Benar</dt><dd className="font-semibold text-good">{selected.correct_count}</dd></div>
                  <div><dt className="text-xs text-cream-400">Salah</dt><dd className="font-semibold text-bad">{selected.mistake_count}</dd></div>
                  <div><dt className="text-xs text-cream-400">Hint</dt><dd className="font-semibold">{selected.hint_count}</dd></div>
                  <div><dt className="text-xs text-cream-400">Bukti</dt><dd className="font-semibold">{selected.evidence_found}/{selected.evidence_total}</dd></div>
                  <div><dt className="text-xs text-cream-400">XP</dt><dd className="font-semibold">{selected.xp}</dd></div>
                  <div><dt className="text-xs text-cream-400">Bintang</dt><dd className="font-semibold">{selected.stars}/3</dd></div>
                </dl>

                <h3 className="mt-5 text-sm font-semibold">Detail aktivitas</h3>
                <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-ink-950 p-3 text-[11px] leading-relaxed text-cream-300">{JSON.stringify(selected.details, null, 2)}</pre>
              </>
            )}
          </aside>
        </div>
      </main>
    </>
  )
}
