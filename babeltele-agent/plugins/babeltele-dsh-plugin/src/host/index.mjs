/**
 * Host-Plane Root Entry (`@babeltele/dsh-plugin`).
 * Connects BabelTele state persistence, `/babeltele-api/*` HTTP endpoints on DSH `webServer`,
 * and optional deep LLM-assisted prompt neutralization through `ctx.llm`.
 */
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import {
  STARTER_TEMPLATES,
  countTokens,
  decodeBtToChinese,
  neutralizePrompt,
} from '../protocol/babeltele-core.mjs'
import { btState } from './state.mjs'

export const name = '@babeltele/dsh-plugin'

function readJsonBody(req, maxBytes = 131072) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > maxBytes) {
        reject(new Error('Request payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(body.length),
  })
  res.end(body)
}

export function apply(ctx) {
  const homeDir = ctx.get('profileContext')?.home
  if (homeDir) {
    btState.bindHome(homeDir)
  }

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() =>
      webCtx.webServer.register({
        kind: 'prefix',
        path: '/babeltele-api',
        auth: 'required',
        handler: async (req, res) => {
          try {
            const url = new URL(req.url ?? '/', 'http://127.0.0.1')
            const sub = url.pathname.replace(/^\/babeltele-api\/?/, '')

            if (req.method === 'GET' && (sub === '' || sub === 'state')) {
              sendJson(res, 200, {
                ok: true,
                ...btState.snapshot(),
                templates: STARTER_TEMPLATES,
              })
              return
            }

            if (req.method === 'POST' && sub === 'settings') {
              const patch = await readJsonBody(req)
              const snap = btState.updatePrefs(patch)
              sendJson(res, 200, { ok: true, ...snap })
              return
            }

            if (req.method === 'POST' && sub === 'neutralize') {
              const body = await readJsonBody(req)
              const text = String(body?.text ?? '').trim()
              const useLlm = Boolean(body?.useLlm)
              if (!text) {
                sendJson(res, 400, { ok: false, error: '请先在下方输入框填写需要提纯的工程需求。' })
                return
              }

              let llmFn = null
              if (useLlm && ctx.get('llm')) {
                const defRoute = ctx.get('agentDefaultModel')?.current?.()
                if (defRoute?.provider && defRoute?.model) {
                  llmFn = async (sysPrompt, userRaw) => {
                    const assembler = new BlockAssembler()
                    for await (const chunk of ctx.llm.stream({
                      provider: defRoute.provider,
                      model: defRoute.model,
                      messages: [
                        { role: 'system', content: [{ type: 'text', text: sysPrompt }] },
                        { role: 'user', content: [{ type: 'text', text: userRaw }] },
                      ],
                      maxTokens: 512,
                    })) {
                      assembler.push(chunk)
                    }
                    return assembler
                      .blocks()
                      .filter(b => b.type === 'text')
                      .map(b => b.text)
                      .join('')
                  }
                }
              }

              const result = await neutralizePrompt(text, llmFn)
              if (result.budget?.savedTokens > 0) {
                btState.recordNeutralization(result.budget.savedTokens)
              }
              sendJson(res, 200, {
                ok: true,
                ...result,
                decodedZh: decodeBtToChinese(result.babeltele),
                state: btState.snapshot(),
              })
              return
            }

            if (req.method === 'POST' && sub === 'decode') {
              const body = await readJsonBody(req)
              const text = String(body?.text ?? '')
              sendJson(res, 200, {
                ok: true,
                tokens: countTokens(text),
                decodedZh: decodeBtToChinese(text),
              })
              return
            }

            sendJson(res, 404, { ok: false, error: `Unknown BabelTele API route: ${sub}` })
          } catch (err) {
            sendJson(res, 500, {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        },
      }),
    )
  })
}
