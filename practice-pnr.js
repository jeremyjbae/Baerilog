/* practice-pnr.js - a STATIC placement, drawn into any element on a topic page.
 *
 * The counterpart of practice-synth.js's drawStatic, and deliberately NOT that function: a netlist
 * figure and a placement figure are two different pictures made of different things - one is nodes
 * and wires computed from a graph, the other is real cell layouts abutted into rows - and they will
 * grow apart rather than together. Sharing one drawer would mean one set of options describing both.
 *
 * The cost of that choice is stated rather than hidden: both files size a wrapper to its content,
 * centre it with auto margins, set `position: relative` inline and leave the container's height to
 * flow. That arithmetic is what clipped 26px off every netlist figure once, so each has its own
 * assertions - the wrapper carries the height, the box carries none - and a regression in one is
 * caught in one place instead of being shrugged off because the other still passes.
 *
 * WHAT THIS DOES NOT DO. No pan, no zoom, no selection, no view toggle, no re-draw. A placement in
 * an article is an illustration of one arrangement; the app at pnr.html is where a reader who wants
 * to move the row width around goes. So there is no state here at all: every call is complete in
 * itself, and nothing is remembered between two figures on one page.
 *
 * It needs window.PNR (Baerilog/pnr.js, the slice of pnr.html's engine). Only a topic whose manifest
 * entry says `"pnr": true` loads either, which is checked by build.py in both directions - the flag
 * without a layout block carries the largest generated file here for nothing, and a layout block
 * without the flag draws nothing at all.
 */
'use strict';

window.PRACTICE_PNR_API = (function () {

  /* One row of cells at this many CSS pixels tall. The app scales by a zoom factor over the raw
     lambda units; a figure cannot, because it has no zoom - so the scale is derived from the one
     dimension every placement shares. Every cell in this library is CELL_H tall (that is what makes
     rows abut at all), so "how tall is a row" is the whole of the sizing question and the width
     follows from the aspect ratio. 150px reads as a strip of layout rather than as a diagram of one,
     and a four-cell row still fits a 68ch column at it. */
  var ROW_PX = 150;

  /* Which layer set to draw. `phantom` is the abutment box and the pins - the floorplan reading -
     and `all` is every mask layer, which is the one a page about silicon wants. pnr.html's own
     toolbar calls them Abstract and Detail. */
  var DEFAULT_VIEW = 'all';

  /* ONE LAMBDA, IN MICRONS. pnr's coordinates are milli-lambda - a cell is 40000 x 72000, i.e.
     40 x 72 lambda - because the .ap layouts they come from are scalable rules rather than a fixed
     process. So a figure that wants microns needs exactly one number, and this is it.

     0.65 um puts the AND cell at 26 x 46.8 um, which is the size of a cell in a mature process and
     the scale these Alliance layouts are drawn for. Nothing else in this file has an opinion about
     scale, so a different process is this line and nothing more. */
  var LAMBDA_UM = 0.65;

  /* WHERE THE LAYOUTS COME FROM. The cell art in pnr.html is not this repo's: it is the free VLSI
     cell library from vlsitechnology.org, converted out of its Alliance .ap files. So a figure that
     draws those shapes says so, and the credit lives HERE rather than in a topic file - it is a fact
     about the artwork the drawer places, not about any one page, and a per-topic string would be a
     second place for it to go stale. */
  var SOURCE = { label: 'vlsitechnology.org', href: 'https://www.vlsitechnology.org/index.html' };

  function px(n) { return Math.round(n) + 'px'; }

  /* Trailing zeros are noise on a figure, and a hard 2 decimals turns 26 into 26.00. So: whole
     numbers stay whole, and anything else keeps up to two decimals with a trailing zero trimmed -
     which is what makes 46.8 read as 46.8 rather than as 46.80. */
  function um(milliLambda) {
    var v = milliLambda / 1000 * LAMBDA_UM;
    if (Math.abs(v - Math.round(v)) < 0.005) return String(Math.round(v));
    return v.toFixed(2).replace(/0$/, '');
  }

  /* Which cells, and how many of each - counted rather than listed, because a row of eight inverters
     should read as `8 x not_gate` and not as the word eight times. Sorted by count then name, so the
     same placement always reads the same way. */
  function tally(types) {
    var n = {};
    types.forEach(function (ty) { n[ty] = (n[ty] || 0) + 1; });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a] || (a < b ? -1 : 1); })
      .map(function (ty) { return { type: ty, count: n[ty] }; });
  }

  /* WHAT WAS PLACED AND HOW BIG IT IS, as one line of text, and it lives here because two pages write it
     under their Layout drawing and a caption stated twice is a caption that comes to disagree. It was the
     FABRICATION figure's, appended inside it beside the cut's own little layout - which put a fact about
     the ARRANGEMENT under a drawing of the process, and made it appear only once Fabricate had been
     pressed. It belongs under the layout it describes, and it now arrives with the placement.

     TAKES THE PLACED LIST AND THE EXTENT, not a `drawStatic` result, because the two callers hold
     different things: `code2silicon.js` has that result and `pnr.html` has a raw plan from `place`. Both
     have cells with a type and a width and a height in milli-lambda, which is all this needs.

     The order is `tally`'s - commonest first, ties by name - so the string is byte-for-byte what the
     figure used to print. */
  function tallyLine(placed, widthMilli, heightMilli) {
    var types = (placed || []).map(function (p) {
      return p.type || (p.inst && p.inst.type) || '?';
    });
    if (!types.length) return '';
    return tally(types).map(function (t) { return t.count + ' × ' + t.type; }).join(', ')
      + ' — ' + um(widthMilli) + ' × ' + um(heightMilli) + ' µm';
  }

  /* The pipeline, in one place: text -> instances -> rows -> markup. `expand` is what turns a
     compound cell into the primitives that have layouts, and it reports what it expanded, which is
     returned rather than logged - a figure has no console, and a caller that wants to say
     "two cells, one expanded from a half adder" should be able to. */
  function planFor(netlist, rowWidthLambda, rows, opts) {
    var P = window.PNR;
    opts = opts || {};
    if (!P) return null;
    /* CAUGHT, because the text is a caller's: a placement figure may be handed the editor's current
       contents, and that is RTL or a testbench as often as it is a netlist - `always @` is not
       something this parser can read. A figure that cannot be drawn is an empty box and a reason,
       never an exception that takes the rest of the page's load with it. */
    var parsed;
    try {
      parsed = P.parse(netlist);
    } catch (e) {
      return { error: (e && e.message) || String(e), plan: { placed: [], unplaceable: [] },
               expanded: [], unplaceable: [] };
    }
    /* FLATTENED BEFORE IT IS EXPANDED, and the two are different steps: `parse` reads every
       module and hands back the TOP's own instances plus the module map, `flatten` walks that
       hierarchy down to the cell library and the macros, and `expand` turns a macro into the
       primitives that have layouts. Without the middle one a sub-module instance goes straight
       to the placer, which has no layout for it, so it is dropped into `unplaceable` and simply
       missing from the picture - measured on the counter-4bit netlist as 19 cells synthesized
       and 13 drawn, with the synthesizer's generated `FUNC_add4` absent and nothing on the page
       saying so. It is guarded because a page may be carrying an older slice, where the honest
       fallback is the top level rather than no figure at all.

       `flatten` also REPORTS: a wrapper whose statements are not instances, a pin wired to
       several nets, a module that instantiates itself. Those are returned so a caller with a
       console can say them - `problems` rather than thrown, since a partial figure plus a
       reason beats an exception that takes the rest of the page's load with it. */
    var flat = P.flatten ? P.flatten(parsed) : { instances: parsed.instances, problems: [] };
    var ex = P.expand(flat.instances);
    /* A ROW COUNT WINS OVER A WIDTH, because it is the more specific request: a figure that says
       `rows: 4` has decided its shape, and a width left beside it in the topic file would be a
       second answer to the same question. The width path is what every figure used before and is
       untouched where no count is given.

       AND `shape: 'squarest'` IS A THIRD, OPT-IN ANSWER, which is the app's: `P.squarest` runs one
       placement per candidate row count and keeps the one closest to square. It is opt-in rather
       than the default for the honest reason that a figure in an article column WANTS one wide row
       - a topic saying `rows: 1` and a topic saying nothing mean the same thing there - where a
       full-width card wants the whole design to read at once, which is what one row of 25 cells
       does not do. `Baerilog/code2silicon.html` is the only caller today. Guarded, so an older
       slice costs the shape and not the figure. */
    var budget = (rowWidthLambda || 0) * 1000 || Infinity;
    var plan;
    if (rows > 0) {
      plan = P.place(ex.instances, { rows: rows });
    } else if (opts.shape === 'squarest' && P.squarest) {
      var shaped = P.squarest(ex.instances);
      plan = shaped.plan;
      budget = shaped.budget;
    } else {
      plan = P.place(ex.instances, budget);
    }
    /* AND ROUTED, unless a figure says otherwise. A placement with no wires is a floorplan, which is
       a fair thing to draw and not what these figures are for - the netlist says which cells connect
       to which, and a picture that leaves that out asks the reader to take it on trust. `route: false`
       is there for a figure that wants the bare arrangement; nothing uses it yet. `P.route` is guarded
       because a page may be carrying an older slice, where a missing router should cost the wires and
       not the whole figure.

       `opts.ring` IS PASSED THROUGH AND IS OFF BY DEFAULT, which is what keeps the twenty topic figures
       exactly as they are: a power ring gives the block a margin on each side, so it changes the
       drawing's width, its aspect and the fit that sizes it - measured, switching it on for everything
       moved four topics' quoted µm widths (`decoder-2to4` 239.2 to 312), stopped three figures filling
       their columns, and put a CALU1 badge on pages with no page colour for one. The apps ask; a figure
       in an article column does not. */
    if (opts.route !== false && P.route) P.route(plan, { ring: !!opts.ring });
    /* A PIN THE LAYOUT DOES NOT HAVE is reported here rather than by each caller, so the two apps
       cannot word it differently or one of them forget: a net wired to a pin no cell provides is a
       wire the router cannot make, which is not a detail. */
    var pinProblems = [];
    (plan.placed || []).forEach(function (p) {
      Object.keys(p.inst.conn || {}).forEach(function (pin) {
        if (!p.cell.pins[pin]) {
          pinProblems.push(p.inst.name + ' (' + p.inst.type + ') has no pin "' + pin
                           + '" in its layout');
        }
      });
    });
    return { plan: plan, expanded: ex.expanded || [], module: parsed.name,
             problems: (flat.problems || []).concat(flat.notes || []),
             pinProblems: pinProblems,
             /* The budget this plan was placed at, in whole LAMBDA, which is what `rowWidth` takes -
                so a second drawing of the same design can be asked for the same arrangement. Where
                the shape was searched for, this is the only way to know what it chose. */
             rowLambda: isFinite(budget) ? Math.round(budget / 1000) : 0,
             topInstances: parsed.instances.length,
             flatInstances: flat.instances.length,
             unplaceable: plan.unplaceable || [] };
  }

  /* Draw one placement into `el`. Returns what was drawn, for a caller to assert on and for a
     harness to read back: the numbers a picture cannot be questioned about otherwise. */
  function drawStatic(el, opts) {
    var out = { cells: 0, types: [], rows: 0, expanded: [], unplaceable: [], width: 0, height: 0 };
    if (!el || !opts || !opts.netlist) return out;
    var built = planFor(opts.netlist, opts.rowWidth, opts.rows, opts);
    if (built && built.error) { el.innerHTML = ''; out.error = built.error; return out; }
    if (!built || !built.plan.placed.length) {
      /* A netlist naming cells this library has no layout for places NOTHING, and that has to be
         visible: an empty box on a page is indistinguishable from a bug. */
      el.innerHTML = '';
      out.unplaceable = built ? built.unplaceable : [];
      return out;
    }
    var view = opts.view || DEFAULT_VIEW;
    var P = window.PNR;
    var art = P.placementSvg(built.plan, view);
    if (!art) { el.innerHTML = ''; return out; }

    var rows = built.plan.height / P.rowHeight;
    var h = (opts.rowPx || ROW_PX) * rows;
    var w = built.plan.width / built.plan.height * h;

    /* An INNER wrapper of exactly the drawing's size, because that is what `margin: 0 auto` can
       centre - and because the container is left to size itself in flow. An inline height on the
       container would be a border-box height that has to leave room for its own padding and
       border, which is the arithmetic that silently clipped the netlist figures. */
    el.innerHTML = '';
    var inner = document.createElement('div');
    inner.className = 'pnr-static';
    inner.style.position = 'relative';
    inner.style.margin = '0 auto';
    inner.style.width = px(w);
    inner.style.height = px(h);
    el.appendChild(inner);

    /* The SVG carries the placement's own coordinate system in its viewBox and is sized in CSS
       pixels, so the layout scales without a single number in the markup changing. `svg` has to be
       created in the SVG namespace or a browser makes an unknown HTML element and draws nothing -
       the same reason the netlist viewer's edge layer uses createElementNS. */
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', art.viewBox);
    svg.setAttribute('width', String(Math.round(w)));
    svg.setAttribute('height', String(Math.round(h)));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = art.markup;
    inner.appendChild(svg);

    /* THE DESIGN'S CELLS, NOT EVERY CELL ON THE WAFER, and that is what every caller of this means: the
       report line compares it against the flattened netlist, and a topic figure asserts "every cell
       placed" against the number the design instantiates. `place` now also inserts FILLER to carry the
       rails across the gap at the end of each row, so the two counts differ - `fillers` is the other
       one, reported beside it rather than folded in. */
    out.cells = built.plan.cells === undefined ? built.plan.placed.length : built.plan.cells;
    out.fillers = built.plan.fillers || 0;
    /* WHICH cells, not just how many: a figure that follows the design has to be checkable against
       what the design says, and "one cell" is true of an AND and of a NOR alike. */
    out.types = built.plan.placed.map(function (p) { return p.inst.type; });
    /* The numbers a caption states, computed HERE so the figure and its caption cannot disagree
       about what was placed: the tally, and the extent in microns rather than in the lambda units
       the placement is laid out in. */
    out.tally = tally(out.types);
    out.layers = layersIn(art.markup);
    out.lambdaUm = LAMBDA_UM;
    out.umWidth = um(built.plan.width);
    out.umHeight = um(built.plan.height);
    out.rows = rows;
    out.expanded = built.expanded;
    out.unplaceable = built.unplaceable;
    /* Carried out to the caller for the same reason `unplaceable` is: a figure has no console,
       and a page that has one (code2silicon's Report) should be able to say what the flattener
       found rather than leaving it to be inferred from a drawing that is short of cells. */
    out.problems = built.problems || [];
    out.pinProblems = built.pinProblems || [];
    /* THE BUDGET THIS DRAWING WAS PLACED AT, so a second drawing of the same design can ask for
       the same arrangement (`rowWidth: rowLambda`). Where `shape: 'squarest'` searched for it,
       this is the only way to know what it chose - and two drawings of one design that disagree
       about its shape is the whole hazard. */
    out.rowLambda = built.rowLambda || 0;
    /* THE BLOCK'S FULL EXTENT IN PLACEMENT UNITS, which is not the cells' extent once there is a power
       ring: `route` gives the block a margin on each side and the svg's viewBox spans the whole of it, so
       anything converting a pointer position into a placement coordinate has to measure against this and
       not against the rightmost cell. `out.width` beside it is a PIXEL width for the box - two fields one
       letter apart in meaning, which is why this one is named after the plan it comes from. */
    out.planWidth = built.plan.width;
    out.planHeight = built.plan.height;
    out.ring = (built.plan.routes && built.plan.routes.power) || null;
    out.topInstances = built.topInstances || 0;
    out.flatInstances = built.flatInstances || 0;
    out.width = w;
    out.height = h;
    out.view = view;
    out.layer = inner;
    /* WHERE EACH CELL LANDED, and the SVG itself, because the cross section needs both: a cut is at
       a placement x, and only the cell under it has a stack to draw. Kept as data rather than
       re-derived from the DOM, so a headless caller sees the same numbers a browser does. */
    /* `flip` travels with the cell, because a mirrored cell's own stack is mirrored with it: the
       cross section reads this list to draw what is under a cut, and on a flipped cell metal is at
       the bottom and the implants at the top. No section figure wraps today - they are one and
       three cells - so nothing reads it yet, and carrying it is what stops the first one that does
       from drawing an upside-down stack with nothing to say so. */
    out.placed = built.plan.placed.map(function (p) {
      return { type: p.inst.type, name: p.inst.name, x: p.x, y: p.y, w: p.cell.w, h: p.cell.h,
               flip: !!p.flip };
    });
    out.flips = built.plan.rows.map(function (r) { return !!r.flip; });
    /* THE WIRING, as data: how many nets were connected, how many pins the design leaves as I/O, and
       anything the router could not do. A caption states the first two and a harness reads all three -
       a router that quietly skipped a net would otherwise look exactly like one that had none to do. */
    var rt = built.plan.routes;
    out.routes = rt || null;
    out.nets = rt ? rt.nets.length : 0;
    out.ioNets = rt ? rt.io.length : 0;
    out.unrouted = rt ? rt.unrouted.length : 0;
    out.svg = svg;

    /* TWO LOOKS AT ONE PLACEMENT. The buttons are the CALLER'S - learn.js owns them, as it already
       owns the cross section's mask column - and what this file owns is what it drew, so the two
       switches are closures over the plan and the <svg> it made rather than a second entry point
       that would have to rebuild both and could disagree with this one.

       `setView` RE-RENDERS ON THE SAME PLAN, which is the whole reason it is safe: the placement and
       the routing are untouched, so the viewBox, the box's size, the cell count and every micron in
       the caption stay exactly as they were and only the cells' own artwork is swapped for the
       abstract underneath it. Rebuilding the plan would re-run the placer and the router - both
       deterministic, so it could not move, but it would be a second opportunity for it to.

       `setRouting` is a CLASS rather than a redraw, because placementSvg already puts every wire in
       one `.pnr-routing` group: hiding them is one rule in pnr.css, the cells are not re-drawn, and
       the wires come back in the state they left. */
    out.setView = function (name) {
      var next = name || DEFAULT_VIEW;
      var v = P.placementSvg(built.plan, next);
      if (!v) return out.view;
      svg.innerHTML = v.markup;
      out.view = next;
      /* Re-read, because the two views do not draw the same masks: the abstract has `CALU1` in it
         and none of the diffusions, so a legend derived from this would otherwise describe the
         picture the reader is no longer looking at. */
      out.layers = layersIn(v.markup);
      return out.view;
    };
    out.setRouting = function (on) {
      inner.classList.toggle('pnr-no-routing', !on);
      out.routingShown = !!on;
      return out.routingShown;
    };
    /* HOW MANY WIRE SHAPES THERE ARE, so a caller can tell whether a Routing button would do
       anything at all: a one-cell figure has nothing to connect, and a control that cannot change
       what is on screen is the dead control this site keeps designing against. */
    out.routeShapes = rt ? rt.shapes.length : 0;
    /* And the opening state, from the topic: `routing: false` for a figure that wants the bare
       placement first. Absent means the wires are shown, which is what every figure does today, so
       no topic file has to change and no page's picture moves. */
    if (opts.routing === false) out.setRouting(false);
    else out.routingShown = true;
    return out;
  }

  /* THE LAYERS PRESENT IN A DRAWING, read off the markup rather than out of the DOM: the generated
     SVG is a string at this point, and a regex over it needs no element to have been laid out - which
     also means the answer is the same headlessly as in a browser.

     A label drops the `layer-` prefix and the `_ALL` suffix the .ap export adds, because `POLY` is the
     name of the mask and `POLY_ALL` is a detail of how that file was written. Two classes that would
     collapse to one label keep their full names instead, so the buttons can never be ambiguous about
     what they switch. */
  /* THE MASK NAMES A READER KNOWS, against the names the .ap files use. `ALU1` is Alliance's name for
     the first metal layer and `NDIF` for n-diffusion; neither is what a page about silicon should put
     in front of someone meeting the layers for the first time. Only the ones that differ are listed -
     POLY and POLY2 are already the mask names - and anything unlisted keeps the artwork's own name
     rather than being guessed at, which is why `CALU1` (the metal-1 connector, drawn only in the
     Abstract view) is absent rather than invented. */
  /* The ROUTING layers are named here beside the cells' own, because the legend and the layer
     toggles are both derived from what the drawing contains: a class with no name in this table
     reads as its raw Alliance spelling (`ALU2_ALL`), which is the tool's word and not the reader's. */
  var LAYER_NAME = { ALU2: 'METAL2', ALU3: 'METAL3', CONT_VIA: 'VIA1', CONT_VIA2: 'VIA2',
                     ALU1: 'METAL1', CONT: 'CONTACT', NDIF: 'N-DIFF', NWELL: 'N-WELL',
                     PDIF: 'P-DIFF' };

  /* THE ORDER THE BUTTONS SIT IN IS THE MASK STACK, top of the wafer downwards - metal, the contacts
     under it, the two polys, the two diffusions, then the well the whole cell sits in. It replaced an
     alphabetical sort, which is an ordering of the WORDS rather than of the thing they name: CONTACT
     came before METAL1 because C precedes M, so the column read as a list with no structure and a
     reader could not use it to descend through the layers one at a time.

     Ranked by the MASK name, so a layer is placed by what it is rather than by which .ap class drew
     it. Anything not on this list keeps its alphabetical place after the ones that are, which is the
     same refusal-to-guess this file makes about the names: measured across the library, the only such
     layer that is ever actually drawn is `CALU1`, the metal-1 connector in the Abstract view, and
     inventing a stratum for it would be a claim about the process that nothing here checks. */
  var LAYER_STACK = ['METAL3', 'VIA2', 'METAL2', 'VIA1', 'METAL1', 'CONTACT', 'POLY2',
                    'POLY', 'P-DIFF', 'N-DIFF', 'N-WELL'];

  /* Each layer's own colour, read out of the cell stylesheet the drawing carries. Parsed once, because
     that string is 3KB and never changes within a page.

     THE TEXT COLOUR IS COMPUTED, not tabulated, so a re-export that changes one hex cannot silently
     produce an unreadable badge. And it is chosen by MEASURED CONTRAST rather than by a luminance
     threshold, which is a correction: a >0.5 split put white on POLY2's #e8590c at 3.58:1, under the
     4.5 that text this size needs, where dark on the same orange is 5.27. Trying both candidates and
     keeping the better one is one line more and cannot be wrong by a threshold's placement. */
  var layerColours = null;
  function coloursOf() {
    if (layerColours) return layerColours;
    layerColours = {};
    var css = (window.PNR && window.PNR.cellStyle) || '';
    var re = /\.layer-([A-Z0-9_]+)\s*\{\s*color:\s*(#[0-9a-fA-F]{6})/g, m;
    while ((m = re.exec(css))) layerColours['layer-' + m[1]] = m[2];
    return layerColours;
  }
  /* WCAG relative luminance: sRGB channels linearised, then weighted. The same formula the contrast
     ratio is defined in terms of, which is why it is here rather than the simpler weighted average -
     the two disagree exactly where a badge is borderline. */
  function relLum(hex) {
    var out = 0, w = [0.2126, 0.7152, 0.0722];
    for (var i = 0; i < 3; i++) {
      var c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
      out += w[i] * (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    }
    return out;
  }
  function contrast(a, b) {
    var x = relLum(a) + 0.05, y = relLum(b) + 0.05;
    return x > y ? x / y : y / x;
  }
  /* The two candidates are the panel tokens rather than literal black and white, so a badge sits in
     the same palette as everything around it. */
  function readableOn(hex) {
    if (!hex) return null;
    var dark = '#0d1117', light = '#ffffff';
    return contrast(hex, dark) >= contrast(hex, light) ? dark : light;
  }

  /* THE COLOUR A BADGE CAN BE PAINTED IN, which is not always the artwork's own. A layer colour is
     chosen to read against the other MASKS in a drawing, not against the page a control sits on, and
     CONTACT is `#111111`: on a dark page that badge was a black outline with black text, i.e. absent.
     So the colour is lifted toward the page's foreground until it clears 3:1, and only when it has to
     be - measured, every other layer in this library already clears it in dark mode, and in light mode
     only P-DIFF's yellow and N-WELL's grey move at all, both darker and both more readable for it.

     The SHAPES keep the artwork's colours untouched: they sit on the wafer's own fixed materials, not
     on the page, so they have no contrast problem to solve. This is about the control only. */
  function pageColour(hex, bgOverride) {
    if (!hex) return hex;
    var dark = false;
    try {
      dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) { dark = false; }
    /* `bgOverride` is a testing seam and is named as one: the mode is read from the browser, so a
       check has no other way to ask what this returns for the mode it is not running in - and the
       CONTACT case only exists in dark mode. */
    var bg = bgOverride || (dark ? '#0d1117' : '#f6f8fa');
    var toward = relLum(bg) < 0.2 ? 255 : 0;
    if (contrast(hex, bg) >= 3) return hex;
    var out = hex;
    for (var k = 1; k <= 10; k++) {
      var mix = '#';
      for (var i = 0; i < 3; i++) {
        var c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
        var v = Math.round(c + (toward - c) * (k / 10));
        mix += ('0' + v.toString(16)).slice(-2);
      }
      out = mix;
      if (contrast(out, bg) >= 3) break;
    }
    return out;
  }

  /* WHAT A LAYER CLASS IS CALLED and where it sits in the stack, in one place each: `layersIn` reads
     them off a drawing's markup and `legendOf` off the shapes a section drew, and a palette built from
     one that disagreed with the other about METAL1's name or its position would be two legends for one
     wafer. The `_ALL` suffix is the .ap exporter's, and `ALU1` is what the artwork calls metal 1 where
     `METAL1` is what a reader needs. */
  function labelOfClass(c) {
    var raw = c.replace(/^layer-/, '').replace(/_ALL$/, '');
    return LAYER_NAME[raw] || raw;
  }
  function rankOfClass(c) {
    var i = LAYER_STACK.indexOf(labelOfClass(c));
    return i < 0 ? LAYER_STACK.length : i;
  }
  /* ONE PILL'S WORTH OF FACTS about a layer. `colour` is what the SHAPES are painted in - the
     artwork's own - and `onPage` is what a control beside them may be painted in. Two fields because
     they answer two questions, and a badge that used the first was invisible in dark mode. */
  function metaOfClass(c, label) {
    var cols = coloursOf();
    return { cls: c, label: label || labelOfClass(c), colour: cols[c] || null,
             onPage: pageColour(cols[c] || null), textOn: readableOn(cols[c]) };
  }
  /* THE LEGEND FOR A SECTION, from the classes it actually put on elements rather than from the masks
     it was asked for - the same reported-not-recomputed rule the regions and the zones follow. It is
     what lets a palette exist before anything is placed: the ideal pair has no layout beside it, so
     there is no `layersIn` result to build one from, and a card with no palette would be a card whose
     mask buttons appear only once a design has been placed. */
  function legendOf(classes) {
    return (classes || []).slice().sort(function (a, b) {
      return rankOfClass(a) - rankOfClass(b) || (a < b ? -1 : 1);
    }).map(function (c) { return metaOfClass(c); });
  }

  function layersIn(markup) {
    var seen = {}, order = [];
    var re = /class="([^"]*)"/g, m;
    while ((m = re.exec(markup))) {
      m[1].split(/\s+/).forEach(function (c) {
        if (c.indexOf('layer-') !== 0 || seen[c]) return;
        seen[c] = true;
        order.push(c);
      });
    }
    var label = {}, taken = {};
    order.forEach(function (c) {
      label[c] = labelOfClass(c);
      taken[label[c]] = (taken[label[c]] || 0) + 1;
    });
    /* Sorted on `label[c]` - the mask name BEFORE the ambiguity fallback below - so two classes that
       collapse to one mask still sit together in the stack even though their buttons end up carrying
       their .ap names. The class is the last tie-break, so the row is stable rather than depending on
       the order the regex happened to meet the shapes in. */
    var rank = rankOfClass;
    return order.slice().sort(function (a, b) {
      return rank(a) - rank(b)
             || (label[a] < label[b] ? -1 : label[a] > label[b] ? 1 : (a < b ? -1 : 1));
    }).map(function (c) {
      return metaOfClass(c, taken[label[c]] > 1 ? c.replace(/^layer-/, '') : label[c]);
    });
  }

  /* Show or hide one layer inside a drawing. The DOM work is here rather than in the caller because
     this file owns what it drew; the caller owns the buttons. */
  function setLayerVisible(el, cls, on) {
    if (!el) return 0;
    var nodes = el.querySelectorAll('.' + cls);
    for (var i = 0; i < nodes.length; i++) nodes[i].style.display = on ? '' : 'none';
    return nodes.length;
  }

  /* Which cells can be drawn at all. A figure naming one this library has no layout for is an
     authoring mistake with no symptom on the page, so a caller is expected to ask. */
  function placeableCells() {
    var P = window.PNR;
    return P ? Object.keys(P.cells()) : [];
  }

  /* ================================ THE CROSS SECTION ================================
   *
   * A vertical cut through the placement, drawn as the wafer beside it. The cut is vertical
   * because that is what makes the textbook picture: these cells put NDIF at the vss rail and PDIF
   * at the vdd rail, so a cut across the cell's HEIGHT walks substrate, NMOS, the well edge, PMOS -
   * left to right, exactly the arrangement a process diagram draws. The section's horizontal axis
   * is therefore the cell's y, and its vertical axis is DEPTH.
   *
   * ONE THING HERE IS NOT DERIVED, and it is the whole of what this feature adds: depth. A .ap file
   * is a set of masks with no z at all, so `STRATA` below assigns each mask a depth band - implants
   * under the surface, poly on it, metal above it, contacts as plugs between. That is process
   * knowledge, stated in one table so it can be argued with, and it is the only invented number in
   * this file. Everything else - which masks are present, where they start and stop, what the cut
   * crosses - is read off the same artwork the layout beside it is drawn from.
   *
   * The section reuses the LAYER CLASSES of the layout (`layer-NDIF_ALL` and friends), which is
   * what makes the layer buttons govern both panels with no extra wiring: setLayerVisible above
   * queries the whole box, so one press hides a mask in the layout and in the section together.
   * It is also why the animation needs no notion of visibility of its own.
   */

  /* Depth bands, in milli-lambda, measured from the wafer surface: negative is above it, positive
     is into it. The numbers are a legible drawing rather than a claim about any real process -
     a 6-lambda-thick metal is nobody's silicon - and they are here rather than in CSS because they
     are geometry the section's own arithmetic reads.

     Keyed by the MASK name, which is what layersIn already resolves a class to, so a layer with no
     band (CALU1, drawn only in the Abstract view) is simply absent from the section rather than
     being given a depth nothing here could justify. */
  var STRATA = {
    /* THE ROUTING STACK, above METAL1 and in the order a wafer is built: metal, a via through the
       oxide, metal, a via, metal. Each metal is 4000 like METAL1's and each via 3000, which puts
       METAL3's top at -32000 - so the whole depth is 48000 against a 72000-wide cell, 1.5:1 where it
       was 2:1 with one metal. That is the cost of drawing three layers instead of one, and it is why
       the vias are thinner than the metals rather than matching them. */
    'METAL3':  { top: -32000, bottom: -28000 },
    'VIA2':    { top: -28000, bottom: -25000 },
    'METAL2':  { top: -25000, bottom: -21000 },
    'VIA1':    { top: -21000, bottom: -18000 },
    'METAL1':  { top: -18000, bottom: -14000 },
    'POLY2':   { top: -11000, bottom: -8000  },
    'POLY':    { top: -5000,  bottom: -1000  },
    'N-DIFF':  { top: 0,      bottom: 5000   },
    'P-DIFF':  { top: 0,      bottom: 5000   },
    'N-WELL':  { top: 0,      bottom: 13000  }
  };
  /* THE TOTAL DEPTH IS 36000 AGAINST A 72000-WIDE CELL, i.e. 2:1, and that ratio is the reason
     these numbers are what they are. The depth axis is invented, so its scale is free - and a
     browser is what settled it: at an earlier 62000 the section rendered 465px tall beside a 220px
     layout and dominated the figure it was meant to sit next to. 2:1 is also the aspect the process
     diagram this was built from uses, for the same reason: a wafer is wide and shallow. */
  var SEC = {
    /* HEADROOM ABOVE THE METAL, because the region captions live up here: at -20000 they were drawn
       inside the METAL1 band and collided with its own M1 tags. */
    top: -38000,          // top of the drawing, above the highest metal
    surface: 0,           // the wafer surface: poly sits on it, implants go into it
    floor: 16000,         // bottom of the substrate
    oxideTop: -14000,     // the ILD fills from the surface up to the metal
    gateOxide: 1000,      // the sliver of oxide under a gate, drawn where poly meets diffusion
    contactTop: -14000    // a plug hangs from the metal down to whatever it lands on
  };
  /* Back to front, so a shape that sits inside another is drawn after it. Not the button column's
     order (that one descends the stack for a reader); this one is a painting order. */
  var SEC_PAINT = ['N-WELL', 'N-DIFF', 'P-DIFF', 'POLY', 'POLY2', 'CONTACT', 'METAL1',
                   'VIA1', 'METAL2', 'VIA2', 'METAL3'];

  /* Every subpath the .ap exporter writes is one axis-aligned rectangle - `union_path_d` emits
     `M x1 y1 L x2 y1 L x2 y2 L x1 y2 Z` per disjoint piece, measured across the library as 1,351
     of 1,351 - so geometry parses as a bbox read and no polygon scanline is needed. A subpath that
     is NOT a rectangle is skipped rather than guessed at, which is what keeps that measurement
     from silently becoming an assumption. */
  function rectsOfBody(body) {
    var out = {}, m;
    var reRect = /<rect class="[^"]*\blayer-([A-Z0-9_]+)\b[^"]*" x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g;
    while ((m = reRect.exec(body))) {
      var x = +m[2], y = +m[3];
      (out['layer-' + m[1]] || (out['layer-' + m[1]] = [])).push([x, y, x + +m[4], y + +m[5]]);
    }
    var rePath = /<path class="[^"]*\blayer-([A-Z0-9_]+)\b[^"]*" d="([^"]+)"/g;
    while ((m = rePath.exec(body))) {
      var cls = 'layer-' + m[1], list = out[cls] || (out[cls] = []);
      m[2].split('Z').forEach(function (sub) {
        var pts = sub.match(/[-\d.]+ [-\d.]+/g);
        if (!pts || pts.length !== 4) return;
        var xs = [], ys = [];
        pts.forEach(function (p) {
          var a = p.split(' ');
          xs.push(+a[0]); ys.push(+a[1]);
        });
        var x1 = Math.min.apply(null, xs), x2 = Math.max.apply(null, xs);
        var y1 = Math.min.apply(null, ys), y2 = Math.max.apply(null, ys);
        if (x1 === x2 || y1 === y2) return;
        list.push([x1, y1, x2, y2]);
      });
    }
    return out;
  }

  var geomCache = {};
  function geomOf(type) {
    if (geomCache[type]) return geomCache[type];
    var P = window.PNR, cells = P && P.cells();
    var cell = cells && cells[type];
    var view = cell && cell.views && (cell.views.all || cell.views.phantom);
    geomCache[type] = view ? rectsOfBody(view.body) : {};
    return geomCache[type];
  }

  /* MASK NAME PER CLASS, the same resolution the buttons use, so the section and the badge beside
     it cannot disagree about what a class is. */
  function maskOf(cls) {
    var raw = cls.replace(/^layer-/, '').replace(/_ALL$/, '');
    return LAYER_NAME[raw] || raw;
  }

  /* AND THE INVERSE, WHICH IS DERIVED RATHER THAN TABULATED: mask name -> the class the artwork
     actually uses for it. The ideal pair knows only mask names, and `layer-N-WELL` is not a class
     anything here draws - the artwork's are `layer-NWELL`, `layer-ALU1_ALL`, `layer-CONT_ALL`. That
     mismatch is not cosmetic and it cost two bugs at once: the shapes fell back to a black default
     because no colour resolved, and `setLayerVisible` - which queries by class - could not see them,
     so the layer badges governed the layout and left the ideal drawing alone. Built from the
     stylesheet's own keys, so a re-export that renames a layer moves this with it. */
  /* The router's layers, as masks: `layersIn` resolves a class to a mask name and the section keys
     everything on that, so the two tables have to agree about what ALU2 is called. */
  var ROUTE_MASK = { ALU2: 'METAL2', ALU3: 'METAL3', CONT_VIA: 'VIA1', CONT_VIA2: 'VIA2' };

  var classForMask = null;
  function classOfMask(mask) {
    if (!classForMask) {
      classForMask = {};
      Object.keys(coloursOf()).forEach(function (cls) {
        var m = maskOf(cls);
        /* THE UNION CLASS WINS, and it has to be asked for rather than assumed to come first: the
           stylesheet lists `.layer-NDIF` before `.layer-NDIF_ALL`, so "first wins" resolved N-DIFF to
           the raw INPUT layer - which no drawing here paints with, so the shape came out black and no
           badge could hide it. `_ALL` is what `_all.svg` and every placement draw. */
        if (!classForMask[m] || /_ALL$/.test(cls)) classForMask[m] = cls;
      });
    }
    return classForMask[mask] || 'layer-' + mask;
  }

  /* What the cut crosses, per mask: the intervals along the WHOLE PLACEMENT's height. This is the
     whole of the derivation - everything the section draws is one of these intervals given a depth.

     THE CUT CROSSES EVERY ROW, not the first one. A vertical line through a two-row placement passes
     through a cell in each, and the section is the wafer along that line: one substrate, with each
     row's own well, diffusions, poly and metal in its own stretch of it. taking the first hit and stopping
     is what made this a picture of one cell, and it is what a reader comparing the drawing
     with the layout beside it would have found disagreeing - the layout shows three rows of cells and
     the section showed the top one.

     THE AXIS IS ABSOLUTE y, MEASURED UP FROM THE PLACEMENT'S BOTTOM, and a single-row placement is
     therefore unchanged by construction: `TOTAL - y` with TOTAL = one row is exactly the
     `h - (y - cell.y)` the one-cell version used, so every learn figure draws what it drew.

     AND THE MIRROR IS APPLIED TO THE CELL rather than to the wires, which is where it belongs. Every
     odd row is flipped so its rails abut the row below, so its artwork's own y-up runs the other way;
     the wires are in placement coordinates and need no flip at all. That branch was unreachable while
     a cut could only land on the first row - the file said so, and said it would be needed the day a
     cut could choose its row. This is that day. */
  function cellsAtCut(res, cutX) {
    var hits = [];
    ((res && res.placed) || []).forEach(function (p) {
      if (cutX >= p.x && cutX <= p.x + p.w) hits.push(p);
    });
    return hits;
  }
  /* HOW FAR THE CUT RUNS: the placement's own height, from the cells rather than from `res.height`,
     which is a PIXEL height for the box the layout is drawn in. Mixing the two would scale every
     interval by the zoom. */
  function cutSpan(res) {
    var t = 0;
    ((res && res.placed) || []).forEach(function (p) { t = Math.max(t, p.y + p.h); });
    return t;
  }

  /* ===================== HOW MANY ROWS A SECTION SHOWS =====================
     A CUT THROUGH SEVENTEEN ROWS IS SEVENTEEN ROWS A FEW PIXELS TALL, which is the problem this
     answers. The section's axis is the placement's whole height, so the taller the floorplan the
     less of it a reader can make out - the region captions were already suppressed past two rows
     for exactly that reason, and suppressing the words does nothing about the shapes. So a cut is
     now a POSITION rather than only an x: which rows to show, and where.

     THE ROW INDEX IS ARITHMETIC, NOT A SEARCH. `pnr.js`'s `place` lays every row at `i * CELL_H`,
     so a placement y names its row exactly - and the pitch is read from the ENGINE's own constant
     rather than restated here, or the two would be free to disagree about it. Row 0 is the TOP row
     of the drawing, which is the sense `y` already has in the placement's coordinates. */
  function rowPitch() { var P = window.PNR; return (P && P.rowHeight) || 72000; }
  function rowsIn(res) { return Math.max(1, Math.round(cutSpan(res) / rowPitch())); }

  /* WHICH ROWS, as ONE function, because four things read the answer and none of them may differ:
     the section's own frame, the cut marker on the layout, the hover marker, and the stops a drag
     snaps to. `maxRows` is a CAP and `row` is the row the reader pointed at; the window is CENTRED
     on that row and clamped to the placement, so the chosen row is always inside what is drawn.

     NULL MEANS THE WHOLE PLACEMENT, and that is the load-bearing half: a cap of four on a four-row
     design produces no window at all rather than a window that happens to cover everything, so
     every existing caller and every learn figure - one and three rows - takes the identical path it
     always did. Byte-identity by construction, not by arithmetic that happens to agree.

     WITH AN EVEN CAP THERE IS NO MIDDLE ROW to centre on, so the extra row goes BELOW the pointer
     (`floor((n-1)/2)` rows above it). That is a choice rather than a rounding, and it is why the
     clamp at both ends is stated: near the top or the bottom of the placement the pointer's row is
     still in the window but no longer in the middle of it, which is what a clamp means. */
  function cutWindow(res, maxRows, row) {
    var total = rowsIn(res);
    var n = Math.floor(maxRows) > 0 ? Math.min(total, Math.floor(maxRows)) : total;
    if (n >= total) return null;
    var r = Math.max(0, Math.min(total - 1, Math.floor(row) || 0));
    return { first: Math.max(0, Math.min(total - n, r - Math.floor((n - 1) / 2))), count: n };
  }
  /* THE WINDOW IN PLACEMENT COORDINATES - the y of its top edge and of its bottom edge. This is the
     one conversion from rows to the units everything else here is in: the section measures its frame
     from `y2`, and the marker on the layout is drawn between the two. Clamped to the placement, so a
     window reaching past the last row describes silicon rather than empty page. */
  function windowY(res, win) {
    var span = cutSpan(res);
    if (!win) return { y1: 0, y2: span };
    var p = rowPitch();
    return { y1: Math.max(0, Math.min(span, win.first * p)),
             y2: Math.max(0, Math.min(span, (win.first + win.count) * p)) };
  }

  /* `win` is optional and absent means the whole placement, which is what every caller written
     before the row window passes and what keeps their drawings identical. */
  function sectionAt(res, cutX, win) {
    var ys = windowY(res, win);
    /* A CELL IS IN THE WINDOW IF ITS ROW IS, tested on the row's own two edges rather than on its
       centre - so a cell is wholly in or wholly out and no row can be drawn half-height. */
    var hits = cellsAtCut(res, cutX).filter(function (p) {
      return p.y >= ys.y1 && p.y + p.h <= ys.y2;
    });
    if (!hits.length) return null;
    /* THE FRAME IS THE WINDOW'S, and `ys.y2` is what every conversion below subtracts from. With no
       window that is the placement's own height and the whole derivation is unchanged. */
    var TOTAL = ys.y2 - ys.y1;
    var by = {}, rows = [];
    /* Bottom of the placement first, so the drawing reads in the same direction as the axis and a
       report of the rows is in the order they appear on it. */
    hits.slice().sort(function (a, b) { return (b.y + b.h) - (a.y + a.h); }).forEach(function (cell) {
      var base = ys.y2 - (cell.y + cell.h);       // where this row's own frame starts along the cut
      var local = cutX - cell.x;
      var geom = geomOf(cell.type);
      rows.push({ type: cell.type, name: cell.name, base: base, h: cell.h,
                  flip: !!cell.flip, local: local, cell: cell });
      Object.keys(geom).forEach(function (cls) {
        var mask = maskOf(cls);
        geom[cls].forEach(function (r) {
          if (r[0] > local || local > r[2]) return;
          var a = cell.flip ? (base + cell.h - r[3]) : (base + r[1]);
          var b = cell.flip ? (base + cell.h - r[1]) : (base + r[3]);
          if (!by[mask]) by[mask] = { cls: cls, intervals: [] };
          by[mask].intervals.push([Math.min(a, b), Math.max(a, b)]);
        });
      });
    });
    /* AND THE WIRES OVER IT, which are the PLACEMENT's shapes rather than any cell's - so they are
       already in the frame this axis is built from and convert with one subtraction. A wire that
       passes over a row this cut has no cell in is still on the cut and is still drawn: that is the
       whole point of a section across the rows, since METAL2 and METAL3 run between them.

       A cut is a vertical line, so a METAL2 column AT that x reads as a tall band and a METAL3 span
       CROSSING it reads as a short segment at its own track. That asymmetry is the picture being
       honest about which layer runs which way.

       A WIRE OUTSIDE THE WINDOW IS CLIPPED BY THE SAME TEST that already dropped one off the
       placement: a route wholly above the window converts to `lo >= TOTAL`, one wholly below to
       `hi <= 0`, and either way `hi <= lo` throws it out. Clipping rather than a second rule,
       because a wire running over the rows the reader is not looking at is genuinely not at any
       depth in this frame. */
    var routes = (res && res.routes && res.routes.shapes) || [];
    routes.forEach(function (r) {
      if (cutX < r.x || cutX > r.x + r.w) return;
      var mask = ROUTE_MASK[r.layer];
      if (!mask) return;
      var lo = Math.max(0, ys.y2 - (r.y + r.h)), hi = Math.min(TOTAL, ys.y2 - r.y);
      if (hi <= lo) return;                       // entirely off the placement, or outside the window
      if (!by[mask]) by[mask] = { cls: 'layer-' + r.layer + '_ALL', intervals: [] };
      by[mask].intervals.push([lo, hi]);
    });
    Object.keys(by).forEach(function (k) {
      by[k].intervals.sort(function (u, v) { return u[0] - v[0]; });
    });
    /* `cell` is the bottom-most row's, kept because the label and every existing caller ask a section
       what cell it is of; `cells` is the honest answer once a cut can cross several. */
    /* HOW MANY METAL LEVELS THE WAFER HAS, which is a property of the DESIGN and not of this x. A
       routed placement has been through the whole back end of the line, so the dielectric and the
       passivation are there at every point of it - including where this cut crosses no wire at all.
       Without this the drawing stopped at whatever the cut happened to touch, so a section through a
       gap between two METAL2 columns showed the transistors, one oxide, and then empty page where the
       rest of the chip is: the reader saw a different chip at every x.

       `routes.shapes` rather than `routes` being present, because a design whose every net is an I/O
       pin routes nothing - and a one-cell topic figure is exactly that, so its stack still ends at
       METAL1 and its ten steps are unchanged. */
    var wired = !!(res && res.routes && res.routes.shapes && res.routes.shapes.length);
    var top = wired ? 'METAL3' : null;
    if (!top) {
      ['METAL1', 'METAL2', 'METAL3'].forEach(function (m) { if (by[m]) top = m; });
    }
    /* `local` is the cut's x INSIDE the cell it is in, and it is kept because a caller asks a section
       where in the cell it was taken - dropping it silently made that read `undefined` while every
       interval was still right, which is the shape of regression a geometry check cannot see. With
       several rows it is the bottom-most row's, the same cell `cell` names. */
    /* `win` is carried out because the CAPTION and the MARKER both have to name the rows this drawing
       is of, and neither may work that out a second time: a window computed twice is two windows. It
       is null on a whole-placement section, which is what says there is nothing to name. */
    return { cell: rows[0].cell, cells: rows, cut: cutX, local: rows[0].local,
             height: TOTAL, masks: by, stackTop: top,
             win: win ? { first: win.first, count: win.count } : null,
             rowsTotal: rowsIn(res) };
  }

  function crosses(sec, mask) { return !!(sec && sec.masks[mask]); }
  function overlaps(a, b) {
    for (var i = 0; i < a.length; i++)
      for (var j = 0; j < b.length; j++)
        if (Math.min(a[i][1], b[j][1]) > Math.max(a[i][0], b[j][0])) return true;
    return false;
  }
  /* A GATE is poly over diffusion, tested as an overlap rather than as "both are present": at some
     cuts the poly is routing that merely passes the diffusion by. */
  function gateAt(sec, diff) {
    return crosses(sec, 'POLY') && crosses(sec, diff)
      && overlaps(sec.masks.POLY.intervals, sec.masks[diff].intervals);
  }

  /* WHAT THIS CUT IS, in words, because most cuts are not the textbook one: measured over the
     library, `not_gate` has 20 distinct sections across 24 lambda and only 3 of them cross both
     gates. Naming the cut is what makes a partial stack read as a fact about that x rather than as
     a drawing that failed. Ordered most specific first, and every clause is derived. */
  function cutLabel(sec) {
    if (!sec) return 'off the cells';
    var n = gateAt(sec, 'N-DIFF'), p = gateAt(sec, 'P-DIFF');
    if (n && p) return 'through both gates';
    if (n) return 'through the NMOS gate';
    if (p) return 'through the PMOS gate';
    if (crosses(sec, 'CONTACT')) return 'through a contact';
    if (crosses(sec, 'N-DIFF') || crosses(sec, 'P-DIFF')) return 'through source/drain';
    if (crosses(sec, 'POLY') || crosses(sec, 'POLY2')) return 'through poly routing';
    if (crosses(sec, 'METAL1')) return 'through metal only';
    if (crosses(sec, 'N-WELL')) return 'through bare well';
    return 'through bare substrate';
  }

  /* THE CUTS WORTH STOPPING AT. Snapping to these rather than to every lambda is what makes
     dragging step between sections that genuinely differ: consecutive x with the same set of
     intervals draw the same picture, so only the first of a run is kept.

     THE WINDOW HAS TO BE THE ONE BEING DRAWN, or a drag snaps against a section the reader is not
     looking at: with four of seventeen rows shown, most of the x at which the whole placement
     changes are changes in rows this drawing does not contain, so the stops would be a picture of
     the wrong thing. `x` still sweeps the full width - it is the rows that narrow, not the axis. */
  function cutStops(res, win) {
    var out = [], last = null;
    var placed = (res && res.placed) || [];
    if (!placed.length) return out;
    var x2 = placed[placed.length - 1].x + placed[placed.length - 1].w;
    for (var x = placed[0].x; x <= x2; x += 500) {
      var sec = sectionAt(res, x, win);
      var sig = sec ? Object.keys(sec.masks).sort().map(function (k) {
        return k + sec.masks[k].intervals.join('|');
      }).join(';') : '';
      if (sig !== last) { out.push(x); last = sig; }
    }
    return out;
  }

  /* WHERE THE CUT OPENS: the centre of the first run of x that crosses both gates. The centre and
     not the leftmost, because the poly is 2 lambda wide and its own edge is the one place half a
     lambda of rounding drops the cut out of the gate. Every cell in the library has such a run, so
     this is the answer rather than a preference - and the fallback is stated anyway, since a cell
     added later might not.

     NULL when there is nothing placed, which is not pedantry: it used to return 0, a caller stored
     that as the reader's cut, and 0 is a legal x inside the first cell - so the "is the stored cut
     still on the cells" guard kept it and the figure opened on `through metal only` at the cell's
     left edge. An absent answer has to be absent.

     THE WINDOW NARROWS WHERE IT LOOKS, for `cutStops`' reason: a gate in a row this section does not
     show is not a place worth opening on. The fallback is the first cell's middle either way, which
     is on the top row and so is in every window that contains row 0. */
  function defaultCut(res, win) {
    var placed = (res && res.placed) || [];
    if (!placed.length) return null;

    var x2 = placed[placed.length - 1].x + placed[placed.length - 1].w, run = [];
    for (var x = placed[0].x; x <= x2; x += 500) {
      var sec = sectionAt(res, x, win);
      var both = sec && gateAt(sec, 'N-DIFF') && gateAt(sec, 'P-DIFF');
      if (both) run.push(x);
      else if (run.length) break;
    }
    if (run.length) return (run[0] + run[run.length - 1]) / 2;
    return placed[0].x + placed[0].w / 2;
  }

  /* THE PROCESS, bottom of the wafer upward, for the animation to step through. Derived from the
     masks the DRAWING has rather than from a fixed list, so an inverter with no PDIF gets no
     P-DIFF step - and it is the reverse of the button column, which descends the stack for a
     reader where a process builds up. Step 0 is the bare wafer, which is not a mask at all. */
  /* FABRICATION ORDER, which is not the mask stack the badges are listed in. The gate is patterned
     BEFORE the source and drain are implanted - that is what self-aligned means, and it is what the
     N-DIFF step's own text says - so a bottom-up stack order made this animation contradict its own
     description. The badge column stays in stack order, top of the wafer downwards; these are two
     different questions about the same masks.

     An entry may carry MATERIALS as well as a mask, which is how the two oxides arrive at the step
     that makes them, and an entry with no mask at all is a step that is only a material: defining the
     active areas grows the field oxide and patterns nothing. */
  var PROCESS = [
    { mask: 'N-WELL' },
    { key: 'ACTIVE', materials: ['fieldox'] },
    { mask: 'POLY', materials: ['gateox'] },
    { mask: 'N-DIFF' },
    { mask: 'P-DIFF' },
    { mask: 'POLY2' },
    /* THE DIELECTRIC IS ITS OWN STEP, before the holes are cut in it. It used to arrive WITH the
       contacts, on the reasoning that depositing the oxide and etching it are one photolithographic
       step - which is true of the mask and wrong about the wafer: the oxide is there, thick and
       unbroken, before anything is etched. So this step draws exactly what step `CONTACT` draws minus
       the plugs. */
    { key: 'ILD', materials: ['ild'] },
    { mask: 'CONTACT' },
    { mask: 'METAL1' },
    /* AND THE ROUTING, WHICH IS THE SAME THREE STEPS OVER AGAIN, ONCE PER LEVEL: cover the metal in
       oxide, cut holes through it, fill them and pattern the next metal. That is why each via now has
       a dielectric step in front of it - `ILD2` before VIA1 and `ILD3` before VIA2 - exactly as `ILD`
       sits in front of CONTACT, and for the reason recorded there: the oxide is thick and unbroken
       before anything is etched, so depositing it and etching it are one MASK and two steps on the
       wafer. `ILD4` is the passivation over the top metal, which is where a real line ends.

       They are here because `applyStep` reveals a layer only if some step names it - so a mask with no
       step is hidden for the WHOLE animation, which is how METAL2 and METAL3 would have disappeared
       the moment a reader pressed play. Each appears only on a cut that has it, like every other step:
       a single-metal figure has no VIA1 above its METAL1, so it grows none of these and its ten steps
       are unchanged. */
    { key: 'ILD2', materials: ['ild2'] },
    { mask: 'VIA1' },
    { mask: 'METAL2' },
    { key: 'ILD3', materials: ['ild3'] },
    { mask: 'VIA2' },
    { mask: 'METAL3' },
    { key: 'ILD4', materials: ['ild4'] }
  ];
  /* Every mask the ideal pair draws, so the panel's default view gets the full eight steps the
     reference has - derived from the drawing rather than listed twice. */
  function idealMasks(full) {
    var seen = [];
    idealShapes(full).shapes.forEach(function (s) {
      if (s.mask && seen.indexOf(s.mask) < 0) seen.push(s.mask);
    });
    return seen;
  }
  /* THE STEPS, and each one carries the WORDS for it as well as its mask - so the step panel and the
     shapes it is describing come out of one list. `only` narrows it to a given set of masks, which is
     what lets the ideal pair keep all eight steps while a real cut has only the masks that cell has.
     Step 0 is the bare wafer and is not a mask at all. */
  function processSteps(res, only, materials) {
    var have = {};
    (res && res.layers || []).forEach(function (L) { have[maskOf(L.cls)] = L; });
    var mats = materials || [];
    var t0 = STEP_TEXT[''] || {};
    var out = [{ mask: null, label: 'Bare wafer', classes: [], materials: [],
                 title: t0.title, desc: t0.desc }];
    PROCESS.forEach(function (p) {
      /* A step is included only if the DRAWING has what it is about - the mask, or for a
         material-only step the material. So a cut with no field oxide grows none, and a cell with no
         PDIF never claims a P-DIFF step. */
      var mine = (p.materials || []).filter(function (k) { return mats.indexOf(k) >= 0; });
      if (p.mask) {
        if (only ? only.indexOf(p.mask) < 0 : !have[p.mask]) return;
      } else if (!mine.length) {
        return;
      }
      var txt = STEP_TEXT[p.mask || p.key] || {};
      out.push({ mask: p.mask || null,
                 /* THE STEP'S OWN KEY, which is what its effect is looked up by. Without it a
                    material-only step was keyed `ACTIVE` by a fallback, so the dielectric step fired at
                    the FIELD OXIDE's zones - the right kind of effect in the wrong place, which is
                    exactly the sort of thing that looks correct until something asks where. */
                 key: p.mask || p.key || null,
                 label: p.mask ? ((have[p.mask] && have[p.mask].label) || p.mask) : txt.title,
                 classes: p.mask ? [(have[p.mask] && have[p.mask].cls) || classOfMask(p.mask)] : [],
                 materials: mine.map(function (k) { return MATERIAL_CLASS[k]; }),
                 title: txt.title, desc: txt.desc });
    });
    return out;
  }
  /* Every material class a step could hide, so a caller can hide the ones it has not reached without
     knowing the table. */
  function materialClasses() {
    return Object.keys(MATERIAL_CLASS).map(function (k) { return MATERIAL_CLASS[k]; });
  }

  function svgEl(name, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    return e;
  }

  /* ---- THE MATERIALS, which are not masks and so are not in the legend ----
   *
   * A wafer is not made only of the things a mask patterns: there is silicon under everything, field
   * oxide between the active areas, a thin gate oxide under each gate and a thick dielectric the
   * contacts pass through. They earn a place here because a cross section without them reads as
   * shapes floating in air - and because they are the two colours the reference this was built from
   * gets most out of: a tan substrate and a pale blue oxide.
   *
   * THEY ARE FIXED IN BOTH COLOUR MODES, and painted from literals rather than tokens, for the
   * reason the emulator's TV palette is: they are the product rather than chrome. Silicon is not a
   * shade of the page. The same choice the `--panel-*` set makes for editors and consoles, and it is
   * what lets the text drawn ON them be a fixed dark - chosen against the fill, which is this repo's
   * rule wherever text lands on a coloured surface. Everything that is NOT on a material - the
   * region captions above the drawing - takes `--fg-muted` and follows the mode as usual.
   *
   * They carry no layer class, so no badge can turn them off: there is no mask to tick.
   */
  /* A LABEL MAY BE SEVERAL LINES, which the substrate's is: `Silicon Substrate` over `(P-type)` reads
     as a name with its doping under it, rather than as one long string competing with the well's name
     beside it. The lines are tspans of ONE text element, so the whole label still carries one class and
     goes with its shape - two text elements would be two things to keep in step. */
  var MATERIAL_LABEL = { sub: ['Silicon Substrate', '(P-type)'], ild: 'oxide',
                         fieldox: 'field oxide', gateox: 'gate oxide' };
  /* The narrow form, for a cut whose substrate has less than 30 lambda of room. */
  var MATERIAL_LABEL_SHORT = { sub: ['Si Substrate', '(P-type)'] };

  /* A MATERIAL IS MADE AT A STEP, so it needs a class the process can hide it by. Only the substrate
     is exempt: it is the wafer, present at step one and never made. Getting this wrong was visible at
     a glance and invisible to every check - step 1, `p-type silicon wafer`, drew the field oxide and
     the gate oxides on top of the bare substrate, because a shape with no class is a shape nothing
     can turn off. Deliberately NOT the layer classes: the oxide is not the CONTACT mask, so
     unticking that badge must take the plugs away and leave the dielectric they sit in. */
  var MATERIAL_CLASS = { fieldox: 'pnr-mat-fieldox', gateox: 'pnr-mat-gateox', ild: 'pnr-mat-ild',
                         /* ONE CLASS PER DIELECTRIC LEVEL, because each is made at its own step and a
                            material is hidden by the class its step names. One shared `pnr-mat-ild`
                            for all four would put the whole back end of the line on screen the moment
                            the contacts' oxide arrived - which is what "a shape nothing can hide is a
                            shape that is always there" means here. They all take the same FILL (see
                            CLS_FOR_KIND), so this costs no CSS: oxide is oxide. */
                         ild2: 'pnr-mat-ild2', ild3: 'pnr-mat-ild3', ild4: 'pnr-mat-ild4' };

  /* ---- WHAT EACH STEP OF THE PROCESS IS, in the words a reader needs ----
   * One entry per MASK rather than per step, because the steps are derived from the masks a drawing
   * has - so an inverter with no PDIF simply never shows the P-DIFF text, and nothing has to be
   * renumbered. Keyed by mask name, the same key the strata and the badges use. */
  var STEP_TEXT = {
    'VIA1': { title: 'VIA1 etch',
          desc: 'Cover the first metal in oxide and cut holes through it wherever the next layer has '
              + 'to reach down. A via is the same idea as a contact, one storey up: this one lands on '
              + 'metal rather than on silicon.' },
    'METAL2': { title: 'METAL2 deposition',
          desc: 'The second metal, patterned to run only up and down. Giving each layer one direction '
              + 'is what lets wires cross without touching - a horizontal wire and a vertical one can '
              + 'share a point of the plan because they are on different layers.' },
    'VIA2': { title: 'VIA2 etch',
          desc: 'Oxide again, and holes again, this time between the second metal and the third.' },
    'METAL3': { title: 'METAL3 deposition',
          desc: 'The third metal, running only left and right. With two directions and a via between '
              + 'them, any pin can be joined to any other: down a column, across a track, down again.' },
    '': { title: 'P-type silicon wafer',
          desc: 'Start with a lightly doped p-type silicon substrate. The NMOS will be built '
              + 'directly into it; the PMOS needs an n-type body, so it gets a well of its own.' },
    'N-WELL': { title: 'N-WELL formation',
          desc: 'Pattern the n-well mask and drive n-type dopant in with heat. This is the body the '
              + 'PMOS transistor will sit inside, and it is why one cell can hold both polarities.' },
    'ACTIVE': { title: 'Active areas and field oxide',
          desc: 'Define where transistors are allowed to be. Thick field oxide is grown everywhere '
              + 'else, and it is what keeps one transistor\'s channel from reaching the next.' },
    'N-DIFF': { title: 'N-DIFF implant',
          desc: 'Heavily doped n+ pockets, forming the NMOS source and drain. The poly gate is '
              + 'already there and masks the channel between them, so the two line up with it '
              + 'exactly - which is what "self-aligned" means.' },
    'P-DIFF': { title: 'P-DIFF implant',
          desc: 'The same idea with p-type dopant, inside the n-well, giving the PMOS its source and '
              + 'drain. The same mask also opens the tap that holds the substrate at ground.' },
    'POLY': { title: 'Gate oxide and POLY gate',
          desc: 'Grow a very thin gate oxide, deposit polysilicon over it and pattern it. The gate '
              + 'never touches the silicon: that sliver of oxide is the whole transistor, and its '
              + 'thickness is what the switching voltage is set by. It is patterned BEFORE the '
              + 'source and drain, which is what lets it mask them.' },
    'POLY2': { title: 'POLY2',
          desc: 'A second polysilicon layer above the first and insulated from it, used for local '
              + 'interconnect or as the top plate of a poly-poly capacitor.' },
    'ILD': { title: 'Interlayer dielectric (ILD)',
          desc: 'A thick oxide is deposited over everything. It is what electrically isolates the '
              + 'metal interconnect stacked above from the transistors below, and from itself where '
              + 'one wire crosses another.' },
    /* THE SAME STEP, ONE STOREY UP, THREE TIMES - and each has a title of its own rather than four
       lines all reading `Interlayer dielectric (ILD)`. A reader stepping through would otherwise see
       the same words at steps 8, 11, 14 and 17 with no way to tell which level they were on, and the
       first one's title is left byte-identical because it is the one every check names. */
    'ILD2': { title: 'Interlayer dielectric · over METAL1',
          desc: 'Cover the first metal in oxide. The wires are buried in it, and the holes for '
              + 'whatever level comes next are cut through it - which is why it is deposited before '
              + 'VIA1 rather than with it.' },
    'ILD3': { title: 'Interlayer dielectric · over METAL2',
          desc: 'Oxide again over the second metal, ready for the vias to the level above. The stack '
              + 'is the same three steps repeated: bury, cut, fill and pattern.' },
    'ILD4': { title: 'Passivation',
          desc: 'A last dielectric over the top metal, sealing the finished wafer. Only the bond pads '
              + 'are opened through it, which is where the chip meets its package.' },
    'CONTACT': { title: 'Contact etch',
          desc: 'Blanket the wafer in dielectric, then etch holes through it and fill them with '
              + 'metal. One mask, but a layout tool splits it by what it lands on - diffusion, poly, '
              + 'or a well or substrate tie.' },
    'METAL1': { title: 'METAL1 interconnect',
          desc: 'Deposit metal and pattern it. It drops into the contacts and wires the transistors '
              + 'into a gate - and the two rails at the ends of the cell are what every cell in the '
              + 'row shares.' }
  };

  /* ---- THE IDEAL PAIR: one NMOS, one PMOS, always the same ----
   *
   * What the panel shows BEFORE a cut is chosen, and the reason it exists is that a derived cut is
   * an answer to a question the reader has not asked yet: most cuts through a real cell are partial
   * (of `not_gate`'s 20 distinct sections, 3 cross both gates), so opening on one is opening on the
   * middle of an explanation. This is the textbook picture instead - and clicking the layout replaces
   * it with the real thing, which is the moment it becomes worth reading.
   *
   * Its geometry is fixed and its coordinate space is the derived section's, so switching between the
   * two does not move the panel or rescale anything. Deliberately NOT a claim about any cell: the
   * header says so, and it is the one drawing here that is authored rather than measured.
   */
  var IDEAL_W = 72000;
  /* `full` ASKS FOR THE WHOLE BACK END OF THE LINE - the two via levels, the two upper metals and the
     three dielectrics over them - and it is OPT-IN for the reason the power ring is. The badge column on
     a LEARN TOPIC is built from its placement's own layers, and a topic figure that routes nothing has no
     METAL2 or METAL3 among them: drawing them in the ideal pair there would paint shapes no badge can
     hide and no stylesheet on that page need colour, which is the black-fill failure `test_learn.py`
     already guards against. The Fabrication card asks, because there a routed cut is the thing the ideal
     pair is being compared with; a topic's own figure does not. */
  function idealShapes(full) {
    var S = STRATA, G = SEC, out = [];
    var nAct = [6000, 30000], pAct = [42000, 66000];
    var well = [36000, IDEAL_W];
    function add(mask, kind, x, w, top, bottom, text, textAt) {
      out.push({ mask: mask, kind: kind, x: x, w: w, top: top, bottom: bottom, text: text || null,
                 textAt: textAt === undefined ? null : textAt });
    }
    /* Named in the half that is NOT well, or the label lands on the well's edge and on the well's
       own name - the same mistake the derived section makes if it centres at half the height. */
    add(null, 'substrate', 0, IDEAL_W, G.surface, G.floor, MATERIAL_LABEL.sub, well[0] / 2);
    /* Opaque and painted before everything above the surface, for the reason the derived section's
       is - and labelled between the two active areas, the one stretch with no plug in the way, since
       a label over a contact reads as naming the contact. */
    add(null, 'ild', 0, IDEAL_W, G.oxideTop, G.surface, MATERIAL_LABEL.ild,
        (nAct[1] + pAct[0]) / 2);
    /* AND THE DIELECTRIC OVER EACH METAL, level by level, with a passivation sealing the top - the same
       bands `cutShapes` builds from its `ILD_OVER` table, and what gives this drawing the ILD2, ILD3 and
       ILD4 steps. Painted HERE, before every mask, because a band that covers a metal level has to sit
       behind that metal's own shapes - the rule the derived section records at length. */
    if (full) {
      add(null, 'ild2', 0, IDEAL_W, S.METAL2.bottom, S.METAL1.bottom, null);
      add(null, 'ild3', 0, IDEAL_W, S.METAL3.bottom, S.METAL2.bottom, null);
      add(null, 'ild4', 0, IDEAL_W, S.METAL3.top - 3000, S.METAL3.bottom, null);
    }
    add('N-WELL', 'band', well[0], well[1] - well[0], S['N-WELL'].top, S['N-WELL'].bottom, 'N-WELL');
    /* Field oxide between and beside the active areas - thicker than a gate oxide, which is the
       whole point of it: it is what stops one transistor's channel reaching the next. */
    [[0, nAct[0]], [nAct[1], pAct[0]], [pAct[1], IDEAL_W]].forEach(function (f) {
      if (f[1] > f[0]) add(null, 'fieldox', f[0], f[1] - f[0], -2000, G.surface, null);
    });
    /* Source and drain either side of each gate, and the gate between them. 7000 wide each, with a
       10000 channel, which is roughly the proportion of a real short-channel device at this scale. */
    [['N-DIFF', nAct, 'N+'], ['P-DIFF', pAct, 'P+']].forEach(function (t) {
      var mask = t[0], a = t[1], tag = t[2];
      add(mask, 'band', a[0], 7000, STRATA[mask].top, STRATA[mask].bottom, tag);
      add(mask, 'band', a[1] - 7000, 7000, STRATA[mask].top, STRATA[mask].bottom, tag);
      var gx = [a[0] + 7000, a[1] - 7000];
      add(null, 'gateox', gx[0], gx[1] - gx[0], -SEC.gateOxide, G.surface, null);
      add('POLY', 'band', gx[0] + 1000, gx[1] - gx[0] - 2000, S.POLY.top, S.POLY.bottom, 'POLY');
      add('POLY2', 'band', gx[0] + 2500, gx[1] - gx[0] - 5000, S.POLY2.top, S.POLY2.bottom, null);
    });

    /* A plug per source and drain, and one on each gate - which is where the two landings differ,
       and the reason the derived section reads a plug's bottom off the cut rather than off a table. */
    [nAct, pAct].forEach(function (a) {
      add('CONTACT', 'plug-on-silicon', a[0] + 2000, 3000, G.contactTop, G.surface, null);
      add('CONTACT', 'plug-on-silicon', a[1] - 5000, 3000, G.contactTop, G.surface, null);
      add('CONTACT', 'plug-on-poly', (a[0] + a[1]) / 2 - 1500, 3000, G.contactTop, S.POLY.top, null);
    });
    [nAct, pAct].forEach(function (a) {
      add('METAL1', 'band', a[0], 8000, S.METAL1.top, S.METAL1.bottom, 'M1');
      add('METAL1', 'band', a[1] - 8000, 8000, S.METAL1.top, S.METAL1.bottom, null);
      add('METAL1', 'band', (a[0] + a[1]) / 2 - 4000, 8000, S.METAL1.top, S.METAL1.bottom, null);
    });
    /* AND THE ROUTING STACK ON TOP, so this drawing is the SAME PROCESS the derived section is. It used
       to stop at METAL1 and therefore described a process that ends halfway: the step list read
       `10/10 METAL1 interconnect` where a real cut reads `17/17 Passivation`, and the headroom `SEC.top`
       reserves for the metal stack was left empty above the M1 blocks. Seven steps were missing - two
       via levels, two metals and the three dielectrics above - and they are the back end of the line,
       which is most of what a modern process spends its masks on.

       ONE COLUMN PER METAL1 BAND, straight up: a via centred on the band below it and the next metal on
       the same x. An ideal pair is a REFERENCE drawing, so regular is right - and stacking them is what
       makes the three metals read as connected rather than as three floating stripes, which is the same
       thing the derived section achieves by taking a via's band from the gap between two metals exactly.

       The mask list and the `plug-on-metal` / `band` split are `cutShapes`' own, so the two drawings
       cannot come to draw a via two ways; `M2` and `M3` are labelled once per region, as `M1` is. */
    if (full) [nAct, pAct].forEach(function (a) {
      var cols = [a[0], (a[0] + a[1]) / 2 - 4000, a[1] - 8000];
      [['VIA1', null], ['METAL2', 'M2'], ['VIA2', null], ['METAL3', 'M3']].forEach(function (pair) {
        var mask = pair[0], via = mask.indexOf('VIA') === 0;
        cols.forEach(function (x, i) {
          add(mask, via ? 'plug-on-metal' : 'band',
              via ? x + 2500 : x, via ? 3000 : 8000,
              S[mask].top, S[mask].bottom, (!via && i === 0) ? pair[1] : null);
        });
      });
    });
    return { width: IDEAL_W, shapes: out, wellAt: (well[0] + well[1]) / 2,
             /* SHORT, because a caption is clipped by the viewBox rather than wrapped: `PMOS region
                (inside N-WELL)` ran off the right edge and lost its closing bracket. The well is
                named in place inside the drawing, so the parenthetical was saying it twice. */
             regions: [{ x: (nAct[0] + nAct[1]) / 2, text: 'NMOS region' },
                       { x: (pAct[0] + pAct[1]) / 2, text: 'PMOS region' }] };
  }

  /* Shapes for a real cut, in the same form the ideal pair produces - so one renderer draws both and
     the two cannot drift into different idioms. Everything here is derived from the intervals. */
  function cutShapes(sec) {
    var S = STRATA, G = SEC, H = sec.height, out = [];
    function add(mask, kind, x, w, top, bottom, text, cls, textAt) {
      out.push({ mask: mask, kind: kind, x: x, w: w, top: top, bottom: bottom,
                 text: text || null, cls: cls || null,
                 textAt: textAt === undefined ? null : textAt });
    }
    var sub = { i: out.length };
    add(null, 'substrate', 0, H, G.surface, G.floor, null);
    /* THE OXIDE IS PAINTED FIRST OF EVERYTHING ABOVE THE SURFACE, and opaque. It used to be drawn
       last at 55% so the poly showed through it - which looked right in light mode and came out
       grey-blue in dark, because a translucent material composites against whatever is behind it and
       the page behind it moves with the reader's OS. Painting it first and letting the poly, the
       plugs and the metal sit on top of it is how a cross section is normally drawn anyway, and it
       makes the material mode-independent by construction rather than by choosing an opacity that
       happens to look similar in both. */
    /* NO MASK AND NO LAYER CLASS. The oxide used to borrow the contact's, which is how it arrived with
       the plugs - and it also meant unticking the CONTACT badge took the dielectric away with them.
       It is a material like the substrate and the field oxide: its own step shows it, and no badge owns
       it because there is no mask to tick. It is still only drawn where there is something above the
       surface for it to hold. */
    /* THE DIELECTRIC IS BUILT FROM THE METALS THAT ARE THERE, level by level, and that is a fix rather
       than a refinement: the bands used to be keyed on PAIRS of adjacent levels - one for METAL1 with
       METAL2, one for METAL2 with METAL3 - so a cut carrying METAL1 and METAL3 but no METAL2 got
       neither of them and the drawing showed a floating gap of page between the two wires. Measured on
       the three-inverter example: most cuts are exactly that shape, since METAL2 runs in columns and a
       cut between two of them crosses none.

       So the rule is stated over the levels PRESENT: the oxide fills from the wafer to the lowest
       metal, then from each metal to the next one above it, and a passivation seals the top. Nothing
       can leave a hole, because each band ends where the next begins.

       Each band BURIES THE METAL BELOW IT - it spans from that metal's own bottom up to the next
       metal's bottom, so it fills the gaps beside the wires as well as the via level over them, and a
       wire reads as embedded in oxide rather than laid on top of it. That works because the materials
       are painted FIRST and the masks after, so a band covering a metal level sits behind that metal's
       own shapes.

       A CUT WITH ONE METAL AND NOTHING ABOVE IT GETS NO NEW BAND, which is what keeps every learn
       figure that draws no routing at exactly the steps it had: there is nothing to bury it under yet,
       and the passivation belongs to a finished stack. `processSteps` includes a step iff its band was
       drawn, so the list follows the picture with no second rule to keep in step. */
    /* THE DIELECTRIC IS BUILT OVER THE LEVELS THE WAFER HAS, level by level, and that is the whole of
       why it is not built over the ones this cut crosses. Two bugs came out of the shorter reading, and
       the second is the one a reader sees at every x:

       keyed on PAIRS of adjacent levels - one for METAL1 with METAL2, one for METAL2 with METAL3 - a
       cut carrying METAL1 and METAL3 but no METAL2 got neither band, and the drawing showed a floating
       gap of page between the two wires;

       and gated on the CUT's own metals, a section through a gap between two METAL2 columns stopped at
       the contact oxide, so the top half of the panel was empty page where the rest of the chip is.

       So the levels come from `sec.stackTop` - METAL3 on a routed design, whatever the cut carries on an
       unrouted one - and the slices join edge to edge from the wafer to the passivation. Nothing can
       leave a hole, because each band ends where the next begins, and every cut of one design is the
       same height of material with its own wires inside it.

       Each band BURIES THE METAL BELOW IT - from that metal's own bottom up to the next metal's bottom -
       so it fills the gaps beside the wires as well as the via level over them, and a wire reads as
       embedded in oxide rather than laid on top of it. That works because the materials are painted
       FIRST and the masks after, so a band covering a metal level sits behind that metal's own shapes.

       `processSteps` includes a step iff its band was drawn, so the step list follows the picture with
       no second rule to keep in step. */
    var LEVELS = ['METAL1', 'METAL2', 'METAL3'];
    var has = sec.stackTop ? LEVELS.slice(0, LEVELS.indexOf(sec.stackTop) + 1) : [];
    var lowest = has[0], highest = has[has.length - 1];
    if (sec.masks.CONTACT || has.length) {
      add(null, 'ild', 0, H, lowest ? S[lowest].bottom : G.oxideTop, G.surface, MATERIAL_LABEL.ild,
          null, sec.masks.POLY ? (sec.masks.POLY.intervals[0][0]) / 2 : H / 2);
    }
    /* KEYED BY THE METAL IT BURIES, not by the pair it sits between - which is why the step titles say
       `over METAL1` rather than `METAL1 to METAL2`. */
    var ILD_OVER = { METAL1: 'ild2', METAL2: 'ild3' };
    has.forEach(function (m, i) {
      var up = has[i + 1];
      if (!up || !ILD_OVER[m]) return;
      add(null, ILD_OVER[m], 0, H, S[up].bottom, S[m].bottom, null);
    });
    /* AND THE PASSIVATION over the topmost level, once there is a stack to seal: a lone METAL1 with
       nothing above it is an unfinished wafer, not a sealed one. */
    if (highest && highest !== 'METAL1') {
      add(null, 'ild4', 0, H, S[highest].top - 3000, S[highest].bottom, null);
    }
    var order = ['N-WELL', 'N-DIFF', 'P-DIFF', 'POLY', 'POLY2'];
    /* FIELD OXIDE IS THE SURFACE THAT IS NOT ACTIVE, so it is the complement of the diffusions -
       derived, like everything else here, rather than drawn where it looks right. */
    var act = [];
    ['N-DIFF', 'P-DIFF'].forEach(function (d) {
      if (sec.masks[d]) sec.masks[d].intervals.forEach(function (iv) { act.push(iv); });
    });
    act.sort(function (a, b) { return a[0] - b[0]; });
    var at = 0;
    act.forEach(function (iv) {
      if (iv[0] > at) add(null, 'fieldox', at, iv[0] - at, -2000, G.surface, null);
      at = Math.max(at, iv[1]);
    });
    if (at < H) add(null, 'fieldox', at, H - at, -2000, G.surface, null);
    order.forEach(function (mask) {
      var m = sec.masks[mask];
      if (!m || !S[mask]) return;
      m.intervals.forEach(function (iv) {
        if (mask === 'POLY') {
          /* The gate oxide, only where the poly really crosses a diffusion: elsewhere the poly is on
             field oxide, and a sliver there would claim a thickness this drawing does not model. */
          ['N-DIFF', 'P-DIFF'].forEach(function (d) {
            if (!sec.masks[d]) return;
            sec.masks[d].intervals.forEach(function (dv) {
              var a = Math.max(iv[0], dv[0]), b = Math.min(iv[1], dv[1]);
              if (b > a) add(null, 'gateox', a, b - a, -SEC.gateOxide, G.surface, null, m.cls);
            });
          });
        }
        add(mask, 'band', iv[0], iv[1] - iv[0], S[mask].top, S[mask].bottom,
            mask === 'N-DIFF' ? 'N+' : mask === 'P-DIFF' ? 'P+'
              : mask === 'N-WELL' && iv[1] - iv[0] >= 20000 ? 'N-WELL' : null, m.cls);
      });
    });
    /* THE OXIDE IS WHAT THE METAL SITS ON, so it is drawn whenever there is metal above the surface
       and not only where this cut happens to have a contact. At `through both gates` there is no
       contact - they sit beside the gate, not on it - and tying the oxide to them alone left the
       metal and the poly floating in mid-air. It takes the class of whichever mask brings it, so the
       process animation still reveals it with the step that deposits it. */
    if (sec.masks.CONTACT) {
      sec.masks.CONTACT.intervals.forEach(function (iv) {
        var onPoly = sec.masks.POLY && overlaps([iv], sec.masks.POLY.intervals);
        add('CONTACT', onPoly ? 'plug-on-poly' : 'plug-on-silicon', iv[0], iv[1] - iv[0],
            G.contactTop, onPoly ? S.POLY.top : G.surface, null, sec.masks.CONTACT.cls);
      });
    }
    if (sec.masks.METAL1) {
      sec.masks.METAL1.intervals.forEach(function (iv) {
        add('METAL1', 'band', iv[0], iv[1] - iv[0], S.METAL1.top, S.METAL1.bottom, 'M1',
            sec.masks.METAL1.cls);
      });
    }
    /* THE ROUTING, in the order it is built: a via is a plug through the oxide between two metals, so
       it takes the gap between their bands exactly - which is what makes the stack read as connected
       rather than as three floating stripes. Labelled M2 and M3 as METAL1 is labelled M1. */
    [['VIA1', null], ['METAL2', 'M2'], ['VIA2', null], ['METAL3', 'M3']].forEach(function (pair) {
      var mask = pair[0], m = sec.masks[mask];
      if (!m || !S[mask]) return;
      m.intervals.forEach(function (iv) {
        add(mask, mask.indexOf('VIA') === 0 ? 'plug-on-metal' : 'band',
            iv[0], iv[1] - iv[0], S[mask].top, S[mask].bottom, pair[1], m.cls);
      });
    });
    /* THE SUBSTRATE IS NAMED WHERE IT IS SUBSTRATE - the widest stretch that is not well. Centring
       at half the height put the label inside the n-well on every cell in this library, which a
       browser caught and no DOM check could. */
    var free = [[0, H]];
    if (sec.masks['N-WELL']) {
      sec.masks['N-WELL'].intervals.forEach(function (w) {
        var next = [];
        free.forEach(function (f) {
          if (w[1] <= f[0] || w[0] >= f[1]) { next.push(f); return; }
          if (f[0] < w[0]) next.push([f[0], w[0]]);
          if (w[1] < f[1]) next.push([w[1], f[1]]);
        });
        free = next;
      });
    }
    var widest = null;
    free.forEach(function (f) { if (!widest || f[1] - f[0] > widest[1] - widest[0]) widest = f; });
    /* THE SUBSTRATE'S NAME GOES IN ITS FREE STRETCH, and its FORM depends on the room there: the
       full phrase needs about 30 lambda and a cell whose well takes more than half leaves less than
       that, where it ran on into the well and read as naming both. Derived from the width rather
       than shortened everywhere, so the ideal pair and a roomy cut keep the full words. */
    if (widest) {
      out[sub.i].text = widest[1] - widest[0] >= 30000 ? MATERIAL_LABEL.sub
                                                       : MATERIAL_LABEL_SHORT.sub;
      out[sub.i].textAt = (widest[0] + widest[1]) / 2;
    }
    /* THE REGION CAPTIONS ARE PER ROW, because a cut across a three-row placement has three of each:
       captioning the widest substrate stretch and the first well once would name row 0's halves and
       leave the other rows' unlabelled, which reads as though only one row had transistors in it.
       Each row's own span is what its caption is derived from, using the same free-stretch and well
       arithmetic as the label above - so on a single-row cut this produces exactly the pair it always
       did, from the same numbers. */
    /* PAST TWO ROWS THERE ARE NO REGION CAPTIONS, and that is a legibility rule rather than a
       tidiness one: the pair is drawn once PER ROW, so a cut through a real design's placement
       stacks `NMOS region` / `PMOS region` seventeen times over a section whose rows are a few
       pixels tall - text over text, naming what the layer legend beside it already names. One or
       two rows is the case the captions were written for (a topic page's figure is one), and
       there they still say which half of a CMOS pair you are looking at.

       The shapes, the legend, the axis and the measured line are untouched: what goes is the
       words inside the drawing, which is what a reader asked to have back. */
    var rowCount = (sec.cells || []).length || 1;
    if (rowCount > 2) return { width: H, shapes: out, wellAt: sec.masks['N-WELL']
                                 ? (sec.masks['N-WELL'].intervals[0][0]
                                    + sec.masks['N-WELL'].intervals[0][1]) / 2
                                 : null,
                               substrateAt: widest ? (widest[0] + widest[1]) / 2 : undefined,
                               regions: [] };
    var regions = [];
    (sec.cells || [{ base: 0, h: H }]).forEach(function (row) {
      var lo = row.base, hi = row.base + row.h;
      var clip = function (list) {
        var out2 = [];
        list.forEach(function (iv) {
          var a = Math.max(iv[0], lo), b = Math.min(iv[1], hi);
          if (b > a) out2.push([a, b]);
        });
        return out2;
      };
      var wells = sec.masks['N-WELL'] ? clip(sec.masks['N-WELL'].intervals) : [];
      var mine = clip(free), pick = null;
      mine.forEach(function (f) { if (!pick || f[1] - f[0] > pick[1] - pick[0]) pick = f; });
      if (pick) regions.push({ x: (pick[0] + pick[1]) / 2, text: 'NMOS region', sub: true });
      /* Short, for the reason the ideal pair's is: a caption is clipped by the viewBox rather than
         wrapped, and the well is named in place inside the drawing anyway. */
      if (wells.length) regions.push({ x: (wells[0][0] + wells[0][1]) / 2, text: 'PMOS region' });
    });
    return { width: H, shapes: out, wellAt: sec.masks['N-WELL']
               ? (sec.masks['N-WELL'].intervals[0][0] + sec.masks['N-WELL'].intervals[0][1]) / 2
               : null,
             substrateAt: widest ? (widest[0] + widest[1]) / 2 : undefined, regions: regions };
  }

  /* ONE RENDERER for both drawings. Everything it needs is in the shape list, which is also what it
     reports back - so the picture and the record of it are the same thing rather than two
     descriptions that could disagree. */
  var CLS_FOR_KIND = { substrate: 'pnr-sec-sub', fieldox: 'pnr-sec-fieldox',
                       gateox: 'pnr-sec-gox', ild: 'pnr-sec-ild',
                       /* THE SAME FILL for every dielectric level: oxide is oxide, and giving each
                          level a shade of its own would say the process deposits four different
                          materials. Their STEPS differ, and their hide classes differ; their colour
                          must not. */
                       ild2: 'pnr-sec-ild', ild3: 'pnr-sec-ild', ild4: 'pnr-sec-ild' };

  /* WHERE A SHAPE'S LABEL IS DRAWN. A shape may name its own x, because a material's midpoint is
     often the wrong place for its name - the substrate spans the whole cell, so centring `p-type Si
     substrate` put it on the well's edge and over the well's own label. One function, because the
     renderer and the report both need the answer and reporting the raw FIELD instead let a mutant
     null it while the report still said the right number: null means "the shape's middle", which is
     exactly the position that was wrong. */
  function labelX(s) {
    return s.textAt === undefined || s.textAt === null ? s.x + s.w / 2 : s.textAt;
  }
  function renderShapes(el, plan, cols) {
    var W = plan.width;
    var vb = [0, SEC.top, W, SEC.floor - SEC.top];
    var svg = svgEl('svg', { viewBox: vb.join(' '), class: 'pnr-sec-svg',
                             preserveAspectRatio: 'xMidYMid meet' });
    var drawn = 0, labels = [], mats = [], classes = [];
    plan.shapes.forEach(function (s) {
      var cls = CLS_FOR_KIND[s.kind] || 'pnr-sec-shape';
      if (MATERIAL_CLASS[s.kind]) cls += ' ' + MATERIAL_CLASS[s.kind];
      /* A MASK SHAPE CARRIES ITS LAYER CLASS, which is what makes one badge press govern this panel
         and the layout together - setLayerVisible queries the whole box. A material carries none:
         there is no mask to tick, so nothing may hide the wafer. */
      var lcls = s.mask ? (s.cls || classOfMask(s.mask)) : null;
      if (lcls) cls += ' ' + lcls;
      /* THE CLASSES THIS DRAWING REALLY PUT ON ELEMENTS, collected here rather than derived from the
         mask list a caller passed in: `classOfMask` is what resolves METAL1 to the artwork's
         `layer-ALU1_ALL`, so a legend built from the masks would name classes that are not in the
         picture and its buttons would switch nothing. */
      if (lcls && classes.indexOf(lcls) < 0) classes.push(lcls);
      var attrs = { x: s.x, y: s.top, width: s.w, height: s.bottom - s.top, class: cls, rx: 600 };
      if (lcls && cols) attrs.fill = cols[lcls] || '';
      if (!attrs.fill) delete attrs.fill;
      svg.appendChild(svgEl('rect', attrs));
      if (MATERIAL_CLASS[s.kind] && mats.indexOf(s.kind) < 0) mats.push(s.kind);
      drawn++;
      /* A LABEL ON A SHAPE rides with it: same class, so it disappears when its own mask does. A
         label on a material is dark by rule, because the material is a fixed light colour in both
         modes and the text has to be chosen against the fill rather than from the page. */
      if (s.text) {
        var tx = labelX(s);
        /* WHICH KIND OF LABEL THIS IS follows the SHAPE'S KIND, not whether it carries a mask class.
           The oxide is a material that carries the CONTACT class so the process can hide it, so a test
           of "does this have a mask" sent its label down the mask branch and measured it against the
           near-black contact colour: white `oxide` on pale blue. */
        var isMat = !!CLS_FOR_KIND[s.kind];
        var rows = [].concat(s.text);
        /* CENTRED AS A BLOCK, so a two-line label sits about the shape's middle rather than starting
           there - and a one-line label keeps exactly the y it always had, which is what makes this
           neutral for every other label in the drawing. */
        var ty = (s.top + s.bottom) / 2 + 900 - (rows.length - 1) * 1500;
        /* A LABEL CARRIES EVERYTHING THAT HIDES ITS SHAPE - the layer class AND the material class.
           Only the layer one was here, which was invisible while the oxide borrowed the contact's:
           the moment it became a material of its own, its shape hid at the right step and the word
           `oxide` stayed on screen from the first step to the last. A label that outlives the thing it
           names is worse than no label. */
        var t = svgEl('text', { x: tx, y: ty,
                                class: (isMat ? 'pnr-sec-mat-tag' : 'pnr-sec-tag')
                                       + (lcls ? ' ' + lcls : '')
                                       + (MATERIAL_CLASS[s.kind] ? ' ' + MATERIAL_CLASS[s.kind] : '') });
        if (!isMat) {
          var on = attrs.fill || (cols ? cols[lcls] : null);
          if (on) t.setAttribute('fill', readableOn(on));
        }
        if (rows.length === 1) {
          t.textContent = rows[0];
        } else {
          rows.forEach(function (line, k) {
            var sp = svgEl('tspan', { x: tx, dy: k ? 3000 : 0 });
            sp.textContent = line;
            t.appendChild(sp);
          });
        }
        labels.push(t);
      }
    });
    labels.forEach(function (t) { svg.appendChild(t); });
    el.innerHTML = '';
    el.appendChild(svg);
    /* THE REGION CAPTIONS ARE REPORTED, NOT DRAWN. Inside the SVG their size was in user units, so it
       scaled with the drawing and came out a different size from every other line of text in the
       figure - the caller places them as ordinary 11px text instead, at a percentage of the width, so
       one number still positions them and the typography is the page's. */
    return { svg: svg, shapes: drawn, aspect: vb[2] / vb[3], materials: mats,
             /* THE PALETTE THIS DRAWING WOULD NEED, one entry per layer class it drew - see legendOf. */
             legend: legendOf(classes),
             /* WHERE EACH STEP HAPPENS, one zone per shape - what the effects fire at. Collected while
                drawing rather than recomputed, so a beam cannot land somewhere the picture does not. */
             zones: zonesOf(plan, cols),
             regions: (plan.regions || []).map(function (r) {
               return { pct: r.x / W * 100, text: r.text };
             }) };
  }

  /* Draw the section for `cutX` into `el`. Returns what it drew, which is what a caption states and
     a harness reads: no assertion about this picture should have to go through the DOM. */
  function drawSection(el, res, cutX, win) {
    /* `rects` is the drawing AS DATA - one record per shape, with the depth band it was given -
       because a picture cannot be questioned any other way: the plug that stops at the poly, the
       implant that sits inside the well and the ordering of the whole stack are all geometry, and a
       harness that can only count elements cannot tell any of them from a plausible mistake. */
    var out = { cut: cutX, label: '', masks: [], shapes: 0, rects: [] };
    if (!el) return out;
    el.innerHTML = '';
    var sec = sectionAt(res, cutX, win);
    out.label = cutLabel(sec);
    if (!sec) return out;
    out.masks = Object.keys(sec.masks).sort();
    out.cell = sec.cell.type;
    /* WHICH ROWS THIS IS OF, reported from the section rather than from the window the caller passed:
       the window is clamped inside `cutWindow`, so what was asked for and what was drawn can differ
       and only one of the two is a fact about the picture. */
    out.win = sec.win;
    out.rowsTotal = sec.rowsTotal;
    var plan = cutShapes(sec);
    var r = renderShapes(el, plan, coloursOf());
    out.rects = plan.shapes.filter(function (s) { return !!s.mask || s.kind === 'gate-oxide'; })
      .map(function (s) {
        return { mask: s.mask, kind: s.kind === 'gateox' ? 'gate-oxide' : s.kind,
                 cls: s.cls, x: s.x, w: s.w, top: s.top, bottom: s.bottom };
      });
    /* The gate oxide is a material and so has no mask, but it IS a claim about where a gate is - so
       it is reported anyway, under the name the checks already use for it. */
    plan.shapes.forEach(function (s) {
      if (s.kind !== 'gateox') return;
      out.rects.push({ mask: 'POLY', kind: 'gate-oxide', cls: s.cls, x: s.x, w: s.w,
                       top: s.top, bottom: s.bottom });
    });
    out.shapes = r.shapes;
    out.aspect = r.aspect;
    out.svg = r.svg;
    /* WHICH MATERIALS THIS DRAWING HAS, so the step list only contains steps about things that are
       there: a cut with no field oxide grows none. */
    out.materials = r.materials;
    out.regions = r.regions;
    out.legend = r.legend;
    out.zones = r.zones;
    /* REPORTED FROM THE SHAPE THAT WAS DRAWN, not computed a second time: a mutant that nulled the
       label's own x left this reporting the right number while the drawing put the name back in the
       middle of the cell, and the check passed. One source, so the report cannot flatter the picture. */
    plan.shapes.forEach(function (s) {
      if (s.kind === 'substrate' && s.text) out.substrateAt = labelX(s);
    });
    out.ideal = false;
    return out;
  }

  /* The ideal pair, into the same element and the same coordinate space. Its `masks` is every mask it
     draws, so the animation gets its full eight steps here and the layer badges govern it exactly as
     they govern a real cut. */
  function drawIdeal(el, full) {
    var out = { cut: null, label: 'ideal CMOS pair', masks: [], shapes: 0, rects: [], ideal: true };
    if (!el) return out;
    var plan = idealShapes(full);
    var r = renderShapes(el, plan, coloursOf());
    out.masks = [];
    plan.shapes.forEach(function (s) {
      if (s.mask && out.masks.indexOf(s.mask) < 0) out.masks.push(s.mask);
      if (s.mask) out.rects.push({ mask: s.mask, kind: s.kind, cls: 'layer-' + s.mask,
                                   x: s.x, w: s.w, top: s.top, bottom: s.bottom });
    });
    out.masks.sort();
    out.shapes = r.shapes;
    out.aspect = r.aspect;
    out.svg = r.svg;
    out.materials = r.materials;
    out.regions = r.regions;
    out.legend = r.legend;
    out.zones = r.zones;
    return out;
  }

  /* The cut's own marker, drawn INTO the layout's SVG so it scales and lands with the artwork
     rather than being positioned against the box. It carries no layer class, so no button can hide
     the one thing that says where the section comes from.

     IT IS A SEGMENT, NOT A FULL-HEIGHT LINE, once a window is in play, and that is the whole of the
     feedback for choosing a row: a line down the entire placement says at which x the section was
     taken and nothing about which rows, so a reader clicking at a different height would see the
     drawing change with no mark moving to explain it. With no window the segment spans the whole
     placement, which is the line this always drew. */
  function drawCutLine(res, cutX, win) {
    var svg = res && res.svg;
    if (!svg) return null;
    var g = svg.querySelector('.pnr-cut');
    if (!g) {
      g = svgEl('g', { class: 'pnr-cut' });
      svg.appendChild(g);
      /* TWO LINES, THE CASING FIRST: the marker is drawn over artwork of eleven saturated mask colours,
         and a single stroke of any one hue is one mask away from disappearing into it. A wide line in the
         page's background colour under a narrower one in its foreground reads on all of them - the
         drafting convention for a section line, and why the casing is a sibling rather than a filter. */
      g.appendChild(svgEl('line', { class: 'pnr-cut-casing' }));
      g.appendChild(svgEl('line', { class: 'pnr-cut-line' }));
    }
    var ys = windowY(res, win);
    /* BOTH LINES TAKE THE SAME GEOMETRY, from one place, or the casing sits off the line it is casing. */
    ['.pnr-cut-casing', '.pnr-cut-line'].forEach(function (sel) {
      var line = g.querySelector(sel);
      if (!line) return;
      line.setAttribute('x1', String(cutX));
      line.setAttribute('x2', String(cutX));
      line.setAttribute('y1', String(ys.y1));
      line.setAttribute('y2', String(ys.y2));
    });
    return g;
  }

  /* THE HOVER MARKER: where a click would cut, drawn faintly so it cannot be mistaken for the cut
     itself. Its own element rather than a class on the cut line, because both are on screen at once
     while the pointer is over the layout - and `null` removes it, which is what pointerleave sends.

     IT SHOWS THE WINDOW A CLICK WOULD PRODUCE, rows included, which is what makes the row choice
     discoverable at all: the pointer's height moves the segment before anything is committed. */
  function drawHoverLine(res, x, win) {
    var svg = res && res.svg;
    if (!svg) return null;
    var g = svg.querySelector('.pnr-hover');
    if (x === null || x === undefined) {
      if (g && g.remove) g.remove();
      return null;
    }
    if (!g) {
      g = svgEl('g', { class: 'pnr-hover' });
      svg.appendChild(g);
      g.appendChild(svgEl('line', { class: 'pnr-hover-line', x1: 0, y1: 0, x2: 0, y2: 0 }));
    }
    var line = g.querySelector('.pnr-hover-line');
    var ys = windowY(res, win);
    line.setAttribute('x1', String(x));
    line.setAttribute('x2', String(x));
    line.setAttribute('y1', String(ys.y1));
    line.setAttribute('y2', String(ys.y2));
    return g;
  }

  /* A pointer x in CSS pixels over the layout, as a placement coordinate. Read from the SVG's own
     box rather than from the wrapper's, because `preserveAspectRatio` may letterbox the drawing
     inside it - the same reason the waveform measures its canvas rather than its card. */
  function cutFromClientX(res, clientX) {
    var svg = res && res.svg;
    if (!svg || !svg.getBoundingClientRect) return null;
    var b = svg.getBoundingClientRect();
    if (!b.width) return null;
    /* THE DRAWING'S OWN EXTENT, NOT THE CELLS', and that distinction arrived with the power ring: the
       block is a margin wider than its cell area on each side, the svg's viewBox spans the whole of it,
       and a pointer fraction has to be measured against the same thing the box is. Derived from the
       cells, the right-hand margin was simply missing from the mapping - every click landed short of
       where it was aimed, by the ratio of the two widths. `planWidth` is what `drawStatic` reports;
       the cell extent is the fallback for a result that predates it, where the two are equal anyway. */
    var total = res.planWidth || 0;
    if (!total) {
      (res.placed || []).forEach(function (p) { total = Math.max(total, p.x + p.w); });
    }
    return (clientX - b.left) / b.width * total;
  }

  /* AND WHICH ROW a pointer y is over, which is the other half of choosing where to cut. Measured off
     the SVG's own box for `cutFromClientX`'s reason - `preserveAspectRatio` may letterbox the drawing
     inside its wrapper, so the wrapper's rect is not the artwork's.
     Clamped to a row that exists rather than returned as null off the ends: a pointer a pixel above
     the top row means the top row, where an absent answer would make the drag drop out at the edges.

     NULL FOR AN EVENT THAT CARRIES NO Y, and that is not defensive padding: a synthesized
     `pointerdown` may have only a `clientX` - the harness's own `pickAt` does - and the arithmetic
     then yields NaN, which `cutWindow` would fold to row 0 while `fabPick` stored the NaN as the
     chosen row. An event that says nothing about the row has to be answered with nothing, so the
     caller keeps the row it had.

     ONE GUARD, NOT TWO. A `typeof clientY !== 'number'` test in front of this was written and
     REMOVED on a measurement: its mutant survived the sweep, because every input that reaches it
     non-numeric - `undefined` above all - arrives here as NaN anyway and is caught by this line. The
     one case it added was a `clientY` of exactly `null`, which coerces to 0 and no event produces.
     Kept as reassurance it would have been a line no test could fail, which is the rule this repo
     applies to `__divmod16`'s unreachable branch. */
  function cutRowFromClientY(res, clientY) {
    var svg = res && res.svg;
    if (!svg || !svg.getBoundingClientRect) return null;
    var b = svg.getBoundingClientRect();
    if (!b.height) return null;
    var span = cutSpan(res);
    if (!span) return null;
    var y = (clientY - b.top) / b.height * span;
    if (!isFinite(y)) return null;
    return Math.max(0, Math.min(rowsIn(res) - 1, Math.floor(y / rowPitch())));
  }

  function snapCut(res, x, win) {
    var stops = cutStops(res, win);
    if (!stops.length) return x;
    var best = stops[0];
    stops.forEach(function (s) { if (Math.abs(s - x) < Math.abs(best - x)) best = s; });
    return best;
  }


  /* ============================== THE PROCESS EFFECTS ==============================
   *
   * The cartoon half of the animation, ported from the process reference: an ion beam firing dopant
   * into the silicon, oxide bubbling up as it grows, poly and metal raining down, sparks where the
   * contacts are etched. It is decoration in the strict sense - no shape, no measurement and no
   * verdict depends on it - and it earns its place because it says what a step DOES, where the shapes
   * only say what a step leaves behind.
   *
   * TWO THINGS MAKE IT DIFFERENT FROM THE REFERENCE, and both follow from this figure being derived.
   * The zones are the STEP'S OWN SHAPES - the beam lands on the intervals that step draws, so on a
   * real cut it fires at that cell's diffusions rather than at two hardcoded rectangles - and the
   * colours come from the artwork, so a beam is the colour of the mask it is implanting.
   *
   * IT IS A CANVAS OVER THE DRAWING, not more SVG. Particles are hundreds of short-lived shapes, and
   * a canvas is what that is for; keeping them out of the SVG also means the layer classes, the badges
   * and the step machinery cannot see them, which is what makes "decoration" true rather than stated.
   */
  /* AN EFFECT MAY OVERRIDE THE COLOUR IT IS DRAWN IN, and two do - because what flies through the air
     is not always the mask being made. A contact etch is plasma, so it is warm and bright rather than
     the near-black of the contact it opens: at the mask's own colour those sparks were invisible over
     the pale blue oxide, which is what `step 8's animation is not visible` turned out to be. Oxide
     growth is the oxide itself, which is a material and has no layer colour at all. Literals for the
     same reason the materials are: they are the process, not chrome. */
  var FX = {
    'N-WELL':  { kind: 'implant', from: 'N-WELL',  name: 'Ion implant · n-type' },
    'ACTIVE':  { kind: 'grow',    from: 'fieldox', name: 'Thermal oxidation', paint: '#7ec8e3' },
    'POLY':    { kind: 'deposit', from: 'POLY',    name: 'Poly deposition + etch' },
    'N-DIFF':  { kind: 'implant', from: 'N-DIFF',  name: 'Self-aligned implant · n-type' },
    'P-DIFF':  { kind: 'implant', from: 'P-DIFF',  name: 'Self-aligned implant · p-type' },
    'POLY2':   { kind: 'deposit', from: 'POLY2',   name: 'POLY2 deposition' },
    /* DEPOSITED, NOT GROWN, and the distinction is the reason both effects exist: a thermal oxide grows
       OUT OF the silicon, consuming it, which is why the field oxide's bubbles rise from the wafer - and
       a dielectric is deposited ONTO the wafer from above, like the poly and the metal. Drawing the two
       the same way said they were the same process. It keeps the oxide's own colour: what is arriving is
       oxide, whatever brings it. */
    'ILD':     { kind: 'deposit', from: 'ild',     name: 'Oxide deposition · ILD', paint: '#7ec8e3' },
    'CONTACT': { kind: 'etch',    from: 'CONTACT', name: 'Contact etch', paint: '#ffc850' },
    'METAL1':  { kind: 'sputter', from: 'METAL1',  name: 'Metal sputter + pattern' },
    /* THE BACK END OF THE LINE HAD NO EFFECTS AT ALL, and that was visible rather than subtle: the
       field went idle from VIA1 onwards, so the second half of the animation was a slideshow while the
       first half was a process. Each is the same physical step as its counterpart below - an oxide is
       deposited, a hole is etched, a metal is sputtered - so it takes the same kind and the same
       paint, and only the zones differ. */
    'ILD2':    { kind: 'deposit', from: 'ild2',    name: 'Oxide deposition · ILD', paint: '#7ec8e3' },
    'ILD3':    { kind: 'deposit', from: 'ild3',    name: 'Oxide deposition · ILD', paint: '#7ec8e3' },
    'ILD4':    { kind: 'deposit', from: 'ild4',    name: 'Passivation deposition', paint: '#7ec8e3' },
    'VIA1':    { kind: 'etch',    from: 'VIA1',    name: 'Via etch', paint: '#ffc850' },
    'VIA2':    { kind: 'etch',    from: 'VIA2',    name: 'Via etch', paint: '#ffc850' },
    'METAL2':  { kind: 'sputter', from: 'METAL2',  name: 'Metal sputter + pattern' },
    'METAL3':  { kind: 'sputter', from: 'METAL3',  name: 'Metal sputter + pattern' }
  };
  var FX_IDLE = { kind: 'idle', zones: [], name: 'Clean wafer', colour: null };

  /* What a step's effect is, and WHERE it happens: the zones are read off the shapes that step draws,
     which is what makes a beam land on this cell's own diffusions rather than on a guess. Returns the
     idle plan for the bare wafer and for anything with nothing to fire at, so a caller never has to
     ask whether a step has an effect. */
  function stepEffect(step, drawn) {
    if (!step || !step.mask && !(step.materials || []).length) return FX_IDLE;
    var key = step.key || step.mask;
    var fx = key ? FX[key] : null;
    if (!fx || !drawn) return FX_IDLE;
    var cols = coloursOf();
    var zones = [], colour = null;
    (drawn.zones || []).forEach(function (z) {
      if (z.of !== fx.from) return;
      zones.push({ x: z.x, w: z.w, top: z.top, bottom: z.bottom });
      if (!colour) colour = z.colour;
    });
    if (!zones.length) return FX_IDLE;
    return { kind: fx.kind, name: fx.name, zones: zones, from: fx.from,
             colour: colour || (cols[classOfMask(key)] || null), paint: fx.paint || null,
             mask: step.mask || null };
  }

  /* THE ZONES A DRAWING OFFERS, collected while it is rendered - one per shape, carrying what it is
     of, so `stepEffect` can pick the ones belonging to its own step. Reported rather than recomputed,
     for the reason every other number here is: the effect and the picture then cannot disagree about
     where a step happens. */
  function zonesOf(plan, cols) {
    var out = [];
    plan.shapes.forEach(function (s) {
      /* A MATERIAL IS A ZONE TOO, keyed by its kind - the field oxide already was, and the dielectric
         is now that it has a step of its own to be fired at. */
      var of = s.mask || (MATERIAL_CLASS[s.kind] ? s.kind : null);
      if (!of) return;
      out.push({ of: of, x: s.x, w: s.w, top: s.top, bottom: s.bottom,
                 colour: s.mask && cols ? (cols[s.cls || classOfMask(s.mask)] || null) : null });
    });
    return out;
  }

  /* One particle field over one drawing. `plan` is what to spawn; `box` is the SVG the canvas covers,
     read for its size and its viewBox so a zone in the drawing's own units lands where the shape is. */
  function makeEffects() {
    var cv = null, ctx = null, host = null, svg = null, parts = [], plan = FX_IDLE, hits = [];
    var raf = null, spawning = false, frames = 0, spawned = 0;

    function reduced() {
      try {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (e) { return false; }
    }
    function geom() {
      /* The mapping from the drawing's units to canvas pixels, read from the SVG that is on screen -
         so it follows the panel's width with no number repeated here.

         AND IT ACCOUNTS FOR THE LETTERBOXING, which it did not have to while `.fab-body` had no height:
         the svg was `width: 100%; height: auto`, so its box's aspect was the viewBox's exactly and
         `xMidYMid meet` fitted with nothing left over. Now the panel is a FIXED height - so the two
         views of this card are the same height - and the drawing is scaled uniformly and CENTRED inside
         a box that is wider or taller than it. Mapping viewBox units onto the element's whole rect then
         puts every particle off the shape it is meant to be landing on, by half the slack on one axis.

         `pw`/`ph` are therefore the DRAWING's pixel size and `ox`/`oy` the margin around it - which is
         what `xMidYMid meet` means, written out. With no slack both offsets are zero and this is the
         mapping it always was. */
      var vb = (svg && svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
      var r = svg && svg.getBoundingClientRect ? svg.getBoundingClientRect() : { width: 0, height: 0 };
      var w = vb[2] || 1, h = vb[3] || 1;
      var rw = r.width || 0, rh = r.height || 0;
      var s = (rw && rh) ? Math.min(rw / w, rh / h) : 0;
      var pw = s ? w * s : rw, ph = s ? h * s : rh;
      return { x0: vb[0], y0: vb[1], w: w, h: h,
               pw: pw, ph: ph,
               /* The canvas covers the whole rect, so the drawing's offset within it is the slack. */
               ox: Math.max(0, (rw - pw) / 2), oy: Math.max(0, (rh - ph) / 2),
               rw: rw, rh: rh };
    }
    function attach(hostEl, svgEl_) {
      host = hostEl; svg = svgEl_;
      if (!host || !host.appendChild) return;
      cv = host.querySelector('canvas.pnr-fx');
      if (!cv) {
        cv = document.createElement('canvas');
        cv.className = 'pnr-fx';
        host.appendChild(cv);
      }
      var g = geom();
      /* THE BITMAP IS THE ELEMENT'S BOX, not the drawing's: the canvas is positioned on the panel
         (`inset: 8px`), so its pixels have to cover that - and `toPx` shifts the drawing into place
         inside it. Sized to the drawing instead, the bitmap would be stretched to the panel by CSS and
         every coordinate scaled by the letterbox twice over. */
      cv.width = Math.max(1, Math.round(g.rw || g.pw));
      cv.height = Math.max(1, Math.round(g.rh || g.ph));
      ctx = cv.getContext && cv.getContext('2d');
    }
    function toPx(g, ux, uy) {
      return { x: g.ox + (ux - g.x0) / g.w * g.pw,
               y: g.oy + (uy - g.y0) / g.h * g.ph };
    }
    function spawn() {
      if (!plan || plan.kind === 'idle' || !plan.zones.length) return;
      var g = geom();
      if (!g.pw) return;
      /* THE BEAM IS PAINTED IN A COLOUR THAT WORKS ON THE PANEL, not necessarily the mask's own: these
         particles fly through the space ABOVE the wafer, which is the figure's surface rather than one
         of the materials - so the n-well's grey and the contact's near-black need the same lift the
         layer badges need. The PLAN still names the mask's true colour, so nothing that reads the plan
         is affected; only the pixels move. */
      /* THE OVERRIDE GOES THROUGH THE SAME LIFT, which its first version did not - and a check caught
         that: the etch's warm `#ffc850` is 1.45:1 against a light panel, so the spark that was added to
         make step 8 visible in dark mode was invisible in light. A colour chosen for one mode is not a
         colour, it is a colour for one mode. */
      var paintCol = pageColour(plan.paint || plan.colour);
      /* EVERY ZONE FIRES, EVERY FRAME. A step happens in all of its places at once - both halves of a
         source/drain pair are implanted by one mask - so a beam over one of them and nothing over the
         other is a false picture of the process.

         It used to take zones in turn, and the turn-taking was broken in a way that made it worse than
         slow: the index was `spawned + i` while `spawned` also advanced inside the loop, so the sum
         moved by two per particle and, with an EVEN number of zones, never changed parity. Two P+
         regions therefore meant every single particle landed in the first one. Firing all of them is
         both the right picture and one fewer thing to get wrong.

         THE ETCH FIRES TWICE PER ZONE, not fewer: one small spark was the least visible thing here. */
      var per = plan.kind === 'etch' ? 2 : 1;
      while (hits.length < plan.zones.length) hits.push(0);
      /* A CEILING, because the count is now zones x per x frames-alive: six contact zones at 80 frames
         of life is ~960, and a figure that quietly turns into a thousand arcs a frame is the runaway
         this repo guards against everywhere else. Dropping the newest is right - the field looks the
         same and the oldest are the ones about to fade. */
      if (parts.length > 600) return;
      for (var zi = 0; zi < plan.zones.length * per; zi++) {
        var z = plan.zones[zi % plan.zones.length];
        var ux = z.x + Math.random() * z.w;
        var p = toPx(g, ux, z.top);
        var top = toPx(g, ux, SEC.top).y;
        if (plan.kind === 'grow') {
          /* Oxide RISES, from the FLOOR of what is growing - the one effect that does not fall, because
             it is the wafer growing rather than something arriving on it. From the floor rather than the
             top so a thick layer fills upward through itself: the field oxide's floor is the surface,
             and so is the dielectric's. */
          p = toPx(g, ux, z.bottom === undefined ? z.top : z.bottom);
          parts.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 0.3, vy: -0.5 - Math.random() * 0.5,
                       r: 2 + Math.random() * 3, life: 1, decay: 0.02, ring: true,
                       colour: paintCol });
        } else if (plan.kind === 'etch') {
          parts.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 1.2, vy: -0.6 - Math.random() * 1.2,
                       r: 2 + Math.random() * 3, life: 1, decay: 0.03, spark: true,
                       colour: paintCol });
        } else {
          /* Everything else arrives from above and stops at the shape it is making: an implant sinks
             in, a deposition lands on top. `stop` is the shape's own y, so nothing has to know which
             stratum this step is. */
          parts.push({ x: p.x, y: top, vx: (Math.random() - 0.5) * 0.4,
                       vy: 1.6 + Math.random() * 1.6, r: 1.5 + Math.random() * 1.5, life: 1,
                       decay: 0.012, stop: p.y, trail: [], colour: paintCol });
        }
        /* COUNTED BY WHERE THE PARTICLE ACTUALLY IS, not by which zone the loop meant to use. Counting
           the intention made the counter agree with a broken zone lookup - two mutants that sent every
           particle to the first zone were invisible, because `hits` still said one each. A count that
           can only be right when the particle is right is the only kind worth having. */
        for (var q = 0; q < plan.zones.length; q++) {
          var zq = plan.zones[q];
          if (ux >= zq.x && ux <= zq.x + zq.w) { hits[q]++; break; }
        }
        spawned++;
      }
    }
    function step() {
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy;
        if (p.trail) {
          p.trail.push(p.y);
          if (p.trail.length > 5) p.trail.shift();
        }
        if (p.stop !== undefined && p.y >= p.stop) { p.vy *= 0.25; p.life -= 0.08; }
      }
    }
    function paint() {
      if (!ctx) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(function (p) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.colour || '#8b949e';
        ctx.strokeStyle = p.colour || '#8b949e';
        if (p.trail && p.trail.length > 1) {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.trail[0]);
          p.trail.forEach(function (y) { ctx.lineTo(p.x, y); });
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        if (p.ring) { ctx.lineWidth = 1.5; ctx.stroke(); } else { ctx.fill(); }
      });
      ctx.globalAlpha = 1;
    }
    /* rAF IN A BROWSER, `tick()` FOR A HARNESS. The stub's `requestAnimationFrame` is
       `setTimeout(fn, 0)` resolved against NODE's timer rather than its own controllable queue, so a
       loop built on it cannot be stepped in a check - it simply never runs. Rather than move the
       animation onto `setTimeout` (which would keep firing in a background tab, for a decoration), the
       frame is a function a caller may drive, and the SCHEDULING is counted so a check can still prove
       the loop was asked to run. */
    function frame() {
      raf = null;
      frames++;
      if (spawning) spawn();
      step();
      paint();
      /* THE LOOP STOPS WHEN THERE IS NOTHING LEFT TO DRAW, rather than running for the life of the
         page as the reference's does: this figure sits on an article beside a simulator, and a rAF
         that never idles is a cost the reader pays for a decoration they may not be looking at. */
      if (spawning || parts.length) schedule();
    }
    var scheduled = 0;
    function schedule() {
      if (raf !== null) return;
      scheduled++;
      try { raf = window.requestAnimationFrame(frame); } catch (e) { raf = null; }
    }
    return {
      /* Point the field at a drawing and a step. Called on every step change and every redraw, so it
         re-reads the geometry rather than caching a size that the panel may have changed. */
      show: function (hostEl, svgEl_, p) {
        plan = p || FX_IDLE;
        attach(hostEl, svgEl_);
        parts.length = 0;
        hits.length = 0;
        if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
        return plan;
      },
      /* Run or stop the spawning. Stopping lets what is in flight finish, which is what keeps a pause
         from snapping the last beam out of existence. REDUCED MOTION never spawns at all - the badge
         still names the process, so nothing is lost but the movement. */
      run: function (on) {
        spawning = !!on && !reduced();
        if (spawning) schedule();
        return spawning;
      },
      burst: function () {
        if (reduced()) return 0;
        spawning = true;
        spawn(); spawn(); spawn();
        spawning = false;
        schedule();
        return parts.length;
      },
      clear: function () {
        parts.length = 0;
        spawning = false;
        if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
      },
      /* One frame, run now. The browser never calls this - it is what a check drives instead of the
         animation frame the stub cannot deliver. */
      tick: function () { frame(); return parts.length; },
      /* For the harness: what is on screen, without going through pixels. */
      state: function () {
        var last = parts.length ? parts[parts.length - 1] : null;
        return { kind: plan.kind, name: plan.name, zones: plan.zones.length, from: plan.from || null,
                 /* The most recently spawned particle, so a check can ask WHERE an effect starts - the
                    difference between growth rising from a layer's floor and from its top is 77px on
                    screen and invisible to any other assertion. */
                 last: last ? { x: last.x, y: last.y } : null,
                 /* HOW MANY PARTICLES EACH ZONE HAS HAD, which is the only way to ask whether a step
                    fired in all of its places rather than in one of them. */
                 hits: hits.slice(),
                 colour: plan.colour, particles: parts.length, frames: frames,
                 spawning: spawning, reduced: reduced(), scheduled: scheduled,
                 canvas: cv ? { w: cv.width, h: cv.height } : null };
      }
    };
  }
  var effects = makeEffects();

  /* ---- ONE PAN AND ZOOM, FOR EVERY BOX THAT SHOWS A PLACEMENT ----
     Lifted out of Baerilog/pnr.html, which had the only copy, so the app, code2silicon and any
     figure that asks share one gesture set rather than two that agree until one is edited. The
     constants come with it, because the FLOOR carries a measurement: it was 0.05 and the
     synthesizer's 16-bit ALU needs 0.0073 (0.037 even with square rows), so Fit returned the clamp
     and left a 3,000px drawing in a 460px box - which reads as "Fit is broken" rather than as a
     clamp. ZOOM_FLOOR is only a guard against a zero or NaN scale from a box that has not been laid
     out; the real floor is the one the zoom writer applies, `Math.min(fitScale(), scale)`.

     IT IS OPT-IN, and that is the whole reason it is a function rather than something `drawStatic`
     does. This renderer's sizing story is ROW_PX - "the app scales by a zoom factor over the raw
     lambda units; a figure cannot, because it has no zoom" - and twenty learn figures plus the
     heights test_learn.py measures depend on it. A caller that wants gestures asks for them; every
     figure that does not is untouched, which is what makes that assertable.

     THE MODEL IS SCROLL OFFSETS, NOT A TRANSFORM: the box is a scroll container, the drawing is
     sized in CSS pixels, and panning moves the scroll offsets so it composes with the scrollbars
     and the wheel instead of being a second idea of where the view is. So a caller supplies two
     functions and nothing else - `size()`, the drawing's UNSCALED px extent, and `resize(k)`, which
     redraws or re-sizes it at that scale. pnr.html's `resize` is its existing
     `scale = k; renderPlacement(lastPlan)`, whose only use of the scale is the svg's width and
     height - which is what makes moving this provably neutral there.

     The 8 is the pair of 1px borders plus room for a scrollbar that should then not be needed. */
  var ZOOM_STEP = 1.3, ZOOM_MAX = 4, ZOOM_FLOOR = 0.0005, FIT_PAD = 8, PAN_SLOP = 4;

  function attachView(wrap, opts) {
    if (!wrap || !opts || typeof opts.size !== 'function' || typeof opts.resize !== 'function') return null;
    var scale = 1;
    function box() { return { w: wrap.clientWidth || 900, h: wrap.clientHeight || 460 }; }
    /* FIT MEANS THE WHOLE LAYOUT IS IN THE BOX, WHICH IS BOTH DIMENSIONS. It fitted the WIDTH
       alone once, so a wide single row was scaled until it filled the box across and then ran off
       the bottom of it - clipped by the card's 460px, with a reader seeing the vdd rail and half a
       cell. A row is 72 lambda tall against a placement that may be hundreds wide, so which of the
       two binds depends entirely on the design: one row of ten cells is width-bound, four rows of
       two are height-bound. Both are computed and the SMALLER wins.

       `fitScale` is factored out because the fit and the zoom floor are the same number, and two
       guesses at one number is how they come apart. */
    function fitScale() {
      var s = opts.size() || { w: 0, h: 0 };
      var b = box(), fits = [];
      if (s.w > 0) fits.push((b.w - FIT_PAD) / s.w);
      if (s.h > 0) fits.push((b.h - FIT_PAD) / s.h);
      return Math.max(ZOOM_FLOOR, fits.length ? Math.min.apply(null, fits) : 1);
    }
    function apply(k) { scale = k; opts.resize(k); }
    function fit() {
      apply(fitScale());
      /* AND BACK TO THE TOP LEFT, because a fit that leaves the box scrolled shows a fitted drawing
         with part of it out of view - the one thing Fit exists to rule out. */
      wrap.scrollLeft = 0;
      wrap.scrollTop = 0;
    }
    /* ONE ZOOM WRITER, anchored on a point: the wheel passes the pointer and a button passes the
       box's centre, since a press has no pointer and centring is what stops repeated clicks walking
       the drawing out of frame. Being a ratio, in-then-out returns to the scale it started from.
       The anchor is kept by arithmetic on the scroll offsets - the content coordinate under the
       pointer is `(scroll + p) / scale` - read BEFORE the redraw, since the redraw is what changes
       the scrollable extent. */
    function zoomAbout(px, py, factor) {
      var floor = Math.min(fitScale(), scale);
      var k = Math.max(floor, Math.min(ZOOM_MAX, scale * factor));
      if (k === scale) return;
      var ux = (wrap.scrollLeft + px) / scale, uy = (wrap.scrollTop + py) / scale;
      apply(k);
      wrap.scrollLeft = ux * k - px;
      wrap.scrollTop = uy * k - py;
    }
    function zoomBy(factor) { var b = box(); zoomAbout(b.w / 2, b.h / 2, factor); }

    /* A DRAG PANS THE DRAWING. `mousemove`/`mouseup` are on the DOCUMENT, as the netlist viewer's
       are, or a drag that leaves the box strands the cursor in `grabbing` and the drawing mid-pan. */
    var drag = null, moved = 0;
    wrap.addEventListener('mousedown', function (ev) {
      drag = { x: ev.clientX, y: ev.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
      moved = 0;
      wrap.style.cursor = 'grabbing';
      /* Or the pointer selects the SVG's text nodes - the cell names - while it drags. */
      if (ev.preventDefault) ev.preventDefault();
    });
    document.addEventListener('mousemove', function (ev) {
      if (!drag) return;
      moved = Math.max(moved, Math.abs(ev.clientX - drag.x), Math.abs(ev.clientY - drag.y));
      wrap.scrollLeft = drag.sl - (ev.clientX - drag.x);
      wrap.scrollTop = drag.st - (ev.clientY - drag.y);
    });
    document.addEventListener('mouseup', function () {
      if (!drag) return;
      drag = null;
      wrap.style.cursor = '';
    });
    /* THE WHEEL ZOOMS ABOUT THE POINTER, and takes the whole gesture: otherwise it scrolls the box
       on one axis and the reader has no zoom without reaching for a button. */
    wrap.addEventListener('wheel', function (ev) {
      if (ev.preventDefault) ev.preventDefault();
      var r = wrap.getBoundingClientRect ? wrap.getBoundingClientRect() : { left: 0, top: 0 };
      zoomAbout(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-(ev.deltaY || 0) * 0.0015));
    });

    /* WAS THAT A PAN OR A CLICK? A drag ends with a `click` on the box, so a caller that also
       does something with a click - code2silicon's layout sets the cross-section's cut - has to
       be able to tell the two apart. The threshold is the netlist viewer's rule: a gesture that
       moved more than a few pixels was a pan. Read rather than enforced here, because what to do
       about it belongs to whoever owns the click. */
    return { fit: fit, fitScale: fitScale, zoomAbout: zoomAbout, zoomBy: zoomBy,
             scale: function () { return scale; },
             panned: function () { return moved > PAN_SLOP; } };
  }


  /* ================= THE FABRICATION FIGURE AND ITS PLAYER =================
     THE CARD pnr.html AND code2silicon.html BOTH SHOW, built here so there is ONE of it. It was 445
     lines and eleven module variables inside pnr.html's own script, and code2silicon had a
     cross-section viewer with none of the player - so the two pages disagreed about what
     "Fabrication" is, and code2silicon's own (?) promised steps it could not run.

     IT OWNS ITS MARKUP, which is what makes one copy possible at all: pnr.html had the figure as
     HTML and code2silicon builds its cards in JS, so sharing the code while each page supplied the
     tree would leave two things to keep in step. The classes are pnr.css's `fab-*` - both pages
     already load it - and the ids are stamped because `test_pnr.py` drives 133 fab assertions by id.

     THE HOST SUPPLIES THREE THINGS and keeps its own flow: which placement to cut, the row budget
     it was placed at (so this drawing and the card above it are the same arrangement), and the
     netlist text. Revealing the card, scrolling to it and deciding when to play are the host's -
     the same opt-in split `attachView` above draws. */
  function attachFabrication(host, opts) {
    if (!host) return null;
    opts = opts || {};
    var SELF = window.PRACTICE_PNR_API;   /* set once the IIFE returns; every use is inside a handler */

    /* THE ELEVEN STATE VARIABLES, now per instance rather than per page. */
    var fabSteps = [], fabStep = -1, fabTimer = null, fabDrawn = null, fabLayerBtns = [], fabOff = {};
    var fabBarDrag = false;
    var fabFig = null, fabView = 'all', fabRouting = true, fabPicked = false, fabCutX = null;
    var fabIdleTimer = null;
    /* A CUT IS AN X AND A ROW, and the row is the half this card used to have no notion of: the
       section was the whole placement's height however tall the floorplan, so a seventeen-row design
       drew seventeen rows a few pixels each. `fabMaxRows` is how many rows to show and `fabCutRow`
       which one the reader pointed at; `SELF.cutWindow` turns the pair into the window everything
       draws from, so neither number is interpreted twice.

       FOUR IS THE DEFAULT because it is the top of the control's range, so the card behaves exactly
       as it always did on every placement of four rows or fewer - which is every learn figure and
       every small example - and only starts limiting where the drawing was illegible anyway. */
    var FAB_MAX_ROWS_CAP = 4;
    var fabMaxRows = FAB_MAX_ROWS_CAP, fabCutRow = 0;
    /* THE WINDOW, from one place. Every draw, every marker and the caption ask this rather than
       computing it, which is what stops the picture and the words about it from disagreeing. */
    function fabWin() {
      return fabFig && SELF.cutWindow ? SELF.cutWindow(fabFig, fabMaxRows, fabCutRow) : null;
    }
    /* pnr.html's own three, moved with the code that reads them. */
    var FAB_MS = 900, FAB_IDLE_MS = 5000, FAB_MARGIN = 10, CELL_H = 72000;
    /* HOW FAST THE PROCESS PLAYS, as a multiplier on FAB_MS rather than a second duration - so
       100% IS the 900ms this has always used and nothing about the default moves. A PERCENTAGE
       because that is what the reader is choosing: 25% is quarter speed, i.e. four times longer
       per step, which is why the interval DIVIDES by it. Read at each tick, not captured when Play
       was pressed, so a change takes effect on the next step instead of after a replay. */
    var FAB_SPEEDS = [25, 50, 100, 150];
    var fabSpeed = 100;
    function stepMs() { return Math.round(FAB_MS * 100 / fabSpeed); }

    function mkEl(tag, cls, id) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (id) e.id = id;
      return e;
    }
    /* THE TREE, in pnr.html's own order: the palette down the left, the layout and its tally in the
       middle, the section with its head, region captions, drawing and step text on the right, and
       the player under all of it. */
    var elFig = mkEl('div', 'fab-fig', 'fabFig');
    var elLayers = mkEl('div', 'fab-layers', 'fabLayers');
    var elMid = mkEl('div', 'fab-mid');
    var elDraw = mkEl('div', 'fab-draw', 'fabDraw');
    /* NO TALLY HERE. What was placed and how big it is describes the ARRANGEMENT, so it belongs under
       the Layout drawing on each page - `tallyLine` above is the one formatter both of them use. Inside
       this figure it sat under a small second copy of the layout, captioning the wrong drawing, and it
       only appeared once Fabricate had been pressed. */
    elMid.appendChild(elDraw);
    var elSec = mkEl('div', 'fab-sec');
    var elHead = mkEl('div', 'fab-sec-head', 'fabHead');
    var elRegions = mkEl('div', 'fab-regions', 'fabRegions');
    var elBody = mkEl('div', 'fab-body', 'fabBody');
    var elStep = mkEl('div', 'fab-step', 'fabStep');
    elSec.appendChild(elHead); elSec.appendChild(elRegions);
    elSec.appendChild(elBody); elSec.appendChild(elStep);
    elFig.appendChild(elLayers); elFig.appendChild(elMid); elFig.appendChild(elSec);
    var elCtl = mkEl('div', 'fab-ctl');
    var elPlay = mkEl('button', 'btn secondary', 'fabPlay');
    elPlay.setAttribute('type', 'button');
    elPlay.innerHTML = '&#9654; Play';
    var elReset = mkEl('button', 'btn secondary', 'fabReset');
    elReset.setAttribute('type', 'button');
    elReset.textContent = 'Reset';
    var elStepNum = mkEl('span', 'fab-step-num', 'fabStepNum');
    var elProg = mkEl('div', 'fab-prog', 'fabProg');
    elProg.setAttribute('tabindex', '0');
    elProg.setAttribute('role', 'slider');
    elProg.setAttribute('aria-label', 'process step');
    /* THE SPEED, beside the transport it governs. A `range` with four stops rather than a
       `select`, because the choice is ORDERED - a reader wants "slower" and "faster", not a
       menu - and because dragging it while the process plays is the natural way to use it.
       `step="1"` over the INDEX, not over the percentages, since 25/50/100/150 are not evenly
       spaced and a slider whose stops are unevenly spaced reads as broken.
       The number beside it is the second encoding, and it is what makes the control legible at
       a glance without moving the thumb. */
    var elSpeedWrap = mkEl('label', 'fab-speed', 'fabSpeedWrap');
    var elSpeedLab = mkEl('span', 'fab-speed-cap');
    elSpeedLab.textContent = 'speed';
    var elSpeed = mkEl('input', null, 'fabSpeed');
    elSpeed.setAttribute('type', 'range');
    elSpeed.type = 'range';
    elSpeed.setAttribute('min', '0');
    elSpeed.setAttribute('max', String(FAB_SPEEDS.length - 1));
    elSpeed.setAttribute('step', '1');
    elSpeed.setAttribute('value', String(FAB_SPEEDS.indexOf(fabSpeed)));
    elSpeed.value = String(FAB_SPEEDS.indexOf(fabSpeed));
    elSpeed.setAttribute('aria-label', 'animation speed');
    var elSpeedVal = mkEl('span', 'fab-speed-val', 'fabSpeedVal');
    elSpeedVal.textContent = fabSpeed + '%';
    function applySpeed() {
      var i = Math.max(0, Math.min(FAB_SPEEDS.length - 1, Number(elSpeed.value) || 0));
      fabSpeed = FAB_SPEEDS[i];
      elSpeedVal.textContent = fabSpeed + '%';
      elSpeed.setAttribute('aria-valuetext', fabSpeed + '%');
      /* NOT RESTARTED. A timer already waiting keeps its old interval and the NEXT one takes the
         new speed, so the change costs at most one step - where clearing and re-arming would
         jump the process forward or stall it for a full period, depending on which way the
         slider moved. */
    }
    elSpeed.addEventListener('input', applySpeed);
    elSpeed.addEventListener('change', applySpeed);
    elSpeedWrap.appendChild(elSpeedLab);
    elSpeedWrap.appendChild(elSpeed);
    elSpeedWrap.appendChild(elSpeedVal);

    /* HOW MANY ROWS THE SECTION SHOWS, beside the transport for the speed control's reason - it
       governs this drawing, not the placement, so it belongs to the figure rather than to the Layout
       card above.

       A NUMBER FIELD AND NOT A SLIDER, which is the opposite call from `speed` and for a stated
       reason: four stops is a range a reader wants to name (`2 rows`) rather than to feel for, and
       unlike a percentage the number IS the answer - there is no second encoding to show beside it.
       `.num-input` is styled by the shared block, so this needs no CSS beyond its own width.

       CLAMPED AND WRITTEN BACK, which is this repo's standing rule against honouring a number other
       than the one on screen: a field reading 9 while the drawing shows 4 is the silent cap every
       other input here is written to avoid. Done on `change` rather than on `input` so a reader
       mid-typing is not fighting the field. */
    var elRowsWrap = mkEl('label', 'fab-rows', 'fabRowsWrap');
    var elRowsLab = mkEl('span', 'fab-rows-cap');
    elRowsLab.textContent = 'max rows';
    var elRows = mkEl('input', 'num-input', 'fabMaxRows');
    elRows.setAttribute('type', 'number');
    elRows.type = 'number';
    elRows.setAttribute('min', '1');
    elRows.setAttribute('max', String(FAB_MAX_ROWS_CAP));
    elRows.setAttribute('step', '1');
    elRows.setAttribute('value', String(fabMaxRows));
    elRows.value = String(fabMaxRows);
    elRows.setAttribute('aria-label', 'how many rows the cross-section shows');
    function applyMaxRows() {
      var n = Math.max(1, Math.min(FAB_MAX_ROWS_CAP, Math.floor(Number(elRows.value) || 0) || 1));
      elRows.value = String(n);
      if (n === fabMaxRows) return;
      fabMaxRows = n;
      /* THE LAYOUT IS NOT RE-PLACED. Only the section's frame moved, and `fabDrawSection` redraws the
         marker on the existing drawing - where `fabDraw` would place the design again for nothing.
         Stopped first, for `fabPick`'s reason: the next tick would step a process on a drawing that
         has just been replaced. */
      fabStop();
      fabDrawSection();
    }
    elRows.addEventListener('change', applyMaxRows);
    elRowsWrap.appendChild(elRowsLab);
    elRowsWrap.appendChild(elRows);

    elCtl.appendChild(elPlay); elCtl.appendChild(elReset);
    elCtl.appendChild(elSpeedWrap);
    elCtl.appendChild(elRowsWrap);
    elCtl.appendChild(elStepNum); elCtl.appendChild(elProg);
    host.appendChild(elFig);
    host.appendChild(elCtl);
  /* The figure element itself, which `setLayerVisible` is handed so one pill press
     governs the layout AND the section - the whole reason the palette lives inside it. */
    function fabBox() { return elFig; }

  /* THE LAYOUT HALF. `drawStatic` places the editor's netlist at the row width the app is set to, so
     this arrangement and the Layout card's agree by construction rather than by being copied - and it
     reports `layers`, `placed`, `svg` and the two switches, which is everything the palette, the cut and
     the view buttons need.

     IT DRAWS INTO THE VISIBLE PANEL, which is the point of the figure: the same call used to render into
     a detached scratch div nobody could see, so `drawCutLine` was writing its marker into an SVG that
     was not on the page. ROUTING IS PASSED THROUGH rather than left to default: drawStatic routes unless
     told not to, and a section showing wires before the reader has pressed Route would be this card
     contradicting the button above it. */
  function fabDrawLayout() {
    var api = SELF;
    const host = elDraw;
    if (!api || !host) return null;
    if (!opts.plan()) { host.innerHTML = ''; fabFig = null; return null; }
    /* FITTED TO THE COLUMN IT SITS IN, with a margin. `drawStatic` sizes a placement by ROW HEIGHT in
       pixels and defaults to 150, which is right for a figure in an article column and left this one as a
       postage stamp in the middle of half a full-width card - measured in a screenshot, since the drawing
       was perfectly correct and simply small.

       Both axes are considered and the smaller wins, which is the same thing `fitView` does for the
       Layout card above and for the same reason: a wide row is width-bound and a tall stack of short rows
       is height-bound. A placement's aspect is fixed, so this is arithmetic and not a second draw.

       FAB_MARGIN keeps the drawing off the panel's edges and off the section's divider; without it a
       fitted layout touches both and reads as clipped even when it is whole. The fallbacks are for a
       panel that has not been laid out (the stub, and a card still `display:none`), where a measured zero
       would otherwise collapse the drawing to nothing.

       THE ROW COUNT IS READ, NOT DERIVED FROM A HEIGHT, and that is the whole of a bug this shipped
       with. It was `Math.round(plan.height / CELL_H)`, which assumes `height` is in milli-lambda -
       true of pnr.html's `lastPlan`, a raw plan from `place()`, and false of code2silicon's, which
       hands over a `drawStatic` RESULT whose height is in PIXELS. One field name, two units: 750 /
       72000 rounds to 1, so a five-row counter was fitted as though it were one row and drew five
       times too big - 2595 x 2539 inside a 497px column, straight across the section beside it.

       Both shapes carry `rows` outright, so asking for it is exact for either and cannot be wrong
       about a unit it never sees. The height fallback keeps the old arithmetic for a caller that
       somehow has neither. */
    const plan0 = opts.plan();
    const rows = Math.max(1, plan0.rows && plan0.rows.length !== undefined
                             ? plan0.rows.length
                             : (plan0.rows || Math.round(plan0.height / CELL_H)));
    const availW = (host.clientWidth || 420) - FAB_MARGIN * 2;
    const availH = (host.clientHeight || 300) - FAB_MARGIN * 2;
    const byW = availW * (opts.plan().height / opts.plan().width);
    const rowPx = Math.max(24, Math.min(byW, availH) / rows);
    const res = api.drawStatic(host, {
      netlist: opts.netlist(),
      rowWidth: opts.rowLambda(),
      route: !!opts.plan().routes,
      view: fabView,
      routing: fabRouting,
      rowPx: rowPx,
      /* THE RING, because this figure is of a BLOCK: both pages that show this card have placed and
         routed a real design, and the drawing has to be the same arrangement as the Layout card above
         it - which asks for one too. A figure in an article column is the case that does not. */
      ring: true
    });
    fabFig = res && res.placed && res.placed.length ? res : null;
    /* BOUND PER DRAW, because the <svg> is replaced by every one: the listeners go with the element they
       were on, so they cannot accumulate and cannot be left pointing at a stale result. */
    if (fabFig) fabWireCut(fabFig);
    return fabFig;
  }

  /* CLICKING AND DRAGGING THE LAYOUT is how a cut is chosen, which is where a reader will reach for it.
     Pointer events rather than mouse ones, so a touch drag needs no second path, and the cut is snapped
     to the renderer's own stops so a drag steps between sections that differ rather than sliding through
     near-duplicates.

     THE POINTER'S Y IS READ AS WELL AS ITS X, which is how the reader says WHERE on the layout to take
     the section from rather than only at which x. A drag therefore moves the window through the rows as
     well as along the placement, which is the gesture a reader already has their hand on. */
  function fabWireCut(res) {
    var api = SELF;
    const svg = res && res.svg;
    if (!svg || !svg.addEventListener) return;
    let down = false;
    const move = (ev) => {
      const x = api.cutFromClientX(res, ev.clientX);
      if (x === null) return;
      fabPick(x, api.cutRowFromClientY ? api.cutRowFromClientY(res, ev.clientY) : null);
    };
    /* HOVER SHOWS WHERE A CLICK WOULD CUT and nothing more: a faint marker following the pointer,
       snapped to the same stops the real cut is. It is what tells the reader the layout is clickable at
       all - the head says so in words, and this says it in place.

       IT SHOWS THE ROWS TOO, so the segment shortens and moves with the pointer's height: without that
       the row choice is invisible until it is committed, and a reader would have no way to discover it
       exists. The window is the one a click WOULD produce, i.e. built from the hovered row rather than
       from the chosen one. */
    svg.addEventListener('pointermove', (ev) => {
      if (down) return;
      const hx = api.cutFromClientX(res, ev.clientX);
      if (hx === null) return;
      const hr = api.cutRowFromClientY ? api.cutRowFromClientY(res, ev.clientY) : null;
      const hw = api.cutWindow ? api.cutWindow(res, fabMaxRows, hr === null ? fabCutRow : hr) : null;
      api.drawHoverLine(res, api.snapCut(res, hx, hw), hw);
    });
    svg.addEventListener('pointerleave', () => { api.drawHoverLine(res, null); });
    svg.addEventListener('pointerdown', (ev) => {
      down = true;
      if (svg.setPointerCapture && ev.pointerId !== undefined) {
        try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* not fatal: the move still fires */ }
      }
      if (ev.preventDefault) ev.preventDefault();
      move(ev);
    });
    svg.addEventListener('pointermove', (ev) => { if (down) move(ev); });
    svg.addEventListener('pointerup', () => { down = false; });
    svg.addEventListener('pointercancel', () => { down = false; });
  }

  /* THE READER CHOSE THIS CUT. One writer, because four paths reach it - a press on the layout, a drag,
     the picker and Route - and the flag it sets is the panel's whole mode. A press stops the player: the
     next tick would step the process on a drawing that has just been replaced.

     `row` IS OPTIONAL and null keeps the row already chosen, which is what the callers that only know an
     x pass. The window is built from the row being picked rather than from `fabCutRow`, since that is not
     written until the pick is accepted - snapping against the old window would snap to the wrong stops. */
  function fabPick(x, row) {
    var api = SELF;
    if (!api || !fabFig) return;
    const wantRow = row === null || row === undefined ? fabCutRow : row;
    const win = api.cutWindow ? api.cutWindow(fabFig, fabMaxRows, wantRow) : null;
    const snapped = api.snapCut(fabFig, x, win);
    if (fabPicked && snapped === fabCutX && wantRow === fabCutRow) return;
    /* NOTHING TO DRAW THERE, SO NOTHING IS CLAIMED - and the test is on the WINDOWED section, because
       that is the drawing this press would produce: a row whose cells stop short of this x has nothing
       at it even where the placement does. Refused whole, so a press into empty space leaves the cut
       that was there rather than replacing it with a blank. */
    if (!api.sectionAt(fabFig, snapped, win)) return;
    fabStop();
    fabCutX = snapped;
    fabCutRow = wantRow;
    fabPicked = true;
    fabDrawSection();
  }
  /* AND THE WAY BACK, which is the head's own button: the ideal pair is a drawing of the process rather
     than of this design, so the marker comes off the layout with it. */
  function fabIdeal() {
    fabStop();
    fabPicked = false;
    fabCutX = null;
    fabDrawSection();
  }

  /* THE SECTION HALF, and everything that describes it: the head, the region captions, the step list and
     the palette all follow the drawing, so they are rebuilt here rather than by each caller. */
  function fabDrawSection() {
    var api = SELF;
    const body = elBody;
    if (!api || !body) return null;
    /* ONE WINDOW FOR THE DRAWING AND ITS MARKER, read once here: asking twice is how the section and
       the line saying where it came from would come to describe different rows. */
    const win = fabWin();
    const real = fabPicked && fabFig && fabCutX !== null && api.sectionAt(fabFig, fabCutX, win);
    /* THE IDEAL PAIR IS DRAWN FULL-STACK HERE, so the panel a reader opens on describes the same
       seventeen-step process a routed cut does rather than one that ends at METAL1. This card is where
       the two are compared - `Show Ideal Pair` is a way BACK from a cut - and its badge column falls
       back to the section's own legend, so the upper metals have badges to be governed by. */
    fabDrawn = real ? api.drawSection(body, fabFig, fabCutX, win) : api.drawIdeal(body, true);
    /* THE MARKER BELONGS TO A REAL CUT, so the ideal view takes it off the layout rather than leaving a
       line pointing at a drawing that is not of this placement. */
    if (fabFig && fabFig.svg) {
      if (real) api.drawCutLine(fabFig, fabCutX, win);
      else {
        const stale = fabFig.svg.querySelector('.pnr-cut');
        if (stale && stale.remove) stale.remove();
      }
    }
    fabSteps = api.processSteps(real ? fabFig : null,
                               fabDrawn.ideal ? api.idealMasks(true) : null, fabDrawn.materials);
    fabBuildLayers();
    fabPaintRegions();
    fabHead();
    fabShow(fabSteps.length - 1);          // built, not bare: the animation is a way to REBUILD it
    return fabDrawn;
  }

  /* WHICH DRAWING THIS IS, above it - and on the ideal pair, what to do to get the other, since nothing
     else on the figure advertises that the layout is clickable. A real cut states its position in
     MICRONS, not lambda: lambda is a scalable design rule rather than a size, and the tally under the
     layout is already in microns, so quoting both would be two units for one drawing. */
  function fabHead() {
    var api = SELF;
    const head = elHead;
    if (!head) return;
    head.innerHTML = '';
    if (!fabDrawn || fabDrawn.ideal) {
      const lab = document.createElement('span');
      lab.className = 'fab-mode';
      lab.textContent = fabFig ? 'Click the layout to see the cut'
                               : 'Ideal pair — place a design to cut one';
      head.appendChild(lab);
      return;
    }
    const back = document.createElement('button');
    back.className = 'fab-mode';
    back.setAttribute('type', 'button');
    back.textContent = 'Show Ideal Pair';
    back.addEventListener('click', fabIdeal);
    head.appendChild(back);
    const what = document.createElement('span');
    what.className = 'fab-cut-label';
    /* WHICH ROWS, ONLY WHERE IT IS A CHOICE. A section of the whole placement says nothing about rows,
       because there is nothing to have chosen; a windowed one has to, or the drawing silently omits
       most of the design. Read off the DRAWING's own report rather than from `fabMaxRows`, since the
       window is clamped and the field's number is a request.

       ONE-BASED FOR THE READER while the index is zero-based throughout the code, which is stated
       because mixing the two is a hazard this repo has paid for: nowhere else on the page does a
       reader see a row number, so `rows 2-4 of 17` is the only place the convention shows, and the
       alternative - offering a `row 0` - reads as a bug. */
    var rowText = '';
    var w = fabDrawn.win;
    if (w) {
      rowText = ', row' + (w.count > 1 ? 's ' : ' ') + (w.first + 1)
              + (w.count > 1 ? '-' + (w.first + w.count) : '')
              + ' of ' + fabDrawn.rowsTotal;
    }
    what.textContent = 'cut at ' + api.um(fabCutX) + ' µm' + rowText + ' — ' + fabDrawn.label;
    head.appendChild(what);
  }

  /* ONE PILL PER LAYER IN THE DRAWING, in stack order and in the layer's own colour, so the button and
     the shapes it switches are the same thing to look at.

     THE SOURCE IS THE LAYOUT when there is one and the SECTION'S OWN LEGEND when there is not: with
     nothing placed this card still draws the ideal pair, and a palette built only from `res.layers`
     would leave that drawing with no mask buttons at all. Both lists come from the same renderer helper,
     so the two cannot disagree about METAL1's name, its colour or where it sits in the stack. */
  function fabBuildLayers() {
    var api = SELF;
    const col = elLayers;
    if (!api || !col) return;
    const layers = (fabFig && fabFig.layers && fabFig.layers.length)
      ? fabFig.layers
      : ((fabDrawn && fabDrawn.legend) || []);
    col.innerHTML = '';
    fabLayerBtns = [];
    if (!layers.length) return;
    const box = fabBox();
    layers.forEach((L) => {
      const b = document.createElement('button');
      b.className = 'fab-layer-btn';
      b.setAttribute('type', 'button');
      b.textContent = L.label;
      /* The artwork's own name in the tooltip, because METAL1 is what a reader needs and ALU1_ALL is
         what they will find in the .ap file if they go looking. */
      b.setAttribute('title', L.cls.replace(/^layer-/, ''));
      const on = !fabOff[L.cls];
      fabPaintLayerBtn(b, L, on);
      api.setLayerVisible(box, L.cls, on);
      b.addEventListener('click', () => {
        /* A MANUAL PRESS STOPS THE ANIMATION rather than fighting it: the next tick would undo the
           press, so the two would take turns writing the same layer and the click would read as having
           been ignored. */
        fabStop();
        const showing = !fabOff[L.cls];
        fabOff[L.cls] = showing;             // was showing, so this hides it
        fabPaintLayerBtn(b, L, !showing);
        api.setLayerVisible(box, L.cls, !showing);
      });
      fabLayerBtns.push({ L: L, btn: b });
    });
    /* SELECT ALL AT THE TOP, UNSELECT ALL AT THE BOTTOM, with the stack between them - so the two ends
       of the column are the two ends of the range they cover, and neither reads as one more layer. Both
       go through the SAME three writes a single pill's click does (the stored state, the pill, the
       shapes) rather than clearing `fabOff` wholesale, because that state is what survives a redraw. */
    const setAll = (on) => {
      fabStop();
      fabLayerBtns.forEach((m) => {
        fabOff[m.L.cls] = !on;
        fabPaintLayerBtn(m.btn, m.L, on);
        api.setLayerVisible(fabBox(), m.L.cls, on);
      });
    };
    const allBtn = (text, on) => {
      const b = document.createElement('button');
      b.className = 'fab-layer-all';
      b.setAttribute('type', 'button');
      b.textContent = text;
      b.addEventListener('click', () => setAll(on));
      return b;
    };
    col.appendChild(allBtn('Select All', true));
    fabLayerBtns.forEach((m) => col.appendChild(m.btn));
    col.appendChild(allBtn('Unselect All', false));
  }
  /* THE OUTLINE AND THE LABEL USE `onPage`, not the artwork's own colour: an off pill is a coloured
     outline with coloured text ON THE PAGE, and CONTACT's near-black on a dark page is a black outline
     with black text - the pill would simply not be there. The ON state keeps the true colour, because
     then the pill IS the fill and its text is measured against it. */
  function fabPaintLayerBtn(btn, L, on) {
    btn.classList.toggle('on', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.style.borderColor = (on ? L.colour : L.onPage) || L.colour || '';
    btn.style.background = on ? (L.colour || '') : 'transparent';
    btn.style.color = on ? (L.textOn || '') : (L.onPage || L.colour || '');
  }

  /* ONE DRAW OF THE WHOLE FIGURE: the layout, then everything that describes the section through it. The
     order matters - the section reads the layout's result, and the palette reads both - so this is the
     one entry point every caller uses rather than each of them doing part of it. */
  function fabDraw() {
    var api = SELF;
    if (!api) return null;
    fabDrawLayout();
    /* A CHOSEN CUT THAT IS NO LONGER ON THE CELLS gives up its chosen-ness as well as its value, or the
       next draw would keep asking to re-derive a cut it had already been told to forget.
       Tested against the WINDOW being drawn, which is also what re-places a stale row: `cutWindow`
       clamps the row into the new placement, so a design that shrank cannot leave the window pointing
       past the last row - what can still fail is the x, and that is what this drops. */
    if (fabPicked && (!fabFig || fabCutX === null || !api.sectionAt(fabFig, fabCutX, fabWin()))) {
      fabPicked = false;
      fabCutX = null;
    }
    return fabDrawSection();
  }

  /* WHICH SIDE IS WHICH, from the drawing's own report rather than from the cut: `regions` is collected
     while the shapes are rendered, so a caption cannot end up over a region the picture does not have.
     Refilled on every draw, since a cut through a different cell has different regions - and cleared
     first, or the ideal pair's two captions would survive onto a partial stack that has one. */
  function fabPaintRegions() {
    const strip = elRegions;
    if (!strip) return;
    strip.innerHTML = '';
    ((fabDrawn && fabDrawn.regions) || []).forEach((r) => {
      const s = document.createElement('span');
      s.className = 'fab-region';
      s.style.left = r.pct + '%';
      s.textContent = r.text;
      strip.appendChild(s);
    });
  }


  /* STEP k MEANS "everything up to and including k", which is what makes this a process and not a
     slideshow: each step adds its masks to what the ones before it left. The badges are repainted from
     the same decision, so the column always says what the drawing shows.

     FIVE THINGS SAY WHERE THE PROCESS IS and they are written together here, which is learn.js's rule
     for the same panel: the shapes, the mask badges, the step caption, the counter and the bar. Written
     apart they will disagree, and a reader has no way to tell which of the five is lying. */
  function fabShow(k) {
    var api = SELF;
    const body = elBody;
    if (!api || !body || !fabSteps.length) return;
    fabStep = Math.max(0, Math.min(k, fabSteps.length - 1));
    const upto = {};
    fabSteps.slice(0, fabStep + 1).forEach((s) => s.classes.forEach((c) => { upto[c] = true; }));
    /* THE PALETTE IS REPAINTED FROM THE SAME DECISION, and applied to the whole FIGURE - so stepping the
       process builds up the layout beside the section rather than only the wafer. That is the payoff of
       the two drawings sharing one set of layer classes: the animation needed no notion of visibility of
       its own, and one call covers both panels. */
    fabLayerBtns.forEach((m) => {
      const on = !!upto[m.L.cls];
      fabOff[m.L.cls] = !on;
      fabPaintLayerBtn(m.btn, m.L, on);
      api.setLayerVisible(fabBox(), m.L.cls, on);
    });
    /* THE MATERIALS TOO, and they have no pill - which is why they are easy to forget and why forgetting
       them was visible on a topic page: step one drew the oxides over a bare wafer, because a shape
       nothing can hide is a shape that is always there. */
    const matsOn = {};
    fabSteps.slice(0, fabStep + 1).forEach((s) => (s.materials || []).forEach((c) => { matsOn[c] = true; }));
    api.materialClasses().forEach((c) => api.setLayerVisible(body, c, !!matsOn[c]));
    const s = fabSteps[fabStep];
    /* THE EFFECT FOLLOWS THE STEP, and it is named as well as drawn: the shapes say what a step leaves
       behind, `Ion implant · n-type` says what it does. Asked for on every step change rather than only
       while playing, because a step is a process that takes time whether the reader arrived by the
       timer or by dragging the bar - `run(true)` keeps it firing, and what stops the field is a step
       with nothing to fire at (the bare wafer has no zones) or putting the card away. Reduced motion
       never spawns at all, inside the renderer, so nothing here has to ask. */
    const fx = api.stepEffect(s, fabDrawn);
    if (fabDrawn && fabDrawn.svg) {
      api.effects.show(body, fabDrawn.svg, fx);
      api.effects.run(true);
    }
    const panel = elStep;
    if (panel) {
      panel.innerHTML = '';
      const title = document.createElement('div');
      title.className = 'fab-step-title';
      title.textContent = (fabStep + 1) + '/' + fabSteps.length + '  ' + (s.title || s.label || '');
      const desc = document.createElement('div');
      desc.className = 'fab-step-desc';
      desc.textContent = s.desc || '';
      panel.appendChild(title);
      panel.appendChild(desc);
      const badge = document.createElement('div');
      badge.className = 'fab-fx-badge';
      badge.textContent = '✦ ' + fx.name;
      panel.appendChild(badge);
    }
    fabPaintProg(s);
    fabQuietLater();
  }

  /* THE FINISHED WAFER GOES QUIET. Armed on arriving at the last step and cancelled by leaving it, so
     stepping back and forth cannot leave two of these running - the clear is at the top for that reason
     rather than as a formality.

     IT STOPS THE SPAWNING, NOT THE FIELD: `run(false)` lets what is in flight finish its own flight, which
     is the same distinction Pause makes and keeps the last beams from being snapped out of existence
     mid-air. The player's timer is untouched, since by here there is none - `fabTick` stops at the last
     step, which is what makes this the only thing still moving. */
  function fabQuietLater() {
    var api = SELF;
    if (fabIdleTimer) { clearTimeout(fabIdleTimer); fabIdleTimer = null; }
    if (!fabSteps.length || fabStep !== fabSteps.length - 1) return;
    fabIdleTimer = setTimeout(() => {
      fabIdleTimer = null;
      /* Guarded because a figure may have been redrawn or the page torn down in between, and a decoration
         must never cost anything more than itself. */
      try { api.effects.run(false); } catch (e) { /* nothing to quieten */ }
    }, FAB_IDLE_MS);
  }

  /* THE COUNTER AND THE BAR, which are one fact said twice: a bar says roughly and `4 / 14` says
     exactly, which is the two-encodings rule this repo holds anything meaning-in-colour to.

     THE SEGMENTS ARE BUILT HERE rather than with the row, because the step count is only settled once
     a drawing has reported its materials - and it changes when the reader moves between the ideal pair
     and a cut whose cell has fewer masks. Rebuilt only when the COUNT differs, so stepping does not
     churn the DOM once a second. */
  function fabPaintProg(s) {
    const num = elStepNum;
    if (num) num.textContent = (fabStep + 1) + ' / ' + fabSteps.length;
    const bar = elProg;
    if (!bar) return;
    if (bar.children.length !== fabSteps.length) {
      bar.innerHTML = '';
      for (let i = 0; i < fabSteps.length; i++) {
        const seg = document.createElement('div');
        seg.className = 'fab-prog-seg';
        /* Hidden from assistive tech: the bar's own ARIA says where it is, and fourteen unlabelled
           divs would be nothing but noise. */
        seg.setAttribute('aria-hidden', 'true');
        bar.appendChild(seg);
      }
    }
    /* CUMULATIVE, because the drawing beside it is: at step 5 the wafer really does carry everything
       the first five steps did. */
    [].forEach.call(bar.children, (seg, i) => seg.classList.toggle('on', i <= fabStep));
    bar.setAttribute('aria-valuemin', '1');
    bar.setAttribute('aria-valuemax', String(fabSteps.length));
    bar.setAttribute('aria-valuenow', String(fabStep + 1));
    bar.setAttribute('aria-valuetext', (fabStep + 1) + ' / ' + fabSteps.length + ': '
                                      + ((s && (s.title || s.label)) || ''));
  }

  /* WHERE A POINTER MEANS: N equal cells, so `floor(f * N)` clamped at the top - what the eye expects
     of a segmented bar, where a continuous one would need rounding and a rule about which half of a
     gap belongs to which step. Null when the bar has not been laid out, which is what the stub DOM
     reports and what a display:none card would. */
  function fabStepAt(clientX) {
    const bar = elProg;
    const b = bar && bar.getBoundingClientRect ? bar.getBoundingClientRect() : null;
    if (!b || !b.width || !fabSteps.length) return null;
    const f = Math.max(0, Math.min(1, (clientX - b.left) / b.width));
    return Math.max(0, Math.min(fabSteps.length - 1, Math.floor(f * fabSteps.length)));
  }
  /* ONE WRITER for every way of arriving at a step, so a click, a drag and the arrow keys cannot
     disagree about what a position means - and each STOPS the player rather than fighting it, since
     the next tick would otherwise undo the press. */
  function fabGoTo(k) {
    if (k === null || k === fabStep) return;
    fabStop();
    fabShow(k);
  }

  /* Play from the BEGINNING when the last run finished, so a press at the end replays rather than
     sitting on a built cell doing nothing - and the label, the pressed flag and the timer are one
     state written three ways. */
  function fabPlay() {
    if (fabTimer) { fabStop(); return; }
    const btn = elPlay;
    if (btn) { btn.innerHTML = '&#9208; Pause'; btn.setAttribute('aria-pressed', 'true'); }
    fabShow(fabStep >= fabSteps.length - 1 ? 0 : fabStep);
    fabTimer = setTimeout(fabTick, stepMs());
  }
  function fabTick() {
    if (fabStep >= fabSteps.length - 1) { fabStop(); return; }
    fabShow(fabStep + 1);
    fabTimer = setTimeout(fabTick, stepMs());
  }
  function fabStop() {
    if (fabTimer) { clearTimeout(fabTimer); fabTimer = null; }
    const btn = elPlay;
    if (btn) { btn.innerHTML = '&#9654; Play'; btn.setAttribute('aria-pressed', 'false'); }
  }


    /* THE PLAYER'S OWN CONTROLS, wired here rather than by the host: the builder made these three
       elements, so nothing outside needs to know their ids to make them work. pnr.html wired them
       from its setup and code2silicon would have had to wire them again. */
    elPlay.addEventListener('click', function () { fabPlay(); });
    /* RESET GOES TO THE BARE WAFER, deliberately, where a Play at the end replays from the
       beginning: step 1 is a fact about the process (this is what you start with) and is worth
       being able to ask for. It stops the player first, or the next tick would walk straight off
       it. */
    elReset.addEventListener('click', function () { fabStop(); fabShow(0); });
    /* THE BAR IS THE STEPPER: a click jumps, a drag scrubs, and the arrow keys walk it once it has
       focus - which is what replaces the keyboard access Prev/Next would have given. All four go
       through `fabGoTo`, so none of them can mean a different step from the others. */
    elProg.addEventListener('click', function (ev) { fabGoTo(fabStepAt(ev.clientX)); });
    elProg.addEventListener('pointerdown', function (ev) {
      fabBarDrag = true;
      fabGoTo(fabStepAt(ev.clientX));
      if (ev.preventDefault) ev.preventDefault();
    });
    elProg.addEventListener('pointermove', function (ev) {
      if (fabBarDrag) fabGoTo(fabStepAt(ev.clientX));
    });
    elProg.addEventListener('pointerup', function () { fabBarDrag = false; });
    elProg.addEventListener('keydown', function (ev) {
      var k = ev.key;
      if (k === 'ArrowLeft' || k === 'ArrowDown') fabGoTo(Math.max(0, fabStep - 1));
      else if (k === 'ArrowRight' || k === 'ArrowUp') fabGoTo(Math.min(fabSteps.length - 1, fabStep + 1));
      else if (k === 'Home') fabGoTo(0);
      else if (k === 'End') fabGoTo(fabSteps.length - 1);
      else return;
      if (ev.preventDefault) ev.preventDefault();
    });

    /* WHAT THE HOST GETS. `openOn` is pnr.html's own arrival, minus the parts that are its page's:
       revealing the card, refreshing the tab strip and scrolling are the caller's, because they are
       about the PAGE and differ between the two. */
    return {
      el: elFig,
      draw: fabDraw,
      drawLayout: fabDrawLayout,
      stop: fabStop,
      play: fabPlay,
      show: fabShow,
      steps: function () { return fabSteps.length; },
      at: function () { return fabStep; },
      drawn: function () { return fabDrawn; },
      fig: function () { return fabFig; },
      cut: function () { return fabCutX; },
      /* OPEN ON A CUT THROUGH THE FIRST CELL, which is what makes the figure say something the
         moment it appears rather than opening on the ideal pair with the design beside it.
         THE ROW COMES FROM THAT SAME CELL, so the window is centred where the cut is rather than on
         whatever row was left over from a previous design. */
      openOn: function () {
        fabStop();
        fabDrawLayout();
        if (!fabPicked && fabFig) {
          var first = fabFig.placed[0];
          var mid = first.x + first.w / 2;
          fabCutRow = SELF.rowPitch ? Math.floor(first.y / SELF.rowPitch()) : 0;
          var win = SELF.cutWindow ? SELF.cutWindow(fabFig, fabMaxRows, fabCutRow) : null;
          var at = SELF.snapCut ? SELF.snapCut(fabFig, mid, win) : mid;
          if (SELF.sectionAt(fabFig, at, win)) { fabPicked = true; fabCutX = at; }
        }
        fabDraw();
      },
      /* THE ROW WINDOW, for a host that wants to drive it and for a harness that has to read it back:
         the cap as the reader set it, the row they chose, and the window those two resolve to. */
      maxRows: function (n) {
        if (n === undefined) return fabMaxRows;
        elRows.value = String(n);
        applyMaxRows();
        return fabMaxRows;
      },
      row: function () { return fabCutRow; },
      win: fabWin
    };
  }

  return { drawStatic: drawStatic, placeableCells: placeableCells, rowPx: ROW_PX,
           lambdaUm: LAMBDA_UM, source: SOURCE, setLayerVisible: setLayerVisible,
           /* The lambda-to-micron conversion, exported because the cut label needs it too - and one
              formatter means the cut and the measured line under the layout cannot round differently. */
           um: um,
           /* the placement's caption, as one line - both pages write it under their Layout drawing */
           tallyLine: tallyLine,
           /* the cross section: derive, draw, and the three questions a caller asks about a cut */
           sectionAt: sectionAt, drawSection: drawSection, drawCutLine: drawCutLine,
           defaultCut: defaultCut, cutStops: cutStops, cutLabel: cutLabel,
           cutFromClientX: cutFromClientX, snapCut: snapCut, processSteps: processSteps,
           /* HOW MANY ROWS A SECTION SHOWS AND WHICH ONES. `cutWindow` is the single writer of that
              decision and the reason it is exported rather than kept private: the figure, its markers
              and its caption all have to describe one window, and a second caller working it out for
              itself is how they would come to describe two. */
           cutWindow: cutWindow, windowY: windowY, rowsIn: rowsIn, rowPitch: rowPitch,
           cutRowFromClientY: cutRowFromClientY,
           strata: STRATA, secGeom: SEC,
           /* the ideal pair, and the words for each step of the process */
           drawIdeal: drawIdeal, idealMasks: idealMasks, stepText: STEP_TEXT,
           pageColour: pageColour, contrast: contrast, materialLabels: MATERIAL_LABEL,
           /* the process effects: the plan for a step, and the field that draws it */
           stepEffect: stepEffect, effects: effects,
           materialClasses: materialClasses,
           drawHoverLine: drawHoverLine,
           /* the pan and zoom every box that shows a placement shares, and its constants - a
              caller that wants the gestures calls attachView, a figure simply does not */
           attachView: attachView, zoomStep: ZOOM_STEP, zoomMax: ZOOM_MAX, zoomFloor: ZOOM_FLOOR,
           /* the Fabrication figure and its player, built and owned here so the two pages that
              show it cannot drift into two cards */
           attachFabrication: attachFabrication };
})();
