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
    var ex = P.expand(parsed.instances);
    /* A ROW COUNT WINS OVER A WIDTH, because it is the more specific request: a figure that says
       `rows: 4` has decided its shape, and a width left beside it in the topic file would be a
       second answer to the same question. The width path is what every figure used before and is
       untouched where no count is given. */
    var plan = rows > 0 ? P.place(ex.instances, { rows: rows })
                        : P.place(ex.instances, (rowWidthLambda || 0) * 1000 || Infinity);
    /* AND ROUTED, unless a figure says otherwise. A placement with no wires is a floorplan, which is
       a fair thing to draw and not what these figures are for - the netlist says which cells connect
       to which, and a picture that leaves that out asks the reader to take it on trust. `route: false`
       is there for a figure that wants the bare arrangement; nothing uses it yet. `P.route` is guarded
       because a page may be carrying an older slice, where a missing router should cost the wires and
       not the whole figure. */
    if (opts.route !== false && P.route) P.route(plan);
    return { plan: plan, expanded: ex.expanded || [], module: parsed.name,
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

    out.cells = built.plan.placed.length;
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
  function sectionAt(res, cutX) {
    var hits = cellsAtCut(res, cutX);
    if (!hits.length) return null;
    var TOTAL = cutSpan(res);
    var by = {}, rows = [];
    /* Bottom of the placement first, so the drawing reads in the same direction as the axis and a
       report of the rows is in the order they appear on it. */
    hits.slice().sort(function (a, b) { return (b.y + b.h) - (a.y + a.h); }).forEach(function (cell) {
      var base = TOTAL - (cell.y + cell.h);       // where this row's own frame starts along the cut
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
       honest about which layer runs which way. */
    var routes = (res && res.routes && res.routes.shapes) || [];
    routes.forEach(function (r) {
      if (cutX < r.x || cutX > r.x + r.w) return;
      var mask = ROUTE_MASK[r.layer];
      if (!mask) return;
      var lo = Math.max(0, TOTAL - (r.y + r.h)), hi = Math.min(TOTAL, TOTAL - r.y);
      if (hi <= lo) return;                       // entirely off the placement
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
    return { cell: rows[0].cell, cells: rows, cut: cutX, local: rows[0].local,
             height: TOTAL, masks: by, stackTop: top };
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
     intervals draw the same picture, so only the first of a run is kept. */
  function cutStops(res) {
    var out = [], last = null;
    var placed = (res && res.placed) || [];
    if (!placed.length) return out;
    var x2 = placed[placed.length - 1].x + placed[placed.length - 1].w;
    for (var x = placed[0].x; x <= x2; x += 500) {
      var sec = sectionAt(res, x);
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
     left edge. An absent answer has to be absent. */
  function defaultCut(res) {
    var placed = (res && res.placed) || [];
    if (!placed.length) return null;

    var x2 = placed[placed.length - 1].x + placed[placed.length - 1].w, run = [];
    for (var x = placed[0].x; x <= x2; x += 500) {
      var sec = sectionAt(res, x);
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
  function idealMasks() {
    var seen = [];
    idealShapes().shapes.forEach(function (s) {
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
  function idealShapes() {
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
  function drawSection(el, res, cutX) {
    /* `rects` is the drawing AS DATA - one record per shape, with the depth band it was given -
       because a picture cannot be questioned any other way: the plug that stops at the poly, the
       implant that sits inside the well and the ordering of the whole stack are all geometry, and a
       harness that can only count elements cannot tell any of them from a plausible mistake. */
    var out = { cut: cutX, label: '', masks: [], shapes: 0, rects: [] };
    if (!el) return out;
    el.innerHTML = '';
    var sec = sectionAt(res, cutX);
    out.label = cutLabel(sec);
    if (!sec) return out;
    out.masks = Object.keys(sec.masks).sort();
    out.cell = sec.cell.type;
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
  function drawIdeal(el) {
    var out = { cut: null, label: 'ideal CMOS pair', masks: [], shapes: 0, rects: [], ideal: true };
    if (!el) return out;
    var plan = idealShapes();
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
     the one thing that says where the section comes from. */
  function drawCutLine(res, cutX) {
    var svg = res && res.svg;
    if (!svg) return null;
    var g = svg.querySelector('.pnr-cut');
    if (!g) {
      g = svgEl('g', { class: 'pnr-cut' });
      svg.appendChild(g);
      g.appendChild(svgEl('line', { class: 'pnr-cut-line', y1: 0, y2: res.plan_h || 0 }));
    }
    var line = g.querySelector('.pnr-cut-line');
    var h = 0;
    (res.placed || []).forEach(function (p) { h = Math.max(h, p.y + p.h); });
    line.setAttribute('x1', String(cutX));
    line.setAttribute('x2', String(cutX));
    line.setAttribute('y1', '0');
    line.setAttribute('y2', String(h));
    return g;
  }

  /* THE HOVER MARKER: where a click would cut, drawn faintly so it cannot be mistaken for the cut
     itself. Its own element rather than a class on the cut line, because both are on screen at once
     while the pointer is over the layout - and `null` removes it, which is what pointerleave sends. */
  function drawHoverLine(res, x) {
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
    var line = g.querySelector('.pnr-hover-line'), h = 0;
    (res.placed || []).forEach(function (p) { h = Math.max(h, p.y + p.h); });
    line.setAttribute('x1', String(x));
    line.setAttribute('x2', String(x));
    line.setAttribute('y1', '0');
    line.setAttribute('y2', String(h));
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
    var total = 0;
    (res.placed || []).forEach(function (p) { total = Math.max(total, p.x + p.w); });
    return (clientX - b.left) / b.width * total;
  }

  function snapCut(res, x) {
    var stops = cutStops(res);
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
         so it follows the panel's width with no number repeated here. */
      var vb = (svg && svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
      var r = svg && svg.getBoundingClientRect ? svg.getBoundingClientRect() : { width: 0, height: 0 };
      return { x0: vb[0], y0: vb[1], w: vb[2] || 1, h: vb[3] || 1,
               pw: r.width || 0, ph: r.height || 0 };
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
      cv.width = Math.max(1, Math.round(g.pw));
      cv.height = Math.max(1, Math.round(g.ph));
      ctx = cv.getContext && cv.getContext('2d');
    }
    function toPx(g, ux, uy) {
      return { x: (ux - g.x0) / g.w * g.pw, y: (uy - g.y0) / g.h * g.ph };
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

  return { drawStatic: drawStatic, placeableCells: placeableCells, rowPx: ROW_PX,
           lambdaUm: LAMBDA_UM, source: SOURCE, setLayerVisible: setLayerVisible,
           /* The lambda-to-micron conversion, exported because the cut label needs it too - and one
              formatter means the cut and the measured line under the layout cannot round differently. */
           um: um,
           /* the cross section: derive, draw, and the three questions a caller asks about a cut */
           sectionAt: sectionAt, drawSection: drawSection, drawCutLine: drawCutLine,
           defaultCut: defaultCut, cutStops: cutStops, cutLabel: cutLabel,
           cutFromClientX: cutFromClientX, snapCut: snapCut, processSteps: processSteps,
           strata: STRATA, secGeom: SEC,
           /* the ideal pair, and the words for each step of the process */
           drawIdeal: drawIdeal, idealMasks: idealMasks, stepText: STEP_TEXT,
           pageColour: pageColour, contrast: contrast, materialLabels: MATERIAL_LABEL,
           /* the process effects: the plan for a step, and the field that draws it */
           stepEffect: stepEffect, effects: effects,
           materialClasses: materialClasses,
           drawHoverLine: drawHoverLine };
})();
