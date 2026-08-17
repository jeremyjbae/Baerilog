/* Topic content for the 'alu-4bit' learn page - the last topic in Arithmetic, and the one that puts
 * `mux-2to1` and the adder run together into a block that does FOUR jobs.
 *
 * THE POINT IS NOT THE ARITHMETIC. Every operation in it is a page the reader already has: the adder
 * is `ripple-carry-4bit`, and the AND, OR and XOR are `logic-gates` four bits wide. What is new is
 * that one block does a DIFFERENT one of them depending on a control input - which is the step from a
 * circuit to an instruction, and the reason a processor has a single ALU rather than one block per
 * operation.
 *
 * AND THE LESSON UNDERNEATH IT IS THAT HARDWARE DOES NOT BRANCH. A `case` reads like a choice of what
 * to do, and in software it is one; here all four results are computed on every input, every time, and
 * the muxes throw three of them away. Measured on the synthesizer: 26 cells, of which twelve are
 * multiplexers - nearly half the design is the choosing rather than the computing. That is the page's
 * central fact and it is read off the netlist card rather than asserted.
 *
 * THE OP DECODE IS DELIBERATELY NOT DRAWN. `op` is two bits, and the twelve muxes are a tree: op[0]
 * picks within each pair and op[1] picks between the pairs. The figure draws that as three muxes on
 * one bit slice, because a fourth level of detail - the xnor/and pairs the tool builds to compare `op`
 * against each constant - is the synthesizer's business and would put nine more boxes in a picture
 * whose subject is the tree.
 *
 * ONE LAYOUT FIGURE, and it wraps to ONE ROW PER BIT: 36 cells at 600 lambda comes out as four rows of
 * nine, which is the four bit slices of the design, in order. That is the tidiest wrap any topic here
 * gets and it is not luck - a slice is 568 lambda wide, so the row width was chosen just above it.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['alu-4bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="many">One block, four jobs</h2>
<p>Every circuit on this site does one thing. An adder adds; an AND ands; a register holds. A
processor cannot be built that way - it would need a separate block for every operation it can
perform, all of them idle except the one in use - so instead it has <b>one</b> block that can do all
of them, and an input that says which.</p>
<p>That block is the <b>ALU</b>: the arithmetic and logic unit. This one takes two four-bit numbers, a
two-bit <code>op</code>, and does whichever of four operations <code>op</code> names:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">op</th><th class="sep"></th><th>y</th><th>from</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">00</td><td class="sep"></td><td>a + b</td><td>the 4-bit adder</td></tr>
      <tr><td class="in">01</td><td class="sep"></td><td>a &amp; b</td><td>four ANDs</td></tr>
      <tr><td class="in">10</td><td class="sep"></td><td>a | b</td><td>four ORs</td></tr>
      <tr><td class="in">11</td><td class="sep"></td><td>a ^ b</td><td>four XORs</td></tr>
    </tbody>
  </table>
</div>
<p>Nothing in that table is new. What is new is <code>op</code> - a <b>control</b> input, the kind
<a href="learn-mux-2to1.html">2:1 Multiplexer</a> introduces, which does not join in the answer but
decides where the answer comes from. An instruction, in other words, is mostly a value on an
<code>op</code>.</p>
` },

    { html: String.raw`
<h2 data-sec="tree">All four, all the time</h2>
<p>Here is the part that surprises everyone who comes from software. The design does not <em>pick</em>
an operation and perform it. It performs <b>all four</b>, on every input, always - and then a tree of
multiplexers throws three of the answers away.</p>
<div class="learn-note">
  <b>There is no branch in hardware.</b> The adder cannot be skipped: it is four columns of gates with
  values on their inputs, and gates do not wait to be asked. Choosing happens <em>after</em>
  everything has been computed, which is exactly what a mux is for.
</div>
<p>Two bits of <code>op</code> means two levels of choosing: <code>op[0]</code> picks within each pair
of results, and <code>op[1]</code> picks between the pairs. Three muxes per bit of output, and the
same <code>op</code> wires reach all of them:</p>
` },

    { figure: 'alu-slice' },

    { html: String.raw`
<p>Four bits of output means four copies of that - the four function blocks are four bits wide, and
the mux tree is repeated per bit. Which is where the cost of an ALU lives: not in the arithmetic, but
in the choosing, done once for every bit of the answer.</p>
` },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>A <code>case</code> over <code>op</code>, in a combinational block:</p>
<pre class="learn-code">case (op)
2'd0:    y = a + b;
2'd1:    y = a &amp; b;
2'd2:    y = a | b;
default: y = a ^ b;
endcase</pre>
<p>Three things about it are worth reading carefully, and the first is the block it sits in.</p>
<h3>1. <code>always @(*)</code> is not a clock</h3>
<p>The flip-flop pages use <code>always @(posedge clk)</code> - one instant per cycle. This block is
sensitive to <code>*</code>, meaning <em>everything it reads</em>, so it re-runs whenever
<code>a</code>, <code>b</code> or <code>op</code> moves. That is how a combinational circuit is
written procedurally, and there is no memory anywhere in it.</p>
<h3>2. <code>=</code>, not <code>&lt;=</code></h3>
<p>Combinational logic gets the blocking assignment. The nonblocking form is for state that lands at
the end of a clock edge, and there is no edge here at all - <code>y</code> is a wire in everything but
name.</p>
<h3>3. The <code>default</code> is not optional</h3>
<p>Every branch of this case assigns <code>y</code>, and one of the branches is a <code>default</code>
that catches whatever is left. Leave a value of <code>op</code> with no assignment and you are asking
the tool to remember <code>y</code> from last time - which means a latch, in a design that was meant
to have no memory in it. Most synthesizers refuse; this one does too.</p>
<p>Press <b>Run Simulation</b>. The testbench holds one pair of numbers and walks <code>op</code>
through all four values, then changes the numbers and walks it again.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="waveform">Reading it as a waveform</h2>
<p>Four bits each for <code>a</code>, <code>b</code> and <code>y</code>, so those are value boxes;
<code>op</code> is two bits, so it is a box too. Read down the <code>op</code> row and the
<code>y</code> box changes with it while <code>a</code> and <code>b</code> sit still - which is the
whole idea of the page in one picture: same data, different instruction, different answer.</p>
<p>And nothing here waits for a clock, because there is no clock. Every change to <code>y</code>
happens at the instant an input moves.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="netlist">What the tool builds from it</h2>
<p>Press <b>Synthesize</b>. <b>26 cells</b>, and the split is the page's argument:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">cells</th><th class="sep"></th><th>what they are</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">1</td><td class="sep"></td><td>the generated four-bit adder, chain and all</td></tr>
      <tr><td class="in">12</td><td class="sep"></td><td>four ANDs, four ORs, four XORs - one per bit each</td></tr>
      <tr><td class="in">12</td><td class="sep"></td><td>multiplexers: the tree, three per bit of output</td></tr>
      <tr><td class="in">1</td><td class="sep"></td><td>a constant, wired where the design names one</td></tr>
    </tbody>
  </table>
</div>
<p><b>Nearly half of this design is the choosing.</b> Twelve muxes against thirteen cells of actual
arithmetic and logic - and that is with only four operations. Add a fifth and the tree grows again,
which is why a real instruction set has fewer distinct operations than you might expect and why they
share hardware wherever they can (subtraction reuses the adder, comparison reuses subtraction).</p>
<p>The report prices the lot at about <b>84 NAND-equivalents</b>, the biggest design on the site so
far - and the adder inside it is a block you can double-click into, exactly as on the
<a href="learn-adder-8bit.html">8-Bit Adder</a> page.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>Thirty-six cells on the wafer, and the placer's rows land exactly on the design's structure: <b>one
row per bit of the answer</b>, nine cells each. Read along a row and it is one bit slice - the adder
column for that bit, its AND, its OR, its XOR, and the three muxes that pick between them:</p>
` },

    { layout: 'the-slices' },

    { html: String.raw`
<p><b>369.2 &micro;m</b> by <b>187.2 &micro;m</b>: four rows, and the widest picture-to-cell count
this site has drawn. It is thirty-six cells rather than the netlist's twenty-six because the layout
library has no full-adder artwork - each adder column arrives as two half adders and an OR, the
expansion the <a href="learn-full-adder-1bit.html">1-Bit Full Adder</a> page introduces - so the
arithmetic costs a little more here than the Console's count suggests.</p>
<p>Four identical rows is what a datapath looks like. A processor's registers, adders and ALUs are all
built as one bit slice repeated as many times as the machine is wide, and the wires that run
<em>across</em> the slices - the carry, and the <code>op</code> that has to reach every mux - are the
part that decides how fast the whole thing can go.</p>
<p>As on the other wide topics, this figure carries <b>a netlist written out for it</b>: the design is
a case statement over buses, and the placer reads plain nets. It is the same structure with one wire
per bit.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>An ALU and a <a href="learn-register-4bit.html">4-Bit Register</a> are most of a processor: the
register holds the numbers, the ALU does something to them, and an <code>op</code> chosen by an
instruction says what. <a href="learn-counter-4bit.html">4-Bit Counter</a> is the other piece - the
thing that decides which instruction comes next - and <a href="learn-logic-gates.html">Logic
Gates</a> goes the other way, into the mask layers all thirty-six of these cells are drawn as.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Seven questions on control, choosing, and what an ALU spends its area on. A wrong answer says so and
links back to the section it came from; the score at the foot of the panel is what the Learn hub shows
beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE FIGURE: a bit slice, because that is what the design and the layout both are four of. The four
     function blocks on the left all read the same two inputs - a fan-out of one wire to four pins,
     which the drawer handles by giving each edge its own route - and the three muxes on the right are
     the tree: two picking within their pair, one picking between them.

     THE OP DECODE IS NOT HERE, deliberately: `op` reaches all three muxes as one label, where the
     synthesizer really builds a small comparator per value of it. That is a level of detail below the
     subject, and drawing it would put nine more boxes in the picture.

     Pin positions are the viewer's own: an adder is 85 x 124 (a at 15/95, b at 65/95, sum at 30/95),
     an AND and an OR are 52 x 52 and an XOR 59 x 52 (a at 20%, b at 80%, y at 50%), and a mux2 is
     36 x 42 (sel at 13%, a at 50%, b at 87%). Columns are 22px-band clear of each other. */
  figures: {
    'alu-slice': {
      caption: 'One bit of the ALU: all four operations computed, three of them thrown away.',
      nodes: [
        { id: 'a', kind: 'in', label: 'a', x: 0, y: 3+50 },
        { id: 'b', kind: 'in', label: 'b', x: 0, y: 69+50 },
        { id: 'op', kind: 'in', label: 'op', x: 200, y: 0 },
        { id: 'add', kind: 'add', label: 'add', x: 170, y: 0+50 },
        { id: 'an', kind: 'and', label: 'and', x: 170, y: 150+50 },
        { id: 'orr', kind: 'or', label: 'or', x: 170, y: 225+50 },
        { id: 'xr', kind: 'xor', label: 'xor', x: 170, y: 310+50 },
        { id: 'm0', kind: 'mux2', label: 'mux2', x: 350, y: 44+60 },
        { id: 'm1', kind: 'mux2', label: 'mux2', x: 350, y: 240+50 },
        { id: 'm2', kind: 'mux2', label: 'mux2', x: 440, y: 142 +50},
        { id: 'y', kind: 'out', label: 'y', x: 560, y: 147+50 }
      ],
      edges: [
        ['a', 'add', 'a'], ['b', 'add', 'b'],
        ['a', 'an', 'a'], ['b', 'an', 'b'],
        ['a', 'orr', 'a'], ['b', 'orr', 'b'],
        ['a', 'xr', 'a'], ['b', 'xr', 'b'],
        ['add', 'm0', 'a', 'sum'], ['an', 'm0', 'b'],
        ['orr', 'm1', 'a'], ['xr', 'm1', 'b'],
        ['m0', 'm2', 'a', 'y'], ['m1', 'm2', 'b', 'y'],
        ['op', 'm0', 'sel'], ['op', 'm1', 'sel'], ['op', 'm2', 'sel'],
        ['m2', 'y', 'y', 'y']
      ]
    }
  },

  /* No truth table card: ten inputs is 1,024 rows, and the card is generated over the whole input
     space or not at all - see `ripple-carry-4bit` for the same decision at eight. The four rows that
     matter are in the prose as prose, the waveform is where the run is read, and 90 time units is the
     eight steps the testbench drives at 10 apiece plus its settling delays. */
  maxTime: 90,

  /* One question per marked section, and `tree` is asked twice, being the section this page exists
     for: that everything is computed, and that the choosing is what it costs. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'many',
          q: 'What kind of input is <code>op</code>?',
          options: [
            'A control - it does not join in the answer, it decides which answer comes out',
            'A third operand, added to a and b like any other number',
            'A clock, since something has to tell the block when to start'
          ],
          answer: 0
        },
        {
          sec: 'tree',
          q: 'When op says 01, what is the adder doing?',
          options: [
            'Adding, as always - its answer is computed and then thrown away by the muxes',
            'Nothing: the case statement skips it, the way software skips an unrun branch',
            'Holding its last result until op asks for it again'
          ],
          answer: 0
        },
        {
          sec: 'tree',
          q: 'Why does two bits of op mean two levels of multiplexer?',
          options: [
            'Each mux chooses between two things, so choosing among four takes a pair and then one more',
            'One level per bit of the widest operand, and the operands are four bits',
            'The first level chooses the operation and the second checks the result'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'Why must every branch of the case assign <code>y</code>?',
          options: [
            'A branch that does not is asking the block to remember y - which is a latch, in a circuit meant to have no memory',
            'Because the simulator reports an error otherwise',
            'It need not: the tool fills in 0 for any branch that says nothing'
          ],
          answer: 0
        },
        {
          sec: 'waveform',
          q: 'a and b sit still while op walks through its four values. What does the y row do?',
          options: [
            'It changes with op - same data, different instruction, different answer',
            'It holds, because y only updates when the data changes',
            'It changes once per clock edge, as the flip-flop pages do'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'Twelve of the 26 cells are multiplexers. What does that say about an ALU?',
          options: [
            'Nearly half of it is the choosing rather than the computing',
            'The tool built a mux where a gate would have done, and a better one would not',
            'The muxes are the four operations, one mux each'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'The layout is four rows of nine cells. What is one row?',
          options: [
            'One bit of the answer: that bit\'s adder column, its three logic gates and its three muxes',
            'One of the four operations, laid out across all four bits',
            'A quarter of the design chosen by the placer to fill the width'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. A combinational `case` - the first on the site - and the `default` is load-bearing:
     without it one value of `op` would leave `y` unassigned, which is a latch this synthesizer
     refuses to infer. */
  verilog: String.raw`/* A 4-bit ALU: one block, four operations, chosen by op.
 *
 * always @(*) is combinational - it re-runs whenever anything it reads
 * moves, so there is no clock and no memory here. Combinational logic gets
 * the blocking assignment, =, where state gets <=.
 *
 * All four operations happen on every input. Nothing is skipped: the tool
 * builds an adder, four ANDs, four ORs and four XORs, and a tree of
 * multiplexers picks one answer and discards the rest.
 *
 * The default is not optional. Leave a value of op with no assignment and
 * y would have to be remembered from last time, which is a latch in a
 * circuit meant to have none.
 */
module dut(
  input  [3:0] a,
  input  [3:0] b,
  input  [1:0] op,
  output reg [3:0] y
);

  always @(*) begin
    case (op)
      2'd0:    y = a + b;
      2'd1:    y = a & b;
      2'd2:    y = a | b;
      default: y = a ^ b;
    endcase
  end

endmodule
`,

  /* The hidden testbench: one pair of numbers walked through all four operations, then another pair.
     The delays are what let a combinational block settle before the line is printed - a process that
     never yields reads the value from before its own write, so an input change and a read of what it
     feeds need a delay between them. */
  testbench: String.raw`module tb;

  reg  [3:0] a, b;
  reg  [1:0] op;
  wire [3:0] y;

  dut u_dut (.a(a), .b(b), .op(op), .y(y));

  initial begin
    a = 4'd9; b = 4'd5;
    op = 2'd0; #10; $display("t=%d  a=%h b=%h op=%b -> y=%h   9 + 5 = 14", $time, a, b, op, y);
    op = 2'd1; #10; $display("t=%d  a=%h b=%h op=%b -> y=%h   1001 & 0101", $time, a, b, op, y);
    op = 2'd2; #10; $display("t=%d  a=%h b=%h op=%b -> y=%h   1001 | 0101", $time, a, b, op, y);
    op = 2'd3; #10; $display("t=%d  a=%h b=%h op=%b -> y=%h   1001 ^ 0101", $time, a, b, op, y);

    a = 4'd15; b = 4'd1;
    op = 2'd0; #10; $display("t=%d  a=%h b=%h op=%b -> y=%h   15 + 1 wraps to 0", $time, a, b, op, y);
    op = 2'd1; #10; $display("t=%d  a=%h b=%h op=%b -> y=%h", $time, a, b, op, y);
    op = 2'd2; #10; $display("t=%d  a=%h b=%h op=%b -> y=%h", $time, a, b, op, y);
    op = 2'd3; #10; $display("t=%d  a=%h b=%h op=%b -> y=%h", $time, a, b, op, y);
    $finish;
  end

endmodule
`,

  /* THE PLACEMENT: a netlist written out, since the design is a case over buses and pnr reads plain
     nets. Written SLICE BY SLICE - adder column, AND, OR, XOR, three muxes - so `rowWidth: 600` breaks
     it exactly at the slice boundary: a slice is 568 lambda, so four rows of nine cells is one row per
     bit of the answer. `rowPx` is PER ROW, so 60 is 240px for the four, under the ~275 the column
     allows at this aspect. The `fa_gate`s arrive as two half adders and an OR each, which is why the
     figure is 36 cells where the netlist card counts 26. */
  layouts: {
    'the-slices': {
      caption: 'Four bit slices, one to a row: the adder column, its three gates, and its three muxes.',
      view: 'all',
      rowWidth: 600,
      rowPx: 60,
      netlist: String.raw`module the_slices(
  input  a0, b0, a1, b1, a2, b2, a3, b3,
  input  s0, s1,
  output y0, y1, y2, y3
);

  fa_gate   ad0 (.a(a0), .b(b0), .cin(cin0), .sum(sm0), .cout(c1));
  and_gate  an0 (.a(a0), .b(b0), .y(g0));
  or_gate   or0 (.a(a0), .b(b0), .y(o0));
  xor_gate  xr0 (.a(a0), .b(b0), .y(x0));
  mux2_gate p0a (.a(sm0), .b(g0), .sel(s0), .y(t0));
  mux2_gate p0b (.a(o0),  .b(x0), .sel(s0), .y(u0));
  mux2_gate p0c (.a(t0),  .b(u0), .sel(s1), .y(y0));

  fa_gate   ad1 (.a(a1), .b(b1), .cin(c1), .sum(sm1), .cout(c2));
  and_gate  an1 (.a(a1), .b(b1), .y(g1));
  or_gate   or1 (.a(a1), .b(b1), .y(o1));
  xor_gate  xr1 (.a(a1), .b(b1), .y(x1));
  mux2_gate p1a (.a(sm1), .b(g1), .sel(s0), .y(t1));
  mux2_gate p1b (.a(o1),  .b(x1), .sel(s0), .y(u1));
  mux2_gate p1c (.a(t1),  .b(u1), .sel(s1), .y(y1));

  fa_gate   ad2 (.a(a2), .b(b2), .cin(c2), .sum(sm2), .cout(c3));
  and_gate  an2 (.a(a2), .b(b2), .y(g2));
  or_gate   or2 (.a(a2), .b(b2), .y(o2));
  xor_gate  xr2 (.a(a2), .b(b2), .y(x2));
  mux2_gate p2a (.a(sm2), .b(g2), .sel(s0), .y(t2));
  mux2_gate p2b (.a(o2),  .b(x2), .sel(s0), .y(u2));
  mux2_gate p2c (.a(t2),  .b(u2), .sel(s1), .y(y2));

  fa_gate   ad3 (.a(a3), .b(b3), .cin(c3), .sum(sm3), .cout(c4));
  and_gate  an3 (.a(a3), .b(b3), .y(g3));
  or_gate   or3 (.a(a3), .b(b3), .y(o3));
  xor_gate  xr3 (.a(a3), .b(b3), .y(x3));
  mux2_gate p3a (.a(sm3), .b(g3), .sel(s0), .y(t3));
  mux2_gate p3b (.a(o3),  .b(x3), .sel(s0), .y(u3));
  mux2_gate p3c (.a(t3),  .b(u3), .sel(s1), .y(y3));

endmodule
`
    }
  }
};
