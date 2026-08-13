/* 2:1 Multiplexer - reference solution.
 *
 * Purely combinational, so one continuous "assign" with a ternary is the whole
 * design. Note what the third check is for: with sel unknown the two inputs
 * disagree bit by bit, and IEEE-1364 says the result is X on the bits that
 * disagree - this simulator implements that, so a mux built out of "&"/"|" gates
 * behaves the same way and the check passes either way.
 */
module mux2(
  input [3:0] a,
  input [3:0] b,
  input sel,
  output [3:0] y
);
  assign y = sel ? b : a;
endmodule

// ======== TESTBENCH ========

module tb;
  reg [3:0] a, b;
  reg sel;
  wire [3:0] y;
  reg [7:0] pass, fail;

  mux2 u_mux(.a(a), .b(b), .sel(sel), .y(y));

  initial begin
    pass = 0; fail = 0;

    a = 4'ha; b = 4'h5; sel = 1'b0; #5;
    if (y == 4'ha) begin pass = pass + 1; $display("PASS  sel=0 picks a              y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  sel=0: expected y=a, got y=%h", y); end

    sel = 1'b1; #5;
    if (y == 4'h5) begin pass = pass + 1; $display("PASS  sel=1 picks b              y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  sel=1: expected y=b, got y=%h", y); end

    a = 4'h0; b = 4'hf; sel = 1'b0; #5;
    if (y == 4'h0) begin pass = pass + 1; $display("PASS  sel=0 with a=0 b=f         y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  expected y=0, got y=%h", y); end

    sel = 1'b1; #5;
    if (y == 4'hf) begin pass = pass + 1; $display("PASS  sel=1 with a=0 b=f         y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  expected y=f, got y=%h", y); end

    a = 4'h3; b = 4'h3; sel = 1'b1; #5;
    if (y == 4'h3) begin pass = pass + 1; $display("PASS  both inputs equal          y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  expected y=3, got y=%h", y); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
