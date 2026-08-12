/* Exercise data for the 'ram-8bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/ram-8bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['ram-8bit'] = {
  descriptionHtml: String.raw`
<p>Implement <code>ram256</code>, a 256-byte memory with a synchronous write and a
combinational read.</p>
<div class="ex-code">module ram256(input clk, input we, input [7:0] addr,
              input [7:0] din, output [7:0] dout);</div>
<ul>
  <li><code>dout</code> follows <code>addr</code> immediately, with no clock edge involved.</li>
  <li>On a rising clock edge, if <code>we</code> is high, <code>din</code> is written to <code>mem[addr]</code>. With <code>we</code> low nothing changes, edge or not.</li>
  <li>Only the addressed cell may change - the whole point of a memory.</li>
</ul>
<p>The array declaration is already there: <code>reg [7:0] mem [0:255];</code> - the second
<code>[ ]</code> is what makes it 256 separate bytes rather than one 256-bit signal. Index it
with the full <code>addr</code>; the index may be a runtime value, and this simulator drops a
write whose address is unknown rather than corrupting some random cell.</p>
<p>Memories deliberately have no waveform row - use the <b>Memory Viewer</b> card below
the waveform to watch the cells change.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
`,
  starter: String.raw`
/* 8-bit RAM - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module ram256(
  input clk,
  input we,
  input [7:0] addr,
  input [7:0] din,
  output [7:0] dout
);
  reg [7:0] mem [0:255];

  /* TODO: write din into the addressed cell on a rising edge, but only when we is
     high; and read the addressed cell out on dout with no clock at all. Right now
     nothing is ever written and dout is stuck on cell 0. */
  always @(posedge clk)
    if (we) mem[0] <= mem[0];

  assign dout = mem[0];
endmodule

module tb;
  reg clk, we;
  reg [7:0] addr, din;
  wire [7:0] dout;
  reg [7:0] pass, fail;

  ram256 u_ram(.clk(clk), .we(we), .addr(addr), .din(din), .dout(dout));

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
    clk = 0; we = 1'b0; addr = 8'h00; din = 8'h00;

    /* Write one byte and read it straight back. */
    addr = 8'h10; din = 8'hab; we = 1'b1;
    @(negedge clk);
    we = 1'b0; #1;
    if (dout == 8'hab) begin pass = pass + 1; $display("PASS  mem[10] = ab, read %h", dout); end
    else begin fail = fail + 1; $display("FAIL  mem[10]: expected ab, got %h", dout); end

    /* A second address, so the two cannot be one shared register. */
    addr = 8'h11; din = 8'h5c; we = 1'b1;
    @(negedge clk);
    we = 1'b0; #1;
    if (dout == 8'h5c) begin pass = pass + 1; $display("PASS  mem[11] = 5c, read %h", dout); end
    else begin fail = fail + 1; $display("FAIL  mem[11]: expected 5c, got %h", dout); end

    addr = 8'h10; #1;
    if (dout == 8'hab) begin pass = pass + 1; $display("PASS  mem[10] still ab       %h", dout); end
    else begin fail = fail + 1; $display("FAIL  writing 11 disturbed 10: %h", dout); end

    /* dout must follow addr with no clock edge in between. */
    addr = 8'h11; #1;
    if (dout == 8'h5c) begin pass = pass + 1; $display("PASS  read is combinational  %h", dout); end
    else begin fail = fail + 1; $display("FAIL  the read needs a clock edge: %h", dout); end

    /* we=0 with an edge and real data on din: nothing may change. */
    addr = 8'h10; din = 8'hff; we = 1'b0;
    @(negedge clk);
    if (dout == 8'hab) begin pass = pass + 1; $display("PASS  we=0 blocks the write   %h", dout); end
    else begin fail = fail + 1; $display("FAIL  we=0 still wrote: %h", dout); end

    /* Overwrite an existing cell. */
    din = 8'h01; we = 1'b1;
    @(negedge clk);
    we = 1'b0; #1;
    if (dout == 8'h01) begin pass = pass + 1; $display("PASS  overwrote mem[10] = %h", dout); end
    else begin fail = fail + 1; $display("FAIL  overwrite: expected 01, got %h", dout); end

    /* The top of the array is reachable - an addr accidentally truncated to 4 bits
       would land somewhere else entirely. */
    addr = 8'hff; din = 8'h7e; we = 1'b1;
    @(negedge clk);
    we = 1'b0; #1;
    if (dout == 8'h7e) begin pass = pass + 1; $display("PASS  mem[ff] = %h", dout); end
    else begin fail = fail + 1; $display("FAIL  mem[ff]: expected 7e, got %h", dout); end

    addr = 8'h10; #1;
    if (dout == 8'h01) begin pass = pass + 1; $display("PASS  mem[10] survived        %h", dout); end
    else begin fail = fail + 1; $display("FAIL  the ff write aliased onto 10: %h", dout); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
