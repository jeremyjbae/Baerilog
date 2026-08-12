/* 4-bit Ring Counter - reference solution.
 *
 * A ring counter holds one 1 and moves it round, so it is a shift register whose
 * output feeds back into its input - {q[2:0], q[3]}, the same concatenation a
 * rotate uses.
 *
 * The reset is what makes it work at all. A shift register that starts at 0000
 * shifts zeros round forever, and one that starts at X shifts X round forever, so
 * the single 1 has to be seeded, and reset is where that happens.
 */
module ring4(
  input clk,
  input rst_n,
  output reg [3:0] q
);
  always @(posedge clk) begin
    if (!rst_n) q <= 4'b0001;
    else        q <= {q[2:0], q[3]};
  end
endmodule

module tb;
  reg clk, rst_n;
  wire [3:0] q;
  reg [7:0] pass, fail;

  ring4 u_ring(.clk(clk), .rst_n(rst_n), .q(q));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0;

    @(negedge clk);
    if (q == 4'b0001) begin pass = pass + 1; $display("PASS  reset seeds one 1       q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  reset: expected 0001, got %b", q); end

    rst_n = 1;
    @(negedge clk);
    if (q == 4'b0010) begin pass = pass + 1; $display("PASS  step 1                   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  step 1: expected 0010, got %b", q); end

    @(negedge clk);
    if (q == 4'b0100) begin pass = pass + 1; $display("PASS  step 2                   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  step 2: expected 0100, got %b", q); end

    @(negedge clk);
    if (q == 4'b1000) begin pass = pass + 1; $display("PASS  step 3                   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  step 3: expected 1000, got %b", q); end

    /* The bit at the top has to come back to the bottom - this is where a plain
       shift register (q <= q << 1) parts company with a ring. */
    @(negedge clk);
    if (q == 4'b0001) begin pass = pass + 1; $display("PASS  wraps back round        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  wrap: expected 0001, got %b (a shift, not a ring?)", q); end

    @(negedge clk);
    if (q == 4'b0010) begin pass = pass + 1; $display("PASS  and keeps going         q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected 0010, got %b", q); end

    /* Reset in mid-flight puts it back to one 1, not to zero. */
    rst_n = 0;
    @(negedge clk);
    if (q == 4'b0001) begin pass = pass + 1; $display("PASS  reset mid-flight        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  reset mid-flight: expected 0001, got %b", q); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
