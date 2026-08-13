/* D Flip-Flop - reference solution.
 *
 * The one thing this exercise is about: q must be assigned NONBLOCKING (<=)
 * inside an always @(posedge clk) block. That is what makes it a register rather
 * than a wire, and it is why the value that lands on q is the d from *before*
 * the edge.
 */
module dff(
  input clk,
  input rst_n,
  input d,
  output reg q
);
  always @(posedge clk) begin
    if (!rst_n) q <= 1'b0;
    else        q <= d;
  end
endmodule

// ======== TESTBENCH ========

module tb;
  reg clk, rst_n, d;
  wire q;
  reg [7:0] pass, fail;

  dff u_dff(.clk(clk), .rst_n(rst_n), .d(d), .q(q));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0; d = 1;

    @(negedge clk);   /* the rising edge at t=5 happened with reset asserted */
    if (q == 1'b0) begin pass = pass + 1; $display("PASS  reset wins over d=1        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  reset: expected q=0, got q=%b", q); end

    rst_n = 1; d = 1;
    @(negedge clk);
    if (q == 1'b1) begin pass = pass + 1; $display("PASS  d=1 captured on the edge   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  d=1: expected q=1, got q=%b", q); end

    d = 0;
    @(negedge clk);
    if (q == 1'b0) begin pass = pass + 1; $display("PASS  d=0 captured on the edge   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  d=0: expected q=0, got q=%b", q); end

    /* d moves while the clock is low: q must NOT follow it. A design that used a
       plain "assign q = d;" or an always @(*) passes every check above and fails
       this one. */
    d = 1;
    if (q == 1'b0) begin pass = pass + 1; $display("PASS  d changed between edges    q=%b (still)", q); end
    else begin fail = fail + 1; $display("FAIL  q followed d without a clock edge: q=%b", q); end

    @(negedge clk);
    if (q == 1'b1) begin pass = pass + 1; $display("PASS  next edge takes it up      q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=1 after the edge, got q=%b", q); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
