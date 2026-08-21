/* learn.js - what makes a topic page a topic page.
 *
 * Runs after shell.js and app.js, as practice.js does on an exercise page, and for the
 * same reason: shell.js has to have injected the markup app.js's UI wiring looks up, and
 * app.js has to have defined everything before anything here can call it. Its top-level
 * functions see app.js's bindings directly (setEditorText, runSimulation, logLine,
 * result) because classic scripts share one global lexical scope - the same property
 * practice.js relies on, and what lets app.js stay a byte-identical copy of the
 * simulator's script with no exports bolted on.
 *
 * Three jobs:
 *
 *   1. build the ARTICLE from topics/<slug>.js and put it above the app's grid
 *   2. MOVE the cards the topic asked for into the holes in that article
 *   3. render the TRUTH TABLE from the run, whenever one happens
 *
 * The second is the interesting one. The cards are the ones shell.js injected - the same
 * editor, waveform and netlist viewer a practice page has - and moving a card with
 * appendChild does not disturb any of it, because every handler app.js registered finds
 * its element by getElementById and the collapse buttons walk up with closest('.card').
 * So a card can sit in the middle of an explanation and still be the whole card, with its
 * height controls, its radix menus and its layout buttons live. Nothing is re-created,
 * which is what keeps this a reuse of the app rather than a second copy of it.
 */
(function () {
  'use strict';

  var slug = window.LEARN_SLUG;
  var topic = (window.LEARN_TOPICS || {})[slug] || null;
  var meta = (window.LEARN_MANIFEST || []).filter(function (e) { return e.slug === slug; })[0]
             || { slug: slug, title: slug, category: '', level: 0 };

  function $(id) { return document.getElementById(id); }
  function mk(tag, cls, id) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (id) el.id = id;
    return el;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- 1. the page's own chrome -------------------------------------------------
     The header bar arrives with the injected markup, so all that is needed here is to
     move the current-app marker onto Learn and retitle the crumb. Scoped to the nav
     element rather than written as a compound selector, because the stub DOM the harness
     uses resolves one simple selector at a time and a silently-empty NodeList would leave
     the marker on Simulator - the same reason shell.js does it that way. */
  (function () {
    var nav = document.querySelector('.gh-nav');
    if (nav) {
      var links = nav.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        links[i].classList.remove('here');
        if ((links[i].getAttribute('href') || '') === 'learn.html') links[i].classList.add('here');
      }
    }
    var h1 = document.querySelector('h1');
    if (h1) {
      /* `Learn` capitalised, `logic-gates` not - see shell.js's note on the same line: the
         section is a place with a name, the leaf is a slug. */
      /* Baerilog / Learn / <title>, the shape shell.js now writes for an exercise and the
         apps have always written - so the leaf is the human title rather than the slug, and
         the level label comes along because a topic and an exercise are the same kind of
         thing to a reader. See shell.js's note for why the slug lost that place. */
      h1.innerHTML = '<a href="index.html">Baerilog</a>'
                   + '<span class="sep">/</span>'
                   + '<a href="learn.html">Learn</a>'
                   + '<span class="sep">/</span>'
                   + '<span class="here">' + esc(meta.title || meta.slug || '') + '</span>'
                   + '<span class="gh-label">'
                   + esc([meta.category, meta.level ? 'Level ' + meta.level : '']
                         .filter(Boolean).join(' \u00b7 ')) + '</span>';
    }
    /* `.gh-sub`, not `.subtitle`. The breadcrumb heading moved into style.css and the
       markup was renamed with it, so this selector had been returning null - which is why
       the line under the crumb read `undefined`: shell.js had already written it from a
       PRACTICE_META it builds for a page it knows nothing about, and this never overwrote
       it. Silent in both directions, since a missing element and a missing blurb both
       leave the line alone. */
    var sub = document.querySelector('.gh-sub');
    if (sub) sub.textContent = meta.blurb || '';
    document.title = meta.title + ' · Baerilog Learn';
  })();

  /* ---- 2. the article, and the holes in it -------------------------------------
     One <article> built from the topic's blocks, inserted BEFORE the grid - so the prose
     is the page and the app's cards are things inside it, rather than the other way
     round. A {slot} block leaves an empty div; the cards move into them below. */
  var grid = document.querySelector('.grid');
  var article = mk('article', 'learn-article', 'learnArticle');
  var slots = {};
  var figureHoles = {};
  var layoutHoles = {};
  var quizHoles = {};
  var widgetHoles = {};

  /* ---- named sections, for a quiz to point back at -------------------------------
     A heading marked `data-sec="key"` in a topic's prose is a section a question may name. Two
     things are taken from it: an `id` to link to, and the heading's OWN TEXT as the link's label -
     so the words in the quiz are the words on the page and cannot drift from them.

     Read out of the block's HTML rather than the DOM, and the id is written INTO that html before
     it is injected. Both for the same reason: the stub DOM the harness uses parses no markup, so a
     `querySelector('[data-sec=...]')` finds nothing there and the whole feature would be
     untestable headlessly while working in a browser. Rewriting the string works identically in
     both, and the id cannot end up missing.

     A heading that already carries an `id` keeps it - an author's own anchor wins over a derived
     one, and a topic that links to `#something` in its prose must not have it renamed. */
  var sections = {};
  var SEC_RE = /<(h[1-6])([^>]*?)\bdata-sec="([\w-]+)"([^>]*)>([\s\S]*?)<\/\1>/g;
  function indexSections(html) {
    return String(html || '').replace(SEC_RE, function (all, tag, pre, key, post, inner) {
      var id = 'sec-' + key;
      sections[key] = { id: id, label: inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() };
      if (/\bid=/.test(pre + post)) return all;
      return '<' + tag + pre + ' id="' + id + '" data-sec="' + key + '"' + post + '>'
           + inner + '</' + tag + '>';
    });
  }
  if (topic && topic.blocks) {
    topic.blocks.forEach(function (b) {
      if (b.layout) {
        /* A PLACEMENT figure: the same idea as {figure} but a different picture made of different
           things - real cell layouts abutted into rows, drawn by practice-pnr.js out of pnr.html's
           engine. Its own block kind and its own drawer, deliberately: sharing either would mean one
           set of options describing a graph diagram and a mask layout at once. */
        var pf = mk('div', 'learn-fig');
        var pb = mk('div', 'learn-fig-box');
        pb.setAttribute('data-layout', b.layout);
        pf.appendChild(pb);
        layoutHoles[b.layout] = pb;
        article.appendChild(pf);
        return;
      }
      if (b.figure) {
        /* A figure is a FRAME plus the box drawStatic draws into: the frame carries the
           border and the padding, so the drawn box keeps its own content height and a caption
           can sit under it without being inside the diagram. */
        var frame = mk('div', 'learn-fig');
        var box = mk('div', 'learn-fig-box');
        box.setAttribute('data-figure', b.figure);
        frame.appendChild(box);
        figureHoles[b.figure] = box;
        article.appendChild(frame);
        return;
      }
      if (b.slot) {
        var hole = mk('div', 'learn-slot');
        hole.setAttribute('data-app-slot', b.slot);
        slots[b.slot] = hole;
        article.appendChild(hole);
        return;
      }
      if (b.widget) {
        /* A WIDGET: the second interactive thing a topic can carry, and the same shape as a quiz - a
           hole here, the data in `topic.widgets[name]`, the behaviour in this file. A topic stays DATA,
           which is what lets `figures`, `layouts`, `quizzes` and now this one all be read the same way
           and checked the same way. */
        var wh = mk('div', 'learn-widget');
        wh.setAttribute('data-widget', b.widget);
        widgetHoles[b.widget] = wh;
        article.appendChild(wh);
        return;
      }
      if (b.quiz) {
        /* A QUIZ: the one interactive thing a topic can carry that is not one of the app's cards,
           so it gets a block kind and a hole of its own like a figure does. The questions live in
           `topic.quizzes[name]` rather than in this block, for the reason figures do: a block list
           is the running order of the page and the data belongs beside the other data. */
        var qh = mk('div', 'learn-quiz');
        qh.setAttribute('data-quiz', b.quiz);
        quizHoles[b.quiz] = qh;
        article.appendChild(qh);
        return;
      }
      var sec = mk('div', 'learn-prose');
      sec.innerHTML = indexSections(b.html);
      article.appendChild(sec);
    });
  }
  if (grid && grid.parentElement) grid.parentElement.insertBefore(article, grid);

  /* ---- how big this topic's truth tables are drawn --------------------------------
     `truthTable.scale` is a MULTIPLIER on the 12px learn.css sets, put on the article as a custom
     property so every table under it follows - the card learn.js renders from the run AND any the
     prose writes out. One knob per topic, because a page whose card and paragraphs disagreed about
     how big a truth table is would read as two different kinds of table.

     Absent means absent: nothing is written, so learn.css's own fallback applies - and THAT is
     where the site default lives (1.2, i.e. 120% of the 12px the panel is otherwise set in), so
     this file has no default of its own to disagree with it. A topic's number is stated against
     the same 12px base, so 1 is what every table was before the knob existed. That is also why
     `truthTable` may carry a scale and no columns - `lego-logic` states its tables in prose and
     has no card at all, so the size is the only thing it has to say about them.

     CLAMPED, and the clamp is disclosed through LEARN_API rather than silently applied: 0 or a
     typo'd string would otherwise collapse every table to nothing, and the range is what a
     12px base can be stretched to before the panel stops looking like the read-only output it
     is. A value outside it is honoured up to the bound rather than ignored. */
  var TRUTH_SCALE_MIN = 0.6, TRUTH_SCALE_MAX = 2.5;
  function truthScale() {
    var raw = topic && topic.truthTable ? topic.truthTable.scale : undefined;
    if (raw === undefined || raw === null || raw === '') return null;
    var n = Number(raw);
    if (!isFinite(n) || n <= 0) return null;
    return Math.max(TRUTH_SCALE_MIN, Math.min(TRUTH_SCALE_MAX, n));
  }
  (function () {
    var n = truthScale();
    if (n === null || !article.style || !article.style.setProperty) return;
    article.style.setProperty('--truth-scale', String(n));
  })();

  /* Which card answers to which slot name. `netlist` and `netlist-view` are
     practice-synth.js's, and they do not exist until a synthesis has succeeded - that app
     builds them on demand and takes them away again on a failure - so those two are
     resolved lazily, every time, rather than once at load. */
  var CARD_FOR = {
    'editor': 'card-editor',
    'testbench': 'card-testbench',
    'console': 'card-console',
    'waveform': 'card-wave',
    'hierarchy': 'card-hierarchy',
    'memory': 'card-memory',
    'model': 'card-model',
    'netlist': 'card-netlist',
    /* BOTH NAMES ARE THE SAME CARD NOW: the Netlist Viewer became the Synthesis Results card's
       Diagram view, so there is one card for a topic to place. A topic that asks for both - all
       fifteen do - gets it at the LATER of the two holes, because `fill` appends per slot in
       document order and appendChild MOVES a node; the earlier hole is left empty. That is why no
       topic file had to change, and the later position is the better one anyway: it is where the
       prose introducing the picture leads, and the picture is what the card opens on. */
    'netlist-view': 'card-netlist'
  };

  /* A card is MOVED, not copied: appendChild on a node already in the document detaches it
     from where it was. That is the whole mechanism, and it is why nothing about the card
     has to be rebuilt or re-wired.

     Two of the app's controls are deliberately hidden on the cards that move, and they are
     hidden rather than left dead: the editor/console STACK toggle works by putting a class
     on `.grid` and styling `.grid.stack-editor-console .layout-pair`, and the waveform's
     full-bleed EXPAND measures `.grid`'s width to compute its negative margins. Both are
     statements about a card that is a grid item, and a card in the middle of an article is
     not one. A button that silently does nothing is worse than one that is not there. */
  function fill() {
    /* TWO PASSES, AND THE SECOND ONE IS WHY. Since the Netlist Viewer became the Synthesis
       Results card's Diagram view, `netlist` and `netlist-view` are ONE card - so a topic
       asking for both (all fifteen do) has two holes and one thing to put in them, and
       `appendChild` MOVES a node: the second hole wins and the FIRST is left behind. Deciding
       a hole's visibility in the same pass as the move therefore decided it too early - the
       abandoned hole was measured `display: ''` with no child in it, i.e. 24px of
       `.learn-slot` margin sitting in the prose where the listing used to be.

       So every move happens first, and only then is each hole asked the question that can now
       be answered: does it actually hold its card? That also keeps the rule a SINGLE writer -
       one place decides whether a hole is shown, for both reasons a hole can be empty (its
       card is hidden, or its card went to a later hole). */
    var wanted = {};
    Object.keys(slots).forEach(function (name) {
      var hole = slots[name];
      var card = $(CARD_FOR[name] || '');
      if (!card) return;
      wanted[name] = card;
      if (card.parentElement === hole) return;            // already in this hole
      hole.appendChild(card);
      var stack = card.querySelector('.layout-toggle [data-layout-btn]');
      if (stack && stack.parentElement) stack.parentElement.style.display = 'none';
      var expand = card.querySelector('#waveExpandBtn');
      if (expand && expand.parentElement) expand.parentElement.style.display = 'none';
    });
    /* A HOLE FOLLOWS ITS CARD'S VISIBILITY, and this runs even when the card was already here -
       which is the case that matters, since a card's visibility moves long after it was moved in.
       Without it the Synthesis Results hole keeps its own 24px margin on a page whose design the
       synthesizer refused, where practice-synth takes that card away: a gap in the prose with
       nothing in it. Read from the card rather than decided here - whoever hid it owns the
       reason - and `parentElement` is what covers the abandoned-hole case above. */
    Object.keys(wanted).forEach(function (name) {
      var hole = slots[name], card = wanted[name];
      var empty = card.parentElement !== hole || card.style.display === 'none';
      hole.style.display = empty ? 'none' : '';
    });
  }
  /* ---- 2d. figures: a static logic diagram in the prose --------------------------
     A {figure: 'name'} block is a hole the topic's own `figures[name]` is drawn into, with
     PRACTICE_SYNTH_API.drawStatic - the netlist viewer's own node and wire drawing, with none
     of its interaction. So an illustration is in the same visual language as the netlist that
     appears further down the page, and cannot drift from it.

     THE AUTHORING FORM IS DELIBERATELY NOT THE RENDERER'S. A topic writes

       {id: 'n', kind: 'nand', x: 120, y: 20}          and    ['a', 'n', 'a']

     where the renderer wants {id, type, data: {...}, position: {x, y}} and an edge with both
     handle ids. Converting here keeps the topic file readable - a figure is prose, not a data
     structure - and keeps the renderer's shape private, so it can change without every topic
     changing with it.

     Two conventions do the work. An output pin is `y` on every kind that has one, so the
     source handle DEFAULTS to it and is only written for a dff (`q`) or an adder (`sum`,
     `cout`); and a two-input gate's inputs are `a` and `b`, so an edge names the pin it
     arrives at. Getting one wrong does not fail silently: drawStatic counts an edge whose
     handle does not exist, and the check below refuses a figure with any.

     POSITIONS ARE THE AUTHOR'S. The real viewer gets them from the engine's layoutGraph and
     packColumns, neither of which has anything to say about a hand-made picture - and a
     figure exists precisely to show an arrangement the synthesizer would not produce, like an
     AND drawn as a NAND and an inverter. */
  var UNARY = { not: 1, buf: 1 };
  /* The gap under a symbol and the room its caption needs. Two numbers rather than one measured
     height, because a stub DOM has no layout to measure and a figure has to come out the same
     there as in a browser - the same reason drawStatic returns its own extent. */
  var CAPTION_GAP = 6, CAPTION_H = 16;
  function figureGraph(spec) {
    /* A PIN NOTHING LANDS ON IS NOT DRAWN, derived from the figure's own wires - the same rule the
       engine's dropInertPins applies to a synthesized netlist, and it has to be applied here too
       because a figure never goes through the engine: `figureGraph` hands drawStatic its nodes
       directly, so without this a hand-drawn adder kept the bubbled carry-in stub the netlist below
       it had already stopped drawing, and the two pictures on one page disagreed about the same
       block. `counter-4bit`'s adder adds one and has no carry in at all; it was drawing a stub going
       nowhere.

       Only the two pins that HAVE a symbol without them: an adder's `cin` (addnc/subnc) and a
       flip-flop's `rstn` (dffnr). A mux with no select is not a mux, so `sel` is always drawn.

       An explicit flag on the node WINS, so a topic that wants to show a bare pin - to point at it in
       the prose, say - writes `noCarry: false` and gets it. Same rule as an author's own heading id
       beating the derived one. */
    var wired = {};
    (spec.edges || []).forEach(function (e) {
      var t = e[1], pin = e[2] || 'a';
      (wired[t] || (wired[t] = {}))[pin] = true;   // nested, never a joined key: see cloud.js's NUL
    });
    function bare(id, pin) { return !(wired[id] && wired[id][pin]); }
    function pick(own, derived) { return own === undefined ? derived : !!own; }
    var nodes = (spec.nodes || []).map(function (n) {
      var pos = { x: n.x || 0, y: n.y || 0 };
      if (n.kind === 'in' || n.kind === 'out') {
        return { id: n.id, type: 'port', position: pos,
                 data: { dir: n.kind, label: n.label || n.id } };
      }
      if (n.kind === 'const') {
        return { id: n.id, type: 'const', position: pos, data: { label: n.label || '0' } };
      }
      if (n.kind === 'dff') {
        return { id: n.id, type: 'dff', position: pos,
                 data: { label: n.label || n.kind,
                         noReset: pick(n.noReset, bare(n.id, 'rstn')) } };
      }
      if (n.kind === 'mux2') {
        return { id: n.id, type: n.kind, position: pos, data: { label: n.label || n.kind } };
      }
      if (n.kind === 'add' || n.kind === 'sub') {
        return { id: n.id, type: 'adder', position: pos,
                 data: { op: n.kind, label: n.label || n.kind,
                         noCarry: pick(n.noCarry, bare(n.id, 'cin')) } };
      }
      return { id: n.id, type: 'gate', position: pos,
               data: { kind: n.kind, unary: !!UNARY[n.kind], label: n.label || n.kind } };
    });
    var edges = (spec.edges || []).map(function (e) {
      return { source: e[0], target: e[1], targetHandle: e[2] || 'a', sourceHandle: e[3] || 'y' };
    });
    return { nodes: nodes, edges: edges };
  }

  /* ---- placements ---------------------------------------------------------------
     `topic.layouts[name]` is either a netlist string of its own, or `from: 'design'` - which is the
     interesting case: a design that instantiates cells IS a netlist, so the page's own Verilog goes
     straight into placement with nothing in between. That is only true of a structural design, and
     it is derived rather than declared: the same reason the netlist viewer decides "already a
     netlist" from the cells it finds rather than from a flag in the topic file.

     The LIBRARY is deliberately not passed. pnr's placement needs the instance TYPES and takes the
     art for each from its own cell table, so the modules' bodies are irrelevant to it - which is why
     a placement can be drawn for a design whose cells this repo has layouts for and no synthesis has
     to happen first. */
  /* A figure's caption, set ONCE however many times the figure is drawn. Appending it was fine while
     every figure was drawn a single time at load, and became three captions under the placement the
     moment that one started following the design - the same text stacked up, one per press. So the
     element is reused where it exists: written as "set this caption" rather than "add a caption",
     which is the only form that is safe to call from a redraw. */
  /* The figure's FOOTER: the measured line and the credit on one row, since they are both facts about
     the picture above them and two stacked lines of 11px grey read as clutter. Created once and reused,
     like everything else a redraw touches. */
  /* One badge's two states, in one place so they cannot say different things. ON is the layer's colour
     with text computed against it by the drawer; OFF is the same colour as an OUTLINE with nothing
     inside, which reads as "not drawn" - where dimming the fill would read as a pale layer. The class
     is set as well as the inline colours, so the state has the two encodings this repo asks for
     wherever colour carries meaning, and `aria-pressed` says it a third way for anyone not reading
     colour at all. */
  function paintLayerBtn(b, L, on) {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    /* THE OUTLINE AND THE LABEL USE `onPage`, not the artwork's own colour: an off badge is a coloured
       outline with coloured text ON THE PAGE, and CONTACT's `#111111` on a dark page is a black
       outline with black text - the badge was simply not there. The ON state keeps the true colour,
       because then the swatch IS the fill and its text is measured against it. */
    b.style.borderColor = (on ? L.colour : L.onPage) || L.colour || '';
    b.style.background = on ? (L.colour || '') : 'transparent';
    b.style.color = on ? (L.textOn || '') : (L.onPage || L.colour || '');
  }

  /* WHICH LAYERS ARE HIDDEN, per figure and per layer, kept OUTSIDE the drawing because the drawing is
     replaced on every press: a reader who turned the metal off to see the poly under it should not have
     that undone by pressing Synthesize. Not persisted beyond the page - a layer choice is a way of
     looking at one figure, not a preference about the site. */
  var layerOff = {};

  /* The badges themselves, per figure, because the ANIMATION repaints them: it steps the process by
     turning layers on, and a row of buttons left saying otherwise would be the two encodings of one
     state disagreeing - exactly what paintLayerBtn exists to prevent. */
  var layerBtns = {};

  /* One toggle per layer the drawing contains, labelled with the mask's name. `.layout-btn` is the
     repo's own toggle - the same control the waveform's and the netlist viewer's headers use - so this
     needs no styling of its own and cannot drift from them.

     Rebuilt on each draw, because a different cell has different layers: an inverter has no PDIF where
     an AND does. What survives is the STATE above, re-applied after the buttons are made, so the row
     is about the drawing on screen while the choice is about the layer name. */
  function setLayerButtons(name, hole, res) {
    if (!hole || !hole.parentElement) return null;
    var api = window.PRACTICE_PNR_API;
    var row = hole.querySelector('.learn-fig-layers');
    var layers = res.layers || [];
    if (!layers.length) {
      if (row && row.remove) row.remove();
      return null;
    }
    if (!row) {
      row = mk('div', 'learn-fig-layers');
      /* FIRST child of the box, before the drawing target, so it is inside the view's border and at
         its left. */
      hole.insertBefore(row, hole.firstChild);
    }
    /* A RESERVED column, not an overlay: the box is a flex row, so a wide placement can never slide
       underneath the badges. The cost is that the drawing's centre sits right of the box's by the
       column's width - the honest trade, since an overlay costs nothing only until the first figure
       wide enough to go under it. */
    row.innerHTML = '';
    var off = layerOff[name] || (layerOff[name] = {});
    var made = [];
    layers.forEach(function (L) {
      /* A BADGE IN THE LAYER'S OWN COLOUR, so the button and the shapes it switches are the same thing
         to look at. Not `.layout-btn` any more: that control is a neutral toggle and this one has to
         carry a colour, and a `.layout-btn` whose background is overridden is no longer that control -
         it just looks like one until someone changes the shared rule. */
      var b = mk('button', 'learn-layer-btn');
      b.setAttribute('type', 'button');
      b.textContent = L.label;
      /* The artwork's own name in the tooltip, because METAL1 is what a reader needs and ALU1_ALL is
         what they will find in the .ap file if they go looking. */
      b.setAttribute('title', L.cls.replace(/^layer-/, ''));
      var on = !off[L.cls];
      paintLayerBtn(b, L, on);
      api.setLayerVisible(hole, L.cls, on);
      b.addEventListener('click', function () {
        /* A MANUAL PRESS STOPS THE ANIMATION, rather than fighting it: the next tick would undo the
           press, so the two would take turns writing the same layer and the reader's click would
           read as having been ignored. Stopping is the only reading of a press that is not a lie. */
        stopAnim(name);
        var showing = !off[L.cls];
        off[L.cls] = showing;              // was showing, so this hides it
        paintLayerBtn(b, L, !showing);
        api.setLayerVisible(hole, L.cls, !showing);
      });
      made.push({ L: L, btn: b });
    });
    layerBtns[name] = made;

    /* SELECT ALL AT THE TOP, UNSELECT ALL AT THE BOTTOM, with the stack between them - so the two ends
       of the column are the two ends of the range they cover, and neither reads as one more layer. They
       go through the SAME three writes a single badge's click does (the stored state, the badge, the
       shapes), rather than clearing `off` wholesale, because the state is what survives a redraw and a
       row of buttons left painted from a state nobody wrote is the one failure available here.

       Actions, not toggles: `.learn-layer-all` is neutral where a badge carries its layer's colour, and
       neither takes `aria-pressed` - there is no state for them to be in. Pressing one when it would
       change nothing is allowed to change nothing, the way the viewer's height buttons clamp in
       silence. */
    function setAll(on) {
      stopAnim(name);
      made.forEach(function (m) {
        off[m.L.cls] = !on;
        paintLayerBtn(m.btn, m.L, on);
        api.setLayerVisible(hole, m.L.cls, on);
      });
    }
    function allBtn(text, on) {
      var b = mk('button', 'learn-layer-all');
      b.setAttribute('type', 'button');
      b.textContent = text;
      b.addEventListener('click', function () { setAll(on); });
      return b;
    }
    row.appendChild(allBtn('Select All', true));
    made.forEach(function (m) { row.appendChild(m.btn); });
    row.appendChild(allBtn('Unselect All', false));

    return row;
  }

  /* The cells' own artwork, or the abstract underneath it - and, separately, the wires.
     `practice-pnr.js` owns the drawing and hands back the two switches; this owns the buttons, the
     same division the badges above are built on.

     THE STATE IS PER FIGURE AND NOT PERSISTED. A topic's prose points at what its figure shows
     ("ten cells in a single row, 239.2 um long"), so a choice made on one page must not silently
     decide what another page's sentence is describing. The opening state comes from the layout spec
     - `view` for the cells, `routing: false` for a figure that wants the bare placement - and a
     press is a look, not a preference. */
  var figView = {}, figNoRouting = {};
  function setViewButtons(name, hole, res) {
    if (!hole || !res || !res.setView) return null;
    /* A ROW OF ITS OWN, above the drawing, and NOT in the layer column beside it. These two switch
       what is drawn where every badge in that column switches one mask, and the column has a shape
       that says so: Select All at the top, Unselect All at the bottom, the stack between them, so
       its two ends are the two ends of the range they cover. Putting another kind of control in it
       breaks that reading - and the check that pins it, which is how this was noticed.

       Inside `.learn-fig-mid`, before the drawing target, because `drawStatic` empties the target it
       is handed: a row that lived in there would be deleted by the next redraw. Found-or-created and
       then cleared, the same way the badge column is, so a redraw cannot leave two of them. */
    var mid = hole.querySelector('.learn-fig-mid') || hole;
    var row = mid.querySelector('.learn-fig-views');
    if (!row) {
      row = mk('div', 'learn-fig-views');
      mid.insertBefore(row, mid.firstChild);
    }
    row.innerHTML = '';
    function btn(text, on, title) {
      var b = mk('button', 'layout-btn' + (on ? ' active' : ''));
      b.setAttribute('type', 'button');
      b.textContent = text;
      if (title) b.setAttribute('title', title);
      row.appendChild(b);
      return b;
    }
    /* A PAIR, one active, exactly as pnr.html's own Abstract/Detail control is - so the standalone
       layout app and a topic's figure read as the same control rather than as two ideas about the
       same switch. `figView` is written before the redraw, so the rebuild that follows paints from
       the state rather than from which button was clicked. */
    var view = figView[name] || res.view;
    var detail = btn('Detail', view !== 'phantom', 'The cells’ mask artwork');
    var abstract = btn('Abstract', view === 'phantom', 'The cells as the router sees them: outline, pins and blockages');
    function pickView(v) {
      return function () {
        if ((figView[name] || res.view) === v) return;      // pressing the lit one changes nothing
        stopAnim(name);                                     // the same rule a badge press follows
        figView[name] = v;
        res.setView(v);
        /* REBUILT, because the two views do not draw the same masks - the abstract has the metal-1
           connector and none of the diffusions - so a column left from the other view would offer
           buttons for shapes that are no longer in the picture. The per-layer state survives in
           `layerOff`, so what the reader had hidden stays hidden. */
        setLayerButtons(name, hole, res);
        setViewButtons(name, hole, res);
      };
    }
    detail.addEventListener('click', pickView('all'));
    abstract.addEventListener('click', pickView('phantom'));

    /* AND THE WIRES, as ONE switch for all four layers, because a wire is a via-metal-via-metal
       stack: hiding one layer of it leaves a net that looks broken rather than hidden. The badges
       below can still take a single layer out - this is the master switch, the way Select All is
       for the stack - and hiding the group wins over them while it is off.

       NOT DRAWN AT ALL when there are no wires: a one-cell figure has nothing to connect, and a
       control that cannot change the picture is the dead control this site keeps refusing. */
    if (res.routeShapes > 0) {
      /* SEEDED FROM THE DRAWING, once: `drawStatic` has already applied the spec's `routing`, so
         reading it back is how the topic's choice reaches the button rather than being overwritten
         by it on the first paint. After that the reader owns it. */
      if (figNoRouting[name] === undefined) figNoRouting[name] = !res.routingShown;
      var on = !figNoRouting[name];
      var wires = btn('Routing', on, 'VIA1, METAL2, VIA2 and METAL3 - the wires between the cells');
      res.setRouting(on);
      wires.addEventListener('click', function () {
        var showing = !figNoRouting[name];
        figNoRouting[name] = showing;                       // was showing, so this hides it
        wires.classList.toggle('active', !showing);
        res.setRouting(!showing);
      });
    }
    return row;
  }

  /* The box is the VIEW - the bordered surface - and drawStatic empties whatever element it is handed.
     So the palette cannot be a child of the box directly: the next redraw would delete it. The box gets
     a stable pair of children instead, the palette and a drawing target, and only the target is handed
     over. That is what lets the layers sit INSIDE the view's border rather than above it. */
  function drawTargetIn(hole) {
    /* A COLUMN, so the measured line can sit UNDER the drawing rather than in the figure's footer:
       `.learn-fig-draw` is what drawStatic is handed and drawStatic empties what it is handed, so the
       line cannot be a child of it and a sibling would become a third flex column of the box. */
    var col = hole.querySelector('.learn-fig-mid');
    if (!col) {
      col = mk('div', 'learn-fig-mid');
      hole.appendChild(col);
    }
    var el = col.querySelector('.learn-fig-draw');
    if (!el) {
      el = mk('div', 'learn-fig-draw');
      col.appendChild(el);
    }
    return el;
  }

  function figFoot(hole) {
    if (!hole || !hole.parentElement) return null;
    var foot = hole.parentElement.querySelector('.learn-fig-foot');
    if (!foot) {
      foot = mk('div', 'learn-fig-foot');
      hole.parentElement.appendChild(foot);
    }
    return foot;
  }

  /* The credit line, bottom right of a placement. Set rather than appended, like everything else that
     a redraw touches. It is drawn from what the DRAWER says its cells came from rather than from a
     string here, so the page cannot credit the wrong library, and it is a real link - a credit nobody
     can follow is decoration. */
  function setSource(hole, src) {
    if (!hole || !hole.parentElement || !src || !src.href) return null;
    var foot = figFoot(hole);
    var el = foot.querySelector('.learn-fig-source');
    if (!el) {
      el = mk('div', 'learn-fig-source');
      foot.appendChild(el);
    }
    var a = el.querySelector('a');
    if (!a) {
      a = mk('a');
      a.setAttribute('rel', 'noreferrer');
      el.textContent = 'Source: ';
      el.appendChild(a);
    }
    a.setAttribute('href', src.href);
    a.textContent = src.label;
    return el;
  }

  /* The measured line under a placement. Set rather than appended, for the reason setCaption's own
     note gives - this one is redrawn on every press, so appending would stack it. */
  function setStats(hole, res) {
    if (!hole || !hole.parentElement) return null;
    /* UNDER THE DRAWING IT MEASURES, not in the figure's footer at the far left: it is a caption for
       the placement, and at the bottom of a three-column figure it read as a caption for the whole
       thing. The footer keeps the credit, which IS about the figure. */
    var col = hole.querySelector('.learn-fig-mid') || hole;
    var el = col.querySelector('.learn-fig-stats');
    var cells = (res.tally || []).map(function (c) { return c.count + ' \u00d7 ' + c.type; });
    if (!cells.length) {
      if (el && el.remove) el.remove();
      return null;
    }
    if (!el) {
      el = mk('div', 'learn-fig-stats');
      col.appendChild(el);          // after the drawing, whichever order the setters run in
    }
    /* No lambda on the line. It was there while the number looked wrong and was the only way to
       check it; with the scale right, a reader of a page about logic gates has no use for the rule
       the layout was drawn to - and the figure is about the cell, not about the process. It is still
       reported by the drawer, so the check can pin it. */
    el.textContent = cells.join(', ') + '  \u2014  ' + res.umWidth + ' \u00d7 ' + res.umHeight
                   + ' \u00b5m';
    return el;
  }

  function setCaption(hole, text) {
    if (!hole || !hole.parentElement) return null;
    var cap = hole.parentElement.querySelector('.learn-fig-caption');
    if (!text) {
      if (cap && cap.remove) cap.remove();
      return null;
    }
    if (!cap) {
      cap = mk('div', 'learn-fig-caption');
      hole.parentElement.appendChild(cap);
    }
    cap.textContent = text;
    return cap;
  }

  /* FIT THE PLACEMENT TO ITS COLUMN. `rowPx` is what the topic asks for and it is a fixed number, so a
     one-cell placement sat 220px tall in a column the section beside it had made twice that - a small
     picture with a large hole under it.

     A RE-SIZE OF WHAT IS ALREADY DRAWN, not a redraw: `drawStatic` replaces the SVG, which would take
     the cut marker, the pointer wiring and every layer's visibility with it. An SVG with a viewBox
     scales by its width and height alone, so this is two attributes and the wrapper's own box - and the
     cut line, being in the drawing's own coordinates, does not move.

     THE FITTED HEIGHT IS DELIBERATELY NOT FED BACK INTO `res.height`. That is what the section's width
     cap is derived from, so writing it back would grow the section, which would grow the box, which
     would offer more room to fit into - the oscillation this avoids by keeping one canonical height for
     the drawing and treating the fit as presentation. */
  function fitLayout(hole, res) {
    var mid = hole && hole.querySelector('.learn-fig-mid');
    var inner = res && res.layer;
    if (!mid || !inner || !res.height || !res.width) return null;
    var stats = mid.querySelector('.learn-fig-stats');
    var box = mid.clientHeight || (mid.getBoundingClientRect ? mid.getBoundingClientRect().height : 0);
    if (!box) return null;             // no layout to measure: the stub, or a hidden figure
    var used = (stats ? (stats.clientHeight || 20) : 0) + 8;   // the caption and the column's gap
    var avail = box - used;
    /* NEVER SMALLER THAN THE TOPIC ASKED FOR: `rowPx` is a floor rather than a target now, so a figure
       in a narrow column keeps the size its author chose and only a roomy one grows. */
    var floor = res.height;
    var h = Math.max(floor, Math.min(avail, floor * 4));
    var w = res.width / res.height * h;
    /* AND NOT WIDER THAN THE COLUMN, or a tall cell grown to fill the height would overflow sideways -
       the aspect is kept by fitting to whichever dimension runs out first. */
    var wide = mid.clientWidth || (mid.getBoundingClientRect ? mid.getBoundingClientRect().width : 0);
    if (wide && w > wide) { w = wide; h = res.height / res.width * w; }
    if (Math.round(h) === Math.round(res.height)) return null;
    inner.style.width = Math.round(w) + 'px';
    inner.style.height = Math.round(h) + 'px';
    var svg = res.svg;
    if (svg) {
      svg.setAttribute('width', String(Math.round(w)));
      svg.setAttribute('height', String(Math.round(h)));
    }
    res.fit = { w: Math.round(w), h: Math.round(h), from: Math.round(res.height) };
    return res.fit;
  }

  var layoutsDrawn = [];

  /* The record of one figure's last draw, by name. The API's section verbs need the `res` the
     drawing reported - the placed cells and the SVG - and looking it up here keeps that in one place
     rather than threading it through every exported function. */
  function layoutFor(name) {
    for (var i = 0; i < layoutsDrawn.length; i++)
      if (layoutsDrawn[i].name === name) return layoutsDrawn[i];
    return null;
  }

  /* ===================== THE CROSS SECTION, AND THE ANIMATION =====================
   *
   * Two switches, and they are INDEPENDENT: the section can be read still, and the process can be
   * stepped with no section on screen (it plays through the layout's own layers, which is a real
   * reading of a mask set). Both are opt-in per figure from the topic's own `layouts` entry, the
   * same shape `"pnr": true` and `"memory": true` already use.
   *
   * `crossSection: true` opens SHOWN, because a topic that asks for it wants it seen and the switch
   * is there to put it away. `animate: true` opens STOPPED, because a page that starts moving on
   * load is the thing `prefers-reduced-motion` exists about - and that query is honoured here as
   * well, by refusing to auto-anything rather than by animating faster.
   *
   * Neither is persisted. A layer choice is already a way of looking at one figure rather than a
   * preference about the site, and these are the same kind of thing.
   */
  var secState = {};
  function secOf(name) {
    return secState[name] || (secState[name] = { on: false, cut: null, picked: false, anim: false,
                                                 step: 0, timer: null, steps: [] });
  }

  /* 2.8s A STEP: between the 2.2s the process animation this follows uses and the 3.4s that was tried
     next and was too slow. Each step carries a sentence to read AND a beam to watch arrive, so it wants
     more than the reference's; ten of them still have to be worth sitting through. */
  var ANIM_MS = 2800;

  /* The control row, between the figure and its measured line - which is where the example this was
     built from puts its own controls, and below the drawing either way. Created once and refilled,
     like every other part of a figure a redraw touches. */
  function figCtl(hole) {
    if (!hole || !hole.parentElement) return null;
    var row = hole.parentElement.querySelector('.learn-fig-ctl');
    if (!row) {
      row = mk('div', 'learn-fig-ctl');
      /* Right after the box, so the order down the page is figure, controls, measurements, caption -
         and `insertBefore` with the foot's own position rather than an append, which would put the
         controls under the credit line. */
      var foot = hole.parentElement.querySelector('.learn-fig-foot');
      if (foot) hole.parentElement.insertBefore(row, foot);
      else hole.parentElement.appendChild(row);
    }
    return row;
  }

  /* The section's own panel, a SIBLING of the drawing target inside the box - so the box's flex row
     puts the two side by side, and so `setLayerVisible`, which queries the whole box, governs the
     layout and the section with one call. That sharing is the reason the layer buttons needed no
     changes at all for this feature. */
  /* The element the drawing sits in, which is also what the effects canvas is laid over. Named because
     three callers need it and `panel.querySelector` in each is three chances to pick the wrong one. */
  function panelBodyOf(hole) {
    var panel = hole && hole.querySelector('.learn-fig-sec');
    return panel ? panel.querySelector('.learn-sec-body') : null;
  }

  function secPanelIn(hole) {
    var el = hole.querySelector('.learn-fig-sec');
    if (!el) {
      el = mk('div', 'learn-fig-sec');
      hole.appendChild(el);          // after .learn-fig-draw, so it sits to its right
    }
    return el;
  }

  /* Draw (or redraw) the section for the figure's current cut, and move the marker on the layout to
     match. One function, so the line and the drawing cannot end up describing different x. */
  function redrawSection(name, hole, res) {
    var api = window.PRACTICE_PNR_API;
    var st = secOf(name);
    var panel = secPanelIn(hole);
    if (!st.on) {
      panel.innerHTML = '';
      panel.style.display = 'none';
      hole.classList.remove('learn-fig-cutting');
      /* The field goes with the drawing it decorated, or it keeps asking for frames to paint a canvas
         that is no longer on the page. */
      try { window.PRACTICE_PNR_API.effects.clear(); } catch (e) { /* nothing drawn yet */ }
      var old = res.svg && res.svg.querySelector('.pnr-cut');
      if (old && old.remove) old.remove();
      st.drawn = null;
      return null;
    }
    panel.style.display = '';
    /* The box says it is cuttable, which is what puts the resize cursor on the layout - and only
       while a section exists to be moved. */
    hole.classList.add('learn-fig-cutting');
    var head = panel.querySelector('.learn-sec-head');
    var body = panel.querySelector('.learn-sec-body');
    if (!head) {
      head = mk('div', 'learn-sec-head');
      panel.appendChild(head);
      body = mk('div', 'learn-sec-body');
      panel.appendChild(body);
      panel.appendChild(mk('div', 'learn-sec-step'));
    }
    /* THE IDEAL PAIR UNTIL THE READER PICKS A CUT. A derived section answers a question they have not
       asked yet - most cuts through a real cell are partial, and opening on one is opening in the
       middle of an explanation - so the panel starts on the textbook picture and the layout invites a
       click. `picked` IS the mode: set by a click, a drag or the stepper, and nothing else re-derives
       a cut behind the reader's back. It is also what stops a draw with nothing placed - which
       reports no default cut at all - from being stored as a choice. */
    if (st.picked && st.cut === null) st.cut = api.defaultCut(res);
    var drawn = st.picked && st.cut !== null
      ? api.drawSection(body, res, st.cut)
      : api.drawIdeal(body);
    /* THE REGION CAPTIONS AS ORDINARY TEXT, above the drawing rather than inside it: in the SVG their
       size was in user units and scaled with the figure, so they were the one line of text in the
       panel at a different size from all the others. Placed at a percentage of the width, so the
       drawing's own coordinates still decide where they go. */
    var caps = panel.querySelector('.learn-sec-regions');
    if (!caps) {
      caps = mk('div', 'learn-sec-regions');
      panel.insertBefore(caps, body);
    }
    caps.innerHTML = '';
    (drawn.regions || []).forEach(function (r) {
      var s = mk('span', 'learn-sec-region');
      s.style.left = r.pct + '%';
      s.textContent = r.text;
      caps.appendChild(s);
    });
    /* BOTH HALVES OF THE FIGURE ARE THE SAME HEIGHT, capped from the layout's own px height and the
       section's reported aspect - so the pair reads as one figure rather than as a small drawing
       beside a large one. A max-width rather than a width, because the section may legitimately be
       given less room than that on a narrow screen and should shrink rather than overflow. */
    if (drawn && drawn.aspect && res.height) {
      body.style.maxWidth = Math.round(res.height * drawn.aspect) + 'px';
      body.style.margin = '0 auto';
    }
    /* WHICH OF THE TWO DRAWINGS THIS IS, above it - and on the ideal one, what to do to get the
       other, since nothing else on the figure advertises that the layout is clickable. A real cut
       states its lambda too, because that is the number the marker on the layout sits at, and it
       names what the cut passes through: most cuts are not the textbook one (measured, `not_gate` has
       31 stops and exactly one crosses both gates), so a partial stack has to read as a fact about
       that x rather than as a drawing that failed. */
    head.innerHTML = '';
    /* ONE CONTROL, AND IT SAYS WHAT PRESSING IT WOULD DO - or, on the ideal pair, what to do INSTEAD of
       pressing it. `Click the layout to see the cut` is an invitation and not a button, because the
       thing to click is the layout; `Show Ideal Pair` is the way back and is a real button. That
       replaced a pill labelled `Ideal Pair` in both states, which named the drawing rather than the
       action and left the invitation to a separate hint at the other end of the header. */
    if (drawn.ideal) {
      var lab = mk('span', 'learn-sec-what learn-sec-mode learn-sec-invite');
      lab.textContent = 'Click the layout to see the cut';
      head.appendChild(lab);
    } else {
      var back = mk('button', 'learn-sec-mode learn-cut-ideal');
      back.setAttribute('type', 'button');
      back.textContent = 'Show Ideal Pair';
      back.addEventListener('click', function () {
        stopAnim(name);
        st.picked = false;
        st.cut = null;
        redrawSection(name, hole, res);
      });
      head.appendChild(back);
      var what = mk('span', 'learn-sec-what');
      /* IN MICRONS, not lambda. Lambda is a scalable design rule rather than a size, so `23.5λ` says
         nothing to a reader without the rule beside it - and the measured line under the layout is
         already in microns, so the figure was quoting two units for the same drawing. Through the
         drawer's own formatter, so the two cannot round differently. */
      what.textContent = 'cut at ' + api.um(st.cut) + ' \u00b5m \u2014 ' + drawn.label;
      head.appendChild(what);
    }
    /* The marker belongs to a real cut, so the ideal view takes it off the layout rather than
       leaving a line pointing at a drawing that is not of this cell. */
    if (drawn.ideal) {
      var stale = res.svg && res.svg.querySelector('.pnr-cut');
      if (stale && stale.remove) stale.remove();
    } else {
      api.drawCutLine(res, st.cut);
    }
    /* THE STEPS FOLLOW THE DRAWING: the ideal pair has every mask, a real cut only the ones that cell
       has at that x - so the step count, the titles and the words all move with what is on screen
       rather than being fixed at eight the way a hand-drawn animation can afford. */
    st.steps = api.processSteps(res, drawn.ideal ? api.idealMasks() : null, drawn.materials);
    /* THE FIGURE OPENS FINISHED, at the LAST step, and that is a correction rather than a default:
       opening at step 1 showed a bare wafer while every badge beside it said its mask was on, which
       is the two encodings of one state disagreeing - and it hid the drawing the panel exists to
       show. The animation is a way to rebuild the cell, so it starts from the built one; Play from
       the end replays from the beginning, and Reset goes to the bare wafer deliberately. */
    if (st.step === null || st.step === undefined || st.step > st.steps.length - 1
        || st.stepFor !== st.steps.length) {
      st.step = st.steps.length - 1;
      st.stepFor = st.steps.length;
    }
    st.drawn = drawn;
    paintStep(name, hole, res);
    return drawn;
  }

  /* Show every mask up to step k and hide the rest, THROUGH the same three writes a badge press
     makes (the stored state, the badge, the shapes). Not a fourth notion of visibility: the whole
     point of the section sharing the layout's classes is that one of these covers both panels. */
  function applyStep(name, hole, res, k) {
    var api = window.PRACTICE_PNR_API;
    var st = secOf(name);
    var off = layerOff[name] || (layerOff[name] = {});
    var upto = {}, matsOn = {};
    st.steps.slice(0, k + 1).forEach(function (s) {
      s.classes.forEach(function (c) { upto[c] = true; });
      (s.materials || []).forEach(function (c) { matsOn[c] = true; });
    });
    (layerBtns[name] || []).forEach(function (m) {
      var on = !!upto[m.L.cls];
      off[m.L.cls] = !on;
      paintLayerBtn(m.btn, m.L, on);
      api.setLayerVisible(hole, m.L.cls, on);
    });
    /* THE MATERIALS TOO, and they have no badge - which is why they are easy to forget and why
       forgetting them was visible on the page: step one drew the field and gate oxides over a bare
       wafer, because a shape nothing can hide is a shape that is always there. The substrate is
       deliberately not in this set: it is the wafer, not something a step makes. */
    api.materialClasses().forEach(function (c) {
      api.setLayerVisible(hole, c, !!matsOn[c]);
    });
    st.step = k;
    paintStep(name, hole, res);
  }

  /* THE STEP PANEL AND THE PLAYER'S OWN STATE, in one writer. The reference this follows shows the
     step's title and a sentence about it, a `3 / 8` counter and a progress bar, and disables Prev and
     Next at the ends - and all five are the same fact said five ways, so they are written together or
     they will disagree. `paintStep` is called by every path that can move the step: the animation's
     tick, the buttons, and a redraw that changed how many steps there are. */
  function paintStep(name, hole, res) {
    var st = secOf(name);
    var s = st.steps[st.step] || {};
    var last = st.steps.length - 1;
    var panel = secPanelIn(hole);
    var foot = panel.querySelector('.learn-sec-step');
    if (foot) {
      foot.innerHTML = '';
      /* THE TITLE IS NUMBERED HERE rather than in the text, so a mask a cell does not have cannot
         leave a gap in the numbering - the reference can hardcode `2. N-WELL Formation` because its
         eight steps are always all there, and these are derived.

         COUNTED FROM ONE, as the reference counts: the bare wafer is step 1 of 8, not step 0 of 7.
         Numbering from the array index instead made every title one too low - the fifth step read
         `4. Gate oxide and POLY gate` - which is the sort of thing that reads as correct until you
         count the list. */
      var h = mk('div', 'learn-sec-step-title');
      h.textContent = (st.step + 1) + '. ' + (s.title || s.label || '');
      foot.appendChild(h);
      var d = mk('div', 'learn-sec-step-desc');
      d.textContent = s.desc || '';
      foot.appendChild(d);
    }
    /* THE EFFECT FOLLOWS THE STEP, and it is named as well as drawn: the badge says which physical
       process this is - `Ion implant · n-type` - where the shapes only say what the step leaves
       behind. It is set here rather than where the animation ticks, because a manual Prev/Next has to
       move it too. */
    var api2 = window.PRACTICE_PNR_API;
    var body = panelBodyOf(hole);
    var plan = api2.stepEffect(s, st.drawn);
    if (body && st.drawn && st.drawn.svg) {
      api2.effects.show(body, st.drawn.svg, plan);
      /* PLAYING SPAWNS CONTINUOUSLY; a manual step gets ONE burst and then quiet. The reference runs
         its loop for the life of the page, which is a cost this figure should not impose: it sits on an
         article beside a simulator, and a reader who has stopped stepping is not watching. */
      /* THE EFFECT REPEATS while its step is on screen, whether or not the player is advancing: a step
         is a process that takes time, so showing it once and stopping said the opposite. What the Play
         button controls is the STEP ADVANCE; what stops the field is leaving a step that has no effect
         (the bare wafer spawns nothing by having no zones) or putting the section away.

         The cost is a rAF loop that runs while a reader sits on a step, which is the reference's own
         behaviour and is the price of the animation being an animation. `prefers-reduced-motion` still
         turns it off entirely. */
      api2.effects.run(true);
    }
    if (foot) {
      var badge = mk('div', 'learn-fx-badge');
      badge.textContent = '✦ ' + plan.name;
      foot.appendChild(badge);
    }
    var row = figCtl(hole);
    if (!row) return;
    var num = row.querySelector('.learn-anim-step');
    if (num) num.textContent = (st.step + 1) + ' / ' + st.steps.length;
    var bar = row.querySelector('.learn-prog');
    /* THE SEGMENTS ARE BUILT AND REBUILT HERE, because the step count is only settled once the drawing
       has reported its materials - and it changes when the reader moves between the ideal pair and a cut
       whose cell has fewer masks. Rebuilt only when the count differs, so stepping does not churn the
       DOM sixty times a second. */
    if (bar) {
      var segsNow = bar.querySelectorAll('.learn-prog-seg');
      if (segsNow.length !== st.steps.length) {
        bar.innerHTML = '';
        for (var si = 0; si < st.steps.length; si++) {
          var seg = mk('div', 'learn-prog-seg');
          /* Hidden from assistive tech: the bar's own ARIA says where it is, and nine unlabelled divs
             would only be noise. */
          seg.setAttribute('aria-hidden', 'true');
          bar.appendChild(seg);
        }
      }
    }
    /* THE SEGMENTS UP TO AND INCLUDING THIS STEP ARE LIT - cumulative, because the drawing beside it is
       cumulative: at step 5 the wafer really does carry everything the first five steps did. */
    var segs = row.querySelectorAll('.learn-prog-seg');
    for (var i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i <= st.step);
    /* AND THE BAR CARRIES THE POSITION in ARIA as well as in the lit segments - a slider a reader
       cannot see has nothing else to say where it is. There is no Prev/Next to disable any more; the
       bar's ends are simply its ends. */
    if (bar) {
      bar.setAttribute('aria-valuenow', String(st.step + 1));
      bar.setAttribute('aria-valuemin', '1');
      bar.setAttribute('aria-valuemax', String(st.steps.length));
      bar.setAttribute('aria-valuetext', (st.step + 1) + ' / ' + st.steps.length
                                         + ': ' + (s.title || s.label || ''));
    }
  }

  /* START PLAYING. One writer, because two things ask for it now - the Play button and the page itself
     on load - and the label, the flag and the timer are one state written three ways. From the
     BEGINNING when the last run finished, so a press at the end replays rather than sitting on a
     completed cell doing nothing. */
  function startAnim(name, hole, res) {
    var st = secOf(name);
    if (st.anim) return false;
    st.anim = true;
    var row = figCtl(hole);
    var play = row && row.querySelector('.learn-anim-play');
    if (play) {
      play.textContent = '⏸ Pause';
      play.setAttribute('aria-pressed', 'true');
    }
    applyStep(name, hole, res, st.step >= st.steps.length - 1 ? 0 : st.step);
    st.timer = setTimeout(function () { tick(name, hole, res); }, ANIM_MS);
    return true;
  }

  /* THE PAGE OPENS PLAYING, which is the whole point of an animation nobody asked to start - EXCEPT for
     a reader who asked for no motion, where it opens on the finished cell instead. That is not a
     courtesy: `prefers-reduced-motion` is the one preference this figure is obliged to honour, and
     autoplay is precisely what it is about. Its own function so the decision has one home and a check
     can drive both branches. */
  function autoplay(name, hole, res) {
    var reduced = false;
    try {
      reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { reduced = false; }
    if (reduced) return false;
    return startAnim(name, hole, res);
  }

  function stopAnim(name) {
    var st = secState[name];
    if (!st) return;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    /* THE FIELD IS NOT STOPPED HERE ANY MORE. Pausing stops the step ADVANCE; the step the reader is
       left on is still that process happening, so its beam keeps firing. What stops the field is
       leaving the figure - `setSection(false)` clears it - or a step with nothing to fire at. */
    if (!st.anim) return;
    st.anim = false;
    var row = st.hole && figCtl(st.hole);
    var btn = row && row.querySelector('.learn-anim-play');
    if (btn) { btn.textContent = '▶ Play'; btn.setAttribute('aria-pressed', 'false'); }
  }

  /* One tick, rescheduling itself. It STOPS at the last step rather than looping, because a loop
     would wipe the finished picture - the completed cell is the thing worth being left with, and it
     is what the figure shows when nothing is animating at all. */
  function tick(name, hole, res) {
    var st = secOf(name);
    if (!st.anim) return;
    var next = st.step + 1;
    if (next >= st.steps.length) { stopAnim(name); return; }
    applyStep(name, hole, res, next);
    st.timer = setTimeout(function () { tick(name, hole, res); }, ANIM_MS);
  }

  /* A LABELLED toggle, which is NOT `.layout-btn`: that control is a fixed 24x20 ICON button, and a
     browser is what said so - `Cross section` inside it wrapped onto two lines and came out
     accent-blue from its own `.active` rule, which looked like an unstyled link. So these wear the
     palette's pill instead, the one shape here that already takes text, with `.on` and
     `aria-pressed` as the two encodings of the state. Neither of those is visible to the stub DOM,
     which is why this needed looking at rather than reasoning about. */
  function ctlToggle(text, on, fn) {
    var b = mk('button', 'learn-layer-all learn-fig-switch' + (on ? ' on' : ''));
    b.setAttribute('type', 'button');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = text;
    b.addEventListener('click', function () {
      var next = b.getAttribute('aria-pressed') !== 'true';
      b.classList.toggle('on', next);
      b.setAttribute('aria-pressed', next ? 'true' : 'false');
      fn(next);
    });
    return b;
  }
  function ctlAction(text, cls, fn) {
    var b = mk('button', 'learn-layer-all' + (cls ? ' ' + cls : ''));
    b.setAttribute('type', 'button');
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }

  function setSectionControls(name, hole, res, spec) {
    var api = window.PRACTICE_PNR_API;
    var wantSec = !!(spec && spec.crossSection), wantAnim = !!(spec && spec.animate);
    var row = figCtl(hole);
    if (!row) return null;
    if (!wantSec && !wantAnim) { row.innerHTML = ''; row.style.display = 'none'; return null; }
    row.style.display = '';
    row.innerHTML = '';
    var st = secOf(name);
    st.hole = hole;
    st.steps = api.processSteps(res);
    /* FIRST TIME ONLY, so a redraw - a synthesis, a design edit - does not reopen a panel the reader
       closed or reset a cut they moved. The cut is re-derived only if the cell under it changed
       enough that there is nothing there any more, which `sectionAt` returning null reports. */
    if (st.on === null || st.first !== true) {
      if (st.first !== true) { st.on = wantSec; st.first = true; }
    }
    /* A CHOSEN CUT THAT IS NO LONGER ON THE CELLS gives up its chosen-ness as well as its value, or
       the next draw would keep asking to re-derive a cut it had already been told to forget. */
    if (st.cut !== null && !api.sectionAt(res, st.cut)) { st.cut = null; st.picked = false; }

    if (wantSec) {
      /* NO `Cross Section` SWITCH ON A TOPIC PAGE. A topic that asks for the section wants it seen, so
         the switch only ever offered to take away the thing the page is about - and with the mode
         control now saying `Click the layout to see the cut`, the panel already explains itself. The
         state and its setter remain (`setSection`), because the section is still a thing that can be
         off: nothing on a topic page turns it off, and a caller that wants to may. */
      /* THE WAY BACK TO THE IDEAL PAIR IS IN THE SECTION'S OWN HEADER, not down here: it is a control
         over what that panel shows, so it belongs to the panel - and this row is then the process
         player and nothing else. It is built in `redrawSection`, which is where the header is.

         THE CUT STEPPER WENT WITH IT. Its two arrows sat beside the player's own Prev/Next, which is
         two pairs of arrows doing different things in one row. The cost is real and worth stating: a
         cut can now only be chosen with a pointer, so there is no keyboard route to one. */
    }
    if (wantAnim) {
      /* NO PREV/NEXT. THE BAR IS THE STEPPER: click anywhere along it to go to that step, which is one
         control where there were three and is how a reader jumps to the step they want rather than
         walking to it. Two things follow. It is a real control now, so it takes a `tabindex` and the
         arrow keys - that is what replaces the keyboard access the two buttons gave, and dropping them
         without it would have taken stepping away from anyone not using a pointer. And the counter
         beside it stays, because a bar says roughly and `4 / 9` says exactly. */
      var play = mk('button', 'learn-layer-all learn-anim-play');
      play.setAttribute('type', 'button');
      play.textContent = '▶ Play';
      play.setAttribute('aria-pressed', 'false');
      play.addEventListener('click', function () {
        if (st.anim) { stopAnim(name); return; }
        startAnim(name, hole, res);
      });
      row.appendChild(play);
      row.appendChild(ctlAction('Reset', 'learn-anim-reset', function () {
        stopAnim(name);
        applyStep(name, hole, res, 0);
      }));
      var tag = mk('span', 'learn-anim-step');
      tag.textContent = (st.step + 1) + ' / ' + st.steps.length;
      row.appendChild(tag);
      /* The bar is a SECOND encoding of the counter beside it, which is the rule this repo holds
         anything carrying meaning in colour to - it is readable at a glance and the numbers are
         readable exactly. */
      /* ONE SEGMENT PER STEP, with a gap between them, rather than one continuous fill: the bar is a
         stepper now, so it should look like steps. It also makes the click mapping honest - a segment
         IS a step, where a continuous bar needed a rule about which position meant which.

         THE SEGMENTS ARE NOT BUILT HERE, though the bar is: this runs before `redrawSection` has
         settled how many steps there are (it is what discovers the drawing's materials), so a count
         taken now is one short. `paintStep` builds them, which is the one place that always knows. */
      var bar = mk('div', 'learn-prog');
      bar.setAttribute('tabindex', '0');
      bar.setAttribute('role', 'slider');
      bar.setAttribute('aria-label', 'process step');
      /* THE STEP IS THE SEGMENT THE POINTER IS IN: N equal cells, so `floor(f * N)` clamped at the top -
         which is what the eye expects of a segmented bar, where a continuous one needed rounding and a
         rule about which half of a gap belonged to which step. */
      function stepAt(clientX) {
        var b = bar.getBoundingClientRect ? bar.getBoundingClientRect() : null;
        if (!b || !b.width) return null;
        var f = Math.max(0, Math.min(1, (clientX - b.left) / b.width));
        return Math.max(0, Math.min(st.steps.length - 1, Math.floor(f * st.steps.length)));
      }
      function goTo(k) {
        if (k === null || k === st.step) return;
        stopAnim(name);
        applyStep(name, hole, res, k);
      }
      bar.addEventListener('click', function (ev) { goTo(stepAt(ev.clientX)); });
      /* A DRAG SCRUBS, which is what a bar invites - and it is the same writer as the click, so the
         two cannot disagree about which step a position means. */
      bar.addEventListener('pointerdown', function (ev) {
        bar.dataset ? (bar.dataset.dragging = '1') : null;
        goTo(stepAt(ev.clientX));
        if (ev.preventDefault) ev.preventDefault();
      });
      bar.addEventListener('pointermove', function (ev) {
        if (bar.dataset && bar.dataset.dragging === '1') goTo(stepAt(ev.clientX));
      });
      bar.addEventListener('pointerup', function () { if (bar.dataset) bar.dataset.dragging = ''; });
      bar.addEventListener('keydown', function (ev) {
        var k = ev.key;
        if (k === 'ArrowLeft' || k === 'ArrowDown') goTo(Math.max(0, st.step - 1));
        else if (k === 'ArrowRight' || k === 'ArrowUp') goTo(Math.min(st.steps.length - 1, st.step + 1));
        else if (k === 'Home') goTo(0);
        else if (k === 'End') goTo(st.steps.length - 1);
        else return;
        if (ev.preventDefault) ev.preventDefault();
      });
      row.appendChild(bar);
    }
    paintStep(name, hole, res);
    return row;
  }

  /* THE READER CHOSE THIS CUT. One writer for it, because three paths reach it - a press on the
     layout, a drag, and the harness - and the flag it sets is the panel's whole mode: `picked` true
     means the section is of this cell at this x, false means it is the ideal pair. A press and not a
     hover, so the pointer can be run across the cell to see where the cuts are without the drawing
     beside it changing under the reader's hand. */
  function pickCut(name, hole, res, x) {
    var api = window.PRACTICE_PNR_API;
    var st = secOf(name);
    if (!st.on) return;
    var snapped = api.snapCut(res, x);
    if (st.picked && snapped === st.cut) return;
    st.cut = snapped;
    st.picked = true;
    redrawSection(name, hole, res);
  }

  /* Move the cut by n stops. Clamped in silence at both ends, the way the netlist viewer's zoom and
     the height buttons clamp - a control that does nothing at the edge is better than one that
     wraps around to the far side of the cell. */
  function stepCut(name, hole, res, n) {
    var api = window.PRACTICE_PNR_API;
    var st = secOf(name);
    var stops = api.cutStops(res);
    if (!stops.length) return;
    if (st.cut === null) st.cut = api.defaultCut(res);
    if (st.cut === null) return;
    /* FROM THE IDEAL VIEW THE FIRST PRESS LANDS ON THE DEFAULT CUT rather than one stop away from it:
       the reader has not chosen an x yet, so there is nothing to step from, and the centre of the
       first gate is the cut worth arriving at. */
    if (!st.picked) {
      st.picked = true;
      if (!st.on) { st.on = true; syncSecToggle(name, hole); }
      redrawSection(name, hole, res);
      return;
    }
    var i = 0, best = Math.abs(stops[0] - st.cut);
    stops.forEach(function (s, k) {
      var d = Math.abs(s - st.cut);
      if (d < best) { best = d; i = k; }
    });
    var j = Math.max(0, Math.min(stops.length - 1, i + n));
    st.cut = stops[j];
    st.picked = true;
    if (!st.on) { st.on = true; syncSecToggle(name, hole); }
    redrawSection(name, hole, res);
  }

  function syncSecToggle(name, hole) {
    var row = figCtl(hole);
    var b = row && row.querySelector('.learn-fig-switch');
    if (!b) return;
    b.classList.toggle('on', !!secOf(name).on);
    b.setAttribute('aria-pressed', secOf(name).on ? 'true' : 'false');
  }

  /* DRAGGING THE CUT on the layout itself, which is where a reader will reach for it. Pointer
     events rather than mouse ones, so a touch drag works with no second code path, and the cut is
     snapped to the stops so a drag steps between sections that differ rather than sliding through
     near-duplicates. Bound once per drawing - the SVG is replaced on a redraw, so the listener goes
     with it and cannot accumulate. */
  function wireCutDrag(name, hole, res) {
    var api = window.PRACTICE_PNR_API;
    var svg = res && res.svg;
    if (!svg || !svg.addEventListener) return;
    var down = false;
    function move(ev) {
      var x = api.cutFromClientX(res, ev.clientX);
      if (x === null) return;
      pickCut(name, hole, res, x);
    }
    /* HOVER SHOWS WHERE A CLICK WOULD CUT and nothing more: a faint marker following the pointer,
       snapped to the same stops the real cut is. It is what tells the reader the layout is clickable
       at all - the header says so in words, and this says it in place. */
    svg.addEventListener('pointermove', function (ev) {
      if (down || !secOf(name).on) return;
      var hx = api.cutFromClientX(res, ev.clientX);
      if (hx === null) return;
      api.drawHoverLine(res, api.snapCut(res, hx));
    });
    svg.addEventListener('pointerleave', function () { api.drawHoverLine(res, null); });
    svg.addEventListener('pointerdown', function (ev) {
      if (!secOf(name).on) return;
      down = true;
      if (svg.setPointerCapture && ev.pointerId !== undefined) {
        try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* not fatal: the move still fires */ }
      }
      /* The gesture takes the pointer, so the page must not also treat it as a scroll or a text
         selection - the same reason the waveform's canvas reserves its own axis. */
      if (ev.preventDefault) ev.preventDefault();
      move(ev);
    });
    svg.addEventListener('pointermove', function (ev) { if (down) move(ev); });
    svg.addEventListener('pointerup', function () { down = false; });
    svg.addEventListener('pointercancel', function () { down = false; });
  }

  /* WHERE A PLACEMENT'S NETLIST COMES FROM, and all three answers are derived rather than stored:

       netlist: '...'      one the topic wrote out, for a picture of something else entirely
       from: 'synthesis'   the gate-level netlist the LAST SYNTHESIS produced - so the figure follows
                           the Synthesize button, which is the point: an RTL design becomes cells
                           there for the first time, and a structural one comes back as the cells it
                           named. Before the first synthesis there is no netlist, so it falls back to
                           the design rather than drawing an empty box.
       from: 'design'      what is IN THE EDITOR, cut at the testbench marker - not `topic.verilog`,
                           which is the text the page shipped with. Reading that constant is what
                           made this figure show the same cell whatever the reader typed.

     The design half carries the library too, and that is harmless: pnr's parser reads the FIRST
     module, which is the one the page is about, and takes each instance's art from its own cell
     table - so the library's bodies are never looked at. */
  function layoutNetlist(spec) {
    if (spec.netlist) return spec.netlist;
    if (spec.from === 'synthesis') {
      var api = window.PRACTICE_SYNTH_API;
      var text = api && api.netlistText && api.netlistText();
      if (text) return text;
    }
    /* `currentFullSource` merges whatever view the editor is showing back into the document first,
       which is the call every other consumer of this text makes. */
    var doc = (typeof currentFullSource === 'function' ? currentFullSource() : '') || '';
    var cut = doc.split(/^\s*\/\/ =+ *TESTBENCH *=+ *$/m)[0];
    return cut || topic.verilog || '';
  }

  function drawLayouts() {
    var api = window.PRACTICE_PNR_API;
    if (!api || !topic || !topic.layouts) return;
    /* Re-drawable, so a synthesis can change the picture. The record is rebuilt rather than appended
       to, or a harness reading it back would see every draw this page has ever done. */
    layoutsDrawn = [];
    Object.keys(layoutHoles).forEach(function (name) {
      var spec = topic.layouts[name];
      if (!spec) return;
      var netlist = layoutNetlist(spec);
      var res = api.drawStatic(drawTargetIn(layoutHoles[name]), {
        netlist: netlist, rowWidth: spec.rowWidth, rows: spec.rows,
        /* `view` is the CELLS' opening look and `routing` the WIRES', both the topic's to choose and
           both absent from every layout written so far - which is deliberate: the defaults are what
           these figures already drew, so adding the two toggles moved no picture and no measured
           claim on any page. */
        view: spec.view, rowPx: spec.rowPx, routing: spec.routing
      });
      res.name = name;
      layoutsDrawn.push(res);
      setCaption(layoutHoles[name], spec.caption);
      /* WHAT WAS PLACED, AND HOW BIG, as its own line under the authored caption. Two lines rather
         than one because they are two kinds of statement: the caption is the topic's prose about why
         the figure is there, and this is measured from the placement that was just drawn - so it
         follows the design on every redraw while the sentence above it does not move.

         `1 x and_gate` reads as a bill of materials, and the extent is W x H in MICRONS rather than
         the lambda the layout is laid out in, since lambda is a scalable rule and not a size. The
         lambda used is stated, because the number means nothing without it. */
      setLayerButtons(name, layoutHoles[name], res);
      setViewButtons(name, layoutHoles[name], res);
      setStats(layoutHoles[name], res);
      setSource(layoutHoles[name], api.source);
      /* AFTER the badges, because the animation repaints them and `setSectionControls` reads the
         step list from what the drawing reports - and after the stats, so the control row can find
         the foot to sit above it. A redraw stops any animation in flight: it is stepping a picture
         that has just been replaced, and the layers it left hidden would look like a bug. */
      stopAnim(name);
      setSectionControls(name, layoutHoles[name], res, spec);
      redrawSection(name, layoutHoles[name], res);
      wireCutDrag(name, layoutHoles[name], res);
      /* THE LAYOUT FILLS THE COLUMN, once the section beside it has settled how tall the box is. Last,
         because the height it fits to is the section's. */
      fitLayout(layoutHoles[name], res);
      /* LAST, and only on the first draw: a redraw is a synthesis or an edit, and starting the animation
         over because the reader changed the design would take the step they were reading away from
         them. */
      if (spec.animate && !secOf(name).played) {
        secOf(name).played = true;
        autoplay(name, layoutHoles[name], res);
      }
      res.section = secOf(name).drawn || null;
      res.cut = secOf(name).cut;
    });
  }

  var figuresDrawn = [];      // what each figure reported, for the harness to read back
  function drawFigures() {
    var api = window.PRACTICE_SYNTH_API;
    if (!api || !api.drawStatic || !topic || !topic.figures) return;
    Object.keys(figureHoles).forEach(function (name) {
      var spec = topic.figures[name];
      if (!spec) return;
      var graph = figureGraph(spec);
      var res = api.drawStatic(figureHoles[name], graph);
      res.name = name;
      /* Which gates were built as UNARY, because that is the one part of the conversion no
         count can see: a `not` without the flag keeps the two-input handle table, so its wire
         still resolves and still draws - at 20% of the box's height instead of the middle.
         The diagram is then wrong in a way only a picture would show, which is exactly the
         kind of thing this repo asserts from data instead. */
      res.unary = graph.nodes.filter(function (n) {
        return n.type === 'gate' && n.data.unary;
      }).map(function (n) { return n.id; });

      /* PER-NODE CAPTIONS, added here rather than asked of the renderer. A gate node's label is
         a `title` attribute and nothing more - buildNode draws the symbol and no text - which is
         right in a netlist, where a wire says what a gate is connected to and a name would be
         noise on hundreds of cells. A figure naming the seven symbols needs the opposite, so the
         caption is a plain div positioned under the box from the SAME numbers the symbol was
         drawn at: nodeSize is exported, so the label's width is the node's width and it cannot
         drift from the shape it names.

         The box then has to grow, because drawStatic sized it to the drawing and these sit
         below it. Bumping it here keeps drawStatic knowing nothing about captions. */
      /* Every node's drawn box, for the harness: a hand-authored figure has hand-authored
         positions, so "no two symbols overlap" is a real thing to get wrong and the only place
         the numbers exist together is here. Same shape as the check packColumns is held to. */
      res.boxes = graph.nodes.map(function (n) {
        var sz = api.nodeSize(n);
        return { id: n.id, x: n.position.x, y: n.position.y, w: sz.width, h: sz.height };
      });

      var withCaps = (spec.nodes || []).filter(function (n) { return n.caption; });
      if (withCaps.length && api.nodeSize) {
        var byId = {};
        graph.nodes.forEach(function (n) { byId[n.id] = n; });
        var lowest = 0;
        withCaps.forEach(function (n) {
          var node = byId[n.id];
          if (!node) return;
          var sz = api.nodeSize(node);
          var lab = mk('div', 'learn-fig-label');
          lab.textContent = n.caption;
          lab.style.left = node.position.x + 'px';
          lab.style.top = (node.position.y + sz.height + CAPTION_GAP) + 'px';
          lab.style.width = sz.width + 'px';
          (res.layer || figureHoles[name]).appendChild(lab);
          lowest = Math.max(lowest, node.position.y + sz.height);
        });
        res.captions = withCaps.length;
        res.height = lowest + CAPTION_GAP + CAPTION_H;
        /* The WRAPPER only. The box is a normal-flow parent and grows on its own - giving it a
           height too is what clipped the captions, since an inline height is a border-box height
           and has to leave room for the padding and the border, which this arithmetic did not. */
        if (res.layer) res.layer.style.height = res.height + 'px';
      }
      figuresDrawn.push(res);
      /* Through the same helper as the placement's, though this one is only ever drawn once: two
         ways to put a caption on a figure is how one of them ends up appending. */
      setCaption(figureHoles[name], spec.caption);
    });
  }

  /* ---- 2e. the quiz, and the progress it reports ---------------------------------
   * A few multiple-choice questions on what the page just said, and the ONE thing on a topic
   * page that produces a result. That is what makes it worth having beyond the reading: the
   * Learn hub shows a badge per topic, and until now a topic had nothing to put in it - the
   * verdict seam in cloud-sync.js was written and deliberately left unused, waiting for a
   * topic to have something to report.
   *
   * IT REPORTS THROUGH A HOOK RATHER THAN SAVING ANYTHING ITSELF. `window.LEARN_ON_QUIZ` is
   * cloud-sync.js's, set only when a project is configured, and this file calls it if it is
   * there - so every write to a learner's record still happens in the one file that owns them,
   * and a checkout with no project runs this code and stores nothing. It is read at CLICK time,
   * which is what lets cloud-sync.js load after this file, as it must.
   *
   * THE VERDICT'S SHAPE IS THE PRACTICE SITE'S, because the hub renders both with one rule:
   * `{pass, fail, state}`. What each means here:
   *
   *     pass    questions currently answered correctly
   *     fail    questions whose last answer was wrong
   *     state   'fail' if any is wrong, 'pass' only when EVERY question is right, else 'none'
   *
   * That last line is the whole of the reporting design. 'none' renders as `in progress` on the
   * hub, which is exactly what a half-answered quiz is - where a 'pass' state would make three
   * of four read as `3/3 passing`, a complete-looking badge for an incomplete section.
   *
   * A question is LOCKED once it is right: a reader who has answered cannot un-answer by
   * clicking about, so the score only moves in the direction they earned. A wrong answer is not
   * locked and does not reveal the right one - it says try another, which is what a quiz on a
   * page of prose is for. */
  var quizState = {};        // name -> array of 'right' | 'wrong' | undefined
  var quizzesBuilt = [];

  function quizQuestions(name) {
    var spec = (topic && topic.quizzes && topic.quizzes[name]) || null;
    return spec && spec.questions ? spec.questions : [];
  }

  /* Every question on the page, over every quiz on it, because the hub badge is ONE fact about
     the topic rather than one per panel. */
  function quizVerdict() {
    var pass = 0, fail = 0, total = 0;
    Object.keys(quizHoles).forEach(function (name) {
      var qs = quizQuestions(name), st = quizState[name] || [];
      qs.forEach(function (q, i) {
        total++;
        if (st[i] === 'right') pass++;
        else if (st[i] === 'wrong') fail++;
      });
    });
    return {
      pass: pass, fail: fail, total: total,
      state: fail > 0 ? 'fail' : (total && pass === total ? 'pass' : 'none')
    };
  }

  function reportQuiz() {
    var v = quizVerdict();
    if (!v.total) return v;
    /* `total` GOES WITH THEM NOW, and the reason it did not is worth keeping: it was left out
       because nothing read it back, which was true when this was written. It stopped being true the
       moment the hub wanted to say how far in a reader is - `pass` and `fail` have no denominator
       between them, so a quiz with three of five right could only render as `in progress`, and the
       full-marks badge had to fake its denominator by printing `pass` twice. */
    if (typeof window.LEARN_ON_QUIZ === 'function') {
      try {
        window.LEARN_ON_QUIZ({ pass: v.pass, fail: v.fail, state: v.state, total: v.total });
      } catch (e) { /* a progress write must never cost the reader their answer */ }
    }
    return v;
  }

  /* ---- widgets: one stepper, three data sets -------------------------------------
     `topic.widgets[name]` is `{ steps: [{ title, body, svg }] }` and nothing else - no functions, so a
     topic file stays data the way `figures` and `quizzes` are. One mechanism rather than three, because
     all three of `integrated-circuits`' widgets are the same thing: a walk along a fixed list, one item
     at a time. The source article built them as two sliders and a scrubber; a stepper is what this site
     already uses for the layout player, so it costs no new control and no new look.

     THE CONTROLS ARE THAT PLAYER'S, class for class - `.learn-fig-ctl` holding two `.layout-btn`s, a
     `.learn-anim-step` counter and a segmented `.learn-prog` - which is the whole of "keep the
     consistent look": a reader who has stepped a cross section already knows how to drive this.

     BUILT WITH createElement, not one innerHTML string, and that is a testability rule this repo
     records twice over: the stub DOM parses no markup, so a panel built from a string has no button to
     click and the feature cannot be checked headlessly at all. The step's own drawing IS a string,
     because an <svg> is a leaf nobody clicks - and it is the one place a topic's markup lands here.

     A SEGMENT IS A STEP, clickable, and the counter beside it says the same thing in numbers - the
     two-encodings rule this repo holds anything meaningful in colour to. */
  var widgetsBuilt = [];
  var widgetState = {};

  function buildWidgets() {

  /* ---- 2f. THE MOORE CHART: one picture of the whole series, with the step marked ----------------
     A stepper says what one year was; a chart says what the SHAPE is, and on this topic the shape is
     the argument - the prediction holds for thirty years, overshoots in the middle, lands almost
     exactly in 2020 and is out by a factor of two now. Seven tiles cannot say that and one plot can.

     THE PREDICTION IS A STRAIGHT LINE, and that is not a simplification: doubling every two years is
     exponential, the left axis is logarithmic, and an exponential on a log axis IS a straight line.
     Which is why every drawing of Moore's law you have ever seen looks like this - and why two points
     are enough to draw it, rather than a curve sampled per year.

     TWO AXES, DELIBERATELY OPPOSED. Transistors climb on the left; the process node DESCENDS on the
     right, because the right axis is labelled large-at-top - 10 um down to 2 nm - so "down" reads as
     "smaller features". The alternative, small-at-top, makes both series climb and they become one
     indistinguishable pair of rising lines; opposed, the crossing is the picture. The axis is labelled
     either way, which is what keeps it honest rather than a trick.

     BUILT WITH createElementNS, not an innerHTML string: the stub DOM parses no markup, so a chart
     pasted as text has no elements for a harness to count or to read a coordinate off - and every
     claim about it would pass vacuously. The same reason the netlist viewer's edge layer does it. */
  var MOORE = { base: 2300, year0: 1971, years: 2 };
  function moorePredict(year) {
    return MOORE.base * Math.pow(2, (year - MOORE.year0) / MOORE.years);
  }
  /* The axes' own extents and ticks, in the units the data is in. Written out rather than derived from
     the data, because a tick set that moves with the numbers is a chart whose gridlines change meaning
     when a step is edited - and these are decades, which is what a log axis wants. */
  var MOORE_LEFT = [[2300, '2,300'], [1e5, '100k'], [1e7, '10M'], [1e9, '1B'], [1e11, '100B']];
  var MOORE_RIGHT = [[10000, '10 \u00b5m'], [1000, '1 \u00b5m'], [100, '100 nm'],
                     [10, '10 nm'], [2, '2 nm']];
  /* THE SAME TWO AXES, LINEAR, and this is the DEFAULT - which is a teaching decision rather than a
     technical one. Every published drawing of Moore's law is logarithmic, and on a log axis an
     exponential is a straight line: true, but it hides the thing a reader should feel first, which is
     that 2,300 and two hundred billion are not comparable quantities. Linear, the transistor line sits
     flat on the floor for thirty years and then leaves the top of the frame, and the feature-size line
     drops to nothing before 1990 - so `Log scale` is the button that turns the dramatic picture into the
     legible one, and pressing it is the moment the straightness means something.
     0 to 450 billion covers the prediction's own 437 billion at 2026, so the dashed line stays inside
     the plot in both modes. */
  var MOORE_LEFT_LIN = [[0, '0'], [1e11, '100B'], [2e11, '200B'], [3e11, '300B'], [4e11, '400B']];
  var MOORE_RIGHT_LIN = [[10000, '10 \u00b5m'], [7500, '7.5 \u00b5m'], [5000, '5 \u00b5m'],
                         [2500, '2.5 \u00b5m'], [0, '0']];
  var MOORE_LIN_MAX = 450e9, MOORE_LIN_NM = 10000;

  function mooreChart(el, spec) {
    var pts = (spec.steps || []).map(function (s) {
      return { year: s.year, real: s.real, node: s.node };
    });
    /* A step missing any of the three is not chartable, and the widget keeps working without one -
       so a topic that has not supplied numbers gets its stepper and no chart, rather than a broken
       picture or a thrown error on load. */
    if (!pts.length || pts.some(function (p) { return !p.year || !p.real || !p.node; })) return null;

    /* 188 is THREE QUARTERS of the 250 this started at, and the reason is that `.learn-chart` is
       `width: 100%; height: auto` - so H is not a height in pixels, it is the aspect. At 250 the chart
       rendered 1222 x 391 in a full-width column, which is taller than everything around it and taller
       than it needs to be for five gridlines. Every y below is derived from H through `yl`/`yr`, and T
       and B are unchanged, so the axis labels and the legend keep their room and only the plot gets
       shorter: 138px of it against 200 before. */
    var W = 780, H = 188, L = 64, R = 74, T = 16, B = 34;
    var y0 = pts[0].year, y1 = pts[pts.length - 1].year;
    var loL = Math.log(2000) / Math.LN10, hiL = Math.log(1e12) / Math.LN10;
    var loR = Math.log(2) / Math.LN10, hiR = Math.log(20000) / Math.LN10;
    /* LINEAR BY DEFAULT, log behind the button - see the note above MOORE_LEFT_LIN for why round that
       way. `logOn` is read by both scales and by the tick tables, so one flag decides the whole
       picture and the two cannot end up describing different axes. */
    var logOn = false;
    function x(year) { return L + (year - y0) / (y1 - y0) * (W - L - R); }
    function yl(n) {
      if (!logOn) {
        return T + (1 - Math.max(0, Math.min(1, n / MOORE_LIN_MAX))) * (H - T - B);
      }
      var v = (Math.log(n) / Math.LN10 - loL) / (hiL - loL);
      return T + (1 - v) * (H - T - B);
    }
    /* LARGE AT TOP on the right, which is what makes the node line descend - see the note above. Linear
       keeps that orientation, so the two modes cannot disagree about which way "smaller" is. */
    function yr(nm) {
      if (!logOn) {
        return T + (1 - Math.max(0, Math.min(1, nm / MOORE_LIN_NM))) * (H - T - B);
      }
      var v = (hiR - Math.log(nm) / Math.LN10) / (hiR - loR);
      return T + v * (H - T - B);
    }
    function el2(tag, attrs, cls) {
      var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
      if (cls) e.setAttribute('class', cls);
      return e;
    }
    el.innerHTML = '';
    /* THE BUTTON SITS OUTSIDE WHAT IS REDRAWN. Toggling the scale rebuilds the plot - thirty elements,
       once, on a press nobody makes often, where STEPPING still moves the cursor without redrawing
       anything - so the control has to live in its own row or it would be destroyed by the first press
       of itself. `.layout-btn` with `.active` and `aria-pressed` is this site's existing toggle, in the
       same text-button row the placement figures use, so it needed no styling of its own. */
    var ctl = mk('div', 'learn-fig-views learn-chart-ctl');
    /* THE STEP'S TITLE LIVES HERE when the widget asks for it (`titleOnChart`), which for the Moore
       widget it does: its titles are bare years, and a big `2010` on a line of its own above the frame
       said nothing the chart's own cursor, x-axis tick and counter were not already saying - it was a
       heading for a picture that is already labelled. On the chart it is the plot's caption instead,
       beside the control that changes the plot. */
    var chartTitle = mk('span', 'learn-chart-title');
    ctl.appendChild(chartTitle);
    var logBtn = mk('button', 'layout-btn');
    logBtn.textContent = 'Show as Log scale';
    logBtn.setAttribute('type', 'button');
    logBtn.setAttribute('aria-pressed', 'false');
    logBtn.setAttribute('title', 'Plot both axes logarithmically');
    ctl.appendChild(logBtn);
    el.appendChild(ctl);
    var body = mk('div', 'learn-chart-body');
    el.appendChild(body);

    var built = null, atStep = 0;
    function draw() {
    body.innerHTML = '';
    var svg = el2('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
                           'aria-label': 'Transistors per chip and the smallest feature size, '
                                       + y0 + ' to ' + y1 },
                  'learn-chart');
    function add(e) { svg.appendChild(e); return e; }

    (logOn ? MOORE_LEFT : MOORE_LEFT_LIN).forEach(function (t2) {
      add(el2('line', { x1: L, x2: W - R, y1: yl(t2[0]), y2: yl(t2[0]) }, 'learn-chart-grid'));
      add(el2('text', { x: L - 6, y: yl(t2[0]) + 3, 'text-anchor': 'end' },
              'learn-chart-tick')).textContent = t2[1];
    });
    (logOn ? MOORE_RIGHT : MOORE_RIGHT_LIN).forEach(function (t2) {
      add(el2('text', { x: W - R + 6, y: yr(t2[0]) + 3 },
              'learn-chart-tick learn-chart-tick-node')).textContent = t2[1];
    });
    add(el2('line', { x1: L, x2: W - R, y1: H - B, y2: H - B }, 'learn-chart-axis'));
    pts.forEach(function (p) {
      add(el2('text', { x: x(p.year), y: H - B + 16, 'text-anchor': 'middle' },
              'learn-chart-tick')).textContent = String(p.year);
    });

    /* THE PREDICTION IS SAMPLED PER YEAR, not drawn as two points, and that is what makes it right in
       BOTH modes. An exponential is a straight line only on a logarithmic axis; drawn as two points it
       stayed straight when the axis went linear - a tidy diagonal from 1971 to 2026 that no doubling
       ever passed through, and the one line on the chart that was simply false. Sampled, it is straight
       when the axis is log and the hockey stick it really is when the axis is not. Fifty-six points on a
       press nobody makes often. */
    var predPts = [];
    for (var py = y0; py <= y1; py++) predPts.push(x(py) + ',' + yl(moorePredict(py)));
    add(el2('polyline', { points: predPts.join(' ') }, 'learn-chart-pred'));
    /* What shipped, and the node, each as a line through its own points. */
    add(el2('polyline', { points: pts.map(function (p) { return x(p.year) + ',' + yl(p.real); }).join(' ') },
            'learn-chart-real'));
    add(el2('polyline', { points: pts.map(function (p) { return x(p.year) + ',' + yr(p.node); }).join(' ') },
            'learn-chart-node'));

    var cursor = add(el2('line', { x1: x(y0), x2: x(y0), y1: T, y2: H - B }, 'learn-chart-cursor'));
    var realDots = pts.map(function (p) {
      return add(el2('circle', { cx: x(p.year), cy: yl(p.real), r: 4,
                                 'data-year': p.year, 'data-real': p.real }, 'learn-chart-dot'));
    });
    var nodeDots = pts.map(function (p) {
      return add(el2('circle', { cx: x(p.year), cy: yr(p.node), r: 3,
                                 'data-year': p.year, 'data-node': p.node },
                     'learn-chart-dot learn-chart-dot-node'));
    });

    /* The legend names the three series in their own colours, because a reader cannot be asked to
       remember which line is which - and it says which axis the node is on, since that is the one
       thing a two-axis chart can be misread about. */
    var keys = [['learn-chart-key-pred', 'doubling predicts'],
                ['learn-chart-key-real', 'real chips'],
                ['learn-chart-key-node', 'smallest feature (right)']];
    var legend = mk('div', 'learn-chart-legend');
    keys.forEach(function (k) {
      var item = mk('span', 'learn-chart-key');
      item.appendChild(mk('span', k[0]));
      var lab = mk('span', 'learn-chart-key-label');
      lab.textContent = k[1];
      item.appendChild(lab);
      legend.appendChild(item);
    });
    body.appendChild(svg);
    body.appendChild(legend);

    return {
      /* THE STEP, MARKED IN THE PICTURE: the cursor moves and that year's two dots grow. Nothing is
         redrawn, so the plot cannot flicker or re-lay-out as a reader steps through it. */
      setStep: function (k) {
        var i = Math.max(0, Math.min(pts.length - 1, k));
        cursor.setAttribute('x1', String(x(pts[i].year)));
        cursor.setAttribute('x2', String(x(pts[i].year)));
        realDots.concat(nodeDots).forEach(function (d, j) {
          var on = (j % pts.length) === i;
          d.setAttribute('class', d.getAttribute('class').replace(/ on\b/, '') + (on ? ' on' : ''));
        });
      },
      points: pts, svg: svg, dots: realDots, nodeDots: nodeDots
    };
    }

    /* ONE WRITER FOR BOTH ENCODINGS of the state - the class and `aria-pressed` - which is the rule
       this repo holds anything meaningful in colour to, and `add`/`remove` rather than `toggle(cls,
       force)` because that is what the stub DOM models. The step is re-applied after a redraw, or
       toggling the scale would silently move the cursor back to 1971. */
    function paint() {
      if (logOn) logBtn.classList.add('active'); else logBtn.classList.remove('active');
      logBtn.setAttribute('aria-pressed', logOn ? 'true' : 'false');
    }
    logBtn.addEventListener('click', function () {
      logOn = !logOn;
      paint();
      built = draw();
      built.setStep(atStep);
    });
    paint();
    built = draw();

    return {
      setStep: function (k) {
        atStep = Math.max(0, Math.min(pts.length - 1, k));
        built.setStep(atStep);
      },
      /* For the harness: which scale is on, and the button to press. Everything else it needs it can
         read off the drawing, which is the point of building this with real elements. */
      log: function () { return logOn; },
      logButton: logBtn,
      setTitle: function (t) { chartTitle.textContent = t || ''; },
      points: pts,
      svg: function () { return built.svg; },
      dots: function () { return built.dots; },
      nodeDots: function () { return built.nodeDots; }
    };
  }

    Object.keys(widgetHoles).forEach(function (name) {
      var spec = (topic && topic.widgets && topic.widgets[name]) || null;
      var hole = widgetHoles[name];
      if (!spec || !spec.steps || !spec.steps.length) return;

      var fig = mk('div', 'learn-illus learn-widget-fig');
      /* THE CHART IS BUILT ONCE for the whole series and only MARKED per step - it is a picture of
         all seven years, where `st.svg` is a picture of one. A widget declaring `chart` therefore
         keeps its own figure element for the chart and leaves the per-step drawing alone. */
      var chartFig = spec.chart === 'moore' ? mk('div', 'learn-illus learn-widget-chart') : null;
      var head = mk('div', 'learn-widget-head');
      /* THE LABELLED FIELDS, and they are why a step is worth stepping to: a number on its own is not
         readable, and `301.5 million` beside the words `estimated transistors` is. One tile per fact,
         each `{label, value}`, in a grid that wraps - so a step can carry two or four of them and a
         phone gets one column. A step with no `facts` builds no row at all. */
      var stats = mk('div', 'learn-widget-stats');
      var body = mk('div', 'learn-widget-body');
      var row = mk('div', 'learn-fig-ctl');
      var prev = mk('button', 'layout-btn');
      var next = mk('button', 'layout-btn');
      var count = mk('span', 'learn-anim-step');
      var bar = mk('div', 'learn-prog');
      prev.textContent = '◀';
      next.textContent = '▶';
      prev.setAttribute('title', 'Previous');
      next.setAttribute('title', 'Next');
      bar.setAttribute('role', 'slider');
      bar.setAttribute('aria-label', spec.label || name);
      /* The head is left OUT when the title belongs on the chart - not merely hidden, so nothing has to
         remember to hide it, and a check reading the panel's parts sees exactly what is on the page. */
      if (!spec.titleOnChart) hole.appendChild(head);
      if (chartFig) hole.appendChild(chartFig);
      hole.appendChild(fig);
      hole.appendChild(stats);
      hole.appendChild(body);
      row.appendChild(prev);
      row.appendChild(next);
      row.appendChild(count);
      row.appendChild(bar);
      hole.appendChild(row);
      /* WHAT THE BAR IS AN AXIS OF. `3 / 7` says where you are in a list; on a widget whose list is a
         TIMELINE it does not say what the list is - so a spec may name its two ends and they are
         printed under the bar, which is the axis label a chart would have. Absent means absent: the
         other two widgets are lists of things rather than a range, and get no row. */
      var ends = null;
      if (spec.ends && spec.ends.length === 2) {
        ends = mk('div', 'learn-widget-ends');
        var lo = mk('span'), hi = mk('span');
        lo.textContent = spec.ends[0];
        hi.textContent = spec.ends[1];
        ends.appendChild(lo);
        ends.appendChild(hi);
        hole.appendChild(ends);
      }

      var segs = spec.steps.map(function (_, i) {
        var seg = mk('div', 'learn-prog-seg');
        seg.addEventListener('click', function () { show(i); });
        bar.appendChild(seg);
        return seg;
      });

      var chart = chartFig ? mooreChart(chartFig, spec) : null;
      if (chartFig && !chart) chartFig.style.display = 'none';   // no numbers: no chart, not a broken one

      function show(k) {
        k = Math.max(0, Math.min(spec.steps.length - 1, k));
        var st = spec.steps[k];
        widgetState[name] = k;
        head.textContent = st.title || '';
        if (spec.titleOnChart && chart && chart.setTitle) chart.setTitle(st.title);
        /* The drawing is optional, and a step without one must not leave the panel holding the
           PREVIOUS step's picture - which is the failure a `if (st.svg)` alone would ship. */
        /* THE DRAWING AND THE PHOTOGRAPHS SHARE ONE ROW, which is the point of the photographs: a
           schematic says what the part IS and a photograph says what it LOOKED LIKE, and the two are
           worth having side by side rather than one under the other. `.learn-widget-fig` is the flex
           row (see learn.css); it wraps, so a phone stacks them.

           Rebuilt per step like the tiles are - a step with two photographs following one with three
           must not keep the third - and the whole row is hidden when a step has neither. Every shot
           carries its own CREDIT, because none of these pictures is this repo's: the same rule the
           placement figures follow for the cell artwork they draw. */
        fig.innerHTML = '';
        if (st.svg) {
          var drawn = mk('div', 'learn-widget-drawing');
          drawn.innerHTML = st.svg;
          fig.appendChild(drawn);
        }
        (st.shots || []).forEach(function (sh) {
          var f = mk('figure', 'learn-widget-shot');
          var im = mk('img');
          im.setAttribute('src', sh.src);
          /* Alt text is not optional on a photograph that is carrying part of the explanation. And NOT
             `loading="lazy"`, which was the first thing tried and is the wrong tool here: these images
             are not below the fold at load, they are not in the document at all until the reader steps
             to them - at which point they are in view and wanted immediately. Lazy buys nothing and
             costs a blank frame while the browser decides. Measured: with it, the images of a step
             reached by pressing Next reported naturalWidth 0 for long enough to see. */
          im.setAttribute('alt', sh.alt || '');
          f.appendChild(im);
          var cap = mk('figcaption');
          cap.textContent = sh.credit || '';
          f.appendChild(cap);
          fig.appendChild(f);
        });
        fig.style.display = (st.svg || (st.shots && st.shots.length)) ? '' : 'none';
        if (chart) chart.setStep(k);
        /* Rebuilt per step rather than written into, for the reason the drawing is cleared above: a
           step with three facts followed by one with two would otherwise keep the third. */
        stats.innerHTML = '';
        (st.facts || []).forEach(function (f) {
          var tile = mk('div', 'learn-widget-stat');
          var lab = mk('div', 'learn-widget-stat-label');
          var val = mk('div', 'learn-widget-stat-value');
          lab.textContent = f.label;
          val.innerHTML = f.value;
          tile.appendChild(lab);
          tile.appendChild(val);
          stats.appendChild(tile);
        });
        stats.style.display = (st.facts && st.facts.length) ? '' : 'none';
        body.innerHTML = st.body || '';
        count.textContent = (k + 1) + ' / ' + spec.steps.length;
        segs.forEach(function (seg, i) {
          if (i === k) seg.classList.add('on'); else seg.classList.remove('on');
        });
        /* Disabled at the ends rather than wrapping: a list with a first and a last item is what the
           counter says it is, and a reader who reaches 6 / 6 should be told, not sent back to 1. */
        prev.disabled = k === 0;
        next.disabled = k === spec.steps.length - 1;
      }
      prev.addEventListener('click', function () { show((widgetState[name] || 0) - 1); });
      next.addEventListener('click', function () { show((widgetState[name] || 0) + 1); });
      show(0);
      widgetsBuilt.push(name);
    });
  }

  function buildQuizzes() {
    Object.keys(quizHoles).forEach(function (name) {
      var hole = quizHoles[name];
      var qs = quizQuestions(name);
      if (!qs.length) { hole.style.display = 'none'; return; }
      quizState[name] = [];
      /* Built with createElement, not one innerHTML string: the stub DOM parses no markup, so a
         panel built from a string would have no buttons to click and the whole feature would be
         untestable headlessly - the same reason the exercise sheet and the hub's chips are. */
      var opts = [], verdicts = [];
      var score = mk('div', 'learn-quiz-score');

      function paint(qi) {
        var st = quizState[name][qi];
        opts[qi].forEach(function (b, oi) {
          var right = st === 'right' && oi === qs[qi].answer;
          var wrong = st === 'wrong' && b.getAttribute('data-picked') === '1';
          b.classList.toggle('right', right);
          b.classList.toggle('wrong', wrong);
          b.setAttribute('aria-pressed', right || wrong ? 'true' : 'false');
        });
        /* THE GLYPH AND THE COLOUR ARE TWO ENCODINGS OF ONE BIT, which is the rule this repo holds
           anything carrying meaning in colour to - the line reads in a greyscale screenshot and to
           a reader who cannot separate the two hues. `✓` and `✗` are TEXT glyphs, not the emoji
           the mockup used: an emoji ignores `color` entirely and lands in whatever shade the
           platform ships, which is the trap CLAUDE.md records for the Run button's warning sign. */
        verdicts[qi].className = 'learn-quiz-verdict' + (st ? ' ' + st : '');
        verdicts[qi].innerHTML = '';
        verdicts[qi].textContent = st === 'right' ? '✓ Correct'
                                 : st === 'wrong' ? '✗ Not quite — try another' : '';
        /* AND THE WAY BACK, on a WRONG answer only. A question names the section it came from with
           `sec`, and the link's text is that heading's own words - so it lands where the answer is
           explained and says so in the page's language rather than in the quiz's.
           Only when wrong, deliberately: offered up front it would say where to look before the
           reader has thought, and on a right answer there is nothing to go back for. A `sec` that
           names no section on the page adds nothing rather than a dead link - and the harness
           refuses one, since a silent absence is exactly what nobody would notice. */
        var back = st === 'wrong' && qs[qi].sec ? sections[qs[qi].sec] : null;
        if (back) {
          verdicts[qi].appendChild(document.createTextNode(', or re-read '));
          var a = mk('a');
          a.setAttribute('href', '#' + back.id);
          a.textContent = back.label;
          verdicts[qi].appendChild(a);
        }
      }

      function paintScore() {
        var v = quizVerdict();
        score.textContent = v.pass + ' of ' + v.total + ' correct';
        score.classList.toggle('all', v.pass === v.total);
      }

      qs.forEach(function (q, qi) {
        var row = mk('div', 'learn-quiz-q');
        var ask = mk('div', 'learn-quiz-ask');
        var num = mk('b');
        num.textContent = 'Q' + (qi + 1) + '.';
        ask.appendChild(num);
        var text = mk('span', 'learn-quiz-text');
        /* The question may quote a signal or an expression, so it is html - the one place in a
           quiz that is. The options are plain text, which is what keeps them clickable in the
           stub. */
        text.innerHTML = ' ' + (q.q || '');
        ask.appendChild(text);
        row.appendChild(ask);

        /* AN OPTION IS PLAIN TEXT, where the question may be html. It is set with `textContent`, so
           a tag written in one is SHOWN rather than rendered - which is what put a literal
           `<code>dut</code>` on screen here, visible in a screenshot and invisible to every check
           until one was written for it. The rule stays this way round on purpose: an option set
           with innerHTML would not be readable back as its own text, which is how the harness
           knows which button is which. */
        var list = mk('div', 'learn-quiz-opts');
        opts[qi] = (q.options || []).map(function (label, oi) {
          var b = mk('button', 'learn-quiz-opt');
          b.setAttribute('type', 'button');
          b.setAttribute('aria-pressed', 'false');
          b.textContent = label;
          b.addEventListener('click', function () {
            if (quizState[name][qi] === 'right') return;      // answered: nothing to change
            opts[qi].forEach(function (o) { o.removeAttribute('data-picked'); });
            b.setAttribute('data-picked', '1');
            quizState[name][qi] = oi === q.answer ? 'right' : 'wrong';
            paint(qi);
            paintScore();
            reportQuiz();
          });
          list.appendChild(b);
          return b;
        });
        row.appendChild(list);

        var v = mk('div', 'learn-quiz-verdict');
        /* Announced, because the answer is the whole point and a colour change is not something a
           screen reader reports. */
        v.setAttribute('role', 'status');
        verdicts[qi] = v;
        row.appendChild(v);
        hole.appendChild(row);
      });

      hole.appendChild(score);
      paintScore();
      quizzesBuilt.push(name);
    });
  }

  /* ---- Synthesize belongs to the NETLIST VIEWER here ----------------------------
     practice-synth.js puts it in the editor's run toolbar beside Run, because on an exercise
     page the two are peers: both act on the design you are writing. On a topic the design is
     the article's, and this button's whole job is to fill the panel the prose is pointing at -
     so it sits in that panel, bottom left, beside the legend that explains what appears.

     MOVED, not copied - the same mechanism as the cards, and for a stronger reason. There is
     one element, so the three-state label (Synthesize / Re-synthesize / the error form) and the
     busy glyph with its width and height pins cannot come apart; a second button would mean
     teaching syncSynthLabel and withBusyButton to write a list, in a file eighteen practice
     pages share.

     The footer is its own row rather than the legend itself: the legend is a CENTRED flex row,
     so a button inside it would shove the dots off-centre. As its sibling in a flex footer the
     button takes the left and the legend keeps its centring in what is left. */
  /* THE CARD, NOT THE DIAGRAM PANEL, and that is the one thing to get right here: the viewer is
     the Synthesis Results card's Diagram VIEW now, so a footer built inside that panel would
     vanish the moment a reader picked Synthesis Log - taking the only Synthesize button with it.
     In the card, after the panels, it is always there, and at load the picture is what it was: the
     placeholder box above, the button bottom left, the legend centred beside it. The legend comes
     with it for that reason - it is what makes them one row. */
  function moveSynthIntoViewer() {
    var btn = $('synthBtn');
    var card = $('card-netlist');
    if (!btn || !card) return;
    var legend = card.querySelector('.legend-row');
    if (!legend) return;
    var foot = card.querySelector('.learn-synth-foot');
    if (!foot) {
      foot = mk('div', 'learn-synth-foot');
      card.appendChild(foot);
      foot.appendChild(legend);
    }
    /* ONE ROW: Synthesize, then the gate-level Run, then the legend. The Run was a `.toolbar` of
       its own above this row, which read as two footers for one card; in the flow's order they are
       the two things a reader does with a netlist, so they sit side by side. The ROW is moved rather
       than its button, so `syncResultsView` still owns whether it is on screen - it takes the
       gate-level Run away for a design that was already a netlist. */
    var gateRow = $('gateRunRow');
    if (gateRow && gateRow.parentElement !== foot) {
      gateRow.style.marginTop = '0';
      gateRow.style.marginBottom = '0';
      foot.insertBefore(gateRow, foot.firstChild);
    }
    if (btn.parentElement !== foot) foot.insertBefore(btn, foot.firstChild);
  }

  /* PINNED BEFORE `fill()`, WHICH IS THE WHOLE OF IT. That function gives a hole its card's own
     visibility - `hole.style.display = card.style.display === 'none' ? 'none' : ''` - so a card
     pinned AFTERWARDS ends up visible inside a hidden hole, and the topic shows nothing at all
     between its prose and the next heading. That is exactly what shipped in the first cut of this,
     and neither learn check saw it: they ask where the button is and whether the CARD is hidden,
     and the hole is a third thing. One owner for the decision either way - practice-synth.js's
     own flag, not this file writing `style.display` behind its back. */
  function pinNetlistCard() {
    if (window.PRACTICE_SYNTH_API && window.PRACTICE_SYNTH_API.pinCard) {
      window.PRACTICE_SYNTH_API.pinCard();
    }
  }

  /* THE VIEWER CARD MUST STAY ON THE PAGE, because the only Synthesize button is now inside
     it - hiding it would leave a topic with no way to synthesize at all, on the first press and
     after every failure. That holds because `showCards(false)` hides the netlist text card and
     `viewerRow`, the split row this card used to sit in, and moving it into a prose slot took it
     out of that row.

     A `keepViewerVisible()` was written here to say so in code and REMOVED: a mutant deleting it
     changed nothing observable, since nothing hides this card any more. What guards the property
     is test_learn.py asserting it at load and after a failed synthesis - which a future change to
     showCards would fail, where a redundant write would have hidden that change instead. Same
     with re-running the move on every click: nothing rebuilds this card, so once is once. */
  pinNetlistCard();       // before fill(), or the card lands in a hidden hole - see its note
  fill();
  moveSynthIntoViewer();
  /* Once, at load: a figure is an illustration, so nothing re-draws it. A PLACEMENT is not drawn
     here, because it reads the EDITOR and the editor still holds app.js's own first example at this
     point - parsing that gave `expected id but found @`, from an `always` block. It is drawn below,
     once the topic has been seeded. */
  drawFigures();
  /* Once too, and before anything can be answered: a quiz is content, so nothing re-builds it.
     It reports nothing at load - an unanswered quiz is not a result, and writing one would put a
     row on the hub for a topic the reader has only opened. */
  buildWidgets();
  buildQuizzes();

  /* Everything the topic did NOT ask for is removed outright rather than hidden: a learn
     page is an article, and a strip of empty panels below it would read as a broken app
     rather than as an app that was not wanted. Removing is safe for the same reason moving
     is - app.js renders into these by id, and it checks for null nowhere, so a card it
     WILL render into has to stay. #card-console is the exception the topic need not
     mention: runSimulation writes to it unconditionally. */
  (function () {
    var keep = { 'card-console': true };
    Object.keys(slots).forEach(function (n) { if (CARD_FOR[n]) keep[CARD_FOR[n]] = true; });
    Object.keys(CARD_FOR).forEach(function (n) {
      var id = CARD_FOR[n];
      if (keep[id]) return;
      var card = $(id);
      if (card && card.parentElement) card.parentElement.removeChild(card);
    });
    // the console has to exist, but it does not have to be shown
    if (!keep['card-console-visible']) {
      var c = $('card-console');
      if (c && !slots['console']) c.style.display = 'none';
    }
    /* A TOPIC THAT ASKS FOR NO CARDS HAS NO GRID, and the grid is what is left behind: the
       cards are gone from it but its own containers are not - `#waveSplitRow` in particular,
       whose padding and gap are a band of nothing under the last paragraph. `lego-logic` is
       prose and illustrations with nothing to run, so the article is the whole page.

       HIDDEN rather than removed, which is this file's rule for everything app.js still writes
       into: the console lives in here and `logLine` appends to it unconditionally, so the
       element has to stay reachable for the log dialog to have anything to copy. */
    if (grid && !Object.keys(slots).length) grid.style.display = 'none';
  })();

  /* ---- 2b. the editor card's own trimming --------------------------------------
     The editor card is the SIMULATOR's, byte for byte: shell.js injects app markup that
     build.py generates from simulator.html's body, so there is exactly one editor card in
     this repo and every page gets that one. A practice page looks trimmed because
     practice.js hides two of its controls afterwards - and a topic page does not load
     practice.js, which is the exercise shell.

     So the trimming has to happen here, and a topic page wants MORE of it than an exercise
     does. practice.js's reasons were "one design per page, so the example picker is noise"
     and "opening a file would replace the problem the sheet describes"; on a topic page the
     prose is ABOUT the design in the editor, so loading an example or a file leaves the
     article explaining code that is no longer on screen. Copy and Save go too: a topic is
     something to read, not work to take away. The module browser goes because a topic's
     design is one or two modules and the panel is a 150px column of nothing.

     Hidden rather than removed, exactly as practice.js does it: app.js populates the picker
     and renders into the panel unconditionally, and hiding costs nothing. */
  (function () {
    var picker = $('exampleSelect');
    if (picker) {
      picker.style.display = 'none';
      var label = picker.previousElementSibling;   // the "Select from Examples:" span
      if (label && label.className === 'time-label') label.style.display = 'none';
    }
    ['editorCopyBtn', 'editorSaveBtn', 'editorHierarchyToggleBtn'].forEach(function (id) {
      var el = $(id);
      if (el) el.style.display = 'none';
    });
    /* The panel and its button are two things: the button toggles a class on the row, and
       the row starts collapsed, so hiding the button alone would leave whatever state the
       reader's localStorage last stored. Hiding the panel is what makes it certainly gone. */
    var panel = $('editorHierarchyPanel');
    if (panel) panel.style.display = 'none';

    var openBtn = $('openBtn');
    if (openBtn) {
      openBtn.style.display = 'none';
      /* Its toolbar goes when nothing visible is left in it, or it stays as an empty band
         above the editor. classList rather than `className === 'toolbar'`, so adding a
         control to that row cannot make this fail OPEN - practice.js's own note. */
      var bar = openBtn.parentElement;
      if (bar && bar.classList && bar.classList.contains('toolbar')) {
        var visible = [].slice.call(bar.children).filter(function (el) {
          return el.style.display !== 'none' && el.id !== 'fileOpenInput';
        });
        if (!visible.length) bar.style.display = 'none';
      }
    }

    /* THE WAVEFORM CARD'S PLOT-OFF ROW GOES TOO, for the same reason as the picker: it is a
       tool control on a page that is a lesson. "Turn the plot off to save memory" asks the
       reader to trade a panel the prose is about against an allocation nobody mentioned, and
       the note beside it (`3 rows, ~1.2 MB of canvas`) is a developer's number - true, and
       about the tool rather than about logic gates. A topic's waveform is a handful of rows,
       so the saving it offers is not one worth a decision.

       The whole ROW goes, not just the checkbox, because the note is its sibling and a lone
       hidden input would leave the band above the plot. It carries no id, so it is reached
       through the checkbox - and matched with classList rather than `className === 'toolbar'`
       so that adding a control there cannot make this fail OPEN, which is the rule the Import
       File row above already follows. */
    /* RESET AND THE RUN LENGTH GO TOO. Both are controls for work in progress: Reset throws
       away a run so you can start again, and the run length is a number you tune when your own
       testbench does not call $finish. A topic supplies its own hidden testbench and computes
       the length from the sweep (2^N steps - see topicMaxTime), so the field shows a number the
       reader did not choose and should not have to, and there is nothing to reset TO: the
       design is the article's and Run is idempotent.

       The two labels either side of the field carry no ids, so they are reached as its siblings
       and each is tested for `time-label` first - the stub DOM parents every element to one
       grid, where an unguarded previousElementSibling would hide whatever happened to be
       created before it. */
    var reset = $('resetBtn');
    if (reset) reset.style.display = 'none';
    var maxIn = $('maxTimeInput');
    if (maxIn) {
      maxIn.style.display = 'none';
      [maxIn.previousElementSibling, maxIn.nextElementSibling].forEach(function (el) {
        if (el && el.classList && el.classList.contains('time-label')) el.style.display = 'none';
      });
    }

    var plotOff = $('waveOffCheckbox');
    var offRow = plotOff && plotOff.parentElement && plotOff.parentElement.parentElement;
    if (offRow && offRow.classList && offRow.classList.contains('toolbar')) {
      offRow.style.display = 'none';
    }
  })();

  /* ---- 2c. the log, when a run reports a problem -------------------------------
     A topic page has no Console on it - the card is hidden, because an article is not a
     place for a panel of status text - but a run that FAILS has nothing else to say so
     with: the waveform and the truth table simply stay empty, which reads as the button
     not working. So the log is surfaced in a dialog, and only then.

     The signal is two FLAGS rather than the console's rendered `.err` rows, and the reason
     is testability: a stub DOM does not parse injected markup, so `class="err"` is not an
     element there and a DOM test for it passes silently forever. `lastRunFailed` is app.js's
     own - set by all three of its failing paths - and PRACTICE_SYNTH_API.hasError() reads
     the stored synthesis log, which covers a failed synthesis AND the gate button's two
     refusals, neither of which sets a flag of its own.

     The dialog COPIES the console's html rather than moving the card into it. The card
     stays where it is, so practice-synth's own bookkeeping - the elements it tracks to
     re-print its synthesis section - is untouched. The copy is taken at open time, which is
     the only moment it is looked at.

     Built with createElement, not one innerHTML string, so the harness can click its parts;
     and it reuses the exercise sheet's own .ex-backdrop/.ex-sheet from practice.css, which a
     topic page loads - one dialog idiom on the site rather than a second. */
  var logBack = null, logBody = null;
  var lastTruthRows = [];   // what the table last rendered, as data - see renderTruthTable
  function buildLogDialog() {
    if (logBack) return;
    logBack = mk('div', 'ex-backdrop', 'learnLogBackdrop');
    var sheet = mk('div', 'ex-sheet', 'learnLogSheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    var head = mk('div', 'ex-sheet-head');
    head.appendChild(mk('span', 'ex-kicker', null));
    head.lastChild.textContent = 'Log';
    var close = mk('button', 'ex-close', 'learnLogClose');
    close.setAttribute('type', 'button');
    close.textContent = '\u2715';
    head.appendChild(close);
    logBody = mk('div', 'ex-sheet-body console-box', 'learnLogBody');
    sheet.appendChild(head);
    sheet.appendChild(logBody);
    /* The panel is a CHILD of the backdrop, as every dialog here is - that is what makes the
       `ev.target === logBack` guard load-bearing rather than unfalsifiable: as siblings a
       click inside the panel could never reach the backdrop's handler at all. */
    logBack.appendChild(sheet);
    document.body.appendChild(logBack);
    close.addEventListener('click', closeLog);
    logBack.addEventListener('click', function (ev) { if (ev.target === logBack) closeLog(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && logBack.classList.contains('open')) closeLog();
    });
  }
  function closeLog() {
    if (logBack) logBack.classList.remove('open');
    document.body.style.overflow = '';
  }
  function runReportedProblem() {
    if (typeof lastRunFailed !== 'undefined' && lastRunFailed) return true;
    var api = window.PRACTICE_SYNTH_API;
    return !!(api && api.hasError && api.hasError());
  }
  function showLogIfFailed() {
    var box = document.getElementById('consoleBox');
    if (!box || !runReportedProblem()) return false;
    buildLogDialog();
    /* The rows are CLONED, not copied as html. logLine appends a child per line and never
       sets the console's innerHTML, so reading that property back gives '' - in a stub DOM
       always, and in a browser it happens to work only because a real one serialises its
       children. Cloning also keeps each row an element, so the `.err`/`.info` colours come
       with it instead of being flattened into text. */
    logBody.innerHTML = '';
    var kids = box.children;
    for (var i = 0; i < kids.length; i++) logBody.appendChild(kids[i].cloneNode(true));
    logBack.classList.add('open');
    document.body.style.overflow = 'hidden';
    return true;
  }

  /* ---- 3. the truth table ------------------------------------------------------
     A RENDERING of the recorded run, not a second simulation. The topic's testbench holds
     each input combination for `step` time units, so reading every signal at
     `sampleAt` into each step gives one row per combination, taken where everything has
     settled rather than at the edge where it is still moving. The values therefore come
     from the same signal histories the waveform draws from, and the table cannot say
     something the plot beside it contradicts.

     valueAtTime is app.js's own sampler, so "the value at t" means here exactly what it
     means to the waveform's value column. */
  function bitsOf(sig, t) {
    var v = valueAtTime(sig, t);
    if (!v) return '?';
    if (v.x) return 'x';
    if (v.z) return 'z';
    return String(v.v & 1);
  }
  function renderTruthTable() {
    var hole = slots['truth-table'];
    if (!hole || !topic || !topic.truthTable) return;
    var spec = topic.truthTable;
    var res = (typeof lastResult !== 'undefined') ? lastResult : null;
    hole.innerHTML = '';
    var card = mk('div', 'card', 'card-truth');
    var h2 = mk('h2');
    h2.textContent = 'Truth Table';
    card.appendChild(h2);
    if (!res || !res.signals) {
      var empty = mk('div', 'wave-empty');
      empty.textContent = 'No simulation data yet — press Run Simulation above.';
      card.appendChild(empty);
      hole.appendChild(card);
      return;
    }
    var cols = spec.inputs.concat(spec.outputs);
    var missing = cols.filter(function (n) { return !res.signals[n]; });
    if (missing.length) {
      var bad = mk('div', 'editor-sync-warning');
      bad.textContent = 'not signals in this design: ' + missing.join(', ');
      card.appendChild(bad);
      hole.appendChild(card);
      return;
    }
    var step = spec.step || 10, at = spec.sampleAt == null ? Math.floor(step / 2) : spec.sampleAt;
    var rows = Math.max(1, Math.floor((res.time + step - 1) / step));
    /* The rows are collected as DATA as they are built, and exposed for the harness. The
       table itself is one innerHTML string, which a stub DOM does not parse - so there are no
       cells to inspect there, and a check over the rendered text has to filter it for digits
       and then trips over the letter x in `y_xor`. This is the same values the html is built
       from, so the two cannot disagree. */
    lastTruthRows = [];
    var html = '<table class="truth-table"><thead><tr>';
    spec.inputs.forEach(function (n) { html += '<th class="in">' + esc(n) + '</th>'; });
    html += '<th class="sep"></th>';
    spec.outputs.forEach(function (n) { html += '<th>' + esc(n) + '</th>'; });
    html += '</tr></thead><tbody>';
    for (var r = 0; r < rows; r++) {
      var t = r * step + at;
      if (t > res.time) break;
      html += '<tr>';
      spec.inputs.forEach(function (n) {
        html += '<td class="in">' + bitsOf(res.signals[n], t) + '</td>';
      });
      html += '<td class="sep"></td>';
      spec.outputs.forEach(function (n) {
        var b = bitsOf(res.signals[n], t);
        html += '<td class="' + (b === '1' ? 'one' : 'zero') + '">' + b + '</td>';
      });
      html += '</tr>';
      lastTruthRows.push({
        inputs: spec.inputs.map(function (n) { return bitsOf(res.signals[n], t); }),
        outputs: spec.outputs.map(function (n) { return bitsOf(res.signals[n], t); }),
        at: t
      });
    }
    html += '</tbody></table>';
    var wrap = mk('div', 'truth-wrap');
    wrap.innerHTML = html;
    card.appendChild(wrap);
    var note = mk('div', 'truth-note');
    note.textContent = 'read from the run at t = ' + at + ', ' + at + '+' + step + ', … — the same signal histories the waveform draws';
    card.appendChild(note);
    hole.appendChild(card);
  }

  /* ---- 4. seed the topic's design ---------------------------------------------
     The run length has to be set here for the reason practice.js sets it: app.js loaded an
     example on the way past, and loadExample wrote that example's statically-known $finish
     time into the field. Nothing runs at load, here as everywhere else - the article is
     the page, and the panels show their own empty states until Run is pressed. */
  /* ---- the document the simulator runs -----------------------------------------
     The topic's design and its HIDDEN testbench, joined by the same marker line the two
     editors split on - so what the editor shows is the design, the testbench goes to a card
     that is not on the page, and the engine still sees the one file it always did.

     The stimulus is GENERATED from truthTable.inputs, into the testbench's line reading
     SWEEP. A hand-written sweep and a declared column list are two statements about the same
     thing, and the moment a topic has three inputs the hand-written one silently shows four
     rows of an eight-row space. Generated, the sweep IS the column list: one combination per
     step, counting up in binary, which is also the order the table reads them back in.

     The run length comes from the same place for the same reason: 2^N steps is exactly how
     long the sweep takes, so a topic cannot declare a cap that cuts its own table short. A
     topic may still set maxTime to override it. */
  function sweepFor(spec) {
    var ins = spec.inputs, n = ins.length, step = spec.step || 10, lines = [];
    for (var row = 0; row < (1 << n); row++) {
      var assigns = [];
      for (var b = 0; b < n; b++) {
        // the FIRST named input is the most significant, so the rows count up as they read
        assigns.push(ins[b] + ' = ' + ((row >> (n - 1 - b)) & 1) + ';');
      }
      lines.push('    ' + assigns.join(' ') + ' #' + step + ';');
    }
    lines.push('    $display("swept all ' + (1 << n) + ' input combinations");');
    lines.push('    $finish;');
    return lines.join('\n');
  }
  /* The module the page is ABOUT: the sole one declared in `verilog`. It is the only thing the
     Source Editor shows and the synthesizer's top, and it is DERIVED rather than declared - a
     `top: 'dut'` field would be a second place for the same fact to live, and one of the two would
     eventually be wrong. If `verilog` declares more than one module there is nothing to derive, so
     nothing is claimed: the editor stays on the whole design and the synthesizer infers as it
     always did, and reports its own ambiguity if there is one. */
  function designModule(src) {
    var names = String(src === undefined ? ((topic && topic.verilog) || '') : src)
                  .match(/^[ \t]*module\s+(\w+)/gm) || [];
    if (names.length !== 1) return null;
    return names[0].replace(/^[ \t]*module\s+/, '');
  }

  function topicDocument() {
    if (!topic || !topic.verilog) return null;
    var tb = topic.testbench || '';
    var spec = topic.truthTable;
    if (tb && spec && spec.inputs && spec.inputs.length) {
      tb = tb.replace(/^[ \t]*\/\/ SWEEP[ \t]*$/m, sweepFor(spec));
    }
    /* THE DESIGN HALF IS `verilog` PLUS `library`, and the marker still separates design from
       testbench - so the synthesizer, which cuts at that marker, gets the library it needs to
       resolve the design's instantiations, while the editor is narrowed to one module by
       showModuleInEditor rather than by where the text sits. */
    var design = topic.verilog.replace(/\s*$/, '\n');
    if (topic.library) design += '\n' + topic.library.replace(/^\n+/, '').replace(/\s*$/, '\n');
    if (!tb) return design;
    return design + '\n// ======== TESTBENCH ========\n\n' + tb.replace(/^\n+/, '');
  }
  function topicMaxTime() {
    if (topic && topic.maxTime) return topic.maxTime;
    var spec = topic && topic.truthTable;
    if (spec && spec.inputs && spec.inputs.length) {
      return (1 << spec.inputs.length) * (spec.step || 10);
    }
    return 2000;
  }

  /* ---- the editor is sized to the DESIGN, not to the app's default ----------------
     `.editor-wrap` is a flat 360px in the app's CSS, and app.js then applies whatever
     `editorHeight` localStorage holds - a key the simulator and the practice pages share,
     so a reader who enlarged it there arrives here with that height. Both are right for a
     page where the editor IS the work; a topic's design is deliberately a dozen lines, so
     either leaves most of the box empty and pushes the prose that should come next off the
     screen. The reader can still resize: the height buttons are untouched, and this only
     decides where the card starts.

     MEASURED, not assumed. The editor is 12px on a desktop and 16px on a phone - the
     shared narrow-screen block raises every focusable control - so a line-height constant
     here would be wrong on one of the two. With no metrics to read (a stub that reports
     none) it leaves the CSS default alone rather than guessing. */
  var EDITOR_MIN_H = 140, EDITOR_MAX_H = 520;
  function fitEditorHeight() {
    var wrap = $('editorWrap');
    if (!wrap || !codeInput || !window.getComputedStyle) return;
    var cs = window.getComputedStyle(codeInput);
    var lh = parseFloat(cs.lineHeight);
    if (!lh) return;
    var pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var lines = String(codeInput.value || '').split('\n').length;
    var h = Math.round(lines * lh + pad);
    wrap.style.height = Math.max(EDITOR_MIN_H, Math.min(EDITOR_MAX_H, h)) + 'px';
  }

  if (topic && topic.verilog) {
    var maxInput = $('maxTimeInput');
    /* The topic document is handed to seedFullSource, which splits it across the two
       editors WITHOUT recording an undoable edit. Both halves of that matter. Writing it
       into the design editor first (setEditorText, then a reset that read it back) put the
       whole file into that textarea's undo stack, so one Cmd-Z brought the testbench in
       below the design; and even split, a page's FIRST document replaces nothing of the
       reader's - app.js loads EXAMPLES' first entry on the way past, so an undoable seed
       left `module dff` one keystroke behind the topic. See app.js at seedFullSource. */
    seedFullSource(topicDocument());
    tryApplyAutoFinishTime(codeInput.value);
    /* THE RUN LENGTH IS WRITTEN AFTER THAT CALL, AND ONLY IF IT DECLINED - which is the
       opposite of the obvious order, and the obvious order was silently wrong. app.js loads
       its first example on the way past, deriving that design's $finish time and setting
       `maxTimeIsAuto`; this call is then handed the DESIGN half alone, which has no $finish
       in it, so it declines - and declining means `releaseRunLength()`, which restores
       app.js's own MAX_TIME_DEFAULT over whatever was in the field. So a topic's `maxTime`
       written before it was thrown away and every page ran for 300 units.
       Nothing had noticed because no topic asked for more until `alu-4bit-opt`, whose
       testbench sweeps 1,024 input combinations and needs 1,120: measured in a browser, the
       Console said `Stopped: reached run length of 300 time units without $finish` while
       `LEARN_API.maxTime()` reported 1120 quite correctly - the intent and the effect had
       come apart, which is why test_learn.py now reads the FIELD. The `disabled` test is
       what keeps a genuinely derived time: if the derivation DID answer, it owns the field
       and has switched it off. */
    if (maxInput && !maxInput.disabled) maxInput.value = String(topicMaxTime());
    /* TRAILING BLANK LINES TRIMMED FROM THE VIEW. The seeded document puts a blank line
       before the marker so the two halves read apart, and `designSpan` keeps it - where
       `testbenchSpan` deliberately skips the blank lines AFTER the marker. So the editor
       opened on two empty lines below `endmodule`, which the gutter numbered and the
       height below then had to make room for.

       The view only: this is an ordinary edit as far as the app is concerned, and every
       path that consumes the source merges first, so no merge is needed here. One was
       written and then removed - a mutant deleting it changed nothing observable, which
       is this repo's own test for reassurance that cannot be checked.

       setEditorView, not setEditorText: a view-only trim of a document the reader has not
       touched yet is not an edit to undo, and recording one would put the untrimmed seed
       one Cmd-Z behind the page - the same reason the seed above is not undoable. */
    var tidy = codeInput.value.replace(/\n\s*$/, '\n');
    if (tidy !== codeInput.value) setEditorView(tidy);
    /* ONE MODULE IN THE EDITOR. The design half holds the library too, and none of it is what
       the reader is reading, so the editor is narrowed to the module the page is about. The module
       browser is already hidden here, so there is no control that would wander off it.

       Two things follow. `editorFullSource` is still the whole document, so Run compiles the
       library and the testbench and Save writes them - narrowing is a VIEW, which is exactly what
       app.js's module browser already does. And a mid-typo edit cannot parse, so app.js falls back
       to the design span: the library becomes visible until the text parses again, the testbench
       never does, and the fallback is what stops a broken edit from being stranded. */
    var only = designModule();
    if (only && typeof showModuleInEditor === 'function') showModuleInEditor(only);
    /* After the split, the trim AND the narrowing, so it measures what the reader actually sees -
       the document it was handed carries the library and the testbench and is far longer. */
    fitEditorHeight();
  }
  /* The synthesizer's top, for practice-synth.js to pass on. A global rather than an API call
     because that file already reads window.LEARN_SLUG and window.PRACTICE_META the same way, and
     because it is read at CLICK time - this file runs after it. */
  window.LEARN_SYNTH_TOP = designModule();

  /* AFTER the seeding above, for the reason drawFigures' note gives: a placement reads the design,
     so the design has to be the topic's by the time it is placed. */
  drawLayouts();
  renderTruthTable();

  /* Both run buttons, and the netlist pair appearing, change what this page shows - so the
     table is re-rendered after each, and the two synthesis cards are moved into their slots
     the moment they exist. Registered after app.js's own handlers, so the run is complete
     and lastResult is current by the time these fire. */
  ['runBtn', 'resetBtn', 'synthBtn', 'gateRunBtn'].forEach(function (id) {
    var b = $(id);
    if (!b) return;
    b.addEventListener('click', function () {
      fill();
      /* The placement follows the design, so it is redrawn with everything else: after a synthesis
         it places the netlist that synthesis produced, and after a Run it places what the editor
         now says. Cheap enough to do unconditionally - one parse and one placement of a handful of
         cells - and the alternative is a picture that is right only until the reader edits. */
      drawLayouts();
      renderTruthTable();
      /* Registered after app.js's own handler and after practice-synth's, so by the time
         this runs the console holds the whole of what that click produced - which is what
         lets one `.err` test stand for every way a run or a synthesis can fail. Reset is in
         this list to re-render, not to report: it clears the console, so there is no error
         row for it to find. */
      if (id !== 'resetBtn') showLogIfFailed();
    });
  });

  // Named for the harness, which drives all of this without a browser.
  window.LEARN_API = {
    figures: function () { return figuresDrawn.slice(); },
    layouts: function () { return layoutsDrawn.slice(); },
    /* The cross section and the animation, for the harness: the state, and the two verbs that drive
       them - so a check can step the process and move the cut without a pointer, which is the only
       way either is testable against the stub DOM. */
    section: function (n) {
      var st = secState[n];
      if (!st) return null;
      return { on: !!st.on, cut: st.cut, anim: !!st.anim, step: st.step,
               steps: st.steps.map(function (s) { return s.label; }),
               drawn: st.drawn || null };
    },
    /* The fit, callable: the stub reports one height for every element, so a check has to supply real
       box metrics and ask for the arithmetic again. The browser calls it once per draw. */
    refit: function (n) {
      var res = layoutFor(n);
      return res ? fitLayout(layoutHoles[n], res) : null;
    },
    /* The autoplay decision, for the harness: the stub answers `matchMedia` however it is told to, so
       both branches are drivable - and this is the one place the page decides to move on its own. */
    autoplay: function (n) {
      var res = layoutFor(n);
      return res ? autoplay(n, layoutHoles[n], res) : false;
    },
    stepCut: function (n, d) {
      var res = layoutFor(n);
      if (res) stepCut(n, layoutHoles[n], res, d);
    },
    /* The click, without a pointer: the same writer the press goes through, so a check drives the
       real path rather than a copy of it. Takes a PLACEMENT coordinate, since converting a client x
       needs a laid-out box and the stub has none. */
    pickCut: function (n, x) {
      var res = layoutFor(n);
      if (res) pickCut(n, layoutHoles[n], res, x);
    },
    idealView: function (n) {
      var res = layoutFor(n);
      if (!res) return;
      stopAnim(n);
      secOf(n).picked = false;
      secOf(n).cut = null;
      redrawSection(n, layoutHoles[n], res);
    },
    animStep: function (n, k) {
      var res = layoutFor(n);
      if (res) applyStep(n, layoutHoles[n], res, k);
    },
    setSection: function (n, on) {
      var res = layoutFor(n);
      if (!res) return;
      secOf(n).on = on;
      syncSecToggle(n, layoutHoles[n]);
      redrawSection(n, layoutHoles[n], res);
    },
    /* Takes an optional source so the derivation itself is testable: with two modules in a design
       part there is nothing to derive and nothing may be claimed, and no real topic has that shape
       - which would leave that branch unreachable and its mutant alive. */
    designModule: designModule,
    /* The clamped multiplier the tables were drawn at, or null where the topic said nothing -
       so a check can tell "asked for 1" from "asked for nothing", which are the same on screen
       and different in the markup. */
    truthScale: truthScale,
    /* The quiz, for the harness: the panels that were built, the per-question state and the
       verdict the hub would be given - so a check can drive the real buttons and then ask what
       this page thinks it has, rather than recomputing the rule it is checking. */
    quizzes: function () { return quizzesBuilt.slice(); },
    /* The widgets, for the harness: which were built, and the step each is on - so a check can drive
       one without a pointer, the same way `section` exposes the cross-section's step. */
    widgets: function () { return widgetsBuilt.slice(); },
    widgetStep: function (n) { return widgetState[n] === undefined ? null : widgetState[n]; },
    quizState: function (n) { return (quizState[n] || []).slice(); },
    quizVerdict: quizVerdict,
    /* The sections a question may point back at, keyed as the prose marks them - so a check can
       assert every `sec` a topic names really is a heading on its page, which is the one way this
       fails silently (a dead link, or no link at all where one was meant). */
    sections: function () {
      var out = {};
      Object.keys(sections).forEach(function (k) {
        out[k] = { id: sections[k].id, label: sections[k].label };
      });
      return out;
    },
    slots: function () { return Object.keys(slots); },
    /* The log dialog, for the harness: whether it is open, and a way out of it that is not
       a click on a specific element - the same shape PRACTICE_API exposes its own dialog. */
    logOpen: function () { return !!logBack && logBack.classList.contains('open'); },
    document: topicDocument,
    truthRows: function () { return lastTruthRows; },
    maxTime: topicMaxTime,
    closeLog: closeLog,
    slotFor: function (n) { return slots[n] || null; },
    fill: fill,
    renderTruthTable: renderTruthTable,
    topic: function () { return topic; }
  };
})();
