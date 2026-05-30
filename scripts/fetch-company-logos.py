#!/usr/bin/env python3
"""
Fetch Space Rising tenant company logos and convert each to:
  - <slug>-white.png  (white-on-transparent for use on dark cards)
  - <slug>-black.png  (black-on-transparent for use on light cards)

Source priority per company:
  1. directory_companies.logo_url (if set + reachable)
  2. Clearbit Logo API based on directory_companies.website domain

Saves to: public/v2-assets/logos/

Usage:
  python3 scripts/fetch-company-logos.py [--limit N] [--force]
"""
import os, re, sys, argparse, urllib.parse, urllib.request, json
from io import BytesIO
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO, "public", "v2-assets", "logos")
TENANT_SLUG = "space-rising"

def load_env():
    env = {}
    for path in [os.path.join(REPO, ".env.local"), os.path.join(REPO, ".env.production")]:
        if not os.path.exists(path): continue
        for line in open(path):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line: continue
            k, _, v = line.partition("=")
            k = k.replace("VITE_", "").strip()
            env[k] = v.strip().strip('"').strip("'")
    return env

def http_get(url, headers=None, timeout=8):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except Exception as e:
        return 0, b"", {"error": str(e)}

def fetch_companies(env):
    url = f"{env['SUPABASE_URL']}/rest/v1/directory_tenants?slug=eq.{TENANT_SLUG}&select=id"
    h = {"apikey": env["SUPABASE_ANON_KEY"], "Authorization": f"Bearer {env['SUPABASE_ANON_KEY']}"}
    _, body, _ = http_get(url, h)
    tid = json.loads(body)[0]["id"]
    url = (f"{env['SUPABASE_URL']}/rest/v1/directory_companies"
           f"?tenant_id=eq.{tid}&select=name,slug,website,logo_url&order=name.asc")
    _, body, _ = http_get(url, h)
    return json.loads(body)

def domain_from_website(website):
    if not website: return None
    s = website.strip().replace("\\", "/")
    # Fix common "http:////www.x.com" style entries
    s = re.sub(r"^https?:/+", "https://", s)
    if not re.match(r"^https?://", s): s = "https://" + s
    try:
        host = urllib.parse.urlparse(s).hostname or ""
        host = host.replace("www.", "")
        return host or None
    except Exception:
        return None

def try_image(body, expect_min_bytes=400):
    if not body or len(body) < expect_min_bytes:
        return None
    try:
        return Image.open(BytesIO(body)).convert("RGBA")
    except Exception:
        return None

def fetch_logo_image(company):
    """Try multiple sources in order. Return (PIL Image, source-tag) or (None, None)."""
    UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    # 1) existing logo_url from DB
    if company.get("logo_url"):
        status, body, _ = http_get(company["logo_url"], headers=UA)
        if status == 200:
            img = try_image(body)
            if img: return img, "stored"
    domain = domain_from_website(company.get("website"))
    if not domain:
        return None, None
    # 2) Apple-touch-icon (often 180x180 PNG, sometimes bigger)
    for path in ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png",
                 "/apple-touch-icon-180x180.png", "/apple-touch-icon-152x152.png",
                 "/favicon-512x512.png", "/favicon-192x192.png"]:
        status, body, _ = http_get(f"https://{domain}{path}", headers=UA)
        if status == 200:
            img = try_image(body)
            if img and min(img.size) >= 96:
                return img, f"site:{path}"
    # 3) Google s2 favicon API at 256px (reliable baseline)
    url = f"https://www.google.com/s2/favicons?domain={domain}&sz=256"
    status, body, _ = http_get(url, headers=UA)
    if status == 200:
        img = try_image(body, expect_min_bytes=200)
        if img and min(img.size) >= 32:
            return img, f"google-s2:{domain}"
    return None, None

def is_dark_bg(img):
    """Sample corner pixels to determine bg luminance."""
    w, h = img.size
    samples = []
    for x, y in [(0,0), (w-1,0), (0,h-1), (w-1,h-1), (w//2,0), (w//2,h-1)]:
        p = img.getpixel((x, y))
        a = p[3] if len(p) >= 4 else 255
        if a >= 200:  # only count opaque corner pixels
            samples.append((p[0] + p[1] + p[2]) / 3)
    if not samples: return False
    return sum(samples) / len(samples) < 110

def make_mono(img, color):
    """Extract the logo shape from background, recolor to `color`.
    - If bg is light (typical favicon): keep DARK pixels, drop light → transparent
    - If bg is dark: keep LIGHT pixels, drop dark → transparent"""
    r, g, b = color
    dark_bg = is_dark_bg(img)
    pixels = list(img.getdata())
    new_pixels = []
    for p in pixels:
        sr, sg, sb = p[0], p[1], p[2]
        sa = p[3] if len(p) >= 4 else 255
        brightness = (sr + sg + sb) / 3
        if sa < 20:
            new_pixels.append((r, g, b, 0))
            continue
        if dark_bg:
            # Logo is light on dark — keep bright pixels
            if brightness >= 60:
                alpha = int(255 * min(1.0, brightness / 240))
                new_pixels.append((r, g, b, alpha))
            else:
                new_pixels.append((r, g, b, 0))
        else:
            # Logo is dark on light — keep dark pixels (default favicon case)
            if brightness <= 200:
                alpha = int(255 * (1 - brightness / 240))
                alpha = max(0, min(255, alpha))
                new_pixels.append((r, g, b, alpha))
            else:
                new_pixels.append((r, g, b, 0))
    out = Image.new("RGBA", img.size, (r, g, b, 0))
    out.putdata(new_pixels)
    return out

def trim_transparent(img, padding=8):
    """Trim transparent borders, then add small uniform padding."""
    bbox = img.split()[-1].getbbox()
    if not bbox: return img
    cropped = img.crop(bbox)
    new_w, new_h = cropped.size[0] + padding*2, cropped.size[1] + padding*2
    out = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
    out.paste(cropped, (padding, padding), cropped)
    return out

def slugify(name):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.lower()).strip("-")
    return s

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    env = load_env()
    if not env.get("SUPABASE_URL") or not env.get("SUPABASE_ANON_KEY"):
        print("ERROR: SUPABASE_URL or SUPABASE_ANON_KEY missing from .env.local/.env.production", file=sys.stderr)
        sys.exit(2)

    os.makedirs(OUT_DIR, exist_ok=True)

    companies = fetch_companies(env)
    if args.limit:
        companies = companies[:args.limit]

    ok, miss, skip = 0, 0, 0
    misses = []
    for c in companies:
        slug = c.get("slug") or slugify(c.get("name") or "")
        if not slug: continue
        white_path = os.path.join(OUT_DIR, f"{slug}-white.png")
        black_path = os.path.join(OUT_DIR, f"{slug}-black.png")
        if not args.force and os.path.exists(white_path) and os.path.exists(black_path):
            skip += 1
            continue
        img, source = fetch_logo_image(c)
        if img is None:
            miss += 1
            misses.append(f"{c['name']} (website={c.get('website')!r})")
            continue
        img = trim_transparent(img, padding=12)
        make_mono(img, (255, 255, 255)).save(white_path)
        make_mono(img, (0, 0, 0)).save(black_path)
        ok += 1
        print(f"  ok: {slug:<40s} <- {source}")

    print(f"\nResult: {ok} ok, {miss} miss, {skip} skipped (already exist). Total {len(companies)} companies.")
    if misses:
        print("Misses (no logo found):")
        for m in misses[:20]:
            print(f"  - {m}")
        if len(misses) > 20:
            print(f"  ... and {len(misses) - 20} more")

if __name__ == "__main__":
    main()
