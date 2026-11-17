(() => {
  const state = {
    blueprints: {},
    artifacts: new Map(), // filePath -> GeneratedArtifact
    selectedFilePath: null,
    activeViewTab: 'code', // 'code' | 'header' | 'smft'
    smftSnapshot: '',
    globalLensOpen: false,
    msgCount: 0,
    isRunning: false,
  };

  const els = {
    toolchainStrip: document.getElementById('toolchainStrip'),
    promptInput: document.getElementById('projectPromptInput'),
    languageSelect: document.getElementById('languageSelect'),
    busModeSelect: document.getElementById('busModeSelect'),
    engineSelect: document.getElementById('engineSelect'),
    faultDrillCheckbox: document.getElementById('faultDrillCheckbox'),
    launchRunBtn: document.getElementById('launchRunBtn'),
    llmConfigDrawer: document.getElementById('llmConfigDrawer'),
    apiKeyGroup: document.getElementById('apiKeyGroup'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    baseUrlInput: document.getElementById('baseUrlInput'),
    modelInput: document.getElementById('modelInput'),
    ollamaStatusText: document.getElementById('ollamaStatusText'),
    detectOllamaBtn: document.getElementById('detectOllamaBtn'),
    raceBanner: document.getElementById('raceBanner'),
    controlFeedList: document.getElementById('controlFeedList'),
    msgCountPill: document.getElementById('msgCountPill'),
    toggleAllLensBtn: document.getElementById('toggleAllLensBtn'),
    workspacePathBar: document.getElementById('workspacePathBar'),
    artifactFileTree: document.getElementById('artifactFileTree'),
    activeFileTitle: document.getElementById('activeFileTitle'),
    activeFileBadges: document.getElementById('activeFileBadges'),
    artifactCodeViewer: document.getElementById('artifactCodeViewer'),
    isolationShieldBadge: document.getElementById('isolationShieldBadge'),
    purityTitle: document.getElementById('purityTitle'),
    purityDesc: document.getElementById('purityDesc'),
    purityIcon: document.getElementById('purityIcon'),
    kpiTotalSaved: document.getElementById('kpiTotalSaved'),
    kpiTotalTokensSub: document.getElementById('kpiTotalTokensSub'),
    kpiMemSaved: document.getElementById('kpiMemSaved'),
    kpiMemSub: document.getElementById('kpiMemSub'),
    kpiSpeedup: document.getElementById('kpiSpeedup'),
    kpiDurationSub: document.getElementById('kpiDurationSub'),
    kpiPurity: document.getElementById('kpiPurity'),
    kpiFilesSub: document.getElementById('kpiFilesSub'),
    raceBtVal: document.getElementById('raceBtVal'),
    raceNlVal: document.getElementById('raceNlVal'),
    raceBtBar: document.getElementById('raceBtBar'),
    raceNlBar: document.getElementById('raceNlBar'),
    stageBreakdownList: document.getElementById('stageBreakdownList'),
    verifyStatusTag: document.getElementById('verifyStatusTag'),
    compilerLogBox: document.getElementById('compilerLogBox'),
    decoderModal: document.getElementById('decoderModal'),
    openDecoderModalBtn: document.getElementById('openDecoderModalBtn'),
    closeDecoderModalBtn: document.getElementById('closeDecoderModalBtn'),
    customDecodeInput: document.getElementById('customDecodeInput'),
    runCustomDecodeBtn: document.getElementById('runCustomDecodeBtn'),
    customDecodeOutput: document.getElementById('customDecodeOutput'),
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function highlightBabelTele(raw) {
    let html = escapeHtml(raw);
    html = html.replace(
      /(#(?:PRD|ARCH|DRAFT|HDR|DIAG|FIX|PASS|CONTRACT)|§SMFT|@(?:FILE|Cls|Fn|Mod|Dep|Err))/g,
      '<span class="bt-sigil">$1</span>'
    );
    html = html.replace(/([⊢⇒⇐⟶⊥⊕⊗]|!(?:Guard|Fail))/g, '<span class="bt-op">$1</span>');
    return html;
  }

  function formatNumberedCode(codeText) {
    const lines = String(codeText ?? '').split(/\r?\n/);
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    const padWidth = String(lines.length).length;
    return lines
      .map((line, i) => `${String(i + 1).padStart(padWidth, ' ')} │ ${line}`)
      .join('\n');
  }

  function resetPipelineNodes() {
    for (const role of ['PM-Spec', 'Architect', 'Coder', 'Verifier']) {
      const node = document.getElementById(`node-${role}`);
      if (node) node.className = 'agent-node';
    }
    document.getElementById('sub-PM-Spec').textContent = '待命 · <120 tok #PRD';
    document.getElementById('sub-Architect').textContent = '待命 · #ARCH 接口契约锁';
    document.getElementById('sub-Coder').textContent = '待命 · BT-Header 跨文件记忆';
    document.getElementById('sub-Verifier').textContent = '待命 · 零污染审计 + 真编译验收';
  }

  function updateAgentNode(agent, status, detail) {
    const targetRole = agent === 'Fixer' ? 'Verifier' : agent;
    const node = document.getElementById(`node-${targetRole}`);
    const sub = document.getElementById(`sub-${targetRole}`);
    if (node) {
      node.className = `agent-node ${status}`;
    }
    if (sub && detail) {
      sub.textContent = detail;
    }
  }

  async function initHealthAndBlueprints() {
    try {
      const [healthRes, bpRes] = await Promise.all([
        fetch('/api/health').then((r) => r.json()),
        fetch('/api/blueprints').then((r) => r.json()),
      ]);

      if (healthRes.ok && healthRes.toolchains) {
        const tc = healthRes.toolchains;
        const chips = [
          `Node ${tc.node}`,
          `${tc.tsc}`,
          tc.javac ? `☕ ${tc.javac}` : 'Java AST Check',
          tc.python ? `🐍 ${tc.python}` : 'Python Check',
        ];
        els.toolchainStrip.innerHTML = chips
          .map((c) => `<span class="tc-chip">✓ ${escapeHtml(c)}</span>`)
          .join('');
      }

      if (bpRes.ok && Array.isArray(bpRes.blueprints)) {
        for (const bp of bpRes.blueprints) {
          state.blueprints[bp.language] = bp;
        }
        applyPreset('java');
      }
    } catch (err) {
      els.toolchainStrip.innerHTML = `<span class="tc-chip">服务连接异常: ${escapeHtml(err.message)}</span>`;
    }
  }

  function applyPreset(lang) {
    els.languageSelect.value = lang;
    const bp = state.blueprints[lang];
    if (bp) {
      els.promptInput.value = bp.defaultPromptZh;
    }
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.presetLang === lang);
    });
  }

  async function probeOllama() {
    els.ollamaStatusText.textContent = '正在探测 127.0.0.1:11434...';
    try {
      const res = await fetch('/api/ollama/detect').then((r) => r.json());
      els.ollamaStatusText.textContent = res.message;
      if (res.available) {
        els.baseUrlInput.value = res.baseUrl;
        if (res.models && res.models.length > 0) {
          els.modelInput.value = res.models[0];
        }
      }
    } catch {
      els.ollamaStatusText.textContent = '探测本机 Ollama 失败';
    }
  }

  function syncEngineUi() {
    const eng = els.engineSelect.value;
    if (eng === 'demo-sim') {
      els.llmConfigDrawer.classList.add('hidden');
    } else {
      els.llmConfigDrawer.classList.remove('hidden');
      if (eng === 'ollama') {
        els.apiKeyGroup.classList.add('hidden');
        els.baseUrlInput.value = 'http://127.0.0.1:11434/v1';
        els.modelInput.value = 'qwen2.5-coder:7b';
        probeOllama();
      } else {
        els.apiKeyGroup.classList.remove('hidden');
        if (els.baseUrlInput.value.includes('11434')) {
          els.baseUrlInput.value = 'https://api.deepseek.com/v1';
          els.modelInput.value = 'deepseek-chat';
        }
        els.ollamaStatusText.textContent = '兼容 DeepSeek / Qwen / OpenAI / Gemini 接口';
      }
    }
  }

  function appendControlMessage(msg, isBaselineTrack = false) {
    if (state.msgCount === 0) {
      els.controlFeedList.innerHTML = '';
    }
    state.msgCount += 1;
    els.msgCountPill.textContent = `${state.msgCount} 条指令`;

    const savedPct =
      msg.baselineVerboseTokens && msg.baselineVerboseTokens > msg.tokens
        ? Math.round(((msg.baselineVerboseTokens - msg.tokens) / msg.baselineVerboseTokens) * 100)
        : 0;

    const card = document.createElement('div');
    card.className = `msg-card agent-${msg.agent} stage-${msg.stage}${isBaselineTrack ? ' baseline-track' : ''}`;

    const trackTag = isBaselineTrack
      ? '<span class="msg-file-pill" style="color:#fcd34d">对照组 Verbose-NL</span>'
      : '';
    const fileTag = msg.targetFile
      ? `<span class="msg-file-pill">${escapeHtml(msg.targetFile)}</span>`
      : '';
    const savedHtml =
      savedPct > 0 && msg.busMode === 'babeltele'
        ? `<span class="saved-badge">-${savedPct}% vs NL</span>`
        : '';

    const lensOpen = state.globalLensOpen;

    card.innerHTML = `
      <div class="msg-top">
        <div class="msg-agent-tag">
          <span>[${escapeHtml(msg.agent)}]</span>
          ${trackTag}
          ${fileTag}
        </div>
        <div class="msg-meta">
          <span class="tok-badge">${msg.tokens} tok</span>
          ${savedHtml}
          <button type="button" class="lens-btn ${lensOpen ? 'active' : ''}">👁️ 中文透视</button>
        </div>
      </div>
      <div class="msg-raw">${msg.busMode === 'babeltele' ? highlightBabelTele(msg.rawContent) : escapeHtml(msg.rawContent)}</div>
      <div class="msg-lens-box ${lensOpen ? '' : 'hidden'}">${escapeHtml(msg.humanZh)}</div>
    `;

    const lensBtn = card.querySelector('.lens-btn');
    const lensBox = card.querySelector('.msg-lens-box');
    lensBtn.addEventListener('click', async () => {
      const willOpen = lensBox.classList.contains('hidden');
      if (willOpen && !lensBox.textContent.trim()) {
        const res = await fetch('/api/decode-msg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: msg.rawContent }),
        }).then((r) => r.json());
        if (res.ok) {
          lensBox.textContent = res.decoded.decodedZh;
        }
      }
      lensBox.classList.toggle('hidden', !willOpen);
      lensBtn.classList.toggle('active', willOpen);
    });

    els.controlFeedList.appendChild(card);
    els.controlFeedList.scrollTop = els.controlFeedList.scrollHeight;
  }

  function renderFileTree() {
    const entries = Array.from(state.artifacts.values());
    if (entries.length === 0) {
      els.artifactFileTree.innerHTML = '<div class="tree-empty">暂无生成文件</div>';
      return;
    }

    els.artifactFileTree.innerHTML = '';
    for (const art of entries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `file-item ${state.selectedFilePath === art.filePath ? 'active' : ''}`;

      const cleanBadge = art.sanitizer.clean
        ? `<span class="clean-dot">${art.healedIterations > 0 ? '🩹 自愈净' : '0污染 ✓'}</span>`
        : `<span class="polluted-dot">⚠ ${art.sanitizer.babelTeleLeakageCount} 泄漏</span>`;

      btn.innerHTML = `
        <div class="file-item-name">${escapeHtml(art.filePath)}</div>
        <div class="file-item-meta">
          <span>${art.lines} 行 · -${art.btHeaderDigest.savedPercent}% HDR</span>
          ${cleanBadge}
        </div>
      `;
      btn.addEventListener('click', () => {
        state.selectedFilePath = art.filePath;
        renderFileTree();
        renderArtifactViewer();
      });
      els.artifactFileTree.appendChild(btn);
    }
  }

  function renderArtifactViewer() {
    if (state.activeViewTab === 'smft') {
      els.activeFileTitle.textContent = '§SMFT 跨文件符号记忆池全局快照 (Plane 1 Memory)';
      els.activeFileBadges.innerHTML = `<span class="saved-badge">替代全量源码硬塞 · 节省 ~86% 上下文</span>`;
      els.artifactCodeViewer.textContent =
        state.smftSnapshot || '// 尚未索引任何文件的 BT-Header';
      return;
    }

    const art = state.selectedFilePath ? state.artifacts.get(state.selectedFilePath) : null;
    if (!art) {
      els.activeFileTitle.textContent = '选择左侧源码文件查看';
      els.activeFileBadges.innerHTML = '';
      return;
    }

    if (state.activeViewTab === 'code') {
      els.activeFileTitle.textContent = `${art.filePath} (纯净原生源码 · ${art.lines} 行)`;
      const purityTag = art.sanitizer.clean
        ? `<span class="saved-badge">0 BabelTele 泄漏 ✓</span>`
        : `<span class="tok-badge" style="color:#fda4af;border-color:#f43f5e">拦截到 ${art.sanitizer.babelTeleLeakageCount} 处控制符泄漏</span>`;
      els.activeFileBadges.innerHTML = `
        <span class="tok-badge">源码 ${art.rawTokens} tok</span>
        ${purityTag}
      `;
      els.artifactCodeViewer.textContent = formatNumberedCode(art.content);
    } else {
      const d = art.btHeaderDigest;
      els.activeFileTitle.textContent = `${art.filePath} → BT-Header 符号签名摘要`;
      els.activeFileBadges.innerHTML = `
        <span class="tok-badge">摘要仅 ${d.headerTokens} tok (原文件 ${d.rawTokens} tok)</span>
        <span class="saved-badge">压缩率 ${Math.round(d.compressionRatio * 100)}% · 省 ${d.savedPercent}%</span>
      `;
      els.artifactCodeViewer.textContent = [
        '/* === Plane 1: 供下游 Coder 跨文件引用的机械提取 BT-Header === */',
        d.btHeader,
        '',
        '/* === Sidecar 中文结构化解读 === */',
        d.humanSummaryZh,
        '',
        `模块/包路径 : ${d.moduleOrPackage}`,
        `导出类型数   : ${d.types.length}`,
        ...d.types.map(
          (t) =>
            `  - [${t.kind}] ${t.name}${t.methods.length ? '\n      方法签名: ' + t.methods.join(', ') : ''}`
        ),
        ...(d.functions.length ? [`顶层导出函数 : ${d.functions.join(', ')}`] : []),
      ].join('\n');
    }
  }

  function updateRaceBars(btTok, nlTok) {
    els.raceBtVal.textContent = `${btTok} tok`;
    els.raceNlVal.textContent = `${nlTok} tok`;
    const maxTok = Math.max(1, btTok, nlTok);
    els.raceBtBar.style.width = `${Math.max(4, Math.round((btTok / maxTok) * 100))}%`;
    els.raceNlBar.style.width = `${Math.max(4, Math.round((nlTok / maxTok) * 100))}%`;
  }

  function renderVerificationReport(rep) {
    els.verifyStatusTag.textContent = rep.passed ? `PASS (Iter #${rep.iteration})` : `HEALING (Iter #${rep.iteration})`;
    els.verifyStatusTag.className = `verify-status-tag ${rep.passed ? 'pass' : 'fail'}`;

    if (rep.zeroBabelTeleLeakage) {
      els.isolationShieldBadge.textContent = '🛡️ 0 BabelTele Leakage ✓';
      els.isolationShieldBadge.className = 'isolation-shield';
      els.purityIcon.textContent = '🛡️';
      els.purityTitle.textContent = '双平面零污染审计通过（0 巴别语符号残留）';
      els.purityDesc.textContent = rep.humanSummaryZh;
    } else {
      els.isolationShieldBadge.textContent = `⚠️ 拦截 ${rep.totalLeakageCount} 处污染 → 自愈中`;
      els.isolationShieldBadge.className = 'isolation-shield alert';
      els.purityIcon.textContent = '🩹';
      els.purityTitle.textContent = 'ArtifactSanitizer 成功拦截控制符泄漏，已触发 Fixer 热修复！';
      els.purityDesc.textContent = rep.humanSummaryZh;
    }

    const logLines = [
      `[Gate 1 · Sanitizer] Zero-Pollution=${rep.zeroBabelTeleLeakage} (Leaks=${rep.totalLeakageCount}, Files=${rep.filesChecked})`,
      `[Gate 2 · Toolchain] ${rep.toolchainUsed}`,
    ];
    if (rep.compilerStdout) logLines.push(rep.compilerStdout);
    if (rep.compilerStderr) logLines.push(`[STDERR]\n${rep.compilerStderr}`);
    els.compilerLogBox.textContent = logLines.join('\n\n');
  }

  function applyAbComparison(ab, result) {
    if (!ab) return;
    els.kpiTotalSaved.textContent = `-${ab.totalBusAndMemoryReductionPercent}%`;
    els.kpiTotalTokensSub.textContent = `${ab.babeltele.totalBusAndMemoryTokens} vs ${ab.verboseNl.totalBusAndMemoryTokens} tok`;

    els.kpiMemSaved.textContent = `-${ab.babeltele.memoryTokensSavedPercent}%`;
    els.kpiMemSub.textContent = `${ab.babeltele.memoryContextTokensUsed} vs ${ab.babeltele.rawMemoryContextWouldBe} tok`;

    els.kpiSpeedup.textContent = `${ab.speedupMultiplier}x`;
    els.kpiDurationSub.textContent = `控制流立省 ${ab.controlTokenReductionPercent}%`;

    if (result) {
      els.kpiPurity.textContent = result.finalVerification.zeroBabelTeleLeakage ? '100%' : 'ERR';
      els.kpiFilesSub.textContent = `${result.artifacts.length} 个源码文件 · ${result.telemetry.artifactTokens} 原生 tok`;
    }

    updateRaceBars(ab.babeltele.totalBusAndMemoryTokens, ab.verboseNl.totalBusAndMemoryTokens);

    if (Array.isArray(ab.stageBreakdown) && ab.stageBreakdown.length > 0) {
      els.stageBreakdownList.innerHTML = ab.stageBreakdown
        .map(
          (st) => `
          <div class="stage-row">
            <span>${escapeHtml(st.stageLabelZh)}</span>
            <span class="stage-nums">
              <strong style="color:#34d399">${st.btTokens}</strong> vs ${st.nlTokens} tok
              <span style="color:#22d3ee">(-${st.savedPercent}%)</span>
            </span>
          </div>
        `
        )
        .join('');
    }
  }

  async function startStreamingRun() {
    if (state.isRunning) return;
    state.isRunning = true;
    els.launchRunBtn.disabled = true;
    els.launchRunBtn.textContent = '⏳ 正在双平面极速构建与真机编译验收中...';

    // Reset state for new run
    state.artifacts.clear();
    state.selectedFilePath = null;
    state.smftSnapshot = '';
    state.msgCount = 0;
    els.controlFeedList.innerHTML = '';
    els.msgCountPill.textContent = '0 条指令';
    els.compilerLogBox.textContent = '正在启动 4-Agent 双平面流水线...';
    els.verifyStatusTag.textContent = 'RUNNING';
    els.verifyStatusTag.className = 'verify-status-tag';
    resetPipelineNodes();
    renderFileTree();

    const payload = {
      prompt: els.promptInput.value.trim(),
      language: els.languageSelect.value,
      busMode: els.busModeSelect.value,
      engine: els.engineSelect.value,
      injectFaultDrill: els.faultDrillCheckbox.checked,
      apiKey: els.apiKeyInput.value.trim() || undefined,
      baseUrl: els.baseUrlInput.value.trim() || undefined,
      model: els.modelInput.value.trim() || undefined,
    };

    try {
      const response = await fetch('/api/runs/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundaryIdx;
        while ((boundaryIdx = buffer.indexOf('\n\n')) !== -1) {
          const rawPacket = buffer.slice(0, boundaryIdx);
          buffer = buffer.slice(boundaryIdx + 2);

          let eventName = 'message';
          let dataStr = '';
          for (const line of rawPacket.split(/\r?\n/)) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr += line.slice(5).trim();
            }
          }
          if (!dataStr) continue;
          const data = JSON.parse(dataStr);
          handleSseEvent(eventName, data);
        }
      }
    } catch (err) {
      els.raceBanner.textContent = `❌ 运行异常: ${err.message}`;
      els.compilerLogBox.textContent = `运行出错: ${err.message}`;
    } finally {
      state.isRunning = false;
      els.launchRunBtn.disabled = false;
      els.launchRunBtn.textContent = '⚡ 运行极速推进实战演练 / AB 竞速对比';
    }
  }

  function handleSseEvent(eventName, data) {
    if (eventName === 'race-phase') {
      els.raceBanner.textContent = data.labelZh;
      return;
    }

    if (eventName === 'run-start') {
      els.workspacePathBar.innerHTML = `📁 磁盘工作区：<code>${escapeHtml(data.workspacePath)}</code>`;
      els.raceBanner.textContent = `🚀 正在推进 [${data.language.toUpperCase()}] · 总线模式: ${data.busMode}`;
      return;
    }

    if (eventName === 'agent-status') {
      updateAgentNode(data.agent, data.status, data.detail);
      return;
    }

    if (eventName === 'control-msg') {
      appendControlMessage(data.message, false);
      return;
    }

    if (eventName === 'race-baseline-event') {
      if (data.type === 'control-msg') {
        appendControlMessage(data.message, true);
      } else if (data.type === 'agent-status') {
        els.raceBanner.textContent = `📝 对照组 [Verbose NL] ${data.agent}: ${data.detail}`;
      }
      return;
    }

    if (eventName === 'artifact-written') {
      const art = data.artifact;
      state.artifacts.set(art.filePath, art);
      state.smftSnapshot = data.smftPoolSnapshot || state.smftSnapshot;
      if (!state.selectedFilePath) {
        state.selectedFilePath = art.filePath;
      }
      renderFileTree();
      renderArtifactViewer();
      return;
    }

    if (eventName === 'verification-report') {
      renderVerificationReport(data.report);
      return;
    }

    if (eventName === 'ab-progress') {
      updateRaceBars(data.btTokensSoFar, data.nlTokensSoFar);
      return;
    }

    if (eventName === 'run-complete') {
      const res = data.result;
      if (res.abComparison) {
        applyAbComparison(res.abComparison, res);
      }
      els.raceBanner.textContent = `✅ 构建验收完成 (${res.telemetry.durationMs}ms · 0 巴别语污染 · ${res.artifacts.length} 文件编译全绿)`;
      return;
    }

    if (eventName === 'race-complete') {
      applyAbComparison(data.abComparison, null);
      els.raceBanner.textContent = `🏆 双模式同台竞速完成！巴别语总线总开销立省 ${data.abComparison.totalBusAndMemoryReductionPercent}%，实测加速 ${data.abComparison.speedupMultiplier}x！`;
      return;
    }

    if (eventName === 'run-error') {
      els.raceBanner.textContent = `❌ 错误: ${data.error}`;
      els.compilerLogBox.textContent = `[ERROR] ${data.error}`;
    }
  }

  // Event Listeners
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.presetLang));
  });

  els.languageSelect.addEventListener('change', () => {
    const bp = state.blueprints[els.languageSelect.value];
    if (bp) {
      els.promptInput.value = bp.defaultPromptZh;
      document.querySelectorAll('.preset-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.presetLang === els.languageSelect.value);
      });
    }
  });

  els.engineSelect.addEventListener('change', syncEngineUi);
  els.detectOllamaBtn.addEventListener('click', probeOllama);
  els.launchRunBtn.addEventListener('click', startStreamingRun);

  els.toggleAllLensBtn.addEventListener('click', () => {
    state.globalLensOpen = !state.globalLensOpen;
    els.toggleAllLensBtn.textContent = state.globalLensOpen ? '🙈 收起中文透视' : '👁️ 全部中文透视';
    document.querySelectorAll('.msg-card').forEach((card) => {
      const box = card.querySelector('.msg-lens-box');
      const btn = card.querySelector('.lens-btn');
      if (box && btn) {
        box.classList.toggle('hidden', !state.globalLensOpen);
        btn.classList.toggle('active', state.globalLensOpen);
      }
    });
  });

  document.querySelectorAll('.tab-btn').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.activeViewTab = tab.dataset.viewTab;
      document.querySelectorAll('.tab-btn').forEach((b) =>
        b.classList.toggle('active', b.dataset.viewTab === state.activeViewTab)
      );
      renderArtifactViewer();
    });
  });

  // Sidecar Decoder Modal
  async function runModalDecode() {
    const text = els.customDecodeInput.value;
    const res = await fetch('/api/decode-msg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then((r) => r.json());
    if (res.ok) {
      els.customDecodeOutput.textContent = `${res.decoded.decodedZh}\n\n[精确 o200k_base Token 计量：${res.decoded.tokens} tokens]`;
    }
  }

  els.openDecoderModalBtn.addEventListener('click', () => {
    els.decoderModal.classList.remove('hidden');
    runModalDecode();
  });
  els.closeDecoderModalBtn.addEventListener('click', () => {
    els.decoderModal.classList.add('hidden');
  });
  els.runCustomDecodeBtn.addEventListener('click', runModalDecode);

  initHealthAndBlueprints();
})();
