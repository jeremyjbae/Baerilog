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
  function planFor(netlist, rowWidthLambda) {
    var P = window.PNR;
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
    var plan = P.place(ex.instances, (rowWidthLambda || 0) * 1000 || Infinity);
    return { plan: plan, expanded: ex.expanded || [], module: parsed.name,
             unplaceable: plan.unplaceable || [] };
  }

  /* Draw one placement into `el`. Returns what was drawn, for a caller to assert on and for a
     harness to read back: the numbers a picture cannot be questioned about otherwise. */
  function drawStatic(el, opts) {
    var out = { cells: 0, types: [], rows: 0, expanded: [], unplaceable: [], width: 0, height: 0 };
    if (!el || !opts || !opts.netlist) return out;
    var built = planFor(opts.netlist, opts.rowWidth);
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
  var LAYER_NAME = { ALU1: 'METAL1', CONT: 'CONTACT', NDIF: 'N-DIFF', NWELL: 'N-WELL',
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
  var LAYER_STACK = ['METAL1', 'CONTACT', 'POLY2', 'POLY', 'P-DIFF', 'N-DIFF', 'N-WELL'];

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
      var raw = c.replace(/^layer-/, '').replace(/_ALL$/, '');
      label[c] = LAYER_NAME[raw] || raw;
      taken[label[c]] = (taken[label[c]] || 0) + 1;
    });
    var cols = coloursOf();
    /* Sorted on `label[c]` - the mask name BEFORE the ambiguity fallback below - so two classes that
       collapse to one mask still sit together in the stack even though their buttons end up carrying
       their .ap names. The class is the last tie-break, so the row is stable rather than depending on
       the order the regex happened to meet the shapes in. */
    var rank = function (c) {
      var i = LAYER_STACK.indexOf(label[c]);
      return i < 0 ? LAYER_STACK.length : i;
    };
    return order.slice().sort(function (a, b) {
      return rank(a) - rank(b)
             || (label[a] < label[b] ? -1 : label[a] > label[b] ? 1 : (a < b ? -1 : 1));
    }).map(function (c) {
      return { cls: c,
               label: taken[label[c]] > 1 ? c.replace(/^layer-/, '') : label[c],
               colour: cols[c] || null,
               textOn: readableOn(cols[c]) };
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

  return { drawStatic: drawStatic, placeableCells: placeableCells, rowPx: ROW_PX,
           lambdaUm: LAMBDA_UM, source: SOURCE, setLayerVisible: setLayerVisible };
})();
