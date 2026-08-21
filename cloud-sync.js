/* cloud-sync.js - the glue between an app's editor and CLOUD. One file for all
 * four apps, because what they need is identical: seed the editor from whatever
 * was saved, save it back as it is edited, and never lose either copy.
 *
 * WHICH APP THIS IS, IS DECLARED, NOT DETECTED. Each host sets `CLOUD_APP` in a
 * one-line inline script, exactly as a practice page already declares
 * PRACTICE_SLUG. Sniffing for a global (`EXAMPLES` for the simulator, `TARGETS`
 * for the compiler) would work today and would silently pick the wrong app the
 * first time two of them shared a name - which is not hypothetical here, since
 * the simulator and the synthesizer already collide on six top-level names.
 *
 * LOADS LAST, and that ordering is load-bearing on a practice page: practice.js
 * seeds the exercise skeleton into the editor, so restoring saved work has to
 * happen after it or the skeleton overwrites the learner's own answer a moment
 * after they see it.
 *
 * DOES NOTHING WITHOUT A PROJECT. Every entry point below is guarded on
 * CLOUD.configured(), so an unconfigured checkout runs the same code paths and
 * takes none of them. Note the local half is guarded too: writing to
 * localStorage under a key nobody reads back would be storage this feature never
 * admits to using.
 */
'use strict';

(function () {
  if (!window.CLOUD || !window.CLOUD.configured()) return;

  /* ---- which document is open ----------------------------------------- */

  var app = window.CLOUD_APP ||
            (typeof window.PRACTICE_SLUG === 'string' ? 'practice' : null);
  if (!app) return;

  /* Which document, within that app. A page that HAS more than one says so by declaring
     CLOUD_ITEM - a learn topic does, and so its progress is its own row rather than every
     topic sharing one. A practice page predates that declaration and names its document
     with PRACTICE_SLUG, which is read here rather than migrated: twenty rows already exist
     under those keys.

     The three menu apps have a single editor and no notion of a document, so they use one
     fixed name - 'default' rather than the app's own name, so that adding a document picker
     later is a new `item` and not a migration of this one. */
  var item = window.CLOUD_ITEM
             || (app === 'practice' ? String(window.PRACTICE_SLUG || '') : 'default');
  if (!item) return;

  /* Some pages have an editor but no DOCUMENT in it. A learn topic seeds its design from
     topics/<slug>.js and the prose around it is ABOUT that design, so the text is the
     lesson's rather than the reader's: saving it would be storing something nobody typed,
     and restoring it would silently replace the code the article explains with an older
     edit. That is not a hypothetical - it is what put a stale testbench back on a topic
     page after learn.js had seeded the right one.

     So such a page declares CLOUD_NO_SOURCE, and this file stores and restores no source
     for it. The VERDICT seam is deliberately left intact: a topic can still get a row of
     its own once it has something to report, and that row simply carries no `source`. */
  var storesSource = !window.CLOUD_NO_SOURCE;

  /* AND A PAGE MAY HAVE NO EDITOR AT ALL. `lego-logic` is prose and illustrations, so learn.js
     removes every card - the editor's included - before this file runs, and `codeInput` is not in
     the document by the time it looks. Such a page stores no source either, so there is nothing
     to read or write; every use of `editor` below is therefore guarded, and without that the
     `input` listener alone threw and took the rest of this file with it - the pull, the conflict
     dialog and the quiz hook. */
  var editor = document.getElementById('codeInput');
  if (!editor && storesSource) return;

  /* ---- reading and writing the editor --------------------------------- */

  /* THE CHECKS ARE NOT THE READER'S WORK. On a page whose Testbench Editor is READ-ONLY -
     every practice page, see practice.js - a restore takes only the DESIGN half of the
     stored document and keeps the testbench the page seeded. Two reasons, and the second
     is why this is a repair rather than a tidy-up:

       - a card nobody can type in cannot have been edited, so a stored copy of it carries
         no information about what the reader did; and
       - a record saved while that card was momentarily EMPTY stores a document with a
         marker and nothing after it. One browser's execCommand really did produce that
         (see setTextIn's own note), and once such a record exists - locally or on the
         server - restoring it blanks the card on every single load and pushes the blank
         back, so the page can never heal itself from its own seed. Grafting the stored
         design onto the page's own testbench makes an old bad record harmless.

     The marker is matched here rather than imported because app.js keeps it in a local
     const; it is the same line the two editors split on. A stored document with no marker
     at all - anything saved before the split - is a design half already, which is exactly
     what the fallback returns. */
  var TB_MARKER = /^[ \t]*\/\/[ \t]*=+[ \t]*TESTBENCH[ \t]*=+[ \t]*$/m;
  function designHalfOf(text) {
    var m = TB_MARKER.exec(text || '');
    return m ? text.slice(0, m.index) : (text || '');
  }
  function keepsItsOwnTestbench() {
    var tb = document.getElementById('tbInput');
    return !!(tb && tb.readOnly);
  }

  /* setEditorText exists in the simulator and therefore on the twenty practice
     pages, and it matters: it writes through document.execCommand('insertText')
     so the textarea's NATIVE UNDO STACK SURVIVES. Assigning .value wipes it, and
     the undo stack is the last line of defence for an edit that went somewhere
     unexpected - which is precisely what restoring a document from another
     machine is. The synthesizer and the compiler have no such helper and assign
     .value directly throughout, so there this is no worse than what they
     already do to themselves. */
  function setText(text) {
    /* THE GRAFT READS THIS PAGE'S OWN DOCUMENT, so it is behind `storesSource` like every other
       reach for the editor's text here. On a page that stores none there is no document of the
       reader's to graft a testbench off, and `restore` already refuses to run at all - this is
       the same claim stated where the read happens, so no single line has to be trusted to
       protect the other. It is one statement rather than a nested `if` because the rule is
       checkable that way: test_cloud.py requires every use of `getText()` to name the flag in
       its own statement, which is what caught this line reaching for the editor unconditionally. */
    var mine = (storesSource && keepsItsOwnTestbench()) ? getText() : null;
    if (mine !== null) {
      var m = TB_MARKER.exec(mine || '');
      if (m) text = designHalfOf(text) + mine.slice(m.index);
    }
    /* loadFullSource splits a whole document across the two editors AND resets the
       module browser, which is what a restore has to do: writing setEditorText
       alone puts the whole file in the DESIGN editor, leaving a page that claims
       the file has no testbench section. Both are function declarations, so both
       really are on `window` - see currentFullSource above. */
    if (typeof window.loadFullSource === 'function') { window.loadFullSource(text); return; }
    if (typeof window.setEditorText === 'function') window.setEditorText(text);
    else if (editor) editor.value = text;
  }

  /* The simulator keeps the authoritative full document in `editorFullSource`
     while the module browser is showing a single module, and since the design /
     testbench split it keeps only HALF of it in the textarea - so reading the
     textarea would save the design and lose the testbench.

     `currentFullSource` is a function precisely so that this can reach it: a
     function declaration becomes a property of `window`, a top-level `let` does
     not. Reading `window.editorFullSource` is what this used to do, and it was
     `undefined` in every browser while looking perfectly correct, so it silently
     took the fallback below. It merges the visible text back first - the same
     call Run, Save and Copy each make for the same reason. */
  function getText() {
    if (typeof window.currentFullSource === 'function') {
      try { return window.currentFullSource(); } catch (e) { /* fall through */ }
    }
    if (typeof window.spliceEditorChangesBack === 'function') {
      try { window.spliceEditorChangesBack(); } catch (e) { /* fall through to the textarea */ }
    }
    return editor ? editor.value : '';
  }

  /* A document saved before the design/testbench split has no marker, because at
     the time it was written getText() was silently saving only the design half.
     Restoring one as-is puts a markerless document on screen: everything in the
     design editor, and a Testbench card correctly reporting there is nothing to
     split on. The work is not lost - it is the half that was saved - but the
     testbench it was written against is missing.

     So a markerless restore is REPAIRED against the exercise's own starter, which
     is the authority on where this problem's boundary is and what its testbench
     says. Three rules make that safe:

       - it only fires when the stored copy has no marker AND the starter does, so
         a document saved since the fix is passed through untouched;
       - the design half is the STORED text, never the starter's - that is the
         learner's answer and the whole point of restoring it;
       - it is a repair of what is shown, not a rewrite of what is stored. The
         saved record is left alone until the next ordinary save, so a page opened
         and closed changes nothing on the server.

     A page with no exercise data (the simulator, an app with one editor) has no
     starter to repair against and keeps the document exactly as stored. */
  function repairSplit(text) {
    if (typeof text !== 'string') return text;
    var MARK = /^[ \t]*\/\/[ \t]*=+[ \t]*TESTBENCH[ \t]*=+[ \t]*$/m;
    if (MARK.test(text)) return text;                       // saved since the split: as-is
    var ex = window.PRACTICE_EX;
    var starter = ex && typeof ex.starter === 'string' ? ex.starter : '';
    var m = starter ? MARK.exec(starter) : null;
    if (!m) return text;                                    // nothing to repair against
    var tail = starter.slice(m.index);                      // marker + blank line + testbench
    return text.replace(/\s*$/, '\n\n') + tail;
  }

  /* Restoring writes the editor, which fires the very handler that saves it. The
     guard is a flag rather than removing and re-adding the listener, because the
     simulator's own change plumbing may fire more than once per write. */
  var restoring = false;
  function restore(text) {
    if (typeof text !== 'string') return;
    /* A PAGE THAT STORES NO SOURCE RESTORES NONE, and this is the one place that has to say so
       rather than each of the three callers. Two of them were NOT gated - the seed at load and
       CLOUD_ON_ADOPT - so a learn topic holding an old record with a `source` in it (one written
       before CLOUD_NO_SOURCE existed) would put that stale design over the one learn.js had just
       seeded, on every load. That is not a hypothetical failure: it is the exact bug the
       CLOUD_NO_SOURCE note above records, reachable again through a path that never got the
       guard. One writer, at the entry, so no new call site can miss it. */
    if (!storesSource) return;
    text = repairSplit(text);
    restoring = true;
    try {
      setText(text);
      /* Both are the simulator's and both optional. setText already reset the
         module browser when it went through loadFullSource, so this only matters
         on the fallback path - it is idempotent either way. The run length is
         derived from the WHOLE document, not from the textarea: since the split
         the textarea is the design half, where a testbench's $finish is not. */
      if (typeof window.loadFullSource !== 'function'
          && typeof window.resetEditorHierarchyState === 'function') window.resetEditorHierarchyState();
      if (typeof window.tryApplyAutoFinishTime === 'function') window.tryApplyAutoFinishTime(text);
    } finally {
      /* Cleared on a timeout, not immediately: setEditorText's execCommand
         dispatches its input event asynchronously in some browsers, so clearing
         the flag on this tick would let that event through as a fresh edit and
         restamp updated_at - making a restored document look newer than the copy
         it came from. */
      window.setTimeout(function () { restoring = false; }, 0);
    }
  }

  /* ---- saving --------------------------------------------------------- */

  /* CLOUD.save writes localStorage synchronously and coalesces the network push
     itself, so this can be called on every keystroke without a debounce here.
     Keeping the debounce in one place is deliberate: two of them compose into a
     delay nobody chose. */
  function saveSource() {
    if (restoring) return;
    if (storesSource) window.CLOUD.save(app, item, { source: getText() });
  }

  if (editor) editor.addEventListener('input', saveSource);

  /* Choosing an example, or opening a file, replaces the document by assigning
     .value - which fires no `input` event, so without this the new text is not
     saved until the next keystroke and a reload would resurrect the old one.
     `change` on the picker and a late read after the file handler both cover it. */
  var picker = document.getElementById('exampleSelect') || document.getElementById('isaSelect');
  if (picker) picker.addEventListener('change', function () { window.setTimeout(saveSource, 0); });
  var opener = document.getElementById('fileOpenInput');
  if (opener) opener.addEventListener('change', function () { window.setTimeout(saveSource, 250); });

  /* ---- the verdict, on a practice page only --------------------------- */

  /* Counted from the console the same way practice.js's pill counts it, and for
     the same reason: any testbench printing PASS/FAIL lines is scored for free.
     It is recomputed here rather than read off the pill because the pill is
     display text ("3 of 6 checks failing") and parsing a sentence back into two
     numbers is the kind of coupling that breaks silently when the wording moves.
     Deliberately NOT shared with practice.js: this is four lines, and reaching
     into that file for them would make the pill's rendering and the stored
     verdict one thing that has to change together. */
  function countOf(text, word) {
    var m = text.match(new RegExp('\\b' + word + '\\b', 'g'));
    return m ? m.length : 0;
  }

  if (app === 'practice') {
    /* BOTH run buttons on a synthesis page: Run Simulation, and the netlist card's Run
       Gate-level Simulation. A gate-level run replaces the panels and the pill, so the
       stored verdict has to follow them or the hub would report a run that is no longer
       on screen. Safe to bind here because practice-synth.js builds that button at load,
       several script tags before this file - and its own handler is registered first, so
       the console is written by the time this one reads it. */
    var runBtn = document.getElementById('runBtn');
    var gateBtn = document.getElementById('gateRunBtn');
    var box = document.getElementById('consoleBox');
    if (runBtn && box) {
      /* Registered after app.js's handler (which writes the console) and after
         practice.js's (which refreshes the pill), because a classic script's
         listeners fire in load order and this file is loaded last. runSimulation
         is synchronous, so the console is complete by the time this runs. */
      var record = function () {
        var text = box.textContent || '';
        var pass = countOf(text, 'PASS'), fail = countOf(text, 'FAIL');
        window.CLOUD.save(app, item, {
          source: storesSource ? getText() : undefined,
          /* 'none' is a real verdict and not a missing one: cpu-16bit's testbench
             prints nothing deliberately and is judged by the Scoreboard instead,
             so storing null there would make a page that ran look like a page
             that never did. */
          verdict: { pass: pass, fail: fail, state: fail > 0 ? 'fail' : (pass > 0 ? 'pass' : 'none') }
        });
      };
      runBtn.addEventListener('click', record);
      if (gateBtn) gateBtn.addEventListener('click', record);
    }

    /* GET STARTED IS THE MARK. Pressing it is the first unambiguous "I am working on this"
       a page gets - it happens before any keystroke and any Run - and the hub already has a
       state for that: no record means no badge, and a record with no verdict reads
       `in progress` (practice.html's progressBadge). So this CREATES the row and writes
       nothing else. It is also what stops the exercise sheet greeting a returning reader,
       since shell.js opens that sheet only when this row is absent - one fact, read by two
       surfaces, rather than a badge rule and a seen-it flag that can disagree.

       ONLY IF THERE IS NOTHING THERE, and both halves of that guard earn their line:
         - the Exercise button re-opens this sheet, so Get Started is pressed again on a
           page that may already be solved. Unguarded, `verdict: null` would go OVER a real
           verdict and the hub would read `in progress` while the pill on that very page
           says all 5 checks passing - the pill/badge disagreement the Reset path below was
           written to prevent; and
         - `save` restamps updated_at, so merely re-reading the brief would jump the
           exercise to the top of the dashboard's newest-first In Progress list.

       NULL rather than a 'none' state, for the reason the Clear handler below records:
       'none' is what a real run of cpu-16bit stores, its testbench printing nothing by
       design, so writing it here would make "begun" indistinguishable from "ran silently".

       AND NO `source`, unlike Clear below - which is not an omission. A record whose source
       is undefined has `source === synced`, so pull() sees no local edit and ADOPTS the
       remote row, which is what a second machine must do. Storing the pristine starter here
       would make it a local edit, and the first Get Started on a second machine would raise
       a conflict dialog over work nobody had touched. */
    var startBtn = document.getElementById('exStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        if (window.CLOUD.load(app, item)) return;
        window.CLOUD.save(app, item, { verdict: null });
      });
    }

    /* RESET FORGETS THE EXERCISE, which is a stronger thing than un-running it and is why
       this is a delete rather than another save. The strip's Reset restores the starter and
       re-opens the brief - it returns the page to what a first visit finds - so the hub
       must stop badging it and the next load must show the brief again, and both of those
       are read off whether this row exists. Clearing the verdict and keeping the row is
       what `in progress` means, so it is the wrong answer here and the right one for Clear.

       A HOOK, NOT A LISTENER ON `resetBtn`, and the ordering is the whole reason. doReset
       clicks that hidden button FIRST and re-seeds the editor AFTER, and re-seeding fires
       `input` - so a delete wired to the button would be undone by the save that follows it
       microseconds later. practice.js calls this last, once the editor is already back to
       the starter. Same idiom as LEARN_ON_QUIZ below, and one writer for one state. */
    window.CLOUD_ON_RESET = function () { window.CLOUD.forget(app, item); };

    /* The Console's Clear button. It silences the pill, so the badge that reads the same
       verdict has to go quiet with it - a pill and a badge disagreeing is precisely the bug
       this pair of handlers exists to prevent. Note Clear is NOT a Reset: the waveform, the
       netlist and the learner's source all stay, so the ROW stays too and only the verdict
       goes. That leaves the badge reading `in progress`, which is the true state of a page
       that has been edited but not run - and is exactly what Reset above must NOT leave.

       NULL rather than a 'none' state, and the difference matters on exactly one page:
       'none' is what a real run of cpu-16bit stores (its testbench prints nothing by
       design), so writing it here would make a discarded run indistinguishable from a
       silent one. CLOUD.save tests `'verdict' in fields` rather than truthiness, which is
       what lets null actually clear the field instead of falling back to the old value;
       pushNow sends `rec.verdict || null`, and a pull resolves on SOURCE, so a
       verdict-only change is neither dirty nor moved and no sync can resurrect it. */
    var clearBtn = document.getElementById('consoleClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        window.CLOUD.save(app, item, storesSource
          ? { source: getText(), verdict: null } : { verdict: null });
      });
    }
  }

  /* ---- the verdict, on a learn topic ---------------------------------- */

  /* A TOPIC HAS SOMETHING TO REPORT NOW, which is what the seam above was left open for. Its
     quiz is the only thing on a page you read that produces a result, so learn.js hands the
     count here and this is still the one file that writes a learner's record.
   *
   * A HOOK RATHER THAN A LISTENER, because there is no single element to bind to: the quiz is
   * built by learn.js out of createElement, several script tags before this file, and the
   * questions differ per topic. learn.js calls this at CLICK time and only if it exists, so a
   * checkout with no project has the quiz working and nothing stored - the same shape
   * CLOUD_ON_SIGNIN and CLOUD_ON_ADOPT already have, read from the other direction.
   *
   * `storesSource` is false on a topic page (CLOUD_NO_SOURCE), so the row carries a verdict and
   * no source, exactly as the note above describes. Nothing here clears it: a quiz cannot be
   * un-answered, where a practice page's Reset and Clear really do discard the run the badge
   * was reporting. */
  if (app === 'learn') {
    window.LEARN_ON_QUIZ = function (verdict) {
      if (!verdict) return;
      window.CLOUD.save(app, item, storesSource
        ? { source: getText(), verdict: verdict } : { verdict: verdict });
    };
  }

  /* ---- seeding at load ------------------------------------------------ */

  /* What is on screen right now is a default nobody chose - the exercise skeleton
     on a practice page, or EXAMPLES' first entry in the three menu apps - so a
     saved document supersedes it. The comparison is against that default rather
     than against nothing, so a learner who has never edited anything still gets
     the example, and re-opening a page they left mid-answer gets the answer.

     `seeded` is the whole DOCUMENT, not the textarea: since the split the textarea
     is the design half, and comparing a stored document against half of one makes
     every unedited page look edited, restoring what is already on screen.

     Worth knowing before "simplifying" it back: with repairSplit in place that
     spurious restore is IDEMPOTENT, so reverting this line changes nothing
     observable - measured, on all three cases (stored equals the seed, stored is
     edited, stored is a pre-split half). It stays because a restore that does
     nothing is still work, still trips the restoring flag, and would go wrong the
     moment the repair stops being a no-op. A mutation test correctly reports it as
     equivalent; that is a fact about the repair, not a reason to drop the guard. */
  var seeded = (typeof window.currentFullSource === 'function')
    ? window.currentFullSource() : (editor ? editor.value : '');
  var rec = window.CLOUD.load(app, item);
  if (rec && typeof rec.source === 'string' && rec.source !== seeded) restore(rec.source);

  /* ---- pulling, and conflicts ---------------------------------------- */

  /* One pull per load, and it is allowed to arrive late: the page is already
     usable from the local copy, so this only ever upgrades it. */
  function syncDown() {
    window.CLOUD.pull(app).then(function (r) {
      if (!r || !r.ok) return;
      /* Adopting the remote copy has already been decided inside CLOUD.pull -
         that branch only runs when there were no local edits to lose - so all
         that is left here is to put the adopted text on screen. */
      if (r.adopted.indexOf(item) >= 0) {
        var got = window.CLOUD.load(app, item);
        if (storesSource && got && typeof got.source === 'string' && got.source !== getText()) restore(got.source);
      }
      /* A conflict is never resolved automatically. The dialog states what each
         copy is and lets the learner choose; doing nothing keeps what is on
         screen, so the safe outcome needs no decision. */
      var mine = r.conflicts.filter(function (c) { return c.item === item; })[0];
      if (mine && window.CLOUD_UI) window.CLOUD_UI.askConflict(app, item, mine);
    });
  }

  if (window.CLOUD.signedIn()) syncDown();

  /* Signing in mid-session has to pull too, or the account appears to work while
     showing none of the work it was signed into. cloud-ui.js calls this hook
     rather than pulling itself, because it does not know which document is open. */
  window.CLOUD_ON_SIGNIN = function () {
    /* The document on screen is pushed FIRST. Before signing in there was no
       account to attribute it to, so it exists only locally; pulling first would
       compare it against rows it has never been part of and could report a
       conflict against the learner's own unsent work. */
    if (storesSource) window.CLOUD.save(app, item, { source: getText() });
    window.CLOUD.flush();
    syncDown();
  };

  /* Used only by the conflict dialog's "use the cloud version" branch, which has
     already written the record - this puts it in the editor. */
  window.CLOUD_ON_ADOPT = function (r) {
    if (r && typeof r.source === 'string') restore(r.source);
  };

  /* WHICH DOCUMENT IS OPEN CAN MOVE, and this is the one thing that moves it. Code2Silicon's
     first Save mints a project and the page is then editing THAT row rather than the scratch
     one it loaded with - so every autosave after it, and every pull, has to follow. `item` is
     a closure variable read by six functions here, so the alternative to this hook is a
     reload, which would throw away the editor state the reader just saved.
   *
   * A HOOK, NOT AN EXPORTED SETTER, and the same idiom CLOUD_ON_RESET and LEARN_ON_QUIZ
   * already use: the page calls it if it exists, so a checkout with no project has the Save
   * button absent and this never defined, with no branch on either side.
   *
   * IT SAVES TO THE NEW ROW BEFORE RETURNING, and that ordering is the whole of it. The mint
   * is `save(app, id, {source, verdict})` in the caller, then this - so what the reader typed
   * is already under the new item and this only has to redirect what comes next. Doing it the
   * other way round leaves a window in which an `input` event lands on the old row.
   *
   * The SCRATCH row is deliberately left alone rather than deleted. It is what an unnamed
   * Code2Silicon autosaves to, so forgetting it here would empty the document a reader
   * returning to a bare code2silicon.html expects to find - saving a project is not a
   * statement about the scratch. */
  window.CLOUD_SET_ITEM = function (next) {
    next = String(next || '');
    if (!next || next === item) return;
    item = next;
  };
})();
