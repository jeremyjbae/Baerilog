/* Exercise data for the 'barrel-shifter-4bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/barrel-shifter-4bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['barrel-shifter-4bit'] = {
  descriptionHtml: String.raw`
<p>Implement <code>barrel4</code>: <b>rotate</b> a 4-bit value left by 0 to 3 places.</p>
<div class="ex-code">module barrel4(input [3:0] data, input [1:0] amt, output [3:0] y);</div>
<ul>
  <li><code>amt = 0</code> passes <code>data</code> through unchanged.</li>
  <li><code>amt = 1</code> moves every bit up one place, and the bit that leaves the top <b>comes back in at the bottom</b>: <code>1001</code> becomes <code>0011</code>.</li>
  <li>Same for 2 and 3 places. No bit is ever lost, so <code>1111</code> rotates to <code>1111</code> for every amount.</li>
</ul>
<p>The skeleton uses <code>data &lt;&lt; amt</code>, which is a shift: the top bits fall off and
zeros come in at the bottom. A rotate is a <b>concatenation</b> instead - the bits
that leave the top are the same bits you paste back on at the bottom - and with only
four amounts, spelling all four out is clearer than being clever.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates - when it can. The synthesizer reads a smaller subset than the simulator does (no shift operators, no memory arrays), so on some designs it reports what it cannot handle in the Console instead; the netlist cards only appear when it got all the way through.</p>
`,
  starter: String.raw`
/* 4-bit Barrel Shifter - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module barrel4(
  input [3:0] data,
  input [1:0] amt,
  output [3:0] y
);
  /* TODO: this SHIFTS - the bits that leave the top are lost and zeros arrive at the
     bottom. A rotate puts them back: for amt = 1 the answer is {data[2:0], data[3]}.
     Handle all four amounts. */
  assign y = data << amt;
endmodule

module tb;
  reg [3:0] data;
  reg [1:0] amt;
  wire [3:0] y;
  reg [7:0] pass, fail;

  barrel4 u_rot(.data(data), .amt(amt), .y(y));

  initial begin
    pass = 0; fail = 0;

    data = 4'b1001; amt = 2'd0; #5;
    if (y == 4'b1001) begin pass = pass + 1; $display("PASS  1001 rot 0 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1001 rot 0: expected 1001, got %b", y); end

    amt = 2'd1; #5;
    if (y == 4'b0011) begin pass = pass + 1; $display("PASS  1001 rot 1 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1001 rot 1: expected 0011, got %b", y); end

    amt = 2'd2; #5;
    if (y == 4'b0110) begin pass = pass + 1; $display("PASS  1001 rot 2 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1001 rot 2: expected 0110, got %b", y); end

    amt = 2'd3; #5;
    if (y == 4'b1100) begin pass = pass + 1; $display("PASS  1001 rot 3 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1001 rot 3: expected 1100, got %b", y); end

    /* A plain shift loses bits; a rotate cannot. 1000 rotated by 1 has to come
       back as 0001, which is the check a << gets wrong. */
    data = 4'b1000; amt = 2'd1; #5;
    if (y == 4'b0001) begin pass = pass + 1; $display("PASS  1000 rot 1 wraps to %b", y); end
    else begin fail = fail + 1; $display("FAIL  1000 rot 1: expected 0001 (a rotate, not a shift), got %b", y); end

    data = 4'b1111; amt = 2'd2; #5;
    if (y == 4'b1111) begin pass = pass + 1; $display("PASS  1111 rot 2 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  1111 rot 2: expected 1111, got %b", y); end

    data = 4'b0001; amt = 2'd3; #5;
    if (y == 4'b1000) begin pass = pass + 1; $display("PASS  0001 rot 3 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  0001 rot 3: expected 1000, got %b", y); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
