/* 8-bit CPU, 16-bit instruction word (a reduced AVR2 subset) - reference solution.
 *
 * A real instruction set this time: LDI and the ALU group are given, and the
 * exercise is the CONTROL FLOW - RJMP, BREQ and BRNE - which on this machine is
 * one expression per instruction, computing pc_nxt inside the decoder.
 *
 * Three facts decide those three expressions, and all three are AVR facts rather
 * than opinions:
 *
 *   The displacement is a WORD count, not a byte count, because pc counts words.
 *   It is SIGNED, so it has to be sign-extended to 16 bits before it is added -
 *   the same trap as the 8-bit CPU exercise, one instruction width up.
 *   And it is relative to the instruction AFTER the branch, so the sum carries a
 *   +1: pc_nxt = pc + k + 1. Leaving that out lands every branch one word short,
 *   which for a backward branch to itself is an infinite loop.
 *
 * RJMP carries a 12-bit displacement (inst[11:0]); BREQ and BRNE carry 7 bits
 * (inst[9:3]) and test Z, which is sreg[1] here. Note BRNE tests the INVERSE of
 * the same bit - there is no separate not-equal flag.
 *
 * Everything else is provided: a 32-entry register file built out of discrete
 * registers with a one-hot write decoder, an ALU with V/N/Z/C flags, and the
 * ROM/RAM around them. The ALU opcode numbering is this core's own reading of the
 * instruction word; the CPU / Memory Model card at the bottom of the page is the
 * place to hold it up against real AVR semantics, and it is worth doing after the
 * checks below pass.
 *
 * rom.txt and ram.txt are already attached - read the program in the Memory
 * Viewer card. It is written so that every branch has a witness register: one that
 * is written only if the branch went the right way, and one that is written only
 * if it went the wrong way.
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
    /* Defaults, so every signal this block drives is assigned on every path through
       the casex below. Without them the synthesizer refuses the block rather than
       infer a latch, and this design produces no netlist at all. The cost is paid in
       the waveform: a signal written twice per settling pass records both values, so
       opcode's row goes from 12 history entries to 1171. */
    sreg_we <= 1'b0;
    opcode <= 4'b0;
    rf_we <= 1'b0;
    rf_idx_d <= 5'b0;
    rf_idx_r <= 5'b0;
    rf_wdata <= 8'b0;
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

      6'b1100xx: begin // rjmp (offset)
        debug_inst <= "RJMP";
        pc_nxt <= pc + {inst[11], inst[11], inst[11], inst[11], inst[11:0]} + 1;
      end

      6'b111100: begin // breq
        debug_inst <= "BREQ";
        if(sreg[1])
          pc_nxt <= pc + {inst[9], inst[9], inst[9], inst[9], inst[9], inst[9], inst[9], inst[9], inst[9], inst[9:3]} + 1;
        else
          pc_nxt <= pc + 1;
      end

      6'b111101: begin // brne
        debug_inst <= "BRNE";
        if(~sreg[1])
          pc_nxt <= pc + {inst[9], inst[9], inst[9], inst[9], inst[9], inst[9], inst[9], inst[9], inst[9], inst[9:3]} + 1;
        else
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
// ======== TESTBENCH ========

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
