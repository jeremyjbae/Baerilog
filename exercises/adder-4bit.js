/* Exercise data for the 'adder-4bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/adder-4bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['adder-4bit'] = {
  descriptionHtml: String.raw`
<p>Implement <code>adder4</code>: add two 4-bit numbers and a carry-in, and produce a 4-bit
sum plus the carry-out.</p>
<div class="ex-code">module adder4(input [3:0] a, input [3:0] b, input cin,
              output [3:0] sum, output cout);</div>
<ul>
  <li><code>sum</code> is the low 4 bits of <code>a + b + cin</code>.</li>
  <li><code>cout</code> is the bit that falls out of the top - 1 exactly when the true sum is 16 or more.</li>
</ul>
<p>The skeleton already computes the sum and leaves <code>cout</code> undriven, which is why it
reads as X in the waveform. The fix is not a second adder: a <b>concatenation</b> on the
left of the assignment, <code>{cout, sum}</code>, is a single 5-bit target, so the carry
lands in <code>cout</code> instead of being discarded.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
`,
  starter: String.raw`
/* 4-bit Adder - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module adder4(
  input [3:0] a,
  input [3:0] b,
  input cin,
  output [3:0] sum,
  output cout
);
  /* TODO: this drops the carry - a + b + cin can need 5 bits, and only 4 are being
     assigned. Make the target 5 bits wide so cout catches the top one. */
  assign sum = a + b + cin;
endmodule

// ======== TESTBENCH ========

module tb;
  reg [3:0] a, b;
  reg cin;
  wire [3:0] sum;
  wire cout;
  reg [7:0] pass, fail;

  adder4 u_add(.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

  initial begin
    pass = 0; fail = 0;

    a = 4'd3; b = 4'd4; cin = 1'b0; #5;
    if (sum == 4'd7 && cout == 1'b0) begin pass = pass + 1; $display("PASS  3 + 4 = %0d, cout=%b", sum, cout); end
    else begin fail = fail + 1; $display("FAIL  3 + 4: expected sum=7 cout=0, got sum=%0d cout=%b", sum, cout); end

    a = 4'd3; b = 4'd4; cin = 1'b1; #5;
    if (sum == 4'd8 && cout == 1'b0) begin pass = pass + 1; $display("PASS  3 + 4 + 1 = %0d, cout=%b", sum, cout); end
    else begin fail = fail + 1; $display("FAIL  carry-in ignored: expected sum=8, got sum=%0d", sum); end

    a = 4'd9; b = 4'd7; cin = 1'b0; #5;
    if (sum == 4'd0 && cout == 1'b1) begin pass = pass + 1; $display("PASS  9 + 7 = 16, sum=%0d cout=%b", sum, cout); end
    else begin fail = fail + 1; $display("FAIL  9 + 7: expected sum=0 cout=1, got sum=%0d cout=%b", sum, cout); end

    a = 4'd15; b = 4'd15; cin = 1'b1; #5;
    if (sum == 4'd15 && cout == 1'b1) begin pass = pass + 1; $display("PASS  15 + 15 + 1 = 31, sum=%0d cout=%b", sum, cout); end
    else begin fail = fail + 1; $display("FAIL  15+15+1: expected sum=15 cout=1, got sum=%0d cout=%b", sum, cout); end

    a = 4'd0; b = 4'd0; cin = 1'b0; #5;
    if (sum == 4'd0 && cout == 1'b0) begin pass = pass + 1; $display("PASS  0 + 0 = 0, cout=%b", cout); end
    else begin fail = fail + 1; $display("FAIL  0 + 0: expected sum=0 cout=0, got sum=%0d cout=%b", sum, cout); end

    a = 4'd8; b = 4'd8; cin = 1'b0; #5;
    if (sum == 4'd0 && cout == 1'b1) begin pass = pass + 1; $display("PASS  8 + 8 carries out, cout=%b", cout); end
    else begin fail = fail + 1; $display("FAIL  8 + 8: expected sum=0 cout=1, got sum=%0d cout=%b", sum, cout); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
