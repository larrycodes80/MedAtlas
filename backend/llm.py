import json
import re

import httpx

from config import GUARD_MODEL, OLLAMA_BASE_URL, QWEN_MODEL


def _chat(model, messages, schema=None):
    body = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.2 if model == GUARD_MODEL else 0},
    }
    if model == QWEN_MODEL:
        body["think"] = False
    if schema is not None:
        body["format"] = schema
    try:
        response = httpx.post(
            f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat",
            json=body,
            timeout=180,
            trust_env=False,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("done") is not True or data.get("done_reason") not in {None, "stop"}:
            raise ValueError
        content = data["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise ValueError
        return content.strip()
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise RuntimeError("The local model failed or returned an incomplete response.") from None


def guard(messages):
    verdict = _chat(GUARD_MODEL, messages)
    lines = [line.strip() for line in verdict.splitlines() if line.strip()]
    if lines == ["safe"]:
        return True
    if len(lines) == 2 and lines[0] == "unsafe" and re.fullmatch(
        r"S(?:[1-9]|1[0-3])(?:\s*,\s*S(?:[1-9]|1[0-3]))*", lines[1]
    ):
        return False
    raise RuntimeError("The safety model returned an unrecognized verdict.")


def json_answer(messages, schema):
    raw = _chat(QWEN_MODEL, messages, schema)
    try:
        result = json.loads(raw, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
    except (TypeError, ValueError):
        raise RuntimeError("The answer model returned invalid JSON.") from None
    if not isinstance(result, dict):
        raise RuntimeError("The answer model returned invalid JSON.")
    return result
