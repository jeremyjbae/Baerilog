/* Topic content for the 'design-tools' learn page - the second history topic, and the second with no
 * design to run.
 *
 * IT IS AN INTEGRATION OF AN OUTSIDE ARTICLE, `evolution_of_eda_tools.html`, and it follows the rule
 * `integrated-circuits` set when the first of these was brought in: what is kept is the CONTENT - the
 * narrative, every number in it, and its five quiz questions - and what is dropped is the presentation,
 * all of it. That file is a standalone page with its own token set, gradient headings and ~500 lines of
 * CSS, and none of it would survive contact with this site. So every paragraph here is `.learn-prose`,
 * every aside is `.learn-note`, the era numbers are the site's own `.truth-table`, the two drawings are
 * `.learn-illus` panels painted from tokens, and its two steppers are `{widget}` blocks - which is why
 * this page is legible in both colour modes and that one is not.
 *
 * ITS TWO STEPPERS ARE DATA, not code. `topic.widgets[name]` is a list of steps exactly as `figures`
 * and `quizzes` are lists, and learn.js owns every bit of the stepping - so the source's pipeline TABS
 * and its era SLIDER, which were two different controls doing one thing, are the same control here, and
 * it is the control the layout player already uses. A reader who has stepped a cross section knows how
 * to drive these.
 *
 * THE TABLE AND THE ERA STEPPER SAY DIFFERENT THINGS, deliberately, for the reason the IC page records:
 * saying the same thing twice on one page is how two copies drift. The table carries the NUMBERS - what
 * a chip held per decade, and what one designer was drawing - because that is a comparison and belongs
 * in one glance. The stepper carries what a table cannot: the tool of the era, drawn, and the thing it
 * put out of a job. No number appears in both.
 *
 * NO SLOTS, NO FIGURES, NO PLACEMENT. `slots: []` is a real answer (see the manifest note): learn.js
 * removes every card and hides the app's grid, and the article is the page. There is no Verilog to run
 * because the subject is the tools rather than a circuit - and the one place a netlist WOULD help, the
 * synthesis section, points at `learn-mux-2to1.html` instead, where that exact example is synthesized
 * for real by the app rather than drawn as a picture of a synthesis.
 *
 * WHERE IT SITS is directly after `integrated-circuits`, and the pair is the point: that page is how a
 * chip became possible to MAKE, this one is how a chip became possible to DESIGN, and both end up
 * pointing at the same three apps. The whole second section is a map of this site - stage 2 is the
 * simulator, stage 3 is the synthesizer, stage 4 is Place & Route - which is what makes this a topic
 * here rather than an article that happens to be hosted here.
 *
 * FOUR CLAIMS OF THE SOURCE ARE CORRECTED rather than repeated, and the first two are the ones a reader
 * could be misled by:
 *
 *   - it invents a product. "Google DSO-01" is not a thing; the Google work is a reinforcement-learning
 *     floorplanner published in Nature in 2021, and the shipping products with names are Synopsys
 *     DSO.ai and Cadence Cerebrus. Naming a tool that does not exist is the one error here that a
 *     reader cannot possibly catch.
 *   - it invents a measurement. Its synthesis demo reports "4 standard cells (Area: 14 um2)" for a 2:1
 *     mux, which is a number with no library behind it. This site can do better than a plausible
 *     number: its own synthesizer turns that exact line into ONE cell, and the four-gate spelling of
 *     the same function into four - measured, on the page that does it.
 *   - it dates the Mead-Conway textbook to 1979. `Introduction to VLSI Systems` was published in 1980;
 *     the courses that became it ran from 1978. The decade is what matters and the decade is right, so
 *     the fix is quiet.
 *   - it dates PrimeTime to 1995. It shipped in 1997, so this page says the second half of the
 *     nineties: a precise year nobody has checked is worse than a range everybody agrees on, and
 *     "mid-1990s" - which this file said first - is the same mistake one notch smaller.
 *
 * ITS "27 MILLION YEARS" IS KEPT, because it is right: 100 billion transistors at ten a day is 10
 * billion days, which is 27.4 million years. Arithmetic the reader can redo is the best kind of number
 * to keep from a source, and this one is also the argument for the entire page.
 *
 * ITS ONE CODE BLOCK IS A QUOTATION OF ANOTHER PAGE, and that is why it is one line rather than a
 * module. `learn-code` normally quotes the topic's OWN design, and test_learn.py holds every line in one
 * to a line the topic ships - which a slotless topic cannot satisfy, so it takes the branch that says
 * so. That branch is not a licence to invent: the line here is byte-for-byte the design `mux-2to1`
 * ships, because the paragraph around it tells the reader to go and synthesize it there, and a
 * quotation with the port names changed would be the same drift the check exists to stop, one page over.
 *
 * EVERY DRAWING IS `currentColor` PLUS AT MOST ONE TOKEN, so there is no colour literal in this file at
 * all and both illustrations follow the reader's colour mode. The source's SVGs were six literal hexes
 * on a fixed dark background - invisible in light mode, which is the whole reason none of its CSS came
 * across.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['design-tools'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="razor">Drawing a chip with a razor blade</h2>
<p>The <a href="learn-integrated-circuits.html">previous topic</a> ends with a factory that can print a
million transistors. It leaves out the harder half of the problem: somebody has to say <em>where they
go</em>. For the first fifteen years of the integrated circuit, that somebody was a person with a
pencil.</p>
<p>A design started as a schematic drawn on graph paper in coloured pencils - one colour per layer, the
same layers the <a href="learn-logic-gates.html">Logic Gates</a> page cuts a cell open into. To turn
that drawing into something a factory could use, technicians cut it by hand into <b>Rubylith</b>: a red
plastic film on a clear backing, laid out at <b>500 times</b> the size of the finished chip. Every
shape was outlined with an <b>X-Acto blade</b> and the film inside it peeled away. The result was
photographed and reduced onto a glass mask.</p>
<p>One slip of the blade ruined the layer.</p>
` },

    { html: String.raw`
<div class="learn-split">
  <div>
    <div class="learn-illus">
      <svg width="240" height="140" viewBox="0 0 240 140" aria-label="A sheet of Rubylith with two hand-cut shapes whose edges overlap">
        <rect x="14" y="14" width="212" height="112" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
        <text x="24" y="32" font-size="9" fill="currentColor" opacity="0.7">DIFFUSION, cut at 500x</text>
        <g fill="currentColor" opacity="0.5">
          <path d="M32 52 L104 50 L106 84 L33 86 Z"/>
          <path d="M100 49 L196 52 L194 85 L102 83 Z"/>
        </g>
        <path d="M100 49 L106 50 L106 84 L102 83 Z" style="fill: var(--danger-fg)"/>
        <path d="M103 40 V96" style="stroke: var(--danger-fg)" stroke-width="1.5" stroke-dasharray="4 3"/>
        <text x="103" y="110" font-size="9" text-anchor="middle" style="fill: var(--danger-fg)">the two cuts overlap</text>
      </svg>
      <div class="learn-illus-cap">By hand: the error is in the artwork, and nothing checks it.</div>
    </div>
    <p>Two shapes that should have met at an edge overlap by half a millimetre on the sheet. Reduced 500
    times that is a micron of unwanted diffusion - a short between two things that were meant to be
    separate. It is found when the wafers come back, weeks later.</p>
  </div>
  <div>
    <div class="learn-illus">
      <svg width="240" height="140" viewBox="0 0 240 140" aria-label="The same layout drawn on a grid by a tool, with cells aligned and no overlap">
        <g stroke="currentColor" stroke-width="1" opacity="0.18">
          <path d="M14 44 H226 M14 70 H226 M14 96 H226"/>
          <path d="M62 18 V122 M110 18 V122 M158 18 V122"/>
        </g>
        <rect x="14" y="14" width="212" height="112" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
        <g fill="currentColor" opacity="0.5">
          <rect x="32" y="52" width="70" height="34"/>
          <rect x="110" y="52" width="70" height="34"/>
        </g>
        <path d="M102 69 H110" stroke="currentColor" stroke-width="1.5" opacity="0.8"/>
        <text x="120" y="112" font-size="9" text-anchor="middle" style="fill: var(--success-fg)">0 rule violations</text>
      </svg>
      <div class="learn-illus-cap">By tool: the shapes are on a grid, and the rules are checked before the mask exists.</div>
    </div>
    <p>The same two shapes placed by software abut on a grid, and a <b>design rule check</b> reads the
    finished artwork against the foundry's own list of legal widths and spacings before anything is
    printed. The mistake above is not caught later. It is not available to make.</p>
  </div>
</div>
` },

    { html: String.raw`
<div class="learn-note">
  <b>The arithmetic that ends the hand-drawn era.</b> A person can draw carefully about <b>ten
  transistors a day</b>. A chip in your phone has around <b>100 billion</b>. At ten a day that is ten
  billion days of drawing, which is <b>27 million years</b> - and it would still be one blade-slip from
  a dead layer. Every tool on this page exists because of that number.
</div>
<p>What replaced the blade was not one invention but a chain of them, each automating the step above it.
That chain is what the industry means by <b>EDA</b> - electronic design automation - and a modern chip
goes down all of it.</p>
` },

    { html: String.raw`
<h2 data-sec="pipeline">The six stages a chip goes through</h2>
<p>Step through them. Three of the six are apps on this site, and each step below says which - so this
is a map of what you have already been using as much as it is a description of the industry.</p>
` },

    { widget: 'pipeline' },

    { html: String.raw`
<div class="learn-note">
  <b>Every stage hands the next one a file, and every stage can send work back.</b> Timing that does not
  close at stage 5 is not fixed at stage 5 - it goes back to placement, or to synthesis, or in the worst
  case to the RTL, and the loop runs again. A chip is not designed once in six steps; it is designed
  perhaps a hundred times in six steps, which is why every one of them had to become software.
</div>
` },

    { html: String.raw`
<h2 data-sec="synthesis">What logic synthesis actually does</h2>
<p>Stage 3 is the one that changed what a designer's job <em>is</em>, so it is worth doing rather than
describing. Here is a two-to-one multiplexer written as behaviour - what it should do, with no gates in
it at all:</p>
<pre class="learn-code">assign y = sel ? b : a;</pre>
<p>A synthesizer reads that, works out the Boolean function, and picks cells out of a foundry's library
to build it - balancing speed, power and area as it goes. Nobody chose the cells. Nobody drew a
transistor.</p>
<p><b>You can watch this site do it.</b> That line is the whole design on
<a href="learn-mux-2to1.html">2:1 Multiplexer</a>: press <b>Synthesize</b> there and it comes out as
<b>one cell</b>, a <code>mux2_gate</code>, because the library has a multiplexer ready and the tool
would rather use it. Write the same function the long way - <code>(a &amp; ~sel) | (b &amp; sel)</code> -
and the same tool gives you <b>four</b>: an inverter, two ANDs and an OR. Both are correct. Placed and
routed, the one cell is <b>41.6 &micro;m</b> wide against the four gates' <b>93.6</b>.</p>
<div class="learn-note">
  <b>That is the whole argument for synthesis, in one measurement.</b> Two spellings of one function,
  differing by more than a factor of two in area, and the choice between them is not interesting to a
  human - it is a lookup against a library that changes with every process. Which is exactly the kind of
  decision worth handing to software, and exactly the kind a person drawing shapes on film could never
  revisit.
</div>
<p>And it goes further than picking cells. Try <a href="learn-adder-8bit.html">8-Bit Adder</a>, where
one line - <code>assign {cout, sum} = a + b;</code> - becomes a chain of full adders the author never
wrote down.</p>
` },

    { html: String.raw`
<h2 data-sec="eras">Sixty years of tools, and what each one unlocked</h2>
<p>Each generation of tools made the next size of chip possible, and then that size of chip made the
next generation of tools necessary. Read the middle column down the page: it is the
<a href="learn-integrated-circuits.html">transistor count</a> from the last topic, seen from the
designer's side.</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">decade</th><th class="sep"></th><th>transistors on a chip</th><th>what a designer was drawing</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">1960s-70s</td><td class="sep"></td><td>1,000 to 10,000</td><td>polygons, one layer at a time</td></tr>
      <tr><td class="in">1980s</td><td class="sep"></td><td>100,000 to 1 million</td><td>gates, then behaviour in a new kind of language</td></tr>
      <tr><td class="in">1990s</td><td class="sep"></td><td>1 million to 50 million</td><td>modules, with the wiring left to the tool</td></tr>
      <tr><td class="in">2000s-2010s</td><td class="sep"></td><td>100 million to 10 billion</td><td>whole subsystems, mostly bought in</td></tr>
      <tr><td class="in">2020s</td><td class="sep"></td><td>100 billion on one die, more once several are stacked</td><td>constraints, and which tool to point at them</td></tr>
    </tbody>
  </table>
</div>
` },

    { widget: 'eras' },

    { html: String.raw`
<div class="learn-note">
  <b>The 1980s row is the one that made the industry we have.</b> Carver Mead and Lynn Conway wrote down
  a set of scalable design rules - lambda rules, the same kind the placement figures on this site are
  drawn in - and published them in a textbook in 1980. It meant a designer no longer had to know which
  factory would build the chip: describe the logic against the rules, and any foundry that met them
  could make it. Companies that design chips without owning a fab exist because of that separation, and
  so does every foundry that builds other people's designs.
</div>
` },

    { html: String.raw`
<h2 data-sec="future">What the tools are doing now</h2>
<h3>1. The floorplan is searched, not drawn</h3>
<p>Deciding where the big blocks of a chip go used to take a team of people months, and the answer was
judged by how the wire lengths came out. It is a search problem with an enormous space and a clear
score, which is the shape of problem machine learning is good at: a
<b>reinforcement-learning</b> floorplanner treats each placement as a move and each score as a reward,
and explores far more arrangements than a team could. Google published results of this kind in 2021;
<b>Synopsys DSO.ai</b> and <b>Cadence Cerebrus</b> are the products you can buy. The tools do not
replace the engineer - somebody still says what a good chip is - but nobody is placing blocks by hand at
the top level any more.</p>
<h3>2. There is more than one die, so the tools have to see all of them</h3>
<p>Once a part is several <b>chiplets</b> on an interposer, or dies stacked on top of one another, the
questions stop being answerable one die at a time: heat from the bottom die comes out through the top
one, power has to be delivered through the stack, and a signal crossing between them is neither an
on-chip wire nor a board trace. So the tools model the package and the silicon together, which is a
different program from the one that laid out a single die.</p>
<h3>3. The chip is run before it is built</h3>
<p>A modern design is emulated before any silicon is made - on racks of FPGAs, or on purpose-built
emulators, fast enough to boot a real operating system on a virtual chip. Finding a bug there costs
weeks; finding it after tapeout costs a new set of masks and several million dollars, which is why this
stage keeps growing.</p>
<div class="learn-note">
  <b>The pattern has not changed once in sixty years.</b> Each of these tools automates the step that
  had become the bottleneck, and the reward is always the same: the design gets bigger until the next
  step is the bottleneck. Rubylith gave way to a digitiser, drawing gates gave way to synthesis,
  routing by hand gave way to a router, and choosing a floorplan is giving way to a search. Whatever is
  hand-done and slow in 2026 is what the 2030s will automate.
</div>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>This page is a description of four apps you can open. <a href="simulator.html">Simulator</a> is stage
2: write RTL, run a testbench, read the waveform. <a href="synthesis.html">Synthesizer</a> is stage 3,
and it will show you its netlist and its cell count for anything you give it.
<a href="pnr.html">Place &amp; Route</a> is stage 4, and it now goes one step past it - press
<b>Fabrication</b> and it cuts the placement open into the mask layers the foundry actually prints.
<a href="compiler.html">Compiler</a> is the software side of the same story: the same argument as
synthesis, one level up, where nobody writes machine code by hand either.</p>
<p>And <a href="learn-logic-gates.html">Logic Gates</a> is the whole flow at its smallest possible
scale - one gate, from a line of Verilog to a cross section through its transistors, in a single page.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Five questions on sixty years of tools. A wrong answer says so and links back to the section it came
from; the score at the foot of the panel is what the Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* THE TWO STEPPERS, as data: `steps`, each with a title, a drawing, labelled fields and a body.
     learn.js owns the stepping, so there is no behaviour in this file.

     `pipeline` is the source's six TABS and `eras` is its era SLIDER - two controls in the original, one
     control here, because underneath they were both a walk along a fixed list. `eras` declares `ends`
     and `pipeline` does not, which is the distinction learn.js's `ends` exists for: a decade range has
     two ends worth printing under the bar, and a sequence of stages is a list rather than an axis.

     NO NUMBER IN THE `eras` STEPS APPEARS IN THE TABLE ABOVE IT. Its fields are the tool and the thing
     the tool replaced; the counts are the table's. */
  widgets: {

    /* ONE STAGE AT A TIME, in the order a real chip goes down them, and each step names the app on this
       site that does that stage where there is one - which is the reason this topic is worth having
       here rather than as a link to the article it came from. */
    'pipeline': {
      label: 'stage of the flow',
      steps: [
        {
          title: 'Stage 1: Architecture and specification',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A block labelled system architecture over three smaller labelled boxes">'
             + '<rect x="18" y="14" width="184" height="76" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<text x="110" y="36" font-size="11" font-weight="600" text-anchor="middle" style="fill: var(--accent-fg)">system architecture</text>'
             + '<g fill="currentColor" opacity="0.45">'
             + '<rect x="34" y="50" width="44" height="24" rx="3"/>'
             + '<rect x="88" y="50" width="44" height="24" rx="3"/>'
             + '<rect x="142" y="50" width="44" height="24" rx="3"/></g>'
             + '<g font-size="8" fill="currentColor" text-anchor="middle" opacity="0.85">'
             + '<text x="56" y="66">cores</text><text x="110" y="66">cache</text><text x="164" y="66">power</text></g>'
             + '</svg>',
          facts: [
            { label: 'Tools', value: 'System-level models in SystemC, Python or MATLAB' },
            { label: 'Deliverable', value: 'A specification, and performance models to argue about' }
          ],
          body: 'How many cores. How big the cache. What the power budget is. Nothing here is a circuit '
              + 'yet - these are simulations of a machine that does not exist, run to find out whether '
              + 'the machine is worth building. Getting it wrong is the most expensive mistake available, '
              + 'because every later stage is faithful to whatever this one decided.'
              + '<div class="learn-widget-facts">No app here - the decisions on this site were made for you.</div>'
        },
        {
          title: 'Stage 2: RTL coding and simulation',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="Two digital waveforms inside a panel">'
             + '<rect x="14" y="14" width="192" height="76" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<path d="M28 44 H56 V30 H84 V44 H112 V30 H140 V44 H168 V30 H196" fill="none" style="stroke: var(--accent-fg)" stroke-width="1.8"/>'
             + '<path d="M28 74 H70 V60 H126 V74 H196" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.7"/>'
             + '<text x="110" y="86" font-size="8" fill="currentColor" text-anchor="middle" opacity="0.7">clk, and a signal it clocks</text>'
             + '</svg>',
          facts: [
            { label: 'Tools', value: 'Verilog, SystemVerilog or VHDL, and a logic simulator' },
            { label: 'Deliverable', value: 'RTL source, and waveforms showing it does what was asked' }
          ],
          body: 'A designer writes what the hardware should <em>do</em> - registers and the logic between '
              + 'them, which is what RTL means - and a verification engineer writes testbenches that try '
              + 'to prove it wrong. On a large chip there are more people writing the tests than writing '
              + 'the design, and billions of simulated cycles behind a release.'
              + '<div class="learn-widget-facts">This is the <a href="simulator.html">Simulator</a>, and every practice exercise on this site.</div>'
        },
        {
          title: 'Stage 3: Logic synthesis',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="Three gate shapes wired together inside a panel">'
             + '<rect x="14" y="14" width="192" height="76" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<g fill="currentColor" opacity="0.5">'
             + '<path d="M38 28 H58 Q76 38 58 48 H38 Z"/>'
             + '<path d="M38 58 H58 Q76 68 58 78 H38 Z"/></g>'
             + '<path d="M112 40 H132 Q152 53 132 66 H112 Z" style="fill: var(--accent-fg)" opacity="0.75"/>'
             + '<g stroke="currentColor" stroke-width="1.4" opacity="0.7" fill="none">'
             + '<path d="M74 38 H112"/><path d="M74 68 H94 V60 H112"/><path d="M148 53 H186"/></g>'
             + '</svg>',
          facts: [
            { label: 'Tools', value: 'Synopsys Design Compiler, Cadence Genus' },
            { label: 'Deliverable', value: 'A gate-level netlist, against one foundry’s cell library' }
          ],
          body: 'The compiler of hardware. It reads the RTL, works out the logic, and builds it from the '
              + 'cells a particular foundry offers - balancing performance, power and area, the three '
              + 'things that are always in tension. The same source targeted at a different library comes '
              + 'out as a different netlist, which is the point of keeping the two apart.'
              + '<div class="learn-widget-facts">This is the <a href="synthesis.html">Synthesizer</a>, and the netlist card on most topics here.</div>'
        },
        {
          title: 'Stage 4: Place and route',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="Placed blocks in two rows with wires between them">'
             + '<rect x="14" y="14" width="192" height="76" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<g fill="currentColor" opacity="0.45">'
             + '<rect x="30" y="26" width="40" height="22"/><rect x="86" y="26" width="40" height="22"/>'
             + '<rect x="142" y="26" width="40" height="22"/>'
             + '<rect x="56" y="60" width="40" height="22"/><rect x="118" y="60" width="40" height="22"/></g>'
             + '<g fill="none" style="stroke: var(--accent-fg)" stroke-width="1.6">'
             + '<path d="M50 48 V54 H76 V60"/><path d="M106 48 V54 H138 V60"/></g>'
             + '</svg>',
          facts: [
            { label: 'Tools', value: 'Cadence Innovus, Synopsys ICC2' },
            { label: 'Deliverable', value: 'A physical layout, wired across a dozen or more metal layers' }
          ],
          body: 'The netlist is a list of cells and the wires between them, with no positions in it. This '
              + 'stage puts every cell somewhere on the silicon and then finds a path for every wire, '
              + 'through the stack of metal layers, without two of them touching. It is the stage where a '
              + 'design stops being logic and starts being a shape.'
              + '<div class="learn-widget-facts">This is <a href="pnr.html">Place &amp; Route</a>, and the placement figures on the topic pages.</div>'
        },
        {
          title: 'Stage 5: Timing, power and physical signoff',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A panel showing a passing check and a timing slack figure">'
             + '<rect x="14" y="14" width="192" height="76" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<circle cx="56" cy="46" r="15" fill="none" style="stroke: var(--success-fg)" stroke-width="1.6"/>'
             + '<path d="M49 46 L55 52 L64 40" fill="none" style="stroke: var(--success-fg)" stroke-width="2"/>'
             + '<text x="86" y="42" font-size="10" font-weight="600" fill="currentColor">rules clean</text>'
             + '<text x="86" y="58" font-size="9" fill="currentColor" opacity="0.7">slack +52 ps</text>'
             + '<text x="110" y="80" font-size="8" fill="currentColor" text-anchor="middle" opacity="0.7">at every corner, hot and cold</text>'
             + '</svg>',
          facts: [
            { label: 'Tools', value: 'Synopsys PrimeTime, Siemens Calibre' },
            { label: 'Deliverable', value: 'Timing closed, zero rule violations, layout matching schematic' }
          ],
          body: 'Three separate questions, all of which have to be answered yes. <b>Static timing '
              + 'analysis</b> asks whether every signal arrives before the clock edge that samples it - at '
              + 'every temperature the part is rated for, from well below freezing to 125 degrees. '
              + '<b>Design rule checking</b> asks whether the polygons obey the foundry’s widths and '
              + 'spacings. <b>Layout versus schematic</b> asks whether the shapes still are the netlist '
              + 'they came from.'
              + '<div class="learn-widget-facts">The nearest thing here is the design rule spacing the placement engine keeps by construction.</div>'
        },
        {
          title: 'Stage 6: Tapeout',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A wafer with a grid of dies on it">'
             + '<circle cx="110" cy="52" r="40" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<g stroke="currentColor" stroke-width="1" opacity="0.45">'
             + '<path d="M84 18 V86 M110 14 V90 M136 18 V86"/>'
             + '<path d="M74 38 H146 M70 52 H150 M74 66 H146"/></g>'
             + '<path d="M96 88 L124 88" style="stroke: var(--accent-fg)" stroke-width="1.6"/>'
             + '<text x="110" y="100" font-size="8" fill="currentColor" text-anchor="middle" opacity="0.7">one wafer, hundreds of dies</text>'
             + '</svg>',
          facts: [
            { label: 'Tools', value: 'GDSII or OASIS export to a foundry' },
            { label: 'Deliverable', value: 'One file of polygons, and the photomasks written from it' }
          ],
          body: 'The layout leaves as a single file of geometry - GDSII, or its newer replacement OASIS - '
              + 'which for a large chip runs to hundreds of gigabytes of polygons. The foundry writes '
              + 'quartz photomasks from it with electron beams and starts printing wafers. The name is '
              + 'literal: the file used to go out on magnetic tape.'
              + '<div class="learn-widget-facts">After this the design is unchangeable, which is why stage 5 exists.</div>'
        }
      ]
    },

    /* ONE DECADE AT A TIME, and what changes down the list is the TOOL - the numbers are in the table
       above, and putting them here as well is how the two would come to disagree. */
    'eras': {
      label: 'era of the tools',
      ends: ['1960s', '2020s'],
      steps: [
        {
          title: '1960s-70s: the drafting table, the digitiser and SPICE',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A terminal displaying a SPICE model listing">'
             + '<rect x="26" y="16" width="168" height="62" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<rect x="36" y="26" width="148" height="42" fill="currentColor" opacity="0.12"/>'
             + '<text x="110" y="52" font-size="11" font-family="ui-monospace, monospace" text-anchor="middle" style="fill: var(--accent-fg)">.MODEL npn</text>'
             + '<rect x="86" y="78" width="48" height="8" fill="currentColor" opacity="0.4"/>'
             + '</svg>',
          facts: [
            { label: 'Landmark', value: 'SPICE at Berkeley, 1973; Calma digitisers and the GDS format' },
            { label: 'What it replaced', value: 'The razor blade, and building a breadboard to find a voltage' }
          ],
          body: 'Two things arrived that had nothing to do with each other. A <b>digitiser</b> let a '
              + 'technician trace a drawing into a computer instead of cutting it, so the artwork became '
              + 'data and a plotter drew the masks. And <b>SPICE</b> let a circuit be simulated: you could '
              + 'ask what a voltage would do before building anything. Neither designed a chip for you. '
              + 'Both removed a reason to be wrong.'
        },
        {
          title: '1980s: hardware description languages, and synthesis',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="Verilog text above an arrow pointing down to a gate netlist">'
             + '<rect x="22" y="14" width="176" height="76" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<text x="110" y="36" font-size="10" font-family="ui-monospace, monospace" text-anchor="middle" style="fill: var(--accent-fg)">assign y = a &amp; b;</text>'
             + '<path d="M110 44 V58 M104 52 L110 58 L116 52" fill="none" stroke="currentColor" stroke-width="1.6"/>'
             + '<g fill="currentColor" opacity="0.5">'
             + '<path d="M84 66 H100 Q114 74 100 82 H84 Z"/>'
             + '<path d="M120 66 H136 Q150 74 136 82 H120 Z"/></g>'
             + '</svg>',
          facts: [
            { label: 'Landmark', value: 'Verilog in 1984, VHDL standardised in 1987, Design Compiler in 1987' },
            { label: 'What it replaced', value: 'Choosing and drawing every gate yourself' }
          ],
          body: 'The change of job. Instead of drawing gates, a designer wrote what the logic should do in '
              + 'a language - <b>Verilog</b> or <b>VHDL</b> - and a <b>synthesis</b> tool worked out the '
              + 'gates. Design became a form of programming, which is why the front half of this site is '
              + 'an editor and a simulator rather than a drawing surface. It also decoupled the two '
              + 'halves: the same source could be built by any foundry whose library you targeted.'
        },
        {
          title: '1990s: automatic place and route, and static timing',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="Three routing tracks with a clock tree branching to two points">'
             + '<rect x="22" y="14" width="176" height="76" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<g stroke="currentColor" stroke-width="1.5" opacity="0.55">'
             + '<path d="M36 32 H184"/><path d="M36 52 H184"/><path d="M36 72 H184"/></g>'
             + '<g fill="none" style="stroke: var(--accent-fg)" stroke-width="1.6">'
             + '<path d="M110 84 V62 M74 62 H146 M74 62 V52 M146 62 V52"/></g>'
             + '<circle cx="74" cy="52" r="3" style="fill: var(--accent-fg)"/>'
             + '<circle cx="146" cy="52" r="3" style="fill: var(--accent-fg)"/>'
             + '</svg>',
          facts: [
            { label: 'Landmark', value: 'Automatic routers, clock tree synthesis, and PrimeTime in the later 1990s' },
            { label: 'What it replaced', value: 'Routing metal by hand, and adding delays up on paper' }
          ],
          body: 'Millions of gates cannot be wired by a person, so the router became the tool that did it. '
              + 'Two harder problems came with the clock rate: getting one clock edge to arrive '
              + 'everywhere at once, which is <b>clock tree synthesis</b>, and proving that every path in '
              + 'the design meets its deadline without simulating it, which is <b>static timing '
              + 'analysis</b>. Timing stopped being something you measured and became something you '
              + 'proved.'
        },
        {
          title: '2000s-2010s: systems on a chip, bought-in blocks, emulation',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A die holding two labelled blocks over a shared bus">'
             + '<rect x="22" y="14" width="176" height="76" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>'
             + '<g fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.7">'
             + '<rect x="36" y="26" width="60" height="28" rx="3"/>'
             + '<rect x="124" y="26" width="60" height="28" rx="3"/></g>'
             + '<g font-size="9" fill="currentColor" text-anchor="middle" opacity="0.85">'
             + '<text x="66" y="44">CPU</text><text x="154" y="44">GPU</text></g>'
             + '<rect x="36" y="66" width="148" height="12" rx="3" style="fill: var(--accent-fg)" opacity="0.55"/>'
             + '<text x="110" y="75" font-size="8" text-anchor="middle" style="fill: var(--fg-on-emphasis)">shared bus</text>'
             + '</svg>',
          facts: [
            { label: 'Landmark', value: 'Licensed IP blocks, and hardware emulators big enough to boot an OS' },
            { label: 'What it replaced', value: 'Designing every part of a system yourself' }
          ],
          body: 'A phone needs a processor, a graphics unit, a radio, a camera pipeline and an audio path '
              + 'on one die, and no company designs all of that from scratch. So blocks became products: '
              + 'you license a core, and the tools have to integrate somebody else’s design with '
              + 'yours and verify the result. Emulators grew to match - racks of hardware running the '
              + 'unbuilt chip fast enough to boot an operating system on it.'
        },
        {
          title: '2020s: searched floorplans, and more than one die',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="Two stacked dies beside a dashed circle labelled search">'
             + '<g fill="none" stroke="currentColor" stroke-width="1.5">'
             + '<rect x="24" y="52" width="80" height="26" rx="3"/>'
             + '<rect x="38" y="30" width="52" height="22" rx="3"/></g>'
             + '<g stroke="currentColor" stroke-width="1" opacity="0.5">'
             + '<path d="M48 52 V44 M64 52 V44 M80 52 V44"/></g>'
             + '<circle cx="162" cy="52" r="24" fill="none" style="stroke: var(--accent-fg)" stroke-width="1.6" stroke-dasharray="4 3"/>'
             + '<text x="162" y="56" font-size="9" text-anchor="middle" style="fill: var(--accent-fg)">search</text>'
             + '<text x="110" y="94" font-size="8" fill="currentColor" text-anchor="middle" opacity="0.7">a stack to co-design, and a space to explore</text>'
             + '</svg>',
          facts: [
            { label: 'Landmark', value: 'Reinforcement-learning floorplanning; Synopsys DSO.ai, Cadence Cerebrus' },
            { label: 'What it replaced', value: 'A team deciding by hand where the big blocks go' }
          ],
          body: 'Placement at the top level is a search with a score, so it is being handed to machines '
              + 'that search. And a part is no longer one die: <b>chiplets</b> side by side or stacked on '
              + 'top of each other mean the tools have to solve heat, power delivery and cross-die signals '
              + 'for the whole package at once. Both changes are the same change the previous four rows '
              + 'made - the bottleneck moved, so the software moved to it.'
        }
      ]
    }
  },

  /* The source article's own five questions, one per marked section, with `sec` tying each to the
     heading it came from.

     THE QUESTIONS ARE ITS; THE DISTRACTORS ARE NOT. Every wrong option in the original was a joke - a
     cooling liquid for vacuum tubes, mining cryptocurrency during compiles, checking the spelling in the
     documentation - and a reader who can eliminate three answers without knowing anything has not been
     asked a question. Each wrong option here is something a person could believe after reading the page
     quickly, and several are the RIGHT answer to a different question on it: photoresist for Rubylith,
     equivalence checking and static timing for DRC, SPICE and the digitiser for Mead-Conway. That is
     what makes the link back to the section worth following. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'razor',
          q: 'What was Rubylith?',
          options: [
            'A red plastic film, hand-cut with a blade, that a photomask was made from',
            'The light-sensitive coating a wafer is spun with before it is exposed',
            'An early plotting language that drove the drafting machines'
          ],
          answer: 0
        },
        {
          sec: 'pipeline',
          q: 'What does design rule checking verify?',
          options: [
            'That the finished polygons obey the foundry’s own width and spacing rules',
            'That the netlist still matches the RTL it was synthesized from',
            'That every signal arrives before the clock edge that samples it'
          ],
          answer: 0
        },
        {
          sec: 'synthesis',
          q: 'What is a logic synthesizer choosing between?',
          options: [
            'Cells from a foundry’s library, traded off for speed, power and area',
            'The shortest way to write the design in Verilog',
            'Which of the design’s modules are worth simulating'
          ],
          answer: 0
        },
        {
          sec: 'eras',
          q: 'What did Mead and Conway’s scalable design rules make possible?',
          options: [
            'Designing a chip without knowing which factory would build it',
            'Simulating a circuit’s voltages instead of breadboarding it',
            'Cutting mask artwork by machine instead of by hand'
          ],
          answer: 0
        },
        {
          sec: 'future',
          q: 'What are reinforcement-learning tools being used for in EDA today?',
          options: [
            'Searching far more floorplans and routes than a team could evaluate by hand',
            'Writing the architectural specification a chip is designed against',
            'Replacing the timing and rule signoff a foundry requires before tapeout'
          ],
          answer: 0
        }
      ]
    }
  }
};
