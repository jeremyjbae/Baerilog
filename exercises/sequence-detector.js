/* Exercise data for the 'sequence-detector' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/sequence-detector.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['sequence-detector'] = {
  descriptionHtml: String.raw`
<p>Implement <code>seqdet</code>: watch a serial input and report every time the last four bits
received were <code>1011</code>.</p>
<div class="ex-code">module seqdet(input clk, input rst_n, input in, output found);</div>
<ul>
  <li>One bit arrives per rising clock edge, most recent last.</li>
  <li><code>found</code> is 1 while the last four bits read <code>1011</code>, and drops as soon as a fifth bit spoils it.</li>
  <li>Matches <b>overlap</b>: the stream <code>1011011</code> contains two of them, because the second match reuses the 1 that ended the first.</li>
  <li><code>rst_n</code> is active low and clears the history.</li>
</ul>
<p>A five-state FSM does this, and so does the 4-bit shift register the skeleton
declares - they are the same circuit. Shift the incoming bit into <code>hist</code> on each
edge and compare. The overlap is the part to be careful about: an FSM that returns to
its idle state after a match finds only the first, which is the classic bug here and
exactly what the seventh check is looking for.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* Sequence Detector (1011) - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module seqdet(
  input clk,
  input rst_n,
  input in,
  output found
);
  reg [3:0] hist;   /* hist[3] is the oldest bit, hist[0] the newest */

  always @(posedge clk) begin
    /* TODO: shift in on the low end of hist, so hist holds the last four bits. */
    if (!rst_n) hist <= 4'b0000;
    else        hist <= hist;
  end

  /* TODO: assert found when those four bits read 1011. */
  assign found = 1'b0;
endmodule

// ======== TESTBENCH ========

module tb;
  reg clk, rst_n, in;
  wire found;
  reg [7:0] pass, fail, hits;

  seqdet u_sd(.clk(clk), .rst_n(rst_n), .in(in), .found(found));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0; hits = 0;
    clk = 0; rst_n = 0; in = 0;

    @(negedge clk);
    rst_n = 1;
    if (found == 1'b0) begin pass = pass + 1; $display("PASS  quiet after reset        found=%b", found); end
    else begin fail = fail + 1; $display("FAIL  found asserted after reset"); end

    /* Feed 1 0 1 1 - the match must appear once the fourth bit is in. */
    in = 1;
    @(negedge clk);
    if (found == 1'b0) begin pass = pass + 1; $display("PASS  after 1                  found=%b", found); end
    else begin fail = fail + 1; $display("FAIL  matched too early after 1"); end

    in = 0;
    @(negedge clk);
    if (found == 1'b0) begin pass = pass + 1; $display("PASS  after 10                 found=%b", found); end
    else begin fail = fail + 1; $display("FAIL  matched too early after 10"); end

    in = 1;
    @(negedge clk);
    if (found == 1'b0) begin pass = pass + 1; $display("PASS  after 101                found=%b", found); end
    else begin fail = fail + 1; $display("FAIL  matched too early after 101"); end

    in = 1;
    @(negedge clk);
    if (found == 1'b1) begin pass = pass + 1; $display("PASS  1011 found              found=%b", found); end
    else begin fail = fail + 1; $display("FAIL  1011 not detected, found=%b", found); end
    if (found == 1'b1) hits = hits + 1;

    /* Next bit is 0, so the window is 0110 and the match must drop. */
    in = 0;
    @(negedge clk);
    if (found == 1'b0) begin pass = pass + 1; $display("PASS  match is one cycle long  found=%b", found); end
    else begin fail = fail + 1; $display("FAIL  found stayed high past the match"); end

    /* ...1 1 completes 1011 again, overlapping the first match's last 1. */
    in = 1;
    @(negedge clk);
    in = 1;
    @(negedge clk);
    if (found == 1'b1) begin pass = pass + 1; $display("PASS  overlapping match found  found=%b", found); end
    else begin fail = fail + 1; $display("FAIL  the overlapping 1011 was missed (FSM reset to idle?)"); end
    if (found == 1'b1) hits = hits + 1;

    /* A near miss: 1010 must not match. */
    in = 0;
    @(negedge clk);
    in = 1;
    @(negedge clk);
    in = 0;
    @(negedge clk);
    if (found == 1'b0) begin pass = pass + 1; $display("PASS  1010 is not a match      found=%b", found); end
    else begin fail = fail + 1; $display("FAIL  1010 matched"); end

    if (hits == 8'd2) begin pass = pass + 1; $display("PASS  exactly 2 matches in the stream"); end
    else begin fail = fail + 1; $display("FAIL  expected 2 matches, saw %0d", hits); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
