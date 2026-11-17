import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHOWCASE_BLUEPRINTS } from '../src/core/demoBlueprints';
import { auditArtifact, splitCoderDualPlaneResponse } from '../src/core/sanitizer';

describe('ArtifactSanitizer (Dual-Plane Zero-Pollution Guard)', () => {
  it('passes 100% pure showcase Java, TypeScript, and Python artifacts with 0 leakage', () => {
    for (const bp of Object.values(SHOWCASE_BLUEPRINTS)) {
      for (const file of bp.files) {
        const report = auditArtifact(file.filePath, file.pureCode, bp.language);
        assert.equal(
          report.clean,
          true,
          `Expected ${file.filePath} to pass clean, got violations: ${JSON.stringify(report.violations)}`
        );
        assert.equal(report.babelTeleLeakageCount, 0);
        assert.equal(report.braceBalanceOk, true);
        assert.equal(report.headerValid, true);
      }
    }
  });

  it('allows symbols inside string literals and comments (no false positives)', () => {
    const javaWithStrings = `package com.demo;
// Comment mentioning ⇒ and ⊢ does not corrupt active Java syntax
public class Greeter {
    public String formatArrow() {
        return "Order Status ⇒ PAID → DONE";
    }
}
`;
    const report = auditArtifact('src/com/demo/Greeter.java', javaWithStrings, 'java');
    assert.equal(report.clean, true);
    assert.equal(report.babelTeleLeakageCount, 0);
  });

  it('catches BabelTele control-plane operators (⇒, ⊢, ⟦, #DRAFT) leaked into Java, TS, and Python', () => {
    for (const bp of Object.values(SHOWCASE_BLUEPRINTS)) {
      const faultyFile = bp.files.find((f) => Boolean(f.faultyPollutedCode));
      assert.ok(faultyFile, `Expected faulty drill sample for ${bp.language}`);
      const report = auditArtifact(
        faultyFile.filePath,
        faultyFile.faultyPollutedCode!,
        bp.language
      );
      assert.equal(report.clean, false);
      assert.ok(
        report.babelTeleLeakageCount >= 2,
        `Expected >=2 BT leaks in ${faultyFile.filePath}, got ${report.babelTeleLeakageCount}`
      );
    }
  });

  it('catches markdown code fences, prose chatter, and unbalanced brackets', () => {
    const pollutedTs = `Sure! Here is the code you requested:
\`\`\`typescript
export function add(a: number, b: number): number {
  if (a > 0) {
    return a + b;
}
\`\`\`
`;
    const report = auditArtifact('src/math.ts', pollutedTs, 'typescript');
    assert.equal(report.clean, false);
    assert.equal(report.braceBalanceOk, false);
    const rules = new Set(report.violations.map((v) => v.rule));
    assert.ok(rules.has('PROSE_CHATTER_LEAK'));
    assert.ok(rules.has('MARKDOWN_FENCE_LEAK'));
    assert.ok(rules.has('UNBALANCED_BRACES'));
  });

  it('cleanly splits Plane-1 BT_DRAFT from Plane-2 ARTIFACT code', () => {
    const rawLlmOutput = `<BT_DRAFT>#DRAFT[@Foo.py ⊢ fn(calc) ⊥ pure:py]</BT_DRAFT>
<ARTIFACT>
def calc(x: int) -> int:
    return x * 2
</ARTIFACT>`;
    const split = splitCoderDualPlaneResponse(rawLlmOutput);
    assert.equal(split.btDraft, '#DRAFT[@Foo.py ⊢ fn(calc) ⊥ pure:py]');
    assert.ok(split.pureCode.includes('def calc(x: int) -> int:'));
    assert.ok(!split.pureCode.includes('BT_DRAFT'));
    assert.ok(!split.pureCode.includes('#DRAFT'));
  });
});
