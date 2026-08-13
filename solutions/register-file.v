/* 8-bit Register File: two read ports, one write port - reference solution.
 *
 * Built the way a datapath actually is - out of discrete registers plus two kinds
 * of decoder - rather than as one array, because that is what makes the two read
 * ports visible: they are two independent muxes over the SAME four registers, so
 * reading r1 and r2 in the same cycle costs nothing.
 *
 *   rf_wdec   the write index -> a one-hot enable, so exactly one register loads
 *   rf_reg    one 8-bit register with an asynchronous reset
 *   rf_rdec   a read index -> that register's value (instantiated twice)
 *
 * idx_d is both the write index and the first read index, which is how a real
 * instruction set works: Rd is the destination and also an operand.
 */
module rf (
  input clk, rst_n,
  input [1:0] idx_d, idx_r,
  input       we,
  input [7:0] wdata,
  output [7:0] rd, rr
);
  wire [7:0] r0, r1, r2, r3;
  wire [3:0] we_1h;

  rf_reg u_r0(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[0]), .wdata(wdata), .r(r0));
  rf_reg u_r1(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[1]), .wdata(wdata), .r(r1));
  rf_reg u_r2(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[2]), .wdata(wdata), .r(r2));
  rf_reg u_r3(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[3]), .wdata(wdata), .r(r3));

  rf_wdec u_wdec(.idx(idx_d), .we(we), .we_1h(we_1h));
  rf_rdec u_rdec_d(.idx(idx_d), .r0(r0), .r1(r1), .r2(r2), .r3(r3), .opr(rd));
  rf_rdec u_rdec_r(.idx(idx_r), .r0(r0), .r1(r1), .r2(r2), .r3(r3), .opr(rr));
endmodule

module rf_reg (
  input clk, rst_n, we_1h,
  input [7:0] wdata,
  output reg [7:0] r
);
  always @(posedge clk or negedge rst_n)
    if (!rst_n)       r <= 8'b0;
    else if (we_1h)   r <= wdata;
endmodule

/* The write decoder. we is an enable on the whole file, not a fifth register: with
   we low, no bit of we_1h may be set. */
module rf_wdec (
  input [1:0] idx,
  input       we,
  output reg [3:0] we_1h
);
  always @(*)
    if (we)
      case (idx)
        2'd0: we_1h = 4'b0001;
        2'd1: we_1h = 4'b0010;
        2'd2: we_1h = 4'b0100;
        2'd3: we_1h = 4'b1000;
        default: we_1h = 4'b0000;
      endcase
    else
      we_1h = 4'b0000;
endmodule

/* One read port. Instantiated twice, so it must be a pure function of idx - a read
   port that remembered anything would make the two ports interfere. */
module rf_rdec(
  input [1:0] idx,
  input [7:0] r0, r1, r2, r3,
  output reg [7:0] opr
);
  always @(*)
    case (idx)
      2'd0: opr = r0;
      2'd1: opr = r1;
      2'd2: opr = r2;
      2'd3: opr = r3;
      default: opr = 8'h00;
    endcase
endmodule

// ======== TESTBENCH ========

module tb;
  reg clk, rst_n, we;
  reg [1:0] idx_d, idx_r;
  reg [7:0] wdata;
  wire [7:0] rd, rr;
  reg [7:0] pass, fail;

  rf u_rf(.clk(clk), .rst_n(rst_n), .idx_d(idx_d), .idx_r(idx_r),
          .we(we), .wdata(wdata), .rd(rd), .rr(rr));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses.

     The #1 delays below are for the COMBINATIONAL outputs: a process that never
     yields would read the value from before its own write, so an input change and a
     read of what it feeds need a moment between them. #1 stays inside the same low
     phase, so the clock is untouched. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0; we = 1'b0; wdata = 8'h00; idx_d = 2'd0; idx_r = 2'd1; #1;
    if (rd == 8'h00 && rr == 8'h00) begin pass = pass + 1; $display("PASS  reset zeros the file    rd=%h rr=%h", rd, rr); end
    else begin fail = fail + 1; $display("FAIL  after reset expected 00/00, got %h/%h", rd, rr); end

    @(negedge clk);
    rst_n = 1;

    /* r1 <= a5 */
    idx_d = 2'd1; wdata = 8'ha5; we = 1'b1;
    @(negedge clk);
    if (rd == 8'ha5) begin pass = pass + 1; $display("PASS  wrote r1, read it back  rd=%h", rd); end
    else begin fail = fail + 1; $display("FAIL  r1 write: expected a5, got %h", rd); end

    /* r2 <= 3c, then read r1 and r2 through the two ports at once. */
    idx_d = 2'd2; wdata = 8'h3c;
    @(negedge clk);
    we = 1'b0; idx_d = 2'd1; idx_r = 2'd2; #1;
    if (rd == 8'ha5 && rr == 8'h3c) begin pass = pass + 1; $display("PASS  both ports at once      rd=%h rr=%h", rd, rr); end
    else begin fail = fail + 1; $display("FAIL  expected rd=a5 rr=3c, got %h/%h", rd, rr); end

    /* Writing r2 must not have touched r1 - that is what the one-hot enable is for. */
    idx_d = 2'd1; idx_r = 2'd0; #1;
    if (rd == 8'ha5 && rr == 8'h00) begin pass = pass + 1; $display("PASS  neighbours untouched    r1=%h r0=%h", rd, rr); end
    else begin fail = fail + 1; $display("FAIL  expected r1=a5 r0=00, got %h/%h", rd, rr); end

    /* we=0: the edge happens, the data is on wdata, and nothing may change. */
    idx_d = 2'd1; wdata = 8'hff; we = 1'b0;
    @(negedge clk);
    if (rd == 8'ha5) begin pass = pass + 1; $display("PASS  we=0 blocks the write    r1=%h", rd); end
    else begin fail = fail + 1; $display("FAIL  we=0 still wrote: r1=%h", rd); end

    /* Both read ports may select the same register. */
    idx_d = 2'd1; idx_r = 2'd1; #1;
    if (rd == 8'ha5 && rr == 8'ha5) begin pass = pass + 1; $display("PASS  both ports read r1      rd=%h rr=%h", rd, rr); end
    else begin fail = fail + 1; $display("FAIL  expected a5/a5, got %h/%h", rd, rr); end

    /* Write while reading the same index: rd sees the new value once the edge lands. */
    idx_d = 2'd3; idx_r = 2'd3; wdata = 8'h77; we = 1'b1;
    @(negedge clk);
    if (rd == 8'h77 && rr == 8'h77) begin pass = pass + 1; $display("PASS  wrote r3, both ports see it %h", rd); end
    else begin fail = fail + 1; $display("FAIL  r3 write: expected 77/77, got %h/%h", rd, rr); end

    /* Asynchronous reset: no clock edge at all, and the file must clear. */
    we = 1'b0; rst_n = 0; #1;
    if (rd == 8'h00 && rr == 8'h00) begin pass = pass + 1; $display("PASS  async reset needs no edge  rd=%h", rd); end
    else begin fail = fail + 1; $display("FAIL  reset is not asynchronous: rd=%h rr=%h", rd, rr); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
