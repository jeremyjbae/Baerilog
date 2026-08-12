/* Exercise data for the 'parity-8bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/parity-8bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['parity-8bit'] = {
  descriptionHtml: String.raw`
<p>Implement <code>parity8</code>: report whether a byte contains an odd or an even number of
1 bits.</p>
<div class="ex-code">module parity8(input [7:0] data, output odd, output even);</div>
<ul>
  <li><code>odd</code> is 1 when the number of 1 bits in <code>data</code> is odd.</li>
  <li><code>even</code> is its exact opposite - never both, never neither.</li>
  <li>All eight bits count, including the top one.</li>
</ul>
<p>XOR is parity: <code>a ^ b</code> is 1 exactly when an odd number of its two inputs are 1,
and that generalises. Verilog has a <b>reduction</b> form of it - a unary <code>^</code>
applied to a vector XORs every bit together and yields one bit - and <code>~^</code> is the
inverse in a single operator. Writing out all seven XORs by hand builds the same
circuit if you prefer.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* 8-bit Parity - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module parity8(
  input [7:0] data,
  output odd,
  output even
);
  /* TODO: this only looks at the lowest bit, so it is right for half of all inputs
     by luck. Fold all eight bits together instead. */
  assign odd  = data[0];
  assign even = ~data[0];
endmodule

module tb;
  reg [7:0] data;
  wire odd, even;
  reg [7:0] pass, fail;

  parity8 u_par(.data(data), .odd(odd), .even(even));

  initial begin
    pass = 0; fail = 0;

    data = 8'b00000000; #5;
    if (odd == 1'b0 && even == 1'b1) begin pass = pass + 1; $display("PASS  00000000: no ones      odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  00000000: expected odd=0 even=1, got %b %b", odd, even); end

    data = 8'b00000001; #5;
    if (odd == 1'b1 && even == 1'b0) begin pass = pass + 1; $display("PASS  00000001: one 1        odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  00000001: expected odd=1 even=0, got %b %b", odd, even); end

    data = 8'b00000011; #5;
    if (odd == 1'b0 && even == 1'b1) begin pass = pass + 1; $display("PASS  00000011: two 1s       odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  00000011: expected odd=0 even=1, got %b %b", odd, even); end

    data = 8'b10110111; #5;
    if (odd == 1'b0 && even == 1'b1) begin pass = pass + 1; $display("PASS  10110111: six 1s       odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  10110111: expected odd=0 even=1, got %b %b", odd, even); end

    data = 8'b11111111; #5;
    if (odd == 1'b0 && even == 1'b1) begin pass = pass + 1; $display("PASS  11111111: eight 1s     odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  11111111: expected odd=0 even=1, got %b %b", odd, even); end

    /* The high bit counts too: a parity built from data[6:0] passes everything
       above and fails here. */
    data = 8'b10000000; #5;
    if (odd == 1'b1 && even == 1'b0) begin pass = pass + 1; $display("PASS  10000000: top bit only odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  10000000: expected odd=1 even=0, got %b %b", odd, even); end

    /* odd and even are opposites by construction - never both, never neither. */
    data = 8'b01010101; #5;
    if (odd != even) begin pass = pass + 1; $display("PASS  odd and even disagree   odd=%b even=%b", odd, even); end
    else begin fail = fail + 1; $display("FAIL  odd and even are the same: %b %b", odd, even); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
