#!/usr/bin/env python3
"""Draws the CrankHog wordmark: the name in Saira ExtraBold Italic at 72 % width,
outlined, over the velodrome's four track lines.

The letters are real outlines, not live text, so the logo looks the same with no
fonts loaded. This script is the only way they should ever be redrawn.

    python3 -m pip install fonttools brotli
    npm run wordmark          # or: python3 scripts/make-wordmark.py

It writes the four SVGs in docs/brand/ and prints the WORDMARK block for
src/shared/brand.ts. Paste that in: brand.ts stays hand-edited, because its
comments are part of the guidelines (docs/BRAND.md).
"""

import os
import sys
from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "node_modules/@fontsource-variable/saira/files/saira-latin-standard-italic.woff2"

WORD = "CrankHog"
WEIGHT = 800
WIDTH = 72

# The velodrome's colours, as in src/shared/brand.ts.
INK = {"": "#13213c", "-night": "#eff4fa", "-white": "#ffffff"}
STAYER, SPRINTER, AZURE = "#1e59cd", "#e0383b", "#77c3ff"

# The four lines under the word, as bands. They lean 12° to match the italics,
# so each band's top edge sits right of its bottom edge. The offsets are from
# the top of the first band; the gaps between them are the velodrome's.
LEAN = 0.21256  # tan 12°
BANDS = [("stayer", 0, 38), ("sprinter", 62, 100), ("measure", 124, 140), ("azure", 164, 228)]
# The air between the lowest ink in the word (the g's tail) and the first line.
CLEARANCE = int(os.environ.get("CLEARANCE", 32))
# Where the bands sit against the word's bounding box.
LEAD_IN, TRAIL = 10, 60


def outline(word: str) -> tuple[str, tuple[float, float, float, float]]:
    """The word as one SVG path, baseline at y=0, y down. Returns the path and its bounds."""
    font = instancer.instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT, "wdth": WIDTH}, inplace=False)
    glyphs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    parts: list[str] = []
    pen_x = 0.0
    x0 = y0 = float("inf")
    x1 = y1 = float("-inf")
    for ch in word:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs, ntos=lambda v: str(round(v, 1)))
        glyphs[name].draw(TransformPen(pen, Transform(1, 0, 0, -1, pen_x, 0)))
        bounds = BoundsPen(glyphs)
        glyphs[name].draw(bounds)
        if bounds.bounds:
            bx0, by0, bx1, by1 = bounds.bounds
            x0, y0 = min(x0, bx0 + pen_x), min(y0, -by1)
            x1, y1 = max(x1, bx1 + pen_x), max(y1, -by0)
        if d := pen.getCommands():
            parts.append(d)
        pen_x += hmtx[name][0]
    return " ".join(parts), (x0, y0, x1, y1)


def bands(x0: float, x1: float, y: float) -> dict[str, str]:
    """A leaning parallelogram per line, spanning the word less its lead-in and trail."""
    left, right = x0 + LEAD_IN, x1 - TRAIL
    out = {}
    for name, top, bottom in BANDS:
        t, b = round(y + top), round(y + bottom)
        lean = round((b - t) * LEAN, 1)
        out[name] = f"M{round(left + lean, 1)} {t}L{round(right + lean, 1)} {t}L{round(right, 1)} {b}L{round(left, 1)} {b}Z"
    return out


def svg(word: str, lines: dict[str, str], view: str, ink: str, plain: bool) -> str:
    """One wordmark file. `plain` draws the lines in the ink too (the all-white lockup)."""
    line_ink = ink if plain else None
    paths = [f'  <path d="{word}" fill="{ink}"/>']
    for name, colour in (("stayer", STAYER), ("sprinter", SPRINTER), ("measure", ink), ("azure", AZURE)):
        paths.append(f'  <path d="{lines[name]}" fill="{line_ink or colour}"/>')
    body = "\n".join(paths)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{WORD}">\n{body}\n</svg>\n'


def main() -> None:
    if not FONT.exists():
        sys.exit(f"Saira is missing: {FONT}\nRun npm install first.")
    word, (x0, y0, x1, y1) = outline(WORD)
    band_top = round(y1) + CLEARANCE
    lines = bands(x0, x1, band_top)
    band_bottom = band_top + BANDS[-1][2]

    # The wordmark's box: a little air round the letters, down to the bottom of
    # the côte d'azur band. The lines' own box is tight, for the TrackLines divider.
    vx, vy = round(x0) - 14, round(y0) - 8
    view = f"{vx} {vy} {round(x1) + 24 - vx} {band_bottom + 8 - vy}"
    lx0 = round(x0 + LEAD_IN, 1) - 4
    lx1 = round(x1 - TRAIL + BANDS[-1][2] * LEAN, 1) + 4
    lines_view = f"{lx0} {band_top - 4} {round(lx1 - lx0, 1)} {BANDS[-1][2] + 8}"

    brand = ROOT / "docs" / "brand"
    brand.mkdir(parents=True, exist_ok=True)
    slug = WORD.lower()
    for suffix, ink in INK.items():
        (brand / f"{slug}-wordmark{suffix}.svg").write_text(svg(word, lines, view, ink, plain=suffix == "-white"))

    print(f"wrote {len(INK)} wordmarks to docs/brand/ (word {x0:.1f}…{x1:.1f})", file=sys.stderr)
    print("\n// Paste into src/shared/brand.ts:\n")
    print("export const WORDMARK = {")
    print(f"  viewBox: '{view}',")
    print(f"  linesViewBox: '{lines_view}',")
    print(f"  word: '{word}',")
    print("  lines: {")
    for name, _, _ in BANDS:
        print(f"    {name}: '{lines[name]}',")
    print("  },\n} as const")


if __name__ == "__main__":
    main()
