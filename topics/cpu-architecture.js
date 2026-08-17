/* Topic content for the 'cpu-architecture' learn page - the third history topic, and the last page of
 * the Learn site: everything before it is a part, and this is what the parts are for.
 *
 * IT IS AN INTEGRATION OF AN OUTSIDE ARTICLE, `evolution_of_cpu.html`, under the rule
 * `integrated-circuits` set and `design-tools` followed: keep the CONTENT - the narrative, every number,
 * and its five quiz questions - and drop the presentation entirely. So the paragraphs are
 * `.learn-prose`, the asides are `.learn-note`, the numbers are the site's own `.truth-table`, the
 * drawings are `currentColor` in a `.learn-illus`, and its two interactive panels are `{widget}` blocks
 * that learn.js steps.
 *
 * IT IS THE ONE TOPIC WHOSE PARTS ARE ALL ALREADY ON THE SITE, and that decides its shape. The reader
 * arriving here has built an <a href="learn-alu-4bit.html">ALU</a>, a
 * <a href="learn-register-4bit.html">register</a> and a <a href="learn-counter-4bit.html">counter</a>,
 * which is a program counter with the increment already in it - so this page does not introduce the
 * pieces, it names which piece each part of the fetch-decode-execute loop is. Every section ends by
 * pointing at the thing on this site that IS the section: `cpu-16bit` on the practice hub is the machine
 * described here, and `compiler.html` is what feeds it.
 *
 * ITS TWO STEPPERS ARE DATA. The source's cycle stepper (three states of an SVG) and its era slider
 * (five cards) become `topic.widgets`, which is a list of steps with no functions in it - so both use
 * the control the layout player already has, and neither carries behaviour this file would own.
 *
 * THE TABLE AND THE ERA STEPPER SAY DIFFERENT THINGS, the rule both earlier history topics follow: the
 * table carries the NUMBERS - width, clock, transistors, five rows of them, which is a comparison and
 * wants one glance - and the stepper carries the PARTS, the chips of the era and what changed in them.
 * No number appears in both.
 *
 * SIX SECTIONS AND SIX QUESTIONS, where the source had five of each, and the extra one is deliberate:
 * `generations` is a marked section, learn.js links a wrong answer back to the section it came from, and
 * test_learn.py requires every marked section to be asked about - so a section with no question is a
 * section with no way back. The five source questions map one-to-one onto the other five sections.
 *
 * NO SLOTS. `slots: []` (see the manifest note): learn.js removes every card and hides the app's grid.
 * There is no design to run because a CPU is not a page's worth of Verilog - it is the practice site's
 * `cpu-16bit`, which is exactly where this page sends the reader who wants to run one.
 *
 * FOUR CLAIMS OF THE SOURCE ARE CORRECTED rather than repeated, and the first two would each leave a
 * reader believing something false about how a processor works:
 *
 *   - IT STATES THE POWER LAW AS A FACT OF NATURE. "Power consumption scales with the cube of clock
 *     frequency" is not what the physics says: dynamic power is roughly C V^2 f, which is LINEAR in
 *     frequency at a fixed voltage. The cube appears because reaching a higher frequency needs a higher
 *     voltage, and the voltage is squared - so the relationship is real, and it is a consequence of two
 *     things rather than one law. Said properly it also explains why the fix was more cores at a LOWER
 *     clock, which the cube on its own does not.
 *   - IT SAYS CPUS HIT 4 GHZ. They did not, on that path: Intel cancelled its 4 GHz Pentium 4 in 2004
 *     and the line stopped at 3.8 GHz - which the source's own era table says, two sections earlier. The
 *     wall is more convincing as the place the industry turned back from than as a number it reached.
 *   - IT CLAIMS PIPELINING IS 4x FASTER. Its own worked example is five instructions, where the honest
 *     figures are 8 cycles against 20 - two and a half times, not four. Four times is the LIMIT as the
 *     instruction count grows, and the table on this page shows both numbers so the reader can see where
 *     the missing speedup went: the three cycles at the start where the pipe is filling.
 *   - IT INCREMENTS THE PROGRAM COUNTER DURING DECODE. Its own stepper moves PC from 0x004 to 0x008 in
 *     step 2. The increment belongs to the fetch: the address is used and then advanced, which is why a
 *     branch works by overwriting a PC that has already moved on. Corrected in the widget, and the
 *     reason is stated there rather than in a footnote.
 *
 * ONE NUMBER IS NAMED RATHER THAN DESCRIBED, and it moved twice. The source has the 6502 at 25 dollars
 * "when competitors charged 300"; 300 was what an 8080 or a 6800 had cost earlier, and by the September
 * 1975 launch both were 179. A first pass here rendered that as "about a quarter of the price", which
 * is wrong in the flattering direction - 25 against 179 is nearer a SEVENTH - so the page gives the two
 * figures and lets the reader do the division. A ratio in prose is exactly the sort of claim that gets
 * softened until it is untrue.
 *
 * THE PARTS THAT 6502 SHIPPED IN ARE CHECKED, not listed from memory, because a list of four is four
 * claims. The Apple II, the Commodore PET and the BBC Micro (a 6502A at 2 MHz in the Model A and B; the
 * later Master used a 65C12) all ran the part itself. The NES did NOT: its CPU is a Ricoh 2A03, a 6502
 * core with the decimal mode fused off and a sound generator on the same die, so it is named here as a
 * cut-down core rather than as another 6502 socket. Acorn is the one worth knowing about if this comes
 * up again - the BBC Micro's Tube could carry a Z80 or an ARM as a SECOND processor, which is what makes
 * "the BBC Micro was not a 6502 machine" a reasonable thing to believe and still not so.
 *
 * ITS TWO CODE BLOCKS ARE ILLUSTRATIVE, not quotations. `learn-code` normally holds a fragment of the
 * topic's own design and test_learn.py checks every line of one against what the topic ships; a slotless
 * topic has no design and no editor, so nothing can drift, and the check takes the branch that says so.
 * What is in them is a CISC mnemonic no machine on this site runs and the three-instruction RISC form of
 * the same operation - the comparison is the whole point of that section, and neither side of it belongs
 * to a page here. The power relationship is deliberately NOT one of them: an equation is not source text,
 * so it is an inline `code` chip in its sentence and the class keeps meaning "code".
 *
 * EVERY DRAWING IS `currentColor` PLUS AT MOST ONE TOKEN, so this file contains no colour literal and
 * both colour modes work. The source's SVGs were literal slate and cyan on a fixed dark background.
 *
 * HTML is carried in String.raw template literals, so no block may contain a backtick or a dollar
 * followed by a brace - either ends the literal and turns the rest of the file into JavaScript,
 * hundreds of lines from where it looks wrong.
 */
window.LEARN_TOPICS = window.LEARN_TOPICS || {};
window.LEARN_TOPICS['cpu-architecture'] = {

  blocks: [
    { html: String.raw`
<h2 data-sec="cycle">One instruction, three steps</h2>
<p>Everything else on this site is a circuit that does one thing. An adder adds. A multiplexer chooses.
A register keeps. A processor is different in one respect only: <b>what it does next is written down
somewhere it can read</b>, and it spends its whole life doing the same three steps to find out.</p>
<p>Fetch the instruction. Work out what it asks for. Do it. Then again. A 3.5 GHz core runs that loop
three and a half billion times a second, per core, and has done nothing else since it was switched
on.</p>
<p>The parts it uses are all parts you have already built:</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">part</th><th class="sep"></th><th>what it does</th><th>where you built it</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">program counter</td><td class="sep"></td><td>holds the address of the next instruction, and advances</td><td>a counter</td></tr>
      <tr><td class="in">instruction register</td><td class="sep"></td><td>holds the instruction being worked on</td><td>a register</td></tr>
      <tr><td class="in">control unit</td><td class="sep"></td><td>turns the bits of an instruction into control signals</td><td>a decoder</td></tr>
      <tr><td class="in">arithmetic logic unit</td><td class="sep"></td><td>does the arithmetic or the logic, and says which</td><td>an ALU</td></tr>
      <tr><td class="in">register file</td><td class="sep"></td><td>the handful of values being worked on right now</td><td>registers, with a decoder in front</td></tr>
    </tbody>
  </table>
</div>
<p>There is nothing in that list you have not seen. Step one instruction through them:</p>
` },

    { widget: 'cycle' },

    { html: String.raw`
<div class="learn-note">
  <b>The loop is where a program comes from.</b> Nothing in the hardware knows what a program is - it
  knows one instruction, and it knows how to find the next address. Everything above that, from a
  <code>for</code> loop to an operating system, is a consequence of the counter advancing and of
  instructions that can write to it.
</div>
<p>You can run exactly this. On the practice site, <a href="cpu-16bit.html">16-Bit CPU</a> is a working
processor of this shape written in the same Verilog subset as every other page here - a program counter,
an instruction memory, a decoder, an ALU and thirty-two registers - with its control flow left for you
to finish. And <a href="compiler.html">Compiler</a> is the other end of the same loop: it takes C or
Python, emits the instructions this machine fetches, and single-steps them beside the source.</p>
` },

    { html: String.raw`
<h2 data-sec="generations">From four bits to sixty-four</h2>
<p>What changed over fifty years was not the loop. It was how much the machine could hold, how wide the
values were, and how fast the loop ran. Read the last column against the
<a href="learn-integrated-circuits.html">transistor counts</a> from the history page - they are the same
numbers seen from the other side.</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">era</th><th class="sep"></th><th>width</th><th>clock</th><th>transistors</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">1970s</td><td class="sep"></td><td>4 and 8 bits</td><td>740 kHz to 2 MHz</td><td>2,300 to 9,000</td></tr>
      <tr><td class="in">1980s</td><td class="sep"></td><td>16 and 32 bits</td><td>4.77 to 33 MHz</td><td>29,000 to 275,000</td></tr>
      <tr><td class="in">1990s-2000s</td><td class="sep"></td><td>32 bits</td><td>66 MHz to 3.8 GHz</td><td>3.1 to 125 million</td></tr>
      <tr><td class="in">2005-2015</td><td class="sep"></td><td>64 bits, several cores</td><td>2.0 to 4.5 GHz</td><td>200 million to 3 billion</td></tr>
      <tr><td class="in">2020s</td><td class="sep"></td><td>64 bits, cores of two kinds</td><td>3.5 to 5.8 GHz</td><td>10 to over 100 billion</td></tr>
    </tbody>
  </table>
</div>
<p>The widths in the first column are the interesting ones, because a width is not a speed - it is a
reach. An 8-bit processor with a 16-bit address can name 65,536 places; 32 bits of address names four
billion. Every one of those steps changed what a program was allowed to be, and none of them made the
loop above any different.</p>
` },

    { widget: 'generations' },

    { html: String.raw`
<div class="learn-note">
  <b>Your own 16-bit CPU is roughly the first row.</b> The practice site's processor is about the
  complexity of a 1971 part, which is what makes it a page rather than a career, and it is the reason
  every one of these eras is reachable from a design you can read in an afternoon. The 4004 held 2,300
  transistors. The <a href="learn-alu-4bit.html">4-Bit ALU</a> on this site is 26 cells.
</div>
` },

    { html: String.raw`
<h2 data-sec="pipelining">The laundry line</h2>
<p>Take the three steps above, and split the last one so there are four: fetch, decode, execute, write
the answer back. In the simplest possible processor each instruction goes through all four before the
next one starts - which means that while the ALU is working, the part that fetches instructions is doing
nothing at all. Three quarters of the machine is idle at any moment.</p>
<p>You have a washing machine, a dryer, a folding table and a cupboard, and four loads of laundry.
Nobody waits for load one to reach the cupboard before starting load two. You put load two in the washer
as soon as load one moves to the dryer, and after a while all four machines are busy at once. That is
<b>pipelining</b>, and it is the same idea with the same benefit and the same catch.</p>
<div class="truth-wrap">
  <table class="truth-table">
    <thead>
      <tr><th class="in">instruction</th><th class="sep"></th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th></tr>
    </thead>
    <tbody>
      <tr><td class="in">ADD r1, r2</td><td class="sep"></td><td class="one">IF</td><td class="one">ID</td><td class="one">EX</td><td class="one">WB</td><td class="zero">.</td><td class="zero">.</td><td class="zero">.</td><td class="zero">.</td></tr>
      <tr><td class="in">SUB r3, r4</td><td class="sep"></td><td class="zero">.</td><td class="one">IF</td><td class="one">ID</td><td class="one">EX</td><td class="one">WB</td><td class="zero">.</td><td class="zero">.</td><td class="zero">.</td></tr>
      <tr><td class="in">LOAD r5</td><td class="sep"></td><td class="zero">.</td><td class="zero">.</td><td class="one">IF</td><td class="one">ID</td><td class="one">EX</td><td class="one">WB</td><td class="zero">.</td><td class="zero">.</td></tr>
      <tr><td class="in">STORE r6</td><td class="sep"></td><td class="zero">.</td><td class="zero">.</td><td class="zero">.</td><td class="one">IF</td><td class="one">ID</td><td class="one">EX</td><td class="one">WB</td><td class="zero">.</td></tr>
      <tr><td class="in">MUL r7, r8</td><td class="sep"></td><td class="zero">.</td><td class="zero">.</td><td class="zero">.</td><td class="zero">.</td><td class="one">IF</td><td class="one">ID</td><td class="one">EX</td><td class="one">WB</td></tr>
    </tbody>
  </table>
</div>
<p>Read the columns rather than the rows: from cycle 4 onwards <b>all four stages are busy</b>, and one
instruction finishes every cycle. Read the rows and nothing got faster - each instruction still takes
four cycles from start to finish. Both readings are true, and the second is why pipelining does not help
a single instruction at all.</p>
<p>The arithmetic, exactly: five instructions unpipelined is <b>20 cycles</b>, four each. Pipelined it
is <b>8</b> - four for the first, then one for each of the other four. That is <b>two and a half times</b>,
not four. Four times is what you approach as the program gets longer, because the three cycles at the
start where the pipe is filling stop mattering. For fifty instructions it is 200 against 53.</p>
<div class="learn-note">
  <b>And the catch, which is where all the difficulty went.</b> Cycle 5 fetches the instruction after
  <code>STORE</code> - but if <code>STORE</code> had been a branch, the machine has already fetched the
  wrong one. So a deep pipeline needs <b>branch prediction</b> to guess, and a way to throw away work
  when the guess was wrong. It also needs to notice when one instruction wants a value the one in front
  has not written back yet. Neither problem exists without pipelining, and modern processors spend an
  enormous fraction of their transistors on both.
</div>
<p>This is not only history. The reference processor behind this site's own co-simulator is a two-stage
pipeline, and it has to be: without a prefetch, every instruction would take two cycles instead of one
and it would fail to match the real part's timing on every single instruction.</p>
` },

    { html: String.raw`
<h2 data-sec="philosophies">Two answers to what an instruction should be</h2>
<p>Given that the machine reads instructions, how much should one instruction do? The industry answered
that twice, thirty years apart, and both answers are still shipping.</p>
<div class="learn-split">
  <div>
    <p><b>CISC</b> - complex instruction set. Do as much as possible per instruction, because memory is
    expensive and a program that fits in less of it is worth having. One opcode reads two values out of
    memory, multiplies them and writes the answer back:</p>
    <pre class="learn-code">MULT [addr_a], [addr_b]</pre>
    <p>That was the right trade in 1975, when RAM cost more than logic. It is the x86 family, which is to
    say most desktops and most servers.</p>
  </div>
  <div>
    <p><b>RISC</b> - reduced instruction set. Keep every instruction simple, uniform and one cycle long,
    and let the compiler assemble the complicated things out of them. The same multiply is three
    instructions, each of which does exactly one thing:</p>
    <pre class="learn-code">LOAD r1, [addr_a]
LOAD r2, [addr_b]
MUL  r3, r1, r2</pre>
    <p>More instructions, less hardware per instruction - which pipelines cleanly and uses less power.
    It is ARM, Apple silicon, and RISC-V.</p>
  </div>
</div>
<p><b>Both of this site's compiler targets are RISC</b>, and that is not a preference so much as what a
teachable machine looks like: <a href="compiler.html">Compiler</a> emits RISC-V, where every instruction
is one 32-bit word, and an 8-bit AVR, where loads and stores are the only instructions that touch memory
at all. The load-then-operate shape in the right-hand column is what its generated assembly is made
of.</p>
<div class="learn-note">
  <b>The rivalry was settled by not settling it.</b> A modern x86 processor accepts CISC instructions and
  then <em>translates them</em>, in hardware, into simple fixed-length operations - micro-ops - which it
  pipelines and reorders exactly as a RISC machine would. The instruction set stayed complex because
  software depends on it; the machine underneath became the other thing. So the honest summary is that
  RISC won the engineering argument and CISC kept its customers.
</div>
` },

    { html: String.raw`
<h2 data-sec="power">The wall the clock ran into</h2>
<p>For thirty years the way to make a processor faster was to run it faster, and the clock rose from
740 kHz to nearly 4 GHz - a factor of five thousand. Then it stopped, and it has not really moved
since.</p>
<p>What stopped it was heat. The power a chip burns switching its transistors is roughly
<code>P = C x V^2 x f</code>, where <code>f</code> is the clock, <code>V</code> the supply voltage and
<code>C</code> what has to be charged and discharged. On its own that is <b>linear</b> in frequency:
twice the clock, twice the power, which would be a bargain. The trouble is <code>V</code>. Switching a
transistor faster needs a higher voltage to do it, so pushing the clock up drags the voltage up with it -
and the voltage is <b>squared</b>. Push both and consumption climbs closer to the cube of the clock rate
than to the first power of it.</p>
<div class="learn-note">
  <b>The wall is where the industry turned back, not where it arrived.</b> Intel cancelled its 4 GHz
  Pentium 4 in 2004; that line topped out at 3.8 GHz. The last part of the single-core era was abandoned
  before it shipped, which is a better summary of the problem than any number it reached: the cooling
  needed had stopped being something you could put in a computer.
</div>
<p>Read the power equation the other way and it says what to do instead. Halve the clock on one core and
you can lower the voltage as well, so it burns far less than half the power - and now you have room for
a second core at the same reduced settings. <b>Two cores at 2 GHz do more total work than one at
4 GHz would have done, and they can actually be cooled.</b> That is the whole reason your machine has
eight of them, and it is not a performance win so much as the only remaining direction.</p>
<div class="learn-note">
  <b>And it moved the difficulty into software.</b> One core at twice the speed makes every program
  faster for free. Eight cores make a program faster only if it can be split into eight pieces that do
  not have to wait for each other, and most programs cannot. Which is why a processor from 2015 and one
  from today feel much more alike than a processor from 1995 and one from 2005.
</div>
` },

    { html: String.raw`
<h2 data-sec="modern">What a processor is now</h2>
<p>Once you cannot raise the clock, everything left is specialisation - and a modern chip is less a
processor than a collection of them.</p>
<h3>1. The cores are not all the same</h3>
<p>A <b>performance core</b> is wide, deeply pipelined, aggressively predicting, and expensive in power.
An <b>efficiency core</b> is narrow and simple and costs a fraction as much to run. Most of what a
computer does - waiting, syncing, playing audio - does not need the first kind, so the work is sorted
between them. It is a direct consequence of the section above: since power is the budget, the answer is
to stop paying for speed you are not using.</p>
<h3>2. The memory is shared with everything else</h3>
<p>The processor, the graphics unit and the accelerators sit on one very wide <b>unified memory</b>
rather than each keeping their own and copying between them. Copying was often the actual cost of using
a graphics unit for computation, so removing the copy is worth more than it sounds.</p>
<h3>3. Some of the work is not instructions at all</h3>
<p>A <b>neural processing unit</b> is not a small CPU. It is a large array of multipliers arranged to do
one thing - multiply matrices - with none of the fetch, decode, predict and reorder machinery this page
has been describing. That machinery is what makes a processor able to run <em>anything</em>, and it is
pure overhead for work whose shape you already know. So the shape gets its own silicon, at a fraction of
the energy per operation.</p>
<div class="learn-note">
  <b>Which is where the loop comes back.</b> A general-purpose processor is a machine that is mediocre at
  everything on purpose, because it does not know what you will ask. Every accelerator on a modern die
  is a bet that some particular thing is worth being excellent at - and each one is designed with the
  same flow, out of the same cells, as the ALU on this site.
</div>
` },

    { html: String.raw`
<h2>Where this goes next</h2>
<p>This is the last topic, and the exit from it is the practice site.
<a href="cpu-16bit.html">16-Bit CPU</a> is the machine on this page with its control flow removed for
you to write, checked instruction by instruction against a reference model.
<a href="cpu-8bit.html">8-Bit CPU</a> is a smaller accumulator machine with its data bus and its branch
left out. <a href="compiler.html">Compiler</a> compiles C or Python down to what those machines fetch,
and will hand you the ROM image to feed one.</p>
<p>Going the other way, <a href="learn-design-tools.html">The Evolution of Chip Design Tools</a> is how
anything this size gets built at all, and <a href="learn-integrated-circuits.html">The Evolution of
Integrated Circuits</a> is why it fits on a fingernail. All three of those pages end in the same place:
a description of what the hardware should do, and tools that turn it into shapes.</p>
` },

    { html: String.raw`
<h2>Check yourself</h2>
<p>Six questions on fifty years of processors. A wrong answer says so and links back to the section it
came from; the score at the foot of the panel is what the Learn hub shows beside this topic.</p>
` },

    { quiz: 'check-yourself' }
  ],

  /* THE TWO STEPPERS, as data. `cycle` is the source's three-state instruction stepper and `generations`
     is its five-card era slider; learn.js owns the stepping.

     `generations` declares `ends` because it is a range of years with two ends worth naming under the
     bar. `cycle` does not: three stages of one instruction are a list, and its last step leads back to
     its first rather than stopping at a far end.

     NO NUMBER IN THE `generations` STEPS APPEARS IN THE TABLE ABOVE IT - the widths, clocks and counts
     are the table's, and these steps carry the parts and what changed. */
  widgets: {

    /* THE PROGRAM COUNTER ADVANCES IN THE FETCH, which is where the source had it wrong (it moved PC in
       step 2). The address is used and then incremented, and saying so here is load-bearing rather than
       pedantic: the reason a branch is implemented by WRITING to the program counter only makes sense
       once you know it has already moved past the branch by the time the branch executes. */
    'cycle': {
      label: 'step of the instruction cycle',
      steps: [
        {
          title: 'Fetch: read the instruction the counter points at',
          svg: '<svg width="240" height="120" viewBox="0 0 240 120" aria-label="A program counter box emphasised, feeding an instruction register, a control unit and an ALU">'
             + '<rect x="12" y="16" width="66" height="34" rx="4" fill="none" style="stroke: var(--accent-fg)" stroke-width="2.5"/>'
             + '<text x="45" y="37" font-size="10" text-anchor="middle" style="fill: var(--accent-fg)">PC</text>'
             + '<rect x="12" y="68" width="66" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="45" y="89" font-size="10" fill="currentColor" text-anchor="middle">IR</text>'
             + '<rect x="98" y="16" width="62" height="86" rx="5" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="129" y="55" font-size="9" fill="currentColor" text-anchor="middle">control</text>'
             + '<text x="129" y="69" font-size="9" fill="currentColor" text-anchor="middle">unit</text>'
             + '<path d="M180 16 L228 32 L228 86 L180 102 L198 59 Z" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="209" y="63" font-size="10" fill="currentColor" text-anchor="middle">ALU</text>'
             + '<path d="M45 50 V68 M39 62 L45 68 L51 62" fill="none" style="stroke: var(--accent-fg)" stroke-width="1.6"/>'
             + '</svg>',
          facts: [
            { label: 'Program counter', value: '0x004, then 0x008' },
            { label: 'Instruction register', value: 'ADD r1, r2' },
            { label: 'Control unit', value: 'idle - it has not seen the instruction yet' }
          ],
          body: 'The counter holds <code>0x004</code>. The word at that address is read out of memory '
              + 'and put in the instruction register - and the counter is <b>advanced in the same '
              + 'step</b>, to <code>0x008</code>, so it is already pointing at the next instruction '
              + 'before this one has been looked at.'
              + '<div class="learn-widget-facts">Four bytes on, because this machine’s instructions are 32-bit words. The 16-bit CPU on the practice site counts words instead, so its counter goes 4 to 5.</div>'
        },
        {
          title: 'Decode: work out what the bits are asking for',
          svg: '<svg width="240" height="120" viewBox="0 0 240 120" aria-label="The control unit emphasised, reading the instruction register">'
             + '<rect x="12" y="16" width="66" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="45" y="37" font-size="10" fill="currentColor" text-anchor="middle">PC</text>'
             + '<rect x="12" y="68" width="66" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="45" y="89" font-size="10" fill="currentColor" text-anchor="middle">IR</text>'
             + '<rect x="98" y="16" width="62" height="86" rx="5" fill="none" style="stroke: var(--accent-fg)" stroke-width="2.5"/>'
             + '<text x="129" y="55" font-size="9" text-anchor="middle" style="fill: var(--accent-fg)">control</text>'
             + '<text x="129" y="69" font-size="9" text-anchor="middle" style="fill: var(--accent-fg)">unit</text>'
             + '<path d="M180 16 L228 32 L228 86 L180 102 L198 59 Z" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="209" y="63" font-size="10" fill="currentColor" text-anchor="middle">ALU</text>'
             + '<path d="M78 85 H98 M92 79 L98 85 L92 91" fill="none" style="stroke: var(--accent-fg)" stroke-width="1.6"/>'
             + '</svg>',
          facts: [
            { label: 'Program counter', value: '0x008 - already past this instruction' },
            { label: 'Instruction register', value: 'ADD r1, r2' },
            { label: 'Control unit', value: 'decoded: an add, of r2 into r1' }
          ],
          body: 'The control unit reads the instruction register and turns those bits into control '
              + 'signals: which two registers to read, what the ALU should do with them, where the '
              + 'answer goes. This is a <b>decoder</b>, the circuit from '
              + '<a href="learn-decoder-2to4.html">2:4 Decoder</a>, at a larger size - a pattern of '
              + 'bits in, one line asserted out of many.'
              + '<div class="learn-widget-facts">Nothing has happened to any value yet. This step only routes.</div>'
        },
        {
          title: 'Execute: do it, and write the answer back',
          svg: '<svg width="240" height="120" viewBox="0 0 240 120" aria-label="The ALU emphasised, with a result path back to the registers">'
             + '<rect x="12" y="16" width="66" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="45" y="37" font-size="10" fill="currentColor" text-anchor="middle">PC</text>'
             + '<rect x="12" y="68" width="66" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="45" y="89" font-size="10" fill="currentColor" text-anchor="middle">IR</text>'
             + '<rect x="98" y="16" width="62" height="86" rx="5" fill="none" stroke="currentColor" stroke-width="1.4"/>'
             + '<text x="129" y="55" font-size="9" fill="currentColor" text-anchor="middle">control</text>'
             + '<text x="129" y="69" font-size="9" fill="currentColor" text-anchor="middle">unit</text>'
             + '<path d="M180 16 L228 32 L228 86 L180 102 L198 59 Z" fill="none" style="stroke: var(--accent-fg)" stroke-width="2.5"/>'
             + '<text x="209" y="63" font-size="10" text-anchor="middle" style="fill: var(--accent-fg)">ALU</text>'
             + '<path d="M160 59 H180 M174 53 L180 59 L174 65" fill="none" style="stroke: var(--accent-fg)" stroke-width="1.6"/>'
             + '<path d="M204 102 V112 H45 V102" fill="none" style="stroke: var(--accent-fg)" stroke-width="1.6" stroke-dasharray="3 2"/>'
             + '</svg>',
          facts: [
            { label: 'Program counter', value: '0x008 - the next fetch is from here' },
            { label: 'Instruction register', value: 'ADD r1, r2' },
            { label: 'Control unit', value: 'executing, and steering the result home' }
          ],
          body: 'The ALU adds the two values and the sum is written back into <code>r1</code> - the '
              + 'dashed path. This is the <a href="learn-alu-4bit.html">4-Bit ALU</a> and the '
              + '<a href="learn-register-4bit.html">4-Bit Register</a> doing exactly what those pages '
              + 'built them to do. Then the loop starts again at the address the counter has been '
              + 'holding since step 1.'
              + '<div class="learn-widget-facts">A branch is this step writing to the PC instead of to a register - which is why it has to overwrite an address that has already moved on.</div>'
        }
      ]
    },

    /* ONE ERA AT A TIME, and what changes down the list is the PART and what became possible with it -
       the widths, clocks and transistor counts are the table's. */
    'generations': {
      label: 'generation of processor',
      ends: ['1971', 'today'],
      steps: [
        {
          title: '1970s: a whole processor on one chip',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A dual-in-line package labelled 6502">'
             + '<g fill="currentColor" opacity="0.5">'
             + '<rect x="46" y="10" width="8" height="14"/><rect x="76" y="10" width="8" height="14"/>'
             + '<rect x="106" y="10" width="8" height="14"/><rect x="136" y="10" width="8" height="14"/>'
             + '<rect x="166" y="10" width="8" height="14"/>'
             + '<rect x="46" y="80" width="8" height="14"/><rect x="76" y="80" width="8" height="14"/>'
             + '<rect x="106" y="80" width="8" height="14"/><rect x="136" y="80" width="8" height="14"/>'
             + '<rect x="166" y="80" width="8" height="14"/></g>'
             + '<rect x="36" y="24" width="148" height="56" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
             + '<text x="110" y="50" font-size="13" font-weight="600" text-anchor="middle" style="fill: var(--accent-fg)">MOS 6502</text>'
             + '<text x="110" y="66" font-size="9" fill="currentColor" text-anchor="middle" opacity="0.75">the whole CPU, in a part you can hold</text>'
             + '</svg>',
          facts: [
            { label: 'The parts', value: 'Intel 4004, MOS 6502, Zilog Z80' },
            { label: 'What changed', value: 'A processor stopped being a cabinet and became a component' }
          ],
          body: 'The 4004 put a complete processor on one piece of silicon for the first time. What made '
              + 'it a revolution rather than a curiosity was price: MOS Technology put the <b>6502</b> '
              + 'on sale at <b>25 dollars</b> in 1975, against the <b>179</b> Intel and Motorola were '
              + 'asking for the 8080 and the 6800 - which is why it ended up in the Apple II, the '
              + 'Commodore PET and the BBC Micro, and as a cut-down core in the NES. A processor became '
              + 'something an individual could buy and build around.'
        },
        {
          title: '1980s: enough address space to be worth programming',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A wider package labelled MC68000">'
             + '<g fill="currentColor" opacity="0.5">'
             + '<rect x="30" y="10" width="7" height="14"/><rect x="54" y="10" width="7" height="14"/>'
             + '<rect x="78" y="10" width="7" height="14"/><rect x="102" y="10" width="7" height="14"/>'
             + '<rect x="126" y="10" width="7" height="14"/><rect x="150" y="10" width="7" height="14"/>'
             + '<rect x="174" y="10" width="7" height="14"/>'
             + '<rect x="30" y="80" width="7" height="14"/><rect x="54" y="80" width="7" height="14"/>'
             + '<rect x="78" y="80" width="7" height="14"/><rect x="102" y="80" width="7" height="14"/>'
             + '<rect x="126" y="80" width="7" height="14"/><rect x="150" y="80" width="7" height="14"/>'
             + '<rect x="174" y="80" width="7" height="14"/></g>'
             + '<rect x="22" y="24" width="176" height="56" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
             + '<text x="110" y="50" font-size="13" font-weight="600" text-anchor="middle" style="fill: var(--accent-fg)">MC68000</text>'
             + '<text x="110" y="66" font-size="9" fill="currentColor" text-anchor="middle" opacity="0.75">more pins, because more address</text>'
             + '</svg>',
          facts: [
            { label: 'The parts', value: 'Intel 8086 and 8088, Motorola 68000, Intel 386' },
            { label: 'What changed', value: 'Addresses got wide enough for graphics and an operating system' }
          ],
          body: 'Sixteen bits, then thirty-two. The number that mattered was not the clock but the '
              + '<b>address</b>: a machine that can only name 64 kilobytes cannot hold a bitmap screen '
              + 'and a program to draw on it. The <b>68000</b> could, which is why the graphical '
              + 'interfaces of the decade - the Macintosh, the Amiga, the Atari ST - are all built on it.'
        },
        {
          title: '1990s: several instructions at once, and the gigahertz race',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A die with four pipeline stages drawn as a row of stacked bars">'
             + '<rect x="24" y="14" width="172" height="76" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
             + '<g fill="currentColor" opacity="0.4">'
             + '<rect x="36" y="28" width="34" height="14"/><rect x="76" y="28" width="34" height="14"/>'
             + '<rect x="116" y="28" width="34" height="14"/><rect x="156" y="28" width="28" height="14"/>'
             + '<rect x="36" y="48" width="34" height="14"/><rect x="76" y="48" width="34" height="14"/>'
             + '<rect x="116" y="48" width="34" height="14"/><rect x="156" y="48" width="28" height="14"/></g>'
             + '<text x="110" y="80" font-size="10" font-weight="600" text-anchor="middle" style="fill: var(--accent-fg)">two instructions per cycle</text>'
             + '</svg>',
          facts: [
            { label: 'The parts', value: 'Intel Pentium, AMD Athlon, PowerPC G4' },
            { label: 'What changed', value: 'The machine stopped doing one instruction at a time' }
          ],
          body: 'Pipelining came first, then <b>superscalar</b> execution - two or more instructions '
              + 'genuinely running in the same cycle - then <b>out-of-order</b> execution, where the '
              + 'machine reorders work to keep its units busy and hides the reordering completely. Then '
              + 'the clock race: AMD shipped a 1 GHz Athlon in March 2000, days ahead of Intel. This is '
              + 'the era where a processor became far more complicated than the instruction set it runs.'
        },
        {
          title: '2005-2015: more cores, and a processor in every pocket',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A die with two cores over a shared cache">'
             + '<rect x="24" y="14" width="172" height="76" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
             + '<g fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.8">'
             + '<rect x="38" y="26" width="66" height="26" rx="3"/>'
             + '<rect x="116" y="26" width="66" height="26" rx="3"/></g>'
             + '<g font-size="9" fill="currentColor" text-anchor="middle">'
             + '<text x="71" y="43">core 0</text><text x="149" y="43">core 1</text></g>'
             + '<rect x="38" y="62" width="144" height="16" rx="3" style="fill: var(--accent-fg)" opacity="0.5"/>'
             + '<text x="110" y="74" font-size="9" text-anchor="middle" style="fill: var(--fg-on-emphasis)">shared cache</text>'
             + '</svg>',
          facts: [
            { label: 'The parts', value: 'Intel Core 2 Duo, AMD64, ARM Cortex-A, Apple A7' },
            { label: 'What changed', value: 'Speed came from having more cores, and from using less power' }
          ],
          body: 'Two things at once, and they are the same thing seen from two ends. On the desktop the '
              + 'clock stopped rising and the <b>core count</b> started, because power had become the '
              + 'limit. On a phone, power was <em>always</em> the limit, so ARM’s simpler cores were '
              + 'already the right answer - and the volumes of the smartphone paid for the process '
              + 'improvements everything else then used. Apple’s A7 made a phone 64-bit in 2013.'
        },
        {
          title: '2020s: cores of two kinds, and silicon that is not a core at all',
          svg: '<svg width="220" height="104" viewBox="0 0 220 104" aria-label="A die holding performance cores, efficiency cores and a neural engine">'
             + '<rect x="18" y="14" width="184" height="76" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
             + '<g fill="none" stroke="currentColor" stroke-width="1.4">'
             + '<rect x="30" y="24" width="76" height="24" rx="3"/>'
             + '<rect x="116" y="24" width="76" height="24" rx="3"/></g>'
             + '<g font-size="9" fill="currentColor" text-anchor="middle">'
             + '<text x="68" y="40">P-cores</text><text x="154" y="40">E-cores</text></g>'
             + '<rect x="30" y="58" width="162" height="20" rx="3" style="fill: var(--accent-fg)" opacity="0.5"/>'
             + '<text x="111" y="72" font-size="9" text-anchor="middle" style="fill: var(--fg-on-emphasis)">neural engine</text>'
             + '</svg>',
          facts: [
            { label: 'The parts', value: 'Apple M-series, AMD Zen with stacked cache, Intel Core Ultra' },
            { label: 'What changed', value: 'The die stopped being all processor' }
          ],
          body: 'A modern part mixes <b>performance</b> and <b>efficiency</b> cores and sorts the work '
              + 'between them, shares one very wide memory with the graphics unit instead of copying '
              + 'between two, and gives whole regions of silicon to jobs that are not instruction '
              + 'streams at all - matrix multiply for machine learning, video encoding, encryption. The '
              + 'fetch-decode-execute loop is still in there. It is just no longer most of the chip.'
        }
      ]
    }
  },

  /* The source article's five questions, plus one for `generations` - which has to exist because a
     marked section with no question is a section a wrong answer cannot send anybody back to, and
     test_learn.py says so.

     THE QUESTIONS ARE ITS; THE DISTRACTORS ARE NOT. The originals were jokes - "Boil, Toast, Butter",
     pipelining that "only works on cotton fabrics", RISC chips that "only work in cold climates",
     single cores "banned by law", an NPU that "spins the cooling fans" - so three of four options could
     be eliminated by a reader who had not read the page. Each wrong option here is something a person
     could believe after reading it quickly, and two are the right answer to a different question: the
     memory-wall answer for the power wall, and the graphics-copy answer for unified memory. */
  quizzes: {
    'check-yourself': {
      questions: [
        {
          sec: 'cycle',
          q: 'What are the three steps every instruction goes through?',
          options: [
            'Fetch the instruction, decode what it asks for, execute it',
            'Compile it, link it, then load it into memory',
            'Read the operands, write the result, advance the clock'
          ],
          answer: 0
        },
        {
          sec: 'generations',
          q: 'Widening a processor from 16 bits to 32 changed which of these most directly?',
          options: [
            'How much memory a program could address',
            'How many instructions per second the machine could run',
            'How many transistors the instruction set needed to decode'
          ],
          answer: 0
        },
        {
          sec: 'pipelining',
          q: 'Why is pipelining compared to a laundry line?',
          options: [
            'Several instructions are in different stages at once, so one finishes every cycle',
            'Each instruction is cleaned of errors before the next one is allowed to start',
            'The clock is divided four ways, so each stage gets a quarter of it'
          ],
          answer: 0
        },
        {
          sec: 'philosophies',
          q: 'What is the difference between CISC and RISC?',
          options: [
            'CISC instructions each do several steps; RISC keeps them simple and uniform',
            'They are the same instructions, and only the manufacturers differ',
            'RISC has no arithmetic unit, so the compiler does the arithmetic instead'
          ],
          answer: 0
        },
        {
          sec: 'power',
          q: 'Why did manufacturers add cores instead of pushing the clock past about 4 GHz?',
          options: [
            'A higher clock needs a higher voltage too, and the heat became impossible to remove',
            'Memory could not keep up with a faster core, so the extra speed was wasted',
            'A signal cannot cross a chip in less than the time a 4 GHz cycle allows'
          ],
          answer: 0
        },
        {
          sec: 'modern',
          q: 'What makes a neural processing unit different from a CPU core?',
          options: [
            'It is an array of multipliers for one shape of work, with no fetch or decode machinery',
            'It is a small extra core kept in reserve for when the others are busy',
            'It removes the need to copy data between the processor and the graphics unit'
          ],
          answer: 0
        }
      ]
    }
  }
};
