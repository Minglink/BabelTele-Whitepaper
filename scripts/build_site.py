#!/usr/bin/env python3
"""Static Site & AI-Search Optimization (SEO + GEO) Builder for BabelTele Whitepaper.

Pre-renders all 20 Chinese & English Markdown documents into semantic static HTML5 pages
with Schema.org JSON-LD, Google Scholar Highwire Press meta tags, OpenGraph/Twitter cards,
hreflang alternates, sitemap.xml, llms-full.txt, and search-index.json.
"""
import html as html_lib
import json
import os
import posixpath
import re
import subprocess

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SITE_BASE = "https://minglink.github.io/BabelTele-Whitepaper"
TODAY = "2026-11-17"

PAGES = [
    # Chinese Edition
    {
        "md": "README.md",
        "html": "index.html",
        "lang": "zh",
        "pair_html": "en/index.html",
        "nav_group": 0,
        "nav_title": "🏠 白皮书门户导览",
        "seo_title": "巴别语体系白皮书 (BabelTele Whitepaper · BT-Spec v1.0) — 面向硅基智能的模型原生高密度语义通信与记忆规范",
        "seo_desc": "巴别语（BabelTele / 巴别塔电报）官方体系白皮书（BT-Spec v1.0）：融汇 arXiv:2606.19857 实证成果，定义全语种词元寻优、关系图谱坍缩、零密码本自解释三大公理，MCP/A2A 五层协议栈、语义默克尔记忆折叠树（SMFT）与三层确定性安全审计网关。",
        "is_portal": True,
    },
    {
        "md": "WHITEPAPER.md",
        "html": "whitepaper.html",
        "lang": "zh",
        "pair_html": "en/whitepaper.html",
        "nav_group": 0,
        "nav_title": "📜 单文件完整典藏白皮书",
        "seo_title": "巴别语：一种模型原生的高密度语义通信与记忆体系（单卷完整版白皮书 · BT-Spec v1.0）",
        "seo_desc": "《巴别语（BabelTele）白皮书》单文件完整典藏版：涵盖人类可读性税、率失真三元解耦定理、三大基本公理、六大标准算子簇、四级压缩档位、MCP/A2A 载荷协议、语义默克尔记忆树与三层确定性审计网关。",
    },
    {
        "md": "docs/01-manifesto-and-problem.md",
        "html": "docs/01-manifesto-and-problem.html",
        "lang": "zh",
        "pair_html": "en/01-manifesto-and-problem.html",
        "nav_group": 1,
        "nav_title": "01 · 人类可读性税与巴别塔隐喻",
        "seo_title": "第一章：人类可读性税与巴别塔隐喻 — 巴别语白皮书 (BabelTele BT-Spec v1.0)",
        "seo_desc": "剖析自然语言语法缓冲冗余、MCP 与 A2A 协议之后的机器原生语义载荷空缺，以及巴别塔（Babel）与 1866 电报体（Telegraphese）在硅基大模型时代的双重隐喻。",
    },
    {
        "md": "docs/02-theoretical-foundations.md",
        "html": "docs/02-theoretical-foundations.html",
        "lang": "zh",
        "pair_html": "en/02-theoretical-foundations.html",
        "nav_group": 1,
        "nav_title": "02 · 信息论基础与解耦定理",
        "seo_title": "第二章：信息论基础与三元解耦定理 — 巴别语白皮书 (BabelTele BT-Spec v1.0)",
        "seo_desc": "建立可读性放宽的率失真语义投影方程，基于 Dale-Chall 评分与 8 款基座模型 PPL 暴涨 13-20 倍实证数据，证明人类可读性、自然语言典型性与模型语义可恢复性三元解耦（27.9% 长度维持 99.5% 保真）。",
    },
    {
        "md": "docs/03-core-axioms-and-grammar.md",
        "html": "docs/03-core-axioms-and-grammar.html",
        "lang": "zh",
        "pair_html": "en/03-core-axioms-and-grammar.html",
        "nav_group": 1,
        "nav_title": "03 · 三大公理与标准语法算子",
        "seo_title": "第三章：巴别语三大公理与标准语法算子规范 (BT-Spec v1.0) — 分词器悖论与六大算子簇",
        "seo_desc": "定义全语种词元熵最小化律、关系图谱坍缩律与零私有码本自解释律；通过 tiktoken (cl100k_base / o200k_base) 实测揭示朴素符号错觉（ΔL_BPE < 0），规范六大符号算子簇与光合作用/RFC 标准编码实例。",
    },
    {
        "md": "docs/04-compression-tiers-and-cot.md",
        "html": "docs/04-compression-tiers-and-cot.html",
        "lang": "zh",
        "pair_html": "en/04-compression-tiers-and-cot.html",
        "nav_group": 1,
        "nav_title": "04 · 四级压缩档位与认知税动力学",
        "seo_title": "第四章：四级压缩档位 (BT-L0~BT-L3) 与推理思维链 (CoT) 认知税动力学 — 巴别语白皮书",
        "seo_desc": "基于 4,714 题 116 组实验揭示模型原生压缩的空间-时间权衡定律、温和压缩 CoT 降噪加速效应、全生命周期成本摊销方程及 BT-L0 至 BT-L3 四级工程档位标准。",
    },
    {
        "md": "docs/05-agentic-protocol-stack.md",
        "html": "docs/05-agentic-protocol-stack.html",
        "lang": "zh",
        "pair_html": "en/05-agentic-protocol-stack.html",
        "nav_group": 1,
        "nav_title": "05 · 智能体协议栈与默克尔记忆树",
        "seo_title": "第五章：MCP/A2A/BabelTele 五层智能体协议栈与语义默克尔记忆折叠树 (SMFT) — 巴别语白皮书",
        "seo_desc": "规范 JSON-RPC babeltele/1.0 载荷信封头，实测异构多智能体通信节省 44.21% Token（保持 99.7% 得分），提出 T1-T3 语义默克尔记忆树与 1.65M 超长代码仓库分块扩窗方案。",
    },
    {
        "md": "docs/06-cross-model-consensus-and-audit.md",
        "html": "docs/06-cross-model-consensus-and-audit.html",
        "lang": "zh",
        "pair_html": "en/06-cross-model-consensus-and-audit.html",
        "nav_group": 1,
        "nav_title": "06 · 跨模型共识与三层安全审计",
        "seo_title": "第六章：19 款异构模型零样本共识规律与三层确定性安全审计网关 — 巴别语白皮书",
        "seo_desc": "解析 GPT-5.4、Claude、Gemini、DeepSeek、Qwen 跨模型传输矩阵规律，设计 Tier-1 字面硬锚点机检、Tier-2 异构盲测与语义护栏、Tier-3 人类旁路解码观测镜。",
    },
    {
        "md": "docs/07-canonical-instruction-set.md",
        "html": "docs/07-canonical-instruction-set.html",
        "lang": "zh",
        "pair_html": "en/07-canonical-instruction-set.html",
        "nav_group": 1,
        "nav_title": "07 · 标准编译与解码指令集",
        "seo_title": "第七章：巴别语标准压缩编译与还原解码 Prompt 指令集 (BT-Core / BT-P1~BT-P13) — 巴别语白皮书",
        "seo_desc": "开箱即用的中英双语巴别语压缩 Prompt 与无损还原解码 Prompt 模板库：涵盖通用标准编译器、Agent 记忆检查清单编译器、纯 ASCII 代码骨架编译器、零开销键值编译器及 BT-P1~BT-P13 全索引。",
    },
    {
        "md": "docs/08-genealogy-and-ecosystem.md",
        "html": "docs/08-genealogy-and-ecosystem.html",
        "lang": "zh",
        "pair_html": "en/08-genealogy-and-ecosystem.html",
        "nav_group": 1,
        "nav_title": "08 · 学术谱系、勘误与开源生态",
        "seo_title": "第八章：上下文压缩学术谱系对比、光合作用 OCR 勘误与全球开源生态全景 — 巴别语白皮书",
        "seo_desc": "横向对比 LLMLingua-2、Gist Tokens、Interlat、GibberLink 与巴别语，勘误网传光合作用符号 OCR 谬误，收录 6 大 GitHub 开源项目、3 份 Hugging Face 数据集与七步严谨评测规程。",
    },
    # English Edition
    {
        "md": "README_EN.md",
        "html": "en/index.html",
        "lang": "en",
        "pair_html": "index.html",
        "nav_group": 0,
        "nav_title": "🏠 Whitepaper Portal",
        "seo_title": "BabelTele Whitepaper (BT-Spec v1.0) — A Model-Native High-Density Semantic Communication & Memory System for LLMs",
        "seo_desc": "Official BabelTele System Whitepaper (BT-Spec v1.0): Synthesizing arXiv:2606.19857 into formal axioms, tokenizer-grounded symbolic grammar, BT-L0..L3 compression tiers, MCP/A2A payload envelopes, Semantic Merkle Folding Trees (SMFT), and a 3-Tier Safety Audit Gateway.",
        "is_portal": True,
    },
    {
        "md": "WHITEPAPER_EN.md",
        "html": "en/whitepaper.html",
        "lang": "en",
        "pair_html": "whitepaper.html",
        "nav_group": 0,
        "nav_title": "📜 Complete Single-File Whitepaper",
        "seo_title": "BabelTele: A Model-Native High-Density Semantic Communication and Memory System (Complete Canonical Whitepaper · BT-Spec v1.0)",
        "seo_desc": "Full 10-section canonical treatise of the BabelTele protocol (BT-Spec v1.0): Anthropocentric Readability Tax, Tripartite Decoupling Principle, Three Axioms, Six Operator Clusters, CoT Dynamics, MCP/A2A Stack, SMFT Memory, and Deterministic Auditing.",
    },
    {
        "md": "en/01-manifesto-and-problem.md",
        "html": "en/01-manifesto-and-problem.html",
        "lang": "en",
        "pair_html": "docs/01-manifesto-and-problem.html",
        "nav_group": 1,
        "nav_title": "01 · Manifesto & Readability Tax",
        "seo_title": "Chapter 01: The Anthropocentric Readability Tax & The Babel Metaphor — BabelTele Whitepaper (BT-Spec v1.0)",
        "seo_desc": "Why biological prose imposes a 60%–75% token tax on LLM-to-LLM communication, how BabelTele complements MCP and A2A channels, and the dual metaphor of Babel and 1866 Telegraphese.",
    },
    {
        "md": "en/02-theoretical-foundations.md",
        "html": "en/02-theoretical-foundations.html",
        "lang": "en",
        "pair_html": "docs/02-theoretical-foundations.html",
        "nav_group": 1,
        "nav_title": "02 · Information Theory & Decoupling",
        "seo_title": "Chapter 02: Information-Theoretical Foundations & Tripartite Decoupling — BabelTele Whitepaper (BT-Spec v1.0)",
        "seo_desc": "Rate-distortion semantic projection, 13x–20x base-model perplexity (PPL) diagnostics, Dale-Chall scores, and empirical proof of 99.5% semantic fidelity at 27.9% text volume.",
    },
    {
        "md": "en/03-core-axioms-and-grammar.md",
        "html": "en/03-core-axioms-and-grammar.html",
        "lang": "en",
        "pair_html": "docs/03-core-axioms-and-grammar.html",
        "nav_group": 1,
        "nav_title": "03 · Core Axioms & Grammar Spec",
        "seo_title": "Chapter 03: Three Core Axioms, Tokenizer BPE Paradox & Canonical Grammar (BT-Spec v1.0) — BabelTele Whitepaper",
        "seo_desc": "Formalizing Omnilingual Token Minimization (ΔL_BPE < 0 proved via tiktoken cl100k_base/o200k_base), Relational Graph Collapse, Zero-Codebook Invariance, and Six Canonical Operator Clusters.",
    },
    {
        "md": "en/04-compression-tiers-and-cot.md",
        "html": "en/04-compression-tiers-and-cot.html",
        "lang": "en",
        "pair_html": "docs/04-compression-tiers-and-cot.html",
        "nav_group": 1,
        "nav_title": "04 · Compression Tiers & CoT Dynamics",
        "seo_title": "Chapter 04: Standardized Compression Tiers (BT-L0 to BT-L3) & Chain-of-Thought Cognitive Dynamics — BabelTele Whitepaper",
        "seo_desc": "Space-time CoT trade-off across 116 experimental runs, mild-compression denoising acceleration (<1.0x CoT), full-lifecycle cost amortization formula, and BT-L0..BT-L3 operational tiers.",
    },
    {
        "md": "en/05-agentic-protocol-stack.md",
        "html": "en/05-agentic-protocol-stack.html",
        "lang": "en",
        "pair_html": "docs/05-agentic-protocol-stack.html",
        "nav_group": 1,
        "nav_title": "05 · Agentic Stack & Merkle Memory",
        "seo_title": "Chapter 05: Five-Layer MCP/A2A/BabelTele Protocol Stack & Semantic Merkle Folding Tree (SMFT) — BabelTele Whitepaper",
        "seo_desc": "JSON-RPC babeltele/1.0 envelope specification, 44.21% token savings in heterogeneous multi-agent communication, SMFT T1-T3 memory pruning, and 1.65M-token codebase context extension.",
    },
    {
        "md": "en/06-cross-model-consensus-and-audit.md",
        "html": "en/06-cross-model-consensus-and-audit.html",
        "lang": "en",
        "pair_html": "docs/06-cross-model-consensus-and-audit.html",
        "nav_group": 1,
        "nav_title": "06 · Cross-Model & Audit Gateway",
        "seo_title": "Chapter 06: Zero-Shot Cross-Model Portability & Three-Tier Deterministic Safety Audit Gateway — BabelTele Whitepaper",
        "seo_desc": "Portability across 19 proprietary and open-weight LLMs, dense vs. sparse MoE scaling, and Tier 1–3 deterministic anchor verification, semantic guardrails, and human Sidecar Decoders.",
    },
    {
        "md": "en/07-canonical-instruction-set.md",
        "html": "en/07-canonical-instruction-set.html",
        "lang": "en",
        "pair_html": "docs/07-canonical-instruction-set.html",
        "nav_group": 1,
        "nav_title": "07 · Canonical Compiler Prompts",
        "seo_title": "Chapter 07: Official BabelTele Compression & Lossless Decoder Prompts (BT-Core / BT-P1 to BT-P13) — BabelTele Whitepaper",
        "seo_desc": "Production copy-paste system prompts for LLM-native compression and lossless human-audit decoding: BT-Core, BT-Memory, BT-Skeleton (pure ASCII), BT-Zero, BT-Decoder, and BT-P1..P13 index.",
    },
    {
        "md": "en/08-genealogy-and-ecosystem.md",
        "html": "en/08-genealogy-and-ecosystem.html",
        "lang": "en",
        "pair_html": "docs/08-genealogy-and-ecosystem.html",
        "nav_group": 1,
        "nav_title": "08 · Genealogy, Errata & Ecosystem",
        "seo_title": "Chapter 08: Context Compression Taxonomy, Empirical Errata & Global Open-Source Ecosystem — BabelTele Whitepaper",
        "seo_desc": "Comparing LLMLingua-2, Gist Tokens, Interlat, GibberLink, and BabelTele; primary-source errata on photosynthesis OCR; 6 GitHub tools; 3 Hugging Face datasets; and 7-step eval protocol.",
    },
]

MD_TO_HTML = {p["md"]: p["html"] for p in PAGES}
HTML_TO_PAGE = {p["html"]: p for p in PAGES}


def rel_url(from_html, to_html):
    from_dir = posixpath.dirname(from_html)
    rel = posixpath.relpath(to_html, from_dir if from_dir else ".")
    return rel


def resolve_md_link(current_md, current_html, href):
    if not href or href.startswith(("http://", "https://", "mailto:", "#", "javascript:")):
        return href, href.startswith(("http://", "https://"))
    path_part, _, frag = href.partition("#")
    base_dir = posixpath.dirname(current_md)
    norm = posixpath.normpath(posixpath.join(base_dir, path_part)) if base_dir else posixpath.normpath(path_part)
    if norm == "LICENSE":
        return "https://github.com/Minglink/BabelTele-Whitepaper/blob/main/LICENSE", True
    if norm == "CITATION.cff":
        return "https://github.com/Minglink/BabelTele-Whitepaper/blob/main/CITATION.cff", True
    if norm in MD_TO_HTML:
        r = rel_url(current_html, MD_TO_HTML[norm])
        return (f"{r}#{frag}" if frag else r), False
    return href, False


def render_inline(text, current_md, current_html):
    stash = []
    def put(h):
        k = f"\x00INL{len(stash)}\x00"
        stash.append(h)
        return k

    # 1. Inline code
    def repl_code(m):
        c = m.group(1).replace(r"\|", "|")
        return put(f"<code>{html_lib.escape(c)}</code>")
    text = re.sub(r"`([^`\n]+)`", repl_code, text)

    # 2. Inline math $...$
    def repl_math(m):
        tex = m.group(1)
        return put(f'<span class="math-inline">${html_lib.escape(tex)}$</span>')
    text = re.sub(r"(?<!\$)\$(?!\s)([^\$\n]+?)(?<!\s)\$(?!\$)", repl_math, text)

    # 3. Preserve raw inline HTML tags like <br>, <sub>, <b>, <a>, <code>
    def repl_raw_tag(m):
        return put(m.group(0))
    text = re.sub(r"</?(?:br|sub|sup|b|strong|i|em|u|kbd|span)(?:\s[^>]*)?>", repl_raw_tag, text, flags=re.I)

    # Escape remaining HTML chars
    text = html_lib.escape(text, quote=False)

    # 4. Linked badge images [![alt](img)](url)
    def repl_linked_img(m):
        alt, img_src, link_href = m.group(1), m.group(2), m.group(3)
        u, ext = resolve_md_link(current_md, current_html, link_href)
        target = ' target="_blank" rel="noopener"' if ext else ""
        return put(f'<a href="{u}"{target}><img src="{img_src}" alt="{html_lib.escape(alt, True)}" /></a>')
    text = re.sub(r"\[\!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)", repl_linked_img, text)

    # 5. Standalone images ![alt](src)
    def repl_img(m):
        alt, src = m.group(1), m.group(2)
        if not re.match(r"(?:[a-z][a-z0-9+.-]*:|/|#)", src, flags=re.I):
            source_path = posixpath.normpath(posixpath.join(posixpath.dirname(current_md), src))
            src = rel_url(current_html, source_path)
        return put(f'<img src="{src}" alt="{html_lib.escape(alt, True)}" />')
    text = re.sub(r"\!\[([^\]]*)\]\(([^)]+)\)", repl_img, text)

    # 6. Links [label](href)
    def repl_link(m):
        label, href = m.group(1), m.group(2)
        u, ext = resolve_md_link(current_md, current_html, href)
        target = ' target="_blank" rel="noopener"' if ext else ""
        # Render formatting inside label
        lbl_html = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", label)
        lbl_html = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", lbl_html)
        return put(f'<a href="{u}"{target}>{lbl_html}</a>')
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", repl_link, text)

    # 7. Bare URLs
    def repl_bare_url(m):
        u = m.group(1)
        return put(f'<a href="{u}" target="_blank" rel="noopener">{u}</a>')
    text = re.sub(r"(?<![\"'>=])(https?://[^\s<)\]]+)", repl_bare_url, text)

    # 8. Bold & Italic
    text = re.sub(r"\*\*([^\n*]+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![*\w])\*([^\s*][^\n*]*?)\*(?![*\w])", r"<em>\1</em>", text)

    for idx, val in enumerate(stash):
        text = text.replace(f"\x00INL{idx}\x00", val)
    return text


def split_table_row(line):
    # Protect \| inside inline code or cells before splitting on |
    protected = line.strip().replace(r"\|", "\x01PIPE\x01")
    if protected.startswith("|"):
        protected = protected[1:]
    if protected.endswith("|"):
        protected = protected[:-1]
    cells = [c.strip().replace("\x01PIPE\x01", r"\|") for c in protected.split("|")]
    return cells


def render_blocks(lines, current_md, current_html, headings_out):
    out = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # Raw HTML structural lines (<div...>, </div>, <details...>, </details>, <summary>...</summary>)
        if re.match(r"^</?(?:div|details|summary)(?:\s|>|$)", stripped, flags=re.I):
            out.append(line)
            i += 1
            continue

        # Horizontal rule
        if re.match(r"^-{3,}\s*$", stripped):
            out.append("<hr />")
            i += 1
            continue

        # Fenced code block
        m_fence = re.match(r"^```(\w*)\s*$", stripped)
        if m_fence:
            lang = m_fence.group(1).strip()
            i += 1
            buf = []
            while i < n and not re.match(r"^```\s*$", lines[i].strip()):
                buf.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            code_raw = "\n".join(buf)
            esc = html_lib.escape(code_raw)
            if lang.lower() == "mermaid":
                out.append(f'<div class="mermaid-box"><pre class="mermaid">{esc}</pre></div>')
            else:
                cls = f' class="language-{lang}"' if lang else ""
                out.append(f'<div class="code-wrapper"><button class="copy-btn" onclick="copyCode(this)">Copy</button><pre><code{cls}>{esc}</code></pre></div>')
            continue

        # Display math $$...$$
        if stripped.startswith("$$"):
            if stripped.endswith("$$") and len(stripped) > 4:
                tex = stripped[2:-2].strip()
                out.append(f'<div class="math-display">$${html_lib.escape(tex)}$$</div>')
                i += 1
                continue
            buf = [stripped[2:]]
            i += 1
            while i < n and not lines[i].strip().endswith("$$"):
                buf.append(lines[i])
                i += 1
            if i < n:
                buf.append(lines[i].strip()[:-2])
                i += 1
            tex = "\n".join(buf).strip()
            out.append(f'<div class="math-display">$${html_lib.escape(tex)}$$</div>')
            continue

        # Headings #..####
        m_h = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if m_h:
            lvl = len(m_h.group(1))
            raw_t = m_h.group(2).strip()
            hid = f"sec-{len(headings_out)}"
            inline_h = render_inline(raw_t, current_md, current_html)
            plain_t = re.sub(r"<[^>]+>", "", inline_h)
            if lvl in (2, 3):
                headings_out.append((lvl, hid, plain_t))
            out.append(f'<h{lvl} id="{hid}">{inline_h}</h{lvl}>')
            i += 1
            continue

        # Blockquote / GitHub Alert (> ...)
        if stripped.startswith(">"):
            bq_lines = []
            while i < n and lines[i].strip().startswith(">"):
                sub = re.sub(r"^\s*>\s?", "", lines[i])
                bq_lines.append(sub)
                i += 1
            m_alert = re.match(r"^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$", bq_lines[0].strip(), flags=re.I)
            icons = {
                "note": "ℹ️ Note",
                "tip": "💡 Tip",
                "important": "💠 Important",
                "warning": "⚠️ Warning",
                "caution": "🛡️ Caution",
            }
            if m_alert:
                kind = m_alert.group(1).lower()
                inner_html = render_blocks(bq_lines[1:], current_md, current_html, headings_out)
                out.append(f'<div class="gh-alert gh-alert-{kind}"><div class="gh-alert-title">{icons[kind]}</div>{inner_html}</div>')
            else:
                inner_html = render_blocks(bq_lines, current_md, current_html, headings_out)
                out.append(f"<blockquote>{inner_html}</blockquote>")
            continue

        # GFM Table
        if "|" in stripped and i + 1 < n and re.match(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$", lines[i + 1].strip()):
            headers = split_table_row(lines[i])
            aligns_raw = split_table_row(lines[i + 1])
            aligns = []
            for a in aligns_raw:
                if a.startswith(":") and a.endswith(":"):
                    aligns.append(' style="text-align:center"')
                elif a.endswith(":"):
                    aligns.append(' style="text-align:right"')
                else:
                    aligns.append("")
            i += 2
            rows = []
            while i < n and "|" in lines[i] and lines[i].strip() and not lines[i].strip().startswith("#"):
                rows.append(split_table_row(lines[i]))
                i += 1
            th_html = "".join(
                f"<th{aligns[idx] if idx < len(aligns) else ''}>{render_inline(h, current_md, current_html)}</th>"
                for idx, h in enumerate(headers)
            )
            body_rows = []
            for r in rows:
                tds = "".join(
                    f"<td{aligns[idx] if idx < len(aligns) else ''}>{render_inline(c, current_md, current_html)}</td>"
                    for idx, c in enumerate(r)
                )
                body_rows.append(f"<tr>{tds}</tr>")
            out.append(f'<div class="table-wrap"><table><thead><tr>{th_html}</tr></thead><tbody>{"".join(body_rows)}</tbody></table></div>')
            continue

        # Lists (ul / ol)
        m_ul = re.match(r"^(\s*)[*+-]\s+(.+)$", line)
        m_ol = re.match(r"^(\s*)\d+\.\s+(.+)$", line)
        if m_ul or m_ol:
            is_ol = bool(m_ol)
            tag = "ol" if is_ol else "ul"
            items = []
            while i < n:
                l_cur = lines[i]
                if not l_cur.strip():
                    i += 1
                    break
                m_item = re.match(r"^(\s*)(?:\d+\.|[*+-])\s+(.+)$", l_cur)
                if m_item and len(m_item.group(1)) == 0:
                    item_buf = [render_inline(m_item.group(2).strip(), current_md, current_html)]
                    i += 1
                    sub_items = []
                    while i < n and lines[i].strip():
                        m_sub = re.match(r"^\s{2,}(?:\d+\.|[*+-])\s+(.+)$", lines[i])
                        if m_sub:
                            sub_items.append(f"<li>{render_inline(m_sub.group(1).strip(), current_md, current_html)}</li>")
                            i += 1
                        elif lines[i].startswith("  ") and not re.match(r"^(\s*)(?:\d+\.|[*+-])\s+", lines[i]):
                            item_buf.append(render_inline(lines[i].strip(), current_md, current_html))
                            i += 1
                        else:
                            break
                    sub_html = f"<ul>{''.join(sub_items)}</ul>" if sub_items else ""
                    items.append(f"<li>{' '.join(item_buf)}{sub_html}</li>")
                else:
                    break
            out.append(f"<{tag}>{''.join(items)}</{tag}>")
            continue

        # Regular paragraph
        p_buf = [stripped]
        i += 1
        while i < n:
            nxt = lines[i].strip()
            if (not nxt or nxt.startswith(("#", ">", "```", "$$", "---"))
                    or re.match(r"^</?(?:div|details|summary)", nxt, flags=re.I)
                    or re.match(r"^(?:\d+\.|[*+-])\s+", nxt)
                    or ("|" in nxt and i + 1 < n and re.match(r"^\|?\s*:?-{3,}", lines[i + 1].strip()))):
                break
            p_buf.append(nxt)
            i += 1
        out.append(f"<p>{render_inline(' '.join(p_buf), current_md, current_html)}</p>")

    return "\n".join(out)


FAQ_ZH = [
    ("什么是巴别语（BabelTele / 巴别塔电报 / 巴别电报）？",
     "巴别语（BabelTele，又称巴别塔电报）是一类面向大语言模型（LLM）而非人类阅读优化的模型原生高密度离散文本表示。该现象最初由上海交通大学、悉尼大学、合肥工业大学、西安交通大学、南京大学团队在论文 arXiv:2606.19857 中实证提出；本白皮书正式构建了标准化的巴别语协议体系（BT-Spec v1.0），包含三大公理、六大算子簇、四级压缩档位（BT-L0~BT-L3）、语义默克尔记忆折叠树（SMFT）与三层确定性安全审计网关。"),
    ("巴别语（BabelTele）与 MCP 协议、A2A 协议是什么关系？",
     "二者是上下层互补协同关系而非替代关系。MCP 负责纵向连接外部工具与数据源，A2A 负责横向智能体发现与任务路由（传输与信令管道）；巴别语（content_encoding: babeltele/1.0）位于第 4 层语义载荷层，在保持外层协议不变的前提下将内部消息压缩 40%–75%。"),
    ("用汉字、数学符号和 Emoji 替换英文单词一定更省 Token 吗？",
     "不一定，必须遵循 BT-Spec v1.0 的分词器净收益不等式（ΔL_BPE < 0）。tiktoken（cl100k_base / o200k_base）实测表明孤立将 water（1 token）、and（1 token）换为 💧（2 tokens）、∧（2 tokens）反而因多字节回退膨胀。真正的 3–4 倍压缩来自整句从句语法骨架坍缩与单 Token ASCII 算子（->, =>, &, ?, !, @）优先策略。"),
    ("AI 智能体用不可读的巴别语通信，如何防止数值幻觉与安全失控？",
     "BT-Spec v1.0 配套三层确定性安全审计网关：Tier-1 用正则在 2ms 内逐位核验全部数字、单位、公式与标识符；Tier-2 用支持零样本直读巴别语的轻量语义护栏模型拦截指令注入；Tier-3 在人类运维面板挂载旁路无损解码器（BT-Decoder）按需还原母语视图。"),
]

FAQ_EN = [
    ("What is BabelTele (巴别语 / 巴别塔电报 / Babel-Telegraph)?",
     "BabelTele is a model-native, high-density discrete textual representation paradigm optimized for LLM-to-LLM communication and memory rather than human readability. Originating from empirical findings in arXiv:2606.19857, The BabelTele System (BT-Spec v1.0) formalizes three axioms, six symbolic operator clusters, four compression tiers (BT-L0 to BT-L3), Semantic Merkle Folding Trees (SMFT), and a Three-Tier Deterministic Safety Audit Gateway."),
    ("Does BabelTele replace MCP (Model Context Protocol) or A2A (Agent-to-Agent Protocol)?",
     "No—they operate at complementary layers. MCP handles vertical tool/context binding and A2A handles horizontal agent discovery and task routing; BabelTele (content_encoding: babeltele/1.0) serves as the Layer-4 high-density semantic payload inside MCP and A2A messages, cutting token overhead by 40%–75%."),
    ("Do emojis, math symbols, and CJK characters always cost fewer BPE tokens than English words?",
     "No. Empirical tiktoken (cl100k_base / o200k_base) measurements show swapping 1-token words like 'water' or 'and' into '💧' or '∧' inflates count to 2 tokens via UTF-8 byte splitting. BT-Spec v1.0 enforces ΔL_BPE < 0: true compression comes from clause-level syntactic collapse and 1-token ASCII operators (->, =>, &, ?, !, @)."),
    ("How do humans audit safety and prevent numeric hallucinations over unreadable BabelTele payloads?",
     "BT-Spec v1.0 mandates a Three-Tier Audit Gateway: Tier-1 runs <2ms regex verification ensuring bit-exact conservation of numbers, units, formulas, and identifiers; Tier-2 runs zero-shot LLM semantic guardrails against prompt injection; Tier-3 provides an on-demand lossless Sidecar Decoder (BT-Decoder) for human inspection."),
]


def build_json_ld(page, canonical_url, pdf_url):
    is_zh = page["lang"] == "zh"
    graph = [
        {
            "@type": "WebSite",
            "@id": f"{SITE_BASE}/#website",
            "url": f"{SITE_BASE}/",
            "name": "BabelTele Whitepaper · 巴别语体系白皮书 (BT-Spec v1.0)",
            "alternateName": ["巴别语白皮书", "巴别塔电报白皮书", "BabelTele Specification", "BT-Spec v1.0"],
            "inLanguage": ["zh-CN", "en"],
        },
        {
            "@type": "ScholarlyArticle",
            "@id": f"{canonical_url}#article",
            "headline": page["seo_title"],
            "alternativeHeadline": "BabelTele: A Model-Native High-Density Semantic Communication and Memory System (BT-Spec v1.0) / 巴别语体系白皮书",
            "description": page["seo_desc"],
            "inLanguage": "zh-CN" if is_zh else "en",
            "datePublished": TODAY,
            "dateModified": TODAY,
            "version": "1.0.0",
            "license": "https://creativecommons.org/licenses/by/4.0/",
            "url": canonical_url,
            "mainEntityOfPage": canonical_url,
            "image": f"{SITE_BASE}/assets/og-card.png",
            "author": {
                "@type": "Person",
                "name": "MingLin",
                "alternateName": "Minglink",
                "url": "https://github.com/Minglink",
            },
            "publisher": {
                "@type": "Organization",
                "name": "BabelTele Open Specification Project",
                "url": "https://github.com/Minglink/BabelTele-Whitepaper",
            },
            "encoding": {
                "@type": "MediaObject",
                "contentUrl": pdf_url,
                "encodingFormat": "application/pdf",
            },
            "citation": {
                "@type": "ScholarlyArticle",
                "name": "Large Language Models Do Not Always Need Readable Language",
                "identifier": "arXiv:2606.19857",
                "url": "https://arxiv.org/abs/2606.19857",
                "sameAs": "https://doi.org/10.48550/arXiv.2606.19857",
            },
            "keywords": [
                "BabelTele", "巴别语", "巴别塔电报", "巴别电报", "BT-Spec v1.0",
                "AI原生语言", "LLM-Native Language", "Model-Native Representation",
                "Prompt Compression", "Context Compression", "arXiv:2606.19857",
                "MCP", "Model Context Protocol", "A2A", "Agent-to-Agent Protocol",
                "Multi-Agent Communication", "Agent Memory", "Semantic Merkle Folding Tree"
            ],
        },
    ]
    if page.get("is_portal"):
        faqs = FAQ_ZH if is_zh else FAQ_EN
        graph.append({
            "@type": "FAQPage",
            "@id": f"{canonical_url}#faq",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": q,
                    "acceptedAnswer": {"@type": "Answer", "text": a},
                }
                for q, a in faqs
            ],
        })
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)


PAGE_SHELL = r"""<!DOCTYPE html>
<html lang="__HTML_LANG__" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>__SEO_TITLE__</title>
  <meta name="description" content="__SEO_DESC__" />
  <meta name="keywords" content="BabelTele, 巴别语, 巴别塔电报, 巴别电报, BT-Spec v1.0, AI原生语言, 模型原生语言, AI涌现语言, LLM-Native Language, Model-Native Representation, Prompt Compression, Context Compression, arXiv:2606.19857, Large Language Models Do Not Always Need Readable Language, 大语言模型并不总是需要可读语言, MCP, Model Context Protocol, A2A, Agent-to-Agent, Multi-Agent Systems, Agent Memory, Semantic Merkle Folding Tree, MingLin, Minglink" />
  <meta name="author" content="MingLin (@Minglink)" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />

  <!-- Canonical & Bilingual Hreflang -->
  <link rel="canonical" href="__CANONICAL_URL__" />
  <link rel="alternate" hreflang="zh-CN" href="__ZH_URL__" />
  <link rel="alternate" hreflang="en" href="__EN_URL__" />
  <link rel="alternate" hreflang="x-default" href="__SITE_BASE__/" />

  <!-- AI Agent & LLM Ingestion Discovery Links -->
  <link rel="alternate" type="text/plain" title="LLMs.txt Structured Index" href="__SITE_BASE__/llms.txt" />
  <link rel="alternate" type="text/plain" title="LLMs Full Whitepaper Corpus" href="__SITE_BASE__/llms-full.txt" />
  <link rel="alternate" type="text/plain" title="Native BabelTele Digest" href="__SITE_BASE__/llms-bt.txt" />

  <!-- Google Scholar / Semantic Scholar / Academic Grounding Meta Tags -->
  <meta name="citation_title" content="__SEO_TITLE__" />
  <meta name="citation_author" content="MingLin" />
  <meta name="citation_publication_date" content="2026/11/17" />
  <meta name="citation_online_date" content="2026/11/17" />
  <meta name="citation_pdf_url" content="__PDF_URL__" />
  <meta name="citation_fulltext_html_url" content="__CANONICAL_URL__" />
  <meta name="citation_language" content="__HTML_LANG__" />
  <meta name="citation_keywords" content="BabelTele; 巴别语; 巴别塔电报; BT-Spec v1.0; LLM-Native Representation; Prompt Compression; MCP; A2A; arXiv:2606.19857" />

  <!-- OpenGraph & Twitter Card -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="BabelTele Whitepaper · 巴别语体系白皮书" />
  <meta property="og:title" content="__SEO_TITLE__" />
  <meta property="og:description" content="__SEO_DESC__" />
  <meta property="og:url" content="__CANONICAL_URL__" />
  <meta property="og:image" content="__SITE_BASE__/assets/og-card.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="__OG_LOCALE__" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="__SEO_TITLE__" />
  <meta name="twitter:description" content="__SEO_DESC__" />
  <meta name="twitter:image" content="__SITE_BASE__/assets/og-card.png" />

  <!-- Schema.org Structured Data (JSON-LD) -->
  <script type="application/ld+json">
__JSON_LD__
  </script>

  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css" id="hljs-theme" />
  <link rel="stylesheet" href="__ASSET_PREFIX__assets/style.css" />
</head>
<body>
  <header class="topbar">
    <div style="display:flex;align-items:center;gap:10px;">
      <button class="menu-btn" id="menuToggle" aria-label="Menu">☰</button>
      <a class="brand" href="__HOME_HREF__">
        <span>🗼 BabelTele Whitepaper</span>
        <span class="brand-badge">BT-Spec v1.0</span>
      </a>
    </div>
    <div class="top-actions">
      <div class="search-box">
        <input type="search" class="search-input" id="searchInput" placeholder="__SEARCH_PLACEHOLDER__" autocomplete="off" />
        <div class="search-dropdown" id="searchDropdown"></div>
      </div>
      <a class="btn-pill" href="__PAIR_HREF__" title="Switch Language">__LANG_BTN_LABEL__</a>
      <a class="btn-pill" href="__ASSET_PREFIX__llms.txt" title="AI-Readable Index (llms.txt)">🤖 llms.txt</a>
      <a class="btn-pill btn-primary" href="__PDF_URL__" target="_blank" rel="noopener">__PDF_BTN_LABEL__</a>
      <button class="btn-pill" id="themeToggle" title="Toggle Dark/Light Theme">🌙</button>
      <a class="btn-pill" href="https://github.com/Minglink/BabelTele-Whitepaper" target="_blank" rel="noopener">GitHub ↗</a>
    </div>
  </header>

  <div class="layout">
    <nav class="sidebar" id="sidebar" aria-label="Chapter Navigation">
__SIDEBAR_HTML__
    </nav>
    <main class="main-wrap">
      <article class="article" id="article">
__ARTICLE_HTML__
__PAGER_HTML__
      </article>
    </main>
    <aside class="toc-aside" id="tocAside" aria-label="On This Page">
      <div class="toc-heading">__TOC_HEADING__</div>
      <div id="tocList">
__TOC_HTML__
      </div>
    </aside>
  </div>

  <script>window.__ASSET_PREFIX__ = "__ASSET_PREFIX__"; window.__PAGE_LANG__ = "__LANG_SHORT__";</script>
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
  <script src="__ASSET_PREFIX__assets/reader.js"></script>
</body>
</html>
"""

STYLE_CSS = """
:root {
  --bg: #ffffff;
  --bg-sidebar: #f8fafc;
  --bg-elevated: #f1f5f9;
  --bg-code: #f6f8fa;
  --text: #0f172a;
  --text-muted: #475569;
  --text-faint: #64748b;
  --border: #e2e8f0;
  --accent: #2563eb;
  --accent-soft: rgba(37, 99, 235, 0.1);
  --header-h: 60px;
  --sidebar-w: 292px;
  --toc-w: 236px;
}
[data-theme="dark"] {
  --bg: #0b1120;
  --bg-sidebar: #0f172a;
  --bg-elevated: #1e293b;
  --bg-code: #131c2e;
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --text-faint: #64748b;
  --border: #1e293b;
  --accent: #60a5fa;
  --accent-soft: rgba(96, 165, 250, 0.14);
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  line-height: 1.72; -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.topbar {
  position: fixed; top: 0; left: 0; right: 0; height: var(--header-h);
  background: var(--bg); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; z-index: 100;
}
.brand {
  display: flex; align-items: center; gap: 10px;
  font-weight: 700; font-size: 16px; color: var(--text); text-decoration: none !important;
}
.brand-badge {
  font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 999px;
  background: var(--accent-soft); color: var(--accent); border: 1px solid rgba(37, 99, 235, 0.25);
}
.menu-btn {
  display: none; background: transparent; border: 1px solid var(--border);
  color: var(--text); border-radius: 6px; padding: 5px 9px; cursor: pointer; font-size: 16px;
}
.top-actions { display: flex; align-items: center; gap: 8px; }
.search-box { position: relative; display: flex; align-items: center; }
.search-input {
  width: 200px; padding: 6px 12px; border-radius: 7px;
  border: 1px solid var(--border); background: var(--bg-sidebar);
  color: var(--text); font-size: 13px; outline: none; transition: border-color 0.15s, width 0.2s;
}
.search-input:focus { border-color: var(--accent); width: 250px; }
.search-dropdown {
  position: absolute; top: 38px; right: 0; width: 350px; max-height: 380px;
  overflow-y: auto; background: var(--bg); border: 1px solid var(--border);
  border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.18);
  display: none; z-index: 200; padding: 6px;
}
.search-item {
  display: block; padding: 8px 10px; border-radius: 6px;
  color: var(--text) !important; text-decoration: none !important;
  font-size: 13px; border-bottom: 1px solid var(--border);
}
.search-item:last-child { border-bottom: none; }
.search-item:hover { background: var(--accent-soft); }
.search-item-title { font-weight: 600; color: var(--accent); margin-bottom: 2px; }
.search-item-snip { font-size: 12px; color: var(--text-muted); }
.btn-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px; border-radius: 7px; font-size: 13px; font-weight: 500;
  border: 1px solid var(--border); background: var(--bg-sidebar);
  color: var(--text) !important; cursor: pointer; text-decoration: none !important;
}
.btn-pill:hover { border-color: var(--accent); color: var(--accent) !important; }
.btn-primary { background: var(--accent); color: #fff !important; border-color: var(--accent); }
.btn-primary:hover { opacity: 0.92; color: #fff !important; }
.layout { display: flex; padding-top: var(--header-h); min-height: 100vh; }
.sidebar {
  position: fixed; top: var(--header-h); bottom: 0; left: 0; width: var(--sidebar-w);
  background: var(--bg-sidebar); border-right: 1px solid var(--border);
  overflow-y: auto; padding: 20px 14px 40px; z-index: 90;
}
.nav-group-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-faint); margin: 18px 10px 6px;
}
.nav-group-title:first-child { margin-top: 4px; }
.nav-link {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 7px;
  font-size: 13.5px; color: var(--text-muted) !important; text-decoration: none !important; margin-bottom: 2px;
}
.nav-link:hover { background: var(--bg-elevated); color: var(--text) !important; }
.nav-link.active { background: var(--accent-soft); color: var(--accent) !important; font-weight: 600; }
.main-wrap {
  flex: 1; margin-left: var(--sidebar-w); margin-right: var(--toc-w);
  display: flex; justify-content: center;
}
.article { width: 100%; max-width: 860px; padding: 38px 44px 80px; min-width: 0; }
.toc-aside {
  position: fixed; top: var(--header-h); right: 0; bottom: 0; width: var(--toc-w);
  padding: 28px 16px 40px 12px; overflow-y: auto; border-left: 1px solid var(--border); font-size: 12.5px;
}
.toc-heading {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-faint); margin-bottom: 10px;
}
.toc-item {
  display: block; padding: 4px 0 4px 8px; color: var(--text-muted) !important;
  text-decoration: none !important; border-left: 2px solid transparent; line-height: 1.4;
}
.toc-item.toc-h3 { padding-left: 20px; font-size: 12px; }
.toc-item:hover { color: var(--accent) !important; border-left-color: var(--accent); }
.article h1 { font-size: 2rem; line-height: 1.28; margin: 0 0 18px; letter-spacing: -0.02em; }
.article h2 { font-size: 1.42rem; margin: 40px 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.article h3 { font-size: 1.15rem; margin: 28px 0 10px; }
.article p { margin: 0 0 16px; }
.article ul, .article ol { margin: 0 0 16px; padding-left: 24px; }
.article li { margin-bottom: 6px; }
.article hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }
.article img { max-width: 100%; height: auto; border-radius: 6px; }
.article code {
  font-family: "JetBrains Mono", "Cascadia Code", Consolas, monospace;
  font-size: 0.88em; background: var(--bg-code); padding: 2px 6px; border-radius: 5px; border: 1px solid var(--border);
}
.code-wrapper { position: relative; margin: 16px 0 22px; }
.article pre {
  background: var(--bg-code); border: 1px solid var(--border);
  border-radius: 9px; padding: 16px 18px; overflow-x: auto; margin: 0; line-height: 1.55;
}
.article pre code { background: none; border: none; padding: 0; font-size: 13px; }
.copy-btn {
  position: absolute; top: 8px; right: 8px; font-size: 11.5px; padding: 4px 9px;
  border-radius: 5px; border: 1px solid var(--border); background: var(--bg);
  color: var(--text-muted); cursor: pointer; opacity: 0.85;
}
.copy-btn:hover { opacity: 1; border-color: var(--accent); color: var(--accent); }
.table-wrap { overflow-x: auto; margin: 18px 0 24px; }
.article table { width: 100%; border-collapse: collapse; font-size: 13.8px; }
.article th, .article td { border: 1px solid var(--border); padding: 9px 13px; text-align: left; vertical-align: top; }
.article th { background: var(--bg-sidebar); font-weight: 600; }
.article tr:nth-child(even) td { background: rgba(148, 163, 184, 0.04); }
.article blockquote {
  margin: 16px 0; padding: 10px 16px; border-left: 4px solid var(--border);
  background: var(--bg-sidebar); color: var(--text-muted); border-radius: 0 8px 8px 0;
}
.gh-alert { margin: 20px 0; padding: 14px 18px; border-radius: 8px; border-left: 4px solid; background: var(--bg-sidebar); }
.gh-alert-title { font-weight: 700; font-size: 13.5px; display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
.gh-alert p:last-child, .gh-alert ul:last-child, .gh-alert ol:last-child { margin-bottom: 0; }
.gh-alert-note { border-left-color: #3b82f6; } .gh-alert-note .gh-alert-title { color: #3b82f6; }
.gh-alert-tip { border-left-color: #10b981; } .gh-alert-tip .gh-alert-title { color: #10b981; }
.gh-alert-important { border-left-color: #8b5cf6; } .gh-alert-important .gh-alert-title { color: #8b5cf6; }
.gh-alert-warning { border-left-color: #f59e0b; } .gh-alert-warning .gh-alert-title { color: #f59e0b; }
.gh-alert-caution { border-left-color: #ef4444; } .gh-alert-caution .gh-alert-title { color: #ef4444; }
.mermaid-box {
  margin: 22px 0; padding: 18px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg-sidebar); text-align: center; overflow-x: auto;
}
.katex-display, .math-display { overflow-x: auto; overflow-y: hidden; padding: 8px 0; text-align: center; }
details { margin: 14px 0; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-sidebar); }
summary { cursor: pointer; font-weight: 600; }
.pager {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  margin-top: 52px; padding-top: 24px; border-top: 1px solid var(--border);
}
.pager-card {
  display: block; padding: 14px 18px; border: 1px solid var(--border);
  border-radius: 10px; text-decoration: none !important;
}
.pager-card:hover { border-color: var(--accent); background: var(--accent-soft); }
.pager-card.next { text-align: right; }
.pager-label { font-size: 11.5px; color: var(--text-faint); margin-bottom: 4px; }
.pager-title { font-size: 14px; font-weight: 600; color: var(--accent); }
@media (max-width: 1180px) { .toc-aside { display: none; } .main-wrap { margin-right: 0; } }
@media (max-width: 860px) {
  .menu-btn { display: inline-flex; }
  .sidebar { transform: translateX(-100%); transition: transform 0.22s ease; }
  .sidebar.open { transform: translateX(0); box-shadow: 8px 0 24px rgba(0,0,0,0.25); }
  .main-wrap { margin-left: 0; }
  .article { padding: 26px 18px 64px; }
  .search-box { display: none; }
  .pager { grid-template-columns: 1fr; }
}
"""

READER_JS = r"""
(function() {
  // Backward compatibility for legacy hash routes (#/WHITEPAPER, #/docs/..., #/en/...)
  if (location.hash.startsWith("#/")) {
    const h = location.hash.slice(2).replace(/\.md$/, "");
    const map = {
      "README": "index.html",
      "WHITEPAPER": "whitepaper.html",
      "README_EN": "en/index.html",
      "WHITEPAPER_EN": "en/whitepaper.html",
      "en/WHITEPAPER_EN": "en/whitepaper.html"
    };
    const dest = map[h] || (h ? h + ".html" : "index.html");
    location.replace((window.__ASSET_PREFIX__ || "") + dest);
    return;
  }

  window.copyCode = function(btn) {
    const code = btn.parentElement.querySelector("code").innerText;
    navigator.clipboard.writeText(code).then(() => {
      const prev = btn.textContent;
      btn.textContent = "Copied ✓";
      setTimeout(() => (btn.textContent = prev), 1500);
    });
  };

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("bt-theme", t);
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
    const hl = document.getElementById("hljs-theme");
    if (hl) {
      hl.href = t === "dark"
        ? "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css"
        : "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css";
    }
  }
  applyTheme(localStorage.getItem("bt-theme") || "light");

  // Progressive enhancement: KaTeX, Highlight.js, Mermaid
  if (window.katex) {
    document.querySelectorAll(".math-display").forEach(el => {
      const raw = el.textContent.replace(/^\$\$|\$\$$/g, "").trim();
      try { el.innerHTML = katex.renderToString(raw, { displayMode: true, throwOnError: false }); } catch (e) {}
    });
    document.querySelectorAll(".math-inline").forEach(el => {
      const raw = el.textContent.replace(/^\$|\$$/g, "").trim();
      try { el.innerHTML = katex.renderToString(raw, { displayMode: false, throwOnError: false }); } catch (e) {}
    });
  }
  if (window.hljs) {
    document.querySelectorAll("pre code").forEach(el => {
      try { hljs.highlightElement(el); } catch (e) {}
    });
  }
  async function renderMermaid() {
    if (!window.mermaid) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", securityLevel: "loose" });
    const nodes = document.querySelectorAll(".mermaid");
    if (nodes.length) {
      try { await mermaid.run({ nodes }); } catch (e) {}
    }
  }
  renderMermaid();

  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("open");
  });

  // Instant Pre-Indexed Search
  let searchData = null;
  const searchInput = document.getElementById("searchInput");
  const searchDropdown = document.getElementById("searchDropdown");
  async function loadIndex() {
    if (searchData) return searchData;
    const resp = await fetch((window.__ASSET_PREFIX__ || "") + "assets/search-index.json");
    searchData = await resp.json();
    return searchData;
  }
  searchInput?.addEventListener("focus", loadIndex);
  searchInput?.addEventListener("input", async () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchDropdown.style.display = "none"; return; }
    const idx = await loadIndex();
    const langDocs = idx.filter(d => d.lang === window.__PAGE_LANG__);
    const hits = [];
    for (const d of langDocs) {
      const pos = d.body.toLowerCase().indexOf(q);
      if (pos !== -1 || d.title.toLowerCase().includes(q)) {
        const snip = pos !== -1 ? d.body.slice(Math.max(0, pos - 28), pos + 72) + "..." : d.desc;
        hits.push({ href: (window.__ASSET_PREFIX__ || "") + d.html, title: d.title, snip });
      }
    }
    searchDropdown.innerHTML = hits.length
      ? hits.slice(0, 8).map(h => `<a class="search-item" href="${h.href}"><div class="search-item-title">${h.title}</div><div class="search-item-snip">${h.snip.replace(/</g, "&lt;")}</div></a>`).join("")
      : `<div style="padding:10px;font-size:13px;color:var(--text-muted);">No matches / 未找到匹配内容</div>`;
    searchDropdown.style.display = "block";
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box") && searchDropdown) searchDropdown.style.display = "none";
  });
})();
"""


def build_og_card(assets_dir):
    og_html = os.path.join(assets_dir, "_og_temp.html")
    og_png = os.path.join(assets_dir, "og-card.png")
    chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome):
        return
    card_src = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: linear-gradient(135deg, #0b1120 0%, #1e293b 60%, #0f172a 100%);
    color: #f8fafc; font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 58px 68px; border-bottom: 10px solid #3b82f6;
  }
  .badge {
    display: inline-block; background: rgba(59,130,246,0.18); color: #60a5fa;
    border: 1px solid rgba(96,165,250,0.4); padding: 6px 16px; border-radius: 999px;
    font-size: 18px; font-weight: 700; letter-spacing: 0.08em;
  }
  h1 { font-size: 54px; line-height: 1.2; margin: 22px 0 14px; font-weight: 800; }
  .sub { font-size: 26px; color: #cbd5e1; line-height: 1.45; }
  .code-strip {
    margin-top: 26px; padding: 16px 22px; border-radius: 12px;
    background: rgba(15,23,42,0.85); border: 1px solid #334155;
    font-family: Consolas, "Microsoft YaHei", monospace; font-size: 22px; color: #38bdf8;
  }
  .footer { display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 20px; }
  .metrics span { color: #f8fafc; font-weight: 700; margin-right: 24px; }
</style></head><body>
  <div>
    <span class="badge">BABELTELE PROTOCOL SPECIFICATION · BT-SPEC V1.0</span>
    <h1>🗼 巴别语体系白皮书 · BabelTele Whitepaper</h1>
    <div class="sub">A Model-Native High-Density Semantic Communication &amp; Memory System for LLMs</div>
    <div class="code-strip">🌿光合: CO2+H2O ⇨(ox/red)⇨ O2↑ + Glucose. 💧-e⁻, CO2+e⁻. &nbsp;|&nbsp; content_encoding: "babeltele/1.0"</div>
  </div>
  <div class="footer">
    <div class="metrics"><span>27.9% Volume @ 99.5% Fidelity</span><span>-44.2% A2A Tokens</span><span>SMFT + 3-Tier Audit</span></div>
    <div>github.com/Minglink/BabelTele-Whitepaper</div>
  </div>
</body></html>"""
    with open(og_html, "w", encoding="utf-8") as f:
        f.write(card_src)
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu", "--window-size=1200,630",
        "--hide-scrollbars", f"--screenshot={og_png}", f"file:///{og_html.replace(os.sep, '/')}"
    ], check=True)
    os.remove(og_html)


def main():
    assets_dir = os.path.join(REPO, "assets")
    os.makedirs(assets_dir, exist_ok=True)
    with open(os.path.join(assets_dir, "style.css"), "w", encoding="utf-8") as f:
        f.write(STYLE_CSS.strip() + "\n")
    with open(os.path.join(assets_dir, "reader.js"), "w", encoding="utf-8") as f:
        f.write(READER_JS.strip() + "\n")

    build_og_card(assets_dir)

    search_index = []
    for p in PAGES:
        is_zh = p["lang"] == "zh"
        md_path = os.path.join(REPO, p["md"])
        raw_md = open(md_path, encoding="utf-8").read()
        headings = []
        article_html = render_blocks(raw_md.splitlines(), p["md"], p["html"], headings)

        # Build Sidebar HTML
        lang_pages = [x for x in PAGES if x["lang"] == p["lang"]]
        g0 = [x for x in lang_pages if x["nav_group"] == 0]
        g1 = [x for x in lang_pages if x["nav_group"] == 1]
        g0_title = "总览与单卷典藏本" if is_zh else "Overview & Canonical Treatise"
        g1_title = "BT-Spec v1.0 深度规范分册" if is_zh else "BT-Spec v1.0 Modular Specification"

        def nav_items_html(items):
            return "\n".join(
                f'      <a class="nav-link{" active" if it["html"] == p["html"] else ""}" href="{rel_url(p["html"], it["html"])}">{it["nav_title"]}</a>'
                for it in items
            )

        sidebar_html = (
            f'      <div class="nav-group-title">{g0_title}</div>\n{nav_items_html(g0)}\n'
            f'      <div class="nav-group-title">{g1_title}</div>\n{nav_items_html(g1)}'
        )

        # Build Right TOC HTML
        toc_html = "\n".join(
            f'        <a class="toc-item toc-h{lvl}" href="#{hid}">{html_lib.escape(t)}</a>'
            for lvl, hid, t in headings
        )

        # Build Prev / Next Pager HTML
        idx = lang_pages.index(p)
        prev_p = lang_pages[idx - 1] if idx > 0 else None
        next_p = lang_pages[idx + 1] if idx < len(lang_pages) - 1 else None
        prev_lbl = "← 上一章" if is_zh else "← Previous"
        next_lbl = "下一章 →" if is_zh else "Next →"
        prev_card = (
            f'<a class="pager-card" href="{rel_url(p["html"], prev_p["html"])}"><div class="pager-label">{prev_lbl}</div><div class="pager-title">{prev_p["nav_title"]}</div></a>'
            if prev_p else ""
        )
        next_card = (
            f'<a class="pager-card next" href="{rel_url(p["html"], next_p["html"])}"><div class="pager-label">{next_lbl}</div><div class="pager-title">{next_p["nav_title"]}</div></a>'
            if next_p else ""
        )
        pager_html = f'<div class="pager"><div>{prev_card}</div><div>{next_card}</div></div>'

        depth = p["html"].count("/")
        asset_prefix = "../" * depth
        canonical_url = f"{SITE_BASE}/" if p["html"] == "index.html" else (
            f"{SITE_BASE}/en/" if p["html"] == "en/index.html" else f"{SITE_BASE}/{p['html']}"
        )
        zh_html = p["html"] if is_zh else p["pair_html"]
        en_html = p["pair_html"] if is_zh else p["html"]
        zh_url = f"{SITE_BASE}/" if zh_html == "index.html" else f"{SITE_BASE}/{zh_html}"
        en_url = f"{SITE_BASE}/en/" if en_html == "en/index.html" else f"{SITE_BASE}/{en_html}"

        pdf_url = (
            "https://github.com/Minglink/BabelTele-Whitepaper/releases/download/v1.0.0/BabelTele-Whitepaper-v1.0-zh.pdf"
            if is_zh else
            "https://github.com/Minglink/BabelTele-Whitepaper/releases/download/v1.0.0/BabelTele-Whitepaper-v1.0-en.pdf"
        )
        json_ld = build_json_ld(p, canonical_url, pdf_url)

        final_html = (
            PAGE_SHELL
            .replace("__HTML_LANG__", "zh-CN" if is_zh else "en")
            .replace("__LANG_SHORT__", p["lang"])
            .replace("__SEO_TITLE__", html_lib.escape(p["seo_title"], True))
            .replace("__SEO_DESC__", html_lib.escape(p["seo_desc"], True))
            .replace("__CANONICAL_URL__", canonical_url)
            .replace("__ZH_URL__", zh_url)
            .replace("__EN_URL__", en_url)
            .replace("__SITE_BASE__", SITE_BASE)
            .replace("__PDF_URL__", pdf_url)
            .replace("__OG_LOCALE__", "zh_CN" if is_zh else "en_US")
            .replace("__JSON_LD__", json_ld)
            .replace("__ASSET_PREFIX__", asset_prefix)
            .replace("__HOME_HREF__", rel_url(p["html"], "index.html" if is_zh else "en/index.html"))
            .replace("__PAIR_HREF__", rel_url(p["html"], p["pair_html"]))
            .replace("__LANG_BTN_LABEL__", "🇬🇧 English" if is_zh else "🇨🇳 简体中文")
            .replace("__PDF_BTN_LABEL__", "📥 中文 PDF" if is_zh else "📥 English PDF")
            .replace("__SEARCH_PLACEHOLDER__", "搜索全书章节..." if is_zh else "Search chapters...")
            .replace("__TOC_HEADING__", "本页目录" if is_zh else "On This Page")
            .replace("__SIDEBAR_HTML__", sidebar_html)
            .replace("__ARTICLE_HTML__", article_html)
            .replace("__PAGER_HTML__", pager_html)
            .replace("__TOC_HTML__", toc_html)
        )

        out_file = os.path.join(REPO, p["html"])
        os.makedirs(os.path.dirname(out_file), exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(final_html)

        plain_body = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", article_html)).strip()
        search_index.append({
            "html": p["html"],
            "lang": p["lang"],
            "title": p["nav_title"],
            "desc": p["seo_desc"],
            "body": plain_body,
        })

    with open(os.path.join(assets_dir, "search-index.json"), "w", encoding="utf-8") as f:
        json.dump(search_index, f, ensure_ascii=False)

    # Generate sitemap.xml with xhtml:link hreflang pairs
    sm_entries = []
    for p in PAGES:
        is_zh = p["lang"] == "zh"
        loc = f"{SITE_BASE}/" if p["html"] == "index.html" else (
            f"{SITE_BASE}/en/" if p["html"] == "en/index.html" else f"{SITE_BASE}/{p['html']}"
        )
        zh_h = p["html"] if is_zh else p["pair_html"]
        en_h = p["pair_html"] if is_zh else p["html"]
        zh_u = f"{SITE_BASE}/" if zh_h == "index.html" else f"{SITE_BASE}/{zh_h}"
        en_u = f"{SITE_BASE}/en/" if en_h == "en/index.html" else f"{SITE_BASE}/{en_h}"
        prio = "1.0" if p["nav_group"] == 0 else "0.85"
        sm_entries.append(f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{prio}</priority>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="{zh_u}"/>
    <xhtml:link rel="alternate" hreflang="en" href="{en_u}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE_BASE}/"/>
  </url>""")

    for extra_path, prio in [("llms.txt", "0.95"), ("llms-full.txt", "0.90"), ("llms-bt.txt", "0.90")]:
        sm_entries.append(f"""  <url>
    <loc>{SITE_BASE}/{extra_path}</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{prio}</priority>
  </url>""")

    sitemap_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(sm_entries)
        + "\n</urlset>\n"
    )
    with open(os.path.join(REPO, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap_xml)

    # Generate llms-full.txt (complete machine-ingestible bilingual corpus)
    full_sections = [
        "# BabelTele Whitepaper (BT-Spec v1.0) — Complete Bilingual AI Corpus\n"
        f"Canonical URL: {SITE_BASE}/\n"
        "Repository: https://github.com/Minglink/BabelTele-Whitepaper\n"
        "Author: MingLin (@Minglink)\n"
        "Foundational Empirical Paper: Large Language Models Do Not Always Need Readable Language (arXiv:2606.19857)\n"
    ]
    for md_rel in [
        "WHITEPAPER_EN.md",
        "en/03-core-axioms-and-grammar.md",
        "en/04-compression-tiers-and-cot.md",
        "en/05-agentic-protocol-stack.md",
        "en/06-cross-model-consensus-and-audit.md",
        "en/07-canonical-instruction-set.md",
        "en/08-genealogy-and-ecosystem.md",
        "WHITEPAPER.md",
        "docs/07-canonical-instruction-set.md",
    ]:
        full_sections.append(f"\n\n{'=' * 80}\nSOURCE FILE: {md_rel}\n{'=' * 80}\n\n" + open(os.path.join(REPO, md_rel), encoding="utf-8").read())

    with open(os.path.join(REPO, "llms-full.txt"), "w", encoding="utf-8") as f:
        f.write("".join(full_sections))

    print(f"Built {len(PAGES)} pre-rendered static HTML pages, sitemap.xml, llms-full.txt, search-index.json, and og-card.png!")


if __name__ == "__main__":
    main()
