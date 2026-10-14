import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { Ar } from '../components/common/RichText'
import { Stars } from '../components/common/Stars'
import { TopBar } from '../components/common/TopBar'
import { CASES } from '../data/cases'
import { caseStats, completedCount, overallAccuracy, playersToCsv, starsTotal, totalXp, vocabDifficulty } from '../engine/analytics'
import { usePlayerStore } from '../stores/playerStore'
import { formatDuration, pct } from '../utils/format'

export function Teacher() {
  const playersMap = usePlayerStore((s) => s.players)
  const players = useMemo(() => Object.values(playersMap).sort((a, b) => a.name.localeCompare(b.name)), [playersMap])
  const [selId, setSelId] = useState<string | null>(null)
  const selected = players.find((p) => p.id === selId) ?? (players.length === 1 ? players[0] : null)
  const vocab = useMemo(() => vocabDifficulty(selected ? [selected] : players), [players, selected])
  const stats = useMemo(() => caseStats(players), [players])

  function exportCsv() {
    const blob = new Blob(['\ufeff' + playersToCsv(players)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'arabic-detective-siswa.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <TopBar title="Mode Guru" back="/" right={players.length > 0 ? <Button size="sm" icon={<Download size={16} />} onClick={exportCsv}>Ekspor CSV</Button> : undefined} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <p className="mb-4 rounded-lg border border-ink-600 bg-ink-800/60 px-3 py-2 text-xs text-cream-300">Data berikut berasal dari permainan siswa di perangkat/browser ini (tersimpan lokal). Tidak ada sinkronisasi cloud pada versi ini.</p>
        {players.length === 0 ? (
          <div className="panel p-8 text-center">
            <h2 className="text-lg font-bold">Belum ada data siswa</h2>
            <p className="mt-1 text-sm text-cream-300">Minta siswa memainkan satu kasus; hasilnya akan muncul di sini.</p>
            <Link to="/setup"><Button variant="primary" className="mt-4">Tambah siswa</Button></Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Ringkasan siswa</caption>
                  <thead className="bg-ink-700 text-xs text-cream-300">
                    <tr><th className="p-3">Nama</th><th className="p-3">Progres</th><th className="p-3 text-right">Akurasi</th><th className="p-3 text-right">Hint</th><th className="p-3 text-right">XP</th></tr>
                  </thead>
                  <tbody>
                    {players.map((p) => {
                      const acc = overallAccuracy(p)
                      const on = selected?.id === p.id
                      return (
                        <tr key={p.id} className={`border-t border-ink-700 ${on ? 'bg-ink-700/60' : ''}`}>
                          <th scope="row" className="p-0 font-medium"><button onClick={() => setSelId(p.id)} aria-pressed={on} className="tap w-full px-3 py-2 text-left hover:text-gold-400">{p.name}<span className="block text-xs font-normal text-cream-400">{p.className || '—'}</span></button></th>
                          <td className="p-3">{completedCount(p)}/{CASES.length} <span className="ml-1 inline-block align-middle"><Stars value={Math.round(starsTotal(p) / CASES.length)} size={12} /></span></td>
                          <td className="p-3 text-right tabular-nums">{acc === null ? '—' : pct(acc)}</td>
                          <td className="p-3 text-right tabular-nums">{p.totals.hints}</td>
                          <td className="p-3 text-right font-semibold tabular-nums text-gold-400">{totalXp(p).toLocaleString('id-ID')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {selected && (
                <div className="border-t border-ink-600 p-4">
                  <h3 className="mb-2 text-sm font-semibold">Detail: {selected.name}</h3>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-cream-300"><tr><th className="pb-1 text-left">Kasus</th><th className="pb-1 text-right">Bintang</th><th className="pb-1 text-right">Akurasi terbaik</th><th className="pb-1 text-right">Percobaan</th><th className="pb-1 text-right">Waktu terbaik</th></tr></thead>
                    <tbody>
                      {CASES.map((c) => {
                        const pr = selected.progress[c.id]
                        return (
                          <tr key={c.id} className="border-t border-ink-700">
                            <td className="py-1.5">{c.number}. {c.titleId}</td>
                            <td className="text-right">{pr?.completed ? <Stars value={pr.stars} size={13} /> : '—'}</td>
                            <td className="text-right tabular-nums">{pr?.completed ? pct(pr.bestAccuracy) : '—'}</td>
                            <td className="text-right tabular-nums">{pr?.attempts ?? 0}</td>
                            <td className="text-right tabular-nums">{pr?.bestTimeMs ? formatDuration(pr.bestTimeMs) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-cream-400">Pencapaian: {Object.keys(selected.achievements).length}/4 · Total waktu bermain: {formatDuration(selected.totals.timeMs)}</p>
                </div>
              )}
            </section>
            <div className="grid content-start gap-6">
              <section className="panel p-4">
                <h2 className="mb-1 text-sm font-semibold">Kosakata Paling Sulit{selected ? ` · ${selected.name}` : ' · semua siswa'}</h2>
                {vocab.length === 0 ? <p className="text-sm text-cream-300">Belum ada data kosakata.</p> : (
                  <ul className="grid gap-2">
                    {vocab.slice(0, 8).map((v) => (
                      <li key={v.id}>
                        <div className="flex items-baseline justify-between"><Ar size="sm">{v.ar}</Ar><span className="text-xs text-cream-300">{v.idn} · <b className="text-cream-100">{pct(v.accuracy)}</b> ({v.c + v.w} percobaan)</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-ink-600" role="img" aria-label={`Akurasi ${pct(v.accuracy)}`}><div className={`h-full ${v.accuracy < 0.7 ? 'bg-bad' : v.accuracy < 0.85 ? 'bg-gold-500' : 'bg-good'}`} style={{ width: pct(v.accuracy) }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="panel p-4">
                <h2 className="mb-2 text-sm font-semibold">Ringkasan per kasus</h2>
                <ul className="grid gap-1.5 text-sm">
                  {stats.map((s) => (
                    <li key={s.def.id} className="flex items-center justify-between"><span>{s.def.number}. {s.def.titleId}</span><span className="text-xs text-cream-300">{s.completedBy}/{players.length} selesai · {s.avgAccuracy === null ? '—' : pct(s.avgAccuracy)}</span></li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
