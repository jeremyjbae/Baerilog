/* Exercise data for the 'gray-counter' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/gray-counter.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['gray-counter'] = {
  descriptionHtml: String.raw`
<p>Implement <code>gray4</code>, a 4-bit counter whose output is in <b>Gray code</b>: exactly one
bit changes between one step and the next.</p>
<div class="ex-code">module gray4(input clk, input rst_n, output [3:0] gray);</div>
<ul>
  <li><code>rst_n</code> is active low and starts the count at <code>0000</code>.</li>
  <li>The sequence is <code>0000</code>, <code>0001</code>, <code>0011</code>, <code>0010</code>, <code>0110</code>, <code>0111</code>, <code>0101</code>...</li>
  <li>The testbench checks the values <i>and</i> checks the one-bit property directly, by asserting that each step's difference from the last is a power of two.</li>
</ul>
<p>Counting in Gray code directly is fiddly; <b>converting</b> is one line. Keep the
ordinary binary counter the skeleton already has, and put its Gray form on the
output - a value XORed with itself shifted right by one. That is the whole trick, and
it is why Gray code exists: a value read while it is changing is either the old one
or the new one, never a mixture of the two.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates - when it can. The synthesizer reads a smaller subset than the simulator does (no shift operators, no memory arrays), so on some designs it reports what it cannot handle in the Console instead; the netlist cards only appear when it got all the way through.</p>
`,
  starter: String.raw`
/* 4-bit Gray-code Counter - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module gray4(
  input clk,
  input rst_n,
  output [3:0] gray
);
  reg [3:0] bin;

  always @(posedge clk) begin
    if (!rst_n) bin <= 4'd0;
    else        bin <= bin + 4'd1;
  end

  /* TODO: bin counts correctly, but plain binary changes several bits at once (0111
     to 1000 changes four). Convert it to Gray code here. */
  assign gray = bin;
endmodule

module tb;
  reg clk, rst_n;
  wire [3:0] gray;
  reg [3:0] prev, delta;
  reg [7:0] pass, fail, steps, onebit;

  gray4 u_gray(.clk(clk), .rst_n(rst_n), .gray(gray));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0; steps = 0; onebit = 0;
    clk = 0; rst_n = 0;

    @(negedge clk);
    rst_n = 1;
    if (gray == 4'b0000) begin pass = pass + 1; $display("PASS  reset -> %b", gray); end
    else begin fail = fail + 1; $display("FAIL  reset: expected 0000, got %b", gray); end

    prev = gray;
    @(negedge clk);
    if (gray == 4'b0001) begin pass = pass + 1; $display("PASS  step 1 -> %b", gray); end
    else begin fail = fail + 1; $display("FAIL  step 1: expected 0001, got %b", gray); end

    /* One bit per step, checked rather than eyeballed: the difference between two
       consecutive codes must be a power of two, i.e. d & (d-1) == 0 with d != 0. */
    delta = gray ^ prev;
    if (delta != 4'd0 && (delta & (delta - 4'd1)) == 4'd0) onebit = onebit + 1;
    steps = steps + 1;
    prev = gray;

    @(negedge clk);
    if (gray == 4'b0011) begin pass = pass + 1; $display("PASS  step 2 -> %b", gray); end
    else begin fail = fail + 1; $display("FAIL  step 2: expected 0011, got %b", gray); end
    delta = gray ^ prev;
    if (delta != 4'd0 && (delta & (delta - 4'd1)) == 4'd0) onebit = onebit + 1;
    steps = steps + 1;
    prev = gray;

    @(negedge clk);
    if (gray == 4'b0010) begin pass = pass + 1; $display("PASS  step 3 -> %b", gray); end
    else begin fail = fail + 1; $display("FAIL  step 3: expected 0010, got %b", gray); end
    delta = gray ^ prev;
    if (delta != 4'd0 && (delta & (delta - 4'd1)) == 4'd0) onebit = onebit + 1;
    steps = steps + 1;
    prev = gray;

    @(negedge clk);
    if (gray == 4'b0110) begin pass = pass + 1; $display("PASS  step 4 -> %b", gray); end
    else begin fail = fail + 1; $display("FAIL  step 4: expected 0110, got %b", gray); end
    delta = gray ^ prev;
    if (delta != 4'd0 && (delta & (delta - 4'd1)) == 4'd0) onebit = onebit + 1;
    steps = steps + 1;
    prev = gray;

    @(negedge clk);
    if (gray == 4'b0111) begin pass = pass + 1; $display("PASS  step 5 -> %b", gray); end
    else begin fail = fail + 1; $display("FAIL  step 5: expected 0111, got %b", gray); end
    delta = gray ^ prev;
    if (delta != 4'd0 && (delta & (delta - 4'd1)) == 4'd0) onebit = onebit + 1;
    steps = steps + 1;
    prev = gray;

    @(negedge clk);
    if (gray == 4'b0101) begin pass = pass + 1; $display("PASS  step 6 -> %b", gray); end
    else begin fail = fail + 1; $display("FAIL  step 6: expected 0101, got %b", gray); end
    delta = gray ^ prev;
    if (delta != 4'd0 && (delta & (delta - 4'd1)) == 4'd0) onebit = onebit + 1;
    steps = steps + 1;

    if (onebit == steps) begin pass = pass + 1; $display("PASS  exactly one bit changed in all %0d steps", steps); end
    else begin fail = fail + 1; $display("FAIL  only %0d of %0d steps changed a single bit", onebit, steps); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
