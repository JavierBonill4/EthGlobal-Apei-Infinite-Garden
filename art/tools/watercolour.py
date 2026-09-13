"""
Watercolour in SVG, without raster assets.

WHY THIS EXISTS
Stroll.png set the art direction: soft mottled washes, no outlines, visible
paper grain. Hand-drawing that per asset is not repeatable and hand-drawing it
25 times is not affordable, so the look is generated from three primitives:

  blob()   an organic closed path -- a circle with jittered radii, smoothed.
           This replaces feDisplacementMap: a displaced shape cannot tile,
           because the filter moves pixels across the tile edge. A jittered
           PATH can be clipped to the tile and still tile perfectly.
  wash()   a blob stack -- one base fill plus darker and lighter pools at low
           opacity. Watercolour reads as watercolour because of the pooling,
           not because of the edges.
  grain()  ONE feTurbulence overlay per file, clipped to the artwork.

PERFORMANCE NOTE, which is why filters are affordable at all: these ship as
separate .svg files loaded through <img>. A browser rasterises one URL once and
blits it for every instance, so a ground tile drawn 200 times runs its filter
once. Inline the same SVG 200 times and you will pay 200 times. Keep them as
<img>.

Everything is seeded and deterministic: same seed in, same path out, so a
regenerated asset is byte-identical and diffs stay readable.
"""
import math


class Rng:
    """Deterministic, tiny, and stable across Python versions -- which
    `random` is not guaranteed to be. Assets must regenerate byte-identical."""

    def __init__(self, seed: int):
        self.s = (seed * 2654435761) & 0xFFFFFFFF or 1

    def next(self) -> float:
        x = self.s
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.s = x & 0xFFFFFFFF
        return self.s / 0xFFFFFFFF

    def range(self, a: float, b: float) -> float:
        return a + (b - a) * self.next()


def blob(cx, cy, rx, ry, seed, points=9, jitter=0.3, squash=1.0):
    """A closed organic path. Catmull-Rom through jittered radial points,
    converted to cubic Beziers so the outline stays smooth -- a polygon reads
    as a gem, and watercolour has no facets."""
    rng = Rng(seed)
    pts = []
    for i in range(points):
        a = (i / points) * math.tau + rng.range(-0.12, 0.12)
        j = 1 + rng.range(-jitter, jitter)
        pts.append((cx + math.cos(a) * rx * j,
                    cy + math.sin(a) * ry * j * squash))

    def at(i):
        return pts[i % len(pts)]

    d = f"M{at(0)[0]:.1f} {at(0)[1]:.1f}"
    for i in range(len(pts)):
        p0, p1, p2, p3 = at(i - 1), at(i), at(i + 1), at(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += (f" C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f}"
              f" {p2[0]:.1f} {p2[1]:.1f}")
    return d + " Z"


def wash(cx, cy, rx, ry, base, dark, light, seed, pools=3, jitter=0.26,
         base_op=0.9, squash=1.0):
    """A blob with pigment pooled inside it. The pools are what sell it: real
    watercolour dries unevenly and the darkest value is never at the edge."""
    rng = Rng(seed * 31 + 7)
    out = (f'<path d="{blob(cx, cy, rx, ry, seed, 9, jitter * 0.7, squash)}" '
           f'fill="{base}" fill-opacity="{base_op}"/>')
    for k in range(pools):
        ox = cx + rng.range(-rx * 0.32, rx * 0.32)
        oy = cy + rng.range(-ry * 0.32, ry * 0.32)
        r = rng.range(0.32, 0.6)
        col = dark if k % 2 == 0 else light
        op = rng.range(0.12, 0.3)
        out += (f'<path d="{blob(ox, oy, rx * r, ry * r * squash, seed * 17 + k, 8, jitter)}" '
               f'fill="{col}" fill-opacity="{op:.2f}"/>')
    return out


def grain_def(fid="grain", freq=0.8, alpha=0.18, seed=5):
    """Paper. One per file, applied to a group -- not per shape."""
    return (f'<filter id="{fid}" x="0" y="0" width="100%" height="100%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="{freq}" '
            f'numOctaves="4" seed="{seed}" result="t"/>'
            f'<feColorMatrix in="t" type="saturate" values="0" result="g"/>'
            f'<feComponentTransfer in="g" result="a">'
            f'<feFuncA type="table" tableValues="0 {alpha}"/></feComponentTransfer>'
            f'<feComposite in="a" in2="SourceGraphic" operator="in"/></filter>')


def soft_def(fid="soft", blur=0.7):
    """A hair of blur. Watercolour has no hard edge anywhere, and this is
    cheaper than modelling bleed properly."""
    return (f'<filter id="{fid}" x="-15%" y="-15%" width="130%" height="130%">'
            f'<feGaussianBlur stdDeviation="{blur}"/></filter>')


def svg(w, h, body, defs="", label="", comment="", grain_over=None):
    """Assemble. `grain_over` is a rect spec to lay grain across the artwork."""
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
         f'width="{w}" height="{h}" role="img" aria-label="{label}">\n')
    if comment:
        # XML forbids "--" inside a comment, and prose wants em dashes. Fixing
        # it here rather than in every caller: this bit us three times before
        # it was centralised.
        safe = comment.strip().replace("--", "\u2014")
        s += "".join(f"  <!-- {ln} -->\n" for ln in safe.split("\n"))
    if defs:
        s += f"  <defs>{defs}</defs>\n"
    s += body
    if grain_over:
        x, y, gw, gh = grain_over
        s += (f'  <rect x="{x}" y="{y}" width="{gw}" height="{gh}" '
              f'fill="#6B5B3E" filter="url(#grain)"/>\n')
    return s + "</svg>\n"
