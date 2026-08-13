/* 4-bit Shift Register, built out of four flip-flops - reference solution.
 *
 * The design itself contains no logic at all: it is four dff instances and the
 * wiring between them. Each instance's d comes from the previous stage's q, and
 * stage 0's d is serial_in - so a bit entering at serial_in appears on q[0] after
 * one edge, q[1] after two, and leaves at q[3] after four.
 *
 * Because the simulator flattens the hierarchy by qualifying every signal with
 * its instance path, the individual stages show up in the waveform and the
 * hierarchy panel as u_sr.bit0.q, u_sr.bit1.q and so on - worth looking at, since
 * that is the shift happening one stage at a time.
 */
module dff(
  input clk,
  input d,
  output reg q
);
  always @(posedge clk)
    q <= d;
endmodule

module shiftreg(
  input clk,
  input serial_in,
  output [3:0] q
);
  /* Positional connections, in dff's own port order (clk, d, q). */
  dff bit0 (clk, serial_in, q[0]);
  dff bit1 (clk, q[0],      q[1]);
  dff bit2 (clk, q[1],      q[2]);
  dff bit3 (clk, q[2],      q[3]);
endmodule

// ======== TESTBENCH ========

module tb;
  reg clk, serial_in;
  wire [3:0] q;
  reg [7:0] pass, fail;

  shiftreg u_sr(.clk(clk), .serial_in(serial_in), .q(q));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; serial_in = 0;

    /* Flush four zeros through first, so the register starts from a known state
       instead of the X it powers up with. */
    @(negedge clk);
    @(negedge clk);
    @(negedge clk);
    @(negedge clk);
    if (q == 4'b0000) begin pass = pass + 1; $display("PASS  four zeros flushed through q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0000, got %b", q); end

    serial_in = 1;
    @(negedge clk);
    if (q == 4'b0001) begin pass = pass + 1; $display("PASS  a 1 entered at q[0]        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0001, got %b", q); end

    serial_in = 0;
    @(negedge clk);
    if (q == 4'b0010) begin pass = pass + 1; $display("PASS  it moved up to q[1]        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0010, got %b", q); end

    serial_in = 1;
    @(negedge clk);
    if (q == 4'b0101) begin pass = pass + 1; $display("PASS  1,0,1 in flight            q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0101, got %b", q); end

    serial_in = 1;
    @(negedge clk);
    if (q == 4'b1011) begin pass = pass + 1; $display("PASS  the whole word arrived     q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=1011, got %b", q); end

    /* One more edge: the oldest bit must fall off the top rather than stay. */
    serial_in = 0;
    @(negedge clk);
    if (q == 4'b0110) begin pass = pass + 1; $display("PASS  oldest bit shifted out     q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0110, got %b", q); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
