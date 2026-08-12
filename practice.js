/* practice.js - the behaviour half of a practice page.
 *
 * Runs AFTER app.js, which is the whole point: app.js's top-level `let`/`const`
 * live in the shared global lexical scope, so this file can call the simulator's
 * own setEditorText / runSimulation / renderMemFileList and write into
 * attachedMemFiles directly. That is what lets app.js stay a verbatim copy of
 * simulator/index.html's script body with no exports bolted on.
 *
 * NOTHING RUNS ON LOAD. app.js has loaded EXAMPLES' first entry into the editor and
 * this file replaces it with the exercise skeleton, but no simulation happens until
 * Run is pressed - so the Console, Waveform and Scoreboard show their own empty
 * states rather than a result belonging to a design nobody asked about. That used to
 * be the other way round: app.js auto-ran the D flip-flop example and this file ran
 * the starter over it, and both runs are gone (the first from the simulator itself,
 * the second from here). Two things elsewhere in this file exist because of it - the
 * Scoreboard is hidden until a run decides its own visibility, and the tab strip is
 * rebuilt afterwards for the same reason.
 */
'use strict';

(function () {
  var ex = PRACTICE_EX;                       // set by shell.js
  var backdrop = document.getElementById('exBackdrop');
  var startBtn = document.getElementById('exStartBtn');
  var closeBtn = document.getElementById('exCloseBtn');
  var hasRun = false;                         // has Run (or Reset) been pressed yet

  /* The waveform's colours are the app's own business now: style.css carries the
     tokens and the simulator reads them in readTheme(), so the PALETTE mutation
     that used to live here is gone - and with it the light-plot-in-dark-mode
     compromise, since the plot's text and gridlines follow the mode too. */

  /* ---- 1. memory images this exercise's design reads with $readmemh/$readmemb.
     Written into the map the Simulator resolves against (never reassigned - it is
     passed by reference into every run), then the chips are re-rendered because
     renderMemFileList is not called at startup. ---- */
  if (ex && ex.memFiles) {
    Object.keys(ex.memFiles).forEach(function (name) {
      attachedMemFiles[name] = ex.memFiles[name];
    });
    renderMemFileList();
  }

  /* ---- 2. one design per page, so the example picker is noise. Hidden rather
     than removed: app.js populates and reads it, and hiding costs nothing. ---- */
  var picker = document.getElementById('exampleSelect');
  if (picker) {
    picker.style.display = 'none';
    var label = picker.previousElementSibling;   // the "Select from Examples:" span
    if (label && label.className === 'time-label') label.style.display = 'none';
  }

  /* The Memory Viewer is opt-in per problem (manifest.js's `memory` flag), for the
     same reason: on a design with no memory array it renders its own "No memories
     declared in this design." empty state, which is honest but is nineteen panels
     of nothing across twenty pages. Hidden rather than removed, because app.js
     renders into it unconditionally - renderMemorySelect and renderMemoryTable
     would both have to be taught about the practice site otherwise. */
  var memCard = document.getElementById('card-memory');
  if (memCard && !(PRACTICE_META && PRACTICE_META.memory)) memCard.style.display = 'none';

  /* The Scoreboard decides its own visibility inside renderModelCard, which only
     runs during a simulation - and nothing simulates on load any more. So it is
     hidden here and revealed by the first Run, on whichever pages that card's own
     rule keeps. Leaving it visible would put the card on all twenty pages and then
     make it vanish on the first Run for the seventeen with no CPU evidence, and the
     tab strip below would have built a Model tab pointing at it. */
  var modelCard = document.getElementById('card-model');
  if (modelCard) modelCard.style.display = 'none';

  /* The two cards that have nothing to show until something has run are FOLDED rather
     than hidden: the Waveform Viewer and the Module Hierarchy beside it. Folded keeps
     their headers on the page, so the page reads as a tool waiting for input rather
     than one missing two panels, and their tabs stay live (a fold does not change
     `style.display`, which is what practice.js's strip tests).

     Unfolded by the first Run - and only the first, so a reader who folds the waveform
     back up afterwards is not overruled on the next one. */
  var FOLD_UNTIL_RUN = ['card-wave', 'card-hierarchy'];
  function foldCard(id, folded) {
    var card = document.getElementById(id);
    if (!card) return;
    card.classList.toggle('collapsed', folded);
    // app.js's own [data-collapse] handler owns this glyph, so it is written the same
    // way here rather than left pointing the wrong direction.
    var btn = card.querySelector('.card-collapse-btn');
    if (btn) btn.textContent = folded ? '▸' : '▾';
  }
  FOLD_UNTIL_RUN.forEach(function (id) { foldCard(id, true); });
  /* The Module Hierarchy card is also the thing the waveform's hierarchy toggle reveals,
     and app.js applies that toggle's persisted state before this file runs. So a reader
     who asks to see the panel before running would be handed a folded header - a dead
     control. Asking for it counts as wanting it, so the toggle unfolds it. */
  (function () {
    var hierBtn = document.getElementById('hierarchyToggleBtn');
    if (hierBtn) hierBtn.addEventListener('click', function () { foldCard('card-hierarchy', false); });
  })();

  /* ---- 3. the skeleton. NOT followed by a run: a simulation happens when Run is
     pressed and not before, so the page comes up with the starter in the editor and
     every result panel showing its own empty state. ---- */
  if (ex && ex.starter) {
    /* The run length has to be set here, and this is not optional. app.js loaded an
       example whose $finish time IS statically known, so loadExample's
       tryApplyAutoFinishTime wrote that number into the field and disabled it; the
       other branch only re-enables the field, it does not restore a default. An
       exercise whose testbench waits on @(negedge clk) has no statically known finish
       time, so it would inherit the superseded example's cap - measured: 60 time
       units, which truncated a 160-unit testbench to its first six checks and
       reported them as the whole verdict. Note this survived the auto-run's removal
       unchanged, because the cap comes from the example LOAD, not from a run.
       tryApplyAutoFinishTime still overrides it whenever it CAN work the time out. */
    var maxInput = document.getElementById('maxTimeInput');
    if (maxInput) maxInput.value = String(ex.maxTime || 2000);
    setEditorText(ex.starter);
    resetEditorHierarchyState();
    tryApplyAutoFinishTime(codeInput.value);
  }

  /* ---- 4. the verdict pill.
     Derived from the console text rather than from anything the checker is asked
     to expose, so any testbench that prints PASS / FAIL lines gets a verdict for
     free. A design whose checker prints neither says so ("no checks reported")
     instead of claiming a pass: the CPU exercises are judged by the CPU / Memory
     Model card, which has its own verdict of its own. ---- */
  var verdict = document.createElement('span');
  verdict.className = 'ex-verdict';
  verdict.id = 'exVerdict';
  var consoleCard = document.getElementById('card-console');
  var consoleHead = consoleCard ? consoleCard.querySelector('h2') : null;
  if (consoleHead) {
    // Before the layout buttons, not after them: both want margin-left:auto, and
    // whichever comes first takes the slack - so appending would put the pill out
    // past the controls at the very edge.
    var controls = consoleHead.querySelector('.header-controls');
    if (controls) consoleHead.insertBefore(verdict, controls);
    else consoleHead.appendChild(verdict);
  }

  function countOf(text, word) {
    var m = text.match(new RegExp('\\b' + word + '\\b', 'g'));
    return m ? m.length : 0;
  }

  function refreshVerdict() {
    var text = consoleBox.textContent || '';
    var pass = countOf(text, 'PASS');
    var fail = countOf(text, 'FAIL');
    verdict.className = 'ex-verdict';
    /* Nothing has run yet: the pill says nothing rather than "no checks reported".
       The two are different claims and the difference is the whole point - after a
       run, "no checks reported" is a real verdict (cpu-16bit's testbench prints
       nothing deliberately, and the Scoreboard is its checker), so a pill reading it
       before anyone pressed Run would be describing a run that never happened. */
    if (!hasRun) { verdict.textContent = ''; verdict.style.display = 'none'; return; }
    verdict.style.display = '';
    if (fail > 0) {
      verdict.className += ' fail';
      verdict.textContent = fail + ' of ' + (pass + fail) + ' checks failing';
    } else if (pass > 0) {
      verdict.className += ' pass';
      verdict.textContent = 'all ' + pass + ' checks passing';
    } else {
      verdict.textContent = 'no checks reported';
    }
  }
  /* Registered after app.js's own handlers, and runSimulation is synchronous, so the
     console is already written by the time these fire. Reset counts as a run for the
     pill's purposes: it clears the console, so leaving the previous verdict up would
     have it describing output that is no longer there. */
  ['runBtn', 'resetBtn'].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', function () {
      var first = !hasRun;
      hasRun = true;
      refreshVerdict();
      refreshTabs();
      if (first) {
        FOLD_UNTIL_RUN.forEach(function (id) { foldCard(id, false); });
        /* The waveform was drawn while its card was folded, i.e. against a canvas of no
           width - and `canvas { width: 100% !important }` means a stale drawing is
           STRETCHED rather than clipped, leaving waveLayout's plotX0/plotW describing
           geometry the click handlers no longer measure. Same obligation the hierarchy
           panel and the full-bleed expand carry in app.js: change the container, redraw. */
        if (typeof lastResult !== 'undefined' && lastResult) drawWaveform(lastResult);
      }
    });
  });
  refreshVerdict();

  /* ---- 5. the tab strip.
     Built here rather than in shell.js because which tabs exist depends on which
     cards this page actually has, and that is only settled once the design has run:
     the Memory Viewer is opt-in per problem, and the CPU / Memory Model card decides
     its own visibility inside renderModelCard. A tab pointing at a card that is not
     there is a dead control, so a tab is only rendered when its target is real.

     And since nothing runs on load, "once the design has run" is now a real event
     rather than something that has already happened by the time this file executes -
     so the strip is REBUILT after each Run. The Model card is hidden until then, so
     without the rebuild its tab would never appear on the pages that do keep it.
     Rebuilding preserves which tab is lit, or pressing Run would silently move the
     selection back to Exercise.

     The Exercise tab keeps the id exReopenBtn - it IS the old header button, moved
     into the strip, so everything already wired to that id keeps working. ---- */
  var TABS = [
    { id: 'exReopenBtn', label: 'Exercise', icon: 'book', sheet: true },
    { id: 'tabDesign', label: 'Design', icon: 'code', card: 'card-editor' },
    { id: 'tabConsole', label: 'Console', icon: 'term', card: 'card-console' },
    { id: 'tabWave', label: 'Waveform', icon: 'pulse', card: 'card-wave' },
    { id: 'tabMemory', label: 'Memory', icon: 'db', card: 'card-memory' },
    { id: 'tabModel', label: 'Model', icon: 'chip', card: 'card-model' }
  ];
  var tabStrip = document.getElementById('exTabs');
  var tabButtons = [];

  function cardIsOnThePage(id) {
    var el = document.getElementById(id);
    return !!el && el.style.display !== 'none';
  }

  function refreshTabs() {
    if (!tabStrip) return;
    /* Only this file's own tabs are rebuilt. practice-synth.js appends two more of
       its own, whose cards exist for as long as the page does, so they are left
       exactly where they are - the alternative is a strip that reorders itself on
       every Run. */
    var lit = tabButtons.filter(function (b) { return b.classList.contains('selected'); })
                        .map(function (b) { return b.id; })[0];
    tabButtons.forEach(function (b) { b.remove(); });
    tabButtons = [];
    var mine = [];
    TABS.forEach(function (t) {
      if (t.card && !cardIsOnThePage(t.card)) return;
      var b = document.createElement('button');
      b.id = t.id;
      b.className = 'gh-tab';
      b.innerHTML = (ICON[t.icon] || '') + '<span>' + t.label + '</span>';
      b.setAttribute('type', 'button');
      b.addEventListener('click', function () {
        // Every .gh-tab in the strip, not the closure list: practice-synth.js appends
        // two more once its cards exist, and a closure would leave two tabs lit at once.
        tabStrip.querySelectorAll('.gh-tab').forEach(function (o) { o.classList.remove('selected'); });
        b.classList.add('selected');
        if (t.sheet) { openSheet(); return; }
        var card = document.getElementById(t.card);
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
      });
      mine.push(b);
      tabButtons.push(b);
    });
    // Ahead of anything another file appended, so the strip reads in page order.
    var first = tabStrip.children[0] || null;
    mine.forEach(function (b) { tabStrip.insertBefore(b, first); });
    /* Restore the lit tab, and note neither list may be filtered with Array.filter:
       querySelectorAll returns a NodeList in a real browser, which has forEach but no
       filter - the stub DOM's array would have hidden that. */
    var keep = null;
    tabButtons.forEach(function (b) { if (b.id === lit) keep = b; });
    if (keep) { keep.classList.add('selected'); return; }
    var anyLit = false;
    tabStrip.querySelectorAll('.gh-tab').forEach(function (b) {
      if (b.classList.contains('selected')) anyLit = true;
    });
    if (!anyLit && tabButtons.length) tabButtons[0].classList.add('selected');
  }
  refreshTabs();
  var reopenBtn = document.getElementById('exReopenBtn');

  /* ---- 6. the sheet. Four ways out (Get Started!, the ✕, Escape, the backdrop)
     and one way back in (the Exercise tab). ---- */
  function openSheet() {
    backdrop.classList.add('open');
    document.body.classList.add('ex-sheet-open');
    if (startBtn.focus) startBtn.focus();
  }
  function closeSheet() {
    backdrop.classList.remove('open');
    document.body.classList.remove('ex-sheet-open');
    if (codeInput.focus) codeInput.focus();
  }
  startBtn.addEventListener('click', closeSheet);
  closeBtn.addEventListener('click', closeSheet);
  if (reopenBtn) reopenBtn.addEventListener('click', openSheet);
  // Only the backdrop itself - a click that lands on the sheet must not dismiss it.
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closeSheet();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) closeSheet();
  });
  // shell.js builds the sheet already open, so it covers the page from the moment
  // it exists rather than after a repaint. This is where body scroll gets locked
  // and focus lands, which is why it is re-opened rather than assumed.
  openSheet();

  // Named for the harness, which drives these paths without a browser.
  window.PRACTICE_API = {
    refreshVerdict: refreshVerdict,
    openSheet: openSheet,
    closeSheet: closeSheet,
    isSheetOpen: function () { return backdrop.classList.contains('open'); },
    hasRun: function () { return hasRun; },
    /* Every tab in the strip, not just this file's: practice-synth.js appends its
       own, and a harness asking "what can be clicked here" wants all of them. */
    tabs: function () {
      var ids = [];
      if (tabStrip) {
        tabStrip.querySelectorAll('.gh-tab').forEach(function (b) { ids.push(b.id); });
      }
      return ids;
    }
  };
})();
