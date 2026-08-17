/* Topic content for the 'adder-8bit' learn page - the sixth topic, and the first about DESCRIBING
 * hardware rather than drawing it: every page before it named the gates or named the blocks, and
 * this one names neither.
 *
 * THE DESIGN IS BEHAVIOURAL, and it is the deliberate opposite of `ripple-carry-4bit`. That topic
 * writes four instantiations and every carry between them by name, because what it is about is that
 * a wide adder is one block repeated; this one writes `assign {cout, sum} = a + b + cin;` and lets
 * the synthesizer choose. So the pair reads as two ways of saying one thing, which is why this page
 * points back at that one twice - once for the chain it wired by hand, and once because the chain is
 * exactly what comes back out of the tool here.
 *
 * WHICH IS THE PAGE'S PAYOFF, and it is measured rather than promised. Synthesizing this one line on
 * the synthesizer this repo ships gives a top level of exactly ONE cell - a `FUNC_add8` instance -
 * whose body is EIGHT `fa_gate`s wired carry to carry, and each of those is five gates (two XORs, two
 * ANDs, an OR). So the reader double-clicks twice and arrives at the previous topic's design,
 * generated: forty gate cells, priced by the report at about 76 NAND-equivalents. Nothing on this
 * page has to claim the two descriptions agree - the netlist card is the tool saying so.
 *
 * THE CARRY IN IS A PORT HERE, and that is what keeps the two pages honest with each other. Writing
 * `a + b` alone would have been the shorter line, and it synthesizes to the same eight cells with the
 * block's carry in tied to a constant - so the netlist would have carried a `1'b0` the source never
 * mentioned, and a symbol with a pin the design has no name for. With `+ cin` in the line the block's
 * five ports are all the design's own, and the page gets the better fact besides: cout and cin are
 * what let two of these stack into a sixteen-bit adder, which is the same sentence the four-bit page
 * ends on.
 *
 * NO TRUTH TABLE CARD, for `ripple-carry-4bit`'s reason and more so: the card's rows are generated
 * from `truthTable.inputs` and cover the whole input space, and this design has SEVENTEEN inputs -
 * 131,072 rows. So the interesting cases are a testbench written out here, the WAVEFORM is where the
 * run is read, and the four-row table in the prose is prose. (The harness sweeps all 131,072
 * combinations against arithmetic done in JS, in batches, because the engine stops any single run at
 * 8,000 steps - which is the whole input space verified, just not on the page.)
 *
 * ONE LAYOUT FIGURE, AND IT CANNOT FOLLOW THE DESIGN. A placement reads a netlist, and this design
 * is a single `assign`: there is nothing to place until Synthesize has run, and what it produces then
 * is a GENERATED module with vector ports, which pnr's netlist parser does not take (no bit-selects,
 * plain nets only). So the figure carries its own netlist - eight `fa_gate`s with one net per bit -
 * and the prose says as much, because a figure that cannot follow the editor must not look as though
 * it does. What this page's silicon section is about instead is ROWS: twenty-four cells in a line are
 * 26:1 and unreadable, so the placer wraps them, and rows of abutted cells is what a floorplan is.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['adder-8bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="describe">Saying what it does, not what it is made of</h2>
<p>The <a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry Adder</a> is written as a wiring
diagram: four full adders, named one per line, with every carry between them declared and connected
by hand. Eight columns is eight of those lines and seven carry wires; thirty-two columns is
thirty-two and thirty-one. Nothing about it gets <em>harder</em> - it gets longer, and longer in the
one way that costs something, because a single mistyped index reads perfectly and adds the wrong
column.</p>
<p>So there is another way to write the same hardware: <b>say what the circuit does</b> and let the
tool work out what it is made of. That is what an <code>assign</code> with a <code>+</code> in it
says - not "put an adder here", but "this output is that sum" - and it is called a <b>behavioural</b>
description, against the <b>structural</b> one on the last page.</p>
<div class="learn-note">
  <b>Both describe the same circuit.</b> The gates do not appear because they were asked for by
  name; they appear because something has to compute a sum, and the tool knows what does. What
  changes between the two pages is <em>who writes the chain down</em>.
</div>
` },

    { html: String.raw`
<h2 data-sec="verilog">Eight bits, one line</h2>
<p>Here is the whole design, apart from its ports:</p>
<pre class="learn-code">assign {cout, sum} = a + b + cin;</pre>
<p>Three things in that line are worth pulling apart, and none of them is the <code>+</code>.</p>

<h3>1. The answer is nine bits wide</h3>
<p>Eight bits hold 0 to 255, so the most this can be asked for is 255 + 255 + 1, which is
<b>511</b> - and 511 is exactly what nine bits hold. <code>sum</code> is eight of them. The ninth is
<code>cout</code>, worth <b>256</b>: the same carry out every column of the last page's chain
produced, just the one that has no column left to go into.</p>

<h3>2. The braces are the target</h3>
<p><code>{cout, sum}</code> is a <b>concatenation</b> - one nine-bit thing made of two signals, with
<code>cout</code> the top bit and <code>sum</code> the low eight - and here it is on the
<em>left</em> of the assignment, which is what splits the answer between them. Drop the braces and
write <code>assign sum = a + b + cin;</code> and the addition is identical; what changes is that only
eight bits have anywhere to land, and <code>cout</code> has nothing driving it at all.</p>

<h3>3. The carry in is one more term</h3>
<p><code>cin</code> is a single bit added to the total like any other number, and writing it that way
is the whole of what the last page needed a wire and a port connection for. It is what makes this a
<b>full</b> adder eight bits wide rather than a half one - and it is the reason the design has
something to say about numbers wider than itself, below.</p>
<p>Drawn as a single symbol, that is the whole design - two buses and a carry in on one side, eight
bits and a carry out on the other:</p>
` },

    { figure: 'add8' },

    { html: String.raw`
<p>Every pin on that symbol is one of the design's own ports, which is worth noticing because the
four-bit page had nowhere to put the one underneath: its first column had no column to its right, so
it tied that pin to <b>0</b>. Here it is an input, and <code>cout</code> is an output, so
<b>two of these stack</b> - the low half's carry out into the high half's carry in - and that is a
sixteen-bit adder made of two lines instead of sixteen.</p>
<p>Press <b>Run Simulation</b>. The testbench drives six cases through it - three that fit in eight
bits and three that do not - and the waveform below is what came out.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2>Reading it as a waveform</h2>
<p><code>a</code>, <code>b</code> and <code>sum</code> are eight bits wide, so the viewer draws them
as labelled value boxes rather than as step lines - press <b>[:]</b> above the plot and each name says
how wide it is. <code>cin</code> and <code>cout</code> are one bit each, so they are still step lines,
and <code>cout</code> is the row worth following: it goes high on exactly the three steps where the
value in the <code>sum</code> box is <em>smaller</em> than the numbers that went in.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="width">Making it wider</h2>
<p>Two ways, and the line that does the adding survives both. Change <code>[7:0]</code> to
<code>[15:0]</code> in the three port declarations and this is a sixteen-bit adder - the assignment
<b>does not change at all</b>, not its length and not its text, where the structural form would need
sixteen instantiations and fifteen carry wires written out. Or leave it at eight and instantiate it
twice, carry out into carry in, which is the same trick the four-bit page plays with four one-bit
blocks. That is why arithmetic is normally described this way, and why the <code>+</code> in a
processor is one line of Verilog rather than sixty-four blocks.</p>
<p>What does change with width is where the answer stops fitting. Four cases from the run above:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">a</th><th class="in">b</th><th class="in">cin</th><th class="sep"></th>
          <th>sum</th><th>cout</th><th>read as nine bits</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">12</td><td class="in">5</td><td class="in">1</td><td class="sep"></td>
          <td>00010010</td><td class="zero">0</td><td>18, and eight bits is room to spare</td></tr>
      <tr><td class="in">200</td><td class="in">100</td><td class="in">0</td><td class="sep"></td>
          <td>00101100</td><td class="one">1</td><td>300, which is 256 + 44</td></tr>
      <tr><td class="in">255</td><td class="in">0</td><td class="in">1</td><td class="sep"></td>
          <td>00000000</td><td class="one">1</td><td>256, and every sum bit rolled over</td></tr>
      <tr><td class="in">255</td><td class="in">255</td><td class="in">1</td><td class="sep"></td>
          <td>11111111</td><td class="one">1</td><td>511, the widest this adder can say</td></tr>
    </tbody>
  </table>
</div>
<p>Read <code>cout</code> as the top bit and not one of those rows is wrong. Read <code>sum</code>
alone and 255 + 1 comes out as 0, which is what a program sees when a number <b>overflows</b>: the
answer wrapped, and the bit that would have said so was the one nobody kept. That is the same
sentence the four-bit page ends on, and it is the reason <code>{cout, sum}</code> is written with the
braces rather than without them.</p>
` },

    { html: String.raw`
<h2 data-sec="netlist">What the tool builds from it</h2>
<p>Press <b>Synthesize</b>. The top level is <b>one cell</b>: the adder the tool inferred, which it
names <code>FUNC_add8</code> because nobody else named it, with all five of its pins wired to the
design's own ports - <code>a</code>, <code>b</code> and <code>cin</code> in, <code>sum</code> and
<code>cout</code> out. That is the entire netlist at this level, and the one line above is all that
asked for it.</p>
<p><b>Double-click the block.</b> Inside it are <b>eight full adders in a row</b>, each carry out
wired into the next carry in, with <code>cin</code> arriving at the first of them - which is the
previous topic's design, four columns wider, written by the tool instead of by you. That is the claim
this page exists to make, and the diagram is the tool making it rather than the prose.</p>
<p><b>Double-click one of those</b> and there are its five gates: two XORs, two ANDs and an OR. So one
line of Verilog is eight cells at this level and <b>forty gates</b> at the bottom, and the report in
the Console prices the eight at about <b>76 NAND gates' worth of area</b>. The breadcrumb above the
diagram is how you get back out, and the listing above it is the whole design in text:
<code>dut</code> holding one <code>FUNC_add8</code>, then <code>FUNC_add8</code> wiring eight
<code>fa_gate</code>s, then <code>fa_gate</code> itself.</p>
<p>Nothing here is smaller than the design on the last page - it is the same hardware, and the same
count of it. What the one line bought is that none of the forty gates, and none of the seven carries
between the columns, had to be written down correctly.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>One line of Verilog, and this is the strip of wafer it comes to. Eight columns, one per bit - and
each column is the library's own full adder, which has no artwork of its own, so it arrives as
<b>two half adders and an OR</b>: <b>twenty-four cells</b> for an eight-bit add.</p>
<p>Note that this is a DIFFERENT decomposition from the forty gates above. The tool built each column
out of five gates because that is what the expressions said; the layout library builds one out of
three cells because that is what somebody drew. Same arithmetic, same eight columns, different pieces
- and neither of them is the ninth bit's fault. Choosing the pieces is a job of its own.</p>
` },

    { layout: 'the-strip' },

    { html: String.raw`
<p><b>301.6 &micro;m</b> by <b>187.2 &micro;m</b>, and the shape is the thing to notice: those
twenty-four cells are in <b>four rows</b> rather than one. In a single line they would be twenty-six
times wider than tall, which is nothing a chip could use and nothing a page could show, so the placer
breaks the line and starts again underneath - <b>two full adders to a row</b> here, which is why the
rows come out even. Rows of cells abutted end to end is what a chip's floorplan IS, and every design
on this site would become one, given a placer with more to say about where things go.</p>
<p>Look along a row boundary and every other row is <b>upside down</b>. That is not a mistake and it
is not decoration: each cell carries its <b>VDD</b> rail along its top edge and its <b>VSS</b> rail
along the bottom, so two upright rows stacked together would put VSS against VDD and short the supply
the moment they touched. Mirroring alternate rows makes like meet like - VSS to VSS, then VDD to VDD -
so a rail is shared by the two rows on either side of it. Real standard-cell rows are built exactly
this way, and it is the reason a cell library gives every cell the same height and puts the rails at
the edges.</p>
<p>The wiring above them is the same two layers the
<a href="learn-half-adder-1bit.html">1-Bit Half Adder</a> introduces, and this is what it looks like
when there is real work to do: <b>31 nets</b>, drawn as <b>62 pieces of METAL2, 31 of METAL3 and 124
vias</b>. Look at how far they travel. A net joining two neighbouring cells still crosses a whole cell,
because a half adder's <code>sum</code> leaves on its <b>left</b> edge while the next stage's
<code>a</code> sits in the <b>middle</b> - and the cells were placed in the order the netlist names
them, so almost every wire doubles back. It averages <b>156 lambda per net</b>, and not one wire was
pushed off its own track by another. So the length is the <b>placement's</b> doing and not the wiring's,
which is why placing cells is a job of its own: the same netlist and the same cells, reordered or
flipped, is the same circuit with shorter wires.</p>
<p>One thing to know about this figure: it is <b>drawn from a netlist written out for it</b>, not from
the design in the editor or from the netlist the tool built. The placer here reads plain nets, where
both of those are vectored - <code>a[7:0]</code> - so this is the same eight columns with one wire per
bit. The <a href="learn-half-adder-1bit.html">1-Bit Half Adder</a> and
<a href="learn-full-adder-1bit.html">1-Bit Full Adder</a> are the pages where the placement really
does follow what you type.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>Two directions from here, and both are pages you have already got.
<a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry Adder</a> is this design with the chain
written out by hand, which is worth holding up beside the diagram above - and its own strip of wafer
is twelve cells in two rows against these twenty-four in four.
<a href="learn-logic-gates.html">Logic Gates</a> goes the other way - into a single cell, opened up
into the NAND and inverter it really is, with the mask layers named one at a time and a cross section
through its transistors.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Nine questions on describing arithmetic, catching the ninth bit, what the tool does with it and
what all of it comes to on the wafer. A
wrong answer says so and links back to the section it came from; the score at the foot of the panel
is what the Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE BOX, which is the figure this page needs: at the level the design is written, the whole
     adder is a single symbol with two buses and a carry in on one side and nine bits of answer on the
     other. Drawn by the netlist viewer's own node and wire code (see learn.js's note above
     figureGraph), so it is the same adder symbol, in the same colours, as the block Synthesize puts
     on the page further down - the picture and the netlist are in one language and cannot drift.

     THE COORDINATES ARE `ripple-carry-4bit`'s TOP STAGE, offsets included, and deliberately: this is
     one stage of that staircase with its neighbours taken away, so a reader who has just read that
     page meets the same symbol in the same place. The pin offsets are that file's, restated because
     they are what the numbers below mean: an adder is 124px tall with a at 19.5px, b at 84.5, cout at
     39 and sum at 65, absolute in the symbol's own units; a port is 32px tall with its pin at the
     middle, so a port sits at pin - 16.

     CIN IS THE EXCEPTION, being the one pin on the BOTTOM edge: a wire into it is routed to 22px
     BELOW the pin and then straight up, so its port is placed level with THAT point rather than with
     the pin - 124 + 22 - 16 = 130 - which makes the wire one straight run and a turn up the stub
     instead of an S-bend to reach it. It is also what sets the figure's height, and it clears the `b`
     port above it by 29.5px against the harness's 22px floor. */
  figures: {
    'add8': {
      caption: 'The design as written: one adder, eight bits wide, with a carry in underneath and the ninth bit of the answer leaving as cout.',
      nodes: [
        { id: 'a', kind: 'in', label: 'a[7:0]', x: 0, y: 3.5 },
        { id: 'b', kind: 'in', label: 'b[7:0]', x: 0, y: 68.5 },
        { id: 'cin', kind: 'in', label: 'cin', x: 0, y: 130 },
        { id: 'add', kind: 'add', label: 'a + b + cin', x: 140, y: 0 },
        { id: 'sum', kind: 'out', label: 'sum[7:0]', x: 260, y: 49 },
        { id: 'cout', kind: 'out', label: 'cout', x: 380, y: 23 }
      ],
      /* [source, target, target pin, source pin] - a wire out of an adder names `sum` or `cout` in
         the fourth slot, and a port's own single pin is `y` whichever way it faces. */
      edges: [
        ['a', 'add', 'a'], ['b', 'add', 'b'], ['cin', 'add', 'cin'],
        ['add', 'sum', 'y', 'sum'],
        ['add', 'cout', 'y', 'cout']
      ]
    }
  },

  /* Six cases at 10 time units each, so the run is 60 - stated here because there is no
     `truthTable` for it to be derived from, which is what having seventeen inputs costs (see the note
     at the top of the file). */
  maxTime: 60,

  /* THE PLACEMENT: a netlist WRITTEN OUT, for the reason the header note gives - the design is one
     `assign` and the tool's own netlist is vectored, and pnr's parser takes neither. Eight `fa_gate`s
     with one net per bit is the same eight columns, and `fa_gate` having no artwork is what makes each
     one two `ha_gate`s and an `or_gate`: twenty-four cells, which is deliberately NOT the forty gates
     the synthesizer emitted. Two decompositions of the same arithmetic, and the prose says so.

     `rows: 4` ASKS FOR A SHAPE, not a width, and the wrapping is this page's subject. A width budget
     says nothing about the result: `rowWidth: 700` (in lambda) is what this figure asked for before,
     and 24 cells of two different widths came out 9, 9, 6 - a strip 3.22 times wider than tall, with
     an unbalanced last row. Four rows of six is 1.61:1, and six cells is exactly TWO FULL ADDERS
     (ha, ha, or, ha, ha, or), so no bit straddles a row boundary. Measured, for the record: 5 rows
     would be squarer still at 1.18 and 6 rows overshoots to 0.76, but 5 splits a full adder.

     `rowPx` IS PER ROW and is only the BASE: `fitLayout` grows the drawing to the column it is in
     (measured, 256 -> 335px in a 488px column), so this number decides the shape of the first paint
     and not the final size. 64 rather than the 50 this carried at three rows because four rows of a
     squarer placement leave width spare, and a base that starts nearer the column's own aspect is
     one the fit has less to do to. */
  layouts: {
    'the-strip': {
      caption: 'Eight columns as cells - two half adders and an OR each - wrapped into four rows, every other one mirrored so the power rails meet like for like.',
      view: 'all',
      rows: 4,
      rowPx: 64,
      netlist: String.raw`module strip(
  input  a0, b0, a1, b1, a2, b2, a3, b3,
  input  a4, b4, a5, b5, a6, b6, a7, b7,
  input  cin,
  output s0, s1, s2, s3, s4, s5, s6, s7,
  output cout
);

  fa_gate f0 (.a(a0), .b(b0), .cin(cin), .sum(s0), .cout(c1));
  fa_gate f1 (.a(a1), .b(b1), .cin(c1),  .sum(s1), .cout(c2));
  fa_gate f2 (.a(a2), .b(b2), .cin(c2),  .sum(s2), .cout(c3));
  fa_gate f3 (.a(a3), .b(b3), .cin(c3),  .sum(s3), .cout(c4));
  fa_gate f4 (.a(a4), .b(b4), .cin(c4),  .sum(s4), .cout(c5));
  fa_gate f5 (.a(a5), .b(b5), .cin(c5),  .sum(s5), .cout(c6));
  fa_gate f6 (.a(a6), .b(b6), .cin(c6),  .sum(s6), .cout(c7));
  fa_gate f7 (.a(a7), .b(b7), .cin(c7),  .sum(s7), .cout(cout));

endmodule
`
    }
  },

  /* One question per marked section, and `sec` is what ties each to the heading it came from: a
     wrong answer links back to that section, with the heading's own words as the link. `verilog` and
     `width` are asked twice - the first because the three parts of that one line are the whole
     lesson, the second because widening the ports and stacking two blocks are different answers to
     one question. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'describe',
          q: 'What is the difference between this design and the four-bit one on the last page?',
          options: [
            'This one says what the circuit computes; that one says which blocks it is made of',
            'This one is faster, because it has no carries to pass along',
            'This one is arithmetic in software, where that one is hardware'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'Why does the answer need nine bits when the inputs are eight, eight and one?',
          options: [
            'Because 255 + 255 + 1 is 511, which will not fit in eight bits',
            'Because one bit is always reserved for the sign',
            'Because the concatenation adds a bit of its own'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'What does <code>{cout, sum}</code> on the left of the assignment do?',
          options: [
            'Makes one nine-bit target, so the top bit of the answer lands in cout',
            'Adds cout to sum and stores the result',
            'Says the two outputs change at the same instant'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'How does the carry in get into the sum?',
          options: [
            'It is written as one more term: a + b + cin',
            'It is wired into the first column by hand, as on the last page',
            'It is added afterwards, by a second assign'
          ],
          answer: 0
        },
        {
          sec: 'width',
          q: 'How much of this design changes to make it a sixteen-bit adder?',
          options: [
            'The three port widths; the line that adds them stays exactly as it is',
            'The adding line, which needs sixteen terms instead of eight',
            'Every carry wire has to be renamed'
          ],
          answer: 0
        },
        {
          sec: 'width',
          q: 'Without changing the design at all, how would you add sixteen-bit numbers with it?',
          options: [
            'Use two, with the low half’s carry out feeding the high half’s carry in',
            'Use two and add their sums together afterwards',
            'Run one twice and keep the larger answer'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'Every other row of the layout is mirrored top to bottom. Why?',
          options: [
            'So VSS meets VSS and VDD meets VDD where two rows touch, instead of shorting',
            'To fit more cells into the same width',
            'So the cell names read the right way up in both directions'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'Why is the layout four rows rather than one long line?',
          options: [
            'Twenty-four cells in a line would be about 26 times wider than tall, so the placer wraps them',
            'Each row is one of the three cell types the design uses',
            'A row can hold at most eight cells, one per bit of the adder'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'Press Synthesize and double-click the block. What is inside it?',
          options: [
            'Eight full adders, each carry out wired into the next carry in',
            'One eight-bit adder cell, which is a single gate with wide pins',
            'A copy of the assign statement, still unsynthesized'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. Behavioural, and the whole of it is the one assign - which is the page. No `library`
     here: nothing is instantiated, so there is nothing for the synthesizer to resolve. */
  verilog: String.raw`/* An 8-bit adder, written as arithmetic.
 *
 * One line says the whole circuit: add a, b and the carry in, and catch the
 * answer in nine bits - eight of sum, plus cout for the one that will not fit.
 *
 * {cout, sum} is a concatenation used as the TARGET of the assignment, so the
 * ninth bit lands in cout instead of being thrown away: 255 + 0 + 1 comes out
 * as sum = 00000000 with cout = 1, which read together is 256.
 *
 * cin and cout are what make it stackable: two of these, carry out into carry
 * in, add sixteen-bit numbers.
 */
module dut(
  input  [7:0] a,
  input  [7:0] b,
  input        cin,
  output [7:0] sum,
  output       cout
);

  assign {cout, sum} = a + b + cin;

endmodule
`,

  /* The hidden testbench. WRITTEN OUT rather than generated, because with seventeen inputs the
     generated sweep would be 131,072 steps - see the note at the top of the file. Six cases, chosen
     so that each says something the prose claims: nothing at all, an add with room to spare, the same
     one with the carry in set so its effect is a single row apart, and the three that do not fit -
     one wrapping partway, one wrapping to exactly zero on the carry in alone, and 511, the widest
     answer this adder can produce. */
  testbench: String.raw`module tb;

  reg  [7:0] a, b;
  reg        cin;
  wire [7:0] sum;
  wire       cout;

  dut u_dut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

  initial begin
    a = 8'd0;   b = 8'd0;   cin = 1'b0; #10; $display("%d + %d + %b = %d, carry out %b", a, b, cin, sum, cout);
    a = 8'd12;  b = 8'd5;   cin = 1'b0; #10; $display("%d + %d + %b = %d, carry out %b", a, b, cin, sum, cout);
    a = 8'd12;  b = 8'd5;   cin = 1'b1; #10; $display("%d + %d + %b = %d, carry out %b", a, b, cin, sum, cout);
    a = 8'd200; b = 8'd100; cin = 1'b0; #10; $display("%d + %d + %b = %d, carry out %b", a, b, cin, sum, cout);
    a = 8'd255; b = 8'd0;   cin = 1'b1; #10; $display("%d + %d + %b = %d, carry out %b", a, b, cin, sum, cout);
    a = 8'd255; b = 8'd255; cin = 1'b1; #10; $display("%d + %d + %b = %d, carry out %b", a, b, cin, sum, cout);
    $finish;
  end

endmodule
`
};
