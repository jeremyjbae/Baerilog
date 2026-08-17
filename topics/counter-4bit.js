/* Topic content for the 'counter-4bit' learn page - the third topic in Sequential, and the one the
 * flip-flop page promises: an adder in front of a register, feeding its own output back.
 *
 * IT IS THE FIRST PAGE THAT NEEDS BOTH HALVES OF THE SITE. Everything in Arithmetic computes and
 * forgets; everything in Sequential remembers and does not compute. A counter is the smallest useful
 * thing you get by wiring the two together, and the whole design is one line: `count <= count + 1`,
 * where the left and right sides are the same register.
 *
 * WHICH MAKES THE FEEDBACK THE SUBJECT. `register-4bit` has a loop already - the enable's mux reading
 * q back - but it loops a value round unchanged; here it goes through an ADDER on the way, so the
 * state is a function of itself. That is what a state machine is, and this is the smallest one.
 *
 * AN INCREMENTER IS A CHAIN OF HALF ADDERS, which is the fact the silicon section is built on and it
 * is measured rather than reasoned: adding a constant 1 gives every column one bit and a carry to add
 * instead of two bits and a carry, and a half adder is exactly the cell for that. So the layout is
 * four `ha_gate`s and four `dff_gate`s - the adder pages' cell and the flip-flop page's cell, in one
 * row - which is the site's two halves in one picture.
 *
 * THE CARRY OUT IS DROPPED, and the page says so rather than letting it look like an oversight: the
 * top column's carry has nowhere to go, so 15 + 1 is 0 and the counter wraps. That is the same
 * arithmetic the 4-bit adder's overflow section describes, in the one case where it is wanted.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['counter-4bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="count">Counting is adding to yourself</h2>
<p>Two pages ago a <a href="learn-register-4bit.html">4-Bit Register</a> held a number until something
gave it a new one. Four pages before that, a <a href="learn-ripple-carry-4bit.html">4-Bit
Ripple-Carry Adder</a> added two numbers and forgot them immediately. Wire the output of the register
into the adder and the answer back into the register, and it <b>counts</b>.</p>
<p>That is the entire circuit. There is nothing in a counter that is not in those two pages - what is
new is the <em>direction</em>: for the first time on this site, a value goes round in a circle rather
than from left to right.</p>
<div class="learn-note">
  <b>Every circuit before Sequential runs forwards.</b> Inputs on the left, outputs on the right, and
  a wire that went backwards would be a combinational loop - a value chasing itself with nothing to
  stop it. A flip-flop is what makes a loop legal: it holds the value for a whole cycle, so the trip
  round happens once per clock edge instead of as fast as the gates allow.
</div>
` },

    { html: String.raw`
<h2 data-sec="feedback">The loop, drawn</h2>
<p>Read it as one lap per clock edge: the register's current value goes into the adder, the adder adds
<b>1</b> to it, the answer waits on the flop's <code>d</code> pin, and the next edge makes it the new
current value. Nothing else is connected to the adder at all - one of its two inputs is a constant,
which is what makes this an <b>incrementer</b> rather than an adder.</p>
` },

    { figure: 'loop' },

    { html: String.raw`
<p>Notice what is <em>not</em> wired: the adder's carry out. Four bits of count means the top
column's carry has nowhere to go, so it is dropped on the floor - which is exactly why the counter
wraps, and the section after the waveform is about that.</p>
` },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>Two lines in the clocked block, and the second is the first line on this site with the same
signal on both sides of an assignment:</p>
<pre class="learn-code">if (!rst_n) count &lt;= 4'd0;
else        count &lt;= count + 4'd1;</pre>
<p>Read it in two halves at the edge. <code>count</code> on the RIGHT is what the register holds
<em>now</em>; <code>count</code> on the LEFT is what it will hold after this edge. The
<code>&lt;=</code> is what keeps those two apart - it works the right-hand side out from the current
value and lands the answer at the end of the instant, so there is no moment where the counter reads
half of its own new value.</p>
<div class="learn-note">
  <b>Write it with <code>=</code> instead</b> and you are asking for something else entirely: the
  blocking form assigns immediately, so a design with several of these in one block would see values
  from halfway through the edge. In a clocked block, state gets <code>&lt;=</code>.
</div>
<p>Press <b>Run Simulation</b>. The testbench releases the reset and then leaves the clock running
for twenty cycles, which is more than a four-bit counter has values for - so the interesting part is
what happens at the end.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="waveform">Reading it as a waveform</h2>
<p><code>count</code> is four bits wide, so it is drawn as a row of labelled value boxes: 0, 1, 2, 3
and on, one box per clock cycle, each one changing at a rising edge and holding flat in between. That
staircase is the whole behaviour of the design, and it is worth noticing how <em>regular</em> it is -
one edge, one increment, forever, with no input telling it to.</p>
<p>Then find the box after <code>f</code>. It is <code>0</code>, and the counter carries on from there
as though nothing happened.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="wrap">What happens after 15</h2>
<p>Four bits hold 0 to 15. The adder is asked for 15 + 1, which is 16, and 16 needs five bits - so
the fifth bit is the adder's carry out, and the carry out is not connected to anything. What lands in
the register is the low four bits of 16, which are <code>0000</code>.</p>
<div class="learn-note">
  <b>15 + 1 = 0</b> is not a bug in the counter; it is the same overflow the
  <a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry Adder</a> page measures, with the carry
  deliberately thrown away. A counter that must not wrap needs a fifth bit, or a comparison that
  stops it.
</div>
<p>Wrapping is usually what you want. A counter that divides a clock, or walks through a fixed number
of states, is supposed to come back round - and this is why almost every counter you meet is described
by the number of bits it has rather than by the number it counts to.</p>
` },

    { html: String.raw`
<h2 data-sec="netlist">What the tool builds from it</h2>
<p>Press <b>Synthesize</b>. Two kinds of thing: <b>four flip-flops</b>, one per bit of
<code>count</code>, and <b>one adder block</b> the tool generated for the <code>+</code> - the same
<code>FUNC_add4</code> shape the <a href="learn-adder-8bit.html">8-Bit Adder</a> page's one line
produced, four bits wide. Double-click it and there is the ripple-carry chain, written by the tool.</p>
<p>The constant is in there too, drawn as its own little node: the <b>1</b> the design adds is not an
input, so it is wired in as a fixed value. And no cell anywhere came from the reset - the flops have
a pin for it, because this design's reset is asynchronous.</p>
<p>What the report prices at about <b>62 NAND-equivalents</b> is mostly the flops and the adder in
roughly equal measure, which is the honest shape of a counter: remembering and computing cost about
the same here.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>On the wafer the adder is not four full adders. Adding a <em>constant</em> 1 is a smaller job than
adding a second number: every column gets one bit and a carry rather than two bits and a carry, and
the cell for that is the <b>half adder</b> from
<a href="learn-half-adder-1bit.html">1-Bit Half Adder</a>. So a four-bit incrementer is four
<code>ha_gate</code>s in a carry chain, and the whole counter is those four plus the four flops:</p>
` },

    { layout: 'the-counter' },

    { html: String.raw`
<p><b>312 &micro;m</b> by <b>93.6 &micro;m</b>, eight cells, two rows - and it is the first picture on
this site with a cell from each half of it: the half adder the arithmetic pages built up to, and the
flip-flop the sequential ones start from. A counter really is just those two things next to each
other.</p>
<p>Read the pairs and the flop is the wider cell again, as it was on the register page. Remembering
one bit costs more silicon than adding one does - which is worth keeping in mind when a design has a
choice about how much state to carry.</p>
<p>As on the other wide topics, this figure carries <b>a netlist written out for it</b>: the design is
one <code>always</code> block with a bus in it, and the placer reads plain nets. It is the same eight
cells with one wire per bit, and the carry chain running along the row.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>A counter is a state machine whose only rule is "add one", and everything with more interesting
rules is built the same way: a register holding the state, and logic in front of it working out the
next one. <a href="learn-alu-4bit.html">4-Bit ALU</a> is the logic half made general - one block that
adds, ands, ors or xors depending on a control input - and
<a href="learn-logic-gates.html">Logic Gates</a> goes the other way, into the mask layers one of
these cells is drawn as.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Six questions on loops, wrapping, and what a counter is made of. A wrong answer says so and links
back to the section it came from; the score at the foot of the panel is what the Learn hub shows
beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE FIGURE: the loop. Drawn in the viewer's own symbols, so the adder is the same shape the
     netlist card draws for a generated adder and the flop is the same cell the register page used.

     THE CARRY OUT IS DELIBERATELY UNWIRED - a pin with no edge on it - because that is the fact the
     wrap section turns into arithmetic. A figure that tied it to something would be a different
     circuit, and one that hid the pin would be a different symbol.

     Pin positions are the viewer's: an adder is 85 x 124 with a at 15/95 of its height, b at 65/95,
     cin on the BOTTOM edge and sum/cout at 30/95 and 50/95 on the right; a dff is 59 x 59 with d at a
     third, rstn at two thirds, q at a third on the right and clk on the bottom. The left column keeps
     56px between boxes, which is the closest the harness's 22px caption band allows. */
  figures: {
    'loop': {
      caption: 'A counter: the register\'s value goes round through an adder that adds one.',
      nodes: [
        { id: 'one', kind: 'const', label: "4'd1", x: 212, y: 131 },
        { id: 'rstn', kind: 'in', label: 'rst_n', x: 0, y: 83 },
        { id: 'clk', kind: 'in', label: 'clk', x: 0, y: 139 },
        { id: 'inc', kind: 'add', label: 'add', x: 300, y: 60 },
        { id: 'ff', kind: 'dff', label: 'dff', x: 150, y: 60 },
        { id: 'cnt', kind: 'out', label: 'count', x: 300, y: 0 }
      ],
      edges: [
        ['one', 'inc', 'b'],
        ['inc', 'ff', 'd', 'sum'],
        ['rstn', 'ff', 'rstn'], ['clk', 'ff', 'clk'],
        ['ff', 'cnt', 'y', 'q'],
        ['ff', 'inc', 'a', 'q']
      ]
    }
  },

  /* No truth table: the design has state and one input that is a clock, so a row of that card would be
     one combination sampled once and say nothing about the staircase. 200 time units is twenty cycles
     of the testbench's `always #5` clock, which is more than the sixteen values a four-bit counter
     has - the wrap is the point, so the run has to be long enough to reach it. */
  maxTime: 200,

  /* One question per marked section, and `wrap` is asked twice: it is the arithmetic the page exists
     to explain, and both halves are worth having - where the missing bit went, and whether it is a
     fault. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'count',
          q: 'What makes a wire that goes backwards legal here, when a combinational loop is not?',
          options: [
            'The flip-flop holds the value for a cycle, so the lap happens once per clock edge',
            'The adder only reads its input once, so nothing can chase itself',
            'It is not legal - the tool cuts the loop and warns about it'
          ],
          answer: 0
        },
        {
          sec: 'feedback',
          q: 'One of the adder\'s inputs is a constant 1. What does that make it?',
          options: [
            'An incrementer - a smaller job than adding a second number',
            'A comparator, since it only ever checks against one value',
            'An adder with half of its input wasted'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'In <code>count &lt;= count + 4\'d1;</code>, what is the <code>count</code> on the right?',
          options: [
            'What the register holds now - the left one is what it will hold after this edge',
            'The same thing as the left one, which is why the line needs a nonblocking assignment',
            'The adder\'s output, read back before the edge'
          ],
          answer: 0
        },
        {
          sec: 'waveform',
          q: 'The count row is a staircase that changes only at rising edges. What is holding it flat in between?',
          options: [
            'The flip-flops - they keep their value until the next edge, whatever the adder is doing',
            'The adder, which takes a whole cycle to work out the next value',
            'Nothing: the count is genuinely changing, and the viewer samples it once per cycle'
          ],
          answer: 0
        },
        {
          sec: 'wrap',
          q: 'Where does the missing bit go when 15 + 1 lands in the register as 0?',
          options: [
            'It is the adder\'s carry out, and nothing is connected to it',
            'It is stored in a fifth flip-flop the tool adds for overflow',
            'It is lost inside the adder, which cannot represent 16 at all'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'The netlist has one adder block rather than four full adders. Why one?',
          options: [
            'The tool generated a four-bit adder for the +, with the ripple-carry chain inside it',
            'A four-bit count only needs one adder, since the carry does the other three columns',
            'The other three were optimised away, because adding 1 only affects the low bit'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'Why are the adder cells in the layout <em>half</em> adders?',
          options: [
            'Adding a constant 1 gives each column one bit and a carry, which is what a half adder takes',
            'Half adders are cheaper, and the tool accepts the loss of the carry out',
            'They are full adders drawn small, since only four bits are involved'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. One clocked block, four bits of state, and the reset in the sensitivity list - the
     form the library's flop has a pin for, and the same shape `register-4bit` uses. */
  verilog: String.raw`/* A 4-bit counter: an adder in front of a register, feeding itself.
 *
 * count is on both sides of the assignment. On the right it is what the
 * register holds now; on the left it is what the next clock edge will make
 * it. <= is what keeps those two apart.
 *
 * One of the adder's inputs is the constant 1, which makes it an
 * incrementer - and its carry out is not connected to anything, so 15 + 1
 * lands as 0 and the counter wraps.
 *
 * The reset is ASYNCHRONOUS: negedge rst_n is in the sensitivity list, so
 * count clears the moment rst_n falls, with no clock edge needed.
 */
module dut(
  input        clk,
  input        rst_n,
  output reg [3:0] count
);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) count <= 4'd0;
    else        count <= count + 4'd1;
  end

endmodule
`,

  /* The hidden testbench. A free-running clock and no loops in this Verilog subset, so the run is a
     few narrated edges and then a long delay - `#120` is twelve more cycles, which is what carries the
     count past 15 without writing out twelve identical lines. */
  testbench: String.raw`module tb;

  reg  clk, rst_n;
  wire [3:0] count;

  dut u_dut (.clk(clk), .rst_n(rst_n), .count(count));

  always #5 clk = ~clk;

  initial begin
    clk = 0; rst_n = 0;
    @(negedge clk); $display("t=%d  rst_n=%b -> count=%h   reset holds it at 0", $time, rst_n, count);

    rst_n = 1;
    @(negedge clk); $display("t=%d  rst_n=%b -> count=%h   one edge, one increment", $time, rst_n, count);
    @(negedge clk); $display("t=%d  rst_n=%b -> count=%h", $time, rst_n, count);
    @(negedge clk); $display("t=%d  rst_n=%b -> count=%h", $time, rst_n, count);

    #120;
    $display("t=%d  rst_n=%b -> count=%h   twelve cycles later, past 15 and round again", $time, rst_n, count);

    rst_n = 0;
    #2 $display("t=%d  rst_n=%b -> count=%h   the reset cleared it with no edge", $time, rst_n, count);
    @(negedge clk);
    $finish;
  end

endmodule
`,

  /* THE PLACEMENT: a netlist written out, since the design is one always block over a bus and pnr
     reads plain nets. Interleaved half adder, flop, half adder, flop - so a ROW is bit slices rather
     than four adders followed by four flops - and `rowWidth: 500` breaks after two slices: 312 x 93.6
     um. `rowPx` is PER ROW, so 75 is 150px for the two rows, under the ~162 the column allows at this
     aspect. No cross section or animation: what this page adds is which two cells a counter is. */
  layouts: {
    'the-counter': {
      caption: 'Eight cells: a half adder and a flip-flop per bit, two slices to a row.',
      view: 'all',
      rowWidth: 500,
      rowPx: 75,
      netlist: String.raw`module the_counter(
  input  clk, rstn,
  output q0, q1, q2, q3
);

  ha_gate  h0 (.a(q0), .b(one), .sum(n0), .cout(c1));
  dff_gate f0 (.d(n0), .clk(clk), .rstn(rstn), .q(q0));
  ha_gate  h1 (.a(q1), .b(c1),  .sum(n1), .cout(c2));
  dff_gate f1 (.d(n1), .clk(clk), .rstn(rstn), .q(q1));
  ha_gate  h2 (.a(q2), .b(c2),  .sum(n2), .cout(c3));
  dff_gate f2 (.d(n2), .clk(clk), .rstn(rstn), .q(q2));
  ha_gate  h3 (.a(q3), .b(c3),  .sum(n3), .cout(c4));
  dff_gate f3 (.d(n3), .clk(clk), .rstn(rstn), .q(q3));

endmodule
`
    }
  }
};
