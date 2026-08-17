/* Topic content for the 'register-4bit' learn page - the second topic in Sequential, and the step
 * from one bit of memory to a WORD of it.
 *
 * `d-flip-flop` is one bit that takes whatever d says at every edge. This page changes two things at
 * once, and they are independent: four of them side by side on ONE clock, so a bus is stored rather
 * than a bit; and an ENABLE, so an edge can arrive and the register keep what it has. The second is
 * the one with a circuit behind it - `else if (en)` is a multiplexer in front of every flop, choosing
 * between the new value and the old one - which is why `mux-2to1` comes before this page and is
 * linked from it twice.
 *
 * THE RESET IS ASYNCHRONOUS, `posedge clk or negedge rst_n`, and that is not a style choice: it is
 * the form the layout library's flop has a PIN for. `dff_gate` carries `rstn`, so an async reset costs
 * nothing on the wafer, where a synchronous one is an inverter and a mux per bit - which the flip-flop
 * page draws for itself. Measured on the synthesizer here: this design is 8 cells, four muxes and four
 * flops, and the four muxes are the ENABLE rather than the reset.
 *
 * ONE LAYOUT FIGURE, and it carries its own netlist for the reason the wide topics do - the design's
 * ports are buses, and pnr's netlist parser takes plain nets with no bit-selects. What the figure is
 * about is that a bit slice is TWO cells and a four-bit register is four of them, wrapped: at 450
 * lambda the placer breaks the row after two slices, so the shape on the page is 2 x (mux, flop).
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['register-4bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="word">Four bits of memory instead of one</h2>
<p>The <a href="learn-d-flip-flop.html">D Flip-Flop</a> remembers one bit. Nothing about it says how
wide a memory has to be, so put <b>four side by side, on the same clock</b>, and the four of them
remember a four-bit number - one flop per bit, each taking its own bit of <code>d</code> and driving
its own bit of <code>q</code>.</p>
<p>That is a <b>register</b>, and it is the box every processor is mostly made of. There is no new
idea in the width at all: the flops do not talk to each other, they are not chained the way the
adder's columns were, and the only thing they share is <em>when</em> - one clock edge, four bits
landing together.</p>
<div class="learn-note">
  <b>Together is the point.</b> One clock means the four bits change at the same instant, so anything
  reading the register sees a whole number rather than a half-updated one. A design with two clocks
  in it has to worry about exactly that.
</div>
` },

    { html: String.raw`
<h2 data-sec="enable">Keeping what you have</h2>
<p>A flip-flop takes <code>d</code> at every edge, whether or not anything wanted it to. A register
usually has one more input - an <b>enable</b> - and the rule is: at the edge, <em>if</em>
<code>en</code> is 1, load <code>d</code>; otherwise keep what is already there.</p>
<p>"Otherwise keep what is already there" is a circuit, not an absence of one. The flop cannot be
told to skip an edge - it always loads whatever is on its <code>d</code> pin - so what changes is
what that pin is fed with:</p>
<div class="learn-note">
  <b>A register with an enable is a <a href="learn-mux-2to1.html">multiplexer</a> in front of every
  flop</b>, with the flop's own output looped back as one of the two choices. <code>en</code> is the
  control: 1 picks the new value, 0 picks the value it already had.
</div>
<p>So the loop is deliberate. A wire from a flop's output back to its own input is the standard way
to say "hold", and it is the first feedback path on this site - the pages before this one all run
forward from inputs to outputs.</p>
` },

    { figure: 'bit-slice' },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>Four bits, one clocked block, and the two <code>if</code>s are the two features:</p>
<pre class="learn-code">if (!rst_n)  q &lt;= 4'd0;
else if (en) q &lt;= d;</pre>
<p>Read the second line with its <b>missing else</b> in mind. There is no "otherwise" branch, and in
a clocked block that is what "hold" is written as: no assignment at this edge means the flop keeps
its value, which the tool builds as the mux above. It is the one place in Verilog where writing
nothing is the same as writing something.</p>
<p><code>q</code> is <code>output reg [3:0]</code> - four bits of state, declared once - and
<code>&lt;=</code> is the nonblocking assignment the flip-flop page introduces: work the right-hand
side out now, land it at the end of this instant, so all four bits move together.</p>
<p>The reset is <b>asynchronous</b>: <code>negedge rst_n</code> is in the sensitivity list, so it
takes effect the moment <code>rst_n</code> falls rather than waiting for a clock edge. That is the
form the flip-flop cell in the library has a pin for, which is the silicon section below.</p>
<p>Press <b>Run Simulation</b>. The testbench loads a value, holds it while <code>d</code> changes
underneath, loads again, and finally pulls the reset with no clock edge in sight.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="waveform">Reading it as a waveform</h2>
<p><code>d</code> and <code>q</code> are four bits wide, so the viewer draws them as labelled value
boxes - press <b>[:]</b> above the plot and each name says how wide it is. Three things are worth
following:</p>
<p><b>Where q changes.</b> Never in the middle of a box on the <code>d</code> row - only at a rising
edge of <code>clk</code>, and only when <code>en</code> was 1 as that edge arrived.</p>
<p><b>Where q does not change.</b> The stretch where <code>en</code> is 0 has edges going by and
<code>d</code> moving, and the <code>q</code> box just continues - that is the mux picking the loop
rather than the input.</p>
<p><b>The reset.</b> It arrives between edges and <code>q</code> goes to 0 immediately, without
waiting for the clock. That is what asynchronous means, and it is visible as a change that does not
line up with the clock's edges.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="netlist">What the tool builds from it</h2>
<p>Press <b>Synthesize</b>. <b>Eight cells</b>, and they come in pairs: four <code>dff_gate</code>s -
one per bit, all on the same <code>clk</code> and the same <code>rst_n</code> - and four
<code>mux2_gate</code>s, one in front of each, with <code>en</code> on every mux's select.</p>
<p>Which is the figure above, four times over, and nothing else. No cell anywhere in that netlist
came from the reset: it is a pin on the flop rather than logic in front of it. Write the reset
synchronously instead - move it inside the block, as the flip-flop page does - and the tool has to
build it out of gates, which is an inverter and a second mux <em>per bit</em>.</p>
<p>The report prices the eight at about <b>32 NAND-equivalents</b>, and the split is worth reading:
a flop is far and away the dearest thing here, because remembering costs more transistors than
choosing does.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>Eight cells on the wafer, and a bit slice is a <b>pair</b>: the mux that decides and the flop that
remembers, abutted. Four slices is the whole register, and at this row width the placer fits two
slices to a row before starting the next:</p>
` },

    { layout: 'the-word' },

    { html: String.raw`
<p><b>270.4 &micro;m</b> by <b>93.6 &micro;m</b> - two rows of the one row height every cell in this
library is built to, which is why the second row sits flush under the first. Look at the pairs and the
flop is the wider of the two by a good margin: the same thing the area report said, in the one place
where it is a length you can measure rather than a number in a Console.</p>
<p>Nothing here is chained. The adder pages' rows had a carry running along them, so the ORDER of the
cells mattered; these four slices are independent, and the only thing that has to reach all of them
is the clock. A real placer spends most of its effort on exactly that - getting one wire to arrive
everywhere at the same time.</p>
<p>As on the wider adder topics, this figure carries <b>a netlist written out for it</b>: the design's
ports are buses, and the placer reads plain nets. It is the same eight cells with one wire per bit.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p><a href="learn-counter-4bit.html">4-Bit Counter</a> takes this register and feeds its own output
back through an adder, so it counts instead of holding - which is the shortest useful thing you can
build out of the two halves of this site. And <a href="learn-logic-gates.html">Logic Gates</a> goes
the other way, into the mask layers one of these cells is drawn as.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Six questions on width, holding, and what a register costs. A wrong answer says so and links back
to the section it came from; the score at the foot of the panel is what the Learn hub shows beside
this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE FIGURE: a single bit slice, because four of them would be the same drawing four times and the
     netlist card already shows that. The interesting part is the LOOP - the flop's own q going back
     into the mux's `a` input - which is the first feedback path on the site and is what "hold" is.

     The pins are the viewer's own: a mux2 is 36 x 42 with sel at 13%, a at 50% and b at 87% of its
     height, and a dff is 59 x 59 with d at a third, rstn at two thirds, q at a third on the right and
     CLK ON THE BOTTOM EDGE - which is why the clock port sits low and its wire comes up into the cell.
     Ports are 56px apart in the left column, the closest the harness's 22px caption band allows. */
  figures: {
    'bit-slice': {
      caption: 'One bit of the register: the mux chooses new or old, the flop remembers it.',
      nodes: [
        { id: 'en', kind: 'in', label: 'en', x: 0, y: 0 },
        { id: 'd0', kind: 'in', label: 'd[0]', x: 0, y: 56 },
        { id: 'rstn', kind: 'in', label: 'rst_n', x: 0, y: 112 },
        { id: 'clk', kind: 'in', label: 'clk', x: 0, y: 168 },
        { id: 'mx', kind: 'mux2', label: 'mux2', x: 170, y: 51 },
        { id: 'ff', kind: 'dff', label: 'dff', x: 280, y: 42 },
        { id: 'q0', kind: 'out', label: 'q[0]', x: 400, y: 46 }
      ],
      edges: [
        ['en', 'mx', 'sel'], ['d0', 'mx', 'b'],
        ['mx', 'ff', 'd', 'y'],
        ['rstn', 'ff', 'rstn'], ['clk', 'ff', 'clk'],
        ['ff', 'q0', 'y', 'q'],
        ['ff', 'mx', 'a', 'q']
      ]
    }
  },

  /* No truth table: four bits of state and a clock, so a row of the card would be one input
     combination sampled once and the design's whole subject is that q depends on WHEN as much as on
     what. The waveform is where this run is read, and the run length is stated here because there is
     no `truthTable.inputs` for it to be derived from. */
  maxTime: 90,

  /* One question per marked section, and `enable` is asked twice - it is the section with the circuit
     in it, and both halves are worth having: what the mux is for, and what the missing else means. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'word',
          q: 'What do the four flip-flops in a register share?',
          options: [
            'The clock - so their four bits change at the same instant',
            'Their d inputs, which is what makes them hold the same value',
            'A carry chain, the way the adder\'s four columns did'
          ],
          answer: 0
        },
        {
          sec: 'enable',
          q: 'A flip-flop loads d at every edge. So how does an enable make it hold?',
          options: [
            'A mux feeds the flop its own output back, so it loads the value it already had',
            'The enable gates the clock, so no edge reaches the flop',
            'The flop has a second pin that tells it to ignore the edge'
          ],
          answer: 0
        },
        {
          sec: 'enable',
          q: 'Why is the loop from q back into the mux not a problem, when a loop in combinational logic would be?',
          options: [
            'The flop breaks it: the value goes round once per clock edge rather than settling',
            'The mux only reads it when en is 0, so the loop is not always there',
            'It is a problem, and the tool inserts a buffer to fix it'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'What does the missing <code>else</code> after <code>else if (en)</code> describe?',
          options: [
            'Hold: no assignment at this edge means the flop keeps its value',
            'Nothing - it is a style choice, and adding one changes no hardware',
            'An error the tool has to guess its way around'
          ],
          answer: 0
        },
        {
          sec: 'waveform',
          q: 'One change to q does not line up with a clock edge. Which, and why?',
          options: [
            'The reset - it is asynchronous, so it takes effect the moment rst_n falls',
            'The first load, because the register was still settling',
            'None of them: every change to q is at an edge'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'No cell in the netlist came from the reset. Why not?',
          options: [
            'The flop has a reset pin, so it is wiring rather than logic',
            'The tool optimised the reset away, since the testbench only uses it once',
            'Resets are added later, by the placer'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'The four bit slices in the layout are not chained. What has to reach all of them?',
          options: [
            'The clock - and getting it everywhere at once is most of a placer\'s work',
            'The carry, as in the adder pages',
            'The enable, which is why it is drawn first'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. One clocked block, four bits of state, and the reset in the SENSITIVITY LIST rather
     than in the body - which is the form the library's flop has a pin for. */
  verilog: String.raw`/* A 4-bit register with a load enable.
 *
 * Four flip-flops on one clock, so the four bits land together and anything
 * reading q sees a whole number rather than a half-updated one.
 *
 * en is what makes it a register rather than four flops: at the edge, load d
 * if en is 1, otherwise keep what is already there. The missing else is how
 * "keep" is written - and the tool builds it as a mux in front of each flop.
 *
 * The reset is ASYNCHRONOUS: negedge rst_n is in the sensitivity list, so it
 * clears q the moment rst_n falls, with no clock edge needed. That is the
 * form the flip-flop cell in the library has a pin for.
 */
module dut(
  input        clk,
  input        rst_n,
  input        en,
  input  [3:0] d,
  output reg [3:0] q
);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n)  q <= 4'd0;
    else if (en) q <= d;
  end

endmodule
`,

  /* The hidden testbench. A free-running clock, and every check made just after a FALLING edge, so
     the inputs move in the low phase and each line reads what the rising edge in between committed -
     the same convention the practice exercises follow. The narration is what the Console shows if a
     run fails; on a run that works the log stays out of the way. */
  testbench: String.raw`module tb;

  reg  clk, rst_n, en;
  reg  [3:0] d;
  wire [3:0] q;

  dut u_dut (.clk(clk), .rst_n(rst_n), .en(en), .d(d), .q(q));

  always #5 clk = ~clk;

  initial begin
    clk = 0; rst_n = 0; en = 0; d = 4'd0;
    @(negedge clk); $display("t=%d  rst_n=%b en=%b d=%h -> q=%h   reset holds q at 0", $time, rst_n, en, d, q);

    rst_n = 1; en = 1; d = 4'd5;
    @(negedge clk); $display("t=%d  rst_n=%b en=%b d=%h -> q=%h   the edge loaded d", $time, rst_n, en, d, q);

    en = 0; d = 4'd12;
    @(negedge clk); $display("t=%d  rst_n=%b en=%b d=%h -> q=%h   en was 0, so q held", $time, rst_n, en, d, q);

    d = 4'd3;
    @(negedge clk); $display("t=%d  rst_n=%b en=%b d=%h -> q=%h   d moved again, q still held", $time, rst_n, en, d, q);

    en = 1;
    @(negedge clk); $display("t=%d  rst_n=%b en=%b d=%h -> q=%h   en back to 1, the edge loaded d", $time, rst_n, en, d, q);

    d = 4'd15;
    @(negedge clk); $display("t=%d  rst_n=%b en=%b d=%h -> q=%h   loaded again", $time, rst_n, en, d, q);

    rst_n = 0;
    #2 $display("t=%d  rst_n=%b en=%b d=%h -> q=%h   the reset cleared q with no edge", $time, rst_n, en, d, q);
    @(negedge clk);
    $finish;
  end

endmodule
`,

  /* THE PLACEMENT: a netlist written out, because the design's ports are buses and pnr's parser takes
     plain nets. Interleaved mux, flop, mux, flop - so a ROW is bit slices rather than four muxes
     followed by four flops, and `rowWidth: 450` breaks it after two of them: 2 x (mux, flop),
     270.4 x 93.6 um. `rowPx` is PER ROW, so 85 is 170px for the two, under the ~187 the column allows
     at this aspect - a wrapped figure cannot take the 150 or 220 a single-row one can. No cross
     section and no animation: `logic-gates` teaches the process, and what this page adds is the pair. */
  layouts: {
    'the-word': {
      caption: 'The whole register: four bit slices of mux and flop, two to a row.',
      view: 'all',
      rowWidth: 450,
      rowPx: 85,
      netlist: String.raw`module the_word(
  input  clk, rstn, en,
  input  d0, d1, d2, d3,
  output q0, q1, q2, q3
);

  mux2_gate m0 (.a(q0), .b(d0), .sel(en), .y(n0));
  dff_gate  f0 (.d(n0), .clk(clk), .rstn(rstn), .q(q0));
  mux2_gate m1 (.a(q1), .b(d1), .sel(en), .y(n1));
  dff_gate  f1 (.d(n1), .clk(clk), .rstn(rstn), .q(q1));
  mux2_gate m2 (.a(q2), .b(d2), .sel(en), .y(n2));
  dff_gate  f2 (.d(n2), .clk(clk), .rstn(rstn), .q(q2));
  mux2_gate m3 (.a(q3), .b(d3), .sel(en), .y(n3));
  dff_gate  f3 (.d(n3), .clk(clk), .rstn(rstn), .q(q3));

endmodule
`
    }
  }
};
