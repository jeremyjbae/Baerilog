/* Exercise data for the 'mux-2to1' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/mux-2to1.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['mux-2to1'] = {
  descriptionHtml: String.raw`
<p>Implement <code>mux2</code>, a 2:1 multiplexer over two 4-bit inputs.</p>
<div class="ex-code">module mux2(input [3:0] a, input [3:0] b, input sel, output [3:0] y);</div>
<ul>
  <li><code>sel == 0</code> puts <code>a</code> on <code>y</code>.</li>
  <li><code>sel == 1</code> puts <code>b</code> on <code>y</code>.</li>
</ul>
<p>It is purely combinational, so it wants one continuous <code>assign</code> and no clock at all.
A conditional expression (<code>sel ? b : a</code>) says it in one line; so does a pile of
AND/OR gates, and the checks cannot tell the two apart.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates: the two cards under the waveform show it as a gate-level netlist and as a diagram of the cells it became. Nothing runs until you press Run or Synthesize; the testbench is not synthesized, since a testbench is not hardware.</p>
`,
  starter: String.raw`
/* 2:1 Multiplexer - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module mux2(
  input [3:0] a,
  input [3:0] b,
  input sel,
  output [3:0] y
);
  /* TODO: pick b when sel is 1, a when sel is 0. This only ever picks a. */
  assign y = a;
endmodule

module tb;
  reg [3:0] a, b;
  reg sel;
  wire [3:0] y;
  reg [7:0] pass, fail;

  mux2 u_mux(.a(a), .b(b), .sel(sel), .y(y));

  initial begin
    pass = 0; fail = 0;

    a = 4'ha; b = 4'h5; sel = 1'b0; #5;
    if (y == 4'ha) begin pass = pass + 1; $display("PASS  sel=0 picks a              y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  sel=0: expected y=a, got y=%h", y); end

    sel = 1'b1; #5;
    if (y == 4'h5) begin pass = pass + 1; $display("PASS  sel=1 picks b              y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  sel=1: expected y=b, got y=%h", y); end

    a = 4'h0; b = 4'hf; sel = 1'b0; #5;
    if (y == 4'h0) begin pass = pass + 1; $display("PASS  sel=0 with a=0 b=f         y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  expected y=0, got y=%h", y); end

    sel = 1'b1; #5;
    if (y == 4'hf) begin pass = pass + 1; $display("PASS  sel=1 with a=0 b=f         y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  expected y=f, got y=%h", y); end

    a = 4'h3; b = 4'h3; sel = 1'b1; #5;
    if (y == 4'h3) begin pass = pass + 1; $display("PASS  both inputs equal          y=%h", y); end
    else begin fail = fail + 1; $display("FAIL  expected y=3, got y=%h", y); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
