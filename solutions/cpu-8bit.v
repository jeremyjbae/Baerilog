/* 8-bit CPU with an 8-bit instruction word - reference solution.
 *
 * One accumulator ("results"), one program counter, a ROM it fetches from and a
 * RAM it can load from and store to. Every instruction is one byte, and the top
 * two bits say which kind it is:
 *
 *   00 oo aaaa    results = results op aaaa      ADD / SUB / SHL / SHR
 *   01 iiiiii     results = iiiiii               MOV, 6-bit immediate
 *   10 oooooo     if results > 0: pc = pc + o    BGT, 6-bit SIGNED offset
 *   11 L ddddd    L=0: results = mem[d]          LD
 *                 L=1: mem[d] = results          ST
 *
 * Two parts of this are what the exercise is about, and both are outside the ALU:
 *
 *   the DATA BUS.  we, daddr and wdata are combinational functions of the
 *   instruction currently being fetched - they have to be ready before the edge
 *   that commits the store, because the RAM samples them on that same edge.
 *
 *   the BRANCH.  A 6-bit offset counts in both directions, so it has to be
 *   SIGN-EXTENDED to the pc's width: {{2{inst[5]}}, inst[5:0]}. Zero-extending it
 *   instead makes every backward branch a huge forward jump, which is the classic
 *   bug here and the reason the test program loops backwards.
 */
module cpu (
  input clk,
  input rst_n,
  output [7:0] iaddr,
  input [7:0] inst,
  output [7:0] daddr,
  output we,
  output [7:0] wdata,
  input [7:0] rdata
);
  reg [7:0] results;
  wire      gt0;

  assign gt0 = (results > 8'b0);

  /* The data bus. we is asserted only for a store, i.e. 11 with L=1. */
  assign we    = (inst[7:5] == 3'b111);
  assign daddr = (inst[7:6] == 2'b11) ? {3'b0, inst[4:0]} : 8'b0;
  assign wdata = (we) ? results : 8'b0;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
      results <= 8'b0;
    else if (inst[7:6] == 2'b11) begin
      if (!inst[5]) results <= rdata;              /* LD - a store leaves results alone */
    end
    else if (inst[7:6] == 2'b01)
      results <= inst[5:0];                        /* MOV */
    else if (inst[7:6] == 2'b00) begin
      casex (inst[5:4])
        2'b10: results <= results + inst[3:0];     /* ADD */
        2'b01: results <= results - inst[3:0];     /* SUB */
        2'b00: results <= results << inst[3:0];    /* SHL */
        2'b11: results <= results >> inst[3:0];    /* SHR */
      endcase
    end
  end

  pc u_pc (.clk(clk), .rst_n(rst_n), .inst(inst), .gt0(gt0), .pc(iaddr));
endmodule

module pc (
  input clk,
  input rst_n,
  input [7:0] inst,
  input gt0,
  output reg [7:0] pc
);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
      pc <= 8'b0;
    else if (inst[7:6] == 2'b10 && gt0)
      pc <= pc + {{2{inst[5]}}, inst[5:0]};        /* BGT - the offset is signed */
    else
      pc <= pc + 8'b1;
  end
endmodule

/* ---- the machine around it: ROM, RAM, and the wiring ---- */
// ======== TESTBENCH ========

module rom (
  input [7:0] addr,
  output [7:0] data
);
  reg [7:0] mem [0:'hff];

  assign data = mem[addr];

  /* Both images are attached by the practice page - read them in the Memory
     Viewer card. Note the ROM is binary ($readmemb) and the RAM is hex. */
  initial $readmemb("rom.txt", mem, 0);
endmodule

module ram (
  input clk,
  input we,
  input [7:0] addr,
  input [7:0] wdata,
  output [7:0] rdata
);
  reg [7:0] mem [0:'hff];

  always @(posedge clk)
    if (we) mem[addr] = wdata;

  assign rdata = mem[addr];

  initial $readmemh("ram.txt", mem, 0);
endmodule

module system (
  input clk,
  input rst_n
);
  wire [7:0] inst;
  wire [7:0] iaddr;
  wire [7:0] daddr;
  wire [7:0] wdata;
  wire [7:0] rdata;
  wire we;

  rom u_rom (iaddr, inst);
  ram u_ram (clk, we, daddr, wdata, rdata);
  cpu u_cpu (clk, rst_n, iaddr, inst, daddr, we, wdata, rdata);
endmodule

module tb;
  reg clk, rst_n;
  wire [7:0] res, pcv;
  reg [7:0] pass, fail;

  system u_sys (clk, rst_n);

  /* Hierarchical references, so the checks below read like the program does. */
  assign res = u_sys.u_cpu.results;
  assign pcv = u_sys.iaddr;

  always #5 clk = ~clk;

  /* One @(negedge clk) per instruction. Two different things are visible there,
     and the difference matters: res and pcv are the state the edge just
     COMMITTED, while we/daddr/wdata already describe the instruction that is
     ABOUT TO run - they are combinational, and pc has already moved on. */
  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0;
    #12 rst_n = 1;

    @(negedge clk);                     /* w0 MOV 3 */
    if (res == 8'd3 && pcv == 8'd1) begin pass = pass + 1; $display("PASS  MOV 3      results=%0d pc=%0d", res, pcv); end
    else begin fail = fail + 1; $display("FAIL  MOV 3: expected results=3 pc=1, got %0d / %0d", res, pcv); end
    /* w1 ST 0 is the instruction now on the bus. */
    if (u_sys.we == 1'b1 && u_sys.daddr == 8'd0 && u_sys.wdata == 8'd3) begin pass = pass + 1; $display("PASS  ST 0 bus   we=%b daddr=%0d wdata=%0d", u_sys.we, u_sys.daddr, u_sys.wdata); end
    else begin fail = fail + 1; $display("FAIL  ST 0 bus: expected we=1 daddr=0 wdata=3, got %b / %0d / %0d", u_sys.we, u_sys.daddr, u_sys.wdata); end

    @(negedge clk);                     /* w1 ST 0 */
    if (res == 8'd3) begin pass = pass + 1; $display("PASS  ST 0       results untouched=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  a store must not change results: %0d", res); end
    if (u_sys.we == 1'b0) begin pass = pass + 1; $display("PASS  SUB 1 bus  we=%b (no store)", u_sys.we); end
    else begin fail = fail + 1; $display("FAIL  we asserted for a non-store instruction"); end

    @(negedge clk);                     /* w2 SUB 1 */
    if (res == 8'd2) begin pass = pass + 1; $display("PASS  SUB 1      results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  SUB 1: expected 2, got %0d", res); end

    @(negedge clk);                     /* w3 ST 1 */
    @(negedge clk);                     /* w4 BGT -2, taken */
    if (pcv == 8'd2) begin pass = pass + 1; $display("PASS  BGT -2     branched back to pc=%0d", pcv); end
    else begin fail = fail + 1; $display("FAIL  BGT -2: expected pc=2, got %0d (offset not sign-extended?)", pcv); end

    @(negedge clk);                     /* w2 SUB 1 -> 1 */
    @(negedge clk);                     /* w3 ST 1 */
    @(negedge clk);                     /* w4 BGT -2, taken again */
    if (pcv == 8'd2 && res == 8'd1) begin pass = pass + 1; $display("PASS  second lap results=%0d pc=%0d", res, pcv); end
    else begin fail = fail + 1; $display("FAIL  second lap: expected results=1 pc=2, got %0d / %0d", res, pcv); end

    @(negedge clk);                     /* w2 SUB 1 -> 0 */
    if (res == 8'd0) begin pass = pass + 1; $display("PASS  counted down to %0d", res); end
    else begin fail = fail + 1; $display("FAIL  expected results=0, got %0d", res); end

    @(negedge clk);                     /* w3 ST 1 */
    @(negedge clk);                     /* w4 BGT -2, NOT taken now */
    if (pcv == 8'd5) begin pass = pass + 1; $display("PASS  BGT fell through to pc=%0d", pcv); end
    else begin fail = fail + 1; $display("FAIL  BGT with results=0 must not branch: pc=%0d", pcv); end
    /* w5 LD 0 is on the bus: a load addresses memory but must not write it. */
    if (u_sys.we == 1'b0 && u_sys.daddr == 8'd0) begin pass = pass + 1; $display("PASS  LD 0 bus   we=%b daddr=%0d", u_sys.we, u_sys.daddr); end
    else begin fail = fail + 1; $display("FAIL  LD 0 bus: expected we=0 daddr=0, got %b / %0d", u_sys.we, u_sys.daddr); end

    @(negedge clk);                     /* w5 LD 0 */
    /* The one check that needs the store AND the load to both be right: 3 can only
       come back out of mem[0] if the very first ST really put it there. */
    if (res == 8'd3) begin pass = pass + 1; $display("PASS  LD 0       read back results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  LD 0: expected the stored 3, got %0d", res); end

    @(negedge clk);                     /* w6 ADD 2 */
    if (res == 8'd5) begin pass = pass + 1; $display("PASS  ADD 2      results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  ADD 2: expected 5, got %0d", res); end
    if (u_sys.we == 1'b1 && u_sys.daddr == 8'd2 && u_sys.wdata == 8'd5) begin pass = pass + 1; $display("PASS  ST 2 bus   we=%b daddr=%0d wdata=%0d", u_sys.we, u_sys.daddr, u_sys.wdata); end
    else begin fail = fail + 1; $display("FAIL  ST 2 bus: expected we=1 daddr=2 wdata=5, got %b / %0d / %0d", u_sys.we, u_sys.daddr, u_sys.wdata); end

    @(negedge clk);                     /* w7 ST 2 */
    @(negedge clk);                     /* w8 NOP */
    if (res == 8'd5 && pcv == 8'd9) begin pass = pass + 1; $display("PASS  NOP        results=%0d pc=%0d", res, pcv); end
    else begin fail = fail + 1; $display("FAIL  after the NOP: expected results=5 pc=9, got %0d / %0d", res, pcv); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
