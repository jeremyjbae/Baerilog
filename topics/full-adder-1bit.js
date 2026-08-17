/* Topic content for the 'full-adder-1bit' learn page - the fourth topic, and the one that turns a
 * one-column adder into something you can build a real one out of.
 *
 * ONE ADDER PER TOPIC. `half-adder-1bit` teaches the two-input circuit and stops there; this page
 * recaps it in a paragraph and a figure, then adds the carry in. They were one topic to begin with
 * and were split because a topic ships ONE `verilog` and one editor: with both designs on one page
 * the half adder's prose described a design the reader could not see, and every card sat under the
 * full adder's. So the recap here is deliberately short and points back rather than re-teaching.
 *
 * THE DESIGN IS THE EXPLICIT SUM-OF-PRODUCTS, not `a + b + cin`, and that is the whole reason this
 * page has a netlist worth looking at. Measured, on the synthesizer this repo ships: the operator
 * form comes out as a constant and TWO generated sub-module instances - boxes you have to
 * double-click into - where the explicit form synthesizes to five gate cells, xor x2, and x2, or x1,
 * which is exactly the diagram the figures above it draw. So the page shows the same circuit three
 * times over and the three cannot disagree.
 *
 * NO LAYOUT FIGURE HERE, and that is a decision rather than an omission. A placement reads a
 * NETLIST, so on an RTL design there is nothing to place until the reader presses Synthesize - and
 * `from: 'synthesis'` falls back to the design before that, which would put an empty bordered box
 * in the prose at load, the failure this repo keeps designing against. `logic-gates` instantiates a
 * cell and so is a netlist from the start, which is why the silicon story lives there; this page
 * ends at the gates and points at it.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['full-adder-1bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="half">Where the half adder stops</h2>
<p>The <a href="learn-half-adder-1bit.html">1-Bit Half Adder</a> adds two bits and says what came
out in two wires: the <b>sum</b>, which is 1 where the inputs differ - an <b>XOR</b> - and the
<b>carry</b>, which is 1 only where both are 1 - an <b>AND</b>. Two gates over the same two inputs,
and no wire between them:</p>
` },

    { figure: 'half-adder' },

    { html: String.raw`
<h2 data-sec="full">The full adder</h2>
<p>A half adder adds two bits in isolation, and that is not what adding numbers is. Adding
<code>0111</code> to <code>0001</code> means four columns, and every column after the first has to
accept the carry the one before it produced. So the circuit needs a third input - the
<b>carry in</b> - and it is called a <b>full</b> adder once it has one.</p>
<p>Three inputs, so eight rows; still two outputs, because three bits add to at most 3, which is
<code>11</code> in binary - two digits, so <code>sum</code> and <code>cout</code> between them hold
every answer this circuit can produce. A fourth input is where that would stop being true: 1 + 1 + 1
+ 1 is 4, and 4 is <code>100</code>.</p>
<p>And one column is all this has to be. Wire each block's carry out into the next block's carry in
and four of them add four-bit numbers, sixty-four of them add sixty-four-bit ones - three wires for
the first, sixty-three for the second. That is the
<a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry Adder</a>, and it is the next topic.</p>
<p>Under the hood it is <b>two half adders and an OR</b>: the first adds <code>a</code> to
<code>b</code>, the second adds <code>cin</code> to that sum, and the carry out is 1 if
<em>either</em> of them carried - which is what the OR is for. Five gates in total - two XORs, two
ANDs and the OR:</p>
` },

    { figure: 'full-adder' },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>One line per gate, and every line names the gate it uses: the design below is the diagram
above, written down. <code>wire</code> declares the internal nodes - the places a wire runs from
one gate's output to the next one's input - and each instantiation says which cell to put there
and what to connect it to. Nothing here says what <code>sum</code> and <code>cout</code>
<em>are</em>; it says which gates make them, which is why this is called a structural
description.</p>

<h3>1. The sum</h3>
<pre class="learn-code">xor_gate u_xor0 (.a(a), .b(b), .y(w_xor0));
xor_gate u_xor1 (.a(w_xor0), .b(cin), .y(sum));</pre>
<p>Two XORs, one after the other, with <code>w_xor0</code> the wire between them. The first adds
<code>a</code> and <code>b</code>; the second adds the carry in to that. Chaining them is what
makes the sum bit 1 whenever an odd number of the three inputs is 1.</p>

<h3>2. The carry out</h3>
<pre class="learn-code">and_gate u_and0 (.a(a), .b(b), .y(w_and0));
and_gate u_and1 (.a(cin), .b(w_xor0), .y(w_and1));
or_gate u_or0 (.a(w_and0), .b(w_and1), .y(cout));</pre>
<p>The two ways a column can carry, one AND each, and an OR that accepts either.
<code>u_and0</code> is the first half adder carrying on its own - both bits set. <code>u_and1</code>
is the carry in arriving somewhere that was already going to flip, so it pushes the column over.
Neither on its own is the carry out; <code>u_or0</code> is.</p>
<p><b>Five gates, and the diagram above has five</b> - they agree, and the reason is one wire.
<code>u_and1</code> needs <code>a ^ b</code>, and <code>u_xor0</code> has already worked that out and
left it on <code>w_xor0</code>, so this design reads that wire rather than building a second XOR to
compute the same thing. Sharing it is a DECISION, and here it is the author's: hand the same logic to
a synthesizer as two expressions and <code>a ^ b</code> appears in both of them, so a tool that emits
what they say cell for cell builds it twice. The four blocks the
<a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry Adder</a> chains are written that way, and
each one comes out as six cells rather than five.</p>
<p>Press <b>Run Simulation</b> and every one of the eight input combinations is driven in turn -
that is what fills in the table and the waveform below.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2>Reading it as a table</h2>
<p>The eight rows, read out of the run itself rather than typed in - so this is the design's own
behaviour and not a claim about it. Compare the last row against the prose above: 1 + 1 + 1 is 3,
which is <code>11</code>, so both outputs are 1.</p>
` },

    { slot: 'truth-table' },

    { html: String.raw`
<h2>...and as a waveform</h2>
<p>The same run against time. Nothing here remembers anything, so both outputs move at the instant
an input does - and the sweep counts up in binary, which is why <code>cin</code> toggles on every
step, <code>b</code> on every second one and <code>a</code> halfway through.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="netlist">What it becomes as gates</h2>
<p>Press <b>Synthesize</b> and the Console says something worth reading: <i>this design is already
a netlist: 5 instantiated cells, nothing to infer</i>. There is no logic to work out here, because
the design named its gates itself - so what you get is a drawing of the cells you wrote, and no
listing card, since a listing of a design that was already a netlist is your own source read back
to you.</p>
<p>The viewer is the useful half. Each cell is drawn as its symbol with the wires between them, so
you can hold it against the diagram at the top of the page and check them off: two XORs down the sum
path, an AND for each way of carrying, an OR joining them. Five and five - the picture and the
netlist say the same thing, because the design shares the XOR its two output columns have in
common.</p>
<p>The report puts a number on it: <b>5 cells, about 9.5 NAND-equivalents of area</b> - 5 of that the
two XORs, which is why sharing one was worth doing. An XOR is dear compared with an AND because it is
more transistors: building <code>a ^ b</code> a second time would make this 6 cells and about 12.</p>
<p>That a synthesizer is not needed here is the point of the exercise: a structural description
already IS what synthesis produces. Where it earns its keep is a design written as expressions -
<code>assign sum = a ^ b ^ cin;</code> - which has no gates in it at all until something chooses
them.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as area</h2>
<p>NAND-equivalents are a way of counting. This is the same five cells as <b>a strip of wafer</b>:
each one drawn once by somebody, kept in a library, and abutted into a row so the power rails and
the wells run straight through from one into the next. The row is <b>161.2 &micro;m</b> long and
<b>46.8 &micro;m</b> tall - and that height is the same on every page of this site that draws one,
because a cell library has ONE row height and everything in it is built to fit. Area is width.</p>
` },

    { layout: 'the-cells' },

    { html: String.raw`
<p>That row is five cells long because of the shared XOR. Building <code>a ^ b</code> twice - the way
a synthesizer does, cell for cell, from expressions - makes it <b>six cells rather than five</b>: 2.5
more NAND-equivalents, and about a quarter more row, to compute something that was already on a wire.
That is what an optimiser is for, and it is the first place on this site where a decision in the
Verilog has a length you can measure.</p>
<p>Now the other direction. A library carries cells bigger than a gate, and there is a full adder
among them - so ask for one and the placer says something worth reading:</p>
` },

    { layout: 'one-cell' },

    { html: String.raw`
<p>Three cells, <b>150.8 &micro;m</b> - and read the line under it: <code>fa_gate</code> is not what
was placed. There is no full-adder artwork in this library, so the tool <b>expanded</b> it into
<b>two half adders and an OR</b> - which is the circuit the diagram at the top of this page draws, and
the reason it was drawn that way. A cell can be a name for a composition rather than a rectangle of
silicon, and the flow flattens it into the cells that really exist.</p>
<p>And unlike the half adder's, all <b>three</b> of its wires run <em>between</em> gates rather than
fanning an input out to both - the two carries and the sum the second XOR needs - which is what the
diagram at the top of this page draws as lines between the symbols.</p>
<p>So the same one-bit addition is <b>161.2 &micro;m</b> written out by hand here and
<b>150.8 &micro;m</b> as the library's own cell - and it would have been six cells rather than five
with that XOR left unshared. Nothing about the arithmetic changed in any of the three; all that
changed is who chose the cells. That choice is a job of its own, and it is the whole of what the
layers on <a href="learn-logic-gates.html">Logic Gates</a> are made of.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p><a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry Adder</a> chains four of these into
something that adds numbers rather than columns, and that is the next topic. And
<a href="learn-logic-gates.html">Logic Gates</a> goes the other way from the row above: down into a
single cell, opened up into the NAND and inverter it really is, with the mask layers named one at a
time and a cross section through the transistors themselves.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Six questions on what the adder is made of and what it costs. A wrong answer says so and links
back to the section it came from; the score at the foot of the panel is what the Learn hub shows
beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* PLACEMENTS: the same five cells as silicon, and then the library's own full adder. Two of them,
     and NEITHER carries the two switches - no cross section and no animation - which is a decision
     rather than an omission. `logic-gates` and `half-adder-1bit` both teach the process, and a third
     autoplaying figure in the same sequence is length rather than meaning; what this page adds is
     AREA, which is what the measured line under each figure states.

     `the-cells` is `from: 'synthesis'`, which reads the netlist the last synthesis produced and falls
     back to the design when there is none. Both halves matter: the fallback is why the figure is on
     the page at load, and it only works because this design INSTANTIATES cells - a placement reads a
     netlist, so a design written as expressions has nothing to place until Synthesize has been
     pressed. Preferring the synthesis is what keeps the figure from going empty if a reader rewrites
     it that way, where `from: 'design'` would have no instantiation left to read.

     `one-cell` writes its own netlist, because it is a picture of something the design does not
     contain - and of something the library does not quite contain either. There is no `fa_gate`
     ARTWORK, so pnr expands the instance into two `ha_gate`s and an `or_gate` and reports that it
     did; the prose is about exactly that, so this figure is the one place on the site where an
     expanded cell is drawn.

     `rowPx` IS A FLOOR AND A WIDE ROW IS WIDTH-BOUND, which is what sets these two numbers. Five
     cells abutted are 3.4:1, so in the article's column that row can only be about 157px tall - and
     `fitLayout` will not shrink a figure below the floor the topic asked for, so a floor of 200 here
     left the placement refusing to fit its own column at all. 120 and 150 are under what the column
     allows for each shape, so both grow into it instead.

     THE NUMBERS IN THE PROSE ARE THESE FIGURES' OWN. 161.2 um and 150.8 um are what the drawer
     measures for the two placements at 0.65 um a lambda, and the harness now requires every micron
     figure in a topic's prose to be some drawn figure's width or height - which is why the
     six-cell version - the one this design would be with the XOR built twice - is quoted in CELLS
     and NAND-equivalents rather than in microns: it is not on the page, so a number for it could not
     be checked against anything. (It was 202.8 um while the design really had six cells, and the
     check caught that number the moment the design lost one.) */
  layouts: {
    'the-cells': {
      caption: 'The five cells of this design, abutted into one row of standard cells.',
      from: 'synthesis',
      view: 'all',
      rowPx: 120
    },
    'one-cell': {
      caption: 'Ask for the library\'s full adder and you get two half adders and an OR.',
      view: 'all',
      rowPx: 150,
      netlist: String.raw`module one_cell(
  input  a,
  input  b,
  input  cin,
  output sum,
  output cout
);

  fa_gate u0 (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

endmodule
`
    }
  },

  /* The two diagrams, drawn by the netlist viewer's own node and wire code (see learn.js's note
     above figureGraph) - so they are the same symbols, in the same colours, as the netlist the page
     produces further down, and the reader meets one picture rather than two styles of picture. The
     half adder's is deliberately the same figure the previous topic draws, coordinates included: it
     is the same circuit, and a recap that redrew it differently would read as a different one.
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
    },
    /* Two half adders and an OR, which is also exactly what Synthesize produces from the two
       design below: two XORs, since it shares the one both output columns need.
       Laid out in the columns the signal flows through, left to right. */
    'full-adder': {
      caption: 'A full adder: two half adders and an OR - five gates, sharing one XOR result.',
      nodes: [
        { id: 'a', kind: 'in', label: 'a', x: 0, y: 0+14 },
        { id: 'b', kind: 'in', label: 'b', x: 0, y: 90+64 },
        { id: 'cin', kind: 'in', label: 'cin', x: 0, y: 255 },
        { id: 'x1', kind: 'xor', x: 150, y: 20 },
        { id: 'n1', kind: 'and', x: 150, y: 160 },
        { id: 'x2', kind: 'xor', x: 300, y: 90 },
        { id: 'n2', kind: 'and', x: 300, y: 260 },
        { id: 'o1', kind: 'or', x: 450, y: 200 },
        { id: 'sum', kind: 'out', label: 'sum', x: 450, y: 90+10 },
        { id: 'cout', kind: 'out', label: 'cout', x: 600, y: 200+10 }
      ],
      edges: [
        ['a', 'x1', 'a'], ['b', 'x1', 'b'],
        ['a', 'n1', 'a'], ['b', 'n1', 'b'],
        ['x1', 'x2', 'a'], ['cin', 'x2', 'b'],
        ['cin', 'n2', 'a'], ['x1', 'n2', 'b'],
        ['n1', 'o1', 'a'], ['n2', 'o1', 'b'],
        ['x2', 'sum', 'y'], ['o1', 'cout', 'y']
      ]
    }
  },

  /* Three inputs, so the sweep is eight steps and the run is 80 time units - both derived from
     this list rather than written anywhere, which is what stops a table from claiming more rows
     than the stimulus drives. The scale is left at the site default. */
  truthTable: {
    inputs: ['a', 'b', 'cin'],
    outputs: ['sum', 'cout'],
    step: 10,
    sampleAt: 5
  },

  /* One question per marked section, and `sec` is what ties each to the heading it came from: a
     wrong answer links back to that section, with the heading's own words as the link. The two
     bridge sections - the table and the waveform - carry no `data-sec` and no question, being a
     sentence each rather than something to be tested on. The `binary` question the combined topic
     asked - why an adder needs two output wires at all - belongs to the half adder page now, which
     is where the rules of binary addition are set out. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'half',
          q: 'In a half adder, which gate computes the sum?',
          options: ['AND', 'OR', 'XOR', 'NOT'],
          answer: 2
        },
        {
          sec: 'full',
          q: 'What does a full adder have that a half adder does not?',
          options: [
            'A carry in, so a column can accept the carry from the one before it',
            'Four inputs instead of two',
            'A clock, so it can add one column per cycle'
          ],
          answer: 0
        },
        {
          sec: 'full',
          q: 'In a full adder with a = 1, b = 1 and cin = 1, what comes out?',
          options: [
            'sum = 0, cout = 1',
            'sum = 1, cout = 1',
            'sum = 1, cout = 0',
            'sum = 0, cout = 0'
          ],
          answer: 1
        },
        {
          sec: 'verilog',
          q: 'What does <code>a ^ b ^ cin</code> say about the sum bit?',
          options: [
            'It is 1 when an odd number of the three inputs is 1',
            'It is 1 when all three inputs are 1',
            'It is 1 when at least one input is 1'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'The library has a full adder in it. What does the placer draw when you ask for one?',
          options: [
            'Two half adders and an OR - there is no full-adder artwork, so it expands the cell',
            'One rectangle, drawn once by somebody and kept in the library',
            'Nothing: a cell that big cannot be placed in a single row'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'This design names its own cells. Which five?',
          options: [
            'Two XORs sharing their result, two ANDs and an OR',
            'Three XORs, two ANDs and an OR - one XOR per expression',
            'Two half adders, an OR, and a flip-flop to hold the carry'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. Five logic gates instantiated. */
  verilog: String.raw`/* A one-bit full adder.
 *
 * Two outputs, because three bits can add to 3 and that needs two: the sum
 * for this column, and the carry out for the next one along.
 */
module dut(
  input  a,
  input  b,
  input  cin,
  output sum,
  output cout
);

  wire w_xor0, w_and0, w_and1;

  xor_gate u_xor0 (.a(a), .b(b), .y(w_xor0));
  xor_gate u_xor1 (.a(w_xor0), .b(cin), .y(sum));  
  and_gate u_and0 (.a(a), .b(b), .y(w_and0));
  and_gate u_and1 (.a(cin), .b(w_xor0), .y(w_and1));
  or_gate u_or0 (.a(w_and0), .b(w_and1), .y(cout));

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
     stimulus generated from truthTable.inputs, so the eight rows and the eight steps are one
     declaration - counting up in binary, which is the order the table reads them back in. */
  testbench: String.raw`module tb;

  reg  a, b, cin;
  wire sum, cout;

  dut u_dut (.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

  initial begin
    // SWEEP
  end

endmodule
`
};
