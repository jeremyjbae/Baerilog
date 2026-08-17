/* Topic content for the 'decoder-2to4' learn page - the second topic in Combinational, and the mux's
 * mirror image.
 *
 * A MULTIPLEXER TAKES MANY AND PICKS ONE; A DECODER TAKES A NUMBER AND RAISES ONE. That is the whole
 * relationship, and it is why this page follows `mux-2to1` directly: the two are the pair every
 * addressable thing is built from - a decoder chooses which register, row or device is being spoken
 * to, and a mux chooses which one answers.
 *
 * THE DESIGN IS FOUR `assign`s WITH SCALAR PORTS, and both halves of that are deliberate. Four
 * separate output wires is what one-hot IS - a bus would hide it behind a hex digit - and scalars keep
 * the truth table readable: three inputs is eight rows, where a two-bit `sel` plus an enable would
 * need bit-selects the table card cannot name.
 *
 * MEASURED, AND THE COMPARISON IS THE PAGE'S SECOND POINT: the four expressions synthesize to 12 cells
 * at about 14 NAND-equivalents, where the same function written procedurally - an if/else chain in an
 * `always @(*)` - comes out as 22 cells at 32.5, because the tool builds a mux tree for the branches
 * it was given. Same rows, same behaviour, more than twice the area. That is `mux-2to1`'s lesson in the
 * other direction, and it is read off two synthesis runs rather than asserted.
 *
 * THE FOURTH INVERTER IS THE THREAD THIS SITE KEEPS PULLING. The tool builds `~s1` and `~s0` twice
 * each - four inverters where two would do - exactly as the full adder's netlist builds `a ^ b` twice.
 * So the layout figure shares them, which is why it is 10 cells against the netlist's 12, and the page
 * says so rather than leaving the reader to notice a discrepancy.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['decoder-2to4'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="onehot">One wire out of four</h2>
<p>A <a href="learn-mux-2to1.html">2:1 Multiplexer</a> takes several values and passes one of them on.
A <b>decoder</b> does the opposite: it takes a <em>number</em> and raises exactly one wire - the one
that number names.</p>
<p>This one takes two bits, so it has four outputs, and the rule is as simple as it sounds:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">s1</th><th class="in">s0</th><th class="sep"></th>
          <th>y3</th><th>y2</th><th>y1</th><th>y0</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">0</td><td class="in">0</td><td class="sep"></td>
          <td class="zero">0</td><td class="zero">0</td><td class="zero">0</td><td class="one">1</td></tr>
      <tr><td class="in">0</td><td class="in">1</td><td class="sep"></td>
          <td class="zero">0</td><td class="zero">0</td><td class="one">1</td><td class="zero">0</td></tr>
      <tr><td class="in">1</td><td class="in">0</td><td class="sep"></td>
          <td class="zero">0</td><td class="one">1</td><td class="zero">0</td><td class="zero">0</td></tr>
      <tr><td class="in">1</td><td class="in">1</td><td class="sep"></td>
          <td class="one">1</td><td class="zero">0</td><td class="zero">0</td><td class="zero">0</td></tr>
    </tbody>
  </table>
</div>
<p>Exactly one output is 1 in every row, which is called <b>one-hot</b>, and it is the shape of an
answer to the question "which one?". Two bits name four things; three would name eight; the number of
outputs is what the width of the input buys.</p>
<div class="learn-note">
  <b>This is what an address is.</b> A memory with four rows has a two-bit address and a decoder behind
  it, and the one wire that goes high is the row being read. Every "select one of these" in a computer
  is a decoder somewhere.
</div>
<p>There is one more input - <code>en</code>, an <b>enable</b> - and when it is 0 <em>no</em> output is
raised at all. That is how several decoders share one bus: all but one of them is switched off.</p>
` },

    { figure: 'decoder' },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>Four outputs, four lines, and each one says exactly which combination raises it:</p>
<pre class="learn-code">assign y0 = en &amp; ~s1 &amp; ~s0;
assign y1 = en &amp; ~s1 &amp;  s0;</pre>
<p>Read <code>y1</code>'s line as a sentence: "enabled, and <code>s1</code> is 0, and <code>s0</code>
is 1". Every line is the same shape with the inverters in different places, and the pattern of
inverters going down the four lines is the binary counting of the table above - which is what makes
this design so easy to widen: eight outputs is eight lines of three terms.</p>
<p>Press <b>Run Simulation</b>. Three inputs is eight combinations, and the table below is every one of
them - the four rows above plus the four where <code>en</code> is 0 and nothing comes out.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2>Reading it as a table</h2>
<p>Eight rows, read out of the run. The top four are the disabled half - every output 0, whatever the
select bits say - and the bottom four are the table from the top of the page. Read the four output
columns as a group and exactly one of them is 1 in each of those rows, which is the one-hot property
being true rather than claimed.</p>
` },

    { slot: 'truth-table' },

    { html: String.raw`
<h2>...and as a waveform</h2>
<p>The four output rows are worth reading together: they take turns. One goes high, then the next, and
never two at once - a staircase of single pulses walking down the rows as the select bits count up. If
two of them were ever high together, this design would be broken in a way the table might hide but the
plot would not.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="written">How you write it decides what you get</h2>
<p>Those four <code>assign</code>s are not the only way to describe this. The same behaviour written
procedurally - an <code>always @(*)</code> with an <code>if</code> chain choosing which output to set -
reads more like software and gives you a different circuit:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">written as</th><th class="sep"></th><th>cells</th><th>area</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">four expressions</td><td class="sep"></td><td>12</td><td>about 14</td></tr>
      <tr><td class="in">an if/else chain</td><td class="sep"></td><td>22</td><td>about 32.5</td></tr>
    </tbody>
  </table>
</div>
<p><b>More than twice the area for the same eight rows.</b> The reason is the one
<a href="learn-alu-4bit.html">4-Bit ALU</a> is built on: a chain of branches becomes a chain of
<em>multiplexers</em>, because that is what choosing between values looks like in hardware - and here
there was nothing to choose between. The expressions say what each output IS, and gates are all that
takes.</p>
<div class="learn-note">
  <b>Neither is wrong.</b> Procedural style earns its keep the moment a design really is a choice - a
  state machine, or the ALU's four operations. For a decoder it buys a mux tree nobody wanted.
</div>
` },

    { html: String.raw`
<h2 data-sec="netlist">What it becomes as gates</h2>
<p>Press <b>Synthesize</b>. <b>Twelve cells</b>: four inverters and eight ANDs, at about
<b>14 NAND-equivalents</b> - the smallest netlist on the site after the mux and the flip-flop. Each
output is two ANDs deep, because a three-input AND is built from two two-input ones.</p>
<p>And the inverters are worth counting: there are <b>four</b>, for two signals. The tool builds
<code>~s1</code> and <code>~s0</code> once per line that needs them rather than once each and shares
the result - exactly what the <a href="learn-full-adder-1bit.html">1-Bit Full Adder</a> page's third
XOR is. Sharing them is an optimiser's job, and this synthesizer deliberately does not do it: it emits
what the expressions say, cell for cell.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>Here is the design on the wafer with those two inverters shared - <b>ten cells</b> rather than
twelve, which is what an optimiser would have given you:</p>
` },

    { layout: 'the-cells' },

    { html: String.raw`
<p><b>239.2 &micro;m</b> in a single row, and it is the flattest picture on the site: ten cells, no
carry running along them, nothing waiting for anything. A decoder is pure fan-out - two inputs
reaching eight gates - and that is why it is fast, and why the wires matter more than the gates do.</p>
<p>Read the row and you can see the pairing: an AND for the select combination, and a second AND to let
the enable through. Widen the design to three select bits and it is the same picture twice as long,
with a third input reaching every gate.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>A decoder and a <a href="learn-mux-2to1.html">multiplexer</a> back to back is how anything with an
address works: the decoder picks who is being written, the mux picks who is being read. Put those
either side of four <a href="learn-register-4bit.html">registers</a> and you have a register file,
which is the box a processor keeps its numbers in. And
<a href="learn-logic-gates.html">Logic Gates</a> goes the other way, into the mask layers these ten
cells are drawn as.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Five questions on one-hot outputs, enables, and what style costs. A wrong answer says so and links
back to the section it came from; the score at the foot of the panel is what the Learn hub shows beside
this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE FIGURE: the design as gates, with the two inverters SHARED - which is what the silicon figure
     places and one cell fewer per input than the netlist card shows. Drawn as two columns of ANDs
     because each output really is two deep: the select combination first, then the enable.

     Only y0 and y1 are drawn. All four would be the same picture twice as tall with nothing new in it,
     and the prose says the pattern of inverters going down the lines is the binary counting - which a
     reader can then check against the netlist card rather than against a wall of boxes.

     Pin positions are the viewer's own: an AND is 52 x 52 with a at 20%, b at 80% and y at 50%, and an
     inverter is 49 x 35 with its single input at mid-height. The left column keeps 56px between port
     boxes, the closest the harness's 22px caption band allows. */
  figures: {
    'decoder': {
      caption: 'Two of the four outputs: an AND for the combination, an AND for the enable.',
      nodes: [
        { id: 'en', kind: 'in', label: 'en', x: 0, y: 0 },
        { id: 's1', kind: 'in', label: 's1', x: 0, y: 56 },
        { id: 's0', kind: 'in', label: 's0', x: 0, y: 112 },
        { id: 'n1', kind: 'not', label: 'not', x: 150, y: 60 },
        { id: 'n0', kind: 'not', label: 'not', x: 150, y: 120 },
        { id: 'a0', kind: 'and', label: 'and', x: 260, y: 60 },
        { id: 'a1', kind: 'and', label: 'and', x: 260, y: 160 },
        { id: 'b0', kind: 'and', label: 'and', x: 370, y: 8 },
        { id: 'b1', kind: 'and', label: 'and', x: 370, y: 210 },
        { id: 'y0', kind: 'out', label: 'y0', x: 480, y: 18 },
        { id: 'y1', kind: 'out', label: 'y1', x: 480, y: 220 }
      ],
      edges: [
        ['s1', 'n1', 'a'], ['s0', 'n0', 'a'],
        ['n1', 'a0', 'a'], ['n0', 'a0', 'b'],
        ['n1', 'a1', 'a'], ['s0', 'a1', 'b'],
        ['a0', 'b0', 'a'], ['en', 'b0', 'b'],
        ['a1', 'b1', 'a'], ['en', 'b1', 'b'],
        ['b0', 'y0', 'y'], ['b1', 'y1', 'y']
      ]
    }
  },

  /* Three inputs, so the sweep is eight steps. `en` is named FIRST, which puts the four disabled rows
     at the top of the table as a block - the prose asks the reader to read it in halves, and the sweep
     counts up over this list in order, so the first column is the one that moves slowest. */
  truthTable: {
    inputs: ['en', 's1', 's0'],
    outputs: ['y3', 'y2', 'y1', 'y0'],
    step: 10,
    sampleAt: 5
  },

  /* One question per marked section. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'onehot',
          q: 'What does a decoder do that a multiplexer does not?',
          options: [
            'It takes a number and raises the one wire that number names',
            'It picks one of several values and passes it on',
            'It remembers which wire was raised last'
          ],
          answer: 0
        },
        {
          sec: 'onehot',
          q: 'What is <code>en</code> for?',
          options: [
            'With en at 0 no output is raised at all, so several decoders can share one bus',
            'It selects between the two select bits',
            'It clocks the decoder, so the outputs change in step'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'What does <code>assign y1 = en &amp; ~s1 &amp; s0;</code> say?',
          options: [
            'y1 is 1 when the decoder is enabled and the select bits are 01',
            'y1 is 1 whenever s0 is 1, unless s1 is also 1',
            'y1 is the enable delayed by one gate'
          ],
          answer: 0
        },
        {
          sec: 'written',
          q: 'Why does the procedural version cost more than twice the area?',
          options: [
            'A chain of branches becomes a chain of multiplexers, and here there was nothing to choose between',
            'It uses wider gates, which are dearer per input',
            'The tool cannot optimise an always block at all'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'The netlist has four inverters for two signals. Why?',
          options: [
            'The tool emits what each expression says, so ~s1 and ~s0 are each built twice',
            'Each output needs its own inverter, so four outputs need four',
            'Two of them are buffers, added to make the fan-out reach every gate'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'Nothing in this layout waits for anything. What makes a decoder fast?',
          options: [
            'It is pure fan-out - two inputs reaching eight gates, with no chain through it',
            'The cells are smaller than the adder\'s, so signals cross them sooner',
            'The enable arrives last, which lets the other gates settle first'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. Four continuous assignments and SCALAR ports - four separate wires is what one-hot is,
     and it keeps the truth table's columns nameable. */
  verilog: String.raw`/* A 2:4 decoder: two bits in, one of four wires out.
 *
 * Exactly one output is 1 at a time - which is called one-hot - and the
 * select bits say which. This is what an address is: two bits name four
 * things, and the wire that goes high is the one being spoken to.
 *
 * en switches the whole thing off. With en at 0 every output is 0, so
 * several decoders can share a bus and only one of them drives it.
 */
module dut(
  input  s1,
  input  s0,
  input  en,
  output y0,
  output y1,
  output y2,
  output y3
);

  assign y0 = en & ~s1 & ~s0;
  assign y1 = en & ~s1 &  s0;
  assign y2 = en &  s1 & ~s0;
  assign y3 = en &  s1 &  s0;

endmodule
`,

  /* The hidden testbench: the wrapper only. The line reading SWEEP is replaced by learn.js with a
     stimulus generated from truthTable.inputs, so the eight rows and the eight steps are one
     declaration - counting up in binary, which is the order the table reads them back in. */
  testbench: String.raw`module tb;

  reg  s1, s0, en;
  wire y0, y1, y2, y3;

  dut u_dut (.s1(s1), .s0(s0), .en(en), .y0(y0), .y1(y1), .y2(y2), .y3(y3));

  initial begin
    // SWEEP
  end

endmodule
`,

  /* THE PLACEMENT: a netlist written out, and the one place this page's figure and its netlist card
     deliberately disagree - the figure SHARES the two inverters where the synthesizer builds four, so
     it is ten cells against twelve, and the prose says which is which. Ten cells fit one row at
     239.2 x 46.8 um (5.1:1), so `rowPx: 100` is under the ~106 the column allows at that aspect and
     the figure grows into its box. No cross section or animation: `logic-gates` teaches the process. */
  layouts: {
    'the-cells': {
      caption: 'The decoder as ten cells in one row, with its two inverters shared.',
      view: 'all',
      rowPx: 100,
      netlist: String.raw`module the_cells(
  input  s1, s0, en,
  output y0, y1, y2, y3
);

  not_gate v1 (.a(s1), .y(ns1));
  not_gate v0 (.a(s0), .y(ns0));

  and_gate c0 (.a(ns1), .b(ns0), .y(t0));
  and_gate e0 (.a(t0),  .b(en),  .y(y0));
  and_gate c1 (.a(ns1), .b(s0),  .y(t1));
  and_gate e1 (.a(t1),  .b(en),  .y(y1));
  and_gate c2 (.a(s1),  .b(ns0), .y(t2));
  and_gate e2 (.a(t2),  .b(en),  .y(y2));
  and_gate c3 (.a(s1),  .b(s0),  .y(t3));
  and_gate e3 (.a(t3),  .b(en),  .y(y3));

endmodule
`
    }
  }
};
