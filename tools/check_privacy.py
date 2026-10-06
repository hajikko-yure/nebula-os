#!/usr/bin/env python3
"""Check privacy and prevent local identifiers from leaking."""

import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".cache", ".agents", ".kilo", ".tmp"}
SKIP_FILES = {"tools/check-privacy.js", "tools/check_privacy.py"}

CHECKS = [
    ("Windows user path", re.compile(r"[A-Za-z]:[\\/]+Users[\\/]+[A-Za-z0-9._-]+", re.I)),
    ("Unix user path", re.compile(r"/Users/[A-Za-z0-9._-]+")),
    ("Home env ref", re.compile(r"%USERPROFILE%|\$HOME|~/Library", re.I)),
    ("Local temp path", re.compile(r"AppData[\\/]+Local[\\/]+Temp|nebula-cdp-", re.I)),
    ("MAC address", re.compile(r"\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b")),
    ("Private LAN address", re.compile(r"\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b")),
    ("Private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
]

def tracked_files():
    try:
        out = subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
            cwd=ROOT,
            encoding="utf-8"
        )
    except Exception:
        out = subprocess.check_output(["git", "ls-files"], cwd=ROOT, encoding="utf-8")

    files = [f.strip() for f in out.splitlines() if f.strip()]
    valid = []
    for f in files:
        norm = f.replace("\\", "/")
        first = norm.split("/")[0]
        if norm in SKIP_FILES or first in SKIP_DIRS:
            continue
        valid.append(f)
    return valid

def main():
    files = tracked_files()
    findings = 0

    for rel in files:
        abs_path = os.path.join(ROOT, rel)
        if not os.path.isfile(abs_path):
            continue
        try:
            with open(abs_path, "r", encoding="utf-8") as fp:
                for line_no, line in enumerate(fp, 1):
                    for name, pat in CHECKS:
                        matches = pat.findall(line)
                        if matches:
                            findings += 1
                            print(f"[{name}] {rel}:{line_no}")
                            print(f"  matched: {set(matches)}")
                            print(f"  {line.strip()[:100]}\n")
        except UnicodeDecodeError:
            continue

    if findings > 0:
        print(f"Found {findings} potential leak(s).")
        sys.exit(1)
    else:
        print(f"Clean: {len(files)} files scanned, no machine-specific leaks found.")

if __name__ == "__main__":
    main()
