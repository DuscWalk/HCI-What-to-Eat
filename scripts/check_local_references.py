"""Reject machine-specific paths and private-library links in tracked files."""

from pathlib import Path
import re
import subprocess
import sys
import zipfile


PATTERNS = {
    "absolute Windows path": re.compile(r"(?<![A-Za-z])[A-Za-z]:[\\/]"),
    "local file or Zotero link": re.compile(r"(?:file|zotero)://", re.IGNORECASE),
    "personal home directory": re.compile(r"/(?:Users|home)/[^/\s]+/"),
}
PRIVATE_PREFIXES = (".local/", "private/", "data/raw/")


def violations(text):
    return [(number, label) for number, line in enumerate(text.splitlines(), 1)
            for label, pattern in PATTERNS.items() if pattern.search(line)]


def main():
    root = Path(subprocess.check_output(
        ["git", "rev-parse", "--show-toplevel"], encoding="utf-8").strip())
    own_path = Path(__file__).resolve()
    names = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=root).decode("utf-8").split("\0")
    errors = []
    checked = 0
    for name in filter(None, names):
        path = root / name
        if name.startswith(PRIVATE_PREFIXES):
            errors.append(f"{name}: private material must not be tracked")
            continue
        if path.resolve() == own_path or not path.is_file():
            continue
        if path.suffix.lower() == ".docx":
            try:
                with zipfile.ZipFile(path) as package:
                    texts = [(entry, package.read(entry).decode("utf-8"))
                             for entry in package.namelist()
                             if entry.endswith((".xml", ".rels"))]
            except (zipfile.BadZipFile, UnicodeDecodeError) as error:
                errors.append(f"{name}: cannot inspect document: {error}")
                continue
        else:
            try:
                texts = [("", path.read_text(encoding="utf-8-sig"))]
            except UnicodeDecodeError:
                continue
        checked += 1
        for part, text in texts:
            for line, label in violations(text):
                location = f"{name}:{part}" if part else name
                errors.append(f"{location}:{line}: {label}")
    if errors:
        print("Remove local references before sharing:", file=sys.stderr)
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Checked {checked} tracked files: no local references found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
