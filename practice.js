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
 *
 * AND RESET PUTS THAT STATE BACK, which is why showPreRunState exists rather than the
 * three statements it holds sitting inline: Reset restores the console's placeholder
 * and drops the result, so the page it leaves behind should be the page you opened.
 * Reset used to share the Run handler and so did the opposite - see showPreRunState.
 */
'use strict';

(function () {
  var ex = PRACTICE_EX;                       // set by shell.js
  var backdrop = document.getElementById('exBackdrop');
  var startBtn = document.getElementById('exStartBtn');
  var closeBtn = document.getElementById('exCloseBtn');
  var hasRun = false;                         // has Run been pressed yet (Reset clears it)

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

  /* Import File goes with it, for the same reason and one more: a page IS an
     exercise, so there is no other file to open, and opening one would replace the
     problem the sheet is describing with something the checker was never written
     against. Save stays - taking work OUT is still worth having.

     Hiding the button alone would leave its toolbar behind as an empty band above
     the editor (the picker beside it is already hidden), so the toolbar goes when
     nothing visible is left in it - tested rather than assumed, since app.js may
     add to that row later and this must not then hide something real. */
  var openBtn = document.getElementById('openBtn');
  if (openBtn) {
    openBtn.style.display = 'none';
    var bar = openBtn.parentElement;
    /* classList, not `className === 'toolbar'`: the toolbar carries only that class
       today, so the two agree, and an exact-string test would silently stop matching
       the day anything is added to it - failing OPEN, leaving the empty band back. */
    if (bar && bar.classList && bar.classList.contains('toolbar')) {
      var visible = [].slice.call(bar.children).filter(function (el) {
        return el.style.display !== 'none' && el.id !== 'fileOpenInput';
      });
      if (!visible.length) bar.style.display = 'none';
    }
  }

  /* The Memory Viewer is opt-in per problem (manifest.js's `memory` flag), for the
     same reason: on a design with no memory array it renders its own "No memories
     declared in this design." empty state, which is honest but is nineteen panels
     of nothing across twenty pages. Hidden rather than removed, because app.js
     renders into it unconditionally - renderMemorySelect and renderMemoryTable
     would both have to be taught about the practice site otherwise. */
  /* The editor toolbar's Reset is HIDDEN, not removed, and that is load-bearing rather
     than convenient: three files attach handlers to it - app.js clears the console,
     result, view, radix map and hierarchy state, practice.js restores the pre-run state,
     practice-synth.js re-prints its console section - and those handlers ARE the bulk of
     what the new Reset does. The button in the tab strip clicks this one and then does
     only the delta a first open has that a Reset does not (see doReset). Removing it
     would mean writing a fourth copy of all three. */
  var toolbarResetBtn = document.getElementById('resetBtn');
  if (toolbarResetBtn) toolbarResetBtn.style.display = 'none';

  var memCard = document.getElementById('card-memory');
  if (memCard && !(PRACTICE_META && PRACTICE_META.memory)) memCard.style.display = 'none';

  /* The Scoreboard decides its own visibility inside renderModelCard, which only
     runs during a simulation - and nothing simulates on load any more. So it is
     hidden here and revealed by the first Run, on whichever pages that card's own
     rule keeps. Leaving it visible would put the card on all twenty pages and then
     make it vanish on the first Run for the seventeen with no CPU evidence, and the
     tab strip below would have built a Model tab pointing at it. */
  var modelCard = document.getElementById('card-model');

  /* THE TESTBENCH IS THIS PAGE'S CHECKER, so here it is READ-ONLY where the simulator's own
     copy is an editor. The exercise is marked by the PASS/FAIL lines that testbench prints,
     and a learner who can edit it can make any design pass - including one that does nothing.
     So the design is the writable half of the document and the checks are fixed.

     READ-ONLY RATHER THAN `disabled`, which is the other way to stop a keystroke and would be
     wrong: app.js already disables that textarea to mean something else (a document with no
     testbench region at all - see showTestbenchInEditor), and a disabled control cannot be
     selected or copied, which is most of what reading a testbench is for.

     Nothing else had to change for the seeding to keep working, and the reason is worth
     recording because it is not obvious. `setTextIn` prefers execCommand to preserve the undo
     stack, and its own comment records the failure it guards: when a textarea refuses focus
     the insert silently lands in whichever one was focused before. A read-only textarea does
     NOT refuse focus, so that guard passes, execCommand declines the edit, and the plain
     `.value` fallback under it is what writes the text - so the card still shows the
     exercise's testbench, and the undo stack it wiped belongs to a box nobody can type in. */
  var tbTextarea = document.getElementById('tbInput');
  if (tbTextarea) tbTextarea.readOnly = true;
  (function () {
    /* And the heading SAYS so, in the same words practice-synth.js's netlist card uses. A
       textarea that swallows a keystroke with no explanation reads as a broken page, and this
       one looks exactly like the editor above it.

       Inserted before the help icon rather than appended to the h2: `.header-controls` is
       pushed to the far end of the header, so an appended span lands to the right of the
       height and layout buttons instead of after the words it qualifies. And the card is
       found by id and THEN searched, never as one `#card-testbench h2` - the stub DOM
       resolves a single simple selector at a time and returns null for a compound one, which
       is how a feature ships absent with every check passing.

       The class carries NO rule and is a handle for the harness: the wording is part of the
       heading, exactly as it is in the netlist card's own `(Read-only)` title, so styling it
       differently would make one of the two look like the deliberate one. */
    var card = document.getElementById('card-testbench');
    var h2 = card && card.querySelector('h2');
    var help = h2 && h2.querySelector('.help-wrap');
    if (!h2 || !help) return;
    var note = document.createElement('span');
    note.className = 'tb-readonly';
    /* A NON-BREAKING space, because `.card h2` is a flex row: text nodes become anonymous
       flex items with their surrounding whitespace stripped, so an ordinary leading space
       disappears and the heading reads `Testbench Editor(Read-only)`. Measured in Chrome,
       not reasoned about - it looks correct in the markup either way. */
    note.textContent = '\u00A0(Read-only)';
    h2.insertBefore(note, help);
  })();

  /* The two cards that have nothing to show until something has run are FOLDED rather
     than hidden: the Waveform Viewer and the Module Hierarchy beside it. Folded keeps
     their headers on the page, so the page reads as a tool waiting for input rather
     than one missing two panels, and their tabs stay live (a fold does not change
     `style.display`, which is what practice.js's strip tests).

     Unfolded by the first Run - and only the first, so a reader who folds the waveform
     back up afterwards is not overruled on the next one. */
  var FOLD_UNTIL_RUN = ['card-wave', 'card-hierarchy'];

  /* The Testbench Editor is folded too, and it is deliberately NOT in that list: a Run must
     not reveal it. The two lists are different claims - those two cards are folded because
     they have nothing IN them yet, and this one because what is in it is the answer sheet's
     other half, which the reader may open when they want it and which nothing should open on
     their behalf. Folded rather than hidden for the same reason it is read-only rather than
     disabled: the checks are worth reading, and on a page whose testbench is the spec of the
     exercise, hiding them outright would make the sheet the only statement of what is being
     asked. There is no Testbench tab in the strip below, so the header is the one control
     that opens it and a fold cannot leave a dead one behind. */
  var FOLD_ALWAYS = ['card-testbench'];
  function foldCard(id, folded) {
    var card = document.getElementById(id);
    if (!card) return;
    card.classList.toggle('collapsed', folded);
    // app.js's own [data-collapse] handler owns this glyph, so it is written the same
    // way here rather than left pointing the wrong direction.
    var btn = card.querySelector('.card-collapse-btn');
    if (btn) btn.textContent = folded ? '▸' : '▾';
  }

  /* The state of a page nobody has run yet, in ONE place, because Reset has to put it
     back and "the same as first launching" is only a checkable claim while the two
     share an implementation. Reset drops the result and restores the console's
     placeholder, so what it should leave behind is the page you opened.

     One of the three is app.js's to get wrong rather than merely to miss: its Reset
     calls renderModelCard, which with no result at all reveals the Scoreboard
     DELIBERATELY - "hide on evidence, never on the absence of it", so that a Reset
     cannot make the feature look broken in the simulator. Here that is exactly the
     card hidden above, so the handler below re-hides it. It runs after app.js's,
     which is the same registration order the verdict pill already depends on.

     It cannot call refreshVerdict/refreshTabs itself: `verdict` and `tabStrip` are
     declared below and would be undefined at load. Both callers do that. */
  function showPreRunState() {
    hasRun = false;
    /* And the next Run selects the DUT again, for the same reason the fold comes back: app.js's
       Reset nulls lastTopModuleName, so that run is a FRESH design and its visibility resets to
       top-only - leaving this flag set would hand back the testbench-only plot for good.
       Assigned rather than declared here: `var dutShown` below is hoisted into this scope. */
    dutShown = false;
    if (modelCard) modelCard.style.display = 'none';
    FOLD_UNTIL_RUN.concat(FOLD_ALWAYS).forEach(function (id) { foldCard(id, true); });
  }
  showPreRunState();
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
    /* The starter is handed to seedFullSource rather than written with setEditorText
       first, and the two halves of that are separate bugs it fixes. Splitting it there
       is what keeps the whole document out of the design editor's undo stack (one Cmd-Z
       used to bring the testbench back into the design card); SEEDING rather than
       loading is what keeps app.js's own example out of it - this page opens with the
       D flip-flop in the editor for an instant, because app.js is a verbatim copy of
       the simulator and loads EXAMPLES' first entry, and while the swap was an ordinary
       undoable edit one Cmd-Z on a page nobody had typed in yet replaced the exercise
       with `module dff`. There is nothing behind a page's first document to undo to.
       Reset is deliberately NOT this: see doReset. */
    /* And so does the file name, for the same reason and from the same cause: app.js
       loaded an example on the way past, and loadExample sets `currentFileName` from the
       example's NAME. The first entry of EXAMPLES is the D flip-flop, so without this
       every one of the twenty pages saved the learner's work as `D_Flip-Flop.v`. All
       twenty were wrong, including `d-flip-flop`, whose own name is `d-flip-flop.v` - and
       that page is the trap rather than the exception, because `D_Flip-Flop.v` reads as
       deliberate there, so the one page anybody would spot-check is the one page that
       looks fine. Nothing else writes it here: Import File is hidden on these pages,
       so the example load is the only other writer, and Reset does not touch it.

       PRACTICE_META.slug, not window.PRACTICE_SLUG: the binding shell.js already
       normalised (it falls back to the raw slug when no manifest entry claims the page),
       which is the form this file uses everywhere else. It needs no sanitising the way
       loadExample's example names do - build.py names each page `<slug>.html`, so a slug
       that was not filename-safe could not have a page in the first place. */
    currentFileName = PRACTICE_META.slug + '.v';
    seedFullSource(ex.starter);
    tryApplyAutoFinishTime(codeInput.value);
  }

  /* ---- 4. the verdict pill.
     Derived from the console text rather than from anything the checker is asked
     to expose, so any testbench that prints PASS / FAIL lines gets a verdict for
     free. A design whose checker prints neither says so ("no checks reported")
     instead of claiming a pass: the CPU exercises are judged by the CPU / Memory
     Model card, which has its own verdict of its own. ---- */
  var clearBtn = null;
  var verdict = document.createElement('span');
  verdict.className = 'ex-verdict';
  verdict.id = 'exVerdict';
  /* IT SITS BESIDE THE BUTTON THAT PRODUCES IT, in the editor card's run toolbar, not in
     the Console card's header. The verdict is the answer to pressing Run, and the Console
     is two cards further down the page - so on anything shorter than a desktop window the
     result of a run was off-screen at the moment it arrived, and reading it meant scrolling
     past the Testbench Editor to a header whose own box you then had to look away from. Run
     and its verdict are one exchange, so they are in one row.
     Clear comes with it, because it is the control that retires that verdict.

     The anchor is `maxTimeInput`'s own toolbar, which is deliberately the same anchor
     practice-synth.js uses for Synthesize - so the two files cannot disagree about which
     row this is - and appending is what puts the pill BEFORE that button: practice-synth.js
     is a later classic script, so its append lands to the right of these two. That is the
     order the mock asks for (Run … time units, verdict, Clear, Synthesize) and it is the
     one thing here that depends on load order, which is why it is written down. */
  var maxInput = document.getElementById('maxTimeInput');
  var runBar = maxInput ? maxInput.parentElement : null;
  if (runBar) {
    runBar.appendChild(verdict);
    /* Clear. `.btn.secondary`, not the green primary: it discards, and the two primaries in
       this row are the two things a learner asks the page to DO (see practice-synth.js on
       why Synthesize is green beside Run). Worded rather than an icon for the same reason it
       always was - every icon control on this page adjusts something and this one throws
       something away - and in a toolbar of worded buttons that now needs no exception. */
    clearBtn = document.createElement('button');
    clearBtn.className = 'btn secondary';
    clearBtn.id = 'consoleClearBtn';
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    runBar.appendChild(clearBtn);
  }

  /* Clear discards what the Console SHOWS and everything that speaks for it - the pill,
     the remembered synthesis log (or the next Run would re-print it and half-undo this),
     and the hub badge, which cloud-sync clears from this same button. A pill and a badge
     that disagree is the bug Reset already had once.

     `hasRun` going false is not tidiness: refreshVerdict reports "no checks reported" for
     a run that printed nothing, which is a real verdict, so without this the pill would
     claim a silent run instead of going quiet.

     Deliberately NOT a Reset: the waveform, the Scoreboard, the netlist and the editor are
     left exactly as they are. This is the Console's own control. */
  function clearConsoleSection() {
    consoleBox.innerHTML = '<span class="info">Click Run to simulate…</span>';
    if (window.PRACTICE_SYNTH_API && window.PRACTICE_SYNTH_API.forgetLog) {
      window.PRACTICE_SYNTH_API.forgetLog();
    }
    hasRun = false;
    refreshVerdict();
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
    /* Nothing has run yet - the state a Reset puts back, too - so the pill says nothing
       rather than "no checks reported". The two are different claims and the difference
       is the whole point - after a run, "no checks reported" is a real verdict
       (cpu-16bit's testbench prints nothing deliberately, and the Scoreboard is its
       checker), so a pill reading it with no run behind it would be describing a run
       that never happened. */
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
  /* Everything that has to happen AFTER a simulation, whichever button caused one.
     Extracted because there are two now: Run Simulation, and the netlist card's Run
     Gate-level Simulation, which practice-synth.js wires to this through PRACTICE_API.
     One writer with two callers rather than two copies - the arrangement showPreRunState
     already has, and for the same reason: the two would agree today and drift later. */
  /* `— simulation —`, prepended after the run rather than printed before it, because
     app.js's runSimulation clears the console as its first act - anything written ahead of
     it is wiped. So the rows are already there and the rule goes on top of them.

     Every section is labelled, including this one on a page with no synthesizer at all:
     an unlabelled block would mean "RTL" only by implication, and the Console is now
     ordered by WHEN each thing ran rather than by what it is, so a reader needs each
     block to say which it is. Held to the same rule the synthesis log is: no PASS or
     FAIL in the words, since the verdict pill counts those over the whole box. */
  function prependRow(html, cls) {
    var el = document.createElement('div');
    if (cls) el.className = cls;
    el.innerHTML = html;
    consoleBox.insertBefore(el, consoleBox.firstChild);
  }
  /* `detail` is a line that belongs to this section rather than to the run - what the
     gate-level button says about how the netlist was assembled. Prepended BEFORE the rule
     so it ends up just under it: both go to the top of the box, so the last one written is
     the one on top. It used to be logged by the caller, which appended it, leaving it
     stranded at the very bottom under the simulation output. */
  function noteRun(label, detail) {
    if (detail) prependRow('<span class="info">' + detail + '</span>');
    prependRow('<span class="info">— ' + (label || 'simulation') + ' —</span>', 'console-rule');
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
  }
  /* ---- THE FIRST RUN SHOWS THE DUT'S OWN SIGNALS, because on a practice page the top
     module is the TESTBENCH, and app.js's fresh-design default - show the top module's own
     signals, hide every direct child instance - therefore opens the plot on the stimulus
     rather than on the thing being written. Measured across the twenty: the testbench's own
     rows are 2 to 10 of them, and `cpu-16bit`'s first Run plotted exactly two (`clk`,
     `rst_n`) while its DUT has 25. That default is right in the standalone simulator, where
     the top module IS the design; here it is one instance short.

     It ADDS to what is shown rather than replacing it, and it does so by making exactly the
     two writes the panel's own instance-row click makes (`shown` on the DUT, `hidden` on its
     children, so the drill-down stays one level at a time). So this is not a second rule
     about visibility - it is the click the reader would otherwise have had to find, done
     once, and every subsequent toggle behaves as it always did. The testbench's rows stay:
     nothing that was plotted disappears, at the cost of a port appearing twice under two
     names (`clk` beside `u_dff.clk`), which is what showing both halves of a connection
     looks like.

     THE DUT IS THE SHALLOWEST INSTANCE WHOSE MODULE IS DECLARED IN THE DESIGN HALF, and
     each half of that is load-bearing. `u_dut` is not a convention here - the twenty use
     `u_dff`, `u_cnt`, `u_rf`, `u_tl` and thirteen more - so a name match would find nothing
     on most pages. The design half is the document up to the `// ======== TESTBENCH ========`
     marker, i.e. the same cut the two editors and the synthesizer already split on, so the
     answer is the module the exercise asks for rather than a guess. Shallowest, because on
     the three system-level pages the DUT is nested (`u_sys.u_cpu`, `u_sys.u_calc`) while the
     modules it is built from - `alu`, `rf`, `pc` - are declared in that same half and would
     otherwise be candidates too. Verified to resolve on all twenty.

     It reads the tree by RE-PARSING, since app.js keeps it in renderHierarchyTree's closure
     and nothing retains it - one parse of a document that has just parsed, once per page.
     Reaching into app.js for a global instead would mean editing a verbatim slice of
     `Baerilog/simulator.html`, which the next `build.py --sync` would take away. ---- */
  var dutShown = false;
  function showDutSignals() {
    if (dutShown) return;
    /* Guarded on a RESULT rather than on the click, so a first Run that failed to parse
       does not consume the one chance to do this - the reader fixes the design, presses Run
       again, and that is the run this belongs to. */
    if (typeof lastResult === 'undefined' || !lastResult) return;
    var src = typeof currentFullSource === 'function' ? currentFullSource() : editorFullSource;
    var ast;
    try { ast = parseVerilog(src); } catch (e) { return; }
    if (!ast || !ast.tree) return;
    var design = String(src).split('// ======== TESTBENCH ========')[0];
    var mods = [];
    design.replace(/(^|\n)\s*module\s+(\w+)/g, function (_, nl, name) { mods.push(name); return ''; });
    if (!mods.length) return;
    var best = null;
    (function walk(node, depth) {
      if (node.path && mods.indexOf(node.modType) !== -1 && (!best || depth < best.depth)) {
        best = { node: node, depth: depth };
      }
      node.children.forEach(function (c) { walk(c, depth + 1); });
    })(ast.tree, 0);
    if (!best) return;
    instanceVisibility.set(best.node.path, 'shown');
    best.node.children.forEach(function (c) { instanceVisibility.set(c.path, 'hidden'); });
    /* Every branch is folded on a fresh design, and the root's fold is what decides whether
       its children are rendered at all - so without this the panel would report the change
       by showing nothing, and on the nested pages the row now marked `shown` would be
       inside a collapsed ancestor. Unfolding the path to it is the rest of the same click. */
    var at = best.node.path, guard = 0;
    while (guard++ < 64) {
      var dot = at.lastIndexOf('.');
      at = dot === -1 ? '' : at.slice(0, dot);
      collapsedBranches.delete(at);
      if (at === '') break;
    }
    renderHierarchyTree(ast.tree);
    drawWaveform(lastResult);
    dutShown = true;
  }

  /* Registered after app.js's own handlers, and runSimulation is synchronous, so the
     console is already written by the time this fires. */
  (function () {
    var b = document.getElementById('runBtn');
    if (!b) return;
    /* Before noteRun, whose own first-Run block unfolds the Waveform Viewer and redraws -
       so the selection is in place for that draw rather than needing a third one. This is
       the behavioural Run deliberately: practice-synth.js's gate-level run also calls
       noteRun, and its netlist has a different tree from the document in the editor. */
    b.addEventListener('click', function () { showDutSignals(); noteRun('simulation'); });
  })();
  /* Registered here rather than where the button is built, so the Console's two handlers
     read together. cloud-sync adds its own to the same button, later in load order, which
     is what clears the hub badge. */
  if (clearBtn) clearBtn.addEventListener('click', clearConsoleSection);

  /* Reset is NOT a run, and used to be wired as one - which put the Scoreboard, the
     Waveform Viewer and the Module Hierarchy on screen at the moment their contents
     were being thrown away, and had the pill reading "no checks reported" about a run
     that never happened. It clears the console back to the placeholder and drops the
     result, so it restores the page you opened instead. Both refreshes are needed and
     for different reasons: the pill goes silent because `hasRun` is false again, and
     the Model tab has to follow its card back off the strip or it is a dead control. */
  (function () {
    var b = document.getElementById('resetBtn');
    if (!b) return;
    b.addEventListener('click', function () {
      showPreRunState();
      refreshVerdict();
      refreshTabs();
    });
  })();
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
     selection back to Design.

     EVERY ENTRY HERE SELECTS A CARD ON THIS PAGE, which is what a tab is. Exercise used
     to sit at the front of this list and did not: it opened a dialog, and clicking it took
     the lit marker off the card you were reading and put it on a control that navigates
     nowhere. It is a button beside Reset now - see section 6. ---- */
  var TABS = [
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

  /* `scrollIntoView({block:'start'})` puts a card's top at the top of the VIEWPORT, which
     is behind the bar and the sticky page head - so a tab press left the card it selected
     with its own title hidden under the strip that selected it, i.e. looking headless and
     cut off. This scrolls back by whatever is still covering the top afterwards.

     MEASURED AFTER THE SCROLL, and that is what makes it one rule for both layouts: the
     band's bottom edge IS the height of everything docked above the content (the bar sits
     above it, so one rect covers both), and where the narrow layer has released the band
     it has scrolled away with the page and its bottom is at or above 0, so there is
     nothing to correct. No copy of the 760px breakpoint, and nothing to keep in step with
     the two heights - both of which vary, since the bar and the crumb wrap. */
  function clearStickyOverlap() {
    var head = document.querySelector('.gh-page-head');
    if (!head || !head.getBoundingClientRect || !window.scrollBy) return;
    var over = head.getBoundingClientRect().bottom;
    if (over > 0) window.scrollBy(0, -over);
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
        var card = document.getElementById(t.card);
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
        clearStickyOverlap();
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

  /* ---- 6. the strip's ACTIONS: Exercise, then Reset.

     NEITHER IS A TAB, and that is what keeps both out of three mechanisms they would
     otherwise each need an exception in: `PRACTICE_API.tabs()` collects `.gh-tab`, the
     one-lit-at-a-time handler clears `.gh-tab`, and the harness requires every tab to point
     at a card that exists and is visible. One opens a dialog and one discards work; neither
     navigates to a card, so neither is in that set.

     Exercise was a tab until now, and being one cost something real: clicking it took the
     lit marker off the card you were reading and put it on a control that goes nowhere.

     ONE GROUP rather than two separately placed buttons, because the two properties that
     place them are properties of the PAIR: `margin-left: auto`, and `position: sticky;
     right: 0` in the narrow layer. Pinning them individually would mean giving the second
     one a `right:` offset measured off the first one's width - the width of a word at 12px,
     which is not a constant.

     `margin-left: auto` pushes the group right, but that is NOT what makes it last: an auto
     margin absorbs the space BEFORE its item and holds nothing back after it.
     practice-synth.js appends two netlist tabs on every successful synthesis, so it inserts
     them BEFORE this group instead (PRACTICE_API.stripActions) - which is what makes DOM
     order, keyboard order and visual order agree, and lets "rightmost" be checked from a
     booted page rather than asserted against CSS text. ---- */
  var stripActions = null, exBtn = null, resetBtn = null;
  if (tabStrip) {
    stripActions = document.createElement('div');
    stripActions.id = 'exStripActions';
    stripActions.className = 'ex-strip-actions';

    /* Stock `.btn.outline`, which app.css already paints in --accent-fg with an
       --accent-subtle hover - so "blue" needs no rule of its own here. The glyph is ⓘ
       rather than the book it carried as a tab: a book says "reading material", and what
       this offers is the statement of the problem you are solving. */
    exBtn = document.createElement('button');
    exBtn.id = 'exReopenBtn';          // the id everything already wired to it keeps
    exBtn.className = 'btn outline';
    exBtn.setAttribute('type', 'button');
    exBtn.innerHTML = (ICON.info || '') + '<span>Exercise</span>';
    exBtn.title = 'Read the exercise description again';

    resetBtn = document.createElement('button');
    resetBtn.id = 'exResetBtn';
    resetBtn.className = 'btn outline ex-reset';
    resetBtn.setAttribute('type', 'button');
    resetBtn.textContent = 'Reset';
    resetBtn.title = 'Discard your changes and start this exercise over';
    resetBtn.addEventListener('click', openResetConfirm);

    stripActions.appendChild(exBtn);
    stripActions.appendChild(resetBtn);
    tabStrip.appendChild(stripActions);
  }

  /* The confirmation, built with createElement rather than one innerHTML string -
     the same reason practice-synth.js builds its cards that way: the stub DOM does not
     parse injected markup, so a dialog built from a string has no elements to click and
     the whole thing would be untestable. It reuses the exercise sheet's own backdrop and
     panel classes, so it is the page's existing dialog idiom rather than a second one. */
  var resetBackdrop = null;
  function openResetConfirm() {
    if (!resetBackdrop) resetBackdrop = buildResetConfirm();
    resetBackdrop.classList.add('open');
    document.body.classList.add('ex-sheet-open');
    var cancel = document.getElementById('exResetCancel');
    if (cancel && cancel.focus) cancel.focus();   // the safe choice is the default one
  }
  function closeResetConfirm() {
    if (!resetBackdrop) return;
    resetBackdrop.classList.remove('open');
    /* Only if the exercise sheet is not itself open underneath - it sets the same class,
       and clearing it here would let the page scroll behind an open sheet. */
    if (!backdrop.classList.contains('open')) document.body.classList.remove('ex-sheet-open');
  }
  function buildResetConfirm() {
    var back = document.createElement('div');
    back.className = 'ex-backdrop';
    back.id = 'exResetBackdrop';
    var box = document.createElement('div');
    box.className = 'ex-sheet ex-confirm';
    var head = document.createElement('div');
    head.className = 'ex-sheet-head';
    var title = document.createElement('div');
    title.className = 'ex-sheet-title';
    title.textContent = 'Reset this exercise?';
    head.appendChild(title);
    var body = document.createElement('div');
    body.className = 'ex-sheet-body';
    var p = document.createElement('p');
    /* Names what is lost, because that is the only thing the reader is deciding - and it
       names the progress as well as the source now, since this deletes the saved record:
       the hub stops badging the exercise and the brief greets the next visit. For a reader
       signed in on two machines that is true of both, which is what "start over" means and
       is why it is worth saying before rather than after. */
    p.textContent = 'Your changes to the Verilog source will be discarded, the original '
      + 'exercise restored, and your saved progress for it cleared.';
    body.appendChild(p);
    var row = document.createElement('div');
    row.className = 'ex-confirm-actions';
    var cancel = document.createElement('button');
    cancel.id = 'exResetCancel';
    cancel.className = 'btn secondary';
    cancel.setAttribute('type', 'button');
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeResetConfirm);
    var go = document.createElement('button');
    go.id = 'exResetConfirm';
    go.className = 'btn outline ex-reset';
    go.setAttribute('type', 'button');
    go.textContent = 'Reset exercise';
    go.addEventListener('click', function () { closeResetConfirm(); doReset(); });
    row.appendChild(cancel);
    row.appendChild(go);
    body.appendChild(row);
    box.appendChild(head);
    box.appendChild(body);
    back.appendChild(box);
    // Backdrop click cancels, but only the backdrop itself - a click inside the panel
    // bubbles to it, and treating that as a cancel is the bug the sheet already avoids.
    back.addEventListener('click', function (ev) { if (ev.target === back) closeResetConfirm(); });
    document.body.appendChild(back);
    return back;
  }
  // Escape cancels. Registered on the document, like the sheet's, and it checks the
  // dialog is actually open so it cannot swallow the sheet's own Escape.
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (resetBackdrop && resetBackdrop.classList.contains('open')) closeResetConfirm();
  });

  /* Back to the page you opened. The three handlers on the hidden toolbar Reset do most
     of it, so this clicks that and then does only what a FIRST OPEN has that a Reset
     does not - which is a five-item delta rather than a second copy of the whole load
     sequence, and each item stays owned by the file that owns that state.
     Deliberately NOT touched: the memory images, which are written into
     attachedMemFiles at load and never removed, so they are already right; and the
     localStorage layout preferences, which a real first open honours too. */
  function doReset() {
    if (toolbarResetBtn) toolbarResetBtn.click();

    // 1. the source - the one thing the old Reset never did, and the whole request.
    if (ex && ex.starter) {
      var maxInput = document.getElementById('maxTimeInput');
      if (maxInput) maxInput.value = String(ex.maxTime || 2000);
      /* resetEditorHierarchyState, NOT seedFullSource: this discards work the learner
         really did (behind a confirmation), so it stays one undoable edit and Cmd-Z is
         the backstop. The load path above is the opposite case - see it. */
      resetEditorHierarchyState(ex.starter);
      tryApplyAutoFinishTime(codeInput.value);
    }
    // 2. the netlist, its cards and its console section.
    if (window.PRACTICE_SYNTH_API && window.PRACTICE_SYNTH_API.reset) {
      window.PRACTICE_SYNTH_API.reset();
    }
    // 3. the strip, since the cards it points at have just moved.
    refreshTabs();
    /* 4. the RECORD, so the exercise is not merely un-run but un-BEGUN: the hub stops
       badging it and the next load shows the brief again, both of which are read off
       whether that row exists. cloud-sync.js owns the row and installs this hook, the way
       it installs LEARN_ON_QUIZ, so nothing here has to know how progress is stored.

       AFTER the source is back, and that ordering is the whole reason it is a hook rather
       than a listener on the button clicked at the top of this function: re-seeding the
       editor fires `input`, cloud-sync saves on `input`, and a delete wired to the button
       would be undone microseconds later by that save. */
    if (window.CLOUD_ON_RESET) window.CLOUD_ON_RESET();
    // 5. the sheet, last, so it is what has focus when this returns.
    openSheet();
  }

  var reopenBtn = document.getElementById('exReopenBtn');

  /* ---- 6. the sheet. Four ways out (Get Started!, the ✕, Escape, the backdrop)
     and one way back in (the Exercise button). ---- */
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
  /* ADOPTED, NOT DECIDED. shell.js is what stamps `open` onto the backdrop, and it is the
     only file here that runs before the browser can paint - app.js sits between the two as a
     quarter of a megabyte of blocking script - so it is also what decides whether an
     exercise already begun gets the brief at all. This re-opens what is open, because
     openSheet is where body scroll gets locked and focus lands; where it is not, there is
     nothing to unlock, and focus is deliberately left where the browser put it rather than
     pulled into the editor, which on a phone would open the keyboard on arrival. */
  if (backdrop.classList.contains('open')) openSheet();

  // Named for the harness, which drives these paths without a browser.
  window.PRACTICE_API = {
    refreshVerdict: refreshVerdict,
    clearConsole: clearConsoleSection,
    /* What Run does to this page once the simulation itself is over - the pill, the tab
       strip, and the first-run unfold. practice-synth.js calls it after a gate-level run,
       so that run lands on the page exactly as a behavioural one does. */
    noteRun: noteRun,
    openSheet: openSheet,
    closeSheet: closeSheet,
    isSheetOpen: function () { return backdrop.classList.contains('open'); },
    hasRun: function () { return hasRun; },
    /* The strip's two action buttons and the group holding them. `stripActions` is what
       practice-synth.js inserts its tabs before, so the pair stays DOM-last however often
       the netlist tabs come and go - it used to pin on `resetButton`, which is a CHILD of
       the group now, so `parentElement === strip` would be false there and the netlist pair
       would land to the right of Reset. The rest is for the harness, which has to be able to
       open the dialog and take either branch without a native confirm(). */
    resetButton: function () { return resetBtn; },
    exerciseButton: function () { return exBtn; },
    stripActions: function () { return stripActions; },
    openResetConfirm: openResetConfirm,
    isResetConfirmOpen: function () {
      return !!resetBackdrop && resetBackdrop.classList.contains('open');
    },
    /* Every tab in the strip, not just this file's: practice-synth.js appends its
       own, and a harness asking "what can be clicked here" wants all of them. */
    /* The correction a sticky page head needs after a scrollIntoView - see the function.
       practice-synth.js's two tabs scroll to their cards exactly as this file's do, so they
       take the same correction from here rather than measuring the band a second time. */
    clearStickyOverlap: clearStickyOverlap,
    tabs: function () {
      var ids = [];
      if (tabStrip) {
        tabStrip.querySelectorAll('.gh-tab').forEach(function (b) { ids.push(b.id); });
      }
      return ids;
    },
    /* The whole strip in the order a reader tabs through it, with the actions group
       FLATTENED - so "every tab, then Exercise, then Reset" is one assertion rather than
       three separate readings of the DOM's shape. `children` is an HTMLCollection in a real
       browser, with neither forEach nor filter, hence the slice - the trap refreshTabs
       already records about querySelectorAll. */
    stripOrder: function () {
      var out = [];
      if (!tabStrip) return out;
      [].slice.call(tabStrip.children).forEach(function (c) {
        if (stripActions && c === stripActions) {
          [].slice.call(c.children).forEach(function (k) { out.push(k.id); });
        } else out.push(c.id);
      });
      return out;
    }
  };
})();
