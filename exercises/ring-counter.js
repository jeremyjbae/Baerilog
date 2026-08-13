/* Exercise data for the 'ring-counter' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/ring-counter.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['ring-counter'] = {
  descriptionHtml: String.raw`
<p>Implement <code>ring4</code>, a 4-bit ring counter: a single 1 that walks round the four
bits, one place per clock edge.</p>
<div class="ex-code">module ring4(input clk, input rst_n, output reg [3:0] q);</div>
<ul>
  <li><code>rst_n</code> is active low and <b>seeds</b> the counter with <code>0001</code> - not with 0000.</li>
  <li>Each rising edge moves the 1 up one place: <code>0001</code>, <code>0010</code>, <code>0100</code>, <code>1000</code>...</li>
  <li>...and then back to <code>0001</code>. The bit that leaves the top comes in at the bottom.</li>
</ul>
<p>The seed is what makes this work at all: a shift register that starts at 0000 shifts
zeros round forever, and one that starts at X shifts X round forever. That is why the
reset value is part of the exercise rather than an afterthought.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates - when it can. The synthesizer reads a smaller subset than the simulator does (no shift operators, no memory arrays), so on some designs it reports what it cannot handle in the Console instead; the netlist cards only appear when it got all the way through.</p>
`,
  starter: String.raw`
/* 4-bit Ring Counter - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module ring4(
  input clk,
  input rst_n,
  output reg [3:0] q
);
  always @(posedge clk) begin
    /* TODO: seed the ring on reset, then rotate it one place per edge. As written it
       resets to nothing useful and shifts the 1 straight out of the top. */
    if (!rst_n) q <= 4'b0000;
    else        q <= q << 1;
  end
endmodule

// ======== TESTBENCH ========

module tb;
  reg clk, rst_n;
  wire [3:0] q;
  reg [7:0] pass, fail;

  ring4 u_ring(.clk(clk), .rst_n(rst_n), .q(q));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0;
    clk = 0; rst_n = 0;

    @(negedge clk);
    if (q == 4'b0001) begin pass = pass + 1; $display("PASS  reset seeds one 1       q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  reset: expected 0001, got %b", q); end

    rst_n = 1;
    @(negedge clk);
    if (q == 4'b0010) begin pass = pass + 1; $display("PASS  step 1                   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  step 1: expected 0010, got %b", q); end

    @(negedge clk);
    if (q == 4'b0100) begin pass = pass + 1; $display("PASS  step 2                   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  step 2: expected 0100, got %b", q); end

    @(negedge clk);
    if (q == 4'b1000) begin pass = pass + 1; $display("PASS  step 3                   q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  step 3: expected 1000, got %b", q); end

    /* The bit at the top has to come back to the bottom - this is where a plain
       shift register (q <= q << 1) parts company with a ring. */
    @(negedge clk);
    if (q == 4'b0001) begin pass = pass + 1; $display("PASS  wraps back round        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  wrap: expected 0001, got %b (a shift, not a ring?)", q); end

    @(negedge clk);
    if (q == 4'b0010) begin pass = pass + 1; $display("PASS  and keeps going         q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  expected 0010, got %b", q); end

    /* Reset in mid-flight puts it back to one 1, not to zero. */
    rst_n = 0;
    @(negedge clk);
    if (q == 4'b0001) begin pass = pass + 1; $display("PASS  reset mid-flight        q=%b", q); end
    else begin fail = fail + 1; $display("FAIL  reset mid-flight: expected 0001, got %b", q); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
