/* Traffic-light FSM - reference solution.
 *
 * Two pieces of state, and that split is the point: "light" says which state the
 * machine is in, "t" says how long it has been there. The transition rule is then
 * one line per state - stay until the timer reaches this state's length, then move
 * on and clear the timer.
 *
 * Note t is cleared ON the transition rather than at the start of the next state.
 * Doing it the other way needs an extra cycle to notice, and every phase comes out
 * one tick long.
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
      case (light)
        GREEN:
          if (t == GREEN_LEN - 3'd1) begin light <= YELLOW; t <= 3'd0; end
          else t <= t + 3'd1;
        YELLOW:
          if (t == YELLOW_LEN - 3'd1) begin light <= RED; t <= 3'd0; end
          else t <= t + 3'd1;
        default:
          if (t == RED_LEN - 3'd1) begin light <= GREEN; t <= 3'd0; end
          else t <= t + 3'd1;
      endcase
    end
  end

  /* The walk light is a function of the state, not a fourth state of its own. */
  assign walk = (light == RED);
endmodule

// ======== TESTBENCH ========

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
