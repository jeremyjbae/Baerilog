/* 4-bit Counter with a synchronous reset - reference solution.
 *
 * "Synchronous" is the whole point: reset is only looked at on a clock edge, so
 * it is the FIRST thing inside the always @(posedge clk) block rather than a
 * separate always @(negedge rst_n). And the counter wraps 15 -> 0 for free,
 * because count is 4 bits wide and the carry out of bit 3 has nowhere to go.
 */
module counter4(
  input clk,
  input rst,
  input en,
  output reg [3:0] count
);
  always @(posedge clk) begin
    if (rst)     count <= 4'd0;
    else if (en) count <= count + 4'd1;
  end
endmodule

// ======== TESTBENCH ========

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
