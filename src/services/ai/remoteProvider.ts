import type { DalilAction, DalilContext, DalilProvider, DalilReply } from './types'
import { DALIL_SYSTEM_PROMPT } from './prompt'

/**
 * Adapter for a real LLM. IMPORTANT: it talks to YOUR proxy endpoint (VITE_AI_ENDPOINT), never to a vendor API
 * directly, so no secret ever ships in the browser bundle. Expected contract:
 *   POST { system, action, context }  ->  200 { reply: string }
 * See README → "AI architecture" for a ready-to-copy serverless example.
 */
export function createRemoteProvider(endpoint: string): DalilProvider {
  return {
    id: 'remote',
    async respond(action: DalilAction, ctx: DalilContext): Promise<DalilReply> {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 9000)
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system: DALIL_SYSTEM_PROMPT, action, context: ctx }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: unknown = await res.json()
        const reply = typeof data === 'object' && data !== null ? (data as { reply?: unknown }).reply : undefined
        if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty reply')
        return { text: reply.trim().slice(0, 1200), source: 'remote' }
      } finally {
        window.clearTimeout(timer)
      }
    },
  }
}
