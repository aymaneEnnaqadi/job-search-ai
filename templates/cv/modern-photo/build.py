#!/usr/bin/env python3
"""
Render a modern-photo CV HTML file to a PDF via WeasyPrint.

Usage:
    python3 build.py <input.html> <output.pdf>

Always reports the page count on stdout - /apply's compile-and-inspect loop
reads that to enforce the template's declared page limit (see TEMPLATE.md).
Requires: pip install weasyprint (or `pip3 install --user --break-system-packages
weasyprint` on a PEP 668 "externally managed" Python, e.g. Homebrew on macOS).
"""

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: python3 build.py <input.html> <output.pdf>")
        return 1

    src = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    if not src.exists():
        print(f"error: {src} not found")
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        from weasyprint import HTML
    except ImportError:
        print("error: weasyprint is not installed. Run:")
        print("  python3 -m pip install --user --break-system-packages weasyprint")
        return 1

    doc = HTML(filename=str(src), base_url=str(src.parent)).render()
    pages = len(doc.pages)
    doc.write_pdf(str(out))

    print(f"Output written on {out.name} ({pages} page{'s' if pages != 1 else ''}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
