"""Pre-deploy checks for the portfolio site: a trial balance before posting.

Usage:  python tools/check.py [staging folder]
        Prints PASS / WARN / FAIL per check and exits 1 if anything FAILs.
        Pass the staging folder made by stage_deploy.py to also check its vercel.json.

Read-only: it never changes a file. Each check exists because the mistake log in the
project CLAUDE.md records that failure happening at least once.
"""
import hashlib
import html
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
SITE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SITE / 'tools'))
from stage_deploy import script_hashes  # noqa: E402  same hashing the deploy uses

PROD = 'https://aditya-totade-portfolio.vercel.app/'
# The canonical résumé. Update this line whenever a new résumé version becomes canonical.
RESUME_MASTER = SITE.parent / '02_RESUMES' / 'Aditya_Totade_Business_Systems_AI_Resume_v4_5.pdf'
RESUME_SITE = SITE / 'assets' / 'Aditya_Totade_Resume.pdf'
# Phrases that must never ship (mistake log 2026-10-14 / 2026-10-15).
BANNED = {
    r'-projects\.vercel\.app': 'team-scoped Vercel URL (sits behind a login wall)',
    r'(?i)state this plainly': 'internal working note',
    r'(?i)not requested/approved': 'internal working note',
    r'(?i)\bsigned\s+(client\s+)?(recommendation|letter|LOR)\b': 'claims a signed letter; the Glück letter is an unsigned draft',
}

results = []


def report(status, name, detail=''):
    results.append(status)
    print(f'{status:<5} {name}' + (f'\n      {detail}' if detail else ''))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_assets(page):
    refs = set(re.findall(r'(?:src|href|content)="(?:' + re.escape(PROD) + r'|\./|/)?(assets/[^"#?]+)"', page))
    for srcset in re.findall(r'srcset="([^"]+)"', page):
        refs.update(re.findall(r'(assets/[^\s,]+)', srcset))
    missing = sorted(r for r in refs if not (SITE / html.unescape(r)).is_file())
    if missing:
        report('FAIL', 'Asset links', 'missing: ' + ', '.join(missing))
    else:
        report('PASS', 'Asset links', f'{len(refs)} files referenced, all present')


def check_scripts(page, staged):
    hidden = [s for s in re.findall(r'<!--(.*?)-->', page, re.S) if '<script' in s]
    if hidden:
        report('FAIL', 'Scripts in HTML comments', 'staging would hash a commented-out <script>; remove it')
    hashes = script_hashes(page)
    if not staged:
        report('PASS', 'CSP script hashes', f'{len(hashes)} inline scripts; pass the staging folder to compare with vercel.json')
        return
    cfg = Path(staged) / 'vercel.json'
    if not cfg.is_file():
        report('FAIL', 'CSP script hashes', f'no vercel.json in {staged}; run stage_deploy.py first')
        return
    csp = next(h['value'] for rule in json.loads(cfg.read_text(encoding='utf-8'))['headers']
               for h in rule['headers'] if h['key'] == 'Content-Security-Policy')
    stale = [h for h in hashes if h not in csp]
    staged_html = Path(staged) / 'index.html'
    if stale or not staged_html.is_file() or sha256(staged_html) != sha256(SITE / 'index.html'):
        report('FAIL', 'CSP script hashes', 'staging is out of date with index.html; re-run stage_deploy.py')
    else:
        report('PASS', 'CSP script hashes', f'{len(hashes)} hashes match the staged vercel.json')


def check_services(page):
    select = re.search(r'<select[^>]*>(.*?)</select>', page, re.S)
    options = [html.unescape(o).strip() for o in re.findall(r'<option(?![^>]*value="")[^>]*>([^<]*)</option>',
                                                              select.group(1) if select else '')]
    gs = (SITE / 'booking-brief' / 'Code.gs').read_text(encoding='utf-8')
    block = re.search(r'var PLAYBOOK = \{(.*?)\n\};', gs, re.S)
    keys = re.findall(r"^  '([^']+)':\s*\{", block.group(1) if block else '', re.M)
    if not options or options != keys:
        only_html = [o for o in options if o not in keys]
        only_gs = [k for k in keys if k not in options]
        report('FAIL', 'Booking services match Code.gs',
               f'only on the page: {only_html or "-"}; only in Code.gs: {only_gs or "-"} (order must match too)')
    else:
        report('PASS', 'Booking services match Code.gs', f'{len(options)} services, same names and order')


def check_urls(page):
    found = re.findall(r'<link rel="canonical" href="([^"]+)"', page)
    found += re.findall(r'<meta (?:property|name)="(?:og:url|og:image|twitter:image)" content="([^"]+)"', page)
    found += re.findall(r'<loc>([^<]+)</loc>', (SITE / 'sitemap.xml').read_text(encoding='utf-8'))
    found += re.findall(r'Sitemap:\s*(\S+)', (SITE / 'robots.txt').read_text(encoding='utf-8'))
    wrong = [u for u in found if not u.startswith(PROD)]
    if len(found) < 6 or wrong:
        report('FAIL', 'Public URLs', f'not on {PROD}: {wrong}' if wrong else 'canonical/og/twitter/sitemap/robots URL missing')
    else:
        report('PASS', 'Public URLs', f'{len(found)} absolute URLs all use the production domain')


def check_banned(page):
    hits = [f'{why} ("{m.group(0)}")' for pattern, why in BANNED.items() for m in [re.search(pattern, page)] if m]
    report('FAIL' if hits else 'PASS', 'Banned wording', '; '.join(hits))
    todos = [c.strip()[:70] for c in re.findall(r'<!--(.*?)-->', page, re.S) if 'TODO' in c]
    if todos:
        report('WARN', 'Notes in HTML comments (visible via View Source)', '; '.join(todos))


def check_resume(page):
    if 'assets/Aditya_Totade_Resume.pdf' not in page:
        report('FAIL', 'Résumé', 'the page no longer links assets/Aditya_Totade_Resume.pdf')
    elif not RESUME_MASTER.is_file():
        report('WARN', 'Résumé', f'cannot find {RESUME_MASTER.name}; update RESUME_MASTER in check.py')
    elif sha256(RESUME_SITE) != sha256(RESUME_MASTER):
        report('FAIL', 'Résumé', f'site PDF differs from {RESUME_MASTER.name}; recopy it')
    else:
        report('PASS', 'Résumé', f'site PDF is identical to {RESUME_MASTER.name}')


def check_head(page):
    problems = []
    for name, pattern in [('title', r'<title>[^<]{10,}</title>'), ('meta description', r'<meta name="description" content="[^"]{50,}"')]:
        if not re.search(pattern, page):
            problems.append(f'{name} missing or too short')
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S):
        try:
            json.loads(block)
        except ValueError as e:
            problems.append(f'structured data (JSON-LD) does not parse: {e}')
    report('FAIL' if problems else 'PASS', 'Page head', '; '.join(problems))


def main():
    staged = sys.argv[1] if len(sys.argv) > 1 else None
    page = (SITE / 'index.html').read_text(encoding='utf-8')
    for check in (check_assets, check_services, check_urls, check_banned, check_resume, check_head):
        check(page)
    check_scripts(page, staged)
    fails, warns = results.count('FAIL'), results.count('WARN')
    print(f'\n{"FAILED" if fails else "OK"}: {fails} fail, {warns} warn, {results.count("PASS")} pass')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
