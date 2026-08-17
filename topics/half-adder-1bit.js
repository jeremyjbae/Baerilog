/* Topic content for the 'half-adder-1bit' learn page - the third topic, and the first that builds
 * something OUT of gates rather than looking at one.
 *
 * It follows `logic-gates` deliberately closely, because it is the same walk down the same stack
 * with a bigger design on it: prose, a figure in the netlist viewer's own symbols, the design in
 * the editor, the truth table and the waveform read off one run, then the gate-level netlist. The
 * one difference is where it stops - see the note on the last block below.
 *
 * ONE ADDER PER TOPIC, and this one is the HALF adder: two bits in, sum and carry out, and nothing
 * that accepts a carry from the column before it. The full adder is `full-adder-1bit`, which recaps
 * this circuit in a paragraph and then adds the third input. They were one topic to begin with and
 * were split because the page held two designs and one editor: a topic ships ONE `verilog`, so the
 * second half's prose described a design the reader could not see, and every card sat under it.
 *
 * THE DESIGN IS THE EXPRESSION, not `a + b`, and that is the whole reason this page has a netlist
 * worth looking at. Measured, on the synthesizer this repo ships: `assign {carry, sum} = a + b`
 * comes out as a generated sub-module instance - a box you have to double-click into - where the two
 * expressions synthesize to `xor_gate u_xor0` and `and_gate u_and0`, which is exactly the diagram
 * above them. So the page shows the same circuit three times over and the three cannot disagree.
 *
 * TWO LAYOUT FIGURES, and this file used to say there could be none - worth keeping, because the
 * note was right when it was written and stopped being right for a reason that is easy to miss. A
 * placement reads a NETLIST, so while this design was two `assign` lines there was nothing to place
 * until Synthesize had been pressed, and `from: 'synthesis'` falls back to the design, which would
 * have put an empty bordered box in the prose at load. The design instantiates cells now, so it IS a
 * netlist as it stands and the figure is there from the first paint. See the note above `layouts`.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['half-adder-1bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="binary">How a computer adds</h2>
<p>A computer has no fingers to count on and no notion of the digits 2 to 9. It runs on switches,
so it knows <b>1</b> and <b>0</b> and nothing else. Addition therefore has to be built out of the
gates on the previous page - and the first thing to work out is what the rules even are.</p>
<div class="learn-note">
  <b>Binary addition, in full:</b> 0 + 0 = 0, &nbsp; 0 + 1 = 1, &nbsp; 1 + 0 = 1, &nbsp;
  and 1 + 1 = <b>2, which is not a digit we have</b>.
</div>
<p>Base-10 (decimal) has the same problem at 9 + 1: you write a 0 and <b>carry</b> a one into the next
column. Binary does exactly that, one column earlier - 1 + 1 is written <code>10</code>, which is
two. So a circuit that adds one bit to another cannot have one output. It needs two: the
<b>sum</b>, which belongs in this column, and the <b>carry</b>, which belongs in the next one.</p>
` },

    { html: String.raw`
<h2 data-sec="half">The half adder</h2>
<p>Two inputs, two outputs, and the table is four rows because two inputs always are. Read the
<code>sum</code> column on its own and it is 1 exactly where the inputs differ - which is
<b>XOR</b>. Read <code>carry</code> and it is 1 only where both are 1 - which is <b>AND</b>.</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">a</th><th class="in">b</th><th class="sep"></th>
          <th>sum</th><th>carry</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">0</td><td class="in">0</td><td class="sep"></td>
          <td class="zero">0</td><td class="zero">0</td></tr>
      <tr><td class="in">0</td><td class="in">1</td><td class="sep"></td>
          <td class="one">1</td><td class="zero">0</td></tr>
      <tr><td class="in">1</td><td class="in">0</td><td class="sep"></td>
          <td class="one">1</td><td class="zero">0</td></tr>
      <tr><td class="in">1</td><td class="in">1</td><td class="sep"></td>
          <td class="zero">0</td><td class="one">1</td></tr>
    </tbody>
  </table>
</div>
<p>That is the whole circuit: the two columns are two gates you have already met, both looking at
the same two inputs.</p>
` },

    { figure: 'half-adder' },

    { html: String.raw`
<div class="learn-note">
  <b>Why is it called a 'half' adder?</b> Good question. Hang on tight until we get the answer when
  we learn <a href="learn-full-adder-1bit.html">1-Bit Full Adder</a>.
</div>
` },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>Two lines, one per output column, and neither of them names a gate: they say what the outputs
<em>are</em> in terms of the inputs and let the synthesizer choose the gates. That is the
difference between this page's design and the previous one's, and it is the ordinary way hardware
is written.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2>Reading it as a table</h2>
<p>The four rows, read out of the run itself rather than typed in - so this is the design's own
behaviour and not a claim about it. Compare the last row against the table further up the page:
1 + 1 is 2, which is <code>10</code>, so <code>sum</code> is 0 and <code>carry</code> is 1.</p>
` },

    { slot: 'truth-table' },

    { html: String.raw`
<h2>...and as a waveform</h2>
<p>The same run against time. Nothing here remembers anything, so both outputs move at the instant
an input does - and the sweep counts up in binary, which is why <code>b</code> toggles on every step
and <code>a</code> halfway through.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="netlist">What it becomes as gates</h2>
<p>Press <b>Synthesize</b>. The two <code>assign</code> lines become a netlist of standard cells -
and it is the circuit this page drew by hand: <b>one XOR and one AND</b>, two cells, nothing else.
Nobody wrote those gates down. They are what those two expressions mean.</p>
<p>Read the listing against the source and the correspondence is line for line: <code>u_xor0</code>
drives <code>sum</code>, <code>u_and0</code> drives <code>carry</code>, and each carries the
expression it came from as a comment. Nothing is shared, because the two expressions have no
sub-expression in common - which stops being true the moment a carry in arrives, and is worth
remembering when the full adder's netlist comes out with three XORs for two in its diagram.</p>
<p>Otherwise it is ordinary Verilog, one instantiation per cell, which is the form the previous
topic's design was written in to begin with. That is the whole of what a synthesizer does.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>A cell is not an idea. It is a rectangle of patterned silicon, and the two this design names have
been drawn once each by somebody and kept in a library ever since. Below is <b>this design</b> on the
wafer: the XOR and the AND, side by side, abutted so their power rails and their wells run straight
through from one into the next. That is what a row of standard cells is - the same height every time,
whatever width the logic needs.</p>
<p>The colours are the <b>mask layers</b>, one per step of the process: the well is a tub of doped
silicon, the diffusions are pockets inside it, the polysilicon crossing a diffusion is a transistor
gate, and the metal above carries the wires between them on contacts. Press <b>Unselect All</b> and
bring them back one at a time from the bottom up, or press <b>Play</b> and watch the process run in
order.</p>
<p>Beside the layout is a <b>cross section</b> at the dashed line - the same masks seen edge-on, so
the well is a tub, the diffusions are pockets in it and the metal sits above on its contacts. Drag
the line or step it with the arrows to cut somewhere else; it opens through a transistor gate, which
is the one place the whole stack shows at once.</p>
` },

    { layout: 'the-cells' },

    { html: String.raw`
<p>Two things sit above the cells that are not part of either of them: <b>teal wires that run only up
and down</b> (METAL2) and <b>violet ones that run only left and right</b> (METAL3), joined by small
dark squares - <b>vias</b>, the holes cut through the oxide where a wire changes layer. There are
exactly <b>two wires</b> here, and they are the two <b>inputs</b>: <code>a</code> has to arrive at both
cells and so does <code>b</code>, because the sum column and the carry column read the same two bits.
Follow one and it is three moves - down a column, across a track, down again - with a via at each
change, eight vias for the two of them.</p>
<p><b>Each layer having one direction is the whole trick.</b> Two wires may cross wherever they like,
because one is above the other and only a via connects them; without that rule every crossing would be
a short and a chip could not be wired at all. The layers are stacked with oxide between them -
<a href="learn-logic-gates.html">Logic Gates</a> is where that oxide and the holes through it get built
one step at a time. Press any badge above the drawing to turn a layer off: with METAL1 and the poly
hidden, what is left is the wiring on its own.</p>
` },

    { html: String.raw`
<p>Read the measured line under it: two cells, and their row is <b>67.6 &micro;m</b> wide. Now the
same function as a cell somebody drew <em>on purpose</em> - <code>ha_gate</code>, a half adder in one
piece, 14 transistors:</p>
` },

    { layout: 'one-cell' },

    { html: String.raw`
<p><b>62.4 &micro;m against 67.6</b>, for the identical logic, and the same height - a cell library
is one row height throughout, so saving area means saving width. Nothing was optimised away: the
wires that carried <code>a</code> and <code>b</code> to both gates are inside the cell now, so they
cost no space between them, and
the transistors were placed for this one function rather than for two functions that happen to sit
next to each other. That is why a library has an <code>ha_gate</code> at all, and it is the whole
argument for cells bigger than a gate - a design built out of them is smaller than the same design
built out of the pieces.</p>
<p>It is also the reason the previous topic's netlist had a third XOR: a tool that emits what the
expressions say, cell for cell, cannot make either of these trades. Choosing the cell is a job of its
own.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>Two ways on from here. <a href="learn-full-adder-1bit.html">1-Bit Full Adder</a> gives this
circuit the carry in it is missing, which is what lets one column feed the next and turns two of
these into an adder of any width. And <a href="learn-logic-gates.html">Logic Gates</a> takes a single
cell apart in a way this page does not: an AND opened up into the NAND and inverter it really is,
which is what the layers above are made of.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Six questions on what the half adder is made of and what it becomes. A wrong answer says so and
links back to the section it came from; the score at the foot of the panel is what the Learn hub
shows beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* PLACEMENTS: what the design becomes on the wafer, drawn by practice-pnr.js out of pnr.html's
     engine. Two of them, and they are two different kinds of statement.

     `the-cells` is `from: 'synthesis'`, which reads the netlist the last synthesis produced and
     falls back to the design when there is none - and both halves of that matter here. The fallback
     is why the figure is on the page at LOAD, before anything is pressed, and it only works because
     this design INSTANTIATES cells: a placement reads a netlist, so an RTL design has nothing to
     place until Synthesize has been pressed, and this one is a netlist as it stands. (This file used
     to carry a note saying a layout figure was impossible here for that reason, which stopped being
     true when the design stopped being two `assign` lines.) And preferring the synthesis is what
     keeps the figure from going EMPTY if the reader rewrites the design as expressions: `from:
     'design'` would then have no instantiation to read and would leave an empty bordered box in the
     prose, where this draws the cells the synthesizer chose.

     `one-cell` writes its own netlist, because it is a picture of something the design does NOT
     contain: `ha_gate`, the library's purpose-built half adder. Measured through the same engine,
     that is 62.4 um against the 67.6 the two gates take abutted - and the prose quotes those in
     MICRONS because that is the unit the drawer's own measured line under each figure uses. The
     engine works in lambda (104 and 96 of them, at 0.65 um each), and quoting those numbers as
     microns is a mistake this page shipped for one draft: the paragraph said 104 um while the line
     under the figure it was describing said 67.6.

     THE TWO SWITCHES ARE ON THE FIRST FIGURE ONLY. `crossSection` opens shown and `animate` opens
     stopped (a page that starts moving is what prefers-reduced-motion is about) - and the second
     figure has neither, because it is there for a comparison of area, not for a second copy of the
     process story with its own Play button.

     `view: 'all'` is every mask layer, which is what a section about silicon wants; 'phantom' would
     draw the abutment box and the pins, the floorplan reading. `rowPx` is a floor, not a target -
     learn.js grows a placement to fill the column it is given. */
  layouts: {
    'the-cells': {
      caption: 'This design on the wafer: the XOR abutted to the AND, one row of standard cells.',
      from: 'synthesis',
      view: 'all',
      rowPx: 220,
    },
    'one-cell': {
      caption: 'The same function as one purpose-built cell - 14 transistors, and narrower.',
      view: 'all',
      rowPx: 220,
      netlist: String.raw`module one_cell(
  input  a,
  input  b,
  output sum,
  output carry
);

  ha_gate u0 (.a(a), .b(b), .sum(sum), .cout(carry));

endmodule
`
    }
  },

  /* The one diagram, drawn by the netlist viewer's own node and wire code (see learn.js's note
     above figureGraph) - so it is the same symbols, in the same colours, as the netlist the page
     produces further down, and the reader meets one picture rather than two styles of picture.
     Positions are hand-authored in the viewer's own pixel space, and the harness asserts no two
     boxes overlap, since that is the thing most likely to be wrong in a new figure. */
  figures: {
    /* A PORT'S ONE HANDLE IS CALLED `y`, whether the wire arrives at it or leaves it - so an edge
       into an output port names `y` where an edge into a gate names `a` or `b`. Getting that wrong
       is not loud: drawStatic discards a wire whose handle does not exist, so the figure simply
       comes out short of two wires, which is what the harness's edge count is for (it reported
       `drew 4 wires for 6 declared`). */
    /* XOR for the sum, AND for the carry, both fed by the same two inputs. */
    'half-adder': {
      caption: 'A half adder: the sum column is an XOR, the carry column an AND.',
      nodes: [
        { id: 'a', kind: 'in', label: 'a', x: 0, y: 6+10 },
        { id: 'b', kind: 'in', label: 'b', x: 0, y: 86+10 },
        { id: 'x1', kind: 'xor', x: 150, y: 6 },
        { id: 'n1', kind: 'and', x: 150, y: 86 },
        { id: 'sum', kind: 'out', label: 'sum', x: 280, y: 6+10 },
        { id: 'carry', kind: 'out', label: 'carry', x: 280, y: 86+10 }
      ],
      edges: [
        ['a', 'x1', 'a'], ['b', 'x1', 'b'],
        ['a', 'n1', 'a'], ['b', 'n1', 'b'],
        ['x1', 'sum', 'y'], ['n1', 'carry', 'y']
      ]
    }
  },

  /* Two inputs, so the sweep is four steps - both the row count and the run length are derived from
     this list rather than written anywhere, which is what stops a table from claiming more rows
     than the stimulus drives. The scale is left at the site default. */
  truthTable: {
    inputs: ['a', 'b'],
    outputs: ['sum', 'carry'],
    step: 10,
    sampleAt: 5
  },

  /* One question per marked section, and `sec` is what ties each to the heading it came from: a
     wrong answer links back to that section, with the heading's own words as the link. The two
     bridge sections - the table and the waveform - carry no `data-sec` and no question, being a
     sentence each rather than something to be tested on. `silicon` is asked TWICE, being the
     section with two figures under it: what a layer is, and what the second figure is for. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'binary',
          q: 'Why does a one-bit adder need two output wires?',
          options: [
            'One says the answer and the other says whether it is valid',
            'Because 1 + 1 is 2, which needs a carry into the next column',
            'One is the sum and the other is its inverse'
          ],
          answer: 1
        },
        {
          sec: 'half',
          q: 'In a half adder, which gate computes the sum?',
          options: ['AND', 'OR', 'XOR', 'NOT'],
          answer: 2
        },
        {
          sec: 'verilog',
          q: 'What does <code>assign carry = a &amp; b;</code> say about the carry?',
          options: [
            'It is 1 only when both inputs are 1',
            'It is 1 whenever either input is 1',
            'It is 1 when the two inputs differ'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'The two assign lines synthesize to two cells. Which two?',
          options: [
            'An XOR for the sum and an AND for the carry',
            'Two XORs, one per output',
            'An AND for the sum and an OR for the carry'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'In the layout, what makes a transistor?',
          options: [
            'Polysilicon crossing a diffusion',
            'Metal crossing another piece of metal',
            'Two contacts landing on the same well'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'Why is the single ha_gate narrower than the XOR and the AND abutted?',
          options: [
            'The wire between the two gates is inside the cell, and its transistors were placed for this one function',
            'It uses fewer transistors, because a half adder needs less logic than an XOR and an AND',
            'It is drawn on a smaller process, with thinner layers'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. Two logic gates instantiated. */
  verilog: String.raw`/* A one-bit half adder.
 *
 * Two outputs, because 1 + 1 is 2 and that needs two bits: the sum for this
 * column, and the carry for the next one along. There is no carry IN, which
 * is the half of a full adder this one is missing.
 */
module dut(
  input  a,
  input  b,
  output sum,
  output carry
);

  xor_gate u0 (.a(a), .b(b), .y(sum));
  and_gate u1 (.a(a), .b(b), .y(carry));


endmodule
`,

  library: String.raw`module and_gate (input a, input b, output y);
  assign y = a & b;
endmodule

module or_gate (input a, input b, output y);
  assign y = a | b;
endmodule

module nand_gate (input a, input b, output y);
  assign y = ~(a & b);
endmodule

module nor_gate (input a, input b, output y);
  assign y = ~(a | b);
endmodule

module xor_gate (input a, input b, output y);
  assign y = a ^ b;
endmodule

module xnor_gate (input a, input b, output y);
  assign y = ~(a ^ b);
endmodule

module not_gate (input a, output y);
  assign y = ~a;
endmodule

module buf_gate (input a, output y);
  assign y = a;
endmodule
`,

  /* The hidden testbench: the wrapper only. The line reading SWEEP is replaced by learn.js with a
     stimulus generated from truthTable.inputs, so the four rows and the four steps are one
     declaration - counting up in binary, which is the order the table reads them back in. */
  testbench: String.raw`module tb;

  reg  a, b;
  wire sum, carry;

  dut u_dut (.a(a), .b(b), .sum(sum), .carry(carry));

  initial begin
    // SWEEP
  end

endmodule
`
};
