/* 8-bit Calculator - reference solution.
 *
 * A CPU with one register. Every clock edge the program counter fetches the next
 * byte out of the ROM and the calculator applies it to "results" - so this is a
 * complete fetch/execute loop with no pipeline, no branches and no memory.
 *
 * Instruction set (one byte each):
 *
 *   01 iiiiii    MOV imm    results = imm            6-bit immediate
 *   00 10 aaaa   ADD a      results = results + a
 *   00 01 aaaa   SUB a      results = results - a
 *   00 00 aaaa   SHL a      results = results << a   a = 0 is the NOP
 *   00 11 aaaa   SHR a      results = results >> a
 *
 * The decode reads two fields out of one byte: bit 6 says whether this is a MOV,
 * and if it is not, bits [5:4] pick the ALU operation while bits [3:0] are its
 * operand. Doing that with a "case (data[5:4])" rather than nested ifs is what
 * keeps all four operations visibly parallel - there is no priority between them.
 *
 * The ROM comes from rom.txt, which this page has already attached for you - look
 * at the Memory Viewer card to read the program, and note the ROM is loaded with
 * $readmemb, so the words there are binary rather than hex.
 */
module calc (
  input clk,
  input rst_n,
  output [7:0] addr,
  input [7:0] data
);
  reg [7:0] results;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
      results <= 8'b0;
    else if (data[6])
      results <= data[5:0];                      /* MOV */
    else
      case (data[5:4])
        2'b10: results <= results + data[3:0];    /* ADD */
        2'b01: results <= results - data[3:0];    /* SUB */
        2'b00: results <= results << data[3:0];   /* SHL */
        2'b11: results <= results >> data[3:0];   /* SHR */
        default: results <= results;
      endcase
  end

  pc u_pc (.clk(clk), .rst_n(rst_n), .pc(addr));
endmodule

module pc (
  input clk,
  input rst_n,
  output reg [7:0] pc
);
  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) pc <= 8'b0;
    else        pc <= pc + 8'b1;
  end
endmodule

/* ---- the machine around it: ROM, and the system that wires the two together ---- */
// ======== TESTBENCH ========

module rom (
  input [7:0] addr,
  output [7:0] data
);
  reg [7:0] mem [0:'hff];

  assign data = mem[addr];

  /* rom.txt is attached by the practice page rather than by hand - this app has no
     filesystem access over file://, so $readmemb can only resolve a name that is
     already in the Memory Viewer's list. */
  initial $readmemb("rom.txt", mem, 0);
endmodule

module system (
  input clk,
  input rst_n
);
  wire [7:0] addr;
  wire [7:0] data;

  rom u_rom (addr, data);
  calc u_calc (clk, rst_n, addr, data);
endmodule

module tb;
  reg clk, rst_n;
  wire [7:0] res;
  reg [7:0] pass, fail;

  system u_sys (clk, rst_n);

  /* A hierarchical reference: "results" lives two levels down, and naming it here
     puts it in the waveform and the checks below as an ordinary signal. */
  assign res = u_sys.u_calc.results;

  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0;
    #12 rst_n = 1;    /* released between two edges, so no edge is half-reset */

    /* One @(negedge clk) per instruction: the posedge just before it executed the
       word the pc was pointing at, and the negedge is a settled place to look. */
    @(negedge clk);
    if (res == 8'd5) begin pass = pass + 1; $display("PASS  MOV 5   -> results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  MOV 5:   expected 5, got %0d", res); end

    @(negedge clk);
    if (res == 8'd8) begin pass = pass + 1; $display("PASS  ADD 3   -> results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  ADD 3:   expected 8, got %0d", res); end

    @(negedge clk);
    if (res == 8'd6) begin pass = pass + 1; $display("PASS  SUB 2   -> results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  SUB 2:   expected 6, got %0d", res); end

    @(negedge clk);
    if (res == 8'd24) begin pass = pass + 1; $display("PASS  SHL 2   -> results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  SHL 2:   expected 24, got %0d", res); end

    @(negedge clk);
    if (res == 8'd12) begin pass = pass + 1; $display("PASS  SHR 1   -> results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  SHR 1:   expected 12, got %0d", res); end

    @(negedge clk);
    if (res == 8'd63) begin pass = pass + 1; $display("PASS  MOV 63  -> results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  MOV 63:  expected 63, got %0d", res); end

    @(negedge clk);
    if (res == 8'd64) begin pass = pass + 1; $display("PASS  ADD 1   -> results=%0d", res); end
    else begin fail = fail + 1; $display("FAIL  ADD 1:   expected 64, got %0d", res); end

    /* SHL 0 is this instruction set's NOP: it decodes as a shift, and a shift by
       zero has to leave the value alone. */
    @(negedge clk);
    if (res == 8'd64) begin pass = pass + 1; $display("PASS  SHL 0   -> results=%0d (unchanged)", res); end
    else begin fail = fail + 1; $display("FAIL  SHL 0 changed results to %0d", res); end

    /* The pc is a counter, not part of the ALU: it must have advanced once per
       instruction whatever those instructions were. */
    if (u_sys.u_calc.addr == 8'd8) begin pass = pass + 1; $display("PASS  pc advanced once per instruction: pc=%0d", u_sys.u_calc.addr); end
    else begin fail = fail + 1; $display("FAIL  pc is %0d after 8 instructions, expected 8", u_sys.u_calc.addr); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
