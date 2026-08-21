/* Topic content for the 'mux-8to1' learn page - the 2:1 multiplexer widened, and the page where a
 * `case` inside `always @(*)` is the RIGHT tool rather than an expensive one.
 *
 * IT IS THE DECODER PAGE'S COUNTERPOINT, deliberately. There, the same function written procedurally
 * cost twice the area, because an if/else chain over things that were not choices became a mux tree
 * nobody wanted. Here the design IS a choice, so the procedural form costs nothing: measured, the case
 * and a hand-written chain of nested ternaries synthesize to the same 7 cells and the same 14
 * NAND-equivalents. A reader who took "procedural is dear" away from the decoder page needs this one.
 *
 * SEVEN CELLS, THREE LEVELS: 4 + 2 + 1. That is the shape of every wide mux and it is where the cost
 * of one lives - not in the count of inputs but in the DEPTH, which is log2 of them, because a signal
 * has to cross one mux per select bit. The figure is drawn as the tree for that reason, and the layout
 * section says plainly that a placer's rows are not the tree's levels.
 *
 * `y = d[sel]` IS THE SHARPEST FACT ON THE PAGE and it is measured both ways: the SIMULATOR runs it
 * (bit 5 of 10100110 really is 1), and the SYNTHESIZER refuses it in as many words - `the index of 'd'
 * must be a constant ... a netlist has to select a fixed bit`. One line that works in a simulation and
 * cannot be built is the whole difference between a program that models hardware and hardware, so the
 * page shows it rather than warning about it.
 *
 * A FULL CASE NEEDS NO `default`, which is the nuance this page adds to the ALU's rule. Three select
 * bits have eight values and all eight are listed, so `y` is assigned on every reachable path -
 * measured: with a default or with the eighth branch written out, the netlist is identical.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['mux-8to1'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="wider">Choosing between more than two</h2>
<p>The <a href="learn-mux-2to1.html">2:1 Multiplexer</a> has one select bit and picks one of two
inputs. Nothing about that idea stops at two: with <b>three</b> select bits there are eight
combinations, so three bits can name one of <b>eight</b> inputs.</p>
<div class="learn-note">
  <b>n select bits choose between 2<sup>n</sup> inputs.</b> One bit for two, two for four, three for
  eight, ten for a thousand and twenty-four. The select is a <em>number</em>, and the mux hands back the
  input that number names - which is why a mux is how anything with an address is read.
</div>
<p>So an 8:1 multiplexer is eight data inputs, a three-bit select, and one output that is a copy of
whichever input was named. Still nothing computed, and still no clock.</p>
` },

    { html: String.raw`
<h2 data-sec="tree">Seven muxes in three levels</h2>
<p>You do not need a new kind of cell for this. Take the eight inputs in pairs and put a 2:1 mux on
each pair, all four controlled by <code>sel[0]</code>: that leaves four survivors. Pair those and use
two more muxes on <code>sel[1]</code>: two survivors. One last mux on <code>sel[2]</code> picks between
them.</p>
<div class="learn-note">
  <b>4 + 2 + 1 = 7 muxes, in 3 levels.</b> One level per select bit, and each level halves what is
  left - which is the same arithmetic as the select being a binary number, read one bit at a time from
  the bottom up.
</div>
<p>Which means the cost of a wide mux is not really the count of cells. It is the <b>depth</b>: a
signal has to cross one mux per select bit, so a 16:1 is 15 cells but only four deep, and a 1024:1 is a
thousand cells and ten deep. Depth is delay, and delay is what a clock has to wait for.</p>
` },

    { figure: 'tree' },

    { html: String.raw`
<p>Every mux in a level shares the same select bit - one wire reaching four pins in the first level,
two in the second, one in the third. That fan-out is the other half of what a wide mux costs, and it is
why a real design sometimes buffers a select line before spreading it that far.</p>
` },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>Eight choices is a <code>case</code>, and this is the page where that is exactly the right tool:</p>
<pre class="learn-code">always @(*) begin
case (sel)
3'd0: y = d[0];
3'd1: y = d[1];
3'd2: y = d[2];
3'd3: y = d[3];
3'd4: y = d[4];
3'd5: y = d[5];
3'd6: y = d[6];
3'd7: y = d[7];
endcase
end</pre>
<p>Three things about it are worth pulling out, and the third is the one that surprises people.</p>

<h3>1. <code>always @(*)</code> with no clock in sight</h3>
<p>Sensitive to everything it reads, so it re-runs whenever <code>d</code> or <code>sel</code> moves.
The block is procedural but the circuit is not sequential: there is no edge, no memory, and
<code>y</code> is a wire in everything but name - which is why it is declared <code>output reg</code>
and assigned with <code>=</code> rather than <code>&lt;=</code>.</p>

<h3>2. A full case needs no <code>default</code></h3>
<p>The <a href="learn-alu-4bit.html">4-Bit ALU</a> page's rule is that every branch must assign
<code>y</code>, or the tool has to remember it and builds a latch. Here all <b>eight</b> values of a
three-bit select are listed, so there is no path through the block that assigns nothing - measured, the
netlist is identical whether the eighth branch is written as <code>3'd7</code> or as
<code>default</code>. Leave any one of them out and the default becomes compulsory again.</p>

<h3>3. <code>y = d[sel]</code> would be one line, and cannot be built</h3>
<p>The obvious shortcut is to index the bus with the select directly. It <b>simulates perfectly</b> -
the engine on this page will run it and give the right answer for every value of <code>sel</code> - and
the synthesizer refuses it outright:</p>
<div class="learn-note">
  <code>the index of 'd' must be a constant, got 'sel' - a netlist has to select a fixed bit</code>
</div>
<p>Which is the difference between a program that models hardware and hardware. There is no wire in a
circuit that can be "bit number <code>sel</code>": every wire is soldered where it is, and choosing
between them is what the seven muxes above are FOR. A <code>case</code> is how you say that in a way
something can be built from.</p>
<p>Press <b>Run Simulation</b>. The testbench holds one pattern on <code>d</code> and walks
<code>sel</code> from 0 to 7, so <code>y</code> traces the bits of that pattern in order.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="waveform">Reading it as a waveform</h2>
<p><code>d</code> is a value box holding <code>a6</code> the whole way through - that is
<code>1010 0110</code> - and <code>sel</code> is a box counting 0 to 7. The row to read is
<code>y</code>, which is one bit, so it is a step line.</p>
<p>Read it against the pattern from the bottom bit up: <b>0, 1, 1, 0, 0, 1, 0, 1</b>. That is
<code>10100110</code> backwards, which is what "bit 0 first" means - and it is the design's whole
behaviour in one row. Nothing about <code>y</code> depends on when anything happened; it changes the
instant <code>sel</code> does.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="netlist">What the tool builds from it</h2>
<p>Press <b>Synthesize</b>. <b>Seven cells, all multiplexers</b>, at about <b>14 NAND-equivalents</b> -
the tree from the top of the page, built by the tool from the case statement without being asked for in
those terms.</p>
<p>And it is worth knowing what this page did <em>not</em> cost. On the
<a href="learn-decoder-2to4.html">2:4 Decoder</a> page the procedural spelling cost more than twice the
area of the expressions, because branches over things that were not choices became muxes nobody
wanted. Here the design is a choice, so the case is free: written as a chain of nested
<code>?:</code> instead, the netlist is the same seven cells and the same 14 NAND-equivalents.</p>
<div class="learn-note">
  <b>The lesson is not "avoid procedural" but "say what you mean".</b> A case over a select is a
  multiplexer, and a tool that recognises one gives you exactly that.
</div>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>Seven cells on the wafer, and at this row width they land four and three:</p>
` },

    { layout: 'the-tree' },

    { html: String.raw`
<p><b>166.4 &micro;m</b> by <b>93.6 &micro;m</b>, and the first row happens to be exactly the tree's
first level - the four muxes on <code>sel[0]</code> - with the second row holding the other three. That
is a coincidence of widths rather than a plan: <b>a placer's rows are not a circuit's levels</b>. Rows
are how a chip is tiled, and depth is a property of the wiring between the cells, not of where they
sit.</p>
<p>Which is worth saying because the two are easy to conflate. This picture would look the same if the
seven muxes were wired as a chain seven deep instead of a tree three deep - same cells, same area, and
three times the delay. Area is what you can see; depth is what you have to read the netlist for.</p>
<p>As on the other wide topics, this figure carries <b>a netlist written out for it</b>: the design is a
case over buses, and the placer reads plain nets.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>A wide mux and a <a href="learn-decoder-2to4.html">decoder</a> are the read and write halves of
anything addressed: put an 8:1 mux on eight <a href="learn-register-4bit.html">registers</a>' outputs
and a decoder on their enables, and you have a register file - one address to read from, one to write
to. <a href="learn-alu-4bit.html">4-Bit ALU</a> is the same tree used for operations rather than
addresses. And <a href="learn-logic-gates.html">Logic Gates</a> goes the other way, into the mask
layers one of these cells is drawn as.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Seven questions on width, depth, and what a case statement is worth. A wrong answer says so and links
back to the section it came from; the score at the foot of the panel is what the Learn hub shows beside
this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE FIGURE: the tree, all seven muxes and all eleven inputs, because the SHAPE is the topic - a
     half tree would show the cells and lose the point.

     THE PINS CANNOT LINE UP AND THAT IS FINE. A mux2 is 36 x 42 in the viewer's pixel space with sel at
     13%, a at 50% and b at 87% of its height, so its two data pins are 15.5px apart where a port box is
     32px tall and the harness's caption band wants 22px of clearance. So the ports are 56px apart and
     each mux sits centred between the pair it reads, with the router bending the two wires into it -
     the same trade the 2:1 page makes, for the same reason: a symbol drawn bigger than the netlist
     viewer draws it would put this figure and the netlist card in disagreement.

     THE SELECT PORTS ARE ABOVE THE DATA, one per level, at y=0 while the data starts at y=80, and
     their wires run DOWN into every mux of that level. That fan-out is busy on purpose: it is the
     second cost of a wide mux and the prose says so. (This said "below ... run up" for a long time,
     which the coordinates below have never agreed with; the netlist viewer now hoists a select
     driver above the muxes it drives for exactly the reason this figure is drawn this way, so the
     two finally describe one arrangement.) */
  figures: {
    'tree': {
      caption: 'An 8:1 mux as seven 2:1 muxes: four on sel[0], two on sel[1], one on sel[2].',
      nodes: [
        { id: 'd0', kind: 'in', label: 'd[0]', x: 0, y: 80+0 },
        { id: 'd1', kind: 'in', label: 'd[1]', x: 0, y: 80+56 },
        { id: 'd2', kind: 'in', label: 'd[2]', x: 0, y: 80+112 },
        { id: 'd3', kind: 'in', label: 'd[3]', x: 0, y: 80+168 },
        { id: 'd4', kind: 'in', label: 'd[4]', x: 0, y: 80+224 },
        { id: 'd5', kind: 'in', label: 'd[5]', x: 0, y: 80+280 },
        { id: 'd6', kind: 'in', label: 'd[6]', x: 0, y: 80+336 },
        { id: 'd7', kind: 'in', label: 'd[7]', x: 0, y: 80+392 },

        { id: 'm0', kind: 'mux2', label: 'mux2', x: 180, y: 80+23 },
        { id: 'm1', kind: 'mux2', label: 'mux2', x: 180, y: 80+135 },
        { id: 'm2', kind: 'mux2', label: 'mux2', x: 180, y: 80+247 },
        { id: 'm3', kind: 'mux2', label: 'mux2', x: 180, y: 80+359 },

        { id: 'n0', kind: 'mux2', label: 'mux2', x: 330, y: 80+79 },
        { id: 'n1', kind: 'mux2', label: 'mux2', x: 330, y: 80+303 },

        { id: 'p0', kind: 'mux2', label: 'mux2', x: 480, y: 80+191 },
        { id: 'y', kind: 'out', label: 'y', x: 560, y: 80+196 },

        { id: 's0', kind: 'in', label: 'sel[0]', x: 50, y: 0 },
        { id: 's1', kind: 'in', label: 'sel[1]', x: 200, y: 0 },
        { id: 's2', kind: 'in', label: 'sel[2]', x: 350, y: 0 }
      ],
      edges: [
        ['d0', 'm0', 'a'], ['d1', 'm0', 'b'],
        ['d2', 'm1', 'a'], ['d3', 'm1', 'b'],
        ['d4', 'm2', 'a'], ['d5', 'm2', 'b'],
        ['d6', 'm3', 'a'], ['d7', 'm3', 'b'],
        ['m0', 'n0', 'a', 'y'], ['m1', 'n0', 'b', 'y'],
        ['m2', 'n1', 'a', 'y'], ['m3', 'n1', 'b', 'y'],
        ['n0', 'p0', 'a', 'y'], ['n1', 'p0', 'b', 'y'],
        ['p0', 'y', 'y', 'y'],
        ['s0', 'm0', 'sel'], ['s0', 'm1', 'sel'], ['s0', 'm2', 'sel'], ['s0', 'm3', 'sel'],
        ['s1', 'n0', 'sel'], ['s1', 'n1', 'sel'],
        ['s2', 'p0', 'sel']
      ]
    }
  },

  /* No truth table card: eleven inputs is 2,048 rows, and the card is generated over the whole input
     space or not at all - `ripple-carry-4bit` records that decision at eight. The pattern the testbench
     walks is what the waveform section reads instead, and 90 time units is the eight steps it drives at
     10 apiece plus its settling delays. */
  maxTime: 90,

  /* One question per marked section, and `verilog` is asked twice: the full-case nuance and the
     variable-index refusal are two separate things a reader can take away. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'wider',
          q: 'How many inputs can four select bits choose between?',
          options: ['16', '8', '4', '32'],
          answer: 0
        },
        {
          sec: 'tree',
          q: 'Why does an 8:1 mux take seven 2:1 muxes rather than eight?',
          options: [
            'Each level halves what is left: four pairs, then two, then one - 4 + 2 + 1',
            'One input needs no mux, since it is the default when sel is 0',
            'Two of the eight can share a mux, because their select bits agree'
          ],
          answer: 0
        },
        {
          sec: 'tree',
          q: 'What does the DEPTH of the tree cost?',
          options: [
            'Delay - a signal has to cross one mux per select bit before the answer is right',
            'Area, since deeper trees need bigger cells',
            'Nothing: only the number of cells matters'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'Why does this case need no <code>default</code>?',
          options: [
            'All eight values of a three-bit select are listed, so no path assigns nothing',
            'A case in an always @(*) block never needs one',
            'The tool fills in 0 for anything not listed'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: '<code>y = d[sel]</code> simulates correctly. Why will the synthesizer not build it?',
          options: [
            'No wire in a circuit can be "bit number sel" - choosing between wires is what the muxes are for',
            'It is legal but slower, so the tool refuses it as a warning',
            'A bus cannot be indexed at all in a netlist, even by a constant'
          ],
          answer: 0
        },
        {
          sec: 'waveform',
          q: 'With d held at 10100110, why does y read 0, 1, 1, 0, 0, 1, 0, 1?',
          options: [
            'sel counts from 0, so y traces the pattern from its bottom bit up',
            'The mux inverts every second bit as it selects it',
            'The pattern is shifting, one place per step'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'The case costs nothing here, where the decoder page\'s procedural version cost double. Why the difference?',
          options: [
            'This design really is a choice, and a case over a select is what a multiplexer is',
            'The tool optimises case statements but not if/else chains',
            'The decoder page used more bits, and area grows with them'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'The first row of the layout is the tree\'s first level. What does that tell you?',
          options: [
            'Nothing about the circuit - rows are how a chip is tiled, and depth is in the wiring',
            'That the placer lays out one level per row',
            'That the tree is three cells deep, which is why there are three rows'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. A combinational `case` with all eight branches written out - a full case, so no
     `default` is needed, which is the nuance this page adds to the ALU's rule. */
  verilog: String.raw`/* An 8:1 multiplexer: three select bits choosing one of eight inputs.
 *
 * always @(*) is combinational - it re-runs whenever d or sel moves - so
 * there is no clock and no memory here, and y is a wire in everything but
 * name. Combinational logic gets =, where state gets <=.
 *
 * All eight values of a three-bit select are listed, so every path through
 * the block assigns y and no default is needed. Leave one out and it is
 * compulsory again, or the tool has to remember y and builds a latch.
 *
 * y = d[sel] would be one line and cannot be built: a netlist has to select
 * a fixed bit, and choosing between wires is what a mux is for.
 */
module dut(
  input  [7:0] d,
  input  [2:0] sel,
  output reg   y
);
  always @(*) begin
    case (sel)
      3'd0: y = d[0];
      3'd1: y = d[1];
      3'd2: y = d[2];
      3'd3: y = d[3];
      3'd4: y = d[4];
      3'd5: y = d[5];
      3'd6: y = d[6];
      3'd7: y = d[7];
    endcase
  end
endmodule
`,

  /* The hidden testbench: one pattern held on d while sel walks 0 to 7, so y traces the pattern's bits
     from the bottom up - which is what the waveform section asks the reader to read. The delays are what
     let the combinational block settle before each line is printed. */
  testbench: String.raw`module tb;

  reg  [7:0] d;
  reg  [2:0] sel;
  wire y;

  dut u_dut (.d(d), .sel(sel), .y(y));

  initial begin
    d = 8'b1010_0110;
    sel = 3'd0; #10; $display("t=%d  d=%b sel=%d -> y=%b   bit 0", $time, d, sel, y);
    sel = 3'd1; #10; $display("t=%d  d=%b sel=%d -> y=%b   bit 1", $time, d, sel, y);
    sel = 3'd2; #10; $display("t=%d  d=%b sel=%d -> y=%b", $time, d, sel, y);
    sel = 3'd3; #10; $display("t=%d  d=%b sel=%d -> y=%b", $time, d, sel, y);
    sel = 3'd4; #10; $display("t=%d  d=%b sel=%d -> y=%b", $time, d, sel, y);
    sel = 3'd5; #10; $display("t=%d  d=%b sel=%d -> y=%b", $time, d, sel, y);
    sel = 3'd6; #10; $display("t=%d  d=%b sel=%d -> y=%b", $time, d, sel, y);
    sel = 3'd7; #10; $display("t=%d  d=%b sel=%d -> y=%b   bit 7, the top of the pattern", $time, d, sel, y);
    $finish;
  end

endmodule
`,

  /* THE PLACEMENT: a netlist written out, since the design is a case over buses and pnr reads plain
     nets. Written in tree order - the four first-level muxes, then the two, then the one - and
     `rowWidth: 256` fits four to a row, so the first row happens to be exactly the first level. The
     prose says that is a coincidence of widths and not a plan, because a placer's rows are not a
     circuit's levels. `rowPx` is PER ROW, so 85 is 170px for the two, under what the column allows at
     this aspect. */
  layouts: {
    'the-tree': {
      caption: 'The seven mux cells, four to a row - which here happens to be the tree\'s first level.',
      view: 'all',
      rowWidth: 256,
      rowPx: 85,
      netlist: String.raw`module the_tree(
  input  d0, d1, d2, d3, d4, d5, d6, d7,
  input  s0, s1, s2,
  output y
);

  mux2_gate a0 (.a(d0), .b(d1), .sel(s0), .y(t0));
  mux2_gate a1 (.a(d2), .b(d3), .sel(s0), .y(t1));
  mux2_gate a2 (.a(d4), .b(d5), .sel(s0), .y(t2));
  mux2_gate a3 (.a(d6), .b(d7), .sel(s0), .y(t3));

  mux2_gate b0 (.a(t0), .b(t1), .sel(s1), .y(u0));
  mux2_gate b1 (.a(t2), .b(t3), .sel(s1), .y(u1));

  mux2_gate c0 (.a(u0), .b(u1), .sel(s2), .y(y));

endmodule
`
    }
  }
};
