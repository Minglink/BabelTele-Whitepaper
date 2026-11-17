/* BabelTele Super Agent — 100% Local Zero-CDN Graphical IDE Controller */
(() => {
  "use strict";

  const TEMPLATES = {
    rate_limiter:
      "你好啊麻烦帮我一下！我真是服了这破系统总是被恶意刷接口，老板又在催命一样逼着改！能不能帮我在当前项目写一个生产级 Python 滑动窗口与令牌桶限流模块 rate_limiter.py，如果出现单 IP 每秒请求大于等于 20 次那么就必须立即拦截返回 False，并且要求支持白名单豁免（严禁误拦 127.0.0.1 和 /health 健康检查路径），然后再写一个完整的单元测试文件 test_rate_limiter.py 并用终端运行 python -m unittest 验证全部通过！万分感谢辛苦了！",
    java_pure:
      "请在当前工作区创建一个标准 Java 17 订单风控校验类 OrderValidator.java（包含金额上限 50000.00 校验、必填字段非空检查与 VIP 免审白名单逻辑，要求 100% 纯正标准 Java 源码与 Javadoc 注释），同时生成一个零依赖单文件可视化测试看板 order_dashboard.html，并检查生成文件的代码纯净度。",
    subagent_audit:
      "请先查看当前工作区的所有文件结构；如果还没有示例工程文件，请先创建一个简短的计算器模块 calc_engine.py，随后调用 spawn_subagent 委派一名『安全与边界审计员』子智能体（走 babeltele/1.0 协议）对代码做除零异常、类型边界与单元测试覆盖审查，最后向我汇总中文审计报告。",
  };

  const state = {
    settings: {},
    presets: [],
    running: false,
    workspaceDir: "",
    files: [],
    fileChanges: [],
    terminalLogs: [],
    headerDigest: "",
    telemetry: {},
    lastOriginalPrompt: "",
    lastNeutralizedPrompt: "",
    browseParent: "",
    activeToolCard: null,
    activeSubagentCard: null,
    selectedFilePath: "",
  };

  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg, kind = "info") {
    const box = $("toastContainer");
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 250);
    }, 3600);
  }

  async function apiJson(url, options = {}) {
    const opts = {
      headers: { "Content-Type": "application/json" },
      ...options,
    };
    const resp = await fetch(url, opts);
    const data = await resp.json();
    return data;
  }

  /* -------------------- State Sync & Rendering -------------------- */
  async function loadFullState() {
    try {
      const data = await apiJson("/api/state");
      applyServerState(data);
    } catch (err) {
      showToast(`无法连接本地后台服务: ${err.message}`, "error");
    }
  }

  function applyServerState(data) {
    if (!data || !data.settings) return;
    state.settings = data.settings;
    if (Array.isArray(data.presets) && data.presets.length) {
      state.presets = data.presets;
    }
    state.running = Boolean(data.running);
    state.workspaceDir = data.workspace_dir || state.settings.workspace_dir || "";
    state.files = data.files || [];
    state.fileChanges = data.file_changes || [];
    state.terminalLogs = data.terminal_logs || [];
    if (typeof data.header_digest === "string") {
      state.headerDigest = data.header_digest;
    }
    state.telemetry = data.telemetry || {};

    renderHeaderBar();
    renderFileTree();
    renderDiffsPane();
    renderTerminalPane();
    renderMemoryTelemetry();
  }

  function renderHeaderBar() {
    const wsParts = state.workspaceDir.replace(/\\/g, "/").split("/").filter(Boolean);
    const shortWs = wsParts.slice(-2).join("/") || state.workspaceDir;
    $("currentWorkspaceLabel").textContent = shortWs;
    $("btnOpenWorkspaceModal").title = `当前完整工作区路径: ${state.workspaceDir}（点击切换或新建）`;
    $("workspaceFullHint").textContent = state.workspaceDir;

    const btMode = state.settings.bt_mode !== false;
    $("btnModeBT").classList.toggle("active", btMode);
    $("btnModeVerbose").classList.toggle("active", !btMode);

    const statusBtn = $("btnApiStatus");
    const statusTxt = $("statusText");
    if (state.settings.is_ready) {
      statusBtn.className = "status-pill ready";
      statusTxt.textContent = `已就绪 · ${state.settings.model}`;
    } else {
      statusBtn.className = "status-pill unconfigured";
      statusTxt.textContent = "未配置 API Key · 点击配置";
    }

    setRunningUI(state.running);
  }

  function setRunningUI(isRunning, stepLabel = "") {
    state.running = isRunning;
    const badge = $("runStateBadge");
    if (isRunning) {
      badge.className = "run-badge running";
      badge.textContent = stepLabel || "⚡ 超级 Agent 正在高速推进...";
      $("btnStopAgent").classList.remove("hidden");
      $("btnRunAgent").disabled = true;
    } else {
      badge.className = "run-badge idle";
      badge.textContent = "● 空闲待命";
      $("btnStopAgent").classList.add("hidden");
      $("btnRunAgent").disabled = false;
    }
  }

  function renderFileTree() {
    const container = $("fileTreeList");
    if (!state.files.length) {
      container.innerHTML = `<div class="empty-hint">当前工作区暂无文件，派遣 Agent 执行任务后将实时生成</div>`;
      return;
    }
    container.innerHTML = state.files
      .map((f) => {
        const activeCls = f.path === state.selectedFilePath ? "active" : "";
        const kb = f.size < 1024 ? `${f.size} B` : `${(f.size / 1024).toFixed(1)} KB`;
        return `<div class="file-item ${activeCls}" data-filepath="${escapeHtml(f.path)}">
          <span>📄 ${escapeHtml(f.path)}</span>
          <span class="file-size">${kb}</span>
        </div>`;
      })
      .join("");

    container.querySelectorAll(".file-item").forEach((el) => {
      el.addEventListener("click", () => openWorkspaceFile(el.dataset.filepath));
    });
  }

  function formatColorDiff(diffText) {
    if (!diffText) return `<span class="text-dim">(无行级差异)</span>`;
    return diffText
      .split("\n")
      .map((line) => {
        const esc = escapeHtml(line);
        if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
          return `<span class="diff-line-meta">${esc}</span>`;
        }
        if (line.startsWith("+")) return `<span class="diff-line-add">${esc}</span>`;
        if (line.startsWith("-")) return `<span class="diff-line-del">${esc}</span>`;
        return esc;
      })
      .join("\n");
  }

  function renderDiffsPane() {
    $("badgeDiffCount").textContent = String(state.fileChanges.length);
    const box = $("diffListContainer");
    if (!state.fileChanges.length) {
      box.innerHTML = `<div class="empty-hint">Agent 创建或修改文件后，此处将实时展示 Unified Diff 与双平面纯净度审计结果。</div>`;
      return;
    }
    box.innerHTML = [...state.fileChanges]
      .reverse()
      .map((fc) => {
        const pureBadge = fc.pure_code
          ? `<span class="tag-pill success">🛡️ 100% 纯净原生代码</span>`
          : `<span class="tag-pill warn">⚠️ 疑似符号告警</span>`;
        return `<div class="diff-card">
          <div class="diff-card-header">
            <span>${fc.action === "created" ? "🆕 新建" : "✏️ 修改"} <code>${escapeHtml(fc.path)}</code></span>
            ${pureBadge}
          </div>
          <pre class="diff-pre">${formatColorDiff(fc.diff)}</pre>
        </div>`;
      })
      .join("");
  }

  function renderTerminalPane() {
    $("badgeTermCount").textContent = String(state.terminalLogs.length);
    const box = $("terminalListContainer");
    if (!state.terminalLogs.length) {
      box.innerHTML = `<div class="empty-hint">Agent 调用终端执行编译、运行或单元测试后，此处将展示真实退出码与标准输出。</div>`;
      return;
    }
    box.innerHTML = [...state.terminalLogs]
      .reverse()
      .map((tl) => {
        const okPill =
          tl.returncode === 0
            ? `<span class="tag-pill success">rc=0 · ${tl.duration_ms}ms</span>`
            : `<span class="tag-pill warn">rc=${tl.returncode} · ${tl.duration_ms}ms</span>`;
        return `<div class="term-card">
          <div class="term-card-header">
            <code>$ ${escapeHtml(tl.command)}</code>
            ${okPill}
          </div>
          <pre class="term-pre">${escapeHtml(tl.output || "(无输出)")}</pre>
        </div>`;
      })
      .join("");
  }

  function renderMemoryTelemetry() {
    const tel = state.telemetry || {};
    const saved = tel.total_estimated_tokens_saved || 0;
    const pureOk = tel.all_artifacts_pure !== false;

    $("quickSavedStat").innerHTML = `累计省流: <strong>${saved}</strong> tok`;
    $("quickPurityStat").innerHTML = pureOk
      ? `🛡️ 双平面源码纯净度: <strong>100%</strong>`
      : `⚠️ 双平面源码纯净度: <strong>需复核</strong>`;

    $("metPromptTok").textContent = String(tel.prompt_tokens || 0);
    $("metCompTok").textContent = String(tel.completion_tokens || 0);
    $("metSavedTok").textContent = `${saved} tok`;
    const hdrPct = tel.header_memory ? tel.header_memory.savings_pct || 0 : 0;
    $("metHeaderSavings").textContent = `${hdrPct}%`;

    $("btHeaderDigestBox").textContent =
      state.headerDigest || "(工作区代码文件被扫描或写入后自动生成签名索引)";

    const smft = tel.smft_memory || { nodes: [] };
    const listEl = $("smftNodesList");
    if (!smft.nodes || !smft.nodes.length) {
      listEl.innerHTML = `<div class="empty-hint">当多轮对话增长或手动点击「📦 立即折叠旧轮次」时，历史轮次将折叠为高密度 [T1]/[T2] 巴别语摘要节点，支持一键无损回溯。</div>`;
    } else {
      listEl.innerHTML = smft.nodes
        .map(
          (n) => `<div class="smft-node">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong>[T${n.tier}] ${escapeHtml(n.node_id)} (${n.turn_count} 轮 · ${n.raw_tokens}➔${n.compressed_tokens} tok)</strong>
              <button class="mini-btn" data-deref="${escapeHtml(n.node_id)}">🔍 冷库回溯</button>
            </div>
            <div class="bt-code-line">${escapeHtml(n.bt_digest)}</div>
          </div>`
        )
        .join("");

      listEl.querySelectorAll("[data-deref]").forEach((btn) => {
        btn.addEventListener("click", () => openDerefModal(btn.dataset.deref));
      });
    }
  }

  async function openWorkspaceFile(relPath) {
    state.selectedFilePath = relPath;
    renderFileTree();
    switchInspectorTab("viewer");
    const box = $("fileViewerContainer");
    box.innerHTML = `<div class="empty-hint">正在读取 ${escapeHtml(relPath)} ...</div>`;
    try {
      const data = await apiJson(`/api/workspace/file?path=${encodeURIComponent(relPath)}`);
      if (!data.ok) {
        box.innerHTML = `<div class="empty-hint">${escapeHtml(data.error)}</div>`;
        return;
      }
      const numbered = data.content
        .split("\n")
        .map((ln, idx) => `${String(idx + 1).padStart(4, " ")} | ${escapeHtml(ln)}`)
        .join("\n");
      box.innerHTML = `
        <div class="diff-card">
          <div class="diff-card-header">
            <span>📄 <code>${escapeHtml(data.path)}</code> (${data.size} B)</span>
            <span class="tag-pill ${data.pure_code ? "success" : "warn"}">${
              data.pure_code ? "🛡️ 纯正源码" : "⚠️ 需检查"
            }</span>
          </div>
          ${
            data.bt_header
              ? `<div style="padding:6px 10px;border-bottom:1px solid var(--border);font-size:11px;" class="bt-code-line">BT-Header: ${escapeHtml(
                  data.bt_header
                )}</div>`
              : ""
          }
          <pre class="source-pre">${numbered}</pre>
        </div>
      `;
    } catch (err) {
      box.innerHTML = `<div class="empty-hint">读取失败: ${escapeHtml(err.message)}</div>`;
    }
  }

  function switchInspectorTab(tabId) {
    document.querySelectorAll(".insp-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    document.querySelectorAll(".insp-pane").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${tabId}`);
    });
  }

  /* -------------------- Neutralizer (0ms Offline + Optional LLM) -------------------- */
  async function runNeutralizer(useLlm = false) {
    const raw = $("promptInput").value.trim();
    if (!raw) {
      showToast("请先在输入框输入一段中文需求（或点击左侧一键模板）！", "warn");
      $("promptInput").focus();
      return;
    }
    if (useLlm && !state.settings.is_ready) {
      showToast("尚未配置 API Key，已先为您执行 0ms 离线规则提纯；配置密钥后可启用大模型深度提纯。", "warn");
      useLlm = false;
    }

    const btn = useLlm ? $("btnDeepLlmNeutral") : $("btnNeutralizeOnly");
    const oldLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ 提纯核算中...";

    try {
      const res = await apiJson("/api/neutralize", {
        method: "POST",
        body: JSON.stringify({ text: raw, use_llm: useLlm }),
      });
      if (!res.ok) {
        showToast(res.error || "提纯失败", "error");
        return;
      }
      state.lastOriginalPrompt = raw;
      state.lastNeutralizedPrompt = res.babeltele;

      $("neutralizerPreview").classList.remove("hidden");
      $("npEngineBadge").textContent = `${res.engine} · ${res.elapsed_ms}ms`;
      const b = res.budget || {};
      const sign = b.saved_tokens >= 0 ? `省 ${b.saved_tokens} tok (${b.savings_pct}%)` : "触发短句防膨胀熔断";
      $("npTokenBadge").textContent = `${b.source_tokens} ➔ ${b.bt_tokens} tok · ${sign}`;
      $("npOutputCode").textContent = res.babeltele;

      const aud = res.audit || {};
      $("npAnchorBadge").textContent = aud.passed
        ? `🔒 锚点硬锁 ${aud.total_anchors}/${aud.total_anchors} 完整保留`
        : "⚠️ 锚点已自动补齐";
      $("npAnchorDetail").textContent =
        aud.matched && aud.matched.length
          ? `已精确锁定的工程锚点：${aud.matched.join(" · ")}`
          : "未检测到特殊数字/路径硬锚点，已剥离冗余寒暄与情绪词。";

      showToast("⚡ 巴别语中性提纯完成！可点击「填入输入框」或直接派遣 Agent。", "success");
    } catch (err) {
      showToast(`提纯请求出错: ${err.message}`, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }

  /* -------------------- Streaming Super Agent Execution -------------------- */
  function hideWelcomeIfPresent() {
    const w = $("welcomeCard");
    if (w) w.classList.add("hidden");
  }

  function scrollStreamBottom() {
    const s = $("executionStream");
    s.scrollTop = s.scrollHeight;
  }

  function appendStreamCard(html, extraClass = "") {
    hideWelcomeIfPresent();
    const el = document.createElement("div");
    el.className = `ev-card ${extraClass}`;
    el.innerHTML = html;
    $("executionStream").appendChild(el);
    scrollStreamBottom();
    return el;
  }

  async function dispatchSuperAgent() {
    const prompt = $("promptInput").value.trim();
    if (!prompt) {
      showToast("请先输入任务指令（或点击左侧「一键实测任务模板」）！", "warn");
      $("promptInput").focus();
      return;
    }

    if (!state.settings.is_ready) {
      showToast("请先配置大模型 API Key（或一键探测本机 Ollama），保存后即可立即执行！", "warn");
      openSettingsModal();
      return;
    }

    const autoNeutralize = $("chkAutoNeutralize").checked;
    $("neutralizerPreview").classList.add("hidden");
    $("promptInput").value = "";

    appendStreamCard(
      `<div class="ev-header">
        <span class="ev-role">👤 人类工程需求</span>
        <span class="ev-meta">${state.settings.bt_mode ? "⚡ 巴别语极速内核" : "🐢 自然语言基线"}</span>
      </div>
      <div style="white-space:pre-wrap;">${escapeHtml(prompt)}</div>`,
      "ev-user"
    );

    setRunningUI(true, "⚡ 正在初始化工作区上下文...");
    state.activeToolCard = null;
    state.activeSubagentCard = null;

    try {
      const resp = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, auto_neutralize: autoNeutralize }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text();
        throw new Error(errText || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const block of parts) {
          const line = block.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const ev = JSON.parse(jsonStr);
            handleStreamEvent(ev);
          } catch (_) {
            // ignore malformed heartbeat chunk
          }
        }
      }
    } catch (err) {
      appendStreamCard(
        `<div class="ev-header"><span class="ev-role">❌ 通信或执行中断</span></div>
        <div>${escapeHtml(err.message)}</div>`,
        "ev-error"
      );
    } finally {
      setRunningUI(false);
    }
  }

  function handleStreamEvent(ev) {
    switch (ev.type) {
      case "input_neutralized": {
        const d = ev.data || {};
        const b = d.budget || {};
        if (d.babeltele && d.babeltele !== d.original) {
          appendStreamCard(
            `<div class="ev-header">
              <span class="ev-role">⚡ 输入侧自动脱水提纯 (BT-L2)</span>
              <span class="ev-meta">${b.source_tokens}➔${b.bt_tokens} tok · 锚点硬锁通过</span>
            </div>
            <div class="bt-code-line">${escapeHtml(d.babeltele)}</div>`
          );
        }
        break;
      }

      case "step_start":
        setRunningUI(true, `⚡ 正在推理执行第 ${ev.step} 步...`);
        break;

      case "bt_thought": {
        const showSidecar = $("chkAutoSidecar").checked;
        const card = appendStreamCard(
          `<div class="ev-header">
            <span class="ev-role">🧠 Step ${ev.step} · ${
              state.settings.bt_mode ? "硅基巴别语思考 (#BT)" : "模型思考"
            }</span>
            <div class="ev-meta">
              <span class="tag-pill info">${ev.thought_tokens} tok</span>
              <span>${ev.latency_ms} ms</span>
              <button type="button" class="mini-btn btn-toggle-lens">👁️ 人话透视</button>
            </div>
          </div>
          <div class="bt-code-line">${escapeHtml(ev.bt_text)}</div>
          <div class="sidecar-box ${showSidecar ? "" : "hidden"}">
            <strong>中文透视：</strong>${escapeHtml(ev.decoded_zh)}
          </div>`,
          "ev-thought"
        );
        const toggleBtn = card.querySelector(".btn-toggle-lens");
        const sidecar = card.querySelector(".sidecar-box");
        toggleBtn.addEventListener("click", () => sidecar.classList.toggle("hidden"));
        break;
      }

      case "tool_start": {
        const argsSummary = JSON.stringify(ev.args || {});
        const shortArgs = argsSummary.length > 180 ? `${argsSummary.slice(0, 180)}...` : argsSummary;
        state.activeToolCard = appendStreamCard(
          `<div class="ev-header">
            <span class="ev-role">🔧 调用工具: <code>${escapeHtml(ev.tool)}</code></span>
            <span class="tag-pill tool-status-pill">⏳ 执行中...</span>
          </div>
          <div class="tool-args-line">${escapeHtml(shortArgs)}</div>
          <div class="tool-obs-slot"></div>`,
          "ev-tool"
        );
        break;
      }

      case "tool_done": {
        if (state.activeToolCard) {
          const pill = state.activeToolCard.querySelector(".tool-status-pill");
          if (pill) {
            pill.className = `tag-pill ${ev.ok ? "success" : "warn"}`;
            pill.textContent = ev.ok ? "✅ 完成" : "⚠️ 返回非零/告警";
          }
          const slot = state.activeToolCard.querySelector(".tool-obs-slot");
          if (slot && ev.preview) {
            slot.innerHTML = `<div class="tool-obs-preview">${escapeHtml(ev.preview)}</div>`;
          }
        }
        if (ev.telemetry) {
          state.telemetry = ev.telemetry;
          renderMemoryTelemetry();
        }
        if (ev.tool === "write_file" || ev.tool === "edit_file" || ev.tool === "run_command") {
          loadFullState();
        }
        scrollStreamBottom();
        break;
      }

      case "subagent_start": {
        state.activeSubagentCard = appendStreamCard(
          `<div class="ev-header">
            <span class="ev-role">🐝 子智能体委派 [<code>${escapeHtml(ev.role)}</code>]</span>
            <span class="tag-pill info">content_encoding: babeltele/1.0</span>
          </div>
          <div class="bt-code-line">${escapeHtml(ev.task_bt)}</div>
          <div class="sidecar-box"><strong>任务透视：</strong>${escapeHtml(ev.decoded_zh)}</div>
          <div class="subagent-report-slot" style="margin-top:6px;color:var(--text-muted);font-size:12px;">⏳ 子智能体正在独立上下文执行...</div>`,
          "ev-thought"
        );
        break;
      }

      case "subagent_done": {
        if (state.activeSubagentCard) {
          const slot = state.activeSubagentCard.querySelector(".subagent-report-slot");
          if (slot) {
            slot.innerHTML = `<strong>✅ 子智能体回传 (${ev.tokens} tok)：</strong><div class="bt-code-line" style="margin-top:3px;">${escapeHtml(
              ev.report_bt
            )}</div>`;
          }
        }
        break;
      }

      case "smft_compacted": {
        const d = ev.data || {};
        appendStreamCard(
          `<div class="ev-header">
            <span class="ev-role">🌳 SMFT 语义默克尔记忆自动折叠</span>
            <span class="tag-pill success">${escapeHtml(d.node_id || "")}</span>
          </div>
          <div class="bt-code-line">${escapeHtml(d.bt_digest || "")}</div>`
        );
        break;
      }

      case "final_answer": {
        appendStreamCard(
          `<div class="ev-header">
            <span class="ev-role">✅ 超级 Agent 交付汇报（共 ${ev.step} 步）</span>
            <span class="tag-pill success">任务完成</span>
          </div>
          <div class="final-content">${escapeHtml(ev.content)}</div>`,
          "ev-final"
        );
        break;
      }

      case "cancelled": {
        appendStreamCard(
          `<div class="ev-header"><span class="ev-role">⏹️ 任务已停止</span></div>
          <div>${escapeHtml(ev.message)}</div>`
        );
        break;
      }

      case "error": {
        appendStreamCard(
          `<div class="ev-header"><span class="ev-role">⚠️ 执行受阻提示</span></div>
          <div>${escapeHtml(ev.message)}</div>`,
          "ev-error"
        );
        if (ev.error_kind === "unconfigured") {
          openSettingsModal();
        }
        break;
      }

      case "done": {
        applyServerState(ev);
        setRunningUI(false);
        break;
      }
    }
  }

  /* -------------------- Settings Modal -------------------- */
  function openSettingsModal() {
    const sel = $("selProvider");
    sel.innerHTML = state.presets
      .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
      .join("");
    sel.value = state.settings.provider_id || "deepseek";

    $("inpBaseUrl").value = state.settings.base_url || "";
    $("inpModel").value = state.settings.model || "";
    $("inpApiKey").value = "";
    $("inpApiKey").placeholder = state.settings.has_api_key
      ? `已保存密钥 (${state.settings.api_key_masked}) — 留空则保持不变`
      : "粘贴您的 API Key（如 sk-...，本机 Ollama 可留空）";
    $("inpMaxSteps").value = state.settings.max_steps || 25;
    $("inpCmdTimeout").value = state.settings.command_timeout || 45;
    $("testConnResult").classList.add("hidden");

    renderModelChipsForProvider(sel.value);
    $("modalSettings").classList.remove("hidden");
  }

  function renderModelChipsForProvider(providerId) {
    const preset = state.presets.find((p) => p.id === providerId);
    const row = $("modelChipsRow");
    if (!preset || !preset.models || !preset.models.length) {
      row.innerHTML = "";
      return;
    }
    row.innerHTML = preset.models
      .map((m) => `<button type="button" class="chip-btn" data-model="${escapeHtml(m)}">${escapeHtml(m)}</button>`)
      .join("");
    row.querySelectorAll(".chip-btn").forEach((b) => {
      b.addEventListener("click", () => {
        $("inpModel").value = b.dataset.model;
      });
    });
  }

  async function probeLocalOllama() {
    const btn = $("btnProbeOllama");
    btn.disabled = true;
    btn.textContent = "⏳ 探测中...";
    try {
      const res = await apiJson("/api/ollama/probe");
      if (res.online) {
        $("selProvider").value = "ollama";
        $("inpBaseUrl").value = res.base_url || "http://127.0.0.1:11434/v1";
        if (res.models && res.models.length) {
          $("inpModel").value = res.models[0];
          const row = $("modelChipsRow");
          row.innerHTML = res.models
            .map((m) => `<button type="button" class="chip-btn" data-model="${escapeHtml(m)}">${escapeHtml(m)}</button>`)
            .join("");
          row.querySelectorAll(".chip-btn").forEach((b) => {
            b.addEventListener("click", () => {
              $("inpModel").value = b.dataset.model;
            });
          });
          showToast(`发现 ${res.models.length} 个本机 Ollama 模型！直接点击保存即可免密钥运行。`, "success");
        } else {
          showToast("本机 Ollama 在线，但暂未拉取模型（可执行 ollama pull qwen2.5-coder:7b）。", "warn");
        }
      } else {
        showToast("未检测到本机运行中的 Ollama (127.0.0.1:11434)，您可使用 DeepSeek/通义千问/OpenAI API Key。", "warn");
      }
    } catch (err) {
      showToast(`探测失败: ${err.message}`, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "🔍 一键探测本机 Ollama";
    }
  }

  async function testModelConnection() {
    const box = $("testConnResult");
    const btn = $("btnTestConnection");
    btn.disabled = true;
    btn.textContent = "⏳ 正在握手测试...";
    box.className = "test-conn-result";
    box.textContent = "正在向目标大模型发送握手请求...";
    box.classList.remove("hidden");

    try {
      const res = await apiJson("/api/settings/test", {
        method: "POST",
        body: JSON.stringify({
          provider_id: $("selProvider").value,
          base_url: $("inpBaseUrl").value.trim(),
          api_key: $("inpApiKey").value.trim(),
          model: $("inpModel").value.trim(),
        }),
      });
      if (res.ok) {
        box.className = "test-conn-result ok";
        box.textContent = `✅ 连接成功！模型 ${res.model} 响应耗时 ${res.latency_ms} ms（返回: ${res.reply}）`;
      } else {
        box.className = "test-conn-result err";
        box.textContent = `❌ ${res.error || "连接失败"}`;
      }
    } catch (err) {
      box.className = "test-conn-result err";
      box.textContent = `❌ 请求异常: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = "🔌 测试连接";
    }
  }

  async function saveModelSettings() {
    const payload = {
      provider_id: $("selProvider").value,
      base_url: $("inpBaseUrl").value.trim(),
      api_key: $("inpApiKey").value.trim(),
      model: $("inpModel").value.trim(),
      max_steps: Number($("inpMaxSteps").value) || 25,
      command_timeout: Number($("inpCmdTimeout").value) || 45,
    };
    const res = await apiJson("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      applyServerState(res);
      $("modalSettings").classList.add("hidden");
      showToast("✅ 模型与 API 配置已保存生效！", "success");
    }
  }

  /* -------------------- Graphical Workspace Browser Modal -------------------- */
  async function openWorkspaceModal() {
    $("inpCreateSubdir").value = "";
    $("modalWorkspace").classList.remove("hidden");
    await browseDirectory(state.workspaceDir);
  }

  async function browseDirectory(targetPath) {
    const res = await apiJson(`/api/fs/browse?path=${encodeURIComponent(targetPath || "")}`);
    if (!res.ok) return;
    $("inpBrowsePath").value = res.current || "";
    state.browseParent = res.parent || "__ROOT__";

    const shortcuts = [...(res.shortcuts || []), ...(res.drives || [])];
    const bar = $("wsShortcutsBar");
    bar.innerHTML = shortcuts
      .map(
        (s) =>
          `<button type="button" class="chip-btn" data-jump="${escapeHtml(s.path)}">${escapeHtml(s.name)}</button>`
      )
      .join("");
    bar.querySelectorAll("[data-jump]").forEach((b) => {
      b.addEventListener("click", () => browseDirectory(b.dataset.jump));
    });

    const list = $("dirBrowserList");
    const items = res.dirs || [];
    if (!items.length) {
      list.innerHTML = `<div class="empty-hint" style="grid-column:1/-1;">当前目录下没有子文件夹（可直接选定此目录或在下方新建子项目名）</div>`;
      return;
    }
    list.innerHTML = items
      .map(
        (d) =>
          `<div class="dir-item" data-dirpath="${escapeHtml(d.path)}" title="${escapeHtml(d.path)}">📁 ${escapeHtml(
            d.name
          )}</div>`
      )
      .join("");
    list.querySelectorAll(".dir-item").forEach((el) => {
      el.addEventListener("click", () => browseDirectory(el.dataset.dirpath));
    });
  }

  async function confirmWorkspaceSelection() {
    const basePath = $("inpBrowsePath").value.trim();
    const createName = $("inpCreateSubdir").value.trim();
    if (!basePath) {
      showToast("请先选择或输入有效的目录路径", "warn");
      return;
    }
    const res = await apiJson("/api/workspace/select", {
      method: "POST",
      body: JSON.stringify({ path: basePath, create_name: createName }),
    });
    if (!res.ok) {
      showToast(res.error || "切换目录失败", "error");
      return;
    }
    applyServerState(res);
    $("modalWorkspace").classList.add("hidden");
    showToast(`📂 工作区已切换至: ${res.workspace_dir}`, "success");
  }

  /* -------------------- SMFT Dereference Modal -------------------- */
  async function openDerefModal(nodeId) {
    const res = await apiJson(`/api/memory/deref?node_id=${encodeURIComponent(nodeId)}`);
    const body = $("derefModalBody");
    const msgs = res.messages || [];
    body.innerHTML = msgs.length
      ? msgs
          .map(
            (m, i) =>
              `<div class="smft-node"><strong>#${i + 1} [${escapeHtml(m.role)}${
                m.name ? `:${escapeHtml(m.name)}` : ""
              }]</strong><pre style="white-space:pre-wrap;margin-top:4px;">${escapeHtml(
                m.content || JSON.stringify(m.tool_calls || [])
              )}</pre></div>`
          )
          .join("")
      : `<div class="empty-hint">未找到冷库归档记录</div>`;
    $("modalDeref").classList.remove("hidden");
  }

  /* -------------------- Event Listeners -------------------- */
  function bindEvents() {
    // Top bar controls
    $("btnOpenSettings").addEventListener("click", openSettingsModal);
    $("btnApiStatus").addEventListener("click", openSettingsModal);
    $("btnWelcomeConfig").addEventListener("click", openSettingsModal);
    $("btnOpenWorkspaceModal").addEventListener("click", openWorkspaceModal);

    $("btnWelcomeTryOffline").addEventListener("click", () => {
      $("promptInput").value = TEMPLATES.rate_limiter;
      runNeutralizer(false);
    });

    $("btnToggleTheme").addEventListener("click", () => {
      const html = document.documentElement;
      const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
    });

    // Kernel Mode Switch
    [$("btnModeBT"), $("btnModeVerbose")].forEach((btn) => {
      btn.addEventListener("click", async () => {
        const btMode = btn.dataset.mode === "bt";
        const res = await apiJson("/api/settings", {
          method: "POST",
          body: JSON.stringify({ bt_mode: btMode }),
        });
        if (res.ok) {
          applyServerState(res);
          showToast(
            btMode
              ? "⚡ 已切换至巴别语极速内核（#BT 推理 + 双平面零污染代码）"
              : "🐢 已切换至常规自然语言思考基线（可用于对比测速）",
            "info"
          );
        }
      });
    });

    // Sidebar templates & refresh
    $("btnRefreshFiles").addEventListener("click", loadFullState);
    document.querySelectorAll(".template-card").forEach((card) => {
      card.addEventListener("click", () => {
        const key = card.dataset.tpl;
        $("promptInput").value = TEMPLATES[key] || "";
        $("promptInput").focus();
        showToast("已填入实战任务模板！可先点「⚡ 巴别语中性提纯」看压缩效果，或点「🚀 派遣超级 Agent 执行」。", "info");
      });
    });

    // Neutralizer controls
    $("btnNeutralizeOnly").addEventListener("click", () => runNeutralizer(false));
    $("btnDeepLlmNeutral").addEventListener("click", () => runNeutralizer(true));
    $("btnCloseNeutralPreview").addEventListener("click", () => $("neutralizerPreview").classList.add("hidden"));
    $("btnApplyNeutral").addEventListener("click", () => {
      if (state.lastNeutralizedPrompt) {
        $("promptInput").value = state.lastNeutralizedPrompt;
        $("neutralizerPreview").classList.add("hidden");
        showToast("已将提纯后的巴别语规格填入输入框！", "success");
      }
    });
    $("btnRestoreOriginal").addEventListener("click", () => {
      if (state.lastOriginalPrompt) {
        $("promptInput").value = state.lastOriginalPrompt;
        showToast("已还原为原始中文输入", "info");
      }
    });

    // Run / Stop / Reset
    $("btnRunAgent").addEventListener("click", dispatchSuperAgent);
    $("promptInput").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        dispatchSuperAgent();
      }
    });

    $("btnStopAgent").addEventListener("click", async () => {
      await apiJson("/api/agent/stop", { method: "POST" });
      showToast("⏹️ 已发送停止指令...", "warn");
    });

    $("btnResetSession").addEventListener("click", async () => {
      const res = await apiJson("/api/agent/reset", { method: "POST" });
      applyServerState(res);
      $("executionStream").innerHTML = "";
      showToast("🧹 会话上下文已重置（磁盘已生成文件安全保留）", "info");
    });

    // Inspector tabs & manual SMFT compaction
    document.querySelectorAll(".insp-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchInspectorTab(btn.dataset.tab));
    });

    $("btnCompactNow").addEventListener("click", async () => {
      const res = await apiJson("/api/memory/compact", { method: "POST" });
      if (res.telemetry) {
        state.telemetry = res.telemetry;
        renderMemoryTelemetry();
      }
      showToast(res.compacted ? `🌳 已生成 SMFT 摘要节点 ${res.node_id}` : res.reason || "暂无需折叠", "info");
    });

    // Settings Modal controls
    $("selProvider").addEventListener("change", (e) => {
      const pid = e.target.value;
      const preset = state.presets.find((p) => p.id === pid);
      if (preset) {
        $("inpBaseUrl").value = preset.base_url;
        $("inpModel").value = preset.default_model;
        renderModelChipsForProvider(pid);
      }
    });
    $("btnProbeOllama").addEventListener("click", probeLocalOllama);
    $("btnTestConnection").addEventListener("click", testModelConnection);
    $("btnSaveSettings").addEventListener("click", saveModelSettings);

    // Workspace Modal controls
    $("btnBrowseUp").addEventListener("click", () => browseDirectory(state.browseParent || "__ROOT__"));
    $("btnBrowseGo").addEventListener("click", () => browseDirectory($("inpBrowsePath").value.trim()));
    $("btnConfirmWorkspace").addEventListener("click", confirmWorkspaceSelection);

    // Close modals
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = $(btn.dataset.close);
        if (target) target.classList.add("hidden");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    loadFullState();
  });
})();
