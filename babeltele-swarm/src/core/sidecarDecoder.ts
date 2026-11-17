import { countTokens } from './tokenizer';

export interface DecodedBabelTeleMessage {
  raw: string;
  isBabelTele: boolean;
  blockType: string;
  decodedZh: string;
  keyFields: Array<{ label: string; value: string }>;
  tokens: number;
}

const OPERATOR_GLOSSARY: Array<[RegExp, string]> = [
  [/§SMFT/g, '【跨文件符号记忆池】'],
  [/!Fail\b/g, '【故障定位】'],
  [/!Guard\b/g, '【安全守卫不变式】'],
  [/⇒/g, ' → 触发/修复动作：'],
  [/⇐/g, ' ← 依赖上下文：'],
  [/⟶/g, ' → 流向：'],
  [/⊢/g, ' ｜ 锁定契约：'],
  [/⊥/g, ' ｜ 双平面纯净边界：'],
  [/⊕/g, ' + 组合 '],
  [/⊗/g, ' × 互斥 '],
  [/⚡/g, ' [极速通道] '],
];

function humanizeSegment(seg: string): string {
  let out = seg.trim();
  for (const [pattern, replacement] of OPERATOR_GLOSSARY) {
    out = out.replace(pattern, replacement);
  }
  out = out
    .replace(/\bdom:/gi, '业务域：')
    .replace(/\blang:/gi, '目标语言：')
    .replace(/\bgoals?:/gi, '核心功能：')
    .replace(/\binv:/gi, '核心不变式：')
    .replace(/\bslo:/gi, '验收指标：')
    .replace(/\bpkg:/gi, '包路径：')
    .replace(/\bmod:/gi, '模块：')
    .replace(/\bCls:/g, '类 ')
    .replace(/\bIfc:/g, '接口 ')
    .replace(/\bEnum:/g, '枚举 ')
    .replace(/\bRec:/g, '数据记录 ')
    .replace(/\bTyp:/g, '类型 ')
    .replace(/\bFn:/g, '方法/函数 ')
    .replace(/\bDep:/gi, '依赖 ')
    .replace(/\bErr:/g, '异常边界 ')
    .replace(/\bpure:/gi, '100%纯净原生代码输出：');
  return out;
}

function unwrapBlock(text: string, prefix: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(prefix)) return null;
  const openIdx = trimmed.indexOf('[');
  const closeIdx = trimmed.lastIndexOf(']');
  if (openIdx !== -1 && closeIdx > openIdx) {
    return trimmed.slice(openIdx + 1, closeIdx).trim();
  }
  return trimmed.slice(prefix.length).trim();
}

/**
 * Sidecar Lens: Deterministically translates dense Control-Plane BabelTele (BT-Skeleton)
 * messages into crystal-clear Chinese engineering explanations (< 1ms latency, 100% observability).
 */
export function decodeBabelTeleToZh(rawText: string): DecodedBabelTeleMessage {
  const raw = (rawText ?? '').trim();
  const tokens = countTokens(raw);

  const looksLikeBt =
    /^#(PRD|ARCH|DRAFT|HDR|DIAG|FIX|PASS|CONTRACT)\b/.test(raw) ||
    raw.includes('§SMFT') ||
    /[⟦⟧⟪⟫⇒⇐⊢⊥]/.test(raw) ||
    raw.includes('!Fail') ||
    raw.includes('!Guard');

  if (!looksLikeBt) {
    return {
      raw,
      isBabelTele: false,
      blockType: 'VERBOSE-NL',
      decodedZh: raw || '（空消息）',
      keyFields: [{ label: '通信模式', value: '传统自然语言 (Verbose NL)' }],
      tokens,
    };
  }

  const keyFields: Array<{ label: string; value: string }> = [];

  // 1. #PRD[...]
  const prdBody = unwrapBlock(raw, '#PRD');
  if (prdBody !== null) {
    const parts = prdBody.split(/\s*\|\s*/).filter(Boolean);
    const linesZh: string[] = ['【PM-Spec 巴别语需求骨架 → 中文透视】'];
    for (const part of parts) {
      const colon = part.indexOf(':');
      if (colon !== -1) {
        const key = part.slice(0, colon).trim().toLowerCase();
        const val = humanizeSegment(part.slice(colon + 1));
        const labelMap: Record<string, string> = {
          dom: '业务领域',
          proj: '项目名称',
          lang: '目标语言栈',
          goals: '核心能力矩阵',
          goal: '核心目标',
          inv: '强一致性/安全守卫',
          slo: '交付验收红线',
          arch: '架构风格',
        };
        const zhLabel = labelMap[key] ?? key.toUpperCase();
        keyFields.push({ label: zhLabel, value: val });
        linesZh.push(`• ${zhLabel}：${val}`);
      } else {
        linesZh.push(`• ${humanizeSegment(part)}`);
      }
    }
    return {
      raw,
      isBabelTele: true,
      blockType: 'PRD',
      decodedZh: linesZh.join('\n'),
      keyFields,
      tokens,
    };
  }

  // 2. #ARCH[...]
  const archBody = unwrapBlock(raw, '#ARCH');
  if (archBody !== null) {
    const rawLines = archBody
      .split(/\r?\n|;\s*(?=@FILE|@)/)
      .map((s) => s.trim())
      .filter(Boolean);
    const linesZh: string[] = ['【Architect 架构清单与跨文件接口契约 → 中文透视】'];
    for (const line of rawLines) {
      if (line.startsWith('@FILE:') || line.startsWith('@')) {
        const cleaned = humanizeSegment(line.replace(/^@FILE:/, '文件 '));
        linesZh.push(`• ${cleaned}`);
        const fMatch = line.match(/^@(?:FILE:)?([^\s|⊢]+)/);
        if (fMatch) {
          keyFields.push({ label: '锁定产物文件', value: fMatch[1] });
        }
      } else {
        linesZh.push(`• ${humanizeSegment(line)}`);
      }
    }
    return {
      raw,
      isBabelTele: true,
      blockType: 'ARCH',
      decodedZh: linesZh.join('\n'),
      keyFields,
      tokens,
    };
  }

  // 3. #DRAFT[...]
  const draftBody = unwrapBlock(raw, '#DRAFT');
  if (draftBody !== null) {
    const humanized = humanizeSegment(draftBody);
    const fileMatch = draftBody.match(/@([^\s⇐⊢|]+)/);
    if (fileMatch) {
      keyFields.push({ label: '当前生成文件', value: fileMatch[1] });
    }
    keyFields.push({ label: '平面隔离状态', value: '草稿留存于控制平面，源码产物 100% 纯净输出' });
    return {
      raw,
      isBabelTele: true,
      blockType: 'DRAFT',
      decodedZh: `【Coder 极速思维草稿 (<40 Tokens) → 中文透视】\n• ${humanized}\n• 隔离承诺：本草稿仅在控制平面流转，绝不写入磁盘源代码文件。`,
      keyFields,
      tokens,
    };
  }

  // 4. #DIAG[...] or !Fail
  const diagBody = unwrapBlock(raw, '#DIAG');
  if (diagBody !== null || raw.startsWith('!Fail')) {
    const content = diagBody ?? raw;
    const humanized = humanizeSegment(content);
    const locMatch = content.match(/@([^\s⊢|]+)/);
    if (locMatch) {
      keyFields.push({ label: '异常定位', value: locMatch[1] });
    }
    return {
      raw,
      isBabelTele: true,
      blockType: 'DIAG',
      decodedZh: `【Verifier 编译/纯净度故障诊断单 → 中文透视】\n• ${humanized}`,
      keyFields,
      tokens,
    };
  }

  // 5. #FIX[...]
  const fixBody = unwrapBlock(raw, '#FIX');
  if (fixBody !== null) {
    return {
      raw,
      isBabelTele: true,
      blockType: 'FIX',
      decodedZh: `【Fixer 自愈热补丁回执 → 中文透视】\n• ${humanizeSegment(fixBody)}`,
      keyFields: [{ label: '动作', value: '自愈热修复完成并重新送检' }],
      tokens,
    };
  }

  // 6. #PASS[...]
  const passBody = unwrapBlock(raw, '#PASS');
  if (passBody !== null) {
    const parts = passBody.split(/\s*\|\s*/).filter(Boolean);
    const linesZh = ['【Verifier 双平面验收通过战报 → 中文透视】'];
    for (const p of parts) {
      linesZh.push(`• ${humanizeSegment(p)}`);
    }
    return {
      raw,
      isBabelTele: true,
      blockType: 'PASS',
      decodedZh: linesZh.join('\n'),
      keyFields: [{ label: '双平面验收结果', value: '0 巴别语符号污染 & 原生编译通过' }],
      tokens,
    };
  }

  // 7. §SMFT or #HDR[...]
  if (raw.startsWith('§SMFT') || raw.startsWith('#HDR')) {
    const hdrLines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const linesZh = ['【SMFT 跨文件符号头文件记忆池 → 中文透视】'];
    for (const hl of hdrLines) {
      if (hl === '§SMFT[' || hl === ']') continue;
      const inner = unwrapBlock(hl, '#HDR') ?? hl;
      linesZh.push(`• ${humanizeSegment(inner)}`);
    }
    return {
      raw,
      isBabelTele: true,
      blockType: 'SMFT-HDR',
      decodedZh: linesZh.join('\n'),
      keyFields: [{ label: '记忆池类型', value: 'BT-Header 符号签名摘要 (~12% 原文件体积)' }],
      tokens,
    };
  }

  // 8. Generic BT-Skeleton fallback
  const fallbackLines = raw
    .split(/\r?\n/)
    .map((l) => `• ${humanizeSegment(l)}`)
    .join('\n');
  return {
    raw,
    isBabelTele: true,
    blockType: 'BT-MSG',
    decodedZh: `【巴别语控制流消息 → 中文透视】\n${fallbackLines}`,
    keyFields: [{ label: '编码协议', value: 'BT-Skeleton v1' }],
    tokens,
  };
}
