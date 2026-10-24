# Booking brief: email + one-page PDF for every new booking (about 3 minutes)

When someone books on the portfolio (Calendly), this script emails **aditya.totade@gmail.com** a summary plus a one-page PDF prep brief: when, who, their service and problem, which proof to mention, and five questions to ask. See `SAMPLE_prep_brief_TEST_booking.pdf` for what it looks like.

It runs in your own Google account, checks Calendly every 10 minutes, and never sends the same booking twice. Nothing here is deployed to the website.

## 1. Get a Calendly token (1 minute)
Calendly → **Integrations & apps** → **API and webhooks** → **Personal access tokens** → **Generate new token**. Name it `Portfolio brief`, copy the token. Treat it like a password: don't email it or paste it into the code.

## 2. Create the script
1. Open https://script.google.com signed in as **aditya.totade@gmail.com** → **New project** → name it `Portfolio booking brief`.
2. Delete the sample code, paste everything from `Code.gs` (this folder), **Save**.
3. **Project Settings** (gear icon) → **Script Properties** → **Add script property**: Property `CALENDLY_TOKEN`, Value = the token from step 1 → **Save**.

## 3. Switch it on
1. Back in the editor, choose **setup** in the function drop-down → **Run** → **Review permissions** → your account → **Advanced** → **Go to Portfolio booking brief** → **Allow**.
   This installs the 10-minute check and runs it once. The existing test booking (Wed 21 Oct, 12:00 IST) will produce your first brief within a minute.
2. Optional: choose **testRun** → **Run** to resend the latest booking's brief, marked `[TEST]`.

## Afterwards
- Cancel the test booking in Calendly (Scheduled events → "TEST Booking (portfolio check)" → Cancel), or ask Claude to cancel it.
- To change where briefs go, edit `SEND_TO` at the top of the script.
- If a brief stops arriving: open the script → **Executions** to see the error. A `401` means the Calendly token was revoked; make a new one and update the Script Property.
