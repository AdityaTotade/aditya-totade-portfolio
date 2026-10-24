# Aditya Totade: portfolio site

Live at **https://aditya-totade-portfolio.vercel.app**

The portfolio of a Mumbai-based business-systems consultant (Zoho One, process mapping, SOPs, Power BI, and research and policy writing). It is a single static page with no framework and no server: every claim on it is checked against source documents before it is published.

## How it is built

| Part | What it does |
|---|---|
| `index.html` | The whole site: content, CSS (design tokens on `:root`) and vanilla JavaScript in one file. Works offline. |
| `assets/` | Images (WebP with JPEG fallbacks), the résumé, writing samples and one-page project briefs (PDF). |
| `tools/stage_deploy.py` | Copies only the public files into a clean folder and writes `vercel.json` with security headers. The Content Security Policy allows each inline script by its SHA-256 hash, so the page runs no script it did not ship with. |
| `tools/check.py` | Pre-deploy checks: every linked file exists, booking options match the booking-brief script, no internal notes or login-walled URLs, the résumé matches the canonical version, script hashes match the staged CSP. Exits non-zero on any failure. |
| `booking-brief/` | A Google Apps Script that polls the Calendly API every 10 minutes and emails a one-page PDF prep brief for each new booking (service, the visitor's problem, relevant proof, five questions to ask). The API token lives in Script Properties, never in code. Setup steps are in `booking-brief/SETUP.md`. |

**Booking flow.** The site's own form collects name, email, service and notes, validates them (length limits, a honeypot field for bots), then opens Calendly in an embedded frame with those details pre-filled. Calendly sends the invites; the page listens for Calendly's `event_scheduled` message to confirm.

**Security headers** (set in `vercel.json` at deploy time): strict CSP with hashed scripts and `frame-src` limited to Calendly, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a locked-down permissions policy and cross-origin opener isolation.

**Quality bar.** Lighthouse scores 100 for accessibility, best practices and SEO. The layout is checked from 280px to 2560px wide for horizontal overflow, the page prints cleanly to PDF, and if any script fails the page falls back to a no-JavaScript view, so no content stays hidden.

## Run it locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Deploy

```bash
python tools/stage_deploy.py ../stage   # public files + vercel.json with CSP hashes
python tools/check.py ../stage          # must report 0 fail
cd ../stage && vercel deploy --prod --yes
```

Each deploy replaces the whole site, so always deploy the complete staged folder.

## Content rules

Every figure on the site traces to a source document, and each one is labelled for what it is: client work, an internship result (self-reported), an academic or self-directed project, a modelled projection, or a design that was not deployed. Group projects say so and give the team size. The political writing is self-directed, non-partisan and drafted with AI assistance, and every fact in it is listed with its source.

## Built with

Plain HTML, CSS and JavaScript; Python for the tooling; Google Apps Script for the booking brief; Vercel for hosting; Calendly for scheduling. Built and tested with Claude Code.

© 2026 Aditya Totade. Text, images and documents may not be reused without permission.
