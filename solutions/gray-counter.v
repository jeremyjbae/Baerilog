/* 4-bit Gray-code Counter - reference solution.
 *
 * Counting in Gray code directly is fiddly; converting is one line. Keep an
 * ordinary binary counter and put its Gray form on the output:
 *
 *     gray = bin ^ (bin >> 1)
 *
 * Every step of the binary count then changes exactly one bit of the output,
 * which is the whole reason Gray code exists - a value read while it is changing
 * is either the old one or the new one, never a mixture.
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

  assign gray = bin ^ (bin >> 1);
endmodule

// ======== TESTBENCH ========

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
