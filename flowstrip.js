/* Baerilog/flowstrip.js - THE flow strip, for the pages that have a flow.
 *
 * A row of stages in the order the work happens - `</> Code > ▶ Run Simulation >
 * ⚙ Synthesize > ▶ Run Gate-level Simulation` - where a stage is GREEN when it can be run
 * and grey when it cannot. So the row answers "where am I and what is next" without the
 * reader working it out from which cards have appeared.
 *
 * TWO PAGES, ONE BUILDER, AND THAT IS THE WHOLE POINT OF THE FILE. It was written inside
 * `code2silicon.js` and the twenty practice pages have the same flow with three fewer
 * stages; a second copy of it in `practice.js` is exactly the drift this repo keeps paying
 * for - the shared stylesheet became four variants that way. Unlike the navigation drawer
 * this needs no paste-and-sync tool: both callers are classic scripts in this one flat
 * directory, so a real shared file works and there is nothing to keep in step.
 *
 * WHAT IT IS NOT: a table of contents. The tabs it replaced named the page's panels, which
 * is a different question from what a reader does next. Cards lose their jump and are
 * reached by scrolling - the cost of the trade, taken deliberately on both pages.
 *
 * IT DRIVES EXISTING CONTROLS RATHER THAN REIMPLEMENTING THEM. Run, Synthesize and the
 * gate-level Run belong to app.js, practice-synth.js and the netlist card, each with a
 * handler chain behind it - the verdict pill, the folded cards, the stale marks, the
 * three-state label, the busy decoration. So those buttons are hidden and the strip CLICKS
 * them: one owner per action, and every consequence still happens. It is the same pattern
 * practice.js's Reset already uses for the toolbar's own hidden button.
 *
 * A stage is `{id, label, card, drives?, run?, btn?, when?}`:
 *   drives  an element id this stage clicks - app.js's `runBtn`, and so on
 *   run     a function the CALLER owns, for a stage that is its own action
 *   btn     returns a button that already exists, which the strip adopts rather than making
 *   when    an extra precondition beyond the driven button existing
 *   card    what to scroll to afterwards; a stage with no `drives`/`run` only scrolls
 */
'use strict';

window.FLOWSTRIP = (function () {

  function create(opts) {
    var strip = opts.strip;
    var stages = opts.stages || [];
    var afterRun = opts.afterRun || function () {};
    /* EVERY NODE THIS FILE PUT IN THE STRIP, so a rebuild can take back exactly its own and
       leave everything else. `innerHTML = ''` was what the single-page version did, and it is
       wrong the moment the row holds anything else: practice.js appends the Exercise / Reset
       group, and a rebuild after every Run would delete it along with the handlers on it. */
    var mine = [];

    function $(id) { return document.getElementById(id); }

    /* AVAILABILITY IS READ FROM THE CONTROL THE BUTTON DRIVES, never tracked a second time.
       A stage whose driven button is disabled cannot be run, so the strip must not offer it;
       keeping a copy of that judgement is how the row would come to claim a stage that does
       nothing.

       NOT its VISIBILITY: the button a stage drives is deliberately hidden - that is the
       whole arrangement - so `display: none` would grey every driven stage forever. */
    function ready(st) {
      if (st.run || st.btn) return true;                 // the caller's own, and its own answer
      if (!st.drives) return true;                       // Code: navigation only
      var el = $(st.drives);
      if (!el || el.disabled) return false;
      return st.when ? st.when() : true;
    }

    /* ABSENT IS NOT THE SAME AS NOT READY, and the difference is what lets one stage list
       serve a page that has no synthesizer. A button that EXISTS but is not usable yet is
       greyed - the gate-level Run before anything has been synthesized, which is a real
       stage of this page's flow and worth showing as the next thing. A button that is not on
       the page AT ALL is a stage this page does not have: `ram-8bit` carries no Synthesize,
       so offering a permanently grey one would describe a flow it cannot run. */
    function present(st) {
      if (st.run || st.btn) return true;
      if (!st.drives) return true;
      return !!$(st.drives);
    }

    /* THE LABEL IS MIRRORED, NOT RESTATED. app.js writes `▶ Run Simulation` -> `▶ Re-run
       Simulation` -> `⚠︎ Error (Retry)` on its own button and practice-synth.js the same three
       on Synthesize, with `data-error` for the red state - so the strip takes both from the
       button it drives and cannot disagree with it. A stage with nothing behind it keeps the
       label its own entry gives. */
    function sync() {
      if (!strip) return;
      stages.forEach(function (st) {
        var b = st.btn ? st.btn() : $(st.id);
        if (!b || !st.drives) return;
        b.disabled = !ready(st);
        var src = $(st.drives);
        if (!src) return;
        if (src.textContent) b.textContent = src.textContent;
        if (src.getAttribute && src.getAttribute('data-error') !== null) {
          b.setAttribute('data-error', '');
        } else if (b.removeAttribute) {
          b.removeAttribute('data-error');
        }
      });
    }

    /* `scrollIntoView` aims at the top of the VIEWPORT, which is under the bar and the sticky
       page head - so a press left the card it selected with its own title hidden behind the
       strip that selected it.

       BY HOW MUCH THE BAND ACTUALLY COVERS THE CARD, not by where the band's bottom edge is.
       The two are the same number only when the scroll reached the top of its range and put
       the card at y=0 - and for the LAST card on the page it cannot, there being no content
       below it to scroll past. Measured on code2silicon's Fabricate: the scroll hit its
       maximum with the card already clear of the band, and the old form then scrolled back
       anyway, leaving a third of the viewport empty above it and part of it cut off below.

       Measured AFTER the scroll, which is what makes one rule serve both layouts: where the
       narrow layer has released the band it has scrolled away with the page and its bottom is
       at or above 0, so there is nothing to correct - no second copy of the 760px breakpoint. */
    function clearStickyOverlap(el) {
      var head = document.querySelector('.gh-page-head');
      if (!head || !head.getBoundingClientRect || !window.scrollBy) return;
      var over = head.getBoundingClientRect().bottom;
      if (el && el.getBoundingClientRect) over -= el.getBoundingClientRect().top;
      if (over > 0) window.scrollBy(0, -over);
    }

    function goTo(cardId) {
      var el = $(cardId);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
      clearStickyOverlap(el);
    }

    function build() {
      if (!strip) return;
      /* THE ROW SAYS WHAT IT IS, so the stylesheet can dress a flow without touching the four
         menu apps' tab strips - which share this element's class and must keep their own
         geometry. One class on the container beats `:has(.flow-stage)`, and it is set here
         because this is the only thing that puts stages in a strip. */
      if (strip.classList) strip.classList.add('flow');
      /* Only this file's own nodes come out, and they go back at the FRONT - so whatever
         another file appended (the Exercise / Reset group) stays where it is, at the end,
         where its own `margin-left: auto` holds it against the right edge. */
      mine.forEach(function (n) { if (n.remove) n.remove(); });
      mine = [];
      var made = [];
      stages.filter(present).forEach(function (st, i) {
        var b = st.btn ? st.btn() : document.createElement('button');
        if (!st.btn) {
          b.className = 'btn flow-stage';
          b.id = st.id;
          b.setAttribute('type', 'button');
          b.textContent = st.label;
        }
        /* The separator says the row is a SEQUENCE rather than a set of peers. Decoration
           only, so it is hidden from a screen reader, which reads the buttons in order. */
        if (i) {
          var sep = document.createElement('span');
          sep.className = 'flow-stage-sep';
          sep.textContent = '>';
          sep.setAttribute('aria-hidden', 'true');
          made.push(sep);
        }
        made.push(b);
        if (b.__flowWired) return;
        b.__flowWired = true;
        b.addEventListener('click', function () {
          /* A grey stage does nothing at all, not even the scroll: arriving at a card with
             nothing in it is a dead end, and `disabled` on a real button gets that for free -
             this guard is for a caller reaching the handler directly. */
          if (b.disabled) return;
          var act = st.run || (st.drives ? function () {
            var el = $(st.drives);
            if (el) el.click();
          } : null);
          if (!act) { goTo(st.card); return; }
          /* The press is acknowledged on the button the reader actually pressed. withBusyButton
             decorates whatever it is given, and for a driven stage the button it would otherwise
             decorate is the hidden one - so the feedback would happen off screen. */
          if (typeof window.withBusyButton === 'function') window.withBusyButton(b, act, sync);
          else act();
          afterRun(st);
          sync();
          goTo(st.card);
        });
      });
      var first = strip.children[0] || null;
      made.forEach(function (n) { strip.insertBefore(n, first); mine.push(n); });
      sync();
    }

    return {
      build: build,
      sync: sync,
      goTo: goTo,
      /* Published because practice-synth.js scrolls to a card of its own and needs the same
         correction - taking it from here rather than measuring the sticky band a second time. */
      clearStickyOverlap: clearStickyOverlap,
      /* THE ROW AS A READER SEES IT: the stages in order, with their label and whether each
         is available. Collected BY CLASS rather than by tag, because the row may hold other
         controls - practice.js's Exercise and Reset - and a tag query would count those. */
      list: function () {
        return [].map.call(strip ? strip.querySelectorAll('.flow-stage') : [], function (b) {
          return { id: b.id, label: b.textContent, ready: !b.disabled };
        });
      },
      button: function (id) {
        var all = strip ? strip.querySelectorAll('.flow-stage') : [];
        for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
        return null;
      },
      cardOf: function (id) {
        for (var i = 0; i < stages.length; i++) {
          var st = stages[i], b = st.btn ? st.btn() : null;
          if ((b && b.id === id) || st.id === id) return st.card;
        }
        return null;
      }
    };
  }

  return { create: create };
})();
