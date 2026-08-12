/* 4-bit Adder - reference solution.
 *
 * The whole design is one line, and the interesting part of it is the
 * concatenation on the left: {cout, sum} is a 5-bit target, so the carry that
 * falls out of bit 3 lands in cout instead of being thrown away. Writing
 * "assign sum = a + b + cin;" on its own would silently drop it.
 */
module adder4(
  input [3:0] a,
  input [3:0] b,
  input cin,
  output [3:0] sum,
  output cout
);
  assign {cout, sum} = a + b + cin;
endmodule

module tb;
  reg [3:0] a, b;
  reg cin;
  wire [3:0] sum;
  wire cout;
  reg [7:0] pass, fail;

  adder4 u_add(.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));

  initial begin
    pass = 0; fail = 0;

    a = 4'd3; b = 4'd4; cin = 1'b0; #5;
    if (sum == 4'd7 && cout == 1'b0) begin pass = pass + 1; $display("PASS  3 + 4 = %0d, cout=%b", sum, cout); end
    else begin fail = fail + 1; $display("FAIL  3 + 4: expected sum=7 cout=0, got sum=%0d cout=%b", sum, cout); end

    a = 4'd3; b = 4'd4; cin = 1'b1; #5;
    if (sum == 4'd8 && cout == 1'b0) begin pass = pass + 1; $display("PASS  3 + 4 + 1 = %0d, cout=%b", sum, cout); end
    else begin fail = fail + 1; $display("FAIL  carry-in ignored: expected sum=8, got sum=%0d", sum); end

    a = 4'd9; b = 4'd7; cin = 1'b0; #5;
    if (sum == 4'd0 && cout == 1'b1) begin pass = pass + 1; $display("PASS  9 + 7 = 16, sum=%0d cout=%b", sum, cout); end
    else begin fail = fail + 1; $display("FAIL  9 + 7: expected sum=0 cout=1, got sum=%0d cout=%b", sum, cout); end

    a = 4'd15; b = 4'd15; cin = 1'b1; #5;
    if (sum == 4'd15 && cout == 1'b1) begin pass = pass + 1; $display("PASS  15 + 15 + 1 = 31, sum=%0d cout=%b", sum, cout); end
    else begin fail = fail + 1; $display("FAIL  15+15+1: expected sum=15 cout=1, got sum=%0d cout=%b", sum, cout); end

    a = 4'd0; b = 4'd0; cin = 1'b0; #5;
    if (sum == 4'd0 && cout == 1'b0) begin pass = pass + 1; $display("PASS  0 + 0 = 0, cout=%b", cout); end
    else begin fail = fail + 1; $display("FAIL  0 + 0: expected sum=0 cout=0, got sum=%0d cout=%b", sum, cout); end

    a = 4'd8; b = 4'd8; cin = 1'b0; #5;
    if (sum == 4'd0 && cout == 1'b1) begin pass = pass + 1; $display("PASS  8 + 8 carries out, cout=%b", cout); end
    else begin fail = fail + 1; $display("FAIL  8 + 8: expected sum=0 cout=1, got sum=%0d cout=%b", sum, cout); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
