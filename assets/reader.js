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
