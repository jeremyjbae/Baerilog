/* Topic content for the 'alu-4bit-opt' learn page - the same ALU as the page before it, with its two
 * adders shared down to one, and the first topic here whose subject is a REWRITE rather than a circuit.
 *
 * THE PREVIOUS PAGE PREDICTS THIS ONE. `alu-4bit` reads its netlist and finds eight full adders in two
 * chains, because `a + b` and `a - b` are two demands; its note says a processor would share one adder
 * and invert b, and that the trade is four muxes for a whole ripple-carry chain. This page makes that
 * edit and reads the report again. So the pair is a measurement, not an opinion.
 *
 * AND THE HEADLINE IS THAT IT GETS BIGGER AND SMALLER AT ONCE: 34 cells become 37, and 99 NAND
 * equivalents become 77.75. Cell COUNT is not area, and the report is the only thing here that can settle
 * which one moved the right way. That is the page's central fact and every number in it is read off the
 * Console rather than typed from memory.
 *
 * THE MUXES ARE THE PRETTY PART, and they are worth checking rather than trusting: the total does not
 * move (12 either way), but the tree drops from three per bit to two - merging `2'd0, 2'd1` removed a
 * level - and the four muxes that frees are spent selecting b or ~b in front of the shared adder.
 * Measured from the netlist by select net: four on op[0], eight on the decoded op. Exactly the trade
 * the previous page names.
 *
 * THE BIT YOU SELECT ON IS THE ONE THAT BITES. Inside `case (2'd0, 2'd1)` the top bit of op is always
 * 0, so `op[1] ? ~b : b` never inverts and the subtraction comes out as a + b + 1. It looks right,
 * simulates, synthesizes, and is wrong on exactly the four inputs where op is 01 - which is why the
 * hidden testbench compares against a plain ALU over the whole input space instead of spot-checking.
 *
 * ONE LAYOUT FIGURE at nine cells per row against the previous page's twelve, which is the area saving
 * as a picture: one adder column per slice instead of two.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['alu-4bit-opt'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="why">One adder, not two</h2>
<p>The <a href="learn-alu-4bit.html">4-Bit ALU</a> works, and its netlist says something awkward about
it. Press Synthesize there and the Console lists <b>two</b> generated blocks - a
<code>FUNC_add4</code> and a <code>FUNC_sub4</code>, eight full adders between them - because the design
asks for <code>a + b</code> on one line and <code>a - b</code> on another, and the tool reads those as
two separate demands. Both chains compute on every input; the muxes throw one away.</p>
<p>A processor does not spend hardware that way, and the trick it uses is the one
<a href="learn-subtractor-4bit.html">4-Bit Subtractor</a> arrives at:</p>
<div class="learn-note">
  <b>a - b is a + (~b) + 1.</b> So an adder can subtract, provided something flips every bit of
  <code>b</code> on the way in and the carry into the bottom bit is 1 instead of 0. Both of those are
  cheap: an inverter and a mux per bit, and a single wire for the carry.
</div>
<p>And on this ALU the thing that decides which of the two arithmetic operations is wanted is already
sitting there: <code>op[0]</code> is 0 for add and 1 for subtract. It can drive the inversion
<em>and</em> the carry in, because it is the same question in both places.</p>
` },

    { html: String.raw`
<h2 data-sec="code">The edit</h2>
<p>Two case branches become one, and the arithmetic is written once:</p>
<pre class="learn-code">case (op)
2'd0, 2'd1:  y = a + (op[0] ? ~b : b) + op[0];
2'd2:        y = a &amp; b;
default:     y = a | b;
endcase</pre>
<p>Read the arithmetic line as three separate decisions that all happen to be answered by the same
bit. <code>op[0] ? ~b : b</code> is the inversion; <code>+ op[0]</code> is the carry into the bottom
bit; and the branch label <code>2'd0, 2'd1</code> is what says both of them belong to one piece of
hardware rather than two.</p>
<div class="learn-note">
  <b>The bit you select on is the one that bites.</b> Inside a branch labelled <code>2'd0, 2'd1</code>
  the top bit of <code>op</code> is always 0 - that is what those two labels have in common - so
  writing <code>op[1] ? ~b : b</code> never inverts anything, and the subtraction quietly comes out as
  <code>a + b + 1</code>. It parses, it simulates, it synthesizes, and it is wrong on exactly the
  quarter of the input space where <code>op</code> is <code>01</code>. Which is the argument for the
  testbench below.
</div>
<p>As a bit slice, the edit is one box fewer and one moved: the second adder column is gone, and a mux
has appeared in front of the one that is left.</p>
` },

    { figure: 'shared-slice' },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="equal">Proving it is the same circuit</h2>
<p>An optimization is only an optimization if the answers do not move, and "it looked right when I
tried it" is not a proof for a block with ten input bits. So the hidden testbench holds <b>both</b>
designs at once - this one, and a plain ALU written the way the previous page writes it - and drives
them from the same wires through <b>every one of the 1,024 combinations</b> of <code>a</code>,
<code>b</code> and <code>op</code>, counting the places they disagree.</p>
<p>Press <b>Run Simulation</b>. The Console prints one line per operation for a readable start, then
the sweep's verdict. Zero mismatches out of 1,024 is the whole claim of this page; write
<code>op[1]</code> in place of <code>op[0]</code> and the same testbench reports <b>256</b> of
them.</p>
<p>The waveform is worth a look for the same reason: <code>y</code> and <code>y_ref</code> are the two
designs' outputs, drawn as two rows that never differ anywhere in the sweep.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="area">What it costs, measured both ways</h2>
<p>Press <b>Synthesize</b> and compare the Console with the previous page's:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in"></th><th class="sep"></th><th>4-Bit ALU</th><th>this page</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">cells</td><td class="sep"></td><td>34</td><td>37</td></tr>
      <tr><td class="in">area</td><td class="sep"></td><td>99.00</td><td>77.75</td></tr>
      <tr><td class="in">full adders</td><td class="sep"></td><td>8, in two chains</td><td>4, in one</td></tr>
      <tr><td class="in">their area</td><td class="sep"></td><td>62.00</td><td>31.00</td></tr>
      <tr><td class="in">multiplexers</td><td class="sep"></td><td>12</td><td>12</td></tr>
      <tr><td class="in">generated blocks</td><td class="sep"></td><td>FUNC_add4, FUNC_sub4</td><td>FUNC_add4</td></tr>
    </tbody>
  </table>
</div>
<p><b>It got bigger and smaller at the same time.</b> Eight more cells, and sixteen fewer
NAND-equivalents - about a sixth of the design gone. Both numbers are true and they are answers to
different questions: the count says how many pieces there are, the area says how much silicon they
occupy. Halving the adder chain gave back 31 of those units; the inverters, the carry logic and the
op decode that replaced it cost 15 of them.</p>
<div class="learn-note">
  <b>Cell count is not area.</b> A full adder is 7.75 NAND-equivalents and an inverter is 0.75, so
  trading one adder for four small gates is a win even though it is three more cells. This is the
  reason a report prices a design instead of counting it, and the reason "fewer gates" is not the same
  claim as "smaller".
</div>
<p>The multiplexers are the elegant part, and the total hiding a change is what makes them worth
reading twice. Twelve either way - but on the previous page all twelve are the tree, three per bit of
output, and here <b>eight</b> are the tree and <b>four</b> sit in front of the adder choosing
<code>b</code> or <code>~b</code>. Merging the two arithmetic branches took a level out of the tree,
and the four muxes it freed are exactly what the sharing needed. The previous page predicts that
trade - four muxes for a whole ripple-carry chain - and this is it, paid.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>Thirty-six cells on the wafer, and the rows still land on the design's structure: <b>one row per bit
of the answer</b>, nine cells each where the previous page needs twelve. Read along a row and the
saving is the thing that is missing - one adder column instead of two, with an inverter and a mux in
front of the one that is left:</p>
` },

    { layout: 'the-slices' },

    { html: String.raw`
<p><b>343.2 &micro;m</b> by <b>187.2 &micro;m</b> against the ALU's 494 by 187.2: same four rows, a
third of the width gone, and the height untouched because a row is still one bit. That is what a
sixth of the area looks like when you can see it - and it is the same lesson the
<a href="learn-integrated-circuits.html">Integrated Circuits</a> page opens with, that area is money
and every gate is charged for.</p>
<p>What did <em>not</em> get better is the depth. The shared adder now sits behind a mux, so the
longest path through the block is one gate longer than it was, and a carry still ripples through four
stages. Sharing hardware trades area for time, which is the trade every processor makes somewhere -
and the one this site's <a href="learn-alu-4bit.html">4-Bit ALU</a> pair exists to show you can
measure.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>This is the last of Arithmetic, and the pattern it leaves you with is the working method rather than
the circuit: write it plainly, read what the tool built, find the thing built twice, and rewrite it
once. <a href="learn-register-4bit.html">4-Bit Register</a> and
<a href="learn-counter-4bit.html">4-Bit Counter</a> are the pieces that go around an ALU, and
<a href="learn-design-tools.html">Design Tools</a> is where the report you have been reading comes
from.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Six questions on sharing hardware, and on the difference between counting a design and pricing it.
A wrong answer says so and links back to the section it came from; the score at the foot of the panel
is what the Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE FIGURE: the shared slice, drawn so the difference from the previous page's figure is what a
     reader notices - four function boxes became three, and a mux moved to the left of the adder.

     The inverter and the b-select are the subject, so they are the only nodes with room around them.
     `add` draws no carry-in stub, since nothing in this picture wires one; the carry is prose. */
  figures: {
    'shared-slice': {
      caption: 'One bit of the shared ALU: op[0] picks b or ~b on the way into the single adder, and two muxes pick the answer.',
      nodes: [
        { id: 'a', kind: 'in', label: 'a', x: 0, y: 60 },
        { id: 'b', kind: 'in', label: 'b', x: 0, y: 150 },
        { id: 'op', kind: 'in', label: 'op', x: 210, y: 0 },
        { id: 'nb', kind: 'not', label: 'not', x: 110, y: 230 },
        { id: 'bs', kind: 'mux2', label: 'mux2', x: 240, y: 170 },
        { id: 'add', kind: 'add', label: 'add', x: 360, y: 40 },
        { id: 'an', kind: 'and', label: 'and', x: 240, y: 300 },
        { id: 'orr', kind: 'or', label: 'or', x: 240, y: 375 },
        { id: 'm1', kind: 'mux2', label: 'mux2', x: 400, y: 320 },
        { id: 'm2', kind: 'mux2', label: 'mux2', x: 500, y: 200 },
        { id: 'y', kind: 'out', label: 'y', x: 620, y: 205 }
      ],
      edges: [
        ['b', 'nb', 'a'],
        ['b', 'bs', 'a'], ['nb', 'bs', 'b'],
        ['a', 'add', 'a'], ['bs', 'add', 'b'],
        ['a', 'an', 'a'], ['b', 'an', 'b'],
        ['a', 'orr', 'a'], ['b', 'orr', 'b'],
        ['an', 'm1', 'a'], ['orr', 'm1', 'b'],
        ['add', 'm2', 'a', 'sum'], ['m1', 'm2', 'b', 'y'],
        ['op', 'bs', 'sel'], ['op', 'm1', 'sel'], ['op', 'm2', 'sel'],
        ['m2', 'y', 'y', 'y']
      ]
    }
  },

  /* No truth table card, for `alu-4bit`'s reason: ten inputs is 1,024 rows and the card is generated
     over the whole space or not at all. The run instead sweeps that space in the testbench, which is
     what the equivalence section is about, so the length is the sweep's: 1,024 probes at one time unit
     each after a readable four-step walk at ten. */
  maxTime: 1120,

  /* One question per marked section, and `area` is asked twice - it is the section this page exists
     for, and its two halves (the count went up, the area went down) are separate facts. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'why',
          q: 'Why did the previous page\'s ALU contain two adder chains?',
          options: [
            'It asks for a + b and a - b on separate lines, and the tool reads those as two demands',
            'A subtractor is a different circuit from an adder, so it needs its own chain',
            'One chain adds the low two bits and the other the high two'
          ],
          answer: 0
        },
        {
          sec: 'code',
          q: 'The arithmetic line uses op[0] three times over. What would op[1] do there instead?',
          options: [
            'Nothing: inside a 2\'d0, 2\'d1 branch the top bit is always 0, so it would never invert b',
            'The same thing, since either bit distinguishes add from subtract',
            'Invert b for the logic operations as well, which is harmless'
          ],
          answer: 0
        },
        {
          sec: 'equal',
          q: 'Why does the testbench drive all 1,024 input combinations instead of a handful?',
          options: [
            'A rewrite can be wrong on part of the input space and right everywhere you looked',
            'The waveform needs that many steps to be readable',
            'The synthesizer refuses a design it has not seen exercised'
          ],
          answer: 0
        },
        {
          sec: 'area',
          q: 'The rewrite has 37 cells against 34, and 77.75 NAND-equivalents against 99. Which is the improvement?',
          options: [
            'The area: it is the silicon the design occupies, where the count is just how many pieces',
            'Neither - more cells means a bigger design however it is priced',
            'The count, because every cell costs a placement site'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'The layout is four rows of nine cells where the previous page needs twelve. What is missing from each row?',
          options: [
            'One adder column - the second chain, which the sharing removed',
            'Three muxes, since the tree lost a whole level',
            'The logic gates, which the shared adder now computes as well'
          ],
          answer: 0
        },
        {
          sec: 'area',
          q: 'Both designs have twelve multiplexers. What changed?',
          options: [
            'The tree lost a level and those four muxes moved to the front of the adder, choosing b or ~b',
            'Nothing - the muxes are the one part the rewrite could not touch',
            'Four muxes became inverters, which is where the area saving comes from'
          ],
          answer: 0
        }
      ]
    }
  },

  verilog: String.raw`/* A 4-bit ALU with ONE adder, shared between add and subtract.
 *
 * a - b is a + (~b) + 1, so an adder can do both jobs: invert every bit of
 * b on the way in, and carry a 1 into the bottom bit. op[0] is 0 for add
 * and 1 for subtract, so the same bit answers both questions - and the two
 * case labels on one branch are what says the two operations share hardware.
 *
 * Careful with WHICH bit. Inside a 2'd0, 2'd1 branch, op[1] is always 0 -
 * that is what those labels have in common - so op[1] ? ~b : b would never
 * invert anything, and subtraction would come out as a + b + 1. It is wrong
 * on exactly the quarter of the input space where op is 01, which is what
 * the testbench's sweep is for.
 *
 * The result is 37 cells against the plain version's 34, and 77.75
 * NAND-equivalents against 99: more pieces, less silicon.
 */
module dut(
  input  [3:0] a,
  input  [3:0] b,
  input  [1:0] op,
  output reg [3:0] y
);

  always @(*) begin
    case (op)
      2'd0, 2'd1:  y = a + (op[0] ? ~b : b) + op[0];
      2'd2:        y = a & b;
      default:     y = a | b;
    endcase
  end

endmodule
`,

  /* The hidden testbench is an EQUIVALENCE CHECK, not a demonstration: it carries a second ALU written
     the plain way - the previous page's design, four separate branches - and drives both from the same
     wires over the whole input space, counting disagreements. That is the only kind of evidence a
     rewrite deserves, and it is cheap here because the space is 1,024 wide.

     The readable walk comes FIRST, at ten time units a step, so the waveform opens on something a
     reader can follow; the sweep then runs at one unit a probe. `y` and `y_ref` are both in the
     waveform, which makes the claim visible as two rows that never differ. */
  testbench: String.raw`module alu_ref(
  input  [3:0] a,
  input  [3:0] b,
  input  [1:0] op,
  output reg [3:0] y
);
  always @(*) begin
    case (op)
      2'd0:    y = a + b;
      2'd1:    y = a - b;
      2'd2:    y = a & b;
      default: y = a | b;
    endcase
  end
endmodule

module tb;

  reg  [3:0] a, b;
  reg  [1:0] op;
  wire [3:0] y, y_ref;

  integer ai, bi, oi, bad, probes;

  dut     u_dut (.a(a), .b(b), .op(op), .y(y));
  alu_ref u_ref (.a(a), .b(b), .op(op), .y(y_ref));

  initial begin
    a = 4'd9; b = 4'd5;
    op = 2'd0; #10; $display("t=%d  9 + 5 -> y=%h  ref=%h", $time, y, y_ref);
    op = 2'd1; #10; $display("t=%d  9 - 5 -> y=%h  ref=%h", $time, y, y_ref);
    op = 2'd2; #10; $display("t=%d  9 & 5 -> y=%h  ref=%h", $time, y, y_ref);
    op = 2'd3; #10; $display("t=%d  9 | 5 -> y=%h  ref=%h", $time, y, y_ref);

    bad = 0;
    probes = 0;
    for (oi = 0; oi < 4; oi = oi + 1) begin
      for (ai = 0; ai < 16; ai = ai + 1) begin
        for (bi = 0; bi < 16; bi = bi + 1) begin
          a = ai[3:0];
          b = bi[3:0];
          op = oi[1:0];
          #1;
          probes = probes + 1;
          if (y !== y_ref) begin
            bad = bad + 1;
            if (bad < 5) $display("MISMATCH a=%h b=%h op=%b -> y=%h, plain ALU says %h", a, b, op, y, y_ref);
          end
        end
      end
    end

    if (bad == 0) $display("swept %d combinations: the two designs agree everywhere", probes);
    else          $display("swept %d combinations: %d disagree - this is not the same circuit", probes, bad);
    $finish;
  end

endmodule
`,

  /* THE PLACEMENT: a netlist written out, since the design is a case over buses and pnr reads plain
     nets. Written SLICE BY SLICE - inverter, b-select mux, ONE adder column, AND, OR, two muxes - so
     `rowWidth` breaks it at the slice boundary and four rows of nine cells is one row per bit. The
     `fa_gate` arrives as two half adders and an OR, which is why a slice is nine placeable cells where
     the netlist card counts seven instances in it.

     ONE CARRY CHAIN now, where the previous page's figure has two threading its rows side by side -
     which is the area saving as a picture. Its head is a port (`cin0`, which the design drives with
     op[0]) rather than a constant cell, exactly as on that page and for the same reason.

     `rowWidth` IS THE SLICE, MEASURED: nine cells at 24 + 64 + 96 + 96 + 40 + 40 + 40 + 64 + 64 is
     528 lambda, so 528 is the budget and the wrap is 9/9/9/9 by construction rather than by luck (the
     previous page's twelve-cell slice is 760 for the same reason). Anything looser breaks it in a way
     that is easy to miss: 600 puts TEN cells in the first two rows and seven in the last, and 552 -
     one not_gate more than a slice - is enough to do it. It also has to be tight for the ROUTER: s0
     reaches eight muxes and s1 four, and at 600 the drawing came back with s0 unrouted, which
     `test_learn.py` reports rather than drawing a diagram with a wire missing. */
  layouts: {
    'the-slices': {
      caption: 'Four bit slices, one to a row: the inverter and mux that feed b to the single adder column, the two logic gates, and the two muxes that pick the answer.',
      view: 'all',
      rowWidth: 528,
      rowPx: 60,
      netlist: String.raw`module the_slices(
  input  a0, b0, a1, b1, a2, b2, a3, b3,
  input  s0, s1, cin0,
  output y0, y1, y2, y3
);

  not_gate  nb0 (.a(b0), .y(ib0));
  mux2_gate bs0 (.a(b0), .b(ib0), .sel(s0), .y(bb0));
  fa_gate   ad0 (.a(a0), .b(bb0), .cin(cin0), .sum(sm0), .cout(c1));
  and_gate  an0 (.a(a0), .b(b0), .y(g0));
  or_gate   or0 (.a(a0), .b(b0), .y(o0));
  mux2_gate p0a (.a(g0),  .b(o0), .sel(s0), .y(u0));
  mux2_gate p0b (.a(sm0), .b(u0), .sel(s1), .y(y0));

  not_gate  nb1 (.a(b1), .y(ib1));
  mux2_gate bs1 (.a(b1), .b(ib1), .sel(s0), .y(bb1));
  fa_gate   ad1 (.a(a1), .b(bb1), .cin(c1), .sum(sm1), .cout(c2));
  and_gate  an1 (.a(a1), .b(b1), .y(g1));
  or_gate   or1 (.a(a1), .b(b1), .y(o1));
  mux2_gate p1a (.a(g1),  .b(o1), .sel(s0), .y(u1));
  mux2_gate p1b (.a(sm1), .b(u1), .sel(s1), .y(y1));

  not_gate  nb2 (.a(b2), .y(ib2));
  mux2_gate bs2 (.a(b2), .b(ib2), .sel(s0), .y(bb2));
  fa_gate   ad2 (.a(a2), .b(bb2), .cin(c2), .sum(sm2), .cout(c3));
  and_gate  an2 (.a(a2), .b(b2), .y(g2));
  or_gate   or2 (.a(a2), .b(b2), .y(o2));
  mux2_gate p2a (.a(g2),  .b(o2), .sel(s0), .y(u2));
  mux2_gate p2b (.a(sm2), .b(u2), .sel(s1), .y(y2));

  not_gate  nb3 (.a(b3), .y(ib3));
  mux2_gate bs3 (.a(b3), .b(ib3), .sel(s0), .y(bb3));
  fa_gate   ad3 (.a(a3), .b(bb3), .cin(c3), .sum(sm3), .cout(c4));
  and_gate  an3 (.a(a3), .b(b3), .y(g3));
  or_gate   or3 (.a(a3), .b(b3), .y(o3));
  mux2_gate p3a (.a(g3),  .b(o3), .sel(s0), .y(u3));
  mux2_gate p3b (.a(sm3), .b(u3), .sel(s1), .y(y3));

endmodule
`
    }
  }
};
