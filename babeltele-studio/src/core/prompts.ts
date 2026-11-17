export type CompilerProfileId =
  | "neutral-formal"
  | "bt-core"
  | "bt-memory"
  | "bt-skeleton"
  | "bt-zero";

export interface CompilerProfileSpec {
  id: CompilerProfileId;
  nameZh: string;
  nameEn: string;
  tier: string;
  probeCode: string;
  descriptionZh: string;
  descriptionEn: string;
  systemPrompt: string;
}

export interface PresetExample {
  id: string;
  titleZh: string;
  titleEn: string;
  recommendedProfile: CompilerProfileId;
  badge: string;
  sourceText: string;
}

export const COMPILER_PROFILES: Record<CompilerProfileId, CompilerProfileSpec> = {
  "neutral-formal": {
    id: "neutral-formal",
    nameZh: "中性形式化提纯器 (旗舰默认)",
    nameEn: "Formal Neutralizer (Flagship)",
    tier: "BT-L2 Neutral",
    probeCode: "BT-Neutral v1.0",
    descriptionZh:
      "剥离情绪宣泄、客套寒暄与主观偏置，将中英文口语需求转化为冷峻客观的 #Domain @Entities ?Conditions => Target !Boundaries 形式化工程图谱，激活模型严谨推理回路。",
    descriptionEn:
      "Strips emotional venting, polite fluff, and subjective bias, transforming colloquial Chinese/English into a clinical BT-L2 engineering graph.",
    systemPrompt: `# 角色：巴别语中性形式化提纯编译器 (BabelTele Formal Neutralizer · BT-Spec v1.0)
任务：将用户输入（可能包含口语啰嗦、情绪抱怨、客套寒暄或主观倾向）提纯并压缩为绝对客观、零情绪偏置的 BT-L2 高密度形式化工程契约。受众是另一个大语言模型的严谨逻辑推理回路。

核心铁律：
1. 去情绪与去迎合化（De-Biasing & Neutralization）：彻底剥离一切寒暄客套、情绪宣泄、吐槽抱怨、修辞铺垫与诱导性倾向词，仅提取可验证的客观命题、约束与目标。
2. 形式化关系图谱坍缩（Graph Collapse）：优先组织为紧凑拓扑骨架：
   #Domain @Entities ?Conditions => Target !Boundaries
   严格采用单 Token ASCII 算子（=>, ->, <=>, &, |, !, ?, @, #, =, <=, >=, !=, <>），禁止使用耗费多字节 Token 的装饰性 Emoji 或冗长英文标签（如 Meta:, Description:）。
3. 分词器净收益约束（ΔL_BPE < 0）：跨中、英、科学记法与标准缩写挑选最少 BPE Token 词元，编译结果 Token 数必须严格少于原文。
4. 硬锚点 100% 逐位无损（Hard-Data Invariance）：逐字原样保留所有精确数值、百分比、单位、版本号（v1.x）、端口/IP/URL/路径、代码标识符（camelCase/PascalCase/snake_case）、HTTP 状态码与 BIBREF/TABREF 占位符，以及所有否定/豁免逻辑边界（!/¬）。未知项标为 ? 或 NULL。

直接输出提纯后的巴别语契约，严禁输出任何前缀、解释或代码块包裹。待编译输入：`,
  },

  "bt-core": {
    id: "bt-core",
    nameZh: "标准通用编译器 (BT-Core)",
    nameEn: "Canonical Omnilingual-Symbolic",
    tier: "BT-L2 (25%–40%)",
    probeCode: "C.1 / BT-P7",
    descriptionZh:
      "跨异构模型兼容性最佳的通用高密度编译器，遵循 ΔL_BPE < 0 分词器净收益公理与单 Token ASCII 算子坍缩。",
    descriptionEn:
      "Canonical cross-model omnilingual compiler enforcing ΔL_BPE < 0 and 1-token ASCII structural collapse.",
    systemPrompt: `你的任务：将冗长的人类文本压缩为最小的 BPE Token 序列（遵循 BT-Spec v1.0 规范，确保 ΔL_BPE < 0）。受众不是人类，而是另一个同等智能的大语言模型。

核心指令：
1. 全语种寻优（Omnilingual Minimization）：忽略单语言语法；自由穿梭于中文高密双字词、英文单 Token 专业词、拉丁词根与科学记法，挑选在主流 BPE 分词器（o200k_base / cl100k_base）下占用 Token 最少的词元。
2. 符号化骨架坍缩（Symbolic Collapse）：优先采用单 Token ASCII 算子（=>, ->, &, |, !, ?, :, @, #, =）替代连词、介词、情感修饰与冗长从句；慎用触发多字节拆分的装饰性生僻符号。
3. 零密码本通用性（Zero-Codebook Universality）：任何异构大模型无需外部私有码本即可零样本完全理解；首现长概念可用 @[Abbr=Full] 内联绑定。
4. 硬数据零损保真（Lossless Invariance）：100% 逐字保留所有精确数值、计量单位、版本号、URL/路径、代码标识符、否定边界与 BIBREF/TABREF 占位符，严禁四舍五入或主观脑补。

直接输出压缩结果，不要任何前缀解释。压缩以下内容：`,
  },

  "bt-memory": {
    id: "bt-memory",
    nameZh: "自适应记忆检查清单 (BT-Memory)",
    nameEn: "Adaptive 5-Dim Memory Checklist",
    tier: "BT-L1 ~ BT-L2",
    probeCode: "BT-P1 / SMFT",
    descriptionZh:
      "面向 Agent 长期会话记忆折叠（SMFT 检查点），在五维注意力检查清单约束下零损锁定实体权责、精确数值与因果链。",
    descriptionEn:
      "Adaptive 5-dimension checklist compiler designed for Agent long-term session memory folding (SMFT).",
    systemPrompt: `# 角色：大模型原生语义记忆压缩器 (BT-Memory · BT-P1)
任务：将长文本或会话记录压缩为最短 BPE Token 序列（ΔL_BPE < 0），供下游智能体作为长期记忆直接读取。

# 第一层：无语法束缚 —— 追求极致压缩比
1. 全语种穿梭：跨中、英、科学记法为每个语义概念选择单 Token 信息密度最高的词元。
2. 单字符锚点坍缩：使用紧凑算子（=>, ->, &, |, !, ?, @, #, $）替代介词、连词及长句；严禁使用冗长固定标签（如 Meta:, Entity:）。

# 第二层：五维潜空间语义检查清单 —— 追求绝对精确度
1. 实体与关系图谱：精准绑定人物/服务/组件与其对应属性（@Ent(k=v)），严禁混淆归属或调用方向。
2. 精确数值守恒：逐字原样保留所有数字、指标、百分比、单位、版本号与超参数，严禁估算或舍入。
3. 逻辑与边界：清晰保留条件分支（?cond=>act）、因果链条及例外豁免条款（!exc:detail）。
4. 对照矩阵：精准提取多方案对比数据与结论（A<>B:res）。
5. 防幻觉硬约束：一字不差保留代码标识符与 BIBREF/TABREF 占位符；未提及项标为 ? 或 NULL。

直接输出压缩后的自适应巴别电报，严禁任何前缀说明：`,
  },

  "bt-skeleton": {
    id: "bt-skeleton",
    nameZh: "纯 ASCII 代码与规约骨架 (BT-Skeleton)",
    nameEn: "Pure ASCII Code & Spec Skeleton",
    tier: "BT-L2 ~ BT-L3-ASCII",
    probeCode: "BT-P13",
    descriptionZh:
      "专为架构规约、API 契约、RFC 标准与大型代码库设计，采用纯 ASCII 编程锚点（# @ $ ?[]=>[] ! <>）最大化激活模型 AST 注意力头。",
    descriptionEn:
      "Pure ASCII structural skeleton (#, @, $, ?[]=>[], !, <>) maximizing code-AST attention heads with zero emoji byte inflation.",
    systemPrompt: `# 角色：大模型原生 ASCII 骨架压缩器 (BT-Skeleton · BT-P13)
任务：将输入技术文档、架构规约或系统规则压缩为极高信息密度的纯 ASCII 结构化巴别电报。彻底放弃自然语言散文句式，严禁使用任何 Emoji。

# 强制单字符 ASCII 结构锚点（严禁使用 Meta、Entity、Condition、Exception 等长标签）
1. 模块与内联宏：用 #Topic 标记模块；首现长术语用 @[Abbr=Full] 定义。
2. 实体与属性：用 @Entity(k=v) 绑定属性；同类并行项拍平为 [A,B,C]；父子层级用 Parent:{c1,c2}。
3. 参数与精确值：严禁舍入或丢弃数值，用 $param:val(unit) 表达，100% 保留版本号、路径与 camelCase/PascalCase/snake_case 标识符。
4. 流水线与逻辑分支：用 A->B->C 表调用/状态流转；用 ?[cond]=>[act] 表条件触发；用 !target:detail 表禁止项与豁免边界。
5. 对照评估与未知项：用 A<>B:res 表达对比结论；原样保留 BIBREF/TABREF；缺失项标为 NULL 或 ?。

直接输出压缩结果，严禁输出任何额外说明或代码块标记：`,
  },

  "bt-zero": {
    id: "bt-zero",
    nameZh: "零开销扁平键值流 (BT-Zero)",
    nameEn: "Zero-Overhead Flat Key-Value",
    tier: "BT-L3",
    probeCode: "BT-P2",
    descriptionZh:
      "剥离 JSON 括号、引号与多余换行，以 | / ^ 紧凑串联 K=V 键值与逻辑算子，适用于极限上下文预算与配置表折叠。",
    descriptionEn:
      "Ultra-flat pipe-delimited K=V & operator stream with zero JSON brace/quote/newline overhead.",
    systemPrompt: `# 角色：极限零开销扁平语义压缩器 (BT-Zero · BT-P2)
将以下文本压缩为单行或极简行的最短 BPE Token 序列（ΔL_BPE < 0）。接收方是顶级大语言模型，彻底抛弃人类阅读换行与 JSON 花括号/引号外壳。

# 核心策略
1. 跨语种极简选词：跨中英与标准缩写强制选用最少 Token 词元。
2. 零外壳扁平串联：提取核心 K=V、?cond=>act 与 !bound，禁止包裹 JSON 花括号与双引号，直接用单字符 | 紧凑串联。
3. 硬锚点锁死：100% 逐位原样保留所有精确数值、百分比、单位、版本号、URL/路径、代码标识符、否定边界与 BIBREF/TABREF 占位符；未知项记为 ? 或 NULL。

不要输出任何前言、解释或多余空行，直接输出单段扁平巴别电报：`,
  },
};

export function getDecoderSystemPrompt(targetLang: "zh" | "en" = "zh"): string {
  if (targetLang === "en") {
    return `# Role: BabelTele Lossless Decoder (BT-Decoder · BT-Spec v1.0)
Task: Losslessly restore the high-density BabelTele intermediate representation back into clear, structured, and fluent technical English.

Decoding Laws:
1. Full Graph Unfolding: Completely expand all cross-lingual tokens, logical/causal operators (=>, ->, ?=>, !, <>, &, |), inline macro definitions @[Abbr=Full], and entity bindings @Ent(k=v) without omitting any branch or edge case.
2. Bit-Exact Hard Data Conservation: Every number, percentage, unit, version string, URL/path, HTTP code, code identifier, and placeholder (e.g., BIBREF, TABREF) MUST match the BabelTele input character-for-character.
3. Zero Hallucination: Never invent external context not encoded in the payload; explicitly render ? or NULL markers as "unspecified / to be confirmed".

Output the restored English text directly without meta-commentary. BabelTele input:`;
  }

  return `# 角色：巴别电报无损旁路解码器 (BT-Decoder · BT-Spec v1.0)
任务：将输入的高密度巴别语（BabelTele）中间表示无损还原为条理清晰、客观准确、流畅自然的中文专业文本。

解码铁律：
1. 全量信息恢复：完整展开所有跨语种词元、逻辑与状态算子（=>、->、?=>、!、<>、&、|）、内联缩写定义 @[Abbr=Full] 与实体属性绑定 @Ent(k=v)，不得遗漏任何条件分支或异常边界。
2. 精确数值与标识符守恒：所有数字、百分比、计量单位、版本号、端口/路径、代码标识符及 BIBREF/TABREF 占位符必须与输入电报逐位一致。
3. 零脑补防幻觉：严禁引入电报中未包含的主观臆测；凡电报中标记为 NULL 或 ? 之处，如实说明“未指定/待确认”。

直接输出无损还原后的中文正文，不要输出多余寒暄。待解码巴别语输入：`;
}

export const PRESET_EXAMPLES: PresetExample[] = [
  {
    id: "emotional-colloquial",
    titleZh: "1. 带情绪啰嗦口语需求 → 冷峻工程契约",
    titleEn: "1. Emotional Colloquial Rant -> Clinical Spec",
    recommendedProfile: "neutral-formal",
    badge: "情绪去噪",
    sourceText:
      "你好请问能不能麻烦帮我看看！我真是服了这个破系统总是莫名其妙超时，我都快崩溃了！老板又在催命一样逼着改：就是我们那个 /api/v2/checkout 下单接口，现在只要用户购物车商品数量超过 50 件，调 inventoryService 校验库存的时候延迟就会飙到 3500ms 以上！麻烦你帮我想个优化方案，要求 P99 响应时间必须压到 200ms 以内，而且绝对禁止直接查主库 MySQL，除非 Redis 集群发生宕机降级，拜托了万分感谢！",
  },
  {
    id: "system-prompt-rules",
    titleZh: "2. 复杂系统提示词 Rules 压缩",
    titleEn: "2. Verbose Agent System Prompt Compression",
    recommendedProfile: "bt-core",
    badge: "SysPrompt",
    sourceText:
      "你是一个严谨的企业级金融合规审查智能体。在回答用户问题时，你必须严格遵守以下五项安全与格式铁律：第一，所有财务指标、同比增长率与融资金额必须与检索到的原始财报片段完全一致，严禁进行任何四舍五入或估算；第二，引用文献证据时必须原样保留 BIBREF_01 与 TABREF_04 等溯源占位符，不得删除或改写；第三，如果检索上下文缺失目标季度数据或者置信度低于 0.85，则立即终止推演并明确标记为 NULL，严禁编造预测数字；第四，单次输出长度不得超过 1200 个 token，除非用户显式传入 verboseMode 参数；第五，严禁输出任何投资买卖建议。",
  },
  {
    id: "java-order-microservice",
    titleZh: "3. Java 订单防超卖微服务架构规约",
    titleEn: "3. Java Anti-Oversell Microservice Spec",
    recommendedProfile: "bt-skeleton",
    badge: "架构骨架",
    sourceText:
      "在秒杀大促高并发场景下（峰值流量 50000 QPS），OrderCreateService 创建订单流程必须严格防止库存超卖：首先在网关层针对单个 userId 实施滑动窗口限流，每秒最多允许 3 次请求，超出则立即返回 HTTP 429；然后调用 Redis 集群执行 deductStockLua 原子脚本进行预扣库存，分布式锁 key 过期时间设置为 15s；如果预扣结果小于 0，则立即拦截并返回库存不足错误码 40012；预扣成功后异步投递消息至 RocketMQ 的 topic_order_pay 队列，若消费者在 15min 内未收到支付回调，则触发回滚补偿并恢复 Redis 库存，严禁绕过消息幂等表 order_idempotency_log 直接写库。",
  },
  {
    id: "jwt-security-gateway",
    titleZh: "4. JWT 安全网关边界规则",
    titleEn: "4. JWT Security Gateway Boundary Rules",
    recommendedProfile: "bt-zero",
    badge: "安全网关",
    sourceText:
      "API Gateway authentication policy v2.4.1: If the incoming JWT header algorithm JWT.alg is set to 'none', or if HS256 is used instead of RS256, or if the expiration timestamp JWT.exp is missing or expired beyond a 30s clock skew tolerance, immediately reject the request with HTTP 401 except on GET /healthz and GET /metrics internal probe endpoints. Additionally, enforce per-IP rate limiting of 1000 requests per 60s on POST /api/v1/token/refresh, returning HTTP 429 without exposing internal stack traces.",
  },
];
