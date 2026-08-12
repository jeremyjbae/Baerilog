/* Exercise data for the 'cpu-16bit' practice page.
 *
 * descriptionHtml is what the exercise sheet shows on load; starter is what the
 * editor is seeded with. The reference answer lives in practice/solutions/cpu-16bit.v,
 * which no page loads - practice/test.py reads it off disk and asserts it passes
 * every check while this starter fails at least one.
 *
 * Verilog and HTML are carried in String.raw template literals, so neither may
 * contain a backtick: one would end the literal and turn the rest of the design
 * into code, which is the hazard CLAUDE.md records for the simulator's EXAMPLES.
 */
window.PRACTICE_EXERCISES = window.PRACTICE_EXERCISES || {};
window.PRACTICE_EXERCISES['cpu-16bit'] = {
  descriptionHtml: String.raw`
<p>Complete the <b>control flow</b> of a reduced-AVR2 core: <code>RJMP</code>, <code>BREQ</code> and
<code>BRNE</code>. Everything else is given - a 32-entry register file built from discrete
registers with a one-hot write decoder, an ALU with V/N/Z/C flags, <code>LDI</code>, and the
ROM and RAM around them.</p>
<p>Each of the three is one expression, computing <code>pc_nxt</code> inside the decoder. Three
AVR facts decide all three:</p>
<ul>
  <li>The displacement counts <b>words</b>, because <code>pc</code> counts words. The Memory Viewer's address column is in words too, so it and the ROM listing agree.</li>
  <li>It is <b>signed</b>, so it must be sign-extended to 16 bits before it is added - copy the top bit, do not pad with zeros.</li>
  <li>It is relative to the instruction <b>after</b> the branch, so the sum carries a <code>+ 1</code>. Leaving that out lands every branch one word short; for a backward branch to itself that is an infinite loop.</li>
</ul>
<p><code>RJMP</code> carries 12 bits of displacement in <code>inst[11:0]</code>. <code>BREQ</code> and
<code>BRNE</code> carry 7 bits in <code>inst[9:3]</code> and test Z, which is <code>sreg[1]</code> here -
<code>BRNE</code> tests the <b>inverse</b> of that same bit, since there is no separate
not-equal flag.</p>
<p><b>rom.txt and ram.txt are already attached.</b> The program gives every branch a
<b>witness</b>: a register written only if the branch went the right way, and another
written only if it went the wrong way - so "it happened to end up in the right place"
and "it actually skipped what it should have skipped" are separate checks.</p>
<p><b>This exercise has no testbench checks - the Scoreboard card above the waveform is
the checker.</b> It runs a reference model of the AVR subset alongside your design and
compares <code>pc</code>, <code>r0</code>-<code>r31</code>, <code>sp</code>, the flags
and the memories after every retired instruction, so it catches a wrong branch at the
instruction that took it rather than in a register three steps later. It is on by
default; the run stops a few time units after the first divergence.</p>
<p>While the branches are unimplemented it reports:</p>
<div class="ex-code">Mismatch at t=85 - instruction #8 'w07  breq +1  TAKEN:  pc = 07 + 1 + 1 -> w09'
pc: model 0009, design 0008. The design's pc was at word 0008 'w08  mov r7, r16  SKIPPED'.</div>
<p>When it is right, the card reads <b>36 instructions compared, no mismatch</b>, ending
with <i>instruction memory is X at word 0028</i> - that is the model running off the end
of the program, not a fault. <b>No mismatch is the pass.</b> Tick <b>Show detail</b> if
you want to see which signals it bound to.</p>
<p class="ex-note">The testbench under the design is already written and is not part of the exercise. Press <b>Run</b> and read the Console: every check prints PASS or FAIL, and the pill in the Console header counts them. The waveform below shows every signal, and the Module Hierarchy panel beside the editor lets you edit one module at a time.</p>
<p class="ex-note"><b>Synthesize</b>, next to the run length, turns your design into gates - when it can. The synthesizer reads a smaller subset than the simulator does (no shift operators, no memory arrays), so on some designs it reports what it cannot handle in the Console instead; the netlist cards only appear when it got all the way through.</p>
`,
  starter: String.raw`
/* 8-bit CPU (16-bit instruction) - practice exercise.
 *
 * Look for the TODO comments: that is the part to write. Everything else,
 * including the self-checking testbench at the bottom of the file, is already
 * written - press Run and read the Console.
 *
 * The full statement of the problem is in the exercise sheet, which the Exercise
 * button in the page header brings back at any time.
 */

module cpu (
  input clk, 
  input rst_n, output [15:0] iaddr, 
  input [15:0] inst, 
  output [15:0] daddr, 
  output we, 
  output [7:0] wdata, 
  input [7:0] rdata
);

  wire [15:0] pc;
  reg [15:0] pc_nxt;
  wire [15:0] sp, sp_nxt;
  reg  [3:0] opcode;
  wire [7:0] rd, rr;
  wire [7:0] alu_out;
  wire [3:0] sreg;
  reg sreg_we;
  reg [4:0] rf_idx_d, rf_idx_r;
  reg       rf_we;
  reg [7:0] rf_wdata;
  wire retire;
  reg [39:0] debug_inst;

  assign sp = 16'b0;      // Not Implemented
  assign sp_nxt = 16'b0;  // Not Implemented
  assign iaddr = pc;
  assign daddr = 16'b0;    // Not Implemented
  assign we = 1'b0;       // Not Implemented
  assign wdata = 8'b0;    // Not Implemented
  assign retire = 1'b1;   // Not Implemented

  always@(*) begin
    sreg_we <= 1'b0;
    casex(inst[15:10])

      6'b00xxxx: begin // alu
        debug_inst <= u_alu.debug_alu; 
        opcode <= inst[13:10];
        if(opcode == 4'b0101)
          rf_we <= 1'b0;
        else rf_we <= 1'b1;
        sreg_we <= 1'b1;
        rf_idx_d <= inst[8:4];
        rf_idx_r <= {inst[9], inst[3:0]};
        rf_wdata <= alu_out;
        pc_nxt <= pc + 1;
      end

      6'b1110xx: begin // ldi
        debug_inst <= "LDI";
        rf_we <= 1'b1;
        rf_idx_d <= inst[7:4] + 5'b10000;
        rf_wdata <= {inst[11:8], inst[3:0]};
        pc_nxt <= pc + 1;
      end

      /* TODO: all three of these just step to the next instruction, so no branch or
         jump in the program ever happens. RJMP takes its 12-bit displacement from
         inst[11:0]; BREQ and BRNE take 7 bits from inst[9:3] and are conditional on
         Z, which is sreg[1] - BREQ when it is set, BRNE when it is clear. Sign-extend
         the displacement to 16 bits and remember the + 1. */
      6'b1100xx: begin // rjmp (offset)
        debug_inst <= "RJMP";
        pc_nxt <= pc + 1;
      end

      6'b111100: begin // breq
        debug_inst <= "BREQ";
        pc_nxt <= pc + 1;
      end

      6'b111101: begin // brne
        debug_inst <= "BRNE";
        pc_nxt <= pc + 1;
      end
      
      default: begin
        debug_inst <= "ERR"; 
        pc_nxt <= pc + 1;
      end
    endcase
  end

  alu u_alu (.clk(clk), .rst_n(rst_n), .opcode(opcode), .rd(rd), .rr(rr), .sreg_we(sreg_we), .alu_out(alu_out), .sreg(sreg));
  rf u_rf (.clk(clk), .rst_n(rst_n), .rf_we(rf_we), .rf_idx_d(rf_idx_d), .rf_idx_r(rf_idx_r), .rf_wdata(rf_wdata), .rd(rd), .rr(rr));
  pc u_pc (.clk(clk), .rst_n(rst_n), .inst(inst), .pc_nxt(pc_nxt), .pc(pc));

endmodule

module alu (
  input clk, 
  input rst_n, 
  input [3:0] opcode, 
  input [7:0] rd, rr, 
  input sreg_we,
  output reg [7:0] alu_out, 
  output [3:0] sreg
);

reg sreg_v; // Overflow
reg sreg_n; // Negative
reg sreg_z; // Zero
reg sreg_c; // Carry
reg v_nxt; // Overflow (next)
reg n_nxt; // Negative (next)
reg z_nxt; // Zero (next)
reg c_nxt; // Carry (next)

assign sreg = {sreg_v, sreg_n, sreg_z, sreg_c};

always@(posedge clk or negedge rst_n)
begin
  if(!rst_n) begin
    sreg_v <= 4'b0;
    sreg_n <= 4'b0;
    sreg_z <= 4'b0;
    sreg_c <= 4'b0;
  end
  else if(sreg_we) begin
    sreg_v <= v_nxt;
    sreg_n <= n_nxt;
    sreg_z <= z_nxt;
    sreg_c <= c_nxt;
  end
end

always@(*)
begin
  case(opcode)
    4'b0001: alu_out <= rd + rr;          // ADD
    4'b0011: alu_out <= rd + rr + sreg_c; // ADC (Add with Carry): Rd = Rd + Rr + C
    4'b0010: alu_out <= rd - rr - sreg_c; // SBC (Subtract with Carry)
    4'b0110: alu_out <= rd - rr;          // SUB
    4'b0101: alu_out <= rd - rr;          // CP (Compare)
    4'b1000: alu_out <= rd & rr;          // AND
    4'b1001: alu_out <= rd ^ rr;          // EOR
    4'b1010: alu_out <= rd | rr;          // OR
    4'b1011: alu_out <= rr;               // MOV
    default: alu_out <= rd;               // default
  endcase
end

wire add_v, sub_v, add_z, sbc_z, add_c, sub_c;

assign add_v = ( rd[7] &  rr[7] & ~alu_out[7]) | (~rd[7] & ~rr[7] & alu_out[7]);
assign sub_v = ( rd[7] & ~rr[7] & ~alu_out[7]) | (~rd[7] &  rr[7] & alu_out[7]);
assign add_z = &~alu_out;
assign sbc_z = add_z & sreg_z;
assign add_c = ( rd[7] &  rr[7]) | (rr[7] & ~alu_out[7]) | (~alu_out[7] &  rd[7]);
assign sub_c = (~rd[7] &  rr[7]) | (rr[7] &  alu_out[7]) | ( alu_out[7] & ~rd[7]);


always@(*)
begin
  case(opcode)
    4'b0001: begin v_nxt <= add_v;  n_nxt <= alu_out[7]; z_nxt <= add_z;  c_nxt <= add_c;  end // ADD
    4'b0011: begin v_nxt <= add_v;  n_nxt <= alu_out[7]; z_nxt <= add_z;  c_nxt <= add_c;  end // ADC (Add with Carry): Rd = Rd + Rr + C
    4'b0010: begin v_nxt <= sub_v;  n_nxt <= alu_out[7]; z_nxt <= sbc_z;  c_nxt <= sub_c;  end // SBC (Subtract with Carry)
    4'b0110: begin v_nxt <= sub_v;  n_nxt <= alu_out[7]; z_nxt <= add_z;  c_nxt <= sub_c;  end // SUB
    4'b0101: begin v_nxt <= sub_v;  n_nxt <= alu_out[7]; z_nxt <= add_z;  c_nxt <= sub_c;  end // CP (Compare)
    4'b1000: begin v_nxt <= 1'b0;   n_nxt <= alu_out[7]; z_nxt <= add_z;  c_nxt <= sreg_c; end // AND
    4'b1001: begin v_nxt <= 1'b0;   n_nxt <= alu_out[7]; z_nxt <= add_z;  c_nxt <= sreg_c; end // EOR
    4'b1010: begin v_nxt <= 1'b0;   n_nxt <= alu_out[7]; z_nxt <= add_z;  c_nxt <= sreg_c; end // OR
    4'b1011: begin v_nxt <= sreg_v; n_nxt <= sreg_n;     z_nxt <= sreg_z; c_nxt <= sreg_c; end // MOV
    default: begin v_nxt <= sreg_v; n_nxt <= sreg_n;     z_nxt <= sreg_z; c_nxt <= sreg_c; end // default
  endcase
end

reg [23:0] debug_alu;

always@(*)
begin
  case(opcode)
    4'b0001: debug_alu <= "ADD";
    4'b0011: debug_alu <= "ADC";
    4'b0010: debug_alu <= "SBC";
    4'b0110: debug_alu <= "SUB";
    4'b0101: debug_alu <= "CP";
    4'b1000: debug_alu <= "AND";
    4'b1001: debug_alu <= "EOR";
    4'b1010: debug_alu <= "OR ";
    4'b1011: debug_alu <= "MOV";
    default: debug_alu <= "ERR";
  endcase
end

endmodule

module rf (
  input clk, 
  input rst_n, 
  input rf_we, 
  input [4:0] rf_idx_d, rf_idx_r, 
  input [7:0] rf_wdata, 
  output [7:0] rd, rr
);

wire [7:0] r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19, r20, r21, r22, r23, r24, r25, r26, r27, r28, r29, r30, r31;
wire [31:0] we_1h;

rf_reg_32 u_rf_reg_32 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h), .rf_wdata(rf_wdata), .r0(r0), .r1(r1), .r2(r2), .r3(r3), .r4(r4), .r5(r5), .r6(r6), .r7(r7), .r8(r8), .r9(r9), .r10(r10), .r11(r11), .r12(r12), .r13(r13), .r14(r14), .r15(r15), .r16(r16), .r17(r17), .r18(r18), .r19(r19), .r20(r20), .r21(r21), .r22(r22), .r23(r23), .r24(r24), .r25(r25), .r26(r26), .r27(r27), .r28(r28), .r29(r29), .r30(r30), .r31(r31));

rf_wdec u_wdec (.idx(rf_idx_d), .rf_we(rf_we), .we_1h(we_1h));

rf_rdec u_rdec_d (.idx(rf_idx_d), .r0(r0), .r1(r1), .r2(r2), .r3(r3), .r4(r4), .r5(r5), .r6(r6), .r7(r7), .r8(r8), .r9(r9), .r10(r10), .r11(r11), .r12(r12), .r13(r13), .r14(r14), .r15(r15), .r16(r16), .r17(r17), .r18(r18), .r19(r19), .r20(r20), .r21(r21), .r22(r22), .r23(r23), .r24(r24), .r25(r25), .r26(r26), .r27(r27), .r28(r28), .r29(r29), .r30(r30), .r31(r31), .opr(rd));

rf_rdec u_rdec_r (.idx(rf_idx_r), .r0(r0), .r1(r1), .r2(r2), .r3(r3), .r4(r4), .r5(r5), .r6(r6), .r7(r7), .r8(r8), .r9(r9), .r10(r10), .r11(r11), .r12(r12), .r13(r13), .r14(r14), .r15(r15), .r16(r16), .r17(r17), .r18(r18), .r19(r19), .r20(r20), .r21(r21), .r22(r22), .r23(r23), .r24(r24), .r25(r25), .r26(r26), .r27(r27), .r28(r28), .r29(r29), .r30(r30), .r31(r31), .opr(rr));

endmodule

module rf_reg_32 (
  input clk, 
  input rst_n, 
  input [31:0] we_1h, 
  input [7:0] rf_wdata, 
  output [7:0] r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19, r20, r21, r22, r23, r24, r25, r26, r27, r28, r29, r30, r31
);

rf_reg u_r0 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 0]), .wdata(rf_wdata), .r(r0 ));
rf_reg u_r1 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 1]), .wdata(rf_wdata), .r(r1 ));
rf_reg u_r2 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 2]), .wdata(rf_wdata), .r(r2 ));
rf_reg u_r3 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 3]), .wdata(rf_wdata), .r(r3 ));
rf_reg u_r4 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 4]), .wdata(rf_wdata), .r(r4 ));
rf_reg u_r5 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 5]), .wdata(rf_wdata), .r(r5 ));
rf_reg u_r6 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 6]), .wdata(rf_wdata), .r(r6 ));
rf_reg u_r7 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 7]), .wdata(rf_wdata), .r(r7 ));
rf_reg u_r8 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 8]), .wdata(rf_wdata), .r(r8 ));
rf_reg u_r9 (.clk(clk), .rst_n(rst_n), .we_1h(we_1h[ 9]), .wdata(rf_wdata), .r(r9 ));
rf_reg u_r10(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[10]), .wdata(rf_wdata), .r(r10));
rf_reg u_r11(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[11]), .wdata(rf_wdata), .r(r11));
rf_reg u_r12(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[12]), .wdata(rf_wdata), .r(r12));
rf_reg u_r13(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[13]), .wdata(rf_wdata), .r(r13));
rf_reg u_r14(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[14]), .wdata(rf_wdata), .r(r14));
rf_reg u_r15(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[15]), .wdata(rf_wdata), .r(r15));
rf_reg u_r16(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[16]), .wdata(rf_wdata), .r(r16));
rf_reg u_r17(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[17]), .wdata(rf_wdata), .r(r17));
rf_reg u_r18(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[18]), .wdata(rf_wdata), .r(r18));
rf_reg u_r19(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[19]), .wdata(rf_wdata), .r(r19));
rf_reg u_r20(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[20]), .wdata(rf_wdata), .r(r20));
rf_reg u_r21(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[21]), .wdata(rf_wdata), .r(r21));
rf_reg u_r22(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[22]), .wdata(rf_wdata), .r(r22));
rf_reg u_r23(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[23]), .wdata(rf_wdata), .r(r23));
rf_reg u_r24(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[24]), .wdata(rf_wdata), .r(r24));
rf_reg u_r25(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[25]), .wdata(rf_wdata), .r(r25));
rf_reg u_r26(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[26]), .wdata(rf_wdata), .r(r26));
rf_reg u_r27(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[27]), .wdata(rf_wdata), .r(r27));
rf_reg u_r28(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[28]), .wdata(rf_wdata), .r(r28));
rf_reg u_r29(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[29]), .wdata(rf_wdata), .r(r29));
rf_reg u_r30(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[30]), .wdata(rf_wdata), .r(r30));
rf_reg u_r31(.clk(clk), .rst_n(rst_n), .we_1h(we_1h[31]), .wdata(rf_wdata), .r(r31));

endmodule

module rf_reg (
  input clk, rst_n, we_1h,
  input [7:0] wdata,
  output reg [7:0] r
);

always@(posedge clk or negedge rst_n)
  if(!rst_n)
    r <= 8'b0;
  else if (we_1h)
    r <= wdata;
 
endmodule

module rf_wdec (
  input [4:0] idx,
  input       rf_we,
  output reg [31:0] we_1h
);

always@(*)
  if(rf_we)
    case(idx)
      5'd0 : we_1h = 32'b0000_0000_0000_0000_0000_0000_0000_0001;
      5'd1 : we_1h = 32'b0000_0000_0000_0000_0000_0000_0000_0010;
      5'd2 : we_1h = 32'b0000_0000_0000_0000_0000_0000_0000_0100;
      5'd3 : we_1h = 32'b0000_0000_0000_0000_0000_0000_0000_1000;
      5'd4 : we_1h = 32'b0000_0000_0000_0000_0000_0000_0001_0000;
      5'd5 : we_1h = 32'b0000_0000_0000_0000_0000_0000_0010_0000;
      5'd6 : we_1h = 32'b0000_0000_0000_0000_0000_0000_0100_0000;
      5'd7 : we_1h = 32'b0000_0000_0000_0000_0000_0000_1000_0000;
      5'd8 : we_1h = 32'b0000_0000_0000_0000_0000_0001_0000_0000;
      5'd9 : we_1h = 32'b0000_0000_0000_0000_0000_0010_0000_0000;
      5'd10: we_1h = 32'b0000_0000_0000_0000_0000_0100_0000_0000;
      5'd11: we_1h = 32'b0000_0000_0000_0000_0000_1000_0000_0000;
      5'd12: we_1h = 32'b0000_0000_0000_0000_0001_0000_0000_0000;
      5'd13: we_1h = 32'b0000_0000_0000_0000_0010_0000_0000_0000;
      5'd14: we_1h = 32'b0000_0000_0000_0000_0100_0000_0000_0000;
      5'd15: we_1h = 32'b0000_0000_0000_0000_1000_0000_0000_0000;
      5'd16: we_1h = 32'b0000_0000_0000_0001_0000_0000_0000_0000;
      5'd17: we_1h = 32'b0000_0000_0000_0010_0000_0000_0000_0000;
      5'd18: we_1h = 32'b0000_0000_0000_0100_0000_0000_0000_0000;
      5'd19: we_1h = 32'b0000_0000_0000_1000_0000_0000_0000_0000;
      5'd20: we_1h = 32'b0000_0000_0001_0000_0000_0000_0000_0000;
      5'd21: we_1h = 32'b0000_0000_0010_0000_0000_0000_0000_0000;
      5'd22: we_1h = 32'b0000_0000_0100_0000_0000_0000_0000_0000;
      5'd23: we_1h = 32'b0000_0000_1000_0000_0000_0000_0000_0000;
      5'd24: we_1h = 32'b0000_0001_0000_0000_0000_0000_0000_0000;
      5'd25: we_1h = 32'b0000_0010_0000_0000_0000_0000_0000_0000;
      5'd26: we_1h = 32'b0000_0100_0000_0000_0000_0000_0000_0000;
      5'd27: we_1h = 32'b0000_1000_0000_0000_0000_0000_0000_0000;
      5'd28: we_1h = 32'b0001_0000_0000_0000_0000_0000_0000_0000;
      5'd29: we_1h = 32'b0010_0000_0000_0000_0000_0000_0000_0000;
      5'd30: we_1h = 32'b0100_0000_0000_0000_0000_0000_0000_0000;
      5'd31: we_1h = 32'b1000_0000_0000_0000_0000_0000_0000_0000;
    endcase
  else
      we_1h = 32'b0000_0000_0000_0000_0000_0000_0000_0000;
  
endmodule

module rf_rdec(
  input [4:0] idx, 
  input [7:0] r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19, r20, r21, r22, r23, r24, r25, r26, r27, r28, r29, r30, r31,
  output reg [7:0] opr
);

always@(*)
begin
  case(idx)
    5'd0:  opr = r0;
    5'd1:  opr = r1;
    5'd2:  opr = r2;
    5'd3:  opr = r3;
    5'd4:  opr = r4;
    5'd5:  opr = r5;
    5'd6:  opr = r6;
    5'd7:  opr = r7;
    5'd8:  opr = r8;
    5'd9:  opr = r9;
    5'd10: opr = r10;
    5'd11: opr = r11;
    5'd12: opr = r12;
    5'd13: opr = r13;
    5'd14: opr = r14;
    5'd15: opr = r15;
    5'd16: opr = r16;
    5'd17: opr = r17;
    5'd18: opr = r18;
    5'd19: opr = r19;
    5'd20: opr = r20;
    5'd21: opr = r21;
    5'd22: opr = r22;
    5'd23: opr = r23;
    5'd24: opr = r24;
    5'd25: opr = r25;
    5'd26: opr = r26;
    5'd27: opr = r27;
    5'd28: opr = r28;
    5'd29: opr = r29;
    5'd30: opr = r30;
    5'd31: opr = r31;
  endcase
end

endmodule

module pc (
  input clk, 
  input rst_n, 
  input [15:0] inst, 
  input [15:0] pc_nxt, 
  output reg [15:0] pc
);

  always@(posedge clk or negedge rst_n) begin
    if(!rst_n)
      pc <= 0;
    else begin
      pc <= pc_nxt;
    end
  end

endmodule

/* ---- Testbench (Skip Synthesis)  ---- */
module rom_256x16 (
  input [15:0] addr, 
  output [15:0] data
);

  reg [15:0] mem [0:'hff];

  assign data = mem[addr[15:0]];

  // loads mem[] from a file attached via the Memory Viewer card below -
  // this app has no real filesystem access over file://, so $readmemh can
  // only resolve a filename the user has already attached there
  initial $readmemh("rom.txt", mem, 0);

endmodule

module ram_4kx8 (
  input clk, 
  input we, 
  input [7:0] addr, 
  input [7:0] wdata, 
  output [7:0] rdata
);

  reg [7:0] mem [0:'h10ff]; // 4K + 256

  always@(posedge clk)
    if(we) mem[addr] = wdata;

  assign rdata = mem[addr]; // 0x100 offset

  // loads mem[] from a file attached via the Memory Viewer card below -
  // this app has no real filesystem access over file://, so $readmemh can
  // only resolve a filename the user has already attached there
  initial $readmemh("ram.txt", mem, 0);
endmodule

module system (input clk, input rst_n);
  wire [15:0] inst;
  wire [15:0] iaddr;
  wire [16:0] daddr;
  wire [7:0] wdata;
  wire [7:0] rdata;
  wire we;

  rom_256x16 u_rom (iaddr, inst);
  ram_4kx8 u_ram (clk, we, daddr, wdata, rdata);
  cpu u_cpu (clk, rst_n, iaddr, inst, daddr, we, wdata, rdata);

endmodule

module tb;
  reg clk, rst_n;

  system u_sys (clk, rst_n);

  always #5 clk = ~clk;

  /* No $display checks here, and that is the point: the Scoreboard card below runs a
     reference model of the AVR subset alongside this design and compares pc, r0-r31,
     sp, the flags and the memories after every retired instruction. It is a strictly
     stronger checker than a list of register comparisons could be, and it names the
     failing instruction in the program's own terms - on the unfinished starter it
     reports:

       pc: model 0009, design 0008 at instruction #8
       w07  breq +1        TAKEN:     pc = 07 + 1 + 1 -> w09
       the design was on w08  mov r7,  r16   SKIPPED

     Hand-written checks over u_sys.u_cpu.u_rf.rN would only restate what it already
     compares, one register at a time and without naming the instruction.

     So this testbench's whole job is to clock the design and stop: reset, run long
     enough for the program to finish, and $finish. */
  initial begin
    clk = 0; rst_n = 0;
    #12 rst_n = 1;
    #400;
    $finish;
  end
endmodule
`
  ,
  /* Attached for $readmemh/$readmemb by practice.js, so the design can fetch
     from it with nothing to save and re-attach by hand. */
  memFiles: {
    'rom.txt': String.raw`
// 8-bit CPU (16-bit instruction) practice program - real AVR encodings, one
// 16-bit word per line, loaded with $readmemh. Addresses below are WORD
// addresses, which is what pc holds and what a branch displacement counts in.
//
// It sets up two values, then proves each of the four control-flow cases in
// turn - a taken and an untaken BREQ, a taken and an untaken BRNE, and then a
// forward and a backward RJMP. Every case has a WITNESS register: one that is
// only written if the branch went the right way, and one that is only written
// if it went the wrong way.
e604 // w00  ldi r16, 100   r16 = 0x64
2e00 // w01  mov r0,  r16   r0  = 100
e604 // w02  ldi r16, 100
2e10 // w03  mov r1,  r16   r1  = 100  == r0
ec08 // w04  ldi r16, 200
2e20 // w05  mov r2,  r16   r2  = 200  != r0
1401 // w06  cp  r0,  r1    100 == 100 -> Z = 1
f009 // w07  breq +1        TAKEN:     pc = 07 + 1 + 1 -> w09
2e70 // w08  mov r7,  r16   SKIPPED    -> r7 must stay 0
e001 // w09  ldi r16, 1     <-- BREQ landed HERE
2e30 // w0a  mov r3,  r16   r3  = 1    proves the branch was taken
1402 // w0b  cp  r0,  r2    100 != 200 -> Z = 0
f009 // w0c  breq +1        NOT taken: pc = 0c + 1 -> w0d
e002 // w0d  ldi r16, 2     <-- fell through to HERE
2e40 // w0e  mov r4,  r16   r4  = 2    proves it was not taken
1402 // w0f  cp  r0,  r2    100 != 200 -> Z = 0
f409 // w10  brne +1        TAKEN:     pc = 10 + 1 + 1 -> w12
2e80 // w11  mov r8,  r16   SKIPPED    -> r8 must stay 0
e003 // w12  ldi r16, 3     <-- BRNE landed HERE
2e50 // w13  mov r5,  r16   r5  = 3    proves the branch was taken
1401 // w14  cp  r0,  r1    100 == 100 -> Z = 1
f409 // w15  brne +1        NOT taken: pc = 15 + 1 -> w16
e004 // w16  ldi r16, 4     <-- fell through to HERE
2e60 // w17  mov r6,  r16   r6  = 4    proves it was not taken
c002 // w18  rjmp +2        pc = 18 + 1 + 2 -> w1b   forward
2e90 // w19  mov r9,  r16   SKIPPED    -> r9 must stay 0
2ea0 // w1a  mov r10, r16   SKIPPED    -> r10 must stay 0
e005 // w1b  ldi r16, 5     <-- forward RJMP landed HERE
2eb0 // w1c  mov r11, r16   r11 = 5    proves where the forward jump landed
c002 // w1d  rjmp +2        pc = 1d + 1 + 2 -> w20
e007 // w1e  ldi r16, 7     <-- backward RJMP lands HERE
c003 // w1f  rjmp +3        pc = 1f + 1 + 3 -> w23   the exit, only reached from w1e
e006 // w20  ldi r16, 6
2ec0 // w21  mov r12, r16   r12 = 6
cffb // w22  rjmp -5        pc = 22 + 1 - 5 -> w1e   backward
2ed0 // w23  mov r13, r16   r13 = 7    proves where the backward jump landed
0000 // w24  nop
0000 // w25  nop
0000 // w26  nop
0000 // w27  nop
`,
    'ram.txt': String.raw`
// Initial data memory, loaded with $readmemh. This program never touches data
// memory (the core ties we low), so these bytes are only here because
// $readmemh's filename is fixed and an unattached file is a runtime error.
00
00
00
00
`
  }
};
