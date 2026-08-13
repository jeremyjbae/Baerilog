/* 3:8 Decoder - reference solution.
 *
 * One-hot means exactly one output bit is high, and which one is the binary value
 * of sel - so the whole design is a 1 shifted left by sel, gated by the enable.
 * A case statement listing all eight patterns is just as correct and is what a
 * schematic of AND gates would look like; the shift is shorter and says the same
 * thing.
 */
module decoder38(
  input [2:0] sel,
  input en,
  output [7:0] y
);
  assign y = en ? (8'b1 << sel) : 8'b0;
endmodule

// ======== TESTBENCH ========

module tb;
  reg [2:0] sel;
  reg en;
  wire [7:0] y;
  reg [7:0] pass, fail;

  decoder38 u_dec(.sel(sel), .en(en), .y(y));

  initial begin
    pass = 0; fail = 0;

    en = 1'b1; sel = 3'd0; #5;
    if (y == 8'b00000001) begin pass = pass + 1; $display("PASS  sel=0 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=0: expected 00000001, got %b", y); end

    sel = 3'd1; #5;
    if (y == 8'b00000010) begin pass = pass + 1; $display("PASS  sel=1 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=1: expected 00000010, got %b", y); end

    sel = 3'd3; #5;
    if (y == 8'b00001000) begin pass = pass + 1; $display("PASS  sel=3 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=3: expected 00001000, got %b", y); end

    sel = 3'd7; #5;
    if (y == 8'b10000000) begin pass = pass + 1; $display("PASS  sel=7 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=7: expected 10000000, got %b", y); end

    /* The enable is not an output-polarity option: en=0 means every bit low,
       whatever sel says. */
    en = 1'b0; sel = 3'd5; #5;
    if (y == 8'b00000000) begin pass = pass + 1; $display("PASS  en=0 blanks the output y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  en=0: expected 00000000, got %b", y); end

    en = 1'b1; sel = 3'd5; #5;
    if (y == 8'b00100000) begin pass = pass + 1; $display("PASS  en back on, sel=5 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=5: expected 00100000, got %b", y); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
