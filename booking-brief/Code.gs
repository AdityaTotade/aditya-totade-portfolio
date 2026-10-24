/**
 * Booking brief: when someone books a Workflow Audit call on Calendly, email Aditya
 * a one-page PDF prep brief (who, when, what they need, relevant proof, questions to ask).
 *
 * Runs in Aditya's own Google account (script.google.com). Reads bookings from the
 * Calendly API every 10 minutes. Setup: see SETUP.md in this folder.
 * The Calendly token lives in Script Properties (CALENDLY_TOKEN), never in this code.
 */

var CONFIG = {
  SEND_TO: 'aditya.totade@gmail.com',
  TIMEZONE: 'Asia/Kolkata',
  LOOKBACK_HOURS: 24,          // catch bookings made while the script was paused
  LOOKAHEAD_DAYS: 60,
  CHECK_EVERY_MINUTES: 10
};

/* Proof and discovery questions for each service on the website's booking form. */
var PLAYBOOK = {
  'Business Analysis & Process Improvement': {
    proof: 'DHL Express India internship: workflow redesign (+17% productivity), DHL and Blue Dart SOPs (+30% classification accuracy, -20% misrouting delays), a further -20% in overall delivery delays. Results as reported.',
    questions: ['Walk me through the process step by step, as it really runs today.', 'Where does work wait, and who is it waiting on?', 'Which handoff causes the most rework or complaints?', 'What is written down, and what lives in one person\'s head?', 'How would we know in 90 days that it got better?']
  },
  'AI Integration & Business Automation': {
    proof: 'ARK Meditech: AI integrated into Zoho CRM (written recommendation). AI Operations Manager prototype for an Allo Innoware hiring assignment (prototype, not deployed). Principle: AI interprets, rules validate, humans approve.',
    questions: ['Which tasks repeat every day or week, and how long do they take?', 'What decisions in those tasks need a person to approve?', 'What tools and data do these tasks touch today?', 'What has been tried with AI already, and what went wrong?', 'What would be unacceptable if the automation made a mistake?']
  },
  'Zoho CRM & Zoho One Implementation': {
    proof: 'ARK Meditech: Zoho CRM configured end to end (paid in full, written recommendation), then a Zoho One rollout: about 980 customer and vendor records migrated from Tally to Zoho Books and reconciled; Analytics dashboards and a Creator delivery app (piloted).',
    questions: ['Which Zoho apps are you on today, and on which plan?', 'Where do leads come from, and what happens to them in the first 48 hours?', 'Is accounting in Tally or Books, and how clean is the data?', 'Who will own the CRM day to day?', 'Which report does leadership want first?']
  },
  'Data Analytics & Power BI': {
    proof: 'DHL Express India: manual reporting replaced with live Power BI dashboards, validated through UAT. ARK Meditech: executive, vendor-analysis and migration-control dashboards in Zoho Analytics.',
    questions: ['Which decisions should this dashboard support?', 'Where does the data live today, and who updates it?', 'How long does the current report take to build each week?', 'Which numbers do people argue about?', 'Who will look at it, and how often?']
  },
  'Market Research & Business Strategy': {
    proof: 'The Glück Bistro (client): positioning, acquisition and retention system, unit economics and a weekly KPI system (modelled projections). Gatorade GTM study, 159 responses (academic). China+1 framework (self-directed). Luxury fashion and FMCG (Dabur vs Patanjali) sector analyses (academic group projects).',
    questions: ['What decision does this research need to support?', 'Who is the customer, and what do we already know about them?', 'What does success look like in numbers?', 'What budget and timeline are we working within?', 'What has been tried before?']
  },
  'Political Research, Public Policy & Geopolitical Analysis': {
    proof: 'Three self-directed political writing samples (Oct 2026): BMC accountability, Maharashtra drought response vs council polls, India\'s strategic autonomy; each with a source list. Governance-first, non-partisan.',
    questions: ['What is the output: article, policy brief, election research or a governance report?', 'Who is the audience, and where will it be published or used?', 'What is the deadline, and how current must the facts be?', 'Are there positions or parties the piece must not take sides on?', 'How will sources be cited, and who signs off before it goes out?']
  },
  'Not sure yet, help me decide': {
    proof: 'Start with the free Workflow Audit: map the process first, then pick the service.',
    questions: ['What is the one process costing you the most time?', 'What happens when it goes wrong?', 'Who is affected, inside and outside the team?', 'What tools are involved?', 'What would "fixed" look like?']
  }
};

/* ---------- entry points ---------- */

/** Run once from the editor: checks the token, installs the 10-minute trigger, runs a first check. */
function setup() {
  token_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkNewBookings') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkNewBookings').timeBased().everyMinutes(CONFIG.CHECK_EVERY_MINUTES).create();
  Logger.log('Trigger installed. Running a first check...');
  checkNewBookings();
}

/** Sends a brief for the most recent upcoming booking, even if one was already sent. For testing. */
function testRun() {
  var items = upcoming_();
  if (!items.length) { Logger.log('No upcoming bookings found.'); return; }
  var it = items[items.length - 1];
  sendBrief_(it.event, it.invitee, true);
  Logger.log('Test brief sent for ' + it.invitee.name);
}

/** Runs on the trigger: one brief per new booking. */
function checkNewBookings() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var done = JSON.parse(props.getProperty('DONE') || '[]');
    upcoming_().forEach(function (it) {
      if (done.indexOf(it.invitee.uri) !== -1) return;
      sendBrief_(it.event, it.invitee, false);
      done.push(it.invitee.uri);
    });
    props.setProperty('DONE', JSON.stringify(done.slice(-500)));
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Calendly ---------- */

function token_() {
  var t = PropertiesService.getScriptProperties().getProperty('CALENDLY_TOKEN');
  if (!t) throw new Error('Add your Calendly personal access token as Script Property CALENDLY_TOKEN (see SETUP.md).');
  return t;
}

function api_(url) {
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token_() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Calendly API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

function upcoming_() {
  var me = api_('https://api.calendly.com/users/me').resource;
  var min = new Date(Date.now() - CONFIG.LOOKBACK_HOURS * 3600000).toISOString();
  var max = new Date(Date.now() + CONFIG.LOOKAHEAD_DAYS * 86400000).toISOString();
  var url = 'https://api.calendly.com/scheduled_events?user=' + encodeURIComponent(me.uri) +
    '&status=active&sort=start_time:asc&count=50&min_start_time=' + encodeURIComponent(min) +
    '&max_start_time=' + encodeURIComponent(max);
  var out = [];
  api_(url).collection.forEach(function (ev) {
    api_(ev.uri + '/invitees?status=active').collection.forEach(function (inv) {
      out.push({ event: ev, invitee: inv });
    });
  });
  out.sort(function (a, b) { return new Date(a.invitee.created_at) - new Date(b.invitee.created_at); });
  return out;
}

/* ---------- brief ---------- */

function sendBrief_(event, invitee, isTest) {
  var d = briefData(event, invitee, CONFIG.TIMEZONE);
  var html = briefHtml(d);
  var pdf = HtmlService.createHtmlOutput(html).getBlob().getAs('application/pdf')
    .setName('Prep brief - ' + d.name.replace(/[\\/:*?"<>|]/g, '') + ' - ' + d.dateShort + '.pdf');
  MailApp.sendEmail({
    to: CONFIG.SEND_TO,
    subject: (isTest ? '[TEST] ' : '') + 'New booking: ' + d.name + ', ' + d.when,
    htmlBody: summaryHtml(d),
    attachments: [pdf],
    name: 'Portfolio booking brief'
  });
}

/* Pure functions below: no Google services, so they can be tested outside Apps Script. */

function parseNotes(text) {
  var out = { service: '', company: '', phone: '', problem: '', raw: text || '' };
  (text || '').split(/\r?\n/).forEach(function (line) {
    var m = line.match(/^\s*(Service|Company|Phone|Process costing the most time)\s*:\s*(.*)$/i);
    if (!m) return;
    var k = m[1].toLowerCase();
    if (k === 'service') out.service = m[2].trim();
    else if (k === 'company') out.company = m[2].trim();
    else if (k === 'phone') out.phone = m[2].trim();
    else out.problem = m[2].trim();
  });
  if (!out.service && !out.problem) out.problem = (text || '').trim();
  return out;
}

function fmt_(iso, tz) {
  var d = new Date(iso);
  if (typeof Utilities !== 'undefined') {
    return { when: Utilities.formatDate(d, tz, "EEE d MMM yyyy, h:mm a") + ' IST', short: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
             booked: Utilities.formatDate(new Date(), tz, 'd MMM yyyy, h:mm a') + ' IST' };
  }
  var o = { timeZone: tz };
  return { when: d.toLocaleString('en-IN', Object.assign({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }, o)) + ' IST',
           short: d.toLocaleDateString('en-CA', o), booked: new Date().toLocaleString('en-IN', o) + ' IST' };
}

function briefData(event, invitee, tz) {
  var qa = (invitee.questions_and_answers || []).map(function (q) { return q.answer; }).join('\n');
  var n = parseNotes(qa);
  var t = fmt_(event.start_time, tz);
  var mins = Math.round((new Date(event.end_time) - new Date(event.start_time)) / 60000);
  var play = PLAYBOOK[n.service] || PLAYBOOK['Not sure yet, help me decide'];
  return {
    name: invitee.name || '(no name)', email: invitee.email || '', company: n.company, phone: n.phone,
    service: n.service || 'Not stated', problem: n.problem || '(not given)', when: t.when, dateShort: t.short,
    booked: t.booked, minutes: mins, eventName: event.name || 'Workflow Audit call',
    meet: (event.location && event.location.join_url) || '', reschedule: invitee.reschedule_url || '', cancel: invitee.cancel_url || '',
    inviteeTz: invitee.timezone || '', proof: play.proof, questions: play.questions
  };
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function briefHtml(d) {
  var row = function (k, v) { return v ? '<tr><th>' + k + '</th><td>' + v + '</td></tr>' : ''; };
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@page{size:A4;margin:16mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11pt;line-height:1.45;margin:0}' +
    '.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:14px}' +
    '.k{font-size:8.5pt;letter-spacing:.14em;text-transform:uppercase;color:#666}h1{font-size:20pt;margin:2px 0 0;letter-spacing:-.02em}' +
    '.when{background:#0b0b0b;color:#fff;border-radius:8px;padding:12px 16px;margin-bottom:14px}.when b{font-size:14pt}' +
    '.when a{color:#7ee2bf}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{text-align:left;width:28%;color:#555;font-weight:600;font-size:9.5pt;padding:5px 0;vertical-align:top}' +
    'td{padding:5px 0;border-bottom:1px solid #eee}h2{font-size:10pt;letter-spacing:.12em;text-transform:uppercase;color:#08a87a;margin:14px 0 6px}' +
    '.box{background:#f5f3ee;border-radius:8px;padding:10px 14px}ol{margin:0;padding-left:18px}li{margin:3px 0}' +
    '.foot{margin-top:16px;font-size:8.5pt;color:#777;border-top:1px solid #ddd;padding-top:6px}</style></head><body>' +
    '<div class="top"><div><div class="k">Workflow Audit call &middot; prep brief</div><h1>' + esc_(d.name) + '</h1></div>' +
    '<div class="k" style="text-align:right">Aditya Totade<br>Business systems</div></div>' +
    '<div class="when"><div class="k" style="color:#bbb">When</div><b>' + esc_(d.when) + '</b> &middot; ' + d.minutes + ' min' +
    (d.meet ? '<br>Google Meet: <a href="' + esc_(d.meet) + '">' + esc_(d.meet) + '</a>' : '') + '</div>' +
    '<table>' + row('Email', esc_(d.email)) + row('Company', esc_(d.company)) + row('Phone', esc_(d.phone)) +
    row('Service', '<b>' + esc_(d.service) + '</b>') + row('Their time zone', esc_(d.inviteeTz)) + '</table>' +
    '<h2>What they said</h2><div class="box">' + esc_(d.problem) + '</div>' +
    '<h2>Proof to mention</h2><div>' + esc_(d.proof) + '</div>' +
    '<h2>Questions to ask</h2><ol>' + d.questions.map(function (q) { return '<li>' + esc_(q) + '</li>'; }).join('') + '</ol>' +
    '<h2>Close</h2><div>If it is a fit, the next step is a written proposal: problem, current state, desired state, deliverables, timeline and price.</div>' +
    '<div class="foot">Brief generated ' + esc_(d.booked) + ' from the Calendly booking.' +
    (d.reschedule ? ' Reschedule: ' + esc_(d.reschedule) : '') + '</div></body></html>';
}

function summaryHtml(d) {
  return '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    '<p><b>' + esc_(d.name) + '</b> booked a Workflow Audit call.</p>' +
    '<p><b>When:</b> ' + esc_(d.when) + ' (' + d.minutes + ' min)<br><b>Service:</b> ' + esc_(d.service) +
    (d.company ? '<br><b>Company:</b> ' + esc_(d.company) : '') + '<br><b>Email:</b> ' + esc_(d.email) +
    (d.meet ? '<br><b>Meet:</b> <a href="' + esc_(d.meet) + '">' + esc_(d.meet) + '</a>' : '') + '</p>' +
    '<p><b>What they said:</b> ' + esc_(d.problem) + '</p><p>The full prep brief is attached as a PDF.</p></div>';
}

if (typeof module !== 'undefined') module.exports = { parseNotes: parseNotes, briefData: briefData, briefHtml: briefHtml, summaryHtml: summaryHtml, PLAYBOOK: PLAYBOOK };
