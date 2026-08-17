/* The learn catalogue: the single list learn.html and Baerilog/tools/build.py read.
 *
 * Written as JSON-compatible object literals for the same reason PRACTICE_MANIFEST is -
 * build.py reads this file with json.loads rather than a JS parser, so: double-quoted
 * keys and strings, no trailing commas, no comments inside the array.
 *
 * A topic is READ, where an exercise is answered, so the fields differ in one way that
 * matters: there is no solution and no starter to fail, and `slots` says which of the
 * app's cards this topic wants and therefore which files its page loads. The rest -
 * `category`, `level`, `blurb`, `kind` - is deliberately the same vocabulary the practice
 * hub uses, because the two catalogues are read the same way and a reader moving between
 * them should not have to learn a second one.
 *
 * `slots` names the cards the topic's own markup places, in `topics/<slug>.js`. It is not
 * cosmetic: build.py generates the page's <script> tags from it, so a topic asking for
 * "netlist" gets synth.js and practice-synth.js and one that does not, does not - the same
 * iff-check the practice pages' "synthesis" flag carries. An EMPTY list is a real answer and
 * not an omission: `lego-logic` is prose and illustrations with nothing to run, so learn.js
 * removes every card and hides the app's grid, and the article is the whole page.
 *
 * Page filenames are `learn-<slug>.html`. Baerilog/ is flat - a page finds app.js by bare
 * filename - so a learn/ subdirectory would need ../app.js everywhere and break the one
 * property that makes every page here work over file://. The prefix is what keeps a topic
 * slug from colliding with an exercise slug.
 */
var LEARN_MANIFEST = [
  {"slug": "lego-logic", "title": "Digital Logic is like LEGO!", "category": "Basics", "level": 1, "kind": "comb", "blurb": "Why a gate needs two inputs before it can decide anything", "slots": []},
  {"slug": "logic-gates", "title": "Logic Gates", "category": "Basics", "level": 1, "kind": "comb", "pnr": true, "blurb": "Basic logic gate, truth table, and how it becomes silicon", "slots": ["editor", "truth-table", "waveform", "netlist"]},
  {"slug": "decoder-2to4", "title": "2:4 Decoder", "category": "Combinational", "level": 1, "kind": "comb", "pnr": true, "blurb": "Two bits in, one wire out of four - which is what an address is", "slots": ["editor", "truth-table", "waveform", "netlist"]},
  {"slug": "half-adder-1bit", "title": "1-Bit Half Adder", "category": "Combinational", "level": 2, "kind": "comb", "pnr": true, "blurb": "Two bits in, sum and carry out, built out of the gates from the last topic", "slots": ["editor", "truth-table", "waveform", "netlist"]},
  {"slug": "full-adder-1bit", "title": "1-Bit Full Adder", "category": "Combinational", "level": 2, "kind": "comb", "pnr": true, "blurb": "The same circuit given a carry in, which is what lets one column feed the next", "slots": ["editor", "truth-table", "waveform", "netlist"]},
  {"slug": "ripple-carry-4bit", "title": "4-Bit Ripple-Carry Adder", "category": "Arithmetic", "level": 2, "kind": "comb", "pnr": true, "blurb": "Four of those chained carry to carry, and what happens when the answer will not fit", "slots": ["editor", "waveform", "netlist"]},
  {"slug": "adder-8bit", "title": "8-Bit Adder with \"One line of Code\"", "category": "Arithmetic", "level": 2, "kind": "comb", "pnr": true, "blurb": "The same addition written as one line, and the chain the tool builds from it", "slots": ["editor", "waveform", "netlist"]},
  {"slug": "mux-2to1", "title": "2:1 Multiplexer", "category": "Combinational", "level": 2, "kind": "comb", "pnr": true, "blurb": "One bit of control choosing between two bits of data - the first circuit that does not compute", "slots": ["editor", "truth-table", "waveform", "netlist"]},
  {"slug": "mux-8to1", "title": "8:1 Multiplexer", "category": "Combinational", "level": 2, "kind": "comb", "pnr": true, "blurb": "Three select bits choosing one of eight - seven muxes in three levels, and where a case statement is exactly right", "slots": ["editor", "waveform", "netlist"]},
  {"slug": "subtractor-4bit", "title": "4-Bit Subtractor", "category": "Arithmetic", "level": 3, "kind": "comb", "pnr": true, "blurb": "There is no subtractor - it is the adder with b inverted, and that is where negative numbers come from", "slots": ["editor", "waveform", "netlist"]},
  {"slug": "alu-4bit", "title": "4-Bit ALU", "category": "Arithmetic", "level": 3, "kind": "comb", "pnr": true, "blurb": "One block, four operations, and a control input that says which - where nearly half the area is choosing", "slots": ["editor", "waveform", "netlist"]},
  {"slug": "d-flip-flop", "title": "D Flip-Flop: One Bit of Memory", "category": "Sequential", "level": 2, "kind": "seq", "pnr": true, "blurb": "The first circuit that remembers, and the clock edge that tells it when", "slots": ["editor", "waveform", "netlist"]},
  {"slug": "register-4bit", "title": "4-Bit Register", "category": "Sequential", "level": 2, "kind": "seq", "pnr": true, "blurb": "Four flip-flops on one clock, and the mux that lets them keep what they have", "slots": ["editor", "waveform", "netlist"]},
  {"slug": "shift-register-4bit", "title": "4-Bit Shift Register", "category": "Sequential", "level": 2, "kind": "seq", "pnr": true, "blurb": "The same four flops in a line instead of side by side - four cells and no logic at all", "slots": ["editor", "waveform", "netlist"]},
  {"slug": "counter-4bit", "title": "4-Bit Counter", "category": "Sequential", "level": 2, "kind": "seq", "pnr": true, "blurb": "An adder in front of a register, feeding itself - and what happens after 15", "slots": ["editor", "waveform", "netlist"]}
];

/* Row order on the hub, and the order of the Category chips. Same arrangement as
   PRACTICE_CATEGORIES: a category with no topic simply grows no chip.
 *
 * `Basics` leads, which is what puts the LEGO topic at the top of the hub - and it is the
 * category ORDER that does it rather than the array order above, since learn.html sorts by
 * this list first. Same word the practice manifest uses for the same idea, because the two
 * catalogues share one vocabulary and a reader moving between them should not have to learn
 * a second one.
 *
 * `Sequential` comes LAST, where PRACTICE_CATEGORIES puts it before the datapath ones, and that
 * is the one deliberate departure. A topic reads in hub order, `d-flip-flop`'s first sentence is
 * that every circuit on the pages before it forgets, and its last one is that an adder in front of
 * a flip-flop is a counter - so it has to sit after the arithmetic run rather than in the middle of
 * it. The word is the same either way; only the position moved. */
var LEARN_CATEGORIES = ['Basics', 'Combinational', 'Arithmetic', 'Sequential'];
