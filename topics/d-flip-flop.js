/* Topic content for the 'd-flip-flop' learn page - the seventh topic, and the first SEQUENTIAL one:
 * every page before it is a function of the inputs it has at that instant, and this one is about the
 * only circuit here that is not.
 *
 * THE DESIGN IS BEHAVIOURAL, and it has to be. `logic-gates` and the two one-bit adders instantiate
 * cells because what those pages are about is what a cell is; this page is about `always @(posedge
 * clk)`, so a design that instantiated `dff_gate` would put the one thing being taught inside a
 * library module the reader never opens. So the design is the block, and the netlist card is where
 * the cell arrives - which is the same shape `adder-8bit` uses for the same reason.
 *
 * THE RESET IS ASYNCHRONOUS, BECAUSE THAT IS THE FLIP-FLOP THE LIBRARY HAS. `dff_gate` is
 * `always @(posedge clk or negedge rstn)` - one reset pin, and an async one - so the design that maps
 * onto it cell for cell is the one written the same way. Measured, on the synthesizer this repo ships:
 * this design comes out as exactly ONE cell with all four of its ports on the cell's four pins, 6.00
 * NAND-equivalents and 93.6 um of row, and the netlist diagram is the figure at the top of the page.
 * Move the reset INSIDE the block and it becomes THREE cells - a `not_gate` and a `mux2_gate` in front
 * of the flip-flop's d pin, with the flop's own `rstn` tied to `1'b1` - 8.50 and 150.8 um.
 *
 * SO THE RTL LESSON THAT MATTERS MOST IS AN EXPERIMENT HERE rather than a claim: a clocked block is
 * one flip-flop per bit of state plus combinational logic computing the next value, and the reader
 * sees the logic appear by editing one line and pressing Synthesize again. An async reset is the one
 * thing in such a block that the flip-flop can do by itself, which is exactly why it is free.
 *
 * NO TRUTH TABLE CARD, and the reason is the subject rather than the size. The card's rows are
 * generated from `truthTable.inputs` and each row is one input combination sampled once - which is a
 * statement that the outputs are a function of the inputs, and the whole of what this page says is
 * that they are not. Two rows of `d=1` would disagree about `q` and the table would look broken. The
 * WAVEFORM is where a flip-flop is read, so the testbench is written out here: six phases, one per
 * thing the prose claims.
 *
 * THE FIGURE IS THE NETLIST, which is the strongest form of this site's picture-and-netlist rule: all
 * four of the design's ports go to the four pins of the part, and that is not a drawing of what a
 * flip-flop is like - it is what Synthesize produces, one cell, wire for wire. Nothing in the prose has
 * to claim the two agree.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong. `<=` is written `&lt;=` in the prose, which is also
 * what the harness un-escapes before checking every quoted line against the design.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['d-flip-flop'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="remember">Every circuit so far forgets</h2>
<p>An adder has no past. Put 12 and 5 on its inputs and <code>sum</code> is 17; take them away and
there is nothing left of it anywhere in the circuit. That is true of every design on the pages before
this one - the outputs are a function of the inputs <em>at that instant</em>, which is what
<b>combinational</b> means, and it is why a truth table describes one completely.</p>
<p>Nothing can be built out of that alone. Adding up a column of numbers means holding the running
total while the next one arrives. Counting means knowing what you counted last. A processor is
mostly a machine for keeping things: an instruction address, thirty-two registers, the flags left
over from the last comparison. Something has to <b>remember</b>.</p>
<div class="learn-note">
  <b>Remembering is mostly refusing to change.</b> A circuit that copies its input the moment the
  input moves has not remembered anything - it has passed it along, which is what a wire does. So the
  interesting half of a memory is not where the value sits. It is <em>when</em> the value is allowed
  to change.
</div>
` },

    { html: String.raw`
<h2 data-sec="edge">One instant in every cycle</h2>
<p>The answer digital design settles on is a <b>clock</b>: one signal, going up and down forever, that
nothing computes anything from. It is there to say <em>now</em>. Between one <em>now</em> and the next,
the rest of the circuit is free to settle at its own speed and nobody looks.</p>
<p>A <b>D flip-flop</b> is one bit of memory with that idea built into it. It watches one of the two
moments in each cycle - the <b>rising edge</b>, where the clock goes from 0 to 1 - and at that
instant it copies whatever is on <code>d</code> onto <code>q</code>. Then it ignores <code>d</code>
altogether until the next rising edge. So <code>q</code> is <code>d</code>, held, and late: whatever
<code>d</code> was at the last edge, still there now. That is what the D is for - <b>delay</b>, or
<b>data</b>, depending on who is writing.</p>
` },

    { figure: 'flop' },

    { html: String.raw`
<div class="learn-note">
  <b>Two marks on that symbol are worth naming.</b> The little triangle where the clock arrives
  underneath is the standard way of drawing <em>this input acts on an edge, not on a level</em> - the
  one thing that separates a flip-flop from a plain latch. And the middle pin on the left, the one with
  a small circle on it, is a <b>reset</b>: the circle means it is asserted by a <b>0</b> rather than a
  1, which is why the design's port is called <code>rst_n</code>.
  <br><br>
  Four ports, four pins, and no gates anywhere - hold onto that drawing, because it is not an
  illustration of the idea. It is what the synthesizer builds from the design below, wire for wire.
</div>
` },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>Four lines, and none of them is an <code>assign</code>:</p>
<pre class="learn-code">always @(posedge clk or negedge rst_n) begin
  if (!rst_n) q &lt;= 1'b0;
  else        q &lt;= d;
end</pre>
<p>Three things in that are new, and the first is the one everything else follows from.</p>

<h3>1. The block says WHEN</h3>
<p>The list in brackets is a <b>sensitivity list</b>: it names the moments the block runs, and this one
names two - the rising edge of <code>clk</code>, and <code>rst_n</code> falling. An <code>assign</code>
has nothing like it, because an <code>assign</code> is true continuously: it is a statement about what
a wire <em>is</em>, and the tool re-works it out whenever anything on the right changes. This block
runs at those two instants and at no other. Nothing in it happens between them, and that is the whole
of the memory: <code>q</code> keeps the value it was given because nothing is running that could
change it.</p>

<h3>2. The arrow assignment is a different assignment</h3>
<p><code>&lt;=</code> is <b>nonblocking</b>. It says: work out the right-hand side now, and land the
value at the <em>end</em> of this instant, once everything else has read the old one. That is what
real flip-flops do - they all sample together, then all change together - and it is why a chain of
them shifts a value along by one stage per edge instead of rushing it through the whole chain in a
single edge, which is what a plain <code>=</code> would describe. Inside a clocked block, state is
assigned with <code>&lt;=</code>.</p>

<h3>3. q is held, so it is declared as held</h3>
<p>The port is <code>output reg q</code>. An <code>assign</code> drives a wire; a value assigned
inside an <code>always</code> block is one Verilog keeps between runs of that block, and the language
wants that spelled out. The word is <code>reg</code>, and it is Verilog's own - it says how the signal
is written in this file, not which cell the tool will pick for it.</p>
<p>Why the reset is in the list rather than inside the block has a section of its own below. Press
<b>Run Simulation</b>: the testbench clocks the design through six phases, and the waveform under it
is what came out.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="waveform">Reading it as a waveform</h2>
<p>This is the first page on this site where the waveform is the point rather than a second view of
the table. Five things to find in it.</p>
<p><b>The clock is the square wave</b>, 5 time units low and 5 high, so its rising edges are at
t=5, 15, 25, 35, 45 and 55.</p>
<p><b>q moves only when the block runs.</b> Follow it across: it steps at t=15, 35 and 45, and it is
flat everywhere between - although <code>d</code> changes six times. Three of the six edges moved it;
the other three stored a value it already held, which is a write that changes nothing. Hold that
against the adder pages, where an output moved the moment an input did.</p>
<p><b>At t=20, d drops to 0 and comes back up at t=22</b> - both inside one low phase, with no edge
anywhere near - and <code>q</code> does not twitch. That is the memory doing its job. An XOR handed
the same wobble would have passed it straight through; this circuit was not looking.</p>
<p><b>q starts at 0, not at X</b>, and it is worth knowing why: <code>rst_n</code> is already low at
t=0, so the block ran there and cleared it before the clock had done anything at all. Hold the reset
high for the whole run instead and <code>q</code> reads X - the red mid-height line this viewer draws
for <em>unknown</em> - until the first edge at t=5. A flip-flop has no value until something puts one
in it, and real silicon is the same: it powers up holding something, and nobody knows what.</p>
<p><b>And q drops at t=50</b>, in the middle of a low phase, five units before the next edge. Nothing
clocked it: <code>rst_n</code> went low and the flip-flop cleared there and then. That is the next
section.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="reset">Starting from a known state</h2>
<p>An X on <code>q</code> is a simulator being honest, and on a chip it is worse than that: a
flip-flop powers up holding a 1 or a 0 nobody chose, and a design made of thousands of them starts in
one of an unimaginable number of states. So every real design has a wire whose job is to put it in a
known one - a <b>reset</b> - and holding it for a few cycles at power-on is the first thing that
happens to any chip.</p>
<p>Here it is <code>rst_n</code>, and the <code>_n</code> is a convention worth knowing: the reset is
asserted when the signal is <b>0</b>, which is what <b>active low</b> means and what the small circle
on the symbol's reset pin is drawing. It is the usual choice, and the reason is electrical rather than
logical - a wire that has not been driven yet tends to sit high.</p>
<p>What kind of reset it is, though, is decided by <em>where it is written</em>, and the run above
shows it twice. <code>negedge rst_n</code> is in the sensitivity list, so a falling
<code>rst_n</code> runs the block just as a clock edge does: <code>q</code> is cleared at t=0 before
the clock has done anything, and cleared again at t=50 without waiting for the edge at t=55. A reset
that does not wait for the clock is an <b>asynchronous</b> one, and it is what a flip-flop in a cell
library has a pin for.</p>
<div class="learn-note">
  <b>The other kind is one edit away.</b> Take <code>or negedge rst_n</code> out of the list, leaving
  <code>always @(posedge clk)</code>, and the reset is just another line inside a block that only runs
  at an edge - so <code>q</code> would hold 1 from t=50 until t=55 and clear there. That is a
  <b>synchronous</b> reset. Both are ordinary and real designs use both, and the next section is why
  the choice is not only about timing.
</div>
` },

    { html: String.raw`
<h2 data-sec="netlist">What the tool builds from it</h2>
<p>Press <b>Synthesize</b>. The netlist is <b>one cell</b>: <code>dff_gate</code>, with all four of
the design's ports on its four pins - <code>clk</code>, <code>rst_n</code> and <code>d</code> in,
<code>q</code> out. That diagram is the figure at the top of this page. Nothing was inferred, nothing
was built in front of it, and nothing in the prose has to claim the picture and the netlist agree.</p>
<p>It is also the first cell on this site that is not a gate. It has a <b>clock</b> pin, no gate has
one, and no arrangement of the gates on the earlier pages would give you one - a library either has a
flip-flop drawn for it or the machine cannot remember anything. The report prices it at <b>6</b>
NAND-equivalents, against 2.5 for an XOR, which was the dearest gate on any page so far. Remembering
one bit costs more than almost anything you can compute with it.</p>
<p>One cell rather than two or three is the reset's doing: the flip-flop already has the pin, so the
reset you asked for is a wire and not a circuit. <b>Try the other one.</b> Change the first line to
<code>always @(posedge clk)</code>, leaving everything else alone, and press <b>Synthesize</b>
again:</p>
<ul>
  <li><b>Three cells</b> instead of one, and <b>8.5</b> NAND-equivalents instead of 6.</li>
  <li>A <code>not_gate</code> making <code>!rst_n</code>, and a <code>mux2_gate</code> - a switch with
  two inputs and a select - choosing <b>0</b> when the reset is asserted and <code>d</code> when it is
  not. Its output goes to the flip-flop's <code>d</code> pin.</li>
  <li>And <b>the flip-flop drawn without its reset pin at all</b>. The listing still says
  <code>.rstn(1'b1)</code> - tied high, held de-asserted, never used - and since nothing drives it,
  the diagram leaves the pin off rather than drawing one with a constant hanging on it. Compare the
  symbol against the figure at the top of this page: same box, same clock, one pin fewer.</li>
</ul>
<p><b>That is the shape of every clocked design there is.</b> One flip-flop per bit of state, and
gates in front of it computing the next value from the current one. Everything you write inside a
clocked block that is not the assignment itself becomes those gates - an <code>if</code> becomes a
multiplexer, a comparison becomes the logic that drives its select - and the flip-flops are the only
things that remember. An asynchronous reset is the one exception, and that is precisely why it came
out free: it is the only thing in that block the flip-flop can do by itself.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>NAND-equivalents are a way of counting. Here is that one cell as <b>a piece of wafer</b> - drawn
once by somebody and kept in a library ever since, with its power rails at the top and bottom edges so
it can be abutted to whatever sits beside it. The colours are the mask layers: the well is a tub of
doped silicon, the diffusions are pockets in it, polysilicon crossing a diffusion is a transistor
gate, and the metal above carries the wires on contacts.</p>
` },

    { layout: 'the-cell' },

    { html: String.raw`
<p><b>93.6 &micro;m</b> wide and <b>46.8 &micro;m</b> tall - and that height is the same on every page
of this site that draws a row of cells, because a cell library has one row height and everything in it
is built to fit. Area is width. This is a wide cell for one bit, which is that 6 against an XOR's 2.5
seen from above.</p>
<p>Now the synchronous version - the same design with the reset moved inside the block, which is the
three cells the tool built when you tried it:</p>
` },

    { layout: 'the-sync-form' },

    { html: String.raw`
<p><b>150.8 &micro;m</b> against <b>93.6</b>. The same one bit of memory, the same reset value, the
same library - and the synchronous form is more than half again as wide, because it computes its reset
out of gates while the other one uses a pin the cell already has. That is the whole cost of the
decision, and it is a decision either way: a synchronous reset is easier to reason about, since
nothing in the design changes except at a clock edge, and plenty of designs pay this row for it.</p>
<p>Both drawings are one row tall, which is not what a chip holding thousands of these looks like -
<a href="learn-adder-8bit.html">8-Bit Adder with One Line of Code</a> has a strip that wraps into
three rows, and that is what a floorplan is made of. And
<a href="learn-logic-gates.html">Logic Gates</a> goes the other way: down into a single one of these
cells, opened up into the transistors the layers above are drawn for, with a cross section through
them.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>A flip-flop on its own remembers. A flip-flop with something computing its <code>d</code> is a
<b>machine</b>, and you already have the something: put an adder in front of one and the value it
stores is the value it stored last, plus one - which is a <b>counter</b>, and it is the reason this
page comes after the adders rather than before them. Eight of these behind
<a href="learn-adder-8bit.html">8-Bit Adder with One Line of Code</a> is an accumulator, which is
most of what a processor does all day.</p>
<p>The <a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry Adder</a> is worth a second look
with this page in mind. Its carry has to cross four columns before the answer is right, and nothing
in that design says how long that takes - a clock is what turns "eventually" into "by the next edge",
and how fast the clock is allowed to run is decided by the slowest path between two flip-flops.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Eight questions on what a flip-flop is, when it looks, and what the tool builds around it. A wrong
answer says so and links back to the section it came from; the score at the foot of the panel is what
the Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE SYMBOL, and it is the whole netlist: this design synthesizes to a single `dff_gate` with all
     four of its ports on the cell's four pins, so the figure is not an illustration of a flip-flop -
     it is what Synthesize draws, wire for wire. Drawn by the netlist viewer's own node and wire code
     (see learn.js's note above figureGraph), so it is the same symbol in the same colours as the cell
     further down the page, and the two cannot drift.

     THE SPACING IS THE HARNESS'S, not a look: two nodes whose x ranges overlap must clear each other by
     the port height plus the 22px caption band, so 32 + 22 = 54px is the minimum gap between the three
     left-hand ports - 140px of fan against a 59px symbol. That is why they cannot each align with the
     pin they feed, and why only the DATA path is straight: `d` sits at 19.667 - 16, so d, the flop and
     q are one line across the top, and the two control inputs jog up into their pins from below. An
     earlier draft put the three ports 40px apart, which reads as correct and fails as `d and rstn
     overlap`.

     THE PIN POSITIONS ARE THE SYMBOL'S OWN, restated because they are what the offsets below mean: the
     dff box is 59px square, with `d` a third of the way down the left edge (19.667px), `rstn` two
     thirds down it (39.333), `q` a third of the way down the right one, and `clk` on the BOTTOM edge at
     44.44% across. A port is 32px tall with its pin at the middle, so a port sits at pin - 16.

     CLK IS THE ONE ON THE BOTTOM EDGE, and a wire into one is routed to 22px BELOW the pin and then
     straight up - so with only two ports its own would sit level with THAT point (59 + 22 - 16 = 65)
     and the wire would be one straight run and a turn up the stub. The third port pushes it to 111.667
     instead, which costs it that alignment and gives it a longer climb up the stub; the run is still
     clear of the body, since all of it is below the symbol's bottom edge. Same routing `adder-8bit`
     gives its carry in. */
  figures: {
    'flop': {
      caption: 'A D flip-flop with the design’s four ports on it: d in, the reset and the clock underneath it, q out. The triangle is the mark for an input that acts on an edge.',
      nodes: [
        { id: 'd', kind: 'in', label: 'd', x: 0, y: 3.667 },
        { id: 'rstn', kind: 'in', label: 'rst_n', x: 0, y: 57.667 },
        { id: 'clk', kind: 'in', label: 'clk', x: 0, y: 111.667 },
        { id: 'ff', kind: 'dff', x: 140, y: 0 },
        { id: 'q', kind: 'out', label: 'q', x: 260, y: 3.667 }
      ],
      /* [source, target, target pin, source pin] - a wire out of a flip-flop names `q` in the fourth
         slot, and a port's own single pin is `y` whichever way it faces. The pin is `rstn`, which is
         the CELL's name for it, where `rst_n` is what this design calls the port driving it - and the
         difference fails silently, since drawStatic discards a wire whose handle does not exist and
         the figure would simply come out one wire short. */
      edges: [
        ['d', 'ff', 'd'], ['rstn', 'ff', 'rstn'], ['clk', 'ff', 'clk'],
        ['ff', 'q', 'y', 'q']
      ]
    }
  },

  /* PLACEMENTS: the two netlists this page compares, as rows of standard cells, drawn by
     practice-pnr.js out of pnr.html's engine.

     BOTH WRITE THEIR OWN NETLIST rather than following the design, which is what the design being
     BEHAVIOURAL costs: a placement reads a netlist, and an `always` block names no cells, so
     `from: 'design'` would have nothing to place and would leave an empty bordered box in the prose.
     `the-cell` is a transcription of what Synthesize produces from the design as it ships - one cell,
     every pin on a port - and `the-sync-form` is what it produces once the reset moves inside the
     block, which is the edit the netlist section asks the reader to make. The prose quotes both
     widths, and those numbers are the drawer's own measured line under each figure rather than
     arithmetic done here: the engine works in lambda (144 and 232 of them, at 0.65 um each) and
     quoting lambda as microns is a mistake this site has shipped once already.

     THIS DESIGN COMES FIRST, which is the order the sections run in: the page's own cell, then the
     alternative it was compared against. The reverse reads as though the three-cell row were what the
     design does.

     NEITHER ASKS FOR `crossSection` OR `animate`. The process story belongs to `logic-gates`, which
     this page links to; these two are here for a comparison of area, and a second Play button would
     be a second copy of that story rather than an addition to this one. */
  layouts: {
    'the-cell': {
      caption: 'This design on the wafer: one flip-flop cell, with the reset on a pin of its own.',
      view: 'all',
      rowPx: 150,
      netlist: String.raw`module the_cell(
  input  clk,
  input  rst_n,
  input  d,
  output q
);

  dff_gate u0 (.clk(clk), .rstn(rst_n), .d(d), .q(q));

endmodule
`
    },
    'the-sync-form': {
      caption: 'The synchronous form as cells: an inverter and a multiplexer computing what the flip-flop stores.',
      view: 'all',
      rowPx: 150,
      netlist: String.raw`module the_sync_form(
  input  clk,
  input  rst_n,
  input  d,
  output q
);

  wire n_rst, next;

  not_gate  u0 (.a(rst_n), .y(n_rst));
  mux2_gate u1 (.sel(n_rst), .a(d), .b(1'b0), .y(next));
  dff_gate  u2 (.clk(clk), .rstn(1'b1), .d(next), .q(q));

endmodule
`
    }
  },

  /* Six phases at 10 time units each, so the run is 60 - stated here because there is no
     `truthTable` for it to be derived from, which is what having state costs (see the note at the top
     of the file). */
  maxTime: 60,

  /* One question per marked section, and `sec` is what ties each to the heading it came from: a wrong
     answer links back to that section, with the heading's own words as the link. `verilog` is asked
     twice, because when the block runs and how state is assigned inside it are two separate ideas and
     the second is the one every beginner gets wrong. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'remember',
          q: 'What separates this circuit from every one on the pages before it?',
          options: [
            'Those decide their outputs from the inputs they have now; this one holds a value between edges',
            'Those are built out of gates, and this one is not built out of anything smaller',
            'This one is faster, because it does not have to wait for its inputs to settle'
          ],
          answer: 0
        },
        {
          sec: 'edge',
          q: 'When does a D flip-flop look at <code>d</code>?',
          options: [
            'At the rising edge of the clock, and at no other moment',
            'Whenever d changes, like every circuit so far',
            'Twice per cycle, once on each edge of the clock'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'What does the sensitivity list of <code>always @(posedge clk or negedge rst_n)</code> say?',
          options: [
            'The two moments this block runs: a rising clock edge, and rst_n falling',
            'That the block runs whenever clk or rst_n changes in any direction',
            'That the signals it drives are wires rather than registers'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'Why is <code>q</code> given its new value with the nonblocking arrow rather than a plain <code>=</code>?',
          options: [
            'So every flip-flop reads the old values and lands its new one at the end of the same instant',
            'Because a plain equals sign is not allowed inside an always block',
            'Because the arrow form is quicker for the simulator to work out'
          ],
          answer: 0
        },
        {
          sec: 'waveform',
          q: 'In the run, <code>d</code> drops to 0 and comes back up while the clock is low. What does <code>q</code> do?',
          options: [
            'Nothing at all: it holds the value the last rising edge gave it',
            'It follows d down and back up, a moment behind it',
            'It goes to X, because d moved when it should not have'
          ],
          answer: 0
        },
        {
          sec: 'reset',
          q: '<code>q</code> drops to 0 at t=50, in the middle of a low phase with no clock edge near it. Why?',
          options: [
            'rst_n falling is in the sensitivity list, so the reset does not wait for an edge',
            'The reset is stored until the next edge, which is where q really changes',
            'The flip-flop lost its value because d and rst_n moved together'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'Synthesize gives exactly one cell, with nothing in front of its <code>d</code> pin. Why is there nothing to build?',
          options: [
            'The reset it was asked for is the one the flip-flop already has a pin for',
            'The synthesizer leaves a reset out and relies on the simulator for it',
            'A flip-flop cannot have logic in front of it, so there was nowhere to put any'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'Why is the synchronous row wider than the flip-flop on its own?',
          options: [
            'Its reset has to be built out of gates in front of the flip-flop, and they take room',
            'The single cell is drawn on a smaller process, so its layers are thinner',
            'A row gets shorter as it holds fewer cells, whatever those cells are'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. The whole of it is the clocked block - which is the page. No `library` here: nothing
     is instantiated, so there is nothing for the synthesizer to resolve. */
  verilog: String.raw`/* A D flip-flop: one bit of memory.
 *
 * The block runs at the rising edge of clk and at no other time, which is what
 * makes q hold its value between edges rather than following d the way a wire
 * would.
 *
 * State inside a clocked block is assigned with <=, the nonblocking form: work
 * the right-hand side out now, land it at the end of this instant, so every
 * flip-flop in a design samples the old values and changes together.
 *
 * The reset is ASYNCHRONOUS - negedge rst_n is in the sensitivity list, so the
 * block also runs the moment rst_n falls and q clears there and then, without
 * waiting for a clock edge. That is the flip-flop the cell library has: one
 * dff_gate, with rst_n on the reset pin it was drawn with. Move the reset inside
 * the block instead - always @(posedge clk) - and it happens at an edge like
 * everything else, which is a SYNCHRONOUS reset and costs two more cells.
 */
module dut(
  input      clk,
  input      rst_n,
  input      d,
  output reg q
);

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) q <= 1'b0;
    else        q <= d;
  end

endmodule
`,

  /* The hidden testbench. WRITTEN OUT rather than generated, because a sweep of every input
     combination is a claim that the outputs are a function of the inputs, which is exactly what this
     page says they are not (see the note at the top of the file). Six phases, each one thing the
     prose points at: the reset clearing q at t=0 before any edge, an edge taking d, d wobbling
     between edges with q unmoved, an edge taking a low d, an edge taking it back up, and the reset
     clearing q again at t=50 without waiting for the edge at t=55.

     THE CLOCK IS THE ONE EVERY DESIGN ON THIS SITE USES - 5 units low, 5 high, free-running - so its
     row is a plain square wave and the testbench's own delays cannot change its shape. Inputs move
     just after a falling edge, so each rising edge samples a d that has been steady for half a cycle,
     which is what real logic in front of a flip-flop has to manage. */
  testbench: String.raw`module tb;

  reg  clk, rst_n, d;
  wire q;

  dut u_dut (.clk(clk), .rst_n(rst_n), .d(d), .q(q));

  always #5 clk = ~clk;

  initial begin
    clk = 0; rst_n = 0; d = 1;
    @(negedge clk); $display("t=%d  rst_n=%b d=%b -> q=%b   reset cleared q at t=0, before any edge", $time, rst_n, d, q);

    rst_n = 1;
    @(negedge clk); $display("t=%d  rst_n=%b d=%b -> q=%b   the edge took d", $time, rst_n, d, q);

    d = 0; #2; d = 1; #2;
    @(negedge clk); $display("t=%d  rst_n=%b d=%b -> q=%b   d wobbled between edges, q did not move", $time, rst_n, d, q);

    d = 0;
    @(negedge clk); $display("t=%d  rst_n=%b d=%b -> q=%b   the edge took d", $time, rst_n, d, q);

    d = 1;
    @(negedge clk); $display("t=%d  rst_n=%b d=%b -> q=%b   the edge took d", $time, rst_n, d, q);

    rst_n = 0;
    @(negedge clk); $display("t=%d  rst_n=%b d=%b -> q=%b   reset cleared q at t=50, with no edge", $time, rst_n, d, q);
    $finish;
  end

endmodule
`
};
