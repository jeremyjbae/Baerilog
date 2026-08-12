/* 4-bit Barrel Shifter (rotate left) - reference solution.
 *
 * A rotate is a shift whose bits come back round, and in Verilog that is a
 * concatenation rather than an arithmetic operation: rotating 4 bits left by 1 is
 * {data[2:0], data[3]} - the low three bits move up, and the bit that fell off
 * the top is put back at the bottom.
 *
 * All four amounts are spelled out because there are only four; a wider shifter
 * would be built as a chain of muxes, one per bit of amt, which is what makes it
 * a "barrel" shifter.
 */
module barrel4(
  input [3:0] data,
  input [1:0] amt,
  output [3:0] y
);
  assign y = (amt == 2'd0) ? data
           : (amt == 2'd1) ? {data[2:0], data[3]}
           : (amt == 2'd2) ? {data[1:0], data[3:2]}
                           : {data[0],   data[3:1]};
endmodule

module tb;
  reg [3:0] data;
  reg [1:0] amt;
  wire [3:0] y;
  reg [7:0] pass, fail;

  barrel4 u_rot(.data(data), .amt(amt), .y(y));

  initial begin
    pass = 0; fail = 0;

    data = 4'b1001; amt = 2'd0; #5;
    if (y == 4'b1001) begin pass = pass + 1; $display("PASS  1001 rot 0 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1001 rot 0: expected 1001, got %b", y); end

    amt = 2'd1; #5;
    if (y == 4'b0011) begin pass = pass + 1; $display("PASS  1001 rot 1 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1001 rot 1: expected 0011, got %b", y); end

    amt = 2'd2; #5;
    if (y == 4'b0110) begin pass = pass + 1; $display("PASS  1001 rot 2 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1001 rot 2: expected 0110, got %b", y); end

    amt = 2'd3; #5;
    if (y == 4'b1100) begin pass = pass + 1; $display("PASS  1001 rot 3 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1001 rot 3: expected 1100, got %b", y); end

    /* A plain shift loses bits; a rotate cannot. 1000 rotated by 1 has to come
       back as 0001, which is the check a << gets wrong. */
    data = 4'b1000; amt = 2'd1; #5;
    if (y == 4'b0001) begin pass = pass + 1; $display("PASS  1000 rot 1 wraps to %b", y); end
    else begin fail = fail + 1; $display("FAIL  1000 rot 1: expected 0001 (a rotate, not a shift), got %b", y); end

    data = 4'b1111; amt = 2'd2; #5;
    if (y == 4'b1111) begin pass = pass + 1; $display("PASS  1111 rot 2 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1111 rot 2: expected 1111, got %b", y); end

    data = 4'b0001; amt = 2'd3; #5;
    if (y == 4'b1000) begin pass = pass + 1; $display("PASS  0001 rot 3 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  0001 rot 3: expected 1000, got %b", y); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
