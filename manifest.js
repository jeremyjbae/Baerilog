/* The practice catalogue: the single list the hub and every page read from.
 *
 * Written as JSON-compatible object literals on purpose - Baerilog/tools/build.py
 * reads this file to generate one page per entry and to check that each slug has
 * an exercise file and a solution, and it does that with json.loads rather than a
 * JS parser. So: double-quoted keys and strings, no trailing commas, no comments
 * inside the array.
 *
 * `kind` picks the glyph on the hub: "comb" for a purely combinational design, "seq"
 * for anything with a clock, and "mega" for a design built around a memory array - a
 * RAM, a ROM-driven datapath or a CPU. "mega" is a subset of what "seq" would say (all
 * four are clocked), chosen because the thing worth telling apart at a glance on that
 * row is which designs have a memory in them. `level` is the difficulty band; it shows as a
 * Label on the problem's row and drives the hub's Level filter chips, so a level
 * used by no entry simply grows no chip. `category` does the same for the Category
 * chips, in PRACTICE_CATEGORIES order, which is also the row order.
 *
 * `memory` shows the Memory Viewer card on that problem's page. It is opt-in
 * because the card reads "No memories declared in this design." on a design that
 * has none, which across twenty pages is sixteen panels of nothing - so a page
 * carries it exactly where a memory array or an attached image is part of the
 * exercise, and nowhere else. Baerilog/test.py derives that set from the designs
 * rather than reading this flag back, so a flag added or dropped here is caught.
 */
var PRACTICE_MANIFEST = [
  {"slug": "d-flip-flop", "title": "D Flip-Flop", "category": "Basics", "level": 1, "kind": "seq", "blurb": "Capture d on the rising edge of clk", "synthesis": true},
  {"slug": "mux-2to1", "title": "2:1 Multiplexer", "category": "Basics", "level": 1, "kind": "comb", "blurb": "Select between two 4-bit inputs", "synthesis": true},
  {"slug": "counter-4bit", "title": "4-bit Counter", "category": "Basics", "level": 1, "kind": "seq", "blurb": "Count up with a synchronous reset", "synthesis": true},
  {"slug": "edge-detector", "title": "Rising-Edge Detector", "category": "Basics", "level": 1, "kind": "seq", "blurb": "One-cycle pulse on every 0 to 1 transition", "synthesis": true},
  {"slug": "shift-register-4bit", "title": "4-bit Shift Register", "category": "Basics", "level": 1, "kind": "seq", "blurb": "Four dff instances wired into a chain", "synthesis": true},

  {"slug": "adder-4bit", "title": "4-bit Adder", "category": "Combinational", "level": 1, "kind": "comb", "blurb": "Sum and carry-out from two 4-bit inputs", "synthesis": true},
  {"slug": "decoder-3to8", "title": "3:8 Decoder", "category": "Combinational", "level": 1, "kind": "comb", "blurb": "One-hot output with an enable", "synthesis": true},
  {"slug": "comparator-4bit", "title": "4-bit Comparator", "category": "Combinational", "level": 1, "kind": "comb", "blurb": "Less-than, equal and greater-than flags", "synthesis": true},
  {"slug": "parity-8bit", "title": "8-bit Parity", "category": "Combinational", "level": 1, "kind": "comb", "blurb": "Even and odd parity of a byte", "synthesis": true},
  {"slug": "barrel-shifter-4bit", "title": "4-bit Barrel Shifter", "category": "Combinational", "level": 1, "kind": "comb", "blurb": "Rotate left by 0 to 3 places", "synthesis": true},
  {"slug": "alu-4bit", "title": "4-bit ALU", "category": "Combinational", "level": 1, "kind": "comb", "blurb": "Eight operations selected by a 3-bit opcode", "synthesis": true},

  {"slug": "ring-counter", "title": "4-bit Ring Counter", "category": "Sequential / FSM", "level": 2, "kind": "seq", "blurb": "A single 1 walking around four bits", "synthesis": true},
  {"slug": "gray-counter", "title": "4-bit Gray-code Counter", "category": "Sequential / FSM", "level": 2, "kind": "seq", "blurb": "One bit changes per step", "synthesis": true},
  {"slug": "sequence-detector", "title": "Sequence Detector (1011)", "category": "Sequential / FSM", "level": 2, "kind": "seq", "blurb": "Overlapping pattern match on a serial input", "synthesis": true},
  {"slug": "traffic-light", "title": "Traffic-light FSM", "category": "Sequential / FSM", "level": 2, "kind": "seq", "blurb": "Timed green / yellow / red with a walk light", "synthesis": true},

  {"slug": "register-file", "title": "8-bit Register File", "category": "Memory & Datapath", "level": 2, "kind": "seq", "blurb": "Two read ports, one write port, built from discrete registers", "synthesis": true},
  {"slug": "ram-8bit", "title": "8-bit RAM", "category": "Memory & Datapath", "level": 2, "kind": "mega", "memory": true, "blurb": "Synchronous write, combinational read"},
  {"slug": "calculator-8bit", "title": "8-bit Calculator", "category": "Memory & Datapath", "level": 2, "kind": "mega", "memory": true, "blurb": "Execute an opcode stream out of a ROM image", "synthesis": true},

  {"slug": "cpu-8bit", "title": "8-bit CPU (8-bit instruction)", "category": "CPU", "level": 3, "kind": "mega", "memory": true, "blurb": "Accumulator ISA: fetch, decode, execute, store", "synthesis": true}
];

/* The hub's card order. A category absent from here would still render (appended
 * in first-appearance order), but naming them keeps Basics first however the
 * array above is edited. */
var PRACTICE_CATEGORIES = [
  'Basics',
  'Combinational',
  'Sequential / FSM',
  'Memory & Datapath',
  'CPU'
];
