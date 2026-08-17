/* Topic content for the 'logic-gates' learn page.
 *
 * A topic is an ordered list of BLOCKS. Two kinds, and the split is the whole layout
 * mechanism: {html} is prose, and {slot} is a hole one of the app's cards is moved into
 * by learn.js. So a card can sit anywhere in the explanation rather than in a fixed
 * strip below it, and the cards themselves stay the ones shell.js injected - the editor,
 * the waveform, the netlist viewer, all wired exactly as they are on a practice page,
 * because every one of their handlers finds its element by id and does not care what it
 * hangs from.
 *
 * `verilog` is what the editor SHOWS. `testbench` is joined on at load and never shown - a
 * topic is read, and its stimulus is scaffolding rather than something the prose is about.
 * The line reading SWEEP in it is replaced by learn.js with a stimulus generated from
 * `truthTable.inputs`, so the sweep, the number of rows the table can have and the run
 * length all follow from one declaration and cannot disagree with each other. There is no
 * `maxTime` here for that reason: 2^N steps is exactly how long the sweep takes.
 *
 * THE DESIGN IS ONE TWO-INPUT GATE on purpose. The prose names all eight, because that is
 * what a reader needs to know, but the code shows one: a single assign and a single output
 * column is the smallest thing that demonstrates what a truth table IS, and every idea on
 * this page - combinational, a table as a specification, a waveform, a netlist - is visible
 * in it. Seven output columns is eight things to read before any of that lands.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may contain a
 * backtick, and neither may contain a dollar followed by a brace - either would end the
 * literal and turn the rest of the file into JavaScript. That is the hazard CLAUDE.md
 * records for EXAMPLES and for every exercise file here.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['logic-gates'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="gate">What a gate is</h2>
<p>A logic gate is a circuit whose output depends only on its inputs: change an input and the output follows as fast as the transistors
allow. It has no memory of what the inputs were a moment ago, and nothing has to tell it when to
look - which is what the word <b>combinational</b> means. You will meet it on every page here, and
that is all it is saying: the output is a function of the inputs, right now.</p>
<p>Because the output is a function of the inputs alone, you can write down everything
a gate does in a small table called Truth Table - one row per combination of inputs.</p>
<p>Eight of them account for almost all combinational logic. Six take two inputs, so four rows
are the whole of what each one does - one column per gate, side by side:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr>
        <th class="in">a</th><th class="in">b</th><th class="sep"></th>
        <th>AND</th><th>OR</th><th>NAND</th><th>NOR</th><th>XOR</th><th>XNOR</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="in">0</td><td class="in">0</td><td class="sep"></td>
        <td class="zero">0</td><td class="zero">0</td><td class="one">1</td>
        <td class="one">1</td><td class="zero">0</td><td class="one">1</td>
      </tr>
      <tr>
        <td class="in">0</td><td class="in">1</td><td class="sep"></td>
        <td class="zero">0</td><td class="one">1</td><td class="one">1</td>
        <td class="zero">0</td><td class="one">1</td><td class="zero">0</td>
      </tr>
      <tr>
        <td class="in">1</td><td class="in">0</td><td class="sep"></td>
        <td class="zero">0</td><td class="one">1</td><td class="one">1</td>
        <td class="zero">0</td><td class="one">1</td><td class="zero">0</td>
      </tr>
      <tr>
        <td class="in">1</td><td class="in">1</td><td class="sep"></td>
        <td class="one">1</td><td class="one">1</td><td class="zero">0</td>
        <td class="zero">0</td><td class="zero">0</td><td class="one">1</td>
      </tr>
    </tbody>
  </table>
</div>
<p>The other two take one input, so they have two rows rather than four:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr>
        <th class="in">a</th><th class="sep"></th>
        <th>NOT (Inverter)</th><th>BUF (Buffer)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="in">0</td><td class="sep"></td>
        <td class="one">1</td><td class="zero">0</td>
      </tr>
      <tr>
        <td class="in">1</td><td class="sep"></td>
        <td class="zero">0</td><td class="one">1</td>
      </tr>
    </tbody>
  </table>
</div>
<p>Read down a column and you have the gate. <b>AND</b> is 1 only where every input is 1 and
<b>OR</b> is 1 where any input is; <b>NAND</b> and <b>NOR</b> are those two columns inverted,
and they are the ones real silicon is built from - in static CMOS a NAND is cheaper than an
AND, because an AND <em>is</em> a NAND followed by an inverter. <b>XOR</b> is 1 where the
inputs differ, which is the column that adds, and <b>XNOR</b> is 1 where they agree, so it is
an equality test. <b>NOT</b> inverts its one input and <b>BUF</b> passes it through.</p>
<p>These are the symbols. They are the same shapes the synthesizer draws further down this
page, so the gate you meet here is the one you will recognise in a netlist: a flat back and a
round nose is an AND, a curved back is an OR, a bar across the input is an XOR, and a bubble on
the output is what inverts it - which is why NAND is an AND with a bubble and NOR is an OR with
one.</p>
` },

    { figure: 'the-eight' },

    { html: String.raw`
<p>The rest of this page follows one of them all the way down - from Verilog, to a table, to
a waveform, to cells on silicon. Start with AND: two inputs, one output, four rows.</p>
` },

    { html: String.raw`
<h2 data-sec="verilog">An AND gate in Verilog</h2>
<p>Here it is, in the editor below: nine lines, of which one builds anything. This is what each
part of it says.</p>

<h3>1. Module declaration</h3>
<pre class="learn-code">module dut(
  input  a,
  input  b,
  output y
);</pre>
<ul>
  <li><code>module dut</code> - declares a module named <code>dut</code>, for device under test.
      A module is the unit of hardware here: a name, a port list, and whatever is inside it.</li>
  <li><code>input a</code> and <code>input b</code> - two input ports, the question this gate is
      asked.</li>
  <li><code>output y</code> - one output port, its answer. No width is written on any of the
      three, so each is a single wire; <code>input [3:0] a</code> would be four of them.</li>
</ul>

<h3>2. Instantiating the gate</h3>
<pre class="learn-code">and_gate u0(.a(a), .b(b), .y(y));</pre>
<p>This is the line that puts a gate in the design, and it has four parts:</p>
<ol>
  <li><code>and_gate</code> - the module being instantiated: one of the eight above, which this
      page keeps in a library beside the design rather than in it. Swap the name and you swap
      the gate.</li>
  <li><code>u0</code> - the instance name, this particular gate. It is what distinguishes two
      copies of the same module, and it is the name the waveform and the netlist call it by.</li>
  <li><code>(...)</code> - the port mapping: which of <code>dut</code>'s own signals reach which
      of the gate's ports.</li>
  <li><code>.a(a)</code> - one connection, named. The dot names the <em>gate's</em> port and the
      parentheses hold <code>dut</code>'s signal, so the two <code>a</code>s here are different
      things that happen to agree. Naming them means the order cannot matter, which is why this
      form is worth the extra characters over a positional <code>u0(a, b, y)</code>.</li>
</ol>
<p>Instantiation is not a call and nothing here executes: it says a gate of that kind exists and
is wired that way, for all time.</p>
<p>On clicking <strong>Run Simulation</strong> four combination of the input will input to the <code>dut</code> and update the results in the <strong>Truth Table</strong> and <strong>Waveform</strong> below.</p>
<div class="learn-note">
  <b>What is Verilog?</b> Much like Python is used to write software, <strong>Verilog</strong> is used to design hardware. As a Hardware Description Language (HDL), it describes digital logic and circuit structures that standard programming languages cannot.</a>
</div>

` },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="table">Reading it as a table</h2>
<p>There is additional Verilog code to generate the test pattern as part of the simulation: changing input <code>a</code> and <code>b</code> every 10 time unit to test the behavior of <code>dut</code>. The results on <code>y</code> is shown as table below.</p>
<div class="learn-note">
Try it: change <code>and_gate</code> to <code>or_gate</code> in the editor and run again - the
output will become an OR, three 1s and one 0. Change it to <code>xor_gate</code> and you get XOR, 1
where the inputs differ.
</div>
` },

    { slot: 'truth-table' },

    { html: String.raw`
<h2 data-sec="waveform">...and as a waveform</h2>
<p>The same results, this time against time. A table is the better way to check a
combinational function; a waveform is the better way to see WHEN things change. Here <code>y</code> moves at the instant
an input does, because nothing in this design remembers anything.</p>
<p>Drag right on the plot to zoom into a range, drag left to zoom back out, and click to put
the cursor somewhere - the value column beside each name reads that instant.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="netlist">What it becomes as hardware</h2>
<p>Press <b>Synthesize</b> and the design is turned into a netlist: a list of standard
cells and the wires between them. This example has only one logic gate but it is very helpful to see the connection between many logic gate this way.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>The netlist above says which cells and how they connect. This is one of those cells as it is
actually drawn on the wafer using mask layers. You can visualize how the semiconductor process is working by clicking 'Unselect All' then showing the layers one by one from bottom to top &mdash; or press <b>Play</b> and watch it happen (Well, Diffusion, polysilicon and metal ...). Beside the layout is a <b>cross section</b> at the dashed line: the same masks seen edge-on, so the well is a tub, the diffusions are pockets inside it and the metal sits above on its contacts. Drag the line, or step it with the arrows, to cut the cell somewhere else &mdash; it opens through both transistor gates, which is the one place you see the whole stack at once.</p>
<div class="learn-note">
Modern manufacturing requires tens to over 100 process layers. The world’s most advanced chips are still designed using these tiny cells, leveraging multiple cell variations to optimize for speed and power consumption.
</div>
` },

    { layout: 'the-cell' },

    { html: String.raw`
<div class="learn-note">
  <b>The whole process, start to finish.</b> What the figure above steps through is four layers of
  one cell. A real fab runs the same idea &mdash; grow, mask, expose, etch, deposit &mdash; a hundred
  times over across a whole wafer, and it is worth watching somebody walk through it:
  <a href="https://www.youtube.com/watch?v=c9arR8T0Qts" rel="noreferrer">The Semiconductor Production
  Process Explained Clearly</a> (video, off-site).
</div>
` },
    { html: String.raw`
<h2>Check yourself</h2>
<p>Six questions, one for each section above. A wrong answer says so and links back to the
section it came from, so nothing here has to be got right first time; the score at the foot of
the panel is what the Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' },
  ],

  /* THE QUIZ, one question per section, and `sec` is what ties the two together: it names the
   * `data-sec` on a heading above, and a WRONG answer then links back to that section with the
   * heading's own words as the link. Only when wrong - offered up front it would say where to look
   * before the reader has thought - and learn.js takes the label from the page rather than from
   * here, so the quiz cannot end up naming a section by a title the page no longer uses.
   *
   * Every section on this page is named by exactly one question, which is the reason there are six
   * rather than four: a section with no question is a part of the article the panel never sends
   * anyone back to.
   *
   * The distractors are the misreadings this page is written against - that a gate might remember
   * something, that `u0` is the gate's type rather than this particular gate, that synthesis
   * produces a layout - not filler. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'gate',
          q: 'Four rows are enough to say everything a two-input gate does because...',
          options: [
            'its output depends only on its inputs, so there is nothing else to write down',
            'the fourth row always repeats the first',
            'a gate only ever sees four of the sixteen possible inputs'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'In <code>and_gate u0(.a(a), .b(b), .y(y));</code>, what is <code>u0</code>?',
          options: [
            'The kind of gate being built',
            'The instance name - this particular gate',
            'A signal inside dut'
          ],
          answer: 1
        },
        {
          sec: 'table',
          q: 'Change <code>and_gate</code> to <code>or_gate</code> and run again. The <code>y</code> column becomes...',
          options: ['one 1 and three 0s', 'unchanged', 'three 1s and one 0'],
          answer: 2
        },
        {
          sec: 'waveform',
          q: 'On the waveform, <code>y</code> moves at the instant an input does. Why?',
          options: [
            'Nothing in this design remembers anything',
            'The clock is fast enough to keep up',
            'The waveform is drawn after the run, so everything lines up'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'What does <b>Synthesize</b> produce?',
          options: [
            'A faster version of the same Verilog',
            'The transistors, drawn on the wafer',
            'A netlist: standard cells, and the wires between them'
          ],
          answer: 2
        },
        {
          sec: 'silicon',
          q: 'In the layout figure, what is the cross section beside the cell?',
          options: [
            'The same masks seen edge-on, at the dashed line',
            'The cell from above with the metal hidden',
            'A second cell, abutted to the first'
          ],
          answer: 0
        }
      ]
    }
  },

  /* Figures: hand-authored diagrams drawn by the netlist viewer's own node and wire code
     (see learn.js's note above figureGraph), so they are the same shapes and the same tokens
     as the netlist further up the page.

     This one shows what no synthesis of `y = a & b` would ever produce - the AND opened up
     into the NAND and inverter it really is - which is exactly what a figure is for.

     Positions are in the same pixel space the viewer lays nodes out in, so the pins line up by
     construction: nodeSize decides each box and the wires are drawn to its own handles. An
     input port is 92 wide, a NAND 58, an inverter 49. */
  /* Placements: what the design becomes on the wafer. `from: 'design'` is the whole point - the
     design instantiates a cell, which IS a netlist, so it goes straight into placement with no
     synthesis in between and the picture follows the editor: swap and_gate for nor_gate and this
     draws the nor cell's layout instead.

     `view: 'all'` is every mask layer, which is what a page about silicon wants; 'phantom' would
     draw the abutment box and the pins, the floorplan reading. `rowPx` is the only sizing knob: one
     row of cells at that many pixels tall, width following the aspect. */
  layouts: {
    'the-cell': {
      from: 'synthesis',
      view: 'all',
      rowPx: 220,
      /* THE TWO SWITCHES, opt-in per figure. `crossSection` opens SHOWN, because a page about how
         the process works is the one that asked for it and the switch is there to put it away;
         `animate` opens STOPPED, because a figure that starts moving on load is what
         `prefers-reduced-motion` is about. The cut opens at the centre of the first transistor gate,
         derived rather than written here - which is the one cut that gives the textbook picture, and
         on an inverter it is 1 of 31 positions. */
      crossSection: true,
      animate: true
    }
  },

  figures: {
    /* The eight symbols, named, in one row - which reads as a chart in a way two rows do not,
       at the cost of about 670px: on a phone the box scrolls rather than shrinking the symbols
       (see learn.css), which is the same trade the emulator's TV makes.

       POSITIONS START AT ZERO. Centring is drawStatic's and learn.css's - the drawing is a block
       of its own width with auto margins - so a figure never carries an x offset to centre
       itself, which would be centred at one column width and wrong at every other.

       Widths are not uniform: an AND and an OR are 52, the inverted ones 58 and 65 because the
       bubble sits outside the body, and a NOT is 49 x 35 against everything else's 52. So the
       pitch is 100, and the NOT is nudged 8 down onto its neighbours' centreline rather than
       aligned to their top edge. There are no wires - a symbol chart is nodes only, which is why
       this figure declares no edges at all. */
    'the-eight': {
      caption: 'The eight gates, in the shapes the netlist viewer draws them.',
      nodes: [
        { id: 'g_and',  kind: 'and',  caption: 'AND',  x: 0,   y: 0 },
        { id: 'g_or',   kind: 'or',   caption: 'OR',   x: 100, y: 0 },
        { id: 'g_nand', kind: 'nand', caption: 'NAND', x: 200, y: 0 },
        { id: 'g_nor',  kind: 'nor',  caption: 'NOR',  x: 300, y: 0 },
        { id: 'g_xor',  kind: 'xor',  caption: 'XOR',  x: 400, y: 0 },
        { id: 'g_xnor', kind: 'xnor', caption: 'XNOR', x: 500, y: 0 },
        { id: 'g_not',  kind: 'not',  caption: 'inverter',  x: 600, y: 8 },
        { id: 'g_buf',  kind: 'buf',  caption: 'buffer',  x: 700, y: 8 }
      ]
    }
  },

  /* The columns, in order. The VALUES come from the recorded run, so this list only decides
     what is shown and in what order - and it is also what the sweep is generated from, so
     the four rows and the four stimulus steps are one declaration rather than two that
     happen to agree.

     Names are resolved as the waveform resolves them: an unqualified one is the top module's
     own, a nested one would be written u_and.y. So the headings are the names the reader is
     looking at in the source above.

     `scale` may be added here as well - a multiplier on the 12px learn.css sets, reaching every
     truth table on the page at once, the card's and any the prose writes out. It is deliberately
     absent on this page, which is what keeps it at the 12px it has always been; `lego-logic`
     carries one and its own comment explains the knob. learn.js clamps it to 0.6 - 2.5. */
  truthTable: {
    inputs: ['a', 'b'],
    outputs: ['y'],
    step: 10,
    sampleAt: 5
  },

  /* THREE PARTS, and the split is what decides where each one is used:

       `verilog`   the module the page is ABOUT. The only thing the Source Editor shows, and the
                   synthesizer's top - derived, because there is exactly one module here, so no
                   topic ever declares a top module by name.
       `library`   modules the design needs but the reader is not reading. Compiled for the run
                   AND handed to the synthesizer, so `dut`'s instantiation resolves and the
                   netlist has a real cell in it - but never shown in the editor.
       `testbench` the stimulus, hidden the same way. See below.

     So swapping `and_gate` for `or_gate` in the editor is the whole exercise, against a library
     that is already there and that the reader never has to scroll past. */
  verilog: String.raw`/* A two-input logic gate.
 *
 * Swap and_gate below for any of or_gate, nand_gate, nor_gate, xor_gate or
 * xnor_gate and run again: the truth table and the waveform follow, and so does
 * the netlist under Synthesize.
 *
 * not_gate and buf_gate take ONE input, so instantiating either means dropping
 * the .b() connection: buf_gate u0(.a(a), .y(y));
 */
module dut(
  input  a,
  input  b,
  output y
);

  and_gate u0(.a(a), .b(b), .y(y));

endmodule
`,

  /* The eight gates, hidden. They are the alternatives the design above chooses between, so they
     have to be COMPILED with it and given to the synthesizer, and they are not what the reader is
     editing - a page about one gate that opens on nine modules is a page you have to scroll to
     read.

     `not_gate` and `buf_gate` take ONE input and are the odd ones out; instantiating either means
     dropping the `.b()` connection. The buffer is here because the chart above NAMES it: a symbol
     chart offering a cell the library cannot supply sends a reader to
     `Unknown module type 'buf_gate'`, so the two lists are one list. It looks like a gate that does
     nothing, which on this page is the point - the identity beside seven that all change their
     input. */
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

  /* The hidden testbench: the wrapper only - the regs, the wire, the instantiation - with
     the driving left to the line reading SWEEP, which learn.js replaces with a stimulus
     generated from truthTable.inputs above.

     The placeholder is a Verilog LINE comment on purpose: a block one could not be named in
     a comment like this one without ending it. */
  testbench: String.raw`module tb;

  reg  a, b;
  wire y;

  dut u_dut (.a(a), .b(b), .y(y));

  initial begin
    // SWEEP
  end

endmodule
`
};
