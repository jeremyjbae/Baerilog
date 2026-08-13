/* Exercise data for the 'shift-register-4bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/shift-register-4bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['shift-register-4bit'] = {
  descriptionHtml: String.raw`
<p>Wire up <code>shiftreg</code>: four <code>dff</code> instances forming a 4-bit shift register.
The flip-flop itself is written for you - the exercise is the <b>wiring</b>.</p>
<div class="ex-code">module shiftreg(input clk, input serial_in, output [3:0] q);</div>
<ul>
  <li><code>serial_in</code> feeds stage 0, so a bit appears on <code>q[0]</code> after one clock edge.</li>
  <li>Each later stage takes its input from the stage below it, so that bit reaches <code>q[1]</code> after two edges and leaves at <code>q[3]</code> after four.</li>
  <li>Nothing else changes: no logic, no reset, just four instances and the connections between them.</li>
</ul>
<p>The four instantiations use <b>positional</b> connections in <code>dff</code>'s own port order,
<code>(clk, d, q)</code>. Once it works, open the Module Hierarchy panel and add
<code>u_sr.bit1.q</code> to the waveform - the shift is visible one stage at a time.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* 4-bit Shift Register - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module dff(
  input clk,
  input d,
  output reg q
);
  always @(posedge clk)
    q <= d;
endmodule

module shiftreg(
  input clk,
  input serial_in,
  output [3:0] q
);
  /* Positional connections, in dff's own port order (clk, d, q).
     TODO: every stage is fed from serial_in here, so all four hold the same bit
     instead of passing it along. Chain them: bit1 takes q[0], bit2 takes q[1]... */
  dff bit0 (clk, serial_in, q[0]);
  dff bit1 (clk, serial_in, q[1]);
  dff bit2 (clk, serial_in, q[2]);
  dff bit3 (clk, serial_in, q[3]);
endmodule

// ======== TESTBENCH ========

module tb;
  reg clk, serial_in;
  wire [3:0] q;
  reg [7:0] pass, fail;

  shiftreg u_sr(.clk(clk), .serial_in(serial_in), .q(q));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; serial_in = 0;

    /* Flush four zeros through first, so the register starts from a known state
       instead of the X it powers up with. */
    @(negedge clk);
    @(negedge clk);
    @(negedge clk);
    @(negedge clk);
    if (q == 4'b0000) begin pass = pass + 1; $display("PASS  four zeros flushed through q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0000, got %b", q); end

    serial_in = 1;
    @(negedge clk);
    if (q == 4'b0001) begin pass = pass + 1; $display("PASS  a 1 entered at q[0]        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0001, got %b", q); end

    serial_in = 0;
    @(negedge clk);
    if (q == 4'b0010) begin pass = pass + 1; $display("PASS  it moved up to q[1]        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0010, got %b", q); end

    serial_in = 1;
    @(negedge clk);
    if (q == 4'b0101) begin pass = pass + 1; $display("PASS  1,0,1 in flight            q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0101, got %b", q); end

    serial_in = 1;
    @(negedge clk);
    if (q == 4'b1011) begin pass = pass + 1; $display("PASS  the whole word arrived     q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=1011, got %b", q); end

    /* One more edge: the oldest bit must fall off the top rather than stay. */
    serial_in = 0;
    @(negedge clk);
    if (q == 4'b0110) begin pass = pass + 1; $display("PASS  oldest bit shifted out     q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=0110, got %b", q); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
