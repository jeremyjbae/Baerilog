/* Topic content for the 'ripple-carry-4bit' learn page - the fifth topic, and the first about
 * COMPOSITION: every page before it built one circuit out of gates, and this one builds a wider
 * circuit out of four copies of the last page's.
 *
 * THE DESIGN IS STRUCTURAL, and that is the point rather than a style choice. `full-adder-1bit`
 * writes two expressions and lets the synthesizer choose the gates; here the four columns are
 * written out as four instantiations of that very module, because what the reader has to see is
 * that a 4-bit adder contains no new idea - it is the same block, four times, with one wire
 * between each pair. `assign sum = a + b` would say the same thing to a simulator and hide
 * exactly the thing this page is about (and, measured, comes out of this synthesizer as a
 * generated sub-module: one box, nothing to read).
 *
 * SO THE NETLIST IS A HIERARCHY, which no earlier topic's is: the top level synthesizes to four
 * `full_adder` blocks and the constant feeding column 0, and the six gates are one level down
 * inside each block, reached by double-clicking it. The page says so, because a reader who
 * expected twenty-four gate symbols would otherwise read four boxes as a failure.
 *
 * NO TRUTH TABLE CARD, and this is the one place a topic in this category cannot have one. The
 * truth table is generated from `truthTable.inputs` and covers the whole input space - which is
 * what makes it the design's own behaviour rather than a claim about it - and this design has
 * EIGHT inputs, so that space is 256 rows. A card claiming to be exhaustive at 256 rows is not
 * something anyone reads, and one showing a chosen handful would be the hand-written sweep the
 * generator exists to replace. So the interesting cases are driven by a testbench written out
 * here, the WAVEFORM is where the run is read, and the worked table in the prose is prose - four
 * rows the reader can check by hand, not a rendering of the run.
 *
 * ONE LAYOUT FIGURE, AND IT CANNOT FOLLOW THE DESIGN - which is the difference from the two adder
 * topics, where it does. A placement reads a netlist, and this design is unreadable to the placer
 * twice over: its cells are `full_adder`, a module with a body rather than a cell with artwork, and
 * every connection is a bit-select, which pnr's netlist parser does not take. So the figure carries
 * its own netlist with one net per bit, the prose says so in as many words, and the silicon story
 * this page tells is about ROWS and about where the carry goes - see the note above `layouts`.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['ripple-carry-4bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="paper">Adding one column is not adding numbers</h2>
<p>The <a href="learn-full-adder-1bit.html">1-Bit Full Adder</a> adds three bits - <code>a</code>,
<code>b</code> and a carry in - and says the answer in two: a <b>sum</b> for this column and a
<b>carry out</b> for the next one. That is a whole column of arithmetic, and it is also the most it
can ever do: three bits add to at most 3, so on its own the largest sum it can reach is
<code>11</code>.</p>
<p>Adding numbers is what you already do on paper. Stack them up, add the rightmost column, and if
the answer does not fit in one digit, write the digit you have and <b>carry</b> the rest into the
column on the left. Then add that column, <em>plus the carry</em>, and keep going until you run out
of columns.</p>
<div class="learn-note">
  <b>Every column needs three things:</b> its own two bits, and the carry the column to its right
  produced. That is exactly the full adder's three inputs - which is why one per column is all this
  takes.
</div>
` },

    { html: String.raw`
<h2 data-sec="ripple">Four adders in a row</h2>
<p>So put one full adder under each column and wire them together: <b>the carry out of each one
becomes the carry in of the next</b>. Column 0 has no column to its right, so there is nothing to
accept - its carry in is tied to <b>0</b>, which is the same statement the half adder made by not
having one at all.</p>
<p>The carry travels from the lowest column to the highest, one block at a time, like a wave running
down the line - so this arrangement is called a <b>ripple-carry adder</b>. Four blocks add four-bit
numbers; eight blocks add eight-bit numbers; sixty-four of them is the adder in the machine you are
reading this on. Nothing about the block changes, only how many of them there are.</p>
<p>The diagram is drawn as a <b>staircase, bit 0 at the bottom left</b>, and the block's own pins are
what put it that way: the two operand bits arrive on the left, the carry in arrives
<em>underneath</em>, and of the two outputs on the right the carry out is the upper one and the sum
the lower. So a carry leaves the top of one block and climbs into the bottom of the next - up and to
the right, one step per column, which is the ripple. The <code>1'b0</code> is at the bottom, under
the column that has nothing to its right, and <code>cout</code> leaves at the top. On paper the same
chain is one row read right to left.</p>
` },

    { figure: 'ripple-carry' },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>Four lines, one per column, and every one of them names the <em>same module</em>. This is the
first design on the site that is written as a wiring diagram rather than as logic: there is no
<code>assign</code> anywhere in it, because every gate it needs is already inside the block it
instantiates.</p>

<h3>1. The carries between the columns</h3>
<pre class="learn-code">wire [2:0] c;</pre>
<p>Three wires for four columns, which is the arithmetic of a chain: the carry out of the last column
is not an internal wire at all - it leaves the design as <code>cout</code>, and it is the reason the
next section exists.</p>

<h3>2. One block per column</h3>
<pre class="learn-code">full_adder u_fa0 (.a(a[0]), .b(b[0]), .cin(1'b0), .sum(sum[0]), .cout(c[0]));
full_adder u_fa1 (.a(a[1]), .b(b[1]), .cin(c[0]), .sum(sum[1]), .cout(c[1]));</pre>
<p>Read the <code>.cin</code> and <code>.cout</code> connections down the four lines and the chain is
right there in the text: <code>1'b0</code>, then <code>c[0]</code>, <code>c[1]</code>,
<code>c[2]</code> - each column reading the wire the one above it drove. Everything else is
bit-by-bit: column 1 gets <code>a[1]</code> and <code>b[1]</code> and drives
<code>sum[1]</code>.</p>
<p>Press <b>Run Simulation</b>. The testbench drives six pairs of numbers through it - including two
that do not fit - and the waveform below is what came out.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2>...and as a waveform</h2>
<p>Something new in this plot: <code>a</code>, <code>b</code> and <code>sum</code> are <b>four bits
wide</b>, so the viewer draws them as labelled value boxes rather than as the high-and-low step lines
of the pages before this. <code>cout</code> is still one bit, so it is still a step line. A box is
how a bus is drawn everywhere on this site - press the <b>[:]</b> button above the plot and each name
says how wide it is.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="overflow">When the answer does not fit</h2>
<p>Four bits hold 0 to 15. Ask for more than that and the sum has nowhere to put the top of the
answer - except that it does: <code>cout</code> <em>is</em> the top of the answer, worth <b>16</b>,
and it is the same carry every other column produced.</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">a</th><th class="in">b</th><th class="sep"></th>
          <th>sum</th><th>cout</th><th>in decimal</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">0011</td><td class="in">0001</td><td class="sep"></td>
          <td>0100</td><td class="zero">0</td><td>3 + 1 = 4</td></tr>
      <tr><td class="in">0111</td><td class="in">0001</td><td class="sep"></td>
          <td>1000</td><td class="zero">0</td><td>7 + 1 = 8, carried three columns</td></tr>
      <tr><td class="in">1111</td><td class="in">0010</td><td class="sep"></td>
          <td>0001</td><td class="one">1</td><td>15 + 2 = 17, which is 16 + 1</td></tr>
      <tr><td class="in">1111</td><td class="in">1111</td><td class="sep"></td>
          <td>1110</td><td class="one">1</td><td>15 + 15 = 30, which is 16 + 14</td></tr>
    </tbody>
  </table>
</div>
<p>Read the last two rows with <code>cout</code> as a fifth bit and the adder is not wrong at all -
<code>1 0001</code> is 17 and <code>1 1110</code> is 30. Read them as four bits and 15 + 2 comes out
as 1, which is what a program sees when it <b>overflows</b>: the answer wrapped, and the bit that
would have said so was thrown away. Nothing in the hardware went wrong; the number was asked to be
wider than the wires it was given.</p>
<p>Which is also how a wider adder is built. Take <code>cout</code> and hand it to a fifth block as
its carry in, and 17 fits.</p>
` },

    { html: String.raw`
<h2 data-sec="netlist">What it becomes as gates</h2>
<p>Press <b>Synthesize</b>, and the diagram is <b>four blocks and a constant</b> - not a field of
gates. That is the difference between this page and the ones before it: the top level of this design
has no logic of its own to infer, so what comes back is the chain as written, with the tied-off
<code>1'b0</code> drawn as the constant it is.</p>
<p><b>Double-click a block</b> to go inside it. There is the full adder from the last topic, gate for
gate - three XORs, two ANDs and an OR - and the breadcrumb above the diagram is how you get back
out. Four blocks of six cells is <b>24 gates</b> for a four-bit add, and the listing above the
diagram is the whole of it: <code>dut</code> wiring four <code>full_adder</code>s, then
<code>full_adder</code> itself in cells, then the cells' own one-line definitions.</p>
<p>This is what hierarchy buys, and it is the reason real designs are built this way: the reader -
and the tool - looks at four blocks or at six gates, and never at twenty-four things at once.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>Four columns, each one the full adder from the last topic - and as CELLS that is
<b>two half adders and an OR</b> apiece, which is what the library has artwork for. So the chain is
<b>twelve cells</b>, and here they are on the wafer in the order they carry:</p>
` },

    { layout: 'the-chain' },

    { html: String.raw`
<p>The carry is the short hop between neighbours. That is the whole reason they sit in this order:
a cell's carry out is the next cell's carry in, so putting them side by side makes that wire as short
as it can be - and a wire that has to cross the chip is slower than one that does not. The row is
<b>301.6 &micro;m</b> long and <b>93.6 &micro;m</b> tall, which is two rows of cells rather than one:
twelve cells in a line would be too long and thin to look at, so the placer wrapped it. Rows of cells
abutted end to end, stacked, is what a chip's floorplan is made of - and the second row is
<b>upside down</b> on purpose: every cell carries its supply rail along the top edge and its ground
rail along the bottom, so mirroring alternate rows is what lets two of them touch without shorting
the two together. The <a href="learn-adder-8bit.html">8-Bit Adder</a> has four rows and says more
about it.</p>
<p>Fifteen wires cross it, and three of them are the carries: those are the ones that leave one column
and arrive at the next, so the ripple this page is named after is now something you can trace on the
wafer rather than only in the diagram.</p>
<p>One thing to know about this figure: it is <b>drawn from a netlist written out for it</b>, not from
the design in the editor. The placer here reads plain nets, where the design above is written in
vectors - <code>a[0]</code>, <code>c[1]</code> - so this is the same circuit with one wire per bit
rather than a rendering of what you typed. Edit the design and the figure will not follow; the two
adder topics before this one are the pages where it does.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>An adder is the first thing on this site that is a <em>component</em> rather than a circuit, and
almost everything else is built the same way. <a href="learn-adder-8bit.html">8-Bit Adder with One
Line of Code</a> is what happens when you stop writing the chain out and let the tool build it, and
<a href="learn-logic-gates.html">Logic Gates</a> goes the other direction - down from one of the cells
above to the mask layers on the wafer and a cross section through its transistors.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Seven questions on chaining, carrying, what happens when the answer will not fit, and what all
of it costs. A wrong answer
says so and links back to the section it came from; the score at the foot of the panel is what the
Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* The chain, drawn by the netlist viewer's own node and wire code (see learn.js's note above
     figureGraph) - so a full adder here is the ADDER SYMBOL the viewer draws for one, with its five
     pins in the places the viewer puts them, and the picture is in the same language as the netlist
     the page produces further down.

     A STAIRCASE CLIMBING TO THE RIGHT, bit 0 at the bottom left, because that is what the symbol's
     own pins ask for: the carry in arrives UNDERNEATH and the carry out leaves at the TOP right, so
     a carry belongs to the block above and to the right of the one that produced it. Two earlier
     arrangements were wrong in ways worth recording, since both look reasonable written down:

     A SINGLE COLUMN RUNNING DOWN, which is what this was first, puts the tied-off carry in at the
     TOP - so the constant enters the block the chain should end at, and every carry wire runs down a
     lane to the right of the whole diagram and doubles back under the next block. It is consistent
     and it reads backwards.

     A SINGLE COLUMN RUNNING UP cannot be drawn at all with this router, and that is arithmetic
     rather than taste. edgePoints takes the FORWARD branch only when the target is 30px or more to
     the right; cin sits 39px LEFT of the right edge the wire leaves, so within one column every
     carry is a backward wire, and a backward wire dips 34px below the LOWER of its two ends. Going
     up, the lower end is the source's own cout, so the dip lands inside the source block and the
     wire is drawn across it - whatever the pitch.

     Stepping 90px right per stage is what makes the carry forward instead: the next cin is 135.8px
     right of the cout it comes from, comfortably over the 30 the router asks for, so each carry is a
     short hook up and to the right with nothing doubling back. The 130px rise is set by the caption
     band - the harness rejects boxes closer than 22px, and the tightest pair is a stage's own adder
     against the b port of the stage above it, which clears by 29.5px at 130 and collides at 120.

     The pin offsets: an adder is 124px tall (a 95-unit viewBox at 1.3px a unit) with a at 15/95 of
     it, b at 65/95, cout at 30/95 and sum at 50/95 - absolute in viewBox units, so 19.5, 84.5, 39
     and 65px whatever the canvas height is. A port is 32px tall with its pin at the middle, so a
     port sits at pin - 16. cin is the exception, being on the bottom edge: a wire into it is routed
     to 22px BELOW the pin and then straight up, so the constant is placed level with THAT point
     rather than with the pin - 536, not 514 - which is what makes its wire one straight run and a
     turn up the stub instead of an S-bend to reach the leader. */
  figures: {
    'ripple-carry': {
      caption: 'A 4-bit ripple-carry adder: four full adders, each carry out climbing into the next carry in.',
      nodes: [
        { id: 'a3', kind: 'in', label: 'a[3]', x: 360, y: 3.5 },
        { id: 'b3', kind: 'in', label: 'b[3]', x: 360, y: 68.5 },
        { id: 'fa3', kind: 'add', label: 'u_fa3', x: 500, y: 0 },
        { id: 's3', kind: 'out', label: 'sum[3]', x: 620, y: 49 },
        { id: 'cout', kind: 'out', label: 'cout', x: 740, y: 23 },

        { id: 'a2', kind: 'in', label: 'a[2]', x: 270, y: 133.5 },
        { id: 'b2', kind: 'in', label: 'b[2]', x: 270, y: 198.5 },
        { id: 'fa2', kind: 'add', label: 'u_fa2', x: 410, y: 130 },
        { id: 's2', kind: 'out', label: 'sum[2]', x: 530, y: 179 },

        { id: 'a1', kind: 'in', label: 'a[1]', x: 180, y: 263.5 },
        { id: 'b1', kind: 'in', label: 'b[1]', x: 180, y: 328.5 },
        { id: 'fa1', kind: 'add', label: 'u_fa1', x: 320, y: 260 },
        { id: 's1', kind: 'out', label: 'sum[1]', x: 440, y: 309 },

        { id: 'a0', kind: 'in', label: 'a[0]', x: 90, y: 393.5 },
        { id: 'b0', kind: 'in', label: 'b[0]', x: 90, y: 458.5 },
        { id: 'fa0', kind: 'add', label: 'u_fa0', x: 230, y: 390 },
        { id: 's0', kind: 'out', label: 'sum[0]', x: 350, y: 439 },
        { id: 'k0', kind: 'const', label: "1'b0", x: 0, y: 522 }
      ],
      /* [source, target, target pin, source pin] - so a wire into an adder names `a`, `b` or `cin`,
         and one out of it names `sum` or `cout` in the fourth slot. A port's own single pin is `y`
         whichever direction it faces, which is why the wires into the sum ports say `'y', 'sum'`. */
      edges: [
        ['k0', 'fa0', 'cin'],
        ['a0', 'fa0', 'a'], ['b0', 'fa0', 'b'], ['fa0', 's0', 'y', 'sum'],
        ['a1', 'fa1', 'a'], ['b1', 'fa1', 'b'], ['fa1', 's1', 'y', 'sum'],
        ['a2', 'fa2', 'a'], ['b2', 'fa2', 'b'], ['fa2', 's2', 'y', 'sum'],
        ['a3', 'fa3', 'a'], ['b3', 'fa3', 'b'], ['fa3', 's3', 'y', 'sum'],
        ['fa0', 'fa1', 'cin', 'cout'],
        ['fa1', 'fa2', 'cin', 'cout'],
        ['fa2', 'fa3', 'cin', 'cout'],
        ['fa3', 'cout', 'y', 'cout']
      ]
    }
  },

  /* THE PLACEMENT, and it is a netlist WRITTEN OUT rather than the design's own - which is the one
     way this page differs from the two adder topics before it. pnr's netlist parser takes plain nets
     and no bit-selects, and this design is vectored throughout (`.a(a[0])`), so neither
     `from: 'design'` nor `from: 'synthesis'` can be placed here at all: the first fails to parse and
     the second names `full_adder`, which is a module with a body rather than a cell with artwork. So
     the figure is four `fa_gate`s with one net per bit, and the prose says so - a figure that cannot
     follow the editor must not look as though it does.

     `fa_gate` has no artwork either, and that is the point rather than a problem: pnr expands each
     one into two `ha_gate`s and an `or_gate`, so twelve cells is what four columns really are. The
     full adder topic introduces that expansion; this page inherits it.

     `rowWidth: 500` WRAPS, in lambda, and no other topic's figure does. Twelve cells in a line are
     603 um at 13:1, which is too thin to read in a column; wrapped they are 301.6 x 93.6 at 3.2:1,
     two columns to a row. `rowPx: 150` is under the ~168px the column allows at that aspect, so the
     figure grows into its box rather than being refused for shrinking below its own floor. 
     `rowPx` IS PER ROW, so a wrapped figure's own height is rows x rowPx: 80 makes this 160px for
     two rows, against the ~168 the column allows at 3.2:1. A single-row figure can afford 150 or 220
     (the adder topics do); a wrapped one cannot, and 150 here asked for 300px in a box that could
     give 168 - which `fitLayout` refuses, since it will not shrink a figure below its own floor. */
  layouts: {
    'the-chain': {
      caption: 'The four columns as cells: two half adders and an OR each, wrapped into two rows.',
      view: 'all',
      rowWidth: 500,
      rowPx: 80,
      netlist: String.raw`module chain(
  input  a0, b0, a1, b1, a2, b2, a3, b3,
  output s0, s1, s2, s3,
  output cout
);

  fa_gate f0 (.a(a0), .b(b0), .cin(zero), .sum(s0), .cout(c1));
  fa_gate f1 (.a(a1), .b(b1), .cin(c1),   .sum(s1), .cout(c2));
  fa_gate f2 (.a(a2), .b(b2), .cin(c2),   .sum(s2), .cout(c3));
  fa_gate f3 (.a(a3), .b(b3), .cin(c3),   .sum(s3), .cout(cout));

endmodule
`
    }
  },

  /* Six cases at 10 time units each, so the run is 60 - stated here because there is no
     `truthTable` for it to be derived from, which is the one thing this topic gives up by having
     eight inputs (see the note at the top of the file). */
  maxTime: 60,

  /* One question per marked section, and `sec` is what ties each to the heading it came from: a
     wrong answer links back to that section, with the heading's own words as the link. `ripple` is
     asked twice, being the section the page is named after - how the chain works, and what changes
     when the numbers get wider. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'paper',
          q: 'A single full adder tops out at 1 + 1 + 1. How do you add four-bit numbers with it?',
          options: [
            'Use one per column, and pass each carry out into the next column',
            'Build a bigger full adder with eight inputs instead of three',
            'Run the same adder four times and add up the sums afterwards'
          ],
          answer: 0
        },
        {
          sec: 'ripple',
          q: 'Why is this arrangement called a <em>ripple</em>-carry adder?',
          options: [
            'Because the carry has to travel along the chain, one block at a time',
            'Because the sum bits arrive in a ripple, one per clock cycle',
            'Because the blocks are wired in a ring rather than a line'
          ],
          answer: 0
        },
        {
          sec: 'ripple',
          q: 'How many full adders does it take to add two eight-bit numbers this way?',
          options: ['2', '4', '8', '16'],
          answer: 2
        },
        {
          sec: 'verilog',
          q: 'What does <code>.cin(1&#39;b0)</code> on the first block say?',
          options: [
            'Column 0 has no column to its right, so there is no carry to accept',
            'The adder starts at zero and counts up from there',
            'Column 0 is disabled until the other three have finished'
          ],
          answer: 0
        },
        {
          sec: 'overflow',
          q: 'In this four-bit adder, what comes out of 15 + 2?',
          options: [
            'sum = 0001 and cout = 1, which read together is 17',
            'sum = 1111, because 15 is as high as it goes',
            'sum = 0001 and cout = 0, so the answer is simply wrong'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'On the wafer, where is the carry that ripples?',
          options: [
            'A wire between neighbouring cells - which is why they are placed in carry order',
            'A wire that leaves the row and comes back at the far end of the chip',
            'Nowhere: the carry is inside the cells, so it costs no wire at all'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'Press Synthesize. Why are there four blocks in the diagram rather than 24 gates?',
          options: [
            'The gates are one level down inside each block - double-click one to see them',
            'The synthesizer merged the gates into four larger cells to save area',
            'Four is all this design needs; a block is a single gate with five pins'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. Structural, and narrowed to this one module in the editor: `library` below carries
     the block it instantiates, so Run compiles both and the synthesizer resolves the instances,
     while the reader sees only the chain. */
  verilog: String.raw`/* A 4-bit ripple-carry adder.
 *
 * Four copies of the full adder from the last topic, one per column, with each
 * one's carry out wired into the next one's carry in. Column 0 has nothing to
 * its right, so its carry in is tied to zero.
 *
 * cout is the fifth bit of the answer: 15 + 2 comes out as sum = 0001 with
 * cout = 1, which read together is 17.
 */
module dut(
  input  [3:0] a,
  input  [3:0] b,
  output [3:0] sum,
  output       cout
);

  // the three carries between the four columns
  wire [2:0] c;

  full_adder u_fa0 (.a(a[0]), .b(b[0]), .cin(1'b0), .sum(sum[0]), .cout(c[0]));
  full_adder u_fa1 (.a(a[1]), .b(b[1]), .cin(c[0]), .sum(sum[1]), .cout(c[1]));
  full_adder u_fa2 (.a(a[2]), .b(b[2]), .cin(c[1]), .sum(sum[2]), .cout(c[2]));
  full_adder u_fa3 (.a(a[3]), .b(b[3]), .cin(c[2]), .sum(sum[3]), .cout(cout));

endmodule
`,

  /* THE BLOCK, byte for byte the design of `full-adder-1bit` - which is the page's whole claim, so
     it is worth keeping identical rather than merely equivalent: what the reader wrote there is what
     is instantiated here. */
  library: String.raw`module full_adder(
  input  a,
  input  b,
  input  cin,
  output sum,
  output cout
);

  assign sum  = a ^ b ^ cin;
  assign cout = (a & b) | (cin & (a ^ b));

endmodule
`,

  /* The hidden testbench. WRITTEN OUT rather than generated, because with eight inputs the generated
     sweep would be 256 steps - see the note at the top of the file. Six cases, chosen so that each
     one says something the prose claims: no carry at all, a carry into bit 1, a carry that runs the
     whole width, an ordinary mixed add, and the two that overflow. */
  testbench: String.raw`module tb;

  reg  [3:0] a, b;
  wire [3:0] sum;
  wire       cout;

  dut u_dut (.a(a), .b(b), .sum(sum), .cout(cout));

  initial begin
    a = 4'd0;  b = 4'd0;  #10; $display("%d + %d = %d, carry out %b", a, b, sum, cout);
    a = 4'd3;  b = 4'd1;  #10; $display("%d + %d = %d, carry out %b", a, b, sum, cout);
    a = 4'd7;  b = 4'd1;  #10; $display("%d + %d = %d, carry out %b", a, b, sum, cout);
    a = 4'd9;  b = 4'd5;  #10; $display("%d + %d = %d, carry out %b", a, b, sum, cout);
    a = 4'd15; b = 4'd2;  #10; $display("%d + %d = %d, carry out %b", a, b, sum, cout);
    a = 4'd15; b = 4'd15; #10; $display("%d + %d = %d, carry out %b", a, b, sum, cout);
    $finish;
  end

endmodule
`
};
