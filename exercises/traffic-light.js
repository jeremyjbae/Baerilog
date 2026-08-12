/* Exercise data for the 'traffic-light' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/traffic-light.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['traffic-light'] = {
  descriptionHtml: String.raw`
<p>Implement <code>traffic</code>, a traffic light that cycles green to yellow to red and back,
holding each colour for a fixed number of clock cycles.</p>
<div class="ex-code">module traffic(input clk, input rst_n, output reg [1:0] light, output walk);</div>
<table>
  <tr><th>light</th><th>colour</th><th>cycles</th></tr>
  <tr><td>0</td><td>green</td><td>4</td></tr>
  <tr><td>1</td><td>yellow</td><td>2</td></tr>
  <tr><td>2</td><td>red</td><td>3</td></tr>
</table>
<ul>
  <li><code>rst_n</code> is active low and returns it to green <b>with the timer cleared</b>, so a reset mid-phase starts a fresh 4 cycles of green.</li>
  <li><code>walk</code> is 1 exactly while the light is red - a function of the state, not a fourth state of its own.</li>
</ul>
<p>Two pieces of state, and the split is the point: <code>light</code> says which phase it is
in, <code>t</code> says how long it has been there. The parameters are already declared, so a
transition is one line per phase - stay until the timer reaches this phase's length,
then move on and clear the timer <b>on the same edge</b>. Clearing it at the start of
the next phase instead needs an extra cycle to notice, and every phase comes out one
tick long.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* Traffic-light FSM - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module traffic(
  input clk,
  input rst_n,
  output reg [1:0] light,
  output walk
);
  parameter GREEN  = 2'd0;
  parameter YELLOW = 2'd1;
  parameter RED    = 2'd2;

  parameter GREEN_LEN  = 3'd4;
  parameter YELLOW_LEN = 3'd2;
  parameter RED_LEN    = 3'd3;

  reg [2:0] t;

  always @(posedge clk) begin
    if (!rst_n) begin
      light <= GREEN;
      t <= 3'd0;
    end else begin
      /* TODO: one branch per phase. GREEN shows the shape: count until this phase's
         length is up, then move to the next colour and clear the timer on the same
         edge. YELLOW goes to RED, RED goes back to GREEN. */
      case (light)
        GREEN:
          if (t == GREEN_LEN - 3'd1) begin light <= YELLOW; t <= 3'd0; end
          else t <= t + 3'd1;
        YELLOW:
          t <= t + 3'd1;
        default:
          t <= t + 3'd1;
      endcase
    end
  end

  /* The walk light is a function of the state, not a fourth state of its own. */
  /* TODO: the walk light is on while the traffic light is red. */
  assign walk = 1'b0;
endmodule

module tb;
  reg clk, rst_n;
  wire [1:0] light;
  wire walk;
  reg [7:0] pass, fail, greens;

  traffic u_tl(.clk(clk), .rst_n(rst_n), .light(light), .walk(walk));

  /* The same clock every exercise on this site uses: 5 time units low, 5 high, for
     as long as the run lasts. Inputs move just after a falling edge and each check
     reads the state the rising edge in between committed, so no check depends on
     where in the cycle it happens to land - and the clk row in the waveform is a
     plain square wave rather than a train of narrow pulses. */
  always #5 clk = ~clk;

  initial begin
    pass = 0; fail = 0; greens = 0;
    clk = 0; rst_n = 0;

    @(negedge clk);
    rst_n = 1;
    if (light == 2'd0 && walk == 1'b0) begin pass = pass + 1; $display("PASS  reset -> green, walk=%b", walk); end
    else begin fail = fail + 1; $display("FAIL  reset: expected light=0 walk=0, got %0d %b", light, walk); end

    /* Green lasts 4 cycles: the first three edges must leave it green. */
    @(negedge clk);
    if (light == 2'd0) greens = greens + 1;
    @(negedge clk);
    if (light == 2'd0) greens = greens + 1;
    @(negedge clk);
    if (light == 2'd0) greens = greens + 1;
    if (greens == 8'd3) begin pass = pass + 1; $display("PASS  green held for its 4 cycles"); end
    else begin fail = fail + 1; $display("FAIL  green held %0d of the 3 further cycles", greens); end

    @(negedge clk);
    if (light == 2'd1) begin pass = pass + 1; $display("PASS  green -> yellow           light=%0d", light); end
    else begin fail = fail + 1; $display("FAIL  expected yellow (1) after 4 green cycles, got %0d", light); end

    @(negedge clk);
    if (light == 2'd1) begin pass = pass + 1; $display("PASS  yellow still on          light=%0d", light); end
    else begin fail = fail + 1; $display("FAIL  yellow is 2 cycles long, got %0d", light); end

    @(negedge clk);
    if (light == 2'd2 && walk == 1'b1) begin pass = pass + 1; $display("PASS  yellow -> red, walk=%b", walk); end
    else begin fail = fail + 1; $display("FAIL  expected red (2) with walk=1, got %0d %b", light, walk); end

    @(negedge clk);
    @(negedge clk);
    if (light == 2'd2) begin pass = pass + 1; $display("PASS  red held its 3 cycles    light=%0d", light); end
    else begin fail = fail + 1; $display("FAIL  red is 3 cycles long, got %0d", light); end

    @(negedge clk);
    if (light == 2'd0 && walk == 1'b0) begin pass = pass + 1; $display("PASS  red -> green, walk=%b", walk); end
    else begin fail = fail + 1; $display("FAIL  expected green again, got %0d walk=%b", light, walk); end

    /* Reset from the middle of a phase, not just at power-on. */
    @(negedge clk);
    rst_n = 0;
    @(negedge clk);
    if (light == 2'd0) begin pass = pass + 1; $display("PASS  reset mid-phase -> green light=%0d", light); end
    else begin fail = fail + 1; $display("FAIL  reset mid-phase: expected green, got %0d", light); end

    /* ...and the timer has to be cleared by that reset too: green must last a full
       4 cycles again rather than finishing the phase it was interrupted in. */
    rst_n = 1;
    @(negedge clk);
    @(negedge clk);
    @(negedge clk);
    if (light == 2'd0) begin pass = pass + 1; $display("PASS  timer restarted by reset light=%0d", light); end
    else begin fail = fail + 1; $display("FAIL  green ended early after a reset, light=%0d", light); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
