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
 * CLOUD.configured() false and returns - no control, no pill, no dialog, and the
 * page is the page it was before. An absent feature must not look like a broken
 * one, which is also why the pill never renders the 'off' state.
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
    /* The pill is two encodings of one state - a coloured dot and a word - so it
       stays readable in a greyscale screenshot and to a reader who cannot
       separate the colours. The same rule the Scoreboard's flag casing is held to. */
    '.cloud-pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--header-muted)}',
    '.cloud-dot{width:7px;height:7px;border-radius:50%;background:var(--header-muted);flex:none}',
    '.cloud-dot.ok{background:var(--success-fg)}',
    '.cloud-dot.busy{background:var(--attention-fg)}',
    '.cloud-dot.bad{background:var(--danger-fg)}',
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

  var acct, pill, dot, label, signBtn;

  function build(nav) {
    acct = document.createElement('span');
    acct.className = 'cloud-acct';
    acct.id = 'cloudAcct';

    pill = document.createElement('span');
    pill.className = 'cloud-pill';
    dot = document.createElement('span');
    dot.className = 'cloud-dot';
    label = document.createElement('span');
    pill.appendChild(dot);
    pill.appendChild(label);

    signBtn = document.createElement('button');
    signBtn.className = 'cloud-btn';
    signBtn.id = 'cloudSignBtn';
    signBtn.addEventListener('click', function () {
      if (window.CLOUD.signedIn()) window.CLOUD.signOut();
      else openDialog();
    });

    acct.appendChild(pill);
    acct.appendChild(signBtn);
    nav.appendChild(acct);
    window.CLOUD.subscribe(render);
  }

  /* The nav is injected by shell.js on a practice page and is static markup in
     the three menu apps, and this file may be loaded before or after either. So
     it is looked for now and again once the document is parsed, rather than
     assuming a position in the load order that differs between the two cases. */
  (function locate() {
    var nav = document.querySelector('.gh-nav');
    if (nav) { build(nav); return; }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        var late = document.querySelector('.gh-nav');
        if (late) build(late);
      });
    }
  })();

  /* One state string in, one appearance out - so the pill cannot disagree with
     what cloud.js thinks is happening. The words are deliberately about the
     WORK ("saved", "saving…") rather than about the transport, because that is
     the question the learner is actually asking. */
  var WORDS = {
    'signed-out': ['', 'not signed in'],
    'synced':     ['ok', 'saved'],
    'pending':    ['busy', 'saving…'],
    'syncing':    ['busy', 'saving…'],
    'sending':    ['busy', 'sending…'],
    'verifying':  ['busy', 'checking…'],
    'code-sent':  ['busy', 'check your email'],
    'signed-in':  ['ok', 'saved'],
    'offline':    ['', 'offline — saved on this device'],
    'conflict':   ['bad', 'needs attention'],
    'too-big':    ['bad', 'too large to sync'],
    'error':      ['bad', 'sync failed']
  };

  function render(i) {
    if (!acct) return;
    var w = WORDS[i.state] || ['', ''];
    dot.className = 'cloud-dot' + (w[0] ? ' ' + w[0] : '');
    label.textContent = i.signedIn ? w[1] : (i.state === 'signed-out' ? '' : w[1]);
    /* The email is the label when signed in: it is both the identity and the
       answer to "whose progress am I looking at", which matters on a shared
       machine. Sign out is the button, so the account is never a dead end. */
    signBtn.textContent = i.signedIn ? 'Sign out' : 'Sign in to save';
    signBtn.title = i.signedIn ? ('Signed in as ' + i.email) : 'Save your work to the cloud';
    if (i.signedIn && i.email) label.textContent = i.email + (w[1] ? ' · ' + w[1] : '');
    if (i.error) pill.title = i.error; else pill.removeAttribute('title');
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
  window.CLOUD_UI = { open: openDialog, close: closeDialog, askConflict: askConflict };
})();
