/* Topic content for the 'subtractor-4bit' learn page - the topic that explains negative numbers, and
 * the one place in Arithmetic where the answer to "how does the hardware do this" is "it does not".
 *
 * SUBTRACTION IS NOT A CIRCUIT HERE. There is no subtractor cell in this library and no borrow chain
 * anywhere on the page: a - b is computed as a + (~b) + 1, so the hardware is the adder the reader
 * already has with an inverter on one input and the carry in tied to 1. That is the whole topic, and
 * it is why this page comes after `ripple-carry-4bit` rather than beside it.
 *
 * AND THE TOOL SAYS SO ITSELF, which is the fact the netlist section is built on. Measured: `assign
 * diff = a - b;` synthesizes to a generated `FUNC_sub4` block, and inside that block are FOUR
 * INVERTERS AND FOUR FULL ADDERS - no borrow logic of any kind. The reader double-clicks and sees the
 * claim rather than reading it.
 *
 * TWO'S COMPLEMENT IS THEREFORE A CONSEQUENCE, not a convention to be memorised: if -b has to be
 * `~b + 1` for the adder to give the right answer, then that IS what a negative number looks like, and
 * 5 - 9 landing as 1100 is the same four bits as -4. The page shows both readings of that pattern and
 * says which one the hardware has an opinion about, which is neither.
 *
 * ONE LAYOUT FIGURE, ONE ROW PER BIT: 16 cells at 256 lambda comes out as four rows of four, and a row
 * is an inverter, the two half adders the full adder expands into, and their OR. That the rows land on
 * the bit slices is not luck - a slice is 256 lambda, so the width was chosen to be exactly one.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['subtractor-4bit'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="minus">There is no subtractor</h2>
<p>Four pages of this site are about adding, and adding has a circuit: a column of gates per bit, with
a carry running along them. Subtraction looks like it should need another one - a borrow chain, running
the other way, with its own cells - and it does not. <b>Nothing on this page subtracts.</b></p>
<p>The trick is old and it is the reason computers represent negative numbers the way they do. Instead
of taking <code>b</code> away from <code>a</code>, <b>add the negative of b</b>:</p>
<div class="learn-note">
  <b>a &minus; b = a + (&minus;b)</b>, and in binary <b>&minus;b is <code>~b + 1</code></b> - every bit
  of <code>b</code> flipped, plus one. So a subtractor is an adder with an inverter on one input and its
  carry in tied to <b>1</b>. That is the entire circuit.
</div>
<p>Check it on one column of four bits. <code>b</code> is 5, <code>0101</code>; flip it and you get
<code>1010</code>; add 1 and you get <code>1011</code>. Now add that to <code>a</code> = 9,
<code>1001</code>: the answer is <code>1</code> <code>0100</code>, and dropping the fifth bit leaves
<code>0100</code> - which is 4, and 9 &minus; 5 is 4.</p>
` },

    { figure: 'sub-slice' },

    { html: String.raw`
<p>The carry in is what makes the <code>+ 1</code> free: it is a pin the adder already had, tied high
instead of low. And the fifth bit that fell off the top is the same one the
<a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry Adder</a> calls the carry out - on a
subtraction it means the answer did <em>not</em> go negative, which is the opposite of what it means on
an addition and is why a processor keeps them as separate flags.</p>
` },

    { html: String.raw`
<h2 data-sec="verilog">The same thing in Verilog</h2>
<p>One line, and it says nothing about inverters at all:</p>
<pre class="learn-code">assign diff = a - b;</pre>
<p>Which is the point. You write the arithmetic; the tool knows the trick. This is the
<a href="learn-adder-8bit.html">8-Bit Adder</a> page's argument in the one case where the gap between
what you wrote and what you get is <em>interesting</em> - nobody would guess from that line that the
hardware under it contains four inverters and an adder.</p>
<p>Press <b>Run Simulation</b>. The testbench drives six pairs, three of which subtract a bigger number
from a smaller one - and the waveform below is where that gets interesting.</p>
` },

    { slot: 'editor' },

    { html: String.raw`
<h2 data-sec="waveform">Reading it as a waveform</h2>
<p><code>a</code>, <code>b</code> and <code>diff</code> are four bits wide, so they are value boxes.
Read the first three steps and it is ordinary arithmetic: 9 &minus; 5 is 4, 12 &minus; 3 is 9,
7 &minus; 7 is 0.</p>
<p>Then read the last three, where <code>b</code> is the bigger number. 5 &minus; 9 does not come out
as &minus;4, because there is no minus sign anywhere in four bits: it comes out as <code>c</code>,
which is 12. The next section is what that means.</p>
` },

    { slot: 'waveform' },

    { html: String.raw`
<h2 data-sec="twos">What 5 &minus; 9 comes out as</h2>
<p><code>1100</code>. Four bits, and they are the four bits a computer uses for &minus;4:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">a</th><th class="in">b</th><th class="sep"></th>
          <th>diff</th><th>read as unsigned</th><th>read as signed</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">9</td><td class="in">5</td><td class="sep"></td>
          <td>0100</td><td>4</td><td>4</td></tr>
      <tr><td class="in">7</td><td class="in">7</td><td class="sep"></td>
          <td>0000</td><td>0</td><td>0</td></tr>
      <tr><td class="in">5</td><td class="in">9</td><td class="sep"></td>
          <td>1100</td><td>12</td><td>&minus;4</td></tr>
      <tr><td class="in">0</td><td class="in">1</td><td class="sep"></td>
          <td>1111</td><td>15</td><td>&minus;1</td></tr>
    </tbody>
  </table>
</div>
<p><b>The hardware has no opinion about which column is right.</b> It produced four bits; the last two
columns are two ways of reading them, and the difference is entirely in the reader. That is what
<b>two's complement</b> means: the same adder, the same bits, and a convention that says a leading 1
counts as negative.</p>
<div class="learn-note">
  <b>Why this convention and not another?</b> Because it is the one that makes subtraction free. Any
  scheme for writing negative numbers could be chosen; this is the one where <code>~b + 1</code> added
  to <code>a</code> gives the right answer in every case, so no second circuit is needed.
</div>
<p>Which is also why the top bit is called the <b>sign bit</b> and why a four-bit signed number reaches
only 7: half of the sixteen patterns have been given to the negatives.</p>
` },

    { html: String.raw`
<h2 data-sec="netlist">What the tool builds from it</h2>
<p>Press <b>Synthesize</b>. The top level is one generated block, <code>FUNC_sub4</code>, with
<code>a</code>, <code>b</code> and <code>diff</code> on its pins - and the interesting part is one
double-click away.</p>
<p><b>Inside it: four inverters and four full adders.</b> Nothing else. No borrow chain, no subtractor
cell, no second kind of arithmetic - the tool built exactly the circuit the first section describes,
with the inverters on <code>b</code> and the first adder's carry in tied high. The page's claim is the
netlist's own structure.</p>
<p>Which is worth holding against the <a href="learn-ripple-carry-4bit.html">4-Bit Ripple-Carry
Adder</a>: that page's design and this one's are the same four full adders. All that a minus sign cost
is four inverters and a constant.</p>
` },

    { slot: 'netlist' },
    { slot: 'netlist-view' },

    { html: String.raw`
<h2 data-sec="silicon">...and as silicon</h2>
<p>Sixteen cells, and the placer's rows land on the design's structure: <b>one row per bit</b>. Read
along a row and it is an inverter, then the two half adders and the OR that a full adder expands into -
the same expansion the <a href="learn-full-adder-1bit.html">1-Bit Full Adder</a> page introduces:</p>
` },

    { layout: 'the-slices' },

    { html: String.raw`
<p><b>166.4 &micro;m</b> by <b>187.2 &micro;m</b>: almost square, and the tallest-for-its-width picture
on the site, because a bit slice here is only four cells wide. Compare it with the four-bit adder's own
strip - twelve cells - and the difference is those four inverters, one per bit, which is the whole
price of being able to subtract.</p>
<p>The carry still runs along the rows and up between them, exactly as it does on the adder pages, and
it is still what decides how fast the thing can go. Subtraction is not slower than addition here; it is
the same chain with a different value going into it.</p>
<p>As on the other wide topics, this figure carries <b>a netlist written out for it</b>: the design is
one <code>assign</code> over buses, and the placer reads plain nets.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>An adder that can subtract is most of an <a href="learn-alu-4bit.html">4-Bit ALU</a> - add a
multiplexer on <code>b</code>'s inverters and one control bit chooses between plus and minus, which is
how a real one does it. Comparison comes free with it too: <code>a &lt; b</code> is a subtraction whose
answer nobody keeps, read off the sign bit. And <a href="learn-logic-gates.html">Logic Gates</a> goes
the other way, into the mask layers these sixteen cells are drawn as.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Seven questions on subtracting by adding, and on what a leading 1 means. A wrong answer says so and
links back to the section it came from; the score at the foot of the panel is what the Learn hub shows
beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* ONE FIGURE: a single bit slice of the trick - the inverter on b, the full adder, and the carry in
     that carries the `+ 1` for the whole word. Drawn for bit 0 because that is where the constant goes:
     every other column's carry in comes from the column below it, so a figure of bit 1 would have the
     same shape with a wire instead of the constant and would say less.

     Pin positions are the viewer's own: an adder is 85 x 124 with a at 15/95 of its height, b at 65/95,
     cin on the BOTTOM edge and sum/cout at 30/95 and 50/95 on the right; an inverter is 49 x 35 with
     its input at mid-height. The left column keeps 56px between port boxes, the closest the harness's
     22px caption band allows, and the constant sits level with the leader the router gives a bottom
     pin - 22px below it - so its wire is one straight run and a turn up the stub. */
  figures: {
    'sub-slice': {
      caption: 'One column of a subtractor: b inverted, and the carry in carrying the plus one.',
      nodes: [
        { id: 'a0', kind: 'in', label: 'a[0]', x: 0, y: 4 },
        { id: 'b0', kind: 'in', label: 'b[0]', x: 0, y: 68.5 },
        { id: 'one', kind: 'const', label: "1'b1", x: 0, y: 132 },
        { id: 'nv', kind: 'not', label: 'not', x: 150, y: 67 },
        { id: 'fa', kind: 'add', label: 'add', x: 280, y: 0 },
        { id: 'd0', kind: 'out', label: 'diff[0]', x: 420, y: 100 },
        { id: 'c1', kind: 'out', label: 'carry', x: 420, y: 23 }
      ],
      edges: [
        ['a0', 'fa', 'a'],
        ['b0', 'nv', 'a'], ['nv', 'fa', 'b'],
        ['one', 'fa', 'cin'],
        ['fa', 'd0', 'y', 'sum'], ['fa', 'c1', 'y', 'cout']
      ]
    }
  },

  /* No truth table card: eight inputs is 256 rows, and the card is generated over the whole input space
     or not at all - `ripple-carry-4bit` records that decision. The four rows that matter are in the
     prose, the waveform is where the run is read, and 70 time units is the six cases the testbench
     drives at 10 apiece plus its settling delays. */
  maxTime: 70,

  /* One question per marked section, and `twos` is asked twice: it is the section the page exists for,
     and both halves are worth having - what the pattern means, and who decides. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'minus',
          q: 'How does this design subtract without a subtractor?',
          options: [
            'It adds the negative of b: every bit flipped, plus one',
            'It runs the adder backwards, with the carry chain reversed',
            'It compares the two numbers first and counts down from the larger'
          ],
          answer: 0
        },
        {
          sec: 'minus',
          q: 'Where does the "plus one" come from?',
          options: [
            'The adder\'s carry in, tied to 1 instead of 0 - a pin it already had',
            'A fifth adder column, added below the other four',
            'The inverters, which add one as they flip'
          ],
          answer: 0
        },
        {
          sec: 'verilog',
          q: 'The design says only <code>a - b</code>. What is interesting about that?',
          options: [
            'Nothing in the line hints at the four inverters and the adder underneath it',
            'It is the shortest possible way to write a borrow chain',
            'It leaves the tool free to choose between subtracting and comparing'
          ],
          answer: 0
        },
        {
          sec: 'waveform',
          q: 'On the last three steps b is the bigger number. What does the diff box show?',
          options: [
            'A pattern with its top bit set - there is no minus sign anywhere in four bits',
            'Zero, because the subtractor clamps at its smallest value',
            'The answer with a minus sign, which the viewer draws in front of the box'
          ],
          answer: 0
        },
        {
          sec: 'twos',
          q: '5 &minus; 9 comes out as 1100. What is that?',
          options: [
            'Four bits that read as 12 unsigned and as -4 signed - the hardware has no opinion',
            'An error code the adder produces when it cannot represent the answer',
            '12, because subtraction wraps the way the counter does'
          ],
          answer: 0
        },
        {
          sec: 'twos',
          q: 'Why is two\'s complement the convention rather than some other?',
          options: [
            'It is the one where adding ~b + 1 gives the right answer, so no second circuit is needed',
            'It is the only scheme in which zero has a single representation',
            'It makes the sign bit easy to test, which the others do not'
          ],
          answer: 0
        },
        {
          sec: 'netlist',
          q: 'What is inside the generated FUNC_sub4 block?',
          options: [
            'Four inverters and four full adders - no borrow logic at all',
            'Four subtractor cells, one per bit',
            'A comparator and an adder, chosen between by the sign'
          ],
          answer: 0
        },
        {
          sec: 'silicon',
          q: 'This layout is four cells wide against the adder page\'s twelve-cell strip. What are the extra cells?',
          options: [
            'The four inverters, one per bit - the whole price of being able to subtract',
            'Borrow cells, which the adder has no need of',
            'Nothing extra: the two pages place the same sixteen cells'
          ],
          answer: 0
        }
      ]
    }
  },

  /* THE DESIGN. One continuous assignment, and deliberately no borrow output: the fifth bit means the
     opposite of what it means on an addition, and a page that showed it without explaining the two
     flags would be teaching a confusion. The prose says what it is instead. */
  verilog: String.raw`/* A 4-bit subtractor, which contains no subtractor.
 *
 * a - b is computed as a + (~b) + 1: every bit of b flipped, and the adder's
 * carry in tied to 1. So the hardware is the adder from the earlier pages
 * with four inverters in front of it, and nothing here borrows.
 *
 * That is also where negative numbers come from. If -b has to be ~b + 1 for
 * the sum to be right, then those are the bits a negative number has - which
 * is what two's complement means, and why 5 - 9 lands as 1100.
 */
module dut(
  input  [3:0] a,
  input  [3:0] b,
  output [3:0] diff
);

  assign diff = a - b;

endmodule
`,

  /* The hidden testbench: six pairs, three of them with b larger than a, so half the run is the
     interesting half. The delays let the combinational block settle before each line is printed - a
     process that never yields reads the value from before its own write. */
  testbench: String.raw`module tb;

  reg  [3:0] a, b;
  wire [3:0] diff;

  dut u_dut (.a(a), .b(b), .diff(diff));

  initial begin
    a = 4'd9;  b = 4'd5; #10; $display("t=%d  %d - %d -> %b   9 - 5 = 4", $time, a, b, diff);
    a = 4'd12; b = 4'd3; #10; $display("t=%d  %d - %d -> %b   12 - 3 = 9", $time, a, b, diff);
    a = 4'd7;  b = 4'd7; #10; $display("t=%d  %d - %d -> %b   7 - 7 = 0", $time, a, b, diff);
    a = 4'd5;  b = 4'd9; #10; $display("t=%d  %d - %d -> %b   5 - 9 = 12 unsigned, -4 signed", $time, a, b, diff);
    a = 4'd0;  b = 4'd1; #10; $display("t=%d  %d - %d -> %b   0 - 1 is all ones, which is -1", $time, a, b, diff);
    a = 4'd8;  b = 4'd15; #10; $display("t=%d  %d - %d -> %b   8 - 15 = -7", $time, a, b, diff);
    $finish;
  end

endmodule
`,

  /* THE PLACEMENT: a netlist written out, since the design is one assign over buses and pnr reads plain
     nets. Written SLICE BY SLICE - inverter then adder column - so `rowWidth: 256` breaks it exactly at
     the slice boundary, which is what makes the rows one bit each: a slice is 256 lambda, so the width
     is one. `rowPx` is PER ROW, so 60 is 240px for the four, under what the column allows at this
     aspect. The `fa_gate`s arrive as two half adders and an OR each, which is why sixteen cells are
     drawn where the design names four adders and four inverters. */
  layouts: {
    'the-slices': {
      caption: 'Four bit slices, one to a row: the inverter on b, then that column of the adder.',
      view: 'all',
      rowWidth: 256,
      rowPx: 60,
      netlist: String.raw`module the_slices(
  input  a0, b0, a1, b1, a2, b2, a3, b3,
  output d0, d1, d2, d3, output cout
);

  not_gate v0 (.a(b0), .y(nb0));
  fa_gate  f0 (.a(a0), .b(nb0), .cin(one), .sum(d0), .cout(c1));
  not_gate v1 (.a(b1), .y(nb1));
  fa_gate  f1 (.a(a1), .b(nb1), .cin(c1),  .sum(d1), .cout(c2));
  not_gate v2 (.a(b2), .y(nb2));
  fa_gate  f2 (.a(a2), .b(nb2), .cin(c2),  .sum(d2), .cout(c3));
  not_gate v3 (.a(b3), .y(nb3));
  fa_gate  f3 (.a(a3), .b(nb3), .cin(c3),  .sum(d3), .cout(cout));

endmodule
`
    }
  }
};
