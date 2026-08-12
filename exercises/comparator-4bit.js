/* Exercise data for the 'comparator-4bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/comparator-4bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['comparator-4bit'] = {
  descriptionHtml: String.raw`
<p>Implement <code>comp4</code>, a 4-bit magnitude comparator with three separate outputs.</p>
<div class="ex-code">module comp4(input [3:0] a, input [3:0] b,
             output lt, output eq, output gt);</div>
<ul>
  <li><code>lt</code> is 1 when <code>a &lt; b</code>, <code>eq</code> when they are equal, <code>gt</code> when <code>a &gt; b</code>.</li>
  <li>Exactly one of the three is high for any pair of inputs - which comes for free if each is written as its own relational expression.</li>
  <li>The comparison is <b>unsigned</b>: <code>4'b1000</code> is 8, not -8, so it is greater than <code>4'b0111</code>.</li>
</ul>
<p><code>eq</code> is already written, so the shape of the answer is on screen; the other two
are the exercise.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* 4-bit Comparator - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module comp4(
  input [3:0] a,
  input [3:0] b,
  output lt,
  output eq,
  output gt
);
  /* TODO: lt and gt are tied low - write each as its own comparison of a and b.
     eq shows the shape. */
  assign lt = 1'b0;
  assign eq = (a == b);
  assign gt = 1'b0;
endmodule

module tb;
  reg [3:0] a, b;
  wire lt, eq, gt;
  reg [7:0] pass, fail;

  comp4 u_cmp(.a(a), .b(b), .lt(lt), .eq(eq), .gt(gt));

  initial begin
    pass = 0; fail = 0;

    a = 4'd3; b = 4'd9; #5;
    if (lt == 1'b1 && eq == 1'b0 && gt == 1'b0) begin pass = pass + 1; $display("PASS  3 < 9        lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  3 < 9: expected 100, got %b%b%b", lt, eq, gt); end

    a = 4'd9; b = 4'd3; #5;
    if (lt == 1'b0 && eq == 1'b0 && gt == 1'b1) begin pass = pass + 1; $display("PASS  9 > 3        lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  9 > 3: expected 001, got %b%b%b", lt, eq, gt); end

    a = 4'd7; b = 4'd7; #5;
    if (lt == 1'b0 && eq == 1'b1 && gt == 1'b0) begin pass = pass + 1; $display("PASS  7 == 7       lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  7 == 7: expected 010, got %b%b%b", lt, eq, gt); end

    a = 4'd0; b = 4'd0; #5;
    if (lt == 1'b0 && eq == 1'b1 && gt == 1'b0) begin pass = pass + 1; $display("PASS  0 == 0       lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  0 == 0: expected 010, got %b%b%b", lt, eq, gt); end

    a = 4'd15; b = 4'd0; #5;
    if (lt == 1'b0 && eq == 1'b0 && gt == 1'b1) begin pass = pass + 1; $display("PASS  15 > 0       lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  15 > 0: expected 001, got %b%b%b", lt, eq, gt); end

    /* Unsigned: 8 is bigger than 7, even though its top bit is set. */
    a = 4'b1000; b = 4'b0111; #5;
    if (gt == 1'b1) begin pass = pass + 1; $display("PASS  1000 > 0111 unsigned    gt=%b", gt); end
    else begin fail = fail + 1; $display("FAIL  comparison is not unsigned: gt=%b", gt); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
