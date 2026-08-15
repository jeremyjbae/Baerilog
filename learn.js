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
      var sec = mk('div', 'learn-prose');
      sec.innerHTML = b.html || '';
      article.appendChild(sec);
    });
  }
  if (grid && grid.parentElement) grid.parentElement.insertBefore(article, grid);

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
    'netlist-view': 'card-netlist-view'
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
    Object.keys(slots).forEach(function (name) {
      var hole = slots[name];
      var card = $(CARD_FOR[name] || '');
      if (!card) return;
      /* A HOLE FOLLOWS ITS CARD'S VISIBILITY, and this runs even when the card is already here -
         which is the case that matters, since a card's visibility moves long after it was moved in.
         Without it the netlist LISTING's hole keeps its own 24px margin on a design that was already
         a netlist, where practice-synth suppresses that card: a gap in the prose with nothing in it.
         Read from the card rather than decided here - whoever hid it owns the reason. */
      hole.style.display = card.style.display === 'none' ? 'none' : '';
      if (card.parentElement === hole) return;            // already in this hole
      hole.appendChild(card);
      var stack = card.querySelector('.layout-toggle [data-layout-btn]');
      if (stack && stack.parentElement) stack.parentElement.style.display = 'none';
      var expand = card.querySelector('#waveExpandBtn');
      if (expand && expand.parentElement) expand.parentElement.style.display = 'none';
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
    var nodes = (spec.nodes || []).map(function (n) {
      var pos = { x: n.x || 0, y: n.y || 0 };
      if (n.kind === 'in' || n.kind === 'out') {
        return { id: n.id, type: 'port', position: pos,
                 data: { dir: n.kind, label: n.label || n.id } };
      }
      if (n.kind === 'const') {
        return { id: n.id, type: 'const', position: pos, data: { label: n.label || '0' } };
      }
      if (n.kind === 'dff' || n.kind === 'mux2') {
        return { id: n.id, type: n.kind, position: pos, data: { label: n.label || n.kind } };
      }
      if (n.kind === 'add' || n.kind === 'sub') {
        return { id: n.id, type: 'adder', position: pos,
                 data: { op: n.kind, label: n.label || n.kind } };
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
    b.style.borderColor = L.colour || '';
    b.style.background = on ? (L.colour || '') : 'transparent';
    b.style.color = on ? (L.textOn || '') : (L.colour || '');
  }

  /* WHICH LAYERS ARE HIDDEN, per figure and per layer, kept OUTSIDE the drawing because the drawing is
     replaced on every press: a reader who turned the metal off to see the poly under it should not have
     that undone by pressing Synthesize. Not persisted beyond the page - a layer choice is a way of
     looking at one figure, not a preference about the site. */
  var layerOff = {};

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
        var showing = !off[L.cls];
        off[L.cls] = showing;              // was showing, so this hides it
        paintLayerBtn(b, L, !showing);
        api.setLayerVisible(hole, L.cls, !showing);
      });
      made.push({ L: L, btn: b });
    });

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

  /* The box is the VIEW - the bordered surface - and drawStatic empties whatever element it is handed.
     So the palette cannot be a child of the box directly: the next redraw would delete it. The box gets
     a stable pair of children instead, the palette and a drawing target, and only the target is handed
     over. That is what lets the layers sit INSIDE the view's border rather than above it. */
  function drawTargetIn(hole) {
    var el = hole.querySelector('.learn-fig-draw');
    if (!el) {
      el = mk('div', 'learn-fig-draw');
      hole.appendChild(el);
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
    var foot = figFoot(hole);
    var el = foot.querySelector('.learn-fig-stats');
    var cells = (res.tally || []).map(function (c) { return c.count + ' \u00d7 ' + c.type; });
    if (!cells.length) {
      if (el && el.remove) el.remove();
      return null;
    }
    if (!el) {
      el = mk('div', 'learn-fig-stats');
      /* FIRST in the row, so the measured line leads and the credit trails it whichever order the
         two setters happen to run in. */
      foot.insertBefore(el, foot.firstChild);
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

  var layoutsDrawn = [];

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
        netlist: netlist, rowWidth: spec.rowWidth, view: spec.view, rowPx: spec.rowPx
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
      setStats(layoutHoles[name], res);
      setSource(layoutHoles[name], api.source);
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
  function moveSynthIntoViewer() {
    var btn = $('synthBtn');
    var card = $('card-netlist-view');
    if (!btn || !card) return;
    var legend = card.querySelector('.legend-row');
    if (!legend) return;
    var foot = card.querySelector('.learn-synth-foot');
    if (!foot) {
      foot = mk('div', 'learn-synth-foot');
      if (legend.parentElement) legend.parentElement.insertBefore(foot, legend);
      foot.appendChild(legend);
    }
    if (btn.parentElement !== foot) foot.insertBefore(btn, foot.firstChild);
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
  fill();
  moveSynthIntoViewer();
  /* Once, at load: a figure is an illustration, so nothing re-draws it. A PLACEMENT is not drawn
     here, because it reads the EDITOR and the editor still holds app.js's own first example at this
     point - parsing that gave `expected id but found @`, from an `always` block. It is drawn below,
     once the topic has been seeded. */
  drawFigures();

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
    if (maxInput) maxInput.value = String(topicMaxTime());
    setEditorText(topicDocument());
    resetEditorHierarchyState();
    tryApplyAutoFinishTime(codeInput.value);
    /* TRAILING BLANK LINES TRIMMED FROM THE VIEW. The seeded document puts a blank line
       before the marker so the two halves read apart, and `designSpan` keeps it - where
       `testbenchSpan` deliberately skips the blank lines AFTER the marker. So the editor
       opened on two empty lines below `endmodule`, which the gutter numbered and the
       height below then had to make room for.

       The view only: this is an ordinary edit as far as the app is concerned, and every
       path that consumes the source merges first, so no merge is needed here. One was
       written and then removed - a mutant deleting it changed nothing observable, which
       is this repo's own test for reassurance that cannot be checked. */
    var tidy = codeInput.value.replace(/\n\s*$/, '\n');
    if (tidy !== codeInput.value) setEditorText(tidy);
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
    /* Takes an optional source so the derivation itself is testable: with two modules in a design
       part there is nothing to derive and nothing may be claimed, and no real topic has that shape
       - which would leave that branch unreachable and its mutant alive. */
    designModule: designModule,
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
