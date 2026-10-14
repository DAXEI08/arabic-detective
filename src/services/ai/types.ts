export type DalilAction = 'hint' | 'explainSentence' | 'explainWord' | 'whyWrong' | 'analyzeEvidence'

/**
 * Everything Dalil is allowed to know. Deliberately contains NO solution data
 * (no correct answers, no solution maps) so neither the offline engine nor a remote LLM can leak it.
 */
export interface DalilContext {
  caseId: string
  caseTitleId: string
  taskId: string
  taskType: string
  taskIndex: number
  taskCount: number
  instruction: string
  promptAr?: string
  focusText?: string
  /** Hint level to serve for a 'hint' action (1–3), already adapted to attempts. */
  hintLevel: 1 | 2 | 3
  failedAttempts: number
  hintsUsedOnTask: number
  evidence: { id: string; ar: string }[]
  evidenceFound: number
  evidenceTotal: number
  lastMistake?: { message: string; vocab: string[] }
  word?: string
  /** Authored scaffold text for the task — offline mode serves it; remote mode may use it as a style guide. */
  authoredHints: [string, string, string]
}

export interface DalilReply { text: string; source: 'offline' | 'remote' | 'offline-fallback' }

export interface DalilProvider {
  readonly id: 'offline' | 'remote'
  respond(action: DalilAction, ctx: DalilContext): Promise<DalilReply>
}
