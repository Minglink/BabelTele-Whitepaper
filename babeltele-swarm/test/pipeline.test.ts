import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { executeSwarmRun } from '../src/orchestrator/swarmEngine';
import type { TargetLanguage } from '../src/types';

describe('4-Agent Dual-Plane Swarm Pipeline (Java, TypeScript, Python + Self-Healing)', () => {
  let tempWorkspacesRoot = '';

  before(() => {
    tempWorkspacesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'babeltele-swarm-test-'));
  });

  after(() => {
    if (tempWorkspacesRoot && fs.existsSync(tempWorkspacesRoot)) {
      fs.rmSync(tempWorkspacesRoot, { recursive: true, force: true });
    }
  });

  const languages: TargetLanguage[] = ['java', 'typescript', 'python'];

  for (const lang of languages) {
    it(`builds, sanitizes, and compiles pure ${lang.toUpperCase()} project with >60% token savings`, async () => {
      const result = await executeSwarmRun({
        prompt: '',
        language: lang,
        busMode: 'babeltele',
        computeAbComparison: true,
        simulateStreamingDelay: false,
        workspaceRootDir: tempWorkspacesRoot,
        llm: { engine: 'demo-sim' },
      });

      // Verify #PRD < 120 tokens and every Coder #DRAFT < 40 tokens
      const prdMsg = result.messages.find((m) => m.agent === 'PM-Spec');
      assert.ok(prdMsg, 'Expected PM-Spec message');
      assert.ok(
        prdMsg.tokens < 120,
        `Expected #PRD < 120 tokens, got ${prdMsg.tokens}`
      );

      const draftMsgs = result.messages.filter(
        (m) => m.agent === 'Coder' && m.stage === 'draft'
      );
      assert.equal(draftMsgs.length, 4);
      for (const dm of draftMsgs) {
        assert.ok(
          dm.tokens < 40,
          `Expected Coder #DRAFT < 40 tokens for ${dm.targetFile}, got ${dm.tokens}`
        );
      }

      // Verify Plane-2 artifacts exist on disk with ZERO BabelTele pollution
      assert.equal(result.artifacts.length, 4);
      for (const art of result.artifacts) {
        assert.ok(fs.existsSync(art.absolutePath), `Missing disk file: ${art.absolutePath}`);
        assert.equal(art.sanitizer.clean, true);
        assert.equal(art.sanitizer.babelTeleLeakageCount, 0);
      }

      // Verify real compiler + self-tests passed
      assert.equal(
        result.finalVerification.passed,
        true,
        `Verification failed for ${lang}: ${result.finalVerification.compilerStderr || result.finalVerification.btDiag}`
      );
      assert.equal(result.finalVerification.zeroBabelTeleLeakage, true);

      // Verify AB benchmark savings
      assert.ok(result.abComparison);
      assert.ok(
        result.abComparison.totalBusAndMemoryReductionPercent >= 65,
        `Expected >=65% bus+memory token reduction, got ${result.abComparison.totalBusAndMemoryReductionPercent}%`
      );
      assert.ok(result.abComparison.speedupMultiplier >= 2.2);
    });
  }

  it('catches injected BabelTele pollution via Verifier #DIAG and self-heals via Fixer in 1 loop', async () => {
    const result = await executeSwarmRun({
      prompt: '高并发防超卖故障演练',
      language: 'java',
      busMode: 'babeltele',
      injectFaultDrill: true,
      simulateStreamingDelay: false,
      workspaceRootDir: tempWorkspacesRoot,
      llm: { engine: 'demo-sim' },
    });

    assert.equal(result.verificationHistory.length, 2, 'Expected 2 verification iterations');
    assert.equal(result.verificationHistory[0].passed, false, 'Iter #1 must catch injected fault');
    assert.ok(result.verificationHistory[0].totalLeakageCount > 0, 'Iter #1 must detect BT leak');
    assert.ok(result.verificationHistory[0].btDiag.startsWith('#DIAG[!Fail'));

    assert.equal(result.telemetry.selfHealingLoops, 1);
    assert.equal(result.finalVerification.passed, true, 'Iter #2 after Fixer must pass');
    assert.equal(result.finalVerification.zeroBabelTeleLeakage, true);
  });
});
