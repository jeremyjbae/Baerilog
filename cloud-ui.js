/* cloud-ui.js - every pixel of cloud progress. cloud.js owns state and the
 * network and touches no DOM; this file owns the DOM and makes no request of its
 * own. That split is what lets the sync logic be driven headlessly with no stub
 * DOM, and it is why this file only ever calls CLOUD's published methods.
 *
 * IT ADDS NO MARKUP TO ANY APP. The control is appended to `.gh-nav`, the shared
 * header's link list, which all four pages already carry - the three menu apps in
 * their own <body> and the twenty practice pages through shell.js's injected
 * markup. So wiring an app up is one <script src> and nothing else, and there is
 * no per-app copy of a control to drift. The same reasoning as the header bar
 * itself: six copies of markup is the cost of six single-file apps, so anything
 * that can be built once in script is.
 *
 * IF NOTHING IS CONFIGURED, NOTHING APPEARS. cloud-config.js ships empty, so on
 * an unconfigured checkout this file injects its stylesheet, finds
 * CLOUD.configured() false and returns - no control, no avatar, no dialog, and the
 * page is the page it was before. An absent feature must not look like a broken
 * one, which is also why nothing renders an 'off' state.
 *
 * STYLES ARE INJECTED FROM HERE rather than living in a stylesheet, for one
 * reason: a <link> would be a fifth file for the practice pages and a first
 * external stylesheet for three apps that are meant to open standalone. Every
 * declaration uses a var(--token) from style.css - no literal colour - so the
 * result follows light and dark mode with the rest of the page and nothing new
 * has to be taught to tools/theme.py.
 */
'use strict';

(function () {
  if (!window.CLOUD) return;              // cloud.js absent: nothing to show

  /* ---- styles ---------------------------------------------------------- */

  /* --header-* for anything sitting on the top bar, which is dark in BOTH modes,
     and --canvas/--fg for the dialog, which follows the page. Getting that split
     wrong is the documented trap here: a token that happens to be white in light
     mode reads as correct until dark mode turns it near-black. */
  var CSS = [
    '.cloud-acct{display:flex;align-items:center;gap:8px;margin-left:14px}',
    '.cloud-btn{background:none;border:1px solid var(--header-muted);color:var(--header-fg);',
      'font:inherit;font-size:12px;padding:2px 9px;border-radius:var(--radius);cursor:pointer}',
    '.cloud-btn:hover{border-color:var(--header-fg)}',
    /* The state dot: a colour AND a word beside it in the drawer's head, so the state
       survives a greyscale screenshot and a reader who cannot separate the colours - the
       same rule the Scoreboard's flag casing is held to. */
    '.cloud-dot{width:7px;height:7px;border-radius:50%;background:var(--fg-muted);flex:none}',
    '.cloud-dot.ok{background:var(--success-fg)}',
    '.cloud-dot.busy{background:var(--attention-fg)}',
    '.cloud-dot.bad{background:var(--danger-fg)}',
    /* The connection indicator on the bar: the same state, one surface earlier. It is
       sized BY HEIGHT with the width left to follow, the rule the wordmark beside it
       follows - the ratio is 67:40 today and is not stable across a re-export, and a
       square box would squash it.

       The colours are --header-* rather than the dot's page-following tokens because
       this sits on the bar, which is dark in BOTH modes; they are the same hues, tuned
       for that surface (see style.css). `color` drives it, not `fill`, because the
       artwork is stroked as well as filled and one token has to reach both - the same
       reason .gh-row-icon sets color. */
    '.cloud-conn{display:inline-flex;align-items:center;flex:none;color:var(--header-muted)}',
    '.cloud-conn svg{height:14px;width:auto;display:block}',
    '.cloud-conn.ok{color:var(--header-success)}',
    '.cloud-conn.busy{color:var(--header-attention)}',
    '.cloud-conn.bad{color:var(--header-danger)}',
    /* --- the account control and its drawer, on the practice pages ---
       Geometry mirrors shell.js's navigation drawer (same width, same 220ms, same
       backdrop dim) so the page has ONE drawer idiom opening from two sides, and it is
       declared here rather than in practice.css because this file must also work in an
       app that loads no stylesheet of its own. Tokens only, as everywhere here. */
    '.cloud-signin{font-size:13px;padding:4px 12px;font-weight:600}',
    '.cloud-avatar{width:30px;height:30px;border-radius:50%;padding:0;flex:none;',
      'display:inline-flex;align-items:center;justify-content:center;font-size:11px;',
      'font-weight:700;letter-spacing:.02em;background:var(--canvas-default);',
      'color:var(--fg-default);border:1px solid var(--header-muted);cursor:pointer}',
    '.cloud-avatar:hover{border-color:var(--header-fg)}',
    '.cloud-dback{position:fixed;inset:0;z-index:2050;background:rgba(31,35,40,.5);',
      'opacity:0;visibility:hidden;transition:opacity 220ms ease,visibility 220ms}',
    '.cloud-dback.open{opacity:1;visibility:visible}',
    '.cloud-drawer{position:fixed;top:0;right:0;bottom:0;z-index:2100;',
      'width:min(340px,88vw);display:flex;flex-direction:column;overflow-y:auto;',
      'background:var(--canvas-default);color:var(--fg-default);',
      'border-left:1px solid var(--border-default);box-shadow:var(--shadow-overlay);',
      'transform:translateX(100%);visibility:hidden;',
      'transition:transform 220ms ease,visibility 220ms}',
    '.cloud-drawer.open{transform:translateX(0);visibility:visible}',
    '@media (prefers-reduced-motion:reduce){.cloud-drawer,.cloud-dback{transition:none}}',
    '.cloud-dhead{display:flex;align-items:center;gap:10px;padding:14px 16px;',
      'border-bottom:1px solid var(--border-default)}',
    '.cloud-dface{width:38px;height:38px;border-radius:50%;flex:none;display:flex;',
      'align-items:center;justify-content:center;font-size:13px;font-weight:700;',
      'border:1px solid var(--border-default);color:var(--fg-default)}',
    '.cloud-dwho{min-width:0;flex:1 1 auto}',
    '.cloud-dname{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cloud-dmail{font-size:12px;color:var(--fg-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cloud-dstate{display:inline-flex;align-items:center;gap:5px;font-size:12px;',
      'color:var(--fg-muted);flex:none}',
    '.cloud-icon-btn{flex:none;border:none;background:none;cursor:pointer;padding:4px;',
      'border-radius:var(--radius);color:var(--fg-muted);display:inline-flex}',
    '.cloud-icon-btn:hover{background:var(--canvas-subtle);color:var(--fg-default)}',
    '.cloud-icon-btn svg{width:16px;height:16px;fill:currentColor}',
    '.cloud-dlist{display:flex;flex-direction:column;gap:2px;padding:8px}',
    '.cloud-drow{display:flex;align-items:center;gap:10px;padding:8px 12px;',
      'border-radius:var(--radius);color:var(--fg-default);font-size:14px;',
      'background:none;border:none;font-family:inherit;text-align:left;cursor:pointer;width:100%}',
    '.cloud-drow:hover{background:var(--canvas-subtle)}',
    '.cloud-drow svg{width:16px;height:16px;fill:var(--fg-muted);flex:none}',
    '.cloud-dsep{border-top:1px solid var(--border-default);margin:6px 8px}',
    '.cloud-dsect{padding:10px 16px 0;font-size:12px;color:var(--fg-muted)}',
    '.cloud-dfield{padding:10px 16px}',
    '.cloud-dfield label{display:block;font-size:12px;color:var(--fg-muted);margin-bottom:4px}',
    '.cloud-dfield input{width:100%;box-sizing:border-box;font:inherit;font-size:14px;',
      'padding:6px 10px;border:1px solid var(--border-default);border-radius:var(--radius);',
      'background:var(--canvas-default);color:var(--fg-default)}',
    '.cloud-dnote{padding:0 16px 10px;font-size:12px;color:var(--fg-muted)}',
    '.cloud-dnote.bad{color:var(--danger-fg)}',
    '.cloud-dnote.ok{color:var(--success-fg)}',
    '.cloud-doc{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--radius);',
      'color:var(--fg-default);text-decoration:none;font-size:13px}',
    '.cloud-doc:hover{background:var(--canvas-subtle)}',
    '.cloud-doc .t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cloud-doc .m{flex:none;font-size:11px;color:var(--fg-muted)}',
    '.cloud-doc .v{flex:none;font-size:11px;border:1px solid var(--border-default);',
      'border-radius:2em;padding:0 7px;line-height:17px;color:var(--fg-muted)}',
    '.cloud-doc .v.pass{color:var(--success-fg);border-color:var(--success-fg)}',
    '.cloud-doc .v.fail{color:var(--danger-fg);border-color:var(--danger-fg)}',
    /* The dialog. --shadow-overlay and --radius-lg are the tokens every other
       raised surface in this repo uses, so it reads as part of the set. */
    '.cloud-back{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;',
      'display:flex;align-items:center;justify-content:center;padding:20px}',
    '.cloud-modal{background:var(--canvas-default);color:var(--fg-default);',
      'border:1px solid var(--border-default);border-radius:var(--radius-lg);',
      'box-shadow:var(--shadow-overlay);width:100%;max-width:400px;padding:20px}',
    '.cloud-modal h3{margin:0 0 6px;font-size:16px}',
    '.cloud-modal p{margin:0 0 14px;font-size:13px;color:var(--fg-muted);line-height:1.5}',
    '.cloud-modal input{width:100%;box-sizing:border-box;font:inherit;font-size:14px;',
      'padding:6px 9px;margin-bottom:12px;background:var(--canvas-default);',
      'color:var(--fg-default);border:1px solid var(--border-default);border-radius:var(--radius)}',
    '.cloud-modal .cloud-row{display:flex;gap:8px;align-items:center}',
    /* The destructive button in a confirm. --btn-danger-bg is style.css's, so this is
       the same red the Run button's error state uses rather than a second one; the
       label stays --fg-on-emphasis from .btn, never --canvas-default. */
    '.cloud-modal .cloud-danger{background:var(--btn-danger-bg)}',
    '.cloud-modal .cloud-danger:hover{background:var(--btn-danger-bg);filter:brightness(1.08)}',
    '.cloud-msg{font-size:12px;margin-top:10px;min-height:1.2em}',
    '.cloud-msg.bad{color:var(--danger-fg)}',
    '.cloud-msg.ok{color:var(--success-fg)}',
    /* A code is read digit by digit off an email, so it is set in the mono face
       at a wider tracking - the one place in this UI where legibility of an
       individual character matters more than the text reading as prose. */
    '.cloud-code{font-family:var(--font-mono);letter-spacing:.22em;text-align:center;font-size:18px !important}',
    '.cloud-link{background:none;border:none;padding:0;font:inherit;font-size:12px;',
      'color:var(--accent-fg);cursor:pointer;text-decoration:underline}'
  ].join('');

  var style = document.createElement('style');
  style.id = 'cloudStyles';
  style.textContent = CSS;
  document.head.appendChild(style);

  /* Configured is checked AFTER the stylesheet is injected but before anything is
     built, so an unconfigured page pays one empty <style> and gains no control.
     Returning here rather than never loading the file is what keeps the four
     apps' script tags unconditional. */
  if (!window.CLOUD.configured()) return;

  /* ---- the account control -------------------------------------------- */

  /* DECLARED BEFORE the control is built, and that is a bug fix rather than a
     tidy-up. `subscribe()` calls its subscriber immediately, build() subscribes,
     and this table used to sit BELOW the locate() call further down - so the first
     render read WORDS while the hoisted var was still undefined, threw
     `Cannot read properties of undefined`, and had it swallowed by subscribe's own
     try/catch (a UI bug must not break a sync). The control was therefore born
     blank - a grey dot and an empty button - and only filled in on the NEXT state
     change, which for a signed-out idle page never comes. That is why it looked as
     though the control only worked once you had signed in.

     The words are deliberately about the WORK ("saved", "saving...") rather than
     about the transport, because that is the question the learner is asking. */
  /* [dot class, word, connection form] - ONE table for all three encodings of the state,
     which is what stops the bar icon from disagreeing with the drawer's dot. The third
     field is 'on' for the connected artwork, 'off' for the disconnected one, and null for
     a state that shows no icon at all.

     `signed-out` is the null: the bar is showing a Sign In button right beside it, so an
     icon would only restate that. `offline` is 'off' and keeps the NEUTRAL dot class -
     the server is genuinely unreachable, which is what the disconnected artwork says, but
     the work is safe on this device, which is not a failure. `conflict` and `too-big` read
     as disconnected even though the server was reached and refused the write; the word is
     what distinguishes those, and one icon cannot say everything. */
  var WORDS = {
    'signed-out': ['', 'not signed in', null],
    'synced':     ['ok', 'saved', 'on'],
    'pending':    ['busy', 'saving…', 'on'],
    'syncing':    ['busy', 'saving…', 'on'],
    'sending':    ['busy', 'sending…', 'on'],
    'verifying':  ['busy', 'checking…', 'on'],
    'code-sent':  ['busy', 'check your email', 'on'],
    'signed-in':  ['ok', 'saved', 'on'],
    'offline':    ['', 'offline — saved on this device', 'off'],
    'conflict':   ['bad', 'needs attention', 'off'],
    'too-big':    ['bad', 'too large to sync', 'off'],
    'error':      ['bad', 'sync failed', 'off']
  };


  var acct;                                       // the bar's container
  var avatarBtn, signInBtn;                       // its two states
  var connEl;                                     // the connection indicator beside them
  var dBack, dPanel, dFace, dName, dMail, dDot, dWord, dBody;   // the drawer
  var view = 'menu';

  var GLYPH = {
    person: '<svg viewBox="0 0 16 16"><path d="M8 1.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5ZM6.25 4.75a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 0 1-3.5 0ZM3 14.5c0-2.2 2.2-3.75 5-3.75s5 1.55 5 3.75H3Z"/></svg>',
    /* Three ascending bars under a rising arrow - drawn here in the same 16x16
       fill-only idiom as the rows either side of it, not traced from anything. The
       bars sit in the lower half and the arrow in the upper, because a zig-zag like
       the one this replaces turns to mush at 16px; a single diagonal with a proper
       arrowhead keeps the meaning at that size. The head is a triangle whose
       hypotenuse is perpendicular to the shaft, so the two read as one arrow rather
       than as a line with a wedge stuck on it. */
    chart: '<svg viewBox="0 0 16 16"><path d="M1 11.8h3.4V15H1v-3.2Zm5.3-1.6h3.4V15H6.3v-4.8Zm5.3-1.6h3.4V15h-3.4V8.6ZM1.9 8.3 10.6 2.4l0.9 1.3L2.8 9.6 1.9 8.3Zm11.7-6.9L11.92 4.96 9.68 1.64 13.6 1.4Z"/></svg>',
    out: '<svg viewBox="0 0 16 16"><path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h4v1.5h-4v11h4V15h-4A1.5 1.5 0 0 1 2 13.5v-11Zm8.7 2.3 3.6 3.2-3.6 3.2-1-1.1 1.6-1.35H6V7.35h5.3L9.7 6l1-1.2Z"/></svg>',
    back: '<svg viewBox="0 0 16 16"><path d="M9.7 3.3 5 8l4.7 4.7-1.06 1.06L2.88 8l5.76-5.76L9.7 3.3Z"/></svg>',
    close: '<svg viewBox="0 0 16 16"><path d="M3.7 2.6 8 6.9l4.3-4.3 1.1 1.1L9.1 8l4.3 4.3-1.1 1.1L8 9.1l-4.3 4.3-1.1-1.1L6.9 8 2.6 3.7l1.1-1.1Z"/></svg>',
    /* Two plugs, joined and pulled apart - the server-connection indicator on the bar.
       Pasted from the cleaned connected.svg / disconnected.svg at the repo root and kept
       byte-identical to them: test_cloud.py compares the two, so a re-export that never
       reached this file is caught rather than going stale silently.

       Unlike every glyph above, these are STROKE-heavy as well as filled, so the paint is
       `currentColor` in the artwork itself rather than a `fill` rule in the CSS: the outer
       <g> carries fill="none" stroke="none", and a rule on the svg element would be
       overridden by that inherited none - the artwork would simply vanish.

       Both keep the SAME 67x40 viewBox, deliberately. The plugs are the same size in both
       and only the gap between them differs (the artwork spans 66pc of the box joined,
       92pc apart), so swapping them shows plugs separating rather than resizing, and the
       slot cannot change width - a state flip must not reflow the header row. Tightening
       each to its own artwork would break both properties. */
    connected: '<svg viewBox="0 0 67 40"><g fill-opacity="1" stroke-opacity="1" fill="none" stroke-dasharray="none" stroke="none"> <g> <g> <g> <g> <rect x="20" y="20" width="17.5" height=".125" fill="currentColor"/> <rect x="20" y="20" width="17.5" height=".125" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/> </g> <g> <path d="M 15 12.5 C 18.333333 12.5 16.666667 12.5 20 12.5 C 25 12.5 25 17.5 25 17.5 C 25 19.166667 25 20.833333 25 22.5 C 25 22.5 25 27.5 20 27.5 C 15 27.5 18.333333 27.5 15 27.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.6"/> </g> </g> <g> <rect x="11.688813" y="10.714286" width="7.5" height="3.5714286" fill="currentColor"/> </g> <g> <rect x="11.701874" y="25.714286" width="7.5" height="3.5714286" fill="currentColor"/> </g> </g> <g> <g> <g> <rect x="30" y="20" width="17.5" height=".125" fill="currentColor"/> <rect x="30" y="20" width="17.5" height=".125" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/> </g> <g> <path d="M 52.5 12.5 C 49.166667 12.5 50.833333 12.5 47.5 12.5 C 42.5 12.5 42.5 17.5 42.5 17.5 C 42.5 19.166667 42.5 20.833333 42.5 22.5 C 42.5 22.5 42.5 27.5 47.5 27.5 C 52.5 27.5 49.166667 27.5 52.5 27.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.6"/> </g> </g> <g> <rect x="48.311187" y="10.714286" width="7.5" height="3.5714286" fill="currentColor"/> </g> <g> <rect x="48.298126" y="25.714286" width="7.5" height="3.5714286" fill="currentColor"/> </g> </g> </g> </g></svg>',
    disconnected: '<svg viewBox="0 0 67 40"><g fill-opacity="1" stroke-opacity="1" fill="none" stroke-dasharray="none" stroke="none"> <g> <g> <g> <g> <rect x="45" y="20" width="17.5" height=".125" fill="currentColor"/> <rect x="45" y="20" width="17.5" height=".125" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/> </g> <g> <path d="M 40 12.5 C 43.333333 12.5 41.666667 12.5 45 12.5 C 50 12.5 50 17.5 50 17.5 C 50 19.166667 50 20.833333 50 22.5 C 50 22.5 50 27.5 45 27.5 C 40 27.5 43.333333 27.5 40 27.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.6"/> </g> </g> <g> <rect x="36.688813" y="10.714286" width="7.5" height="3.5714286" fill="currentColor"/> </g> <g> <rect x="36.701874" y="25.714286" width="7.5" height="3.5714286" fill="currentColor"/> </g> </g> <g> <g> <g> <rect x="5" y="20" width="17.5" height=".125" fill="currentColor"/> <rect x="5" y="20" width="17.5" height=".125" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/> </g> <g> <path d="M 27.5 12.5 C 24.166667 12.5 25.833333 12.5 22.5 12.5 C 17.5 12.5 17.5 17.5 17.5 17.5 C 17.5 19.166667 17.5 20.833333 17.5 22.5 C 17.5 22.5 17.5 27.5 22.5 27.5 C 27.5 27.5 24.166667 27.5 27.5 27.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.6"/> </g> </g> <g> <rect x="23.311187" y="10.714286" width="7.5" height="3.5714286" fill="currentColor"/> </g> <g> <rect x="23.298126" y="25.714286" width="7.5" height="3.5714286" fill="currentColor"/> </g> </g> </g> </g></svg>'
  };

  /* "jeremyjbae@gmail.com" with no name set gives JE; "Jeremy Bae" gives JB. Initials
     come from the NAME when there is one, because that is what the learner set them to
     be - the email is only the fallback. */
  function initials(name, email) {
    var src = String(name || '').trim();
    if (src) {
      var parts = src.split(/\s+/);
      return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    }
    var local = String(email || '').split('@')[0].replace(/[^a-z0-9]/gi, '');
    return (local.slice(0, 2) || '?').toUpperCase();
  }

  function el(tag, cls, id, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (id) e.id = id;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function iconBtn(cls, id, glyph, label) {
    var b = el('button', cls, id);
    b.setAttribute('type', 'button');
    b.setAttribute('aria-label', label);
    b.setAttribute('title', label);
    b.innerHTML = glyph;
    return b;
  }

  /* ---- the account control and drawer, on the practice pages ---------- */

  function buildAccount(nav) {
    acct = el('span', 'cloud-acct', 'cloudAcct');
    signInBtn = el('button', 'cloud-btn cloud-signin', 'cloudSignBtn', 'Sign In');
    signInBtn.setAttribute('type', 'button');
    signInBtn.addEventListener('click', openDialog);
    avatarBtn = el('button', 'cloud-avatar', 'cloudAvatarBtn');
    avatarBtn.setAttribute('type', 'button');
    avatarBtn.setAttribute('aria-label', 'Account');
    avatarBtn.setAttribute('aria-expanded', 'false');
    avatarBtn.addEventListener('click', function () {
      if (dBack && dBack.classList.contains('open')) closeDrawer(); else openDrawer();
    });
    /* First in the row, so the state reads before the account it belongs to, and
       .cloud-acct's own gap:8px places it - no margin of its own to keep in step. A span
       rather than a button: the avatar right beside it already opens the drawer where the
       word and the detail live, and two adjacent controls doing one thing reads as a
       mistake. role=img with a label is what carries it to a reader who cannot see it. */
    connEl = el('span', 'cloud-conn', 'cloudConn');
    connEl.setAttribute('role', 'img');
    acct.appendChild(connEl);
    acct.appendChild(signInBtn);
    acct.appendChild(avatarBtn);
    nav.appendChild(acct);
    buildDrawer();
    window.CLOUD.subscribe(renderAccount);
  }

  function buildDrawer() {
    dBack = el('div', 'cloud-dback', 'cloudDrawerBack');
    dPanel = el('aside', 'cloud-drawer', 'cloudDrawer');
    dPanel.setAttribute('role', 'dialog');
    dPanel.setAttribute('aria-modal', 'true');
    dPanel.setAttribute('aria-label', 'Account');

    var head = el('div', 'cloud-dhead');
    dFace = el('div', 'cloud-dface', 'cloudFace');
    var who = el('div', 'cloud-dwho');
    dName = el('div', 'cloud-dname', 'cloudName');
    dMail = el('div', 'cloud-dmail', 'cloudEmail');
    who.appendChild(dName);
    who.appendChild(dMail);
    /* The sync state moved OFF the bar and into this row: the same dot and word the
       pill carried, so it is still two encodings of one state, but read where the
       account is read rather than crowding the header. */
    var st = el('span', 'cloud-dstate', 'cloudState');
    dDot = el('span', 'cloud-dot');
    dWord = el('span', null, null, '');
    st.appendChild(dDot);
    st.appendChild(dWord);
    /* There was a "Switch account" button here and it is deliberately gone. It ran
       signOut() and then opened the dialog, so it differed from Sign out by exactly one
       line - and since closeDialog() restores nothing, cancelling out of it left you
       signed OUT. Its only distinct behaviour was "and here is the sign-in box", which is
       why it read as a second Sign out. Sign in from the signed-out bar is one click.
       (Worth knowing if it ever comes back: verifyCode adopts the new tokens outright, so
       a real switch needs no signOut at all - opening the dialog while still signed in
       would make cancelling harmless. That was the alternative, and removal was chosen.) */
    var x = iconBtn('cloud-icon-btn', 'cloudDrawerClose', GLYPH.close, 'Close');
    x.addEventListener('click', closeDrawer);
    head.appendChild(dFace);
    head.appendChild(who);
    head.appendChild(st);
    head.appendChild(x);

    dBody = el('div', null, 'cloudDrawerBody');
    dPanel.appendChild(head);
    dPanel.appendChild(dBody);
    dBack.appendChild(dPanel);            // a child, so ev.target can tell them apart
    document.body.appendChild(dBack);
    dBack.addEventListener('click', function (ev) { if (ev.target === dBack) closeDrawer(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && dBack.classList.contains('open')) closeDrawer();
    });
  }

  function openDrawer() {
    /* One drawer at a time. shell.js's navigation drawer is queried at click time
       rather than captured, so neither file has to load before the other. */
    var nb = document.getElementById('navBackdrop'), nd = document.getElementById('navDrawer');
    if (nb) nb.classList.remove('open');
    if (nd) nd.classList.remove('open');
    if (document.body.classList) document.body.classList.remove('nav-open');
    view = 'menu';
    renderBody();
    dBack.classList.add('open');
    dPanel.classList.add('open');
    document.body.classList.add('nav-open');
    if (avatarBtn) avatarBtn.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    dBack.classList.remove('open');
    dPanel.classList.remove('open');
    document.body.classList.remove('nav-open');
    if (avatarBtn) {
      avatarBtn.setAttribute('aria-expanded', 'false');
      if (avatarBtn.focus) avatarBtn.focus();
    }
  }

  function menuRow(id, glyph, text, onClick) {
    var b = el('button', 'cloud-drow', id);
    b.setAttribute('type', 'button');
    b.innerHTML = glyph;
    b.appendChild(el('span', null, null, text));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderBody() {
    if (!dBody) return;
    dBody.innerHTML = '';
    if (view === 'profile') return renderProfile();
    if (view === 'designs') return renderDesigns();
    var list = el('div', 'cloud-dlist');
    list.appendChild(menuRow('cloudProfileRow', GLYPH.person, 'Profile', function () {
      view = 'profile'; renderBody();
    }));
    list.appendChild(menuRow('cloudDesignsRow', GLYPH.chart, 'My Progress', function () {
      view = 'designs'; renderBody();
    }));
    dBody.appendChild(list);
    dBody.appendChild(el('div', 'cloud-dsep'));
    var out = el('div', 'cloud-dlist');
    out.appendChild(menuRow('cloudSignOutRow', GLYPH.out, 'Sign out', function () {
      // The drawer closes either way: the confirm is a dialog of its own, and leaving the
      // drawer open behind it would put two dismissable layers on screen at once.
      closeDrawer();
      askSignOut();
    }));
    dBody.appendChild(out);
  }

  function backRow(text) {
    var row = el('div', 'cloud-dlist');
    row.appendChild(menuRow('cloudBackRow', GLYPH.back, text, function () {
      view = 'menu'; renderBody();
    }));
    return row;
  }

  /* Profile is the display name and nothing else, because the name is the only thing
     about the account this page can change: the email IS the identity (it is what a
     code is sent to), so it is shown and not editable. */
  function renderProfile() {
    dBody.appendChild(backRow('Profile'));
    var f = el('div', 'cloud-dfield');
    var lab = el('label', null, null, 'Display name');
    lab.setAttribute('for', 'cloudNameInput');
    var inp = el('input', null, 'cloudNameInput');
    inp.setAttribute('type', 'text');
    inp.setAttribute('placeholder', 'e.g. Jeremy Bae');
    inp.value = window.CLOUD.info().name || '';
    f.appendChild(lab);
    f.appendChild(inp);
    dBody.appendChild(f);
    var mail = el('div', 'cloud-dfield');
    var ml = el('label', null, null, 'Email');
    ml.setAttribute('for', 'cloudMailRead');
    var mi = el('input', null, 'cloudMailRead');
    mi.setAttribute('type', 'text');
    mi.disabled = true;
    mi.value = window.CLOUD.info().email || '';
    mail.appendChild(ml);
    mail.appendChild(mi);
    dBody.appendChild(mail);
    var note = el('div', 'cloud-dnote', 'cloudProfileNote', '');
    dBody.appendChild(note);
    var actions = el('div', 'cloud-dfield');
    var save = el('button', 'btn', 'cloudNameSave', 'Save');
    save.setAttribute('type', 'button');
    save.addEventListener('click', function () {
      note.className = 'cloud-dnote';
      note.textContent = 'Saving...';
      window.CLOUD.setName(inp.value).then(function (r) {
        note.className = 'cloud-dnote ' + (r.ok ? 'ok' : 'bad');
        note.textContent = r.ok ? 'Saved.'
          : (r.offline ? 'No connection - your name was not saved.' : (r.error || 'Could not save.'));
      });
    });
    actions.appendChild(save);
    dBody.appendChild(actions);
  }

  /* Every document the learner has, local first and the server's own rows after -
     which is what makes this honest on a second machine, where nothing is stored
     here yet. A remote row is listed, never adopted: merging is pull()'s job, under
     the conflict rule. */
  function renderDesigns() {
    dBody.appendChild(backRow('My Progress'));
    var wrap = el('div', 'cloud-dlist', 'cloudDesignList');
    dBody.appendChild(wrap);
    var note = el('div', 'cloud-dnote', 'cloudDesignNote', 'Loading...');
    dBody.appendChild(note);
    draw(window.CLOUD.list(), wrap, note, false);
    window.CLOUD.listAll().then(function (r) {
      if (view !== 'designs') return;              // the panel moved on while we waited
      draw(r.docs, wrap, note, true, r);
    });

    function draw(docs, into, msg, done, r) {
      into.innerHTML = '';
      docs.forEach(function (d) { into.appendChild(docRow(d)); });
      if (!docs.length) msg.textContent = done ? 'Nothing saved yet.' : 'Loading...';
      else if (done && r && !r.ok) msg.textContent = r.offline
        ? 'Showing what is on this device - no connection.' : (r.error || '');
      else msg.textContent = done ? '' : 'Loading...';
    }
  }

  /* practice/<slug> is a page; the three menu apps are one document each, so their
     row points at the app itself. An unknown app gets no link rather than a guess. */
  function docHref(d) {
    if (d.app === 'practice') return d.item + '.html';
    if (d.app === 'simulator') return 'simulator.html';
    if (d.app === 'synthesis') return 'synthesis.html';
    if (d.app === 'compiler') return 'compiler.html';
    return '';
  }
  function ago(t) {
    if (!t) return '';
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    if (m < 1440) return Math.floor(m / 60) + 'h ago';
    return Math.floor(m / 1440) + 'd ago';
  }
  function docRow(d) {
    var href = docHref(d);
    var row = el(href ? 'a' : 'div', 'cloud-doc');
    if (href) row.setAttribute('href', href);
    var title = d.app === 'practice' ? d.item : d.app;
    row.appendChild(el('span', 't', null, title));
    if (d.verdict && d.verdict.state) {
      var v = d.verdict;
      var txt = v.state === 'pass' ? (v.pass ? v.pass + '/' + v.pass + ' passing' : 'passing')
              : v.state === 'fail' ? (v.fail ? v.fail + ' failing' : 'failing')
              : 'in progress';
      row.appendChild(el('span', 'v ' + (v.state === 'pass' ? 'pass' : v.state === 'fail' ? 'fail' : ''), null, txt));
    }
    row.appendChild(el('span', 'm', null, (d.here ? '' : 'cloud · ') + ago(d.updatedAt)));
    return row;
  }

  /* The nav is injected by shell.js on a practice page and is static markup in
     the three menu apps, and this file may be loaded before or after either. So
     it is looked for now and again once the document is parsed, rather than
     assuming a position in the load order that differs between the two cases. */
  (function locate() {
    var nav = document.querySelector('.gh-nav');
    if (nav) { buildAccount(nav); return; }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        var late = document.querySelector('.gh-nav');
        if (late) buildAccount(late);
      });
    }
  })();

  /* The bar is ONE control at a time: a Sign In button, or the avatar. Both exist in
     the DOM and one is hidden, rather than being created and destroyed, so nothing has
     to re-wire a handler on every state change. */
  function renderAccount(i) {
    if (!acct) return;
    var w = WORDS[i.state] || ['', ''];
    signInBtn.style.display = i.signedIn ? 'none' : '';
    avatarBtn.style.display = i.signedIn ? '' : 'none';
    renderConn(i, w);
    avatarBtn.textContent = initials(i.name, i.email);
    avatarBtn.title = i.name ? (i.name + ' · ' + i.email) : (i.email || 'Account');
    if (!i.signedIn && dBack && dBack.classList.contains('open')) closeDrawer();
    if (!dFace) return;
    dFace.textContent = initials(i.name, i.email);
    /* The name line falls back to the email rather than sitting empty, so the panel
       never has a blank where a person should be - and the email line then drops out,
       because printing it twice reads as a rendering fault. */
    dName.textContent = i.name || i.email || 'Signed in';
    dMail.textContent = i.name ? i.email : '';
    dDot.className = 'cloud-dot' + (w[0] ? ' ' + w[0] : '');
    dWord.textContent = i.signedIn ? w[1] : '';
    if (i.error) dWord.title = i.error; else dWord.removeAttribute('title');
  }

  /* The bar's connection indicator. It takes BOTH of its encodings from the same WORDS
     row the drawer's dot and word came from - the artwork from the third field, the colour
     class from the FIRST, which is literally the dot's class - so the two surfaces cannot
     come to disagree about one state. Reading the class off the dot rather than deriving a
     second mapping is the whole point; a mutant that decouples them is caught.

     Hidden when the third field is null (signed out) and whenever we are not signed in at
     all, which also covers the sign-in states: `sending` and `verifying` are 'on', but
     they happen before there is a session, and an indicator that said "connected" beside
     a Sign In button would be answering a question nobody asked.

     innerHTML is written only when the artwork actually changes. That is not a
     micro-optimisation: this runs on every state emit, and a page that is saving hands
     out several per second - reparsing an SVG each time to produce identical DOM is work
     with no output, and it would also restart nothing visibly, so the guard is free. */
  function renderConn(i, w) {
    if (!connEl) return;
    var form = i.signedIn ? w[2] : null;
    connEl.style.display = form ? '' : 'none';
    if (!form) { connEl.removeAttribute('aria-label'); connEl.removeAttribute('title'); return; }
    var glyph = form === 'on' ? GLYPH.connected : GLYPH.disconnected;
    if (connEl.getAttribute('data-form') !== form) {
      connEl.innerHTML = glyph;
      connEl.setAttribute('data-form', form);
    }
    connEl.className = 'cloud-conn' + (w[0] ? ' ' + w[0] : '');
    /* The label says the connection AND the word, because the artwork alone cannot
       distinguish 'needs attention' from 'sync failed' - both are disconnected+red. */
    var label = (form === 'on' ? 'server connected' : 'server disconnected')
              + (w[1] ? ' \u2014 ' + w[1] : '');
    connEl.setAttribute('aria-label', label);
    connEl.setAttribute('title', label);
  }

  /* ---- the sign-in dialog --------------------------------------------- */

  var back = null, emailValue = '';

  function closeDialog() {
    if (!back) return;
    document.removeEventListener('keydown', onKey);
    back.remove();
    back = null;
  }

  /* Escape closes, and a click on the BACKDROP ITSELF closes - `ev.target ===
     back` rather than a containment test, or a click that starts on the modal
     and drifts onto the backdrop dismisses the dialog with a half-typed code in
     it. The practice site's exercise sheet learned the same thing. */
  function onKey(ev) { if (ev.key === 'Escape') closeDialog(); }

  function openDialog() {
    closeDialog();
    back = document.createElement('div');
    back.className = 'cloud-back';
    back.id = 'cloudBackdrop';
    back.addEventListener('click', function (ev) { if (ev.target === back) closeDialog(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    showEmailStep();
  }

  function modal() {
    var m = document.createElement('div');
    m.className = 'cloud-modal';
    back.textContent = '';
    back.appendChild(m);
    return m;
  }

  function msgLine(parent) {
    var el = document.createElement('div');
    el.className = 'cloud-msg';
    parent.appendChild(el);
    return el;
  }
  function say(el, text, kind) {
    el.className = 'cloud-msg' + (kind ? ' ' + kind : '');
    el.textContent = text;
  }

  function showEmailStep() {
    var m = modal();
    var h = document.createElement('h3');
    h.textContent = 'Save your progress';
    var p = document.createElement('p');
    /* States what will happen and what will not. "No password" is the honest
       selling point of the code flow, and saying the code arrives by email is
       what stops a learner waiting for a link to click. */
    p.textContent = 'Enter your email and we will send you a 6-digit code. ' +
                    'No password, and your work syncs to any browser you sign in from.';
    var input = document.createElement('input');
    input.type = 'email';
    input.id = 'cloudEmail';
    input.placeholder = 'you@example.com';
    input.value = emailValue;
    input.autocomplete = 'email';

    var row = document.createElement('div');
    row.className = 'cloud-row';
    var send = document.createElement('button');
    /* .btn is the shared primary button, so this is the one green control in the
       dialog and it carries --fg-on-emphasis for its text through that class
       rather than through anything written here. */
    send.className = 'btn';
    send.id = 'cloudSendBtn';
    send.textContent = 'Send code';
    var cancel = document.createElement('button');
    cancel.className = 'btn secondary';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeDialog);
    row.appendChild(send);
    row.appendChild(cancel);

    m.appendChild(h); m.appendChild(p); m.appendChild(input); m.appendChild(row);
    var msg = msgLine(m);

    function submit() {
      emailValue = input.value;
      send.disabled = true;
      say(msg, 'Sending…');
      window.CLOUD.requestCode(emailValue).then(function (r) {
        send.disabled = false;
        if (r.ok) showCodeStep();
        /* An offline failure is named as such rather than as a rejection: the
           email address was probably fine and retrying later is the advice. */
        else say(msg, r.offline ? 'No connection — your work is still saved on this device.'
                                : r.error, 'bad');
      });
    }
    send.addEventListener('click', submit);
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
    input.focus();
  }

  function showCodeStep() {
    var m = modal();
    var h = document.createElement('h3');
    h.textContent = 'Enter your code';
    var p = document.createElement('p');
    p.textContent = 'We sent a 6-digit code to ' + emailValue + '. It expires in about an hour.';
    var input = document.createElement('input');
    input.className = 'cloud-code';
    input.id = 'cloudCode';
    input.placeholder = '000000';
    input.inputMode = 'numeric';
    input.autocomplete = 'one-time-code';
    input.maxLength = 8;

    var row = document.createElement('div');
    row.className = 'cloud-row';
    var go = document.createElement('button');
    go.className = 'btn';
    go.id = 'cloudVerifyBtn';
    go.textContent = 'Sign in';
    var again = document.createElement('button');
    again.className = 'cloud-link';
    again.textContent = 'Use a different email';
    again.addEventListener('click', showEmailStep);
    row.appendChild(go);
    row.appendChild(again);

    m.appendChild(h); m.appendChild(p); m.appendChild(input); m.appendChild(row);
    var msg = msgLine(m);

    function submit() {
      go.disabled = true;
      say(msg, 'Checking…');
      window.CLOUD.verifyCode(emailValue, input.value).then(function (r) {
        go.disabled = false;
        if (!r.ok) { say(msg, r.error, 'bad'); return; }
        say(msg, 'Signed in.', 'ok');
        /* The dialog closes itself, and the PAGE decides what to do about the new
           session - it is the page that knows which document is open and whether
           the editor has been touched. Adopting cloud text from in here would
           mean this file reaching into four different editors. */
        window.setTimeout(closeDialog, 550);
        if (typeof window.CLOUD_ON_SIGNIN === 'function') {
          try { window.CLOUD_ON_SIGNIN(); } catch (e) { /* page's bug, not ours */ }
        }
      });
    }
    go.addEventListener('click', submit);
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
    input.focus();
  }

  /* ---- conflicts ------------------------------------------------------- */

  /* Sign out is one click on a row in a drawer, next to two navigation rows that also
     take one click - so it was reachable by accident, and the cost is not symmetrical
     with theirs. This is the same shape askConflict below has, and the same rule: the
     SAFE outcome is what doing nothing gives you, so Escape and a click on the backdrop
     both cancel, and the destructive button is the one that has to be aimed at.

     The reassurance in the text is true rather than soothing: signOut() calls
     saveSession(null) and nothing else, so every document stays in localStorage and is
     still there on the next sign-in. Saying so is the point - without it the honest
     reading of "sign out" is "lose what has not been pushed". */
  function askSignOut() {
    closeDialog();
    back = document.createElement('div');
    back.className = 'cloud-back';
    back.id = 'cloudBackdrop';
    back.addEventListener('click', function (ev) { if (ev.target === back) closeDialog(); });
    document.body.appendChild(back);
    var m = modal();
    var h = document.createElement('h3');
    h.textContent = 'Sign out?';
    var p = document.createElement('p');
    p.textContent = 'Your work stays on this device — signing out only forgets the '
                  + 'account, and signing back in picks it up again. Anything not yet '
                  + 'pushed to the cloud will sync then.';
    var row = document.createElement('div');
    row.className = 'cloud-row';
    var go = document.createElement('button');
    go.className = 'btn cloud-danger';
    go.id = 'cloudSignOutConfirm';
    go.textContent = 'Sign out';
    go.addEventListener('click', function () {
      window.CLOUD.signOut();
      closeDialog();
    });
    var no = document.createElement('button');
    no.className = 'btn secondary';
    no.id = 'cloudSignOutCancel';
    no.textContent = 'Cancel';
    no.addEventListener('click', closeDialog);
    row.appendChild(go);
    row.appendChild(no);
    m.appendChild(h); m.appendChild(p); m.appendChild(row);
    document.addEventListener('keydown', onKey);
  }

  /* Shown only when cloud.js reports that BOTH copies moved since the last sync.
     Neither is discarded and neither is preselected as correct; the learner is
     told what each one is and picks. Doing nothing keeps the local copy, which is
     the text already on screen - so the safe outcome is also the default. */
  function askConflict(app, item, c) {
    closeDialog();
    back = document.createElement('div');
    back.className = 'cloud-back';
    back.id = 'cloudBackdrop';
    document.body.appendChild(back);
    var m = modal();
    var h = document.createElement('h3');
    h.textContent = 'Two versions of this work';
    var p = document.createElement('p');
    p.textContent = 'This exercise was edited both here and somewhere else since it ' +
      'last synced. Nothing has been overwritten — choose which one to keep. ' +
      'The version on this device is ' + (c.local || '').length + ' characters, ' +
      'the one in the cloud is ' + (c.remote || '').length + '.';
    var row = document.createElement('div');
    row.className = 'cloud-row';
    var keep = document.createElement('button');
    keep.className = 'btn';
    keep.textContent = 'Keep this device’s';
    keep.addEventListener('click', function () {
      window.CLOUD.resolve(app, item, 'local');
      closeDialog();
    });
    var take = document.createElement('button');
    take.className = 'btn secondary';
    take.textContent = 'Use the cloud version';
    take.addEventListener('click', function () {
      var rec = window.CLOUD.resolve(app, item, 'remote', c.remote);
      closeDialog();
      if (typeof window.CLOUD_ON_ADOPT === 'function') {
        try { window.CLOUD_ON_ADOPT(rec); } catch (e) { /* as above */ }
      }
    });
    row.appendChild(keep);
    row.appendChild(take);
    m.appendChild(h); m.appendChild(p); m.appendChild(row);
    document.addEventListener('keydown', onKey);
  }

  /* The two things a host page needs from this file, and nothing more. */
  /* `ago` is exported for Baerilog/home.js's dashboard, which lists the same documents
     the drawer's My Progress view does - one relative-time format, so the two cannot
     describe the same instant differently. */
  window.CLOUD_UI = { open: openDialog, close: closeDialog, askConflict: askConflict,
                      ago: ago };
})();
