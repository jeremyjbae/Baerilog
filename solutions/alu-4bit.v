/* 4-bit ALU - reference solution.
 *
 * Eight operations, one "case" inside an always @(*). Two rules about that block
 * are worth knowing, and both are properties of how this simulator settles
 * combinational logic:
 *
 *   - every branch must assign y, including the default. A branch that leaves it
 *     alone would hold the previous value, which is a latch, not a mux.
 *   - the defaults-then-override idiom (y = 0 at the top, then the real value)
 *     does NOT work here: a signal written twice in one pass changes on every
 *     pass forever, and the settling loop reports a combinational loop.
 */
module alu4(
  input [3:0] a,
  input [3:0] b,
  input [2:0] op,
  output reg [3:0] y,
  output zero
);
  always @(*) begin
    case (op)
      3'd0: y = a + b;
      3'd1: y = a - b;
      3'd2: y = a & b;
      3'd3: y = a | b;
      3'd4: y = a ^ b;
      3'd5: y = ~a;
      3'd6: y = a << 1;
      3'd7: y = a >> 1;
      default: y = 4'd0;
    endcase
  end

  assign zero = (y == 4'd0);
endmodule

module tb;
  reg [3:0] a, b;
  reg [2:0] op;
  wire [3:0] y;
  wire zero;
  reg [7:0] pass, fail;

  alu4 u_alu(.a(a), .b(b), .op(op), .y(y), .zero(zero));

  initial begin
    pass = 0; fail = 0;

    a = 4'd6; b = 4'd3; op = 3'd0; #5;
    if (y == 4'd9) begin pass = pass + 1; $display("PASS  op0 add   6 + 3 = %0d", y); end
    else begin fail = fail + 1; $display("FAIL  op0 add: expected 9, got %0d", y); end

    op = 3'd1; #5;
    if (y == 4'd3) begin pass = pass + 1; $display("PASS  op1 sub   6 - 3 = %0d", y); end
    else begin fail = fail + 1; $display("FAIL  op1 sub: expected 3, got %0d", y); end

    a = 4'b1100; b = 4'b1010; op = 3'd2; #5;
    if (y == 4'b1000) begin pass = pass + 1; $display("PASS  op2 and   1100 & 1010 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op2 and: expected 1000, got %b", y); end

    op = 3'd3; #5;
    if (y == 4'b1110) begin pass = pass + 1; $display("PASS  op3 or    1100 | 1010 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op3 or: expected 1110, got %b", y); end

    op = 3'd4; #5;
    if (y == 4'b0110) begin pass = pass + 1; $display("PASS  op4 xor   1100 ^ 1010 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op4 xor: expected 0110, got %b", y); end

    op = 3'd5; #5;
    if (y == 4'b0011) begin pass = pass + 1; $display("PASS  op5 not   ~1100 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op5 not: expected 0011, got %b", y); end

    a = 4'b0101; op = 3'd6; #5;
    if (y == 4'b1010) begin pass = pass + 1; $display("PASS  op6 shl   0101 << 1 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op6 shl: expected 1010, got %b", y); end

    op = 3'd7; #5;
    if (y == 4'b0010) begin pass = pass + 1; $display("PASS  op7 shr   0101 >> 1 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op7 shr: expected 0010, got %b", y); end

    /* The shift is 4 bits wide: what leaves the top does not come back, and does
       not appear in bit 4 either. */
    a = 4'b1000; op = 3'd6; #5;
    if (y == 4'b0000 && zero == 1'b1) begin pass = pass + 1; $display("PASS  1000 << 1 leaves 0, zero=%b", zero); end
    else begin fail = fail + 1; $display("FAIL  1000 << 1: expected y=0000 zero=1, got y=%b zero=%b", y, zero); end

    /* zero is a flag on the RESULT, not on the inputs. */
    a = 4'd5; b = 4'd5; op = 3'd1; #5;
    if (y == 4'd0 && zero == 1'b1) begin pass = pass + 1; $display("PASS  5 - 5 = 0 and zero=%b", zero); end
    else begin fail = fail + 1; $display("FAIL  5 - 5: expected y=0 zero=1, got y=%0d zero=%b", y, zero); end

    a = 4'd5; b = 4'd1; op = 3'd0; #5;
    if (zero == 1'b0) begin pass = pass + 1; $display("PASS  nonzero result, zero=%b", zero); end
    else begin fail = fail + 1; $display("FAIL  zero should be 0 when y=%0d", y); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
