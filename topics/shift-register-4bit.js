/* Topic content for the 'shift-register-4bit' learn page - the fourth topic in Sequential, and the
 * cheapest sequential design there is: four flip-flops and no logic at all.
 *
 * `register-4bit` puts four flops SIDE BY SIDE and gives them each their own input. This page chains
 * them: each flop's output is the next one's input, so a bit put in at one end walks along by one place
 * per clock edge. Same four cells, one wire different, and a completely different circuit - which is
 * the point worth having, because it is the first time on this site that the WIRING alone is the
 * design.
 *
 * MEASURED, AND THAT IS THE PAGE'S FACT: `q <= {q[2:0], sin};` synthesizes to FOUR CELLS, all of them
 * flip-flops, at about 24 NAND-equivalents. No gates, no muxes, nothing inferred - because a
 * concatenation is not an operation, it is a statement about which wire goes where. Every other
 * sequential design on the site has logic in front of its flops; this one has none.
 *
 * SO THE LAYOUT IS ONE ROW OF FOUR IDENTICAL CELLS, and the shape says the thing: the data walks along
 * the row, one cell per edge, which is what "shift" means. It is left unwrapped for exactly that reason
 * - a wrapped figure would break the chain in the middle of the picture.
 *
 * SERIAL IN, PARALLEL OUT is the use the page ends on, and it is the reason this circuit is everywhere:
 * one wire and a clock carry a whole word if you are willing to spend four cycles on it, which is what
 * every SPI, UART and scan chain does.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['shift-register-4bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="chain">Four flops in a line</h2>
<p>The <a href="learn-register-4bit.html">4-Bit Register</a> is four flip-flops side by side. Each one
has its own input, they all share a clock, and at every edge four bits land together.</p>
<p>Change one thing - <b>give each flop the one before it as its input</b> - and the same four cells do
something else entirely:</p>
<div class="learn-note">
  <b>At every clock edge, every bit moves one place along.</b> A new bit comes in at one end, the bit
  at the far end falls off, and nothing is computed anywhere: this circuit has no gates in it at all.
</div>
<p>That is a <b>shift register</b>, and the only difference between it and the register page's design is
where the wires go. Same cells, same clock, same reset - a different picture.</p>
` },

    { figure: 'chain' },

    { html: String.raw`
<p>Follow <code>sin</code> along the row: it lands in the first flop at the next edge, moves to the
second at the one after, and reaches the far end after four. So the row is a queue four deep, and the
number in <code>q</code> is the last four bits that arrived, oldest at the top.</p>
` },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>Two lines in the clocked block, and the second contains no operator at all:</p>
<pre class="learn-code">if (!rst_n) q &lt;= 4'd0;
else        q &lt;= {q[2:0], sin};</pre>
<p>The braces are a <b>concatenation</b> - the same notation the
<a href="learn-adder-8bit.html">8-Bit Adder</a> uses to catch its ninth bit, here on the right of the
assignment instead of the left. Read it as "the new <code>q</code> is the old <code>q</code>'s bottom
three bits, with <code>sin</code> stuck on the end".</p>
<div class="learn-note">
  <b>Nothing in that line computes.</b> <code>q[2:0]</code> selects three of the four wires the flops
  already drive, and the concatenation says which flop each one goes to. It is wiring written as an
  expression, which is why the netlist below has no gates in it.
</div>
<p>And the <code>&lt;=</code> is doing real work for once. All four flops sample at the same instant, so
each one has to see the OLD value of its neighbour - which is exactly what the nonblocking assignment
guarantees. Write it with <code>=</code> and you are describing something that reads its own new value
partway through the edge; a real synthesizer would build a different circuit, and a wrong one.</p>
<p>Press <b>Run Simulation</b>. The testbench feeds a pattern in one bit at a time and then holds
<code>sin</code> low, so you can watch the pattern walk along the row and then walk off the end.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="waveform">Reading it as a waveform</h2>
<p><code>q</code> is four bits, so it is a row of value boxes - and this is the one design on the site
where reading it in <b>hex</b> is the wrong instinct. Watch the boxes as a bit pattern instead:
<code>1</code>, then <code>3</code>, then <code>6</code>, then <code>d</code> - which as bits is
<code>0001</code>, <code>0011</code>, <code>0110</code>, <code>1101</code>. The same ones and zeros,
each one a place further left every cycle.</p>
<p>Then <code>sin</code> goes low and the pattern keeps walking, with zeros arriving behind it, until
the row is empty again. Nothing decided that - it is the only thing this circuit can do.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="netlist">What the tool builds from it</h2>
<p>Press <b>Synthesize</b>. <b>Four cells, and all four are flip-flops</b> - about
<b>24 NAND-equivalents</b>, the smallest sequential netlist on the site.</p>
<p>There is <em>nothing</em> else in it. The register page's design has a multiplexer per bit, because
"hold what you have" is a choice and a choice is a circuit; the counter's has an adder, because
"one more" is arithmetic. This page's line asks for neither, so the tool has nothing to infer and the
netlist is the four cells with wires between them.</p>
<p>Which makes it worth looking at the diagram rather than reading the count: the flops are in a line,
each one's <code>q</code> going to the next one's <code>d</code>, and the clock and reset fanning out to
all four. That picture <em>is</em> the design.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>Four identical cells in a single row, which is the closest this site gets to a picture of pure
storage:</p>
` },

    { layout: 'the-chain' },

    { html: String.raw`
<p><b>374.4 &micro;m</b> long and <b>46.8 &micro;m</b> tall - one row, four flops, and the data walks
along it one cell per clock edge. It is left unwrapped deliberately: the shape of the picture is the
behaviour of the circuit, and a row broken in the middle would say the chain breaks there too.</p>
<p>Compare it with the <a href="learn-register-4bit.html">4-Bit Register</a>'s strip, which is the same
four flops with a multiplexer between each pair. Both hold four bits; the difference in area is what
being able to <em>hold</em> a value costs, on top of being able to store one.</p>
<p>As on the other wide topics, this figure carries <b>a netlist written out for it</b>: the design is
one clocked block over a bus, and the placer reads plain nets. It is the same four cells with one wire
per bit.</p>
` },

    { html: String.raw`
<h2 data-sec="serial">One wire, four bits</h2>
<p>A shift register is how a whole word travels on a single wire. Put four bits in one at a time, wait
four edges, and read all four off <code>q</code> at once - <b>serial in, parallel out</b> - and the
reverse works too: load four bits and shift them out one per cycle.</p>
<div class="learn-note">
  <b>That trade is everywhere.</b> Four wires and one cycle, or one wire and four cycles: SPI, UART, I2C
  and the scan chain a chip is tested through are all this circuit, wide enough for the word they carry.
</div>
<p>It is also why a shift register turns up wherever pins are scarce. A chip with too few legs to drive
eight LEDs drives one shift register instead, and spends eight clock edges rather than eight pins.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>The three sequential pages are the same four flops wired three ways: side by side is a
<a href="learn-register-4bit.html">register</a>, in a line is this, and through an adder is a
<a href="learn-counter-4bit.html">counter</a>. Everything else with state is those parts plus logic that
decides what the next value should be. And <a href="learn-logic-gates.html">Logic Gates</a> goes the
other way, into the mask layers one of these flops is drawn as.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Six questions on chaining, concatenation and what a shift register is for. A wrong answer says so and
links back to the section it came from; the score at the foot of the panel is what the Learn hub shows
beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE FIGURE: the chain, drawn left to right, because that is the direction the data moves and the
     row of cells in the layout below has the same shape. The clock and the reset fan out to all four
     flops - four edges each from one port - which is what makes this the site's clearest picture of a
     signal that has to arrive everywhere at once.

     A dff is 59 x 59 in the viewer's pixel space with d at a third of its height, rstn at two thirds,
     q at a third on the right and CLK ON THE BOTTOM EDGE, so the clock port sits below the row and its
     wires come up into the cells. The flops are 110px apart, which leaves room for the router's own
     22px leader off each bottom pin. */
  figures: {
    'chain': {
      caption: 'Four flip-flops in a line: each one\'s output is the next one\'s input.',
      nodes: [
        { id: 'sin', kind: 'in', label: 'sin', x: 0, y: 0 },
        { id: 'rstn', kind: 'in', label: 'rst_n', x: 0, y: 60 },
        { id: 'clk', kind: 'in', label: 'clk', x: 0, y: 150 },
        { id: 'f0', kind: 'dff', label: 'dff', x: 150, y: 0 },
        { id: 'f1', kind: 'dff', label: 'dff', x: 270, y: 0 },
        { id: 'f2', kind: 'dff', label: 'dff', x: 390, y: 0 },
        { id: 'f3', kind: 'dff', label: 'dff', x: 510, y: 0 },
        { id: 'q3', kind: 'out', label: 'q[3]', x: 630, y: 4 }
      ],
      edges: [
        ['sin', 'f0', 'd'],
        ['f0', 'f1', 'd', 'q'], ['f1', 'f2', 'd', 'q'], ['f2', 'f3', 'd', 'q'],
        ['f3', 'q3', 'y', 'q'],
        ['rstn', 'f0', 'rstn'], ['rstn', 'f1', 'rstn'], ['rstn', 'f2', 'rstn'], ['rstn', 'f3', 'rstn'],
        ['clk', 'f0', 'clk'], ['clk', 'f1', 'clk'], ['clk', 'f2', 'clk'], ['clk', 'f3', 'clk']
      ]
    }
  },

  /* No truth table: four bits of state and a clock, so a row of that card would be one input
     combination sampled once and say nothing about a pattern walking along a row. 140 time units is
     fourteen cycles of the testbench's `always #5` clock, which is enough to shift a four-bit pattern
     all the way in and all the way out again. */
  maxTime: 140,

  /* One question per marked section. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'chain',
          q: 'What is the only difference between this and the 4-bit register?',
          options: [
            'Where the wires go - each flop takes the one before it instead of its own input',
            'The clock, which arrives at each flop a cycle later than the last',
            'The cells: a shift register uses a different kind of flip-flop'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'What does <code>{q[2:0], sin}</code> do?',
          options: [
            'Nothing computational - it says which wire goes to which flop',
            'It shifts q left by one, which is an operation the tool builds a shifter for',
            'It adds sin to q, since a concatenation is a sum of shifted parts'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'Why does the nonblocking assignment matter here in particular?',
          options: [
            'All four flops sample at once, so each must see its neighbour\'s OLD value',
            'It is what makes the shift happen left rather than right',
            'It stops the reset from being applied twice in one edge'
          ],
          answer: 0
        },
        {
          sec: 'waveform',
          q: 'The q boxes read 1, 3, 6, d. What is happening?',
          options: [
            'The same bit pattern moving one place left each cycle: 0001, 0011, 0110, 1101',
            'The count going up, since a shift register counts in powers of two',
            'Four separate values being loaded, one per cycle'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'Why does this netlist have no gates at all, when the register\'s has four muxes?',
          options: [
            'This design asks for no choice and no arithmetic, so there is nothing to infer',
            'The tool optimised them away, because shifting is free',
            'The gates are inside the flip-flop cells on this page but not on that one'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'Why is this layout left as one row rather than wrapped?',
          options: [
            'The shape of the row is the behaviour - the data walks along it, and a break would say the chain breaks',
            'Four cells are too few to wrap',
            'A wrapped row would put the clock on the wrong side of the flops'
          ],
          answer: 0
        },
        {
          sec: 'serial',
          q: 'What does a shift register buy?',
          options: [
            'A whole word on one wire, at the price of one clock edge per bit',
            'A faster clock, since only one bit moves at a time',
            'Storage that survives a reset, unlike a plain register'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. One clocked block, four bits of state, no logic - and the reset in the sensitivity list,
     the form the library's flop has a pin for and the same shape the other sequential topics use. */
  verilog: String.raw`/* A 4-bit shift register: four flip-flops in a line.
 *
 * At every clock edge each flop takes the value of the one before it, so a
 * bit put in at sin walks along by one place per edge and falls off the far
 * end after four.
 *
 * The braces are a concatenation, and they compute nothing: q[2:0] is three
 * of the wires the flops already drive, and the concatenation says which
 * flop each one goes to. That is why this design has no gates in it.
 *
 * <= is doing real work here. All four flops sample at the same instant, so
 * each one has to see its neighbour's OLD value - which is exactly what the
 * nonblocking assignment means.
 */
module dut(
  input        clk,
  input        rst_n,
  input        sin,
  output reg [3:0] q
);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) q <= 4'd0;
    else        q <= {q[2:0], sin};
  end

endmodule
`,

  /* The hidden testbench. A free-running clock, and the pattern 1011 fed in one bit at a time - low bit
     first, so it reads left to right in the waveform as it walks. Then sin is held low and the run
     carries on long enough for the pattern to leave the register entirely, which is the second half of
     what the waveform section asks the reader to look at. */
  testbench: String.raw`module tb;

  reg  clk, rst_n, sin;
  wire [3:0] q;

  dut u_dut (.clk(clk), .rst_n(rst_n), .sin(sin), .q(q));

  always #5 clk = ~clk;

  initial begin
    clk = 0; rst_n = 0; sin = 0;
    @(negedge clk); $display("t=%d  sin=%b -> q=%b   reset holds it empty", $time, sin, q);

    rst_n = 1; sin = 1;
    @(negedge clk); $display("t=%d  sin=%b -> q=%b   a 1 walked in", $time, sin, q);
    sin = 1;
    @(negedge clk); $display("t=%d  sin=%b -> q=%b", $time, sin, q);
    sin = 0;
    @(negedge clk); $display("t=%d  sin=%b -> q=%b", $time, sin, q);
    sin = 1;
    @(negedge clk); $display("t=%d  sin=%b -> q=%b   the whole pattern is in", $time, sin, q);

    sin = 0;
    @(negedge clk); $display("t=%d  sin=%b -> q=%b   zeros behind it now", $time, sin, q);
    @(negedge clk); $display("t=%d  sin=%b -> q=%b", $time, sin, q);
    @(negedge clk); $display("t=%d  sin=%b -> q=%b", $time, sin, q);
    @(negedge clk); $display("t=%d  sin=%b -> q=%b   and it has walked off the end", $time, sin, q);

    rst_n = 0;
    #2 $display("t=%d  sin=%b -> q=%b   the reset cleared it with no edge", $time, sin, q);
    @(negedge clk);
    $finish;
  end

endmodule
`,

  /* THE PLACEMENT: a netlist written out, since the design is one clocked block over a bus and pnr reads
     plain nets. Deliberately UNWRAPPED - no `rowWidth` - because the row's shape is the circuit's
     behaviour: four cells in a line, data walking along them. One row at 8:1 means `rowPx` has to be
     small, and 65 is under the ~67 the column allows at that aspect. */
  layouts: {
    'the-chain': {
      caption: 'Four flip-flop cells in one row, in the order the data walks along them.',
      view: 'all',
      rowPx: 65,
      netlist: String.raw`module the_chain(
  input  clk, rstn, sin,
  output q0, q1, q2, q3
);

  dff_gate f0 (.d(sin), .clk(clk), .rstn(rstn), .q(q0));
  dff_gate f1 (.d(q0),  .clk(clk), .rstn(rstn), .q(q1));
  dff_gate f2 (.d(q1),  .clk(clk), .rstn(rstn), .q(q2));
  dff_gate f3 (.d(q2),  .clk(clk), .rstn(rstn), .q(q3));

endmodule
`
    }
  }
};
