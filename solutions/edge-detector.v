/* Rising-Edge Detector - reference solution.
 *
 * The trick is that one flip-flop is enough: remember what "in" looked like at
 * the last clock edge, and a rise is "in is 1 now and the remembered value is 0".
 * "pulse" is combinational, so it goes high as soon as "in" rises and the next
 * clock edge clears it by moving prev up - one pulse per rise, however long "in"
 * stays high.
 */
module edge_det(
  input clk,
  input rst_n,
  input in,
  output pulse
);
  reg prev;

  always @(posedge clk) begin
    if (!rst_n) prev <= 1'b0;
    else        prev <= in;
  end

  assign pulse = in & ~prev;
endmodule

module tb;
  reg clk, rst_n, in;
  wire pulse;
  reg [7:0] pass, fail;

  edge_det u_ed(.clk(clk), .rst_n(rst_n), .in(in), .pulse(pulse));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  /* pulse is combinational, so after moving in there has to be a delay before it is
     read - a process that never yields sees the value from before its own write.
     #1 lands inside the same low phase, so the clock is untouched. */
  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0; in = 0;

    @(negedge clk);
    rst_n = 1; #1;
    if (pulse == 1'b0) begin pass = pass + 1; $display("PASS  idle low, no pulse         pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  pulse should be 0 while in=0, got %b", pulse); end

    in = 1; #1;
    if (pulse == 1'b1) begin pass = pass + 1; $display("PASS  in rose, pulse asserted    pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  in rose but pulse=%b", pulse); end

    /* The edge is remembered here, so the pulse must go away even though in
       stays high. A design that just wired pulse = in fails only this check. */
    @(negedge clk);
    if (pulse == 1'b0) begin pass = pass + 1; $display("PASS  in still 1, pulse cleared  pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  pulse must last one cycle, got %b", pulse); end

    @(negedge clk);
    if (pulse == 1'b0) begin pass = pass + 1; $display("PASS  no repeat while held high  pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  pulse re-fired without a new rise: %b", pulse); end

    in = 0; #1;
    if (pulse == 1'b0) begin pass = pass + 1; $display("PASS  falling edge, no pulse     pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  a fall must not pulse, got %b", pulse); end

    @(negedge clk);
    in = 1; #1;
    if (pulse == 1'b1) begin pass = pass + 1; $display("PASS  second rise detected       pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  second rise missed, pulse=%b", pulse); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
