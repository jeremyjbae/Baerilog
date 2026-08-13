/* Exercise data for the 'edge-detector' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/edge-detector.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['edge-detector'] = {
  descriptionHtml: String.raw`
<p>Implement <code>edge_det</code>, which turns a slow-moving input into a single short pulse
every time it goes from 0 to 1.</p>
<div class="ex-code">module edge_det(input clk, input rst_n, input in, output pulse);</div>
<ul>
  <li><code>pulse</code> is 1 when <code>in</code> is 1 <b>now</b> and was 0 at the last clock edge.</li>
  <li>It must go back to 0 at the next clock edge, however long <code>in</code> stays high - one rise, one pulse.</li>
  <li>A <b>falling</b> edge produces nothing.</li>
  <li><code>rst_n</code> is active low and clears the remembered value.</li>
</ul>
<p>One flip-flop is enough. Keep the internal <code>prev</code> register the skeleton already
declares, drive it from <code>in</code> on each edge, and make <code>pulse</code> a combinational
function of <code>in</code> and <code>prev</code>.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* Rising-Edge Detector - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module edge_det(
  input clk,
  input rst_n,
  input in,
  output pulse
);
  reg prev;

  always @(posedge clk) begin
    /* TODO: remember what in looked like at this edge (and clear on reset). */
    prev <= prev;
  end

  /* TODO: 1 only when in is high now and prev says it was low before. */
  assign pulse = in;
endmodule

// ======== TESTBENCH ========

module tb;
  reg clk, rst_n, in;
  wire pulse;
  reg [7:0] pass, fail;

  edge_det u_ed(.clk(clk), .rst_n(rst_n), .in(in), .pulse(pulse));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  /* pulse is combinational, so after moving in there has to be a delay before it is
     read - a process that never yields sees the value from before its own write.
     #1 lands inside the same low phase, so the clock is untouched. */
  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0; in = 0;

    @(negedge clk);
    rst_n = 1; #1;
    if (pulse == 1'b0) begin pass = pass + 1; $display("PASS  idle low, no pulse         pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  pulse should be 0 while in=0, got %b", pulse); end

    in = 1; #1;
    if (pulse == 1'b1) begin pass = pass + 1; $display("PASS  in rose, pulse asserted    pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  in rose but pulse=%b", pulse); end

    /* The edge is remembered here, so the pulse must go away even though in
       stays high. A design that just wired pulse = in fails only this check. */
    @(negedge clk);
    if (pulse == 1'b0) begin pass = pass + 1; $display("PASS  in still 1, pulse cleared  pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  pulse must last one cycle, got %b", pulse); end

    @(negedge clk);
    if (pulse == 1'b0) begin pass = pass + 1; $display("PASS  no repeat while held high  pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  pulse re-fired without a new rise: %b", pulse); end

    in = 0; #1;
    if (pulse == 1'b0) begin pass = pass + 1; $display("PASS  falling edge, no pulse     pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  a fall must not pulse, got %b", pulse); end

    @(negedge clk);
    in = 1; #1;
    if (pulse == 1'b1) begin pass = pass + 1; $display("PASS  second rise detected       pulse=%b", pulse); end
    else begin fail = fail + 1; $display("FAIL  second rise missed, pulse=%b", pulse); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
