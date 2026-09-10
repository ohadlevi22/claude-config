#!/usr/bin/env python3
"""Read-only Obsidian vault HTTP endpoint for Ricci (Reachy Mini).

Serves markdown notes over the LAN so the robot can read the vault via voice
("Ricci, read my note X"). Read-only by design, token-protected, and
path-traversal-safe (every request is resolved inside the vault root AND
restricted to an allowlist of folders).

Endpoints (all require ?token=<t> or an X-Vault-Token header):
  GET /health
  GET /list?folder=<relpath>&recursive=0|1   -> {folder, count, notes:[relpath]}
  GET /read?path=<relpath[.md]>              -> {path, chars, content}
  GET /search?q=<query>&limit=N             -> {query, count, results:[{path,snippet}]}

Paths are vault-relative (relative to VAULT_ROOT), e.g.
  'projects/Reachy Mini/Reachy Mini - Delivery Roadmap.md' or 'DeeperDive/Foo.md'

Config via env:
  VAULT_ROOT   (default: ~/Documents/ohad vault)  -- the addressing root
  VAULT_ALLOW  colon-separated folders (relative to VAULT_ROOT) that may be read;
               empty = the whole vault. e.g. "projects/Reachy Mini:DeeperDive"
  VAULT_PORT   (default: 8890)
  token is read from ~/.reachy_vault_token
"""
import json
import os
import http.server
import socketserver
import urllib.parse
from pathlib import Path

VAULT_ROOT = Path(os.getenv("VAULT_ROOT", os.path.expanduser("~/Documents/ohad vault"))).resolve()
PORT = int(os.getenv("VAULT_PORT", "8890"))

_allow_env = os.getenv("VAULT_ALLOW", "").strip()
if _allow_env:
    ALLOW = [(VAULT_ROOT / part.strip()).resolve() for part in _allow_env.split(":") if part.strip()]
else:
    ALLOW = [VAULT_ROOT]

_tokfile = os.path.expanduser("~/.reachy_vault_token")
TOKEN = open(_tokfile).read().strip() if os.path.exists(_tokfile) else ""

READ_CAP = 20000       # max chars returned per note
LIST_CAP = 500         # max notes listed
SEARCH_FILE_CAP = 2000 # max files scanned per search


def _in_allow(p: Path) -> bool:
    for a in ALLOW:
        if p == a or a in p.parents:
            return True
    return False


def _safe(relpath: str):
    """Resolve relpath inside the vault AND inside an allowed folder."""
    p = (VAULT_ROOT / relpath).resolve()
    return p if _in_allow(p) else None


def _rel(p: Path) -> str:
    return str(p.relative_to(VAULT_ROOT))


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):  # keep it quiet
        pass

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(u.query)
        tok = (qs.get("token", [None])[0]) or self.headers.get("X-Vault-Token")
        if not TOKEN or tok != TOKEN:
            return self._send(401, {"error": "unauthorized"})

        path = u.path.rstrip("/") or "/"
        try:
            if path == "/health":
                return self._send(200, {"ok": True, "vault": str(VAULT_ROOT),
                                        "allowed": [_rel(a) for a in ALLOW]})

            if path == "/list":
                folder = qs.get("folder", [""])[0]
                # Recursive by default: list notes in subfolders too, unless
                # the caller explicitly passes recursive=0/false/no.
                recursive = qs.get("recursive", ["1"])[0] not in ("0", "false", "no")
                if folder:
                    base = _safe(folder)
                    if base is None or not base.exists():
                        return self._send(404, {"error": "folder not found or not allowed", "folder": folder})
                    bases = [base]
                else:
                    bases = ALLOW
                pattern = "**/*.md" if recursive else "*.md"
                notes = set()
                for base in bases:
                    if base.exists():
                        for p in base.glob(pattern):
                            if p.is_file():
                                notes.add(_rel(p))
                notes = sorted(notes)
                return self._send(200, {"folder": folder or "(allowed roots)",
                                        "count": len(notes), "notes": notes[:LIST_CAP]})

            if path == "/read":
                rel = qs.get("path", [""])[0]
                if not rel:
                    return self._send(400, {"error": "missing path"})
                if not rel.endswith(".md"):
                    rel += ".md"
                p = _safe(rel)
                if p is None or not p.is_file():
                    return self._send(404, {"error": "note not found or not allowed", "path": rel})
                text = p.read_text(encoding="utf-8", errors="replace")
                return self._send(200, {"path": rel, "chars": len(text), "content": text[:READ_CAP]})

            if path == "/search":
                q = qs.get("q", [""])[0].lower()
                limit = int(qs.get("limit", ["10"])[0])
                if not q:
                    return self._send(400, {"error": "missing q"})
                results = []
                scanned = 0
                for base in ALLOW:
                    if not base.exists():
                        continue
                    for p in base.glob("**/*.md"):
                        if not p.is_file():
                            continue
                        scanned += 1
                        if scanned > SEARCH_FILE_CAP:
                            break
                        try:
                            t = p.read_text(encoding="utf-8", errors="replace")
                        except Exception:
                            continue
                        rel = _rel(p)
                        hay = (rel + "\n" + t).lower()
                        idx = hay.find(q)
                        if idx != -1:
                            snip = t[max(0, idx - 80):idx + 120].replace("\n", " ")
                            results.append({"path": rel, "snippet": snip})
                    if len(results) >= limit:
                        break
                return self._send(200, {"query": q, "count": len(results), "results": results[:limit]})

            return self._send(404, {"error": "unknown endpoint"})
        except Exception as e:
            return self._send(500, {"error": str(e)})


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit(f"no token found at {_tokfile} — create it first")
    if not VAULT_ROOT.exists():
        raise SystemExit(f"vault root not found: {VAULT_ROOT}")
    srv = ThreadingServer(("0.0.0.0", PORT), Handler)
    print(f"vault endpoint listening on 0.0.0.0:{PORT}  root={VAULT_ROOT}  allow={[_rel(a) for a in ALLOW]}")
    srv.serve_forever()
