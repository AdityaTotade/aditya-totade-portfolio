# Search Visibility Setup
**To be done once the site is publicly live** (see `DEPLOYMENT_STATUS_V7.md` for the one remaining blocker). Google indexing is never instant — expect days to a few weeks for the site to appear reliably in search, even after every step below is done correctly.

## 1. Google Search Console
1. Go to https://search.google.com/search-console.
2. Add a property using the live URL (the Vercel domain, or a custom domain if one is added later).
3. Verify ownership. The simplest method for a static site with no DNS control: the **HTML tag** method — Google gives you a `<meta name="google-site-verification" content="...">` tag to paste into `index.html`'s `<head>`, then redeploy.

## 2. Sitemap submission
Once verified, in Search Console: Sitemaps → Add a new sitemap → enter `sitemap.xml` (already present at the site root). Submit.

## 3. Index request
Use the URL Inspection tool in Search Console, paste the live homepage URL, and click "Request Indexing." This nudges Google to crawl sooner than it otherwise would — it does not guarantee immediate appearance in search results.

## 4. What NOT to expect
- Do not expect the site to outrank Aditya's LinkedIn profile for a "Aditya Totade" search — LinkedIn's domain authority is far higher, and that's fine; the portfolio's job is to be found *from* LinkedIn (via the Featured link) and from direct applications, not to win the search results page on its own.
- Do not resubmit the sitemap or re-request indexing repeatedly — it doesn't speed things up and can look like spam behavior to Google's systems.

## 5. Ongoing maintenance
Any time the site's content changes meaningfully (a new case study, a new credential), no re-submission is needed — Google recrawls on its own schedule. Re-request indexing manually only after a significant content change you want reflected quickly.
