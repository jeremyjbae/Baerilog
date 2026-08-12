/* Exercise data for the 'cpu-8bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/cpu-8bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['cpu-8bit'] = {
  descriptionHtml: String.raw`
<p>Complete <code>cpu</code>, an accumulator machine with a single 8-bit register
(<code>results</code>), a program counter, a ROM it fetches from and a RAM it can load from and
store to. Every instruction is one byte, and the top two bits say which kind it is.</p>
<table>
  <tr><th>encoding</th><th>name</th><th>effect</th></tr>
  <tr><td><code>00 oo aaaa</code></td><td>ADD/SUB/SHL/SHR</td><td><code>results = results op aaaa</code></td></tr>
  <tr><td><code>01 iiiiii</code></td><td>MOV</td><td><code>results = iiiiii</code></td></tr>
  <tr><td><code>10 oooooo</code></td><td>BGT</td><td>if <code>results &gt; 0</code>: <code>pc = pc + o</code>, <code>o</code> SIGNED</td></tr>
  <tr><td><code>11 0 ddddd</code></td><td>LD</td><td><code>results = mem[d]</code></td></tr>
  <tr><td><code>11 1 ddddd</code></td><td>ST</td><td><code>mem[d] = results</code></td></tr>
</table>
<p>The ALU and MOV are written for you. Two things are not, and neither is arithmetic:</p>
<ul>
  <li><b>The data bus.</b> <code>we</code>, <code>daddr</code> and <code>wdata</code> are combinational
  functions of the instruction being fetched - the RAM samples them on the same edge that
  commits the store, so they have to be ready before it. <code>we</code> may only be high for a
  store; a load addresses memory without writing it.</li>
  <li><b>The branch.</b> A 6-bit offset counts both ways, so it must be
  <b>sign-extended</b> to the pc's width before it is added. Zero-extending it instead
  turns every backward branch into a large forward jump, which is why the test program
  loops backwards.</li>
</ul>
<p><b>rom.txt and ram.txt are already attached</b> - read the program in the Memory Viewer
card. It counts 3 down to 0, storing each step, then loads one of those stores back, so
a wrong bus and a wrong branch each fail their own checks.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates - when it can. The synthesizer reads a smaller subset than the simulator does (no shift operators, no memory arrays), so on some designs it reports what it cannot handle in the Console instead; the netlist cards only appear when it got all the way through.</p>
`,
  starter: String.raw`
/* 8-bit CPU (8-bit instruction) - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
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

  /* TODO: the data bus. we must be high only for a store (11 with L=1); daddr is the
     5-bit address out of the instruction, widened to 8 bits, for either LD or ST; and
     wdata is what a store writes. Nothing works while all three are tied off. */
  assign we    = 1'b0;
  assign daddr = 8'b0;
  assign wdata = 8'b0;

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
    /* TODO: BGT. When the instruction is 10xxxxxx and gt0 is high, add the 6-bit
       offset in inst[5:0] to pc instead of stepping by 1 - and remember that the
       offset is SIGNED, so it has to be widened to 8 bits by copying its top bit,
       not by padding with zeros. As written the branch never happens at all. */
    else
      pc <= pc + 8'b1;
  end
endmodule

/* ---- the machine around it: ROM, RAM, and the wiring ---- */
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
`
  ,
  /* Attached for $readmemh/$readmemb by practice.js, so the design can fetch
     from it with nothing to save and re-attach by hand. */
  memFiles: {
    'rom.txt': String.raw`
// 8-bit CPU practice program - loaded with $readmemb, so these are BINARY
// words, one 8-bit instruction per line.
//
// It counts 3 down to 0, storing every step, and then reads one of those
// stores back - so it exercises MOV, SUB, ST, LD and a BACKWARD branch.
//
//   w0  MOV 3        results = 3
//   w1  ST 0         mem[0] = 3          (the count, saved for later)
//   w2  SUB 1        results = results - 1
//   w3  ST 1         mem[1] = results    (overwritten each time round)
//   w4  BGT -2       if results > 0, back to w2
//   w5  LD 0         results = mem[0]    = 3, if the store really happened
//   w6  ADD 2        results = 5
//   w7  ST 2         mem[2] = 5
01000011 // w0  MOV 3
11100000 // w1  ST 0
00010001 // w2  SUB 1
11100001 // w3  ST 1
10111110 // w4  BGT -2
11000000 // w5  LD 0
00100010 // w6  ADD 2
11100010 // w7  ST 2
00000000 // w8  NOP (SHL 0)
00000000 // w9  NOP
00000000 // wa  NOP
00000000 // wb  NOP
`,
    'ram.txt': String.raw`
// Initial data memory for the 8-bit CPU exercise, loaded with $readmemh.
// The program writes before it reads, so these values only prove the loader
// ran: if a check reports 5a where it expected a stored value, the store
// never happened.
5a
5a
5a
5a
5a
5a
5a
5a
`
  }
};
