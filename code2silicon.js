/* Baerilog/code2silicon.html's own wiring: the two cards below the netlist, the chain that
   runs the five stages in order, and the flow strip over all of it.

   TWO CARDS, and it was four: `Place & Route Results` holds the placement drawing, the report
   and the cell library as three VIEWS chosen by a radio triple on its heading - the shape the
   Synthesis Results card above it already has - so `Report` and `Cell Library` are not cards of
   their own. `Fabrication` is the second.
 *
 * WHAT IS NOT HERE is most of the page. The design and testbench editors, the console, the
 * waveform, the Scoreboard, the Memory Viewer, the example picker, Open and Save all arrive
 * with shell.js's markup and are wired by app.js; the netlist and its viewer are
 * practice-synth.js's; and the placement, the routing, the layout drawing and the
 * cross-section are pnr.js's and practice-pnr.js's. This file adds two cards and the order
 * the buttons run in, and nothing else - which is the whole reason the page is affordable.
 *
 * IT LOADS LAST, after practice-synth.js, so its cards land below the netlist pair and the
 * strip is built with every card already on the page.
 *
 * NO practice.js. That file is what makes an exercise an exercise - it seeds a starter, marks
 * the testbench READ-ONLY, hides the example picker and Open, and owns the verdict pill - and
 * every one of those is wrong here. The testbench is the reader's to write.
 */
'use strict';

(function () {

  /* ---------------------------------------------------------------- the chain
     FIVE STAGES, each gated on the one before it, which is the arrangement pnr.html already
     uses for Place -> Route -> Fabricate and the reason this needs no state machine: a stage
     is available exactly when the thing it consumes exists. `stage` is how far the page has
     got, and every button reads it rather than a flag of its own.

     0 nothing   1 simulated   2 synthesized   3 placed   4 routed   5 fabricated

     An EDIT does not reset this to 0 - it marks the stages downstream STALE, which is
     practice-synth.js's own rule for its netlist card and the right one for the same reason:
     the panel you are reading should not empty itself under you while you type. */
  var stage = 0;
  var netlistText = '';     // what the synthesizer emitted, and what Place parses
  var layoutRes = null;     // drawStatic's own result: the svg, the extent, the cut machinery
  /* WHICH VIEW AND WHETHER THE WIRES ARE IN IT, so the Abstract/Detail pair can redraw what is on
     screen rather than whatever the last stage happened to ask for.

     `Abstract` IS WHAT THIS PAGE OPENS ON, and that overrules a decision recorded here for a while
     ("Detail, because it is a page about silicon"). Two reasons replace it. pnr.html opens on
     Abstract - `viewAbstract` carries `.active` in its own markup - and this card exists to MIRROR
     that one: its `(?)` facts are copied from it word for word precisely so a reader moving between
     the two pages does not get two accounts of the same drawing, and opening on a different layer
     set is exactly such an account. And Abstract is the floorplan reading, where Detail is every
     mask layer of every cell - far more SVG, which tells against it most on the large designs this
     page accepts right up to MAX_GATES.

     THIS IS NOW THE ONLY PLACE THE DEFAULT IS STATED. It used to be stated twice - here, and as a
     hardcoded `.active` on the Detail button at build time - because `syncViewButtons` was called
     only from the click handler and so never ran for the first paint. Two writers for one bit, on
     a card whose panel view is a single writer a few lines down; it is one call at init now, so
     flipping the default is this word and nothing else. */
  var layoutView = 'phantom', routed = false;
  var panZoom = null;       // the shared pan/zoom, attached to the drawing's box on first use
  var cut = null;           // the chosen cross-section x, in the placement's milli-lambda

  /* ---- HOW MANY GATES THIS PAGE WILL PLACE, and it is pnr.html's number, not a second one.
     That app refuses a netlist over the cap with a dialog because its ROUTER is what costs:
     measured there, 13.7 s at 2000 gates and 329.6 s at 6872, against 12 ms to place them. A
     synthesized design reaches those sizes easily - `ram-8bit` synthesizes to 15,851 cells -
     so this page needs the same refusal. The number is restated here rather than imported
     because the cap lives in pnr.html's UI region, which is not a slice; the test asserts the
     two agree, so they cannot drift silently. */
  var MAX_GATES = 2100;
  var TOO_BIG_MSG = 'Netlist is too big to proceed. '
                  + 'This page is designed only for educational purpose.';

  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, id) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (id) el.id = id;
    return el;
  }

  /* ------------------------------------------------------------------ the cards
     BUILT WITH createElement, never one innerHTML string. The stub DOM the harness runs
     against parses no markup, so a card assembled from a string has no elements to press and
     the whole page would be untestable headlessly - the rule practice-synth.js and the
     exercise sheet already follow.

     Ids are prefixed `c2s` so nothing can collide with app.js's or practice-synth.js's, which
     is the workbench's rule: that app carries two engines' markup and prefixes one side's ids
     for exactly this reason. */
  var grid = document.querySelector('.grid');

  function card(id, title, facts) {
    /* `.full` - ONE GRID CELL WIDE IS NOT ENOUGH FOR EITHER OF THESE, and this is the code
       catching up with a claim code2silicon.css has always made: `.c2s-figure` lays the mask
       palette out as a ROW rather than pnr.html's column expressly because "this page's cards are
       full width", and they were not - `card()` never added the class, so both sat in a 568px
       half-width cell at 1440. The header is what made it visible: with the view triple beside the
       Abstract/Detail pair and the zoom trio, 445px of controls and a 69px title do not fit in
       568px and the heading wrapped to FOUR lines (84px, against the Synthesis Results card's 42
       at full width). Both cards hold a drawing meant to be looked at, and the Cell Library view is
       a four-column table, so neither wants half a row. */
    var c = mk('div', 'card full', id);
    var h = document.createElement('h2');
    var fold = mk('span', 'card-collapse-btn');
    fold.setAttribute('data-collapse', '');
    fold.textContent = '▾';
    h.appendChild(fold);
    var wrap = mk('span', 'help-wrap');
    wrap.appendChild(document.createTextNode(title));
    var icon = mk('span', 'help-icon');
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.textContent = '?';
    wrap.appendChild(icon);
    /* The popup must be the icon's NEXT ELEMENT - the shared handler uses
       nextElementSibling - and its own <div>s must balance, or it swallows the rest of the
       card. Both are checked repo-wide by tools/check_theme.py. */
    var pop = mk('div', 'help-popup');
    facts.forEach(function (f) {
      var d = document.createElement('div');
      d.textContent = f;
      pop.appendChild(d);
    });
    wrap.appendChild(pop);
    h.appendChild(wrap);
    /* EVERY CARD GETS THE CONTROLS SPAN, empty unless something is put in it: `.header-controls`
       is the shared right-hand slot every card header here uses, and stashing it on the element is
       what lets a caller fill it - the stub DOM has no querySelector to find it with. */
    var ctl = mk('span', 'header-controls');
    h.appendChild(ctl);
    c.appendChild(h);
    c.controls = ctl;
    grid.appendChild(c);
    return c;
  }

  /* ---- THE HEADER'S TOGGLE GROUPS, pnr.html's own ----
     A group rather than loose buttons because the properties that place them belong to the PAIR,
     and `.layout-toggle`/`.layout-btn` are the shared controls, so this needs no CSS of its own:
     the words take `.wide`, which is pnr.css's rule (see the note there), and the glyph buttons
     take the box as it is. The zoom glyphs are copied from pnr.html, which copied them from
     practice-synth.js's builder - a reader who has zoomed a diagram on a topic page should not
     have to learn a second set of controls, and tools/check_theme.py holds the three copies to
     each other. */
  function toggleGroup(label) {
    var g = mk('span', 'layout-toggle');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    return g;
  }
  function toggleBtn(id, text, title, cls) {
    var b = mk('button', 'layout-btn' + (cls ? ' ' + cls : ''), id);
    b.setAttribute('type', 'button');
    if (title) b.setAttribute('title', title);
    if (text) b.textContent = text;
    return b;
  }
  var ZOOM_GLYPH = {
    out: '<circle cx="6.5" cy="5.5" r="4"/><path d="M9.6 8.6 L14.4 11.4"/><path d="M4.5 5.5 H8.5"/>',
    'in': '<circle cx="6.5" cy="5.5" r="4"/><path d="M9.6 8.6 L14.4 11.4"/><path d="M4.5 5.5 H8.5 M6.5 3.5 V7.5"/>',
    fit: '<path d="M1 4 V1.5 H4 M12 1.5 H15 V4 M15 8 V10.5 H12 M4 10.5 H1 V8"/>'
  };
  function zoomBtn(id, kind, title) {
    var b = toggleBtn(id, '', title);
    b.innerHTML = '<svg viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.4" '
      + 'stroke-linecap="round" stroke-linejoin="round">' + ZOOM_GLYPH[kind] + '</svg>';
    return b;
  }

  /* ---- PLACE & ROUTE RESULTS: the placement, the report and the cell library, one card ----
     `drawStatic` EMPTIES the element it is handed, so the palette cannot be a child of the
     drawing target - it is a sibling, which is the arrangement learn.js records at length. */
  /* THREE VIEWS OF ONE PLACE & ROUTE, chosen by a radio triple on the heading - the card
     Synthesis Results above it already is, down to the classes, which reach this page through
     synth.css so this needs no CSS of its own. It was `Layout` with the Report and the Cell
     Library as two cards of their own; they are views here, and the card is NAMED FOR THE
     ARTEFACT rather than for the drawing, the rule that renamed Netlist Viewer.

     THE FACTS ARE STILL pnr.html's, word for word, because it is the same drawing about the same
     placement and a reader moving between the two pages should not get two accounts of it - now
     grouped per view with the view's own name leading, since one popover answers for three
     panels. */
  var layoutCard = card('c2s-card-layout', 'Place & Route Results', [
    'Layout - cells abut into rows. Every cell is 46.8 \u00b5m tall with vdd and vss at the same height, so rows tile exactly.',
    'A row holds whole cells, so it is short of the block\'s width. The cells are spread across it and the slots filled with fill_gate - one track of rails, wells and body taps - so every row\'s power runs unbroken and the block is a rectangle.',
    'Abstract is the boundary and the pins; Detail is every mask layer.',
    'Route adds the wires to this drawing; Routing hides and shows them.',
    'Route also builds the power ring: a margin each side holding a vdd and a vss strap on METAL2, every row\'s rail continued out to reach them, and a via array at each crossing. vdd is outermost on both sides.',
    'P&R Log - what each stage did, and everything it could not do. A stage that refuses says why here as well as on its button.',
    'Cell Library - the standard cells this page can place, and how many of each the design used. A macro has no layout of its own and expands into cells that do.',
    'Widths are in microns at 0.65 \u00b5m per lambda.'
  ]);
  /* ---- THE HEADER: the three views, then Abstract / Detail and zoom, as pnr.html has them ----
     THE MASK PILLS ARE NOT HERE, and that is the parity rather than a loss: on that page the
     per-mask row belongs to the FABRICATION card, where it acts on the cross-section, and the
     Layout card's answer to what-is-drawn is this pair. So the pills move down with it (see the
     Fabrication card below) and Abstract/Detail takes their place here. */
  /* `pnrView` IS NOT `layoutView`, and the two are one letter apart on purpose-avoidance: this
     one is which PANEL is up (layout / report / cells), `layoutView` below is which layer set the
     DRAWING uses (phantom / all). Naming them alike is how they would come to be confused.

     NOT PERSISTED, the reasoning practice-synth.js records for its own triple: every stage FORCES
     a view - the drawing when it succeeds, the report when it does not - so a stored choice could
     only survive until the next press, and a preference nobody can hold is not a preference. The
     Abstract/Detail choice and the zoom, which the reader really does keep, are unaffected. */
  var pnrView = 'layout';
  var viewsGroup = mk('span', 'view-group');
  /* THE LABELS AND THE VALUES ARE ALLOWED TO DIFFER, and one of the three does. `layout` happens
     to match its label; `report` backs `P&R Log` and keeps its own name, which is the
     churn-vs-clarity call practice-synth.js made for the same shape - `area` and `netlist` still
     back `Synthesis Log` and `Gate-level Verilog` there rather than being renamed twice.

     `P&R` IS DELIBERATE and is the one abbreviation on the page: a past commit removed it as a
     label from pnr.html's tab, "where its siblings name themselves in full", so this is that
     decision knowingly overruled for a radio sitting beside `Cell Library` in a header of fixed
     width - not an oversight to fix back. */
  [['c2sViewLayoutRadio', 'layout', 'Layout'],
   ['c2sViewReportRadio', 'report', 'P&R Log'],
   ['c2sViewCellsRadio', 'cells', 'Cell Library']].forEach(function (v) {
    var lab = mk('label', 'view-toggle' + (v[1] === 'layout' ? ' on' : ''));
    lab.setAttribute('for', v[0]);
    var r = mk('input', null, v[0]);
    r.setAttribute('type', 'radio');
    r.type = 'radio';
    /* A name of its OWN, not synthView: two radio groups sharing a name are one group, so
       picking a view here would clear the Synthesis Results card's. */
    r.setAttribute('name', 'pnrView');
    r.setAttribute('value', v[1]);
    r.value = v[1];
    if (v[1] === 'layout') r.checked = true;
    /* Reads ev.target.value rather than which radio is checked, so it does not depend on
       radio-group exclusivity - a property of a real DOM the headless stub does not model, so a
       `.checked` sweep would pass in a browser and switch nothing under test. */
    r.addEventListener('change', function (ev) {
      setPnrView((ev && ev.target && ev.target.value) || v[1]);
    });
    lab.appendChild(r);
    var t = mk('span');
    t.textContent = v[2];
    lab.appendChild(t);
    viewsGroup.appendChild(lab);
  });
  layoutCard.controls.appendChild(viewsGroup);
  var viewGroup = toggleGroup('View');
  var viewAbstractBtn = toggleBtn('c2sViewAbstract', 'Abstract', 'The boundary and the pins', 'wide');
  var viewDetailBtn = toggleBtn('c2sViewDetail', 'Detail', 'Every mask layer', 'wide');
  viewGroup.appendChild(viewAbstractBtn);
  viewGroup.appendChild(viewDetailBtn);
  layoutCard.controls.appendChild(viewGroup);
  var zoomGroup = toggleGroup('Zoom');
  var zoomOutBtn = zoomBtn('c2sZoomOut', 'out', 'Zoom out');
  var zoomInBtn = zoomBtn('c2sZoomIn', 'in', 'Zoom in');
  var zoomFitBtn = zoomBtn('c2sZoomFit', 'fit', 'Zoom to fit the whole layout');
  zoomGroup.appendChild(zoomOutBtn);
  zoomGroup.appendChild(zoomInBtn);
  zoomGroup.appendChild(zoomFitBtn);
  layoutCard.controls.appendChild(zoomGroup);

  var layoutBox = mk('div', 'c2s-figure', 'c2sLayoutBox');
  var layoutDraw = mk('div', 'c2s-draw', 'c2sLayoutDraw');
  layoutBox.appendChild(layoutDraw);
  layoutCard.appendChild(layoutBox);
  /* WHAT WAS PLACED AND HOW BIG IT IS, at the bottom of the Layout pane and under the drawing it is about.
     It used to sit inside the Fabrication card, captioning that figure's own small second copy of the
     layout - a fact about the ARRANGEMENT under a drawing of the process, and only there once Fabricate
     had been pressed. `PRACTICE_PNR_API.tallyLine` is the one formatter, shared with pnr.html's Layout
     card, so the two pages cannot word the same fact two ways.

     `.fab-tally` is its class, which is pnr.css's and is already loaded here - the same rule that dressed
     it in the figure, so moving it needs no CSS. */
  var layoutTally = mk('div', 'fab-tally', 'c2sLayoutTally');
  layoutCard.appendChild(layoutTally);
  var layoutEmpty = mk('div', 'wave-empty', 'c2sLayoutEmpty');
  layoutEmpty.textContent = 'Synthesize, then press Place.';
  layoutCard.appendChild(layoutEmpty);

  /* ---- REPORT + CELL LIBRARY: two more VIEWS of the card above, not two cards ----
     They were `Report` and `Cell Library`, one card each as pnr.html has them, and they are the
     second and third panel of Place & Route Results now - so the page has one home per artefact
     and ten cards where it had twelve. Everything else about them is unchanged: the report is
     still a `console-box` and the library still a `.pnr-table`, so pnr.css dresses both exactly
     as it did, and both keep their ids (`c2sReport`, `c2sCellTable`) because those are what the
     harness drives. */
  var reportBox = mk('div', 'console-box', 'c2sReport');
  /* THE PREREQUISITE IS SYNTHESIS, NOT A RUN. This said `Press Run to simulate, then work down the
     row.`, which named the wrong step twice over: nothing here needs a simulation - a design can be
     placed without Run ever being pressed - and the flow strip is a horizontal row, so there is no
     `down` to work. It is the layout card's own empty-state wording now, so the two panels of one
     card cannot give a reader two different accounts of what to do next. */
  reportBox.textContent = 'Synthesize, then press Place.';
  layoutCard.appendChild(reportBox);

  /* BUILT WITH createElement, head and body both - an innerHTML string here has no elements in
     the stub DOM, so `querySelector('tbody')` returns null, renderCells returns early and the
     table is never filled while every other check passes. That is the same trap this file's
     cards are built out of real elements to avoid, one level down. */
  var cellsTable = document.createElement('table');
  cellsTable.className = 'pnr-table';
  cellsTable.id = 'c2sCellTable';
  var thead = document.createElement('thead');
  var hrow = document.createElement('tr');
  ['cell', 'width', 'pins', 'used'].forEach(function (h) {
    var th = document.createElement('th');
    th.textContent = h;
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  cellsTable.appendChild(thead);
  var cellsBody = document.createElement('tbody');
  cellsTable.appendChild(cellsBody);
  layoutCard.appendChild(cellsTable);

  /* ---- FABRICATION: a cut through the placement, and the process that builds it ---- */
  /* `Mock Fabrication`, the same title pnr.html's card carries - one card, one name. The BUTTON
     that opens it is still `Fabricate` on the flow strip (and `Fabrication` on pnr.html), because a
     stage control names the verb where the card names the artefact: the split Run / Simulation
     Results already uses. */
  var fabCard = card('c2s-card-fab', 'Mock Fabrication', [
    'A vertical cut through the layout above, showing what a wafer looks like at that x.',
    'Click the layout to move the cut; the marker on it says where you are, and how tall it is says which rows.',
    'Max rows caps how many rows the section shows, centred on the row you clicked - a cut through a tall placement is otherwise rows a few pixels each.',
    'The steps run bottom-up, the order a real process deposits them in.'
  ]);
  /* THE WHOLE FIGURE AND ITS PLAYER COME FROM THE RENDERER, which is the card pnr.html shows: the
     mask palette, the placement with its cut marker, the cross-section, the step text and the
     Play / Reset / progress-bar row. This page used to build three boxes of its own - a `cut at N
     µm` line, the pills and the section - so it had no process at all, and the third (?) fact
     below promised steps that were not there. `attachFabrication` owns all of it now, so the two
     pages cannot drift into two cards.

     THE HOST STILL SUPPLIES THREE THINGS and keeps its own flow: which placement to cut, the row
     budget it was placed at (so this drawing and Place & Route Results above are the same
     arrangement), and the netlist text. */
  var fabFigHost = mk('div', null, 'c2sFabFig');
  fabCard.appendChild(fabFigHost);
  var fab = window.PRACTICE_PNR_API.attachFabrication(fabFigHost, {
    plan: function () { return layoutRes; },
    rowLambda: function () { return layoutRes ? layoutRes.rowLambda : 0; },
    netlist: function () { return netlistText; }
  });
  var fabEmpty = mk('div', 'wave-empty', 'c2sFabEmpty');
  fabEmpty.textContent = 'Route, then press Tapeout.';
  fabCard.appendChild(fabEmpty);

  /* Hidden until the stage that fills them has run, and REVEALED rather than built late, so
     the page reads as a flow with steps still to come rather than one missing four panels.
     `wave-empty` carries the "nothing here yet" line, which is app.js's own idiom.

     `layoutShown` is remembered because the drawing's own empty state and the VIEW are two
     different questions now: the box is hidden on the report view whether or not a placement
     exists, and `showFigures` must not be what decides that. */
  var layoutShown = false;
  function showFigures(on) {
    layoutShown = !!on;
    syncPnrView();
  }
  function showFab(on) {
    fabFigHost.style.display = on ? '' : 'none';
    fabEmpty.style.display = on ? 'none' : '';
  }

  /* THE SINGLE WRITER of everything the view decides: both encodings of the selection (the
     radios' `checked` and the pills' `.on` class, which is why neither can be changed alone),
     which panel is up, the drawing's own empty state, and whether the two groups that can only
     act on the drawing are in the header at all.

     HIDDEN, not disabled, for those two: a control that cannot act on the panel in front of you
     and has nothing saying why is worse than one that is not there - the module-list toggle's
     rule on the Synthesis Results card. The header reshuffles as a reader switches, which is the
     cost, and it is the smaller one here because both are whole GROUPS rather than one button in
     a fixed row. */
  /* THE LAYOUT'S CAPTION, from one writer: three paths draw the layout (Place, Route and the
     Abstract/Detail redraw) and a fourth clears it, so a line written at each of them is four chances to
     say something the drawing does not. `tallyLine` is `practice-pnr.js`'s - shared with pnr.html's own
     Layout card - so the wording exists once for the whole repo. */
  function writeTally() {
    var api = window.PRACTICE_PNR_API;
    if (!layoutTally) return;
    layoutTally.textContent = (layoutRes && api && api.tallyLine)
      ? api.tallyLine(layoutRes.placed, layoutRes.planWidth, layoutRes.planHeight)
      : '';
  }

  function syncPnrView() {
    var layout = pnrView === 'layout';
    [['c2sViewLayoutRadio', 'layout'], ['c2sViewReportRadio', 'report'],
     ['c2sViewCellsRadio', 'cells']].forEach(function (v) {
      var r = document.getElementById(v[0]);
      if (!r) return;
      r.checked = v[1] === pnrView;
      if (r.parentElement) r.parentElement.classList.toggle('on', r.checked);
    });
    layoutBox.style.display = (layout && layoutShown) ? '' : 'none';
    layoutEmpty.style.display = (layout && !layoutShown) ? '' : 'none';
    /* THE CAPTION FOLLOWS THE DRAWING, for the reason the empty state does: on the Report or the Cell
       Library it would be a line about a panel that is not on screen. */
    layoutTally.style.display = (layout && layoutShown) ? '' : 'none';
    reportBox.style.display = pnrView === 'report' ? '' : 'none';
    cellsTable.style.display = pnrView === 'cells' ? '' : 'none';
    viewGroup.style.display = layout ? '' : 'none';
    zoomGroup.style.display = layout ? '' : 'none';
    /* The drawing was sized while its panel was `display: none` on any switch away and back, so
       the fit was computed against a box with no width - the obligation every container-width
       change on this page already carries, and the last line of syncResultsView for the same
       reason. Guarded on there being a drawing: `fitLayout` reads `layoutRes`. */
    if (layout && layoutShown) fitLayout();
  }
  function setPnrView(view) {
    pnrView = view === 'report' ? 'report' : (view === 'cells' ? 'cells' : 'layout');
    syncPnrView();
  }
  showFigures(false);
  showFab(false);

  /* ---- THE TWO GENERIC CARD CONTROLS, AND THE FOLD-UNTIL-IT-HAS-SOMETHING RULE ----

     app.js wires `[data-collapse]` and `.help-icon` with querySelectorAll AT LOAD, and these two
     cards did not exist then: this file runs after it. So the chevron did nothing and the (?)
     never opened - built correctly, with seven facts behind one of them, and no handler on either.
     `wireCardControls` is app.js's own function now rather than a third copy of those handlers;
     the bare binding, not `window.`, for the reason practice-synth.js records at its own call.

     FOLDED, NOT HIDDEN, and that is the choice this page makes about every card that has no
     result yet. Hiding gives the cleaner rule - a card exists iff its artefact does - and it
     takes the (?) with it: the seven facts explaining rows, fill_gate, Abstract against Detail
     and the power ring would be unreachable until you had already placed. Folded, a card is one
     header line, its (?) still opens, and the page does not jump as stages complete. It is also
     what the twenty practice pages already do with the Waveform Viewer and the Module Hierarchy,
     for the reason recorded there: a panel with nothing in it reads better as a closed header
     than as an empty box.

     THE SYNTHESIS RESULTS CARD IS PINNED so it is PRESENT to be folded. practice-synth hides it
     until a synthesis succeeds - right on a practice page, where an exercise the synthesizer
     cannot read should show nothing under the waveform - and on this page it leaves a gap in a
     flow whose whole subject is that it has five stages. `pinCard` is that file's own seam and
     learn.js already uses it for the same reason.

     UNFOLDED BY THE FIRST RESULT ONLY, so a reader who folds one back up is not overruled by the
     next press - the rule practice.js's own first-Run unfold follows. */
  if (typeof wireCardControls === 'function') {
    wireCardControls(layoutCard);
    wireCardControls(fabCard);
  }
  if (window.PRACTICE_SYNTH_API && window.PRACTICE_SYNTH_API.pinCard) {
    window.PRACTICE_SYNTH_API.pinCard();
  }

  /* Every card that holds a RESULT, with what it waits for. `card-wave` and `card-hierarchy` are
     app.js's and are folded on a practice page by practice.js, which this page does not load -
     so without this they sit open and empty here, which is the inconsistency all of this is
     about. */
  var FOLD_UNTIL = ['card-netlist', 'c2s-card-layout', 'c2s-card-fab',
                    'card-wave', 'card-hierarchy'];
  var unfolded = {};
  function fold(id, on) {
    if (typeof foldCard === 'function') foldCard(id, on);
  }
  FOLD_UNTIL.forEach(function (id) { fold(id, true); });
  /* AND ASKING FOR THE HIERARCHY PANEL COUNTS AS WANTING IT. That card is hidden by a class on
     its PARENT (`.split-row.hierarchy-collapsed`) rather than by anything here, and app.js applies
     that toggle's persisted state before this file runs - so a reader who asks to see the panel
     before running anything would be handed a folded header, which is a dead control. The same
     guard practice.js carries, for the same reason and in the same words. */
  (function () {
    var hierBtn = $('hierarchyToggleBtn');
    if (hierBtn) {
      hierBtn.addEventListener('click', function () { revealCard('card-hierarchy'); });
    }
  })();
  /* `revealCard` is the ONE writer of that first unfold, and it records the card rather than
     asking whether it is folded: a reader who closed it again has a folded card that has already
     been revealed, and re-opening it on the next press is the override this rule exists to
     avoid. */
  function revealCard(id) {
    if (unfolded[id]) return;
    unfolded[id] = true;
    fold(id, false);
    /* THE WAVEFORM MUST REDRAW WHEN IT IS UNFOLDED. It was drawn while the card was collapsed, so
       its canvas had no width - and `canvas { width: 100% !important }` STRETCHES a stale drawing
       over an unchanged backing store rather than clipping it, which puts every cursor click and
       drag-zoom at the wrong time. The same obligation practice.js's unfold carries, at the same
       moment. */
    if (id === 'card-wave' && typeof lastResult !== 'undefined' && lastResult) {
      drawWaveform(lastResult);
    }
  }
  /* THE LIBRARY IS DRAWN AT LOAD, because it is a fact about the page rather than a result: these
     are the cells this page can place whether or not anything has been placed, and `renderCells`
     already works with no placement - every `used` reads 0 until Place fills the tally. Without
     this the Cell Library view is an empty table with no empty state, which reads as a panel that
     failed rather than as a stage not yet run. */
  renderCells();

  /* ------------------------------------------------------------------ the Report
     One writer, so a stage's own account and the console cannot disagree. `logLine` is
     app.js's and writes into ITS console; this is a second panel with the same shape, because
     the simulation console is the design's output and this is the tool's. */
  function say(text, cls) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    reportBox.appendChild(d);
  }
  function sayFresh(text, cls) { reportBox.innerHTML = ''; say(text, cls); }

  /* An unplaceable entry is the INSTANCE the placer could not place - an object, not a name -
     so it is named by its type and counted, `2 x FUNC_add4` rather than `[object Object]`. A
     type is what a reader can act on: it is the cell the library has no layout for. */
  function cellTypes(list) {
    var n = {};
    (list || []).forEach(function (i) {
      var t = (i && (i.type || i.cell)) || String(i);
      n[t] = (n[t] || 0) + 1;
    });
    return Object.keys(n).sort().map(function (t) {
      return n[t] > 1 ? n[t] + ' × ' + t : t;
    }).join(', ') || '(nothing named)';
  }

  /* ------------------------------------------------------- the three stage buttons
     THEY LIVE IN THE FLOW STRIP NOW, not in the Synthesis Results card, so `buildStrip` below
     is what appends them - it is the one place that knows where a stage control belongs. They
     keep their ids, because those are what the harness drives and what a reader of the flow
     names; and they are created HERE rather than inside the strip builder so `doPlace` and
     friends can still reach them, and so the strip can be rebuilt without making new ones. */
  function stageButton(id, label) {
    var b = mk('button', 'btn flow-stage', id);
    b.textContent = label;
    b.disabled = true;
    return b;
  }
  var placeBtn = stageButton('c2sPlaceBtn', '▦ Place');
  var routeBtn = stageButton('c2sRouteBtn', '⌗ Route');
  /* `Tapeout`, which is what sending a finished layout to be made is called - and the last stage of
     this page's flow is exactly that. The id stays `c2sFabBtn`: it is what the harness drives and
     what the strip maps to the card, and neither is a claim about the word on the button. */
  var fabBtn = stageButton('c2sFabBtn', '◈ Tapeout');

  /* WHICH BUTTONS ARE LIVE IS DERIVED FROM `stage`, in one place, so a stage cannot be
     reachable out of order and no button needs to know about any other. `synthReady` asks
     practice-synth.js whether a netlist is actually on the page rather than tracking its own
     copy of that - it is that file's cards that come and go. */
  /* IS THERE A NETLIST TO PLACE - not "is the Synthesis Results card on the page", which is what
     this asked and is no longer the same question. All three failure paths in `runSynthesis` call
     `showCards(true)` deliberately, so a refused design keeps its card and has somewhere to report
     the error; `cardsShown()` therefore became true after a FAILURE, and Place went live with no
     gates behind it. Pressing it then hit `doPlace`'s own refusal - `Nothing to place - synthesize
     first.` - which is the button and the action disagreeing about whether the step can be run.

     So it reads exactly what doPlace requires. That is this page's own rule for the flow strip,
     applied one level down: availability comes from the control or the artefact the button acts on,
     never from a second thing tracked beside it. `stage` needs no correction here - it is raised to
     2 on the synthesize CLICK, which is bookkeeping rather than gating, and 3 and 4 are set at the
     END of doPlace and doRoute, i.e. on success. */
  function synthReady() {
    var api = window.PRACTICE_SYNTH_API;
    return !!(api && api.netlistText && api.netlistText());
  }
  function syncButtons() {
    placeBtn.disabled = !synthReady();
    routeBtn.disabled = stage < 3;
    fabBtn.disabled = stage < 4;
    syncStrip();
  }

  /* --------------------------------------------------------------- stage 3: place */
  function doPlace() {
    /* ON THE ATTEMPT, not on success, and for the reason the netlist card is revealed the same
       way: every refusal below writes the P&R Log and switches to it, and that log is INSIDE this
       card - so a folded card would hide the reason the stage was refused. Route draws into this
       same card, so it needs no reveal of its own. */
    revealCard('c2s-card-layout');
    var api = window.PRACTICE_PNR_API;
    netlistText = (window.PRACTICE_SYNTH_API && window.PRACTICE_SYNTH_API.netlistText
                   && window.PRACTICE_SYNTH_API.netlistText()) || '';
    if (!netlistText) {
      say('Nothing to place - synthesize first.', 'info');
      setPnrView('report');
      return null;
    }
    /* THE STALE MARK IS CLEARED HERE, not in the button's handler. It was in the handler, and the
       check that caught it is the honest kind: `api.place()` is a second caller - the harness's,
       and any future one - so a placement made that way left the band saying the drawing was out
       of date about a drawing it had just made. A stage clears its own warning. */
    markStale(false);
    sayFresh('placing ' + netlistText.split('\n').length + ' lines of netlist', 'info');

    /* THE SIZE REFUSAL BEFORE THE WORK, not after: the cap is about the router and the
       drawing, and both are downstream of here. Counted on the EXPANDED cell list, so a macro
       counts as the gates it becomes rather than as one instance. */
    var gates = 0;
    try {
      /* THREE STEPS, NOT TWO. `parse` reads every module and returns the TOP's own instances
         plus the module map; `flatten` is what walks that hierarchy down to the cell library
         and the macros; `expand` turns a macro into the cells it is made of. This counted
         `expand(parse(...).instances)` under a comment claiming parse flattens as it goes,
         which is what made the number here disagree with the drawing on any design with a
         sub-module: the counter reported 13 where the synthesizer said 19, and the generated
         FUNC_add4 was dropped by the placer without a word. Same chain as planFor's, which is
         what makes the number counted here the number that would be placed. */
      var P = window.PNR;
      var parsed = P.parse(netlistText);
      var flat = P.flatten ? P.flatten(parsed) : { instances: parsed.instances };
      gates = P.expand(flat.instances).instances.length;
    } catch (err) {
      say(/^Parse error/.test(err.message) ? err.message : 'Parse error: ' + err.message, 'err');
      showFigures(false);
      setPnrView('report');
      stage = 2; syncButtons();
      return null;
    }
    if (gates > MAX_GATES) {
      say(TOO_BIG_MSG, 'err');
      say('  ' + gates + ' gate(s) after flattening, limit ' + MAX_GATES
          + ' - nothing was placed', 'err');
      showFigures(false);
      setPnrView('report');
      stage = 2; syncButtons();
      return null;
    }

    /* `drawStatic` places AND draws in one call - it is what a learn topic figure uses - and
       returns the extent plus the handle the cross-section needs. Revealed BEFORE it draws,
       because a hidden box has no width and the fit would be computed against nothing. */
    /* THE VIEW IS FORCED BEFORE THE BOX IS REVEALED, and that order is the whole of it: a
       reader who was reading the Report presses Place, and `showFigures(true)` reveals a panel
       that is still `display: none` because the report is up - so `drawStatic` would size the
       drawing against a box with no width, which is the accident this reveal-before-draw exists
       to avoid in the first place. Both lines end in `syncPnrView`; this one decides which panel
       that call puts up. A placement that then FAILS flips to the report below. */
    setPnrView('layout');
    showFigures(true);
    /* `route: false` is what makes Place a PLACE. `planFor` routes unless told not to, so the
       default would pay the router here - 13.7 s at the cap - and leave nothing for Route to
       do but unhide wires that were already computed. Two stages, two costs.

       `shape: 'squarest'` is what pnr.html's own Place does: one placement per candidate row
       count, keeping the closest to square. Without it a figure takes one row however many cells
       it has, which is right in an article column and wrong on a full-width card - 25 cells came
       out as a 660 x 47 µm ribbon nobody can read the middle of. The chosen budget comes back as
       `rowLambda` and is REMEMBERED, because the Fabrication figure re-places the same design and
       the two drawings must be the same arrangement. */
    /* `ring: true` ON ALL THREE CALLS, because this page places and routes a real BLOCK and a ring is
       what a block has - the alternative, a figure in an article column, is the case that declines it.
       Harmless on this one, which routes nothing: the ring is built by `route`, so Place draws the bare
       floorplan either way and Route below is where it appears. Asked for here anyway, so the three
       drawings of one design cannot disagree about what they are of. */
    layoutRes = api.drawStatic(layoutDraw, { netlist: netlistText, view: layoutView, route: false,
                                             shape: 'squarest', ring: true });
    writeTally();
    routed = false;
    if (layoutRes.error) {
      say(layoutRes.error, 'err');
      showFigures(false);
      setPnrView('report');
      stage = 2; syncButtons();
      return null;
    }
    if (!layoutRes.cells) {
      say('nothing could be placed - no layout for: ' + cellTypes(layoutRes.unplaceable), 'err');
      showFigures(false);
      setPnrView('report');
      stage = 2; syncButtons();
      return null;
    }
    /* THE REPORT IS pnr.html's, sentence for sentence, because it is the same placement and a
       reader moving between the two pages should not have to learn two accounts of it. Four
       things, and the first two are what the old one-liner left out: how many instances the top
       module named against how many the flattening found (on a hierarchical netlist the top's own
       count says nothing about what was placed), and the SHAPE - a number the page decided for
       you is a decision, and a decision nobody can see is a silent one.

       `umWidth`/`umHeight` are already microns - `width`/`height` are the PIXEL box - so this
       must not go through `um` again, which would convert a converted number. `rowLambda` is in
       whole lambda, hence the * 1000 through `um`. */
    var wrote = layoutRes.topInstances === layoutRes.flatInstances
      ? layoutRes.topInstances + ' instance(s)'
      : layoutRes.topInstances + ' instance(s) flattened to ' + layoutRes.flatInstances;
    say('module ' + (layoutRes.module || '?') + ': ' + wrote + ', '
        + layoutRes.cells + ' cell(s) placed in ' + layoutRes.rows + ' row(s)');
    say('area ' + layoutRes.umWidth + ' × ' + layoutRes.umHeight + ' µm in '
        + layoutRes.rows + ' row(s) of up to ' + api.um(layoutRes.rowLambda * 1000)
        + ' µm - the squarest of the ' + layoutRes.cells + ' arrangements this design has');
    (layoutRes.expanded || []).forEach(function (e) { say('  expanded ' + e, 'info'); });
    /* WHAT WAS LEFT OUT IS SAID OUT LOUD, and this is the half that was missing: a design with
       some placeable cells and some without reported only the ones that made it, so the Layout
       card was short of cells with nothing on the page to say which or why - the silent
       truncation this repo keeps designing against. Only the branch where NOTHING placed ever
       mentioned it. `cellTypes` is what makes it readable: `unplaceable` holds instance
       OBJECTS, so joining them printed `[object Object]`, the same mistake the layer buttons
       were making one card up. */
    (layoutRes.problems || []).forEach(function (p) { say('  ' + p, 'warn'); });
    (layoutRes.pinProblems || []).forEach(function (p) { say('  ' + p, 'err'); });
    if ((layoutRes.unplaceable || []).length) {
      say('  ' + layoutRes.unplaceable.length + ' cell(s) NOT placed, no layout for: '
          + cellTypes(layoutRes.unplaceable), 'err');
    }
    /* AND THE ALL-CLEAR, which is not decoration: with only failures printed, a clean placement
       and a placement whose problems were never checked read exactly the same. */
    if (!(layoutRes.pinProblems || []).length && !(layoutRes.unplaceable || []).length
        && !(layoutRes.problems || []).length) {
      say('every instance placed, every pin resolved');
    }
    renderCells();
    /* FITTED HERE, and this is not decoration: `drawStatic` sizes a drawing from ROW_PX and knows
       nothing about the box it lands in, so an unfitted placement of any size overflows a 460px
       window and the reader sees the top-left corner of it. Measured in Chrome before this line
       existed: a 25-cell design drew at 300x150 in a 516x460 box - which happens to fit, and is
       exactly the accident that hides the bug on a small design. */
    fitLayout();
    cut = null;
    stage = 3;
    showFab(false);
    syncButtons();
    syncStrip();
    return layoutRes;
  }

  /* --------------------------------------------------------------- stage 4: route */
  function doRoute() {
    if (!layoutRes) { say('Nothing to route - place first.', 'info'); setPnrView('report'); return null; }
    var api = window.PRACTICE_PNR_API;
    /* Redrawn WITH the wires rather than drawn over: `drawStatic` applies the routing itself
       when asked, so the drawing and the plan cannot end up describing different metal. */
    layoutRes = api.drawStatic(layoutDraw, { netlist: netlistText, view: layoutView,
                                             rowWidth: layoutRes.rowLambda, ring: true });
    writeTally();
    routed = true;
    if (layoutRes.error) {
      say('Route error: ' + layoutRes.error, 'err');
      setPnrView('report');
      return null;
    }
    /* The counts are NUMBERS on the result, not lists - `unrouted` is how many failed, which is
       what to report; naming them would mean reaching into `routes` for a second reading of the
       same run. */
    say('routed ' + layoutRes.nets + ' net(s) in ' + layoutRes.routeShapes + ' shape(s)');
    if (layoutRes.ioNets) say('  ' + layoutRes.ioNets + ' net(s) left as I/O', 'info');
    if (layoutRes.unrouted) say('  ' + layoutRes.unrouted + ' net(s) could not be routed', 'err');
    /* THE DRAWING, because a successful Route is a change to it - the same rule Place follows.
       `setPnrView` fits, which is what a routed drawing needs anyway: it is a NEW svg, so the
       view has to be told its size again. */
    setPnrView('layout');
    fitLayout();
    stage = 4;
    syncButtons();
    syncStrip();
    return layoutRes;
  }

  /* ---------------------------------------------------- stage 5: fabricate
     A CUT IS A CHOICE, so the page makes one for the reader the first time and then leaves it
     to them: `defaultCut` is the renderer's own answer to "where is worth looking", and a
     click on the layout moves it. Nothing re-derives it behind the reader's back once set. */
  function doFabricate() {
    revealCard('c2s-card-fab');
    if (!layoutRes) {
      say('Nothing to cut - place and route first.', 'info');
      setPnrView('report');
      return null;
    }
    var api = window.PRACTICE_PNR_API;
    if (cut === null) cut = api.defaultCut(layoutRes);
    if (cut === null) {
      say('no cut is available for this placement', 'err');
      setPnrView('report');
      return null;
    }
    /* REVEALED BEFORE IT DRAWS, the rule this page already follows for the layout: the figure fits
       its drawing to the column it sits in, and a hidden box has no width to fit to. */
    showFab(true);
    /* THE FIGURE OPENS ITSELF on a cut through the first cell and then plays, which is
       `attachFabrication`'s own arrival - the same one pnr.html's Fabrication button gives. What
       stays here is the part that is about this PAGE: revealing the card, the stage number, the
       strip and the scroll. */
    if (fab) { fab.openOn(); fab.play(); }
    stage = 5;
    syncButtons();
    syncStrip();
    /* NO SCROLL HERE. The strip's own handler scrolls to `st.card` after every stage runs, and
       this had a SECOND one - the only stage that did. Two scrolls at one press is not merely
       redundant: this one was `behavior: 'smooth'`, so it was still animating when `goTo` ran its
       instant scroll and `clearStickyOverlap` measured the band, and the animation then finished
       on top of the correction. Measured on the 4-bit Counter, the press moved the page 1532 ->
       1843 and the card's title landed at y=434 - well below the band at 179, i.e. a third of the
       viewport of empty space above the card it had just scrolled to.

       Left to the strip, Fabricate arrives exactly as Place and Route do, and the band correction
       is applied once by the one function that owns it. */
    return cut;
  }

  /* NO drawCut AND NO CUT-PICKING HERE ANY MORE. Both were this page's own: a `cut at N µm` line
     over a section, and a click handler on the Layout card's drawing that moved it. The figure
     carries its OWN copy of the placement now and wires the pointer to it - press, drag or hover,
     with the hover marker showing where a click would cut - so a second picker on the card above
     would be two controls for one cut, disagreeing whenever the two drawings showed different
     views. The Layout card is back to being a layout. */

  /* ---- THE SHARED PAN AND ZOOM, on the layout's own box ----
     `attachView` is practice-pnr.js's - the same code pnr.html's three buttons drive, so the two
     apps cannot end up with two gesture sets. It needs the two things only this page knows: the
     drawing's UNSCALED size, which `drawStatic` reports, and how to re-size it at a scale.

     THE RESIZE IS A RE-SIZE, NOT A RE-DRAW, which is the one place this differs from pnr.html:
     that page re-renders its svg (cheap - `placementSvg` again), where here a redraw would go back
     through `planFor` and re-PLACE, and on a routed design re-route. So the inner wrapper and the
     svg are rewritten from the drawing's base size, which is exactly what pnr.html's own
     `renderPlacement` does with its scale, and the viewBox carries the coordinates so every shape
     - the cut marker included - scales with it. */
  function ensureView() {
    var api = window.PRACTICE_PNR_API;
    if (panZoom || !api || !api.attachView) return panZoom;
    panZoom = api.attachView(layoutDraw, {
      size: function () {
        return layoutRes ? { w: layoutRes.width, h: layoutRes.height } : { w: 0, h: 0 };
      },
      resize: function (k) {
        if (!layoutRes || !layoutRes.layer || !layoutRes.svg) return;
        var w = Math.round(layoutRes.width * k), h = Math.round(layoutRes.height * k);
        layoutRes.layer.style.width = w + 'px';
        layoutRes.layer.style.height = h + 'px';
        layoutRes.svg.setAttribute('width', String(w));
        layoutRes.svg.setAttribute('height', String(h));
      }
    });
    return panZoom;
  }
  /* FITTED AFTER EVERY DRAW, because `drawStatic` sizes the drawing from ROW_PX and knows nothing
     about the box it landed in - which is the renderer's own rule, and it is why a fit is this
     page's job. Called after the box is visible, or the fit is computed against a box with no
     width. */
  function fitLayout() {
    var v = ensureView();
    if (v && layoutRes && layoutRes.width) v.fit();
  }

  /* ---- ABSTRACT / DETAIL: the same drawing, a different layer set ----
     It re-places at the budget the first Place chose (`rowWidth: rowLambda`) rather than searching
     again, so switching the view cannot silently rearrange the design under the reader - and it
     asks for the wires again only if they are already on screen. */
  function redrawLayout() {
    var api = window.PRACTICE_PNR_API;
    if (!layoutRes || !api) return;
    var res = api.drawStatic(layoutDraw, { netlist: netlistText, view: layoutView,
                                           rowWidth: layoutRes.rowLambda, route: routed, ring: true });
    if (res.error || !res.cells) {
      /* A FAILED REDRAW GOES TO THE REPORT TOO, and this is the path a reader is least likely to
         expect: the Abstract/Detail pair is on the drawing's own view, so without this the reader
         presses Abstract, the drawing does not change, and the reason is written into a panel they
         cannot see. Switching away takes the pair off the header with it, which is honest - the
         thing it acts on is not what is up. */
      say(res.error || 'nothing could be redrawn', 'err');
      setPnrView('report');
      return;
    }
    layoutRes = res;
    writeTally();
    fitLayout();
    /* AND THE FIGURE FOLLOWS THE REDRAW, because it holds its own copy of the placement: a
       view switch above must not leave the cross-section describing the drawing that was there
       before it. Guarded on the card being open - `draw` fits to a column, and a hidden one
       has no width. */
    if (fab && fabFigHost.style.display !== 'none') fab.draw();
  }

  function syncViewButtons() {
    viewAbstractBtn.className = 'layout-btn wide' + (layoutView === 'phantom' ? ' active' : '');
    viewDetailBtn.className = 'layout-btn wide' + (layoutView === 'all' ? ' active' : '');
  }
  /* ONCE AT INIT, so the lit button comes from `layoutView` exactly as every later press does -
     see the note on that variable for why this replaced a hardcoded class. */
  syncViewButtons();
  [[viewAbstractBtn, 'phantom'], [viewDetailBtn, 'all']].forEach(function (pair) {
    pair[0].addEventListener('click', function () {
      if (layoutView === pair[1]) return;
      layoutView = pair[1];
      syncViewButtons();
      redrawLayout();
    });
  });
  zoomOutBtn.addEventListener('click', function () { var v = ensureView(); if (v) v.zoomBy(1 / 1.3); });
  zoomInBtn.addEventListener('click', function () { var v = ensureView(); if (v) v.zoomBy(1.3); });
  zoomFitBtn.addEventListener('click', function () { fitLayout(); });

  /* ---- NO LAYER PALETTE HERE ANY MORE ----
     It was this page's own row of pills over the section. `attachFabrication` builds the palette
     inside the figure, which is where pnr.html puts it and for a reason this version could not
     reach: `setLayerVisible` governs whatever element it is handed, so a palette INSIDE the figure
     takes a mask out of the placement and the cross-section with one call. Ours was handed
     `fabBody` alone, so hiding METAL1 left it in the drawing it was a cut through. */

  /* ---- THE CELL TABLE, counted from the placement rather than listed, and in MICRONS through
     the renderer's own conversion so this table and the Layout card's extent cannot disagree
     about how big a cell is. */
  function renderCells() {
    var api = window.PRACTICE_PNR_API;
    var tb = cellsBody;
    tb.innerHTML = '';
    var used = {};
    (layoutRes && layoutRes.tally || []).forEach(function (t) { used[t.type] = t.count; });
    var cells = window.PNR.cells();
    Object.keys(cells).sort().forEach(function (n) {
      var c = cells[n];
      var tr = document.createElement('tr');
      /* `c.w / c.scale` is the width in whole lambda and `um` takes milli-lambda, so the * 1000
         is the round trip between them - the scale field honoured rather than assumed to be
         1000, which is what pnr.html's own table does. */
      [n, api.um(c.w / c.scale * 1000) + ' \u00B5m',
       Object.keys(c.pins).filter(function (p) { return p !== 'vdd' && p !== 'vss'; }).join(' '),
       String(used[n] || 0)].forEach(function (v) {
        var td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  /* --------------------------------------------------------- staleness
     AN EDIT MARKS EVERY STAGE DOWNSTREAM STALE and clears none of them. The band is the
     editor's own `.editor-sync-warning`, which practice-synth.js already raises on its two
     cards, so the page has one way of saying "this no longer describes what is above it"
     rather than two. */
  /* TWO CARDS, not three: the Cell Library's `used` column is a VIEW of the first one now, so
     the band that covers the card covers the counts. */
  function markStale(on) {
    [layoutCard, fabCard].forEach(function (c) {
      var band = c.querySelector('.editor-sync-warning');
      if (on && !band) {
        band = mk('div', 'editor-sync-warning');
        band.textContent = 'The design has changed - press Place again.';
        c.insertBefore(band, c.children[1] || null);
      } else if (!on && band && band.remove) {
        band.remove();
      }
    });
  }
  var designEditor = $('codeInput');
  if (designEditor) {
    designEditor.addEventListener('input', function () {
      if (stage >= 3) markStale(true);
    });
  }

  /* ---------------------------------------------------- THE FLOW STRIP
     SEVEN STAGES WHERE TWELVE TABS WERE, and the difference is what the row is FOR: the tabs
     named the page's panels, which is a table of contents; these name the flow, which is what
     this page is about. A stage is GREEN when it can be run and grey when it cannot, so the row
     answers "where am I and what is next" without a reader working it out from which cards have
     appeared. Seven cards lose their jump (Testbench, Console, Model, Memory, Netlist, Viewer,
     Hierarchy) and are reached by scrolling - the cost of the trade, taken deliberately. It was
     nine, and Report and Cells left the list by ceasing to be cards: they are views of Place &
     Route Results, which the Place and Route stages already scroll to.

     A BUTTON RUNS ITS STAGE AND THEN SCROLLS TO THE VIEW THAT SHOWS THE RESULT. `Code` has
     nothing to run, so it only scrolls.

     AND IT DRIVES THE EXISTING CONTROLS RATHER THAN REIMPLEMENTING THEM. Run, Synthesize and the
     gate-level Run belong to app.js, practice-synth.js and that card, each with a handler chain
     behind it - the verdict pill, the folded cards, the stale marks, the three-state label, the
     busy decoration. So those three are hidden and the strip CLICKS them, which is the same
     pattern practice.js's Reset already uses for the toolbar's own button: one owner per action,
     and every consequence still happens. Place, Route and Fabricate are this file's own, so the
     strip's buttons simply ARE them.

     `drives` is an element id, `run` a function of this file's; a stage has one or the other, and
     `Code` neither. */
  var STAGES = [
    { id: 'c2sStageCode',  label: '</> Code',                      card: 'card-editor' },
    /* BOTH RUNS LAND ON SIMULATION RESULTS, not on the waveform: that card is where a run says
       what it did - the $display output and the verdict - and the waveform is one panel further
       down for a reader who wants the shape of it. The gate-level run prints there too, and its
       waveform REPLACES the behavioural one rather than adding a panel, so sending it to the plot
       would show a picture with nothing saying which run drew it. */
    { id: 'c2sStageRun',   label: '▶ Run Simulation',              card: 'card-console',
      drives: 'runBtn' },
    { id: 'c2sStageSynth', label: '⚙ Synthesize',                  card: 'card-netlist',
      drives: 'synthBtn' },
    { id: 'c2sStageGate',  label: '▶ Run Gate-level Simulation',   card: 'card-console',
      drives: 'gateRunBtn', when: function () { return synthReady(); } },
    { btn: function () { return placeBtn; }, card: 'c2s-card-layout', run: function () { doPlace(); } },
    { btn: function () { return routeBtn; }, card: 'c2s-card-layout', run: function () { doRoute(); } },
    { btn: function () { return fabBtn; },   card: 'c2s-card-fab',    run: function () { doFabricate(); } }
  ];

  function onThePage(id) {
    var el = $(id);
    return !!el && el.style.display !== 'none';
  }

  /* THE STRIP IS Baerilog/flowstrip.js NOW, and this file keeps only its stage LIST. Everything
     that was here - availability read off the driven control, the mirrored label, the busy
     decoration, the scroll and its sticky-band correction - moved there unchanged when the twenty
     practice pages grew the same row: two copies of one builder is the drift this repo keeps
     paying for. What stays is the part that is genuinely this page's, which is which stages exist
     and what three of them do.

     `afterRun` is the one hook it needs: a stage that simulated may have produced memories or a
     bound model - the gate-level Run is the case that matters, since it replaces `lastResult` with
     the netlist's own and has no listener of its own here. */
  var flow = window.FLOWSTRIP.create({
    strip: $('exTabs'),
    stages: STAGES,
    afterRun: function () { syncResultCards(); }
  });
  var buildStrip = flow.build, syncStrip = flow.sync;

  /* ------------------------------------------------------- what a Run does to this page
     Stage 1 is "something simulated", and it is read off app.js's own result rather than
     tracked here. The Scoreboard decides its own visibility inside app.js during a run, so the
     strip has to be rebuilt afterwards or the Model tab could never appear. */
  var runBtn = $('runBtn');
  if (runBtn) {
    runBtn.addEventListener('click', function () {
      if (stage < 1) stage = 1;
      syncResultCards();
      syncButtons();
      /* The plot and the panel beside it have something in them now. Unconditional on the run
         SUCCEEDING, deliberately: a run that fails still writes the console, and a design that
         does not parse has a waveform worth seeing as far as it got - the same reason the netlist
         card stays after a refusal. */
      revealCard('card-wave');
      revealCard('card-hierarchy');
    });
  }

  /* Place, Route and Fabricate are wired by `buildStrip` and nowhere else. They had their own
     listeners here, and keeping both meant TWO handlers on one button: the strip's checks
     `disabled` and returns, the other did not, so a grey stage ran anyway. One wiring, one place. */

  /* A NEW SYNTHESIS INVALIDATES EVERYTHING BELOW IT, and the Synthesize button is
     practice-synth.js's - so this listens on it rather than wrapping it. Placement is left on
     screen and marked stale rather than cleared, the same rule as an edit. */
  var synthBtn = $('synthBtn');
  if (synthBtn) {
    synthBtn.addEventListener('click', function () {
      if (stage >= 3) markStale(true);
      if (stage < 2) stage = 2;
      syncButtons();
      /* On the ATTEMPT, not on success: a refused design keeps this card precisely so its error
         has somewhere to be read, and a folded card would hide the reason it was refused. */
      revealCard('card-netlist');
    });
  }

  /* The example picker replaces the whole document, so anything derived from the old one is
     gone: the stages go back to the start and the figures with them. */
  var picker = $('exampleSelect');
  if (picker) {
    picker.addEventListener('change', function () {
      stage = 0;
      layoutRes = null; netlistText = ''; cut = null;
      writeTally();
      showFigures(false);
      showFab(false);
      markStale(false);
      sayFresh('Synthesize, then press Place.');
      syncButtons();
    });
  }

  /* ---- TWO CARDS EARN THEIR PLACE ON THIS PAGE, or they are not on it ----
     The Memory Viewer and the Scoreboard both ship an honest empty state - "No memories declared
     in this design", "run to compare" - which is right in the standalone simulator, where a reader
     opened that app to look at those panels. Here they are two of a dozen cards in a flow, and a
     panel whose whole content is "nothing to show" is a card a reader scrolls past every time.

     So they are HIDDEN AT LOAD and shown by a run that produced something for them: the Memory
     Viewer when the run actually has memories, the Scoreboard when the model BOUND to the design.
     Read off `lastResult`, which is app.js's own - a later classic script sees the bindings of the
     ones before it, the way practice-synth.js reads `editorFullSource`.

     THE SCOREBOARD'S TEST HERE IS THE BINDING, WHICH IS STRICTER THAN app.js's OWN. That file
     keys on `looksLikeCpu` - any `pc`, register file or 16-bit imem - deliberately, so that a
     CPU-ish design which fails to bind still gets the card and with it the message saying what it
     needs (an 8-bit r0..r31 register file). That reasoning is about the simulator, where the
     reader is working ON a CPU; this page's design comes out of the compiler or is a small RTL
     example, so a card explaining a register file it does not have is noise in a flow about
     silicon. The cost is real and worth naming: on this page a half-bound CPU hides the card AND
     its guidance, and the simulator is where to go for that.

     app.js writes `card-model`'s display too (`showModelCard`, during every run), so this runs
     AFTER it and overrides - the same registration order practice.js depends on for the same
     card. Nothing else writes `card-memory`'s. */
  function boundToModel() {
    if (typeof lastResult === 'undefined' || !lastResult) return false;
    if (typeof bindCpuModel !== 'function') return false;
    var b = bindCpuModel(lastResult);
    return !!(b && b.ok);
  }
  function hasMemories() {
    if (typeof lastResult === 'undefined' || !lastResult || !lastResult.memories) return false;
    return Object.keys(lastResult.memories).length > 0;
  }
  function syncResultCards() {
    var mem = $('card-memory'), model = $('card-model');
    if (mem) mem.style.display = hasMemories() ? '' : 'none';
    if (model) model.style.display = boundToModel() ? '' : 'none';
  }

  /* ---- THE DUPLICATES GO, so there is ONE control per action ----
     Run, Synthesize and the gate-level Run are still the owners of their handler chains and are
     still what the strip clicks - they are hidden, not removed, exactly as practice.js hides the
     toolbar's Reset and then clicks it. Removing them would take their handlers with them.
     `gateRunRow` goes as a row rather than as a button, since Place/Route/Fabricate have left it
     and the gate-level Run is the only thing that was in it. */
  /* IMPORT GOES, because a file becomes a PROJECT now. `Import File` dropped a file straight into
     this editor, where the only thing that remembered it was the scratch document; My Projects
     imports the same file as a named row, which is a thing you can come back to and open here by
     URL. One front door rather than two, and the one that keeps what it is given.

     HIDDEN HERE RATHER THAN REMOVED FROM THE MARKUP, and that is not a preference: the button is
     declared in shell.js's markup region, which is GENERATED from Baerilog/simulator.html - so
     taking it out there would take it off the simulator too, which keeps its own Import (it is a
     standalone app whose reader may have no account and no projects page to import from). Same
     reason practice.js hides it rather than editing the markup.

     NO EMPTY-ROW CHECK, unlike practice.js's copy: that file also hides the example picker, so the
     toolbar is left with nothing in it and has to be collapsed. Here the picker is the reader's and
     stays, so the row still has something visible in it. `fileOpenInput` is already
     `display: none` in the markup and needs nothing.

     SAVE STAYS. Taking work OUT is still worth having, and it is the counterpart of importing
     rather than a second way in. */
  var openBtn = $('openBtn');
  if (openBtn) openBtn.style.display = 'none';

  ['runBtn', 'synthBtn', 'gateRunBtn'].forEach(function (id) {
    var el = $(id);
    if (el) el.style.display = 'none';
  });
  syncResultCards();     // hidden until a run has something to put in them
  var gateRow = $('gateRunRow');
  if (gateRow) gateRow.style.display = 'none';

  /* THE STRIP FOLLOWS THE LABEL, so an edit that retires an error retires it here too: app.js
     writes the three states on `input`, and this mirrors whatever it wrote. Both editors, since
     the error can be in either half of the document - and `tbInput` is guarded because a page
     without a Testbench Editor is a real configuration elsewhere in this repo. */
  ['codeInput', 'tbInput'].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('input', function () { syncStrip(); });
  });

  /* The strip is the FLOW, not a table of contents, so nothing else appends into it:
     practice-synth.js adds a `Synthesis Results` tab on a page that has a tab strip, and this
     page's row is seven stage buttons - one of which already points at that card. */
  if (window.PRACTICE_SYNTH_API && window.PRACTICE_SYNTH_API.suppressTabs) {
    window.PRACTICE_SYNTH_API.suppressTabs();
  }

  buildStrip();
  syncButtons();

  /* ------------------------------------------------------------ SAVING A PROJECT
     A PROJECT IS A ROW WHOSE VERDICT CARRIES A NAME - `(app, item = <minted id>)` with
     `{name}` in the jsonb column that already existed. No schema change and no new table; the
     `item` column was always the seam for this, which docs/cloud.md names as such.

     WHAT SAVE ACTUALLY DOES DEPENDS ON WHETHER THERE IS ONE, and only the first case is
     interesting:

       - no project yet -> ask for a name, mint an id, write the document under it, redirect
         every future autosave to it, repaint the crumb, and put the id in the URL;
       - already a project -> flush what the debounce is holding, and say so.

     THE SECOND IS A PUSH, NOT A COMMIT, and that is worth being plain about because the button
     invites the other reading. cloud-sync.js autosaves this editor on every keystroke, so a
     named project is already saved by the time anyone presses Save - what the press buys is
     "now, and confirmed" rather than "at all". Making Save the only writer would mean unpushed
     work sitting in an editor, which is the one thing cloud.js is built to prevent.

     THE BUTTON IS THE PARSE-TIME BLOCK'S, wired here. It exists only where CLOUD_UI does, so
     everything below is guarded on finding it rather than on re-testing configured(). */
  var saveBtn = $('c2sSaveBtn');
  if (saveBtn && window.CLOUD && window.CLOUD.configured()) {
    /* THE ID IS CLOUD.newItem's, not this file's: projects.html mints one too when it imports a
       file, and how a row is keyed is one rule. See that function for why it is opaque rather than
       derived from the name. */

    var currentItem = function () { return window.CLOUD_ITEM || ''; };
    var currentName = function () {
      var it = currentItem();
      if (!it) return '';
      var rec = window.CLOUD.load('code2silicon', it);
      return (rec && rec.verdict && rec.verdict.name) || '';
    };

    /* The crumb's leaf, repainted. textContent, never innerHTML: this is arbitrary text the
       reader typed into a prompt, and it is the one string on this page that reaches the DOM
       from outside it. */
    var paintLeaf = function (name) {
      var leaf = $('c2sProjName');
      if (leaf) leaf.textContent = name || 'New Project';
    };

    /* The URL follows the document, so a reload - or a bookmark, or a copied link - reopens
       the project rather than the scratch. replaceState rather than pushState: naming what is
       already on screen is not a navigation, and a Back button that undid a save's URL while
       leaving the save would be lying about what it undid.

       IN A TRY, because a file:// page throws SecurityError on replaceState in some browsers -
       and this runs after the row is already written. Failing here must leave a saved project
       with a stale URL, never an unsaved one, which is why it is the LAST thing done. */
    var putInUrl = function (id) {
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '',
            window.location.pathname + '?project=' + encodeURIComponent(id));
        }
      } catch (e) { /* file://: the document is saved, only the address bar is behind */ }
    };

    var mint = function (name) {
      var id = window.CLOUD.newItem();
      /* ORDER IS LOAD-BEARING: the document is written under the new id FIRST, then the sync
         layer is redirected to it. The other way round leaves a window in which an `input`
         event - the reader typing while the dialog closes - lands on the scratch row. */
      window.CLOUD.save('code2silicon', id, {
        source: currentFullSource(),
        verdict: { name: name }
      });
      if (typeof window.CLOUD_SET_ITEM === 'function') window.CLOUD_SET_ITEM(id);
      window.CLOUD_ITEM = id;
      paintLeaf(name);
      putInUrl(id);
    };

    saveBtn.addEventListener('click', function () {
      if (currentItem() && currentName()) {
        /* Already a project: push what the debounce is holding. withBusyButton is what makes
           that visible - the work is synchronous and instant, so without the hold there is no
           frame in which anything happened, which reads as a dead button. It is the same
           helper the flow strip's stages use, so the acknowledgement is one idiom. */
        var flush = function () {
          window.CLOUD.save('code2silicon', currentItem(), { source: currentFullSource() });
          window.CLOUD.flush();
        };
        if (typeof window.withBusyButton === 'function') window.withBusyButton(saveBtn, flush);
        else flush();
        return;
      }
      if (!window.CLOUD_UI || !window.CLOUD_UI.askName) return;
      window.CLOUD_UI.askName({ value: currentName() }, mint);
    });
  }

  /* Published for the harness, and for the same reason practice.js publishes its own: every
     one of these is state no assertion can reach from the DOM alone. */
  window.C2S_API = {
    stage: function () { return stage; },
    netlist: function () { return netlistText; },
    cut: function () { return cut; },
    report: function () { return reportBox.textContent || ''; },
    /* THE FLOW STRIP, as a reader sees it: the seven stages in order with their label and
       whether each is available. `tabs()` used to answer with the card ids the 12 tabs pointed
       at; the strip's claim is different, so the shape is too - a check that wants the targets
       asks `stageCard`. */
    stages: function () {
      /* BY CLASS, not by tag: shell.js puts its own Exercise and Reset buttons in this row, so a
         tag query answered 9 where the flow has 7. */
      return flow.list();
    },
    stageCard: function (id) { return flow.cardOf(id); },
    stageButton: function (id) { return flow.button(id); },
    syncStrip: syncStrip,
    /* THE WHOLE DOCUMENT, for a harness that cannot reach app.js's own accessor. `loadFullSource`
       is a function declaration, so in a browser it is a property of `window` - but the stub
       evaluates app.js into a function scope, where a declaration is just a local, which is the
       trap CLAUDE.md records for `editorFullSource`. This file shares that scope, so it can pass
       it on. It matters more than convenience: writing `codeInput.value` sets the DESIGN half and
       leaves the previous testbench in place, so a check that seeds a design that way compiles the
       last example's testbench against it. */
    loadDocument: function (text) { loadFullSource(text); },
    document: function () { return currentFullSource(); },
    /* The two visibility rules AND what they decided, separately - so a failure says which half is
       wrong: the rule reading the run, or the card following the rule. */
    resultCards: function () {
      var mem = $('card-memory'), model = $('card-model');
      return {
        memories: hasMemories(), bound: boundToModel(),
        memShown: !!mem && mem.style.display !== 'none',
        modelShown: !!model && model.style.display !== 'none'
      };
    },
    buttons: function () { return { place: placeBtn, route: routeBtn, fab: fabBtn }; },
    /* The Fabrication figure's own handle, so a check can drive its transport - the speed control's
       claim is the INTERVAL it arms, which needs play and stop rather than a button press. */
    fab: function () { return fab; },
    isStale: function () { return !!layoutCard.querySelector('.editor-sync-warning'); },
    maxGates: function () { return MAX_GATES; },
    tooBigMsg: function () { return TOO_BIG_MSG; },
    place: doPlace,
    route: doRoute,
    fabricate: doFabricate,
    buildStrip: buildStrip,
    /* The Layout card's own controls, for the harness: which view is drawn, what the pan/zoom is
       at, and the three buttons themselves - a check that pressed them and then read the drawing
       would be reading markup the stub does not parse. */
    view: function () { return layoutView; },
    /* THE PANEL VIEW, and everything that follows from it in ONE reading - which view is up, both
       encodings of the selection per radio, whether each panel is shown, and whether the two
       groups that can only act on the drawing are in the header. One accessor rather than five,
       because every assertion about this card is about the COMBINATION: a check that read `pnrView`
       alone would pass a sync that writes the variable and paints nothing. */
    pnrView: function () {
      function shown(el) { return !!el && el.style.display !== 'none'; }
      return {
        view: pnrView,
        radios: ['layout', 'report', 'cells'].map(function (v) {
          var r = document.getElementById('c2sView'
            + v.charAt(0).toUpperCase() + v.slice(1) + 'Radio');
          return { value: v, checked: !!(r && r.checked),
                   lit: !!(r && r.parentElement && r.parentElement.classList.contains('on')) };
        }),
        panels: { layout: shown(layoutBox), report: shown(reportBox), cells: shown(cellsTable) },
        empty: shown(layoutEmpty),
        groups: { view: shown(viewGroup), zoom: shown(zoomGroup) }
      };
    },
    setPnrView: setPnrView,
    cellRows: function () {
      return [].map.call(cellsBody.querySelectorAll('tr'), function (tr) {
        return [].map.call(tr.querySelectorAll('td'), function (td) { return td.textContent; });
      });
    },
    scale: function () { return panZoom ? panZoom.scale() : null; },
    layoutButtons: function () {
      return { abstract: viewAbstractBtn, detail: viewDetailBtn,
               zoomOut: zoomOutBtn, zoomIn: zoomInBtn, zoomFit: zoomFitBtn };
    },
    drawn: function () {
      return layoutRes ? { view: layoutRes.view, rows: layoutRes.rows,
                           rowLambda: layoutRes.rowLambda, cells: layoutRes.cells } : null;
    },
    routed: function () { return routed; },
    /* THE PROJECT, as the page has it: what the crumb says, which row the sync layer is
       pointed at, and whether the control is even there. One accessor rather than three,
       because every assertion about saving is about the COMBINATION - a check that read the
       item alone would pass a mint that redirects the sync layer and leaves the crumb saying
       `New Project`, which is the failure a reader would actually meet. */
    project: function () {
      var leaf = $('c2sProjName');
      return {
        item: window.CLOUD_ITEM || '',
        leaf: leaf ? leaf.textContent : '',
        saveShown: !!$('c2sSaveBtn')
      };
    },
    saveButton: function () { return $('c2sSaveBtn'); }
  };
})();
