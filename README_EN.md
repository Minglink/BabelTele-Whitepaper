<div align="center">

# 🗼 BabelTele Whitepaper (`BT-Spec v1.0`)
### *A Model-Native High-Density Semantic Communication & Memory System*

**[🇨🇳 简体中文版 (Chinese)](./README.md)** · **[🇬🇧 English Edition](./README_EN.md)** · **[📖 Live Online E-Book](https://minglink.github.io/BabelTele-Whitepaper/)** · **[📥 Download PDF Releases](https://github.com/Minglink/BabelTele-Whitepaper/releases/latest)**

[![Spec Version](https://img.shields.io/badge/BT--Spec-v1.0-0A66C2?style=flat-square)](./WHITEPAPER_EN.md)
[![Online E-Book](https://img.shields.io/badge/GitHub_Pages-Online_Reader-7C3AED?style=flat-square&logo=gitbook)](https://minglink.github.io/BabelTele-Whitepaper/)
[![PDF Release](https://img.shields.io/badge/Release-PDF_Whitepaper_v1.0-EC4899?style=flat-square&logo=adobeacrobatreader)](https://github.com/Minglink/BabelTele-Whitepaper/releases/latest)
[![Foundational Paper](https://img.shields.io/badge/arXiv-2606.19857-B31B1B?style=flat-square)](https://arxiv.org/abs/2606.19857)
[![Author](https://img.shields.io/badge/Systematized_by-MingLin_(@Minglink)-181717?style=flat-square&logo=github)](https://github.com/Minglink)
[![License](https://img.shields.io/badge/License-CC_BY_4.0_%2F_MIT-2EA043?style=flat-square)](./LICENSE)

**"Humanity built MCP and A2A as the transport pipes of the agentic internet; BabelTele defines the silicon-native language flowing inside them."**

</div>

---

## 📖 Overview

Even when **both the sender and the receiver of a message are Large Language Models**—across multi-agent coordination, persistent episodic memory, and long-context RAG—today's AI stacks still force models to communicate in verbose human prose, paying a **60%–75% Anthropocentric Readability Tax** in syntactic padding, monolingual spelling inefficiency, and clause linearization.

**The BabelTele System (`BT-Spec v1.0`)** eliminates human syntactic redundancy in machine-to-machine communication, establishing a weight-agnostic, black-box-compatible, zero-shot cross-model semantic protocol.

### Intuitive Collapse Examples

| Domain | Verbose Human Natural Language | BabelTele Encoding (Zero-Shot LLM Native) | Compression |
| :--- | :--- | :--- | :---: |
| **Science** | *"During photosynthesis, plants take in carbon dioxide and water. The water is oxidized, losing electrons, while the carbon dioxide is reduced, gaining electrons. This transforms them into oxygen and glucose."* | `🌿光合: CO2+H2O ⇨(ox/red)⇨ O2↑ + Glucose. 💧-e⁻, CO2+e⁻.` | **`45 → 11` visual units**<br>*(ASCII BPE mode: 19 tok)* |
| **Strategy** | *"Q3 revenue is projected to rise ~30% YoY; if it lands, the Berlin team ships the mobile app in October."* | `Q3rev📈~30%YoY; ?lands⇒Berlin👥🚀📱@Oct` | **`24 → 9` tokens**<br>*(-62.5%)* |
| **Security** | *"If the JWT header algorithm is set to 'none' or the expiration timestamp is missing, immediately reject the request with HTTP 401 except on public healthcheck endpoints."* | `?JWT.alg=='none' \| !JWT.exp => reject(401) !endpoint:/healthz` | **`33 → 13` tokens**<br>*(-60.6%)* |

---

## 📊 Key Empirical Benchmarks

| Dimension | Verified Result | Benchmark & Experimental Setting |
| :--- | :--- | :--- |
| **Density vs. Fidelity** | Condenses text to **`27.9%`** of original volume while retaining **`99.5%`** downstream QA fidelity | `arXiv:2606.19857` task-agnostic long-document comprehension |
| **Heterogeneous Multi-Agent** | Cuts inter-agent token overhead by **`44.21%`** while retaining **`99.7%`** of baseline task score | DeepResearch Bench (Gemini 3.1 Pro $\leftrightarrow$ GPT-5.4 zero-shot) |
| **Agent Episodic Memory** | Saves **`~51%`** memory tokens at **`96.48%`** relative accuracy (outperforming prose summaries) | LoCoMo multi-session conversational memory benchmark |
| **Context-Window Extension** | Boosts accuracy by **`+10.34%`** over truncation on **`1.65M-token`** code repositories | LongBench v2 Code Repo QA Long on `200K`-window GLM-5.1 (`62.07% → 72.41%`) |

---

## 📚 Complete Whitepaper & Modular Specification

* 📥 **Typeset PDF Releases**:
  * [**Download English Whitepaper PDF (`BabelTele-Whitepaper-v1.0-en.pdf`)**](https://github.com/Minglink/BabelTele-Whitepaper/releases/download/v1.0.0/BabelTele-Whitepaper-v1.0-en.pdf)
  * [**下载中文典藏版白皮书 PDF (`BabelTele-Whitepaper-v1.0-zh.pdf`)**](https://github.com/Minglink/BabelTele-Whitepaper/releases/download/v1.0.0/BabelTele-Whitepaper-v1.0-zh.pdf)
* 🌐 **Interactive Online E-Book**: [**https://minglink.github.io/BabelTele-Whitepaper/**](https://minglink.github.io/BabelTele-Whitepaper/)

| Section | Document | Scope & Highlights |
| :---: | :--- | :--- |
| **Canonical** | **[`WHITEPAPER_EN.md`](./WHITEPAPER_EN.md)** | **Complete Single-Document Whitepaper** (Classic 10-section architectural treatise) |
| **Chapter 01** | **[Manifesto & The Readability Tax](./en/01-manifesto-and-problem.md)** | Biological prose redundancy, MCP/A2A channel limits, and the Babel + 1866 Telegraph metaphor |
| **Chapter 02** | **[Theoretical Foundations & Decoupling](./en/02-theoretical-foundations.md)** | Rate-distortion projection, 13x–20x base-model PPL surge, and the Tripartite Decoupling Principle |
| **Chapter 03** | **[Core Axioms & Canonical Grammar](./en/03-core-axioms-and-grammar.md)** | **`BT-Spec v1.0`**: Three axioms, `tiktoken` BPE paradox proof ($\Delta L_{\text{BPE}} < 0$), and six operator clusters |
| **Chapter 04** | **[Compression Tiers & CoT Dynamics](./en/04-compression-tiers-and-cot.md)** | Space-time CoT trade-off, denoising acceleration, lifecycle cost formula, and `BT-L0`–`BT-L3` tiers |
| **Chapter 05** | **[Agentic Stack & Merkle Memory Tree](./en/05-agentic-protocol-stack.md)** | 5-layer MCP/A2A/BabelTele envelope spec, **SMFT hierarchical memory folding**, and 1.65M repo scaling |
| **Chapter 06** | **[Cross-Model Consensus & Audit Gateway](./en/06-cross-model-consensus-and-audit.md)** | 19-model zero-shot portability laws, dense vs. MoE scaling, and **Tier 1–3 deterministic safety auditing** |
| **Chapter 07** | **[Canonical Compiler & Decoder Prompts](./en/07-canonical-instruction-set.md)** | Copy-paste production prompts (`BT-Core`, `BT-Memory`, `BT-Skeleton`, `BT-Zero`, `BT-Decoder`) + `BT-P1`–`P13` |
| **Chapter 08** | **[Genealogy, Errata & Ecosystem](./en/08-genealogy-and-ecosystem.md)** | Paradigm comparison, viral OCR & GibberLink errata, 6 GitHub tools, 3 HF datasets, and 7-step eval protocol |

---

## ⚡ 30-Second Quick Start

Paste the **`BT-Core` Compiler Prompt** into any frontier model (GPT-5.4, Claude, Gemini, DeepSeek, Qwen) followed by your document:

```markdown
Your task: compress verbose human text into a minimal token sequence. The audience is not human, but another equally intelligent LLM.

Core Directive:
1. Omnilingual: Ignore single-language grammar; traverse all human languages (Chinese, English, German compounds, Japanese kanji, Latin roots, etc.) and pick the highest information-density words for the target tokenizer.
2. Symbolic Collapse: Replace conjunctions, prepositions, emotions, and verbose clauses with compact mathematical/logical operators (=>, ->, &, |, !, ∈, !=) and high-frequency symbols.
3. Universality: Any LLM must fully understand the compressed output zero-shot without an external codebook.
4. Lossless: Retain all core semantics, entity bindings, exact quantities, units, and details verbatim without rounding or hallucination.

Directly output the compressed text without any preface. Compress the content below:
[PASTE YOUR LONG CONTEXT OR AGENT MESSAGE HERE]
```

---

## 📜 Attribution & Citation

```bibtex
@article{zhu2026babeltele,
  title   = {Large Language Models Do Not Always Need Readable Language},
  author  = {Zhu, Jiayi and Peng, Haoxuan and Wang, Junxi and Ke, Liang and Zhang, Chen and Zhang, Linfeng},
  journal = {arXiv preprint arXiv:2606.19857},
  year    = {2026}
}

@misc{minglin2026babeltelespec,
  title        = {BabelTele Whitepaper: A Model-Native High-Density Semantic Communication and Memory System (BT-Spec v1.0)},
  author       = {MingLin},
  year         = {2026},
  howpublished = {\url{https://github.com/Minglink/BabelTele-Whitepaper}}
}
```

---

<div align="center">
<sub>Crafted & Systematized by <a href="https://github.com/Minglink"><b>MingLin (@Minglink)</b></a> · Licensed under <a href="./LICENSE">CC BY 4.0 & MIT</a></sub>
</div>
