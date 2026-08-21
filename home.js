/* home.js - what index.html shows a learner who is signed IN.
 *
 * Signed out, this file does nothing at all and the page is the landing hero it has
 * always been. Signed in, the hero is hidden and a dashboard takes its place: what is
 * in progress, what to do next, and the three app documents.
 *
 * Five things about the arrangement are load-bearing:
 *
 *  - IT IS DRIVEN BY CLOUD.subscribe, not by reading the session once. subscribe calls
 *    its subscriber immediately AND on every state change, so the same code paints the
 *    first frame and reacts to a sign-in or a sign-out with no reload - which is also
 *    what makes Sign out in the drawer restore the hero with no wiring of its own. It
 *    removes a load-order dependency too: index.html's cloud scripts come after its own
 *    inline script, so anything reading CLOUD at parse time would be reading undefined.
 *
 *  - AN UNCONFIGURED CHECKOUT IS UNTOUCHED. configured() false returns before the DOM is
 *    read, so a repo with no Supabase project renders exactly the page it did before this
 *    file existed. That is asserted, and mutation-tested, in Baerilog/test_cloud.py.
 *
 *  - LOCAL FIRST. CLOUD.list() is synchronous and local, so the dashboard paints from it
 *    at once; CLOUD.listAll() then merges what other machines have and repaints. A reader
 *    with no network sees their own work immediately rather than a spinner.
 *
 *  - THE HERO IS HIDDEN, NOT REBUILT. Both views are markup that already exists in
 *    index.html and the switch is `hidden` on two elements, so no state lives in the DOM
 *    and flipping back and forth cannot lose anything.
 *
 *  - PANEL TOKENS, not page tokens. This page is dark in BOTH colour modes - see
 *    landing.css - so --fg-default and friends, which follow the reader's OS, are the
 *    wrong set here. Everything below styles with --panel-*, which is the same in both.
 */
'use strict';

(function () {
  if (!window.CLOUD || !window.CLOUD.configured()) return;

  var hero = document.querySelector('main.lp');
  var dash = document.getElementById('dash');
  if (!hero || !dash) return;

  /* The catalogues, if the page loaded them. Guarded rather than assumed: index.html is
     hand-maintained, and a dashboard that throws would take the landing page down with
     it for a signed-in reader - strictly worse than a dashboard with one empty section. */
  var LEARN = window.LEARN_MANIFEST || [];
  var PRAC = window.PRACTICE_MANIFEST || [];
  var CATS = window.PRACTICE_CATEGORIES || [];

  var APP_TITLES = { code2silicon: 'Code2Silicon',
                     simulator: 'Simulator', synthesis: 'Synthesizer',
                     pnr: 'Place & Route', compiler: 'Compiler' };
  /* `APP_ORDER` IS GONE with the fixed row-per-app My Projects section it ordered. That section
     listed the five apps' scratch documents; it lists the reader's NAMED projects now, newest
     first, so there is no fixed order left to state. `APP_TITLES` stays - it is what names the
     app a project belongs to, which is the column that replaced the row. */
  var NEXT_MAX = 3;

  /* Relative time comes from CLOUD_UI so the dashboard and the account drawer's My
     Progress list cannot describe the same instant two ways. The fallback is not
     defensive noise: cloud-ui.js may be absent on a page that loads only cloud.js. */
  function ago(t) {
    if (window.CLOUD_UI && window.CLOUD_UI.ago) return window.CLOUD_UI.ago(t);
    return t ? new Date(t).toLocaleDateString() : '';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---- the data ------------------------------------------------------- */

  /* app -> item -> record, from whichever list we have. Nested rather than a joined
     string key, the rule cloud.js's listAll and pushTimers already follow: an `item` may
     contain any separator, and a non-printable one makes the file un-greppable. */
  function index(docs) {
    var by = {};
    (docs || []).forEach(function (d) {
      if (!by[d.app]) by[d.app] = {};
      by[d.app][d.item] = d;
    });
    return by;
  }

  function catalogueOf(app) { return app === 'learn' ? LEARN : PRAC; }

  function entryFor(app, slug) {
    var list = catalogueOf(app);
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
    return null;
  }

  function hrefFor(app, item) {
    if (app === 'learn') return 'learn-' + item + '.html';
    if (app === 'practice') return item + '.html';
    return app + '.html';
  }

  /* "In progress" is deliberately NOT "has a record": a passed exercise has one too.
     It is anything begun and not finished - a verdict that is not a pass, or NO verdict
     at all, which is an exercise begun and never run.

     That second half used to read `!!d.source`, and it was DEAD CODE that cost the
     dashboard a whole class of row: the rows this walks come from CLOUD.list()/listAll(),
     which report a `bytes` count and never the source itself, so it was always false. A
     record with no verdict was therefore dropped from In Progress AND from Next Steps
     (which only tests whether a record exists) - it vanished from the dashboard entirely.
     Pressing Get Started! now writes exactly such a record, so the rule is stated the way
     the hub's own badge states it: a record with no passing verdict is in progress. */
  function inProgress(by) {
    var out = [];
    ['learn', 'practice'].forEach(function (app) {
      var items = by[app] || {};
      Object.keys(items).forEach(function (item) {
        var d = items[item];
        var v = d.verdict;
        var started = v ? v.state !== 'pass' : true;
        if (!started) return;
        if (!entryFor(app, item)) return;   // a record for a slug no catalogue lists
        out.push({ app: app, item: item, doc: d });
      });
    });
    // newest first: what you touched last is what you were doing.
    return out.sort(function (a, b) { return (b.doc.updatedAt || 0) - (a.doc.updatedAt || 0); });
  }

  /* Never started at all, in catalogue order - reading before solving, and inside
     practice the order PRACTICE_CATEGORIES defines, which is also the order
     practice.html lists its rows in. So "next" agrees with the page it links to. */
  function nextSteps(by) {
    var out = [];
    LEARN.forEach(function (e) {
      if (!(by.learn && by.learn[e.slug])) out.push({ app: 'learn', item: e.slug, entry: e });
    });
    var ranked = PRAC.slice().sort(function (a, b) {
      var ca = CATS.indexOf(a.category), cb = CATS.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return (a.level || 0) - (b.level || 0);
    });
    ranked.forEach(function (e) {
      if (!(by.practice && by.practice[e.slug])) out.push({ app: 'practice', item: e.slug, entry: e });
    });
    return out;
  }

  /* ---- rendering ------------------------------------------------------ */

  function verdictText(d) {
    var v = d.verdict;
    /* No verdict is two different states, told apart by whether there is any work here.
       `bytes` is what both row shapes carry (listLocal measures the stored source,
       listRemote reports 0 because the list query does not fetch it), so a row known only
       from the server always takes the vaguer word - which is honest, where inventing a
       size would not be. "in progress" is also the hub badge's wording for this record, so
       the two surfaces describe a Get Started with the same phrase. */
    if (!v) return d.bytes ? 'edited, not run' : 'in progress';
    /* `total` is deliberately not in a learn verdict - learn.js keeps it as that page's
       own business - so this cannot say "2 of 3" for a quiz and does not pretend to. */
    if (v.state === 'none') return 'no checks reported';
    var bits = [];
    if (v.pass) bits.push(v.pass + ' passing');
    if (v.fail) bits.push(v.fail + ' failing');
    return bits.length ? bits.join(' · ') : 'in progress';
  }

  function row(href, title, meta, note) {
    var a = el('a', 'dash-row');
    a.setAttribute('href', href);
    var main = el('div', 'dash-row-main');
    main.appendChild(el('span', 'dash-row-title', title));
    if (meta) main.appendChild(el('span', 'dash-row-meta', meta));
    a.appendChild(main);
    if (note) a.appendChild(el('span', 'dash-row-note', note));
    return a;
  }

  function section(title, countText) {
    var s = el('section', 'dash-sec');
    var h = el('h2', 'dash-sec-head');
    h.appendChild(el('span', null, title));
    if (countText) h.appendChild(el('span', 'dash-sec-count', countText));
    s.appendChild(h);
    return s;
  }

  function empty(text) { return el('div', 'dash-empty', text); }

  function render(by) {
    dash.textContent = '';

    var i = window.CLOUD.info();
    var head = el('div', 'dash-head');
    head.appendChild(el('h1', 'dash-hello', 'Welcome back' + (i.name ? ', ' + i.name.split(' ')[0] : '') + '.'));
    head.appendChild(el('p', 'dash-sub', 'Everything below is yours, on every machine you sign in from.'));
    dash.appendChild(head);

    // ---- In Progress: uncapped, because hiding some of a learner's own work is the
    // silent truncation this repo keeps designing against.
    var prog = inProgress(by);
    var s1 = section('In Progress', prog.length ? String(prog.length) : '');
    if (!prog.length) {
      s1.appendChild(empty('Nothing open right now — pick something from Next Steps.'));
    } else {
      prog.forEach(function (p) {
        var e = entryFor(p.app, p.item);
        s1.appendChild(row(hrefFor(p.app, p.item), e.title,
                           (p.app === 'learn' ? 'Learn' : 'Practice') + ' · ' + e.category,
                           verdictText(p.doc) + (p.doc.updatedAt ? ' · ' + ago(p.doc.updatedAt) : '')));
      });
    }
    dash.appendChild(s1);

    // ---- Next Steps: capped at three, and the cap SAYS SO with a link to the full
    // list. An uncapped one is just practice.html again, which does it better.
    var next = nextSteps(by);
    var s2 = section('Next Steps', '');
    if (!next.length) {
      s2.appendChild(empty('You have started everything in both catalogues.'));
    } else {
      next.slice(0, NEXT_MAX).forEach(function (n) {
        s2.appendChild(row(hrefFor(n.app, n.item), n.entry.title,
                           (n.app === 'learn' ? 'Learn' : 'Practice') + ' · ' + n.entry.category,
                           'not started'));
      });
      /* One link PER CATALOGUE, and each counts only its own, because there is no page
         that lists both: a single "browse all 21" pointing at practice.html would name a
         number 20 of whose members that page shows. The links exist because the cap
         hides things, so a count that does not match its destination defeats them. */
      if (next.length > NEXT_MAX) {
        [['practice', 'practice.html', 'practice problem'],
         ['learn', 'learn.html', 'learn topic']].forEach(function (t) {
          var n = next.filter(function (x) { return x.app === t[0]; }).length;
          if (!n) return;
          var more = el('a', 'dash-more',
                        'Browse all ' + n + ' ' + t[2] + (n === 1 ? '' : 's') + ' →');
          more.setAttribute('href', t[1]);
          s2.appendChild(more);
        });
      }
    }
    dash.appendChild(s2);

    // ---- My Projects: the reader's own NAMED documents, which is what the My Projects page
    // lists and what the drawer row of that name goes to. It used to be the three app
    // documents - a fixed row per app, each showing its `item: 'default'` scratch document -
    // and that is a different thing wearing the same title: a scratch document is what an app
    // autosaves to, has no name, and `projects.html` deliberately does not list it. So the
    // section and the page it is named after disagreed about what a project is.
    //
    // A ROW IS A PROJECT BECAUSE IT HAS A NAME, which is `projects.html`'s own test and is
    // app-agnostic on purpose: Code2Silicon is the only app that mints one today, so this
    // reads as a list of its documents, and a second app growing a Save As needs nothing here.
    // The APP column is what says which app owns it, exactly as on that page.
    var projects = [];
    Object.keys(by).forEach(function (app) {
      Object.keys(by[app]).forEach(function (item) {
        var d = by[app][item];
        if (d && d.verdict && typeof d.verdict.name === 'string' && d.verdict.name) projects.push(d);
      });
    });
    // NEWEST FIRST, which is the order `projects.html` shows and the order a dashboard wants:
    // the thing you were last working on is the thing you are most likely to want.
    projects.sort(function (a, b) { return (b.updatedAt || 0) < (a.updatedAt || 0) ? -1 : 1; });
    // UNCAPPED, for the reason In Progress above is: showing some of a reader's own work and
    // not saying so is the silent truncation this repo keeps designing against.
    var s3 = section('My Projects', projects.length ? String(projects.length) : '');
    if (!projects.length) {
      s3.appendChild(empty('No projects yet — press Save in Code2Silicon to name one.'));
    } else {
      projects.forEach(function (d) {
        /* `?project=` is read by the owning page's own early inline script, the same link
           `projects.html` builds - so a row here opens the app with that project loaded rather
           than over the reader's scratch document. An app with no page falls back to no href,
           which `row` renders as a dead link rather than a wrong one. */
        var href = APP_TITLES[d.app] ? d.app + '.html?project=' + encodeURIComponent(d.item) : '';
        s3.appendChild(row(href, d.verdict.name, APP_TITLES[d.app] || d.app,
                           d.updatedAt ? 'edited ' + ago(d.updatedAt) : ''));
      });
    }
    dash.appendChild(s3);
  }

  /* ---- the switch ----------------------------------------------------- */

  var lastDocs = null;

  function paint() {
    render(index(lastDocs || window.CLOUD.list()));
  }

  window.CLOUD.subscribe(function (i) {
    if (!i.signedIn) {
      dash.hidden = true;
      hero.hidden = false;
      lastDocs = null;
      return;
    }
    hero.hidden = true;
    dash.hidden = false;
    paint();
    /* Then the remote half, which may add documents saved on another machine. It only
       ever ADDS to what is on screen: listAll merges local with remote and never adopts,
       so this cannot overwrite a local record - that is pull()'s job, under the conflict
       rule. A failure leaves the local paint exactly as it was. */
    window.CLOUD.listAll().then(function (r) {
      if (!window.CLOUD.info().signedIn) return;   // signed out while it was in flight
      if (r && r.docs) { lastDocs = r.docs; paint(); }
    }, function () { /* offline: the local paint stands */ });
  });
})();
