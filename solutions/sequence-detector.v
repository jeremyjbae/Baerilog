/* Sequence Detector for 1011 - reference solution.
 *
 * An FSM with five states does this, and so does a 4-bit shift register plus one
 * comparison - they are the same circuit, and the shift register is the honest
 * way to say it: remember the last four bits, and report when they read 1011.
 *
 * "Overlapping" falls out of that for free. After 1011 is found, the register
 * still holds those bits, so the input 1011011 is detected twice - once at the
 * fourth bit and again at the seventh, because the second match reuses the 1 that
 * ended the first. An FSM that returned to its idle state after a match would
 * find only the first, and that is the classic bug this exercise is about.
 */
module seqdet(
  input clk,
  input rst_n,
  input in,
  output found
);
  reg [3:0] hist;   /* hist[3] is the oldest bit, hist[0] the newest */

  always @(posedge clk) begin
    if (!rst_n) hist <= 4'b0000;
    else        hist <= {hist[2:0], in};
  end

  assign found = (hist == 4'b1011);
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
