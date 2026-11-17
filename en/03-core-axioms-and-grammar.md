# Chapter 03 — The Three Core Axioms & Canonical Grammar Specification (`BT-Spec v1.0`)

> [← Chapter 02: Theoretical Foundations](./02-theoretical-foundations.md) · [Back to Portal (README_EN)](../README_EN.md) · [Next: Chapter 04 — Compression Tiers & CoT Dynamics →](./04-compression-tiers-and-cot.md)

---

## 3.1 The Three Fundamental Axioms

BabelTele is not a rigid artificial vocabulary, but a generative representation system governed by **three formal axioms**:

### Axiom I: Omnilingual Token Minimization
For any semantic concept $c$ with unambiguous candidate expressions $\mathcal{L}(c)$ across world languages, scientific notations, and symbolic operators, the compiler selects the representation $w^*$ minimizing subword token count and conditional semantic entropy under the target tokenizer:

$$w^*(c) = \arg\min_{w \in \mathcal{L}(c)} \Big[ \text{Tokens}(w) + \lambda \cdot H(C \mid w, \text{Context}) \Big]$$

> [!CAUTION]
> **The Tokenizer Paradox & Naive Symbol Illusion ($\Delta L_{\text{BPE}} < 0$)**
> **Fewer visual characters do NOT automatically mean fewer BPE tokens!** Popular blog posts often claim that emojis, math symbols, or CJK characters *always* cost fewer tokens than English words. Direct empirical measurement using `tiktoken` (`cl100k_base` / `o200k_base`) disproves this naive assumption on isolated words:
>
> | Concept | English / ASCII (`cl100k` / `o200k`) | Unicode / Emoji / CJK (`cl100k` / `o200k`) | Empirical Verdict |
> | :--- | :---: | :---: | :--- |
> | Water | `water` (**`1` / `1`**) | `💧` (`2` / `2`) | Emoji triggers UTF-8 byte split (2x costlier) |
> | Because | ` because` (**`1` / `1`**) | `∵` (`2` / `2`) | Rare math glyph costs more than `" because"` |
> | And | ` and` (**`1` / `1`**) · `&` (**`1` / `1`**) | `∧` (`2` / `2`) | Single-char ASCII `&` wins; `∧` inflates tokens |
> | Photosynthesis | `photosynthesis` (**`2` / `2`**) | `光合` (`3` / `2`) · `光合作用` (`5` / `3`) | Common English stem is already compact in BPE |
> | Glucose | `Glucose` (**`2` / `2`**) | `葡萄糖` (`8` / `3`) | Scientific English `Glucose` beats legacy CJK splits |
> | Hospital | `hospital` (**`1` / `1`**) | `医院` (`3` / `1`) | Modern multilingual vocab (`o200k`/Qwen/DeepSeek) equalizes CJK |
>
> **Evolution from Naive Shorthand to `BT-Spec v1.0`**:
> Real 3x–4x token compression comes **not** from swapping 1-token English words into 2-token emojis, but from **collapsing multi-word syntactic clauses** (e.g., collapsing the 12-token clause *"while the carbon dioxide is reduced, gaining electrons"* into `CO2+e-`). Therefore, `BT-Spec v1.0` mandates:
> 1. **Prefer 1-token ASCII operators** (`->`, `=>`, `&`, `|`, `!`, `?`, `:`, `@`, `#`, `=`) over multi-byte decorative Unicode glyphs;
> 2. **Adapt omnilingual lexical choice to tokenizer families**: leverage dense CJK compounds aggressively on CJK-optimized tokenizers (Qwen, DeepSeek, GLM, `o200k_base`), while favoring concise English stems and scientific notation on English-centric BPE vocabularies.

### Axiom II: Relational Graph Collapse
Linear grammatical scaffolding—articles, copulas, passive voice auxiliaries, and relative clauses—must collapse into explicit **Node–Operator–Attribute** relational edges.

### Axiom III: Zero-Codebook Self-Recoverability
Stateful external private codebooks are strictly prohibited. Inline first-use macro declarations (`@[Abbr=FullName]`) within the same context window are permitted because any capable LLM can resolve them self-containedly.
* **Hard-Data Invariance**: Exact numbers, units, hyperparameters, formulas, version strings, and original placeholders (`BIBREF`, `TABREF`) **must be preserved verbatim without rounding or estimation**; missing or unspecified facts must be marked `?` or `NULL`.

---

## 3.2 The Six Canonical Operator Clusters (`BT-Spec v1.0`)

### Cluster I: Causality, Entailment & Sequential Flow
| Relation | Verbose Natural Language | Canonical Operator | Example |
| :--- | :--- | :---: | :--- |
| Causation / Entailment | leads to, therefore, resulting in | `=>` or `⇨` | `Inflation↑ => Rate↑` |
| Equivalence | if and only if, is equivalent to | `<=>` | `Equilibrium <=> Supply==Demand` |
| Pipeline / Sequence | first A, followed by B, then C | `->` or `>` | `Seq: Ingest->Clean->Distill` |
| Provenance / Reason | due to the fact that, caused by | `<-` | `Reject <- ExpiredToken` |

### Cluster II: Boolean Logic & Conditional Boundaries
| Relation | Verbose Natural Language | Canonical Operator | Example |
| :--- | :--- | :---: | :--- |
| Conjunction (AND / Contrast) | and simultaneously, while, however | `&` or `∧` | `Staff@Corp & !FullTime` |
| Disjunction (OR) | either option A or option B | `\|` or `∨` | `Auth: OAuth2 \| APIKey` |
| Negation (NOT / Lacks) | without, does not require, lacks | `!` or `¬` | `!FineTune & !HiddenState` |
| Conditional Branch | if [condition] holds, execute [action] | `?cond => act` | `?Budget>10k => Approve(VP)` |
| Exception / Exemption | except in the case of, excluding | `!target: detail` | `RemoteAll !Ops:OnCall` |

### Cluster III: Sets, Quantifiers & Spatiotemporal Anchors
| Relation | Verbose Natural Language | Canonical Operator | Example |
| :--- | :--- | :---: | :--- |
| Set Membership | belongs to, is an element of | `∈` / `∉` | `GPT-5.4 ∈ Proprietary` |
| Universal / Existential | for every chunk, there exists | `∀` / `∃` | `∀chunk(200K) -> Compress` |
| Location / Time / Scope | in October, at the Berlin office | `@` | `BerlinShipApp@Oct` |
| Macro Section Header | regarding the topic of... | `#Topic` or `S[Topic]` | `#EvalSetup` |
| Inline Macro Definition | hereinafter referred to as... | `@[X=FullName]` | `@[BT=BabelTele]` |

### Cluster IV: Entity Binding & Array Flattening
| Relation | Verbose Natural Language | Canonical Operator | Example |
| :--- | :--- | :---: | :--- |
| Attribute Key-Value Binding | entity E has property K set to V | `@Ent(K=V)` | `@Qwen3.6(ctx=256K, acc=62.07%)` |
| Parallel Array Flattening | including A, B, as well as C | `[A, B, C]` | `Baselines:[Orig, Summ, LLMLingua2]` |
| Hierarchical Containment | module P comprises subcomponents | `Parent:{c1, c2}` | `Stack:{MCP, A2A, BT}` |
| Exact Parameter & Unit | configured with parameter P at V | `$param:V(unit)` | `$lr:3e-4, $chunk:200K(tok)` |

### Cluster V: Comparison, Conflict & Trends
| Relation | Verbose Natural Language | Canonical Operator | Example |
| :--- | :--- | :---: | :--- |
| Comparative Matrix | compared against B, A achieves | `A <> B : result` | `BT <> Truncate : +10.34%(@GLM5.1)` |
| Cross-Source Conflict | contradicts / differs across specs | `⇎` | `RFC2459:? ⇎ RFC3280:<=20oct` |
| Growth / Gas Evolution | rises significantly, releases gas | `↑` or `📈` | `O2↑`, `Q3rev↑~30%YoY` |
| Reduction / Drop | decreases by, drops to | `↓` or `📉` | `tok↓72.1%, fid≈99.5%` |

### Cluster VI: Epistemic & Anti-Hallucination Anchors
| Relation | Verbose Natural Language | Canonical Operator | Example |
| :--- | :--- | :---: | :--- |
| Unspecified / Unknown | not mentioned in source document | `NULL` or `?` | `ReleaseDate=?` |
| Approximate Source Value | roughly around, approximately | `~` or `≈` | `len≈27.9%` |
| Citation / Table Placeholders | original reference markers | Verbatim `BIBREF` / `TABREF` | `cf. BIBREF_12` |

---

## 3.3 Canonical Encoding Walkthroughs

### Walkthrough 1: Scientific Mechanism (Photosynthesis — Verified Primary Figure vs. ASCII BPE Mode)
* **Original English (45 tokens)**:
  > *"During photosynthesis, plants take in carbon dioxide and water. The water is oxidized, losing electrons, while the carbon dioxide is reduced, gaining electrons. This transforms them into oxygen and glucose."*
* **Paper Visual Micro-Example (`arXiv:2606.19857` §3.2)**:
  ```text
  🌿光合: CO2+H2O ⇨(ox/red)⇨ O2↑ + Glucose. 💧-e⁻, CO2+e⁻.
  ```
* **`BT-Spec v1.0` Strict BPE-Optimal ASCII Form (19 `o200k_base` tokens, `-57.8%` true BPE reduction)**:
  ```text
  Photosynthesis(plants): CO2+H2O ->(ox/red)-> O2^ + Glucose; H2O -e-, CO2 +e-.
  ```

### Walkthrough 2: Multi-Standard Technical Reconciliation (RFC Audit Grade)
* **Original Prose (118 tokens)**: Five authoritative specifications define X.509 certificate serial number length differently across RFC 2459, RFC 3280, RFC 5280, CA/B Forum TLS Baseline Requirements, and Let's Encrypt documentation.
* **`BT-L2` Encoding**:
  ```text
  #X509_SerialLen @[LE=Let'sEncrypt]: RFC2459:? ⇎ RFC3280:<=20oct ⇎ RFC5280:{<=20oct & int>0(sign-bit)} ⇎ CA/B_TLS_BR:{<2^159 & entropy>=64b(CSPRNG)} ⇎ LE_doc:8B(63b).
  ```
Every numeric bound (`2459`, `3280`, `5280`, `20oct`, `2^159`, `64b`, `8B`, `63b`) is preserved bit-for-bit while exposing cross-specification discrepancies explicitly via `⇎`.

---

> **Next Chapter**: [Chapter 04 — Standardized Compression Tiers & Chain-of-Thought Cognitive Dynamics →](./04-compression-tiers-and-cot.md)
