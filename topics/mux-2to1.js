/* Topic content for the 'mux-2to1' learn page - the first topic in Combinational, and the first
 * circuit on the site that CHOOSES rather than computes.
 *
 * Every page before it takes its inputs and works something out from all of them. A multiplexer is
 * the other kind of thing: two of its inputs are data and the third is a CONTROL, and the answer is
 * one of the data inputs unchanged. That distinction is the whole topic, and it is what makes this
 * page a prerequisite rather than a detour - a register with a load enable is a mux in front of a
 * flop, and an ALU is a mux in front of everything.
 *
 * THE DESIGN IS THE TERNARY, `sel ? b : a`, and it is chosen because the synthesizer has a mux2
 * PRIMITIVE: measured, that one line comes out as exactly one `mux2_gate` cell with scalar pins, so
 * the netlist is one symbol and the layout is one rectangle. Writing it as `(a & ~sel) | (b & sel)`
 * would say the same thing and synthesize to four gates, which is a fact this page uses - as the
 * comparison in the silicon section rather than as the design.
 *
 * NEITHER PLACEMENT FOLLOWS THE DESIGN, and `from: 'synthesis'` was tried first: it falls back to the
 * design when nothing has been synthesized yet, and a design that is one `assign` has NO cells - so
 * the figure came out empty at load, which is the bordered-empty-box failure this repo keeps
 * designing against. (The harness caught it as `the drawer reports [NaN, NaN, ...]`.) So both figures
 * carry their own netlist, and the prose turns that into the point: the design has no cells until
 * something chooses them, and these are the two things it could be chosen as.
 *
 * TWO PLACEMENTS, and the second is the argument: one `mux2_gate` is 41.6 um where the four gates
 * that do the same job are 93.6 - more than twice the width for the identical choice. That is the
 * half adder page's lesson at the smallest scale there is, and it is measured off the two figures
 * rather than asserted.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['mux-2to1'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="choose">A circuit that chooses</h2>
<p>Every circuit on this site so far works something out. An adder takes two numbers and produces
their sum; a gate takes two bits and produces a third. None of them ever hands back one of its inputs
untouched - and that is the one thing a computer does more than any other.</p>
<p>A <b>multiplexer</b> - a <b>mux</b> - is the circuit for it. Two data inputs, one control input,
and the output is <em>whichever data input the control names</em>. Nothing is computed at all:</p>
<div class="learn-note">
  <b>sel = 0</b> and the output is <code>a</code>. &nbsp; <b>sel = 1</b> and the output is
  <code>b</code>. That is the entire specification, and it is why a mux is drawn as a funnel rather
  than as a gate.
</div>
<p>The third input is what makes this a new kind of thing. <code>a</code> and <code>b</code> are
<b>data</b> - whatever the design happens to be carrying - and <code>sel</code> is a
<b>control</b>: it does not join in the answer, it decides where the answer comes from. Almost
everything built out of these two ideas has that split in it somewhere.</p>
` },

    { figure: 'mux-symbol' },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>One line, and it is a question mark:</p>
<pre class="learn-code">assign y = sel ? b : a;</pre>
<p>Read it as "if <code>sel</code> then <code>b</code> otherwise <code>a</code>". The
<code>?:</code> is called the <b>conditional</b> or <b>ternary</b> operator, and in hardware it is
not a branch that runs - both values are sitting on their wires the whole time, and the circuit
simply passes one of them on. Nothing waits, nothing is skipped, and there is no clock anywhere on
this page.</p>
<p>Press <b>Run Simulation</b>. Three inputs is eight combinations, and every one of them is driven
in turn - which is what fills in the table below.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2>Reading it as a table</h2>
<p>Eight rows, read out of the run itself. Read them in two halves rather than top to bottom: in the
four rows where <code>sel</code> is 0, <code>y</code> is a copy of the <code>a</code> column and
takes no notice of <code>b</code>; in the four where it is 1, the opposite. A mux has no truth table
of its own in the way a gate does - it has two, and the control says which one you are reading.</p>
` },

    { slot: 'truth-table' },

    { html: String.raw`
<h2>...and as a waveform</h2>
<p>The same run against time, and <code>y</code> is the row to watch: it follows <code>a</code> for
the first half of the sweep and <code>b</code> for the second, changing the instant an input does
because there is nothing here that remembers. The <b>1-Bit Half Adder</b>'s outputs moved on every
step; this one has stretches where an input moves and the output does not care at all.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="inside">What is inside one</h2>
<p>A mux is not a primitive of nature - it is gates, like everything else. Four of them, and the
shape of the answer is in the sentence "either a, if sel is 0, or b, if sel is 1" - which written as
logic is <code>y = (a &amp; ~sel) | (b &amp; sel)</code>.</p>
<p>An inverter to make <code>~sel</code>, an AND for each data input to hold it back unless its own
condition is met, and an OR to accept whichever one got through. Exactly one of the two ANDs can be
1 at a time, which is what makes the OR safe: there is never a case where both arrive.</p>
` },

    { figure: 'mux-gates' },

    { html: String.raw`
<p>That line and the one in the editor describe the same circuit, and you can check it: paste it over
the design and every row of the table stays where it is. What changes is what the tool does with
it - which is the next section, and the reason this page has two figures at the bottom.</p>
` },

    { html: String.raw`
<h2 data-sec="netlist">What it becomes as gates</h2>
<p>Press <b>Synthesize</b>. The netlist is <b>one cell</b> - a <code>mux2_gate</code> - because this
synthesizer has a multiplexer among its primitives, so the question mark maps straight onto one. The
viewer draws it as the funnel symbol above with its three pins wired to the design's own ports.</p>
<p>Synthesize the four-gate version instead and you get four cells: an inverter, two ANDs and an OR.
Both are correct, both compute the same eight rows, and the tool picked neither - the source did. A
library that had no mux would have to build one, and a design written as a ternary can always be
turned into gates; what it cannot do is un-choose.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>One cell, and it is the smallest thing this site has drawn on a wafer: <b>41.6 &micro;m</b> wide,
in the same <b>46.8 &micro;m</b> row height as every other cell in the library, because a library has
one row height and everything in it is built to fit.</p>
` },

    { layout: 'the-cell' },

    { html: String.raw`
<p>Now the same choice as the four gates it can be built from:</p>
` },

    { layout: 'the-gates' },

    { html: String.raw`
<p><b>93.6 &micro;m against 41.6</b> - more than twice the width for the identical eight rows. The
cell wins for the reason the half adder's <code>ha_gate</code> won on its own page: the wires between
the four gates are inside it, and its transistors were drawn for this one job rather than for four
jobs that happen to be next to each other. A mux is such a common thing to want that a library keeps
one ready.</p>
<p>Both figures are drawn from netlists written out for them, and on this page that is not a
limitation but the subject: the design is one <code>assign</code>, so it has no cells of its own at
all until something chooses them. These two are the two things it could be chosen as. Press
<b>Synthesize</b> above and the Console names the one the tool actually picked.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>A mux is a part rather than a destination, and two pages are built out of it.
<a href="learn-register-4bit.html">4-Bit Register</a> puts one in front of a flip-flop, which is how
a memory decides whether to keep what it has or take something new. <a href="learn-alu-4bit.html">4-Bit
ALU</a> puts one in front of an adder and a row of gates, which is how one block does arithmetic on
Monday and logic on Tuesday. And <a href="learn-logic-gates.html">Logic Gates</a> goes the other way,
into the mask layers a cell like this is drawn as.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Five questions on choosing, and on what a choice costs. A wrong answer says so and links back to
the section it came from; the score at the foot of the panel is what the Learn hub shows beside this
topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* Two figures: the symbol, and the gates inside it.

     THE SYMBOL'S PINS ARE 15.5px APART and a port box is 32px tall, so the three inputs cannot line
     up with them - a mux2 is 36 x 42 in the viewer's pixel space (a 55 x 65 viewBox at 0.65 a unit)
     with sel at 13%, a at 50% and b at 87% of its height. The ports are therefore spaced 56px, which
     is the closest the harness's 22px caption band allows, and the router bends each wire into its
     pin. That is the honest way round: the alternative is a symbol drawn bigger than the netlist
     viewer draws it, and then this figure and the netlist card would disagree.

     The gate figure is the four cells the other form synthesizes to, in the columns the signal flows
     through: the inverter first, both ANDs beside each other, the OR last. */
  figures: {
    'mux-symbol': {
      caption: 'A 2:1 multiplexer: two data inputs, one control, and the output is one of them.',
      nodes: [
        { id: 'sel', kind: 'in', label: 'sel', x: 0, y: 0 },
        { id: 'a', kind: 'in', label: 'a', x: 0, y: 56 },
        { id: 'b', kind: 'in', label: 'b', x: 0, y: 112 },
        { id: 'mx', kind: 'mux2', label: 'mux2', x: 170, y: 41 },
        { id: 'y', kind: 'out', label: 'y', x: 290, y: 46 }
      ],
      edges: [
        ['sel', 'mx', 'sel'], ['a', 'mx', 'a'], ['b', 'mx', 'b'],
        ['mx', 'y', 'y', 'y']
      ]
    },
    'mux-gates': {
      caption: 'The same choice out of four gates: an inverter, an AND each, and an OR.',
      nodes: [
        { id: 'sel2', kind: 'in', label: 'sel', x: 0, y: 0 },
        { id: 'a2', kind: 'in', label: 'a', x: 0, y: 62 },
        { id: 'b2', kind: 'in', label: 'b', x: 0, y: 200 },
        { id: 'nv', kind: 'not', label: 'not', x: 140, y: 60 },
        { id: 'n1', kind: 'and', label: 'and', x: 250, y: 8 },
        { id: 'n2', kind: 'and', label: 'and', x: 250, y: 170 },
        { id: 'o1', kind: 'or', label: 'or', x: 360, y: 89 },
        { id: 'y2', kind: 'out', label: 'y', x: 470, y: 99 }
      ],
      edges: [
        ['sel2', 'nv', 'a'], ['a2', 'n1', 'a'], ['nv', 'n1', 'b'],
        ['b2', 'n2', 'a'], ['sel2', 'n2', 'b'],
        ['n1', 'o1', 'a'], ['n2', 'o1', 'b'], ['o1', 'y2', 'y']
      ]
    }
  },

  /* Three inputs, so the sweep is eight steps and the table eight rows. `sel` is named FIRST, which
     is what puts the four rows it selects `a` in at the top of the table rather than interleaved -
     the sweep counts up in binary over the list in order, so the first column is the one that moves
     slowest, and the prose asks the reader to read the table in two halves. */
  truthTable: {
    inputs: ['sel', 'a', 'b'],
    outputs: ['y'],
    step: 10,
    sampleAt: 5
  },

  /* One question per marked section. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'choose',
          q: 'What makes <code>sel</code> a different kind of input from <code>a</code> and <code>b</code>?',
          options: [
            'It does not join in the answer - it decides which input the answer comes from',
            'It is the only one that has to be a single bit',
            'It arrives first, so the circuit knows what to do before the data shows up'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'In <code>y = sel ? b : a</code>, what is happening to the value that is not chosen?',
          options: [
            'Nothing - it sits on its wire, and the circuit passes the other one on',
            'It is skipped, the way an unrun branch is skipped in software',
            'It is set to 0 until sel picks it'
          ],
          answer: 0
        },
        {
          sec: 'inside',
          q: 'Why is the OR at the end safe, when both ANDs feed into it?',
          options: [
            'Exactly one AND can be 1 at a time, because they test opposite values of sel',
            'The OR takes whichever input arrives first',
            'The inverter delays one of them, so they never arrive together'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'The ternary synthesizes to one cell, and the four-gate version to four. Which is right?',
          options: [
            'Both - they compute the same eight rows, and the source decided which cells to ask for',
            'The one-cell version, because a mux is a primitive and gates are not',
            'The four-gate version, because a real library has no mux in it'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'Why is one mux2_gate narrower than the four gates that do the same job?',
          options: [
            'Its wires are inside it, and its transistors were drawn for this one job',
            'It uses fewer transistors, because choosing is simpler than computing',
            'It is drawn on a finer process than the gate cells are'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. One continuous assignment, and the ports are SCALARS - which is what lets the
     placement below follow the synthesis rather than carry a netlist of its own. */
  verilog: String.raw`/* A 2:1 multiplexer: one bit of control choosing between two bits of data.
 *
 * Nothing is computed here. Both data inputs are on their wires the whole
 * time and sel decides which one reaches y, so the answer is always a copy
 * of an input rather than a function of all of them.
 *
 * ?: is the conditional operator - "if sel then b else a" - and in hardware
 * it is a multiplexer, which is why this one line becomes one cell.
 */
module dut(
  input  a,
  input  b,
  input  sel,
  output y
);

  assign y = sel ? b : a;

endmodule
`,

  /* The hidden testbench: the wrapper only. The line reading SWEEP is replaced by learn.js with a
     stimulus generated from truthTable.inputs, so the eight rows and the eight steps are one
     declaration - counting up in binary, which is the order the table reads them back in. */
  testbench: String.raw`module tb;

  reg  a, b, sel;
  wire y;

  dut u_dut (.a(a), .b(b), .sel(sel), .y(y));

  initial begin
    // SWEEP
  end

endmodule
`,

  /* PLACEMENTS. The first, `from: 'synthesis'`, is the reader's own design as one cell - possible
     here and on no wider topic, because these ports are single bits and pnr's netlist parser takes
     no bit-selects. The second writes its own netlist, being a picture of the form the design does
     NOT use: the four gates the other spelling synthesizes to, at 93.6 um against 41.6.

     Neither carries `crossSection` or `animate`: `logic-gates` teaches the process and the adder
     pages already made the area argument; what this page adds is the same argument at the smallest
     scale there is. `rowPx: 200` is one row, comfortably under what the column allows at these
     aspects, so both figures grow into their boxes. */
  layouts: {
    'the-cell': {
      caption: 'One mux2_gate - the cell this design becomes.',
      view: 'all',
      rowPx: 200,
      netlist: String.raw`module one_cell(
  input  a,
  input  b,
  input  sel,
  output y
);

  mux2_gate u_mux (.a(a), .b(b), .sel(sel), .y(y));

endmodule
`
    },
    'the-gates': {
      caption: 'The four-gate version of the same choice, for comparison.',
      view: 'all',
      rowPx: 200,
      netlist: String.raw`module four_gates(
  input  a,
  input  b,
  input  sel,
  output y
);

  not_gate u_not (.a(sel),  .y(nsel));
  and_gate u_an0 (.a(a),    .b(nsel), .y(t0));
  and_gate u_an1 (.a(b),    .b(sel),  .y(t1));
  or_gate  u_or0 (.a(t0),   .b(t1),   .y(y));

endmodule
`
    }
  }
};
