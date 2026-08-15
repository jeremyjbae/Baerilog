#!/usr/bin/env python3
"""Harness for Baerilog/pnr.html: boots the app against the stub DOM and checks
the parser, the macro expansion and the placement.

    python3 Baerilog/test_pnr.py

Runs against the SHIPPED file, not a fresh extraction -- a harness that
re-assembles what it is testing proves the generator works, which is not the
question.
"""

import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP = os.path.join(HERE, 'pnr.html')
FAKEDOM = os.path.join(HERE, 'tools', 'fakedom.js')

DRIVER = r'''
const fs = require('fs');
const { makeDom } = require(%(fakedom)s);
const dom = makeDom();
const document = dom.document, window = dom.window, localStorage = dom.localStorage;

const html = fs.readFileSync(%(app)s, 'utf8');
const body = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

// The stub parses no markup, so every element the app reaches for by id is
// stood up by hand -- the same thing Baerilog/test.py does for the pages.
const grid = dom.mk('__grid');
['exSelect','runBtn','codeInput','pnrSvg','pnrWrap','pnrEmpty',
 'consoleBox','cellTable','rowWidth','viewAbstract','viewDetail',
 'zoomIn','zoomOut','zoomFit','card-place'].forEach(function (id) {
  const tag = id === 'codeInput' ? 'textarea'
            : id === 'exSelect' ? 'select'
            : id === 'pnrSvg' ? 'svg'
            : id === 'rowWidth' ? 'input'
            : id.indexOf('view') === 0 || id.indexOf('zoom') === 0 || id === 'runBtn'
              ? 'button' : 'div';
  dom.mk(id, tag, grid);
});
document.getElementById('pnrWrap').clientWidth = 900;
document.getElementById('rowWidth').value = '320';
document.getElementById('viewAbstract').setAttribute('data-view', 'phantom');
document.getElementById('viewDetail').setAttribute('data-view', 'all');

const api = new Function('document','window','localStorage','setTimeout',
  'clearTimeout','requestAnimationFrame','console',
  body + '\nreturn {PNR_parse,PNR_expand,PNR_place,PNR_run,PNR_cells,PNR_macros,' +
         'PNR_examples,PNR_plan,PNR_setView};')(
  document, window, localStorage, setTimeout, clearTimeout,
  function (f) { return setTimeout(f, 0); }, console);

const out = [];
function check(ok, what, detail) {
  out.push((ok ? 'ok   ' : 'FAIL ') + what + (detail ? '  -- ' + detail : ''));
  if (!ok) process.exitCode = 1;
}

const CELLS = api.PNR_cells();
const MACROS = api.PNR_macros();
const EX = api.PNR_examples();

check(Object.keys(CELLS).length === 11,
      'all 11 cell layouts are inlined', Object.keys(CELLS).sort().join(','));

// every cell carries both views and a non-trivial body
var thin = Object.keys(CELLS).filter(function (n) {
  const v = CELLS[n].views;
  return !v.phantom || !v.all || v.phantom.body.length < 100 || v.all.body.length < 100;
});
check(thin.length === 0, 'every cell has both views with real geometry',
      thin.length ? thin.join(',') : '22 views');

// abutment: one height, rails at the same place, so rows tile
var hs = {}; Object.keys(CELLS).forEach(function (n) { hs[CELLS[n].h] = 1; });
check(Object.keys(hs).length === 1 && Object.keys(hs)[0] === '72000',
      'every cell is the same height, so rows abut', Object.keys(hs).join(','));
var rails = Object.keys(CELLS).filter(function (n) {
  const p = CELLS[n].pins;
  return !p.vdd || !p.vss || p.vdd.bbox[3] !== 72000 || p.vss.bbox[1] !== 0;
});
check(rails.length === 0, 'every cell has vdd at the top and vss at the bottom',
      rails.length ? rails.join(',') : '11 cells');

// ---- parser -------------------------------------------------------------
var n = api.PNR_parse(EX['AND from NAND']);
check(n.name === 'and2' && n.instances.length === 2,
      'the parser reads a module and its instances',
      n.name + ', ' + n.instances.length + ' instances');
check(n.instances[0].type === 'nand_gate' &&
      n.instances[0].conn.a === 'a' && n.instances[0].conn.y === 'n1',
      'named port connections are read', JSON.stringify(n.instances[0].conn));

var threw = false;
try { api.PNR_parse('this is not a netlist'); } catch (e) { threw = true; }
check(threw, 'a source with no module is a reported error, not a silent empty plan');

// ---- macro expansion ----------------------------------------------------
var fa = api.PNR_parse(EX['Full adder (macro)']);
var ex = api.PNR_expand(fa.instances);
check(ex.instances.length === 3 && ex.expanded.length === 1,
      'fa_gate expands into three real cells',
      ex.instances.map(function (i) { return i.type; }).join('+'));
var types = ex.instances.map(function (i) { return i.type; }).sort().join(',');
check(types === 'ha_gate,ha_gate,or_gate',
      'the expansion is two half adders and an OR', types);
// the caller's nets must reach the expansion, and internals must not collide
var conns = {};
ex.instances.forEach(function (i) { conns[i.name] = i.conn; });
check(conns['u_0_ha0'].a === 'a' && conns['u_0_ha0'].b === 'b',
      "the macro's a and b come from the caller", JSON.stringify(conns['u_0_ha0']));
check(conns['u_0_ha1'].sum === 'sum' && conns['u_0_or0'].y === 'cout',
      "the macro's outputs go to the caller", JSON.stringify(conns['u_0_or0']));
check(conns['u_0_ha0'].cout === conns['u_0_or0'].a &&
      conns['u_0_ha0'].cout.indexOf('u_0_') === 0,
      'internal carries are joined and instance-prefixed',
      conns['u_0_ha0'].cout);

var two = api.PNR_expand(api.PNR_parse(EX['2-bit ripple adder']).instances);
var names = {};
two.instances.forEach(function (i) { names[i.name] = (names[i.name] || 0) + 1; });
var dup = Object.keys(names).filter(function (k) { return names[k] > 1; });
check(two.instances.length === 6 && dup.length === 0,
      'two macro instances expand without colliding',
      two.instances.length + ' cells, ' + dup.length + ' duplicate names');
var nets = {};
two.instances.forEach(function (i) {
  Object.keys(i.conn).forEach(function (p) { nets[i.conn[p]] = 1; });
});
check(nets['c1'] === 1, 'the carry between the two adders stays one net');

// ---- placement ----------------------------------------------------------
function overlaps(plan) {
  var bad = [];
  for (var i = 0; i < plan.placed.length; i++) {
    for (var j = i + 1; j < plan.placed.length; j++) {
      var A = plan.placed[i], B = plan.placed[j];
      if (A.x < B.x + B.cell.w && B.x < A.x + A.cell.w &&
          A.y < B.y + B.cell.h && B.y < A.y + A.cell.h) {
        bad.push(A.inst.name + '/' + B.inst.name);
      }
    }
  }
  return bad;
}

Object.keys(EX).forEach(function (name) {
  var parsed = api.PNR_parse(EX[name]);
  var e = api.PNR_expand(parsed.instances);
  var plan = api.PNR_place(e.instances, 320000);

  check(plan.placed.length === e.instances.length && !plan.unplaceable.length,
        'every cell is placed: ' + name,
        plan.placed.length + ' of ' + e.instances.length);
  check(overlaps(plan).length === 0, 'no two cells overlap: ' + name,
        overlaps(plan).join(' ') || plan.rows.length + ' row(s)');

  // cells abut with no gap, and each row starts at x=0
  var gaps = [];
  plan.rows.forEach(function (r) {
    var x = 0;
    r.insts.forEach(function (p) { if (p.x !== x) gaps.push(p.inst.name); x += p.cell.w; });
  });
  check(gaps.length === 0, 'cells abut exactly, no gaps: ' + name,
        gaps.join(',') || 'flush');

  // rows are stacked one cell height apart, in order
  var rowBad = plan.rows.filter(function (r, i) { return r.y !== i * 72000; });
  check(rowBad.length === 0, 'rows tile at one cell height: ' + name,
        rowBad.length ? 'row y wrong' : plan.rows.length + ' x 72000');

  // no row is wider than asked unless one cell alone exceeds it
  var over = plan.rows.filter(function (r) {
    return r.w > 320000 && r.insts.length > 1;
  });
  check(over.length === 0, 'no row exceeds the row width: ' + name,
        over.length ? 'a row is too wide' : 'max ' + plan.width);

  // every pin the netlist names exists in the layout it was placed with
  var missing = [];
  plan.placed.forEach(function (p) {
    Object.keys(p.inst.conn).forEach(function (pin) {
      if (!p.cell.pins[pin]) missing.push(p.inst.type + '.' + pin);
    });
  });
  check(missing.length === 0, 'every netlist pin exists in the layout: ' + name,
        missing.join(',') || 'all resolved');
});

// an unknown cell is reported, not dropped
var un = api.PNR_place(api.PNR_parse(
  'module m (input a, output y);\n  no_such_gate u_0 (.a(a), .y(y));\nendmodule'
).instances, 320000);
check(un.placed.length === 0 && un.unplaceable.length === 1,
      'a cell with no layout is reported as unplaceable',
      un.unplaceable.length + ' unplaceable');

// ---- the app end to end -------------------------------------------------
document.getElementById('codeInput').value = EX['Every cell once'];
var plan = api.PNR_run();
check(plan && plan.placed.length === 11,
      'Place lays out every cell in the library through the UI',
      plan ? plan.placed.length + ' cells' : 'no plan');
var svg = document.getElementById('pnrSvg');
check((svg.innerHTML || '').indexOf('layer-') > 0,
      'the placement really drew the inlined layouts',
      (svg.innerHTML || '').length + ' bytes of svg');
check((svg.getAttribute('viewBox') || '').indexOf('0 0 ') === 0,
      'the placement svg carries a viewBox', svg.getAttribute('viewBox'));
var rep = document.getElementById('consoleBox').textContent || '';
check(rep.indexOf('every instance placed') >= 0,
      'a clean run says so in the report');

// Every class a drawn element uses must have a rule.  This is the numeric
// stand-in for "does it render black": an SVG rect with no matching rule falls
// back to an opaque black fill, and the only rasterizer available here is
// unreliable, so the question is settled by reading the stylesheet instead.
['phantom', 'all'].forEach(function (which) {
  api.PNR_setView(which);
  var html = document.getElementById('pnrSvg').innerHTML || '';
  var style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  var used = {};
  (html.match(/class="[^"]*"/g) || []).forEach(function (m) {
    m.slice(7, -1).split(/\s+/).forEach(function (c) { if (c) used[c] = 1; });
  });
  var unstyled = Object.keys(used).filter(function (c) {
    return style.indexOf('.' + c) < 0 && c.indexOf('pnr-') !== 0;
  });
  check(unstyled.length === 0,
        'every class the ' + which + ' view draws has a rule',
        unstyled.length ? unstyled.join(',') : Object.keys(used).length + ' classes');
  check((style.match(/\/\*/g) || []).length === (style.match(/\*\//g) || []).length &&
        (style.match(/\{/g) || []).length === (style.match(/\}/g) || []).length,
        'the ' + which + ' view stylesheet is balanced',
        'an unclosed comment or brace would swallow every rule after it');
  check(style.indexOf('.ap-abox') > 0 && /\.ap-abox[^{]*\{[^}]*fill:\s*none/.test(style),
        'the ' + which + ' abox rule still says fill:none',
        'without it the cell outline is an opaque black rectangle');
});

api.PNR_setView('all');
check((document.getElementById('pnrSvg').innerHTML || '').indexOf('layer-') > 0,
      'the Detail view renders too');

console.log(out.join('\n'));
'''


def css_checks():
    """The editor's own styling, which no headless DOM here can see.

    Comments are stripped first and EVERY matching rule is scanned, not the
    first: the shared narrow-screen block declares .editor-wrap textarea a
    second time to raise it to 16px on a phone, and a check that took the first
    match or grepped the raw file would pass while comparing nothing.  Both
    traps are recorded in CLAUDE.md; this is the third instance.
    """
    out = []

    def ck(ok, what, detail=''):
        out.append(('ok   ' if ok else 'FAIL ') + what +
                   ('  -- ' + detail if detail else ''))
        return ok

    html = open(APP).read()
    css = re.sub(r'/\*.*?\*/', '', html[html.index('<style>'):html.index('</style>')],
                 flags=re.S)
    rules = re.findall(r'([^{}]+)\{([^{}]*)\}', css)

    def bodies(sel):
        return [b for s_, b in rules
                if any(part.strip() == sel for part in s_.split(','))]

    ed = bodies('.editor-wrap textarea')
    ok = ck(bool(ed), 'the app declares a rule for .editor-wrap textarea',
            '%d rule(s)' % len(ed))
    if ok:
        want = ('font', 'white-space', 'background', 'color')
        full = [b for b in ed if all(w in b for w in want)]
        ck(bool(full),
           'one .editor-wrap textarea rule carries font, white-space, background and colour',
           'without it the netlist renders as proportional wrapped text')
        ck(any('pre' in b for b in ed if 'white-space' in b),
           'the editor is white-space: pre, so a netlist keeps its indentation')
    ck(bool(bodies('.editor-wrap')),
       'the app declares a rule for .editor-wrap itself',
       'the panel needs a background and a height')
    ck('class="gutter"' not in html and 'id="gutter"' not in html,
       'there is no line-number gutter',
       'synthesis.html\'s netlist viewer has none either')

    # the phone override must still out-specify the base rule
    narrow = [b for s_, b in rules
              if any(part.strip() == 'body .editor-wrap textarea'
                     for part in s_.split(','))]
    ck(any('16px' in b for b in narrow),
       'the shared narrow-screen rule still raises the editor to 16px',
       'iOS zooms the page on a focused control under 16px')
    return out


def main():
    drv = DRIVER % {'fakedom': json.dumps(FAKEDOM), 'app': json.dumps(APP)}
    path = os.path.join('/tmp', 'pnr_driver.js')
    open(path, 'w').write(drv)
    p = subprocess.run(['node', '--stack-size=8000', path],
                       capture_output=True, text=True)
    print(p.stdout.strip())
    if p.stderr.strip():
        print(p.stderr.strip(), file=sys.stderr)
    extra = css_checks()
    print('\n'.join(extra))
    ok = p.stdout.count('ok   ') + sum(1 for l in extra if l.startswith('ok'))
    bad = p.stdout.count('FAIL ') + sum(1 for l in extra if l.startswith('FAIL'))
    print('\n%d checks, %d failing' % (ok + bad, bad))
    return 1 if (bad or p.returncode) else 0


if __name__ == '__main__':
    sys.exit(main())
