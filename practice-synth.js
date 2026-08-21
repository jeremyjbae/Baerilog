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
  /* A THIRD CALLER, and it DECLARES itself rather than being detected. code2silicon.html is
     neither an exercise nor a topic - it has no manifest entry and no slug - so neither test
     above can see it, and without this it got no netlist cards at all: this file returned on
     its first line and the page was missing two of its eleven panels with nothing to say so.
     Widened rather than copied, which is the choice this guard already records for the learn
     pages; and a declaration rather than a sniff, which is the rule CLAUDE.md states for
     CLOUD_APP - a global that happens to exist today is not a statement of intent. */
  if (window.WANTS_SYNTH) wantsSynth = true;
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
    /* A BUFFER IS THE NOT TRIANGLE WITH THE BUBBLE GONE, AND ITS OUTPUT STUB HAS TO MOVE BACK WITH
       IT. `not`'s stub starts at 67 because that is exactly where its bubble ends (cx 61, r 6), so
       the two touch; the triangle's own apex is back at 57.5. Delete the bubble and leave the stub
       where it was, and what is drawn is a tip with a 9.5-unit gap and then a floating dash - which
       at 16px reads as a symbol whose output is not connected to anything. So the stub runs from the
       apex, and `40` rather than the input's `40.5` because that is the y the body's own `L57.5,40`
       lands on: half a unit off and the join shows a step at this size.

       Nothing about the wires moves - `handleSpecs` puts a unary gate's `y` at the middle of the
       box's right edge, which is where the stub already ended. This is the drawing only.

       `dffnr` is the same situation handled the other way, and worth reading beside this: there the
       bubble's pin goes away entirely, so the stub is DELETED along with it. Here the pin is the
       output and has to stay. */
    buf: { viewBox: '0 13 75 54', body: GATE_NOT_D, stubs: [[0, 40.5, 16, 40.5], [57.5, 40, 74, 40]] },
    /* THE SELECT COMES IN FROM THE TOP, where the data inputs stay on the left. Three pins stacked
       down one edge says nothing about which of them chooses and which are chosen; a mux drawn with
       `sel` on the top edge is the convention every schematic uses, and it reads the way the sentence
       does - two values in from the left, one control from above, one value out. `a` and `b` keep the
       fractions they had, so nothing else about the symbol or its wires moves. The stub is vertical at
       x=27.5, half the canvas width, and stops ON the slanted top edge (y = 2.5 + 0.75 * 7.5), so the
       body's own fill covers the end of it the way the left-edge stubs are covered.
       `a` and `b` are SYMMETRIC about the body's centre now, at 17.5 and 47.5 either side of
       32.5 - which are also the heights of the output edge's two corners. They used to be two of
       THREE evenly spaced stubs (8.808, 32.808, 56.808), symmetric only as a set of three, so with
       sel gone one input sat on the centre line and the other near the bottom corner. Byte-identical to
       synthesis.html's copy, which tools/check_theme.py asserts. */
    mux2: { viewBox: '0 0 55 65', body: 'M 20 2.5 L 40 17.5 L 40 47.5 L 20 62.5 Z', stubs: [[27.5, 0, 27.5, 8.125], [0, 17.5, 20, 17.5], [0, 47.5, 20, 47.5], [40, 32.5, 55, 32.5]] },
    add: {
      viewBox: '0 0 65 95',
      body: 'M 20 0 L 50 15 L 50 60 L 20 80 L 20 50 L 30 40 L 20 30 Z',
      /* cin comes off the BOTTOM edge at its midpoint (35, 70) - the way a flip-flop's clock
         does - and the canvas is 15 units taller than the body for exactly that stub's room: a
         bottom pin's wire lands on the canvas edge, so a stub stopping short of it would start
         the wire in mid-air. cout is the UPPER output now and sum the lower one, which is the
         order the engine's own portOrder for an adder already uses. */
      stubs: [[0, 15, 20, 15], [0, 65, 20, 65], [35, 70, 35, 95], [50, 30, 65, 30], [50, 50, 65, 50]],
      extra: 'M 40 35 L 40 45 M 45 40 L 35 40',
      scale: 2
    },
    sub: {
      viewBox: '0 0 65 95',
      body: 'M 20 0 L 50 15 L 50 60 L 20 80 L 20 50 L 30 40 L 20 30 Z',
      /* cin comes off the BOTTOM edge at its midpoint (35, 70) - the way a flip-flop's clock
         does - and the canvas is 15 units taller than the body for exactly that stub's room: a
         bottom pin's wire lands on the canvas edge, so a stub stopping short of it would start
         the wire in mid-air. cout is the UPPER output now and sum the lower one, which is the
         order the engine's own portOrder for an adder already uses. */
      stubs: [[0, 15, 20, 15], [0, 65, 20, 65], [35, 70, 35, 95], [50, 30, 65, 30], [50, 50, 65, 50]],
      extra: 'M 45 40 L 35 40',
      scale: 2
    },
    /* The same two with NO CARRY IN, for an adder whose `cin` is tied to 0 - which is what
       `assign s = a + b;` gives, a pin the design never named with a `1'b0` hanging off it. See the
       engine's dropInertPins. The viewBox is deliberately UNCHANGED at 95 tall even though the body
       ends at 80: every other pin is a fraction of that height, so shrinking the canvas to the body
       would move a, b, cout and sum. Only the bottom stub goes. `subnc` is unreachable today - a
       subtractor's carry in is tied to 1, the two's-complement increment, and stays drawn - and
       exists so the renderer's key cannot resolve to nothing if one ever appears. Byte-identical to
       synthesis.html's copies, which tools/check_theme.py asserts. */
    addnc: {
      viewBox: '0 0 65 95',
      body: 'M 20 0 L 50 15 L 50 60 L 20 80 L 20 50 L 30 40 L 20 30 Z',
      stubs: [[0, 15, 20, 15], [0, 65, 20, 65], [50, 30, 65, 30], [50, 50, 65, 50]],
      extra: 'M 40 35 L 40 45 M 45 40 L 35 40',
      scale: 2
    },
    subnc: {
      viewBox: '0 0 65 95',
      body: 'M 20 0 L 50 15 L 50 60 L 20 80 L 20 50 L 30 40 L 20 30 Z',
      stubs: [[0, 15, 20, 15], [0, 65, 20, 65], [50, 30, 65, 30], [50, 50, 65, 50]],
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
    },
    /* The same flip-flop with no reset, for one whose `rstn` is tied de-asserted - a synchronous
       reset, or no reset at all. See the engine's dropTiedResets: the pin, its wire and the constant
       that drove it come off together, and this is the symbol that goes with them. Same viewBox, same
       body, same clock notch, and `d`, `clk` and `q` on the same three fractions - only the bubbled
       stub and the bubble are gone, so swapping this in for `dff` cannot move a wire that is still
       there. Byte-identical to synthesis.html's copy, which tools/check_theme.py asserts. */
    dffnr: {
      viewBox: '0 0 90 90',
      body: 'M 24 10 L 70 10 L 70 80 L 24 80 Z',
      stubs: [[0, 30, 24, 30], [40, 80, 40, 90], [70, 30, 90, 30]],
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
      case 'dff': return GATE_DEFS[n.data.noReset ? 'dffnr' : 'dff'];
      case 'fa': case 'adder': return GATE_DEFS[(n.data.op === 'sub' ? 'sub' : 'add') + (n.data.noCarry ? 'nc' : '')];
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
        /* No `rstn` handle on a flip-flop drawn without the pin: a handle with no stub under it is a
           wire landing where nothing is drawn. The engine's dropTiedResets has already taken the edge
           off, so nothing asks for it. */
        out.d = ['l', 1 / 3];
        if (!n.data.noReset) out.rstn = ['l', 2 / 3];
        out.clk = ['b', 0.4444]; out.q = ['r', 1 / 3];
        return out;
      case 'fa': case 'adder':
        /* Written as the symbol's own coordinates over its viewBox height rather than as
           decimals, because that is where they come from - `synthesis/symbol/add.svg`'s five
           red pin markers - and a fraction cannot then be updated without the drawing. cin is
           the one on the BOTTOM edge, at 35 of 65 across; cout is the upper output and sum the
           lower one, which is the order the engine's portOrder for an adder already uses. */
        out.a = ['l', 15 / 95]; out.b = ['l', 65 / 95];
        /* No `cin` handle on an adder drawn without the pin - see its symbol. The engine's
           dropInertPins has already taken the edge off, so nothing asks for it. */
        if (!n.data.noCarry) out.cin = ['b', 35 / 65];
        out.cout = ['r', 30 / 95]; out.sum = ['r', 50 / 95];
        return out;
      case 'mux2':
        /* `sel` is on the TOP edge - see the note on its symbol. `['t', f]` is the fourth side the
           handle table can name, and handlePoint had only three: a wire into one is led 22px ABOVE
           the pin and comes straight down, the mirror of what a bottom pin already did. */
        out.sel = ['t', 0.5]; out.a = ['l', 17.5 / 65]; out.b = ['l', 47.5 / 65]; out.y = ['r', 0.5];
        return out;
      case 'const': out.y = ['r', 0.5]; return out;
      case 'instance':
        n.data.inSlots.forEach(function (s, i) { out[s.id] = ['l', (i + 1) / (n.data.inSlots.length + 1)]; });
        n.data.outSlots.forEach(function (s, i) { out[s.id] = ['r', (i + 1) / (n.data.outSlots.length + 1)]; });
        return out;
      default: return out;
    }
  }

  /* The SIDE comes back with the point, because the router needs it and nothing else has it: a
     wire has to leave a pin the way the pin points, and only handleSpecs knows which edge that is.
     Two extra characters per branch here save passing the side through both edge builders. */
  function handlePoint(n, id) {
    var spec = handleSpecs(n)[id];
    if (!spec) return null;
    var sz = nodeSize(n), p = n.position;
    if (spec[0] === 'l') return { x: p.x, y: p.y + sz.height * spec[1], side: 'l' };
    if (spec[0] === 'r') return { x: p.x + sz.width, y: p.y + sz.height * spec[1], side: 'r' };
    if (spec[0] === 't') return { x: p.x + sz.width * spec[1], y: p.y, side: 't' };
    return { x: p.x + sz.width * spec[1], y: p.y + sz.height, side: 'b' };
  }

  /* =====================================================================
     2. state
     ===================================================================== */

  var currentAll = null;          // last synthesizeAll() result
  var viewStack = [];             // breadcrumb: module names, top down to the viewed one
  var lastGraph = { nodes: [], edges: [] };
  var netlistFullText = '';
  /* THE AREA REPORT IS THIS CARD'S, NOT THE CONSOLE'S. It used to be one `info` row in the
     simulator's console; the card that now offers it is its single home, because the same
     numbers in two panels is exactly what this file removed the viewer's node/net count for
     - two readings of nearly one question, disagreeing with nothing on the page to explain
     it. The Console keeps what only it can say: the parse and elaboration messages, which
     top module was synthesized, and whether the design was already a netlist. */
  var areaReportText = '';
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
    // log view on each one would be work nobody asked for.
    if (moved && synthLines.length) renderLogView();
  }

  /* localStorage keys are deliberately NOT synthesis.html's own
     (netlistBundleMultibit, netlistHeight, netlistExpanded): both apps live on one
     origin, so sharing a key would let a control set here silently change that app
     and vice versa - the trap CLAUDE.md records for the Scoreboard's checkbox.
     Every one of them is honoured in both directions for the same reason. */
  var K_BUNDLE = 'practiceNetlistBundle';
  var K_HEIGHT = 'practiceNetlistHeight';
  var K_VIEW_HEIGHT = 'practiceNetlistViewHeight';
  /* THE CARD'S VIEW, and the STORED CHOICE IS HONOURED IN BOTH DIRECTIONS: `=== 'netlist'`
     reads a missing key as the default and a deliberate pick of either view comes back as
     itself. The form that only ever turns one of two states on is the bug this repo records
     for the Scoreboard's checkbox and for `compilerLang`.

     Declared up here with the other keys rather than beside the functions that use it,
     because the wiring block below reads it and a `var` declared further down reads
     `undefined` there - the hoisting trap this file already paid for twice. */
  /* The diagram is where a successful synthesis lands, so it is also where the card starts. Not
     read from storage - see setResultsView for why a stored view stopped meaning anything. */
  var resultsView = 'diagram';
  /* Set by showCards for a design that was ALREADY a netlist. It suppresses the listing
     without touching `resultsView`, so a reader who prefers the netlist gets it back the
     moment they edit the design into something that is actually synthesized. */
  var listingSuppressed = false;

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

  /* `extra` lands BETWEEN the (?) icon and `.header-controls`, which is where
     Baerilog/synthesis.html's markup puts the same node and where compiler.html puts its
     frontend radios: `.header-controls` keeps its margin-left:auto, so anything before it
     sits left-adjacent to the title with no layout of its own. */
  function cardHead(title, helpLines, controls, extra) {
    var h = document.createElement('h2');
    var collapse = mk('span', 'card-collapse-btn');
    collapse.setAttribute('data-collapse', '');
    collapse.textContent = '▾';
    h.appendChild(collapse);
    h.appendChild(document.createTextNode(title));
    h.appendChild(help(helpLines));
    if (extra) h.appendChild(extra);
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
    var g2 = mk('span', 'layout-toggle', 'codeOutHierarchyGroup');
    var hierBtn = mk('span', 'layout-btn', 'codeOutHierarchyToggleBtn');
    hierBtn.setAttribute('title', 'Show/hide module hierarchy');
    hierBtn.innerHTML = HIER_GLYPH;
    g2.appendChild(hierBtn);
    controls.appendChild(g2);
    /* THE EXPAND IS THE CARD'S NOW, not the viewer row's - one width control for one card, and it
       serves the two text panels as well, which are `pre` boxes that scroll sideways in a grid
       cell. Same measured bleed, same per-app key; only the element it toggles moved. */
    var g3 = mk('span', 'layout-toggle');
    var expand = mk('span', 'layout-btn', 'netlistExpandBtn');
    expand.setAttribute('title', 'Expand to the full browser width');
    expand.innerHTML = '<svg viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1 V11 M15 1 V11"/><path d="M4.5 6 H11.5 M6.5 3.8 L4.3 6 L6.5 8.2 M9.5 3.8 L11.7 6 L9.5 8.2"/></svg>';
    g3.appendChild(expand);
    controls.appendChild(g3);

    /* TWO VIEWS OF ONE SYNTHESIS, chosen by a radio pair on the heading - the same card
       Baerilog/synthesis.html carries, down to the classes, which reach this page through
       synth.css. On the heading because they name what the card HOLDS, where the toolbar
       below the editor names what the page does; two radios rather than a checkbox because
       neither view is a modifier of the other. Synthesis Log is the default for now: it is the
       answer
       to "what did that cost", which is the question a learner has about a design they have
       just written, where the netlist text is what you read when you want to check a cell. */
    var views = mk('span', 'view-group');
    /* NAMED FOR THE ARTEFACT, not for the widget: `Synthesis Log` is where a synthesis says what
       it did (and, under that, what the design costs), `Gate-level Verilog` is the netlist as text.
       A third radio, `Diagram`, joins them when the Netlist Viewer card merges into this one -
       which is why the internal values stay `area`/`netlist` for now rather than churning every
       reader of them twice. */
    [['viewDiagramRadio', 'diagram', 'Diagram'],
     ['viewAreaRadio', 'area', 'Synthesis Log'],
     ['viewNetlistRadio', 'netlist', 'Gate-level Verilog']].forEach(function (v) {
      var lab = mk('label', 'view-toggle' + (v[1] === 'diagram' ? ' on' : ''));
      lab.setAttribute('for', v[0]);
      var r = mk('input', null, v[0]);
      r.setAttribute('type', 'radio');
      r.type = 'radio';
      r.setAttribute('name', 'synthView');
      r.setAttribute('value', v[1]);
      r.value = v[1];
      if (v[1] === 'diagram') r.checked = true;
      lab.appendChild(r);
      var t = mk('span');
      t.textContent = v[2];
      lab.appendChild(t);
      views.appendChild(lab);
    });

    card.appendChild(cardHead('Synthesis Results', [
      'Diagram - the same design as blocks and wires: drag to pan, scroll or pinch to zoom, '
        + 'and the zoom buttons step about the centre while fit brings the whole thing back',
      'click a wire to name its net and light every segment of it, or a symbol to light what it '
        + 'is wired to - inputs pink, outputs accent; Escape or a background click clears it',
      'double-click a sub-module block to drill into its own netlist; the breadcrumb comes back out',
      'bundle multi-bit logic collapses same-width cell chains into one N-bit box',
      'Synthesis Log - what the synthesis did, and what the design costs in cells: a '
        + 'per-module table, a count per gate type, and an approximate area in 2-input NAND '
        + 'equivalents',
      'Gate-level Verilog - the same design as gates: a top module instantiating primitive '
        + 'cells, then the behavioural definition of each cell it used',
      'the testbench is not synthesized - everything below the TESTBENCH marker is dropped '
        + 'first, which is exactly what the Testbench Editor holds',
      'the netlist is read-only, and both are regenerated on every Synthesize: edit the '
        + 'design above, not this'
    ], controls, views));

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
    /* ONE PRE PER VIEW, shown one at a time, with the module list going along with the
       netlist it slices - it picks which module's TEXT to show, which is not a question
       about an area report, so the whole row goes rather than leaving a panel beside a
       report it cannot act on. */
    /* The three panels, in the order the radios read: the diagram first, since it is the default
       and the thing a reader looks at. */
    card.appendChild(buildDiagramPanel());
    var areaPre = mk('pre', 'code-out', 'areaOut');
    card.appendChild(areaPre);
    row.style.display = 'none';
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
    var runGate = mk('div', 'toolbar', 'gateRunRow');
    runGate.style.marginTop = '12px';
    runGate.style.marginBottom = '0';
    var b = mk('button', 'btn', 'gateRunBtn');
    b.setAttribute('type', 'button');
    b.textContent = GATE_LABEL_FRESH;
    runGate.appendChild(b);
    card.appendChild(runGate);
    return card;
  }

  /* ---- THE DIAGRAM IS A PANEL OF THE SYNTHESIS RESULTS CARD, not a card of its own ----
     It was `card-netlist-view` in a `split-row` below the netlist card, which made two cards for
     one synthesis: the same design as a picture and as text, each with its own head, its own
     height buttons and its own stale band. It is the third VIEW of one card now, chosen by the
     radio beside the other two, so the card's header carries one height pair, one expand and one
     stale band for whichever of the three is up.

     What comes with it unchanged is everything inside: the toolbar (breadcrumb, net readout,
     bundle checkbox, zoom trio), `#flowRoot` and its three layers, and the legend. Nothing about
     the viewer's own code moves, which is what keeps this a re-arrangement rather than a rewrite. */
  function buildDiagramPanel() {
    var panel = mk('div', null, 'netlistDiagramPanel');

    var bar = mk('div', 'toolbar');
    bar.style.marginBottom = '8px';
    var crumbs = mk('div', 'breadcrumb-row', 'breadcrumbRow');
    crumbs.style.flex = '1 1 auto';
    crumbs.style.marginBottom = '0';
    bar.appendChild(crumbs);
    var netSel = mk('span', 'pn-net-readout', 'netlistSelectedNet');
    netSel.style.display = 'none';
    bar.appendChild(netSel);
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
    panel.appendChild(bar);

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
    /* THE SELECTED NET'S LABEL GETS A LAYER OF ITS OWN, ABOVE THE NODES. It used to be
       appended to the edge layer, which is deliberately UNDER `.pn-nodes` so that no wire
       crosses a symbol - so the one label this viewer draws was painted behind the very
       symbols it runs between and simply vanished on a long name. See the rule in
       synthesis.html's additions, which is where the CSS for both viewers lives. */
    var labels = document.createElementNS(SVG_NS, 'svg');
    labels.setAttribute('class', 'pn-labels');
    labels.id = 'pnLabels';
    var labelG = document.createElementNS(SVG_NS, 'g');
    labelG.id = 'pnLabelG';
    labels.appendChild(labelG);
    root.appendChild(labels);
    var placeholder = mk('div', 'flow-placeholder', 'flowPlaceholder');
    placeholder.textContent = 'Nothing synthesized yet - press Synthesize.';
    root.appendChild(placeholder);
    panel.appendChild(root);

    /* Seven entries, not synthesis.html's nine. Its legend dots are nine literal iOS
       colours from before the Primer conversion, and its own .rf-node rules no longer
       paint them - several kinds now share one token, so nine rows would name
       distinctions that are not on the screen. Each row here names everything drawn in
       that colour, and the colours are the tokens the shapes actually use - which is why
       the output port and the mux are two rows: the port took --port-out-fg, and they were
       one row for as long as they shared amber. */
    var legend = mk('div', 'legend-row');
    /* SIX ROWS, ALL SYMBOLS: the two that named the SELECTION colours as short wire swatches are
       gone, here and in synthesis.html's markup together - a legend of eleven rows is one nobody
       reads, and a selection explains itself at the moment it happens in a way a resting legend
       cannot (the readout names the lit net and colours its input half, and the pin labels carry
       the direction). So this row says what the SHAPES mean, which is what is true before a click.
       The `kind` column is kept, since it is what said `dot` against `wireswatch`, and every row
       is a dot now. Same rows, same wording, as synthesis.html's legend. */
    /* SEVEN NOW, AND THE SUB-MODULE IS WHAT SPLIT OFF. It shared accent with `gate, dff`, so
       that row named a collision rather than resolving it - which is what --port-out-fg was added
       to stop when the output port shared amber with the mux. Same rows, same wording, same
       order as synthesis.html's legend; tools/check_theme.py compares the two. */
    [['--success-fg', 'input port', 'dot'],
     ['--port-out-fg', 'output port', 'dot'],
     ['--attention-fg', 'mux', 'dot'],
     ['--accent-fg', 'gate, dff', 'dot'],
     ['--node-sub-fg', 'sub-module', 'dot'],
     ['--danger-fg', 'adder / subtractor', 'dot'],
     ['--fg-muted', 'constant', 'dot']].forEach(function (pair) {
      var item = mk('div', 'legend-item');
      var dot = mk('span', pair[2]);
      dot.style.background = 'var(' + pair[0] + ')';
      item.appendChild(dot);
      item.appendChild(document.createTextNode(pair[1]));
      legend.appendChild(item);
    });
    panel.appendChild(legend);
    return panel;
  }

  var grid = document.querySelector('.grid');
  var waveRow = document.getElementById('waveSplitRow');
  if (!grid) return;
  var netlistCard = buildNetlistCard();
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
  /* Both cards start HIDDEN and are revealed only by a synthesis that succeeded. That
     is what lets the flag go on a page whose design the synthesizer cannot handle at
     all - eight of the eighteen - without putting an error panel under every learner's
     waveform: press Synthesize there and the Console says what it could not do, while
     the cards simply never appear. So "the cards are on screen" means "a successful
     synthesis is on screen", and a later failure takes them away again. */
  netlistCard.style.display = 'none';

  var codeOut = document.getElementById('codeOut');
  var codeOutPanel = document.getElementById('codeOutHierarchyPanel');
  var codeOutRow = document.getElementById('codeOutHierarchyRow');
  var areaOut = document.getElementById('areaOut');
  var codeOutGroup = document.getElementById('codeOutHierarchyGroup');
  var netlistEmpty = document.getElementById('netlistEmpty');
  // built inside buildNetlistCard, so resolved here like every other element of it
  var gateBtn = document.getElementById('gateRunBtn');
  var netlistStale = document.getElementById('netlistStale');
  var viewerStale = document.getElementById('viewerStale');
  var flowRoot = document.getElementById('flowRoot');
  var nodesLayer = document.getElementById('pnNodes');
  var edgeLayer = document.getElementById('pnEdgeG');
  var labelLayer = document.getElementById('pnLabelG');
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

  /* app.js wires [data-collapse] and .help-icon with querySelectorAll AT LOAD, and this card
     did not exist then - this file runs after it. It used to re-attach both handlers here, a
     copy of app.js's; they are one function there now (`wireCardControls`), because
     code2silicon.js appends two more cards and would have been a third copy. */
  /* THE BARE BINDING, not `window.wireCardControls`: a classic script sees the top-level
     declarations of the ones before it, which is how this file already reaches app.js's
     `logLine` and `editorFullSource` - and it is the only form that works under the harness,
     which evaluates app.js into a function scope where a declaration is just a local.
     `typeof` on an undeclared identifier is safe, so the guard costs nothing where app.js is
     absent. */
  if (typeof wireCardControls === 'function') wireCardControls(netlistCard);

  // Same constants as app.js's own height controls, so every panel on the page
  // steps by the same amount.
  /* `el` may be a LIST, which this card needs: its two views are two panels sharing one
     pair of buttons and one stored number. The measurement has to come from whichever is
     VISIBLE - getBoundingClientRect().height is 0 on a display:none element, so measuring
     the wrong one would clamp the box to MIN on the first press in the other view - and the
     result is written to both, so switching view leaves the box the size the reader chose
     with nothing to re-apply on reveal. */
  function wireHeight(key, el, dec, inc, after, when) {
    var MIN = 200, MAX = 1000, STEP = 80;
    var els = Object.prototype.toString.call(el) === '[object Array]' ? el : [el];
    var saved = parseInt(localStorage.getItem(key), 10);
    if (!isNaN(saved)) els.forEach(function (e) { e.style.height = saved + 'px'; });
    function adjust(delta) {
      var shown = els.filter(function (e) { return e.style.display !== 'none'; })[0] || els[0];
      var now = shown.getBoundingClientRect().height || parseInt(shown.style.height, 10) || MIN;
      var next = Math.max(MIN, Math.min(MAX, now + delta));
      els.forEach(function (e) { e.style.height = next + 'px'; });
      localStorage.setItem(key, next);
      if (after) after();
    }
    dec.addEventListener('click', function () { if (!when || when()) adjust(-STEP); });
    inc.addEventListener('click', function () { if (!when || when()) adjust(STEP); });
  }
  /* ONE HEIGHT PAIR FOR THREE PANELS, acting on whichever is up - the card has one header now.
     Two keys rather than one, because a `pre` of text and a drawing are not the same box and a
     reader's choice for one is not a claim about the other; and the diagram's own change has to
     refit, the obligation every container-size change here carries. */
  (function () {
    var dec = document.getElementById('netlistHeightDec');
    var inc = document.getElementById('netlistHeightInc');
    wireHeight(K_HEIGHT, [areaOut, codeOut], dec, inc, null,
               function () { return resultsView !== 'diagram'; });
    wireHeight(K_VIEW_HEIGHT, flowRoot, dec, inc,
               function () { viewHeightPinned = true; invalidateFit(); fitView(); },
               function () { return resultsView === 'diagram'; });
  })();
  /* The empty box starts small too, not only once something has been rendered into it: a
     page that has never synthesized never reaches renderGraph, so without this the first
     thing the reader sees is the 520px synth.css gives it. Set DIRECTLY rather than through
     sizeViewToGraph(), which reads `lastGraph` - a `var` declared hundreds of lines below
     and therefore still undefined here, so the call did nothing at all. */
  flowRoot.style.height = VIEW_EMPTY_H + 'px';

  (function () {
    ['viewDiagramRadio', 'viewAreaRadio', 'viewNetlistRadio'].forEach(function (id) {
      var r = document.getElementById(id);
      if (r) r.addEventListener('change', function (ev) { setResultsView(ev.target.value); });
    });
    syncResultsView();
  })();

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
    var row = netlistCard;          // the card, since the viewer's own row is gone
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

  /* COPY AND SAVE ACT ON WHAT IS ON SCREEN, in both directions - a button that silently
     hands back the other view's text is the header describing something not displayed. The
     report saves as a .txt because it is prose in columns rather than Verilog; naming it .v
     would invite feeding it to a tool. */
  function resultsText() {
    if (resultsView === 'diagram') return '';        // a picture has no text to hand back
    return (resultsView === 'netlist' && !listingSuppressed) ? netlistFullText : logViewText();
  }
  /* THE DIAGRAM'S SAVE WRITES THE SVG, which is what the viewer's own Export SVG button used to
     do - one control per card that writes a file, and its target follows the view like Copy's.
     The builder behind it is untouched: `window.__netlistSvg` is the seam, and everything it
     states about resolving tokens and including the wires in its bounds still holds. */
  function saveTarget() {
    if (resultsView === 'diagram') {
      var svg = typeof window.__netlistSvg === 'function' ? window.__netlistSvg() : '';
      return { text: svg, ext: '_netlist.svg', mime: 'image/svg+xml' };
    }
    var netlist = resultsView === 'netlist' && !listingSuppressed;
    return { text: resultsText(), ext: netlist ? '_netlist.v' : '_synthesis.txt',
             mime: 'text/plain' };
  }
  document.getElementById('netlistCopyBtn').addEventListener('click', function () {
    var ta = document.createElement('textarea');
    ta.value = resultsText();
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
  document.getElementById('netlistSaveBtn').addEventListener('click', function () {
    var t = saveTarget();
    if (!t.text) return;
    var blob = new Blob([t.text], { type: t.mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    /* PRACTICE_META is shell.js's, built from PRACTICE_SLUG - which a learn page does not
       declare, so there its slug is undefined and this would offer `undefined_netlist.v`. */
    var stem = (PRACTICE_META && PRACTICE_META.slug) || window.LEARN_SLUG || 'netlist';
    a.download = stem + t.ext;
    a.click();
    URL.revokeObjectURL(url);
  });

  /* Two more tabs, and they follow the cards rather than the page: a tab pointing at a
     hidden card is the dead control practice.js's strip is built to avoid, and these
     cards are hidden until a synthesis succeeds. practice.js rebuilds only its own tabs
     (inserting them before whatever is already there), so these two can be added and
     removed independently and always sit at the end. */
  var synthTabs = [];
  /* ONE TAB, since there is one card: the viewer became this card's Diagram view, so a `Viewer`
     tab would point at a card that no longer exists - the dead control practice.js's strip is
     built to avoid. */
  var tabsSuppressed = false;
  function syncSynthTabs(show) {
    var strip = document.getElementById('exTabs');
    if (!strip) return;
    if (tabsSuppressed) show = false;
    /* A FLOW STRIP IS NOT A TABLE OF CONTENTS, so a page carrying one gets no tab from here.
       Declared by the page's own builder rather than detected, the rule CLOUD_APP already
       follows: code2silicon.html calls suppressTabs() explicitly, and practice.js cannot -
       it runs BEFORE this file, so PRACTICE_SYNTH_API does not exist yet when it would have
       to. It sets the flag instead, which is readable whenever this happens to run. */
    if (window.FLOW_STRIP) show = false;
    if (!show) {
      synthTabs.forEach(function (b) { b.remove(); });
      synthTabs = [];
      return;
    }
    if (synthTabs.length) return;
    /* `Synthesis Results` rather than `Netlist`, because that is what the card is called and
       the tab is a pointer at a card. It is read off the heading in the four menu apps
       (tools/tabstrip.js has no override for this card any more); here the strip's labels are
       a literal table, so this is where the same name is written. */
    [['tabNetlist', 'Synthesis Results', 'code', 'card-netlist']]
      .forEach(function (t) {
      var b = mk('button', 'gh-tab', t[0]);
      b.setAttribute('type', 'button');
      b.innerHTML = ((typeof ICON !== 'undefined' && ICON[t[2]]) || '') + '<span>' + t[1] + '</span>';
      b.addEventListener('click', function () {
        strip.querySelectorAll('.gh-tab').forEach(function (o) { o.classList.remove('selected'); });
        b.classList.add('selected');
        var card = document.getElementById(t[3]);
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
        // the page head is sticky, so the card would land behind it - practice.js owns the
        // measurement, since these two tabs and its own six scroll the same way
        if (window.PRACTICE_API && window.PRACTICE_API.clearStickyOverlap) {
          window.PRACTICE_API.clearStickyOverlap();
        }
      });
      /* BEFORE the strip's ACTIONS GROUP, not appended to the strip. Exercise and Reset are
         pushed right by `margin-left: auto` on the group, and an auto margin absorbs the
         space before its own item - it does not hold anything appended afterwards back. So
         appending here would put the netlist pair to the right of both on every successful
         synthesis, which is exactly the "rightmost" they are meant to be. Inserting keeps
         DOM order, keyboard order and visual order in agreement.

         Pinned on the GROUP rather than on PRACTICE_API.resetButton(), which is a child of
         it: `parentElement === strip` is false for a child, so pinning there would fall
         silently through to the append and reintroduce the bug this comment is about. */
      var pin = (window.PRACTICE_API && window.PRACTICE_API.stripActions
                 && window.PRACTICE_API.stripActions()) || null;
      if (pin && pin.parentElement === strip) strip.insertBefore(b, pin);
      else strip.appendChild(b);
      synthTabs.push(b);
    });
  }

  /* The cards and their tabs move together, and the fit has to happen AFTER they are
     visible: #flowRoot has no width while it is display:none, so a fit computed then
     would place every node against a fallback width and the first thing the reader sees
     would be a badly framed diagram. */
  /* WHAT THE LOG VIEW HOLDS WHEN THERE IS NO REPORT TO SHOW: the error, and the subset hint if
     the design tripped a documented gap rather than a mistake. The Console still carries the full
     log; this is the answer to "why is there no netlist" on the card that would have held one. */
  function failReport(msg, hints) {
    var lines = ['Synthesis failed.', '', msg];
    (hints || []).forEach(function (gap) {
      lines.push('', 'This design uses ' + gap + ', which the synthesizer\'s subset does not '
                   + 'cover - the simulator above does.');
    });
    areaReportText = lines.join('\n');
    renderLogView();
    resultsView = 'area';        // forced: a Diagram of nothing is what a failure means
  }

  /* A PAGE MAY PIN THE CARD ON SCREEN, and a learn topic does: `learn.js` moves the one
     Synthesize button into this card, so hiding it would leave a topic with no way to synthesize
     at all - on the first press and after every failure. It was accidental before (the viewer card
     had been moved out of the row that got hidden); a flag makes it one owner's decision rather
     than two writers racing over `style.display`. */
  var cardsPinned = false;

  function showCards(on) {
    cardsShown = !!on;
    /* THE LISTING IS SUPPRESSED FOR A DESIGN THAT WAS ALREADY A NETLIST - the listing, not
       the card. A view headed "Gate-level Netlist" over a design that instantiated its cells
       by hand is showing the reader their own source back under a heading claiming it was
       produced. What the card offers instead is the AREA REPORT, which is a real answer about
       a structural design: those cells cost what they cost, and the Console says in the same
       breath that nothing was inferred. That is why this stopped hiding the whole card, which
       it did while the netlist was all the card held - hiding it now would take the report off
       the page with the listing.

       Derived per synthesis from the result, so an edit from an instantiation to an operator
       brings the listing back with nothing to keep in step. ONE THING GOES WITH IT: the
       gate-level Run at the bottom of the card, which on a structural design would re-run the
       very modules the simulator just ran - the netlist and the source are the same modules.
       syncResultsView owns both, and it leaves `resultsView` alone, so a reader who prefers
       the netlist gets it back the moment there is one to show. */
    listingSuppressed = cardsShown
      && topIsStructural(currentAll && currentAll.top && currentAll.top.name);
    netlistCard.style.display = (cardsShown || cardsPinned) ? '' : 'none';
    syncResultsView();
    syncSynthTabs(cardsShown);
    /* THE FLOW FOLLOWS THE CARDS, and this is the file that moves them. A gate-level stage is
       runnable only while there is a netlist to run, which it reads off this card's own
       visibility - so whoever changes that has to say so, or the row keeps whatever greyness it
       had when it was last built. It self-corrects when the reader presses a stage (the handler
       re-syncs), which is exactly why it needs stating here: a synthesis the STRIP did not start
       would otherwise leave the next stage looking unavailable. Guarded, because the four menu
       apps and code2silicon.html carry this file with no practice.js flow to notify. */
    if (window.PRACTICE_API && window.PRACTICE_API.syncStrip) window.PRACTICE_API.syncStrip();
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
  function synthLog(level, msg) {
    synthLines.push({ level: level, msg: msg });
    renderLogView();
  }
  /* THE LOG IS THE `Synthesis Log` VIEW OF THE `Synthesis Results` CARD, and it used to be a
     section of the Console. That was wrong twice over: a view LABELLED `Synthesis Log` held the
     area report and no log, while the log itself sat in a card labelled `Simulation Results`
     reporting something that is not a simulation. Both names now describe their contents.

     The report is the TAIL of this view rather than a fourth radio, because it was one `info` row
     of this very log before it was given a card - the last thing the synthesizer says about the
     design it just built. So the view reads in the order the work happened: what it did, then what
     it cost.

     THREE THINGS WENT AWAY WITH THE MOVE, and they were the trickiest code in this file. The
     Console had one box and two owners, so this had to insert at the TOP when its section was
     older than the run on screen, keep every row it printed as an ELEMENT so it could remove them
     again without touching a line the simulation printed, and re-print itself after Run and Reset
     cleared the box. A panel this file owns outright needs none of it: one writer, no ordering
     question, and nothing else clears it. The `— synthesis —` rule went too - it separated two
     sections of one box, and the card's own heading says it now.

     One consequence worth keeping: the pill counts PASS/FAIL over the CONSOLE, so a synthesis line
     could once have moved a verdict it has nothing to do with. Out of that box, it cannot. */
  function logViewText() {
    var out = synthLines.map(function (l) { return l.msg; });
    if (stale) out.push('(the design has changed since this synthesis)');
    if (areaReportText) out.push('', areaReportText);
    return out.join('\n');
  }
  function renderLogView() {
    if (!areaOut) return;
    var html = synthLines.map(function (l) {
      return '<span class="' + l.level + '">' + escapeHtml(l.msg) + '</span>';
    });
    /* The band on the card is not visible to a reader scrolling this panel, so the log says it
       too - otherwise it reads as a report of the design in the editor when it is a report of an
       older one. NOT pushed into synthLines: it is a fact about the flag rather than a line the
       synthesizer produced, and storing it would accumulate one per re-render. */
    if (stale) {
      html.push('<span class="warn">'
        + escapeHtml('(the design has changed since this synthesis)') + '</span>');
    }
    if (areaReportText) html.push('', escapeHtml(areaReportText));
    areaOut.innerHTML = html.join('\n');
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
    syncEmptyState();
  }

  /* ONE WRITER for the placeholder, called from both the text render and the view switch:
     it says "nothing synthesized yet", which is a fact about the synthesis rather than about
     which of the two views is up, so both paths have to reach the same answer. */
  /* THE DIAGRAM CARRIES ITS OWN EMPTY STATE - `flowPlaceholder`, inside the box - so the card's
     `netlistEmpty` must stay out of the way on that view or the same sentence appears twice. The
     other two panels are bare `pre`s, so there it is the only thing that says "nothing yet". */
  function syncEmptyState() {
    var diagram = resultsView === 'diagram';
    netlistEmpty.style.display = (netlistFullText || diagram) ? 'none' : '';
  }

  function renderAreaView() { renderLogView(); }

  /* ONE WRITER for the whole of what the view means: the radios, their `.on` pills, which
     panel is up, whether the module-list button is on the header, and - for a design that
     was already a netlist - whether the netlist is offered at all. Two encodings of one
     selection written in one place is the rule this repo holds every such control to.

     The suppressed case takes the netlist RADIO away rather than disabling it, because a
     control you cannot use and nothing explains is worse than one that is not there; the
     gate-level Run goes with it, since on a structural design it would re-run the very
     modules the simulator just ran. */
  /* ONE WRITER FOR THREE VIEWS. Everything that depends on which panel is up is decided here -
     the radios and their pills, the three panels, and what the header's controls act on - so a
     control cannot come to describe a panel that is not on screen. */
  function syncResultsView() {
    var view = resultsView === 'netlist' && listingSuppressed ? 'area' : resultsView;
    var diagram = view === 'diagram', netlist = view === 'netlist';
    [['viewDiagramRadio', 'diagram'], ['viewAreaRadio', 'area'],
     ['viewNetlistRadio', 'netlist']].forEach(function (v) {
      var r = document.getElementById(v[0]);
      if (!r) return;
      r.checked = v[1] === view;
      if (r.parentElement) r.parentElement.classList.toggle('on', r.checked);
      /* The Gate-level Verilog radio is HIDDEN for a design that was already a netlist - a
         control you cannot use and nothing explains is worse than one that is not there. */
      if (v[1] === 'netlist' && r.parentElement) {
        r.parentElement.style.display = listingSuppressed ? 'none' : '';
      }
    });
    var diagramPanel = document.getElementById('netlistDiagramPanel');
    if (diagramPanel) diagramPanel.style.display = diagram ? '' : 'none';
    areaOut.style.display = (!diagram && !netlist) ? '' : 'none';
    codeOutRow.style.display = netlist ? '' : 'none';
    syncEmptyState();
    // the module list slices the netlist TEXT, so it belongs to that view alone
    if (codeOutGroup) codeOutGroup.style.display = netlist ? '' : 'none';
    /* COPY IS DISABLED ON THE DIAGRAM, not hidden: with three views and a fixed set of header
       controls, hiding one makes the row reshuffle as a reader switches. Disabled says "not for
       this view" and keeps the header still - which is why `.btn:disabled` had to become legible
       first. Save is never disabled: on this view it writes the SVG. */
    var copyBtn = document.getElementById('netlistCopyBtn');
    if (copyBtn) {
      copyBtn.classList.toggle('disabled', diagram);
      if (diagram) copyBtn.setAttribute('aria-disabled', 'true');
      else copyBtn.removeAttribute('aria-disabled');
      copyBtn.setAttribute('title', diagram ? 'Nothing to copy from the diagram — Save writes an SVG'
                                            : 'Copy to clipboard');
    }
    var saveBtn = document.getElementById('netlistSaveBtn');
    if (saveBtn) {
      saveBtn.setAttribute('title', diagram ? 'Save the diagram as an SVG' : 'Save to file');
    }
    var gateRow = document.getElementById('gateRunRow');
    if (gateRow) gateRow.style.display = listingSuppressed ? 'none' : '';
    /* The diagram was drawn while its panel was `display: none` on any view switch, so the fit was
       computed against a box with no width - the obligation every container-width change here
       carries. Told rather than re-fitted: the expand's own rule, for the same reason. */
    if (diagram) { invalidateFit(); fitView(); }
  }

  /* Reads ev.target.value rather than which radio is checked, so it does not depend on
     radio-group exclusivity - a property of a real DOM the headless stub does not model, so
     a `.checked` sweep would pass in a browser and switch nothing under test. */
  /* NOT PERSISTED, and that is a reversal worth stating: every synthesis now FORCES a view -
     the diagram on success, the log on a failure - so a stored choice could only survive until
     the next press, and in Baerilog/synthesis.html (which synthesizes at load) not even that. A
     preference nobody can hold is not a preference; the expand and the panel heights, which the
     reader really does keep, are still stored. */
  function setResultsView(view) {
    resultsView = view === 'netlist' ? 'netlist' : (view === 'diagram' ? 'diagram' : 'area');
    syncResultsView();
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
      /* Hoist BEFORE the constants are placed - see synthesis.html's copy: the hoist moves a node
         and the translate that follows moves every node, so constants placed first would be aimed
         at pins that then shift. */
      lastGraph = placeConstants(hoistControlDrivers(
        packColumns(symbolizeGateCells(S.toFlowElements(v.graph, v.layout)))));
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
    /* Cleared with the netlist, on every path: a report left over from the last synthesis,
       sitting in the card's default view while the Console reports a fresh failure, is the
       panel disagreeing with the page about whether anything was synthesized. */
    areaReportText = '';
    renderAreaView();
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
    /* This synthesis's own log replaces the last one's, in memory and on screen - one
       assignment, since this panel holds nothing but this. It took a row-by-row removal while
       the log lived in the Console, which could not simply be cleared there: the simulation
       output above it belongs to Run. */
    synthLines = [];
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
      /* THE CARD STAYS AND SAYS WHY, where it used to be taken away with the Console left
         holding the whole answer. A reader who pressed Synthesize and got nothing on the page had
         to know to look two cards down; the card that would have carried the result is where the
         reason belongs. Forced onto the Synthesis Log view, since a Diagram of nothing is what
         the failure means.
         Set BEFORE showCards, which is what calls syncSynthLabel - the ordering is the whole
         correctness of this: after it, the label would be written from the old flag. */
      synthFailed = true;
      failReport(e.message, subsetHints(cut.src));
      showCards(true);
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
      failReport('the netlist could not be built', []);
      showCards(true);
      markStale(false);
      return;
    }
    markStale(false);
    /* No node/net count here. It described the DIAGRAM of the module on screen, while the
       area report counts the whole design per instantiation site - two numbers for nearly
       the same thing, disagreeing for reasons nothing on the page explained (`5 nodes` three
       lines above `Number of cells: 4`). The Synthesis Results card states one of them and
       the viewer shows the other. */
    synthLog('ok', 'synthesized top module ' + currentAll.top.name);
    /* SAY WHICH IT WAS. A design that only instantiates cells was already a netlist, and calling
       that a synthesis claims work nobody did - the cells on screen are the ones the source named.
       The area report is still produced, because the cost of those cells is the same question
       either way, and it is why the card stays on a structural design where the LISTING does not.
       Derived per press from the result, so an edit from an instantiation to an operator changes
       the sentence with nothing to keep in step. */
    if (topIsStructural(currentAll.top && currentAll.top.name)) {
      var cells = currentAll.results[currentAll.top.name].cells.length;
      synthLog('info', 'this design is already a netlist: ' + cells + ' instantiated cell'
             + (cells === 1 ? '' : 's') + ', nothing to infer - the diagram is its structure');
    }
    /* The SAME function synthesis.html renders, reached through the slice rather than
       reimplemented - so the two apps cannot report a different area for one design. It
       goes in the Synthesis Results card, which is this card's default view, rather than
       into the console it used to be logged into: see areaReportText's own note. */
    areaReportText = S.buildAreaReport(currentAll);
    renderAreaView();
    /* FORCED, every time: a synthesis that worked has a diagram to show, and that is what the
       card opens on. It is why the view is no longer persisted - see setResultsView. Last, so it
       wins over anything the run wrote on the way here. */
    resultsView = 'diagram';
    syncResultsView();
  }

  /* =====================================================================
     6. the viewer
     ===================================================================== */

  function svg(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  /* A BUNDLED CELL IS DRAWN AS A STACK OF ITS OWN SYMBOL, and that replaces the `[hi:lo]`
     badge the range used to be written as. `[7:0]` names the bits the bundle carries, which is
     a fact about the WIRES; what the reader wants from the block is how many copies of this
     cell the netlist really contains, and eight flip-flops drawn as one box labelled `[7:0]`
     says that only if you already know the convention. A second outline offset behind the first
     is the schematic idiom for "more of these", and `x8` is the count said in words.

     Body only - no second notch, bubble, `extra` curve or pin. Those are features OF the
     symbol, and duplicating them would read as a different cell rather than as another copy of
     this one. It is drawn FIRST, so the real body's own `node-fill` covers the half of it that
     overlaps, which is what makes the ghost read as sitting behind rather than crossing through.

     The offset is in viewBox UNITS, not pixels, so it is the same fraction of every symbol -
     `GATE_PX_PER_UNIT` is shared, so a unit is the same size everywhere except the adder, which
     is deliberately drawn at 2x and gets a proportionally bigger stack. It deliberately falls
     OUTSIDE the viewBox at the top and right, which is fine and is why the four symbol nodes'
     `svg` rules carry `overflow: visible`; nothing measures it, since `nodeSize` reads the
     viewBox and the handle table is fractions of that. Byte-identical to synthesis.html's. */
  var STACK_OFF = 7;

  function gateSymbolHtml(kind, stacked) {
    var def = GATE_DEFS[kind];
    var s = '<svg viewBox="' + def.viewBox + '" preserveAspectRatio="none">';
    if (stacked) {
      s += '<path d="' + def.body + '" class="gate-stroke" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'
         + ' transform="translate(' + STACK_OFF + ',' + (-STACK_OFF) + ')"/>';
    }
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

  /* `x8`, bottom-right, in the SYMBOL's colour rather than the muted grey the range badge used -
     it is a property of the block, not an annotation beside it, and the colour is what ties it
     to the outline it counts. `width` is the bundle's bit count and comes from the same bundling
     pass that sets `isBus`, so the two cannot disagree; the range is kept as a fallback for a
     node that somehow has no width, which is better than a bare `x`. */
  function multHtml(d) {
    if (!d.isBus) return '';
    var text = typeof d.width === 'number' ? 'x' + d.width : (d.range || '');
    return text ? '<div class="rf-node-mult">' + escapeHtml(text) + '</div>' : '';
  }

  function buildNode(n) {
    var d = n.data, sz = nodeSize(n);
    var e = mk('div', 'rf-node');
    e.style.left = n.position.x + 'px';
    e.style.top = n.position.y + 'px';
    /* SELECTING A SYMBOL IS A CLICK ON ANY PART OF IT, wired here so every kind gets it from one
       place. `suppressClick` is the pan threshold the wire click already consults; the click is
       stopped, or the background handler clears what it just made; and the three kinds that own a
       dblclick flash selected before the drill re-renders, which is accepted rather than deferred
       behind a timer. See synthesis.html's copy. */
    e.addEventListener('click', function (ev) {
      if (ev.stopPropagation) ev.stopPropagation();
      if (suppressClick) { suppressClick = false; return; }
      selectNode(n.id);
    });
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
        e.innerHTML = gateSymbolHtml(d.kind, d.isBus) + multHtml(d);
        break;
      case 'dff':
        e.classList.add('rf-node-dff');
        if (d.isBus) e.classList.add('is-bus');
        e.setAttribute('title', 'DFF');
        e.innerHTML = gateSymbolHtml(d.noReset ? 'dffnr' : 'dff', d.isBus) + multHtml(d);
        break;
      case 'fa':
        e.classList.add('rf-node-fa');
        if (d.isBus) e.classList.add('is-bus');
        e.setAttribute('title', d.label + ' — double-click to view gate-level internals');
        e.style.cursor = 'pointer';
        e.innerHTML = gateSymbolHtml((d.op === 'sub' ? 'sub' : 'add') + (d.noCarry ? 'nc' : ''), d.isBus) + multHtml(d);
        e.addEventListener('dblclick', function () { drillInto('FA_PRIMITIVE'); });
        break;
      case 'adder':
        e.classList.add('rf-node-fa');
        /* A FIGURE'S ADDER IS A SYMBOL, and a synthesized one is a sized bus adder - so everything
           below is guarded on `width`, which the synthesizer's node always carries and a topic's
           `{kind: 'add'}` never does. Without the guard `ripple-carry-4bit`'s figure drew `[NaN:0]`
           under all four of its blocks, titled each one `undefined (undefined-bit)` and offered a
           double-click into `drillInto(undefined)` - a drill-down on a static picture that is not a
           netlist and has nothing to drill into. Invisible to every headless check here, which
           counts nodes and wires and cannot read a label; found in a browser. */
        var aSized = typeof d.width === 'number';
        e.setAttribute('title', aSized
          ? d.modType + ' (' + d.width + '-bit) — double-click to view internals'
          : (d.label || (d.op === 'sub' ? 'subtractor' : 'adder')));
        /* THE BADGE IS THE MODULE NAME, ABOVE THE SYMBOL - see synth.css's `.rf-node-modname`
           for why it is neither a width nor underneath. It says the same thing the listing card
           and the breadcrumb say, so a reader can find this block in all three. */
        e.innerHTML = gateSymbolHtml((d.op === 'sub' ? 'sub' : 'add') + (d.noCarry ? 'nc' : ''))
          + (aSized ? '<div class="rf-node-modname">' + escapeHtml(d.modType) + '</div>' : '');
        if (aSized) {
          e.style.cursor = 'pointer';
          e.addEventListener('dblclick', function () { drillInto(d.modType); });
        }
        break;
      case 'mux2':
        e.classList.add('rf-node-mux2');
        if (d.isBus) e.classList.add('is-bus');
        e.setAttribute('title', 'MUX2');
        e.innerHTML = gateSymbolHtml('mux2', d.isBus) + multHtml(d);
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
  var drawn = [];            // {net, wire, mid, pts, from, fromPort, to, toPort} per drawn edge
  var byNet = {};            // net name -> those records
  var byNode = {};           // node id -> the records incident on it, either direction
  var nodeEls = {};          // node id -> its .rf-node element
  var flowById = {};         // node id -> the flow node, for its type and data
  var selectedNode = null;   // TWO KINDS OF SELECTION, ONE AT A TIME - see selectNode
  var selectedLabels = [];   // the <text> elements: one for a net, one per PIN for a symbol
  var selectedNet = null;

  /* ONE CLEAR FOR BOTH, because they are one selection with two shapes - see synthesis.html's
     own note beside selectNode. */
  function clearSelection() {
    selectedLabels.forEach(function (t) {
      if (t.parentElement) t.parentElement.removeChild(t);
    });
    selectedLabels = [];
    if (selectedNet && byNet[selectedNet]) {
      byNet[selectedNet].forEach(function (r) { r.wire.classList.remove('sel'); });
    }
    if (selectedNode) {
      (byNode[selectedNode] || []).forEach(function (r) {
        r.wire.classList.remove('sel');
        r.wire.classList.remove('sel-in');
      });
      if (nodeEls[selectedNode]) nodeEls[selectedNode].classList.remove('sel-node');
    }
    selectedNode = null;
    selectedNet = null;
    if (netReadout) { netReadout.textContent = ''; netReadout.style.display = 'none'; }
  }

  /* ---- A SELECTED NET IS NAMED WITH ITS WIDTH ----
     A wire labelled `raddr` is an 8-bit bus, and the label said nothing about that. It is the reader's
     own name and correct as one - `mergeInstancePins` prefers `portExprText`, the text written at the
     instantiation (`.raddr0(raddr)`) - so the fix is not to rename the net but to say how wide it is
     where there is room to.

     READ FROM THE DECLARATION, never derived from a count: `sig` carries `{width, lo}` for the module
     being viewed, so `raddr` reads `raddr[7:0]` and a signal declared `[4:1]` would read `[4:1]`
     rather than a plausible `[3:0]` - the same reason the simulator's own range label is built from
     `parseRange` rather than from a width.

     ONLY A BARE NAME GAINS ONE. A label that already carries `[hi:lo]` is left alone (no double
     range), and so is one naming a single bit (`sum[0]` really is one bit), a literal (`9'b000000001`
     states its own width) and an expression (`(count + 1)`, which is not a declared signal).

     The IN-PLACE label gains it too, not just the readout: exactly one is drawn at a time - the whole
     point of the selected-net label - so there is no crowding to trade against, and having the wire
     and the line above the diagram say different things about one net would be worse than either. */
  function netRangeLabel(net) {
    if (!net || /\]$/.test(net) || /'[bdho]/i.test(net)) return net;
    var mod = viewStack.length ? viewStack[viewStack.length - 1]
              : (currentAll && currentAll.top ? currentAll.top.name : null);
    var res = mod && currentAll && currentAll.results ? currentAll.results[mod] : null;
    var s = res && res.sig ? res.sig[net] : null;
    if (!s || !(s.width > 1)) return net;
    return net + '[' + (s.lo + s.width - 1) + ':' + s.lo + ']';
  }

  /* Placed where the symbols are NOT: the clicked point first, then the midpoint of each
     other segment of this net, taking the first whose label box clears every node box; the
     clicked point if none does. The box is estimated (10px mono, ~6px a character) rather
     than measured, because getComputedTextLength needs a laid-out SVG no headless harness
     here has and this is the click path. Same numbers and same rule as synthesis.html's. */
  var LABEL_CH = 6, LABEL_H = 12;
  function labelSpot(net, first, text) {
    var boxes = boxesFor(lastGraph.nodes || []);
    function clear(p) {
      if (!p) return false;
      var halfW = (String(text).length * LABEL_CH) / 2 + 2;
      return boxes.every(function (b) {
        return !segHitsBox({ x: p.x - halfW, y: p.y - 3 - LABEL_H }, { x: p.x + halfW, y: p.y }, b);
      });
    }
    if (clear(first)) return first;
    /* A PIN label passes no net: its point is the pin's, so there is no other segment of the
       same name to try - it keeps the anchor and relies on the halo. */
    var others = (net && byNet[net]) || [];
    for (var i = 0; i < others.length; i++) if (clear(others[i].mid)) return others[i].mid;
    return first;
  }

  /* ---- SELECTING A SYMBOL LIGHTS THE NETS IT IS WIRED TO ----
     A net selection answers "where does this signal go"; this answers "what is wired to this".
     Input side amber, output side the net colour, at the same two stroke weights; one label per
     PIN (not per wire) placed at the wire's node end; a port pennant gets none, since it already
     carries its own name. See synthesis.html's own note for the reasoning - this is the same
     behaviour in the second hand-maintained copy of one viewer, held to it by check_theme.py. */
  var PIN_LABEL_MAX = 3;

  function nodeTitle(n) {
    var d = (n && n.data) || {};
    if (!n) return '?';
    if (n.type === 'instance' || n.type === 'adder') {
      return d.instName ? d.instName + ' (' + d.modType + ')' : d.modType;
    }
    /* The `xN` badge is a CELL bundle's - a bundled port is drawn once as a pennant carrying its
       range, so saying `y[7:0] x8` here would describe something not on screen. */
    var mult = n.type !== 'port' && d.isBus && d.width > 1 ? ' x' + d.width : '';
    return (d.label || n.type) + mult;
  }

  /* `pts` runs source -> target, so an output leaves at pts[0] and an input arrives at the last
     point; a few pixels back along the wire keeps the text off the symbol's outline. */
  function pinAnchor(rec, out) {
    var pts = rec.pts || [];
    if (!pts.length) return rec.mid;
    var at = out ? pts[0] : pts[pts.length - 1];
    var next = out ? (pts[1] || at) : (pts[pts.length - 2] || at);
    var dx = next.x - at.x, dy = next.y - at.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var back = Math.min(18, len / 2);
    return { x: at.x + dx / len * back, y: at.y + dy / len * back };
  }

  function selectNode(id) {
    var again = id === selectedNode;
    clearSelection();
    /* Keyed on the NODE existing, not on it having wires: an unconnected port is a real thing on an
       unimplemented starter, and clicking it used to do nothing at all. See synthesis.html's copy. */
    if (again || !id || !flowById[id]) return;
    selectedNode = id;
    if (nodeEls[id]) nodeEls[id].classList.add('sel-node');
    var node = flowById[id];
    var isPort = node && node.type === 'port';
    var pins = { in: [], out: [] };
    var seen = { in: {}, out: {} };
    /* A SELF-LOOP IS BOTH - a flop's `q` back into its own `d`, the hold path every unimplemented
       starter has. One wire carries one hue, so the COLOUR is the output side while BOTH pins are
       named. See synthesis.html's copy. */
    var add = function (rec, side) {
      var pin = (side === 'out' ? rec.fromPort : rec.toPort) || '';
      var key = pin || '\u00b7';
      if (!seen[side][key]) {
        seen[side][key] = { pin: pin, nets: [], first: rec, out: side === 'out' };
        pins[side].push(seen[side][key]);
      }
      if (rec.net && seen[side][key].nets.indexOf(rec.net) < 0) seen[side][key].nets.push(rec.net);
    };
    (byNode[id] || []).forEach(function (rec) {
      var isOut = rec.from === id, isIn = rec.to === id;
      rec.wire.classList.add(isOut ? 'sel' : 'sel-in');
      if (isOut) add(rec, 'out');
      if (isIn) add(rec, 'in');
    });
    if (!isPort) {
      ['in', 'out'].forEach(function (side) {
        pins[side].forEach(function (p) {
          if (!p.pin) return;
          var point = labelSpot(null, pinAnchor(p.first, p.out), p.pin);
          var t = svg('text', { class: 'pn-edge-label ' + (p.out ? 'sel' : 'sel-in'),
                                x: point.x, y: point.y - 3 });
          t.textContent = p.pin;
          labelLayer.appendChild(t);
          selectedLabels.push(t);
        });
      });
    }
    if (netReadout) {
      var say = function (side) {
        var parts = pins[side].map(function (p) {
          var nets = p.nets.map(netRangeLabel).join(', ');
          /* A PORT's pin name is the viewer's own handle id (`y`), not anything the reader wrote,
             so it is dropped for the same reason its wires get no label. */
          if (isPort || !p.pin) return nets;
          return nets ? p.pin + '(' + nets + ')' : p.pin;
        }).filter(Boolean);
        if (!parts.length) return '';
        var shown = parts.slice(0, PIN_LABEL_MAX).join(', ');
        return shown + (parts.length > PIN_LABEL_MAX
          ? ', +' + (parts.length - PIN_LABEL_MAX) + ' more' : '');
      };
      /* MARKUP, not text, so the input half carries the wires' own colour - see synthesis.html's
         copy. Escaped, since a net name is arbitrary source text. */
      var inText = say('in'), outText = say('out');
      netReadout.innerHTML = escapeHtml('cell: ' + nodeTitle(node))
        + (inText ? '<span class="in">' + escapeHtml(' \u2014 in ' + inText) + '</span>' : '')
        + (outText ? escapeHtml(' \u00b7 out ' + outText) : '')
        + (inText || outText ? '' : escapeHtml(' \u2014 nothing wired'));
      netReadout.style.display = '';
    }
  }

  function selectNet(net, at) {
    var again = net === selectedNet;
    clearSelection();
    if (again || !net || !byNet[net]) return;   // clicking the selected net again clears it
    selectedNet = net;
    byNet[net].forEach(function (r) { r.wire.classList.add('sel'); });
    var shown = netRangeLabel(net);
    var point = labelSpot(net, at || byNet[net][0].mid, shown);
    var label = svg('text', { class: 'pn-edge-label sel', x: point.x, y: point.y - 3 });
    label.textContent = shown;
    labelLayer.appendChild(label);
    selectedLabels.push(label);
    /* Also said in words beside the breadcrumb, because the label can be panned
       off-screen while the highlight is still on. */
    if (netReadout) {
      netReadout.textContent = 'net: ' + shown + ' (' + byNet[net].length
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
  /* A WIRE LEAVES A PIN THE WAY THE PIN POINTS, and for the two edges this router was written for
     that is free: a left or right pin's first move is horizontal, which is what an S-bend in x does
     anyway. A pin on the BOTTOM edge is not - the route's last move was horizontal, so the wire
     cornered exactly at the stub's tip and ran alongside it, which reads as a wire that has missed
     the pin rather than one that ends on it.

     So a bottom pin gets a LEADER: the route is computed to a point 22px below it and the pin is
     added at the end (or the start, for a source on that edge, which nothing draws today but which
     costs one branch to be right about). The leader is the same 22px the backward route already
     steps out by, reused rather than a second constant, and it is long enough for `roundedPath`'s
     8px corner to sit inside it. */
  var PIN_LEAD = 22;
  /* ---- A WIRE MUST NOT CROSS A SYMBOL ----
     The midpoint S-bend below is right for two adjacent columns and wrong the moment an edge
     spans more than one: its vertical leg lands at `(a.x + b.x) / 2`, which for a two-column
     edge is the middle of the column in between. Measured, that really happens - one wire of
     seven on the register file's `rf_reg` ran straight through the flip-flop, six of sixteen on
     the shift register cross a flop - and it reads as "behind" rather than "through", which is
     worse: edges are drawn under nodes and a body is filled with `--canvas-default`, so the wire
     disappears at the block's edge and reappears on the far side. A chevron in a rectangular box
     (the adder) leaks it through the empty corners too.

     So the direct route is tried, and if it hits anything the wire goes around: the same
     five-point shape the backward route uses, with the channel taken above or below whatever is
     in the way, whichever is shorter and actually clear. If NEITHER is clear (a design dense
     enough to have no channel) the direct route is returned rather than a worse detour - this may
     fail to find a way through, and when it does the picture is what it was before.

     Both viewers carry it; tools/check_theme.py compares the clearance the two use. */
  /* A node's box, stated ONCE - the router, the constant placement and the fit all ask for it. */
  function boxOf(n) {
    var sz = nodeSize(n);
    return { id: n.id, x0: n.position.x, y0: n.position.y,
             x1: n.position.x + sz.width, y1: n.position.y + sz.height };
  }
  function boxesFor(nodes) { return nodes.map(boxOf); }
  function segHitsBox(p, q, b) {
    return Math.max(p.x, q.x) > b.x0 + 1 && Math.min(p.x, q.x) < b.x1 - 1
        && Math.max(p.y, q.y) > b.y0 + 1 && Math.min(p.y, q.y) < b.y1 - 1;
  }
  function routeClear(pts, boxes) {
    for (var i = 1; i < pts.length; i++) {
      for (var j = 0; j < boxes.length; j++) if (segHitsBox(pts[i - 1], pts[i], boxes[j])) return false;
    }
    return true;
  }
  function pathLength(pts) {
    var t = 0;
    for (var i = 1; i < pts.length; i++) {
      t += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    }
    return t;
  }
  function detour(a, b, yChannel) {
    var xOut = a.x + PIN_LEAD, xIn = b.x - PIN_LEAD;
    return [a, { x: xOut, y: a.y }, { x: xOut, y: yChannel },
            { x: xIn, y: yChannel }, { x: xIn, y: b.y }, b];
  }
  /* ---- ONE LANE PER NET IN A SHARED CHANNEL ----
     Two wires that want the same channel were given the same coordinate and drawn exactly on top of
     one another. Measured by sampling every wire every 4px, more than HALF the points on the 8:1 mux
     tree (706 of 1211) sat within 4px of a wire carrying a DIFFERENT net, and 649 of 1526 on the
     shift register. Several nets drawn as one thick line is not a diagram of anything.

     THE LANE IS KEYED BY NET, which is what makes one rule do both jobs: a net that already has a
     lane keeps it, so the eight wires fanning out of `d[7:0]` share one line and read as the trunk
     they are, while `clk` and `rst_n` broadcasting to the same four flops stop occupying the same
     pixels. Offsets alternate outward from the original, so the first net keeps exactly the
     coordinate it had and nothing moves where there is no contention. A nudged route is re-checked
     for clearance and falls back, so separation never costs a wire its route. See synthesis.html's
     copy for the note on why there is no negative-coordinate guard. */
  var LANE_STEP = 9, LANE_MAX = 6;
  function makeLanes() { return { v: {}, h: {} }; }
  function laneOffset(lanes, axis, coord, net) {
    var key = Math.round(coord / 4);
    var chan = lanes[axis][key] || (lanes[axis][key] = { byNet: {}, next: 0 });
    var name = net == null ? '' : String(net);
    if (chan.byNet[name] === undefined) chan.byNet[name] = chan.next++;
    var i = Math.min(chan.byNet[name], LANE_MAX);
    return (i % 2 ? 1 : -1) * Math.ceil(i / 2) * LANE_STEP;
  }

  var ROUTE_CLEAR = 12, ROUTE_TRIES = 40;
  function routeAround(a, b, boxes, lanes, net) {
    var plain = routeBetween(a, b);
    var ok = function (pts) { return !boxes.length || routeClear(pts, boxes); };
    /* The lane is claimed on the coordinate the route WOULD have used, so the key is the same for
       every wire contending for that channel however far each one is nudged. */
    var dv = lanes ? laneOffset(lanes, 'v', plain.length > 2 ? plain[1].x : a.x, net) : 0;
    var dh = lanes ? laneOffset(lanes, 'h', plain.length > 4 ? plain[2].y : a.y, net) : 0;
    var laned = routeBetween(a, b, dv, dh);
    var direct = ok(laned) ? laned : plain;
    if (!boxes.length || routeClear(direct, boxes)) return direct;
    var lo = Math.min(a.x, b.x) - PIN_LEAD, hi = Math.max(a.x, b.x) + PIN_LEAD;
    var inSpan = boxes.filter(function (x) { return x.x1 > lo && x.x0 < hi; });
    if (!inSpan.length) return direct;
    /* THE CHANNEL IS A GAP BETWEEN ROWS, not "above everything" - see synthesis.html's copy. The
       short version: going over the top row is `minY - CLEAR`, negative whenever the top row sits
       at y=0, which puts the wire outside the fit in the viewer and clips it off a topic's static
       figure. Nearest corridor first with an early exit, because FUNC_ram256x8 puts 256 boxes in
       one x-span and scoring every candidate would be ~650k segment tests per wire. */
    var mid = (a.y + b.y) / 2;
    var ys = [];
    inSpan.forEach(function (x) { ys.push(x.y0 - ROUTE_CLEAR, x.y1 + ROUTE_CLEAR); });
    ys.sort(function (p, q) { return Math.abs(p - mid) - Math.abs(q - mid); });
    /* UNDER EVERYTHING as the last resort, below rather than above - nothing sits under the bottom
       row, so it is always clear, and unlike `minY - CLEAR` it cannot be negative and clipped off a
       static figure. Long, but only reached when no corridor was clear, and a long visible wire
       beats a short hidden one. */
    for (var i = 0; i < ys.length && i < ROUTE_TRIES; i++) {
      // The corridor is laned too, or every wire forced into the same gap between two rows lands
      // on the same pixel row - the contention this whole block exists to break.
      var off = lanes ? laneOffset(lanes, 'h', ys[i], net) : 0;
      var p = detour(a, b, ys[i] + off);
      if (ok(p)) return p;
      if (off) { var q = detour(a, b, ys[i]); if (ok(q)) return q; }
    }
    /* UNDER EVERYTHING, tried OUTSIDE the loop rather than as its last candidate - which is
       where it was, and therefore unreachable on any design big enough to need it, since `ys`
       is sorted by distance and ROUTE_TRIES truncated long before its end. See synthesis.html's
       copy: 145 wires still crossed a symbol on the 16-bit CPU before this moved out. */
    var maxY = -Infinity;
    boxes.forEach(function (x) { if (x.y1 > maxY) maxY = x.y1; });
    var under = maxY + ROUTE_CLEAR;
    var offU = lanes ? laneOffset(lanes, 'h', under, net) : 0;
    var laneUnder = detour(a, b, under + offU);
    if (ok(laneUnder)) return laneUnder;
    var plainUnder = detour(a, b, under);
    if (ok(plainUnder)) return plainUnder;
    return direct;
  }
  function edgePoints(a, b, boxes, lanes, net) {
    /* A pin on a horizontal edge is approached PERPENDICULARLY, or the wire arrives at the top or
       bottom of a symbol running sideways along it. So the route is computed to a lead point 22px
       clear of the pin and the pin itself is added on the end: below for a bottom pin (the adder's
       carry in, the flip-flop's clock), above for a top one (the mux's select). */
    var a2 = a.side === 'b' ? { x: a.x, y: a.y + PIN_LEAD }
           : a.side === 't' ? { x: a.x, y: a.y - PIN_LEAD } : a;
    var b2 = b.side === 'b' ? { x: b.x, y: b.y + PIN_LEAD }
           : b.side === 't' ? { x: b.x, y: b.y - PIN_LEAD } : b;
    var pts = routeAround(a2, b2, boxes || [], lanes, net);
    if (a2 !== a) pts.unshift(a);
    if (b2 !== b) pts.push(b);
    return pts;
  }

  function routeBetween(a, b, dv, dh) {
    dv = dv || 0; dh = dh || 0;
    if (b.x - a.x >= 30) {
      var mx = (a.x + b.x) / 2 + dv;
      // A straight run has no vertical leg to lane, and nudging it would bend a wire that is fine.
      if (Math.abs(a.y - b.y) < 0.5) return [a, b];
      return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
    }
    if (b.x >= a.x) {
      if (Math.abs(a.y - b.y) < 0.5) return [a, b];
      var mx2 = (a.x + b.x) / 2 + dv;
      return [a, { x: mx2, y: a.y }, { x: mx2, y: b.y }, b];
    }
    var out = a.x + 22 + dv, back = b.x - 22 - dv;
    var below = Math.max(a.y, b.y) + 34 + dh;
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
    labelLayer.setAttribute('transform', 'translate(' + view.x + ',' + view.y + ') scale(' + view.k + ')');
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
    var heights = {};
    Object.keys(cols).forEach(function (x) {
      var col = cols[x].slice().sort(function (a, b) { return a.position.y - b.position.y; });
      cols[x] = col;
      var y = 0;
      col.forEach(function (n) {
        n.position = { x: n.position.x, y: y };
        y += nodeSize(n).height + COLUMN_GAP;
      });
      heights[x] = Math.max(0, y - COLUMN_GAP);
    });
    /* EVERY COLUMN IS CENTRED ON ONE MIDLINE - see synthesis.html's copy for why. In short: the
       engine ranks nodes into columns and the loop above packs each to its real heights, but both
       leave every column TOP-ALIGNED, so an 8:1 mux tree of 4 muxes then 2 then 1 hangs off the
       top edge with a wedge of empty space beneath and does not read as a tree. The tallest column
       does not move, so the bounds are unchanged, and this shifts whole columns without ever
       reordering one - which is what keeps `clk` the last node of its own column. */
    var tallest = 0;
    Object.keys(cols).forEach(function (x) { if (heights[x] > tallest) tallest = heights[x]; });
    Object.keys(cols).forEach(function (x) {
      var shift = Math.round((tallest - heights[x]) / 2);
      if (!shift) return;
      cols[x].forEach(function (n) { n.position = { x: n.position.x, y: n.position.y + shift }; });
    });
    return g;
  }

  /* ---- A SELECT DRIVER SITS ABOVE THE MUXES IT DRIVES ----
     `sel` is on a mux's TOP edge, so a wire into one is led 22px above the pin and comes straight
     down. That is right when the driver is above and absurd when it is not: measured on
     `learn-mux-8to1`, the one `sel[2:0]` port sits at y=132 while the topmost sel pin it feeds is at
     y=0, so every one of its seven wires has to climb 132px, hook over the mux and come back down.
     Four of those hooks are what makes that diagram look tangled, and no amount of routing can fix
     it: the wire is going the wrong way before it starts.

     THE TRIGGER IS THE CLIMB, not the pin type. A driver already level with or above everything it
     selects is left alone, so a design like `mux-2to1` - one mux, sel already in line - does not gain
     a row it has no use for. What the pass removes is exactly the upward run.

     IT IS KEYED ON WHAT A NODE DRIVES, never on what it is, so a port, a gate and a sub-block all
     qualify by the same test. And it must drive NOTHING BUT selects: a node that also feeds data pins
     would be dragged away from those consumers and make their wires worse, which is the reasoning the
     constant placement's one-reader rule already follows.

     IT LIVES HERE, after packColumns, for the two reasons that pass records - the position it wants
     is a PIN's, which is the viewer's knowledge, and packColumns is what settles a node's final row,
     so anything done earlier is undone. The engine has the precedent in the other direction:
     `layoutGraph` lifts `clk` out of normal packing and gives it its own row at the BOTTOM.

     AND THEN THE GRAPH IS TRANSLATED BACK DOWN, which is not tidiness. Hoisting puts the driver above
     y=0, and this repo has already paid for negative coordinates once: `Baerilog/test_learn.py` caught
     a wire at y=-18 as `outside the box on the near side`, because a static figure clips rather than
     growing. So if anything went negative every node moves down by the same amount - one loop, and it
     leaves `graphBounds` reading what it always did. It also happens to retire the pre-existing case
     this file records from the other end: a mux in the top row has its `sel` leader at y=-22 whatever
     the lanes do, and after a hoist the top row is the driver, so the leader is positive. */
  var CTRL_GAP = 28;
  function hoistControlDrivers(g) {
    var byId = {};
    g.nodes.forEach(function (n) { byId[n.id] = n; });
    var info = {};
    g.edges.forEach(function (e) {
      var from = byId[e.source], to = byId[e.target];
      if (!from || !to) return;
      var at = handlePoint(to, e.targetHandle);
      if (!at) return;
      var d = info[e.source] || (info[e.source] = { tops: [], cols: [], other: 0 });
      if (at.side === 't') { d.tops.push(at.y); d.cols.push(to.position.x); }
      else d.other++;
    });
    var moved = 0;
    Object.keys(info).forEach(function (id) {
      var d = info[id], n = byId[id];
      if (!d.tops.length || d.other) return;
      var sz = nodeSize(n);
      var topPin = Math.min.apply(null, d.tops);
      if (topPin >= n.position.y) return;                    // nothing has to climb
      // It has to be LEFT of what it drives, or the wire leaves its right edge going backwards -
      // which is the feedback case the backward route already draws properly on its own.
      if (n.position.x + sz.width > Math.min.apply(null, d.cols)) return;
      var home = n.position;
      n.position = { x: home.x, y: Math.round(topPin - PIN_LEAD - CTRL_GAP - sz.height) };
      var b = boxOf(n);
      var clash = g.nodes.some(function (o) {
        if (o === n) return false;
        var q = boxOf(o);
        return b.x1 > q.x0 && b.x0 < q.x1 && b.y1 > q.y0 && b.y0 < q.y1;
      });
      if (clash) { n.position = home; return; }
      moved++;
    });
    if (moved) {
      var minY = Math.min.apply(null, g.nodes.map(function (n) { return n.position.y; }));
      if (minY < 0) g.nodes.forEach(function (n) { n.position = { x: n.position.x, y: n.position.y - minY }; });
    }
    return g;
  }

  /* ---- A CONSTANT SITS IN FRONT OF THE PIN IT FEEDS - see synthesis.html's copy for the whole
     argument. In short: `splitSharedConstants` gives every consumer its own constant, so a
     constant with one reader has exactly one place it belongs, and the engine's own rule (one
     COLUMN left of the cell it ties) leaves a 200px gutter and a wire across it. The position
     wanted is a PIN's, which is a fact about the symbol and so only exists here.

     Two things keep it safe. Every node's box is reserved, a movable constant's own home
     included, so a move is refused unless its slot is clear and a REVERT can never overlap. And
     the routes are then computed and each crossing ATTRIBUTED, so a constant that has landed in a
     channel wires were using is known by name and sent home - measured on the 16-bit ALU, all
     five land in the highway `a[15:0]` and `b[15:0]` run down and all five go back, which is the
     pass declining rather than failing. */
  var CONST_GAP = 16, CONST_CLEAR = 8, CONST_REPAIR = 3;
  function placeConstants(g) {
    var byId = {};
    g.nodes.forEach(function (n) { byId[n.id] = n; });
    var fed = {};
    g.edges.forEach(function (e) {
      var s = byId[e.source];
      if (s && s.type === 'const') (fed[e.source] || (fed[e.source] = [])).push(e);
    });
    var boxes = g.nodes.map(boxOf), moves = [];
    Object.keys(fed).forEach(function (id) {
      if (fed[id].length !== 1) return;
      var e = fed[id][0], to = byId[e.target], k = byId[id];
      var at = to && handlePoint(to, e.targetHandle);
      /* A VERTICAL PIN NEEDS NO TEST OF ITS OWN, and one was written before it was measured.
         A mux's `sel` is on the top edge and an adder's `cin` underneath, and a constant put a gap
         to the LEFT of either is reached by a wire that turns twice and passes the symbol on the
         way - so an `at.side !== 'l'` guard reads as obviously right. It is unreachable: the
         clearance test below already refuses every one of them, and for a reason that cannot come
         apart. `handlePoint` returns a vertical pin ON its own edge, so a 28px box centred there
         straddles the consumer by 14px; and the x overlap needs only the pin's fraction along that
         edge to exceed the 8px clearance, which the shallowest symbol here manages three times
         over (a mux's `sel` at 0.5 of 65 units). Both mutants survived - in this viewer and in
         practice-synth.js - and the measurement that showed why is `1'b1/b@174,258 BLOCKED by
         sub0`, the consumer refusing its own constant.

         So the rule is left to the one mechanism rather than stated twice, and what pins the
         OUTCOME is a check ('a vertical pin keeps its column') rather than a line of code no
         input can reach. */
      if (!at) return;
      var sz = nodeSize(k);
      moves.push({ node: k, home: k.position,
                   want: { x: Math.round(at.x - CONST_GAP - sz.width),
                           y: Math.round(at.y - sz.height / 2) },
                   to: to.position, at: at });
    });
    moves.sort(function (p, q) {
      return (p.to.x - q.to.x) || (p.at.y - q.at.y) || (p.want.x - q.want.x);
    });
    var placed = [];
    moves.forEach(function (m) {
      var sz = nodeSize(m.node);
      var w = { x0: m.want.x - CONST_CLEAR, y0: m.want.y - CONST_CLEAR,
                x1: m.want.x + sz.width + CONST_CLEAR, y1: m.want.y + sz.height + CONST_CLEAR };
      if (m.want.x < 0) return;
      var blocked = boxes.some(function (b) {
        return b.id !== m.node.id && w.x1 > b.x0 && w.x0 < b.x1 && w.y1 > b.y0 && w.y0 < b.y1;
      });
      if (blocked) return;
      m.node.position = m.want;             // a NEW object - see packColumns
      boxes.push(boxOf(m.node));
      placed.push(m);
    });
    for (var pass = 0; placed.length && pass < CONST_REPAIR; pass++) {
      var bad = constsInTheWay(g, placed);
      if (!bad.size) break;
      placed.forEach(function (m) { if (bad.has(m.node.id)) m.node.position = m.home; });
      placed = placed.filter(function (m) { return !bad.has(m.node.id); });
    }
    return g;
  }
  /* Routes every edge exactly as renderGraph will and reports which of `cands` a wire runs
     through. Its own lanes, because they are allocated as routes are made and a shared allocator
     would leave this pass's choices behind for the real one to trip over. */
  function constsInTheWay(g, cands) {
    var byId = {}, bad = new Set();
    g.nodes.forEach(function (n) { byId[n.id] = n; });
    var boxes = boxesFor(g.nodes), lanes = makeLanes();
    var watch = boxes.filter(function (b) {
      return cands.some(function (m) { return m.node.id === b.id; });
    });
    g.edges.forEach(function (e) {
      var from = byId[e.source], to = byId[e.target];
      var a = from && handlePoint(from, e.sourceHandle);
      var b = to && handlePoint(to, e.targetHandle);
      if (!a || !b) return;
      var pts = edgePoints(a, b, boxes, lanes, e.label);
      for (var i = 1; i < pts.length; i++) {
        watch.forEach(function (w) { if (segHitsBox(pts[i - 1], pts[i], w)) bad.add(w.id); });
      }
    });
    return bad;
  }

  /* ---- ONE TRUNK PER NET PER COLUMN, WHICH IS WHAT A FAN-OUT LOOKS LIKE ON PAPER ----
     A net driving forty pins is drawn as forty wires, each routed on its own from the source to its
     own target - and where the geometry is simple they coincide and read as a trunk with drops
     already, because the lane allocator gives one net one lane. Where any of them has to detour they
     come apart: measured across the enabled pages, **27 of 35 fan-out nets (>=3 drops) fragment into
     several vertical legs, carrying 251 wires**, and the 16-bit CPU alone has 19 of them (215 wires).
     `w_and6` there is the lucky one - all forty of its legs land on x=717 - which is exactly why
     reading one net and generalising from it was the wrong way to size this.

     So the trunk is CONSTRUCTED rather than hoped for. Per (net, source pin, target column, pin
     side): one stem from the source to the gutter beside that column, one trunk down the gutter, and
     a short drop into each pin. Grouping by COLUMN as well as by net is the whole of why this stays
     tractable - a net whose drops span six columns gets six short local trunks rather than one long
     one looking for a clear channel across the whole diagram, which on a 263-block page is a channel
     that does not exist. It also means nothing has to move: the trunk lives in the gutter the router
     was already using.

     TWO PIN SIDES, ONE MECHANISM, and that is items 1 and 2 of the plan turning out to be one
     change. A left-side pin is reached by a short horizontal off the trunk. A `sel` pin is on the
     mux's TOP edge, so its drop runs along at `pin.y - PIN_LEAD` (the height a wire into a top pin is
     already led to) and turns down into the pin - which is the "control above the multiplexer, routed
     multi-drop" arrangement, and it needs no node to be hoisted: a column of muxes all share one x,
     so the trunk beside them serves every one.

     EVERY SEGMENT IS CHECKED AND THE GROUP IS ABANDONED WHOLE, never in part. A trunk half-adopted
     is worse than none - the drops that took it and the wires that did not would read as two
     different nets - so if the stem, the trunk or any one drop crosses a symbol, every edge in the
     group goes back to being routed on its own. Same discipline as the constant placement above, and
     for the same reason: a refusal has to leave the picture exactly as it was. */
  var TRUNK_GAP = 24, TRUNK_MIN = 2;
  function trunkPlan(g, byId, boxes) {
    var groups = {};
    g.edges.forEach(function (e, ix) {
      var from = byId[e.source], to = byId[e.target];
      if (!from || !to) return;
      var a = handlePoint(from, e.sourceHandle), b = handlePoint(to, e.targetHandle);
      if (!a || !b || (b.side !== 'l' && b.side !== 't')) return;
      /* JSON rather than a joined string, and that is not fussiness: this file has twice grown a
         key built with a separator that turned out to be a control byte, which worked and made
         `grep` treat the whole file as binary. A stringified array has no separator to get wrong. */
      var k = JSON.stringify([e.label, e.source, e.sourceHandle, to.position.x, b.side]);
      (groups[k] || (groups[k] = [])).push({ ix: ix, a: a, b: b, col: to.position.x });
    });
    var plan = {};
    Object.keys(groups).forEach(function (k) {
      var gr = groups[k];
      if (gr.length < TRUNK_MIN) return;
      var a = gr[0].a, side = gr[0].b.side, col = gr[0].col;
      var trunkX = col - TRUNK_GAP;
      // A source to the RIGHT of the gutter would have its stem run backwards into the trunk, which
      // is the feedback case the backward route already draws properly on its own.
      if (a.x >= trunkX) return;
      var a2 = a.side === 'b' ? { x: a.x, y: a.y + PIN_LEAD }
               : a.side === 't' ? { x: a.x, y: a.y - PIN_LEAD } : a;
      var drops = gr.map(function (d) {
        return side === 'l' ? { x: d.b.x, y: d.b.y } : { x: d.b.x, y: d.b.y - PIN_LEAD };
      });
      var ys = drops.map(function (d) { return d.y; });
      var lo = Math.min(a2.y, ...ys), hi = Math.max(a2.y, ...ys);
      /* THE STEM IS A STRAIGHT HORIZONTAL, and it took a measurement to see why it has to be.
         Routing it with the ordinary router looked obviously right - inherit the detours, the lanes,
         the corridor search - and it made the drawing WORSE: `routeAround` moves vertically too, so
         each group ended up with the stem's own leg AND the trunk's, where before one leg at the
         midpoint had done both jobs. Measured on the 16-bit ALU, distinct vertical legs went 65 to
         67 with the trunk switched on, which is the opposite of the whole point.

         So the trunk carries ALL the vertical movement and the stem carries none. A stem that cannot
         run straight abandons the group rather than detouring, because a detour puts the leg back. */
      var stem = [a2, { x: trunkX, y: a2.y }];
      var seg = [{ x: trunkX, y: lo }, { x: trunkX, y: hi }];
      if (!routeClear(stem, boxes) || !routeClear(seg, boxes)) return;
      var out = {};
      for (var gi = 0; gi < gr.length; gi++) {
        var d = gr[gi];
        var at = side === 'l' ? { x: d.b.x, y: d.b.y } : { x: d.b.x, y: d.b.y - PIN_LEAD };
        var pts = stem.concat([{ x: trunkX, y: at.y }, at]);
        if (side === 't') pts.push({ x: d.b.x, y: d.b.y });
        if (!routeClear(pts, boxes)) return;         // abandon the GROUP, never one drop
        out[d.ix] = pts;
      }
      Object.keys(out).forEach(function (ix) { plan[ix] = out[ix]; });
    });
    return plan;
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
    nodeEls = {};
    flowById = {};
    g.nodes.forEach(function (n) {
      byId[n.id] = n;
      flowById[n.id] = n;
      var el = buildNode(n);
      nodeEls[n.id] = el;
      nodesLayer.appendChild(el);
    });
    var dropped = 0;
    /* A new diagram is a new set of nets, so nothing carries over: the selection is
       cleared here rather than in every caller (Synthesize, drill, the bundle toggle). */
    clearSelection();
    invalidateFit();          // a new diagram has new bounds
    drawn = [];
    byNet = {};
    byNode = {};
    var boxes = boxesFor(g.nodes);
    var lanes = makeLanes();
    /* Computed before the loop, because a trunk is a fact about a GROUP of edges and the loop sees
       one at a time - see synthesis.html's copy. It takes no lane allocator: every segment it makes
       is placed by construction, so there is no channel to contend for. */
    var trunks = trunkPlan(g, byId, boxes);
    g.edges.forEach(function (e, i) {
      var from = byId[e.source], to = byId[e.target];
      var a = from && handlePoint(from, e.sourceHandle);
      var b = to && handlePoint(to, e.targetHandle);
      // React Flow silently drops an edge whose handle does not exist. Counting them
      // instead is the difference between a diagram that is missing wires and a
      // diagram that says so.
      if (!a || !b) { dropped++; return; }
      /* EVERY box is an obstacle, its own two endpoints included - see synthesis.html's copy.
         A pin sits ON its node's boundary and every route leaves it outward, so a segment attached
         to a pin never registers as inside its own box; exempting the endpoints bought nothing and
         let a BACKWARD wire's detour run straight through the source it had just left. */
      var pts = trunks[i] || edgePoints(a, b, boxes, lanes, e.label);
      var thick = e.style && e.style.strokeWidth === 3;
      var d = roundedPath(pts, 8);
      var wire = svg('path', { class: 'pn-edge' + (thick ? ' bus' : ''), d: d });
      edgeLayer.appendChild(wire);
      /* THE RECORD CARRIES ITS TWO ENDS, and is pushed for EVERY wire rather than only a named
         one: a SYMBOL selection lights the wires incident on a NODE where a net selection lights
         the wires sharing a NAME, and an unnamed wire is still one of a node's inputs. Only a
         named wire gets the clickable companion and a byNet entry - a net with no name is not
         something a reader can select by name. */
      var rec = { net: e.label || null, wire: wire, mid: midOf(pts), pts: pts,
                  from: e.source, fromPort: e.sourceHandle, to: e.target, toPort: e.targetHandle };
      drawn.push(rec);
      (byNode[e.source] || (byNode[e.source] = [])).push(rec);
      if (e.target !== e.source) (byNode[e.target] || (byNode[e.target] = [])).push(rec);
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
    clearSelection();
  });
  /* Escape clears it too. This shares the key with the exercise sheet, and the two cannot
     fight: practice.js's handler is registered first and only acts while the sheet is
     open, and a net can only be selected once the sheet has been dismissed. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && (selectedNet || selectedNode)) clearSelection();
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
       shows is marked as no longer describing the design. Said in the Synthesis Log, which is
       where this card says everything else, and synthLog renders it. */
    if (stale) {
      synthLog('err', 'the netlist is behind the design - press Synthesize before running it');
      return;
    }
    if (!netlistFullText) {
      synthLog('err', 'nothing synthesized yet - press Synthesize first');
      return;
    }
    var gate = gateLevelDocument();
    /* One set of panels, so a gate-level run REPLACES the behavioural one. What says so is
       the section rule `— gate-level simulation —`, which noteRun prepends below - it used
       to be a sentence logged here, and the rule says it better and in the same idiom as
       the synthesis section's. */
    runSimulation(gate.text);
    /* NO ORDERING QUESTION ANY MORE. This used to have to run after noteRun, because both
       inserted at the top of the one Console and the later call ended up higher - which is what
       once put the run's rule above the synthesis log and its own output below it. The log lives
       on its own card now, so the two cannot interleave at all.

       The page's own post-run work comes with it - the verdict pill, the tab strip, the
       first-run unfold - called rather than duplicated, which is why practice.js exposes
       it: a gate-level run counts on this page exactly as a behavioural one does. */
    if (window.PRACTICE_API && window.PRACTICE_API.noteRun) {
      window.PRACTICE_API.noteRun('gate-level simulation',
        gate.swapped + ' module' + (gate.swapped === 1 ? '' : 's') + ' replaced by gates, '
        + gate.kept + ' kept from the document (testbench, memories)');
    }
    gateHasRun = true;
    syncGateLabel();
  }
  gateBtn.addEventListener('click', function () {
    withBusyButton(gateBtn, runGateLevel, syncGateLabel);
  });
  /* NOTHING TO RE-PRINT after a Run or a Reset. Both clear the Console, which is why this file
     used to hook them and put its section back; the log is on this card's own panel now, so a
     synthesis survives both without anyone doing anything. The two listeners are deleted rather
     than left calling a renderer, because a listener that re-renders on a button that cannot
     affect it is the kind of line a later reader keeps out of caution. */
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
    var boxes = boxesFor(g.nodes);
    var lanes = makeLanes();
    /* Computed before the loop, because a trunk is a fact about a GROUP of edges and the loop sees
       one at a time - see synthesis.html's copy. It takes no lane allocator: every segment it makes
       is placed by construction, so there is no channel to contend for. */
    var trunks = trunkPlan(g, byId, boxes);
    g.edges.forEach(function (e, i) {
      var from = byId[e.source], to = byId[e.target];
      var a = from && handlePoint(from, e.sourceHandle);
      var b = to && handlePoint(to, e.targetHandle);
      if (!a || !b) return;          // no such pin: the caller's edge count is what says so
      /* EVERY box is an obstacle, its own two endpoints included - see synthesis.html's copy.
         A pin sits ON its node's boundary and every route leaves it outward, so a segment attached
         to a pin never registers as inside its own box; exempting the endpoints bought nothing and
         let a BACKWARD wire's detour run straight through the source it had just left. */
      var pts = trunks[i] || edgePoints(a, b, boxes, lanes, e.label);
      /* THE EXTENT IS WHAT IS DRAWN, NOT JUST THE NODES. A backward wire routes 22px out from
         its source and 34px BELOW the lower of its two ends, so a wire into the bottom row leaves
         the box the nodes alone would define - and `.pn-edges` is an SVG filling that box, so the
         part below it is simply cut off. Reachable the moment a symbol grew a pin on its bottom
         edge: the adder's carry in takes the wire under the block it feeds, and the last block's
         hook lost its bottom 34px with nothing to say so.
         Only the far side is taken in. A route can also run to negative x or y (a backward wire
         into a target within 22px of the left edge), which would need the whole drawing shifted
         rather than the box grown, and no figure here is laid out that way. */
      pts.forEach(function (p) {
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      });
      edgeG.appendChild(svg('path', { class: 'pn-edge' + (e.bus ? ' bus' : ''),
                                      d: roundedPath(pts, 8) }));
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
    forgetLog: function () { synthLines = []; renderLogView(); },
    /* Back to never-synthesized, for practice.js's Reset. Built out of the functions
       that already own each piece rather than by re-clearing their variables: an eighth
       thing to forget is exactly how the "list of things true before a core is live"
       bug in the emulator happened. Note this is the one place a Reset DISCARDS the
       synthesis log rather than keeping it: this is a return to a page where no synthesis
       ever happened, where Run and Reset merely clear a Console this no longer writes to. */
    reset: function () {
      synthLines = [];
      synthFailed = false;   // before showCards below, which is what rewrites the label
      renderLogView();
      clearNetlist('Nothing synthesized yet - press Synthesize.');
      markStale(false);
      clearSelection();
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
    /* Pinned by learn.js, which puts the only Synthesize button inside this card. */
    pinCard: function () { cardsPinned = true; showCards(cardsShown); },
    /* NO TAB ON A PAGE WHOSE STRIP IS NOT A TABLE OF CONTENTS. code2silicon's `#exTabs` holds the
       seven stage buttons of its flow, so a `Synthesis Results` tab appended into that row is a
       control of a different kind sitting among them - and the Synthesize STAGE already points at
       this card. */
    suppressTabs: function () { tabsSuppressed = true; syncSynthTabs(false); },
    /* Which view is up, and a way to choose one - a check that dispatched `change` on the radio
       would be testing the stub's event plumbing rather than the card. */
    setView: setResultsView,
    cardPinned: function () { return cardsPinned; },
    netlistText: function () { return netlistFullText; },
    areaText: function () { return areaReportText; },
    /* WHAT COPY AND SAVE WOULD ACT ON, which is the substance of "the controls follow the
       view": both build a throwaway <textarea>/<a> that a stub DOM cannot be asked about, so
       without this the only checkable claim would be that the panel changed. */
    /* THREE VALUES, and this accessor is where the merge's last two-view assumption hid: it
       collapsed everything that was not the netlist to `area`, so it could never say `diagram` and
       every caller asking "which view is up" got a wrong answer for the default one. */
    resultsView: function () {
      if (resultsView === 'netlist') return listingSuppressed ? 'area' : 'netlist';
      return resultsView === 'diagram' ? 'diagram' : 'area';
    },
    resultsText: resultsText,
    segments: function () { return netlistSegments.slice(); },
    graph: function () { return lastGraph; },
    isStale: function () { return stale; },
    selectedNet: function () { return selectedNet; },
    netSegments: function (net) { return (byNet[net] || []).length; },
    selectNet: selectNet,
    clearNetSelection: clearSelection,
    highlighted: function () {
      return drawn.filter(function (r) { return r.wire.classList.contains('sel'); })
                  .map(function (r) { return r.net; });
    },
    /* ---- the SYMBOL selection, for a harness that cannot hit-test ----
       `highlightedIn` and `highlightedOut` are the two directions read back off the DRAWN wires
       rather than off the selection's own bookkeeping, which is the point: a mutant that records a
       pin and paints nothing would satisfy a check on `selectedNode` alone. `pinLabels` is what
       "one label per PIN, not per wire" is asserted with, and `nodeIds`/`nodeKind` let a check pick
       a symbol by kind without knowing this app's id scheme. */
    selectNode: selectNode,
    selectedNode: function () { return selectedNode; },
    nodeIds: function () { return (lastGraph.nodes || []).map(function (n) { return n.id; }); },
    nodeKind: function (id) { return flowById[id] ? flowById[id].type : null; },
    nodeEdges: function (id) {
      return (byNode[id] || []).map(function (r) {
        return { net: r.net, from: r.from, fromPort: r.fromPort, to: r.to, toPort: r.toPort };
      });
    },
    highlightedIn: function () {
      return drawn.filter(function (r) { return r.wire.classList.contains('sel-in'); })
                  .map(function (r) { return r.net; });
    },
    highlightedOut: function () {
      return drawn.filter(function (r) { return r.wire.classList.contains('sel'); })
                  .map(function (r) { return r.net; });
    },
    pinLabels: function () {
      var out = [];
      [edgeLayer, labelLayer].forEach(function (layer) {
        Array.prototype.forEach.call(layer.children, function (c) {
          if (c.tagName === 'TEXT') out.push(c.textContent);
        });
      });
      return out;
    },
    /* The element itself, so a check can dispatch a real click on a symbol - the harness cannot
       hit-test, so reaching the node any other way would mean knowing this file's id scheme. */
    nodeElement: function (id) { return nodeEls[id] || null; },
    nodeMarked: function () {
      return (lastGraph.nodes || []).filter(function (n) {
        return nodeEls[n.id] && nodeEls[n.id].classList.contains('sel-node');
      }).map(function (n) { return n.id; });
    },
    readout: function () { return netReadout ? netReadout.textContent : ''; },
    /* Counted over BOTH transformed layers, not just the one the label happens to live in:
       the label moved from the edge layer to a layer above the nodes, and a counter pinned to
       one of them read 0 and reported the feature gone. Asking both means the count is about
       how many labels are drawn - the claim - rather than about where they are drawn. */
    labelCount: function () {
      var n = 0;
      [edgeLayer, labelLayer].forEach(function (layer) {
        Array.prototype.forEach.call(layer.children, function (c) {
          if (c.tagName === 'TEXT') n++;
        });
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
    // The gap, so a check can assert a constant is flush against its pin without restating 16.
    constGap: CONST_GAP,
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

  /* THE FLOW STRIP HAS TO BE REBUILT NOW THIS FILE'S BUTTONS EXIST, and the load order is the
     whole reason. `practice.js` runs BEFORE this file - it must, because this file's Run
     listener has to fire after that one's verdict-pill refresh - so when it built the row there
     was no `synthBtn` and no `gateRunBtn` on the page, and flowstrip DROPS a stage whose button
     is absent. Left there, every exercise page would show a two-stage flow and no way to
     synthesize from it.

     `build` is idempotent (it takes back its own nodes and re-inserts them), so calling it a
     second time is a rebuild rather than a duplicate row - and it is guarded, because the four
     menu apps and code2silicon.html carry this file with no flow of practice.js's to rebuild. */
  if (window.PRACTICE_API && window.PRACTICE_API.rebuildStrip) {
    window.PRACTICE_API.rebuildStrip();
  }
})();
