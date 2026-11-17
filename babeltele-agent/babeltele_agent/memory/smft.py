"""Semantic Merkle Folding Tree (SMFT) — Refactored from HKUDS/nanobot AutoCompact.

Folds older agent tool turns into T1 -> T2 BabelTele checkpoints with Tier-1 anchor preservation
and cold-storage rollback so long-horizon tasks never overflow context windows.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

from babeltele_agent.protocol.neutralizer import extract_hard_anchors
from babeltele_agent.protocol.tokenizer import count_tokens


@dataclass
class SMFTNode:
    node_id: str
    tier: int  # 1 = T1 checkpoint, 2 = T2 merged digest
    height: int
    bt_digest: str
    raw_tokens: int
    compressed_tokens: int
    turn_count: int
    created_at: float = field(default_factory=time.time)
    children_ids: list[str] = field(default_factory=list)


class SMFTMemoryTree:
    """Hierarchical T1 -> T2 rolling BabelTele memory tree with cold-storage archive."""

    def __init__(self) -> None:
        self.nodes: list[SMFTNode] = []
        self.cold_archive: dict[str, list[dict[str, Any]]] = {}

    def fold_messages(self, messages_to_fold: list[dict[str, Any]]) -> SMFTNode | None:
        """Fold a slice of historical conversation/tool messages into a self-contained [T1] BabelTele node."""
        if not messages_to_fold:
            return None

        raw_concat = "\n".join(str(m.get("content", "")) for m in messages_to_fold)
        raw_tok = max(1, count_tokens(raw_concat))

        # Deterministically synthesize compact BT-L2 trace of actions & outcomes
        events: list[str] = []
        for m in messages_to_fold:
            role = m.get("role", "")
            content = str(m.get("content", "")).strip()
            if role == "user":
                short_u = content[:80].replace("\n", " ")
                events.append(f"U:{short_u}")
            elif role == "assistant":
                tcs = m.get("tool_calls") or []
                if tcs:
                    calls_str = ",".join(tc.get("function", {}).get("name", "tool") for tc in tcs)
                    events.append(f"A->{calls_str}")
                elif content:
                    events.append(f"A:{content[:60].replace(chr(10), ' ')}")
            elif role == "tool":
                name = m.get("name", "tool")
                first_line = content.splitlines()[0][:70] if content else "ok"
                events.append(f"Obs({name}):{first_line}")

        anchors = extract_hard_anchors(raw_concat)
        key_paths = anchors["paths"][:6]
        key_nums = anchors["numbers"][:6]
        anchor_str = ""
        if key_paths or key_nums:
            anchor_str = f" @[Anchors:{','.join(key_paths + key_nums)}]"

        node_id = f"smft_{uuid.uuid4().hex[:6]}"
        bt_digest = f"[T1#{node_id}] {' -> '.join(events[:10])}{anchor_str}"
        comp_tok = count_tokens(bt_digest)

        node = SMFTNode(
            node_id=node_id,
            tier=1,
            height=1,
            bt_digest=bt_digest,
            raw_tokens=raw_tok,
            compressed_tokens=comp_tok,
            turn_count=len(messages_to_fold),
        )
        self.cold_archive[node_id] = list(messages_to_fold)
        self.nodes.append(node)
        self._maybe_merge_t1_to_t2()
        return node

    def _maybe_merge_t1_to_t2(self) -> None:
        """When >= 4 T1 nodes accumulate, roll the oldest 2 T1 nodes into a [T2] Merkle parent."""
        t1_indices = [i for i, n in enumerate(self.nodes) if n.tier == 1]
        if len(t1_indices) < 4:
            return
        i1, i2 = t1_indices[0], t1_indices[1]
        n1, n2 = self.nodes[i1], self.nodes[i2]
        merged_id = f"smft_{uuid.uuid4().hex[:6]}"
        merged_body = f"[T2#{merged_id} {{h2}}] ({n1.bt_digest}) & ({n2.bt_digest})"
        # Compress merged representation slightly further
        if len(merged_body) > 360:
            merged_body = merged_body[:355] + "...]"
        merged_node = SMFTNode(
            node_id=merged_id,
            tier=2,
            height=max(n1.height, n2.height) + 1,
            bt_digest=merged_body,
            raw_tokens=n1.raw_tokens + n2.raw_tokens,
            compressed_tokens=count_tokens(merged_body),
            turn_count=n1.turn_count + n2.turn_count,
            children_ids=[n1.node_id, n2.node_id],
        )
        # Replace n1, n2 with merged_node
        for idx in sorted([i1, i2], reverse=True):
            self.nodes.pop(idx)
        self.nodes.insert(0, merged_node)

    def render_active_digest(self) -> str:
        if not self.nodes:
            return ""
        return "\n".join(n.bt_digest for n in self.nodes)

    def dereference(self, node_id: str) -> list[dict[str, Any]]:
        """Losslessly retrieve archived raw turns from cold storage."""
        if node_id in self.cold_archive:
            return self.cold_archive[node_id]
        # Check children if T2 node
        for n in self.nodes:
            if n.node_id == node_id and n.children_ids:
                out: list[dict[str, Any]] = []
                for cid in n.children_ids:
                    out.extend(self.cold_archive.get(cid, []))
                return out
        return []

    def summary_stats(self) -> dict[str, Any]:
        raw_total = sum(n.raw_tokens for n in self.nodes)
        comp_total = sum(n.compressed_tokens for n in self.nodes)
        saved = max(0, raw_total - comp_total)
        return {
            "node_count": len(self.nodes),
            "raw_tokens_folded": raw_total,
            "compressed_tokens": comp_total,
            "saved_tokens": saved,
            "savings_pct": round((saved / raw_total) * 100, 1) if raw_total > 0 else 0.0,
            "nodes": [asdict(n) for n in self.nodes],
        }
