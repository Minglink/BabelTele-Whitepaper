/**
 * Browser UI Mod for DeepSeek Harness (`@babeltele/dsh-plugin/client`).
 * Loaded natively by `@deepseek-ai/dsh-client-modules` over `/plugins` and
 * integrated directly into DSH's official React Slot & Store architecture.
 */
window.__ModuleLoader__.load({
  id: '@babeltele/dsh-plugin',
  factory(require) {
    const React = require('react')
    const { Button, Tooltip } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    const NS = 'babelteleUi'

    /* Instant <0.2ms client-side Sidecar Chinese decoder for live streaming #BT reasoning */
    function decodeBtToZhClient(text) {
      if (!text) return ''
      const pairs = [
        ['#BT', '【硅基思考】'],
        ['#Task', '【工程任务】'],
        ['#Plan', '【实施规划】'],
        ['#Diag', '【根因定位】'],
        ['#Fix', '【修复动作】'],
        ['#Verify', '【测试验收】'],
        ['#SubReport', '【子智能体回执】'],
        ['[SMFT-T1]', '【SMFT 默克尔检查点】'],
        ['?missing', '若缺失则'],
        ['?err', '若报错则'],
        ['?ok', '校验通过则'],
        ['!禁止:', '【严禁】'],
        ['!exc:', '【豁免排除】'],
        ['=>', ' ➔ 推导执行：'],
        ['->', ' → 随后 '],
        [' & ', ' 且 '],
      ]
      let out = String(text)
      for (const [k, v] of pairs) out = out.split(k).join(v)
      return out
    }

    function looksLikeBt(text) {
      return /(?:#BT|#Task|#Plan|#Diag|#Fix|#Verify|\[SMFT-T1\]|=>|->|!禁止:|!exc:)/.test(String(text || ''))
    }

    /* Shared lightweight reactive store syncing with `/babeltele-api/*` */
    function createBtClientStore() {
      const listeners = new Set()
      let state = {
        prefs: {
          btEnabled: true,
          autoNeutralizeOnSend: false,
          defaultSidecarOpen: true,
          injectBtHeaders: true,
          strictCodeGuard: true,
        },
        telemetry: {
          promptsNeutralized: 0,
          inputTokensSaved: 0,
          reasoningStepsObserved: 0,
          estimatedReasoningTokensSaved: 0,
          totalTokensSaved: 0,
          filesAudited: 0,
          pureFilesVerified: 0,
          blockedPollutedWrites: 0,
          smftCompactions: 0,
          purityRatePct: 100,
          recentFileAudits: [],
        },
        templates: [
          {
            id: 'rate_limiter',
            title: '🧪 口水话脱水 + Python 限流器与单测闭环',
            prompt:
              '你好啊麻烦帮我一下！我真是服了这破系统总是被恶意刷接口，老板又在催命一样逼着改！能不能帮我在当前工作区写一个生产级 Python 令牌桶与滑动窗口限流模块 rate_limiter.py，如果出现单 IP 每秒请求大于等于 20 次那么就必须立即拦截返回 False，并且要求支持白名单豁免（严禁误拦 127.0.0.1 和 /health 健康检查路径），然后再写一个完整的单元测试文件 test_rate_limiter.py 并用终端运行 python -m unittest 验证全部通过！万分感谢辛苦了！',
          },
          {
            id: 'java_dual_plane',
            title: '🛡️ 双平面零污染验证 (Java 17 + 可视化页)',
            prompt:
              '请在当前工作区创建一个标准 Java 17 订单风控校验器 OrderValidator.java（含单笔金额上限 50000.00 校验、必填字段非空检查与 VIP 免审白名单逻辑，要求 100% 标准 Java 语法与清晰 Javadoc 注释），同时编写配套的交互式演示页 order_demo.html，验证思考层用 #BT 极速推进而落盘工程代码零污染。',
          },
          {
            id: 'subagent_smft',
            title: '🐝 Subagent 子智能体协同巡检 + 边界审计',
            prompt:
              '请先扫描当前工作区的代码结构与边界条件，委派 subagent 子智能体对现有代码进行异常处理、安全边界与测试覆盖率专项审计，汇总整改清单并用简洁中文向我汇报。',
          },
        ],
        dockMode: null, // null | 'neutralized' | 'templates'
        neutralResult: null,
        busyNeutralizing: false,
        notice: '',
      }

      const emit = () => {
        for (const fn of [...listeners]) fn()
      }

      const store = {
        getSnapshot: () => state,
        subscribe: (fn) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        setLocal(patch) {
          state = { ...state, ...patch }
          emit()
        },
        async refresh() {
          try {
            const resp = await fetch('babeltele-api/state', { credentials: 'same-origin' })
            if (!resp.ok) return
            const data = await resp.json()
            if (data && data.ok) {
              state = {
                ...state,
                prefs: data.prefs || state.prefs,
                telemetry: data.telemetry || state.telemetry,
                templates: Array.isArray(data.templates) && data.templates.length ? data.templates : state.templates,
              }
              emit()
            }
          } catch {
            // ignore transient network error during reconnect
          }
        },
        async updatePrefs(patch) {
          const optimistic = { ...state.prefs, ...patch }
          state = { ...state, prefs: optimistic }
          emit()
          try {
            const resp = await fetch('babeltele-api/settings', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch),
            })
            if (resp.ok) {
              const data = await resp.json()
              if (data && data.ok) {
                state = {
                  ...state,
                  prefs: data.prefs || optimistic,
                  telemetry: data.telemetry || state.telemetry,
                }
                emit()
              }
            }
          } catch {
            // keep optimistic state
          }
        },
        async neutralize(rawText, useLlm = false) {
          state = { ...state, busyNeutralizing: true, notice: '' }
          emit()
          try {
            const resp = await fetch('babeltele-api/neutralize', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: rawText, useLlm }),
            })
            const data = await resp.json()
            if (!data.ok) {
              state = { ...state, busyNeutralizing: false, notice: data.error || '提纯失败' }
              emit()
              return null
            }
            state = {
              ...state,
              busyNeutralizing: false,
              dockMode: 'neutralized',
              neutralResult: data,
              telemetry: data.state?.telemetry || state.telemetry,
            }
            emit()
            return data
          } catch (err) {
            state = { ...state, busyNeutralizing: false, notice: String(err) }
            emit()
            return null
          }
        },
      }
      return store
    }

    const btStore = createBtClientStore()

    function useBtStore() {
      return React.useSyncExternalStore(btStore.subscribe, btStore.getSnapshot)
    }

    /* Custom BabelTele Silicon Tower SVG Mark (compliant with DSH Brand Guidelines) */
    function BabelTeleSvg({ size = 24, className }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 32 32',
          fill: 'none',
          className,
          style: { flexShrink: 0, display: 'block' },
          'aria-hidden': 'true',
        },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'btGrad', x1: '0', y1: '0', x2: '32', y2: '32', gradientUnits: 'userSpaceOnUse' },
            h('stop', { offset: '0%', stopColor: '#0ea5e9' }),
            h('stop', { offset: '100%', stopColor: '#8b5cf6' }),
          ),
        ),
        h('rect', { x: '2', y: '2', width: '28', height: '28', rx: '8', fill: 'url(#btGrad)' }),
        h('path', {
          d: 'M17.8 7L10.5 17.2H15.6L14.2 25L21.5 14.8H16.4L17.8 7Z',
          fill: '#ffffff',
        }),
      )
    }

    function SidebarBrandMark({ size = 24 }) {
      return h(BabelTeleSvg, { size })
    }

    function SidebarBrandName() {
      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          },
        },
        h('span', null, 'BabelTele'),
        h(
          'span',
          {
            style: {
              fontSize: 10.5,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(139, 92, 246, 0.16)',
              color: '#8b5cf6',
              border: '1px solid rgba(139, 92, 246, 0.32)',
            },
          },
          'DSH · BT-v1.0',
        ),
      )
    }

    function HeroBrandMark({ size = 44, className }) {
      return h(BabelTeleSvg, { size, className })
    }

    function HeroFrame({ hero, children }) {
      return h(
        'div',
        { style: { position: 'relative', width: '100%', height: '100%' } },
        hero
          ? h('div', {
              'aria-hidden': 'true',
              style: {
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background:
                  'radial-gradient(620px circle at 50% 18%, rgba(14, 165, 233, 0.08), rgba(139, 92, 246, 0.04) 45%, transparent 75%)',
              },
            })
          : null,
        children,
      )
    }

    /* Session Header Live Telemetry & Kernel Toggle Pill */
    function SessionHeaderPill() {
      const snap = useBtStore()
      const enabled = snap.prefs.btEnabled
      const saved = snap.telemetry.totalTokensSaved || 0
      const purity = snap.telemetry.purityRatePct ?? 100

      return h(
        Tooltip,
        {
          label: enabled
            ? `巴别语极速内核运行中 · 累计省流 ${saved} tok · 双平面代码纯净度 ${purity}%（点击可切换至自然语言对照基线）`
            : '当前为常规自然语言思考基线（点击重新开启巴别语 #BT 极速内核）',
          side: 'bottom',
        },
        h(
          'button',
          {
            type: 'button',
            'data-bt-header-pill': '',
            onClick: () => btStore.updatePrefs({ btEnabled: !enabled }),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 999,
              border: enabled
                ? '1px solid rgba(14, 165, 233, 0.4)'
                : '1px solid rgba(148, 163, 184, 0.35)',
              background: enabled
                ? 'rgba(14, 165, 233, 0.11)'
                : 'rgba(148, 163, 184, 0.1)',
              color: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            },
          },
          h('span', null, enabled ? '⚡ BT极速内核' : '🐢 常规基线'),
          saved > 0
            ? h(
                'span',
                { style: { opacity: 0.82, fontWeight: 500, fontSize: 11 } },
                `省 ${saved} tok`,
              )
            : null,
          h(
            'span',
            {
              style: {
                fontSize: 10.5,
                color: '#10b981',
                fontWeight: 600,
              },
            },
            `🛡️${purity}%`,
          ),
        ),
      )
    }

    /* Composer Right Toolbar Button: `⚡ 巴别语提纯` + `🧪 模板` */
    function ComposerBtControls(props) {
      const snap = useBtStore()
      const draft = props.useInput ? props.useInput(s => s.draft) : ''
      const phase = props.useInput ? props.useInput(s => s.phase) : 'plain'
      const locked = phase !== 'plain'

      const onNeutralizeClick = () => {
        const trimmed = String(draft || '').trim()
        if (!trimmed) {
          btStore.setLocal({
            dockMode: snap.dockMode === 'templates' ? null : 'templates',
          })
          return
        }
        btStore.neutralize(trimmed, false)
      }

      return h(
        'div',
        { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
        h(
          Tooltip,
          {
            label: String(draft || '').trim()
              ? '⚡ 一键将输入框中的口水话/中文需求离线提纯为中性巴别语，并锁定数字与路径锚点'
              : '🧪 输入框为空：点击展开巴别语超级 Agent 一键实战模板',
            side: 'top',
          },
          h(
            Button,
            {
              size: 'sm',
              variant: 'ghost',
              disabled: locked || snap.busyNeutralizing,
              'data-bt-neutralize-btn': '',
              onClick: onNeutralizeClick,
            },
            snap.busyNeutralizing
              ? '⏳ 提纯中...'
              : String(draft || '').trim()
                ? '⚡ 巴别语提纯'
                : '⚡ 巴别语模板',
          ),
        ),
      )
    }

    /* Composer Input Dock: Live Neutralizer Audit Card & Starter Templates */
    function ComposerInputDock(props) {
      const snap = useBtStore()
      const inputActions = props.inputActions

      if (!snap.dockMode) return null

      if (snap.dockMode === 'templates') {
        return h(
          'div',
          {
            'data-bt-templates-dock': '',
            style: {
              marginBottom: 8,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(14, 165, 233, 0.35)',
              background: 'rgba(14, 165, 233, 0.07)',
              fontSize: 12.5,
            },
          },
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              },
            },
            h(
              'strong',
              { style: { fontWeight: 600 } },
              '🚀 巴别语超级 Agent 实战测试模板（点击一键填入输入框）',
            ),
            h(
              Button,
              {
                size: 'sm',
                variant: 'ghost',
                onClick: () => btStore.setLocal({ dockMode: null }),
              },
              '✕ 关闭',
            ),
          ),
          h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
            snap.templates.map(tpl =>
              h(
                Button,
                {
                  key: tpl.id,
                  size: 'sm',
                  variant: 'outline',
                  onClick: () => {
                    if (inputActions?.setDraft) {
                      inputActions.setDraft(tpl.prompt)
                    }
                    btStore.setLocal({ dockMode: null })
                  },
                },
                tpl.title,
              ),
            ),
          ),
        )
      }

      const res = snap.neutralResult
      if (!res) return null
      const b = res.budget || {}
      const aud = res.audit || {}

      return h(
        'div',
        {
          'data-bt-neutralizer-dock': '',
          style: {
            marginBottom: 8,
            padding: '10px 13px',
            borderRadius: 12,
            border: '1px solid rgba(139, 92, 246, 0.42)',
            background: 'rgba(139, 92, 246, 0.08)',
            fontSize: 12.5,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 6,
            },
          },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('strong', null, '⚡ 巴别语中性提纯预览'),
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.16)',
                  color: '#10b981',
                  fontWeight: 600,
                },
              },
              `${b.sourceTokens} ➔ ${b.btTokens} tok (${b.savedTokens >= 0 ? `省 ${b.savingsPct}%` : '短句防膨胀保护'})`,
            ),
            h(
              'span',
              {
                style: {
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: 'rgba(14, 165, 233, 0.15)',
                  color: '#0ea5e9',
                  fontWeight: 600,
                },
              },
              aud.passed
                ? `🔒 锚点硬锁 ${aud.totalAnchors}/${aud.totalAnchors}`
                : '🔒 锚点已自动补锁',
            ),
            h('span', { style: { fontSize: 11, opacity: 0.7 } }, `${res.engine} · ${res.elapsedMs}ms`),
          ),
          h(
            Button,
            {
              size: 'sm',
              variant: 'ghost',
              onClick: () => btStore.setLocal({ dockMode: null }),
            },
            '✕',
          ),
        ),
        h(
          'pre',
          {
            style: {
              margin: '6px 0',
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.22)',
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 110,
              overflowY: 'auto',
            },
          },
          res.babeltele,
        ),
        aud.matched && aud.matched.length > 0
          ? h(
              'div',
              { style: { fontSize: 11.5, opacity: 0.8, marginBottom: 8 } },
              `已精确保留硬锚点：${aud.matched.join(' · ')}`,
            )
          : null,
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h(
            Button,
            {
              size: 'sm',
              variant: 'primary',
              onClick: () => {
                if (inputActions?.setDraft) {
                  inputActions.setDraft(res.babeltele)
                }
                btStore.setLocal({ dockMode: null })
              },
            },
            '✅ 填入输入框',
          ),
          h(
            Button,
            {
              size: 'sm',
              variant: 'outline',
              onClick: () => {
                if (inputActions?.setDraft) {
                  inputActions.setDraft(res.babeltele)
                  setTimeout(() => {
                    try {
                      inputActions.submit?.()
                    } catch {
                      // user can press Enter if model not selected yet
                    }
                  }, 30)
                }
                btStore.setLocal({ dockMode: null })
              },
            },
            '🚀 提纯并立即发送',
          ),
          h(
            Button,
            {
              size: 'sm',
              variant: 'ghost',
              disabled: snap.busyNeutralizing,
              onClick: () => btStore.neutralize(res.original, true),
            },
            '🧠 用当前大模型深度提纯',
          ),
          h(
            Button,
            {
              size: 'sm',
              variant: 'ghost',
              onClick: () => {
                if (inputActions?.setDraft && res.original) {
                  inputActions.setDraft(res.original)
                }
              },
            },
            '↩️ 还原原话',
          ),
        ),
      )
    }

    /* Native Reasoning Block Sidecar Lens (`conversation.chat.reasoning.body`, priority 10) */
    function BabelTeleReasoningBody(props) {
      const { text, running, renderFactorySlot } = props
      const snap = useBtStore()
      const hasBt = looksLikeBt(text)
      const [showDecoded, setShowDecoded] = React.useState(false)

      const decoded = React.useMemo(() => decodeBtToZhClient(text), [text])
      const displayText = showDecoded ? decoded : text

      return h(
        'div',
        { 'data-bt-reasoning-lens': '' },
        hasBt || snap.prefs.btEnabled
          ? h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 6,
                  paddingBottom: 4,
                  borderBottom: '1px dashed rgba(148, 163, 184, 0.22)',
                  fontSize: 11.5,
                },
              },
              h(
                'span',
                { style: { opacity: 0.78, fontWeight: 600 } },
                hasBt ? '⚡ #BT 硅基高密度推理流' : '🧠 推理思维链',
              ),
              h(
                Button,
                {
                  size: 'sm',
                  variant: 'ghost',
                  onClick: () => setShowDecoded(v => !v),
                },
                showDecoded ? '⚡ 查看 #BT 硅基原文' : '👁️ 中文人话透视',
              ),
            )
          : null,
        renderFactorySlot('conversation.chat.reasoning.content', {
          text: displayText,
          running,
        }),
      )
    }

    /* Dedicated Settings Page inside DSH Native Settings Modal (`settings.section`) */
    function BabelTeleSettingsPage() {
      const snap = useBtStore()
      const p = snap.prefs
      const tel = snap.telemetry

      const toggleRow = (key, title, desc) =>
        h(
          'div',
          {
            key,
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.22)',
              marginBottom: 10,
            },
          },
          h(
            'div',
            null,
            h('div', { style: { fontWeight: 600, fontSize: 13.5, marginBottom: 2 } }, title),
            h('div', { style: { fontSize: 12, opacity: 0.72 } }, desc),
          ),
          h(
            Button,
            {
              size: 'sm',
              variant: p[key] ? 'primary' : 'outline',
              onClick: () => btStore.updatePrefs({ [key]: !p[key] }),
            },
            p[key] ? '已开启 ✓' : '已关闭',
          ),
        )

      return h(
        'div',
        { style: { padding: '8px 4px', maxWidth: 680 } },
        h(
          'div',
          { style: { marginBottom: 16 } },
          h('h3', { style: { fontSize: 17, fontWeight: 700, marginBottom: 4 } }, '⚡ 巴别语超级内核 (BabelTele BT-Spec v1.0)'),
          h(
            'p',
            { style: { fontSize: 12.5, opacity: 0.78, lineHeight: 1.55 } },
            '基于 DeepSeek Harness (DSH) Cordis 插件底座深度构建：控制面与思考链采用高密度巴别语极速推理，落盘工程源码经双平面卫士严格隔离，确保 100% 原生纯净代码。',
          ),
        ),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
              marginBottom: 18,
            },
          },
          h(
            'div',
            { style: { padding: 12, borderRadius: 10, border: '1px solid rgba(14, 165, 233, 0.35)', background: 'rgba(14, 165, 233, 0.08)' } },
            h('div', { style: { fontSize: 11.5, opacity: 0.75 } }, '累计节省 Tokens'),
            h('div', { style: { fontSize: 20, fontWeight: 700, marginTop: 2 } }, `${tel.totalTokensSaved} tok`),
          ),
          h(
            'div',
            { style: { padding: 12, borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.35)', background: 'rgba(16, 185, 129, 0.08)' } },
            h('div', { style: { fontSize: 11.5, opacity: 0.75 } }, '双平面源码纯净度'),
            h('div', { style: { fontSize: 20, fontWeight: 700, marginTop: 2, color: '#10b981' } }, `${tel.purityRatePct}% (${tel.pureFilesVerified}/${tel.filesAudited})`),
          ),
          h(
            'div',
            { style: { padding: 12, borderRadius: 10, border: '1px solid rgba(139, 92, 246, 0.35)', background: 'rgba(139, 92, 246, 0.08)' } },
            h('div', { style: { fontSize: 11.5, opacity: 0.75 } }, 'SMFT 默克尔压缩次数'),
            h('div', { style: { fontSize: 20, fontWeight: 700, marginTop: 2 } }, `${tel.smftCompactions} 次`),
          ),
        ),
        toggleRow(
          'btEnabled',
          '⚡ 启用 BT-Spec v1.0 双平面极速内核',
          '开启后，Agent 内部推理、子智能体委派与 /compact 压缩采用高密度巴别语；关闭则退回常规冗长自然语言基线。',
        ),
        toggleRow(
          'autoNeutralizeOnSend',
          '🧹 发送人类消息时自动脱水剥离口水话',
          '在发送前毫秒级剥离寒暄与情绪宣泄词，并通过 Tier-1 锚点锁 100% 保留精确数值、路径与严禁边界。',
        ),
        toggleRow(
          'injectBtHeaders',
          '🗂️ 自动注入工作区跨文件 BT-Header 拓扑签名',
          '自动提取当前工作区 Python / Java / TS / Go / Rust 函数与类签名摘要（省约 80% 跨文件上下文读取）。',
        ),
        toggleRow(
          'strictCodeGuard',
          '🛡️ 启用 ArtifactSanitizer 源码零污染强拦截门禁',
          '在 write / edit 落盘前实时扫描代码文件，严禁任何 #BT 或巴别语控制符号混入工程源码。',
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() =>
          ctx.locale.register(NS, {
            zh: { sectionLabel: '⚡ 巴别语内核 (BabelTele)' },
            en: { sectionLabel: '⚡ BabelTele Kernel' },
          }),
        )

        // Initial & periodic state sync with Host `/babeltele-api/state`
        btStore.refresh()
        const timer = setInterval(() => btStore.refresh(), 5000)
        ctx.effect(() => () => clearInterval(timer))

        // 1. Custom BabelTele · DSH Brand Identity
        ctx.slots.inject('sidebar.brand.mark', () =>
          ctx.slots.register({ name: 'sidebar.brand.mark' }, SidebarBrandMark),
        )
        ctx.slots.inject('sidebar.brand.name', () =>
          ctx.slots.register({ name: 'sidebar.brand.name' }, SidebarBrandName),
        )
        ctx.slots.inject('conversation.hero.brand.mark', () =>
          ctx.slots.register({ name: 'conversation.hero.brand.mark' }, HeroBrandMark),
        )
        ctx.slots.inject('conversation.hero.frame', () =>
          ctx.slots.register({ name: 'conversation.hero.frame', id: 'babeltele-hero-glow' }, HeroFrame),
        )

        // 2. Session Header Telemetry & Mode Toggle Pill
        ctx.slots.inject('conversation.session.header.utilities', () =>
          ctx.slots.register(
            { name: 'conversation.session.header.utilities', id: 'babeltele-header-pill', order: -10 },
            SessionHeaderPill,
          ),
        )

        // 3. Composer Right Button + Neutralizer/Template Input Dock
        ctx.slots.inject('conversation.input.right', () =>
          ctx.slots.register(
            { name: 'conversation.input.right', id: 'babeltele-composer-btn', order: 10 },
            ComposerBtControls,
          ),
        )
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            { name: 'conversation.input.dock', id: 'babeltele-input-dock', order: -20 },
            ComposerInputDock,
          ),
        )

        // 4. Native Chat Reasoning Sidecar Lens (priority 10 overrides default priority 100)
        ctx.slots.inject('conversation.chat.reasoning.body', () =>
          ctx.slots.register(
            { name: 'conversation.chat.reasoning.body', priority: 10 },
            BabelTeleReasoningBody,
          ),
        )

        // 5. Dedicated BabelTele Kernel Section inside DSH Native Settings Modal
        const registerSettings = () => {
          const isZh = (ctx.locale.active || 'zh').startsWith('zh')
          return ctx.slots.register(
            {
              name: 'settings.section',
              id: 'babeltele',
              order: 25,
              label: isZh ? '⚡ 巴别语内核' : '⚡ BabelTele',
            },
            BabelTeleSettingsPage,
          )
        }
        ctx.slots.inject('settings.section', () => registerSettings())
      },
    }
  },
})
