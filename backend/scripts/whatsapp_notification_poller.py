#!/usr/bin/env python3
"""
OpenClaw -> WhatsApp notification relay poller.

Runs as a long-lived daemon (see the ai.openclaw.whatsapp-notification-poller
LaunchAgent). On a fixed interval it:

  1. GET  {base}/openclaw/notifications/pending?channel=whatsapp&limit=5
          (header: X-API-Key)
  2. For each returned notification, sends the message body to recipientPhone
     via the local `openclaw message send` WhatsApp gateway.
  3. On success -> POST {base}/openclaw/notifications/<id>/sent
     On failure -> POST {base}/openclaw/notifications/<id>/failed
                        body: {"errorMessage": "<details>"}

Config (base URL + API key) is read from ~/.openclaw/openclaw.json so nothing
is hardcoded here. A local "dispatched" ledger guarantees we never re-send the
same notification if the /sent callback itself fails.

Environment overrides:
  OPENCLAW_POLL_INTERVAL_SEC   poll cadence (default 15)
  OPENCLAW_POLL_LIMIT          pending batch size (default 5)
  OPENCLAW_CONFIG_PATH         path to openclaw.json
  OPENCLAW_POLL_DRY_RUN        "1" => log sends but don't actually send/callback
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

HOME = os.path.expanduser("~")
CONFIG_PATH = os.environ.get(
    "OPENCLAW_CONFIG_PATH", os.path.join(HOME, ".openclaw", "openclaw.json")
)
STATE_DIR = os.path.join(HOME, ".openclaw", "state", "whatsapp-notification-poller")
LEDGER_PATH = os.path.join(STATE_DIR, "dispatched.json")

POLL_INTERVAL_SEC = int(os.environ.get("OPENCLAW_POLL_INTERVAL_SEC", "15"))
POLL_LIMIT = int(os.environ.get("OPENCLAW_POLL_LIMIT", "5"))
DRY_RUN = os.environ.get("OPENCLAW_POLL_DRY_RUN", "") == "1"
CHANNEL = "whatsapp"
DEFAULT_GROUP_JID = "120363426724252289@g.us"
DEFAULT_DEV_GROUP_JID = "120363410068952432@g.us"

HTTP_TIMEOUT = 15  # seconds for CommunityHub calls
SEND_TIMEOUT = 90  # seconds for the openclaw send subprocess

# Cap the in-memory/on-disk ledger so it can't grow without bound.
LEDGER_MAX = 2000


def log(msg):
    ts = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    print(f"{ts} [wa-poller] {msg}", flush=True)


def load_config():
    """Return (base_url, api_key). Environment wins; fall back to openclaw.json.

    Reading from env keeps these custom keys out of openclaw.json, which the
    OpenClaw CLI schema rejects as unknown root keys (breaking `message send`).
    """
    base = (os.environ.get("COMMUNITYHUB_API_URL") or "").rstrip("/")
    key = os.environ.get("COMMUNITYHUB_API_KEY") or ""
    if not base or not key:
        try:
            with open(CONFIG_PATH, "r") as f:
                cfg = json.load(f)
            base = base or (cfg.get("COMMUNITYHUB_API_URL") or "").rstrip("/")
            key = key or (cfg.get("COMMUNITYHUB_API_KEY") or "")
        except (FileNotFoundError, ValueError):
            pass
    if not base or not key:
        raise RuntimeError(
            "COMMUNITYHUB_API_URL / COMMUNITYHUB_API_KEY not set "
            "(checked environment and openclaw.json)"
        )
    return base, key


def load_ledger():
    try:
        with open(LEDGER_PATH, "r") as f:
            data = json.load(f)
        return list(data.get("dispatched", []))
    except (FileNotFoundError, ValueError):
        return []


def save_ledger(ids):
    os.makedirs(STATE_DIR, exist_ok=True)
    trimmed = ids[-LEDGER_MAX:]
    tmp = LEDGER_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"dispatched": trimmed}, f)
    os.replace(tmp, LEDGER_PATH)


def http_json(method, url, api_key, body=None):
    """Perform an HTTP request; return parsed JSON (or None) on 2xx, raise otherwise."""
    data = None
    headers = {"X-API-Key": api_key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        raw = resp.read().decode("utf-8").strip()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return None


def fetch_pending(base, api_key):
    url = f"{base}/openclaw/notifications/pending?channel={CHANNEL}&limit={POLL_LIMIT}"
    payload = http_json("GET", url, api_key)
    # Accept either a bare array or a wrapped object.
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for k in ("notifications", "data", "pending", "results", "items"):
            if isinstance(payload.get(k), list):
                return payload[k]
    return []


def _first(d, keys):
    for k in keys:
        v = d.get(k)
        if v not in (None, ""):
            return v
    return None


def parse_notification(n):
    """Extract (id, phone, message, env) defensively; task-specified names win."""
    nid = _first(n, ("notificationId", "id", "_id", "notification_id"))
    phone = _first(n, ("recipientPhone", "recipient_phone", "recipient", "phone", "to"))
    message = _first(n, ("message", "body", "text", "content", "messageBody"))
    env = _first(n, ("environment", "env"))
    return nid, phone, message, env


def resolve_recipient(phone, env=None):
    """Map notification recipient aliases to concrete WhatsApp targets."""
    target = str(phone).strip()
    if target.lower() == "group":
        is_dev = env and env.lower() in ("dev", "development", "sandbox", "staging")
        if is_dev:
            return os.environ.get("OPENCLAW_WHATSAPP_DEV_GROUP_JID") or DEFAULT_DEV_GROUP_JID
        return os.environ.get("OPENCLAW_WHATSAPP_GROUP_JID") or DEFAULT_GROUP_JID
    return target


def send_whatsapp(phone, message, env=None):
    """Send via the local openclaw gateway. Returns (ok, detail)."""
    target = resolve_recipient(phone, env)
    if DRY_RUN:
        log(f"DRY_RUN would send to {target}: {message[:80]!r}")
        return True, "dry-run"
    cmd = [
        "openclaw", "message", "send",
        "--channel", CHANNEL,
        "--target", target,
        "--message", message,
        "--json",
    ]
    try:
        proc = subprocess.run(
            cmd, capture_output=True, timeout=SEND_TIMEOUT
        )
    except subprocess.TimeoutExpired:
        return False, f"send timed out after {SEND_TIMEOUT}s"
    except Exception as e:
        return False, f"subprocess error: {e}"

    stdout = ""
    stderr = ""
    if proc.stdout:
        stdout = proc.stdout.decode("utf-8", errors="replace")
    if proc.stderr:
        stderr = proc.stderr.decode("utf-8", errors="replace")

    if proc.returncode != 0:
        detail = (stderr or stdout or "").strip()[:500]
        return False, f"openclaw exit {proc.returncode}: {detail}"
    return True, stdout.strip()[:500]


def mark(base, api_key, nid, outcome, error_message=None):
    url = f"{base}/openclaw/notifications/{nid}/{outcome}"
    if outcome == "failed":
        # errorMessage is required by MarkFailedRequest.
        body = {"errorMessage": (error_message or "unspecified error")[:1000]}
    else:
        # MarkSentRequest.sentAt is optional but always send a body.
        body = {"sentAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if DRY_RUN:
        log(f"DRY_RUN would POST {outcome} for {nid}")
        return True
    try:
        http_json("POST", url, api_key, body=body)
        return True
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        log(f"callback {outcome} failed for {nid}: {e}")
        return False


def process_cycle(base, api_key, dispatched):
    try:
        pending = fetch_pending(base, api_key)
    except urllib.error.HTTPError as e:
        log(f"pending fetch HTTP {e.code}: {e.reason}")
        return
    except (urllib.error.URLError, OSError) as e:
        # CommunityHub unreachable — normal when the API is down; stay quiet-ish.
        log(f"pending fetch unavailable: {e}")
        return

    if not pending:
        return
    log(f"fetched {len(pending)} pending notification(s)")

    dispatched_set = set(dispatched)
    for n in pending:
        nid, phone, message, env = parse_notification(n)
        if not nid:
            log(f"skipping notification with no id: {json.dumps(n)[:200]}")
            continue

        # Dedup guard: if we already sent this one but the /sent callback did
        # not stick, retry ONLY the callback — never re-send the message.
        if nid in dispatched_set:
            if mark(base, api_key, nid, "sent"):
                log(f"re-confirmed already-sent {nid}")
            continue

        if not phone or not message:
            err = f"missing {'phone' if not phone else 'message'} in notification"
            log(f"{nid}: {err}")
            mark(base, api_key, nid, "failed", err)
            continue

        ok, detail = send_whatsapp(phone, message, env)
        if ok:
            # Record BEFORE the callback so a callback failure can't cause a resend.
            dispatched.append(nid)
            dispatched_set.add(nid)
            save_ledger(dispatched)
            mark(base, api_key, nid, "sent")
            log(f"sent {nid} -> {phone}")
        else:
            log(f"send failed {nid} -> {phone}: {detail}")
            mark(base, api_key, nid, "failed", detail)


def main():
    log(
        f"starting: config={CONFIG_PATH} interval={POLL_INTERVAL_SEC}s "
        f"limit={POLL_LIMIT} dry_run={DRY_RUN}"
    )
    try:
        base, api_key = load_config()
    except Exception as e:
        log(f"fatal: cannot load config: {e}")
        sys.exit(1)
    log(f"CommunityHub base={base}")

    dispatched = load_ledger()
    while True:
        try:
            process_cycle(base, api_key, dispatched)
        except Exception as e:
            log(f"cycle error: {e}")
        time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    main()
