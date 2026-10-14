import { offlineProvider } from './offlineProvider'
import { createRemoteProvider } from './remoteProvider'
import type { DalilAction, DalilContext, DalilProvider, DalilReply } from './types'

export type { DalilAction, DalilContext, DalilReply } from './types'

const enabled = String(import.meta.env.VITE_AI_ENABLED ?? '').toLowerCase() === 'true'
const endpoint = String(import.meta.env.VITE_AI_ENDPOINT ?? '').trim()

export const aiMode: 'offline' | 'remote' = enabled && endpoint ? 'remote' : 'offline'
const provider: DalilProvider = aiMode === 'remote' ? createRemoteProvider(endpoint) : offlineProvider

/** Asks Dalil. Real-AI failures silently degrade to the deterministic offline tutor, so demos never break. */
export async function askDalil(action: DalilAction, ctx: DalilContext): Promise<DalilReply> {
  try {
    return await provider.respond(action, ctx)
  } catch {
    const r = await offlineProvider.respond(action, ctx)
    return { text: r.text, source: aiMode === 'remote' ? 'offline-fallback' : 'offline' }
  }
}
