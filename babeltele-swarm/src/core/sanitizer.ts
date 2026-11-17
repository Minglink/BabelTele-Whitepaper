import type { SanitizerReport, SanitizerViolation, TargetLanguage } from '../types';

export function inferLanguageFromPath(filePath: string): TargetLanguage | 'other' {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.java')) return 'java';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.mjs')) {
    return 'typescript';
  }
  if (lower.endsWith('.py')) return 'python';
  return 'other';
}

export interface DualPlaneCoderSplit {
  btDraft: string;
  pureCode: string;
}

/**
 * Splits a Coder agent response into Plane 1 (BT-Draft reasoning) and Plane 2 (Pure Source Code).
 * Strips outer <ARTIFACT> tags or outer markdown code fences cleanly without mutating inner code.
 */
export function splitCoderDualPlaneResponse(rawOutput: string): DualPlaneCoderSplit {
  let remaining = rawOutput.trim();
  let btDraft = '';

  const draftTagMatch = remaining.match(/<BT_DRAFT>([\s\S]*?)<\/BT_DRAFT>/i);
  if (draftTagMatch) {
    btDraft = draftTagMatch[1].trim();
    remaining = remaining.replace(draftTagMatch[0], '').trim();
  } else {
    // Check if first line starts with #DRAFT[...]
    const firstNewline = remaining.indexOf('\n');
    if (firstNewline !== -1) {
      const firstLine = remaining.slice(0, firstNewline).trim();
      if (firstLine.startsWith('#DRAFT[') || firstLine.startsWith('⟦BT')) {
        btDraft = firstLine;
        remaining = remaining.slice(firstNewline + 1).trim();
      }
    }
  }

  const artifactTagMatch = remaining.match(/<ARTIFACT>([\s\S]*?)<\/ARTIFACT>/i);
  if (artifactTagMatch) {
    remaining = artifactTagMatch[1].trim();
  }

  // Strip a single outer markdown code fence if the LLM wrapped the artifact in ```lang ... ```
  const outerFenceMatch = remaining.match(/^```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```$/);
  if (outerFenceMatch) {
    remaining = outerFenceMatch[1];
  }

  return {
    btDraft,
    pureCode: remaining.endsWith('\n') ? remaining : `${remaining}\n`,
  };
}

const BT_FRAME_CHARS = new Set(['⟦', '⟧', '⟪', '⟫']);
const BT_FORBIDDEN_CODE_OPERATORS = new Set(['⇒', '⇐', '⟶', '⊢', '⊥', '⊕', '⊗', '⚡', '→']);

const BT_CONTROL_TAG_REGEX = /(#(?:PRD|ARCH|DRAFT|HDR|DIAG|FIX|PASS|CONTRACT)\s*\[|§SMFT|<\/?BT_DRAFT>|<\/?ARTIFACT>)/;
const BT_DIRECTIVE_IN_CODE_REGEX = /(@(?:Cls|Fn|Mod|Err|Pkg|Dep):|!(?:Fail|Guard)\b)/;
const PROSE_PREAMBLE_REGEX = /^(?:Sure!|Certainly!|Here(?:'s| is) the (?:code|implementation|updated file)|Below is the|好的[，！]|当然可以|以下是为您生成的)/i;

interface StrippedCodeLine {
  lineNumber: number;
  rawLine: string;
  activeCode: string; // Strings and comments replaced with spaces to preserve column alignment
}

/**
 * Lexical scanner that strips comments and string literals while preserving exact line & column positions,
 * and simultaneously checks bracket balance ({}, (), []).
 */
function lexicalScanSource(
  content: string,
  language: TargetLanguage | 'other'
): {
  lines: StrippedCodeLine[];
  braceViolations: SanitizerViolation[];
} {
  const rawLines = content.split(/\r?\n/);
  const strippedLines: StrippedCodeLine[] = [];
  const braceViolations: SanitizerViolation[] = [];

  const isPython = language === 'python';
  const isCStyle = language === 'java' || language === 'typescript' || language === 'other';

  type LexState =
    | 'CODE'
    | 'SINGLE_STR'
    | 'DOUBLE_STR'
    | 'TEMPLATE_STR'
    | 'TRIPLE_SINGLE_STR'
    | 'TRIPLE_DOUBLE_STR'
    | 'BLOCK_COMMENT';

  let state: LexState = 'CODE';
  const bracketStack: Array<{ char: string; expected: string; line: number; col: number }> = [];
  const openToClose: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
  const closeToOpen: Record<string, string> = { '}': '{', ')': '(', ']': '[' };

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const raw = rawLines[lineIdx];
    const lineNum = lineIdx + 1;

    if (state === 'CODE' && /^\s*```/.test(raw)) {
      strippedLines.push({
        lineNumber: lineNum,
        rawLine: raw,
        activeCode: ' '.repeat(raw.length),
      });
      continue;
    }

    const activeChars = new Array<string>(raw.length).fill(' ');

    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      const next = i + 1 < raw.length ? raw[i + 1] : '';
      const next2 = i + 2 < raw.length ? raw[i + 2] : '';

      if (state === 'CODE') {
        // C-style comments
        if (isCStyle && ch === '/' && next === '/') {
          break; // Rest of line is comment
        }
        if (isCStyle && ch === '/' && next === '*') {
          state = 'BLOCK_COMMENT';
          i += 2;
          continue;
        }
        // Python line comment
        if (isPython && ch === '#') {
          break; // Rest of line is comment
        }
        // Python or Java text-block triple quotes
        if ((isPython || language === 'java') && ch === '"' && next === '"' && next2 === '"') {
          state = 'TRIPLE_DOUBLE_STR';
          i += 3;
          continue;
        }
        if (isPython && ch === "'" && next === "'" && next2 === "'") {
          state = 'TRIPLE_SINGLE_STR';
          i += 3;
          continue;
        }
        // Normal strings
        if (ch === '"') {
          state = 'DOUBLE_STR';
          i++;
          continue;
        }
        if (ch === "'") {
          state = 'SINGLE_STR';
          i++;
          continue;
        }
        if (language === 'typescript' && ch === '`') {
          state = 'TEMPLATE_STR';
          i++;
          continue;
        }
        // Regex literal heuristic in TS/JS to avoid false bracket mismatch inside /.../
        if (language === 'typescript' && ch === '/' && next !== '/' && next !== '*') {
          const prevActive = activeChars.slice(0, i).join('').trimEnd();
          const prevChar = prevActive.length > 0 ? prevActive[prevActive.length - 1] : '(';
          if ('=([{,:;!&|?+-~^'.includes(prevChar)) {
            // Scan to end of regex literal on same line
            let j = i + 1;
            let inCharClass = false;
            let foundEnd = false;
            while (j < raw.length) {
              if (raw[j] === '\\') {
                j += 2;
                continue;
              }
              if (raw[j] === '[') inCharClass = true;
              else if (raw[j] === ']') inCharClass = false;
              else if (raw[j] === '/' && !inCharClass) {
                foundEnd = true;
                break;
              }
              j++;
            }
            if (foundEnd) {
              i = j + 1;
              continue;
            }
          }
        }

        // Active code character!
        activeChars[i] = ch;

        if (ch in openToClose) {
          bracketStack.push({ char: ch, expected: openToClose[ch], line: lineNum, col: i + 1 });
        } else if (ch in closeToOpen) {
          const top = bracketStack.pop();
          if (!top) {
            braceViolations.push({
              line: lineNum,
              column: i + 1,
              rule: 'UNBALANCED_BRACES',
              snippet: raw.trim().slice(0, 80),
              message: `Unexpected closing '${ch}' with no matching '${closeToOpen[ch]}'`,
              severity: 'error',
            });
          } else if (top.expected !== ch) {
            braceViolations.push({
              line: lineNum,
              column: i + 1,
              rule: 'UNBALANCED_BRACES',
              snippet: raw.trim().slice(0, 80),
              message: `Mismatched bracket '${ch}' (expected '${top.expected}' to close '${top.char}' from line ${top.line})`,
              severity: 'error',
            });
          }
        }
        i++;
      } else if (state === 'BLOCK_COMMENT') {
        if (ch === '*' && next === '/') {
          state = 'CODE';
          i += 2;
        } else {
          i++;
        }
      } else if (state === 'DOUBLE_STR') {
        if (ch === '\\') {
          i += 2;
        } else if (ch === '"') {
          state = 'CODE';
          i++;
        } else {
          i++;
        }
      } else if (state === 'SINGLE_STR') {
        if (ch === '\\') {
          i += 2;
        } else if (ch === "'") {
          state = 'CODE';
          i++;
        } else {
          i++;
        }
      } else if (state === 'TEMPLATE_STR') {
        if (ch === '\\') {
          i += 2;
        } else if (ch === '`') {
          state = 'CODE';
          i++;
        } else {
          i++;
        }
      } else if (state === 'TRIPLE_DOUBLE_STR') {
        if (ch === '\\') {
          i += 2;
        } else if (ch === '"' && next === '"' && next2 === '"') {
          state = 'CODE';
          i += 3;
        } else {
          i++;
        }
      } else if (state === 'TRIPLE_SINGLE_STR') {
        if (ch === '\\') {
          i += 2;
        } else if (ch === "'" && next === "'" && next2 === "'") {
          state = 'CODE';
          i += 3;
        } else {
          i++;
        }
      }
    }

    // Single-line strings shouldn't leak across lines in Java/Python
    if (state === 'DOUBLE_STR' || state === 'SINGLE_STR') {
      state = 'CODE';
    }

    strippedLines.push({
      lineNumber: lineNum,
      rawLine: raw,
      activeCode: activeChars.join(''),
    });
  }

  for (const unclosed of bracketStack) {
    braceViolations.push({
      line: unclosed.line,
      column: unclosed.col,
      rule: 'UNBALANCED_BRACES',
      snippet: rawLines[unclosed.line - 1]?.trim().slice(0, 80) ?? '',
      message: `Unclosed '${unclosed.char}' opened at line ${unclosed.line}:${unclosed.col} (expected '${unclosed.expected}')`,
      severity: 'error',
    });
  }

  return { lines: strippedLines, braceViolations };
}

/**
 * ArtifactSanitizer: Audits generated Plane-2 source code before & after disk writes
 * to guarantee ZERO BabelTele Control-Plane symbol contamination, balanced braces,
 * and valid native language headers.
 */
export function auditArtifact(
  filePath: string,
  content: string,
  explicitLanguage?: TargetLanguage | 'other'
): SanitizerReport {
  const language = explicitLanguage ?? inferLanguageFromPath(filePath);
  const violations: SanitizerViolation[] = [];
  let babelTeleLeakageCount = 0;

  const { lines, braceViolations } = lexicalScanSource(content, language);

  for (const line of lines) {
    const trimmedRaw = line.rawLine.trim();

    // 1. Check framing sigils anywhere in the file
    for (let col = 0; col < line.rawLine.length; col++) {
      const ch = line.rawLine[col];
      if (BT_FRAME_CHARS.has(ch)) {
        babelTeleLeakageCount++;
        violations.push({
          line: line.lineNumber,
          column: col + 1,
          rule: 'BT_FRAME_SIGIL',
          snippet: trimmedRaw.slice(0, 90),
          message: `BabelTele framing sigil '${ch}' leaked into native source file`,
          severity: 'error',
        });
      }
    }

    // 2. Check BabelTele Control-Plane tags (#PRD[, #ARCH[, #DRAFT[, #HDR[, #DIAG[, §SMFT) anywhere
    const tagMatch = line.rawLine.match(BT_CONTROL_TAG_REGEX);
    if (tagMatch && tagMatch.index !== undefined) {
      babelTeleLeakageCount++;
      violations.push({
        line: line.lineNumber,
        column: tagMatch.index + 1,
        rule: 'BT_CONTROL_TAG',
        snippet: trimmedRaw.slice(0, 90),
        message: `BabelTele control tag '${tagMatch[0]}' leaked into Artifact Plane`,
        severity: 'error',
      });
    }

    // 3. Check markdown code fences leaked inside code
    if (/^```/.test(trimmedRaw)) {
      babelTeleLeakageCount++;
      violations.push({
        line: line.lineNumber,
        column: 1,
        rule: 'MARKDOWN_FENCE_LEAK',
        snippet: trimmedRaw.slice(0, 90),
        message: 'Markdown code fence (```) leaked into source file',
        severity: 'error',
      });
    }

    // 4. Check conversational prose preamble on top/bottom lines
    if ((line.lineNumber <= 3 || line.lineNumber >= lines.length - 1) && PROSE_PREAMBLE_REGEX.test(trimmedRaw)) {
      violations.push({
        line: line.lineNumber,
        column: 1,
        rule: 'PROSE_CHATTER_LEAK',
        snippet: trimmedRaw.slice(0, 90),
        message: 'Conversational prose chatter leaked outside code comments',
        severity: 'error',
      });
    }

    // 5. Check active code (outside strings & comments) for BabelTele symbolic operators & directives
    for (let col = 0; col < line.activeCode.length; col++) {
      const ch = line.activeCode[col];
      if (BT_FORBIDDEN_CODE_OPERATORS.has(ch)) {
        babelTeleLeakageCount++;
        violations.push({
          line: line.lineNumber,
          column: col + 1,
          rule: 'BT_SYMBOL_OPERATOR',
          snippet: trimmedRaw.slice(0, 90),
          message: `BabelTele control operator '${ch}' (U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}) leaked into active ${language} expression`,
          severity: 'error',
        });
      }
    }

    const dirMatch = line.activeCode.match(BT_DIRECTIVE_IN_CODE_REGEX);
    if (dirMatch && dirMatch.index !== undefined) {
      babelTeleLeakageCount++;
      violations.push({
        line: line.lineNumber,
        column: dirMatch.index + 1,
        rule: 'BT_SYMBOL_OPERATOR',
        snippet: trimmedRaw.slice(0, 90),
        message: `BabelTele inline directive '${dirMatch[0]}' leaked into active ${language} code`,
        severity: 'error',
      });
    }
  }

  // 6. Bracket balance check (applies to Java, TypeScript, Python)
  if (language === 'java' || language === 'typescript' || language === 'python') {
    violations.push(...braceViolations);
  }
  const braceBalanceOk = braceViolations.length === 0;

  // 7. Language-specific structural header & declaration validation
  let headerValid = true;
  const fullActiveCode = lines.map((l) => l.activeCode).join('\n');

  if (content.trim().length === 0) {
    headerValid = false;
    violations.push({
      line: 1,
      column: 1,
      rule: 'INVALID_HEADER',
      snippet: '<empty>',
      message: 'Artifact source file is empty',
      severity: 'error',
    });
  } else if (language === 'java') {
    // Must contain class, interface, enum, or record declaration
    const hasJavaType = /\b(class|interface|enum|record)\s+[A-Za-z_][A-Za-z0-9_]*/.test(fullActiveCode);
    if (!hasJavaType) {
      headerValid = false;
      violations.push({
        line: 1,
        column: 1,
        rule: 'INVALID_HEADER',
        snippet: lines[0]?.rawLine.trim().slice(0, 80) ?? '',
        message: 'Java source file lacks a valid class/interface/enum/record declaration',
        severity: 'error',
      });
    }
    // If package line exists, ensure valid package syntax ending with semicolon
    const firstCodeLine = lines.find((l) => l.activeCode.trim().length > 0);
    if (firstCodeLine && /^\s*package\b/.test(firstCodeLine.activeCode)) {
      if (!/^\s*package\s+[a-zA-Z_][a-zA-Z0-9_.]*\s*;/.test(firstCodeLine.activeCode)) {
        headerValid = false;
        violations.push({
          line: firstCodeLine.lineNumber,
          column: 1,
          rule: 'INVALID_HEADER',
          snippet: firstCodeLine.rawLine.trim().slice(0, 80),
          message: 'Malformed Java package header (missing semicolon or invalid identifier)',
          severity: 'error',
        });
      }
    }
  } else if (language === 'python') {
    // Reject C-style Java headers accidentally emitted into a .py file
    if (/^\s*package\s+[a-z0-9_.]+\s*;/m.test(fullActiveCode) || /^\s*public\s+class\s+/m.test(fullActiveCode)) {
      headerValid = false;
      violations.push({
        line: 1,
        column: 1,
        rule: 'INVALID_HEADER',
        snippet: lines[0]?.rawLine.trim().slice(0, 80) ?? '',
        message: 'Non-Python (Java/C-style) class/package header detected in .py artifact',
        severity: 'error',
      });
    }
  }

  const hasErrors = violations.some((v) => v.severity === 'error');

  return {
    filePath,
    language,
    clean: !hasErrors && babelTeleLeakageCount === 0 && braceBalanceOk && headerValid,
    babelTeleLeakageCount,
    braceBalanceOk,
    headerValid,
    violations,
    sanitizedContent: content,
  };
}
