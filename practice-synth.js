/* practice-synth.js - the synthesizer half of a practice page.
 *
 * Loaded only by a page whose manifest entry says "synthesis": true, after
 * synth.js (the engine) and after practice.js. It adds two cards below the
 * Waveform Viewer - the read-only gate-level netlist and the Netlist Viewer -
 * and writes the synthesis log into the simulator's own Console.
 *
 * Three things about the arrangement are load-bearing:
 *
 *  - The ENGINE is window.SYNTH, an IIFE, because the two Verilog front ends
 *    collide on six top-level names (EXAMPLES, KEYWORDS, Parser, lex,
 *    parseVerilog, parseTopLevelModules) and classic scripts share one global
 *    lexical environment, where a duplicate const/class is a SyntaxError that
 *    kills the page. See Baerilog/tools/build.py.
 *
 *  - Everything on the Verilog side is REUSED rather than duplicated. This file
 *    calls app.js's spliceEditorChangesBack / editorFullSource / logLine /
 *    escapeHtml directly, the way practice.js calls setEditorText - a classic
 *    script's top-level bindings are visible to the next one.
 *
 *  - The cards are built with createElement, not one innerHTML string. The stub
 *    DOM the harnesses use does not parse injected markup, so a card built from
 *    a string has no elements to click and the whole feature is untestable
 *    headlessly. Same reason the hub builds its filter chips this way.
 *
 * The viewer is dependency-free on purpose. synthesis.html renders its netlist
 * with React Flow from a CDN, behind an ES-module script tag and an importmap;
 * neither works here, because a practice page must load over file:// with no
 * network (build.py --check greps for exactly those, which is also why this
 * comment does not spell the tag out - the grep is a substring match and a
 * quotation would read as the real thing). So the node shapes and the handle
 * geometry are copied out of that module script and drawn as ordinary
 * absolutely-positioned .rf-node divs over an SVG edge layer, which is what
 * React Flow itself does - so synth.css's node rules apply unchanged.
 */
'use strict';

(function () {
  /* `typeof` rather than `window.PRACTICE_META`, and the same for ICON below: shell.js
     declares both with a top-level `var`, so in a browser either form works - but the
     harness hands them to a scope as parameters, where only this one does. A guard that
     is silently false headlessly would make the whole feature untestable. */
  /* Does THIS page want the synthesizer. Two catalogues ask for it now: a practice page
     through its manifest entry's "synthesis", and a learn topic through a netlist slot in
     its own manifest entry. The question is the same one either way, which is why this is a
     widened guard rather than a second copy of this file - the cards, the viewer and the
     gate-level run are identical on both, and a topic page is a place to SHOW a netlist for
     exactly the reason an exercise page is. */
  var wantsSynth = (typeof PRACTICE_META !== 'undefined' && PRACTICE_META && PRACTICE_META.synthesis)
                || (window.LEARN_SLUG && (function () {
                     /* window.LEARN_SLUG, not `typeof LEARN_SLUG`: the generated page
                        declares it with a top-level `var`, which IS a window property in a
                        browser, and learn.js reads it the same way - while the harness hands
                        globals to a scope as parameters, where the bare form is undefined.
                        That is the mirror image of the PRACTICE_META note above, and getting
                        it the wrong way round makes this whole branch silently dead
                        headlessly. */
                     var m = (window.LEARN_MANIFEST || []).filter(function (e) {
                       return e.slug === window.LEARN_SLUG;
                     })[0];
                     var slots = (m && m.slots) || [];
                     return slots.indexOf('netlist') >= 0 || slots.indexOf('netlist-view') >= 0;
                   })());
  if (!wantsSynth) return;
  if (!window.SYNTH) return;

  var S = window.SYNTH;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* =====================================================================
     1. geometry, copied from synthesis.html's viewer
     ===================================================================== */

  /* Gate body/bubble geometry lifted from synthesis/symbol/*.svg via
     synthesis.html's module script, verbatim. All seven gates share one pin
     convention - inputs at 20%/80% of the left edge, output at 50% of the right -
     which is why the handle table below can be percentages rather than per-shape
     coordinates, and why nothing here needs React's <Handle>. */
  var GATE_BODY_D = 'M10,10 L40,10 C40,10 70,10 70,40 C70,70 40,70 40,70 L10,70 Z';
  var GATE_SHIELD_D = 'M10,10 L40,10 C40,10 50,10 60,20 C70,30 70,40 70,40 C70,40 70,50 60,60 C50,70 40,70 40,70 L10,70 C10,70 20,60 20,40 C20,20 10,10 10,10 Z';
  var GATE_XSHIELD_D = 'M20,10 L50,10 C50,10 60,10 70,20 C80,30 80,40 80,40 C80,40 80,50 70,60 C60,70 50,70 50,70 L20,70 C20,70 30,60 30,40 C30,20 20,10 20,10 Z';
  var GATE_XCURVE_D = 'M10,10 C10,10 20,23.0017 20,40 C20,56.9983 10,70 10,70';
  var GATE_NOT_D = 'M10,15 L57.5,40 L10,65 Z';

  var GATE_DEFS = {
    and: { viewBox: '0 0 80 80', body: GATE_BODY_D, stubs: [[0, 16, 16, 16], [0, 64, 16, 64], [70, 40, 80, 40]] },
    nand: { viewBox: '0 0 90 80', body: GATE_BODY_D, stubs: [[0, 16, 16, 16], [0, 64, 16, 64], [82, 40, 89, 40]], bubble: { cx: 76, cy: 40 } },
    or: { viewBox: '0 0 80 80', body: GATE_SHIELD_D, stubs: [[0, 16, 16, 16], [0, 64, 16, 64], [70, 40, 80, 40]] },
    nor: { viewBox: '0 0 90 80', body: GATE_SHIELD_D, stubs: [[0, 16, 16, 16], [0, 64, 16, 64], [82, 40, 89, 40]], bubble: { cx: 76, cy: 40 } },
    xor: { viewBox: '0 0 90 80', body: GATE_XSHIELD_D, extra: GATE_XCURVE_D, stubs: [[0, 16, 14, 16], [0, 64, 14, 64], [81, 40, 89, 40]] },
    xnor: { viewBox: '0 0 100 80', body: GATE_XSHIELD_D, extra: GATE_XCURVE_D, stubs: [[0, 16, 14, 16], [0, 64, 14, 64], [92, 40, 99, 40]], bubble: { cx: 86, cy: 40 } },
    not: { viewBox: '0 13 75 54', body: GATE_NOT_D, stubs: [[0, 40.5, 16, 40.5], [67, 40, 74, 40]], bubble: { cx: 61, cy: 40 } },
    buf: { viewBox: '0 13 75 54', body: GATE_NOT_D, stubs: [[0, 40.5, 16, 40.5], [67, 40, 74, 40]] },
    mux2: { viewBox: '0 0 55 65', body: 'M 20 2.5 L 40 17.5 L 40 47.5 L 20 62.5 Z', stubs: [[0, 8.808153, 20.000004, 8.808153], [0, 32.808153, 20.000004, 32.808153], [0, 56.80815, 20.000004, 56.80815], [40, 32.5, 55, 32.5]] },
    add: {
      viewBox: '0 0 65 80',
      body: 'M 20 0 L 50 15 L 50 60 L 20 80 L 20 50 L 30 40 L 20 30 Z',
      stubs: [[0, 15, 20, 15], [0, 40, 20, 40], [0, 65, 20, 65], [50, 30, 65, 30], [50, 50, 65, 50]],
      extra: 'M 40 35 L 40 45 M 45 40 L 35 40',
      scale: 2
    },
    sub: {
      viewBox: '0 0 65 80',
      body: 'M 20 0 L 50 15 L 50 60 L 20 80 L 20 50 L 30 40 L 20 30 Z',
      stubs: [[0, 15, 20, 15], [0, 40, 20, 40], [0, 65, 20, 65], [50, 30, 65, 30], [50, 50, 65, 50]],
      extra: 'M 45 40 L 35 40',
      scale: 2
    },
    dff: {
      viewBox: '0 0 90 90',
      body: 'M 24 10 L 70 10 L 70 80 L 24 80 Z',
      stubs: [[0, 30, 24, 30], [0, 60, 16, 60], [40, 80, 40, 90], [70, 30, 90, 30]],
      bubble: { cx: 20, cy: 60, r: 4 },
      notch: 'M 34 80 L 40 70 L 46 80 Z',
      label: { text: 'DFF', x: 47, y: 49 }
    }
  };

  // One px-per-SVG-unit factor for every kind, so not.svg's smaller 75x54 viewBox
  // really renders smaller than and.svg's 80x80 instead of being stretched to match.
  var GATE_PX_PER_UNIT = 52 / 80;
  Object.keys(GATE_DEFS).forEach(function (k) {
    var def = GATE_DEFS[k];
    var vb = def.viewBox.split(' ').map(Number);
    var scale = def.scale || 1;
    def.width = Math.round(vb[2] * GATE_PX_PER_UNIT * scale);
    def.height = Math.round(vb[3] * GATE_PX_PER_UNIT * scale);
  });

  /* The port pennant, transcribed from port.svg at the repo root and normalised into the 100x40
     box this node is drawn in (the export is 115 x 35 at an offset, and `preserveAspectRatio="none"`
     stretches whatever is here onto the node's real size). Square left corners now, where it used
     to carry two 8-unit arcs; the shoulder at 71.74 is the export's own 85-of-115.

     THE EXPORT'S COLOURS ARE NOT COPIED, and that is the rule this repo records for every
     OmniGraffle asset: it arrives with an opaque full-canvas `<rect fill="white">`, a `fill="white"`
     body and a `stroke="#5856d6"` - a legacy iOS colour, and a fixed white fill under a themed
     label is invisible in one mode. The classes stay `port-stroke node-fill`, so the stroke and the
     fill keep coming from the tokens. */
  var PORT_D = 'M71.74,0 L100,20 L71.74,40 L0,40 L0,0 Z';

  /* Every node's box, in the same numbers the CSS and the inline styles use, so an
     edge endpoint and the drawn shape cannot disagree. Only the constant node is an
     ESTIMATE: synth.css sizes it by its content (width: max-content), and an edge
     start cannot be computed from that without reading layout back. The width is
     therefore fixed here from the label length and set inline, which makes the box
     and the endpoint agree by construction - the residual risk is a label a couple
     of pixels tighter or looser in its box, not a wire that starts in mid-air. */
  function constWidth(label) { return Math.max(56, 20 + 7 * String(label || '').length); }

  function nodeSize(n) {
    switch (n.type) {
      case 'port': return n.data.isBus ? { width: 104, height: 36 } : { width: 92, height: 32 };
      case 'gate': return GATE_DEFS[n.data.kind];
      case 'dff': return GATE_DEFS.dff;
      case 'fa': case 'adder': return GATE_DEFS[n.data.op === 'sub' ? 'sub' : 'add'];
      case 'mux2': return GATE_DEFS.mux2;
      case 'const': return { width: constWidth(n.data.label), height: 28 };
      case 'instance': {
        var slots = Math.max(n.data.inSlots.length, n.data.outSlots.length, 1);
        return { width: 130, height: Math.max(74, slots * 20 + 40) };
      }
      default: return { width: 92, height: 32 };
    }
  }

  /* handle id -> [side, fraction along that side]. Transcribed from the node
     components in synthesis.html's module script; a port's single handle is called
     'y' whether it is a source or a target, so DIRECTION decides the side. */
  function handleSpecs(n) {
    var out = {};
    switch (n.type) {
      case 'port': out.y = n.data.dir === 'in' ? ['r', 0.5] : ['l', 0.5]; return out;
      case 'gate':
        if (n.data.unary) { out.a = ['l', 0.5]; out.y = ['r', 0.5]; return out; }
        out.a = ['l', 0.2]; out.b = ['l', 0.8]; out.y = ['r', 0.5];
        return out;
      case 'dff':
        out.d = ['l', 1 / 3]; out.rstn = ['l', 2 / 3];
        out.clk = ['b', 0.4444]; out.q = ['r', 1 / 3];
        return out;
      case 'fa': case 'adder':
        out.a = ['l', 0.1875]; out.cin = ['l', 0.5]; out.b = ['l', 0.8125];
        out.sum = ['r', 0.375]; out.cout = ['r', 0.625];
        return out;
      case 'mux2':
        out.sel = ['l', 0.1308]; out.a = ['l', 0.5]; out.b = ['l', 0.8692]; out.y = ['r', 0.5];
        return out;
      case 'const': out.y = ['r', 0.5]; return out;
      case 'instance':
        n.data.inSlots.forEach(function (s, i) { out[s.id] = ['l', (i + 1) / (n.data.inSlots.length + 1)]; });
        n.data.outSlots.forEach(function (s, i) { out[s.id] = ['r', (i + 1) / (n.data.outSlots.length + 1)]; });
        return out;
      default: return out;
    }
  }

  function handlePoint(n, id) {
    var spec = handleSpecs(n)[id];
    if (!spec) return null;
    var sz = nodeSize(n), p = n.position;
    if (spec[0] === 'l') return { x: p.x, y: p.y + sz.height * spec[1] };
    if (spec[0] === 'r') return { x: p.x + sz.width, y: p.y + sz.height * spec[1] };
    return { x: p.x + sz.width * spec[1], y: p.y + sz.height };
  }

  /* =====================================================================
     2. state
     ===================================================================== */

  var currentAll = null;          // last synthesizeAll() result
  var viewStack = [];             // breadcrumb: module names, top down to the viewed one
  var lastGraph = { nodes: [], edges: [] };
  var netlistFullText = '';
  /* Derived from Run's own wording rather than written out, the rule app.js's
     RUN_LABEL_AGAIN follows: `simulator.html`'s markup stays the one source of the verb,
     so if that button ever reads something else this one still agrees with it. */
  var GATE_LABEL_FRESH = (RUN_LABEL_FRESH || '\u25b6 Run Simulation').replace(/Simulation\s*$/, '') + 'Gate-level Simulation';
  var GATE_LABEL_AGAIN = GATE_LABEL_FRESH.replace('Run', 'Re-run');
  var gateHasRun = false;
  var netlistSegments = [];
  var netlistSelectedModule = '(all)';
  var view = { k: 1, x: 0, y: 0 };  // the viewer's pan/zoom, the whole of it
  var stale = false;                // does the netlist still describe the editor?
  /* Counted, not inferred: re-synthesizing an unedited design produces the same text and
     the same diagram, so "Run did not synthesize" is not observable from the panels. */
  var syntheses = 0;
  var cardsShown = false;          // ... and so: is a successful synthesis on screen?
  /* And did the LAST attempt fail? Distinct from !cardsShown, which is also true before
     anything has been pressed - this is specifically "a synthesis was attempted and did
     not work", which is what puts the button in its error state. Cleared at the top of
     runSynthesis, so reaching the end of it IS success. */
  var synthFailed = false;

  /* Both cards carry the same band, because both are showing the same stale thing -
     and the log carries it too, since a reader who scrolls the Console rather than the
     cards would otherwise see a synthesis report with nothing marking it as past. */
  function markStale(on) {
    var next = !!on && !!currentAll;
    var moved = next !== stale;
    stale = next;
    var show = stale ? '' : 'none';
    if (netlistStale) netlistStale.style.display = show;
    if (viewerStale) viewerStale.style.display = show;
    // Only on a real transition: `input` fires per keystroke, and re-rendering the
    // console section on each one would be work nobody asked for.
    if (moved && synthLines.length) renderSynthSection();
  }

  /* localStorage keys are deliberately NOT synthesis.html's own
     (netlistBundleMultibit, netlistHeight, netlistExpanded): both apps live on one
     origin, so sharing a key would let a control set here silently change that app
     and vice versa - the trap CLAUDE.md records for the Scoreboard's checkbox.
     Every one of them is honoured in both directions for the same reason. */
  var K_BUNDLE = 'practiceNetlistBundle';
  var K_HEIGHT = 'practiceNetlistHeight';
  var K_VIEW_HEIGHT = 'practiceNetlistViewHeight';

  /* The viewer's two heights, DECLARED HERE because the wiring block below sets the empty
     one and `var` hoisting made a declaration further down read as `undefined` - the box
     came out `height: undefinedpx`, which a browser ignores, so it silently kept the 520px
     it was meant to replace. The same trap this repo records twice for the plot-off note.

     VIEW_EMPTY_H is the no-diagram state: one line of placeholder text, so 520px there was
     an empty panel taller than the prose above it. VIEW_MIN_H is the floor once there IS a
     diagram. Together: as small as the content, never taller than the reader's own choice. */
  var VIEW_MIN_H = 200, VIEW_EMPTY_H = 96, viewHeightPinned = false;
  var K_EXPANDED = 'practiceNetlistExpanded';
  var K_MODPANEL = 'practiceNetlistModPanel';

  /* =====================================================================
     3. the two cards
     ===================================================================== */

  function mk(tag, cls, id) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (id) e.id = id;
    return e;
  }

  function heightBtn(id, up) {
    var b = mk('span', 'layout-btn', id);
    b.setAttribute('title', (up ? 'Increase' : 'Decrease') + ' height');
    b.innerHTML = up
      ? '<svg viewBox="0 0 45 37.5" fill="currentColor" stroke="none"><rect x="12.5" y="10" width="20" height="7.5"/><rect x="12.5" y="20" width="20" height="7.5"/><path d="M 2.5 25 L 22.5 35 L 42.5 25 Z"/><path d="M 2.5 12.5 L 22.5 2.5 L 42.5 12.5 Z"/></svg>'
      : '<svg viewBox="0 0 45 37.5" fill="currentColor" stroke="none"><rect x="12.5" y="2.5" width="20" height="10"/><rect x="12.5" y="25" width="20" height="10"/><path d="M 2.5 7.5 L 22.5 17.5 L 42.5 7.5 Z"/><path d="M 2.5 30 L 22.5 20 L 42.5 30 Z"/></svg>';
    return b;
  }

  /* Byte-identical to the glyph the other nine hierarchy toggles draw (checked by
     Baerilog/test.py against shell.js's copy, the way tools/check_theme.py checks the
     other nine against each other) - one control, one meaning, one drawing. */
  var HIER_GLYPH = '<svg viewBox="0 0 42.5 35" fill="currentColor"><rect x="0" y="0" width="10" height="10"/><rect x="7.5" y="2.5" width="25" height="5"/><rect x="15" y="2.5" width="5" height="30"/><rect x="32.5" y="0" width="10" height="10"/><rect x="17.5" y="15" width="15" height="5"/><rect x="32.5" y="12.5" width="10" height="10"/><rect x="17.5" y="27.5" width="15" height="5"/><rect x="32.5" y="25" width="10" height="10"/></svg>';

  function help(lines) {
    var wrap = mk('span', 'help-wrap');
    var ic = mk('span', 'help-icon');
    ic.textContent = '?';
    wrap.appendChild(ic);
    // The popup must be the icon's next ELEMENT: the handler uses
    // nextElementSibling, so anything between them silently breaks the popover.
    var pop = mk('div', 'help-popup');
    lines.forEach(function (t) {
      var d = mk('div');
      d.textContent = '· ' + t;
      pop.appendChild(d);
    });
    wrap.appendChild(pop);
    return wrap;
  }

  function cardHead(title, helpLines, controls) {
    var h = document.createElement('h2');
    var collapse = mk('span', 'card-collapse-btn');
    collapse.setAttribute('data-collapse', '');
    collapse.textContent = '▾';
    h.appendChild(collapse);
    h.appendChild(document.createTextNode(title));
    h.appendChild(help(helpLines));
    if (controls) h.appendChild(controls);
    return h;
  }

  function buildNetlistCard() {
    var card = mk('div', 'card full', 'card-netlist');

    var controls = mk('span', 'header-controls');
    var g1 = mk('span', 'layout-toggle');
    g1.appendChild(heightBtn('netlistHeightDec', false));
    g1.appendChild(heightBtn('netlistHeightInc', true));
    var copy = mk('span', 'layout-btn', 'netlistCopyBtn');
    copy.setAttribute('title', 'Copy to clipboard');
    copy.innerHTML = '<svg viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="3" width="8" height="8" rx="1"/><rect x="6.5" y="0.7" width="8" height="8" rx="1"/></svg>';
    g1.appendChild(copy);
    var save = mk('span', 'layout-btn', 'netlistSaveBtn');
    save.setAttribute('title', 'Save to file');
    save.innerHTML = '<svg viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 0.8 V7.5 M5 4.5 L8 7.5 L11 4.5"/><path d="M1.5 8.5 V10.2 a1 1 0 0 0 1 1 H13.5 a1 1 0 0 0 1-1 V8.5"/></svg>';
    g1.appendChild(save);
    controls.appendChild(g1);
    var g2 = mk('span', 'layout-toggle');
    var hierBtn = mk('span', 'layout-btn', 'codeOutHierarchyToggleBtn');
    hierBtn.setAttribute('title', 'Show/hide module hierarchy');
    hierBtn.innerHTML = HIER_GLYPH;
    g2.appendChild(hierBtn);
    controls.appendChild(g2);

    card.appendChild(cardHead('Synthesized Gate-level Verilog Netlist (Read-only)', [
      'the same design as gates: a top module instantiating primitive cells, then the behavioural definition of each cell it used',
      'the testbench is not synthesized - everything below the TESTBENCH marker is dropped first, which is exactly what the Testbench Editor holds',
      'read-only, and regenerated on every Run: edit the design above, not this'
    ], controls));

    var row = mk('div', 'editor-hierarchy-row hierarchy-collapsed', 'codeOutHierarchyRow');
    row.appendChild(mk('div', 'editor-hierarchy-panel', 'codeOutHierarchyPanel'));
    row.appendChild(mk('pre', 'code-out', 'codeOut'));
    /* The stale band sits ABOVE the text, where the editor's own merge warning does,
       because it qualifies everything below it: the netlist stays readable but is no
       longer a description of what is in the editor. Same class, so it is the same
       warning in the same colour rather than a second idiom for one meaning. */
    var stale = mk('div', 'editor-sync-warning', 'netlistStale');
    stale.style.display = 'none';
    stale.textContent = 'The design has changed since this was synthesized — press Synthesize.';
    card.appendChild(stale);
    card.appendChild(row);
    // An empty dark panel reads as a rendering fault rather than as "nothing yet",
    // which is why this sits beside it instead of inside it.
    var empty = mk('div', 'wave-empty', 'netlistEmpty');
    empty.textContent = 'Nothing synthesized yet - press Synthesize.';
    card.appendChild(empty);
    /* Run the netlist. Green, because it is this card's ONE primary action - the rule
       Primer states and this repo follows, and the reason the editor card's two greens
       needed an argument while this needs none.

       At the BOTTOM, after the text, because it acts on what is above it: read the
       netlist, then run it. */
    var runGate = mk('div', 'toolbar');
    runGate.style.marginTop = '12px';
    runGate.style.marginBottom = '0';
    var b = mk('button', 'btn', 'gateRunBtn');
    b.setAttribute('type', 'button');
    b.textContent = GATE_LABEL_FRESH;
    runGate.appendChild(b);
    card.appendChild(runGate);
    return card;
  }

  function buildViewerCard() {
    var row = mk('div', 'split-row', 'netlistSplitRow');
    var card = mk('div', 'card', 'card-netlist-view');

    var controls = mk('span', 'header-controls');
    var g1 = mk('span', 'layout-toggle');
    g1.appendChild(heightBtn('netlistViewHeightDec', false));
    g1.appendChild(heightBtn('netlistViewHeightInc', true));
    controls.appendChild(g1);
    var g2 = mk('span', 'layout-toggle');
    var expand = mk('span', 'layout-btn', 'netlistExpandBtn');
    expand.setAttribute('title', 'Expand to the full browser width');
    expand.innerHTML = '<svg viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1 V11 M15 1 V11"/><path d="M4.5 6 H11.5 M6.5 3.8 L4.3 6 L6.5 8.2 M9.5 3.8 L11.7 6 L9.5 8.2"/></svg>';
    g2.appendChild(expand);
    controls.appendChild(g2);

    card.appendChild(cardHead('Netlist Viewer', [
      'drag to pan, scroll or pinch to zoom - the view refits itself on every new graph',
      'click a wire to name its net and light up every segment of it; Escape, or a click on the '
        + 'background, clears that again',
      'the zoom buttons step in and out about the centre, and fit brings the whole diagram '
        + 'back - zooming out stops there, so the diagram is never lost in empty space',
      'double-click a sub-module block to drill into its own netlist; the breadcrumb comes back out',
      'bundle multi-bit logic collapses same-width cell chains into one N-bit box'
    ], controls));

    var bar = mk('div', 'toolbar');
    bar.style.marginBottom = '8px';
    var crumbs = mk('div', 'breadcrumb-row', 'breadcrumbRow');
    crumbs.style.flex = '1 1 auto';
    crumbs.style.marginBottom = '0';
    bar.appendChild(crumbs);
    var netSel = mk('span', 'pn-net-readout', 'netlistSelectedNet');
    netSel.style.display = 'none';
    bar.appendChild(netSel);
    var vstale = mk('span', 'editor-sync-warning', 'viewerStale');
    vstale.style.display = 'none';
    vstale.style.marginBottom = '0';
    vstale.textContent = 'Design changed — press Synthesize.';
    bar.appendChild(vstale);
    var label = mk('label', 'bundle-toggle');
    label.setAttribute('title', 'Bundle same-width mux/dff/gate chains into one N-bit box, or show every individual 1-bit cell');
    var cb = mk('input', null, 'bundleMultibitCheckbox');
    cb.setAttribute('type', 'checkbox');
    cb.type = 'checkbox';
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' Bundle multi-bit logic'));
    bar.appendChild(label);
    /* Zoom out / in / fit, to the right of the checkbox. `.layout-btn` in a
       `.layout-toggle` group is the control this card already uses for its height -/+ and
       expand buttons, so this needs no CSS of its own and reads as the same kind of thing.
       They stay live at the clamps and a click simply does nothing, exactly how the height
       buttons clamp silently - a disabled style would be the only one on the site. */
    var zoomGroup = mk('span', 'layout-toggle');
    var MAG = '<circle cx="6.5" cy="5.5" r="4"/><path d="M9.6 8.6 L14.4 11.4"/>';
    [['netlistZoomOutBtn', 'Zoom out', MAG + '<path d="M4.5 5.5 H8.5"/>'],
     ['netlistZoomInBtn', 'Zoom in', MAG + '<path d="M4.5 5.5 H8.5 M6.5 3.5 V7.5"/>'],
     ['netlistZoomFitBtn', 'Zoom to fit the whole diagram',
      '<path d="M1 4 V1.5 H4 M12 1.5 H15 V4 M15 8 V10.5 H12 M4 10.5 H1 V8"/>']
    ].forEach(function (b) {
      var el = mk('span', 'layout-btn', b[0]);
      el.setAttribute('title', b[1]);
      el.innerHTML = '<svg viewBox="0 0 16 12" fill="none" stroke="currentColor" '
        + 'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + b[2] + '</svg>';
      zoomGroup.appendChild(el);
    });
    bar.appendChild(zoomGroup);
    card.appendChild(bar);

    var root = mk('div', null, 'flowRoot');
    var edges = document.createElementNS(SVG_NS, 'svg');
    edges.setAttribute('class', 'pn-edges');
    edges.id = 'pnEdges';
    var edgeG = document.createElementNS(SVG_NS, 'g');
    edgeG.id = 'pnEdgeG';
    edges.appendChild(edgeG);
    root.appendChild(edges);
    var nodes = mk('div', 'pn-nodes', 'pnNodes');
    root.appendChild(nodes);
    var placeholder = mk('div', 'flow-placeholder', 'flowPlaceholder');
    placeholder.textContent = 'Nothing synthesized yet - press Synthesize.';
    root.appendChild(placeholder);
    card.appendChild(root);

    /* Five entries, not synthesis.html's nine. Its legend dots are nine literal iOS
       colours from before the Primer conversion, and its own .rf-node rules no longer
       paint them - several kinds now share one token, so nine rows would name
       distinctions that are not on the screen. Each row here names everything drawn in
       that colour, and the colours are the tokens the shapes actually use. */
    var legend = mk('div', 'legend-row');
    [['--success-fg', 'input port'],
     ['--attention-fg', 'output port, mux'],
     ['--accent-fg', 'gate, dff, sub-module'],
     ['--danger-fg', 'adder / subtractor'],
     ['--fg-muted', 'constant']].forEach(function (pair) {
      var item = mk('div', 'legend-item');
      var dot = mk('span', 'dot');
      dot.style.background = 'var(' + pair[0] + ')';
      item.appendChild(dot);
      item.appendChild(document.createTextNode(pair[1]));
      legend.appendChild(item);
    });
    card.appendChild(legend);

    row.appendChild(card);
    return row;
  }

  var grid = document.querySelector('.grid');
  var waveRow = document.getElementById('waveSplitRow');
  if (!grid) return;
  var netlistCard = buildNetlistCard();
  var viewerRow = buildViewerCard();
  // Below the Waveform Viewer, above the Memory Viewer. insertBefore(x, null)
  // appends, which is what happens if the waveform row is somehow last.
  var after = null;
  if (waveRow) {
    var kids = grid.children;
    for (var ki = 0; ki < kids.length; ki++) {
      if (kids[ki] === waveRow) { after = kids[ki + 1] || null; break; }
    }
  }
  grid.insertBefore(netlistCard, after);
  grid.insertBefore(viewerRow, after);
  /* Both cards start HIDDEN and are revealed only by a synthesis that succeeded. That
     is what lets the flag go on a page whose design the synthesizer cannot handle at
     all - eight of the eighteen - without putting an error panel under every learner's
     waveform: press Synthesize there and the Console says what it could not do, while
     the cards simply never appear. So "the cards are on screen" means "a successful
     synthesis is on screen", and a later failure takes them away again. */
  netlistCard.style.display = 'none';
  viewerRow.style.display = 'none';

  var codeOut = document.getElementById('codeOut');
  var codeOutPanel = document.getElementById('codeOutHierarchyPanel');
  var codeOutRow = document.getElementById('codeOutHierarchyRow');
  var netlistEmpty = document.getElementById('netlistEmpty');
  // built inside buildNetlistCard, so resolved here like every other element of it
  var gateBtn = document.getElementById('gateRunBtn');
  var netlistStale = document.getElementById('netlistStale');
  var viewerStale = document.getElementById('viewerStale');
  var flowRoot = document.getElementById('flowRoot');
  var nodesLayer = document.getElementById('pnNodes');
  var edgeLayer = document.getElementById('pnEdgeG');
  var edgeSvg = document.getElementById('pnEdges');
  var placeholderEl = document.getElementById('flowPlaceholder');
  var crumbRow = document.getElementById('breadcrumbRow');
  var bundleBox = document.getElementById('bundleMultibitCheckbox');
  var netReadout = document.getElementById('netlistSelectedNet');

  /* The Synthesize button, beside the run-length field in the editor card's own
     toolbar - so the two things a learner can ask for sit together, and Run keeps
     meaning exactly one thing. It is injected here rather than living in the
     simulator's markup because the simulator has no synthesizer.

     It is GREEN, the same `.btn` as Run Simulation, which is a deliberate departure
     from Primer's one-primary-per-card rule that the rest of this repo follows. The
     reason: these two are the card's two actions and they are peers - neither is the
     lesser way to use the page - and styling one of them as secondary said the opposite.
     Nothing else on the page pairs two primaries, so the rule still holds everywhere it
     is describing a real hierarchy. */
  var synthBtn = mk('button', 'btn', 'synthBtn');
  synthBtn.setAttribute('type', 'button');
  /* `⚙︎` is U+2699 GEAR followed by U+FE0E, the text-presentation selector, and the
     selector is the whole point: bare U+2699 renders as a colour emoji on most
     platforms, which would sit wrong on the green fill beside Run's monochrome `▶` and
     - as the busy `⏲` proved - is drawn from a fallback font tall enough to change the
     button's height. `▶` (U+25B6) needs no selector because it already defaults to text
     presentation. */
  synthBtn.textContent = '⚙︎ Synthesize';
  /* Two states, the same rule Run's label follows in app.js and derived the same way -
     the fresh wording written once, the other made from it. The two buttons are
     deliberate peers (see above), so one of them tracking whether it has anything to
     show while the other sat still would read as an oversight rather than a distinction.
     Keyed on `cardsShown`, i.e. "a successful synthesis is on the page", so a synthesis
     that FAILS and takes the cards away puts the verb back with them.

     The derivation replaces the WORD, exactly as app.js replaces `Run`, so the leading
     glyph is not part of the rule and cannot be mangled by it. It used to prefix `Re-`
     to the whole string, which was correct only while the label began with a letter -
     with `⚙︎` in front that reads `Re-⚙︎ Synthesize`. */
  var SYNTH_LABEL_FRESH = synthBtn.textContent;
  var SYNTH_LABEL_AGAIN = SYNTH_LABEL_FRESH.replace(/\bSynthesize\b/, 'Re-synthesize');
  /* One writer, the same arrangement app.js's syncRunLabel has and for the same reason:
     the ⏲ form is derived HERE rather than written by the busy helper, so a synthesis
     that changes the verb while it runs (the first one, Synthesize -> Re-synthesize)
     cannot silently overwrite the busy glyph or be overwritten by it.

     The error form is app.js's RUN_LABEL_ERROR, read rather than restated: this button
     and Run are peers in one toolbar, so one source for the string is what stops them
     from ever disagreeing about how a failure reads. That works because a classic script
     shares the global lexical environment with the ones before it - the same reason this
     file can call logLine and read editorFullSource. Only the button that actually
     failed goes red, so two identical labels are never ambiguous; both saying it means
     both failed, which is true and is what the Console will confirm. */
  function syncSynthLabel() {
    var base = synthFailed ? RUN_LABEL_ERROR
             : (cardsShown ? SYNTH_LABEL_AGAIN : SYNTH_LABEL_FRESH);
    synthBtn.textContent = synthBtn.hasAttribute('data-busy') ? busyLabel(base) : base;
    // set/removeAttribute rather than toggleAttribute, matching withBusyButton's
    // handling of data-busy - one idiom for the two decorated states of one button.
    if (synthFailed) synthBtn.setAttribute('data-error', '');
    else synthBtn.removeAttribute('data-error');
  }
  (function () {
    var maxInput = document.getElementById('maxTimeInput');
    var bar = maxInput ? maxInput.parentElement : null;
    if (bar) bar.appendChild(synthBtn);          // after the "time units" label
    else document.querySelector('.grid').appendChild(synthBtn);
  })();

  /* =====================================================================
     4. the generic wiring app.js already did for its own cards
     ===================================================================== */

  /* app.js wires [data-collapse] and .help-icon with querySelectorAll AT LOAD, and
     these cards did not exist then - this file runs after it. So the same two
     handlers are attached here, to these cards only. */
  var newCards = [netlistCard, document.getElementById('card-netlist-view')];
  newCards.forEach(function (card) {
    card.querySelectorAll('[data-collapse]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = btn.closest('.card');
        c.classList.toggle('collapsed');
        btn.textContent = c.classList.contains('collapsed') ? '▸' : '▾';
      });
    });
    card.querySelectorAll('.help-icon').forEach(function (btn) {
      var popup = btn.nextElementSibling;
      if (!popup || !popup.classList.contains('help-popup')) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willShow = !popup.classList.contains('visible');
        document.querySelectorAll('.help-popup.visible').forEach(function (p) { p.classList.remove('visible'); });
        if (willShow) popup.classList.add('visible');
      });
    });
  });

  // Same constants as app.js's own height controls, so every panel on the page
  // steps by the same amount.
  function wireHeight(key, el, dec, inc, after) {
    var MIN = 200, MAX = 1000, STEP = 80;
    var saved = parseInt(localStorage.getItem(key), 10);
    if (!isNaN(saved)) el.style.height = saved + 'px';
    function adjust(delta) {
      var now = el.getBoundingClientRect().height || parseInt(el.style.height, 10) || MIN;
      var next = Math.max(MIN, Math.min(MAX, now + delta));
      el.style.height = next + 'px';
      localStorage.setItem(key, next);
      if (after) after();
    }
    dec.addEventListener('click', function () { adjust(-STEP); });
    inc.addEventListener('click', function () { adjust(STEP); });
  }
  wireHeight(K_HEIGHT, codeOut,
             document.getElementById('netlistHeightDec'),
             document.getElementById('netlistHeightInc'));
  // The viewer's fit depends on its own height, so resizing it must refit - the same
  // obligation the waveform's container has.
  wireHeight(K_VIEW_HEIGHT, flowRoot,
             document.getElementById('netlistViewHeightDec'),
             document.getElementById('netlistViewHeightInc'),
             function () { viewHeightPinned = true; invalidateFit(); fitView(); });
  /* The empty box starts small too, not only once something has been rendered into it: a
     page that has never synthesized never reaches renderGraph, so without this the first
     thing the reader sees is the 520px synth.css gives it. Set DIRECTLY rather than through
     sizeViewToGraph(), which reads `lastGraph` - a `var` declared hundreds of lines below
     and therefore still undefined here, so the call did nothing at all. */
  flowRoot.style.height = VIEW_EMPTY_H + 'px';

  (function () {
    var btn = document.getElementById('codeOutHierarchyToggleBtn');
    function apply(visible) {
      codeOutRow.classList.toggle('hierarchy-collapsed', !visible);
      btn.classList.toggle('active', visible);
    }
    btn.addEventListener('click', function () {
      var visible = codeOutRow.classList.contains('hierarchy-collapsed');
      localStorage.setItem(K_MODPANEL, visible ? '1' : '0');
      apply(visible);
    });
    apply(localStorage.getItem(K_MODPANEL) === '1');
  })();

  /* Full-bleed expand, the simulator's mechanism: --row-bleed is MEASURED from
     documentElement.clientWidth rather than calc(50% - 50vw), because 100vw includes
     the vertical scrollbar and the textbook trick pops a horizontal one. */
  (function () {
    var row = document.getElementById('netlistSplitRow');
    var btn = document.getElementById('netlistExpandBtn');
    function measureBleed() {
      var cs = window.getComputedStyle(document.body);
      var contentW = document.documentElement.clientWidth
        - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      return Math.max(0, (contentW - grid.getBoundingClientRect().width) / 2);
    }
    function apply(expanded) {
      row.style.setProperty('--row-bleed', (expanded ? measureBleed() : 0) + 'px');
      row.classList.toggle('row-expanded', expanded);
      btn.classList.toggle('active', expanded);
      btn.setAttribute('title', expanded ? 'Restore the card to the page width'
                                         : 'Expand to the full browser width');
      invalidateFit();
      fitView();   // more pixels for the same graph, so the fit has to be redone
    }
    btn.addEventListener('click', function () {
      var expanded = !row.classList.contains('row-expanded');
      localStorage.setItem(K_EXPANDED, expanded ? '1' : '0');
      apply(expanded);
    });
    apply(localStorage.getItem(K_EXPANDED) === '1');
  })();

  bundleBox.checked = localStorage.getItem(K_BUNDLE) !== '0';
  S.setBundleMultibit(bundleBox.checked);
  bundleBox.addEventListener('change', function () {
    localStorage.setItem(K_BUNDLE, bundleBox.checked ? '1' : '0');
    S.setBundleMultibit(bundleBox.checked);
    // Re-derives the graph from the SAME synthesis result: bundling is a view of the
    // netlist, not a different netlist, so this must not re-parse the source.
    showCurrentView();
  });

  /* One ratio per click, anchored on the viewport CENTRE: a button press has no pointer to
     zoom about, and centring is what stops repeated clicks from walking the diagram out of
     frame. Being a ratio, in-then-out returns to exactly the scale it started from. */
  var ZOOM_STEP = 1.3;
  function zoomFromButton(factor) {
    var vp = viewportSize();
    zoomAbout(vp.w / 2, vp.h / 2, factor);
  }
  document.getElementById('netlistZoomInBtn').addEventListener('click', function () {
    zoomFromButton(ZOOM_STEP);
  });
  document.getElementById('netlistZoomOutBtn').addEventListener('click', function () {
    zoomFromButton(1 / ZOOM_STEP);
  });
  document.getElementById('netlistZoomFitBtn').addEventListener('click', function () {
    fitView();
  });

  document.getElementById('netlistCopyBtn').addEventListener('click', function () {
    var ta = document.createElement('textarea');
    ta.value = netlistFullText;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
  document.getElementById('netlistSaveBtn').addEventListener('click', function () {
    if (!netlistFullText) return;
    var blob = new Blob([netlistFullText], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    /* PRACTICE_META is shell.js's, built from PRACTICE_SLUG - which a learn page does not
       declare, so there its slug is undefined and this would offer `undefined_netlist.v`. */
    var stem = (PRACTICE_META && PRACTICE_META.slug) || window.LEARN_SLUG || 'netlist';
    a.download = stem + '_netlist.v';
    a.click();
    URL.revokeObjectURL(url);
  });

  /* Two more tabs, and they follow the cards rather than the page: a tab pointing at a
     hidden card is the dead control practice.js's strip is built to avoid, and these
     cards are hidden until a synthesis succeeds. practice.js rebuilds only its own tabs
     (inserting them before whatever is already there), so these two can be added and
     removed independently and always sit at the end. */
  var synthTabsSkip = null;   // which tab set is on the strip, see syncSynthTabs
  var synthTabs = [];
  /* `skipNetlist` drops the Netlist tab when its card is suppressed, because a tab pointing at a
     hidden card is the dead control this strip is built to avoid. It is remembered rather than
     tested for presence alone: a design edited from structural to RTL keeps the same two cards
     shown, so `synthTabs.length` would say "already built" and the strip would stay one tab short
     of the cards on the page. */
  function syncSynthTabs(show, skipNetlist) {
    var strip = document.getElementById('exTabs');
    if (!strip) return;
    if (!show) {
      synthTabs.forEach(function (b) { b.remove(); });
      synthTabs = [];
      synthTabsSkip = null;
      return;
    }
    if (synthTabs.length && synthTabsSkip === !!skipNetlist) return;
    synthTabs.forEach(function (b) { b.remove(); });
    synthTabs = [];
    synthTabsSkip = !!skipNetlist;
    [['tabNetlist', 'Netlist', 'code', 'card-netlist'],
     ['tabNetlistView', 'Viewer', 'chip', 'card-netlist-view']]
      .filter(function (t) { return !(skipNetlist && t[3] === 'card-netlist'); })
      .forEach(function (t) {
      var b = mk('button', 'gh-tab', t[0]);
      b.setAttribute('type', 'button');
      b.innerHTML = ((typeof ICON !== 'undefined' && ICON[t[2]]) || '') + '<span>' + t[1] + '</span>';
      b.addEventListener('click', function () {
        strip.querySelectorAll('.gh-tab').forEach(function (o) { o.classList.remove('selected'); });
        b.classList.add('selected');
        var card = document.getElementById(t[3]);
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
      });
      /* BEFORE the Reset button, not appended to the strip. Reset is pushed right by
         `margin-left: auto`, and an auto margin absorbs the space before its own item -
         it does not hold anything appended afterwards back. So appending here would put
         the netlist pair to the right of Reset on every successful synthesis, which is
         exactly the "rightmost" the button is meant to be. Inserting keeps DOM order,
         keyboard order and visual order in agreement. */
      var pin = (window.PRACTICE_API && window.PRACTICE_API.resetButton
                 && window.PRACTICE_API.resetButton()) || null;
      if (pin && pin.parentElement === strip) strip.insertBefore(b, pin);
      else strip.appendChild(b);
      synthTabs.push(b);
    });
  }

  /* The cards and their tabs move together, and the fit has to happen AFTER they are
     visible: #flowRoot has no width while it is display:none, so a fit computed then
     would place every node against a fallback width and the first thing the reader sees
     would be a badly framed diagram. */
  function showCards(on) {
    cardsShown = !!on;
    /* THE LISTING IS SUPPRESSED FOR A DESIGN THAT WAS ALREADY A NETLIST. A card titled
       "Synthesized Gate-level Verilog Netlist" over a design that instantiated its cells by hand is
       showing the reader their own source back under a heading that claims it was produced - the
       viewer beside it is the useful half, because a picture of a structure is not the structure's
       text. Derived per synthesis from the result, so an edit from an instantiation to an operator
       brings the card back with nothing to keep in step.

       ONE THING GOES WITH IT: the gate-level Run button lives at the bottom of that card. On a
       structural design it would re-run the very modules the simulator just ran - the netlist and
       the source are the same modules - so losing it costs nothing there, and it returns the moment
       something is actually synthesized. */
    var structural = cardsShown
      && topIsStructural(currentAll && currentAll.top && currentAll.top.name);
    netlistCard.style.display = (cardsShown && !structural) ? '' : 'none';
    viewerRow.style.display = cardsShown ? '' : 'none';
    syncSynthTabs(cardsShown, structural);
    syncSynthLabel();   // the label follows the cards, and syncSynthLabel is its only writer
    if (cardsShown) fitView();
  }

  /* =====================================================================
     5. running the synthesizer
     ===================================================================== */

  /* The synthesis log goes in the SIMULATOR's console, under a rule that separates it
     from the simulation output above - and it is kept in memory as well as printed,
     because Run and Synthesize now share one box that only Run clears. So the lines
     are the truth and the console is a rendering of them: Synthesize replaces the
     section, Run re-prints whatever the last Synthesize produced. Both halves stay on
     screen, which is the only arrangement where neither button silently discards the
     other's output.

     Nothing here prints the words PASS or FAIL, so the verdict pill - which counts
     them over the whole console - cannot be moved by a synthesis. */
  var synthLines = [];      // {level, msg}, the last synthesis's log - the truth
  var printedEls = [];      // the console rows currently showing it
  function synthLog(level, msg) {
    synthLines.push({ level: level, msg: msg });
    printSynthLine(level, msg);
  }
  /* `before` is the row to insert ahead of, or null to append. That is what puts this
     section in RECENCY order: the Console reads oldest at the top, and a synthesis that
     happened BEFORE the run now on screen has to sit above it. It could only ever append
     before, which is why Synthesize-then-Run printed the older log under the newer
     output - every time, since Run clears the box and this re-prints afterwards. */
  /* A section rule is spaced from the block above it, so the Console reads as sections
     rather than as one stream - and both writers mark it the same way, since `— synthesis —`
     is an ordinary entry of synthLines and would otherwise be the one rule without it. */
  function isRule(msg) { return msg.charAt(0) === '\u2014'; }
  function printSynthLine(level, msg, before) {
    if (before) {
      var div = document.createElement('div');
      if (isRule(msg)) div.className = 'console-rule';
      div.innerHTML = '<span class="' + level + '">' + escapeHtml(msg) + '</span>';
      consoleBox.insertBefore(div, before);
      printedEls.push(div);
      return;
    }
    logLine('<span class="' + level + '">' + escapeHtml(msg) + '</span>');
    // logLine appends one div and hands nothing back, so the row it just made is the
    // console's last child. Keeping the element is what lets this section be removed
    // again without touching a line the simulation printed.
    var kids = consoleBox.children;
    var el = kids[kids.length - 1];
    if (el) {
      if (isRule(msg)) el.className = 'console-rule';
      printedEls.push(el);
    }
  }
  function dropPrintedSynthLines() {
    printedEls.forEach(function (el) {
      if (el.parentElement) el.parentElement.removeChild(el);
    });
    printedEls = [];
  }
  // After something else has cleared the console, or after the stale flag moved: the
  // rows are gone (or wrong), the lines are not.
  function renderSynthSection(atTop) {
    dropPrintedSynthLines();
    if (!synthLines.length) return;
    /* atTop means "this synthesis is older than what is already in the box" - which is
       true of every re-print after a Run, and false when Synthesize is what just
       happened. The `— synthesis —` rule needs no special handling: it is the FIRST entry
       of synthLines, pushed once when a synthesis starts, so it travels with the rows and
       there is still exactly one writer of it. */
    var before = atTop ? consoleBox.firstChild : null;
    synthLines.forEach(function (l) { printSynthLine(l.level, l.msg, before); });
    /* The band on the two cards is not visible to a reader who is scrolling the
       Console, so the section says it too - otherwise the log reads as a report of the
       design in the editor when it is a report of an older one. Not pushed into
       synthLines: it is a fact about the flag, not a line the synthesizer produced, and
       storing it would accumulate one per re-render. */
    if (stale) printSynthLine('warn', '(the design has changed since this synthesis)');
  }

  /* Why a failed synthesis gets a HINT as well as the error. The synthesizer's subset is
     narrower than the simulator's, and where a design steps outside it the message is
     about the token the parser tripped on rather than about the gap: `a << b` reports
     `expected 'ident' but got '<'`, and a `reg [7:0] mem [0:255]` reports `expected ';'
     but got '['`. Both read as "your Verilog is broken" for designs that are correct and
     simulate perfectly on the same page - which, now that eight of the eighteen enabled
     pages are exactly those designs, is the message most learners will meet.

     So each entry is a pattern in the SOURCE plus the thing the subset does not cover,
     and a hint is only offered when the pattern is really present. Deliberately not a
     claim about the cause: it says what is here and unsupported, not "this is why". */
  var SUBSET_GAPS = [
    [/<<|>>/, 'shift operators (<< and >>)'],
    [/\b(?:reg|wire)\b[^;=\n]*\]\s*\w+\s*\[/, 'memory arrays (reg [N:0] name [0:M])'],
    [/[^0-9a-zA-Z_]'[hdbo]/i, "unsized literals ('hff rather than 8'hff)"]
  ];
  function subsetHints(src) {
    var found = [];
    SUBSET_GAPS.forEach(function (g) { if (g[0].test(src)) found.push(g[1]); });
    return found;
  }

  /* The testbench must go before the source reaches the synthesizer, and this is not
     cosmetic: the synthesizer's lexer has no #delay, so handing it a whole exercise
     file fails with `Lex error: unexpected character '#'` and the card would report a
     parse error on every page.

     The boundary is the TESTBENCH marker, which is the same line the two editors
     split on - so what gets synthesized is exactly what the design card shows, by
     construction rather than by a second rule that could disagree with it. This
     replaced a search for the last `module tb`, which was a guess dressed up as a
     convention: it could not see that a rom, a ram model and the system wrapper are
     testbench too, so on the three CPU designs it fed all of them to the synthesizer.

     "By construction" is now literal: this reads app.js's own `tbMarkerIn` rather
     than restating its pattern, the way this file already uses `logLine` and
     `editorFullSource` - a classic script sees the bindings of the ones before it.
     The copy it replaced was line-anchored, so once the marker could sit mid-line
     the two would have split the same document in two different places.

     `tbMarkerIn`, not `designSpan`: that one answers this app's question, where a
     document only has a testbench region if there is a second editor on the page to
     show it in. The design has to be cut out for the synthesizer either way. */
  function designOnly(src) {
    var at = tbMarkerIn(src);
    if (at < 0) return { src: src, dropped: 0 };
    return { src: src.slice(0, at), dropped: src.slice(at).split('\n').length };
  }

  function renderNetlistView() {
    var text = netlistFullText;
    if (netlistSelectedModule !== '(all)') {
      var seg = netlistSegments.filter(function (s) { return s.name === netlistSelectedModule; })[0];
      if (seg) text = netlistFullText.slice(seg.start, seg.end);
    }
    codeOut.textContent = text;
    netlistEmpty.style.display = netlistFullText ? 'none' : '';
  }

  function renderModulePanel() {
    codeOutPanel.innerHTML = '';
    ['(all)'].concat(netlistSegments.map(function (s) { return s.name; })).forEach(function (name) {
      var row = mk('div', 'editor-module-row' + (name === netlistSelectedModule ? ' active' : ''));
      row.textContent = name;
      row.addEventListener('click', function () {
        if (name === netlistSelectedModule) return;
        netlistSelectedModule = name;
        renderNetlistView();
        renderModulePanel();
      });
      codeOutPanel.appendChild(row);
    });
  }

  function renderBreadcrumb() {
    crumbRow.innerHTML = '';
    viewStack.forEach(function (name, i) {
      if (i > 0) {
        var sep = mk('span', 'sep');
        sep.textContent = '/';
        crumbRow.appendChild(sep);
      }
      var b = mk('button', 'crumb');
      b.setAttribute('type', 'button');
      b.textContent = name;
      if (i < viewStack.length - 1) {
        b.addEventListener('click', function () {
          viewStack = viewStack.slice(0, i + 1);
          showCurrentView();
        });
      }
      crumbRow.appendChild(b);
    });
  }

  function drillInto(modType) {
    if (!currentAll) return;
    if (modType !== 'FA_PRIMITIVE' && !currentAll.results[modType]) return;
    viewStack.push(modType);
    showCurrentView();
  }

  /* Returns whether it managed to render, because "the synthesis succeeded" is not the
     same event as "there is something to show": adder-4bit's starter parses and
     elaborates, then fails while the netlist is being built (`no driver found for net
     'cout'`, its unwritten output). Revealing the cards on the strength of
     synthesizeAll alone put an empty pair of cards on that page. */
  function showCurrentView() {
    if (!currentAll) return false;
    var modName = viewStack[viewStack.length - 1];
    try {
      var v = S.synthesizeModuleView(currentAll, modName);
      // The structural text always starts from the real top module, whichever
      // sub-module the graph happens to be showing.
      var results = [currentAll.results[currentAll.top.name]];
      Object.keys(currentAll.results).forEach(function (k) {
        if (k !== currentAll.top.name) results.push(currentAll.results[k]);
      });
      var gen = S.genVerilog(results);
      netlistFullText = gen.text;
      netlistSegments = gen.segments;
      renderNetlistView();
      renderModulePanel();
      lastGraph = packColumns(symbolizeGateCells(S.toFlowElements(v.graph, v.layout)));
      renderGraph(lastGraph);
      renderBreadcrumb();
      return true;
    } catch (e) {
      // Do not leave the breadcrumb pointing at a level whose graph failed, but never
      // pop the last one: an unrenderable top view should stay named.
      if (viewStack.length > 1) viewStack.pop();
      synthLog('err', 'error showing ' + modName + ': ' + e.message);
      renderBreadcrumb();
      return false;
    }
  }

  function clearNetlist(reason) {
    currentAll = null;
    netlistFullText = '';
    netlistSegments = [];
    netlistSelectedModule = '(all)';
    renderNetlistView();
    renderModulePanel();
    crumbRow.innerHTML = '';
    lastGraph = { nodes: [], edges: [] };
    renderGraph(lastGraph, reason);
  }

  function runSynthesis() {
    syntheses++;
    synthFailed = false;   // cleared here, so reaching the end of this function IS success
    // The editor is the simulator's: merging the visible module back is what makes
    // this synthesize what is on screen rather than a stale copy of the file.
    spliceEditorChangesBack();
    var whole = editorFullSource;
    var cut = designOnly(whole);
    /* This synthesis's own log replaces the last one's, in memory and on screen. The
       console cannot be cleared here - the simulation output above it belongs to Run -
       so the previous section's rows are removed individually. */
    dropPrintedSynthLines();
    synthLines = [];
    synthLog('info', '— synthesis —');
    if (cut.dropped) {
      synthLog('info', 'ignored the ' + cut.dropped + ' lines below the TESTBENCH marker: the '
                     + 'synthesizer has no #delay, $display or initial, and a testbench '
                     + 'is not hardware');
    }
    netlistSelectedModule = '(all)';
    try {
      /* window.LEARN_SYNTH_TOP is a topic page's derived top - the sole module in its `verilog`
         part, with its cell library beside it in the same design half. Undefined everywhere else,
         so the eighteen practice pages and synthesis.html keep inferring as they always did. */
      currentAll = S.synthesizeAll(cut.src, window.LEARN_SYNTH_TOP || undefined);
    } catch (e) {
      clearNetlist(e.message);
      synthLog('err', 'error: ' + e.message);
      subsetHints(cut.src).forEach(function (gap) {
        synthLog('info', 'this design uses ' + gap + ', which the synthesizer\'s subset '
                       + 'does not cover - the simulator above does');
      });
      // Nothing was synthesized, so there is nothing to show: the cards go away (or stay
      // away), and the Console carries the whole of the answer.
      // Set BEFORE showCards, which is what calls syncSynthLabel - the ordering is the
      // whole correctness of this: after it, the label would be written from the old flag.
      synthFailed = true;
      showCards(false);
      markStale(false);
      return;
    }
    currentAll.log.forEach(function (l) { synthLog(l.level, '[' + l.level + '] ' + l.msg); });
    viewStack = [currentAll.top.name];
    /* Shown BEFORE the graph is laid out, so the fit measures the real card width - and
       taken away again if the render failed, since the rule is that these cards are on
       the page only while a synthesis is on them. */
    showCards(true);
    if (!showCurrentView()) {
      clearNetlist('the netlist could not be built');
      synthFailed = true;   // before showCards, as above
      showCards(false);
      markStale(false);
      return;
    }
    markStale(false);
    /* No node/net count here any more. It described the DIAGRAM of the module on screen,
       while the report below counts the whole design per instantiation site - two numbers
       for nearly the same thing, disagreeing for reasons nothing on the page explained
       (`5 nodes` three lines above `Number of cells: 4`). The Console states one of them
       and the viewer shows the other. */
    synthLog('ok', 'synthesized top module ' + currentAll.top.name);
    /* The SAME function synthesis.html logs, reached through the slice rather than
       reimplemented - so the two apps cannot report a different area for one design. It
       returns one multi-line string and is logged as one row: the console box is monospace
       and pre-wrap, so its padded columns line up, and one row is what keeps the section's
       own bookkeeping (printedEls, the re-print ordering, Clear) working unchanged. */
    /* SAY WHICH IT WAS. A design that only instantiates cells was already a netlist, and calling
       that a synthesis claims work nobody did - the cells on screen are the ones the source named.
       The area report still follows, because the cost of those cells is the same question either
       way. Derived per press from the result, so an edit from an instantiation to an operator
       changes the sentence with nothing to keep in step. */
    if (topIsStructural(currentAll.top && currentAll.top.name)) {
      var cells = currentAll.results[currentAll.top.name].cells.length;
      synthLog('info', 'this design is already a netlist: ' + cells + ' instantiated cell'
             + (cells === 1 ? '' : 's') + ', nothing to infer - the diagram is its structure');
    }
    synthLog('info', S.buildAreaReport(currentAll));
  }

  /* =====================================================================
     6. the viewer
     ===================================================================== */

  function svg(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function gateSymbolHtml(kind) {
    var def = GATE_DEFS[kind];
    var s = '<svg viewBox="' + def.viewBox + '" preserveAspectRatio="none">';
    def.stubs.forEach(function (st) {
      s += '<line x1="' + st[0] + '" y1="' + st[1] + '" x2="' + st[2] + '" y2="' + st[3]
         + '" class="gate-stroke" stroke-width="3" stroke-linecap="butt"/>';
    });
    s += '<path d="' + def.body + '" class="gate-stroke node-fill" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    if (def.notch) s += '<path d="' + def.notch + '" class="gate-stroke node-fill" stroke-width="3" stroke-linejoin="round"/>';
    if (def.bubble) s += '<circle cx="' + def.bubble.cx + '" cy="' + def.bubble.cy + '" r="' + (def.bubble.r || 6) + '" class="gate-stroke node-fill" stroke-width="3"/>';
    if (def.extra) s += '<path d="' + def.extra + '" fill="none" class="gate-stroke" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    if (def.label) s += '<text x="' + def.label.x + '" y="' + def.label.y + '" font-family="Helvetica" font-size="15" font-weight="bold" class="gate-fill-stroke" text-anchor="middle">' + def.label.text + '</text>';
    return s + '</svg>';
  }

  function rangeHtml(data) {
    return data.isBus && data.range ? '<div class="rf-node-range">' + escapeHtml(data.range) + '</div>' : '';
  }

  function buildNode(n) {
    var d = n.data, sz = nodeSize(n);
    var e = mk('div', 'rf-node');
    e.style.left = n.position.x + 'px';
    e.style.top = n.position.y + 'px';
    if (n.type === 'const') {
      e.classList.add('rf-node-const');
      e.style.width = sz.width + 'px';
      e.innerHTML = '<div class="rf-node-label">' + escapeHtml(d.label) + '</div>';
      return e;
    }
    if (n.type !== 'instance') { e.style.width = sz.width + 'px'; e.style.height = sz.height + 'px'; }
    switch (n.type) {
      case 'port':
        e.classList.add('rf-node-port');
        e.classList.add(d.dir === 'in' ? 'port-in' : 'port-out');
        if (d.isBus) e.classList.add('is-bus');
        e.innerHTML = '<svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="' + PORT_D
          + '" class="port-stroke node-fill" stroke-width="3" stroke-linejoin="round"/></svg>'
          + '<div class="rf-node-label">' + escapeHtml(d.label) + '</div>'
          + (d.isBus && d.range ? '<div class="rf-node-range">' + escapeHtml(d.range) + '</div>' : '');
        break;
      case 'gate':
        e.classList.add('rf-node-gate');
        if (d.inverted) e.classList.add('inverted');
        if (d.isBus) e.classList.add('is-bus');
        e.setAttribute('title', d.label);
        e.innerHTML = gateSymbolHtml(d.kind) + rangeHtml(d);
        break;
      case 'dff':
        e.classList.add('rf-node-dff');
        if (d.isBus) e.classList.add('is-bus');
        e.setAttribute('title', 'DFF');
        e.innerHTML = gateSymbolHtml('dff') + rangeHtml(d);
        break;
      case 'fa':
        e.classList.add('rf-node-fa');
        if (d.isBus) e.classList.add('is-bus');
        e.setAttribute('title', d.label + ' — double-click to view gate-level internals');
        e.style.cursor = 'pointer';
        e.innerHTML = gateSymbolHtml(d.op === 'sub' ? 'sub' : 'add') + rangeHtml(d);
        e.addEventListener('dblclick', function () { drillInto('FA_PRIMITIVE'); });
        break;
      case 'adder':
        e.classList.add('rf-node-fa');
        e.setAttribute('title', d.modType + ' (' + d.width + '-bit) — double-click to view internals');
        e.style.cursor = 'pointer';
        e.innerHTML = gateSymbolHtml(d.op === 'sub' ? 'sub' : 'add')
          + '<div class="rf-node-range">[' + (d.width - 1) + ':0]</div>';
        e.addEventListener('dblclick', function () { drillInto(d.modType); });
        break;
      case 'mux2':
        e.classList.add('rf-node-mux2');
        if (d.isBus) e.classList.add('is-bus');
        e.setAttribute('title', 'MUX2');
        e.innerHTML = gateSymbolHtml('mux2') + rangeHtml(d);
        break;
      case 'instance':
        e.classList.add('rf-node-instance');
        e.style.height = sz.height + 'px';
        e.setAttribute('title', 'double-click to view ' + d.modType + "'s netlist");
        e.innerHTML = '<div class="rf-node-modtype">' + escapeHtml(d.modType) + '</div>'
          + '<div class="rf-node-instname">' + escapeHtml(d.instName) + '</div>'
          + '<div class="rf-node-drill-hint">⤢ double-click</div>';
        e.addEventListener('dblclick', function () { drillInto(d.modType); });
        break;
      default:
        e.innerHTML = '<div class="rf-node-label">' + escapeHtml(d.label || n.type) + '</div>';
    }
    return e;
  }

  /* ---- net selection ----
     A click selects the NET, not the one wire, and that is the whole point of it: the
     16-bit CPU draws 622 edges carrying only 238 distinct nets, and its busiest net is
     drawn as 46 separate segments. "Where does this signal go" is answerable only if all
     46 light up. The label is drawn ONCE, at the wire that was clicked - labelling 46
     segments would rebuild the clutter this replaced. */
  var drawn = [];            // {net, wire, mid} per drawn edge
  var byNet = {};            // net name -> those records
  var selectedNet = null;
  var selectedLabel = null;  // the one <text> element, or null

  function clearNetSelection() {
    if (selectedLabel && selectedLabel.parentElement) {
      selectedLabel.parentElement.removeChild(selectedLabel);
    }
    selectedLabel = null;
    if (selectedNet && byNet[selectedNet]) {
      byNet[selectedNet].forEach(function (r) { r.wire.classList.remove('sel'); });
    }
    selectedNet = null;
    if (netReadout) { netReadout.textContent = ''; netReadout.style.display = 'none'; }
  }

  function selectNet(net, at) {
    var again = net === selectedNet;
    clearNetSelection();
    if (again || !net || !byNet[net]) return;   // clicking the selected net again clears it
    selectedNet = net;
    byNet[net].forEach(function (r) { r.wire.classList.add('sel'); });
    var point = at || byNet[net][0].mid;
    selectedLabel = svg('text', { class: 'pn-edge-label sel', x: point.x, y: point.y - 3 });
    selectedLabel.textContent = net;
    edgeLayer.appendChild(selectedLabel);
    /* Also said in words beside the breadcrumb, because the label can be panned
       off-screen while the highlight is still on. */
    if (netReadout) {
      netReadout.textContent = 'net: ' + net + ' (' + byNet[net].length
        + (byNet[net].length === 1 ? ' segment)' : ' segments)');
      netReadout.style.display = '';
    }
  }

  /* A polyline with its interior corners rounded. One helper for both routes below,
     so a forward wire and a feedback wire cannot end up drawn in two idioms. */
  function roundedPath(pts, r) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0].x + ',' + pts[0].y;
    for (var i = 1; i < pts.length - 1; i++) {
      var p = pts[i - 1], c = pts[i], q = pts[i + 1];
      var d1 = Math.hypot(c.x - p.x, c.y - p.y), d2 = Math.hypot(q.x - c.x, q.y - c.y);
      var rr = Math.min(r, d1 / 2, d2 / 2);
      if (!(rr > 0.5)) { d += ' L' + c.x + ',' + c.y; continue; }
      d += ' L' + (c.x + (p.x - c.x) / d1 * rr) + ',' + (c.y + (p.y - c.y) / d1 * rr);
      d += ' Q' + c.x + ',' + c.y + ' ' + (c.x + (q.x - c.x) / d2 * rr) + ',' + (c.y + (q.y - c.y) / d2 * rr);
    }
    var last = pts[pts.length - 1];
    return d + ' L' + last.x + ',' + last.y;
  }

  /* Left-to-right wires take the middle-column route React Flow's 'smoothstep' draws.
     A wire that runs BACKWARDS is a real case here, not an edge case - a register's Q
     feeding the mux in front of its own D is what every counter looks like - so it is
     routed out of the source, under both nodes and back in, rather than drawn through
     them. */
  function edgePoints(a, b) {
    if (b.x - a.x >= 30) {
      var mx = (a.x + b.x) / 2;
      if (Math.abs(a.y - b.y) < 0.5) return [a, b];
      return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
    }
    var out = a.x + 22, back = b.x - 22;
    var below = Math.max(a.y, b.y) + 34;
    return [a, { x: out, y: a.y }, { x: out, y: below }, { x: back, y: below }, { x: back, y: b.y }, b];
  }

  function midOf(pts) {
    var total = 0, i;
    for (i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    var want = total / 2, acc = 0;
    for (i = 1; i < pts.length; i++) {
      var len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc + len >= want) {
        var t = len ? (want - acc) / len : 0;
        return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
                 y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
      }
      acc += len;
    }
    return pts[pts.length - 1];
  }

  function applyTransform() {
    var t = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
    nodesLayer.style.transform = t;
    edgeLayer.setAttribute('transform', 'translate(' + view.x + ',' + view.y + ') scale(' + view.k + ')');
  }

  /* The engine lays out on a fixed grid - `COL = 200, ROW = 84`, node k of a column at
     `y = k * ROW` - and it cannot do better, because a node's HEIGHT is the viewer's
     knowledge: it comes from the SVG symbols' viewBoxes and from how many pins an
     instance has, neither of which exists yet when layoutGraph runs. Boxes are routinely
     taller than one row (an adder is 104px, a five-pin instance 140, and before the
     engine's bus-pin pass a nineteen-pin one was 420), so blocks lapped the ones below
     them: measured across the enabled pages, 3 overlapping pairs on the 16-bit CPU, 6 on
     traffic-light, 4 on the register file.

     So the columns are re-stacked here, where the sizes are known. The engine's decisions
     are kept exactly - which column a node is in, and the order within it - and only the
     y's move, which is what preserves its layered ranking. `clk` keeps its place at the
     bottom of its own column, since layoutGraph already gives it the largest y there. */
  var COLUMN_GAP = 24;
  /* ---- a cell that IS one gate is drawn as that gate ---------------------------------
     An instantiation is drawn as a block, which is right for a CPU and wrong for a gate: a design
     that instantiates `and_gate u0(...)` is ALREADY a netlist, and drawing its one cell as a box
     with `double-click` on it hides the very thing the page is about one level down.

     DERIVED, never declared. `currentAll.results` holds every module's own synthesis, so the
     question "is this cell a single gate" is already answered: `cells` is one entry and its type is
     one the viewer has a symbol for. Nothing in a topic file or a manifest says so, so nothing can
     go stale when the design changes - swap the instantiation for `assign y = a & b` and the same
     rule draws the same symbol for the other reason.

     A VIEWER concern, so it lives here beside packColumns rather than in the engine: the netlist
     TEXT is untouched, the hierarchy is still real, and `genVerilog` still emits the instance. Only
     the picture changes.

     FLIP-FLOPS FALL OUT ON THEIR OWN, and it is worth being precise about why rather than claiming
     a special case: a flop takes d, clk and rstn, so the arity rule below already leaves it a
     block - listing `dff` here would change nothing, which a mutant adding it confirmed. That also
     keeps the drill-down that shift-register-4bit, register-file and traffic-light are checked
     through, but as a consequence rather than as this list's doing.

     The handles have to be REMAPPED, which is the whole of the work: an instance's pins are its
     port names (`inSlots`/`outSlots`, whatever the module called them) while a gate's are `a`, `b`
     and `y`. So the inputs map in declaration order and the single output becomes `y` - and a cell
     with more than two inputs or more than one output is left as a block, because there would be no
     pin to map it onto. */
  var SYMBOLIZABLE = { and: 1, nand: 1, or: 1, nor: 1, xor: 1, xnor: 1, not: 1, buf: 1 };
  function cellIsOneGate(modType) {
    var r = currentAll && currentAll.results && currentAll.results[modType];
    if (!r || !r.cells || r.cells.length !== 1) return null;
    var kind = r.cells[0].type;
    return SYMBOLIZABLE[kind] ? kind : null;
  }
  function symbolizeGateCells(g) {
    if (!currentAll) return g;
    var swapped = {};      // node id -> { in: {portId: pin}, out: {portId: 'y'} }
    var nodes = g.nodes.map(function (n) {
      if (n.type !== 'instance' || !n.data || n.data.isAdder) return n;
      var kind = cellIsOneGate(n.data.modType);
      var ins = n.data.inSlots || [], outs = n.data.outSlots || [];
      if (!kind || ins.length < 1 || ins.length > 2 || outs.length !== 1) return n;
      var map = { in: {}, out: {} };
      var pins = ins.length === 1 ? ['a'] : ['a', 'b'];
      ins.forEach(function (s, i) { map.in[s.id] = pins[i]; });
      map.out[outs[0].id] = 'y';
      swapped[n.id] = map;
      /* The instance NAME survives in the title, where a block showed it as text: a symbol has
         nowhere to put it, and the page is about the gate rather than about what it was called. */
      return { id: n.id, type: 'gate', position: n.position,
               data: { kind: kind, unary: ins.length === 1,
                       label: n.data.instName + ' (' + n.data.modType + ')' } };
    });
    var edges = g.edges.map(function (e) {
      var s = swapped[e.source], d = swapped[e.target];
      if (!s && !d) return e;
      var out = {};
      for (var k in e) if (Object.prototype.hasOwnProperty.call(e, k)) out[k] = e[k];
      if (s && s.out[e.sourceHandle]) out.sourceHandle = s.out[e.sourceHandle];
      if (d && d.in[e.targetHandle]) out.targetHandle = d.in[e.targetHandle];
      return out;
    });
    return { nodes: nodes, edges: edges };
  }

  /* Was the design ALREADY a gate-level netlist? Two conditions, and the second is what stops this
     from claiming too much: the top has no logic of its own - every cell is an instantiation, so
     nothing was inferred - AND every one of those cells is a single gate, so there is nothing left
     to expand either.

     THE SECOND CONDITION IS NOT PEDANTRY. `shift-register-4bit` instantiates four `dff` modules and
     nothing else, so by the first test alone it is "structural" - but its listing genuinely adds
     something, because each dff is RTL that gets expanded into cells. Without this, that page lost
     its netlist card and eleven checks went with it. A design whose cells are all single gates is
     the case where the listing really is the source back again: the same gates the viewer is already
     drawing as symbols, which is why the two rules share `cellIsOneGate`.

     Derived per press, so an edit from an instantiation to an operator - or to a cell with a body -
     changes the answer with nothing to keep in step. */
  function topIsStructural(topName) {
    var r = currentAll && currentAll.results && currentAll.results[topName];
    if (!r || !r.cells || !r.cells.length) return false;
    for (var i = 0; i < r.cells.length; i++) {
      var c = r.cells[i];
      if (c.type !== 'instance') return false;      // logic of its own: something was synthesized
      if (!cellIsOneGate(c.modType)) return false;  // a cell with a body: the listing expands it
    }
    return true;
  }

  function packColumns(g) {
    var cols = {};
    g.nodes.forEach(function (n) { (cols[n.position.x] || (cols[n.position.x] = [])).push(n); });
    Object.keys(cols).forEach(function (x) {
      var col = cols[x].slice().sort(function (a, b) { return a.position.y - b.position.y; });
      var y = 0;
      col.forEach(function (n) {
        n.position = { x: n.position.x, y: y };
        y += nodeSize(n).height + COLUMN_GAP;
      });
    });
    return g;
  }

  function graphBounds() {
    if (!lastGraph.nodes.length) return null;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    lastGraph.nodes.forEach(function (n) {
      var sz = nodeSize(n);
      x0 = Math.min(x0, n.position.x); y0 = Math.min(y0, n.position.y);
      x1 = Math.max(x1, n.position.x + sz.width); y1 = Math.max(y1, n.position.y + sz.height);
    });
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  function viewportSize() {
    // A stub DOM reports no layout, so fall back to the height synth.css gives
    // #flowRoot - that keeps the fit deterministic headlessly instead of dividing
    // by zero and putting every node at NaN.
    return {
      w: flowRoot.clientWidth || 900,
      h: flowRoot.getBoundingClientRect().height || parseInt(flowRoot.style.height, 10) || 520
    };
  }

  /* The scale at which the whole diagram fits. Factored out because it now has two
     readers - the Fit button and the zoom-out FLOOR - and two guesses at one number is how
     they would come to disagree. The 1.5 cap is part of it: on a small design Fit does not
     magnify past 1.5, so "no further out than Fit" means no further out than that. */
  var FIT_PAD = 28, FIT_MAX_K = 1.5;
  /* Cached, and that is not premature: every wheel event now needs the floor, and
     viewportSize() reads getBoundingClientRect - a forced layout per notch of the wheel is
     the cost this repo already measured in verify's render loop, where one such read per
     frame was three quarters of the work. It depends only on the graph and the container,
     so it is invalidated where those change: a new diagram, a resize, the expand toggle and
     the height buttons. */
  var fitCache = null;
  function invalidateFit() { fitCache = null; }

  /* ---- the box is as tall as its diagram, up to the height it has always had ----
     synth.css gives #flowRoot 520px and wireHeight then applies whatever the reader
     stored. That is right for a CPU netlist and wrong for a two-gate one: Fit does not
     magnify past FIT_MAX_K, so one cell sat in the middle of a box that was mostly empty
     canvas - and on a learn page it pushed the prose that follows off the screen.

     The height taken is what the diagram needs at the scale its WIDTH allows, which is the
     tallest it could usefully be, clamped to [VIEW_MIN_H, the height it would otherwise
     have had]. So nothing is ever taller than before and a small netlist is shorter.
     Touching the height buttons PINS it for the session: after that the box is the
     reader's, not the diagram's, which is why the flag is not persisted - a choice made on
     one topic should not silently govern a CPU on another page tomorrow. */
  // VIEW_MIN_H / VIEW_EMPTY_H / viewHeightPinned are declared beside K_VIEW_HEIGHT above,
  // because the wiring block sets the empty height long before this point.
  function fullViewHeight() {
    // Stored-or-520, the same fallback and the same reason as viewportSize() below.
    var stored = parseInt(localStorage.getItem(K_VIEW_HEIGHT), 10);
    return isNaN(stored) ? 520 : stored;
  }
  function sizeViewToGraph() {
    if (viewHeightPinned) return;
    var b = graphBounds();
    if (!b) {
      flowRoot.style.height = VIEW_EMPTY_H + 'px';
      invalidateFit();
      return;
    }
    var w = flowRoot.clientWidth || 900;
    var k = Math.min((w - 2 * FIT_PAD) / b.w, FIT_MAX_K);
    var need = Math.round(b.h * k + 2 * FIT_PAD);
    flowRoot.style.height = Math.max(VIEW_MIN_H, Math.min(fullViewHeight(), need)) + 'px';
    invalidateFit();                       // the box moved, so the fit it was cached for is stale
  }
  function fitScale() {
    if (fitCache !== null) return fitCache;
    var b = graphBounds();
    if (!b) return 1;
    var vp = viewportSize();
    fitCache = Math.max(MIN_K, Math.min((vp.w - 2 * FIT_PAD) / b.w,
                                        (vp.h - 2 * FIT_PAD) / b.h, FIT_MAX_K));
    return fitCache;
  }

  function fitView() {
    var b = graphBounds();
    if (!b) { view = { k: 1, x: 0, y: 0 }; applyTransform(); return; }
    var vp = viewportSize();
    view.k = fitScale();
    view.x = (vp.w - b.w * view.k) / 2 - b.x * view.k;
    view.y = (vp.h - b.h * view.k) / 2 - b.y * view.k;
    applyTransform();
  }

  function renderGraph(g, reason) {
    nodesLayer.innerHTML = '';
    edgeLayer.innerHTML = '';
    var byId = {};
    g.nodes.forEach(function (n) {
      byId[n.id] = n;
      nodesLayer.appendChild(buildNode(n));
    });
    var dropped = 0;
    /* A new diagram is a new set of nets, so nothing carries over: the selection is
       cleared here rather than in every caller (Synthesize, drill, the bundle toggle). */
    clearNetSelection();
    invalidateFit();          // a new diagram has new bounds
    drawn = [];
    byNet = {};
    g.edges.forEach(function (e) {
      var from = byId[e.source], to = byId[e.target];
      var a = from && handlePoint(from, e.sourceHandle);
      var b = to && handlePoint(to, e.targetHandle);
      // React Flow silently drops an edge whose handle does not exist. Counting them
      // instead is the difference between a diagram that is missing wires and a
      // diagram that says so.
      if (!a || !b) { dropped++; return; }
      var pts = edgePoints(a, b);
      var thick = e.style && e.style.strokeWidth === 3;
      var d = roundedPath(pts, 8);
      var wire = svg('path', { class: 'pn-edge' + (thick ? ' bus' : ''), d: d });
      edgeLayer.appendChild(wire);
      /* No label is drawn until a net is asked for. The old behaviour labelled every
         edge, and on the 16-bit CPU that is 622 labels of which 69 landed inside a block
         - so the diagram was unreadable in exactly the places it mattered. */
      if (!e.label) return;
      /* A 1.5px line is not clickable, so every wire gets a transparent companion 12px
         wide. It lives in the same transformed <g>, so it pans and zooms with the wire it
         belongs to; `.pn-edges` stays pointer-events: none and only these re-enable it,
         which is what keeps a drag on the background panning. */
      var hit = svg('path', { class: 'pn-edge-hit', d: d });
      var title = svg('title', {});
      title.textContent = e.label;
      hit.appendChild(title);
      hit.addEventListener('click', function (ev) {
        if (ev.stopPropagation) ev.stopPropagation();   // or the background handler clears it
        if (suppressClick) { suppressClick = false; return; }
        selectNet(e.label, midOf(pts));
      });
      edgeLayer.appendChild(hit);
      var rec = { net: e.label, wire: wire, mid: midOf(pts) };
      drawn.push(rec);
      (byNet[e.label] || (byNet[e.label] = [])).push(rec);
    });
    if (dropped) synthLog('warn', dropped + ' net(s) could not be drawn: no such pin on the cell');
    placeholderEl.style.display = g.nodes.length ? 'none' : '';
    if (!g.nodes.length) {
      placeholderEl.textContent = reason
        ? 'Nothing to draw — ' + reason
        : 'Nothing synthesized yet - press Synthesize.';
    }
    sizeViewToGraph();                     // before the fit, which reads the box's height
    fitView();
  }

  /* ---- pan and zoom. The whole of the view state is {k, x, y}, and every gesture
     funnels into it - the same shape as the waveform's viewStart/viewEnd. Node
     dragging is deliberately absent, so a drag anywhere pans. ---- */
  var MIN_K = 0.05, MAX_K = 4;
  function zoomAbout(px, py, factor) {
    /* No gesture may show more empty space than Fit does - the buttons, the wheel and the
       pinch all come through here, so the viewer has ONE idea of how far out is too far.
       `Math.min(..., view.k)` is what keeps that a floor rather than a jump: a view already
       further out than Fit (a diagram that grew under it) is left where it is instead of
       being yanked inwards by a zoom-OUT click. MIN_K survives as the backstop for a graph
       with no bounds to fit. */
    var floor = Math.min(fitScale(), view.k);
    var k = Math.max(floor, Math.min(MAX_K, view.k * factor));
    if (k === view.k) return;
    view.x = px - (px - view.x) * (k / view.k);
    view.y = py - (py - view.y) * (k / view.k);
    view.k = k;
    applyTransform();
  }

  flowRoot.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = flowRoot.getBoundingClientRect();
    zoomAbout(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  });

  var drag = null;
  /* A wire's click handler fires after the pan's mouseup, so a drag that happened to
     start on a wire would select a net on release. Movement past a few pixels is what
     tells the two gestures apart, and the flag has to outlive the drag to be readable
     from the click. */
  var DRAG_SLOP = 3;
  var suppressClick = false;
  flowRoot.addEventListener('mousedown', function (e) {
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    flowRoot.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', function (e) {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) > DRAG_SLOP || Math.abs(e.clientY - drag.y) > DRAG_SLOP) {
      drag.moved = true;
    }
    view.x = drag.vx + (e.clientX - drag.x);
    view.y = drag.vy + (e.clientY - drag.y);
    applyTransform();
  });
  document.addEventListener('mouseup', function () {
    suppressClick = !!(drag && drag.moved);
    drag = null;
    flowRoot.style.cursor = '';
  });
  // A click on the background clears the selection, the way every editor does it.
  flowRoot.addEventListener('click', function () {
    if (suppressClick) { suppressClick = false; return; }
    clearNetSelection();
  });
  /* Escape clears it too. This shares the key with the exercise sheet, and the two cannot
     fight: practice.js's handler is registered first and only acts while the sheet is
     open, and a net can only be selected once the sheet has been dismissed. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && selectedNet) clearNetSelection();
  });

  var touch = null;
  function touchMid(t) {
    return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
  }
  function touchGap(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }
  flowRoot.addEventListener('touchstart', function (e) {
    var t = e.touches;
    if (t.length === 1) touch = { mode: 'pan', x: t[0].clientX, y: t[0].clientY, vx: view.x, vy: view.y };
    else if (t.length >= 2) touch = { mode: 'pinch', gap: touchGap(t), k: view.k, mid: touchMid(t) };
  });
  flowRoot.addEventListener('touchmove', function (e) {
    if (!touch) return;
    e.preventDefault();
    var t = e.touches;
    if (touch.mode === 'pan' && t.length === 1) {
      view.x = touch.vx + (t[0].clientX - touch.x);
      view.y = touch.vy + (t[0].clientY - touch.y);
      applyTransform();
    } else if (touch.mode === 'pinch' && t.length >= 2 && touch.gap > 0) {
      var r = flowRoot.getBoundingClientRect();
      // Zoom about the pinch's own midpoint, so a two-finger gesture does not also pan.
      zoomAbout(touch.mid.x - r.left, touch.mid.y - r.top,
                (touchGap(t) / touch.gap) * (touch.k / view.k));
    }
  });
  flowRoot.addEventListener('touchend', function () { touch = null; });
  window.addEventListener('resize', function () { invalidateFit(); fitView(); });

  /* =====================================================================
     7. when it runs
     ===================================================================== */

  /* Synthesis happens when Synthesize is pressed and at no other time - Run simulates
     and nothing else, which is why this button exists at all. Two consequences have to
     be handled rather than left implicit, both because one Console is shared:

     Run and Reset CLEAR that console, so whoever clears it owes the synthesis section
     again - otherwise the two cards would go on showing a netlist whose log had been
     silently wiped. These listeners are registered after app.js's and practice.js's,
     and a classic script's handlers fire in registration order, so the simulation
     output and the verdict pill are already written by the time this re-prints.

     And an edit makes the cards STALE rather than wrong: the netlist stays readable,
     with a band saying it no longer describes the editor. That is the shape
     Baerilog/compiler.html already uses for an invalidated compile, and the reason to
     keep the text on screen is that it is the thing being read. */
  /* Wrapped in app.js's own busy helper, the same one Run uses - so the two peers
     acknowledge a click identically, and there is one copy of the "no paint happens
     during blocking work, so hold the state long enough to see" reasoning rather than
     two. `syncSynthLabel` is handed in as the relabel, exactly as `syncRunLabel` is,
     because which words belong on this button is this file's business: it is the one
     that knows whether a netlist is on the page. */
  synthBtn.addEventListener('click', function () {
    withBusyButton(synthBtn, runSynthesis, syncSynthLabel);
  });

  /* ---- run the netlist ----------------------------------------------------------
     The netlist is SUBSTITUTED into the document, not pasted in front of the testbench.
     The generated text redefines the DUT and every sub-module it synthesized, so what is
     kept from the original is everything the netlist does NOT define - a rom, a ram
     model, the `system` wrapper, the testbench itself. That is what makes this work on a
     hierarchical design: cpu-16bit's testbench drives a `system` holding a ROM, a RAM and
     the CPU, only the CPU is synthesizable, and pasting a gate-level `cpu` in front of
     that leaves two top-level modules and will not elaborate. Substituting runs the
     gate-level core inside its own real environment.

     The rule is `test.py`'s, which has run netlists against these testbenches since the
     cards landed - so this button is a new entry point to a proven path rather than a new
     path. Memory images need no handling at all: $readmemh resolves against
     attachedMemFiles, which the page filled in at load. */
  function moduleSpans(src) {
    var out = [], re = /^module\s+(\w+)/gm, m;
    while ((m = re.exec(src)) !== null) {
      var e = src.indexOf('endmodule', m.index);
      if (e < 0) break;
      out.push({ name: m[1], start: m.index, end: e + 'endmodule'.length });
    }
    return out;
  }
  function gateLevelDocument() {
    var doc = currentFullSource();
    var defined = {};
    moduleSpans(netlistFullText).forEach(function (m) { defined[m.name] = true; });
    var kept = moduleSpans(doc).filter(function (m) { return !defined[m.name]; })
                               .map(function (m) { return doc.slice(m.start, m.end); });
    return { text: netlistFullText + '\n\n' + kept.join('\n\n') + '\n',
             swapped: Object.keys(defined).length, kept: kept.length };
  }
  function syncGateLabel() {
    var base = gateHasRun ? GATE_LABEL_AGAIN : GATE_LABEL_FRESH;
    gateBtn.textContent = gateBtn.hasAttribute('data-busy') ? busyLabel(base) : base;
  }
  function runGateLevel() {
    /* Refuses while stale rather than running the old netlist or silently
       re-synthesizing: the button says it runs what this card shows, and what the card
       shows is marked as no longer describing the design. Said in the Console, because
       that is where every other refusal on this page is said. */
    if (stale) {
      synthLog('err', 'the netlist is behind the design - press Synthesize before running it');
      renderSynthSection();
      return;
    }
    if (!netlistFullText) {
      synthLog('err', 'nothing synthesized yet - press Synthesize first');
      renderSynthSection();
      return;
    }
    var gate = gateLevelDocument();
    /* One set of panels, so a gate-level run REPLACES the behavioural one. What says so is
       the section rule `— gate-level simulation —`, which noteRun prepends below - it used
       to be a sentence logged here, and the rule says it better and in the same idiom as
       the synthesis section's. */
    runSimulation(gate.text);
    /* ORDER MATTERS HERE, and getting it wrong is what put the rule at the very top of the
       box with the synthesis log between it and its own output. Both noteRun and
       renderSynthSection insert at the TOP, so the later call ends up higher - which means
       this has to run in the same sequence the plain Run path gets for free from script
       load order: the run's own rule first, then the older synthesis section above it.

       The page's own post-run work comes with it - the verdict pill, the tab strip, the
       first-run unfold - called rather than duplicated, which is why practice.js exposes
       it: a gate-level run counts on this page exactly as a behavioural one does. */
    if (window.PRACTICE_API && window.PRACTICE_API.noteRun) {
      window.PRACTICE_API.noteRun('gate-level simulation',
        gate.swapped + ' module' + (gate.swapped === 1 ? '' : 's') + ' replaced by gates, '
        + gate.kept + ' kept from the document (testbench, memories)');
    }
    renderSynthSection(true);   // older than the run that just printed, so above it
    gateHasRun = true;
    syncGateLabel();
  }
  gateBtn.addEventListener('click', function () {
    withBusyButton(gateBtn, runGateLevel, syncGateLabel);
  });
  /* Above whatever the run just printed, because it is older than it. Reset takes the
     same path: it leaves the console holding its placeholder, and a synthesis that
     survives a Reset is still the older thing on the page. */
  ['runBtn', 'resetBtn'].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', function () { renderSynthSection(true); });
  });
  /* An edit does two independent things, and they need different tests. A successful
     synthesis becomes STALE (guarded on currentAll, since there has to be something to
     be stale). A FAILED one is retired outright - the label described text the reader
     has since changed, and `⚠︎ Error (Retry)` over a fixed design is the panel
     disagreeing with itself.

     Only codeInput, deliberately, where app.js's Run watches both editors: designOnly()
     cuts the document at the TESTBENCH marker before the synthesizer ever sees it, so
     editing the testbench cannot fix a synthesis error and must not claim to. */
  codeInput.addEventListener('input', function () {
    if (currentAll) markStale(true);
    if (synthFailed) { synthFailed = false; syncSynthLabel(); }
  });

  // Nothing is synthesized on load, for the reason nothing is simulated on load - and
  // here that means the two cards are not on the page at all yet. Pressing Synthesize
  // is what puts them there.
  markStale(false);

  // Named for the harness, which drives all of this without a browser.
  /* ---- a STATIC diagram, drawn anywhere on the page -----------------------------------
     The viewer above is a SINGLETON: flowRoot, pnNodes and pnEdgeG are captured once at
     setup, so renderGraph can only ever draw into that one card. A topic page wants a second
     diagram inside its prose as an illustration, and the reason to draw it with this code
     rather than as an SVG asset is that the shapes are GATE_DEFS and the colours are
     synth.css's tokens: the illustration cannot drift from the netlist the same page shows
     below it, and it is right in both colour modes for free.

     What it deliberately is NOT: no pan, no zoom, no net selection, no fit, and no
     touch-action - so the page keeps scrolling over it. And it touches none of the viewer's
     state (lastGraph, drawn, byNet, view, fitCache), which is what keeps a figure from
     disturbing the card. It draws once; nothing re-renders it.

     The container is sized to its CONTENT, since an illustration is as big as the thing it
     illustrates, and `.pn-nodes > .rf-node` is absolutely positioned so a container with no
     height would collapse to nothing - the same reason #flowRoot has one at all.

     What it RETURNS is the count of wires actually drawn, and that is the whole report an
     illustration needs: this geometry silently discards an edge naming a pin the node does not
     have, so a caller comparing `edges` against what it asked for is what turns a mistyped pin
     into a failure instead of a diagram quietly missing a wire. A separate `dropped` counter was
     written and removed - it can only ever move in lockstep with this one, so a mutant deleting
     it changed nothing, which is this repo's test for a field nothing can falsify. */
  function drawStatic(el, g) {
    var out = { nodes: 0, edges: 0, width: 0, height: 0 };
    if (!el || !g || !g.nodes || !g.nodes.length) return out;
    el.innerHTML = '';
    /* An INNER layer sized to the drawing, because `.pn-nodes` and `.pn-edges` are
       `position: absolute; inset: 0` - they fill their positioned ancestor, so with the
       container as that ancestor the content is pinned to its left edge whatever width the
       container has. A wrapper of exactly the content's width can then be centred by CSS
       (`margin: 0 auto`), which is what the figures want and what a per-figure x offset in the
       topic file was doing by hand - centred at one column width and off-centre at every
       other, with the box scrolling through the offset before reaching the first symbol. */
    var inner = mk('div', 'pn-static');
    el.appendChild(inner);
    var edges = document.createElementNS(SVG_NS, 'svg');
    edges.setAttribute('class', 'pn-edges');
    var edgeG = document.createElementNS(SVG_NS, 'g');
    edges.appendChild(edgeG);
    inner.appendChild(edges);
    var nodes = mk('div', 'pn-nodes');
    inner.appendChild(nodes);

    var byId = {}, x1 = 0, y1 = 0;
    g.nodes.forEach(function (n) {
      byId[n.id] = n;
      nodes.appendChild(buildNode(n));
      var sz = nodeSize(n);
      x1 = Math.max(x1, n.position.x + sz.width);
      y1 = Math.max(y1, n.position.y + sz.height);
    });
    g.edges.forEach(function (e) {
      var from = byId[e.source], to = byId[e.target];
      var a = from && handlePoint(from, e.sourceHandle);
      var b = to && handlePoint(to, e.targetHandle);
      if (!a || !b) return;          // no such pin: the caller's edge count is what says so
      edgeG.appendChild(svg('path', { class: 'pn-edge' + (e.bus ? ' bus' : ''),
                                      d: roundedPath(edgePoints(a, b), 8) }));
      out.edges++;
    });
    out.nodes = g.nodes.length;
    out.width = x1;
    out.height = y1;
    /* THE WRAPPER OWNS BOTH THE EXTENT AND THE HEIGHT, and the container is left to size itself
       in normal flow. Setting the container's height to the content's was wrong in a way only a
       browser could show: `box-sizing: border-box` is global here, so an inline height INCLUDES
       the padding and the border - a caller with 12px padding and a 1px border had 26px less
       content area than the drawing needed, and since `overflow-x: auto` forces `overflow-y` to
       `auto` the bottom of every figure was CLIPPED rather than spilling. Measured in Chrome:
       height 74, clientHeight 72, scrollHeight 98, with the captions and half an input port cut
       off. The wrapper still needs an explicit height, because everything inside it is absolutely
       positioned and it would otherwise collapse to nothing.

       `position: relative` INLINE, not left to a stylesheet. This wrapper's whole purpose is to
       be the positioning context - `.pn-nodes` and `.pn-edges` are `inset: 0` absolute, and a
       caller's overlays (a topic's symbol captions) are absolute too - so the one property
       everything inside depends on is set by the code that depends on it. Leaving it to a rule in
       another file is what broke the captions: they are children of this wrapper now, and when
       that rule was missing they positioned against the nearest positioned ancestor instead,
       which took them out of the figure entirely. */
    inner.style.position = 'relative';
    inner.style.width = x1 + 'px';
    inner.style.height = y1 + 'px';
    out.layer = inner;                 // where a caller may add its own absolute overlays
    return out;
  }

  window.PRACTICE_SYNTH_API = {
    runSynthesis: runSynthesis,
    /* Did the last synthesis - or the gate button - report a problem. Read off synthLines,
       the stored log, rather than off the console's rendered rows: the rows carry
       `class="err"` and a stub DOM does not parse injected markup, so a DOM test for it is
       invisible headlessly and therefore unfalsifiable. This also catches the gate-level
       button's two REFUSALS (stale netlist, nothing synthesized), which log and return
       without setting synthFailed at all. */
    hasError: function () {
      return synthLines.some(function (l) { return l.level === 'err'; });
    },
    /* For the Console's Clear button, and deliberately narrower than reset(): it drops the
       remembered log and the rows showing it, so a later Run cannot re-print what was just
       cleared - and leaves the netlist, the diagram and the cards alone, because Clear is
       the Console's control and not a Reset. */
    forgetLog: function () { dropPrintedSynthLines(); synthLines = []; },
    /* Back to never-synthesized, for practice.js's Reset. Built out of the functions
       that already own each piece rather than by re-clearing their variables: an eighth
       thing to forget is exactly how the "list of things true before a core is live"
       bug in the emulator happened. Note this is the one place a Reset DISCARDS the
       synthesis section rather than re-printing it - Run and Reset both re-print,
       because they clear a console whose synthesis half they do not own, whereas this
       is a return to a page where no synthesis ever happened. */
    reset: function () {
      synthLines = [];
      synthFailed = false;   // before showCards below, which is what rewrites the label
      dropPrintedSynthLines();
      clearNetlist('Nothing synthesized yet - press Synthesize.');
      markStale(false);
      clearNetSelection();
      showCards(false);      // takes the two tabs with it, and puts the verb back
    },
    designOnly: designOnly,
    /* The gate-level netlist the last synthesis produced, as TEXT. It has a second reader now: a
       topic page's placement figure places it, which is what makes that figure follow the Synthesize
       button rather than the file the page shipped with - an RTL design becomes cells here for the
       first time, and a structural one comes back as the cells it named. Empty before the first
       synthesis; the caller decides what to draw then, since this reports rather than substitutes.
       (A DUPLICATE of this entry was added for that reader before noticing this one existed. A
       repeated key is legal JavaScript and the last wins, so nothing broke - which is exactly why it
       took a mutant surviving to find it: the mutation hit the first copy and the second answered.) */
    netlistText: function () { return netlistFullText; },
    segments: function () { return netlistSegments.slice(); },
    graph: function () { return lastGraph; },
    isStale: function () { return stale; },
    selectedNet: function () { return selectedNet; },
    netSegments: function (net) { return (byNet[net] || []).length; },
    selectNet: selectNet,
    clearNetSelection: clearNetSelection,
    highlighted: function () {
      return drawn.filter(function (r) { return r.wire.classList.contains('sel'); })
                  .map(function (r) { return r.net; });
    },
    labelCount: function () {
      var n = 0;
      edgeLayer.children.forEach ? edgeLayer.children.forEach(function (c) {
        if (c.tagName === 'TEXT') n++;
      }) : Array.prototype.forEach.call(edgeLayer.children, function (c) {
        if (c.tagName === 'TEXT') n++;
      });
      return n;
    },
    syntheses: function () { return syntheses; },
    cardsShown: function () { return cardsShown; },
    subsetHints: subsetHints,
    synthLog: function () { return synthLines.slice(); },
    /* For a topic page's illustrations - see drawStatic's own note. Exported rather than
       inlined there so the figure and the card cannot end up drawing gates two ways. */
    drawStatic: drawStatic,
    nodeSize: nodeSize,
    handlePoint: handlePoint,
    edgePoints: edgePoints,
    view: function () { return { k: view.k, x: view.x, y: view.y }; },
    fitView: fitView,
    fitScale: fitScale,
    zoomStep: ZOOM_STEP,
    zoomAbout: zoomAbout,
    breadcrumb: function () { return viewStack.slice(); },
    drillInto: drillInto,
    hierGlyph: function () { return HIER_GLYPH; }
  };
})();
