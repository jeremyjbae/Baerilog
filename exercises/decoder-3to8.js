/* Exercise data for the 'decoder-3to8' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/decoder-3to8.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['decoder-3to8'] = {
  descriptionHtml: String.raw`
<p>Implement <code>decoder38</code>, a 3-to-8 one-hot decoder with an enable.</p>
<div class="ex-code">module decoder38(input [2:0] sel, input en, output [7:0] y);</div>
<ul>
  <li>With <code>en</code> high, exactly one bit of <code>y</code> is 1: bit number <code>sel</code>. So <code>sel = 3</code> gives <code>00001000</code>.</li>
  <li>With <code>en</code> low, every bit of <code>y</code> is 0, whatever <code>sel</code> says.</li>
</ul>
<p>Two equally good ways to write it: a <code>case</code> listing all eight patterns, which is
what a page of AND gates looks like, or a 1 shifted left by <code>sel</code>. Both are one
continuous assignment - there is no state here.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates - when it can. The synthesizer reads a smaller subset than the simulator does (no shift operators, no memory arrays), so on some designs it reports what it cannot handle in the Console instead; the netlist cards only appear when it got all the way through.</p>
`,
  starter: String.raw`
/* 3:8 Decoder - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module decoder38(
  input [2:0] sel,
  input en,
  output [7:0] y
);
  /* TODO: put a single 1 in bit position sel when en is high, and all zeros when it
     is low. This one is stuck on bit 0 and ignores both inputs. */
  assign y = 8'b00000001;
endmodule

module tb;
  reg [2:0] sel;
  reg en;
  wire [7:0] y;
  reg [7:0] pass, fail;

  decoder38 u_dec(.sel(sel), .en(en), .y(y));

  initial begin
    pass = 0; fail = 0;

    en = 1'b1; sel = 3'd0; #5;
    if (y == 8'b00000001) begin pass = pass + 1; $display("PASS  sel=0 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=0: expected 00000001, got %b", y); end

    sel = 3'd1; #5;
    if (y == 8'b00000010) begin pass = pass + 1; $display("PASS  sel=1 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=1: expected 00000010, got %b", y); end

    sel = 3'd3; #5;
    if (y == 8'b00001000) begin pass = pass + 1; $display("PASS  sel=3 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=3: expected 00001000, got %b", y); end

    sel = 3'd7; #5;
    if (y == 8'b10000000) begin pass = pass + 1; $display("PASS  sel=7 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=7: expected 10000000, got %b", y); end

    /* The enable is not an output-polarity option: en=0 means every bit low,
       whatever sel says. */
    en = 1'b0; sel = 3'd5; #5;
    if (y == 8'b00000000) begin pass = pass + 1; $display("PASS  en=0 blanks the output y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  en=0: expected 00000000, got %b", y); end

    en = 1'b1; sel = 3'd5; #5;
    if (y == 8'b00100000) begin pass = pass + 1; $display("PASS  en back on, sel=5 -> y=%b", y); end
    else begin fail = fail + 1; $display("FAIL  sel=5: expected 00100000, got %b", y); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
