#!/usr/bin/env node
/**
 * Launcher for BabelTele Super Agent (Modded DeepSeek Harness `dsh` Runtime).
 * Isolates `$DSH_HOME` inside `babeltele-agent/.dsh-home` by default and applies
 * the resolved `babeltele.patch.yml` onto the official `dsh` profile stack.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PATCH_TEMPLATE = resolve(ROOT, 'config', 'babeltele.patch.yml')
const PLUGIN_ROOT_URL = pathToFileURL(resolve(ROOT, 'plugins', 'babeltele-dsh-plugin')).href.replace(/\/$/, '')
const DEFAULT_HOME = resolve(ROOT, '.dsh-home')
const DEFAULT_WORKSPACE = resolve(ROOT, 'workspaces', 'default-project')

const activeHome = process.env.DSH_HOME ? resolve(process.env.DSH_HOME) : DEFAULT_HOME
mkdirSync(activeHome, { recursive: true })
mkdirSync(DEFAULT_WORKSPACE, { recursive: true })

const runtimePatchPath = join(activeHome, 'babeltele.runtime.patch.yml')
const renderedPatch = readFileSync(PATCH_TEMPLATE, 'utf8').replaceAll('{{BT_PLUGIN_URL}}', PLUGIN_ROOT_URL)
writeFileSync(runtimePatchPath, renderedPatch, 'utf8')

const require = createRequire(resolve(ROOT, 'package.json'))
const dshPkgPath = require.resolve('@deepseek-ai/dsh/package.json')
const dshBin = join(dirname(dshPkgPath), 'lib', 'bin.js')

const rawArgs = process.argv.slice(2)
let cliArgs = []

if (rawArgs.includes('--dump-config')) {
  cliArgs = ['--profile', 'web', '--patch', runtimePatchPath, '--dump-config']
} else {
  const mode = rawArgs[0] && !rawArgs[0].startsWith('-') ? rawArgs[0] : 'web'
  const rest = rawArgs[0] && !rawArgs[0].startsWith('-') ? rawArgs.slice(1) : rawArgs
  cliArgs = [mode, '--patch', runtimePatchPath, ...rest]
}

const env = {
  ...process.env,
  DSH_HOME: activeHome,
  DSH_TELEMETRY_DISABLED: process.env.DSH_TELEMETRY_DISABLED || '1',
}

console.log('========================================================================')
console.log('  ⚡ BabelTele · DSH Super Agent (基于 DeepSeek Harness 深度魔改版)')
console.log('  🧬 内核协议: BT-Spec v1.0 (#BT 硅基思考 · SMFT 默克尔压缩 · 双平面零污染)')
console.log(`  📂 默认沙箱工作区: ${DEFAULT_WORKSPACE}`)
console.log('========================================================================')

const child = spawn(process.execPath, [dshBin, ...cliArgs], {
  cwd: DEFAULT_WORKSPACE,
  env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
