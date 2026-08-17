/* Topic content for the 'lego-logic' learn page - the first topic on the hub, and the one
 * that comes BEFORE any Verilog.
 *
 * It is PROSE ONLY: no `verilog`, no `library`, no `testbench`, no truth-table COLUMNS, and its
 * manifest entry asks for no slots at all. (There is a `truthTable` block at the foot of this
 * file, carrying nothing but a `scale` - how big the tables written out in the prose are drawn.
 * See its own note.)
 *
 * There is one interactive thing on it, and it is not one of the app's cards: a `quiz` block, the
 * second-last section, whose score is what the Learn hub reports for this topic. It needs no slot
 * and no engine - learn.js builds it out of the questions declared at the foot of this file. That is the point rather than a shortcut - the
 * page argues one thing (why a gate needs two inputs before it can decide anything, and why
 * NAND is the one gate you could build a computer out of), and there is nothing on it to run.
 * `logic-gates`, the next topic, is where an editor, a truth table, a waveform and a netlist
 * arrive, all describing a gate this page has already introduced.
 *
 * Two consequences worth knowing before editing:
 *
 *   - learn.js hides the app's grid on a topic with no slots, so the article IS the page. A
 *     slot added here would need its card back, which means the manifest's `slots` list -
 *     the two are one declaration and build.py generates the page's script tags from it.
 *   - `figures` and `layouts` are NOT available here. Both are drawn by other apps'
 *     engines (practice-synth.js and practice-pnr.js), which a page loads only when its
 *     manifest entry asks for a netlist slot or `"pnr": true`. So the illustrations on this
 *     page are hand-drawn SVG in the prose, which is what they want to be anyway: LEGO
 *     bricks are not gate symbols, and drawing them with the netlist viewer's node code
 *     would be forcing one picture through a drawer built for another.
 *
 * THE BRICKS ARE PAINTED FROM TOKENS, never from LEGO's own brand hex. Red, blue, yellow and
 * green become `--danger-fg`, `--accent-fg`, `--attention-fg` and `--success-fg`, so the
 * artwork follows the reader's colour mode like everything else here - and learn.css stays
 * under the literal-colour budget its own harness pins (the only literals in that file are
 * the four cross-section MATERIALS, which are the product rather than chrome). The shapes
 * take their colour from `currentColor`, which is what lets one `<use>` of one brick be any
 * of the four. See learn.css's `.lego-*` block.
 *
 * HTML is carried in String.raw template literals, so no block here may contain a backtick or
 * a dollar followed by a brace - either would end the literal and turn the rest of the file
 * into JavaScript, which surfaces as a SyntaxError hundreds of lines away. That is the hazard
 * CLAUDE.md records for EXAMPLES and for every exercise file here.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['lego-logic'] = {

  blocks: [
    { html: String.raw`
<!-- The brick artwork, defined ONCE and used by every illustration below. Two shapes, three
     rects each: the stud on top, the body, and a thin lit strip inside the body's top edge
     that is what makes a flat rectangle read as a brick.

     The colour is deliberately absent here. Every rect that should be brick-coloured takes
     "fill: currentColor" from learn.css, so the colour is set on the use element instead -
     one definition, four colours, and no copy of the geometry per colour. The stud is drawn
     BEFORE the body so the body's own outline stroke closes over its bottom edge.

     Zero width and height, and out of the accessibility tree: this element draws nothing, it
     only holds the definitions. Note no BACKTICK may appear anywhere in a block like this
     one, comment or not - it would end the template literal that carries it. -->
<svg class="lego-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <g id="lego-1x1">
      <rect class="lego-stud" x="11" y="1" width="18" height="9" rx="3"/>
      <rect class="lego-body" x="0" y="10" width="40" height="30" rx="4"/>
      <rect class="lego-top" x="4" y="13.5" width="32" height="3" rx="1.5"/>
    </g>
    <g id="lego-1x2">
      <rect class="lego-stud" x="11" y="1" width="18" height="9" rx="3"/>
      <rect class="lego-stud" x="51" y="1" width="18" height="9" rx="3"/>
      <rect class="lego-body" x="0" y="10" width="80" height="30" rx="4"/>
      <rect class="lego-top" x="4" y="13.5" width="72" height="3" rx="1.5"/>
    </g>
  </defs>
</svg>

<p>Everything inside a computer is built out of tiny electronic switches called
<b>logic gates</b>, and each one understands exactly two things: <b>1</b>, which is on, and
<b>0</b>, which is off. That is the whole vocabulary. Arithmetic, memory, a photograph, a
video game and this sentence are all some arrangement of gates passing 1s and 0s to each
other.</p>
<p>The interesting question is not what one gate does - it is which gates you would need in
the box to be able to build anything at all. That question is easier to think about with LEGO
bricks than with transistors, because it is the same question: <em>which piece lets me join
two things together?</em></p>
` },

    { html: String.raw`
<h2>The 1x1 brick: an inverter</h2>
<div class="learn-split">
  <div>
    <p>Start with the smallest brick there is. A <b>1x1</b> has one connection underneath and
    one stud on top: one thing in, one thing out, and nowhere else to go.</p>
    <p>In logic that piece is the <b>NOT gate</b>, usually called an <b>inverter</b>. Its only
    job is to disagree with its input. Give it a 1 and it hands back a 0; give it a 0 and it
    hands back a 1. Two rows is the whole of what it does, and a table like this - one row per
    combination of inputs - is called a <b>truth table</b>.</p>
    <div class="truth-wrap">
      <table class="truth-table">
        <thead>
          <tr><th class="in">a</th><th class="sep"></th><th>NOT</th></tr>
        </thead>
        <tbody>
          <tr><td class="in">0</td><td class="sep"></td><td class="one">1</td></tr>
          <tr><td class="in">1</td><td class="sep"></td><td class="zero">0</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="learn-illus">
    <svg viewBox="0 0 40 40" width="76" height="76" role="img" aria-label="A single 1x1 LEGO brick">
      <use class="lego-red" href="#lego-1x1"/>
    </svg>
    <div class="learn-illus-cap">one 1x1 brick: one connection, one stud</div>
  </div>
</div>

<div class="learn-note">
  <b>So why can you not build everything out of 1x1 bricks?</b> Because one connection can
  never bring two pieces of information together. There is only ever one thing to be told.
</div>

<div class="learn-split">
  <div class="learn-illus">
    <svg viewBox="-10 0 60 161" width="100" height="268" role="img" aria-label="Five 1x1 bricks stacked into a swaying tower">
      <g class="lego-tower">
        <use class="lego-red" href="#lego-1x1" y="120"/>
        <use class="lego-yellow" href="#lego-1x1" y="90"/>
        <use class="lego-red" href="#lego-1x1" y="60"/>
        <use class="lego-yellow" href="#lego-1x1" y="30"/>
        <use class="lego-red" href="#lego-1x1" y="0"/>
      </g>
    </svg>
    <div class="learn-illus-cap">every 1x1 structure is this structure</div>
  </div>
  <div>
    <p>With nothing but 1x1s, the only thing you can build is a tower. Each brick sits on
    exactly one brick below it, so nothing ever branches and nothing ever joins - and a tower
    one stud wide is not a wall, a car or a spaceship. It is a tall, wobbly line.</p>
    <p>Inverters chain up exactly the same way. Feed one into the next and the signal simply
    flips back and forth, 1 to 0 to 1 to 0, however many you use. <b>A gate with one input
    cannot compare anything, so it can never decide anything</b> - and deciding is the entire
    job.</p>
  </div>
</div>
` },

    { html: String.raw`
<h2>The 1x2 brick: a NAND gate</h2>
<div class="learn-split">
  <div>
    <p>Now take one step up in size. A <b>1x2</b> brick is twice as wide: it covers
    <b>two</b> connections underneath and offers two studs on top. That one extra connection
    is the whole difference between a box of bricks you can build with and a box you cannot.</p>
    <p>Its counterpart in logic is the <b>NAND gate</b> - NOT-AND. It takes two inputs and
    gives one answer, and the answer is 0 only when <em>both</em> inputs are 1. Anything else
    and it says 1. Two inputs means four combinations, so its truth table has four rows.</p>
    <div class="truth-wrap">
      <table class="truth-table">
        <thead>
          <tr><th class="in">a</th><th class="in">b</th><th class="sep"></th><th>NAND</th></tr>
        </thead>
        <tbody>
          <tr><td class="in">0</td><td class="in">0</td><td class="sep"></td><td class="one">1</td></tr>
          <tr><td class="in">0</td><td class="in">1</td><td class="sep"></td><td class="one">1</td></tr>
          <tr><td class="in">1</td><td class="in">0</td><td class="sep"></td><td class="one">1</td></tr>
          <tr><td class="in">1</td><td class="in">1</td><td class="sep"></td><td class="zero">0</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="learn-illus">
    <svg viewBox="0 0 80 40" width="152" height="76" role="img" aria-label="A single 1x2 LEGO brick">
      <use class="lego-blue" href="#lego-1x2"/>
    </svg>
    <div class="learn-illus-cap">one 1x2 brick: two connections, two studs</div>
  </div>
</div>

<div class="learn-note">
  <b>And why is the 1x2 the magic one?</b> Because it can sit across two bricks at once. That
  is what turns a stack into a structure: pieces below it are now held together by the piece
  above them.
</div>

<div class="learn-split">
  <div class="learn-illus">
    <svg viewBox="0 0 160 130" width="300" height="244" role="img" aria-label="1x2 bricks laid in overlapping rows to make an interlocked wall">
      <use class="lego-blue" href="#lego-1x2" y="90"/>
      <use class="lego-blue" href="#lego-1x2" x="80" y="90"/>
      <use class="lego-red" href="#lego-1x1" y="60"/>
      <use class="lego-green" href="#lego-1x2" x="40" y="60"/>
      <use class="lego-red" href="#lego-1x1" x="120" y="60"/>
      <use class="lego-yellow" href="#lego-1x2" y="30"/>
      <use class="lego-yellow" href="#lego-1x2" x="80" y="30"/>
      <use class="lego-blue" href="#lego-1x2" x="40"/>
    </svg>
    <div class="learn-illus-cap">each row spans the seam in the row below it</div>
  </div>
  <div>
    <p>Offset the rows by one stud and every brick bridges the gap between the two under it.
    Now the pile is a wall, and a wall is what houses, cars and spaceships are made of. The
    ability to span two things is where all of that comes from - not from having more colours
    or more shapes.</p>
    <p>NAND has the same property, and it earns the same name for it: it is a
    <b>universal gate</b>. Because it joins two signals, you can wire NAND gates together to
    make <em>any</em> other gate, and from those, adders, memory and eventually a whole
    processor. Nothing else has to be in the box.</p>
  </div>
</div>
` },

    { html: String.raw`
<h2>Everything out of one brick</h2>
<p>Universal is a strong claim, so here it is spelled out. Three arrangements of NAND, and the
first is the one that makes the point - the 1x1 brick was never needed, because a 1x2 with
both of its connections on the same thing <em>is</em> a 1x1:</p>
<ul>
  <li><b>NOT a</b> - one NAND with both inputs tied to <code>a</code>. Read the table above at
      the rows where the two columns agree: 0 gives 1, 1 gives 0. That is the inverter, and it
      cost no new kind of gate.</li>
  <li><b>a AND b</b> - a NAND is an AND that has been inverted, so invert it back: one NAND
      into a second NAND wired as the inverter above.</li>
  <li><b>a OR b</b> - invert both inputs, then NAND them. That is De Morgan's law in bricks:
      <em>not a</em> and <em>not b</em> being both true is the same statement as <em>a or
      b</em> being false.</li>
</ul>
<p>This is not only a teaching trick. In real static CMOS a NAND is genuinely
<em>cheaper</em> than an AND - an AND is built as a NAND followed by an inverter, so the AND
is the more expensive piece of the two - which is why the gate-level netlists further into
this site are full of NANDs and inverters rather than the ANDs and ORs a diagram is usually
drawn with.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Four questions on what the two bricks are for. Nothing has to be right first time - a wrong
answer says so and lets you try another - and the score at the foot of the panel is what the
Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>So: a gate needs two inputs before it can compare, and one two-input gate is enough to
build the rest. <a href="learn-logic-gates.html">Logic Gates</a> is the same subject with the
bricks taken away - the eight gates and their symbols, one of them written in Verilog, run to
fill in its own truth table and waveform, then synthesized into cells and finally drawn as
the mask layers of a real one on silicon.</p>
` }
  ],

  /* THE QUIZ, and the one result this page produces.
   *
   * `answer` is the index of the correct option, and the options are deliberately NOT in a fixed
   * position from question to question - a reader who notices the answer is always second has
   * stopped reading the answers. Each distractor is a real misreading of the page rather than
   * filler: "too slow" is the wrong axis entirely, "tie one input to 0" is the NAND identity got
   * backwards (it pins the output at 1), and "no delay" and "any voltage" are what "complete"
   * sounds like if you have not met the word.
   *
   * The question text is html, so it may quote a signal - and, like every other block in this
   * file, it may contain no backtick and no dollar-brace. The options are plain text.
   *
   * How the score becomes the hub's badge is learn.js's note above buildQuizzes: the counts go
   * to cloud-sync.js through a hook, `pass` only becomes the hub's `passing` when every question
   * is right, and a half-answered quiz reads as `in progress` rather than as a pass. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          q: 'Why can inverters alone not build a computer?',
          options: [
            'They are too slow',
            'They have only one input, so signals can never combine',
            'They cannot invert a 0'
          ],
          answer: 1
        },
        {
          q: 'With <code>a = 1</code> and <code>b = 1</code>, what does <code>a NAND b</code> output?',
          options: ['1', 'It depends', '0'],
          answer: 2
        },
        {
          q: 'How do you turn one NAND gate into a NOT gate?',
          options: [
            'Tie both inputs to the same signal',
            'Tie one input to 0',
            'Use two NANDs in a row'
          ],
          answer: 0
        },
        {
          q: 'A gate being <b>universal</b> means...',
          options: [
            'The gate has no delay',
            'Every logic function there is can be built out of that one gate',
            'The gate works at any voltage'
          ],
          answer: 1
        }
      ]
    }
  },

  /* HOW BIG THE TABLES ON THIS PAGE ARE, and that is all this block says here.
   *
   * `truthTable` is a topic's statement about the truth tables on its page: which columns the
   * Truth Table CARD shows and where the run is sampled for them (see logic-gates), and `scale`,
   * a multiplier on the 12px learn.css sets. This topic has no card - its two tables are written
   * out in the prose, because there is nothing here to run - so the size is the only thing it has
   * to say, and a scale with no columns is a complete declaration rather than half of one.
   *
   * It reaches every table on the page at once, the card's and the prose's alike, because a page
   * whose paragraphs and panels disagreed about how big a truth table is would read as two
   * different kinds of table.
   *
   * The number is a multiplier on the 12px learn.css sets the panel in, and the SITE DEFAULT is
   * 1.2 - so 1 is what every table was before the knob existed, 1.2 is what a topic that says
   * nothing gets, and this page asks for a little more than that because reading a truth table is
   * the whole of what it is teaching. learn.js clamps to 0.6 - 2.5 and reports what it used. */
  truthTable: {
    scale: 1.35
  }
};
