"""Build a clean deploy folder for Vercel: public files only, plus vercel.json security headers.

Usage:  python tools/stage_deploy.py <empty-or-new staging folder>
Then:   cd <staging folder> && vercel deploy [--prod] --yes --non-interactive
        (with VERCEL_ORG_ID / VERCEL_PROJECT_ID set; see the project CLAUDE.md)

The Content-Security-Policy pins every inline <script> by its SHA-256 hash, so the
hashes are recomputed here on every run. Never deploy index.html without re-staging.
"""
import base64
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
PUBLIC = ['index.html', 'robots.txt', 'sitemap.xml', 'assets']   # nothing else is ever published
FRAME_HOSTS = 'https://calendly.com'   # booking calendar is embedded from Calendly


def script_hashes(html):
    hashes = []
    for attrs, body in re.findall(r'<script([^>]*)>(.*?)</script>', html, re.S):
        if 'application/ld+json' in attrs:      # data, not executed: CSP does not apply
            continue
        digest = hashlib.sha256(body.encode('utf-8')).digest()
        hashes.append("'sha256-" + base64.b64encode(digest).decode() + "'")
    return hashes


def main(out):
    out = Path(out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for name in PUBLIC:
        src = SITE / name
        if src.is_dir():
            shutil.copytree(src, out / name)
        else:
            shutil.copy2(src, out / name)

    html = (SITE / 'index.html').read_text(encoding='utf-8')
    csp = '; '.join([
        "default-src 'self'",
        "script-src 'self' " + ' '.join(script_hashes(html)),
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-src " + FRAME_HOSTS,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
    ])
    headers = [
        {'key': 'Content-Security-Policy', 'value': csp},
        {'key': 'X-Content-Type-Options', 'value': 'nosniff'},
        {'key': 'X-Frame-Options', 'value': 'DENY'},
        {'key': 'Referrer-Policy', 'value': 'strict-origin-when-cross-origin'},
        {'key': 'Permissions-Policy', 'value': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
        {'key': 'Cross-Origin-Opener-Policy', 'value': 'same-origin'},
    ]
    config = {'headers': [{'source': '/(.*)', 'headers': headers}], 'cleanUrls': True, 'trailingSlash': False}
    (out / 'vercel.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
    files = sorted(str(p.relative_to(out)).replace('\\', '/') for p in out.rglob('*') if p.is_file())
    print('staged', len(files), 'files:', ', '.join(files))
    print('CSP script hashes:', len(script_hashes(html)))


if __name__ == '__main__':
    main(sys.argv[1])
