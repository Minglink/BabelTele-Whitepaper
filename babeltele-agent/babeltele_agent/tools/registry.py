"""OpenAI Function-Calling Tool Schema & Dispatcher for BabelTele Super Agent."""
from __future__ import annotations

from typing import Any, Callable

from babeltele_agent.tools.workspace import WorkspaceEnvironment

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List files and directories inside the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative directory path (default '.')"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read line-numbered contents of a file in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path to the file"},
                    "start_line": {"type": "integer", "description": "1-indexed start line (default 1)"},
                    "end_line": {"type": "integer", "description": "1-indexed inclusive end line (default 250)"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or overwrite a file in the workspace with 100% pure native code/content (never include BabelTele shorthand inside code).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path to create/overwrite"},
                    "content": {"type": "string", "description": "Complete pure source file content"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Replace an exact contiguous block `old_text` with `new_text` in an existing file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path"},
                    "old_text": {"type": "string", "description": "Exact existing text to replace"},
                    "new_text": {"type": "string", "description": "Replacement native code text"},
                },
                "required": ["path", "old_text", "new_text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search for a regex or text pattern across files in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regex or keyword pattern"},
                    "path": {"type": "string", "description": "Optional directory or file path (default '.')"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a shell/terminal command in the workspace root (e.g. python, pytest, javac, node, git) and inspect stdout/returncode.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Command line to execute"},
                    "timeout": {"type": "integer", "description": "Timeout in seconds (default 45)"},
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "spawn_subagent",
            "description": "Delegate an isolated sub-task to a specialized child Subagent communicating over the high-density BabelTele (babeltele/1.0) bus.",
            "parameters": {
                "type": "object",
                "properties": {
                    "role": {"type": "string", "description": "Subagent role title, e.g. 'Test Engineer' or 'Code Auditor'"},
                    "task_bt": {"type": "string", "description": "Compact BabelTele specification of the sub-task"},
                },
                "required": ["role", "task_bt"],
            },
        },
    },
]


def execute_tool(
    name: str,
    args: dict[str, Any],
    env: WorkspaceEnvironment,
    subagent_handler: Callable[[str, str], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    try:
        if name == "list_dir":
            return env.list_dir(str(args.get("path", ".")))
        if name == "read_file":
            return env.read_file(
                str(args["path"]),
                int(args.get("start_line", 1)),
                int(args.get("end_line", 250)),
            )
        if name == "write_file":
            return env.write_file(str(args["path"]), str(args["content"]))
        if name == "edit_file":
            return env.edit_file(str(args["path"]), str(args["old_text"]), str(args["new_text"]))
        if name == "search_files":
            return env.search_files(str(args["pattern"]), str(args.get("path", ".")))
        if name == "run_command":
            return env.run_command(str(args["command"]), args.get("timeout"))
        if name == "spawn_subagent":
            if subagent_handler is None:
                return {"ok": False, "error": "Subagent spawning disabled in child subagent."}
            return subagent_handler(str(args.get("role", "Worker")), str(args.get("task_bt", "")))
        return {"ok": False, "error": f"Unknown tool: {name}"}
    except Exception as exc:
        return {"ok": False, "error": f"Tool '{name}' error: {exc}"}
