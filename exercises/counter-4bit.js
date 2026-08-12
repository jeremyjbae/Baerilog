/* Exercise data for the 'counter-4bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/counter-4bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['counter-4bit'] = {
  descriptionHtml: String.raw`
<p>Implement <code>counter4</code>, a 4-bit up-counter with a <b>synchronous</b> reset and an enable.</p>
<div class="ex-code">module counter4(input clk, input rst, input en, output reg [3:0] count);</div>
<ul>
  <li><code>rst</code> is active <b>high</b> and synchronous: it only takes effect on a rising clock edge, and it beats <code>en</code>.</li>
  <li>Otherwise, if <code>en</code> is high, <code>count</code> increases by 1 on each rising edge.</li>
  <li>With <code>en</code> low the count holds.</li>
  <li><code>count</code> is 4 bits, so 15 + 1 is 0 - the wrap needs no code of its own.</li>
</ul>
<p>Synchronous reset means <code>rst</code> is tested <i>inside</i> the <code>always @(posedge clk)</code>
block, not in its sensitivity list.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* 4-bit Counter - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module counter4(
  input clk,
  input rst,
  input en,
  output reg [3:0] count
);
  always @(posedge clk) begin
    /* TODO: clear on rst, otherwise count up when en is high, otherwise hold. */
    count <= count;
  end
endmodule

module tb;
  reg clk, rst, en;
  wire [3:0] count;
  reg [7:0] pass, fail;

  counter4 u_cnt(.clk(clk), .rst(rst), .en(en), .count(count));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; rst = 1; en = 1;

    @(negedge clk);
    if (count == 4'd0) begin pass = pass + 1; $display("PASS  reset clears the count     count=%d", count); end
    else begin fail = fail + 1; $display("FAIL  reset: expected 0, got %d", count); end

    rst = 0;
    @(negedge clk);
    @(negedge clk);
    @(negedge clk);
    if (count == 4'd3) begin pass = pass + 1; $display("PASS  three enabled edges        count=%d", count); end
    else begin fail = fail + 1; $display("FAIL  expected 3 after three edges, got %d", count); end

    en = 0;
    @(negedge clk);
    if (count == 4'd3) begin pass = pass + 1; $display("PASS  en=0 holds the count       count=%d", count); end
    else begin fail = fail + 1; $display("FAIL  en=0 should hold 3, got %d", count); end

    /* Twelve more enabled edges take it from 3 to 15. */
    en = 1;
    @(negedge clk);   /* 4 */
    @(negedge clk);   /* 5 */
    @(negedge clk);   /* 6 */
    @(negedge clk);   /* 7 */
    @(negedge clk);   /* 8 */
    @(negedge clk);   /* 9 */
    @(negedge clk);   /* 10 */
    @(negedge clk);   /* 11 */
    @(negedge clk);   /* 12 */
    @(negedge clk);   /* 13 */
    @(negedge clk);   /* 14 */
    @(negedge clk);   /* 15 */
    if (count == 4'd15) begin pass = pass + 1; $display("PASS  counted up to the top      count=%d", count); end
    else begin fail = fail + 1; $display("FAIL  expected 15, got %d", count); end

    @(negedge clk);
    if (count == 4'd0) begin pass = pass + 1; $display("PASS  15 wraps back to 0         count=%d", count); end
    else begin fail = fail + 1; $display("FAIL  expected the wrap to 0, got %d", count); end

    /* Reset must beat enable on the same edge. */
    rst = 1;
    @(negedge clk);
    if (count == 4'd0) begin pass = pass + 1; $display("PASS  reset beats en on one edge count=%d", count); end
    else begin fail = fail + 1; $display("FAIL  reset should win, got %d", count); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
