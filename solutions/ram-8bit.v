/* 8-bit RAM, 256 bytes - reference solution.
 *
 * Two things make this a memory rather than a pile of registers:
 *
 *   reg [7:0] mem [0:255];        a 2D array declaration - the second [ ] is what
 *                                 makes it an array of 256 bytes rather than one
 *                                 256-bit signal.
 *   mem[addr] <= din;             a fully variable index. Only the selected cell
 *                                 changes, and the simulator drops a write whose
 *                                 address is unknown rather than corrupting a
 *                                 random cell.
 *
 * The read is combinational and the write is synchronous, which is the ordinary
 * asymmetry of an SRAM: dout follows addr immediately, but data only lands on a
 * clock edge.
 *
 * Memories deliberately have no waveform row - look at the Memory Viewer card
 * below the waveform to see the cells change.
 */
module ram256(
  input clk,
  input we,
  input [7:0] addr,
  input [7:0] din,
  output [7:0] dout
);
  reg [7:0] mem [0:255];

  always @(posedge clk)
    if (we) mem[addr] <= din;

  assign dout = mem[addr];
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
