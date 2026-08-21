/* Exercise data for the 'd-flip-flop' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/d-flip-flop.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['d-flip-flop'] = {
  descriptionHtml: String.raw`
<p>Implement <code>dff</code>, a single D flip-flop with a synchronous active-low reset.</p>
<div class="ex-code">module dff(input clk, input rst_n, input d, output reg q);</div>
<ul>
  <li>On each <b>rising edge</b> of <code>clk</code>, <code>q</code> takes the value of <code>d</code>.</li>
  <li>If <code>rst_n</code> is <code>0</code> at that edge, <code>q</code> becomes <code>0</code> instead - reset wins.</li>
  <li>Between edges <code>q</code> must not move, however much <code>d</code> does.</li>
</ul>
<p>Use a <b>nonblocking</b> assignment (<code>&lt;=</code>) inside <code>always @(posedge clk)</code>. That is the
whole difference between a register and a wire: an <code>assign</code> would make <code>q</code> follow
<code>d</code> continuously, which passes three of the five checks and fails the two that matter.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. Nothing runs until you press it. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. A working answer here comes out as one <code>dff_gate</code> with an <code>and_gate</code> in front of its D input, taking <code>d</code> and <code>rst_n</code> - that AND <i>is</i> the synchronous reset: while <code>rst_n</code> is low it holds D at 0, so the next edge clocks in a zero. The testbench is not synthesized; everything from <code>module tb</code> down is dropped first, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* D Flip-Flop - practice exercise.
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
  input rst_n,
  input d,
  output reg q
);
  always @(posedge clk) begin
    /* TODO: clear q when rst_n is low, otherwise capture d. */
    q <= q;
  end
endmodule

// ======== TESTBENCH ========

module tb;
  reg clk, rst_n, d;
  wire q;
  reg [7:0] pass, fail;

  dff u_dff(.clk(clk), .rst_n(rst_n), .d(d), .q(q));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0; d = 1;

    @(negedge clk);   /* the rising edge at t=5 happened with reset asserted */
    if (q == 1'b0) begin pass = pass + 1; $display("PASS  reset wins over d=1        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  reset: expected q=0, got q=%b", q); end

    rst_n = 1; d = 1;
    @(negedge clk);
    if (q == 1'b1) begin pass = pass + 1; $display("PASS  d=1 captured on the edge   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  d=1: expected q=1, got q=%b", q); end

    d = 0;
    @(negedge clk);
    if (q == 1'b0) begin pass = pass + 1; $display("PASS  d=0 captured on the edge   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  d=0: expected q=0, got q=%b", q); end

    /* d moves while the clock is low: q must NOT follow it. A design that used a
       plain "assign q = d;" or an always @(*) passes every check above and fails
       this one. */
    d = 1;
    if (q == 1'b0) begin pass = pass + 1; $display("PASS  d changed between edges    q=%b (still)", q); end
    else begin fail = fail + 1; $display("FAIL  q followed d without a clock edge: q=%b", q); end

    @(negedge clk);
    if (q == 1'b1) begin pass = pass + 1; $display("PASS  next edge takes it up      q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected q=1 after the edge, got q=%b", q); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
