/* Exercise data for the 'alu-4bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/alu-4bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['alu-4bit'] = {
  descriptionHtml: String.raw`
<p>Implement <code>alu4</code>: eight operations on two 4-bit inputs, selected by a 3-bit
opcode, plus a flag that reports a zero result.</p>
<table>
  <tr><th>op</th><th>y</th><th>op</th><th>y</th></tr>
  <tr><td>0</td><td><code>a + b</code></td><td>4</td><td><code>a ^ b</code></td></tr>
  <tr><td>1</td><td><code>a - b</code></td><td>5</td><td><code>~a</code></td></tr>
  <tr><td>2</td><td><code>a &amp; b</code></td><td>6</td><td><code>a &lt;&lt; 1</code></td></tr>
  <tr><td>3</td><td><code>a | b</code></td><td>7</td><td><code>a &gt;&gt; 1</code></td></tr>
</table>
<ul>
  <li><code>y</code> is 4 bits, so both shifts lose the bit that leaves - there is no fifth bit to catch it.</li>
  <li><code>zero</code> is 1 when <code>y</code> is 0. It is a flag on the <b>result</b>, not on the inputs.</li>
</ul>
<p>Opcodes 0 and 1 are written for you inside an <code>always @(*)</code> block with a
<code>case</code>. Two rules about that block, both properties of how this simulator settles
combinational logic: <b>every</b> branch must assign <code>y</code>, including
<code>default</code> - a branch that leaves it alone is a latch, not a mux - and the
familiar "assign a default at the top, then override it" idiom does <b>not</b> work
here, because a signal written twice in one pass never settles and is reported as a
combinational loop.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates - when it can. The synthesizer reads a smaller subset than the simulator does (no shift operators, no memory arrays), so on some designs it reports what it cannot handle in the Console instead; the netlist cards only appear when it got all the way through.</p>
`,
  starter: String.raw`
/* 4-bit ALU - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */
module alu4(
  input [3:0] a,
  input [3:0] b,
  input [2:0] op,
  output reg [3:0] y,
  output zero
);
  always @(*) begin
    case (op)
      3'd0: y = a + b;
      3'd1: y = a - b;
      /* TODO: opcodes 2 to 7 - and, or, xor, not a, a << 1, a >> 1. Each needs its
         own branch that assigns y; without one they fall into the default below and
         come out as zero. */
      default: y = 4'd0;
    endcase
  end

  /* TODO: assert zero when the RESULT is zero. */
  assign zero = 1'b0;
endmodule

module tb;
  reg [3:0] a, b;
  reg [2:0] op;
  wire [3:0] y;
  wire zero;
  reg [7:0] pass, fail;

  alu4 u_alu(.a(a), .b(b), .op(op), .y(y), .zero(zero));

  initial begin
    pass = 0; fail = 0;

    a = 4'd6; b = 4'd3; op = 3'd0; #5;
    if (y == 4'd9) begin pass = pass + 1; $display("PASS  op0 add   6 + 3 = %0d", y); end
    else begin fail = fail + 1; $display("FAIL  op0 add: expected 9, got %0d", y); end

    op = 3'd1; #5;
    if (y == 4'd3) begin pass = pass + 1; $display("PASS  op1 sub   6 - 3 = %0d", y); end
    else begin fail = fail + 1; $display("FAIL  op1 sub: expected 3, got %0d", y); end

    a = 4'b1100; b = 4'b1010; op = 3'd2; #5;
    if (y == 4'b1000) begin pass = pass + 1; $display("PASS  op2 and   1100 & 1010 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op2 and: expected 1000, got %b", y); end

    op = 3'd3; #5;
    if (y == 4'b1110) begin pass = pass + 1; $display("PASS  op3 or    1100 | 1010 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op3 or: expected 1110, got %b", y); end

    op = 3'd4; #5;
    if (y == 4'b0110) begin pass = pass + 1; $display("PASS  op4 xor   1100 ^ 1010 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op4 xor: expected 0110, got %b", y); end

    op = 3'd5; #5;
    if (y == 4'b0011) begin pass = pass + 1; $display("PASS  op5 not   ~1100 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op5 not: expected 0011, got %b", y); end

    a = 4'b0101; op = 3'd6; #5;
    if (y == 4'b1010) begin pass = pass + 1; $display("PASS  op6 shl   0101 << 1 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op6 shl: expected 1010, got %b", y); end

    op = 3'd7; #5;
    if (y == 4'b0010) begin pass = pass + 1; $display("PASS  op7 shr   0101 >> 1 = %b", y); end
    else begin fail = fail + 1; $display("FAIL  op7 shr: expected 0010, got %b", y); end

    /* The shift is 4 bits wide: what leaves the top does not come back, and does
       not appear in bit 4 either. */
    a = 4'b1000; op = 3'd6; #5;
    if (y == 4'b0000 && zero == 1'b1) begin pass = pass + 1; $display("PASS  1000 << 1 leaves 0, zero=%b", zero); end
    else begin fail = fail + 1; $display("FAIL  1000 << 1: expected y=0000 zero=1, got y=%b zero=%b", y, zero); end

    /* zero is a flag on the RESULT, not on the inputs. */
    a = 4'd5; b = 4'd5; op = 3'd1; #5;
    if (y == 4'd0 && zero == 1'b1) begin pass = pass + 1; $display("PASS  5 - 5 = 0 and zero=%b", zero); end
    else begin fail = fail + 1; $display("FAIL  5 - 5: expected y=0 zero=1, got y=%0d zero=%b", y, zero); end

    a = 4'd5; b = 4'd1; op = 3'd0; #5;
    if (zero == 1'b0) begin pass = pass + 1; $display("PASS  nonzero result, zero=%b", zero); end
    else begin fail = fail + 1; $display("FAIL  zero should be 0 when y=%0d", y); end

    if (fail == 0) $display("ALL %0d CHECKS PASSED", pass);
    else $display("%0d of %0d CHECKS FAILED", fail, pass + fail);
    $finish;
  end
endmodule
`
};
