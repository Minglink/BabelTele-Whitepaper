/**
 * Persistent & In-Memory BabelTele Kernel State + Dual-Plane Telemetry Store.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const DEFAULT_PREFS = {
  btEnabled: true,
  autoNeutralizeOnSend: false,
  defaultSidecarOpen: true,
  injectBtHeaders: true,
  strictCodeGuard: true,
}

class BabelTeleStateStore {
  constructor() {
    this.prefs = { ...DEFAULT_PREFS }
    this.telemetry = {
      promptsNeutralized: 0,
      inputTokensSaved: 0,
      reasoningStepsObserved: 0,
      estimatedReasoningTokensSaved: 0,
      filesAudited: 0,
      pureFilesVerified: 0,
      blockedPollutedWrites: 0,
      smftCompactions: 0,
      recentFileAudits: [],
    }
    this.settingsPath = null
  }

  bindHome(dshHomeDir) {
    if (!dshHomeDir) return
    this.settingsPath = join(dshHomeDir, 'babeltele-preferences.json')
    if (existsSync(this.settingsPath)) {
      try {
        const raw = JSON.parse(readFileSync(this.settingsPath, 'utf8'))
        for (const k of Object.keys(DEFAULT_PREFS)) {
          if (typeof raw[k] === 'boolean') this.prefs[k] = raw[k]
        }
      } catch {
        // ignore corrupted prefs file
      }
    }
  }

  updatePrefs(patch) {
    for (const k of Object.keys(DEFAULT_PREFS)) {
      if (typeof patch?.[k] === 'boolean') {
        this.prefs[k] = patch[k]
      }
    }
    if (this.settingsPath) {
      try {
        mkdirSync(dirname(this.settingsPath), { recursive: true })
        writeFileSync(this.settingsPath, JSON.stringify(this.prefs, null, 2), 'utf8')
      } catch {
        // ignore write failure
      }
    }
    return this.snapshot()
  }

  recordNeutralization(savedTokens) {
    this.telemetry.promptsNeutralized += 1
    if (savedTokens > 0) this.telemetry.inputTokensSaved += savedTokens
  }

  recordReasoningStep(btTokens) {
    this.telemetry.reasoningStepsObserved += 1
    // Verbose prose reasoning in coding turns averages ~95 tokens per step
    const saved = Math.max(0, 95 - btTokens)
    this.telemetry.estimatedReasoningTokensSaved += saved
  }

  recordFileAudit({ path, tool, pure, issues }) {
    this.telemetry.filesAudited += 1
    if (pure) this.telemetry.pureFilesVerified += 1
    else this.telemetry.blockedPollutedWrites += 1
    this.telemetry.recentFileAudits.unshift({
      path,
      tool,
      pure,
      issues,
      ts: Date.now(),
    })
    if (this.telemetry.recentFileAudits.length > 25) {
      this.telemetry.recentFileAudits.length = 25
    }
  }

  recordSmftCompaction() {
    this.telemetry.smftCompactions += 1
  }

  snapshot() {
    const totalSaved = this.telemetry.inputTokensSaved + this.telemetry.estimatedReasoningTokensSaved
    return {
      prefs: { ...this.prefs },
      telemetry: {
        ...this.telemetry,
        totalTokensSaved: totalSaved,
        purityRatePct:
          this.telemetry.filesAudited === 0
            ? 100
            : Number(((this.telemetry.pureFilesVerified / this.telemetry.filesAudited) * 100).toFixed(1)),
      },
    }
  }
}

export const btState = new BabelTeleStateStore()
