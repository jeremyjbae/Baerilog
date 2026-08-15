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
 * iff-check the practice pages' "synthesis" flag carries.
 *
 * Page filenames are `learn-<slug>.html`. Baerilog/ is flat - a page finds app.js by bare
 * filename - so a learn/ subdirectory would need ../app.js everywhere and break the one
 * property that makes every page here work over file://. The prefix is what keeps a topic
 * slug from colliding with an exercise slug.
 */
var LEARN_MANIFEST = [
  {"slug": "logic-gates", "title": "Logic Gates", "category": "Combinational", "level": 1, "kind": "comb", "pnr": true, "blurb": "Basic logic gate, truth table, and how it becomes silicon", "slots": ["editor", "truth-table", "waveform", "netlist"]}
];

/* Row order on the hub, and the order of the Category chips. Same arrangement as
   PRACTICE_CATEGORIES: a category with no topic simply grows no chip. */
var LEARN_CATEGORIES = ['Combinational', 'Sequential', 'Arithmetic', 'Memory & Datapath'];
