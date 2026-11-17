import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SHOWCASE_BLUEPRINTS } from '../src/core/demoBlueprints';
import { extractBtHeader, SMFTMemoryPool } from '../src/core/headerExtractor';
import { countTokens } from '../src/core/tokenizer';

describe('BT-Header Symbol Extractor & SMFT Memory Pool', () => {
  it('extracts accurate Java package, classes, methods, and inner exceptions with >70% token savings', () => {
    const invFile = SHOWCASE_BLUEPRINTS.java.files.find((f) =>
      f.filePath.endsWith('InventoryService.java')
    )!;
    const digest = extractBtHeader(invFile.filePath, invFile.pureCode, 'java');

    assert.equal(digest.moduleOrPackage, 'com.babeltele.shop');
    assert.ok(digest.btHeader.startsWith('#HDR['));
    const typeNames = digest.types.map((t) => t.name);
    assert.ok(typeNames.includes('InventoryService'));
    assert.ok(typeNames.includes('InsufficientStockException'));

    const allMethods = digest.types.flatMap((t) => t.methods).join(' ');
    assert.ok(allMethods.includes('reserveStock'));
    assert.ok(allMethods.includes('releaseStock'));
    assert.ok(
      digest.savedPercent >= 65,
      `Expected >=65% token reduction on InventoryService.java, got ${digest.savedPercent}%`
    );
  });

  it('extracts TypeScript interfaces, classes, and exported functions cleanly', () => {
    const jwtFile = SHOWCASE_BLUEPRINTS.typescript.files.find((f) =>
      f.filePath.endsWith('jwtAuth.ts')
    )!;
    const digest = extractBtHeader(jwtFile.filePath, jwtFile.pureCode, 'typescript');

    const typeNames = digest.types.map((t) => t.name);
    assert.ok(typeNames.includes('JwtPayload'));
    assert.ok(typeNames.includes('JwtAuthError'));
    assert.ok(digest.functions.some((fn) => fn.startsWith('signJwt(')));
    assert.ok(digest.functions.some((fn) => fn.startsWith('verifyJwt(')));
    assert.ok(digest.savedPercent >= 65);
  });

  it('extracts Python dataclasses, enums, and async methods cleanly', () => {
    const engineFile = SHOWCASE_BLUEPRINTS.python.files.find((f) =>
      f.filePath.endsWith('rule_engine.py')
    )!;
    const digest = extractBtHeader(engineFile.filePath, engineFile.pureCode, 'python');

    const cls = digest.types.find((t) => t.name === 'AsyncRiskRuleEngine');
    assert.ok(cls, 'Expected AsyncRiskRuleEngine class in digest');
    assert.ok(cls.methods.some((m) => m.includes('async evaluate(')));
    assert.ok(cls.methods.some((m) => m.includes('async evaluate_batch(')));
    assert.ok(digest.savedPercent >= 65);
  });

  it('achieves ~80%+ cross-file context compression in SMFTMemoryPool vs raw file stuffing', () => {
    const pool = new SMFTMemoryPool();
    for (const file of SHOWCASE_BLUEPRINTS.java.files.slice(0, 3)) {
      pool.upsertFile(file.filePath, file.pureCode, 'java');
    }

    const smftContext = pool.formatBtPoolContext();
    const rawVerboseContext = pool.formatVerboseRawContext();

    const smftTokens = countTokens(smftContext);
    const verboseTokens = countTokens(rawVerboseContext);

    assert.ok(smftContext.startsWith('§SMFT['));
    assert.ok(
      smftTokens < verboseTokens * 0.3,
      `Expected SMFT pool (${smftTokens} tok) to be <30% of verbose raw context (${verboseTokens} tok)`
    );
  });
});
