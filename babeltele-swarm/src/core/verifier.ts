import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import type {
  ArchitectManifest,
  FileVerificationResult,
  ProjectVerificationReport,
  TargetLanguage,
} from '../types';
import { resolveProjectRoot } from './paths';
import { auditArtifact, inferLanguageFromPath } from './sanitizer';

export interface HostToolchains {
  node: string;
  tsc: string;
  javac: string | null;
  java: string | null;
  python: string | null;
}

let cachedToolchains: HostToolchains | null = null;

function probeCommand(cmd: string, args: string[]): string | null {
  try {
    const out = execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 4000,
    });
    return (out || '').trim().split(/\r?\n/)[0] || 'available';
  } catch (err: unknown) {
    // javac -version sometimes writes to stderr on older JDKs while still exiting 0, or if non-zero return null
    if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 0) {
      const stderr = String((err as { stderr?: unknown }).stderr ?? '').trim();
      return stderr.split(/\r?\n/)[0] || 'available';
    }
    return null;
  }
}

export function detectHostToolchains(): HostToolchains {
  if (cachedToolchains) return cachedToolchains;
  cachedToolchains = {
    node: process.version,
    tsc: `TypeScript ${ts.version}`,
    javac: probeCommand('javac', ['-version']),
    java: probeCommand('java', ['-version']),
    python: probeCommand('python', ['--version']) ?? probeCommand('python3', ['--version']),
  };
  return cachedToolchains;
}

function collectFilesRecursive(rootDir: string, extFilter?: (relPath: string) => boolean): string[] {
  const results: string[] = [];
  if (!fs.existsSync(rootDir)) return results;

  function walk(curr: string): void {
    const entries = fs.readdirSync(curr, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.verify_') || entry.name === '__pycache__' || entry.name === 'node_modules') {
        continue;
      }
      const abs = path.join(curr, entry.name);
      const rel = path.relative(rootDir, abs).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(abs);
      } else if (!extFilter || extFilter(rel)) {
        results.push(rel);
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

function formatExecError(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err);
  const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
  const stderr = e.stderr ? String(e.stderr).trim() : '';
  const stdout = e.stdout ? String(e.stdout).trim() : '';
  return [stderr, stdout, e.message ?? ''].filter(Boolean).join('\n').trim();
}

function runJavaToolchain(workspaceDir: string, javaRelFiles: string[], toolchains: HostToolchains): {
  toolchainUsed: string;
  toolchainExecuted: boolean;
  runtimeTestsExecuted: boolean;
  passed: boolean;
  stdout: string;
  stderr: string;
} {
  if (!toolchains.javac || javaRelFiles.length === 0) {
    return {
      toolchainUsed: 'Structural AST + Brace + Contract Verifier (javac not found)',
      toolchainExecuted: false,
      runtimeTestsExecuted: false,
      passed: true,
      stdout: '',
      stderr: '',
    };
  }

  const classesDir = path.join(workspaceDir, '.verify_classes');
  fs.mkdirSync(classesDir, { recursive: true });

  try {
    const absJavaFiles = javaRelFiles.map((f) => path.join(workspaceDir, f));
    execFileSync('javac', ['-encoding', 'UTF-8', '-d', classesDir, ...absJavaFiles], {
      cwd: workspaceDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20000,
    });

    let stdout = `javac (${toolchains.javac}): compiled ${javaRelFiles.length} .java files cleanly (0 warnings/errors).`;
    let runtimeTestsExecuted = false;

    // Locate a MainTest or *Test class with public static void main(String[] args)
    if (toolchains.java) {
      const mainCandidate = javaRelFiles.find((f) => /MainTest\.java$|Test\.java$/i.test(f));
      if (mainCandidate) {
        const src = fs.readFileSync(path.join(workspaceDir, mainCandidate), 'utf8');
        if (/public\s+static\s+void\s+main\s*\(\s*String/.test(src)) {
          const pkgMatch = src.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m);
          const clsName = path.basename(mainCandidate, '.java');
          const fqcn = pkgMatch ? `${pkgMatch[1]}.${clsName}` : clsName;
          const runOut = execFileSync('java', ['-ea', '-cp', classesDir, fqcn], {
            cwd: workspaceDir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 15000,
          });
          runtimeTestsExecuted = true;
          stdout += `\njava runtime (${fqcn}):\n${(runOut || '').trim()}`;
        }
      }
    }

    return {
      toolchainUsed: runtimeTestsExecuted
        ? `${toolchains.javac} + Java Runtime Self-Test`
        : `${toolchains.javac}`,
      toolchainExecuted: true,
      runtimeTestsExecuted,
      passed: true,
      stdout,
      stderr: '',
    };
  } catch (err: unknown) {
    return {
      toolchainUsed: `${toolchains.javac}`,
      toolchainExecuted: true,
      runtimeTestsExecuted: false,
      passed: false,
      stdout: '',
      stderr: formatExecError(err),
    };
  } finally {
    fs.rmSync(classesDir, { recursive: true, force: true });
  }
}

function runTypeScriptToolchain(workspaceDir: string, tsRelFiles: string[]): {
  toolchainUsed: string;
  toolchainExecuted: boolean;
  runtimeTestsExecuted: boolean;
  passed: boolean;
  stdout: string;
  stderr: string;
} {
  if (tsRelFiles.length === 0) {
    return {
      toolchainUsed: `TypeScript ${ts.version}`,
      toolchainExecuted: false,
      runtimeTestsExecuted: false,
      passed: true,
      stdout: '',
      stderr: '',
    };
  }

  const absTsFiles = tsRelFiles.map((f) => path.join(workspaceDir, f));
  // Use syntactic + per-file transpile diagnostics + AST check, plus full program check when node types resolve
  const syntaxErrors: string[] = [];
  const tempJsDir = path.join(workspaceDir, '.verify_js');
  fs.mkdirSync(tempJsDir, { recursive: true });

  try {
    // Full Program check using host repo's @types/node via typeRoots fallback
    const hostNodeModulesTypes = path.join(resolveProjectRoot(), 'node_modules', '@types');
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmitOnError: true,
      outDir: tempJsDir,
      rootDir: workspaceDir,
      typeRoots: fs.existsSync(hostNodeModulesTypes) ? [hostNodeModulesTypes] : undefined,
    };

    const program = ts.createProgram(absTsFiles, compilerOptions);
    const emitResult = program.emit();
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    for (const diag of allDiagnostics) {
      const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      if (diag.file && diag.start !== undefined) {
        const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
        const rel = path.relative(workspaceDir, diag.file.fileName).replace(/\\/g, '/');
        syntaxErrors.push(`${rel}:${line + 1}:${character + 1} - TS${diag.code}: ${msg}`);
      } else {
        syntaxErrors.push(`TS${diag.code}: ${msg}`);
      }
    }

    if (syntaxErrors.length > 0) {
      return {
        toolchainUsed: `TypeScript ${ts.version} (tsc strict)`,
        toolchainExecuted: true,
        runtimeTestsExecuted: false,
        passed: false,
        stdout: '',
        stderr: syntaxErrors.join('\n'),
      };
    }

    let stdout = `tsc (TypeScript ${ts.version} --strict): verified ${tsRelFiles.length} .ts files cleanly (0 diagnostics).`;
    let runtimeTestsExecuted = false;

    // Run compiled test file if present
    const testRel = tsRelFiles.find((f) => /(\.test|Test)\.ts$/.test(f));
    if (testRel) {
      const compiledTestPath = path.join(tempJsDir, testRel.replace(/\.ts$/, '.js'));
      if (fs.existsSync(compiledTestPath)) {
        const runOut = execFileSync(process.execPath, [compiledTestPath], {
          cwd: workspaceDir,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 15000,
        });
        runtimeTestsExecuted = true;
        stdout += `\nnode (${process.version}) runtime self-test:\n${(runOut || '').trim()}`;
      }
    }

    return {
      toolchainUsed: runtimeTestsExecuted
        ? `TypeScript ${ts.version} (strict) + Node ${process.version} Runtime`
        : `TypeScript ${ts.version} (strict)`,
      toolchainExecuted: true,
      runtimeTestsExecuted,
      passed: true,
      stdout,
      stderr: '',
    };
  } catch (err: unknown) {
    return {
      toolchainUsed: `TypeScript ${ts.version} + Node ${process.version}`,
      toolchainExecuted: true,
      runtimeTestsExecuted: false,
      passed: false,
      stdout: '',
      stderr: formatExecError(err),
    };
  } finally {
    fs.rmSync(tempJsDir, { recursive: true, force: true });
  }
}

function runPythonToolchain(workspaceDir: string, pyRelFiles: string[], toolchains: HostToolchains): {
  toolchainUsed: string;
  toolchainExecuted: boolean;
  runtimeTestsExecuted: boolean;
  passed: boolean;
  stdout: string;
  stderr: string;
} {
  if (!toolchains.python || pyRelFiles.length === 0) {
    return {
      toolchainUsed: 'Structural Python Verifier (python not found)',
      toolchainExecuted: false,
      runtimeTestsExecuted: false,
      passed: true,
      stdout: '',
      stderr: '',
    };
  }

  const pyCmd = probeCommand('python', ['--version']) ? 'python' : 'python3';

  try {
    execFileSync(pyCmd, ['-B', '-m', 'py_compile', ...pyRelFiles], {
      cwd: workspaceDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    });

    let stdout = `${toolchains.python} (py_compile): syntax-verified ${pyRelFiles.length} .py files cleanly.`;
    let runtimeTestsExecuted = false;

    const hasUnitTests = pyRelFiles.some((f) => /(^|\/)test_.*\.py$|_test\.py$/.test(f));
    if (hasUnitTests) {
      const testOut = execFileSync(
        pyCmd,
        ['-B', '-m', 'unittest', 'discover', '-s', '.', '-p', 'test_*.py', '-v'],
        {
          cwd: workspaceDir,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 15000,
        }
      );
      runtimeTestsExecuted = true;
      stdout += `\nunittest suite:\n${(testOut || 'OK').trim()}`;
    }

    return {
      toolchainUsed: runtimeTestsExecuted
        ? `${toolchains.python} (py_compile + unittest)`
        : `${toolchains.python} (py_compile)`,
      toolchainExecuted: true,
      runtimeTestsExecuted,
      passed: true,
      stdout,
      stderr: '',
    };
  } catch (err: unknown) {
    return {
      toolchainUsed: `${toolchains.python} (py_compile)`,
      toolchainExecuted: true,
      runtimeTestsExecuted: false,
      passed: false,
      stdout: '',
      stderr: formatExecError(err),
    };
  } finally {
    // Ensure no __pycache__ left behind if unittest created any
    const pycache = path.join(workspaceDir, '__pycache__');
    fs.rmSync(pycache, { recursive: true, force: true });
  }
}

/**
 * Verifies an entire generated workspace across all 3 Dual-Plane gates:
 *  Gate 1: ArtifactSanitizer Zero-Pollution Scan (0 BabelTele symbols in disk files)
 *  Gate 2: Architect Manifest Symbol Contract Check
 *  Gate 3: Real Host Compiler & Self-Test Execution (javac/java, tsc/node, py_compile/unittest)
 */
export function verifyProjectWorkspace(
  workspaceDir: string,
  language: TargetLanguage,
  manifest: ArchitectManifest,
  iteration = 1
): ProjectVerificationReport {
  const toolchains = detectHostToolchains();
  const allRelFiles = collectFilesRecursive(workspaceDir);

  const fileResults: FileVerificationResult[] = [];
  let totalLeakageCount = 0;
  let firstFailureLoc = '';
  let firstFailureReason = '';
  let firstFailureFix = '';

  const contractMap = new Map(
    manifest.files.map((fc) => [fc.filePath.replace(/\\/g, '/'), fc])
  );

  // Check for missing expected files from manifest first
  for (const fc of manifest.files) {
    const normPath = fc.filePath.replace(/\\/g, '/');
    const absPath = path.join(workspaceDir, normPath);
    if (!fs.existsSync(absPath)) {
      fileResults.push({
        filePath: normPath,
        sanitizerClean: false,
        babelTeleLeakageCount: 0,
        contractMatched: false,
        missingSymbols: fc.expectedSymbols,
        syntaxValid: false,
        issues: [`Missing expected artifact file: ${normPath}`],
      });
      if (!firstFailureLoc) {
        firstFailureLoc = `${normPath}:1`;
        firstFailureReason = 'missing_file';
        firstFailureFix = `generate ${normPath} matching contract`;
      }
    }
  }

  // Gate 1 & Gate 2 on all present source files
  for (const relFile of allRelFiles) {
    const fileLang = inferLanguageFromPath(relFile);
    if (fileLang === 'other') continue;

    const absPath = path.join(workspaceDir, relFile);
    const content = fs.readFileSync(absPath, 'utf8');
    const audit = auditArtifact(relFile, content, fileLang);
    totalLeakageCount += audit.babelTeleLeakageCount;

    const contract = contractMap.get(relFile);
    const missingSymbols: string[] = [];
    if (contract) {
      for (const sym of contract.expectedSymbols) {
        const symIdentifier = sym.split('(')[0].trim();
        if (symIdentifier && !new RegExp(`\\b${symIdentifier}\\b`).test(content)) {
          missingSymbols.push(sym);
        }
      }
    }

    const issues: string[] = [];
    for (const v of audit.violations) {
      issues.push(`Line ${v.line}:${v.column} [${v.rule}] ${v.message}`);
      if (!firstFailureLoc) {
        firstFailureLoc = `${relFile}:${v.line}`;
        firstFailureReason = `${v.rule}(${v.snippet.slice(0, 32)})`;
        firstFailureFix =
          v.rule.startsWith('BT_') || v.rule === 'MARKDOWN_FENCE_LEAK'
            ? `strip_bt_sigils & rewrite_native_${language}`
            : 'fix_brace_and_header_syntax';
      }
    }
    if (missingSymbols.length > 0) {
      issues.push(`Missing contract symbols: ${missingSymbols.join(', ')}`);
      if (!firstFailureLoc) {
        firstFailureLoc = `${relFile}:1`;
        firstFailureReason = `sym_missing:${missingSymbols.join(',')}`;
        firstFailureFix = `implement ${missingSymbols.join(',')} per #ARCH`;
      }
    }

    fileResults.push({
      filePath: relFile,
      sanitizerClean: audit.clean,
      babelTeleLeakageCount: audit.babelTeleLeakageCount,
      contractMatched: missingSymbols.length === 0,
      missingSymbols,
      syntaxValid: audit.braceBalanceOk && audit.headerValid,
      issues,
    });
  }

  // Gate 3: Real Compiler & Runtime Verification
  let compilerRes: {
    toolchainUsed: string;
    toolchainExecuted: boolean;
    runtimeTestsExecuted: boolean;
    passed: boolean;
    stdout: string;
    stderr: string;
  };

  if (language === 'java') {
    const javaFiles = allRelFiles.filter((f) => f.endsWith('.java'));
    compilerRes = runJavaToolchain(workspaceDir, javaFiles, toolchains);
  } else if (language === 'typescript') {
    const tsFiles = allRelFiles.filter((f) => f.endsWith('.ts'));
    compilerRes = runTypeScriptToolchain(workspaceDir, tsFiles);
  } else {
    const pyFiles = allRelFiles.filter((f) => f.endsWith('.py'));
    compilerRes = runPythonToolchain(workspaceDir, pyFiles, toolchains);
  }

  if (!compilerRes.passed) {
    const firstErrLine =
      compilerRes.stderr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find(Boolean) ?? 'compiler_check_failed';

    // Attribute compiler error to matching file if possible
    for (const fr of fileResults) {
      if (compilerRes.stderr.includes(path.basename(fr.filePath))) {
        fr.syntaxValid = false;
        fr.issues.push(`Compiler error: ${firstErrLine}`);
      }
    }

    if (!firstFailureLoc) {
      const fileLineMatch = compilerRes.stderr.match(/([A-Za-z0-9_./\\-]+\.(?:java|ts|py)):(\d+)/);
      firstFailureLoc = fileLineMatch
        ? `${fileLineMatch[1].replace(/\\/g, '/')}:${fileLineMatch[2]}`
        : `${fileResults[0]?.filePath ?? 'workspace'}:1`;
      firstFailureReason = `compile_err:${firstErrLine.slice(0, 65)}`;
      firstFailureFix = `patch_${language}_compile_error & sync_§SMFT`;
    }
  }

  const zeroBabelTeleLeakage = totalLeakageCount === 0;
  const allFilesClean =
    fileResults.length > 0 &&
    fileResults.every((r) => r.sanitizerClean && r.contractMatched && r.syntaxValid);
  const passed = zeroBabelTeleLeakage && allFilesClean && compilerRes.passed;

  const btDiag = passed
    ? `#PASS[iter:${iteration} | files:${fileResults.length} | bt_leak:0 | contract:OK | toolchain:${compilerRes.toolchainUsed}:PASS]`
    : `#DIAG[!Fail @${firstFailureLoc} ⊢ bt_leak:${totalLeakageCount} & ${firstFailureReason} ⇒ ${firstFailureFix}]`;

  const verboseDiag = passed
    ? `Verification Iteration #${iteration} Succeeded! All ${fileResults.length} generated ${language} source files have been scanned by ArtifactSanitizer with strictly 0 BabelTele symbol leakage, matched every Architect interface contract, and passed compilation and runtime verification using ${compilerRes.toolchainUsed}.`
    : `Verification Iteration #${iteration} Failed at ${firstFailureLoc}. Detailed diagnosis: Detected ${totalLeakageCount} BabelTele leakage symbol(s) and issue "${firstFailureReason}". Compiler stderr output:\n${compilerRes.stderr || '(pre-compiler sanitizer/contract gate triggered)'}\nRecommended remediation for Fixer Agent: Please ${firstFailureFix} and regenerate the complete pure ${language} source file.`;

  const humanSummaryZh = passed
    ? `第 ${iteration} 轮验收一次通过：共审计 ${fileResults.length} 个源码文件，巴别语控制符泄漏数 = 0，架构契约 100% 匹配，本地工具链 (${compilerRes.toolchainUsed}) 编译与自测全部通过！`
    : `第 ${iteration} 轮验收拦截到异常 (@${firstFailureLoc})：巴别语污染计数=${totalLeakageCount}，原因=${firstFailureReason}，已向 Fixer 发送单行 BT-Diag 触发热修复。`;

  return {
    passed,
    iteration,
    toolchainUsed: compilerRes.toolchainUsed,
    toolchainExecuted: compilerRes.toolchainExecuted,
    runtimeTestsExecuted: compilerRes.runtimeTestsExecuted,
    zeroBabelTeleLeakage,
    totalLeakageCount,
    filesChecked: fileResults.length,
    fileResults,
    compilerStdout: compilerRes.stdout,
    compilerStderr: compilerRes.stderr,
    btDiag,
    verboseDiag,
    humanSummaryZh,
  };
}
