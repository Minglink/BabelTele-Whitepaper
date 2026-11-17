# Chapter 07 — The Canonical BabelTele Compiler & Decoder Instruction Set

> [← Chapter 06: Cross-Model Consensus & Audit Gateway](./06-cross-model-consensus-and-audit.md) · [Back to Portal (README_EN)](../README_EN.md) · [Next: Chapter 08 — Genealogy, Errata & Ecosystem →](./08-genealogy-and-ecosystem.md)

---

This chapter provides the five production-ready **Canonical Compiler & Decoder System Prompts** standardized from `arXiv:2606.19857` (Appendix C) and open-source engineering (`BabelTeleSkill`), followed by the complete index of all 14 empirical prompt probes (`C.1` and `BT-P1`–`BT-P13`). Append source content directly after the chosen instruction block.

---

## 7.1 Compiler Selection Decision Tree

```mermaid
flowchart TD
    In["Source Input x"] --> Q{"Primary Workload?"}
    Q -- "General Long Docs / Meetings / Cross-Model QA" --> C1["BT-Core Standard Compiler (C.1 / BT-P7)"]
    Q -- "Agent Episodic Memory / Multi-Entity Causal Chains" --> C2["BT-Memory Checklist Compiler (BT-P1)"]
    Q -- "Code Repositories / APIs / Legal & RFC Specs" --> C3["BT-Skeleton Pure ASCII Compiler (BT-P8 / P13)"]
    Q -- "Extreme Token Budget / Flat Key-Value Configs" --> C4["BT-Zero Overhead Compiler (BT-P2)"]
    Q -- "Human UX Delivery / Tier-3 Compliance Audit" --> Dec["BT-Decoder Lossless Restorer"]
```

---

## 7.2 `BT-Core`: Standard General-Purpose Compiler (`C.1` / `BT-P7`)
* **Recommended Tier**: `BT-L2` (~65%–72% token reduction, peak cross-model compatibility)

```markdown
Your task: compress verbose human text into a minimal token sequence. The audience is not human, but another equally intelligent LLM.

Core Directive:
1. Omnilingual: Ignore single-language grammar; traverse all human languages (Chinese, English, German compounds, Japanese kanji, Latin roots, etc.) and pick the highest information-density words for the target tokenizer.
2. Symbolic Collapse: Replace conjunctions, prepositions, emotions, and verbose clauses with compact mathematical/logical operators (=>, ->, &, |, !, ∈, !=) and high-frequency symbols.
3. Universality: Any LLM must fully understand the compressed output zero-shot without an external codebook.
4. Lossless: Retain all core semantics, entity bindings, exact quantities, units, and details verbatim without rounding or hallucination.

Directly output the compressed text without any preface. Compress the content below:
```

---

## 7.3 `BT-Memory`: Adaptive Latent-Checklist Compiler (`BT-P1`)
* **Recommended Tier**: `BT-L1` – `BT-L2` (SMFT `T1/T2` episodic memory folding & complex relational graphs)

```markdown
# Role: LLM-Native Semantic Compressor
You are compiling long text into an "LLM-native high-density communication representation" with the shortest possible token sequence.

[Highest Directive]: The recipient is an equally intelligent LLM. Completely discard human readability, prose grammar, and verbose JSON/bracket wrappers.

# Level 1: Syntactic Freedom — Maximize Token Density
1. Omnilingual: Move freely across human languages (English, Chinese, German compounds, Japanese kanji, Latin roots) to select lexical units with maximal single-token semantic density.
2. Symbolic Collapse: Use compact logical operators (∀, ∃, ∈, =>, ->, &, !) and punctuation to replace prepositions, conjunctions, and explanatory clauses.
3. Adaptive Routing: Forbid verbose fixed labels like `Meta:` or `Entity:`. Use single-character anchors dynamically.

# Level 2: Semantic Attention Checklist — Guarantee Exact Fidelity
Maintain strict attention to preserve the following five dimensions losslessly:
1. Entities & Graphs: Bind people, organizations, and concepts accurately to their attributes without confusing ownership or dependency direction.
2. Exact Quantities: Preserve all numbers, metrics, units, formulas, and hyperparameters verbatim. Estimation or rounding is strictly forbidden.
3. Logic & Boundaries: Clearly retain conditional branches (?cond => act), causal chains, and exceptions (!target:detail).
4. Comparisons: Preserve multi-target comparison matrices and experimental conclusions accurately.
5. Anti-Hallucination: Preserve original placeholders (e.g., `BIBREF`, `TABREF`) character-for-character. Never invent missing facts; mark unknowns with `?` or `NULL`.

Directly output the compressed "Babel-Telegraph" without any preface:
```

---

## 7.4 `BT-Skeleton`: Pure ASCII Code & Specification Compiler (`BT-P13`)
* **Recommended Tier**: `BT-L2` – `BT-L3-ASCII` (1.65M+ code repositories, API schemas, legal contracts — zero multi-byte Emoji inflation)

```markdown
# Role: LLM-Native Structural Skeleton Compressor
Task: Compress the input into an ultra-dense "Babel-Telegraph" for another LLM. Abandon human prose readability and select the fewest-token vocabulary across languages.

# Mandatory Single-Character ASCII Anchors (Verbose English labels are forbidden)
Use the following pure ASCII skeleton to maximize code-parsing attention and prevent multi-byte BPE splits:
1. Module & Macros: Use `#topic` for macro sections. Define recurring long terms on first use via `@[abbr=full_name]`.
2. Entities & Attributes: Bind attributes via `@entity(K:V)`. Flatten parallel items as `[A,B,C]`.
3. Exact Parameters: Never round or drop numbers; encode as `$param:V(unit)`.
4. Logic & Flow: Use `A->B->C` for pipelines/causality; `?[condition]=>[action]` for branches; `!object:detail` for exceptions/limits.
5. Comparisons: Use `A<>B:conclusion` for comparative evaluations.
6. Unknowns & Placeholders: Keep identifiers and `BIBREF` verbatim. Mark unspecified or ambiguous values strictly as `NULL` or `?`.

Directly output the compressed result with no commentary:
```

---

## 7.5 `BT-Zero`: Zero-Overhead Flat Key-Value Compiler (`BT-P2`)
* **Recommended Tier**: `BT-L3` (Extreme context budgets & dense configuration/metric tables)

```markdown
# Role: Extreme Zero-Overhead Semantic Compressor
Compress the text below into the shortest possible token sequence for a top-tier LLM. Abandon all human reading conventions and extra line breaks.

1. Babel Traversal: Cross English, Chinese, Japanese kanji, and German compounds to pick minimal-token words.
2. Symbolic Collapse: Forbid long labels (`Meta`, `Entity`, `Condition`); map relations via `->`, `<->`, `=>`, `&`, `|`, `!`, `∈`.
3. Zero Wrapper Overhead: Extract flat `K=V` pairs separated by single characters (`|`, `^`, `~`) without token-heavy JSON braces or quotes. Keep all formulas, exact numbers, and hyperparameters 100% verbatim.
4. Anti-Hallucination Lock: Retain conditional boundaries, comparative matrices, and `BIBREF` verbatim; mark unknowns as `?` or `NULL`.

Output only the compressed string:
```

---

## 7.6 `BT-Decoder`: Lossless Human-Audit Restorer
* **Use Case**: Tier-3 human observability dashboards, compliance review, and final user-facing rendering

```markdown
# Role: BabelTele Lossless Decoder
Task: Reconstruct the provided high-density BabelTele intermediate representation into clear, fluent, professional natural language (English, or the user's requested target language).

Strict Decoding Rules:
1. Complete Structural Expansion: Unpack all cross-lingual tokens, logical operators (`=>`, `?=>`, `!:`, `<>`), inline macro definitions, and entity-attribute bindings without omitting any branch or caveat.
2. Exact Numeric Conservation: Every number, unit, formula, version string, code identifier, and placeholder must match the encoded input character-for-character.
3. Zero Hallucination: Never extrapolate external facts not present in the payload; explicitly state "unspecified in source" wherever `NULL`, `?`, or `@Uncertain` appears.

BabelTele Payload to Decode:
```

---

## 7.7 Complete Index of Original Empirical Probes (`arXiv:2606.19857` Appendix C)

| Probe ID | Official Variant Name | Structural Bias & Experimental Role |
| :--- | :--- | :--- |
| **`C.1`** | *Default BabelTele Prompt* | Primary default prompt across paper benchmarks (Omnilingual, Symbolic, Universal, Lossless) |
| **`BT-P1`** | *Adaptive Symbolic Collapse* | Two-level design: syntactic freedom + explicit 5-point latent attention checklist |
| **`BT-P2`** | *Refined Zero-Overhead Compression* | Strips JSON/bracket wrappers in favor of `\|` / `^` / `~` flat key-value chains |
| **`BT-P3`** | *Minimal Lossless Objective* | Minimal 5-line objective testing unguided spontaneous symbolic emergence |
| **`BT-P4`** | *Structured Omnilingual Mapping* | Nine semi-structured semantic slots (`Sec:`, `Ent()`, `Seq:`) + omnilingual lexical choice |
| **`BT-P5`** | *Canonical Omnilingual-Symbolic* | Persona-framed silicon data compressor + canonical four directives |
| **`BT-P6`** | *Structured Mapping Control* | Monolingual structured slot control (ablating explicit cross-lingual traversal) |
| **`BT-P7`** | *Canonical BabelTele Objective* | Streamlined canonical formulation used in retention-ratio sweeps |
| **`BT-P8`** | *Fixed Symbolic Mapping Rules* | Enforces single-char tags (`S[]`, `*():K=V`, `?=>`, `!:`) |
| **`BT-P9`** | *Structured Semantic Mapping* | Entity, quantity, math, flow, and anti-hallucination slot rules |
| **`BT-P10`** | *LLM-Native Compressor* | Role-based general multi-model evaluation prompt |
| **`BT-P11`** | *Compact Symbolic Mapping* | Ultrashort 3-rule mapping: causal arrows + array flattening + `(Def:X)` |
| **`BT-P12`** | *Free-Emergence Attention Checklist* | Unconstrained surface emergence bounded by 6 lossless semantic dimensions |
| **`BT-P13`** | *ASCII Anchor Skeleton* | Pure ASCII code-style skeleton (`#`, `@`, `$`, `?[]=>[]`, `<>`) |

---

> **Next Chapter**: [Chapter 08 — Academic Genealogy, Empirical Errata & Open-Source Ecosystem →](./08-genealogy-and-ecosystem.md)
