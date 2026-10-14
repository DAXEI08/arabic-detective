import { CASES } from '../data/cases'
import { glossSentence } from '../data/lexicon'
import { checkConstraint, landmarkPositions } from './spatial'
import type { Positions } from './spatial'
import type { Cell, CaseDefinition, EntityKind, PlacementTask } from '../types'

/** Static integrity + solvability checks for all authored content. Returns a list of problems (empty = OK). */
export function verifyContent(): string[] {
  const errs: string[] = []
  const ids = new Set<string>()

  for (const def of CASES) {
    const clueIds = new Set(def.clues.map((c) => c.id))
    if (clueIds.size !== def.clues.length) errs.push(`${def.id}: duplicate clue ids`)

    // every Arabic word in every clue / prompt must be explainable by Dalil's lexicon
    const texts = [...def.clues.map((c) => c.ar), ...def.tasks.flatMap((t) => [t.promptAr, t.focusText].filter(Boolean) as string[])]
    for (const t of texts) for (const g of glossSentence(t)) if (!g.entry) errs.push(`${def.id}: no lexicon entry for "${g.surface}" in "${t}"`)

    const needClue = (id: string, where: string) => { if (!clueIds.has(id)) errs.push(`${def.id}: ${where} references missing clue ${id}`) }

    for (const task of def.tasks) {
      if (ids.has(task.id)) errs.push(`duplicate task id ${task.id}`)
      ids.add(task.id)
      task.collects?.forEach((c) => needClue(c, task.id))
      if (task.hints.some((h) => !h.trim())) errs.push(`${task.id}: empty hint`)
      switch (task.type) {
        case 'hotspot': needClue(task.clueId, task.id); if (task.bonus) needClue(task.bonus.clueId, task.id); break
        case 'scene-choice':
          if (!task.options.some((o) => o.id === task.correct)) errs.push(`${task.id}: correct option missing`)
          break
        case 'placement': if (!solvable(task)) errs.push(`${task.id}: placement is NOT solvable`); task.constraints.forEach((c) => needClue(c.clueId, task.id)); break
        case 'dialogue':
          task.statementIds.forEach((s) => needClue(s, task.id))
          task.relevant.forEach((s) => { if (!task.statementIds.includes(s)) errs.push(`${task.id}: relevant not in statements`) })
          task.statementIds.forEach((s) => { if (!task.reasons[s]) errs.push(`${task.id}: missing reason for ${s}`) })
          break
        case 'assign': {
          const z = new Set(task.zones.map((x) => x.id))
          task.items.forEach((i) => { if (!z.has(task.solution[i])) errs.push(`${task.id}: bad solution for ${i}`) })
          if (new Set(Object.values(task.solution)).size !== task.items.length) errs.push(`${task.id}: solution zones not unique`)
          task.referenceIds.forEach((r) => needClue(r, task.id))
          break
        }
        case 'board':
          task.cardIds.forEach((c) => needClue(c, task.id))
          task.relevant.forEach((c) => { if (!task.cardIds.includes(c)) errs.push(`${task.id}: relevant card not on board`) })
          if (task.phase === 'sort') task.cardIds.forEach((c) => { if (!task.reasons[c]) errs.push(`${task.id}: no reason for ${c}`) })
          task.requiredLinks?.forEach(([a, b]) => { if (!task.validLinks?.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) errs.push(`${task.id}: required link not valid`) })
          break
        case 'elimination': {
          const others = task.candidates.filter((c) => c.id !== task.answer)
          others.forEach((c) => { if (!task.eliminatedBy[c.id]?.length) errs.push(`${task.id}: ${c.id} cannot be eliminated`) })
          if (task.eliminatedBy[task.answer]) errs.push(`${task.id}: answer must not be eliminable`)
          task.evidenceIds.forEach((e) => needClue(e, task.id))
          break
        }
        case 'sequence':
          if ([...task.order].sort().join() !== [...task.eventIds].sort().join()) errs.push(`${task.id}: sequence ids mismatch`)
          if (task.order.join() === task.eventIds.join()) errs.push(`${task.id}: sequence starts already solved`)
          task.order.forEach((e) => needClue(e, task.id))
          break
        case 'inspect':
          task.entities.forEach((e) => { if (e.clueId) needClue(e.clueId, task.id); if (e.clueId && e.relevant === false && !e.why) errs.push(`${task.id}: ${e.entity} needs why`) })
          break
        case 'report':
          task.fields.forEach((f) => { if (!f.options.some((o) => o.id === f.correct)) errs.push(`${task.id}: ${f.key} correct missing`) })
          task.evidencePicker?.validIds.forEach((v) => needClue(v, task.id))
          break
      }
    }
    errs.push(...caseSpecific(def))
  }
  return errs
}

function caseSpecific(def: CaseDefinition): string[] {
  const out: string[] = []
  // all evidence must be reachable: collected by a task, or hotspot/inspect bonus
  const reachable = new Set<string>()
  def.tasks.forEach((t) => {
    t.collects?.forEach((c) => reachable.add(c))
    if (t.type === 'hotspot' && t.bonus) reachable.add(t.bonus.clueId)
    if (t.type === 'inspect') t.entities.forEach((e) => e.relevant && e.clueId && reachable.add(e.clueId))
  })
  def.clues.filter((c) => c.isEvidence).forEach((c) => { if (!reachable.has(c.id)) out.push(`${def.id}: evidence ${c.id} is unreachable`) })
  return out
}

/** Brute-force: does at least one placement of the movables satisfy every constraint (distinct free cells)? */
export function solvable(task: PlacementTask): boolean {
  const base = landmarkPositions(task.map)
  const cells: Cell[] = []
  for (let r = 0; r < task.map.rows; r++) for (let c = 0; c < task.map.cols; c++) cells.push({ col: c, row: r })
  const rec = (i: number, pos: Positions, used: Set<string>): boolean => {
    if (i === task.movables.length) return task.constraints.every((c) => checkConstraint(c, pos))
    const m: EntityKind = task.movables[i]
    for (const cell of cells) {
      const k = `${cell.col}:${cell.row}`
      if (used.has(k)) continue
      used.add(k)
      if (rec(i + 1, { ...pos, [m]: cell }, used)) return true
      used.delete(k)
    }
    return false
  }
  return rec(0, base, new Set())
}
