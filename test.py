#!/usr/bin/env python3
"""
Verify the practice site: every exercise, and the page wiring around them.

Two halves, run in one go:

  ENGINE (tools/simrun.js)  - the lexer/parser/Simulator out of the shipped
  practice/app.js, with no DOM at all, so each exercise's starter and reference
  solution can be simulated in milliseconds. This is where the substance is:

    * the solution runs to $finish and prints PASS for every check and FAIL for
      none;
    * the starter parses, runs, and prints at least one FAIL. A starter that
      already passes is not an exercise, and this is the check that catches it -
      including the case where someone pastes the solution in by mistake;
    * starter and solution carry a BYTE-IDENTICAL testbench, so the checks a
      learner sees are the ones the solution was verified against;
    * the exercise's memory images really reach $readmemh/$readmemb - asserted by
      running the solution WITHOUT them and requiring it to fail, naming the file;
    * every data file survives new Function, which is the only real test for the
      backtick trap (parity says nothing: two backticks keep the count even while
      turning comment into code).

  PAGE (tools/fakedom.js) - boot a real page the way a browser does: shell.js,
  then app.js, then practice.js, against a stub DOM. This covers what the engine
  half cannot see - that the editor really holds the starter rather than the
  simulator's first example, that the memory images are attached, that the verdict
  pill counts what the console printed, and that all four ways out of the exercise
  sheet work and the Exercise button brings it back.

    python3 practice/test.py            # everything
    python3 practice/test.py -k adder   # only slugs matching a substring
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, 'tools')


def node(script, *args):
    p = subprocess.run(['node', '--stack-size=8000', '-e', script, '--', *args],
                       capture_output=True, text=True, cwd=HERE)
    if p.returncode != 0:
        print(p.stdout)
        print(p.stderr, file=sys.stderr)
        raise SystemExit('node failed')
    return p.stdout


# --------------------------------------------------------------------------
# half 1: every starter and every solution, through the real engine
# --------------------------------------------------------------------------

ENGINE_DRIVER = r"""
const fs = require('fs'), path = require('path');
const sim = require(TOOLS + '/simrun.js');
const HERE = APP_DIR;
const only = ONLY;

const results = [];
function check(name, f) {
  try { const d = f(); results.push(['PASS', name, d === undefined ? '' : String(d)]); }
  catch (e) { results.push(['FAIL', name, (e && e.message) || String(e)]); }
}
function ok(c, m) { if (!c) throw new Error(m || 'failed'); }

const entries = sim.manifest().entries.filter(e => !only || e.slug.includes(only));

/* Exercises with NO $display checks of their own, because the Scoreboard card is
   their checker: it compares pc, r0-r31, sp, the flags and the memories after every
   retired instruction, which is strictly more than a list of register comparisons
   could assert, and it names the failing instruction in the program's own terms.
   For these the oracle is the model's verdict rather than a PASS/FAIL tally. */
const MODEL_CHECKED = ['cpu-16bit'];

/* The testbench is whatever follows the TESTBENCH marker - the same line the two
   editors split on, so this compares exactly what the Testbench Editor holds.
   Comparing that slice is what pins the starter's checks to the ones the solution
   was verified against.

   This replaced a search for the last `module tb`, which could not see that a rom,
   a ram model and the system wrapper are testbench too: on the three CPU exercises
   it called them design and compared none of them. */
/* Spelled exactly as `Baerilog/simulator.html`'s TB_MARKER_RE and `Baerilog/synthesis.html`'s
   TESTBENCH_MARKER are, and a check below asserts all three agree. Loosened from a line-anchored
   form so a marker embedded in a line (`endmodule// ==== TESTBENCH ====module tb;`) is found; the
   `=` decoration is what keeps prose such as `// checked by the testbench below` from matching. */
const TB_MARKER_RE = /\/\/[^\n]*?=+[ \t]*TESTBENCH[ \t]*=+/i;
// Global twin, for the "exactly one marker in the document" assertions. Built from the one
// pattern rather than written out again, so the two cannot drift.
const TB_MARKER_G = new RegExp(TB_MARKER_RE.source, 'gi');
function tbOf(text, what) {
  const m = TB_MARKER_RE.exec(text);
  if (!m) throw new Error(what + ' has no TESTBENCH marker - the two halves are split on it');
  return text.slice(m.index);
}
function tally(r) {
  const t = r.text || '';
  return {
    pass: (t.match(/\bPASS\b/g) || []).length,
    fail: (t.match(/\bFAIL\b/g) || []).length,
    summary: (t.split('\n').filter(l => /CHECKS (PASSED|FAILED)/.test(l))[0] || '')
  };
}

for (const e of entries) {
  const slug = e.slug;
  const ex = sim.loadExercise(slug);
  const solution = fs.readFileSync(path.join(HERE, 'solutions', slug + '.v'), 'utf8');
  const mem = ex.memFiles || {};

  if (MODEL_CHECKED.includes(slug)) {
    check(slug + ': the Scoreboard finds no mismatch in the reference solution', () => {
      const v = sim.modelVerdict(solution, { memFiles: mem });
      ok(!v.error, v.error);
      ok(v.bound, 'the model could not bind to the design');
      ok(!v.mismatch, 'the model diverges from the solution at ' + v.field
                      + ' (instruction #' + v.instruction + ')');
      ok(v.instructions >= 20, 'only ' + v.instructions + ' instructions were compared');
      return v.instructions + ' instructions, no mismatch (' + v.stopped + ')';
    });
    check(slug + ': the Scoreboard catches the starter, naming the instruction', () => {
      const v = sim.modelVerdict(ex.starter, { memFiles: mem });
      ok(!v.error, v.error);
      ok(v.bound, 'the model could not bind to the starter');
      ok(v.mismatch, 'the model finds nothing wrong with the starter - it is not an exercise');
      ok(v.field, 'the divergence names no field');
      ok(v.insAsm, 'the report does not quote the failing instruction');
      return v.field + ' at instruction #' + v.instruction + ' - ' + v.insAsm.slice(0, 40);
    });
    check(slug + ': its testbench prints no checks, deliberately', () => {
      const r = sim.run(solution, { memFiles: mem });
      ok(r.finished, 'the solution never reaches $finish');
      ok(r.log.length === 0, 'it printed ' + r.log.length + ' lines - if the testbench '
         + 'has checks again, the Scoreboard is no longer the only checker');
      return 'silent, t=' + r.time;
    });
  } else {
  check(slug + ': the reference solution passes every check', () => {
    const r = sim.run(solution, { memFiles: mem });
    ok(!r.parseError, 'parse error: ' + r.parseError);
    ok(!r.crash, 'crash: ' + r.crash);
    ok(!r.error, 'runtime error: ' + r.error);
    ok(r.finished, 'never reached $finish (t=' + r.time + ')');
    const t = tally(r);
    ok(t.pass > 0, 'printed no PASS lines at all');
    ok(t.fail === 0, t.fail + ' checks failed: ' + t.summary);
    return t.pass + ' checks, ' + t.summary;
  });

  check(slug + ': the starter runs but does NOT already pass', () => {
    const r = sim.run(ex.starter, { memFiles: mem });
    ok(!r.parseError, 'the starter does not parse: ' + r.parseError);
    ok(!r.crash, 'the starter crashed the simulator: ' + r.crash);
    ok(!r.error, 'the starter hits a runtime error: ' + r.error);
    ok(r.finished, 'the starter never reaches $finish (t=' + r.time + ')');
    const t = tally(r);
    ok(t.fail > 0, 'the starter passes every check - it is not an exercise');
    return t.fail + ' of ' + (t.fail + t.pass) + ' checks fail, as they should';
  });
  }

  check(slug + ': starter and solution share one testbench', () => {
    const a = tbOf(ex.starter, 'the starter'), b = tbOf(solution, 'the solution');
    ok(a === b, 'the testbench text differs - the learner is being checked by a '
                + 'different testbench from the one the solution was verified against');
    return a.split('\n').length + ' lines';
  });

  /* The images are the page's doing, not the design's, so the design has to fail
     without them - otherwise "it is attached" would be untestable. */
  if (Object.keys(mem).length) {
    check(slug + ': its memory images are load-bearing', () => {
      const r = sim.run(solution, { memFiles: {} });
      ok(r.error, 'the solution ran with nothing attached, so $readmem resolved from somewhere else');
      const names = Object.keys(mem);
      ok(names.some(n => r.error.includes(n)), 'unhelpful error: ' + r.error);
      return names.join(' + ') + ' -> ' + r.error.slice(0, 46);
    });
  }
}

/* One clock for the whole site. Asserted from the recorded waveform rather than by
   grepping for `always #5 clk = ~clk;`, because what matters is the shape of the clk
   row a learner actually sees: an input change or a settling delay left in the low
   phase makes it a train of narrow pulses with a lopsided duty cycle, which is what
   the hand-driven idiom used to produce, and no amount of reading the source says so
   as plainly as the deltas do. */
check('every clock is the same square wave', () => {
  const HALF = 5;
  const clocked = [];
  for (const e of sim.manifest().entries) {
    const ex = sim.loadExercise(e.slug);
    const solution = fs.readFileSync(path.join(HERE, 'solutions', e.slug + '.v'), 'utf8');
    const r = sim.run(solution, { memFiles: ex.memFiles || {} });
    const s = r.signals['clk'];
    if (!s) continue;                       // a purely combinational exercise has none
    clocked.push(e.slug);
    // every time clk takes a new KNOWN value, and how far apart those are
    const edges = [];
    let prev = null;
    for (const [t, v] of s.history) {
      if (v.x !== 0 || v.z !== 0) continue;
      if (prev === null || v.v !== prev) { edges.push(t); prev = v.v; }
    }
    ok(edges.length >= 4, e.slug + ': only ' + edges.length + ' clock transitions');
    ok(edges[0] === 0, e.slug + ': the clock starts at t=' + edges[0] + ', not 0');
    for (let i = 1; i < edges.length; i++) {
      const d = edges[i] - edges[i - 1];
      ok(d === HALF, e.slug + ': a clock phase lasted ' + d + ' time units, not ' + HALF
                     + ' (transitions at ' + edges.slice(Math.max(0, i - 2), i + 1).join(', ') + ')');
    }
  }
  return clocked.length + ' clocked exercises, all ' + (HALF * 2) + '-unit 50% duty';
});

/* Every data file has to be evaluable, and that is the only real check for a stray
   backtick: an even number of them keeps parity happy while turning a stretch of
   comment into code somewhere else entirely. */
check('every exercise file evaluates', () => {
  const bad = [];
  for (const e of sim.manifest().entries) {
    try { sim.loadExercise(e.slug); } catch (err) { bad.push(e.slug + ': ' + err.message); }
  }
  ok(!bad.length, bad.join('; '));
  return sim.manifest().entries.length + ' files';
});

/* Which problems show the Memory Viewer is a REQUIREMENT, so it is derived from
   the designs here rather than read back out of the manifest - asserting the
   manifest against itself would let a flag be dropped silently, and did.
   The rule has no exceptions: a design that declares a memory array, or an
   exercise that attaches an image, shows the card; nothing else does. Note
   register-file is deliberately NOT in that set - its file is built out of
   discrete registers, so there is no memory for the card to show. */
check('the Memory Viewer is on exactly the pages that need it', () => {
  const MEM_DECL = /reg\s*\[[^\]]*\]\s*\w+\s*\[[^\]]*\]\s*;/;
  const shown = [], want = [];
  for (const e of sim.manifest().entries) {
    const ex = sim.loadExercise(e.slug);
    const solution = fs.readFileSync(path.join(HERE, 'solutions', e.slug + '.v'), 'utf8');
    const needs = MEM_DECL.test(solution) || Object.keys(ex.memFiles || {}).length > 0;
    if (needs) want.push(e.slug);
    if (e.memory) shown.push(e.slug);
  }
  ok(shown.join() === want.join(), 'shown on [' + shown.join(', ') + '] but needed on ['
                                   + want.join(', ') + ']');
  return want.join(', ');
});

console.log(JSON.stringify(results));
"""


# --------------------------------------------------------------------------
# half 2: boot a real page against the stub DOM
# --------------------------------------------------------------------------

PAGE_DRIVER = r"""
const fs = require('fs'), path = require('path');
const { makeDom } = require(TOOLS + '/fakedom.js');
// The engine half's own runner, reused here to simulate what the netlist card shows.
const simrun = require(TOOLS + '/simrun.js');
const HERE = APP_DIR;
const SLUG = SLUG_JSON;
// the slugs whose manifest entry says "synthesis": true, derived rather than written
// down, so turning the flag on for another exercise needs no edit here
const SYNTH_SLUGS = SYNTH_SLUGS_JSON;
// kept in step with the engine driver's list by the check right below the loop
const MODEL_CHECKED = ['cpu-16bit'];
/* Spelled identically in the engine driver, in simulator.html and in synthesis.html; a check
   below compares all four rather than trusting them, the same way MODEL_CHECKED is compared.
   The two drivers are separate `new Function` scopes, so this is a second definition and not a
   reference - which is exactly why it needs the check. */
const TB_MARKER_RE = /\/\/[^\n]*?=+[ \t]*TESTBENCH[ \t]*=+/i;
const TB_MARKER_G = new RegExp(TB_MARKER_RE.source, 'gi');

const results = [];
function check(name, f) {
  try { const d = f(); results.push(['PASS', name, d === undefined ? '' : String(d)]); }
  catch (e) { results.push(['FAIL', name, (e && e.message) || String(e)]); }
}
function ok(c, m) { if (!c) throw new Error(m || 'failed'); }

/* The stub DOM materialises elements on demand, so the ids in the injected markup
   have to be discovered from it rather than hardcoded: shell.js inserts the
   simulator's whole body, and app.js then getElementById's every one of them. */
function boot(slug, sharedDom) {
  /* `sharedDom` is how a check seeds localStorage before the page reads it at load - the
     same escape hatch bootHub already takes, and the only way to test a persisted choice,
     since a fresh makeDom() starts with empty storage. */
  const dom = sharedDom || makeDom();
  const ids = {}, parents = {};
  const markupSrc = fs.readFileSync(path.join(HERE, 'shell.js'), 'utf8');
  const m = markupSrc.match(/String\.raw`([\s\S]*?)`;/);
  ok(m, 'shell.js has no markup region');
  // tag per id, plus the two parent relationships the app walks upward through
  const re = /<(\w+)[^>]*\bid="([^"]+)"([^>]*)>/g;
  let mm;
  while ((mm = re.exec(m[1]))) {
    const tag = mm[1], id = mm[2], attrs = mm[3] + mm[0];
    ids[id] = tag === 'input' && /type="checkbox"/.test(attrs) ? 'input:checkbox'
            : tag === 'input' ? 'input:text' : tag;
  }
  /* A BUTTON's own label, which the stub would otherwise leave empty - and that is not
     a cosmetic gap: the Run button's two labels are derived from whatever the markup
     says (see app.js's RUN_LABEL_FRESH), so with an empty one both come out '' and
     every assertion about them passes while comparing nothing. Buttons only. Seeding
     text generally would put words into consoleBox and waveEmpty, which other checks
     read for meaning - the verdict pill counts PASS/FAIL in exactly that text. */
  const labels = {};
  const reBtn = /<button[^>]*\bid="([^"]+)"[^>]*>([^<]*)<\/button>/g;
  while ((mm = reBtn.exec(m[1]))) labels[mm[1]] = mm[2];
  parents['waveCanvas'] = 'waveScroll';
  parents['codeInput'] = 'editorWrap';
  parents['gutter'] = 'editorWrap';
  parents['tbInput'] = 'tbWrap';
  parents['tbGutter'] = 'tbWrap';

  /* The editor toolbar is a real parent with a real class, and practice.js hides it
     only when nothing visible is left in it. Modelling it as `__toolbar` rather than
     letting these ids fall through to the grid is what makes that check mean
     something: parented to the grid, the guard declines (the grid is not a toolbar)
     and the assertion passes against an element that was never the one in question.
     Membership comes from the markup, so a control added to that row joins it here. */
  const barIds = [];
  const reBar = /<div class="toolbar"[^>]*>([\s\S]*?)<\/div>/g;
  let bm;
  while ((bm = reBar.exec(m[1]))) {
    const inner = bm[1];
    let im; const reId = /\bid="([^"]+)"/g;
    while ((im = reId.exec(inner))) barIds.push(im[1]);
    if (barIds.length) break;                 // the editor card's toolbar, the first one
  }
  for (const id of barIds) parents[id] = '__toolbar';

  const grid = dom.mk('__grid');
  grid.classList.add('grid');
  const toolbar = dom.mk('__toolbar', 'div', grid);
  toolbar.classList.add('toolbar');
  const made = new Map([['__grid', grid], ['__toolbar', toolbar]]);
  function ensure(id) {
    if (made.has(id)) return made.get(id);
    const spec = ids[id] || 'div';
    const tag = spec.startsWith('input:') ? 'input' : spec;
    const el = dom.mk(id, tag, parents[id] ? ensure(parents[id]) : grid);
    if (spec === 'input:checkbox') el.checked = true;
    if (labels[id] !== undefined) el.textContent = labels[id];
    made.set(id, el);
    return el;
  }
  for (const id of Object.keys(ids)) ensure(id);
  /* The stub does not parse the injected markup, so the handful of elements the
     page finds by SELECTOR rather than by id have to be stood up by hand - the h1
     and subtitle shell.js retitles, and the Console card's h2 (with its layout
     buttons) that the verdict pill is inserted before. */
  dom.mk('__h1', 'h1', grid);
  dom.mk('__subtitle', 'div', grid).classList.add('gh-sub');
  /* The header bar comes from the injected markup now (it is the simulator's own),
     and the stub does not parse markup - so it is stood up here, nav and all, the
     same way the h1 and subtitle are. shell.js moves the `here` marker onto the
     Practice link, which needs a link to move it to. */
  const hdr = dom.mk('__header', 'header', grid);
  hdr.classList.add('gh-header');
  /* The bar's inner row and the wordmark, because shell.js reaches for both by
     SELECTOR: the menu button is inserted as `.gh-header-inner`'s first child, and
     the drawer's mark is a cloneNode of `.gh-mark svg` rather than a ninth copy of
     those paths. Without them here the code takes its own fallbacks (the body, and no
     mark) and both claims would be tested against something that never happened. */
  const inner = dom.mk('__headerInner', 'div', hdr);
  inner.classList.add('gh-header-inner');
  const mark = dom.mk('__mark', 'a', inner);
  mark.classList.add('gh-mark');
  mark.setAttribute('href', 'index.html');
  dom.mk('__markSvg', 'svg', mark);
  const nav = dom.mk('__nav', 'nav', inner);
  nav.classList.add('gh-nav');
  // The nav is four siblings inside Baerilog/ now, with no ../ - shell.js marks the
  // one whose href is index.html (the hub), so both of these have to be realistic
  // for that to be testable at all.
  const simLink = dom.mk('__navSim', 'a', nav);
  simLink.setAttribute('href', 'simulator.html');
  simLink.className = 'here';
  const pracLink = dom.mk('__navPractice', 'a', nav);
  pracLink.setAttribute('href', 'index.html');
  /* Three (?) icon/popup pairs, because the stub does not parse the injected markup
     and app.js's handler binds to whatever .help-icon elements exist when it runs.
     The MARKUP side of this - one popup per icon, adjacency, no card left with a
     paragraph - is checked repo-wide by tools/check_theme.py; what needs a DOM is
     the toggling. */
  for (let i = 0; i < 3; i++) {
    const wrap = dom.mk('__help' + i, 'span', grid);
    wrap.classList.add('help-wrap');
    const icon = dom.mk('__helpIcon' + i, 'span', wrap);
    icon.classList.add('help-icon');
    const pop = dom.mk('__helpPop' + i, 'div', wrap);
    pop.classList.add('help-popup');
  }
  const consoleCard = dom.mk('card-console', 'div', grid);
  consoleCard.classList.add('card');
  const consoleH2 = dom.mk('__consoleH2', 'h2', consoleCard);
  dom.mk('__consoleControls', 'span', consoleH2).classList.add('header-controls');
  dom.document.getElementById('maxTimeInput').value = '300';
  dom.document.getElementById('memHexCheckbox').checked = true;
  dom.document.getElementById('memBinCheckbox').checked = true;
  /* The Scoreboard's "stop when mismatching" is ON by default now, and app.js's own
     init sets it from localStorage with that default - so there is nothing to force
     here, and forcing it off would make the harness less faithful than a browser.
     What it means for the assertions below: a design the model DIVERGES from has its
     run truncated at that instruction, which is the intended behaviour and not a
     failure. */
  dom.document.getElementById('modelStopAfter').value = '10';

  const run = (file, extra) => {
    const body = fs.readFileSync(path.join(HERE, file), 'utf8');
    return new Function('document', 'window', 'localStorage', 'requestAnimationFrame',
                        'setTimeout', 'clearTimeout',
                        'FileReader', 'Blob', 'URL', 'PRACTICE_MARKUP_UNUSED',
                        body + (extra || ''))
      (dom.document, dom.window, dom.localStorage, dom.window.requestAnimationFrame,
       dom.window.setTimeout, dom.window.clearTimeout,
       function FileReader() {}, function Blob() {}, { createObjectURL: () => 'blob:x', revokeObjectURL() {} });
  };

  dom.window.PRACTICE_SLUG = slug;
  run('manifest.js', '\nwindow.PRACTICE_MANIFEST = PRACTICE_MANIFEST; window.PRACTICE_CATEGORIES = PRACTICE_CATEGORIES;');
  run('exercises/' + slug + '.js');
  const shell = run('shell.js', '\nreturn { PRACTICE_META, PRACTICE_EX, ICON };');
  const synthesis = !!(shell.PRACTICE_META && shell.PRACTICE_META.synthesis);
  // The engine, before the file that calls it - a page loads them in that order too.
  if (synthesis) run('synth.js');

  /* app.js, practice.js and practice-synth.js are evaluated as ONE body, because in a
     browser they are three classic scripts sharing one global lexical environment -
     practice.js reads app.js's setEditorText, and practice-synth.js reads its
     editorFullSource, which is a `let` that is REASSIGNED on every edit. Handing that
     one across as a parameter would freeze it at load, so a test that edits the design
     and presses Run would silently synthesize the old text. Concatenating is the only
     arrangement where a live binding stays live. shell.js stays separate: everything
     the others read from it is a top-level `var`, i.e. a global, so passing those in is
     faithful. */
  let body = fs.readFileSync(path.join(HERE, 'app.js'), 'utf8')
           + '\n;\n' + fs.readFileSync(path.join(HERE, 'practice.js'), 'utf8');
  if (synthesis) body += '\n;\n' + fs.readFileSync(path.join(HERE, 'practice-synth.js'), 'utf8');
  const app = new Function('document', 'window', 'localStorage', 'requestAnimationFrame',
                           'setTimeout', 'clearTimeout',
                           'FileReader', 'Blob', 'URL',
                           'PRACTICE_EX', 'PRACTICE_META', 'ICON',
                           body + '\nreturn { codeInput, consoleBox, attachedMemFiles, runSimulation,'
                                + ' setEditorText, resetEditorHierarchyState, tryApplyAutoFinishTime,'
                                + ' renderMemFileList, EXAMPLES, PALETTE, result: () => lastResult,'
                                + ' fullSource: () => editorFullSource,'
                                + ' selectEditorModule, moduleNames: () => lastGoodModuleNames,'
                                + ' currentFullSource, loadFullSource,'
                                + ' view: () => [viewStart, viewEnd], cursor: () => cursorTime,'
                                + ' layout: () => waveLayout, waveOff: () => waveOff,'
                                + ' setView: (a, b) => { viewStart = a; viewEnd = b; },'
                                + ' runLabels: () => [RUN_LABEL_FRESH, RUN_LABEL_AGAIN] };')
    (dom.document, dom.window, dom.localStorage, dom.window.requestAnimationFrame,
     dom.window.setTimeout, dom.window.clearTimeout,
     function FileReader() {}, function Blob() {}, { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
     shell.PRACTICE_EX, shell.PRACTICE_META, shell.ICON);
  return { dom, shell, app, synthesis };
}

let page = null;
check('a practice page boots: shell.js, then app.js, then practice.js', () => {
  page = boot(SLUG);
  return SLUG;
});

/* The empty page has to READ as empty, and every word of that comes from the injected
   markup rather than from code - so it is checked there. The stub does not parse
   markup, so no booted page can see these; and app.js is asserted to contain no
   auto-run at all, which is the source-level half of "nothing runs on load". */
check('the markup ships the empty states, and app.js runs nothing on load', () => {
  const shellSrc = fs.readFileSync(path.join(HERE, 'shell.js'), 'utf8');
  ok(/id="consoleBox"><span class="info">Click Run to simulate/.test(shellSrc),
     'the console does not ship its "Click Run to simulate" placeholder');
  ok(/id="waveEmpty">No simulation data yet/.test(shellSrc),
     'the waveform card ships no empty state');
  ok(/id="modelEmpty">No simulation data yet/.test(shellSrc),
     'the Scoreboard ships no empty state');
  const appJs = fs.readFileSync(path.join(HERE, 'app.js'), 'utf8');
  /* A bare `runSimulation();` at the top level is the auto-run this site removed.
     Every legitimate mention is a listener, a call inside a function, or a comment -
     none of which start a line. */
  const autorun = (appJs.match(/^runSimulation\(\);/gm) || []).length;
  ok(autorun === 0, 'app.js still auto-runs a simulation (' + autorun + ' call(s))');
  const practiceJs = fs.readFileSync(path.join(HERE, 'practice.js'), 'utf8');
  ok(!/\brunSimulation\(\)/.test(practiceJs), 'practice.js still runs a simulation itself');

  /* Anything another classic script reaches through `window` must be a FUNCTION
     DECLARATION, and this can only be checked in the source: a top-level `let` or
     `const` is not a property of the global object in a browser, while a function
     declaration is - and no headless harness here can tell the difference, because
     the stub evaluates app.js into a function scope where both are just locals.

     That gap shipped a real bug. cloud-sync.js read the document as
     `window.editorFullSource`, got `undefined` in every browser, and silently fell
     back to codeInput.value - which since the design/testbench split holds only the
     design half, so it saved half of every file. The suite stayed green throughout. */
  const REACHED_THROUGH_WINDOW = ['currentFullSource', 'loadFullSource', 'setEditorText',
                                  'spliceEditorChangesBack', 'resetEditorHierarchyState',
                                  'tryApplyAutoFinishTime'];
  for (const n of REACHED_THROUGH_WINDOW) {
    ok(new RegExp('^function ' + n + '\\b', 'm').test(appJs),
       n + ' is not a top-level function declaration in app.js, so window.' + n
       + ' is undefined in a browser - every cross-script caller silently takes its fallback');
  }
  /* And the other half of the claim: nothing may reach for a top-level BINDING,
     which is the shape of the bug rather than its instance. */
  const cloudJs = fs.readFileSync(path.join(HERE, 'cloud-sync.js'), 'utf8');
  /* Comments stripped first: this file EXPLAINS the bug at length, and a check that
     fires on the prose describing a mistake is one people learn to silence. */
  const cloudCode = cloudJs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/window\.editorFullSource/.test(cloudCode),
     'cloud-sync.js reads window.editorFullSource, which is a let and therefore undefined');
  return 'three empty states, no auto-run, ' + REACHED_THROUGH_WINDOW.length
       + ' cross-script names are function declarations';
});

/* The Testbench Editor shipped UNSTYLED, and the cause is worth a check rather than
   care: the editor rule was `textarea#codeInput`, an id selector, so a second
   textarea inherited no font, no padding and no `white-space: pre` and rendered as
   proportional wrapped text in a box that never filled its dark panel. The workbench's
   C editor had already hit exactly this. The rule is structural now, and these
   assertions are what stop it from going back - none of which a booted page can see,
   since the stub applies no CSS at all. */
check('both editors are styled by one structural rule, not by id', () => {
  const css = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8');
  ok(/^\s*\.editor-wrap textarea\s*\{/m.test(css),
     'app.css has no `.editor-wrap textarea` rule - the editors are styled by id again');
  ok(!/textarea#codeInput\s*\{/.test(css),
     'app.css still styles the editor by id, so a second editor inherits nothing');
  ok(!/textarea#tbInput\s*\{/.test(css),
     'the testbench editor got its own id rule - two rules to keep in step is the bug');

  /* The properties whose absence is what the screenshot showed - taken from the rule
     that CARRIES them rather than from the first textual match. The shared block's
     narrow-screen layer now also names `.editor-wrap textarea` (to raise it to 16px,
     which is what stops iOS zooming the page), and that rule matched first: the check
     then reported the shared editor rule as missing `font:` while it was intact three
     hundred lines below. So scan every match and require one complete rule. */
  const rules = [...css.matchAll(/\.editor-wrap textarea\s*\{([^}]*)\}/g)].map(m => m[1]);
  ok(rules.length, 'no .editor-wrap textarea rule at all');
  const PROPS = ['font:', 'white-space: pre', 'padding:', 'flex:', 'tab-size:'];
  const full = rules.find(r => PROPS.every(p => r.indexOf(p) >= 0));
  ok(full, 'no single .editor-wrap textarea rule carries all of ' + PROPS.join(' ')
       + ' - found ' + rules.length + ' rule(s), the fullest missing '
       + PROPS.filter(p => !rules.some(r => r.indexOf(p) >= 0)).join(' '));

  // and the markup must actually put both textareas inside an .editor-wrap
  const shellSrc = fs.readFileSync(path.join(HERE, 'shell.js'), 'utf8');
  for (const id of ['codeInput', 'tbInput']) {
    const m = new RegExp('<div class="editor-wrap"[^>]*>\\s*<div class="gutter"[^>]*>[^<]*</div>\\s*'
                         + '<textarea id="' + id + '"').test(shellSrc);
    ok(m, id + ' is not inside an .editor-wrap with a gutter, so the shared rule misses it');
  }
  return 'one rule, five properties, both textareas inside it';
});


/* The state of a page nobody has run yet. Asserted at load, again after a Reset, and
   again after a Reset pressed with no Run behind it at all - three call sites of one
   function, which is what makes "the same as first launching" a check rather than a
   restatement of it. */
const assertPreRunState = (p, e, when) => {
  const at = e + ' (' + when + '): ';
  ok(!p.app.result(), at + 'there is a simulation result');
  ok(!p.dom.window.PRACTICE_API.hasRun(), at + 'the page thinks it has run');
  /* No check output, and no verdict claiming any: the pill is silent until a run,
     because after one "no checks reported" is a real verdict (cpu-16bit prints
     nothing deliberately) and it must not be said about a run that never happened
     - nor about one a Reset has just thrown away. The console's "Click Run to
     simulate…" placeholder is markup, so it is checked against the markup instead
     - the stub never parses it. */
  ok(!/\bPASS\b|\bFAIL\b/.test(p.app.consoleBox.textContent || ''),
     at + 'the console holds check output');
  ok(!p.dom.document.getElementById('exVerdict').textContent,
     at + 'the verdict pill speaks with no run behind it: '
        + JSON.stringify(p.dom.document.getElementById('exVerdict').textContent));
  ok(p.dom.document.getElementById('waveEmpty').style.display !== 'none',
     at + 'the waveform is not showing its empty state');
  /* The Run button offers to Run, not to Re-run. Both labels come from the app rather
     than being written here, so the check cannot drift from the button - and the fresh
     one is asserted to be the MARKUP's, which is what stops a mutant from writing the
     wording in code (where workbench's shorter label would be clobbered). */
  const [fresh, again] = p.app.runLabels();
  ok(fresh !== again, at + 'the two Run labels are identical: ' + JSON.stringify(fresh));
  ok(/\bRun\b/.test(fresh) && /\bRe-run\b/.test(again),
     at + 'the labels are not Run/Re-run: ' + JSON.stringify([fresh, again]));
  ok(p.dom.document.getElementById('runBtn').textContent === fresh,
     at + 'the Run button says ' + JSON.stringify(p.dom.document.getElementById('runBtn').textContent));
  /* And the Scoreboard is hidden until a run decides, since renderModelCard is what
     knows whether the design looks like a CPU at all. Note app.js's own Reset
     REVEALS it (deliberately, for the simulator's sake: it hides on evidence, never
     on the absence of it), so after a Reset this is practice.js having put it back. */
  ok(p.dom.document.getElementById('card-model').style.display === 'none',
     at + 'the Scoreboard is showing');
  ok(!p.dom.window.PRACTICE_API.tabs().includes('tabModel'),
     at + 'a Model tab points at a card that is hidden');
  /* The exercise sheet is deliberately NOT part of this: it is open at load and a
     Reset leaves whatever the reader chose, since re-opening a full-page dialog on
     every Reset would read as the page reloading itself. Asserted at each call site
     instead, which is where the two differ. */
  /* Folded, not hidden: the two panels with nothing to show keep their headers (and
     so their tabs), and the first Run opens them. */
  for (const id of ['card-wave', 'card-hierarchy']) {
    ok(p.dom.document.getElementById(id).classList.contains('collapsed'),
       at + id + ' is not folded');
    ok(p.dom.document.getElementById(id).style.display !== 'none',
       at + id + ' was hidden rather than folded, which would kill its tab');
  }
};

/* Every page, not just the one the interaction checks use. Booting all of them is
   what proves each exercise's data survives a page context and each design runs to
   completion there - a check the engine half cannot make, since it never goes through
   shell.js, app.js or practice.js.

   NOTHING RUNS ON LOAD any more, so this asserts both halves of that: the page comes
   up with no result at all, and then Run is what produces one. The load half is the
   one worth stating - it is the whole request, and a reintroduced auto-run would
   otherwise pass every check here unnoticed.

   And RESET has to put that state back, so the same battery runs again after one. */
check('every page boots with nothing run, then runs to $finish on Run', () => {
  const notes = [];

  for (const e of ALL_SLUGS) {
    let p;
    try { p = boot(e); } catch (err) { throw new Error(e + ': boot failed: ' + err.message); }

    assertPreRunState(p, e, 'load');
    ok(p.dom.window.PRACTICE_API.isSheetOpen(), e + ': the exercise sheet is not open on load');

    /* Save writes this page's own name. In the all-pages loop deliberately: app.js loads
       an example on the way past and loadExample sets currentFileName from its NAME, the
       first entry of EXAMPLES being the D flip-flop, so all twenty pages wrote
       `D_Flip-Flop.v`. `d-flip-flop` was wrong too - its name is `d-flip-flop.v` - but it
       is the trap rather than the exception, since `D_Flip-Flop.v` reads as deliberate on
       that page and it is the one anybody would spot-check. The name is read off the
       anchor Save builds, not from the binding, so it is what a browser would download. */
    (() => {
      let name = null;
      const create = p.dom.document.createElement.bind(p.dom.document);
      p.dom.document.createElement = function (tag) {
        const el = create(tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'download',
            { set(v) { name = v; }, get() { return name; }, configurable: true });
          el.click = () => {};
        }
        return el;
      };
      p.dom.promptLog.length = 0;
      try { p.dom.document.getElementById('editorSaveBtn').click(); }
      finally { p.dom.document.createElement = create; }
      ok(name === e + '.v',
         e + ': Save would write ' + JSON.stringify(name) + ', not ' + JSON.stringify(e + '.v')
           + " - the example app.js loaded on the way past is still naming the learner's file");
      /* And that name is what the prompt OFFERED, which is the other half of the feature:
         the current name is the baseline, not an empty box. */
      ok(p.dom.promptLog.length === 1 && p.dom.promptLog[0] === e + '.v',
         e + ': Save offered ' + JSON.stringify(p.dom.promptLog) + ' as the default');
    })();
    ok(p.dom.document.getElementById('codeInput').value.indexOf('TODO') >= 0,
       e + ': the editor holds no TODO, so it is not showing the starter');

    p.dom.document.getElementById('runBtn').click();
    for (const id of ['card-wave', 'card-hierarchy']) {
      ok(!p.dom.document.getElementById(id).classList.contains('collapsed'),
         e + ': ' + id + ' is still folded after a Run');
    }
    /* And the button now offers to run it AGAIN - which is the page saying that the
       Waveform Viewer's setup survives a re-run and that Reset is what throws it away. */
    ok(p.dom.document.getElementById('runBtn').textContent === p.app.runLabels()[1],
       e + ': the Run button still says '
         + JSON.stringify(p.dom.document.getElementById('runBtn').textContent) + ' after a run');

    const r = p.app.result();
    ok(r, e + ': Run produced no simulation result');
    ok(!r.error, e + ': runtime error: ' + r.error);
    /* Either the testbench reached $finish, or the Scoreboard stopped the run at a
       divergence - which is what a starter the model checks is SUPPOSED to do. What
       is not allowed is silently running out of time. */
    const stoppedByModel = /Stopped by the model check/.test(p.app.consoleBox.textContent || '');
    ok(r.finished || stoppedByModel,
       e + ': stopped at the time cap instead of $finish (t=' + r.time + ')');
    if (stoppedByModel) {
      ok(MODEL_CHECKED.includes(e), e + ': the Scoreboard stopped a run on a page whose '
         + 'checker is its own testbench, which would truncate its output');
    }
    /* The Model tab has to follow the card, in both directions: the run is what
       reveals the card on a CPU page and what keeps it hidden everywhere else. */
    const modelShown = p.dom.document.getElementById('card-model').style.display !== 'none';
    ok(p.dom.window.PRACTICE_API.tabs().includes('tabModel') === modelShown,
       e + ': the Model tab and the Scoreboard card disagree after a run');
    /* The Memory Viewer is opt-in, and BOTH directions matter: a page that wants
       it must have it, and one that does not must not be left with a panel
       reading "No memories declared in this design." */
    const hidden = p.dom.document.getElementById('card-memory').style.display === 'none';
    const wants = !!p.shell.PRACTICE_META.memory;
    ok(hidden === !wants, e + ': the Memory Viewer is ' + (hidden ? 'hidden' : 'shown')
                            + ' but the manifest says memory=' + wants);

    /* Reset puts the whole of that back. Asserted here rather than on the shared page
       because this is where cpu-16bit is booted - the one page where the Scoreboard was
       genuinely VISIBLE before the Reset, so it is the only place the re-hide is doing
       work rather than agreeing with a card that was already hidden. */
    p.dom.document.getElementById('resetBtn').click();
    assertPreRunState(p, e, 'reset');
    /* And Reset is a return to the pre-run state rather than a state of its own, so the
       next Run has to behave like a first Run: the two folded cards open again. A Reset
       that re-folded them without clearing `hasRun` would leave them shut for good. */
    p.dom.document.getElementById('runBtn').click();
    for (const id of ['card-wave', 'card-hierarchy']) {
      ok(!p.dom.document.getElementById(id).classList.contains('collapsed'),
         e + ': ' + id + ' stayed folded on the Run after a Reset');
    }
    ok(p.app.result(), e + ': the Run after a Reset produced no result');

    notes.push(e + '@' + r.time + (wants ? '+mem' : '') + (modelShown ? '+model' : ''));
  }
  return notes.filter(n => /\+mem/.test(n)).length + ' of ' + notes.length
         + ' pages carry the Memory Viewer, '
         + notes.filter(n => /\+model$/.test(n)).length + ' the Scoreboard';
});

if (page) {
  const { dom, shell, app } = page;
  const $ = id => dom.document.getElementById(id);

  /* The other order, and the one this was reported as: Reset as the very FIRST action.
     app.js's Reset drops the result and re-renders the Scoreboard, which with no result
     at all it deliberately REVEALS - so without practice.js putting the pre-run state
     back, pressing Reset on a page that has never simulated anything reveals a card,
     unfolds two empty panels and starts the pill talking. Run cannot mask it here,
     because the shared page has not run yet. */
  check('Reset before any Run leaves the page exactly as it loaded', () => {
    const sheetWas = dom.window.PRACTICE_API.isSheetOpen();
    $('resetBtn').click();
    assertPreRunState(page, SLUG, 'reset with no run');
    ok(dom.window.PRACTICE_API.isSheetOpen() === sheetWas,
       'Reset moved the exercise sheet');
    return 'card-model hidden, both panels folded, pill silent';
  });

  // The interaction checks below are about a page that HAS run, so this is where the
  // shared `page` gets its run - deliberately after the load-state assertions above.
  $('runBtn').click();

  /* The click acknowledgement, asserted at the two moments it is a different thing.
     `dispatch('click')` is the raw press with the hold still pending, which is the only
     way to observe the busy state at all; `click()` presses and lets the page settle,
     which is what the other ~30 sites want and why they needed no edit.

     Worth stating plainly, because the code reads as if it were a progress indicator
     and is not: NOTHING IS PAINTED DURING THE RUN. `runSimulation` blocks the main
     thread, so in a browser the amber and the ⏲ appear once the work is already done
     and are then HELD long enough to be seen - measured, these designs simulate in
     0.3-64ms, so a state cleared when the work ended would flash for well under a
     frame. The hold is the feature; the busy window is not a claim about what the
     engine is doing at that instant. */
  check('a press marks the button busy, and letting it settle puts it back', () => {
    const btn = $('runBtn');
    const settled = btn.textContent;
    ok(!btn.hasAttribute('data-busy'), 'the button is already busy before a press');

    const pending = dom.window.pendingTimers();
    btn.dispatch('click');
    ok(btn.hasAttribute('data-busy'), 'a press did not mark the button busy');
    ok(/^⏲/.test(btn.textContent), 'the busy label carries no ⏲: ' + JSON.stringify(btn.textContent));
    /* The WORDS are untouched - only the leading glyph is swapped - so the Run/Re-run
       state is still readable while it is busy and cannot be lost by the restore. */
    ok(btn.textContent.slice(1) === settled.slice(1),
       'the busy label changed more than the glyph: ' + JSON.stringify([settled, btn.textContent]));
    /* The width is pinned for the duration, because ⏲ is a colour emoji about twice as
       wide as ▶ and the button would visibly resize mid-flash. The stub reports a width
       for every element, so this is a real assertion here rather than a vacuous one -
       it has to be READ during the press, since the pin is released by the hold. */
    ok(/^\d+(\.\d+)?px$/.test(btn.style.minWidth),
       'the button width was not pinned, so the glyph swap resizes it: '
         + JSON.stringify(btn.style.minWidth));
    /* And the HEIGHT, which the width pin did not cover and a screenshot caught: the
       emoji comes from a fallback font whose ascent and descent are taller than the text
       font's, so with `.btn` inheriting a unitless line-height the button GREW several
       pixels on every press. Two independent fixes, and both are asserted, because the
       CSS one only governs fonts the browser lays out normally and an emoji is exactly
       where platforms differ. */
    ok(/^\d+(\.\d+)?px$/.test(btn.style.height),
       'the button height was not pinned, so a taller glyph grows it: '
         + JSON.stringify(btn.style.height));
    ok(dom.window.pendingTimers() > pending, 'nothing is holding the busy state, so it would flash');
    ok(app.result(), 'the press did not run the simulation');

    dom.window.flushTimers();
    ok(!btn.hasAttribute('data-busy'), 'the hold expired without clearing the busy state');
    ok(btn.textContent === settled, 'the label came back as ' + JSON.stringify(btn.textContent));
    ok(!btn.style.minWidth, 'the pinned width was not released: ' + btn.style.minWidth);
    ok(!btn.style.height, 'the pinned height was not released: ' + btn.style.height);
    return 'busy ' + JSON.stringify('⏲' + settled.slice(1)) + ' -> ' + JSON.stringify(settled);
  });

  /* And the state survives the label CHANGING underneath it, which is the case that
     forced one writer: the very first Run relabels Run -> Re-run while the button is
     still busy, so a helper that restored the string it captured would silently undo
     that, and one that wrote the ⏲ itself would be overwritten by the relabel. */
  check('a first Run relabels underneath the busy state without losing either', () => {
    const p = boot(SLUG);
    const btn = p.dom.document.getElementById('runBtn');
    const [fresh, again] = p.app.runLabels();
    ok(btn.textContent === fresh, 'the fresh page is not showing the fresh label');
    btn.dispatch('click');
    ok(btn.hasAttribute('data-busy'), 'not busy during the run');
    ok(btn.textContent === '⏲' + again.slice(1),
       'the busy label is not the Re-run form: ' + JSON.stringify(btn.textContent));
    p.dom.window.flushTimers();
    ok(btn.textContent === again, 'after the hold the button says ' + JSON.stringify(btn.textContent));
    return JSON.stringify(fresh) + ' -> ' + JSON.stringify('⏲' + again.slice(1)) + ' -> ' + JSON.stringify(again);
  });

  /* Reset moved out of the editor toolbar and into the tab strip, behind a confirmation.
     Four claims, and the second is the one that matters most - a destructive control
     whose Cancel does not actually cancel is worse than no confirmation at all. */
  check('Reset sits rightmost in the strip, as a button rather than a tab', () => {
    const btn = dom.window.PRACTICE_API.resetButton();
    ok(btn, 'there is no Reset button in the strip');
    ok($('resetBtn').style.display === 'none',
       'the editor toolbar still shows its own Reset, so there are two');
    /* Hidden, not removed: app.js, practice.js and practice-synth.js all have handlers
       on it and doReset clicks it rather than restating what they do. */
    ok($('resetBtn'), 'the toolbar Reset was removed, taking three handlers with it');
    /* Not a tab, so it is in none of the three mechanisms that collect `.gh-tab` -
       which is what saves it from being an exception in each. */
    ok(!/\bgh-tab\b/.test(btn.className), 'Reset is a .gh-tab, so it joins the lit-tab rotation');
    ok(!dom.window.PRACTICE_API.tabs().includes('exResetBtn'),
       'Reset appears in tabs(), where every entry must point at a visible card');
    const kids = () => [...$('exTabs').children].map(c => c.id);
    ok(kids()[kids().length - 1] === 'exResetBtn',
       'Reset is not last in the strip: ' + kids().join(' '));
    return kids().join(' ');
  });

  check('Cancel leaves an edited design exactly as it was', () => {
    const api = dom.window.PRACTICE_API;
    const edited = $('codeInput').value + '\n// a change worth not losing\n';
    app.setEditorText(edited);
    api.openResetConfirm();
    ok(api.isResetConfirmOpen(), 'the confirmation did not open');
    $('exResetCancel').click();
    ok(!api.isResetConfirmOpen(), 'Cancel did not close the confirmation');
    ok($('codeInput').value === edited, 'Cancel reverted the source anyway');
    ok(app.result(), 'Cancel threw the run away');
    /* Escape and the backdrop are the other two ways out, both of which must also leave
       the edit alone - one working path cannot stand in for another. */
    api.openResetConfirm();
    dom.document.dispatch('keydown', { key: 'Escape' });
    ok(!api.isResetConfirmOpen(), 'Escape did not close the confirmation');
    api.openResetConfirm();
    const back = $('exResetBackdrop');
    /* A click INSIDE the panel bubbles to the backdrop, and treating that as a dismissal
       is the bug the exercise sheet already avoids - so the negative case is asserted
       first, or a handler ignoring ev.target passes the positive one just as well. */
    back.dispatch('click', { target: $('exResetCancel').parentElement });
    ok(api.isResetConfirmOpen(), 'a click inside the dialog dismissed it');
    back.dispatch('click', { target: back });
    ok(!api.isResetConfirmOpen(), 'a backdrop click did not close the confirmation');
    ok($('codeInput').value === edited, 'a dismissal reverted the source');
    return 'three dismissals, the edit intact';
  });

  check('confirming puts the clean exercise back', () => {
    const api = dom.window.PRACTICE_API;
    const starter = $('codeInput').value;
    ok(/a change worth not losing/.test(starter), 'the previous check left no edit to discard');
    api.closeSheet();
    /* Move the run length off its seeded value first, or "it was re-seeded" is satisfied
       by a reset that never touched the field - which is how that mutant survived. */
    const seeded = String(shell.PRACTICE_EX.maxTime || 2000);
    $('maxTimeInput').value = '37';
    ok($('maxTimeInput').value !== seeded, 'the run length was already off its seed');
    api.openResetConfirm();
    $('exResetConfirm').click();

    ok(!api.isResetConfirmOpen(), 'the confirmation stayed up');
    // 1. the source, which is the whole request - a Reset never did this before.
    ok(!/a change worth not losing/.test($('codeInput').value), 'the edit survived the reset');
    ok($('codeInput').value.indexOf('TODO') >= 0, 'the editor does not hold the starter again');
    // 2. everything the pre-run state means, asserted by the SAME function the load and
    //    Reset checks use - so "like first open" is one definition, not three.
    assertPreRunState(page, SLUG, 'after the strip Reset');
    // 3. the sheet, and the run length.
    ok(api.isSheetOpen(), 'the exercise sheet did not come back');
    ok($('maxTimeInput').value === seeded,
       'the run length was not re-seeded: ' + $('maxTimeInput').value + ' not ' + seeded);
    return 'source, page state, sheet and run length restored';
  });

  /* A page IS an exercise, so Import File would replace the problem the sheet describes
     with something the checker was never written against. The button lives in the shared
     markup, so practice hides it - and the toolbar with it, or an empty band is left
     above the editor where the button used to be. */
  check('Import File and its empty toolbar are gone from a practice page', () => {
    const btn = $('openBtn');
    ok(btn, 'the shared markup no longer ships an Import File button to hide');
    ok(btn.style.display === 'none', 'Import File is still visible on a practice page');
    const bar = btn.parentElement;
    ok(bar.style.display === 'none',
       'the toolbar is still shown with nothing visible in it (display=' + bar.style.display + ')');
    // Save is deliberately kept: taking work out is still worth having
    const save = $('editorSaveBtn');
    ok(!save || save.style.display !== 'none', 'Save was hidden too - only Import should go');
    return 'button hidden, toolbar hidden, Save kept';
  });

  /* Save asks, and what comes back decides what happens. Three answers, three outcomes,
     and the middle one is the one worth having a test for: a Cancel must write NOTHING
     rather than falling back to the default, because a reader who cancels has said they
     do not want this file - and the same `null` is what a browser returns once someone
     ticks "prevent additional dialogs", so the safe direction is the one that writes
     nothing. An empty answer is different: that is a reader who pressed OK on a box they
     had cleared, and writing `.v` with no stem would be absurd, so the default stands. */
  check('Save asks for the name: a rename sticks, Cancel writes nothing', () => {
    const dom = page.dom;
    let wrote = null;
    const create = dom.document.createElement.bind(dom.document);
    dom.document.createElement = function (tag) {
      const el = create(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'download',
          { set(v) { wrote = v; }, get() { return wrote; }, configurable: true });
        el.click = () => {};
      }
      return el;
    };
    const save = () => { wrote = null; dom.promptLog.length = 0; $('editorSaveBtn').click(); };
    try {
      // a rename is honoured...
      dom.promptAnswers.push('my_core.v');
      save();
      ok(wrote === 'my_core.v', 'a renamed save wrote ' + JSON.stringify(wrote));

      // ...and STICKS: the next Save offers it, with no answer queued
      save();
      ok(dom.promptLog[0] === 'my_core.v',
         'the rename did not stick - the next Save offered ' + JSON.stringify(dom.promptLog[0]));
      ok(wrote === 'my_core.v', 'the second save wrote ' + JSON.stringify(wrote));

      // Cancel writes nothing at all, and leaves the name alone
      dom.promptAnswers.push(null);
      save();
      ok(wrote === null, 'Cancel still wrote ' + JSON.stringify(wrote));
      save();
      ok(dom.promptLog[0] === 'my_core.v',
         'Cancel changed the remembered name to ' + JSON.stringify(dom.promptLog[0]));

      // an empty or blank answer keeps the default rather than writing a nameless file
      dom.promptAnswers.push('   ');
      save();
      ok(wrote === 'my_core.v', 'a blank answer wrote ' + JSON.stringify(wrote));
      return 'rename honoured and remembered, Cancel wrote nothing, blank kept the default';
    } finally {
      dom.promptAnswers.length = 0;
      dom.promptAnswers.push(SLUG + '.v');   // put the page's own name back
      $('editorSaveBtn').click();
      dom.document.createElement = create;
    }
  });

  check('the two editors hold the exercise skeleton, not the first EXAMPLE', () => {
    /* The reset above left the page unrun, and every check below this point expects a
       page that HAS run - so it is put back here rather than each of them coping. */
    $('runBtn').click();
    const design = $('codeInput').value, tb = $('tbInput').value;
    // practice.js seeds the starter verbatim, leading newline and all, so the
    // comparison has to accept either form - exactly as this check did before.
    const raw = shell.PRACTICE_EX.starter, starter = raw.replace(/^\n/, '');
    /* The starter is one document shown as two views, so what has to hold is that the
       views RECOMPOSE to it - asserting the design editor equals the starter is what this
       check used to do, and it would now pass only if the split had silently not happened.
       app.fullSource() is the app's own composition, so this pins the halves and the
       thing Run compiles to the same string. */
    ok(app.fullSource() === starter || app.fullSource() === raw,
       'the two editors do not recompose to the starter');
    ok(design && tb, 'a half is empty: design ' + design.length + ' chars, tb ' + tb.length);
    ok(!/module\s+tb\b/.test(design), 'the testbench is still in the design editor');
    ok(/module\s+tb\b/.test(tb), 'the testbench editor does not hold module tb');
    /* The marker belongs to NEITHER view - it is the boundary. Asserting that is what
       stops it from being swallowed into a half, which would put a stray comment at the
       top of the testbench editor and, worse, duplicate it on every save/reload cycle. */
    const MARK_G = TB_MARKER_RE;
    ok(!MARK_G.test(design), 'the marker line is inside the design editor');
    ok(!MARK_G.test(tb), 'the marker line is inside the testbench editor');
    ok(MARK_G.test(app.fullSource()), 'the marker is not in the document at all');
    /* And the design view really is a PROPER prefix: the whole-document view is what
       this replaced, and it looks correct on screen right up to the first merge. */
    ok(design.length < app.fullSource().length, 'the design editor holds the whole document');
    ok(design !== app.EXAMPLES[Object.keys(app.EXAMPLES)[0]], 'app.js\'s loaded example survived');
    return design.split('\n').length + ' design lines, ' + tb.split('\n').length + ' testbench lines';
  });

  /* The MERGE, which the check above cannot see: it only proves the document was
     split at load. An edit in either half has to come back through
     spliceEditorChangesBack into one document, in the right order and at the right
     offset - and the offsets are the interesting part, because editing the design
     shifts everything after it. Four mutants of the seam survive without this:
     showing the whole document in the design view, dropping the testbench half from
     the merge, not shifting the testbench span after a design edit, and swallowing
     the marker line into the testbench half. */
  check('an edit in either half merges back into one document', () => {
    const design0 = $('codeInput').value, tb0 = $('tbInput').value;
    const doc0 = app.fullSource();

    // 1. edit the TESTBENCH half only
    $('tbInput').value = tb0 + '\n// tb-edit\n';
    $('tbInput').dispatch('blur');
    let doc = app.fullSource();
    ok(doc.indexOf('// tb-edit') >= 0, 'the testbench edit did not reach the document');
    const MARK = TB_MARKER_RE;
    ok(doc.indexOf('// tb-edit') > MARK.exec(doc).index,
       'the testbench edit landed ABOVE the marker');
    ok(doc.slice(0, MARK.exec(doc).index) === design0,
       'the testbench edit disturbed the design half');

    // 2. edit the DESIGN half, which shifts every offset after it
    $('codeInput').value = '// design-edit\n' + design0;
    $('codeInput').dispatch('blur');
    doc = app.fullSource();
    ok(doc.indexOf('// design-edit') === 0, 'the design edit is not at the top');
    ok(doc.indexOf('// tb-edit') >= 0, 'the design edit dropped the testbench half');
    ok((doc.match(/\/\/ tb-edit/g) || []).length === 1, 'the testbench half was duplicated');
    ok((doc.match(TB_MARKER_G) || []).length === 1,
       'the marker was duplicated or lost');

    // 3. and what Run compiles is that document, not a stale copy
    $('runBtn').click();
    ok(app.fullSource() === doc, 'Run changed the document');
    const r = app.result();
    ok(r && !r.error, 'the merged document no longer runs: ' + (r && r.error));

    // put it back, so later checks see the page they expect
    $('codeInput').value = design0; $('codeInput').dispatch('blur');
    $('tbInput').value = tb0; $('tbInput').dispatch('blur');
    ok(app.fullSource() === doc0, 'the page did not return to its starting document');
    $('runBtn').click();

    /* Returning to (all) from a single-module view must show the DESIGN, not the whole
       document. That path is separate from the one the page loads through, so a seam
       that splits at load and un-splits here looks perfectly correct until you use the
       module browser - at which point the testbench appears in the design editor and
       the next merge writes it into the document twice. */
    const names = app.moduleNames ? app.moduleNames() : null;
    const pick = (names || []).filter(n => n !== '(all)')[0];
    if (pick) {
      app.selectEditorModule(pick);
      ok($('codeInput').value.indexOf('module ' + pick) >= 0, 'the module view did not open ' + pick);
      app.selectEditorModule('(all)');
      ok(!/module\s+tb\b/.test($('codeInput').value),
         'returning to (all) put the testbench back in the design editor');
      ok($('codeInput').value === design0, '(all) does not show the design half');
      ok(app.fullSource() === doc0, 'the round trip through a module view changed the document');
    }
    return 'testbench edit, design edit, module round trip' + (pick ? ' via ' + pick : '');
  });

  /* The two accessors every OTHER script on the page reaches the document through -
     cloud-sync.js saves and restores with them. They are function declarations for
     one reason: a function declaration becomes a property of `window` and a
     top-level `let` does not, so `window.editorFullSource` is undefined in a browser
     however right it reads. cloud-sync did exactly that, silently fell back to
     codeInput.value, and so saved only the design half of every file once the split
     landed. That is invisible to a stub that models the editor as a bare textarea,
     which is why the claim is asserted HERE, against the real app. */
  check('the document accessors merge, split, and are reachable as functions', () => {
    const doc0 = app.currentFullSource();
    ok(/module\s+tb\b/.test(doc0), 'currentFullSource() did not return the whole document');

    // it must MERGE: an edit that has not blurred yet still has to be in the answer
    $('codeInput').value = '// unblurred\n' + $('codeInput').value;
    ok(app.currentFullSource().indexOf('// unblurred') >= 0,
       'currentFullSource() does not merge the visible edit - a save would store stale work');

    // and loadFullSource must SPLIT, not just fill the design editor
    app.loadFullSource(doc0);
    ok($('codeInput').value.indexOf('// unblurred') < 0, 'loadFullSource did not replace the design');
    ok(!/module\s+tb\b/.test($('codeInput').value), 'loadFullSource put the testbench in the design editor');
    ok(/module\s+tb\b/.test($('tbInput').value), 'loadFullSource left the testbench editor empty');
    ok(app.currentFullSource() === doc0, 'the document did not round-trip through loadFullSource');
    $('runBtn').click();
    return 'currentFullSource merges, loadFullSource splits, round trip exact';
  });

  /* What `Re-run Simulation` is promising: the view you set up survives. Asserted on the
     window because it is the one part of the Waveform Viewer's state that a re-run used
     to discard (the signal selection, the radix map and the hierarchy's expansion were
     already kept, since Run only rebuilds those when the top module NAME changes).
     The shorter-run case is the one that needs the clamp: a window that now begins past
     the end of the run would leave the plot empty, so it is shifted back inside with its
     span intact - and a fresh design must NOT inherit any of it. */
  check('a re-run keeps the waveform window; a new design and Reset do not', () => {
    const capWas = $('maxTimeInput').value;
    try {
      const r0 = app.result();
      const T = r0 && r0.time;
      const SPAN = 4, CAP = 10;                 // CAP is runSimulation's own floor
      ok(T > CAP + SPAN, 'this page\'s run is too short to zoom into (t=' + T + ')');

      const [s0, e0] = app.view();
      ok(s0 === 0 && e0 === Math.max(T, 1),
         'the first run did not open on the whole run: ' + JSON.stringify([s0, e0]));

      /* Zoom into the END of the run - deliberately, because that is the part a shorter
         re-run stops containing, which is what makes the clamp below testable. */
      app.setView(T - SPAN, T);
      $('runBtn').click();
      const [s1, e1] = app.view();
      ok(s1 === T - SPAN && e1 === T,
         'the re-run discarded the window: ' + JSON.stringify([s1, e1]) + ' not ' + JSON.stringify([T - SPAN, T]));
      ok(app.result().time === T, 're-running changed the run itself');

      /* Now make the run end BEFORE that window begins. The run length is a machine
         property rather than a codegen input, so lowering it re-runs the same design
         shorter - the case the clamp exists for. */
      $('maxTimeInput').value = String(CAP);
      $('runBtn').click();
      const short = app.result();
      const [s2, e2] = app.view();
      ok(short.time <= CAP && short.time < T - SPAN,
         'the cap did not shorten the run past the window (t=' + short.time + ')');
      ok(e2 - s2 === SPAN, 'the clamp shrank the span instead of shifting it: ' + (e2 - s2));
      ok(s2 >= 0 && e2 <= Math.max(short.time, 1),
         'the window was left outside the run: ' + JSON.stringify([s2, e2]) + ' of ' + short.time);
      ok(app.cursor() >= s2 && app.cursor() <= e2,
         'the cursor was left outside the window: ' + app.cursor());

      // Reset drops it, so the next run opens on the whole thing again.
      $('maxTimeInput').value = capWas;
      $('resetBtn').click();
      $('runBtn').click();
      const r3 = app.result();
      const [s3, e3] = app.view();
      ok(s3 === 0 && e3 === Math.max(r3.time, 1),
         'the run after a Reset inherited a window: ' + JSON.stringify([s3, e3]));
      return 'kept [' + (T - SPAN) + ',' + T + '], clamped to ' + JSON.stringify([s2, e2])
             + ' at t=' + short.time + ', dropped by Reset';
    } finally {
      /* Whatever happened above, the page goes back to the state the checks after this
         one expect. Without this a failure here reports as four failures, three of them
         in checks that are perfectly fine - which is how a suite stops localising
         anything. */
      $('maxTimeInput').value = capWas;
      $('resetBtn').click();
      $('runBtn').click();
    }
  });

  check('Run ran the design to $finish, with its memory images attached', () => {
    const r = app.result();
    ok(r, 'no simulation result');
    ok(!r.error, 'runtime error: ' + r.error);
    /* Reaching $finish is what proves the run length was not left at whatever
       loadExample's tryApplyAutoFinishTime wrote into the field for the simulator's own
       first example - a truncated run still produces a plausible-looking console, just
       with the later checks missing. The exception is a page the Scoreboard checks:
       there a divergence stops the run on purpose. */
    const stoppedByModel = /Stopped by the model check/.test(app.consoleBox.textContent || '');
    ok(r.finished || (stoppedByModel && MODEL_CHECKED.includes(SLUG)),
       'the run stopped at the time cap instead of reaching $finish (t=' + r.time + ')');
    for (const name of Object.keys(shell.PRACTICE_EX.memFiles || {})) {
      ok(app.attachedMemFiles[name], name + ' was never attached');
    }
    return 't=' + r.time + ', ' + Object.keys(shell.PRACTICE_EX.memFiles || {}).length + ' image(s)';
  });

  /* ---- the canvas is drawn at its container's width, at every width ----
     `canvas { width: 100% !important }` in the shared block beats the inline style the
     renderer sets, so a backing store wider than the container is not scrolled - it is
     STRETCHED over it. Every glyph is then horizontally compressed (which reads as a
     condensed font rather than as a bug) and `waveLayout` describes a coordinate space
     the click handlers do not measure, so a tap lands at the wrong time by exactly that
     ratio. drawWaveform used to floor cssWidth at 600px, which made this permanent on
     any container narrower than that - i.e. every phone. Asserted at a narrow container
     AND a wide one, because the old code was correct at 900 and that is the only width
     any other check here uses. */
  check('the waveform canvas is never wider than its container', () => {
    const scroll = $('waveScroll'), canvas = $('waveCanvas');
    const was = scroll.clientWidth;
    try {
      for (const w of [288, 900]) {
        scroll.clientWidth = w;
        $('runBtn').click();
        const drawn = parseInt(canvas.style.width, 10);
        ok(drawn === w,
           'at a ' + w + 'px container the canvas was drawn ' + drawn + 'px wide, so the '
           + 'drawing is stretched by ' + (drawn / w).toFixed(2) + 'x');
        /* And the layout the handlers read describes that same box: plotX0 + plotW is
           the plot's right edge, 10px short of the canvas (see drawWaveform). */
        const L = app.layout();
        ok(L && Math.abs(L.plotX0 + L.plotW + 10 - w) < 0.5,
           'waveLayout spans ' + (L ? L.plotX0 + L.plotW + 10 : '?') + 'px of a ' + w
           + 'px canvas, so every cursor click maps to the wrong time');
      }
      return 'drawn 1:1 at 288px and 900px, layout agrees with the box';
    } finally {
      scroll.clientWidth = was;
      $('runBtn').click();
    }
  });

  /* Turning the plot off is a MEMORY control, so what it has to be checked on is the
     allocation, not the appearance. `display: none` leaves a canvas's bitmap alive - the
     element keeps its width/height attributes - so an implementation that only hid it
     would look identical on screen and free nothing, which is the whole feature failing
     silently. Hence the assertion is on the attributes.

     And it must not cost the run: history is the engine's, pushed by writeLValue, and the
     Scoreboard's sampler reads it - so the console output and the result have to survive
     with the plot off, or "save memory" quietly means "lose your verdict". */
  check('the plot can be turned off, which frees the canvas and keeps the run', () => {
    const canvas = $('waveCanvas'), box = $('waveOffCheckbox');
    ok(box, 'no waveOffCheckbox in the markup');
    $('runBtn').click();
    ok(!app.waveOff(), 'the plot is off by default - it must default to ON');
    const wasW = canvas.width, wasH = canvas.height;
    ok(wasW > 0 && wasH > 0, 'the canvas has no backing store with the plot on: '
       + wasW + 'x' + wasH);
    const logWas = app.consoleBox.textContent || '';
    const hadResult = !!app.result();

    box.checked = true;
    box.dispatch('change');
    ok(app.waveOff(), 'ticking the box did not set waveOff');
    ok(canvas.width === 0 && canvas.height === 0,
       'the canvas backing store survived at ' + canvas.width + 'x' + canvas.height
       + ' - display:none does not free a canvas, the attributes have to be zeroed');
    ok(app.layout() === null, 'waveLayout survived, so the pointer handlers still map clicks');
    ok($('waveControls').style.display === 'none', 'the zoom/range controls are still shown');
    /* the run is untouched: same result object, same console */
    ok(!!app.result() === hadResult, 'the result was dropped with the plot');
    ok((app.consoleBox.textContent || '') === logWas, 'the console output changed');

    box.checked = false;
    box.dispatch('change');
    ok(!app.waveOff(), 'unticking did not clear waveOff');
    ok(canvas.width > 0 && canvas.height > 0,
       'the canvas was not re-sized after unticking: ' + canvas.width + 'x' + canvas.height);
    ok(app.layout() !== null, 'waveLayout was not rebuilt, so the plot is dead to clicks');
    ok($('waveControls').style.display !== 'none', 'the controls did not come back');
    return 'freed ' + wasW + 'x' + wasH + ', run kept, restored on untick';
  });

  /* The note must cost the DEFAULT state nothing, and that is a claim about DOM
     OPERATIONS rather than about milliseconds - which is the only form a stub DOM can
     check, and the form that matters: `clientWidth` is a forced synchronous layout in a
     browser if the DOM was written since the last one, and free if it was not. So the
     assertion is one read per draw, with the note's write AFTER it.

     This exists because the first version of the feature failed exactly here and nothing
     noticed: it read clientWidth itself and ran at the top of drawWaveform, giving
     WRITE,READ,...,READ - two reflows per draw instead of one, in the state everybody is
     in whether or not they ever tick the box. Twenty checks and three mutants passed over
     it, because a stub has no layout engine and the reads are plain property gets. Counting
     them is what turns that into something falsifiable. */
  check('the memory note costs the default state no extra layout read', () => {
    const scroll = $('waveScroll'), note = $('waveMemNote');
    ok(note, 'no waveMemNote in the markup');
    const log = [];
    const wasW = Object.getOwnPropertyDescriptor(scroll, 'clientWidth');
    let v = note.textContent;
    Object.defineProperty(scroll, 'clientWidth',
      { get() { log.push('READ'); return 900; }, configurable: true });
    Object.defineProperty(note, 'textContent',
      { get() { return v; }, set(x) { log.push('WRITE'); v = x; }, configurable: true });
    try {
      $('runBtn').click();           // warm, so the count is of a settled draw
      log.length = 0;
      $('runBtn').click();
      const reads = log.filter(x => x === 'READ').length;
      ok(reads === 1, 'a draw took ' + reads + ' clientWidth reads, not 1 - the note is '
         + 'measuring geometry of its own again (order: ' + log.join(',') + ')');
      /* NO write may precede the read. lastIndexOf was the first form of this and it was
         wrong in the way that matters: with WRITE,READ,WRITE a later write satisfied it
         while an earlier one had already dirtied the layout the read then had to compute.
         The mutant that writes the note just above the width read survived it. */
      const firstRead = log.indexOf('READ'), firstWrite = log.indexOf('WRITE');
      ok(firstRead >= 0 && (firstWrite === -1 || firstWrite > firstRead),
         'the note is written BEFORE the width is read (' + log.join(',') + '), so that read '
         + 'forces a synchronous layout');
      ok(/MB of canvas/.test(v), 'the note says nothing useful: ' + JSON.stringify(v));
      return log.join(',') + ', note ' + JSON.stringify(v);
    } finally {
      delete note.textContent;
      if (wasW) Object.defineProperty(scroll, 'clientWidth', wasW);
      else { delete scroll.clientWidth; scroll.clientWidth = 900; }
      $('runBtn').click();
    }
  });

  /* Persisted in BOTH directions. The default is off, so `=== '1'` is the correct read -
     but a stored '1' has to survive a reload, which is the half the Scoreboard's checkbox
     got wrong in the other direction. Asserted against a fresh boot rather than the live
     page, since that is where a load-time misread shows. */
  check('the plot-off choice survives a reload, and is not forced either way', () => {
    const on = makeDom();
    on.localStorage.setItem('waveOff', '1');
    const p1 = boot(SLUG, on);
    ok(p1.app.waveOff(), 'a stored waveOff=1 was not honoured on load');
    ok(p1.dom.document.getElementById('waveCanvas').width === 0,
       'the canvas was allocated at load despite the stored choice');
    ok(p1.dom.document.getElementById('waveControls').style.display === 'none',
       'the controls were shown at load despite the stored choice');
    const off = makeDom();
    off.localStorage.setItem('waveOff', '0');
    const p0 = boot(SLUG, off);
    ok(!p0.app.waveOff(), 'a stored waveOff=0 came back on, so the read is one-way');
    return 'honoured in both directions'
  });

  /* The marker is matched ANYWHERE on a line, not only alone on one, and the same one
     definition governs the two editors here and the truncation in synthesis.html. Both
     halves are asserted, because the interesting failure is not "neither works" but "one
     works" - a document that cuts in the synthesizer and does not split here would put
     the whole file in the design editor while the netlist described only part of it. */
  check('a marker embedded in a line splits the document, and round-trips exactly', () => {
    const design = 'module d(input a, output y);\nassign y = a;\nendmodule';
    const tb = 'module tb;\ninitial begin #5 $finish; end\nendmodule\n';
    const doc = design + '// ======== TESTBENCH ========' + tb;
    const before = doc;
    app.loadFullSource(doc);
    /* The design keeps what precedes the marker on that line - `endmodule` cannot be
       dragged out of it - and the rest of that line is inside the comment, so it stays in
       the BOUNDARY rather than being un-commented into the testbench view. */
    ok(app.codeInput.value === design,
       'the design half is not the text before the marker: ' + JSON.stringify(app.codeInput.value));
    ok(!/TESTBENCH/.test(app.codeInput.value), 'the marker leaked into the design editor');
    ok(!/TESTBENCH/.test($('tbInput').value), 'the marker leaked into the testbench editor');
    ok(app.currentFullSource() === before,
       'the round trip is not byte-exact: ' + JSON.stringify(app.currentFullSource()));
    /* And an INDENTED own-line marker puts its indentation in the boundary too, which is
       byte-for-byte where the line-anchored rule this replaced split. That is the walk-back's
       whole job, and no file in the repo has an indented marker - so without this assertion
       deleting it is invisible, and the "identical for every document that exists today"
       claim would rest on nothing. */
    const indented = design + '\n    // ==== TESTBENCH ====\n' + tb;
    app.loadFullSource(indented);
    ok(app.codeInput.value === design + '\n',
       'an indented marker left its indent in the design half: '
       + JSON.stringify(app.codeInput.value.slice(-12)));
    ok(app.currentFullSource() === indented, 'the indented round trip is not byte-exact');
    return 'design kept `endmodule`, marker (and its indent) stayed in the boundary, round trip exact';
  });

  check('an embedded marker truncates in the synthesizer too, and prose does not', () => {
    const design = 'module d(input a, output y);\nassign y = a;\nendmodule';
    const tb = 'module tb;\ninitial begin #5 $finish; end\nendmodule\n';
    const SYNTH = dom.window.SYNTH;
    if (!SYNTH) throw new Error('this page carries no synthesizer to ask');
    // embedded: cuts, and says which marker did it
    const all = SYNTH.synthesizeAll(design + '// ======== TESTBENCH ========' + tb);
    ok(all.top.name === 'd', 'the top module is not the design: ' + all.top.name);
    const said = all.log.map(l => l.msg).join(' | ');
    ok(/TESTBENCH marker/.test(said), 'the log does not name the TESTBENCH marker: ' + said);
    ok(!/Skip Synthesis/.test(said), 'a TESTBENCH cut reported itself as a Skip Synthesis comment');
    // prose naming the word must NOT truncate - that is what the `=` decoration buys
    let prose = null;
    try { SYNTH.synthesizeAll(design + '\n// checked by the testbench below\n' + tb); }
    catch (e) { prose = e.message; }
    ok(prose && /unexpected character '#'/.test(prose),
       'a comment merely mentioning the testbench truncated the file: ' + prose);
    return 'cut named the marker; prose left the file alone';
  });

  check('the verdict pill counts the FAILs the starter printed', () => {
    const pill = $('exVerdict');
    ok(pill, 'no verdict pill');
    const text = app.consoleBox.textContent || '';
    const fails = (text.match(/\bFAIL\b/g) || []).length;
    /* On a Scoreboard-checked page the testbench prints nothing, so the pill has
       nothing to count and says so - and the CARD carries the verdict instead. That
       is the whole arrangement, so it is asserted rather than skipped. */
    if (MODEL_CHECKED.includes(SLUG)) {
      ok(fails === 0, 'this page is meant to have no $display checks, but printed ' + fails + ' FAILs');
      ok(pill.textContent === 'no checks reported', 'pill says ' + JSON.stringify(pill.textContent));
      ok(/Mismatch at t=/.test($('modelVerdict').innerHTML),
         'the Scoreboard does not report the starter\'s divergence: '
         + $('modelVerdict').innerHTML.slice(0, 80));
      return 'pill quiet, Scoreboard carries the verdict';
    }
    ok(fails > 0, 'the starter printed no FAIL lines, so this proves nothing');
    ok(/fail/.test(pill.className), 'pill is not red: ' + pill.className);
    ok(pill.textContent.startsWith(fails + ' of '), 'pill says ' + JSON.stringify(pill.textContent));
    /* Cross-check against the same starter run through the engine on its own: the
       page and the harness must agree about how many checks fail, which is what
       catches a page that quietly simulates something other than what it shows. */
    const sim = require(TOOLS + '/simrun.js');
    const solo = sim.run(shell.PRACTICE_EX.starter, { memFiles: shell.PRACTICE_EX.memFiles || {} });
    const soloFails = ((solo.text || '').match(/\bFAIL\b/g) || []).length;
    ok(soloFails === fails, 'the page reports ' + fails + ' failing checks where the engine reports ' + soloFails);
    return pill.textContent + ' (engine agrees)';
  });

  check('the exercise sheet is open on load, with the description in it', () => {
    ok(dom.window.PRACTICE_API.isSheetOpen(), 'the sheet is not open');
    ok(/ex-sheet-open/.test(dom.document.body.className), 'body scroll was not locked');
    ok($('exSheetBody').innerHTML === shell.PRACTICE_EX.descriptionHtml,
       'the sheet does not carry the exercise description');
    return $('exSheetTitle').textContent;
  });

  /* All four ways out, each from a re-opened sheet, so one working path cannot
     stand in for another. */
  const api = () => dom.window.PRACTICE_API;
  check('Get Started! dismisses it', () => {
    api().openSheet(); $('exStartBtn').click();
    ok(!api().isSheetOpen(), 'still open');
    ok(!/ex-sheet-open/.test(dom.document.body.className), 'body scroll still locked');
  });
  check('the close button dismisses it', () => {
    api().openSheet(); $('exCloseBtn').click();
    ok(!api().isSheetOpen(), 'still open');
  });
  check('Escape dismisses it', () => {
    api().openSheet();
    dom.document.dispatch('keydown', { key: 'Escape' });
    ok(!api().isSheetOpen(), 'still open');
  });
  check('a click on the backdrop dismisses it, one on the sheet does not', () => {
    api().openSheet();
    $('exBackdrop').dispatch('click', { target: $('exSheet') });
    ok(api().isSheetOpen(), 'a click on the sheet itself dismissed it');
    $('exBackdrop').dispatch('click', { target: $('exBackdrop') });
    ok(!api().isSheetOpen(), 'a click on the backdrop did not dismiss it');
  });
  check('the Exercise button brings it back', () => {
    $('exReopenBtn').click();
    ok(api().isSheetOpen(), 'the sheet did not re-open');
  });

  check('the page is retitled and the example picker is hidden', () => {
    const h1 = dom.document.querySelector('h1');
    /* The breadcrumb IS the h1 now, the way a repo page's owner/name is: the slug is
       the last segment and the human title moved to the line below it. */
    ok(/gh-crumb/.test(h1.className), 'the h1 is not the breadcrumb: ' + h1.className);
    ok(h1.innerHTML.includes(shell.PRACTICE_META.slug), 'the breadcrumb does not name the slug');
    ok(/href="index\.html"/.test(h1.innerHTML), 'the breadcrumb does not link back to the hub');
    const sub = dom.document.querySelector('.gh-sub');
    ok(sub && sub.textContent.includes(shell.PRACTICE_META.title),
       'the sub-line does not carry the exercise title');
    ok($('exampleSelect').style.display === 'none', 'the example picker is still visible');
    return h1.textContent.replace(/\s+/g, ' ').trim();
  });

  /* ---- the navigation drawer, which replaced the bar's four links ----
     Every dismissal is exercised on its own, because one working path standing in for
     another is exactly how the exercise sheet's Escape handler could have gone missing
     unnoticed; and the backdrop's NEGATIVE case is asserted first, since a handler
     that ignores ev.target passes the positive one just as well. */
  check('the menu button opens a drawer, and three things close it', () => {
    const btn = $('navMenuBtn'), drawer = $('navDrawer'), back = $('navBackdrop');
    ok(btn && drawer && back, 'the drawer was never built');
    /* Placement, which the stub can only check because the harness stands up a real
       .gh-header-inner: the button is the bar's first child, before the logo. */
    const inner = dom.document.querySelector('.gh-header-inner');
    ok(inner && inner.children[0] === btn,
       'the menu button is not the first thing in the header bar');
    ok(btn.getAttribute('aria-controls') === 'navDrawer', 'the button controls nothing');

    const isOpen = () => drawer.classList.contains('open')
                      && back.classList.contains('open')
                      && dom.document.body.classList.contains('nav-open')
                      && btn.getAttribute('aria-expanded') === 'true';
    const isShut = () => !drawer.classList.contains('open')
                      && !back.classList.contains('open')
                      && !dom.document.body.classList.contains('nav-open')
                      && btn.getAttribute('aria-expanded') === 'false';
    ok(isShut(), 'the drawer is open at load');

    btn.click();
    ok(isOpen(), 'the button did not open the drawer');
    btn.click();
    ok(isShut(), 'the button does not close it again');

    btn.click();
    $('navCloseBtn').click();
    ok(isShut(), 'the close button does not dismiss it');

    btn.click();
    /* A bubbled click, the way the exercise sheet's own check does it: the stub does
       not bubble, so the event is dispatched ON the backdrop carrying the panel as its
       target - which is exactly what a real click inside the drawer delivers, since the
       panel is a child of the backdrop. Asserted BEFORE the positive case, or a handler
       that ignores ev.target passes just as well. */
    back.dispatch('click', { target: drawer });
    ok(isOpen(), 'a click inside the drawer closed it');
    back.dispatch('click', { target: back });
    ok(isShut(), 'a click on the backdrop does not dismiss it');

    btn.click();
    dom.document.dispatch('keydown', { key: 'Escape' });
    ok(isShut(), 'Escape does not dismiss it');
    return 'button, ✕, backdrop and Escape, with the panel click ignored';
  });

  check('the drawer lists real destinations, one of them marked current', () => {
    const rows = [...$('navDrawerList').children];
    ok(rows.length >= 4, 'only ' + rows.length + ' rows in the drawer');
    /* Every row resolves to something. A row pointing at a file that is not there is
       the class of bug this repo has shipped before (an example with no <option>), and
       it is invisible until someone taps it. The one off-site row is asserted to BE
       off-site rather than skipped silently. */
    let external = 0;
    for (const r of rows) {
      const href = r.getAttribute('href') || '';
      ok(href, 'a drawer row has no href at all');
      if (/^https?:\/\//.test(href)) { external++; continue; }
      ok(fs.existsSync(path.join(HERE, href)), 'the drawer links to ' + href + ', which does not exist');
      ok(!href.includes('../'),
         href + ' walks out of Baerilog/, which is the deployed root - it would 404');
    }
    ok(external === 1, external + ' off-site rows, expected exactly 1 (Home)');
    const cur = rows.filter(r => r.classList.contains('current'));
    ok(cur.length === 1, cur.length + ' rows marked current');
    ok(cur[0].getAttribute('href') === 'index.html',
       'the current row is ' + cur[0].getAttribute('href') + ', not the hub');
    // Every row carries a glyph, and the head carries the wordmark cloned from the bar.
    for (const r of rows) ok(r.children[0].innerHTML.indexOf('<svg') === 0, 'a row has no icon');
    ok(dom.document.querySelector('.nav-drawer-mark').children.length === 1,
       'the drawer head has no wordmark - the cloneNode of .gh-mark svg failed');
    return rows.length + ' rows, ' + external + ' off-site, current = index.html';
  });

  check('the chrome is there: header bar and a tab strip whose targets all exist', () => {
    ok(dom.document.querySelector('.gh-header'), 'no header bar');
    /* The bar is the simulator's own markup, so the only thing this page changes
       about it is which link is current - and getting that wrong would mark the
       Simulator as the page you are on. */
    // Scoped, not a descendant selector: the stub resolves one simple selector at
    // a time, and `.gh-nav a.here` would quietly match nothing.
    const nav = dom.document.querySelector('.gh-nav');
    ok(nav, 'no nav in the header bar');
    const here = [...nav.querySelectorAll('a')].filter(a => /\bhere\b/.test(a.className));
    ok(here.length === 1, here.length + ' nav links marked current');
    ok(here[0].getAttribute('href') === 'index.html',
       'the current-app marker is on ' + here[0].getAttribute('href') + ', not the hub');
    const ids = api().tabs();
    ok(ids.length >= 4, 'only ' + ids.length + ' tabs');
    ok(ids[0] === 'exReopenBtn', 'the first tab is not the Exercise tab: ' + ids[0]);
    /* A tab pointing at a card that is absent or hidden is a dead control, which is
       the whole reason the strip is built after the run rather than in shell.js. */
    const CARD_OF = { tabDesign: 'card-editor', tabConsole: 'card-console',
                      tabWave: 'card-wave', tabMemory: 'card-memory', tabModel: 'card-model' };
    for (const id of ids) {
      const card = CARD_OF[id];
      if (!card) continue;
      const el = $(card);
      ok(el, id + ' points at ' + card + ', which does not exist');
      ok(el.style.display !== 'none', id + ' points at ' + card + ', which is hidden');
    }
    // Memory is opt-in, so its tab must track the card exactly.
    const wantsMemory = !!shell.PRACTICE_META.memory;
    ok(ids.includes('tabMemory') === wantsMemory,
       'the Memory tab is ' + (ids.includes('tabMemory') ? 'present' : 'absent')
       + ' but memory=' + wantsMemory);
    return ids.join(' ');
  });

  /* The Scoreboard's defaults, which are what make it this page's checker at all:
     the comparison has to be ON without anyone opting in (it used to compute nothing
     until the box was ticked, and a ticked box persisted in localStorage - so it
     worked for whoever had ticked it once and for nobody else), and the eleven-line
     bind listing has to be OFF, since it is diagnostics rather than the verdict. */
  check('the Scoreboard compares by default, with its detail folded away', () => {
    const stop = $('modelStopCheckbox'), detail = $('modelDetailCheckbox');
    ok(stop && stop.checked, 'the model-stop box is not ticked by default');
    ok(detail && !detail.checked, 'Show detail is ticked by default');
    const bind = $('modelBind');
    ok(bind.style.display === 'none', 'the bind listing is showing: ' + bind.style.display);
    ok($('modelVerdict').style.display !== 'none', 'the verdict is hidden - it never should be');
    // and ticking it reveals the listing
    detail.checked = true;
    detail.dispatch('change');
    ok(bind.style.display !== 'none', 'Show detail did not reveal the bind listing');
    ok(/\bpc\b/.test(bind.innerHTML), 'the listing does not name pc: ' + bind.innerHTML.slice(0, 60));
    detail.checked = false;
    detail.dispatch('change');
    ok(bind.style.display === 'none', 'unticking Show detail did not fold it away again');
    return 'stop on, detail off, toggle works';
  });

  /* The (?) popovers. The handler is generic - it toggles the element right after the
     icon - so what is worth asserting is the wiring, not the prose: one popup per
     icon, opening one closes any other, and a click anywhere closes them all. That
     last one is the part most likely to be silently missing. */
  check('every card explains itself in a (?) popover that opens and closes', () => {
    const icons = dom.document.querySelectorAll('.help-icon');
    const pops = dom.document.querySelectorAll('.help-popup');
    ok(icons.length >= 3, 'only ' + icons.length + ' help icons on the page');
    ok(icons.length === pops.length, icons.length + ' icons but ' + pops.length + ' popups');
    const visible = () => dom.document.querySelectorAll('.help-popup').filter(
      p => /\bvisible\b/.test(p.className)).length;
    ok(visible() === 0, 'a popover is open before anything was clicked');
    icons[0].click();
    ok(visible() === 1, 'clicking an icon opened ' + visible() + ' popovers');
    icons[1].click();
    ok(visible() === 1, 'opening a second left ' + visible() + ' open - they should be exclusive');
    dom.document.dispatch('click');
    ok(visible() === 0, 'a click elsewhere left ' + visible() + ' open');
    /* and the injected markup - the simulator's own - kept no paragraph: the
       description IS the popover now, and this reads the slice as a string since the
       stub never turned it into elements */
    ok(!/<p>/.test(dom.document.body.innerHTML || ''), 'a card description survived in the markup');
    return icons.length + ' cards, exclusive open, click-away closes';
  });

  check('the waveform palette comes from the shared tokens', () => {
    /* The app fills PALETTE from style.css's --wave-palette in readTheme(), so a
       trace colour is a token like everything else. If that ever stops working the
       traces silently fall back to the literals in readTheme, which no other check
       here would notice. */
    ok(app.PALETTE.length > 0, 'no palette');
    ok(app.PALETTE.indexOf('#007aff') < 0, 'iOS blue is still in the palette');
    ok(app.PALETTE[0] === '#0969da', 'first trace colour is ' + app.PALETTE[0]);
    return app.PALETTE.slice(0, 3).join(' ');
  });
}

/* ---- the synthesizer cards, on the pages that opt into them ----

   A page with "synthesis": true carries two more cards below the Waveform Viewer,
   fed by synth.js (Baerilog/synthesis.html's engine) and wired by practice-synth.js.
   The check that carries the most weight is the LAST one: the gate-level netlist the
   card displays is fed back through the simulator's own parser and run against the
   exercise's own testbench. Nothing else here implies that - a card that rendered a
   plausible-looking listing of the wrong hardware would pass every other check, and
   that is exactly what shipped in synthesis.html for a synchronous reset. */
if (SYNTH_SLUGS.length) {
  /* Why synth.js is wrapped, asserted statically because no harness can see it: in a
     browser the page's classic scripts share ONE global lexical environment, so two
     top-level `const`s of the same name are a SyntaxError that kills the page before
     anything runs. Here each file gets its own scope, so an unwrapped engine would
     work headlessly and break in every real browser - the one thing worth a check of
     its own. The collision list is DERIVED from the two files, so a name that starts
     or stops colliding is reported rather than assumed. */
  check('synth.js keeps its engine out of the page\'s global scope', () => {
    const appJs = fs.readFileSync(path.join(HERE, 'app.js'), 'utf8');
    const synthJs = fs.readFileSync(path.join(HERE, 'synth.js'), 'utf8');
    const declared = (src) => new Set((src.match(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm) || [])
      .map(s => s.split(/\s+/)[1]));
    const clash = [...declared(synthJs)].filter(n => declared(appJs).has(n)).sort();
    ok(clash.length > 0, 'nothing collides any more - has app.js or the engine been renamed?');
    const open = synthJs.indexOf('window.SYNTH = (function () {');
    ok(open >= 0, 'synth.js does not open with the IIFE that scopes it');
    for (const n of clash) {
      const at = synthJs.search(new RegExp('^(?:const|let|var|function|class)\\s+' + n + '\\b', 'm'));
      ok(at > open, n + ' is declared at top level in synth.js, which would collide with app.js');
    }
    return clash.length + ' names would collide: ' + clash.join(', ');
  });

  /* Why the testbench has to be cut at all, asserted ONCE and on a fixture rather than per
     page: a #delay really does stop the synthesizer dead. Asserting it against a page's own
     design instead was wrong twice over - it fails for the design's OWN reason on the pages
     outside the subset (calculator-8bit dies on an unsized 'hff long before the delay), and
     it makes a claim about the synthesizer read as a claim about that exercise. */
  check('a testbench construct really does stop the synthesizer', () => {
    /* The engine on its own - it is DOM-free, so this needs no page, and a claim about the
       synthesizer is better made against the shipped synth.js than through a page. */
    const win = {};
    new Function('window', fs.readFileSync(path.join(HERE, 'synth.js'), 'utf8'))(win);
    const dut = 'module m (input a, output b);\n  assign b = a;\nendmodule\n';
    let ok1 = null;
    try { win.SYNTH.synthesizeAll(dut); } catch (e) { ok1 = e.message; }
    ok(!ok1, 'the fixture design does not synthesize on its own: ' + ok1);
    let threw = null;
    try {
      win.SYNTH.synthesizeAll(dut + 'module tb;\n  reg x;\n  always #5 x = ~x;\nendmodule\n');
    } catch (e) { threw = e.message; }
    ok(threw && /#/.test(threw), 'a #delay no longer stops it: ' + threw);
    return threw.slice(0, 46);
  });
}

for (const slug of SYNTH_SLUGS) {
  const name = (t) => slug + ': ' + t;
  /* Booted INSIDE a check, unlike the sections above: practice-synth.js runs at page
     load, so a fault in it throws out of boot() - and a driver that dies there reports
     nothing at all, which reads as a suite that does not cover this rather than as a
     page that is broken. (Both of the first two mutants written against this section
     did exactly that.) */
  let p = null, api = null;
  check(name('the page boots with its synthesizer scripts, and they ran'), () => {
    p = boot(slug);
    ok(p.dom.window.SYNTH, 'window.SYNTH is absent - synth.js did not run');
    api = p.dom.window.PRACTICE_SYNTH_API;
    ok(api, 'PRACTICE_SYNTH_API is absent - practice-synth.js did not run');
    return 'SYNTH + PRACTICE_SYNTH_API';
  });
  // Every check below would report the same one fault again, so say it once.
  if (!p || !api) {
    // Reported rather than silently skipped: a suite that quietly drops ten checks
    // reads as a thinner suite passing, which is the failure this repo keeps avoiding.
    results.push(['FAIL', name('its remaining checks could not run'), 'the page did not boot']);
    continue;
  }
  const $ = (id) => p.dom.document.getElementById(id);

  /* Eighteen pages carry the flag and EIGHT of them hold a design the synthesizer
     cannot handle at all - shifts, memory arrays, an unsized literal - which is the
     whole reason the cards are hidden until a synthesis succeeds. So each page gets the
     battery that applies to it rather than a battery that assumes success: what decides
     is whether the STARTER synthesizes (that is what the button does on the page) and,
     separately, whether the SOLUTION does (that is what the round-trip check needs).
     Both are computed here from the real engine, and both are reported, so a page
     silently changing class shows up as a moved detail line rather than as nothing. */
  const synthesizes = (src) => {
    try {
      const all = p.dom.window.SYNTH.synthesizeAll(api.designOnly(src).src);
      /* BOTH stages, because the page needs both: adder-4bit's starter elaborates and
         then fails while the netlist is being built, so asking synthesizeAll alone put
         this harness a stage ahead of the app and it asserted a diagram that a real
         page correctly refuses to draw. */
      p.dom.window.SYNTH.synthesizeModuleView(all, all.top.name);
      return true;
    } catch (e) { return false; }
  };
  const starterOk = synthesizes(p.app.fullSource());
  const solutionOk = synthesizes(fs.readFileSync(path.join(HERE, 'solutions', slug + '.v'), 'utf8'));
  /* Returned as the check's DETAIL, not skipped silently: the row still prints, saying
     which part of the battery does not apply to this page and why. */
  const NA = 'n/a - this design is outside the synthesizer\'s subset';

  check(name('the two cards sit below the Waveform Viewer'), () => {
    /* A claim about ORDER inside .grid rather than about existence: the cards are
       inserted relative to the waveform row, so getting that wrong puts them above
       the editor. */
    const kids = p.dom.document.querySelector('.grid').children;
    const at = (id) => kids.findIndex(k => k.getAttribute('id') === id);
    ok(at('card-netlist') > at('waveSplitRow'), 'the netlist card is not below the waveform');
    ok(at('netlistSplitRow') > at('card-netlist'), 'the viewer is not below the netlist card');
    ok(at('card-memory') < 0 || at('card-memory') > at('netlistSplitRow'),
       'the Memory Viewer ended up between them');
    return 'card-netlist, netlistSplitRow';
  });

  check(name('the two cards are absent on load, and only a clean synthesis reveals them'), () => {
    /* The load half first, because it is the request: a page that synthesized at load
       would satisfy every other check in this section. And the cards are not merely
       empty at load, they are not on the page - which is what lets the flag go on a
       design the synthesizer cannot handle without putting an error panel under every
       learner's waveform. */
    ok(api.netlistText() === '', 'a netlist exists before anything was pressed');
    ok(api.graph().nodes.length === 0, 'the viewer already holds nodes');
    ok(api.synthLog().length === 0, 'the synthesis log is not empty');
    ok(!/synthesis/.test(p.app.consoleBox.textContent || ''), 'the console holds a synthesis section');
    ok(!api.cardsShown(), 'the cards think they are shown before anything was pressed');
    ok($('card-netlist').style.display === 'none', 'the netlist card is on the page at load');
    ok($('netlistSplitRow').style.display === 'none', 'the viewer is on the page at load');
    const tabs = () => p.dom.window.PRACTICE_API.tabs();
    ok(!tabs().includes('tabNetlist') && !tabs().includes('tabNetlistView'),
       'the netlist tabs point at cards that are not on the page: ' + tabs().join(' '));

    // The button, where it was asked for: in the run toolbar, after the run-length field.
    const btn = $('synthBtn');
    ok(btn, 'there is no Synthesize button');
    /* Its label at load is the fresh verb, and the "again" form is DERIVED here the same
       way practice-synth.js derives it, so neither this check nor the button carries the
       other's wording. */
    const freshLabel = btn.textContent;
    const reLabel = s => s.replace(/\bSynthesize\b/, 'Re-synthesize');
    /* The busy form, derived the way the app derives it - glyph swapped WITH any
       variation selector, so this cannot pass on a label the app mangled. */
    const busyOf = s => s.replace(/^\s*\S︎?/, '⏲');
    ok(freshLabel && !/Re-/.test(freshLabel),
       'the button already offers to re-do it at load: ' + JSON.stringify(freshLabel));
    /* Its PLACEMENT cannot be checked from a booted page: the stub does not parse the
       injected markup, so every element it stands up is a child of the grid and
       `maxTimeInput.parentElement` is the grid too - a button appended anywhere would
       satisfy it. So the claim is split into the two halves that can each be pinned:
       the markup puts Run and the run length in ONE toolbar, and this file appends the
       button to that field's own parent. */
    const shellSrc = fs.readFileSync(path.join(HERE, 'shell.js'), 'utf8');
    const bars = shellSrc.match(/<div class="toolbar"[^>]*>[\s\S]*?<\/div>/g) || [];
    const runBar = bars.filter(b => b.indexOf('id="runBtn"') >= 0)[0];
    ok(runBar, 'the markup has no toolbar carrying the Run button');
    ok(runBar.indexOf('id="maxTimeInput"') >= 0,
       'Run and the run-length field are not in one toolbar, so "next to the run length" '
       + 'and "next to Run" are different places');
    const synthSrc = fs.readFileSync(path.join(HERE, 'practice-synth.js'), 'utf8');
    ok(/maxInput\.parentElement/.test(synthSrc) && /bar\.appendChild\(synthBtn\)/.test(synthSrc),
       'practice-synth.js does not append the button to the run-length field\'s toolbar');
    /* The same green as Run Simulation: the two are peers, so the usual
       one-primary-per-card rule is deliberately not applied here. Asserted rather than
       left to the eye, since `.btn.secondary` is one word away and looks deliberate. */
    ok(/\bbtn\b/.test(btn.className) && !/\bsecondary\b/.test(btn.className)
       && !/\boutline\b/.test(btn.className),
       'the Synthesize button is not the same button as Run: ' + btn.className);
    /* And the same class Run carries - read from the markup, since the stub stands its
       elements up from ids and carries none of their classes. */
    const runClass = /<button class="([^"]*)" id="runBtn"/.exec(shellSrc);
    ok(runClass, 'the markup has no Run button to compare against');
    ok(runClass[1] === btn.className,
       'Run is .' + runClass[1] + ' and Synthesize is .' + btn.className);

    /* The busy acknowledgement, on the peer button. `dispatch` rather than `click` so
       the hold is still pending and the state is observable. Both buttons carry a
       leading glyph now (`⚙︎ Synthesize` beside `▶ Run Simulation`), and the swap has to
       take the variation selector with it - a `⏲︎` left carrying the gear's U+FE0E
       would render differently from Run's `⏲` for no reason anyone could see in the
       source.

       The press runs the synthesis synchronously, so by the time the label is read it
       already reflects the OUTCOME - which is why the expectation is keyed on starterOk
       rather than accepting any of the three forms. On a page whose design is outside the
       synthesizer's subset the only correct answer is the busy form of the error label,
       and a blanket OR of all three would pass whatever happened. The error wording is
       read out of app.js rather than restated, since practice-synth.js reads it from
       there too and a copy here could drift from both. */
    const appSrcForLabel = fs.readFileSync(path.join(HERE, 'app.js'), 'utf8');
    const errM = /RUN_LABEL_ERROR = '([^']*)'/.exec(appSrcForLabel);
    ok(errM, 'app.js no longer defines RUN_LABEL_ERROR for the error state to use');
    const errLabel = errM ? errM[1] : '';
    btn.dispatch('click');
    ok(btn.hasAttribute('data-busy'), 'a press did not mark Synthesize busy');
    const wantBusy = starterOk
      ? [busyOf(freshLabel), busyOf(reLabel(freshLabel))]
      : [busyOf(errLabel)];
    ok(wantBusy.indexOf(btn.textContent) >= 0,
       'the busy label is wrong: ' + JSON.stringify(btn.textContent)
       + ' (wanted one of ' + JSON.stringify(wantBusy) + ')');
    /* And the error state is on exactly the pages whose design cannot synthesize - the
       label and the attribute are two encodings of one bit, so neither can move alone. */
    ok(btn.hasAttribute('data-error') === !starterOk,
       'data-error ' + (starterOk ? 'is set on a page that synthesizes'
                                  : 'is missing after a failed synthesis'));
    p.dom.window.flushTimers();
    ok(!btn.hasAttribute('data-busy'), 'the hold expired without clearing Synthesize');

    btn.click();
    if (starterOk) {
      ok(api.netlistText().length > 0, 'Synthesize produced no netlist');
      ok(api.graph().nodes.length > 0, 'Synthesize produced no diagram');
      ok(api.cardsShown(), 'a successful synthesis did not reveal the cards');
      ok($('card-netlist').style.display !== 'none', 'the netlist card is still hidden');
      ok($('netlistSplitRow').style.display !== 'none', 'the viewer is still hidden');
      ok(tabs().includes('tabNetlist') && tabs().includes('tabNetlistView'),
         'the cards are shown but their tabs are missing: ' + tabs().join(' '));
      /* And they went in BEFORE the Reset button rather than after it. This is the one
         event that can displace it - `margin-left: auto` pushes Reset right but holds
         nothing back that is appended later - and it is only reachable on a page with a
         synthesizer, so the ordering check on the shared page cannot see it. */
      const kids = [...$('exTabs').children].map(c => c.id);
      ok(kids[kids.length - 1] === 'exResetBtn',
         'a synthesis pushed the netlist tabs past Reset: ' + kids.join(' '));
      /* And the button offers to do it again, the same two-state rule Run's label
         follows - derived from the fresh label rather than written out, so it cannot
         drift from the button. The two are deliberate peers, so one tracking its state
         while the other sat still would read as an oversight. */
      ok(btn.textContent === reLabel(freshLabel),
         'the button says ' + JSON.stringify(btn.textContent) + ' after a synthesis');
      return 'absent at load, ' + api.graph().nodes.length + ' nodes and 2 tabs after Synthesize';
    }
    /* The other half of the rule, and the reason eight pages can carry the flag at all:
       a design outside the subset leaves the cards away and puts the whole answer in the
       Console. Asserted here rather than assumed - a card revealed empty, or revealed
       with the previous design's netlist, is the failure this rule exists to prevent. */
    ok(!api.cardsShown(), 'a failed synthesis revealed the cards anyway');
    /* The button reports the failure rather than resetting to the fresh verb. It used to
       say `freshLabel` here - "a failed synthesis puts the verb back with the cards" -
       which was true of the two-state label and is superseded by the third state: the
       cards still go away, but a button that offers `Synthesize` after a synthesis that
       just failed says nothing about what happened, which is the whole reason Run gained
       this state first. The wording is app.js's, read above rather than restated. */
    ok(btn.textContent === errLabel,
       'a failed synthesis did not report it: ' + JSON.stringify(btn.textContent));
    ok(btn.hasAttribute('data-error'), 'a failed synthesis left the button unmarked');
    ok($('card-netlist').style.display === 'none', 'the netlist card was revealed by an error');
    ok($('netlistSplitRow').style.display === 'none', 'the viewer was revealed by an error');
    ok(!tabs().includes('tabNetlist') && !tabs().includes('tabNetlistView'),
       'tabs appeared for cards that are not on the page: ' + tabs().join(' '));
    ok(api.netlistText() === '', 'a failed synthesis left netlist text behind');
    const log = api.synthLog();
    ok(log.some(l => l.level === 'err'), 'the console does not carry the error');
    /* And where the cause is a KNOWN subset gap, the log says which one. The
       synthesizer's own message is about the token it tripped on - `a << b` reports
       `expected 'ident' but got '<'` - which reads as "your Verilog is broken" for a
       design that simulates perfectly on the same page. */
    const gaps = api.subsetHints(api.designOnly(p.app.fullSource()).src);
    for (const gap of gaps) {
      ok(log.some(l => l.msg.indexOf(gap) >= 0),
         'the log does not mention the subset gap it found: ' + gap);
    }
    return 'stayed away; ' + (gaps.length ? 'named: ' + gaps.join(', ')
                                          : 'error reported, no known gap matched');
  });

  check(name('Run does not synthesize, and Synthesize does not simulate'), () => {
    /* Both directions, because the whole point of two buttons is that neither does the
       other's work. Each is asserted by what the OTHER's panels do, not by what the
       pressed one produced. */
    const netlistBefore = api.netlistText();
    /* Counted rather than compared: synthesizing the same design twice produces the same
       text, so a Run that quietly re-synthesized would be invisible in the panels. */
    const countBefore = api.syntheses();
    $('runBtn').click();
    ok(api.syntheses() === countBefore, 'Run synthesized as well');
    ok(api.netlistText() === netlistBefore, 'Run changed the netlist');
    ok(!api.isStale(), 'a Run with no edit marked the netlist stale');

    const runResult = p.app.result();
    ok(runResult, 'Run produced no simulation');
    $('synthBtn').click();
    ok(p.app.result() === runResult, 'Synthesize replaced the simulation result');
    return 'each button keeps to its own half';
  });

  check(name('the Console reads oldest at the top, whichever button ran last'), () => {
    /* One box, two owners, and only Run clears it - so the synthesis section has to be
       re-printed after a Run or it would silently vanish while its netlist stayed on
       screen. What is asserted beyond that is the ORDER, and the rule is RECENCY: the
       newest thing is at the bottom, each section under its own rule.

       This check used to pin the opposite - simulation always above, synthesis always
       below - which was not a decision so much as a consequence of how the two were
       printed: Synthesize appends, while Run clears the box and this section is
       re-printed afterwards, so an older synthesis always landed under a newer run. That
       is the confusion the ordering fixes, and this check moves with it. */
    const at = (s, r) => s.indexOf(r);
    $('synthBtn').click();
    $('runBtn').click();
    let text = p.app.consoleBox.textContent || '';
    const synthRule = at(text, '— synthesis —'), simRule = at(text, '— simulation —');
    ok(synthRule >= 0, 'the synthesis section did not survive a Run');
    ok(simRule >= 0, 'the run printed no section rule of its own');
    ok(synthRule < simRule,
       'Synthesize ran first, so its section belongs ABOVE the run - the older log is '
       + 'still under the newer output');
    ok(/synthesized top module|error: /.test(text.slice(synthRule)),
       'the section survived without its log');
    /* Where the testbench prints checks, they are the run's own output and so must sit
       under the run's rule. cpu-16bit prints nothing deliberately (the Scoreboard is its
       checker), so this only applies where there is something to place. */
    const firstCheck = text.search(/\bPASS\b|\bFAIL\b/);
    if (firstCheck >= 0) ok(firstCheck > simRule, 'check output is not under the run\'s rule');
    ok((text.match(/— synthesis —/g) || []).length === 1, 'the synthesis section printed twice');

    /* Now the other order, from the same page: Synthesize again and it becomes the newest
       thing, so it moves to the BOTTOM - and the run's output above it is untouched,
       which is a stronger and slug-independent way of saying "it did not wipe the
       simulation" than looking for a PASS line cpu-16bit never prints. */
    const runBlock = text.slice(simRule);
    $('synthBtn').click();
    text = p.app.consoleBox.textContent || '';
    const synth2 = at(text, '— synthesis —'), sim2 = at(text, '— simulation —');
    ok((text.match(/— synthesis —/g) || []).length === 1,
       'a second Synthesize left two sections in the console');
    ok(sim2 >= 0 && sim2 < synth2,
       'Synthesize ran last, so its section belongs BELOW the run it followed');
    ok(text.slice(sim2, synth2) === runBlock.slice(0, synth2 - sim2),
       'Synthesize changed the run output above its own section');
    return 'oldest at the top: synth-then-run puts synthesis first, run-then-synth last';
  });

  /* Clear discards what the Console shows and everything that speaks for it. The half worth
     a test is what must NOT come back: the synthesis section is remembered in memory and
     re-printed after every Run, so a Clear that only emptied the box would be undone by the
     next Run - which is the kind of half-working that reads as a bug in Run. */
  check(name('Clear empties the Console, silences the pill, and does not come back'), () => {
    const c = boot(slug);
    const cc = id => c.dom.document.getElementById(id);
    cc('synthBtn').click();
    cc('runBtn').click();
    const pill = cc('exVerdict');
    ok((c.app.consoleBox.textContent || '').length > 0, 'nothing in the console to clear');
    const btn = cc('consoleClearBtn');
    ok(btn, 'the Console header carries no Clear button');
    btn.click();
    const after = c.app.consoleBox.textContent || '';
    ok(!/— synthesis —|— simulation —/.test(after),
       'Clear left a section behind: ' + JSON.stringify(after.slice(0, 80)));
    ok(/Click Run to simulate/.test(after),
       'Clear left the box empty rather than putting its placeholder back');
    /* Silent, not "no checks reported" - that is a real verdict about a run that printed
       nothing, and claiming it for a console nobody has run into is the distinction
       refreshVerdict already draws for a page before its first Run. */
    ok(!pill.textContent, 'the pill still speaks after Clear: ' + JSON.stringify(pill.textContent));
    // and a Run afterwards does not resurrect the synthesis section
    cc('runBtn').click();
    const rerun = c.app.consoleBox.textContent || '';
    ok(!/— synthesis —/.test(rerun), 'a Run after Clear brought the synthesis log back');
    ok(/— simulation —/.test(rerun), 'the Run printed no section of its own');
    return 'console, pill and remembered log all gone; a later Run brings none of it back';
  });

  /* The cell/area report, and what is asserted is that it is the SAME report synthesis.html
     logs rather than a lookalike. Recomputed here from the source through the slice's own
     buildAreaReport and required to appear verbatim: that catches the app reformatting it,
     rounding it, or growing a second implementation - which is the real risk, since two
     apps computing an area independently is two answers for one design. */
  check(name('the Console reports cell counts and area, from the shared function'), () => {
    if (!solutionOk) return "n/a - the reference solution is outside the synthesizer's subset";
    const q = boot(slug);
    const qq = id => q.dom.document.getElementById(id);
    const sol = fs.readFileSync(path.join(HERE, 'solutions', slug + '.v'), 'utf8');
    q.app.loadFullSource(sol);
    qq('synthBtn').click();
    const text = q.app.consoleBox.textContent || '';

    const S = q.dom.window.SYNTH;
    ok(typeof S.buildAreaReport === 'function',
       'synth.js does not export buildAreaReport, so the page cannot share synthesis.html\'s');
    const want = S.buildAreaReport(S.synthesizeAll(api.designOnly(sol).src));
    ok(text.indexOf(want) >= 0,
       'the Console does not carry the report verbatim - it was reformatted or recomputed:\n'
       + JSON.stringify(want.slice(0, 120)));

    /* Internally consistent, so the numbers are readable as a set rather than four
       independent claims: the cell total is its own two halves, and the area total is the
       per-gate areas it just listed. */
    const num = (re) => { const m = want.match(re); return m ? parseFloat(m[1]) : NaN; };
    const cells = num(/Number of cells:\s+(\d+)/);
    const comb = num(/Number of combinational cells:\s+(\d+)/);
    const seq = num(/Number of sequential cells:\s+(\d+)/);
    const total = num(/Total cell area:\s+([\d.]+)/);
    ok(cells === comb + seq,
       cells + ' cells is not ' + comb + ' combinational + ' + seq + ' sequential');
    const areas = want.slice(want.indexOf('Approx. area'), want.indexOf('Total cell area:'))
                      .match(/[\d.]+$/gm) || [];
    const summed = areas.reduce((a, s) => a + parseFloat(s), 0);
    ok(Math.abs(summed - total) < 0.01,
       'the per-gate areas sum to ' + summed.toFixed(2) + ', not the stated ' + total.toFixed(2));

    /* It enters the box the verdict pill counts over, so it must not carry those words -
       the rule every synthesis line is held to. */
    ok(!/\bPASS\b|\bFAIL\b/.test(want), 'the area report contains PASS or FAIL');
    /* The one weight in the model that is a DERIVATION rather than an estimate: this app's
       own `fa` primitive is built from 2 XOR2 + 2 AND2 + 1 OR2, so its area is composed from
       those same weights instead of being a second unrelated guess. That is a claim the
       numbers cannot check - changing it moves the per-gate area and the total together, so
       the consistency assertions above stay happy - and it is exactly what a mutant setting
       `a.fa = 7` does. Asserted against the source, which is where the invariant lives. */
    const engine = fs.readFileSync(path.join(HERE, 'synth.js'), 'utf8');
    ok(/a\.fa\s*=\s*2 \* a\.xor \+ 2 \* a\.and \+ 1 \* a\.or;/.test(engine),
       "the FA area is no longer composed from this app's own fa primitive (2 XOR + 2 AND + "
       + '1 OR), so it is a second guess that can disagree with the cell it describes');
    /* And the old node/net count is gone: it described the diagram of one module while
       this counts the whole design, and the two disagreed with nothing explaining why. */
    ok(!/nodes and \d+ nets/.test(text),
       'the summary still reports nodes/nets beside the report\'s own cell count');
    return cells + ' cells, area ' + total.toFixed(2) + ', verbatim from the slice';
  });

  check(name('an edit marks the netlist stale without clearing it'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    const before = api.netlistText();
    ok(!api.isStale(), 'stale right after a Synthesize');
    ok($('netlistStale').style.display === 'none', 'the stale band is showing after a Synthesize');

    p.app.setEditorText(p.app.fullSource() + '\n// a comment\n');
    ok(api.isStale(), 'an edit did not mark the netlist stale');
    ok($('netlistStale').style.display !== 'none', 'the stale band is hidden on a stale netlist');
    ok($('viewerStale').style.display !== 'none', 'the viewer carries no stale band');
    /* Kept, not cleared: it is the thing being read, and the band says what it is. */
    ok(api.netlistText() === before, 'the netlist was cleared instead of marked');
    ok(api.graph().nodes.length > 0, 'the diagram was cleared instead of marked');

    /* The Console section says it too, since the bands on the cards are invisible to a
       reader who is scrolling the console - a log that reports on an older design
       without saying so is the one reading here that would mislead. */
    ok(/design has changed/.test(p.app.consoleBox.textContent || ''),
       'the synthesis section in the console does not say it is stale');
    /* And it is not one of the log's own lines - checked HERE, while it exists, since
       after the next Synthesize there is nothing to look at. A stored note would be
       re-printed alongside a freshly generated one on every render. */
    ok(!api.synthLog().some(l => /design has changed/.test(l.msg)),
       'the stale note was stored as a log line');

    $('synthBtn').click();
    ok(!api.isStale(), 'Synthesize did not clear the stale mark');
    ok($('netlistStale').style.display === 'none', 'the band survived a Synthesize');
    ok(!/design has changed/.test(p.app.consoleBox.textContent || ''),
       'the stale note survived a Synthesize');
    return 'marked, kept, cleared, said in the console';
  });

  check(name('the log goes to the Console, under its own rule, with no PASS/FAIL in it'), () => {
    $('synthBtn').click();
    const text = p.app.consoleBox.textContent || '';
    ok(text.indexOf('— synthesis —') >= 0, 'the console has no synthesis section');
    const after = text.slice(text.indexOf('— synthesis —'));
    /* Matched WITHOUT a leading word boundary: consoleBox.textContent concatenates its
       rows with no separator, so the previous line's last word runs straight into this
       one's first ("...hardware" + "error: ..."). */
    ok(starterOk ? /synthesized top module/.test(after) : /error: /.test(after),
       starterOk ? 'the log does not say what it synthesized'
                 : 'the log does not say why it could not synthesize');
    /* The verdict pill counts PASS/FAIL over the WHOLE console, so a synthesis line
       carrying either word would silently move a learner's score. */
    ok(!/\bPASS\b|\bFAIL\b/.test(after), 'the synthesis log says PASS or FAIL: ' + after.slice(0, 80));
    return after.split('\n')[0].slice(0, 40) + '…';
  });

  /* designOnly and the two editors must cut the SAME document at the same place, whether the
     marker sits alone on its line or is embedded in one. It reads app.js's tbMarkerIn rather
     than restating the pattern, and this is what pins that: a line-anchored copy here would
     return the whole file for the embedded form, so the netlist card would describe a design
     that included its own testbench while the editors showed them split. */
  check(name('the design cut agrees with the editor split, marker embedded or not'), () => {
    const design = 'module d(input a, output y);\nassign y = a;\nendmodule';
    const tb = 'module tb;\ninitial begin #5 $finish; end\nendmodule\n';
    const forms = { 'own line': design + '\n// ======== TESTBENCH ========\n' + tb,
                    'embedded': design + '// ======== TESTBENCH ========' + tb };
    for (const [what, doc] of Object.entries(forms)) {
      const cut = api.designOnly(doc);
      ok(cut.dropped > 0, what + ': designOnly cut nothing');
      ok(!/TESTBENCH/.test(cut.src), what + ': the marker survived the cut');
      ok(!/module\s+tb\b/.test(cut.src), what + ': module tb survived the cut');
      ok(cut.src.indexOf('assign y = a;') >= 0, what + ': the cut ate part of the design');
    }
    return 'both forms cut to the design alone';
  });

  check(name('the testbench never reaches the synthesizer'), () => {
    /* The claim is that no testbench construct reaches the synthesizer, and there are TWO
       mechanisms that can achieve it: designOnly slices at the TESTBENCH marker - the same
       line the two editors split on, so what is synthesized is exactly what the design card
       shows - and the engine honours a `Skip Synthesis` comment, which can cut earlier. So
       what is asserted is the OUTCOME - the source the synthesizer sees carries no
       testbench - rather than "the untruncated file must fail to lex", which stopped being
       true the moment an exercise used a marker. */
    const whole = p.app.fullSource();
    ok(/module\s+tb\b/.test(whole), 'the exercise has no module tb to drop');
    const marker = /\bskip\s*synthesis\b/i.test(whole);
    const cut = api.designOnly(whole);
    ok(marker || cut.dropped > 0,
       'nothing would drop the testbench: no Skip Synthesis marker, and designOnly cut nothing');
    const reaches = marker ? whole.slice(0, whole.search(/[^\n]*\bskip\s*synthesis\b[^\n]*/i))
                           : cut.src;
    ok(!/module\s+tb\b/.test(reaches), 'module tb survived the cut');
    // The remainder must synthesize where the design is inside the subset; where it is
    // not, the point still holds - it must fail for its OWN reason, not on a '#'.
    /* The claim is about the CUT, not about the design: whatever the sliced source does,
       it must no longer fail on a construct that only the testbench contains. So a design
       that parses is fine (adder-4bit's starter parses here and fails a stage later,
       building the netlist), and one that fails must fail for its own reason. */
    let cutErr = null;
    try { p.dom.window.SYNTH.synthesizeAll(reaches); } catch (e) { cutErr = e.message; }
    ok(!cutErr || !/unexpected character '#'|\$display|\binitial\b/.test(cutErr),
       'what reaches the synthesizer still fails on a testbench construct: ' + cutErr);
    return marker ? 'cut by its Skip Synthesis marker'
                  : 'sliced at the TESTBENCH marker, ' + cut.dropped + ' lines';
  });

  check(name('the viewer draws a node per cell and an edge per net, and fits them'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    const g = api.graph();
    ok(g.nodes.length > 0, 'no nodes');
    ok(g.edges.length > 0, 'no edges');
    ok($('pnNodes').children.length === g.nodes.length,
       g.nodes.length + ' nodes in the graph but ' + $('pnNodes').children.length + ' drawn');
    /* An edge is a <path>, plus a <text> when the net has a name - so what has to hold
       is that every edge produced a path, not that the two counts are equal. React
       Flow silently drops an edge whose handle does not exist; here that would be a
       missing wire, so every one is checked for real endpoints instead. */
    const paths = $('pnEdgeG').children.filter(
      c => c.tagName === 'PATH' && c.classList.contains('pn-edge'));
    ok(paths.length === g.edges.length,
       g.edges.length + ' edges but ' + paths.length + ' wires drawn');
    /* Every wire that carries a net name also gets its transparent 12px companion, or it
       cannot be clicked - a 1.5px line is not a hit target. */
    const hits = $('pnEdgeG').children.filter(
      c => c.tagName === 'PATH' && c.classList.contains('pn-edge-hit'));
    const named = g.edges.filter(e => e.label).length;
    ok(hits.length === named, named + ' named nets but ' + hits.length + ' clickable wires');
    /* And no labels until one is asked for: this is what replaced labelling all 622 edges
       of the 16-bit CPU, 69 of which landed inside a block. */
    ok(api.labelCount() === 0, api.labelCount() + ' labels drawn before any net was clicked');
    const byId = {};
    g.nodes.forEach(n => { byId[n.id] = n; });
    for (const e of g.edges) {
      ok(api.handlePoint(byId[e.source], e.sourceHandle),
         'no ' + e.sourceHandle + ' pin on ' + byId[e.source].type + ' ' + e.source);
      ok(api.handlePoint(byId[e.target], e.targetHandle),
         'no ' + e.targetHandle + ' pin on ' + byId[e.target].type + ' ' + e.target);
    }
    for (const path of paths) ok(/^M[-\d.]+,[-\d.]+ /.test(path.getAttribute('d')),
                                 'an edge path is not a real polyline: ' + path.getAttribute('d'));
    // and the fit put the whole graph inside the viewport rather than at 1:1 off-screen
    const v = api.view();
    ok(v.k > 0 && isFinite(v.k) && isFinite(v.x) && isFinite(v.y),
       'the fit produced ' + JSON.stringify(v));
    return g.nodes.length + ' nodes, ' + g.edges.length + ' nets, k=' + v.k.toFixed(2);
  });

  check(name('every node is drawn at the size its wires are computed from'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    /* The substitute for a browser measurement, which is unavailable here (headless
       Chrome aborts on its SingletonSocket in this environment). It is worth having
       rather than skipping: a node's box comes from ONE table, nodeSize, which both the
       inline style and every handle coordinate read - so asserting the written style
       equals the table pins "the box you see is the box the wires end on" without
       measuring anything. A node sized by CSS alone would show up here as a blank
       style, which is the case that would put a wire in mid-air. */
    const g = api.graph(), nodes = $('pnNodes').children;
    let checked = 0;
    for (let i = 0; i < g.nodes.length; i++) {
      const want = api.nodeSize(g.nodes[i]), el = nodes[i];
      ok(el.style.left === g.nodes[i].position.x + 'px' && el.style.top === g.nodes[i].position.y + 'px',
         g.nodes[i].id + ' is placed at ' + el.style.left + ',' + el.style.top
         + ' not ' + g.nodes[i].position.x + ',' + g.nodes[i].position.y);
      // the instance node takes its width from CSS (it is the one fixed-width kind)
      if (g.nodes[i].type !== 'instance') {
        ok(el.style.width === want.width + 'px',
           g.nodes[i].id + ' is ' + el.style.width + ' wide, but its pins are placed at '
           + want.width + 'px');
      }
      if (g.nodes[i].type !== 'const') {
        ok(el.style.height === want.height + 'px',
           g.nodes[i].id + ' is ' + el.style.height + ' tall, but its pins are placed at '
           + want.height + 'px');
      }
      checked++;
    }
    return checked + ' nodes placed and sized from one table';
  });

  check(name('no two blocks in the diagram overlap'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    /* Geometric, because that is what the bug was: the engine lays out on a fixed 84px
       row and the renderer draws boxes up to 420px tall, so blocks lapped each other and
       nothing in a suite full of counts and classes noticed. Measured before the fix: 3
       overlapping pairs on the 16-bit CPU, 6 on traffic-light, 4 on the register file. */
    const boxes = api.graph().nodes.map(n => {
      const s = api.nodeSize(n);
      return { id: n.id, x: n.position.x, y: n.position.y, w: s.width, h: s.height };
    });
    const bad = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 0 && oy > 0) bad.push(a.id + ' over ' + b.id + ' by ' + Math.min(ox, oy) + 'px');
      }
    }
    ok(!bad.length, bad.length + ' overlapping pair(s): ' + bad.slice(0, 3).join(', '));
    return boxes.length + ' blocks, none overlapping';
  });

  check(name('a multi-bit instance port is one bus pin, not a pin per bit'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    /* The engine's second pass. A port left per-bit shows up as `name[0]`, `name[1]`, …
       slots, which is what turned the 16-bit CPU's `pc` into a 19-pin, 420px block. Bits
       that are genuinely unconnected are exempt: alu.sreg has one of four bits wired, and
       a bus pin would claim the other three exist. */
    const perBit = [];
    let ports = 0;
    for (const n of api.graph().nodes.filter(n => n.type === 'instance')) {
      for (const s of n.data.inSlots.concat(n.data.outSlots)) {
        ports++;
        const m = /^(.+)\[(\d+)\]$/.exec(s.id);
        if (!m) continue;
        const width = (n.data.portWidths || {})[m[1]];
        perBit.push(n.data.modType + '.' + s.id);
      }
    }
    /* Reported as a count rather than asserted to zero: this page may legitimately have a
       partly-connected bus, so what is pinned is the RATIO - a design where most of an
       instance's pins are per-bit is the failure that was visible on screen. */
    ok(!ports || perBit.length <= ports / 2,
       perBit.length + ' of ' + ports + ' instance pins are still per-bit: '
       + perBit.slice(0, 6).join(' '));
    return ports + ' instance pins, ' + perBit.length + ' per-bit';
  });

  check(name('clicking a wire selects its whole net, and Escape lets go'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    const hits = $('pnEdgeG').children.filter(
      c => c.tagName === 'PATH' && c.classList.contains('pn-edge-hit'));
    if (!hits.length) return 'no named nets on this design';

    /* The net, not the wire: the 16-bit CPU draws 577 edges carrying far fewer nets, and
       its busiest is drawn as dozens of segments - "where does this signal go" is only
       answerable if every segment lights up. */
    hits[0].dispatch('click');
    const net = api.selectedNet();
    ok(net, 'clicking a wire selected nothing');
    ok(api.highlighted().length === api.netSegments(net),
       'net ' + net + ' has ' + api.netSegments(net) + ' segments but '
       + api.highlighted().length + ' are highlighted');
    ok(api.highlighted().every(n => n === net), 'a wire from another net was highlighted');
    // ...and exactly one label, at the wire that was clicked
    ok(api.labelCount() === 1, api.labelCount() + ' labels drawn for one selection');

    // Escape lets go. It shares the key with the exercise sheet, whose own handler is
    // guarded on being open, so the two cannot fight.
    p.dom.document.dispatch('keydown', { key: 'Escape' });
    ok(!api.selectedNet(), 'Escape did not clear the selection');
    ok(api.highlighted().length === 0, 'Escape left ' + api.highlighted().length + ' wires lit');
    ok(api.labelCount() === 0, 'Escape left the label on screen');

    // a click on the background clears it too
    hits[0].dispatch('click');
    ok(api.selectedNet(), 'could not re-select after Escape');
    $('flowRoot').dispatch('click');
    ok(!api.selectedNet(), 'a click on the background did not clear the selection');

    // and clicking the same net again is how you let go without reaching for a key
    hits[0].dispatch('click');
    hits[0].dispatch('click');
    ok(!api.selectedNet(), 'clicking the selected net again did not clear it');
    return 'net ' + net + ' (' + api.netSegments(net) + ' segments), cleared 3 ways';
  });

  check(name('a drag selects nothing, and a new graph drops the selection'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    const hits = $('pnEdgeG').children.filter(
      c => c.tagName === 'PATH' && c.classList.contains('pn-edge-hit'));
    if (!hits.length) return 'no named nets on this design';

    /* A wire's click arrives after the pan's mouseup, so without the movement threshold
       every drag that happened to start on a wire would select a net. */
    $('flowRoot').dispatch('mousedown', { clientX: 100, clientY: 100 });
    p.dom.document.dispatch('mousemove', { clientX: 160, clientY: 130 });
    p.dom.document.dispatch('mouseup', {});
    hits[0].dispatch('click');
    ok(!api.selectedNet(), 'a drag selected a net: ' + api.selectedNet());

    // a motionless press still selects
    $('flowRoot').dispatch('mousedown', { clientX: 100, clientY: 100 });
    p.dom.document.dispatch('mouseup', {});
    hits[0].dispatch('click');
    ok(api.selectedNet(), 'a click without movement selected nothing');

    // and a new graph clears it, since the net may not exist at the next level
    api.runSynthesis();
    ok(!api.selectedNet(), 'the selection survived a re-synthesis');
    ok(api.labelCount() === 0, 're-synthesis left a label behind');
    return 'drag ignored, click honoured, cleared on re-render';
  });

  check(name('zoom is about the pointer, and the view refits'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    api.fitView();
    const before = api.view();
    api.zoomAbout(100, 50, 2);
    const after = api.view();
    ok(Math.abs(after.k - before.k * 2) < 1e-9, 'k went ' + before.k + ' -> ' + after.k);
    /* The point under the cursor must not move: that is the whole difference between
       zooming and zooming-then-jumping. */
    const fx = (v) => (100 - v.x) / v.k, fy = (v) => (50 - v.y) / v.k;
    ok(Math.abs(fx(before) - fx(after)) < 1e-6 && Math.abs(fy(before) - fy(after)) < 1e-6,
       'the graph point under the cursor moved');
    api.fitView();
    ok(Math.abs(api.view().k - before.k) < 1e-9, 'refitting did not restore the fit');
    return 'k ' + before.k.toFixed(2) + ' -> ' + after.k.toFixed(2) + ' -> refit';
  });

  check(name('Synthesize re-synthesizes what is in the editor now'), () => {
    if (!starterOk) return NA;
    /* The live-binding case: practice-synth reads app.js's editorFullSource, which is
       reassigned on every edit. A stale read would re-synthesize the old text and the
       card would quietly disagree with the editor. The rename is applied to every
       occurrence, so the testbench's instantiation follows and the design still runs -
       an edit that also broke the simulation would test two things at once. */
    $('synthBtn').click();
    const before = api.netlistText();
    ok(before.length > 0, 'Synthesize produced nothing');
    const top = api.breadcrumb()[0];
    p.app.setEditorText(p.app.fullSource().split(top).join(top + '_edited'));
    $('synthBtn').click();
    const after = api.netlistText();
    ok(after !== before, 'the netlist did not change after an edit and a Synthesize');
    ok(after.indexOf(top + '_edited') >= 0, 'the new netlist does not name the renamed module');
    p.app.setEditorText(p.app.fullSource().split(top + '_edited').join(top));
    $('synthBtn').click();
    ok(api.netlistText() === before, 'undoing the edit did not restore the netlist');
    return 'netlist tracked an edit through Synthesize';
  });

  check(name('a design that breaks takes the cards away again, and says why'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    const good = api.netlistText();
    ok(api.cardsShown(), 'the cards are not shown after a good synthesis');
    const tabs = () => p.dom.window.PRACTICE_API.tabs();

    p.app.setEditorText('module oops(input a, output b); assign b = ~c; endmodule');
    $('synthBtn').click();
    /* The rule is symmetric, and this is the half that is easy to get wrong: the cards
       are shown BECAUSE a synthesis succeeded, so a later failure has to take them - and
       their tabs - away rather than leave a card holding the previous design's netlist. */
    ok(!api.cardsShown(), 'a failed synthesis left the cards on the page');
    ok($('card-netlist').style.display === 'none', 'the netlist card survived a failure');
    ok($('netlistSplitRow').style.display === 'none', 'the viewer survived a failure');
    ok(!tabs().includes('tabNetlist') && !tabs().includes('tabNetlistView'),
       'the tabs survived a failure, pointing at cards that are gone: ' + tabs().join(' '));
    ok(api.netlistText() === '', 'the netlist card kept its old text after a failure');
    ok(api.graph().nodes.length === 0, 'the viewer kept its old nodes after a failure');
    ok(/error: /.test(p.app.consoleBox.textContent || ''), 'the console does not carry the error');

    // and it recovers, cards and tabs together
    p.app.setEditorText(p.shell.PRACTICE_EX.starter);
    $('synthBtn').click();
    ok(api.netlistText() === good, 'reloading the starter did not restore the netlist');
    ok(api.cardsShown(), 'the cards did not come back with a working design');
    ok(tabs().includes('tabNetlist'), 'the tabs did not come back with the cards');
    return 'took them away, named the error, brought them back';
  });

  /* The strip Reset returns the page to never-synthesized, which is the one place a
     reset DISCARDS the synthesis section instead of re-printing it: Run and the old
     Reset both re-print, because they clear a console whose synthesis half they do not
     own, whereas this is a return to a page where no synthesis ever happened. Only
     reachable on a page with a synthesizer, so it cannot live with the other Reset
     checks. */
  check(name('the strip Reset returns the page to never-synthesized'), () => {
    if (!starterOk) return 'n/a - this design is outside the synthesizer\'s subset';
    $('synthBtn').click();
    ok(api.cardsShown(), 'the setup synthesis did not reveal the cards');
    ok(api.netlistText().length > 0, 'the setup synthesis produced no netlist');
    ok(api.synthLog().length > 0, 'the setup synthesis logged nothing');
    const tabsBefore = p.dom.window.PRACTICE_API.tabs();
    ok(tabsBefore.includes('tabNetlist'), 'no netlist tab to lose');

    p.dom.window.PRACTICE_API.openResetConfirm();
    $('exResetConfirm').click();

    ok(!api.cardsShown(), 'the cards survived the reset');
    ok(api.netlistText() === '', 'the netlist text survived the reset');
    ok(api.graph().nodes.length === 0, 'the diagram survived the reset');
    ok(api.synthLog().length === 0, 'the synthesis log survived the reset');
    ok(!/synthesis/.test(p.app.consoleBox.textContent || ''),
       'the console still carries a synthesis section');
    const after = p.dom.window.PRACTICE_API.tabs();
    ok(!after.includes('tabNetlist') && !after.includes('tabNetlistView'),
       'the netlist tabs point at cards the reset took away: ' + after.join(' '));
    ok($('synthBtn').textContent.indexOf('Re-') < 0,
       'the button still offers to re-synthesize: ' + JSON.stringify($('synthBtn').textContent));
    return 'netlist, diagram, log, cards and tabs all gone';
  });

  check(name('its controls persist under keys of their own, not synthesis.html\'s'), () => {
    /* Both apps live on one origin. A shared key would let a control here silently
       change synthesis.html and the other way round - the trap CLAUDE.md records for
       the Scoreboard checkbox - so the keys must differ AND be honoured in both
       directions, since a default-on control read one-way only comes back on. */
    const box = $('bundleMultibitCheckbox');
    ok(box.checked, 'bundling is off by default');
    box.checked = false;
    box.dispatch('change');
    ok(p.dom.localStorage.getItem('practiceNetlistBundle') === '0', 'unticking did not persist');
    ok(p.dom.localStorage.getItem('netlistBundleMultibit') === null,
       'it wrote synthesis.html\'s own key');
    ok(p.dom.window.SYNTH.getBundleMultibit() === false, 'the engine did not hear it');
    box.checked = true;
    box.dispatch('change');
    ok(p.dom.localStorage.getItem('practiceNetlistBundle') === '1', 'reticking did not persist');
    return 'practiceNetlistBundle, both directions';
  });

  check(name('two more tabs, pointing at the new cards, and only one is ever lit'), () => {
    if (!starterOk) return NA;
    $('synthBtn').click();
    const strip = $('exTabs');
    const ids = strip.children.map(b => b.getAttribute('id'));
    ok(ids.includes('tabNetlist') && ids.includes('tabNetlistView'),
       'the netlist tabs are missing: ' + ids.join(' '));
    for (const [tab, card] of [['tabNetlist', 'card-netlist'], ['tabNetlistView', 'card-netlist-view']]) {
      ok($(card), tab + ' points at ' + card + ', which does not exist');
      ok($(card).style.display !== 'none', tab + ' points at a hidden card');
    }
    const lit = () => strip.children.filter(b => b.classList.contains('selected')).length;
    $('tabNetlist').click();
    ok(lit() === 1, 'clicking the Netlist tab left ' + lit() + ' tabs lit');
    ok($('tabNetlist').classList.contains('selected'), 'the clicked tab is not the lit one');
    // and practice.js's own tabs still take the light back off ours
    $('tabDesign').click();
    ok(lit() === 1, 'clicking Design left ' + lit() + ' tabs lit');
    ok($('tabDesign').classList.contains('selected'), 'Design did not light up');
    return ids.join(' ');
  });

  check(name('drilling into a sub-module keeps the netlist on the top module'), () => {
    if (!starterOk) return NA;
    /* Reachable only on a design that HAS sub-modules - shift-register-4bit's four dff
       instances, register-file's rf_reg/rf_wdec/rf_rdec, traffic-light's generated
       adder/subtractor blocks. Both branches are real assertions: where nothing is
       drillable, the diagram must not be offering a dead double-click. */
    $('synthBtn').click();
    const drillable = api.graph().nodes.filter(n => n.data && n.data.drillable);
    const crumbs = () => $('breadcrumbRow').children.map(c => c.textContent);
    ok(api.breadcrumb().length === 1, 'the breadcrumb starts deeper than the top module');
    if (!drillable.length) {
      ok(crumbs().length === 1, 'a design with no sub-modules shows ' + crumbs().length + ' crumbs');
      return 'no sub-modules; one crumb, nothing drillable';
    }
    const mod = drillable[0].data.modType;
    const topText = api.netlistText(), topNodes = api.graph().nodes.length;

    api.drillInto(mod);
    ok(api.breadcrumb().length === 2 && api.breadcrumb()[1] === mod,
       'drilling gave the breadcrumb ' + api.breadcrumb().join('/'));
    ok(api.graph().nodes.length > 0, 'the sub-module drew no nodes');
    /* The netlist TEXT always starts from the real top module, whichever level the
       diagram is showing - the two panels answer different questions, and generating
       the text from the viewed module would silently replace a whole-design listing
       with one cell's. */
    ok(api.netlistText() === topText, 'drilling in rewrote the netlist listing');

    // and the breadcrumb comes back out
    const back = $('breadcrumbRow').children[0];
    back.click();
    ok(api.breadcrumb().length === 1, 'the crumb did not return to the top');
    ok(api.graph().nodes.length === topNodes, 'coming back out did not restore the top diagram');
    return 'into ' + mod + ' and back, listing unchanged';
  });

  check(name('the hierarchy toggle draws the same glyph as the other nine'), () => {
    /* tools/check_theme.py holds the nine buttons in the apps and shell.js to one
       drawing; this one is built by createElement, which that scan cannot see. */
    const shellSrc = fs.readFileSync(path.join(HERE, 'shell.js'), 'utf8');
    ok(shellSrc.indexOf(api.hierGlyph()) >= 0,
       'practice-synth.js draws a hierarchy glyph that shell.js does not carry');
    return 'byte-identical to shell.js\'s';
  });

  /* The one that matters: what the card SHOWS is fed back through the simulator's own
     parser and run against the exercise's own self-checking testbench. That is the
     difference between "a netlist was rendered" and "the netlist is this design".

     The netlist is SUBSTITUTED into the file rather than pasted in front of the
     testbench: the generated text redefines the DUT and every sub-module it synthesized,
     so everything the netlist does NOT define - memory wrappers, a system module, the
     testbench itself - is kept from the original. That is what makes this work on a
     hierarchical design: cpu-16bit's testbench drives a `system` holding a ROM, a RAM and
     the CPU, and only the CPU can be synthesized, so pasting a gate-level `cpu` in front
     of that testbench left two top-level modules and would not elaborate. Substituting
     runs the gate-level CPU inside its own real environment, which is a stronger claim
     than the flat pages ever needed. */
  check(name('the netlist it shows is the design: it simulates, and the checks pass'), () => {
    if (!solutionOk) return 'n/a - the reference solution is outside the synthesizer\'s subset';
    const sol = fs.readFileSync(path.join(HERE, 'solutions', slug + '.v'), 'utf8');

    const moduleSpans = (src) => {
      const out = [];
      const re = /^module\s+(\w+)/gm;
      let m;
      while ((m = re.exec(src)) !== null) {
        const e = src.indexOf('endmodule', m.index);
        out.push({ name: m[1], start: m.index, end: e + 'endmodule'.length });
      }
      return out;
    };
    const gateLevel = (src) => {
      const all = p.dom.window.SYNTH.synthesizeAll(api.designOnly(src).src);
      const results = [all.results[all.top.name]].concat(
        Object.keys(all.results).filter(k => k !== all.top.name).map(k => all.results[k]));
      const netlist = p.dom.window.SYNTH.genVerilog(results).text;
      const defined = new Set(moduleSpans(netlist).map(m => m.name));
      const kept = moduleSpans(src).filter(m => !defined.has(m.name))
                                   .map(m => src.slice(m.start, m.end)).join('\n\n');
      return { text: netlist + '\n\n' + kept + '\n', swapped: defined.size };
    };

    const count = (r, word) => (r.text.match(new RegExp('\\b' + word + '\\b', 'g')) || []).length;
    const good = gateLevel(sol);
    const gr = simrun.run(good.text, { maxTime: 2000, memFiles: p.shell.PRACTICE_EX.memFiles || {} });
    ok(!gr.parseError, 'the generated netlist does not elaborate: ' + gr.parseError);
    ok(!gr.error, 'the gate-level design hit a runtime error: ' + gr.error);
    ok(gr.finished, 'the gate-level design never reached $finish');
    const pass = count(gr, 'PASS'), fail = count(gr, 'FAIL');

    /* A page whose testbench prints nothing is judged by the Scoreboard, not by a tally -
       so what is asserted there is that the gate-level design RUNS to completion, and that
       it is still silent (a gate-level version printing checks would mean this page had
       quietly acquired a second checker). */
    if (MODEL_CHECKED.includes(slug)) {
      ok(pass === 0 && fail === 0,
         'this page is meant to print no checks, but its netlist printed ' + (pass + fail));
      return good.swapped + ' modules swapped for gates; runs to $finish at t=' + gr.time;
    }

    ok(pass > 0 && fail === 0,
       'the solution as gates failed its own testbench: ' + pass + ' pass, ' + fail + ' fail\n'
       + gr.text);
    /* And the starter's netlist must NOT pass - otherwise the two cards show the same
       hardware whatever the learner writes, which is how a synthesizer bug hides. Only
       where the starter synthesizes at all: on two of these pages it is the STARTER that
       steps outside the subset (its stub uses a shift), and there the page shows no cards
       until the learner has written something the synthesizer can take. */
    if (!starterOk) {
      return pass + ' checks pass as gates; the starter is outside the subset, so it has '
           + 'no netlist to compare';
    }
    const bad = gateLevel(p.shell.PRACTICE_EX.starter);
    const br = simrun.run(bad.text, { maxTime: 2000, memFiles: p.shell.PRACTICE_EX.memFiles || {} });
    ok(!br.parseError, "the starter's netlist does not elaborate: " + br.parseError);
    ok(count(br, 'FAIL') > 0,
       "the starter's netlist passes the testbench, so the netlist does not depend on the design");
    ok(good.text !== bad.text, 'the starter and the solution synthesize to the same netlist');
    /* Any cell the exercise sheet NAMES has to be in there. The description tells the
       learner what a working answer comes out as; a cell rename in synthesis.html would
       leave that sentence quietly wrong, and nothing else here reads the prose. */
    const claimed = (p.shell.PRACTICE_EX.descriptionHtml.match(/<code>(\w+_(?:cell|gate))<\/code>/g) || [])
      .map(s => s.replace(/<\/?code>/g, ''));
    for (const cell of claimed) {
      ok(good.text.indexOf(cell) >= 0,
         'the exercise sheet promises a ' + cell + ', which the netlist does not contain');
    }
    return pass + ' checks pass as gates; the starter fails ' + count(br, 'FAIL')
         + (claimed.length ? '; sheet names ' + claimed.join('/') : '');
  });

  /* And the same thing from the BUTTON rather than from the harness. The check above
     proves the netlist is the design by re-running it through the engine directly; this
     one proves the page can do it - that Run Gate-level Simulation feeds the card's own
     text to the same panels, and that what lands there is the netlist's result and not
     the RTL's. The two are worth having separately: the first would pass with no button
     at all, and the second would pass if the button quietly re-ran the design. */
  check(name('Run Gate-level Simulation runs the netlist, in the RTL run\'s panels'), () => {
    if (!solutionOk) return "n/a - the reference solution is outside the synthesizer's subset";
    const q = boot(slug);
    const $$ = id => q.dom.document.getElementById(id);
    const sol = fs.readFileSync(path.join(HERE, 'solutions', slug + '.v'), 'utf8');
    q.app.loadFullSource(sol);
    $$('synthBtn').click();
    ok($$('card-netlist').style.display !== 'none', 'the solution did not synthesize cleanly');
    const btn = $$('gateRunBtn');
    ok(btn, 'the netlist card carries no Run Gate-level Simulation button');
    /* The verb is DERIVED from Run's own label, so the two buttons cannot end up
       describing different actions - the rule RUN_LABEL_AGAIN follows in app.js. */
    const runLabel = q.app.runLabels()[0];
    ok(btn.textContent === runLabel.replace(/Simulation\s*$/, '') + 'Gate-level Simulation',
       'the button reads ' + JSON.stringify(btn.textContent) + ' against Run\'s '
       + JSON.stringify(runLabel));

    $$('runBtn').click();
    const rtl = q.app.consoleBox.textContent || '';
    const rtlSignals = Object.keys(q.app.result().signals);
    btn.click();
    const gate = q.app.consoleBox.textContent || '';
    const gateSignals = Object.keys(q.app.result().signals);
    ok(q.app.result() && q.app.result().finished,
       'the gate-level run did not reach $finish');
    /* It says which design the panels are showing, under its own section rule - one set of
       panels means a gate-level run REPLACES the behavioural one, and a waveform of a
       design the reader cannot see with nothing saying so is the one reading of this page
       that would mislead.

       PLACEMENT, not just presence: a first version of this asserted the rule existed, and
       that passed while the rule sat at the very top of the box with the whole synthesis
       log between it and the output it was labelling - which is what a reader actually
       reported. Both noteRun and renderSynthSection insert at the TOP, so the order of the
       two calls decides which ends up higher, and nothing but position can see that. */
    ok(/— simulation —/.test(rtl) && !/— gate-level simulation —/.test(rtl),
       'the behavioural run is unlabelled, or claims to be gate-level');
    const rows = Array.from(q.app.consoleBox.children).map(el => (el.textContent || '').trim());
    const rowAt = re => rows.findIndex(r => re.test(r));
    const gateRule = rowAt(/^— gate-level simulation —$/);
    const synthRule = rowAt(/^— synthesis —$/);
    const firstOut = rowAt(/\bPASS\b|\bFAIL\b|^Simulation finished/);
    ok(gateRule >= 0, 'the Console does not mark the gate-level section');
    ok(synthRule >= 0 && synthRule < gateRule,
       'the synthesis section ran first, so it belongs ABOVE the gate-level rule (synthesis at '
       + synthRule + ', gate rule at ' + gateRule + ')');
    ok(firstOut > gateRule,
       'the gate-level rule is not above its own output - row ' + gateRule + ' of ' + rows.length
       + ', output starts at ' + firstOut);
    /* And the line about how the netlist was assembled belongs to that section, directly
       under its rule - it used to be logged after the run, which left it stranded at the
       very bottom, below the simulation output it was introducing. */
    ok(/replaced by gates/.test(rows[gateRule + 1] || ''),
       'the "replaced by gates" note is not under the gate-level rule: '
       + JSON.stringify(rows[gateRule + 1] || ''));
    /* The tally is the netlist's own. On a page whose testbench prints checks they must
       pass as gates; where it prints nothing (cpu-16bit) the claim is that it ran at all
       and is still silent - a gate-level version that started printing would mean the
       page had quietly acquired a second checker. */
    const tally = (s, w) => (s.match(new RegExp('\\b' + w + '\\b', 'g')) || []).length;
    ok(tally(gate, 'FAIL') === 0, 'the solution\'s netlist failed ' + tally(gate, 'FAIL') + ' checks');
    ok(tally(gate, 'PASS') === tally(rtl, 'PASS'),
       'gates report ' + tally(gate, 'PASS') + ' passes against the RTL\'s ' + tally(rtl, 'PASS'));
    /* THE assertion, and the tallies above cannot stand in for it: a correct netlist
       passes the same checks as the design it came from, so on every clean page the two
       counts AGREE - which is exactly what a button that quietly re-ran the RTL would
       also produce. Two mutants proved that, surviving a first version of this check that
       compared only the tallies.

       What tells the two runs apart is the SIGNAL SET. A netlist instantiates cells, so it
       carries nets the behavioural design has no equivalent of - the synthesizer's own
       `w_*` wires and `u_*` cell instances. Re-running the design would leave the two sets
       identical. */
    const gateOnly = gateSignals.filter(n => rtlSignals.indexOf(n) < 0);
    ok(gateOnly.length > 0,
       'the gate-level run produced the same ' + rtlSignals.length + ' signals as the RTL run, '
       + 'so what ran was the design and not the netlist');
    /* It counts as a run on this page - the pill, the tab strip, the first-run unfold.
       Asserted on a page where the gate-level run is the ONLY run, because after a Run
       `hasRun` is already true and the claim would hold with nothing calling it: that is
       precisely how a first version of this passed with PRACTICE_API.noteRun deleted. */
    const v = boot(slug);
    const vv = id => v.dom.document.getElementById(id);
    v.app.loadFullSource(sol);
    vv('synthBtn').click();
    ok(!v.dom.window.PRACTICE_API.hasRun(), 'the page counted a run before either button');
    vv('gateRunBtn').click();
    ok(v.dom.window.PRACTICE_API.hasRun(),
       'a gate-level run did not count as a run, so the pill and the strip never heard about it');
    for (const id of ['card-wave', 'card-hierarchy']) {
      ok(!vv(id).classList.contains('collapsed'),
         id + ' is still folded after a gate-level run');
    }
    return tally(gate, 'PASS') + ' checks pass from the button; ' + gateOnly.length
         + ' cell nets the RTL run has not, so it really is the netlist';
  });

  /* Two refusals, and the reason they are refusals rather than best-effort runs: the
     button's whole claim is that it runs what THIS CARD shows. Once the design has moved
     on, the card says so itself (the stale band), and running the old netlist anyway
     would produce a result about hardware that no longer corresponds to anything on
     screen - while silently re-synthesizing would make a Run button report synthesis
     errors. So it declines, in the Console, where every other refusal here is said. */
  check(name('a stale netlist refuses to run, and runs nothing'), () => {
    if (!solutionOk) return "n/a - the reference solution is outside the synthesizer's subset";
    const q = boot(slug);
    const $$ = id => q.dom.document.getElementById(id);
    q.app.loadFullSource(fs.readFileSync(path.join(HERE, 'solutions', slug + '.v'), 'utf8'));
    $$('synthBtn').click();
    $$('gateRunBtn').click();
    const before = q.app.result();
    ok(before && before.finished, 'the first gate-level run did not happen');
    // an edit to the DESIGN marks the netlist stale
    $$('codeInput').dispatch('input');
    ok($$('netlistStale').style.display !== 'none', 'the edit did not mark the netlist stale');
    q.app.consoleBox.innerHTML = '';
    $$('gateRunBtn').click();
    const txt = q.app.consoleBox.textContent || '';
    ok(/press Synthesize/.test(txt),
       'a stale netlist did not say why it refused: ' + JSON.stringify(txt.slice(0, 120)));
    ok(!/GATE-LEVEL run/.test(txt), 'it ran anyway, on a netlist the card marks as stale');
    return 'refused while stale, and said to press Synthesize';
  });
}

/* ---- the stylesheet ----
   practice.css used to be a Primer skin over an iOS app.css, and most of it was a
   substitution layer with a completeness check to match. style.css is Primer itself
   now, so that layer is gone and so is the check: what is left to guard is that this
   file consumes the shared tokens rather than starting its own palette, which is how
   a second source of truth would creep back in. Repo-wide colour and token checks
   live in tools/check_theme.py. */
/* The section rules are spacing, which no headless check can see and which is the whole
   reason the Console reads as sections rather than one stream - so it is asserted as CSS
   TEXT, the way the netlist viewer's own invisible rules are. The first-child reset matters
   as much as the margin: without it the topmost section is pushed off its own box. */
check('the Console section rules are spaced, and the first one is not', () => {
  const css = fs.readFileSync(path.join(HERE, 'practice.css'), 'utf8');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');   // comments name the selectors too
  ok(/\.console-rule\s*\{[^}]*margin-top:\s*[1-9]/.test(bare),
     'practice.css gives .console-rule no top margin, so the sections run together');
  ok(/\.console-rule:first-child\s*\{[^}]*margin-top:\s*0/.test(bare),
     'the first section is not exempted, so the box opens with a gap above its own text');
  return 'spaced, with the first section flush';
});

check('practice.css consumes the shared tokens and defines none of its own', () => {
  const css = fs.readFileSync(path.join(HERE, 'practice.css'), 'utf8');
  const appCss = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8');
  const defined = new Set((appCss.match(/--[\w-]+(?=\s*:)/g) || []));
  ok(defined.size > 10, 'app.css defines only ' + defined.size + ' tokens - did the sync run?');

  const mine = (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/--[\w-]+(?=\s*:)/g) || []);
  ok(!mine.length, 'practice.css defines its own tokens: ' + mine.join(', '));

  const used = new Set((css.match(/var\((--[\w-]+)/g) || []).map(s => s.slice(4)));
  const undef = [...used].filter(n => !defined.has(n));
  ok(!undef.length, 'uses tokens app.css does not define: ' + undef.join(', '));
  return used.size + ' tokens used, all from app.css (' + defined.size + ' available)';
});

if (SYNTH_SLUGS.length) {
  /* The four CSS facts the netlist viewer cannot work without, checked as text because
     the stub DOM applies no stylesheet and headless Chrome is unavailable here. Each is
     a rule whose absence is invisible in the markup and fatal on screen: without
     #flowRoot's height the viewer is a 0px strip, without position:absolute every node
     stacks at the origin (`.rf-node` sets position:relative, so this rule has to be more
     specific to beat it), and without the transform-origin the pan/zoom transform scales
     about the middle instead of the top-left the fit is computed for. */
  check('the netlist viewer\'s own CSS is present in the two stylesheets', () => {
    const practice = fs.readFileSync(path.join(HERE, 'practice.css'), 'utf8');
    const synth = fs.readFileSync(path.join(HERE, 'synth.css'), 'utf8');
    ok(/#flowRoot\s*\{[^}]*height:\s*\d+px/.test(synth), 'synth.css gives #flowRoot no height');
    ok(/\.pn-nodes\s*>\s*\.rf-node\s*\{[^}]*position:\s*absolute/.test(practice),
       'practice.css does not place nodes absolutely, so they would all stack at the origin');
    ok(/\.pn-nodes[^{]*\{[^}]*transform-origin:\s*0\s+0/.test(practice),
       'practice.css does not set transform-origin: 0 0, which the fit assumes');
    ok(/\.pn-edge\s*\{[^}]*stroke:\s*var\(/.test(practice), 'the edge stroke is not a token');
    /* And the node rules really do come from synthesis.html rather than being restated:
       if synth.css ever stops carrying them, every gate renders as a plain box. */
    for (const sel of ['.rf-node', '.rf-node-gate', '.rf-node-port', '.rf-node-instance']) {
      ok(synth.indexOf(sel) >= 0, 'synth.css carries no ' + sel + ' rule');
    }
    return 'flowRoot height, absolute nodes, token stroke, 4 node rules';
  });

  /* The busy button's other half is paint, which no headless tool here can see - so it
     is asserted as CSS text, the same standing arrangement as the four rules above.
     Three claims, and the third is the one worth having: reusing the hover shade would
     make the whole feature invisible to a mouse user, because the pointer is on the
     button and :hover is already showing it. */
  check('the busy button is painted, and not in the colour :hover already shows', () => {
    /* Comments are stripped FIRST, and that is not tidiness: the rules below are
       explained by a comment block that names both `.btn[data-busy]` and `.btn:hover`,
       so a regex run over the raw file matches inside the prose and then reads whatever
       token appears next. The mutant that sets the busy colour TO the hover colour
       survived exactly that way - the check passed while comparing two matches neither
       of which came from a rule. */
    const css = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8')
                  .replace(/\/\*[\s\S]*?\*\//g, '');
    const bg = sel => {
      const m = new RegExp('(?:^|[},])\\s*' + sel + '[^{}]*\\{[^}]*background:\\s*var\\((--[a-z-]+)\\)')
                  .exec(css);
      return m && m[1];
    };
    const busy = bg('\\.btn\\[data-busy\\]');
    const active = bg('\\.btn:active');
    const hover = bg('\\.btn:hover');
    ok(busy, 'app.css has no .btn[data-busy] background rule');
    ok(active, 'app.css has no .btn:active rule, so a press is not acknowledged until the run ends');
    ok(hover, 'app.css has no .btn:hover rule to compare against');
    ok(busy !== hover,
       'the busy colour is ' + busy + ', which is what :hover already shows - so a mouse '
       + 'user, whose pointer is on the button, would see no change at all');
    ok(active !== hover, 'the press colour is the hover colour, so a press shows nothing');
    /* `.btn` must pin its own line-height rather than inherit the unitless 1.5, or the
       line box is sized from whatever font supplies the glyph - and the ⏲ the busy state
       swaps in comes from a colour-emoji fallback that is taller than the text font, so
       the button grew on every press. The value has to be the one the inherited rule
       computed to (12px x 1.5), or this "fix" silently resizes every button in the app;
       both numbers are read from the file rather than written here, so the check follows
       a font-size change instead of failing on one. */
    const size = /select,\s*\.btn,[^{]*\{[^}]*font-size:\s*(\d+)px/.exec(css);
    const lh = /\.btn\s*\{[^}]*line-height:\s*(\d+)px/.exec(css);
    const body = /\bbody\s*\{[^}]*line-height:\s*([\d.]+)\s*;/.exec(css);
    ok(size, 'app.css has no font-size for .btn');
    ok(lh, '.btn does not pin its line-height, so an emoji glyph changes the button height');
    ok(body, 'app.css has no body line-height to compare against');
    ok(Number(lh[1]) === Number(size[1]) * Number(body[1]),
       '.btn pins line-height: ' + lh[1] + 'px, but the inherited rule computed to '
         + (Number(size[1]) * Number(body[1])) + 'px - so every button changed size');
    /* Both modes have to define it, or the button loses its fill in one of them. The
       repo-wide version of this lives in tools/check_theme.py; this is the local claim
       that THIS token is the one being used. */
    const defs = (css.match(new RegExp(busy + ':\\s*#[0-9a-f]{6}', 'g')) || []).length;
    ok(defs >= 2, busy + ' is defined ' + defs + ' time(s), so it is not in both light and dark');
    /* And the glyph is a real label swap rather than generated content, which is what
       makes it assertable from a booted page at all - see the two checks above. */
    ok(!/\.btn\[data-busy\]::(after|before)/.test(css),
       'the ⏲ is drawn by CSS content, where no headless check can see it');
    return busy + ' for busy and press, against ' + hover + ' for hover';
  });

  /* The strip Reset's geometry, which no headless tool here can see - so it is asserted
     as CSS text, like the four viewer rules above. Each of these is invisible in the
     markup and wrong on screen: without the auto margin it sits against the last tab
     instead of hard right; `.gh-tabs` is a flex row with no align-items, so without
     align-self the 32px button stretches to the ~38px tab height; and `.gh-tab`'s
     margin-bottom: -1px must NOT be inherited here, or the button straddles the strip's
     bottom rule rather than resting above it. */
  check('the strip Reset is placed and sized by its own rules', () => {
    const css = fs.readFileSync(path.join(HERE, 'practice.css'), 'utf8')
                  .replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.ex-reset\s*\{([^}]*)\}/.exec(css);
    ok(rule, 'practice.css has no .ex-reset rule');
    ok(/margin-left:\s*auto/.test(rule[1]),
       '.ex-reset is not pushed right, so it sits against the last tab');
    ok(/align-self:\s*center/.test(rule[1]),
       '.ex-reset does not centre itself, so the flex row stretches it to tab height');
    ok(!/margin-bottom:\s*-/.test(rule[1]),
       '.ex-reset carries a negative bottom margin, so it straddles the strip rule');
    ok(/color:\s*var\(--danger-fg\)/.test(rule[1]), '.ex-reset is not danger-coloured');
    /* And the dialog is narrower than the exercise sheet it borrows its panel from -
       900px holding two lines of prose is the failure being avoided. */
    const conf = /\.ex-confirm\s*\{([^}]*)\}/.exec(css);
    ok(conf && /max-width:\s*\d+px/.test(conf[1]), '.ex-confirm does not narrow the sheet');
    return 'pushed right, centred, on the rule, danger-coloured';
  });
}

check('no iOS palette colour survives in practice.css', () => {
  const css = fs.readFileSync(path.join(HERE, 'practice.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const LEGACY = ['#007aff', '#f2f2f7', '#1c1c1e', '#8e8e93', '#c7c7cc', '#e5e5ea',
                  '#3a3a3c', '#ff3b30', '#34c759', '#0066d6'];
  const found = LEGACY.filter(c => css.toLowerCase().includes(c));
  ok(!found.length, 'still using ' + found.join(', '));
  return LEGACY.length + ' legacy colours, none present';
});

/* ---- the mobile block, which is four claims a headless run cannot make ----
   Layout at 390px is exactly what neither the stub DOM nor (this session) headless
   Chrome can see, so the load-bearing parts of practice.css's 760px block are
   asserted as CSS TEXT, the way the viewer's four rules and the strip Reset's
   geometry already are. Each of these is invisible in the markup and wrong on a
   phone: without the strip's overflow the DOCUMENT is ~900px wide and the sticky
   header renders narrower than the page under it; without 16px on the focusable
   controls iOS Safari zooms the whole page on the first tap in the editor; a
   font-size on the textarea but not the gutter slides the line numbers off their
   own lines; and a column count that moves without its row count silently starts a
   third column in a two-column grid. Comments are stripped first - this block
   explains all four at length and names the properties in prose, which is how a
   regex over the raw file passes while comparing nothing. */
/* ---- a card can shrink, so no one panel can widen the page ----
   Measured on cpu-16bit at a 320px viewport after a synthesis: the document was
   19,628px wide, and this one property took it to 812px (the rest being the tab
   strip). It is asserted as text because the stub DOM has no layout and headless
   Chrome aborts in this environment, and it is worth asserting at all because the
   rule is invisible in the markup, fixes a symptom that looks like something else
   entirely ("the header is narrower than the page"), and is the single line whose
   absence makes every panel's own overflow:auto unreachable.

   Read out of app.css rather than practice.css: the rule lives in the SHARED block
   now, so all six apps have it, and app.css is the copy these pages actually load.
   tools/check_theme.py is what holds that block identical to style.css. */
/* ---- the drawer's own CSS, four claims the stub cannot see ----
   The stub has no layout and no cascade, and headless Chrome aborts in this
   environment, so these are asserted as text - the same shape as the netlist viewer's
   four rules and the strip Reset's geometry. Each is invisible in the markup and
   wrong on screen: with no transform the drawer sits open across the page from the
   moment it loads; with no transition it appears instead of sliding, which is the
   whole request; hiding `.gh-nav` rather than its links takes the cloud account
   control with it; and keeping the header's unconditional invert on the cloned
   wordmark paints it white on a white panel. */
/* ---- the drawer's links from every directory it is pasted into ----
   tools/navmenu.js is now the canonical builder for all six apps, and three of them -
   emulator, verify, workbench - live one level ABOVE Baerilog/. A bare filename does not
   resolve from there, and each of those three carried a single `&larr; Baerilog` link
   back to the hub which the shared block now hides: get this wrong and they have no way
   back at all. So the builder is driven here at four pathnames, which is the only place
   in this repo that can run it (check_theme.py proves the copies are identical; this
   proves what the copy DOES). */
check('the drawer resolves from Baerilog/ and from the three directories above it', () => {
  const src = fs.readFileSync(path.join(HERE, '..', 'tools', 'navmenu.js'), 'utf8');
  const region = src.slice(src.indexOf('/* >>> NAV MENU'), src.indexOf('/* <<< NAV MENU */'));
  ok(region.length > 500, 'no NAV MENU region in tools/navmenu.js');

  const at = (pathname) => {
    const dom = makeDom();
    const hdr = dom.mk('__h', 'header');
    hdr.classList.add('gh-header');
    const inner = dom.mk('__i', 'div', hdr);
    inner.classList.add('gh-header-inner');
    const mark = dom.mk('__m', 'a', inner);
    mark.classList.add('gh-mark');
    dom.mk('__ms', 'svg', mark);
    // one simple selector at a time, which is all the builder asks for
    dom.document.querySelector = (sel) => (sel === '.gh-header-inner' ? inner
                                        : sel === '.gh-mark' ? mark : null);
    dom.window.location = { pathname };
    new Function('window', 'document', region)(dom.window, dom.document);
    const rows = [...dom.document.getElementById('navDrawerList').children];
    return {
      hrefs: rows.map(r => r.getAttribute('href')),
      current: rows.filter(r => r.classList.contains('current')).map(r => r.textContent),
    };
  };

  const inside = at('/Baerilog/cpu-16bit.html');
  ok(inside.hrefs.includes('index.html') && inside.hrefs.includes('simulator.html'),
     'inside Baerilog/ the rows are not bare filenames: ' + inside.hrefs.join(' '));
  ok(inside.current.join() === 'Practice',
     'an exercise page marks ' + (inside.current.join() || '(nothing)') + ', not Practice');
  ok(at('/Baerilog/simulator.html').current.join() === 'Simulator',
     'the simulator does not mark its own row');

  for (const dir of ['emulator', 'verify', 'workbench']) {
    const out = at('/' + dir + '/index.html');
    const local = out.hrefs.filter(h => !/^https?:/.test(h));
    ok(local.every(h => h.indexOf('../Baerilog/') === 0),
       'from ' + dir + '/ the rows do not reach Baerilog/: ' + local.join(' '));
    ok(out.current.length === 0,
       'from ' + dir + '/ the drawer marks ' + out.current.join() + ', but none of its rows is this app');
    ok(out.hrefs.some(h => /^https?:/.test(h)), 'the off-site Home row was prefixed');
  }
  return 'bare inside, ../Baerilog/ from the three outside, current row per page';
});

check('the drawer slides, and the bar keeps its account control', () => {
  /* app.css, not practice.css: the drawer is in the SHARED block now, so all six apps
     have one reading of it and tools/navmenu.py pastes one builder into each. What is
     still practice-only (the tab strip, the sheet) is checked from practice.css above. */
  const css = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  /* EVERY rule carrying this selector, concatenated - not the first one. The shared
     block legitimately declares a selector twice (it lays `.gh-nav a` out from when
     those links were visible and then hides them; `.gh-header-inner` is capped and then
     uncapped), and the cascade settles it. A first-match helper made this check report
     three intact rules as missing, which is the same way the editor-rule check failed
     when the 16px block was added: a CSS-text check has to ask "does any rule say this"
     or "does none", never "does the first". */
  const rule = (sel) => {
    const re = new RegExp('(?:^|[,}\\s])' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                          + '\\s*\\{([^}]*)\\}', 'g');
    let m, out = '';
    while ((m = re.exec(css))) out += m[1] + ';';
    return out;
  };
  const closed = rule('.nav-drawer');
  ok(/transform:\s*translateX\(-100%\)/.test(closed),
     '.nav-drawer is not translated off-screen, so it covers the page at load');
  ok(/transition:[^;]*transform/.test(closed),
     '.nav-drawer has no transform transition, so it appears rather than slides');
  /* visibility in the transition, not just the state: without it a closed drawer is
     still focusable and clickable off-screen, and with it in the state alone the
     panel vanishes before it has finished sliding out. */
  ok(/visibility:\s*hidden/.test(closed) && /transition:[^;]*visibility/.test(closed),
     '.nav-drawer does not transition visibility, so it is reachable while closed');
  ok(/transform:\s*translateX\(0\)/.test(rule('.nav-drawer.open')),
     '.nav-drawer.open does not slide in');
  ok(/transition:\s*none/.test(rule('.nav-drawer, .nav-backdrop')),
     'no prefers-reduced-motion rule, so the page moves for someone who asked it not to');

  // the links go, the nav stays - or cloud-ui.js's account control goes with it
  ok(/display:\s*none/.test(rule('.gh-nav a')), 'the bar still shows the four links');
  /* And the claim about the nav itself is that NOTHING hides it - not that no rule
     mentions it, which the shared block must (it lays the nav out). */
  ok(!/display:\s*none/.test(rule('.gh-nav')),
     'a rule hides .gh-nav itself, which takes the cloud account control out of the bar');
  ok(/display:\s*none/.test(rule('.gh-mark span')), 'the Baerilog wordmark text is still shown');

  // the cloned logo on a light surface drops the header's unconditional invert
  ok(/filter:\s*none/.test(rule('.nav-drawer-mark svg')),
     "the drawer's wordmark keeps the header's invert, so it is white on white");
  /* The bar spans the window, so the button and logo sit at its left edge and the
     account control at its right. Three claims, because each is a different way for
     that to come apart: without `max-width: none` the whole row is back in the 1280px
     column (575px in, on a 2430px window); with the button absolutely positioned it
     leaves the flow and the logo slides under it on a phone; and the account control
     is carried right by `.gh-nav`'s own auto margin in the SHARED block, so if that
     goes the pill lands beside the logo instead. */
  ok(/max-width:\s*none/.test(rule('.gh-header-inner')),
     'the header row is still capped at the content column, so the button is not at the '
     + 'window edge');
  ok(!/position:\s*absolute/.test(rule('.gh-menu-btn')),
     'the button is positioned out of the flow, so the logo no longer moves with it');
  const shared = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const navRule = /\.gh-nav\s*\{([^}]*)\}/.exec(shared);
  ok(navRule && /margin-left:\s*auto/.test(navRule[1]),
     'app.css no longer pushes .gh-nav right, so the account control sits next to the logo');
  // and the current row is marked twice over, the rule every state here follows
  const cur = rule('.nav-row.current');
  ok(/background:/.test(cur) && /box-shadow:\s*inset/.test(cur),
     '.nav-row.current has one encoding, not two (a fill and an inset accent rule)');
  return 'slides, reduced-motion honoured, nav kept, logo un-inverted, bar full width';
});

check('a card is allowed to shrink, so no panel can force the grid wide', () => {
  const css = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  /* Every @media block removed, so what is left is what applies at EVERY width - the
     claim being made. Slicing at the first `@media` is what the first draft did, and
     since app.css's first one is the prefers-color-scheme query near the top, `base`
     was the first 80 lines and the check reported the rule missing while all three of
     its mutants "passed" against nothing. */
  const base = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  ok(!/@media/.test(base), 'the @media strip left one behind, so this proves nothing');
  /* By exact selector, not by substring: `.card\s*\{` also matches the TAIL of
     `.split-row > .card {`, so a substring test passed with the `.card` rule deleted -
     two of the three mutants survived on that alone. */
  const declares = (sel) => {
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(base))) {
      const list = m[1].split(',').map(s => s.trim().replace(/\s+/g, ' '));
      if (list.includes(sel) && /min-width:\s*0/.test(m[2])) return true;
    }
    return false;
  };
  ok(declares('.card'),
     'app.css does not give .card min-width: 0 at every width, so one wide panel '
     + 'widens every card');
  ok(declares('.split-row > .card'),
     '.split-row > .card has no floor of its own, so the flex items keep theirs');
  return 'both grid and flex items may shrink, at every width';
});

check('the 760px layer scrolls the strip, defeats iOS zoom and keeps the grid square', () => {
  /* TWO sources, because the layer is split by ownership and the split is the point:
     everything about the shared chrome (the grid, a card header, the split row, the
     header bar, every focusable control and every read-only dark panel) is in the
     SHARED block so all six apps get one reading of it, while the tab strip, the
     exercise sheet and the run-length field are the practice site's own. A check
     reading only one file would pass while half the layer had been deleted. */
  const read = (f) => fs.readFileSync(path.join(HERE, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const inside = (css, what) => {
    const at = css.indexOf('@media (max-width: 760px)');
    ok(at >= 0, what + ' has no 760px block, so nothing there is mobile-aware');
    return css.slice(css.indexOf('{', at) + 1);   // inside the @media, so the first
                                                  // rule scanned is a real one
  };
  const shared = inside(read('app.css'), 'app.css');
  const own = inside(read('practice.css'), 'practice.css');
  const mob = shared + own;
  /* Every declaration block whose selector LIST carries this selector, concatenated.
     Matching `sel {` directly is what the first draft did, and it reported `body
     select is still under 16px` against a rule that sets it - because the focusable
     controls are deliberately one grouped rule. */
  const rule = (sel) => {
    let out = '';
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(mob))) {
      const list = m[1].split(',').map(s => s.trim().replace(/\s+/g, ' '));
      if (list.includes(sel)) out += m[2] + ';';
    }
    return out;
  };

  // 1. one swipeable row, with Reset pinned inside it rather than scrolled away.
  const tabs = rule('.gh-tabs');
  ok(/overflow-x:\s*auto/.test(tabs) && /flex-wrap:\s*nowrap/.test(tabs),
     '.gh-tabs does not scroll at 760px, so the tab strip makes the whole page wide');
  ok(/position:\s*sticky/.test(rule('.ex-reset')),
     'Reset is not pinned, so the destructive control scrolls out of the strip');

  // 2 & 3. one size across every dark panel, and the editor pair moving together.
  const ta = /font-size:\s*(\d+)px/.exec(rule('body .editor-wrap textarea'));
  ok(ta, 'no rule raises the editor textarea, so iOS zooms the page on the first tap');
  const size = ta;
  ok(+size[1] >= 16,
     'the editor is ' + size[1] + 'px at 760px, so iOS zooms the page on the first tap');
  /* The gutter has to land on the SAME number, whether or not it shares the rule: it
     is scroll-synced to the textarea, so a size on one and not the other slides the
     line numbers off their own lines. */
  const gut = /font-size:\s*(\d+)px/.exec(rule('body .gutter'));
  ok(gut && gut[1] === size[1],
     'the gutter is ' + (gut ? gut[1] + 'px' : 'unset') + ' where the textarea is '
     + size[1] + 'px, so the line numbers slide off their lines');
  ['body select', 'body .num-input'].forEach((sel) => {
    ok(/font-size:\s*1[6-9]px|font-size:\s*[2-9]\dpx/.test(rule(sel)),
       sel + ' is still under 16px, so focusing it zooms the page');
  });
  /* The read-only panels are held to the EDITOR's size rather than to 16 - the claim
     is that the four dark panels read as one thing, so a change to one has to move
     the others or this fails. Neither can be focused, so no iOS rule would catch it. */
  ['body .console-box', 'body .code-out', 'body .asm-listing',
   'body .trace-listing', 'body table.memory-table'].forEach((sel) => {
    const got = /font-size:\s*(\d+)px/.exec(rule(sel));
    ok(got && got[1] === size[1],
       sel + ' is ' + (got ? got[1] + 'px' : 'unset') + ' where the editors are '
       + size[1] + 'px, so one dark panel reads as the odd one out');
  });

  // 4. rows x columns still equals the 36 cells renderModelCard emits.
  const cmp = /\.compare-grid,[\s\S]*?\{([^}]*)\}/.exec(mob);
  ok(cmp, 'the Scoreboard grid is not re-shaped, so it overflows the card');
  const rows = /grid-template-rows:\s*repeat\((\d+)/.exec(cmp[1]);
  const cols = /grid-template-columns:\s*repeat\((\d+)/.exec(cmp[1]);
  ok(rows && cols, 'the mobile compare-grid sets one axis without the other');
  ok(+rows[1] * +cols[1] === 36,
     'the mobile compare-grid is ' + cols[1] + ' x ' + rows[1] + ' = '
     + (+rows[1] * +cols[1]) + ' cells, not the 36 renderModelCard emits');
  return 'strip scrolls, Reset pinned, ' + size[1] + 'px controls, '
       + cols[1] + ' x ' + rows[1] + ' = 36 cells';
});

/* ---- cloud progress: the hub badge and the page's pill are one fact ----
   Nothing else in this suite loads the cloud files, and this is the seam where that
   showed: the verdict the hub reads had exactly one writer (a runBtn listener in
   cloud-sync.js) and no resetBtn one, so Reset cleared the console, dropped the result
   and emptied the waveform while the hub went on reporting the run that had just been
   thrown away. */
check('Reset clears the stored verdict, so the hub badge goes with the pill', () => {
  const dom = makeDom();
  const SLUG = 'd-flip-flop';
  ['codeInput', 'consoleBox', 'runBtn', 'resetBtn', 'exampleSelect', 'fileOpenInput',
   'consoleClearBtn']
    .forEach(id => dom.mk(id, 'div'));
  dom.document.getElementById('codeInput').value = 'module dff(input clk); endmodule';
  dom.document.getElementById('consoleBox').textContent = 'PASS a\nPASS b\nFAIL c';
  dom.window.PRACTICE_SLUG = SLUG;

  /* The three cloud scripts in ONE scope, because that is what a browser gives three
     classic scripts - and cloud-config.js declares a top-level `var`, which is a window
     property there but merely function-scoped inside new Function, so it is bridged
     rather than left undefined (without it CLOUD.configured() is false and every
     assertion below passes vacuously). */
  const body = ['cloud-config.js', 'cloud.js', 'cloud-sync.js']
    .map(f => fs.readFileSync(path.join(HERE, f), 'utf8')).join('\n;\n')
    .replace('var BAERILOG_CLOUD_CONFIG', 'window.BAERILOG_CLOUD_CONFIG');
  new Function('window', 'document', 'localStorage', 'fetch', 'setTimeout', 'clearTimeout',
               'navigator', body)
    (dom.window, dom.document, dom.localStorage,
     () => Promise.resolve({ ok: false }), setTimeout, clearTimeout, { onLine: false });
  ok(dom.window.CLOUD && dom.window.CLOUD.configured(),
     'the cloud layer is not configured, so this check would prove nothing');

  const rec = () => dom.window.CLOUD.load('practice', SLUG);
  ok(!rec(), 'a record exists before anything was clicked');

  dom.document.getElementById('runBtn').dispatch('click');
  const after = rec();
  ok(after && after.verdict, 'Run stored no verdict');
  ok(after.verdict.state === 'fail' && after.verdict.fail === 1 && after.verdict.pass === 2,
     'Run stored ' + JSON.stringify(after.verdict) + ' for 2 PASS and 1 FAIL');
  ok(badgeFor(dom, SLUG) === '1 failing', 'the hub reads ' + badgeFor(dom, SLUG) + ' after a Run');

  dom.document.getElementById('resetBtn').dispatch('click');
  const cleared = rec();
  ok(cleared, 'Reset deleted the row, taking the saved source with it');
  ok(cleared.verdict === null || cleared.verdict === undefined,
     'Reset left the verdict as ' + JSON.stringify(cleared.verdict));
  /* Null rather than a 'none' state, and the distinction is real on exactly one page:
     'none' is what a genuine run of cpu-16bit stores, its testbench printing nothing by
     design, so writing it here would make a discarded run look like a silent one. */
  ok(!(cleared.verdict && cleared.verdict.state === 'none'),
     "Reset stored a 'none' verdict, which is what a real silent run stores");
  ok(cleared.source === 'module dff(input clk); endmodule',
     'Reset threw away the saved source: ' + JSON.stringify(cleared.source));
  ok(badgeFor(dom, SLUG) === 'in progress',
     'the hub still reads ' + badgeFor(dom, SLUG) + ' after a Reset');

  /* The Console's Clear button carries the same obligation, and for the same reason: it
     silences the pill, so a badge still reporting that verdict would be the hub speaking
     for a Console nobody can see any more. Driven here rather than on a booted page
     because this is where the cloud layer is wired up at all. */
  dom.document.getElementById('runBtn').dispatch('click');
  ok(badgeFor(dom, SLUG) === '1 failing', 'the second Run did not restore the badge');
  dom.document.getElementById('consoleClearBtn').dispatch('click');
  const wiped = rec();
  ok(wiped, 'Clear deleted the row, taking the saved source with it');
  ok(wiped.verdict === null || wiped.verdict === undefined,
     'Clear left the verdict as ' + JSON.stringify(wiped.verdict));
  ok(wiped.source === 'module dff(input clk); endmodule',
     'Clear threw away the saved source: ' + JSON.stringify(wiped.source));
  ok(badgeFor(dom, SLUG) === 'in progress',
     'the hub still reads ' + badgeFor(dom, SLUG) + ' after a Clear');
  return 'Run -> 1 failing; Reset and Clear -> in progress, source kept';
});

/* The badge the HUB renders, not the record behind it - index.html owns that rule and
   this reads it through the hub's own renderer. */
function badgeFor(dom, slug) {
  const hub = bootHub(dom);
  const rows = hub.rowsHtml().split('class="gh-row"');
  const row = rows.filter(r => r.indexOf('>' + slug + '<') >= 0)[0] || '';
  const m = /<span class="gh-prog[^"]*">([^<]*)<\/span>/.exec(row);
  return m ? m[1] : '(no badge)';
}

/* ---- the hub ----
   One Primer Box of rows now, a repo file listing, rather than a card per category.
   The failure to guard against is the same as before - a link to a page that does
   not exist - plus one the restyle introduced: the category and level used to be
   the card headings, and they now survive only as Labels on each row, so a row
   that lost them has lost information the hub is the only place to see.

   The rows are one innerHTML string in #hubRows while the header's chips are real
   elements, because the stub does not parse markup - so the row assertions read a
   string and the filter assertions click elements. */
function bootHub(sharedDom) {
  /* The dom is an argument so one check can boot the cloud layer of a practice page and
     the hub in the SAME localStorage, and read the badge the hub actually renders rather
     than the record behind it. */
  const dom = sharedDom || makeDom();
  const box = dom.mk('hubBox');
  const html = fs.readFileSync(path.join(HERE, 'index.html'), 'utf8');
  const body = html.slice(html.lastIndexOf('<scr' + 'ipt>') + 8, html.lastIndexOf('</scr' + 'ipt>'));
  const man = fs.readFileSync(path.join(HERE, 'manifest.js'), 'utf8');
  new Function('document', 'window', man.replace(/\bvar /g, 'window.') + '\n'
               + 'var PRACTICE_MANIFEST = window.PRACTICE_MANIFEST;'
               + 'var PRACTICE_CATEGORIES = window.PRACTICE_CATEGORIES;' + body)(dom.document, dom.window);
  const id = s => dom.document.getElementById(s);
  const chip = (wrap, value) => {
    const w = id(wrap);
    const hit = w.children.filter(c => c.getAttribute('data-value') === value);
    ok(hit.length === 1, 'no ' + wrap + ' chip for ' + value);
    return hit[0];
  };
  return {
    dom, box, entries: dom.window.PRACTICE_MANIFEST,
    rowsHtml: () => id('hubRows').innerHTML,
    nRows: () => id('hubRows').innerHTML.split('class="gh-row"').length - 1,
    count: () => id('hubCount').textContent,
    emptyShown: () => id('hubEmpty').style.display !== 'none',
    clear: () => id('hubClear').click(),
    chip, id
  };
}

check('the hub lists every problem, with its labels, linking only to real pages', () => {
  const h = bootHub();
  const entries = h.entries;
  const out = h.rowsHtml();
  const links = (out.match(/href="([^"]+)"/g) || []).map(s => s.slice(6, -1));
  ok(links.length === entries.length, links.length + ' links for ' + entries.length + ' problems');
  for (const l of links) {
    ok(fs.existsSync(path.join(HERE, l)), 'the hub links to ' + l + ', which does not exist');
  }
  const rows = h.nRows();
  ok(rows === entries.length, rows + ' rows for ' + entries.length + ' problems');
  // Counted exactly, so the `gh-labels` wrapper cannot be mistaken for a label.
  const cats = out.split('class="gh-label"').length - 1;
  const lvls = out.split('class="gh-label level"').length - 1;
  ok(cats === entries.length, cats + ' category labels for ' + entries.length + ' rows');
  ok(lvls === entries.length, lvls + ' level labels for ' + entries.length + ' rows');
  for (const e of entries) {
    // The renderer HTML-escapes, so "Memory & Datapath" is in the markup as
    // "Memory &amp; Datapath" - the expectation has to escape the same way.
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    ok(out.includes('>' + esc(e.category) + '<'), 'no category label for ' + e.slug);
    ok(out.includes('Level ' + e.level + '<'), 'no level label for ' + e.slug);
  }
  // The header is elements now, so it is found among the Box's children rather
  // than by a string match on markup that no longer exists.
  const head = h.box.children.filter(c => c.classList.contains('gh-box-header'));
  ok(head.length === 1, head.length + ' box headers');
  ok(/problems$/.test(h.count()), 'the header does not carry a problem count');
  ok(!h.emptyShown(), 'the empty state is showing with all rows present');
  return rows + ' rows, ' + (cats + lvls) + ' labels, all links resolving';
});

/* The filter's numbers are DERIVED from the manifest rather than written down, so
   re-categorising a problem cannot make this fail for the wrong reason. Level is
   decided by category in this manifest, which is exactly why the empty case is
   worth asserting: "Basics + Level 2" is one click away from a real user. */
check('the Category/Level chips filter, AND across the two rows, OR within one', () => {
  const h = bootHub();
  const all = h.entries.length;
  const nCat = c => h.entries.filter(e => e.category === c).length;
  const cats = (h.dom.window.PRACTICE_CATEGORIES || []).slice();
  const [c1, c2] = cats;
  const lvl = String(Math.max.apply(null, h.entries.map(e => e.level)));

  ok(h.nRows() === all, 'load state shows ' + h.nRows() + ' of ' + all + ' rows');
  ok(h.count() === all + ' problems', 'unfiltered count reads "' + h.count() + '"');

  h.chip('hubCatChips', c1).click();
  ok(h.nRows() === nCat(c1), c1 + ' shows ' + h.nRows() + ', expected ' + nCat(c1));
  ok(h.count() === nCat(c1) + ' of ' + all + ' problems',
     'filtered count reads "' + h.count() + '" - it must say what it is out of');

  h.chip('hubCatChips', c2).click();
  ok(h.nRows() === nCat(c1) + nCat(c2), 'two categories show ' + h.nRows()
     + ', expected the union ' + (nCat(c1) + nCat(c2)));

  // The highest level holds only the last category, so ANDing it with the first
  // two categories is empty - under OR it would be the union instead.
  h.chip('hubLevelChips', lvl).click();
  const cross = h.entries.filter(e => (e.category === c1 || e.category === c2)
                                   && String(e.level) === lvl).length;
  ok(cross === 0, 'the manifest no longer makes this combination empty');
  ok(h.nRows() === 0, 'Level ' + lvl + ' AND ' + c1 + '/' + c2 + ' shows ' + h.nRows()
     + ' rows, so the two chip rows are being OR-ed');
  ok(h.emptyShown(), 'nothing matched and the empty state is not showing');
  ok(h.count() === '0 of ' + all + ' problems', 'empty count reads "' + h.count() + '"');

  h.clear();
  ok(h.nRows() === all, 'Clear left ' + h.nRows() + ' of ' + all + ' rows');
  ok(h.count() === all + ' problems', 'Clear left the count reading "' + h.count() + '"');
  ok(!h.emptyShown(), 'Clear left the empty state showing');

  // A chip must unpress, or a filter is a one-way trip until Clear.
  const cc = h.chip('hubCatChips', c1);
  cc.click(); cc.click();
  ok(h.nRows() === all, 'clicking a chip twice left ' + h.nRows() + ' of ' + all + ' rows');
  return cats.length + ' category chips, filtering ' + all + ' problems';
});

/* aria-pressed and the .on class are two encodings of one bit, written together in
   paintChips. Asserting both in both directions is what stops one being changed
   alone - the same rule the Scoreboard's flag casing is held to. */
check('every chip agrees with its own aria-pressed, pressed and not', () => {
  const h = bootHub();
  const wraps = ['hubCatChips', 'hubLevelChips'];
  let n = 0;
  const audit = where => {
    for (const w of wraps) {
      for (const b of h.id(w).children) {
        const on = b.classList.contains('on'), aria = b.getAttribute('aria-pressed');
        ok(aria === (on ? 'true' : 'false'),
           w + '/' + b.getAttribute('data-value') + ' is ' + (on ? 'on' : 'off')
           + ' with aria-pressed=' + aria + ' ' + where);
        n++;
      }
    }
  };
  audit('at load');
  for (const w of wraps) for (const b of h.id(w).children) b.click();
  audit('with every chip pressed');
  const anyOn = wraps.some(w => h.id(w).children.some(b => b.classList.contains('on')));
  ok(anyOn, 'clicking every chip pressed none of them');
  return n + ' chip states, all agreeing';
});

console.log(JSON.stringify(results));
"""


def manifest_entries():
    text = open(os.path.join(HERE, 'manifest.js'), encoding='utf-8').read()
    return json.loads(re.search(r'var PRACTICE_MANIFEST = (\[.*?\]);', text, re.S).group(1))


def report(rows, title):
    print('\n== %s' % title)
    bad = 0
    for status, name, detail in rows:
        if status != 'PASS':
            bad += 1
        print('  %-4s  %-64s %s' % (status, name, detail))
    return bad


def main():
    only = ''
    if '-k' in sys.argv:
        only = sys.argv[sys.argv.index('-k') + 1]

    driver = (ENGINE_DRIVER
              .replace('TOOLS', json.dumps(TOOLS))
              .replace('APP_DIR', json.dumps(HERE))
              .replace('ONLY', json.dumps(only)))
    bad = report(json.loads(node(driver).strip().split('\n')[-1]),
                 'exercises (engine, no DOM)')

    # One page is booted per run, and which one is the point: the default is the
    # heaviest exercise that carries memory images, since a page whose design needs
    # no $readmem cannot show whether attaching works.
    slug = 'cpu-8bit'
    if only:
        hits = [e['slug'] for e in manifest_entries() if only in e['slug']]
        if hits:
            slug = hits[0]
    driver = (PAGE_DRIVER
              .replace('TOOLS', json.dumps(TOOLS))
              .replace('APP_DIR', json.dumps(HERE))
              .replace('ALL_SLUGS', json.dumps([e['slug'] for e in manifest_entries()
                                                if not only or only in e['slug']]))
              .replace('SYNTH_SLUGS_JSON', json.dumps([e['slug'] for e in manifest_entries()
                                                       if e.get('synthesis')
                                                       and (not only or only in e['slug'])]))
              .replace('SLUG_JSON', json.dumps(slug)))
    bad += report(json.loads(node(driver).strip().split('\n')[-1]),
                  'a page, booted against the stub DOM (%s)' % slug)

    # The two drivers each carry MODEL_CHECKED, and they are compared here rather
    # than trusted: a slug added to one and not the other would silently lose either
    # its oracle or its permission to be stopped by the Scoreboard.
    lists = re.findall(r"const MODEL_CHECKED = (\[[^\]]*\]);", ENGINE_DRIVER + PAGE_DRIVER)
    if len(set(lists)) != 1:
        print('\nMODEL_CHECKED differs between the two drivers: %s' % ' vs '.join(lists))
        bad += 1

    # The TESTBENCH marker's pattern exists in four places that cannot share a binding - the two
    # drivers, simulator.html (which splits the two editors on it) and synthesis.html (which
    # truncates there) - so they are compared rather than trusted. Two apps disagreeing about
    # where one document splits is the failure this consolidation exists to prevent, and it would
    # be invisible: each file works perfectly on a marker of the shape its own copy expects.
    pats = {}
    for label, path_, name in (('engine driver', None, 'TB_MARKER_RE'),
                               ('page driver', None, 'TB_MARKER_RE'),
                               ('simulator.html', 'simulator.html', 'TB_MARKER_RE'),
                               ('synthesis.html', 'synthesis.html', 'TESTBENCH_MARKER')):
        text = (ENGINE_DRIVER if label == 'engine driver' else
                PAGE_DRIVER if label == 'page driver' else
                open(os.path.join(HERE, path_), encoding='utf-8').read())
        m = re.search(r"const %s = (/.*?/[a-z]*);" % name, text)
        pats[label] = m.group(1) if m else 'MISSING'
    # the drivers' copies are JS source inside a Python raw string, so they read identically
    if len(set(pats.values())) != 1:
        print('\nthe TESTBENCH marker pattern differs between its copies:')
        for k, v in pats.items():
            print('  %-16s %s' % (k, v))
        bad += 1

    print('\n%s' % ('all checks passed' if not bad else '%d CHECK(S) FAILED' % bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
