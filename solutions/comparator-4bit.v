/* 4-bit Magnitude Comparator - reference solution.
 *
 * Three outputs, and the property that matters is that exactly one of them is
 * high for any pair of inputs - which falls out for free when each is written as
 * its own relational expression rather than derived from the other two.
 *
 * Note these are UNSIGNED comparisons: 4'b1000 is 8, not -8. The simulator's
 * values are plain bit patterns, so a signed comparator would have to compare the
 * top bits itself.
 */
module comp4(
  input [3:0] a,
  input [3:0] b,
  output lt,
  output eq,
  output gt
);
  assign lt = (a < b);
  assign eq = (a == b);
  assign gt = (a > b);
endmodule

// ======== TESTBENCH ========

module tb;
  reg [3:0] a, b;
  wire lt, eq, gt;
  reg [7:0] pass, fail;

  comp4 u_cmp(.a(a), .b(b), .lt(lt), .eq(eq), .gt(gt));

  initial begin
    pass = 0; fail = 0;

    a = 4'd3; b = 4'd9; #5;
    if (lt == 1'b1 && eq == 1'b0 && gt == 1'b0) begin pass = pass + 1; $display("PASS  3 < 9        lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  3 < 9: expected 100, got %b%b%b", lt, eq, gt); end

    a = 4'd9; b = 4'd3; #5;
    if (lt == 1'b0 && eq == 1'b0 && gt == 1'b1) begin pass = pass + 1; $display("PASS  9 > 3        lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  9 > 3: expected 001, got %b%b%b", lt, eq, gt); end

    a = 4'd7; b = 4'd7; #5;
    if (lt == 1'b0 && eq == 1'b1 && gt == 1'b0) begin pass = pass + 1; $display("PASS  7 == 7       lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  7 == 7: expected 010, got %b%b%b", lt, eq, gt); end

    a = 4'd0; b = 4'd0; #5;
    if (lt == 1'b0 && eq == 1'b1 && gt == 1'b0) begin pass = pass + 1; $display("PASS  0 == 0       lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  0 == 0: expected 010, got %b%b%b", lt, eq, gt); end

    a = 4'd15; b = 4'd0; #5;
    if (lt == 1'b0 && eq == 1'b0 && gt == 1'b1) begin pass = pass + 1; $display("PASS  15 > 0       lt/eq/gt = %b%b%b", lt, eq, gt); end
    else begin fail = fail + 1; $display("FAIL  15 > 0: expected 001, got %b%b%b", lt, eq, gt); end

    /* Unsigned: 8 is bigger than 7, even though its top bit is set. */
    a = 4'b1000; b = 4'b0111; #5;
    if (gt == 1'b1) begin pass = pass + 1; $display("PASS  1000 > 0111 unsigned    gt=%b", gt); end
    else begin fail = fail + 1; $display("FAIL  comparison is not unsigned: gt=%b", gt); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
