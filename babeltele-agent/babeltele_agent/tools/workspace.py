"""Workspace File & Command Execution Tools.

Refactored from HKUDS/nanobot's filesystem tools and SWE-agent/mini-swe-agent's LocalEnvironment,
enhanced with Unified Diff tracking, Dual-Plane ArtifactSanitizer, and BT-Header auto-indexing.
"""
from __future__ import annotations

import difflib
import os
import re
import signal
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from babeltele_agent.memory.header_index import WorkspaceHeaderIndex
from babeltele_agent.protocol.sanitizer import audit_code_purity, strip_markdown_fences_if_wrapped

IGNORE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".pytest_cache"}


@dataclass
class FileChangeRecord:
    path: str
    action: str  # "created" | "modified"
    diff: str
    pure_code: bool
    purity_issues: list[str]
    timestamp: float = field(default_factory=time.time)


@dataclass
class TerminalRecord:
    command: str
    returncode: int
    output: str
    duration_ms: float
    timestamp: float = field(default_factory=time.time)


class WorkspaceEnvironment:
    """Sandboxed local workspace environment providing file, search, and shell operations."""

    def __init__(
        self,
        workspace_root: Path,
        header_index: WorkspaceHeaderIndex,
        command_timeout: int = 45,
    ) -> None:
        self.root = workspace_root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.header_index = header_index
        self.command_timeout = command_timeout
        self.file_changes: list[FileChangeRecord] = []
        self.terminal_logs: list[TerminalRecord] = []

    def _resolve_safe(self, rel_or_abs: str) -> Path:
        raw = (rel_or_abs or ".").strip()
        candidate = Path(raw)
        target = candidate.resolve() if candidate.is_absolute() else (self.root / candidate).resolve()
        # Prevent escaping workspace root via ../
        if target != self.root and self.root not in target.parents:
            raise ValueError(f"Path '{rel_or_abs}' escapes workspace root '{self.root}'.")
        return target

    def list_dir(self, path: str = ".") -> dict[str, Any]:
        target = self._resolve_safe(path)
        if not target.exists():
            return {"ok": False, "error": f"Directory not found: {path}"}
        if not target.is_dir():
            return {"ok": False, "error": f"Not a directory: {path}"}

        entries: list[str] = []
        for item in sorted(target.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            if item.name in IGNORE_DIRS:
                continue
            rel = str(item.relative_to(self.root)).replace("\\", "/")
            if item.is_dir():
                entries.append(f"[DIR]  {rel}/")
            else:
                entries.append(f"[FILE] {rel} ({item.stat().st_size} B)")
        summary = "\n".join(entries[:200]) if entries else "(empty directory)"
        return {"ok": True, "output": summary, "count": len(entries)}

    def read_file(self, path: str, start_line: int = 1, end_line: int = 250) -> dict[str, Any]:
        target = self._resolve_safe(path)
        if not target.exists() or not target.is_file():
            return {"ok": False, "error": f"File not found: {path}"}
        text = target.read_text(encoding="utf-8", errors="replace")
        rel = str(target.relative_to(self.root)).replace("\\", "/")
        self.header_index.update_file(rel, text)

        lines = text.splitlines()
        total = len(lines)
        s = max(1, int(start_line or 1))
        e = min(total, int(end_line or min(total, s + 249)))
        numbered = [f"{ln:4d} | {lines[ln - 1]}" for ln in range(s, e + 1)]
        header = f"File: {rel} (Showing lines {s}-{e} of {total})\n"
        return {"ok": True, "output": header + "\n".join(numbered), "total_lines": total}

    def write_file(self, path: str, content: str) -> dict[str, Any]:
        target = self._resolve_safe(path)
        rel = str(target.relative_to(self.root)).replace("\\", "/")
        clean_content = strip_markdown_fences_if_wrapped(content, rel)
        purity = audit_code_purity(rel, clean_content)

        existed = target.exists()
        old_lines = target.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True) if existed else []
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(clean_content, encoding="utf-8")

        new_lines = clean_content.splitlines(keepends=True)
        diff_str = "".join(
            difflib.unified_diff(
                old_lines,
                new_lines,
                fromfile=f"a/{rel}" if existed else "/dev/null",
                tofile=f"b/{rel}",
                n=3,
            )
        )
        self.header_index.update_file(rel, clean_content)
        rec = FileChangeRecord(
            path=rel,
            action="modified" if existed else "created",
            diff=diff_str,
            pure_code=purity["pure"],
            purity_issues=purity["issues"],
        )
        self.file_changes.append(rec)

        warn = ""
        if not purity["pure"]:
            warn = f" [WARNING: Dual-Plane Sanitizer detected potential symbol leakage: {purity['issues']} — please clean native code!]"
        return {
            "ok": True,
            "output": f"Successfully {rec.action} {rel} ({len(new_lines)} lines, pure_code={purity['pure']}).{warn}",
            "path": rel,
            "action": rec.action,
            "pure_code": purity["pure"],
        }

    def edit_file(self, path: str, old_text: str, new_text: str) -> dict[str, Any]:
        target = self._resolve_safe(path)
        if not target.exists() or not target.is_file():
            return {"ok": False, "error": f"File not found: {path}"}
        rel = str(target.relative_to(self.root)).replace("\\", "/")
        current = target.read_text(encoding="utf-8", errors="replace")
        if old_text not in current:
            return {
                "ok": False,
                "error": f"Exact `old_text` block not found in {rel}. Call `read_file` first to verify exact lines.",
            }
        updated = current.replace(old_text, new_text, 1)
        return self.write_file(rel, updated)

    def search_files(self, pattern: str, path: str = ".") -> dict[str, Any]:
        target = self._resolve_safe(path)
        try:
            regex = re.compile(pattern, re.I)
        except re.error as exc:
            regex = re.compile(re.escape(pattern), re.I)

        hits: list[str] = []
        files = [target] if target.is_file() else sorted(target.rglob("*"))
        for f in files:
            if len(hits) >= 80:
                break
            if any(part in IGNORE_DIRS for part in f.parts):
                continue
            if not f.is_file() or f.stat().st_size > 500_000:
                continue
            try:
                for idx, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                    if regex.search(line):
                        rel = str(f.relative_to(self.root)).replace("\\", "/")
                        hits.append(f"{rel}:{idx}: {line.strip()[:140]}")
                        if len(hits) >= 80:
                            break
            except Exception:
                continue

        return {
            "ok": True,
            "output": "\n".join(hits) if hits else f"No matches found for '{pattern}'.",
            "matches": len(hits),
        }

    def run_command(self, command: str, timeout: int | None = None) -> dict[str, Any]:
        """Execute shell command in workspace root (ported from mini-swe-agent LocalEnvironment._run)."""
        limit = min(120, max(3, int(timeout or self.command_timeout)))
        t0 = time.perf_counter()
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PIP_PROGRESS_BAR"] = "off"

        proc = subprocess.Popen(
            command,
            shell=True,
            cwd=str(self.root),
            env=env,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            start_new_session=(os.name == "posix"),
        )
        timed_out = False
        try:
            stdout, _ = proc.communicate(timeout=limit)
            rc = proc.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
            if os.name == "posix":
                os.killpg(proc.pid, signal.SIGKILL)
            else:
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
            stdout, _ = proc.communicate()
            rc = -1

        dur_ms = round((time.perf_counter() - t0) * 1000, 1)
        out_text = stdout or ""
        if len(out_text) > 8000:
            out_text = out_text[:4000] + f"\n... [{len(out_text) - 8000} chars elided] ...\n" + out_text[-4000:]
        if timed_out:
            out_text += f"\n[TIMEOUT after {limit}s]"

        rec = TerminalRecord(command=command, returncode=rc, output=out_text, duration_ms=dur_ms)
        self.terminal_logs.append(rec)
        return {
            "ok": rc == 0 and not timed_out,
            "returncode": rc,
            "duration_ms": dur_ms,
            "output": f"<returncode>{rc}</returncode>\n<output>\n{out_text}\n</output>",
        }

    def build_file_tree(self) -> list[dict[str, Any]]:
        """Return flat file metadata list for the graphical Web Console explorer."""
        items: list[dict[str, Any]] = []
        if not self.root.exists():
            return items
        for p in sorted(self.root.rglob("*"), key=lambda x: (str(x.parent), not x.is_dir(), x.name.lower())):
            if any(part in IGNORE_DIRS for part in p.parts):
                continue
            rel = str(p.relative_to(self.root)).replace("\\", "/")
            if p.is_file():
                items.append({
                    "path": rel,
                    "size": p.stat().st_size,
                    "mtime": p.stat().st_mtime,
                })
            if len(items) >= 250:
                break
        return items
