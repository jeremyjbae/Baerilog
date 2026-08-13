/* 8-bit Parity - reference solution.
 *
 * The unary ^ is a REDUCTION operator: it XORs every bit of its operand together
 * and yields one bit, which is exactly the definition of odd parity. Even parity
 * is its inverse, and ~^ is a single operator for it rather than a typo.
 *
 * Doing it the long way (data[0] ^ data[1] ^ ... ^ data[7]) is the same circuit -
 * the reduction operator just spares you seven of the eight terms.
 */
module parity8(
  input [7:0] data,
  output odd,
  output even
);
  assign odd  = ^data;
  assign even = ~^data;
endmodule

// ======== TESTBENCH ========

module tb;
  reg [7:0] data;
  wire odd, even;
  reg [7:0] pass, fail;

  parity8 u_par(.data(data), .odd(odd), .even(even));

  initial begin
    pass = 0; fail = 0;

    data = 8'b00000000; #5;
    if (odd == 1'b0 && even == 1'b1) begin pass = pass + 1; $display("PASS  00000000: no ones      odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  00000000: expected odd=0 even=1, got %b %b", odd, even); end

    data = 8'b00000001; #5;
    if (odd == 1'b1 && even == 1'b0) begin pass = pass + 1; $display("PASS  00000001: one 1        odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  00000001: expected odd=1 even=0, got %b %b", odd, even); end

    data = 8'b00000011; #5;
    if (odd == 1'b0 && even == 1'b1) begin pass = pass + 1; $display("PASS  00000011: two 1s       odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  00000011: expected odd=0 even=1, got %b %b", odd, even); end

    data = 8'b10110111; #5;
    if (odd == 1'b0 && even == 1'b1) begin pass = pass + 1; $display("PASS  10110111: six 1s       odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  10110111: expected odd=0 even=1, got %b %b", odd, even); end

    data = 8'b11111111; #5;
    if (odd == 1'b0 && even == 1'b1) begin pass = pass + 1; $display("PASS  11111111: eight 1s     odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  11111111: expected odd=0 even=1, got %b %b", odd, even); end

    /* The high bit counts too: a parity built from data[6:0] passes everything
       above and fails here. */
    data = 8'b10000000; #5;
    if (odd == 1'b1 && even == 1'b0) begin pass = pass + 1; $display("PASS  10000000: top bit only odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  10000000: expected odd=1 even=0, got %b %b", odd, even); end

    /* odd and even are opposites by construction - never both, never neither. */
    data = 8'b01010101; #5;
    if (odd != even) begin pass = pass + 1; $display("PASS  odd and even disagree   odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  odd and even are the same: %b %b", odd, even); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
