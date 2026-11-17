"""Dual-Plane Artifact Sanitizer: Guarantees 0% BabelTele symbol contamination in generated code files."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

# Control-plane markers that must NEVER appear outside comments/strings in source code files
_BT_LEAK_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("BT Control Header (#BT / #PRD / #DRAFT)", re.compile(r"^\s*#(?:BT|PRD|DRAFT|SMFT_T[123])\b", re.M)),
    ("AnchorLock Tag (![AnchorLock:])", re.compile(r"\!\[AnchorLock:")),
    ("Unicode Symbolic Collapse Arrow (⇨ / ⇎ / ∵ / ∴)", re.compile(r"[⇨⇎∵∴]")),
    ("Markdown Code Fence Leftover (```)", re.compile(r"^\s*```", re.M)),
]

_CODE_EXTENSIONS = {".py", ".java", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".c", ".cpp", ".cs", ".sql"}


def strip_markdown_fences_if_wrapped(content: str, file_path: str) -> str:
    """If an LLM accidentally wrapped file content in ```lang ... ```, unwrap cleanly for code files."""
    ext = Path(file_path).suffix.lower()
    if ext not in _CODE_EXTENSIONS:
        return content
    stripped = content.strip()
    m = re.match(r"^```\w*\r?\n([\s\S]*?)\r?\n```\s*$", stripped)
    if m:
        return m.group(1) + "\n"
    return content


def audit_code_purity(file_path: str, content: str) -> dict[str, Any]:
    """Inspect a file destined for disk to ensure 100% native language purity."""
    ext = Path(file_path).suffix.lower()
    if ext not in _CODE_EXTENSIONS:
        return {"pure": True, "file": file_path, "issues": []}

    # Strip string literals & line comments before checking symbolic leakage to prevent false positives
    scrubbed = re.sub(r'("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')', '""', content)
    if ext in {".java", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".c", ".cpp", ".cs"}:
        scrubbed = re.sub(r"//.*$", "", scrubbed, flags=re.M)
        scrubbed = re.sub(r"/\*[\s\S]*?\*/", "", scrubbed)
    elif ext == ".py":
        scrubbed = re.sub(r"#(?!BT\b|PRD\b|DRAFT\b).*$", "", scrubbed, flags=re.M)

    issues: list[str] = []
    for label, pat in _BT_LEAK_PATTERNS:
        if pat.search(scrubbed):
            issues.append(label)

    return {
        "pure": len(issues) == 0,
        "file": file_path,
        "issues": issues,
    }
