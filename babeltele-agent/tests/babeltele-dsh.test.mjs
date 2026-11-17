import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  auditAnchors,
  auditCodePurity,
  compareTokenBudget,
  decodeBtToChinese,
  extractBtHeader,
  neutralizePrompt,
  scanWorkspaceHeaders,
} from '../plugins/babeltele-dsh-plugin/src/protocol/babeltele-core.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

test('Neutralizer strips emotional bloat and locks 100% of Tier-1 engineering anchors', async () => {
  const raw =
    '你好啊麻烦帮我一下！我真是服了这破代码，如果出现单接口延迟大于等于 250ms 那么就必须告警，并且严禁误伤 127.0.0.1 和 /api/v2/health 以及 OrderValidator.java！万分感谢！'
  const res = await neutralizePrompt(raw)
  assert.equal(res.audit.passed, true, `Anchor audit failed: ${JSON.stringify(res.audit)}`)
  assert.ok(res.babeltele.includes('250ms'))
  assert.ok(res.babeltele.includes('127.0.0.1'))
  assert.ok(res.babeltele.includes('/api/v2/health'))
  assert.ok(res.babeltele.includes('OrderValidator.java'))
  assert.ok(!res.babeltele.includes('万分感谢'))
  assert.ok(res.budget.savedTokens > 0)
})

test('Sidecar Chinese decoder translates #BT operators cleanly', () => {
  const bt = '#BT #Plan -> read_file(app.py) & ?err => #Fix !禁止:drop_table'
  const zh = decodeBtToZhClientLike(bt)
  assert.ok(zh.includes('【硅基思考】'))
  assert.ok(zh.includes('【实施规划】'))
  assert.ok(zh.includes('【严禁】'))
})

function decodeBtToZhClientLike(s) {
  return decodeBtToChinese(s)
}

test('Dual-Plane ArtifactSanitizer approves pure code and flags #BT symbol leakage', () => {
  const cleanJava = 'public class OrderValidator {\n  public boolean validate(double amount) { return amount <= 50000.0; }\n}\n'
  assert.equal(auditCodePurity('OrderValidator.java', cleanJava).pure, true)

  const pollutedPy = '#BT => leak\ndef run():\n    return "⟦bad⟧"\n'
  const res = auditCodePurity('app.py', pollutedPy)
  assert.equal(res.pure, false)
  assert.ok(res.issues.length >= 1)
})

test('BT-Header topological extractor compresses workspace signatures', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'bt-dsh-hdr-'))
  try {
    const pyCode =
      'class TokenBucket:\n    def allow(self, ip: str) -> bool:\n        return True\n' + '# comment line\n'.repeat(50)
    writeFileSync(join(tmp, 'limiter.py'), pyCode, 'utf8')
    const hdr = extractBtHeader('limiter.py', pyCode)
    assert.ok(hdr && hdr.includes('@limiter.py'))
    const scanned = scanWorkspaceHeaders(tmp)
    assert.equal(scanned.count, 1)
    assert.ok(scanned.savedTokens > 20)
    const budget = compareTokenBudget(pyCode, scanned.digest)
    assert.equal(budget.netBpeGain, true)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('DeepSeek Harness profile + BabelTele overlay composes cleanly via --dump-config', () => {
  const tmpHome = mkdtempSync(join(tmpdir(), 'bt-dsh-home-'))
  try {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'launch.mjs'), '--dump-config'], {
      cwd: ROOT,
      env: { ...process.env, DSH_HOME: tmpHome },
      encoding: 'utf8',
    })
    assert.ok(out.includes('id: babeltele-mod'))
    assert.ok(out.includes('id: preset-babeltele'))
    assert.ok(out.includes('compaction-smft'))
    assert.ok(out.includes('directory-picker-browse'))
  } finally {
    rmSync(tmpHome, { recursive: true, force: true })
  }
})
