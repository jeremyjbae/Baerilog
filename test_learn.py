#!/usr/bin/env python3
"""Baerilog/test_learn.py - the learn site, headless.

    python3 Baerilog/test_learn.py

The practice harness (test.py) is two halves: an engine driver with no DOM, and a page
driver that boots a page the way a browser does. This is the second kind only, because a
topic page has no checker of its own - the engine questions ("does the solution pass",
"does the starter fail") do not exist here. What a topic page can get wrong is what a
READER sees, and that is what this asserts.

That emphasis is not a preference, it is the lesson of the three bugs this file was
written after. Every one of them left the mechanism working and the page wrong:

  - shell.js built its exercise sheet on a topic page and left it OPEN, with no
    practice.js to dismiss it, so the article was behind an undismissable modal. My own
    verification at the time asserted the slots filled, the editor seeded and the run
    finished - all true, with the modal covering everything.
  - the drawer marked Practice on every learn page.
  - the hub's breadcrumb said `practice` and linked back to the practice hub.

So the checks here read the page's own chrome: which nav row is marked, what the crumb
says, that no backdrop is open, that the cards the topic asked for are really inside its
article and the ones it did not ask for are gone.

Like every harness here it runs against the SHIPPED files - it does not re-slice or
re-generate anything, because a harness that rebuilds what it is testing proves the
sources work, which is not the question.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, 'tools')


def read(rel):
    with open(os.path.join(HERE, rel), encoding='utf-8') as f:
        return f.read()


def manifest():
    """learn-manifest.js is `var LEARN_MANIFEST = [ ... ];` with JSON-compatible object
    literals, exactly so this can be read without a JS parser."""
    m = re.search(r'var LEARN_MANIFEST = (\[.*?\]);', read('learn-manifest.js'), re.S)
    if not m:
        raise SystemExit('learn-manifest.js: no `var LEARN_MANIFEST = [...];`')
    return json.loads(m.group(1))


# --------------------------------------------------------------------------
# the driver, which boots a topic page the way a browser does
# --------------------------------------------------------------------------

DRIVER = r"""
const fs = require('fs'), path = require('path');
const HERE = APP_DIR_JSON, TOOLS_DIR = TOOLS_DIR_JSON;
const { makeDom } = require(TOOLS_DIR + '/fakedom.js');
/* The engine, DOM-free, for the one claim below that is about Verilog rather than about the page:
   every cell a topic's library offers has to elaborate and compute its own function. */
const sim = require(TOOLS_DIR + '/simrun.js');
const SLUG = SLUG_JSON;

const results = [];
function check(name, f) {
  try { const d = f(); results.push(['PASS', name, d === undefined ? '' : String(d)]); }
  catch (e) { results.push(['FAIL', name, (e && e.message) || String(e)]); }
}
function ok(c, m) { if (!c) throw new Error(m || 'failed'); }

/* Boot one topic page. The stub materialises elements on demand but does not PARSE
   markup, so the ids the injected markup declares are discovered from shell.js's own
   region - the same trick test.py's boot() uses - and the handful of elements a page
   finds by SELECTOR rather than by id are stood up by hand. */
/* The topic's manifest entry, read the way the page generator reads it - so "does this page load
   the placement engine" is one fact in one place rather than a second list here. */
function manifestEntry(slug) {
  const src = fs.readFileSync(path.join(HERE, 'learn-manifest.js'), 'utf8');
  const w = {};
  new Function('window', src + '\nwindow.__M = LEARN_MANIFEST;')(w);
  return (w.__M || []).filter(e => e.slug === slug)[0] || {};
}

function boot(slug) {
  const dom = makeDom();
  const markup = fs.readFileSync(path.join(HERE, 'shell.js'), 'utf8')
                   .match(/String\.raw`([\s\S]*?)`;/)[1];
  let m;
  const re = /<(\w+)[^>]*\bid="([^"]+)"([^>]*)>/g;
  while ((m = re.exec(markup))) {
    const tag = m[1], id = m[2], attrs = m[3] + m[0];
    dom.mk(id, tag === 'input' && /type="checkbox"/.test(attrs) ? 'input:checkbox'
             : tag === 'input' ? 'input:text' : tag);
  }
  /* A button's own label, which the stub would otherwise leave empty - and that is not
     cosmetic: both Run labels are DERIVED from whatever the markup says, so with an empty
     one they both come out '' and every assertion about them passes while comparing
     nothing. Buttons only. */
  const reB = /<button[^>]*\bid="([^"]+)"[^>]*>([^<]*)<\/button>/g;
  while ((m = reB.exec(markup))) dom.document.getElementById(m[1]).textContent = m[2];

  const grid = dom.mk('__grid', 'div');
  grid.classList.add('grid');
  /* The Import File toolbar as a REAL parent. Every id above is created unparented, so
     `openBtn.parentElement` would be null and the "hide the toolbar once nothing visible is
     left in it" rule would correctly decline - making the assertion about it pass against an
     element that was never the one in question. test.py had to model this same row for the
     same reason. */
  const openBar = dom.mk('__openBar', 'div', grid);
  openBar.classList.add('toolbar');
  for (const id of ['openBtn', 'fileOpenInput', 'exampleSelect']) {
    const el = dom.document.getElementById(id);
    if (el) openBar.appendChild(el);
  }
  /* The RUN toolbar, nested as the markup nests it, because learn.js reaches the two labels
     around the run-length field as its SIBLINGS - they carry no ids. With every element parented
     to one grid those siblings are whatever the harness happened to create next, so the guard
     would decline and the assertion would pass against elements that were never in question.
     The labels carry `time-label`, which is the class that guard tests. */
  const runBar = dom.mk('__runBar', 'div', grid);
  runBar.classList.add('toolbar');
  for (const id of ['runBtn', 'resetBtn']) {
    const el = dom.document.getElementById(id);
    if (el) runBar.appendChild(el);
  }
  const forLabel = dom.mk('__runForLabel', 'span', runBar);
  forLabel.classList.add('time-label');
  const maxIn = dom.document.getElementById('maxTimeInput');
  if (maxIn) runBar.appendChild(maxIn);
  const unitsLabel = dom.mk('__timeUnitsLabel', 'span', runBar);
  unitsLabel.classList.add('time-label');

  /* The plot-off ROW as a real parent, nested as the markup nests it: a `.toolbar` holding
     a <label> that wraps the checkbox, with the memory note beside it. learn.js reaches the
     row THROUGH the checkbox because it carries no id, so with every element parented to the
     grid there is no row to find and the assertion would pass against nothing - the same gap
     that hid the detached-tbInput bug below. */
  const offBar = dom.mk('__waveOffBar', 'div', grid);
  offBar.classList.add('toolbar');
  const offLabel = dom.mk('__waveOffLabel', 'label', offBar);
  for (const id of ['waveOffCheckbox']) {
    const el = dom.document.getElementById(id);
    if (el) offLabel.appendChild(el);
  }
  const note = dom.document.getElementById('waveMemNote');
  if (note) offBar.appendChild(note);

  /* THE TESTBENCH CARD AS A REAL PARENT, for the same reason and with more at stake. A
     topic asks for no `testbench` slot, so learn.js REMOVES that card - and with every id
     hanging straight off body, removing it detached nothing, so `tbInput` stayed focusable
     and every write to it landed. In a browser it is detached, cannot take focus, and
     `document.execCommand` then applies to whatever IS focused while still returning true -
     which is how the previous example's testbench survived in it. Modelling the parent is
     what makes that reachable here. */
  const tbCard = dom.mk('card-testbench', 'div', grid);
  tbCard.classList.add('card');
  for (const id of ['tbInput', 'tbGutter', 'tbEmpty']) {
    const el = dom.document.getElementById(id);
    if (el) tbCard.appendChild(el);
  }
  dom.mk('__h1', 'h1', grid);
  dom.mk('__sub', 'div', grid).classList.add('gh-sub');
  const hdr = dom.mk('__header', 'header', grid);
  hdr.classList.add('gh-header');
  const inner = dom.mk('__hi', 'div', hdr);
  inner.classList.add('gh-header-inner');
  const mark = dom.mk('__mark', 'a', inner);
  mark.classList.add('gh-mark');
  dom.mk('__marksvg', 'svg', mark);
  const nav = dom.mk('__nav', 'nav', inner);
  nav.classList.add('gh-nav');
  for (const [href, text] of [['simulator.html', 'Simulator'], ['practice.html', 'Practice'],
                              ['learn.html', 'Learn']]) {
    const a = dom.mk('__nav_' + href, 'a', nav);
    a.setAttribute('href', href);
    a.textContent = text;
  }

  dom.window.LEARN_SLUG = slug;
  /* pnr.js and practice-pnr.js are loaded only when the manifest says so, which is exactly the rule
     the generated page follows - so the harness cannot test a configuration no page has. They go
     BEFORE learn.js, since drawLayouts() runs at load and reads window.PRACTICE_PNR_API. pnr.js is a
     slice and publishes window.PNR from inside its own IIFE, so it needs no bridge. */
  const files = ['learn-manifest.js', 'topics/' + slug + '.js', 'shell.js', 'app.js',
                 'synth.js', 'practice-synth.js'];
  if (manifestEntry(slug).pnr) files.push('pnr.js', 'practice-pnr.js');
  files.push('learn.js');
  /* A top-level `var` is a window property in a browser and a mere local inside
     new Function, so the manifest is bridged - exactly as test.py bridges the practice
     one. Without it window.LEARN_MANIFEST is empty, practice-synth's "does this page want
     the synthesizer" guard is false, and the netlist half of this file would test nothing
     while reporting PASS. */
  /* The PLACEMENT trio, loaded exactly when the generated page loads it - from the manifest flag,
     so the harness cannot test a configuration no page has. pnr.js is a slice like synth.js and goes
     in its own scope; practice-pnr.js reads it through window.PNR, which is how a browser gives it. */
  const bridge = { 'learn-manifest.js':
    '\nwindow.LEARN_MANIFEST = LEARN_MANIFEST; window.LEARN_CATEGORIES = LEARN_CATEGORIES;' };
  const body = files.map(f => fs.readFileSync(path.join(HERE, f), 'utf8') + (bridge[f] || ''))
                    .join('\n;\n')
    + '\nreturn { codeInput, consoleBox, result: () => lastResult,'
    + ' fullSource: () => editorFullSource };';
  const app = new Function('document', 'window', 'localStorage', 'requestAnimationFrame',
                           'setTimeout', 'clearTimeout', 'FileReader', 'Blob', 'URL', body)
    (dom.document, dom.window, dom.localStorage, dom.window.requestAnimationFrame,
     dom.window.setTimeout, dom.window.clearTimeout,
     function FileReader() {}, function Blob() {},
     { createObjectURL: () => 'blob:x', revokeObjectURL() {} });
  return { dom, app, $: id => dom.document.getElementById(id) };
}

const topics = MANIFEST_JSON;

for (const entry of topics) {
  const slug = entry.slug;
  const name = t => slug + ': ' + t;
  let p = null;
  check(name('the page boots: shell, app, then learn'), () => {
    p = boot(slug);
    return slug;
  });
  if (!p) { check(name('its remaining checks could not run'), () => { throw new Error('the page did not boot'); }); continue; }
  const $ = p.$;

  /* THE CHECK THIS FILE EXISTS FOR. Everything below it was true while an undismissable
     modal covered the article, so what is asserted is the chrome a reader sees. */
  check(name('the article is readable: no exercise sheet, no tab strip'), () => {
    const back = $('exBackdrop');
    ok(!back, 'shell.js built its exercise sheet here - with no practice.js, nothing can '
            + 'dismiss it, so the article is behind a modal');
    ok(!$('exTabs'), 'the exercise tab strip was built, so an empty ruled strip sits under the crumb');
    ok($('learnArticle'), 'there is no article on the page at all');
    return 'no sheet, no strip, article present';
  });

  check(name('it says it is Learn, in the crumb and in the bar'), () => {
    const h1 = p.dom.document.querySelector('h1');
    ok(/gh-crumb/.test(h1.className || ''), 'the h1 is not the breadcrumb: ' + h1.className);
    ok(/>Learn</.test(h1.innerHTML), 'the crumb does not say Learn: ' + h1.innerHTML);
    ok(!/>Practice</.test(h1.innerHTML), 'the crumb still says Practice: ' + h1.innerHTML);
    /* Baerilog / Learn / <title>: the root, the section, and the human title as the leaf -
       the slug is the URL and no longer the heading. */
    ok(/href="index\.html">Baerilog</.test(h1.innerHTML),
       'the crumb has no Baerilog root: ' + h1.innerHTML);
    ok(h1.innerHTML.indexOf(entry.title) >= 0,
       'the crumb does not name the topic: ' + h1.innerHTML);
    ok(h1.innerHTML.indexOf(slug) < 0, 'the crumb still carries the slug: ' + h1.innerHTML);
    const nav = p.dom.document.querySelector('.gh-nav');
    const here = [...nav.querySelectorAll('a')].filter(a => /\bhere\b/.test(a.className || ''));
    ok(here.length === 1, here.length + ' nav links marked current');
    ok(here[0].getAttribute('href') === 'learn.html',
       'the bar marks ' + here[0].getAttribute('href') + ', not learn.html');
    /* And the line UNDER the crumb is the topic's blurb. It read the literal string
       `undefined` for a while: shell.js writes that line from a PRACTICE_META it builds for a
       page it has no entry for, and learn.js's own write was landing on `.subtitle`, a class
       renamed to `.gh-sub` when the breadcrumb moved into style.css. Both ends are asserted -
       the blurb is there, and nothing anywhere in the heading says `undefined`, which is the
       part that would come back if either end regressed. */
    const sub = p.dom.document.querySelector('.gh-sub');
    ok(sub, 'no .gh-sub, so the line under the crumb is not the one being written');
    const text = String(sub.textContent || '');
    ok(text === (entry.blurb || ''),
       'the sub-line is ' + JSON.stringify(text) + ', not the blurb ' + JSON.stringify(entry.blurb || ''));
    ok(!/undefined/.test(text + h1.innerHTML), 'the heading says undefined: ' + text);
    return h1.textContent.replace(/\s+/g, ' ').trim() + ' - ' + text.slice(0, 28);
  });

  check(name('every slot the topic asked for holds its card'), () => {
    const api = p.dom.window.LEARN_API;
    ok(api, 'learn.js exposed no API, so it did not run');
    const asked = entry.slots || [];
    const got = api.slots();
    ok(asked.every(s => got.indexOf(s) >= 0),
       'the manifest asks for ' + asked.join(',') + ' but the page built ' + got.join(','));
    /* A card is MOVED into its hole, so what is asserted is its PARENT - it is not enough
       that the card exists and the hole exists. */
    for (const s of got) {
      if (s === 'netlist' || s === 'netlist-view') continue;   // built by a synthesis, below
      const hole = api.slotFor(s);
      ok(hole.children.length === 1, 'slot ' + s + ' holds ' + hole.children.length + ' cards');
      ok(/^card-/.test(hole.children[0].id || ''),
         'slot ' + s + ' holds ' + hole.children[0].id + ', which is not a card');
    }
    return got.length + ' slots, each holding its card';
  });

  check(name('nothing runs at load, and Run runs the topic'), () => {
    ok(!p.app.result(), 'the page had a result before Run was pressed');
    ok(/module /.test(p.app.codeInput.value || ''), 'the editor does not hold the topic\'s design');
    $('runBtn').click();
    const r = p.app.result();
    ok(r && r.finished, 'the run did not reach $finish');
    ok(!r.error, 'the run hit an error: ' + r.error);
    return 'finished at t=' + r.time;
  });

  /* The editor card is the SIMULATOR's, byte for byte - there is one in this repo and every
     page gets it - so what a topic page shows is whatever it trims afterwards. A practice
     page looks trimmed because practice.js hides two controls; a topic page does not load
     that file, so it shipped with the simulator's whole toolbar: an example picker and an
     Import File that would replace the very design the article is explaining. */
  check(name('the editor card is trimmed to what a reader needs'), () => {
    const hidden = id => {
      const e = $(id);
      ok(e, 'no #' + id + ' on the page at all');
      return (e.style.display || '') === 'none';
    };
    for (const id of ['exampleSelect', 'openBtn', 'editorCopyBtn', 'editorSaveBtn',
                      'editorHierarchyToggleBtn', 'editorHierarchyPanel']) {
      ok(hidden(id), '#' + id + ' is still shown on a topic page');
    }
    /* Its toolbar goes with it, or an empty band sits above the editor - and Run stays,
       which is the point of the page. */
    const bar = $('openBtn').parentElement;
    ok((bar.style.display || '') === 'none',
       'the Import File toolbar is still shown with nothing visible left in it');
    ok(($('runBtn').style.display || '') !== 'none', 'Run Simulation was hidden too');
    return 'picker, Import, Copy, Save and the module browser all hidden';
  });

  /* A topic page has no Console on it, so a run that FAILS has nothing to say so with -
     the waveform and the table simply stay empty, which reads as the button not working.
     The log appears in a dialog, and ONLY then: a good run is already described by the
     panels the article put in its slots. */
  check(name('the log pops up when a run fails, and not when it works'), () => {
    ok(!p.dom.window.LEARN_API.logOpen(), 'the log dialog is open before anything ran');
    $('runBtn').click();
    ok(!p.dom.window.LEARN_API.logOpen(),
       'a run that worked popped the log up anyway: '
       + (p.app.consoleBox.textContent || '').slice(0, 80));

    /* Break the design and press Run: a parse error is logged as an `.err` row, which is the
       one signal that stands for every failing path - app.js's three, practice-synth's, and
       the gate button's two refusals, which set no flag at all. */
    const good = p.app.codeInput.value;
    try {
      p.app.codeInput.value = 'module broken(' ;
      $('runBtn').click();
      ok(p.dom.window.LEARN_API.logOpen(), 'a parse error did not surface the log');
      const shown = p.dom.document.getElementById('learnLogBody');
      ok(/error/i.test(shown.textContent || ''),
         'the dialog is open but carries no error: ' + (shown.textContent || '').slice(0, 80));
      /* Every way out, and the backdrop's guard tested in the direction that can be wrong:
         a click INSIDE the panel must not close it, which is only meaningful because the
         panel is a child of the backdrop. */
      const back = p.dom.document.getElementById('learnLogBackdrop');
      back.dispatch('click', { target: shown });
      ok(p.dom.window.LEARN_API.logOpen(), 'a click inside the panel closed the dialog');
      back.dispatch('click', { target: back });
      ok(!p.dom.window.LEARN_API.logOpen(), 'a click on the backdrop did not close it');
      return 'silent on success, opens on a parse error, backdrop guard holds';
    } finally {
      p.app.codeInput.value = good;
      p.dom.window.LEARN_API.closeLog();
    }
  });

  /* The table has to cover the WHOLE input space, and be the run's own values while doing
     it. Two claims, and the first is why the sweep is generated rather than hand-written: a
     declared column list and a hand-driven stimulus are two statements about one thing, and
     the moment a topic has three inputs the hand-written one shows four rows of an eight-row
     space and nothing notices.

     Read off LEARN_API.truthRows(), the data the card is rendered FROM - the table itself is
     one innerHTML string, which a stub DOM does not parse, and a check over its text has to
     filter for digits and then trips over the letter x in `y_xor`. */
  check(name('the truth table covers every input combination, from the run'), () => {
    const spec = (p.dom.window.LEARN_API.topic() || {}).truthTable;
    if (!spec) return 'n/a - this topic has no truth table';
    const rows = p.dom.window.LEARN_API.truthRows();
    const n = spec.inputs.length, want = 1 << n;
    ok(rows.length === want,
       rows.length + ' rows for ' + n + ' inputs, expected ' + want + ' - the sweep does not '
       + 'cover the whole input space');
    /* Every combination exactly once. A sweep that repeated one and skipped another would
       have the right row COUNT, so counting is not enough. */
    const seen = rows.map(r => r.inputs.join(''));
    ok(new Set(seen).size === want,
       'the sweep repeats a combination and misses another: ' + seen.join(' '));
    for (let v = 0; v < want; v++) {
      const bits = v.toString(2).padStart(n, '0');
      ok(seen.indexOf(bits) >= 0, 'the sweep never drives ' + spec.inputs.join('') + ' = ' + bits);
    }

    /* And the values are the RUN's. Recomputed here from the recorded histories through the
       same instant each row claims, so this is a rendering of the simulation rather than a
       table that happens to look right. */
    const r = p.app.result();
    for (const row of rows) {
      const at = row.at;
      spec.inputs.concat(spec.outputs).forEach((name, i) => {
        const h = r.signals[name].history.filter(e => e[0] <= at).pop();
        const want1 = h ? (h[1].x ? 'x' : h[1].z ? 'z' : String(h[1].v & 1)) : '?';
        const got = i < n ? row.inputs[i] : row.outputs[i - n];
        ok(got === want1,
           name + ' at t=' + at + ': the table says ' + got + ', the run recorded ' + want1);
      });
    }
    return want + ' rows, every combination once, values from the histories';
  });

  /* The testbench is HIDDEN and the stimulus is generated, so what is asserted is that the
     editor shows the design alone while the document that RUNS carries both - and that the
     run length is long enough for the sweep it was given. */
  /* The editor is sized to the design it holds. Asserted against the LINE COUNT and the
     metrics the page itself read, not against a pixel number - the editor is 12px on a
     desktop and 16px on a phone, so a literal would pin one of the two and silently accept
     the other. What matters is that it is derived at all: the app's own default is a flat
     360px, which on a fourteen-line design leaves most of the box empty and pushes the
     prose that follows off the screen. */
  /* The empty Waveform Viewer is one line, not a panel. Both halves are asserted from the
     page rather than from the CSS: the toolbar is hidden until there is a window to control,
     and the first Run reveals it. A check on the message alone would pass with a row of
     dead zoom controls above it. */
  check(name('the empty waveform is a line, and its controls arrive with the data'), () => {
    const controls = $('waveControls'), empty = $('waveEmpty'), canvas = $('waveCanvas');
    ok(controls, 'no waveControls, so this is not the app the simulator built');
    /* The plot-off row is gone: a tool control and a canvas-megabyte note on a page that is
       a lesson. The ROW, not just the checkbox - the note is its sibling, and a lone hidden
       input leaves an empty band above the plot. */
    const off = $('waveOffCheckbox');
    ok(off, 'no waveOffCheckbox, so this assertion is about an element that is not there');
    const offRow = off.parentElement && off.parentElement.parentElement;
    ok(offRow && offRow.style.display === 'none',
       'the "turn the plot off" row is still on the page, memory note and all');
    /* The LOAD state is a markup fact - the stub parses no markup, so every element here
       starts with an empty style and a booted page cannot see the inline `display:none`.
       Same split the Synthesize button's placement is checked with. */
    const region = fs.readFileSync(path.join(HERE, 'shell.js'), 'utf8');
    const tag = (region.match(/<div class="toolbar" id="waveControls"[^>]*>/) || [''])[0];
    ok(/display\s*:\s*none/.test(tag),
       'the markup shows the waveform toolbar at load, over a plot with nothing in it: ' + tag);
    /* And the CANVAS starts hidden, which is what actually made the empty viewer tall: a
       canvas is a replaced element with an intrinsic 300x120 ratio, so `width: 100%` with
       height auto derives ~760px of blank canvas from the card's width. Markup again,
       for the same reason as the toolbar. */
    const cv = (region.match(/<canvas id="waveCanvas"[^>]*>/) || [''])[0];
    ok(/display\s*:\s*none/.test(cv),
       'the canvas is visible at load, so its intrinsic ratio sizes it from the card: ' + cv);
    /* And the empty box is a line rather than a panel. A CSS-TEXT check, because the stub has
       no layout: the padding is the whole of what makes that box 98px tall. */
    const css = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8');
    const rule = (css.match(/#waveEmpty\s*\{[^}]*\}/) || [''])[0];
    const pad = parseFloat((rule.match(/padding\s*:\s*([\d.]+)px/) || [0, '99'])[1]);
    ok(pad <= 20, '#waveEmpty pads ' + pad + 'px a side, so the empty viewer is a panel');

    /* The page half. The stub parses no markup, so `controls` starts with an EMPTY style
       here - which is why asserting the reveal without this line passed against a toolbar
       that had never been hidden, and a mutant deleting the reveal survived. Setting it is
       modelling the markup above, not arranging the answer. */
    controls.style.display = 'none';
    $('runBtn').click();
    ok(controls.style.display !== 'none', 'the toolbar never came back once there was data');
    ok(empty.style.display === 'none', 'the empty message survived a run with data');
    ok(canvas.style.display === 'block', 'the canvas was never revealed');

    /* And it goes away again with the data: Reset drops the result, so the next draw has no
       rows - the path that hides the toolbar. Without this the no-rows branch is never
       reached with the toolbar visible, and a mutant deleting it survives. */
    $('resetBtn').click();
    ok(controls.style.display === 'none',
       'after Reset the toolbar is still on screen over a plot with nothing in it');
    ok(empty.style.display !== 'none', 'after Reset the empty message never came back');
    /* Put the run back: every check here shares ONE booted page, so leaving it Reset made
       the gate-level check further down fail on a page with no result - a check breaking a
       later one is indistinguishable from the feature being broken. */
    $('runBtn').click();
    return 'toolbar hidden while empty, revealed by the run, hidden again by Reset';
  });

  /* Placement, asserted BEFORE anything synthesizes - which is the whole point: the move
     happens at load, and a check that runs after a Synthesize would pass on the click handler
     having done it instead. The failure-survival half is a later check, after the one that
     needs a pristine empty viewer. */
  check(name('Synthesize is in the netlist viewer at load, before any synthesis'), () => {
    const btn = $('synthBtn'), card = $('card-netlist-view');
    ok(btn && card, 'no Synthesize button or no viewer card');
    const foot = card.querySelector('.learn-synth-foot');
    ok(foot, 'the viewer has no footer row, so the button was never moved into it');
    ok(btn.parentElement === foot, 'the button is not in the viewer footer at load');
    ok(foot.firstChild === btn, 'the button is not the leftmost thing in that row');
    ok(foot.querySelector('.legend-row'), 'the legend did not come into the footer with it');
    let up = btn, inCard = false;
    while (up) { if (up === card) { inCard = true; break; } up = up.parentElement; }
    ok(inCard, 'the footer does not hang off the viewer card');
    ok(card.style.display !== 'none', 'the viewer is hidden at load, so the button is unreachable');
    return 'footer built, button leftmost, legend beside it';
  });

  /* A {figure} block is drawn at load by the netlist viewer's own node and wire code. Three
     claims, and the middle one is the substance: EVERY edge landed on a real pin. drawStatic
     discards an edge whose handle does not exist - the geometry has nowhere to put it - so a
     mistyped pin in a topic file would silently produce a diagram missing a wire, which is
     exactly the failure the count exists to expose. */
  /* A PLACEMENT is drawn from the design, out of pnr.html's engine. The claim worth making is not
     that a box appeared - it is that what was placed is what the DESIGN instantiates, at the size the
     figure asked for, from a cell this repo actually has a layout for. A netlist naming a cell with
     no layout places NOTHING and leaves an empty box, which on a page is indistinguishable from a
     bug, so the drawer reports it and this refuses it. */
  check(name('a placement is drawn from the design, with every cell placed'), () => {
    const spec = p.dom.window.LEARN_API.topic() || {};
    const names = Object.keys(spec.layouts || {});
    if (!names.length) return 'n/a - this topic asks for no placement';
    const api = p.dom.window.PRACTICE_PNR_API;
    ok(api, 'practice-pnr.js is not loaded, so the manifest flag and the topic disagree');
    ok(p.dom.window.PNR, 'pnr.js is not loaded, so there is no cell library to place from');
    const drawn = p.dom.window.LEARN_API.layouts();
    ok(drawn.length === names.length,
       drawn.length + ' placements drawn for ' + names.length + ' declared');
    const placeable = api.placeableCells();
    for (const r of drawn) {
      const s = spec.layouts[r.name];
      /* WHAT SHOULD BE PLACED is what the design instantiates, and that is true for both sources:
         `from: 'design'` places the editor's own text, and `from: 'synthesis'` places the netlist a
         synthesis produced - which, for a design that instantiates cells, names the same ones. So
         the expectation comes from the design either way, and the sharper claim about synthesis
         changing the picture is the check below this one. */
      const src = s.netlist || spec.verilog;
      const types = (String(src).match(/^\s*(\w+)\s+\w+\s*\(/gm) || [])
        .map(x => x.trim().split(/\s+/)[0])
        .filter(x => x !== 'module' && x !== 'input' && x !== 'output' && x !== 'wire');
      ok(types.length, r.name + ': nothing in the source looks like an instantiation');
      for (const ty of types) {
        ok(placeable.includes(ty),
           r.name + ': the design instantiates ' + ty + ', which has no layout in the library - '
           + 'the figure would draw an empty box. Cells with layouts: ' + placeable.join(', '));
      }
      ok(r.cells === types.length,
         r.name + ': placed ' + r.cells + ' cells for ' + types.length + ' instantiated');
      ok(!r.unplaceable.length, r.name + ': ' + r.unplaceable.length + ' cell(s) could not be placed');
      ok(r.view === (s.view || 'all'), r.name + ': drew the ' + r.view + ' view, not ' + s.view);
      /* Sized from the ROW, since every cell in this library is one row tall - so the height is the
         figure's own `rowPx` and the width follows the aspect rather than being chosen. */
      ok(Math.round(r.height) === Math.round((s.rowPx || api.rowPx) * r.rows),
         r.name + ': ' + r.height + 'px tall for ' + r.rows + ' row(s) at ' + (s.rowPx || api.rowPx));
      ok(r.width > 0 && r.width < r.height * 20, r.name + ': ' + r.width + 'px wide is not an aspect');
      /* The wrapper carries the size and the box carries none - the rule the netlist figures learned
         by clipping 26px off themselves, and a second drawer is a second chance to get it wrong. */
      const box = p.dom.document.querySelector('[data-layout="' + r.name + '"]');
      ok(box, r.name + ': no box in the article');
      ok(!box.style.height, r.name + ': the box has an inline height, which clips by its own padding');
      ok(r.layer && r.layer.style.position === 'relative',
         r.name + ': the wrapper is not the positioning context');
      ok(Math.round(parseFloat(r.layer.style.height)) === Math.round(r.height),
         r.name + ': the wrapper is ' + r.layer.style.height + ', not ' + r.height + 'px');
      const svg = box.querySelector('svg');
      ok(svg, r.name + ': no svg was created');
      ok(svg.getAttribute('viewBox'), r.name + ': the svg has no viewBox, so nothing scales');
      /* DRAWING TWICE LEAVES ONE PLACEMENT. Nothing on a topic page redraws a figure, so the clear
         at the top of drawStatic is invisible from here - and a public drawer that appends on a
         second call is a bug waiting for the first caller who has a reason to. */
      const again = api.drawStatic(box, { netlist: src, rowWidth: s.rowWidth, view: s.view,
                                          rowPx: s.rowPx });
      ok(box.querySelectorAll('.pnr-static').length === 1,
         r.name + ': drawing twice left ' + box.querySelectorAll('.pnr-static').length + ' wrappers');
      ok(box.querySelectorAll('svg').length === 1, r.name + ': drawing twice left two svgs');
      ok(again.cells === r.cells, r.name + ': the second draw placed a different number of cells');
    }
    return drawn.map(r => r.name + '=' + r.cells + ' cell(s) ' + Math.round(r.width) + 'x'
                          + Math.round(r.height)).join(' ');
  });

  /* EVERY CELL THE LIBRARY OFFERS ACTUALLY WORKS. The editor tells the reader to swap the
     instantiation for another cell, and the symbol chart names them all - so a cell that is named
     but missing, or present but wrong, sends them to `Unknown module type` or to a truth table that
     disagrees with the picture above it. Neither is visible on the page until someone tries that one
     cell, which is why this walks all of them.

     The expected values come from an INDEPENDENT model here, not from the design: reading the
     library's own `assign` back would agree with itself no matter what it said. And the one-input
     cells are instantiated with the `.b()` connection dropped, which is what the editor's comment
     tells a reader to do, so the instruction is checked as well as the cell. */
  check(name('every library cell elaborates and computes its own function'), () => {
    const spec = p.dom.window.LEARN_API.topic() || {};
    if (!spec.library) return 'n/a - this topic has no library';
    const cells = (String(spec.library).match(/^[ \t]*module\s+(\w+)/gm) || [])
                    .map(s => s.replace(/^[ \t]*module\s+/, ''));
    ok(cells.length, 'the library declares no modules at all');
    const F = {
      and_gate: (a, b) => a & b, or_gate: (a, b) => a | b,
      nand_gate: (a, b) => 1 - (a & b), nor_gate: (a, b) => 1 - (a | b),
      xor_gate: (a, b) => a ^ b, xnor_gate: (a, b) => 1 - (a ^ b),
      not_gate: (a) => 1 - a, buf_gate: (a) => a
    };
    const sweep = '    a = 0; b = 0; #10;\n    a = 0; b = 1; #10;\n'
                + '    a = 1; b = 0; #10;\n    a = 1; b = 1; #10;\n    $finish;';
    const tb = String(spec.testbench || '').replace(/^[ \t]*\/\/ SWEEP[ \t]*$/m, sweep);
    const at = (h, when) => {
      let v = null;
      for (const [T, val] of h) { if (T <= when) v = val; else break; }
      return (v.x || v.z) ? 'x' : String(v.v & 1);
    };
    /* THE CHART AND THE LIBRARY ARE ONE LIST. A symbol chart is a menu: every gate it draws is one
       the editor's comment invites the reader to instantiate, so a symbol with no cell behind it
       sends them to `Unknown module type`, and a symbol drawn as the wrong gate makes the picture
       lie about what that cell does. Neither is visible from either side alone - walking the library
       misses a symbol that has no cell, and walking the chart misses a cell that computes the wrong
       thing - which is why both directions are here and the truth tables below are keyed on the
       library. The convention is the topic's own: a symbol of kind K is the cell K_gate. */
    const kinds = [];
    for (const fig of Object.values(spec.figures || {})) {
      for (const n of fig.nodes || []) {
        if (n.caption && n.kind && !kinds.includes(n.kind)) kinds.push(n.kind);
      }
    }
    for (const k of kinds) {
      ok(cells.includes(k + '_gate'),
         'the chart draws a ' + k + ' symbol but the library has no ' + k + '_gate, so a reader '
         + 'who instantiates it gets Unknown module type');
    }
    ok(kinds.length === 0 || kinds.length === cells.length,
       'the chart names ' + kinds.length + ' symbols and the library holds ' + cells.length
       + ' cells - one of them is offering something the other does not');

    const report = [];
    const col = {};
    for (const cell of cells) {
      ok(F[cell], cell + ' is in the library but this check has no model for it - add one rather '
                       + 'than reading the library\'s own assign back, which agrees with itself');
      const unary = F[cell].length === 1;
      const design = String(spec.verilog).replace(/^\s*\w+ u0.*$/m,
        unary ? '  ' + cell + ' u0(.a(a), .y(y));'
              : '  ' + cell + ' u0(.a(a), .b(b), .y(y));');
      ok(design !== spec.verilog, 'the instantiation line was not found, so every run is the same');
      const r = sim.run(design + '\n' + spec.library
                        + '\n// ======== TESTBENCH ========\n\n' + tb, { maxTime: 60 });
      ok(!r.parseError, cell + ': ' + r.parseError);
      ok(r.finished, cell + ': the run did not reach $finish');
      const h = (r.signals['u_dut.y'] || {}).history;
      ok(h, cell + ': the design has no u_dut.y to read');
      const got = [5, 15, 25, 35].map(w => at(h, w)).join('');
      const want = [[0, 0], [0, 1], [1, 0], [1, 1]]
        .map(([a, b]) => String(unary ? F[cell](a) : F[cell](a, b))).join('');
      ok(got === want, cell + ': y = ' + got + ', expected ' + want);
      col[cell] = got;
      report.push(cell.replace('_gate', '') + '=' + got);
    }

    /* AND THE PROSE'S OWN TABLE IS A THIRD ACCOUNT OF THE SAME CELLS. The chart states shapes and
       the library states behaviour; a table in the running text states VALUES, one per gate per
       row, which makes it the one place on this page that can be wrong in a way the reader carries
       away with them - and it is hand-written, where the Truth Table card's values are the run's.
       So each column is compared against the column this check just recorded from a real run, and
       a header names its cell by the same convention the chart uses: AND is and_gate.

       Rows are matched by their INPUT BITS rather than by position, so a table that lists them in
       another order is fine and one that lists a combination twice is not. A one-input gate's table
       has two rows, and its bits index the same four-step sweep driven above with b at 0. */
    const prose = (spec.blocks || []).filter(b => b.html).map(b => b.html).join('');
    const tables = prose.match(/<table class="truth-table">[\s\S]*?<\/table>/g) || [];
    let cellCount = 0;
    for (const tbl of tables) {
      const heads = [...tbl.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1].trim());
      const gates = heads.filter(h => /^[A-Z]/.test(h)).map(h => h.split(' ')[0].toLowerCase());
      ok(gates.length, 'a table in the prose states no gate columns at all, so this proves nothing');
      for (const g of gates) {
        ok(col[g + '_gate'], 'the prose has a ' + g.toUpperCase() + ' column but the library has '
           + 'no ' + g + '_gate to check it against');
      }
      const rows = [...tbl.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1).map(r =>
        [...r[1].matchAll(/<td class="(in|one|zero)"[^>]*>([^<]*)<\/td>/g)]
          .map(m => ({ cls: m[1], v: m[2].trim() })));
      ok(rows.length === (1 << heads.filter(h => /^[a-z]$/.test(h)).length),
         'a table in the prose has ' + rows.length + ' rows for its input columns, so it does not '
         + 'cover the input space it claims to');
      const seen = [];
      for (const cells of rows) {
        const bits = cells.filter(c => c.cls === 'in').map(c => c.v).join('');
        ok(seen.indexOf(bits) < 0, 'the prose table lists inputs ' + bits + ' twice');
        seen.push(bits);
        const idx = parseInt(bits.padEnd(2, '0'), 2);
        const outs = cells.filter(c => c.cls !== 'in');
        ok(outs.length === gates.length,
           'row ' + bits + ' has ' + outs.length + ' values for ' + gates.length + ' columns');
        gates.forEach((g, i) => {
          const want2 = col[g + '_gate'][idx];
          ok(outs[i].v === want2, 'the prose says ' + g.toUpperCase() + ' is ' + outs[i].v
             + ' for ' + bits + '; the run recorded ' + want2);
          /* The colour is a SECOND ENCODING of the same bit, so a green 0 or a dim 1 is the row
             disagreeing with itself - the rule the Scoreboard's flag casing is held to. */
          ok(outs[i].cls === (want2 === '1' ? 'one' : 'zero'),
             g.toUpperCase() + ' at ' + bits + ' is a ' + outs[i].v + ' painted as .' + outs[i].cls);
          cellCount++;
        });
      }
    }
    return cells.length + ' cells: ' + report.join(' ')
           + (tables.length ? '; ' + tables.length + ' prose table(s), ' + cellCount
                              + ' values against the run' : '');
  });

  /* A FRAGMENT OF THE DESIGN QUOTED IN THE PROSE IS A COPY, and a copy sitting a few hundred
     pixels above the original is the drift this repo keeps designing against: the editor holds the
     design, the walkthrough quotes it line by line, and an edit to one is invisible in the other.
     So every line inside a prose code block has to be a line the topic really ships. Compared
     TRIMMED, because a fragment is quoted flush left where the design indents it - what is being
     checked is that the line exists, not where it sits. */
  check(name('every line of code quoted in the prose is the topic\'s own'), () => {
    const spec = p.dom.window.LEARN_API.topic() || {};
    const prose = (spec.blocks || []).filter(b => b.html).map(b => b.html).join('');
    const blocks = prose.match(/<pre class="learn-code">[\s\S]*?<\/pre>/g) || [];
    if (!blocks.length) return 'n/a - this topic quotes no code in its prose';
    const own = [spec.verilog, spec.library, spec.testbench]
                  .map(s => String(s || '')).join('\n').split('\n').map(s => s.trim());
    const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    let n = 0;
    for (const b of blocks) {
      const body = unesc(b.replace(/^<pre[^>]*>/, '').replace(/<\/pre>$/, ''));
      /* No `code` inside: `.learn-prose code` is the light inline chip, and nesting one in this
         dark panel paints a pale box round the text it is meant to be part of. */
      ok(!/<\/?code[\s>]/.test(body), 'a prose code block nests <code>, which draws the inline '
         + 'light chip inside the dark panel');
      for (const line of body.split('\n').map(s => s.trim()).filter(Boolean)) {
        ok(own.indexOf(line) >= 0,
           'the prose quotes a line this topic does not ship: ' + JSON.stringify(line));
        n++;
      }
    }
    return blocks.length + ' code block(s), ' + n + ' lines, every one the design\'s own';
  });

  check(name('a figure is drawn from the topic, with every wire landing on a pin'), () => {
    const specs = (p.dom.window.LEARN_API.topic() || {}).figures || {};
    const names = Object.keys(specs);
    if (!names.length) return 'n/a - this topic declares no figures';
    const drawn = p.dom.window.LEARN_API.figures();
    ok(drawn.length === names.length,
       drawn.length + ' figures drawn for ' + names.length + ' declared');
    for (const r of drawn) {
      const spec = specs[r.name];
      ok(r.nodes === spec.nodes.length,
         r.name + ': drew ' + r.nodes + ' nodes for ' + spec.nodes.length + ' declared');
      /* Every declared wire was drawn. drawStatic discards one naming a pin the node does not
         have, so this comparison IS the missing-wire check - a mistyped pin in a topic file
         would otherwise produce a diagram quietly short of a wire. */
      /* `spec.edges || []` because a figure may be nodes ONLY - a symbol chart has no wires -
         and reading .length off an absent field would crash the check rather than fail it. */
      const declared = (spec.edges || []).length;
      ok(r.edges === declared,
         r.name + ': drew ' + r.edges + ' wires for ' + declared + ' declared');
      /* And a one-input gate was built as one. Its handle table decides where the wire LANDS -
         mid-height for a unary gate, 20% down for a two-input one - so dropping the flag draws
         a diagram that is wrong in a way no count notices. */
      const wantUnary = spec.nodes.filter(n => n.kind === 'not' || n.kind === 'buf')
                                  .map(n => n.id).sort().join(',');
      ok((r.unary || []).slice().sort().join(',') === wantUnary,
         r.name + ': unary gates are [' + (r.unary || []) + '], expected [' + wantUnary + ']');
      /* And it has a box on the page, with a height taken from the content rather than from
         the viewer's fixed 520 - a figure sized like the card would be mostly empty. */
      /* NO TWO SYMBOLS OVERLAP. A figure's positions are hand-authored, so this is the thing
         most likely to be wrong in a new one, and it is invisible to every other assertion here -
         wires still resolve and counts still match when two gates sit on top of each other. The
         caption band is included, since a label overlapping the next symbol is the same fault.
         Boxes come from the drawing's own nodeSize, so this cannot disagree with the picture. */
      const band = 22;   // CAPTION_GAP + CAPTION_H in learn.js
      const bx = r.boxes || [];
      for (let i = 0; i < bx.length; i++) {
        for (let j = i + 1; j < bx.length; j++) {
          const a = bx[i], b = bx[j];
          const over = a.x < b.x + b.w && b.x < a.x + a.w
                    && a.y < b.y + b.h + band && b.y < a.y + a.h + band;
          ok(!over, r.name + ': ' + a.id + ' and ' + b.id + ' overlap');
        }
      }
      const box = p.dom.document.querySelector('[data-figure="' + r.name + '"]');
      ok(box, r.name + ': no box in the article for it');
      /* THE WRAPPER carries the height and the BOX carries none. A height on the box is a
         BORDER-BOX height here, so setting it to the content's left 26px less room than the
         drawing needed - and `overflow-x: auto` forces `overflow-y: auto`, so the bottom of every
         figure was clipped rather than spilling: measured in Chrome as height 74, clientHeight 72,
         scrollHeight 98, with the caption band and half an input port cut off. Both halves are
         asserted, because putting the height back on the box while the wrapper also has one looks
         correct and clips again. */
      const innerH = parseFloat(String((box.querySelector('.pn-static') || { style: {} }).style.height || ''));
      ok(innerH === r.height,
         r.name + ': the wrapper is ' + innerH + ', not the content height ' + r.height);
      ok(!box.style.height,
         r.name + ': the box has an explicit height (' + box.style.height + '), which is a '
         + 'border-box height and so clips the drawing by its own padding and border');
      ok(box.querySelector('.pn-nodes'), r.name + ': nothing was drawn into the box');
      /* CENTRED BY THE DRAWING, not by the topic. The layers are `position: absolute; inset: 0`,
         so they fill their positioned ancestor - which is why the content sits in a wrapper of
         exactly its own width that CSS can centre with auto margins. Two claims, because either
         alone is satisfied by the bug this replaced: the wrapper exists and carries the content
         width, and no node's x was nudged to fake the centring. */
      const inner = box.querySelector('.pn-static');
      ok(inner, r.name + ': no centred wrapper, so the drawing is pinned to the left edge');
      /* The wrapper is the POSITIONING CONTEXT for everything inside it, set inline by the code
         that needs it rather than by a rule in another file. Without it the captions - absolute,
         and children of this wrapper - position against whatever ancestor happens to be
         positioned, which takes them out of the figure rather than merely misplacing them. */
      ok(inner.style.position === 'relative',
         r.name + ': the wrapper is position:' + (inner.style.position || 'static')
         + ', so anything absolute inside it escapes the figure');
      ok(parseFloat(String(inner.style.width || '')) === r.width,
         r.name + ': the wrapper is ' + inner.style.width + ', the drawing is ' + r.width);
      ok(Math.min(...(r.boxes || [{ x: 0 }]).map(b => b.x)) === 0,
         r.name + ': the leftmost node is at x=' + Math.min(...r.boxes.map(b => b.x))
         + ', so a figure is carrying an offset to centre itself');
      /* Captions: one per node that asked for one, and each sized to the box of the symbol it
         names - a label wider or narrower than its gate is not centred on it. */
      const wantCaps = spec.nodes.filter(n => n.caption);
      const labels = [...box.querySelectorAll('.learn-fig-label')];
      ok(labels.length === wantCaps.length,
         r.name + ': ' + labels.length + ' captions drawn for ' + wantCaps.length + ' asked for');
      if (wantCaps.length) {
        ok((r.captions || 0) === wantCaps.length, r.name + ': the caption count was not reported');
        const texts = labels.map(l => l.textContent).sort().join(',');
        ok(texts === wantCaps.map(n => n.caption).sort().join(','),
           r.name + ': the captions read [' + texts + ']');
        /* And the box grew for them, or they hang out of the bottom of the figure. */
        ok(r.height > Math.max(...wantCaps.map(n => n.y)),
           r.name + ': the box was not extended for its captions');
        /* Each label is placed and sized from its NODE's box, and the expected numbers come from
           the same exported nodeSize the drawing used - not from a table here, which would pass
           while disagreeing with the shape on screen. */
        const size = p.dom.window.PRACTICE_SYNTH_API.nodeSize;
        for (const n of wantCaps) {
          const lab = labels.find(l => l.textContent === n.caption);
          ok(lab.style.left === (n.x || 0) + 'px',
             r.name + '/' + n.caption + ': label at ' + lab.style.left + ', node at ' + n.x);
          const w = size({ type: 'gate', position: { x: 0, y: 0 },
                           data: { kind: n.kind, unary: n.kind === 'not' || n.kind === 'buf' } }).width;
          ok(lab.style.width === w + 'px',
             r.name + '/' + n.caption + ': label is ' + lab.style.width + ', the symbol is ' + w);
        }
      }
      ok(!box.querySelector('.pn-edge-hit'),
         r.name + ': the figure has clickable wires, so it is not static');
    }
    /* And an edge naming a pin that does not exist is SKIPPED, not thrown on. The topic's own
       figures are valid, so that guard is unreachable through them - which left a mutant
       deleting it alive. Calling drawStatic directly with one bad pin is what reaches it, and
       the claim is both halves: nothing throws, and the wire is not drawn. */
    const scratch = p.dom.mk('__figScratch', 'div');
    const bad = p.dom.window.PRACTICE_SYNTH_API.drawStatic(scratch, {
      nodes: [{ id: 'p', type: 'port', position: { x: 0, y: 0 }, data: { dir: 'in', label: 'p' } },
              { id: 'g', type: 'gate', position: { x: 120, y: 0 }, data: { kind: 'and', label: 'and' } }],
      edges: [{ source: 'p', target: 'g', sourceHandle: 'y', targetHandle: 'nope' }]
    });
    ok(bad.nodes === 2, 'drawStatic did not draw the two nodes of the scratch figure');
    ok(bad.edges === 0, 'a wire naming a pin that does not exist was drawn anyway');
    return names.length + ' figure(s), ' + drawn.map(r => r.nodes + 'n/' + r.edges + 'w').join(' ');
  });

  check(name('the editor is sized to the design, not left at the app default'), () => {
    const wrap = $('editorWrap');
    ok(wrap, 'no editorWrap, so the editor card is not the one the app built');
    const set = parseFloat(String(wrap.style.height || ''));
    ok(set > 0, 'the editor height was never set, so it is still the app-wide 360px default');
    const cs = p.dom.window.getComputedStyle(p.app.codeInput);
    const lh = parseFloat(cs.lineHeight);
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const lines = String(p.app.codeInput.value || '').split('\n').length;
    const want = Math.max(140, Math.min(520, Math.round(lines * lh + pad)));
    ok(set === want, 'the editor is ' + set + 'px for ' + lines + ' lines, expected ' + want);
    ok(set < 360, 'a ' + lines + '-line design got ' + set + 'px, no better than the default');
    /* And the lines it is sized to are all real: a trailing blank line is room the box has
       to make for nothing, and the gutter numbers it. */
    ok(!/\n\s*\n\s*$/.test(String(p.app.codeInput.value || '')),
       'the editor ends on blank lines, so the height it was given includes empty rows');
    return lines + ' lines -> ' + set + 'px';
  });

  check(name('the testbench is hidden, and the document that runs has it'), () => {
    const design = p.app.codeInput.value || '';
    ok(!/module tb\b/.test(design), 'the testbench is sitting in the editor the reader reads');
    ok(!/TESTBENCH/.test(design), 'the marker line is showing in the editor');
    /* AND ONE MODULE ONLY. A topic's `library` sits in the design half beside the module the page
       is about - the synthesizer needs it to resolve the design's instantiations - so what keeps it
       out of the reader's way is the editor being narrowed to that one module, not where the text
       lives. Asserted against the library's own module names, so this cannot pass by the library
       happening to be empty. */
    const topicSpec = p.dom.window.LEARN_API.topic() || {};
    const libNames = (String(topicSpec.library || '').match(/^[ \t]*module\s+(\w+)/gm) || [])
                       .map(s => s.replace(/^[ \t]*module\s+/, ''));
    const designNames = (String(topicSpec.verilog || '').match(/^[ \t]*module\s+(\w+)/gm) || [])
                       .map(s => s.replace(/^[ \t]*module\s+/, ''));
    if (libNames.length) {
      ok(designNames.length === 1,
         'the design part declares ' + designNames.length + ' modules, so there is no single '
         + 'module to narrow the editor to');
      ok(design.includes('module ' + designNames[0]),
         'the editor does not show ' + designNames[0] + ', the module the page is about');
      for (const n of libNames) {
        ok(!design.includes('module ' + n),
           'the editor shows the library module ' + n + ', which the reader is not reading');
      }
      /* The library is in the DOCUMENT, or the design would not compile at all. */
      const doc = p.app.fullSource() || '';
      for (const n of libNames) {
        ok(doc.includes('module ' + n), 'the document that runs is missing library module ' + n);
      }
      /* And the synthesizer is told which module is the top, since every unused library cell is a
         second root and it would otherwise refuse the file outright. */
      ok(p.dom.window.LEARN_SYNTH_TOP === designNames[0],
         'the synthesis top is ' + p.dom.window.LEARN_SYNTH_TOP + ', not ' + designNames[0]);
      /* The derivation refuses to guess. A design part with two modules has no single subject, so
         nothing is claimed and the synthesizer goes back to inferring - and reports its own
         ambiguity, which is the honest answer. No real topic has that shape, so the branch is
         reached by calling the derivation directly rather than left unreachable. */
      const dm = p.dom.window.LEARN_API.designModule;
      ok(dm('module one(input a); endmodule\n') === 'one', 'one module did not derive its name');
      ok(dm('module one(input a); endmodule\nmodule two(input b); endmodule\n') === null,
         'two modules in a design part still claimed a top');
      ok(dm('') === null, 'an empty design part claimed a top');
    }
    /* THE DOCUMENT THAT RUNS, not the topic's generator. Reading LEARN_API.document() here
       was asserting that topicDocument() composes correctly - which it always did - while
       the thing Run compiles is `editorFullSource` after the merge. Those came apart: the
       merge spliced the PREVIOUS example's testbench back in, so the page reported
       `expected exactly one top-level module, found [and_gate, dff_tb]` with this check
       passing. Naming the old testbench explicitly is what pins it. */
    const doc = p.app.fullSource() || '';
    ok(/module tb\b/.test(doc), 'the document that runs has no testbench at all');
    ok(!/dff_tb|module dff\b/.test(doc),
       'the document that runs still carries the example the editor briefly held');
    ok(!/\/\/ SWEEP/.test(doc), 'the SWEEP placeholder was never replaced');
    const gen = p.dom.window.LEARN_API.document();
    ok(!/\/\/ SWEEP/.test(gen), 'the SWEEP placeholder was never replaced');
    const spec = (p.dom.window.LEARN_API.topic() || {}).truthTable;
    if (spec) {
      const need = (1 << spec.inputs.length) * (spec.step || 10);
      ok(p.dom.window.LEARN_API.maxTime() >= need,
         'the run length is ' + p.dom.window.LEARN_API.maxTime() + ', which cuts a sweep that '
         + 'needs ' + need);
    }
    return 'design in the editor, testbench in the document, sweep substituted';
  });

  const wantsNetlist = (entry.slots || []).some(s => s === 'netlist' || s === 'netlist-view');
  check(name('Synthesize fills the netlist slots, and the gate-level run works'), () => {
    if (!wantsNetlist) return 'n/a - this topic asks for no netlist';
    const btn = $('synthBtn');
    ok(btn, 'no Synthesize button, so practice-synth.js decided this page does not want it');
    /* A top that is not in the file is an ERROR, not a fall back to inference: falling back would
       report the ambiguity the caller had just resolved, naming modules it never asked about. */
    const S = p.dom.window.SYNTH;
    if (S && S.synthesizeAll) {
      let threw = null;
      try { S.synthesizeAll('module one(input a); endmodule\n', 'nope'); }
      catch (e) { threw = e.message || String(e); }
      ok(threw && /no module named 'nope'/.test(threw),
         'synthesizeAll accepted a top that is not in the design: ' + threw);
    }
    const empty = parseFloat(String(($('flowRoot') || { style: {} }).style.height || ''));
    btn.click();
    p.dom.window.LEARN_API.fill();
    /* The viewer takes the height its DIAGRAM needs, not the 520px synth.css gives it: one
       AND cell in a 520px box is mostly empty canvas, and on a topic page it pushes the
       prose that follows off the screen. Asserted as a range against the bounds the viewer
       itself computes, never a pixel literal - the number moves with FIT_PAD and the node
       size table, and a literal would pin this topic's netlist and accept every other. */
    const root = $('flowRoot');
    /* The EMPTY box first, measured before this check pressed Synthesize: it holds one line
       of placeholder text, so anything near the 520px synth.css gives it is an empty panel
       taller than the prose above it. `empty` was read at the top of this file, before any
       synthesis, for exactly that reason. */
    ok(empty > 0 && empty <= 120,
       'the empty viewer is ' + empty + 'px, which is not "much smaller" than its 520 default');
    const h = parseFloat(String(root && root.style.height || ''));
    ok(h > empty, 'the viewer did not grow when a netlist arrived: ' + empty + ' -> ' + h);
    ok(h > 0, 'the viewer height was never set, so it is still the 520px default');
    ok(h >= 200 && h <= 520, 'the viewer is ' + h + 'px, outside its own [200, 520] clamp');
    ok(h < 520, 'a one-cell netlist got the full 520px, so nothing was derived');
    /* A CELL THAT IS ONE GATE IS DRAWN AS THAT GATE. The design instantiates and_gate, so the
       viewer used to draw a sub-module BOX with `double-click` on it and put the gate one level
       down - on a page whose subject is the gate. The rule is derived from the cell's own synthesis
       (one cell, and its type has a symbol), so it needs nothing in the topic file.

       Three claims. The symbol is there and no box is; the instance NAME survives, since a symbol
       has nowhere to print it and hover is where it went; and no wire was dropped - the instance's
       pins are its port names while a gate's are a/b/y, so the remap is where this breaks, and a
       wire whose handle no longer exists is discarded silently by the geometry. */
    /* Queried FROM the layer, not as `#pnNodes .rf-node-gate`: the stub resolves one simple
       selector at a time and a compound one comes back empty, which would make every assertion
       below pass against nothing - the hazard this repo records for `.gh-mark svg`. */
    const layer = $('pnNodes');
    ok(layer, 'no pnNodes layer, so nothing was rendered at all');
    const gates = layer.querySelectorAll('.rf-node-gate');
    const boxes = layer.querySelectorAll('.rf-node-instance');
    ok(gates.length >= 1, 'no gate symbol was drawn, so the cell is still a box');
    ok(boxes.length === 0, boxes.length + ' sub-module box(es) left for cells that are one gate');
    ok(/\(and_gate\)/.test(gates[0].getAttribute('title') || ''),
       'the symbol lost the instance name: title=' + gates[0].getAttribute('title'));
    const con = $('consoleBox').textContent || '';
    ok(!/could not be drawn/.test(con),
       'a wire was dropped, so a handle was not remapped when the box became a symbol');
    /* And the console says the design was ALREADY a netlist rather than reporting a synthesis. */
    ok(/already a netlist: 1 instantiated cell/.test(con),
       'the report does not say the design was already a netlist: ' + con.slice(-200));

    /* AND NO LISTING CARD, because this design was already a netlist: a card headed "Synthesized
       Gate-level Verilog Netlist" would be showing the reader their own source back. The viewer is
       the useful half and stays. Its slot goes with it, or the hole's own margin leaves a gap in the
       prose where nothing is, and the gate-level Run - which lives at the bottom of that card -
       goes too, since it would re-run the very modules the simulator just ran. */
    ok($('card-netlist').style.display === 'none',
       'the netlist listing is shown for a design that was already a netlist');
    ok($('card-netlist-view').style.display !== 'none', 'the viewer went with it');
    const hole = p.dom.document.querySelector('[data-app-slot="netlist"]');
    if (hole) ok(hole.style.display === 'none', 'the listing slot is still taking space in the prose');

    /* THE REMAP NEEDS A CELL WHOSE PORTS ARE NOT ALREADY a/b/y. This topic's and_gate happens to
       name its ports exactly what a gate's pins are called, so the mapping is an identity there and
       deleting it changes nothing - both remap mutants survived against it. A scratch design with
       ports p/q/r is what makes the mapping do work, and a dropped wire is how it fails: the
       geometry discards an edge whose handle does not exist, and the viewer counts those. */
    const good2 = p.app.codeInput.value;
    p.app.codeInput.value =
      'module dut(input a, input b, output y);\n  my_and u(.p(a), .q(b), .r(y));\nendmodule\n'
      + 'module my_and(input p, input q, output r);\n  assign r = p & q;\nendmodule\n';
    btn.click();
    const l2 = $('pnNodes');
    ok(l2.querySelectorAll('.rf-node-gate').length === 1,
       'a cell with ports p/q/r was not drawn as a gate');
    ok(l2.querySelectorAll('.rf-node-instance').length === 0, 'it was left as a box');
    ok(!/could not be drawn/.test($('consoleBox').textContent || ''),
       'a wire was dropped: the instance pins p/q/r were not mapped onto a/b/y');

    /* A cell with a pin the gate has nowhere to put stays a BOX. Reachable only with an UNUSED
       input - `p & q & r` would synthesize to two ANDs and not be a single-gate cell at all - and
       without the arity guard the third pin maps to undefined and its wire is dropped. */
    p.app.codeInput.value =
      'module dut(input a, input b, input c, output y);\n  my3 u(.p(a), .q(b), .r(c), .s(y));\n'
      + 'endmodule\n'
      + 'module my3(input p, input q, input r, output s);\n  assign s = p & q;\nendmodule\n';
    btn.click();
    const l3 = $('pnNodes');
    ok(l3.querySelectorAll('.rf-node-instance').length === 1,
       'a 3-input cell was drawn as a 2-pin gate, so a pin had nowhere to map');
    ok(l3.querySelectorAll('.rf-node-gate').length === 0, 'it was symbolized anyway');

    /* And a design that mixes an instantiation with logic of its own is NOT structural - something
       really was inferred there, so the report must not claim otherwise. */
    p.app.codeInput.value =
      'module dut(input a, input b, output y, output z);\n  my_and u(.p(a), .q(b), .r(y));\n'
      + '  assign z = ~a;\nendmodule\n'
      + 'module my_and(input p, input q, output r);\n  assign r = p & q;\nendmodule\n';
    btn.click();
    ok(!/already a netlist/.test($('consoleBox').textContent || ''),
       'a design with logic of its own was reported as already a netlist');
    /* And it gets its listing BACK: something really was synthesized there, so the card is a real
       product rather than an echo. Both directions, since a card that is always hidden would pass
       the assertion above just as well. */
    ok($('card-netlist').style.display !== 'none',
       'a design with logic of its own still had its netlist listing suppressed');
    p.app.codeInput.value = good2;
    btn.click();

    /* And it shrinks BACK. A design the synthesizer cannot read clears the netlist, so the
       box holds a placeholder again - if it kept the height the diagram earned, an error
       would leave a tall empty panel where the diagram used to be. This has to run BEFORE
       the pin test below: a pinned height deliberately outranks every rule here, so with
       the pin already set the box would correctly decline to shrink and the assertion would
       be testing the pin instead. */
    const good = p.app.codeInput.value;
    p.app.codeInput.value = 'module and_gate(input a); assign';
    btn.click();
    const cleared = parseFloat(String(($('flowRoot') || { style: {} }).style.height || ''));
    ok(cleared === empty, 'a cleared netlist kept ' + cleared + 'px, not the empty ' + empty);
    p.app.codeInput.value = good;
    btn.click();
    ok(parseFloat(String(root.style.height || '')) === h, 'the good netlist did not come back');

    /* And the reader outranks the diagram. Once the height buttons are touched the box is
       theirs, so a later synthesis must not re-derive it - otherwise resizing a small
       netlist is undone by the next press of Synthesize, which reads as the control not
       working. */
    const inc = $('netlistViewHeightInc');
    ok(inc, 'no viewer height button, so the pin cannot be tested');
    inc.click();
    const pinned = parseFloat(String(root.style.height || ''));
    ok(pinned > h, 'the height button did not grow the viewer: ' + h + ' -> ' + pinned);
    btn.click();
    ok(parseFloat(String(root.style.height || '')) === pinned,
       'a re-synthesis overrode the height the reader chose');

    for (const s of ['netlist', 'netlist-view']) {
      if ((entry.slots || []).indexOf(s) < 0) continue;
      const hole = p.dom.window.LEARN_API.slotFor(s);
      ok(hole.children.length === 1, 'slot ' + s + ' is still empty after a synthesis');
    }
    const gate = $('gateRunBtn');
    ok(gate, 'the netlist card carries no gate-level Run');
    gate.click();
    const r = p.app.result();
    ok(r && r.finished, 'the gate-level run did not reach $finish');
    return 'netlist cards in their slots, gate-level run finished at t=' + r.time;
  });

  /* AFTER the netlist check, deliberately: these press Synthesize, and that check samples
     the viewer's EMPTY height before pressing it itself. Ordered first, it left a diagram in
     the box and that check reported 200px where it expects 96 - a check breaking a later one,
     which is indistinguishable from the feature being broken. */
  /* AFTER the netlist check, like the reachability one below it: this presses Synthesize, and
     that check samples the viewer's EMPTY height before pressing it itself. Ordered first, it
     left a diagram in the box and that check read 200px where it expects 96. */
  /* THE PLACEMENT FOLLOWS SYNTHESIZE. A figure drawn once at load shows the cell the page shipped
     with, whatever the reader then puts in the editor - which is what it did, and what makes this
     worth a check of its own rather than a line in the one above: the picture has to be a fact about
     the design on screen, not about the topic file.

     Driven through the button, not by calling the drawer: what is being tested is that pressing
     Synthesize reaches the figure at all. `or_gate` is the swap because its layout is a different
     shape from the AND's, so the picture genuinely changes rather than the label under it. */
  check(name('a placement follows the design, redrawn on Synthesize'), () => {
    const spec = p.dom.window.LEARN_API.topic() || {};
    const names = Object.keys(spec.layouts || {});
    if (!names.length) return 'n/a - this topic asks for no placement';
    const before = (p.dom.window.LEARN_API.layouts()[0] || {}).types || [];
    ok(before.length, 'nothing was placed at load');
    const layerOrder = [];

    const good = p.app.codeInput.value;
    p.app.codeInput.value = good.replace(/\b\w+_gate(\s+u0)/, 'or_gate$1');
    ok(p.app.codeInput.value !== good, 'the swap did not change the editor, so this proves nothing');
    $('synthBtn').click();
    const after = (p.dom.window.LEARN_API.layouts()[0] || {}).types || [];
    ok(after.join(',') === 'or_gate',
       'after synthesizing an or_gate design the placement holds [' + after + ']');
    /* And the netlist it placed really came from the SYNTHESIS, not from the editor being re-read:
       the two agree here, so the distinction is asserted where it is visible - the text exists. */
    ok((p.dom.window.PRACTICE_SYNTH_API.netlistText() || '').includes('or_gate'),
       'the synthesis produced no or_gate netlist for the figure to place');

    /* THE SOURCE ONLY MATTERS FOR AN RTL DESIGN, which is why it has to be tested with one. A
       structural design names its cells, so the editor's text and the synthesized netlist agree and
       every mutant that confuses the two survives - all three did. Written as an operator, the
       editor has NO instantiation to place, and `and_gate` can only have come from the synthesis. */
    p.app.codeInput.value = good.replace(/^\s*\w+_gate\s+u0.*$/m, '  assign y = a & b;');
    ok(!/_gate\s+u0/.test(p.app.codeInput.value), 'the design still instantiates a cell');
    $('synthBtn').click();
    const rtl = (p.dom.window.LEARN_API.layouts()[0] || {}).types || [];
    ok(rtl.join(',') === 'and_gate',
       'an RTL design placed [' + rtl + '] - only the synthesized netlist names a cell here, so '
       + 'the figure is reading the editor instead');

    /* AND THE FALLBACK READS THE EDITOR, not the text the page shipped with. Reachable only with no
       netlist to prefer, so the synthesis result is cleared first - and then a design the topic file
       never contained has to be what appears. */
    p.dom.window.PRACTICE_SYNTH_API.reset();
    p.app.codeInput.value = good.replace(/\b\w+_gate(\s+u0)/, 'xor_gate$1');
    $('runBtn').click();
    const fell = (p.dom.window.LEARN_API.layouts()[0] || {}).types || [];
    ok(fell.join(',') === 'xor_gate',
       'with no synthesis to place, the figure drew [' + fell + '] instead of the editor\'s xor_gate');

    p.app.codeInput.value = good;
    $('synthBtn').click();
    const back = (p.dom.window.LEARN_API.layouts()[0] || {}).types || [];
    ok(back.join(',') === before.join(','),
       'putting the design back left the placement at [' + back + '], not [' + before + ']');
    /* ONE CAPTION, after all of that. Four draws stacked four copies of the same sentence under the
       figure - the append was harmless while every figure was drawn once at load, and became visible
       the moment this one started following the design. Nothing else here would have caught it: the
       placement itself was correct every time, and the suite passed with three captions on the page.
       Counted per FRAME rather than per document, so a second figure's caption cannot stand in. */
    for (const nm of names) {
      const hole = p.dom.document.querySelector('[data-layout="' + nm + '"]');      /* THE MEASURED LINE: what was placed and how big, in microns rather than the lambda the layout
         is laid out in. Derived from the placement's own report, so the line and the picture cannot
         disagree - and asserted as ONE line for the same reason the caption is, since it is redrawn
         on every press. The extent is checked by arithmetic rather than against a literal: a cell is
         40 x 72 lambda, so the number on screen has to be that times the lambda in use. */
      const stats = hole.parentElement.querySelectorAll('.learn-fig-stats');
      ok(stats.length === 1, nm + ': ' + stats.length + ' stat lines after four draws');
      const rep = p.dom.window.LEARN_API.layouts().filter(r => r.name === nm)[0];
      const lam = p.dom.window.PRACTICE_PNR_API.lambdaUm;
      /* PINNED, once, to the value that was asked for. Everything below derives from `lam`, so
         without this the whole arithmetic is circular - a lambda of 1 would satisfy `72 * lam`
         perfectly, which is the trap this repo records for AvrCore.SCALARS. A literal here means
         changing the scale is a deliberate act that fails one check and gets re-read, rather than a
         drift that every derived number quietly agrees with. */
      ok(lam === 0.65, 'lambda is ' + lam + ' um, not the 0.65 the figures are specified in');
      for (const c of rep.tally) {
        ok(stats[0].textContent.includes(c.count + ' \u00d7 ' + c.type),
           nm + ': the line does not say ' + c.count + ' x ' + c.type + ': ' + stats[0].textContent);
      }
      ok(stats[0].textContent.includes('\u00b5m'), nm + ': the extent is not in microns');
      /* And the LINE does not mention lambda: a reader of a page about logic gates has no use for the
         rule the layout was drawn to. It is still reported by the drawer, which is what the arithmetic
         below reads, so dropping it from the text costs the check nothing. */
      ok(!/\u03bb|lambda/.test(stats[0].textContent),
         nm + ': the line still states lambda: ' + stats[0].textContent);
      /* WITHIN A TOLERANCE, not equal: the reported value is formatted to two decimals for the page,
         and 72 * 0.65 is 46.800000000000004 in binary floating point - so an exact comparison against
         the product is wrong by construction rather than by anything the code did. */
      ok(Math.abs(Number(rep.umHeight) - 72 * lam) < 0.01,
         nm + ': a row is ' + rep.umHeight + ' um for 72 lambda at ' + lam + ' um');
      ok(Number(rep.umWidth) > 0, nm + ': the width ' + rep.umWidth + ' is not a number');
      /* ONE TOGGLE PER LAYER THE DRAWING HAS, labelled with the mask's name. Three claims, and the
         middle one is the substance: pressing a button really hides those shapes, and the choice
         SURVIVES a redraw - a reader who turned the metal off to see the poly under it should not have
         that undone by the next press of Synthesize.

         The layer set is read from the drawing's own report, and its size is checked against the
         artwork rather than a literal: an AND has seven masks and an inverter fewer, so a count here
         would pin one cell. */
      const row = hole.parentElement.querySelector('.learn-fig-layers');
      ok(row, nm + ': no layer toggles');
      /* `.learn-layer-btn`, not `.layout-btn`: these carry a colour, and a neutral toggle whose
         background is overridden is no longer that control - it only looks like one until someone
         changes the shared rule. */
      const btns = row.querySelectorAll('.learn-layer-btn');
      ok(btns.length === rep.layers.length,
         nm + ': ' + btns.length + ' buttons for ' + rep.layers.length + ' layers');
      ok(rep.layers.length >= 2, nm + ': only ' + rep.layers.length + ' layer(s) to toggle');
      /* THE MASK NAMES, pinned. `ALU1` and `NDIF` are what the .ap files call them and not what a page
         about silicon should say, so the mapping is the point of the feature - and a literal here is
         the only thing that catches it being dropped, since every other assertion derives from the
         same report the mapping produced. */
      const shown = rep.layers.map(L => L.label);
      for (const [raw, want] of [['ALU1', 'METAL1'], ['CONT', 'CONTACT'], ['NDIF', 'N-DIFF'],
                                 ['NWELL', 'N-WELL'], ['PDIF', 'P-DIFF']]) {
        const has = rep.layers.some(L => L.cls.indexOf('layer-' + raw) === 0);
        if (has) ok(shown.includes(want),
                    nm + ': ' + raw + ' is drawn but no badge says ' + want + ' - ' + shown.join(' '));
      }
      ok(!shown.some(l => /^(ALU1|CONT|NDIF|NWELL|PDIF)$/.test(l)),
         nm + ': a badge still shows an .ap layer name: ' + shown.join(' '));
      /* AND THEY DESCEND THE MASK STACK, top of the wafer downwards, rather than being sorted by the
         alphabet - which put CONTACT above METAL1 because C precedes M, and made a column that a
         reader cannot descend one layer at a time. Pinned as a literal for the reason the mask names
         are: every other assertion in this section derives from the same report, so a drawer that went
         back to sorting the words would satisfy all of them.

         Compared as a SUBSEQUENCE, because which masks a cell draws is the cell's business - what is
         asserted is that the ones present are in that order, and that anything off the list trails
         them rather than being interleaved into the stack. */
      const STACK = ['METAL1', 'CONTACT', 'POLY2', 'POLY', 'P-DIFF', 'N-DIFF', 'N-WELL'];
      const ranked = shown.filter(l => STACK.includes(l));
      ok(ranked.join(' ') === STACK.filter(l => ranked.includes(l)).join(' '),
         nm + ': the badges read ' + shown.join(' ') + ', which is not the mask stack top down');
      ok(shown.slice(ranked.length).every(l => !STACK.includes(l)),
         nm + ': a layer the stack does not name is mixed into it: ' + shown.join(' '));
      layerOrder.push(nm + ':' + shown.join('>'));
      /* And every one of them is a LAYER. The count above compares two numbers derived from the same
         report, so dropping the `layer-` filter - which would offer buttons for `ap-shape` and the
         abutment box as though they were masks - satisfies it perfectly. This says what a layer is. */
      for (const L of rep.layers) {
        ok(L.cls.indexOf('layer-') === 0,
           nm + ': ' + L.cls + ' is not a layer class, so the toggles offer more than masks');
        ok(!/^ap-/.test(L.label), nm + ': ' + L.label + ' is drawing furniture, not a mask');
      }
      for (let i = 0; i < rep.layers.length; i++) {
        ok(btns[i].textContent === rep.layers[i].label,
           nm + ': button ' + i + ' reads ' + btns[i].textContent + ', not ' + rep.layers[i].label);
        ok(btns[i].classList.contains('on'), nm + ': ' + rep.layers[i].label + ' starts hidden');
        /* THE BADGE IS THE LAYER'S COLOUR, and its text is legible on it. Both read from what the
           drawer reports, since both come from the artwork - and the text colour is asserted to be one
           of the two the contrast rule can choose, so a re-export that changes a hex cannot end up
           painting black on black. */
        ok(rep.layers[i].colour && /^#[0-9a-f]{6}$/i.test(rep.layers[i].colour),
           nm + ': ' + rep.layers[i].label + ' has no colour from the cell stylesheet');
        ok(btns[i].style.background === rep.layers[i].colour,
           nm + ': ' + rep.layers[i].label + ' badge is ' + btns[i].style.background);
        ok(btns[i].style.color === rep.layers[i].textOn,
           nm + ': ' + rep.layers[i].label + ' text is ' + btns[i].style.color);
        /* CONTRAST, not equality with what the code chose. Comparing the reported text colour against
           the drawer's own rule is circular - forcing every badge white satisfied it, and white on
           P-DIFF's #d4a017 is 2.0:1 - so this computes the WCAG ratio, which is a different formula
           from the luminance split the code uses and therefore an independent statement. 4.5:1 is the
           AA threshold for text this size. */
        const ratio = (a, b) => {
          const lin = (hex) => [1, 3, 5].map(i => {
            const c = parseInt(hex.slice(i, i + 2), 16) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          }).reduce((s, v, j) => s + v * [0.2126, 0.7152, 0.0722][j], 0);
          const x = lin(a) + 0.05, y = lin(b) + 0.05;
          return x > y ? x / y : y / x;
        };
        const r = ratio(rep.layers[i].colour, rep.layers[i].textOn);
        ok(r >= 4.5, nm + ': ' + rep.layers[i].label + ' text on its badge is only '
           + r.toFixed(2) + ':1');
        ok(btns[i].getAttribute('aria-pressed') === 'true',
           nm + ': ' + rep.layers[i].label + ' says it is not pressed while it is lit');
      }
      /* Press one. WHETHER THE SHAPES GO is not checkable here - the drawing is set with innerHTML and
         this stub does not parse injected markup, so there are no shape elements to hide - so what is
         asserted is the state machine, and the hiding itself is measured in a browser (7 masks, 5
         elements gone, the rest untouched). The state is the half that can regress silently. */
      const target = rep.layers[0];
      btns[0].click();
      ok(!btns[0].classList.contains('on'), nm + ': the button is still lit while its layer is off');
      ok(btns[0].style.background === 'transparent',
         nm + ': an off badge is filled ' + btns[0].style.background + ', not outlined');
      ok(btns[0].style.color === target.colour,
         nm + ': an off badge does not keep its layer colour in the text');
      ok(btns[0].getAttribute('aria-pressed') === 'false',
         nm + ': aria-pressed disagrees with the class - two encodings of one bit');

      /* AND IT SURVIVES A REDRAW, which is the part a state inside the drawing would fail. */
      $('synthBtn').click();
      const row2 = hole.parentElement.querySelector('.learn-fig-layers');
      const b2 = [...row2.querySelectorAll('.learn-layer-btn')]
                   .filter(b => b.textContent === target.label)[0];
      ok(b2 && !b2.classList.contains('on'),
         nm + ': the hidden layer came back lit after a redraw - the choice is stored inside the '
         + 'drawing, which is replaced on every press');
      b2.click();      // put it back, so later checks see a whole drawing
      ok(b2.classList.contains('on'), nm + ': pressing again did not re-light the layer');

      /* SELECT ALL AND UNSELECT ALL, at the two ends of the column. Three claims, and the last is the
         one that would regress in silence: the range buttons have to write the SAME stored state a
         badge's own click does, or the column comes back from a redraw painted from a state nobody
         wrote - every badge lit over a drawing with no shapes in it.

         They are not `.learn-layer-btn`, so the per-layer assertions above still count only layers -
         and they carry no `aria-pressed`, because an action has no state to report. */
      const alls = row2.querySelectorAll('.learn-layer-all');
      ok(alls.length === 2, nm + ': ' + alls.length + ' range buttons, expected Select All and '
         + 'Unselect All');
      const kids = [...row2.children];
      ok(kids[0] === alls[0] && kids[kids.length - 1] === alls[1],
         nm + ': the range buttons are not the first and last of the column');
      ok(alls[0].textContent === 'Select All' && alls[1].textContent === 'Unselect All',
         nm + ': the column reads ' + alls[0].textContent + ' … ' + alls[1].textContent);
      ok(!alls[0].hasAttribute('aria-pressed') && !alls[1].hasAttribute('aria-pressed'),
         nm + ': a range button claims to be a toggle');
      const layerBtns = () => [...row2.querySelectorAll('.learn-layer-btn')];
      alls[1].click();
      ok(layerBtns().every(b => !b.classList.contains('on')),
         nm + ': Unselect All left a layer lit');
      ok(layerBtns().every(b => b.getAttribute('aria-pressed') === 'false'),
         nm + ': Unselect All left a badge saying it is pressed');
      /* THROUGH A REDRAW, which is what proves it wrote the state rather than only the buttons. */
      $('synthBtn').click();
      let row3 = hole.parentElement.querySelector('.learn-fig-layers');
      ok([...row3.querySelectorAll('.learn-layer-btn')].every(b => !b.classList.contains('on')),
         nm + ': the layers came back lit after Unselect All, so it painted the badges and not the '
         + 'state a redraw is rebuilt from');
      row3.querySelectorAll('.learn-layer-all')[0].click();
      ok([...row3.querySelectorAll('.learn-layer-btn')].every(b => b.classList.contains('on')),
         nm + ': Select All left a layer off');
      $('synthBtn').click();
      row3 = hole.parentElement.querySelector('.learn-fig-layers');
      ok([...row3.querySelectorAll('.learn-layer-btn')].every(b => b.classList.contains('on')),
         nm + ': Select All did not survive a redraw either');

      /* THE CREDIT, once, and a real link. The cell artwork is not this repo's - it is the free VLSI
         library the .ap layouts were converted from - so a figure that draws those shapes has to say
         where they came from. Read from the DRAWER's own declaration rather than a literal here, so
         the check cannot pass while the page credits something else; the href is asserted because a
         credit nobody can follow is decoration. */
      const srcs = hole.parentElement.querySelectorAll('.learn-fig-source');
      ok(srcs.length === 1, nm + ': ' + srcs.length + ' source lines after four draws');
      const declared = p.dom.window.PRACTICE_PNR_API.source;
      /* PINNED, once, like lambda: everything below derives from `declared`, so a drawer crediting
         the wrong library would satisfy all of it. The literal is what makes changing the credit a
         deliberate act rather than something every derived assertion agrees with. */
      ok(declared.label === 'vlsitechnology.org'
         && declared.href.indexOf('vlsitechnology.org') > 0,
         'the layouts are credited to ' + declared.label + ' at ' + declared.href);
      const a = srcs[0].querySelector('a');
      ok(a, nm + ': the credit is not a link');
      ok(a.getAttribute('href') === declared.href,
         nm + ': the credit points at ' + a.getAttribute('href'));
      ok(a.textContent === declared.label, nm + ': the credit reads ' + a.textContent);
      ok(/^https:\/\//.test(declared.href), nm + ': the credit is not an https link');

      const caps = hole.parentElement.querySelectorAll('.learn-fig-caption');
      ok(caps.length === (spec.layouts[nm].caption ? 1 : 0),
         nm + ': ' + caps.length + ' captions after ' + 4 + ' draws, expected '
         + (spec.layouts[nm].caption ? 1 : 0));
      if (spec.layouts[nm].caption) {
        ok(caps[0].textContent === spec.layouts[nm].caption,
           nm + ': the caption reads ' + JSON.stringify(caps[0].textContent.slice(0, 40)));
      }
    }
    return before.join(',') + ' -> or_gate -> rtl:' + rtl.join(',') + ' -> fallback:'
         + fell.join(',') + ' -> ' + back.join(',') + ', 1 credit'
         + (layerOrder.length ? '; ' + layerOrder.join(' ') : '');
  });

  /* Synthesize lives in the Netlist Viewer, and can be reached whatever the synthesis did.
     That second half is the substance: it is the ONLY Synthesize button on the page now, so a
     state that hides its card is a page that cannot synthesize - and showCards(false), which a
     failed synthesis calls, hides the split row this card used to sit in. */
  check(name('Synthesize sits in the netlist viewer, and stays reachable'), () => {
    const btn = $('synthBtn'), card = $('card-netlist-view');
    ok(btn && card, 'no Synthesize button or no viewer card');
    /* After a synthesis that FAILS - the state showCards(false) is called for, and the one this
       matters in: with the only Synthesize button inside the viewer, a card hidden here is a page
       that cannot try again. Placement at load is the earlier check's. */
    const good = p.app.codeInput.value;
    p.app.codeInput.value = 'module and_gate(input a); assign';
    btn.click();
    ok($('card-netlist-view').style.display !== 'none',
       'a failed synthesis hid the viewer, leaving no way to synthesize again');
    ok($('synthBtn').parentElement === $('card-netlist-view').querySelector('.learn-synth-foot'),
       'the button left the footer when the synthesis failed');
    p.app.codeInput.value = good;
    btn.click();
    return 'in the footer, leftmost, and still there after a failure';
  });

  /* Reset and the run length are gone: a topic computes its own length from the sweep and has
     nothing to reset to. The two labels are asserted as well as the field - hiding the input
     alone leaves "run for" and "time units" with a gap between them. */
  check(name('Reset and the run-length field are hidden'), () => {
    ok($('resetBtn').style.display === 'none', 'Reset is still on the topic page');
    const maxIn = $('maxTimeInput');
    ok(maxIn.style.display === 'none', 'the run-length field is still on the topic page');
    ok(maxIn.previousElementSibling.style.display === 'none', 'the "run for" label is still there');
    ok(maxIn.nextElementSibling.style.display === 'none', 'the "time units" label is still there');
    /* The value is still SET, because the run reads it - hiding a control is not the same as
       taking the number away. */
    ok(Number(maxIn.value) > 0, 'the run length was blanked as well as hidden: ' + maxIn.value);
    return 'Reset, the field and both its labels hidden; length still ' + maxIn.value;
  });

}

/* ---- the hub ---- */
check('the hub lists every topic, linking only to pages that exist', () => {
  const hub = fs.readFileSync(path.join(HERE, 'learn.html'), 'utf8');
  /* Anchored on the ROW BUILDER, not on the text: `'learn-'` also appears in the drawer's
     own current-row rule, which this file pastes in - so the loose form passed while the
     row builder was mutated away, and a drawer mutant reported this check failing for a
     reason that had nothing to do with it. The take-the-wrong-match failure again. */
  ok(/<a href="learn-' \+ esc\(e\.slug\)/.test(hub),
     'the hub does not build its rows as learn-<slug>.html links');
  for (const e of topics) {
    ok(fs.existsSync(path.join(HERE, 'learn-' + e.slug + '.html')),
       'learn-' + e.slug + '.html does not exist, so its row is a dead link');
  }
  ok(/LEARN_MANIFEST/.test(hub), 'the hub does not read the manifest');
  ok(!/PRACTICE_MANIFEST/.test(hub), 'the hub still reads the practice manifest');
  return topics.length + ' topics, every page present';
});

console.log(JSON.stringify(results));
"""


def node(src):
    p = subprocess.run(['node', '--stack-size=8000', '-e', src],
                       capture_output=True, text=True)
    if p.returncode != 0 or not p.stdout.strip():
        raise SystemExit('node failed:\n' + (p.stderr or '')[-3000:])
    return p.stdout.strip().split('\n')[-1]


def main():
    entries = manifest()
    driver = (DRIVER
              # Distinct placeholder names, and long ones: a bare `TOOLS` also matches
              # inside `TOOLS_DIR`, which turned the driver's first line into a syntax
              # error - the same substring trap test.py's own substitutions avoid.
              .replace('TOOLS_DIR_JSON', json.dumps(TOOLS))
              .replace('APP_DIR_JSON', json.dumps(HERE))
              .replace('SLUG_JSON', json.dumps(entries[0]['slug'] if entries else ''))
              .replace('MANIFEST_JSON', json.dumps(entries)))
    rows = json.loads(node(driver))
    bad = 0
    for status, name, detail in rows:
        if status != 'PASS':
            bad += 1
        print('  %-4s  %-62s %s' % (status, name, detail))
    print()
    print('%d CHECK(S) FAILED' % bad if bad else '%d checks passed' % len(rows))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
