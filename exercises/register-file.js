/* Exercise data for the 'register-file' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/register-file.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['register-file'] = {
  descriptionHtml: String.raw`
<p>Complete <code>rf</code>, a register file with <b>two read ports and one write port</b>. It is
built the way a real datapath is - four discrete registers plus two kinds of
decoder - and the wiring is already done. The two decoders are the exercise.</p>
<div class="ex-code">rf_wdec   write index + we  ->  a one-hot enable, so exactly one register loads
rf_reg    one 8-bit register with an asynchronous reset   (given)
rf_rdec   read index  ->  that register's value           (instantiated twice)</div>
<ul>
  <li><code>rf_wdec</code>: with <code>rf_we</code> high, set the one bit of <code>we_1h</code> that matches <code>idx</code>. With it low, no bit may be set - <code>we</code> is an enable on the whole file.</li>
  <li><code>rf_rdec</code>: return the register <code>idx</code> selects. It is a pure function of its inputs; a read port that remembered anything would make the two ports interfere.</li>
  <li><code>idx_d</code> is both the write index and the first read index, which is how a real instruction set works: Rd is the destination and also an operand.</li>
</ul>
<p>Both are <code>always @(*)</code> blocks with a <code>case</code>, and both must assign their output
in every branch - <code>default</code> included.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* 8-bit Register File - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
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
  /* TODO: turn idx into a one-hot enable when we is high, and into all zeros when it
     is low. As written nothing is ever enabled, so no register can be written. */
  always @(*)
    we_1h = 4'b0000;
endmodule

/* One read port. Instantiated twice, so it must be a pure function of idx - a read
   port that remembered anything would make the two ports interfere. */
module rf_rdec(
  input [1:0] idx,
  input [7:0] r0, r1, r2, r3,
  output reg [7:0] opr
);
  /* TODO: select the register idx names. This one always reads r0. */
  always @(*)
    opr = r0;
endmodule

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
`
};
