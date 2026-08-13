/* Exercise data for the 'calculator-8bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/calculator-8bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['calculator-8bit'] = {
  descriptionHtml: String.raw`
<p>Implement the <b>decode</b> half of <code>calc</code>, a one-register CPU. The program counter
and the ROM around it are given: every clock edge fetches the next byte, and your job
is to apply it to <code>results</code>.</p>
<table>
  <tr><th>encoding</th><th>name</th><th>effect</th></tr>
  <tr><td><code>01 iiiiii</code></td><td>MOV</td><td><code>results = imm</code> (6-bit)</td></tr>
  <tr><td><code>00 10 aaaa</code></td><td>ADD</td><td><code>results = results + a</code></td></tr>
  <tr><td><code>00 01 aaaa</code></td><td>SUB</td><td><code>results = results - a</code></td></tr>
  <tr><td><code>00 00 aaaa</code></td><td>SHL</td><td><code>results = results &lt;&lt; a</code></td></tr>
  <tr><td><code>00 11 aaaa</code></td><td>SHR</td><td><code>results = results &gt;&gt; a</code></td></tr>
</table>
<ul>
  <li>Bit 6 says whether this is a MOV. If it is not, bits <code>[5:4]</code> pick the operation and bits <code>[3:0]</code> are its operand.</li>
  <li><code>SHL 0</code> is this instruction set's NOP, and it has to leave <code>results</code> alone - which it does for free if the shift is written as a shift.</li>
  <li><code>rst_n</code> is asynchronous here (note the <code>or negedge rst_n</code> in the sensitivity list) and clears <code>results</code>.</li>
</ul>
<p>A <code>case (data[5:4])</code> keeps the four ALU operations visibly parallel - there is no
priority between them.</p>
<p><b>rom.txt is already attached</b> for you: open the <b>Memory Viewer</b> card to read the
program the checks below step through, one <code>@(negedge clk)</code> at a time. It is loaded
with <code>$readmemb</code>, so those words are binary rather than hex.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates - when it can. The synthesizer reads a smaller subset than the simulator does (no shift operators, no memory arrays), so on some designs it reports what it cannot handle in the Console instead; the netlist cards only appear when it got all the way through.</p>
`,
  starter: String.raw`
/* 8-bit Calculator - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
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
      results <= data[5:0];                      /* MOV - given, as the shape to follow */
    else
      /* TODO: decode the ALU group. Bits [5:4] pick the operation - 10 add, 01
         subtract, 00 shift left, 11 shift right - and bits [3:0] are the operand.
         As written every one of them is a no-op. */
      results <= results;
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
`
  ,
  /* Attached for $readmemh/$readmemb by practice.js, so the design can fetch
     from it with nothing to save and re-attach by hand. */
  memFiles: {
    'rom.txt': String.raw`
// 8-bit Calculator practice program - loaded with $readmemb, so these are
// BINARY words: one 8-bit instruction per line, low address first.
//
//   01 iiiiii   MOV imm     results = imm            (6-bit immediate)
//   00 10 aaaa  ADD a       results = results + a
//   00 01 aaaa  SUB a       results = results - a
//   00 00 aaaa  SHL a       results = results << a   (a = 0 is the NOP here)
//   00 11 aaaa  SHR a       results = results >> a
01000101 // MOV 5      results = 5
00100011 // ADD 3      results = 8
00010010 // SUB 2      results = 6
00000010 // SHL 2      results = 24
00110001 // SHR 1      results = 12
01111111 // MOV 63     results = 63
00100001 // ADD 1      results = 64
00000000 // SHL 0      no change - the NOP of this instruction set
00000000 // SHL 0
00000000 // SHL 0
`
  }
};
