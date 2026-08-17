/* Topic content for the 'integrated-circuits' learn page - the history one, and the only topic here
 * with no design to run.
 *
 * IT IS AN INTEGRATION OF AN OUTSIDE ARTICLE, `evolution_of_integrated_circuits.html`, and what was
 * kept is its CONTENT: the narrative, every number in it, and its five quiz questions. What was
 * dropped is its presentation, all of it - that file is a standalone page with its own token set,
 * gradient headings, glow borders and ~600 lines of CSS, none of which this site would survive
 * adopting. The rule this repo already follows for an OmniGraffle export applies to a whole page just
 * as well: take the shapes, not the colours. So every paragraph here is `.learn-prose`, every aside is
 * `.learn-note`, both tables are the site's own `.truth-table`, and the two drawings are `.learn-illus`
 * panels painted from tokens - which is why this page is legible in both colour modes and that one is
 * not.
 *
 * ITS THREE INTERACTIVE WIDGETS ARE HERE AS WIDGETS, and they cost learn.js one block kind: `{widget}`
 * plus `topic.widgets[name]`, which is DATA exactly as `figures` and `quizzes` are - a list of steps,
 * no functions. All three of the source's controls were the same thing underneath (an era scrubber, a
 * year slider, a scale explorer: a walk along a fixed list), so one stepper serves all three, and its
 * controls are the layout player's own - `.learn-fig-ctl`, two `.layout-btn`s, a `.learn-anim-step`
 * counter, a segmented `.learn-prog`. That is what "keep the consistent look" means here: a reader who
 * has stepped a cross section already knows how to drive these, and nothing new had to be styled except
 * the frame.
 *
 * THE TABLE AND THE STEPPER SAY DIFFERENT THINGS, deliberately, because saying the same thing twice on
 * one page is how two copies drift. The eras TABLE carries the numbers - six rows of transistor counts
 * and feature sizes, which is a comparison and belongs in one glance - and the eras WIDGET carries what
 * a table cannot: the package of the era, drawn, and the part that defined it. No count appears in
 * both. Moore's law went the other way: its three-row table was deleted, because the widget's
 * predicted-against-shipped is the same data with the point still in it.
 *
 * NO SLOTS, NO FIGURES, NO PLACEMENT. `slots: []` is a real answer (see the manifest note): learn.js
 * removes every card and hides the app's grid, and the article is the page. There is no Verilog here
 * because there is nothing to simulate - the subject is sixty years of manufacturing, not a circuit -
 * and a `{figure}` block is the netlist viewer's own symbols, which would be the wrong language for a
 * DIP package or a stack of dies. So the drawings are hand-written SVG in a `.learn-illus`, the same
 * way `lego-logic` draws its bricks - two standalone ones, and one per step inside the widgets.
 *
 * WHERE IT SITS is after `logic-gates` and before the combinational run, and that is deliberate: the
 * history lands only once a reader knows what a gate is. The whole third section is then a set of
 * pointers INTO this site - the 7400's NAND is the cell `logic-gates` opens up, the 74181 is
 * `alu-4bit`, the 4004 is what `cpu-16bit` and the compiler build - which is what makes this a topic
 * here rather than an article that happens to be hosted here.
 *
 * ONE CLAIM OF THE SOURCE IS CORRECTED rather than repeated: it treats a "2 nm" node as a 2 nm
 * measurement and multiplies it out against a human hair. Node names have not been feature sizes for
 * about a decade, so the arithmetic is kept (it is the source's, and it is right about the ratio) with
 * a note saying what the label actually is. Getting that wrong is how a reader ends up believing a
 * transistor is ten silicon atoms wide.
 *
 * AND ONE FACT IS FIXED WITHOUT COMMENT ON THE PAGE: the source has Apollo buying "dual-NAND" chips.
 * The guidance computer was built from dual three-input NOR gates - one gate type, one part number,
 * about 2,800 of them - which is a better story than the source's anyway, since using a single
 * function for an entire flight computer is what an SSI budget forced. The 7400 quad NAND stays in the
 * table as what it is, an SSI part, rather than as what flew.
 *
 * EVERY DRAWING IS TOKENS OR `currentColor`, checked: the article's markup contains no colour literal
 * at all, so both illustrations follow the reader's colour mode. Verified in a browser - the "gold
 * wires" group computes to #d29922, which is --attention-fg.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['integrated-circuits'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="tyranny">The tyranny of numbers</h2>
<p>Everything on this site is a few gates at a time: a half adder is two cells, an eight-bit adder is
forty, and the placement figures draw them as a row you could count with a finger. For the first
fifteen years of computing that was not a teaching simplification. It was the ceiling.</p>
<p>A machine was built by <b>soldering every part in by hand</b> - each transistor, each resistor, each
capacitor, each wire between them. Making a computer more capable meant more parts and more joints, and
every joint is a chance to be wrong. Engineers had a name for the wall this put in front of them: the
<b>tyranny of numbers</b>. Past a certain size the probability that <em>something</em> in the machine
was broken approached one, and it stayed there.</p>
<div class="learn-note">
  <b>ENIAC, 1945.</b> 18,000 vacuum tubes, 30 tons, 150 kW - about what 150 electric kettles draw - and
  tubes burning out every few hours. It was not badly built. It was as big as a hand-wired machine can
  get before it spends its life being repaired.
</div>
<p>So the problem was never "can we design something bigger". It was that a design nobody could
<em>assemble reliably</em> is not a design. What was needed was a way to make the parts and the wires
between them <b>at the same time, in one piece</b>.</p>
` },

    { html: String.raw`
<h2 data-sec="breakthrough">Two inventions, eighteen months apart</h2>
<p>Two people solved it independently, in different materials, and both answers are in every chip
today.</p>
` },

    { html: String.raw`
<div class="learn-split">
  <div>
    <div class="learn-illus">
      <svg width="230" height="130" viewBox="0 0 230 130" aria-label="A slab of germanium with three components joined by arcing gold wires">
        <rect x="18" y="66" width="194" height="34" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
        <text x="115" y="88" font-size="11" fill="currentColor" text-anchor="middle" opacity="0.75">one piece of germanium</text>
        <g fill="currentColor">
          <rect x="42" y="52" width="26" height="14"/>
          <rect x="102" y="52" width="26" height="14"/>
          <rect x="162" y="52" width="26" height="14"/>
        </g>
        <g fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--attention-fg)">
          <path d="M 55 52 C 60 22 100 22 115 52"/>
          <path d="M 115 52 C 130 22 170 22 175 52"/>
        </g>
        <text x="115" y="18" font-size="11" text-anchor="middle" style="fill: var(--attention-fg)">gold flying wires</text>
      </svg>
      <div class="learn-illus-cap">Kilby, 1958: every part cut from one crystal, joined by hand.</div>
    </div>
    <p><b>Jack Kilby, Texas Instruments.</b> Over the summer of 1958, with the lab half empty on
    holiday, Kilby built the first working integrated circuit: a transistor, a capacitor and a resistor
    all made out of <b>a single piece of germanium</b>, wired together with tiny gold wires arcing over
    the top. The parts were no longer separate objects to be assembled. The wires still were.</p>
  </div>
  <div>
    <div class="learn-illus">
      <svg width="230" height="130" viewBox="0 0 230 130" aria-label="A silicon slab with an oxide layer and straight printed metal lines">
        <rect x="18" y="66" width="194" height="34" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
        <text x="115" y="88" font-size="11" fill="currentColor" text-anchor="middle" opacity="0.75">silicon</text>
        <rect x="18" y="52" width="194" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4,3"/>
        <text x="115" y="44" font-size="10" fill="currentColor" text-anchor="middle" opacity="0.75">insulating oxide</text>
        <g stroke-width="3" style="stroke: var(--accent-fg)">
          <path d="M 34 30 H 196"/>
          <path d="M 34 30 V 52"/>
          <path d="M 110 30 V 52"/>
          <path d="M 196 30 V 52"/>
        </g>
        <text x="115" y="20" font-size="11" text-anchor="middle" style="fill: var(--accent-fg)">printed aluminium</text>
      </svg>
      <div class="learn-illus-cap">Noyce, 1959: the wires are printed with the parts.</div>
    </div>
    <p><b>Robert Noyce, Fairchild.</b> A year and a half later Noyce built the <b>monolithic planar</b>
    circuit in <b>silicon</b>: silicon grows a clean insulating oxide, so the connections could be
    <em>printed</em> as flat aluminium lines straight onto that oxide. No wires to attach. And a flat
    surface is something you can pattern with light - which is what made the whole thing
    <b>manufacturable</b> rather than merely possible.</p>
  </div>
</div>
` },

    { html: String.raw`
<div class="learn-note">
  <b>Both halves survive, and you have already used them.</b> Kilby's idea is that the components come
  out of one piece of material; Noyce's is that the wiring is patterned on top of it in layers. That is
  exactly what the layout figures on this site are made of - diffusions in the silicon, and metal
  printed above them on contacts. <a href="learn-logic-gates.html">Logic Gates</a> takes one cell apart
  layer by layer, and every one of those layers is a step in Noyce's process.
</div>
` },

    { html: String.raw`
<h2 data-sec="eras">Six eras, and what each one could hold</h2>
<p>The industry names its eras by how much fits on one chip. The names are unglamorous - small,
medium, large, very large - and they each cover roughly a decade. Read the transistor column down the
page: that is the whole story of computing in one column of numbers.</p>
` },

    { widget: 'eras' },

    { html: String.raw`
<div class="learn-note">
  <b>NASA bought the first era outright.</b> The Apollo guidance computer was built from thousands of
  identical three-input NOR chips - almost the only logic on board - because an integrated circuit was
  the only way to make a computer light enough to fly. For a while the space programme was buying a
  large share of the world's entire IC production, which is what paid for the factories that made
  everything after it cheap.
</div>
` },

    { html: String.raw`
<h2 data-sec="moore">Moore's law, and how small small is</h2>
<p>In 1965 Gordon Moore counted the parts on the chips his industry had made over four years, and
noticed something: the number was <b>doubling about every two years</b>. He said so in a magazine
article, and guessed it would keep going.</p>
<p>It is not a law of physics. Nothing makes it happen. What happened instead is that everyone who
built chips read it, treated it as the schedule they had to meet, and organised their factories around
meeting it - which is how a guess about the past became a plan for the next fifty years.</p>
<div class="learn-note">
  <b>Two numbers to know before the stepper below.</b> <b>Transistors per chip</b> is how many switches
  are on it. <b>Smallest features</b> is how small a thing the factory can print - it used to be called
  the <em>process node</em>, and smaller features are what let more switches fit in the same space.
  Micrometres (&micro;m) are thousandths of a millimetre; nanometres (nm) are thousandths of THAT.
</div>
<p>Doubling every two years for fifty years multiplies by about 30 million. Step along the years
below. Each one shows what the doubling <b>predicts</b>, how small the features were, and <b>a real chip
from about that year</b> - so you can see for yourself where the prediction was right and where it was
not:</p>
` },

    { widget: 'moore' },

    { html: String.raw`
<p>In 1971 you could see the transistors of a 4004 through a school microscope. You cannot see a modern
one with light at all - it is far smaller than the wavelength you would have to look with, which is
also why the machines that pattern them use extreme ultraviolet.</p>
<p><b>A human hair is about 80,000 nm across.</b> Against a 2 nm figure that is a ratio of 40,000: a
line of them, side by side, to cross one hair. And a silicon atom is about 0.2 nm, so that figure is
around ten atoms - which is the clue that the number is not what it sounds like.</p>
<p>That ratio is easier to believe from the other end. Walk down from something you can see to
something you cannot:</p>
` },

    { widget: 'scale' },

    { html: String.raw`
<div class="learn-note">
  <b>"2 nm" is a name, not a measurement.</b> Node labels stopped being feature sizes years ago; a
  modern "2 nm" process has nothing on it that measures two nanometres. The label means a generation -
  denser and faster than the one before - and the ratios above are honest as ratios while being wrong
  as physical widths. The real limit is unmoved by naming: at these sizes a gate is a few dozen atoms
  thick, and electrons start going where they are not supposed to.
</div>
<div class="learn-note">
  <b>The cells on this site are 1980s geometry, and on purpose.</b> The placement engine works in
  lambda at 0.65 &micro;m, which puts an AND cell at about 26 by 46.8 &micro;m - a mature process, the
  VLSI row of the table above. Everything about the layout is the same at 2 nm; only the numbers shrink,
  and a drawing you can actually read is worth more than an accurate one nobody can see.
</div>
` },

    { html: String.raw`
<h2 data-sec="modern">When flat stops working</h2>
<p>Noyce's insight was that a chip is <b>planar</b> - flat layers, patterned from above. For fifty
years the way forward was to make that flat pattern finer. Around ten nanometres that stopped being
enough, and the answers since have all been the same answer: <b>go upwards</b>.</p>
<h3>1. The transistor became three-dimensional</h3>
<p>A flat transistor controls its channel from one side, and when the channel is a few dozen atoms long
the gate loses the argument - current leaks through even when it is switched off. <b>FinFET</b> stood
the channel up as a fin so the gate could wrap three sides of it; <b>gate-all-around</b> nanosheets
wrap it completely, all the way round. The switch is the same switch this whole site is built on. It is
just no longer a plane.</p>
<h3>2. The chip became several chips</h3>
<p>A big die is a bad bet: one fatal defect anywhere on it throws away the whole thing, and defects
scale with area. So a modern part is built from <b>chiplets</b> - smaller dies, each made on whichever
process suits it, sitting on a silicon interposer or stacked on top of one another and joined by
connections short enough to behave like on-chip wires. Cache stacked directly over a core is the
everyday example.</p>
<h3>3. The board became the chip</h3>
<p>What used to be a motherboard of separate parts - processor, graphics, memory controller, radio,
security, neural accelerator - is now one package: a <b>system on a chip</b>. The design problem moved
with it. Nobody draws billions of transistors, any more than anyone wrote the netlists this site
generates by hand: you describe what the hardware should do, and tools place and route the result. That
is the loop the rest of these topics are about.</p>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p><a href="learn-logic-gates.html">Logic Gates</a> is the other end of this page: one cell, opened up
into the mask layers Noyce's process prints and a cross section through its transistors.
<a href="learn-alu-4bit.html">4-Bit ALU</a> is the MSI row built from scratch, and
<a href="learn-counter-4bit.html">4-Bit Counter</a> is the smallest machine that keeps
its own state, which is where a processor starts. The LSI row itself - a whole CPU to assemble, compile
for and single-step, at about the transistor count the 4004 shipped with in 1971 - is on the practice
site rather than here.</p>
<p>And the thing worth carrying out of the history: every era on that table needed the same two ideas.
Make the parts and their wiring together, in one piece, and let a machine do the patterning. Everything
since has been the same trick at a smaller scale.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Five questions on sixty years. A wrong answer says so and links back to the section it came from;
the score at the foot of the panel is what the Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* THE THREE WIDGETS, as data: `steps`, each with a title, a drawing and a body. learn.js owns the
     stepping (see buildWidgets), so there is no behaviour in this file - the same division `figures`
     and `quizzes` already have.

     EVERY DRAWING IS `currentColor` PLUS AT MOST ONE TOKEN, so a step follows the reader's colour mode
     like the rest of the page. The source's own SVGs were a palette of six literal hexes on a fixed
     dark background: they would have been invisible in light mode, which is the whole reason none of its
     CSS came across.

     NO NUMBER HERE APPEARS IN THE PROSE TABLE ABOVE IT. The eras table is the counts; these steps are
     the packages and the parts. */
  widgets: {

    /* ONE ERA AT A TIME, and what changes down the list is not the count - the table has that - but the
       PACKAGE: a fourteen-pin dual-in-line part you could hold, then a wider one, then a die under a lid,
       then blocks on one die, then dies stacked on each other. */
    'eras': {
      label: 'era of integration',
      steps: [
        {
          title: '1960s: The Dawn of Logic Chips - a few gates in a package you can hold',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A fourteen-pin dual-in-line package">'
             + '<g fill="currentColor" opacity="0.55">'
             + '<rect x="40" y="8" width="9" height="16"/><rect x="72" y="8" width="9" height="16"/>'
             + '<rect x="104" y="8" width="9" height="16"/><rect x="136" y="8" width="9" height="16"/>'
             + '<rect x="168" y="8" width="9" height="16"/>'
             + '<rect x="40" y="80" width="9" height="16"/><rect x="72" y="80" width="9" height="16"/>'
             + '<rect x="104" y="80" width="9" height="16"/><rect x="136" y="80" width="9" height="16"/>'
             + '<rect x="168" y="80" width="9" height="16"/></g>'
             + '<rect x="30" y="24" width="160" height="56" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<text x="110" y="50" font-size="13" font-weight="600" text-anchor="middle" style="fill: var(--accent-fg)">7400</text>'
             + '<text x="110" y="66" font-size="10" fill="currentColor" text-anchor="middle" opacity="0.7">four NAND gates</text>'
             + '</svg>',
          shots: [
            { src: 'img/7400-package.png',
              alt: 'The 7400 ackage: SN7400N in a black plastic dual-in-line package',
              credit: 'SN7400N package - Wikipedia' },
            { src: 'img/7400-pinout.png',
              alt: 'The 7400 pinout: four NAND gates between pin 1 and pin 14',
              credit: '7400 pinout - Wikipedia' },
            { src: 'img/7400-die.jpg',
              alt: 'The die inside a 7400, four identical gate cells in a square of silicon, with gold '
                 + 'bond wires running out to the package pins',
              credit: 'Die and bond wires - Wikipedia' }
          ],
          body: 'The 7400 held <b>four two-input NAND gates</b> and that was the whole part. A designer '
              + 'bought logic by the packet and wired the packets together - which is why the Apollo '
              + 'guidance computer is thousands of copies of one chip. The photograph on the right is '
              + 'what is actually inside that package: four gate cells, and gold wires out to the pins.'
              + '<div class="learn-widget-facts">A gate is the unit you buy.</div>'
        },
        {
          title: 'Late 1960s: Multi-Gate Functional Blocks - a function in a package',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A wide package labelled 74181">'
             + '<g fill="currentColor" opacity="0.55">'
             + '<rect x="26" y="8" width="8" height="16"/><rect x="52" y="8" width="8" height="16"/>'
             + '<rect x="78" y="8" width="8" height="16"/><rect x="104" y="8" width="8" height="16"/>'
             + '<rect x="130" y="8" width="8" height="16"/><rect x="156" y="8" width="8" height="16"/>'
             + '<rect x="182" y="8" width="8" height="16"/>'
             + '<rect x="26" y="80" width="8" height="16"/><rect x="52" y="80" width="8" height="16"/>'
             + '<rect x="78" y="80" width="8" height="16"/><rect x="104" y="80" width="8" height="16"/>'
             + '<rect x="130" y="80" width="8" height="16"/><rect x="156" y="80" width="8" height="16"/>'
             + '<rect x="182" y="80" width="8" height="16"/></g>'
             + '<rect x="18" y="24" width="184" height="56" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<text x="110" y="48" font-size="13" font-weight="600" text-anchor="middle" style="fill: var(--accent-fg)">74181</text>'
             + '<text x="110" y="64" font-size="10" fill="currentColor" text-anchor="middle" opacity="0.7">4-bit ALU, one chip</text>'
             + '</svg>',
          shots: [
            { src: 'img/74181-chip.jpg',
              alt: 'A 74181 in a 24-pin package, resting on a printout of its own gate-level schematic',
              credit: 'SN74LS181N - http://www.righto.com' },
            { src: 'img/74181-schematic.png',
              alt: 'The full gate-level schematic of the 74181: about seventy-five gates across four '
                 + 'bit slices, with the carry logic along the bottom',
              credit: 'Gate-level schematic - Wikipedia' },
            { src: 'img/74181-die.jpg',
              alt: 'The 74181 die photographed and annotated, with the AND gates, OR-INVERT gates, XOR '
                 + 'gates and resistors each outlined and labelled',
              credit: 'Annotated die - electronics-lab.com' }
          ],
          body: 'The 74181 was an <b>arithmetic logic unit</b> - add, subtract, sixteen logic functions, '
              + 'a mode input to pick between them - sold as a single component. It is the design '
              + '<a href="learn-alu-4bit.html">4-Bit ALU</a> builds from scratch on this site. '
              + 'The three pictures are the same chip three ways: the part, the schematic of what is '
              + 'inside it, and that same logic photographed on the silicon.'
              + '<div class="learn-widget-facts">A block is the unit you buy.</div>'
        },
        {
          title: '1970s: The First Microprocessors (LSI) - the processor becomes one part',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A package with a visible die inside it">'
             + '<rect x="34" y="16" width="152" height="72" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<rect x="72" y="34" width="76" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="stroke: var(--accent-fg)"/>'
             + '<text x="110" y="50" font-size="12" font-weight="600" text-anchor="middle" style="fill: var(--accent-fg)">4004</text>'
             + '<text x="110" y="63" font-size="9" fill="currentColor" text-anchor="middle" opacity="0.7">a whole CPU</text>'
             + '</svg>',
          shots: [
            { src: 'img/4004-package.jpg',
              alt: 'An Intel C4004 in a 16-pin ceramic package with a gold lid and gold-plated pins, '
                 + 'stamped C4004 and a date code',
              credit: 'Intel C4004 - Wikipedia' },
            { src: 'img/4004-schematic.jpg',
              alt: 'The 4004 schematic drawn by hand in blue ink on a large sheet of paper, covering the '
                 + 'whole processor',
              credit: 'Original hand-drawn schematic - intel4004.com' },
            { src: 'img/4004-die.jpg',
              alt: 'The 4004 die photographed: a dense rectangle of circuitry with sixteen bond pads '
                 + 'around the edge and 4004 written along the bottom',
              credit: 'Die photograph - computerhistory.org' }
          ],
          body: 'Intel’s 4004 put <b>an entire central processor on one die</b>. Nothing about the '
              + 'logic was new - it is the sort of netlist this site synthesizes - but a computer stopped '
              + 'being a cabinet of boards and became a component. The three pictures are the part, the '
              + 'schematic <b>drawn by hand on paper</b> because there was no software to draw it with, '
              + 'and the die those 2,300 transistors ended up on - about 12 square millimetres.'
              + '<div class="learn-widget-facts">A processor is the unit you buy.</div>'
        },
        {
          title: '1980s - 1990s: Megachips & 3D Graphics (VLSI) - the tools take over',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A die with regular blocks of logic and cache">'
             + '<rect x="30" y="12" width="160" height="80" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<rect x="42" y="24" width="60" height="26" fill="none" stroke="currentColor" stroke-width="1.2"/>'
             + '<rect x="118" y="24" width="60" height="26" fill="none" stroke="currentColor" stroke-width="1.2"/>'
             + '<rect x="42" y="58" width="136" height="22" fill="none" stroke="currentColor" stroke-width="1.2" style="stroke: var(--accent-fg)"/>'
             + '<text x="72" y="41" font-size="9" fill="currentColor" text-anchor="middle">pipeline</text>'
             + '<text x="148" y="41" font-size="9" fill="currentColor" text-anchor="middle">FPU</text>'
             + '<text x="110" y="73" font-size="9" text-anchor="middle" style="fill: var(--accent-fg)">on-chip cache</text>'
             + '</svg>',
          shots: [
            { src: 'img/486-package.jpg',
              alt: 'An Intel i486 DX in a large square ceramic package, printed A80486DX-50 and dated '
                 + '1989, with rows of gold pins along its underside',
              credit: 'Intel i486 DX - Wikipedia' },
            { src: 'img/486-architecture.png',
              alt: 'A block diagram of the 80486DX2: the ALU, register file and barrel shifter on the '
                 + 'left, an 8 KiB cache and its prefetcher in the middle, the floating-point unit below, '
                 + 'and the bus interface down the right-hand side',
              credit: '80486DX2 block diagram - Wikipedia' },
            { src: 'img/486-die.jpg',
              alt: 'The i486 die photographed: recognisable rectangular blocks of cache and datapath, '
                 + 'ringed by bond wires out to the package',
              credit: 'i486 die - Wikipedia' }
          ],
          body: 'At a million transistors nobody draws the transistors. This is the era of <b>synthesis '
              + 'and place-and-route</b> - describe the behaviour, let the tools choose the cells - which '
              + 'is exactly the loop every other topic here walks you through. Notice what the middle '
              + 'picture is: not a schematic any more but a <b>block diagram</b>. At this size the parts '
              + 'worth naming are the cache, the prefetcher and the floating-point unit, and you can see '
              + 'those same blocks as rectangles on the die beside it.'
              + '<div class="learn-widget-facts">The design flow is the product.</div>'
        },
        {
          title: '2000s - 2010s: Multi-Core & Smartphone Applicaiton Processor (SoC): the system moves onto the die (System on Chip)',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="One die holding CPU, GPU and accelerator blocks">'
             + '<rect x="26" y="12" width="168" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<rect x="38" y="24" width="46" height="30" fill="none" stroke="currentColor" stroke-width="1.2"/>'
             + '<rect x="92" y="24" width="46" height="30" fill="none" stroke="currentColor" stroke-width="1.2"/>'
             + '<rect x="146" y="24" width="36" height="30" fill="none" stroke="currentColor" stroke-width="1.2"/>'
             + '<rect x="38" y="62" width="144" height="20" fill="none" stroke="currentColor" stroke-width="1.2" style="stroke: var(--accent-fg)"/>'
             + '<text x="61" y="43" font-size="9" fill="currentColor" text-anchor="middle">CPU x4</text>'
             + '<text x="115" y="43" font-size="9" fill="currentColor" text-anchor="middle">GPU</text>'
             + '<text x="164" y="43" font-size="9" fill="currentColor" text-anchor="middle">ISP</text>'
             + '<text x="110" y="76" font-size="9" text-anchor="middle" style="fill: var(--accent-fg)">shared cache and memory</text>'
             + '</svg>',
          shots: [
            { src: 'img/a5-package.jpg',
              alt: 'The top of an Apple A5 package, laser-marked with the Apple logo, A5, and part and '
                 + 'date codes around the edges',
              credit: 'Apple A5 package - Wikipedia' },
            { src: 'img/a5-die.jpg',
              alt: 'The A5 die photographed and annotated: a box round two ARM cores in the upper left, '
                 + 'three boxes marked GPU across the bottom, and a dozen unlabelled blocks filling the '
                 + 'rest of the die',
              credit: 'Annotated A5 die - Chipworks' }
          ],
          body: 'Clock speed stopped rising around 4 GHz - the power went up faster than the '
              + 'performance - so chips got <b>wider instead of faster</b>: several cores, and beside them '
              + 'the graphics, the image processor and the radio a phone needs. The annotated die is the '
              + 'drawing on the left in real silicon: <b>two CPU cores in one corner, three GPUs along the '
              + 'bottom</b>, and everything else on the die is the rest of the phone - memory interfaces, '
              + 'image processing, audio, security. The processor is the small part.'
              + '<div class="learn-widget-facts">The board is the unit you buy.</div>'
        },
        {
          title: '2020s+: 100+ Billion Transistors & 3D Stacking - one part, several dies',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="Two dies side by side joined by a bridge on an interposer">'
             + '<rect x="18" y="70" width="184" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4,3"/>'
             + '<text x="110" y="84" font-size="9" fill="currentColor" text-anchor="middle" opacity="0.7">interposer</text>'
             + '<rect x="30" y="16" width="70" height="50" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<rect x="120" y="16" width="70" height="50" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<text x="65" y="45" font-size="10" fill="currentColor" text-anchor="middle">die A</text>'
             + '<text x="155" y="45" font-size="10" fill="currentColor" text-anchor="middle">die B</text>'
             + '<rect x="100" y="33" width="20" height="16" fill="none" stroke-width="2" style="stroke: var(--attention-fg)"/>'
             + '<text x="110" y="28" font-size="8" text-anchor="middle" style="fill: var(--attention-fg)">bridge</text>'
             + '</svg>',
          shots: [
            { src: 'img/nvidia-package.jpg',
              alt: 'A large accelerator package: one big processor die in the middle of a gold substrate '
                 + 'with stacks of memory sitting beside it, all under one lid',
              credit: 'Nvidia Blackwell - nvidia.com' },
            { src: 'img/grace-hopper.png',
              alt: 'A block diagram of the NVIDIA Grace Hopper Superchip: a Grace CPU with LPDDR5X memory '
                 + 'on one side, a Hopper GPU with HBM3 stacks on the other, and a 900 GB/s NVLink C2C '
                 + 'link joining the two',
              credit: 'Grace Hopper Superchip - nvidia.com' }
          ],
          body: 'A single big die is a bad bet - one defect anywhere throws the whole thing away - so a '
              + 'modern part is <b>several smaller dies</b>, each on whichever process suits it, joined by '
              + 'links short enough to behave like on-chip wires. The photograph is one package holding a '
              + 'processor and its memory stacks together; the diagram beside it is a CPU die and a GPU '
              + 'die in one part, with <b>900 GB/s</b> between them - which is the number that decides '
              + 'whether two dies can pretend to be one.'
              + '<div class="learn-widget-facts">The package is the unit you buy.</div>'
        }
      ]
    },

    /* THE DOUBLING AGAINST WHAT SHIPPED, which is the source's year slider with the honest half added.
       The prediction is its own formula - 2,300 transistors in 1971 doubling every two years, so
       2300 * 2^((year - 1971) / 2) - and beside it a real part from about that year. Reading the two
       columns down is the actual history of Moore's law: it holds for thirty years, overshoots in the
       middle, matches almost exactly in 2020, and is out by a factor of two now. */
    'moore': {
      label: 'year',
      /* The titles here are bare years, and the chart already marks the year with a cursor and an axis
         tick - so the title goes ON the chart rather than on a line of its own above it. See learn.js. */
      titleOnChart: true,
      /* THE CHART, drawn from the three numbers each step carries below. Declared rather than inferred
         from the fields being present, so this file says what the reader will see - and so a widget
         can carry numbers without one. */
      chart: 'moore',
      /* THE BAR IS A TIMELINE HERE, so it says what its ends are - see learn.js's note on `ends`. */
      ends: ['1971 - Intel 4004', '2026 - the biggest parts made'],
      steps: [
        {
          title: '1971',
          year: 1971, real: 2300, node: 10000,
          facts: [
            { label: 'Doubling predicts', value: '2,300' },
            { label: 'Smallest features', value: '10 &micro;m' },
            { label: 'Real chip', value: 'Intel 4004<br>2,300 transistors' }
          ],
          body: 'Where the curve starts, so the prediction and the real chip are the same number. '
              + 'Ten micrometres is big enough to see through a school microscope.'
              + '<div class="learn-widget-facts">It made the pocket calculator - which is what Intel '
              + 'built it for.</div>'
        },
        {
          title: '1980',
          year: 1980, real: 68000, node: 3000,
          facts: [
            { label: 'Doubling predicts', value: '~52,000' },
            { label: 'Smallest features', value: '3 &micro;m' },
            { label: 'Real chip', value: 'Motorola 68000 (1979)<br>68,000 transistors' }
          ],
          body: 'Four and a half doublings on, and the real chips are slightly <b>ahead</b> of the '
              + 'prediction.'
              + '<div class="learn-widget-facts">It made the home computer and the arcade machine.</div>'
        },
        {
          title: '1990',
          year: 1990, real: 1200000, node: 1000,
          facts: [
            { label: 'Doubling predicts', value: '~1.7 million' },
            { label: 'Smallest features', value: '1 &micro;m' },
            { label: 'Real chip', value: 'Intel 486 (1989)<br>1.2 million transistors' }
          ],
          body: 'And now slightly <b>behind</b> it. The gap goes both ways, which is the first clue '
              + 'that this is a description and not a law.'
              + '<div class="learn-widget-facts">It made a computer with windows and a mouse something '
              + 'you could have on a desk.</div>'
        },
        {
          title: '2000',
          year: 2000, real: 42000000, node: 180,
          facts: [
            { label: 'Doubling predicts', value: '~53 million' },
            { label: 'Smallest features', value: '180 nm' },
            { label: 'Real chip', value: 'Pentium 4<br>42 million transistors' }
          ],
          body: 'Thirty years of doubling, and the two are still the same size. This is the stretch '
              + 'that made the prediction famous.'
              + '<div class="learn-widget-facts">It made multimedia PCs, CD-ROMs and the first 3D '
              + 'games.</div>'
        },
        {
          title: '2010',
          year: 2010, real: 2300000000, node: 45,
          facts: [
            { label: 'Doubling predicts', value: '~1.7 billion' },
            { label: 'Smallest features', value: '45 nm' },
            { label: 'Real chip', value: 'Intel Xeon (Nehalem-EX)<br>2.3 billion transistors' }
          ],
          body: 'Chips stopped getting much faster around here - the power went up quicker than the '
              + 'speed - so the extra transistors went into <b>more cores</b> instead of a faster one.'
              + '<div class="learn-widget-facts">It made the smartphone.</div>'
        },
        {
          title: '2020',
          year: 2020, real: 54000000000, node: 7,
          facts: [
            { label: 'Doubling predicts', value: '~55 billion' },
            { label: 'Smallest features', value: '7 nm' },
            { label: 'Real chip', value: 'Nvidia A100<br>54 billion transistors' }
          ],
          body: 'Fifty years and twenty-four doublings later, the biggest chips land <b>almost exactly '
              + 'where a 1965 guess put them</b>. That is the whole reason anyone still quotes it.'
              + '<div class="learn-widget-facts">It made machine learning something a phone does by '
              + 'itself.</div>'
        },
        {
          title: '2026',
          year: 2026, real: 200000000000, node: 3,
          facts: [
            { label: 'Doubling predicts', value: '~440 billion' },
            { label: 'Smallest features', value: '3 nm to 2 nm class' },
            { label: 'Real chip', value: 'the largest parts today<br>around 200 billion, over several dies' }
          ],
          body: 'Here the curve pulls away from reality. Chips still improve, but not by doubling every '
              + 'two years - and the extra transistors increasingly come from <b>stacking dies</b> '
              + 'rather than from making features smaller.'
              + '<div class="learn-widget-facts">Which is what the last section of this page is '
              + 'about.</div>'
        }
      ]
    },

    /* DOWN FROM SOMETHING VISIBLE, five rungs, because "2 nm" means nothing on its own. The numbers are
       the source's and the ratios are worked out from them here. The last rung is the honest one: at
       0.2 nm per silicon atom, the label on a modern process is about ten atoms - which is the clue that
       it is a name and not a measurement, as the note under this widget says. */
    'scale': {
      label: 'scale',
      steps: [
        { title: 'A human hair - about 80,000 nm',
          svg: '<svg width="220" height="70" viewBox="0 0 220 70" aria-label="A wide bar standing for the width of a hair">'
             + '<rect x="14" y="18" width="192" height="34" rx="17" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<text x="110" y="41" font-size="11" fill="currentColor" text-anchor="middle">80,000 nm across</text></svg>',
          facts: [{ label: 'Width', value: '80,000 nm' }, { label: 'Fit across one hair', value: '1' }],
          body: 'The widest thing on this list, and the only one you can see without a microscope.'
              + '<div class="learn-widget-facts">Fits about <b>40,000</b> features of a "2 nm" generation side by side.</div>' },
        { title: 'A red blood cell - about 7,000 nm',
          svg: '<svg width="220" height="70" viewBox="0 0 220 70" aria-label="An ellipse standing for a red blood cell">'
             + '<ellipse cx="110" cy="35" rx="62" ry="26" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<ellipse cx="110" cy="35" rx="24" ry="10" fill="none" stroke="currentColor" stroke-width="1" opacity="0.6"/>'
             + '</svg>',
          facts: [{ label: 'Width', value: 'about 7,000 nm' }, { label: 'Fit across one hair', value: 'about 11' }],
          body: 'Eleven of these across one hair - and still enormous next to a chip.'
              + '<div class="learn-widget-facts">A 1971 transistor at 10 &micro;m was about <b>one and a half</b> of these.</div>' },
        { title: 'A virus particle - about 100 nm',
          svg: '<svg width="220" height="70" viewBox="0 0 220 70" aria-label="A circle with spikes standing for a virus particle">'
             + '<circle cx="110" cy="35" r="20" fill="none" stroke="currentColor" stroke-width="2"/>'
             + '<g stroke="currentColor" stroke-width="2" opacity="0.7">'
             + '<path d="M 110 15 V 7"/><path d="M 110 55 V 63"/><path d="M 90 35 H 82"/><path d="M 130 35 H 138"/>'
             + '<path d="M 96 21 L 90 15"/><path d="M 124 49 L 130 55"/></g></svg>',
          facts: [{ label: 'Width', value: 'about 100 nm' }, { label: 'Fit across one hair', value: 'about 800' }],
          body: 'Now we are inside the chip world: this is about the size of the smallest features a '
              + 'factory could print in the late 1990s.'
              + '<div class="learn-widget-facts">Eight hundred of these across one hair.</div>' },
        { title: 'A DNA double helix - about 2.5 nm',
          /* CUBICS, IN A TALLER BOX, and both changes are one fix: the first version drew each strand as
             `Q ... T ...`, and a smooth quadratic REFLECTS the previous control point - so the second
             half of the wave was controlled from y = 98 and y = -28, both outside a 70-tall viewBox, and
             the top of one strand and the bottom of the other were simply clipped off. A cubic whose
             control points share their endpoints' y stays inside the box by construction, and 100 tall
             gives the crossing room to read as a helix rather than as two arcs. */
          svg: '<svg width="220" height="100" viewBox="0 0 220 100" aria-label="Two strands crossing twice, standing for a DNA double helix">'
             + '<g stroke-width="3" fill="none" stroke-linecap="round">'
             + '<path d="M 24 24 C 66 24 66 76 108 76 C 150 76 150 24 192 24" stroke="currentColor"/>'
             + '<path d="M 24 76 C 66 76 66 24 108 24 C 150 24 150 76 192 76" style="stroke: var(--accent-fg)"/>'
             + '</g>'
             + '<g stroke="currentColor" stroke-width="1.5" opacity="0.55">'
             + '<path d="M 45 33 V 67"/><path d="M 108 50 V 50"/><path d="M 171 33 V 67"/>'
             + '</g></svg>',
          facts: [{ label: 'Width', value: 'about 2.5 nm' }, { label: 'Fit across one hair', value: 'about 32,000' }],
          body: 'A modern chip’s smallest features are around here - which means biology and computing '
              + 'are now built at the same scale.'
              + '<div class="learn-widget-facts">A "2 nm" label is smaller than <b>this</b>, which is the first sign it cannot be a width.</div>' },
        { title: 'A silicon atom - about 0.2 nm',
          svg: '<svg width="220" height="70" viewBox="0 0 220 70" aria-label="A small circle with two orbits standing for an atom">'
             + '<circle cx="110" cy="35" r="9" fill="none" stroke-width="2" style="stroke: var(--attention-fg)"/>'
             + '<ellipse cx="110" cy="35" rx="42" ry="13" fill="none" stroke="currentColor" stroke-width="1" opacity="0.7" transform="rotate(28 110 35)"/>'
             + '<ellipse cx="110" cy="35" rx="42" ry="13" fill="none" stroke="currentColor" stroke-width="1" opacity="0.7" transform="rotate(-28 110 35)"/>'
             + '</svg>',
          facts: [{ label: 'Width', value: 'about 0.2 nm' }, { label: 'Fit across one hair', value: 'about 400,000' }],
          body: 'The floor. You cannot print half an atom, and a switch only a few dozen atoms thick '
              + 'already leaks the electrons it is meant to hold back.'
              + '<div class="learn-widget-facts">Ten of these is the whole of a "2 nm" label - so the label is a generation, not a length.</div>' }
      ]
    }
  },

  /* The source article's own five questions, one per marked section, with `sec` tying each to the
     heading it came from. The QUESTIONS are its; the DISTRACTORS are not, and that is the one change
     worth recording: several of the originals were jokes (a silicon slab that "looked nicer", vacuum
     tubes that ran colder), and a reader who can eliminate three answers without knowing the material
     has not been asked anything. Each wrong option here is something a person could plausibly believe
     after skimming the page - which is also what makes the link back to the section worth following.
     The source's explanations are not lost: each one is a sentence in the section its question names. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'tyranny',
          q: 'What was the "tyranny of numbers"?',
          options: [
            'More parts meant more hand-soldered joints, so a big machine was always broken somewhere',
            'Early computers could only count as high as the number of tubes they held',
            'Binary arithmetic was too slow for the calculations of the day'
          ],
          answer: 0
        },
        {
          sec: 'breakthrough',
          q: 'Why did Noyce’s planar process matter more for manufacturing than Kilby’s prototype?',
          options: [
            'Its connections were printed flat onto the oxide, so light could pattern them in bulk',
            'It used silicon, which conducts better than germanium',
            'It put more transistors on the first chip than Kilby managed'
          ],
          answer: 0
        },
        {
          sec: 'eras',
          q: 'Which programme was the first large customer for integrated circuits?',
          options: [
            'Apollo, whose guidance computer had to be light enough to fly',
            'The first commercial airline booking systems',
            'Television manufacturers replacing tubes in home sets'
          ],
          answer: 0
        },
        {
          sec: 'moore',
          q: 'What does Moore’s law actually say?',
          options: [
            'The transistor count on a chip roughly doubles every two years',
            'Transistors get twice as fast every two years',
            'A chip of a given size costs half as much every two years'
          ],
          answer: 0
        },
        {
          sec: 'modern',
          q: 'A flat transistor leaks once its channel is a few dozen atoms long. What replaced it?',
          options: [
            'A three-dimensional channel with the gate wrapped around it, as a fin or a nanosheet',
            'A thicker insulating layer, which stops the leak at any size',
            'A return to larger transistors, run at a much higher voltage'
          ],
          answer: 0
        }
      ]
    }
  }
};
