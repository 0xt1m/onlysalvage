#!/usr/bin/env python3
"""
Replace the OnlySalvage logo everywhere it's used in the frontend.

Usage:
    python replace_logo.py path/to/new-logo.png

What it does:
    1. Saves the source image as public/logo2.png (used by the navbar,
       the login/sign-up info panel, and Open Graph/Twitter share images --
       all reference this exact filename, so overwriting it in place means
       no code changes are needed).
    2. Generates public/favicon.ico (multi-size: 16, 32, 48, 64px) from the
       same source image, for the browser tab icon.

Requires Pillow: pip install pillow
"""

import sys
from pathlib import Path

from PIL import Image

PUBLIC_DIR = Path(__file__).parent / "public"
LOGO_PATH = PUBLIC_DIR / "logo2.png"
FAVICON_PATH = PUBLIC_DIR / "favicon.ico"
FAVICON_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64)]


def main():
    if len(sys.argv) != 2:
        print("Usage: python replace_logo.py path/to/new-logo.png")
        sys.exit(1)

    source_path = Path(sys.argv[1])
    if not source_path.exists():
        print(f"File not found: {source_path}")
        sys.exit(1)

    image = Image.open(source_path).convert("RGBA")

    PUBLIC_DIR.mkdir(exist_ok=True)

    image.save(LOGO_PATH, format="PNG")
    print(f"Wrote {LOGO_PATH} ({image.width}x{image.height})")

    image.save(FAVICON_PATH, format="ICO", sizes=FAVICON_SIZES)
    print(f"Wrote {FAVICON_PATH} (sizes: {FAVICON_SIZES})")

    print("Done. Restart the Next.js dev server if the favicon doesn't update right away (browsers cache favicons aggressively).")


if __name__ == "__main__":
    main()
