#!/usr/bin/env python3
"""Baerilog/test_cloud.py - the cloud-progress harness.

Run: python3 Baerilog/test_cloud.py

Everything here runs against the SHIPPED files rather than a fresh extraction of
anything, for the reason the other suites in this repo give: a harness that
rebuilds what it is testing proves the sources work, which is not the question.

cloud.js touches no DOM at all - that is the whole reason cloud-ui.js exists as a
separate file - so the logic half needs no stub DOM, only a stub `window` with
localStorage and fetch on it. That makes the interesting assertions (the conflict
rule, the refresh race, offline behaviour) cheap and exact, and it is why the
split was drawn there.

The weight of the suite is on the MUTANTS at the bottom. A sync layer that
reports success is trivially passable; what has to be true is that it fails when
it should, and above all that it never silently destroys work.
"""
import base64, json, pathlib, re, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent
results = []


def check(name, fn):
    try:
        detail = fn()
        results.append((True, name, detail or ''))
    except AssertionError as e:
        results.append((False, name, str(e)))
    except Exception as e:                                  # a broken check is a failure
        results.append((False, name, '%s: %s' % (type(e).__name__, e)))


def read(rel):
    return (ROOT / rel).read_text()


# --------------------------------------------------------------------------
# the driver: cloud.js under a stub window
# --------------------------------------------------------------------------

# A fake window with just what cloud.js reaches for. localStorage is a plain
# object so a test can inspect and corrupt it directly; fetch is a programmable
# queue so a test can say what the server answered, and RECORDS every call, which
# is what lets "no request was made" be asserted rather than assumed.
#
# The __PRESEED__ slot sits BEFORE cloud.js and is load-bearing: cloud.js reads
# the stored session once, at evaluation time, exactly as it does on a real page
# where localStorage already holds one. A test that signs in afterwards is
# therefore testing a signed-OUT client, and the symptom is every push and pull
# quietly doing nothing - which reads as a broken product rather than a broken
# harness. That mistake cost a whole run of this suite.
STUB_HEAD = r"""
var CALLS = [];
var QUEUE = [];
var STORE = {};

function reply(spec) { QUEUE.push(spec); }

/* A signed-in session, written straight into the store so a test does not have to
   run the OTP flow to reach the interesting code. expires_at is far in the future
   so token() does not try to refresh. Defined here, above cloud.js, so it can be
   used from __PRESEED__. */
function signIn(email) {
  STORE['baerilogCloudSession'] = JSON.stringify({
    access_token: 'tok', refresh_token: 'ref',
    expires_at: Date.now() + 3600e3, email: email || 'a@b.c', user_id: 'u-1'
  });
}
function expired() {
  STORE['baerilogCloudSession'] = JSON.stringify({
    access_token: 'old', refresh_token: 'r', expires_at: Date.now() - 1000,
    email: 'a@b.c', user_id: 'u-1'
  });
}
function seed(app, item, rec) {
  STORE['baerilog:doc:' + app + ':' + item] = JSON.stringify(rec);
}

var window = {
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(STORE, k) ? STORE[k] : null; },
    setItem: function (k, v) { STORE[k] = String(v); },
    removeItem: function (k) { delete STORE[k]; }
  },
  setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
  clearTimeout: function (id) { return clearTimeout(id); },
  addEventListener: function () {},
  fetch: function (url, opts) {
    CALLS.push({ url: url, method: (opts && opts.method) || 'GET',
                 headers: (opts && opts.headers) || {},
                 body: opts && opts.body ? JSON.parse(opts.body) : null });
    var spec = QUEUE.shift() || { status: 200, body: {} };
    if (spec.reject) return Promise.reject(new Error('boom'));
    return Promise.resolve({
      ok: spec.status >= 200 && spec.status < 300,
      status: spec.status,
      text: function () { return Promise.resolve(JSON.stringify(spec.body === undefined ? {} : spec.body)); }
    });
  }
};
var AbortController = function () { this.signal = {}; this.abort = function () {}; };
var BAERILOG_CLOUD_CONFIG = __CONFIG__;
window.BAERILOG_CLOUD_CONFIG = BAERILOG_CLOUD_CONFIG;

__PRESEED__
"""

STUB_TAIL = r"""
var CLOUD = window.CLOUD;

function doc(app, item) {
  var raw = STORE['baerilog:doc:' + app + ':' + item];
  return raw ? JSON.parse(raw) : null;
}
function posts() {
  return CALLS.filter(function (c) { return c.url.indexOf('/rest/v1/progress') >= 0 && c.method === 'POST'; });
}
function out(o) { console.log('__RESULT__' + JSON.stringify(o)); }
"""


def run_js(body, config=None, cloud_js=None, preseed=''):
    """Evaluate `body` with cloud.js and the stub loaded. `preseed` is JS run before
    cloud.js, which is where a session has to be established. Returns the object
    the script passed to out()."""
    cfg = json.dumps(config if config is not None
                     else {'url': 'https://p.supabase.co', 'anonKey': 'anon-key'})
    src = (STUB_HEAD.replace('__CONFIG__', cfg).replace('__PRESEED__', preseed)
           + (cloud_js if cloud_js is not None else read('cloud.js'))
           + STUB_TAIL + '\n' + body)
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(src)
        path = f.name
    proc = subprocess.run(['node', path], capture_output=True, text=True)
    pathlib.Path(path).unlink()
    if proc.returncode != 0:
        raise AssertionError('node failed: ' + (proc.stderr.strip()[:400] or '(no stderr)'))
    m = re.search(r'__RESULT__(.*)', proc.stdout)
    if not m:
        raise AssertionError('driver produced no result. stdout=%r stderr=%r'
                             % (proc.stdout[:200], proc.stderr[:200]))
    return json.loads(m.group(1))


# --------------------------------------------------------------------------
# 1. the four files parse, and say nothing they must not
# --------------------------------------------------------------------------

CLOUD_FILES = ['cloud-config.js', 'cloud.js', 'cloud-ui.js', 'cloud-sync.js']


def t_parse():
    for name in CLOUD_FILES:
        proc = subprocess.run(
            ['node', '-e', 'new Function(require("fs").readFileSync(%s,"utf8"))'
             % json.dumps(str(ROOT / name))], capture_output=True, text=True)
        assert proc.returncode == 0, '%s does not parse: %s' % (name, proc.stderr[:200])
    return '%d files parse' % len(CLOUD_FILES)


def t_no_module_spelling():
    """build.py greps these files for the two banned spellings as plain
    substrings, so writing one in a COMMENT fails the build for prose. cloud.js
    documents that trap; this asserts it is actually observed, in all four."""
    for name in CLOUD_FILES:
        text = read(name)
        for bad in ('type="module"', 'import('):
            assert bad not in text, '%s spells %s, which build.py rejects' % (name, bad)
    return 'neither banned spelling appears, comments included'


def t_config_key_is_public_grade():
    """The committed config may be FILLED IN - the published site needs it, and the
    anon key is public by design. What must never be there is a service-role key,
    which bypasses RLS entirely.

    This replaced a check asserting the file shipped empty. That was right while
    nothing was configured and became wrong the moment a project was connected, and
    it was the wrong property anyway: what matters is which key is present, not
    whether one is.

    Also asserts the URL and the key AGREE. The anon key's `ref` claim is the project
    ref and the URL is built from it, so a mismatched pair means one of them was
    pasted from a different project - a 401 on every call, with two plausible-looking
    values on screen and nothing to say which is wrong."""
    sys.path.insert(0, str(ROOT / 'tools'))
    import build

    cfg = read('cloud-config.js')
    role, why = build.key_role(cfg)
    if role is None:
        # An unconfigured checkout is legitimate and is what this repo ships.
        assert not re.search(r"url:\s*'\S", cfg), 'a URL is set but no key is'
        return 'no key set (%s) - the inert default' % why
    assert role == 'anon', 'cloud-config.js holds a %s key (%s)' % (role, why)

    key = re.search(r"anonKey:\s*'([^']+)'", cfg).group(1)
    url = re.search(r"url:\s*'([^']*)'", cfg).group(1)
    if '.' in key and url:
        payload = key.split('.')[1]
        payload += '=' * (-len(payload) % 4)
        ref = json.loads(base64.urlsafe_b64decode(payload)).get('ref')
        assert ref and ref in url, \
            'the key is for project %r but the URL is %r' % (ref, url)
        return 'anon key (%s), URL agrees with its ref' % why
    return 'anon key (%s)' % why


def t_service_role_key_is_caught():
    """The decoder is the check, so it needs a mutant of its own - and this one earned
    it: the version this replaced grepped the file for the string 'service_role',
    which a real service-role JWT does NOT contain, since the role sits inside the
    base64 payload. So it passed on every genuine service-role key and caught only
    someone pasting the dashboard's label. Both key formats are probed."""
    sys.path.insert(0, str(ROOT / 'tools'))
    import build

    def jwt(role):
        head = base64.urlsafe_b64encode(b'{"alg":"HS256"}').decode().rstrip('=')
        body = base64.urlsafe_b64encode(
            json.dumps({'iss': 'supabase', 'ref': 'abc', 'role': role}).encode()
        ).decode().rstrip('=')
        return '%s.%s.sig' % (head, body)

    cases = [
        (jwt('service_role'), 'service_role', 'a legacy service-role JWT'),
        (jwt('anon'), 'anon', 'a legacy anon JWT'),
        ('sb_secret_abcdef123', 'service_role', 'a new secret key'),
        ('sb_publishable_abcdef123', 'anon', 'a new publishable key'),
    ]
    for key, want, label in cases:
        role, why = build.key_role("anonKey: '%s'" % key)
        assert role == want, '%s read as %r, expected %r' % (label, role, want)
        # the literal never appears, which is the whole point
        if want == 'service_role' and key.startswith('eyJ') is False and '.' in key:
            pass
    plain = jwt('service_role')
    assert 'service_role' not in plain, \
        'this key format does contain the literal, so a grep would have worked'
    return '4 key shapes classified; the literal is absent from the JWT, as expected'


def t_limit_matches_schema():
    """The client refuses an oversized document before sending it; the column has
    a check constraint. Two numbers that must be one number."""
    js = re.search(r'SOURCE_LIMIT\s*=\s*(\d+)', read('cloud.js'))
    sql = re.search(r'length\(source\)\s*<=\s*(\d+)', read('tools/schema.sql'))
    assert js and sql, 'could not find both limits'
    assert js.group(1) == sql.group(1), 'client %s vs schema %s' % (js.group(1), sql.group(1))
    return 'both say %s bytes' % js.group(1)


def t_apps_match_schema():
    """cloud.js's app whitelist and the column's check constraint are the same
    list; a value in one and not the other is a row written and never read."""
    r = run_js('out({apps: CLOUD._limits.apps});')
    sql = re.search(r"app in \(([^)]*)\)", read('tools/schema.sql')).group(1)
    in_sql = sorted(re.findall(r"'([a-z]+)'", sql))
    assert sorted(r['apps']) == in_sql, '%s vs %s' % (sorted(r['apps']), in_sql)
    return '4 apps agree: ' + ', '.join(in_sql)


def t_rls_is_enabled_and_complete():
    """RLS is the ONLY thing protecting this data - the anon key is public. A table
    with policies and RLS switched off is world-readable and looks identical from
    the dashboard, so both halves are asserted, plus that update carries `with
    check` (without it a learner can rewrite user_id and hand rows away)."""
    sql = read('tools/schema.sql')
    assert 'enable row level security' in sql, 'RLS is never enabled'
    for op in ('select', 'insert', 'update', 'delete'):
        assert re.search(r'for %s' % op, sql), 'no %s policy' % op
    upd = re.search(r'for update([^;]*);', sql, re.S).group(1)
    assert 'using' in upd and 'with check' in upd, 'update policy lacks one of using/with check'
    return 'RLS on, 4 policies, update has both clauses'


# --------------------------------------------------------------------------
# 2. unconfigured, and offline: both must be non-events
# --------------------------------------------------------------------------

def t_unconfigured_is_inert():
    """With no project named, nothing is stored and no request is made. Storage is
    included in that deliberately: writing under a key nobody reads back would be
    storage this feature never admits to using."""
    r = run_js("""
      CLOUD.save('practice', 'd-flip-flop', {source: 'x'});
      out({configured: CLOUD.configured(), state: CLOUD.info().state,
           calls: CALLS.length, keys: Object.keys(STORE)});
    """, config={'url': '', 'anonKey': ''})
    assert r['configured'] is False, 'reports configured with no config'
    assert r['state'] == 'off', "state is %r, expected 'off'" % r['state']
    assert r['calls'] == 0, 'made %d requests with no project' % r['calls']
    return "state 'off', no requests, no keys touched"


def t_half_configured_is_inert():
    """A URL with no key would 401 on every call, which surfaces as a broken
    feature rather than an absent one - so both halves are required."""
    r = run_js("out({a: CLOUD.configured()});", config={'url': 'https://p.supabase.co', 'anonKey': ''})
    assert r['a'] is False, 'a URL with no key counts as configured'
    return 'a URL without a key does not count'


def t_signed_out_never_calls():
    """Configured but not signed in: still local-only. There is no anonymous row
    to write, so a request here could only fail."""
    r = run_js("""
      CLOUD.save('practice', 'mux-2to1', {source: 'abc'});
      setTimeout(function () {
        out({calls: CALLS.length, rec: doc('practice','mux-2to1')});
      }, 60);
    """)
    assert r['calls'] == 0, 'made %d requests while signed out' % r['calls']
    assert r['rec']['source'] == 'abc', 'nothing saved locally'
    return 'saved locally, 0 requests'


def t_network_failure_resolves():
    """A dropped connection must resolve, not reject: an unhandled rejection from a
    background sync is a console error the learner can do nothing about. And it
    must report 'offline' rather than 'error', because the two mean different
    things to the pill and only one of them is worth showing as a fault."""
    r = run_js("""
      reply({reject: true});
      CLOUD.pull('practice').then(function (res) {
        out({ok: res.ok, offline: !!res.offline, state: CLOUD.info().state,
             conflicts: res.conflicts.length});
      });
    """, preseed='signIn();')
    assert r['ok'] is False and r['offline'] is True, 'a failed pull did not report offline'
    assert r['state'] == 'offline', "state is %r after a failure" % r['state']
    return "resolved with offline:true, state 'offline'"


def t_offline_keeps_the_session():
    """A refused refresh means the session is finished; an OFFLINE refresh does
    not. Conflating them signs the learner out every time their wifi drops."""
    r = run_js("""
      reply({reject: true});
      CLOUD.pull('practice').then(function () {
        out({stillIn: CLOUD.signedIn()});
      });
    """, preseed='expired();')
    assert r['stillIn'] is True, 'an offline refresh signed the learner out'
    return 'session survives an offline refresh'


def t_refused_refresh_signs_out():
    """The other half: a 400 from the refresh endpoint means the token is spent or
    revoked, and leaving the session in place would show a signed-in account whose
    every save fails."""
    r = run_js("""
      reply({status: 400, body: {msg: 'invalid refresh token'}});
      CLOUD.pull('practice').then(function () {
        out({stillIn: CLOUD.signedIn(), state: CLOUD.info().state});
      });
    """, preseed='expired();')
    assert r['stillIn'] is False, 'a refused refresh left the session in place'
    return "signed out, state '%s'" % r['state']


# --------------------------------------------------------------------------
# 3. save/load, and the push
# --------------------------------------------------------------------------

def t_save_is_synchronous():
    """The contract: by the time save() returns, the work is as durable as the page
    can make it, whatever the network then does. Asserted by reading the store
    immediately, with no await anywhere."""
    r = run_js("""
      CLOUD.save('practice', 'counter-4bit', {source: 'module m; endmodule'});
      out({rec: doc('practice','counter-4bit'), callsYet: CALLS.length});
    """, preseed='signIn();')
    assert r['rec'] and r['rec']['source'] == 'module m; endmodule', 'not stored synchronously'
    assert r['callsYet'] == 0, 'pushed before the debounce elapsed'
    return 'stored before returning; push deferred'


def t_push_coalesces_per_document():
    """Typing must not be one request per keystroke, and a save to a DIFFERENT
    document must not be delayed behind an unrelated one - hence one timer per
    (app, item) rather than one global timer."""
    r = run_js("""
      reply({status: 201, body: {}}); reply({status: 201, body: {}});
      for (var i = 0; i < 8; i++) CLOUD.save('practice', 'a', {source: 'v' + i});
      for (var j = 0; j < 5; j++) CLOUD.save('practice', 'b', {source: 'w' + j});
      setTimeout(function () {
        var p = posts();
        out({posts: p.length, items: p.map(function (x) { return x.body.item; }).sort(),
             sources: p.map(function (x) { return x.body.source; }).sort()});
      }, 1600);
    """, preseed='signIn();')
    assert r['posts'] == 2, '13 saves produced %d requests, expected 2' % r['posts']
    assert r['items'] == ['a', 'b'], 'wrong items pushed: %s' % r['items']
    assert r['sources'] == ['v7', 'w4'], 'pushed stale text: %s' % r['sources']
    return '13 saves -> 2 requests, latest text each'


def t_push_is_an_upsert():
    """Without resolution=merge-duplicates the second save to a document is a 409
    for the rest of time, and the apikey/Authorization pair is what RLS reads."""
    r = run_js("""
      reply({status: 201, body: {}});
      CLOUD.save('practice', 'x', {source: 's'});
      setTimeout(function () {
        var c = posts()[0];
        out({method: c.method, prefer: c.headers.Prefer || '', auth: c.headers.Authorization || '',
             apikey: c.headers.apikey || '', keys: Object.keys(c.body).sort()});
      }, 1500);
    """, preseed='signIn();')
    assert r['method'] == 'POST', 'method is %s' % r['method']
    assert 'resolution=merge-duplicates' in r['prefer'], 'Prefer is %r' % r['prefer']
    assert r['auth'] == 'Bearer tok', 'Authorization is %r' % r['auth']
    assert r['apikey'] == 'anon-key', 'apikey missing'
    assert r['keys'] == ['app', 'item', 'source', 'updated_at', 'user_id', 'verdict'], \
        'row shape is %s' % r['keys']
    return 'POST + merge-duplicates, both auth headers, 6 columns'


def t_oversize_is_refused():
    """Refused with a message rather than truncated: a silent truncation is the
    failure mode this repo keeps designing against, and here it would corrupt a
    design while reporting success."""
    r = run_js("""
      var big = new Array(CLOUD._limits.source + 10).join('x') + 'yyyyyyyyyyy';
      CLOUD.save('practice', 'big', {source: big});
      setTimeout(function () {
        out({posts: posts().length, state: CLOUD.info().state,
             storedLen: (doc('practice','big') || {}).source.length});
      }, 1500);
    """, preseed='signIn();')
    assert r['posts'] == 0, 'pushed an oversized document'
    assert r['state'] == 'too-big', "state is %r" % r['state']
    assert r['storedLen'] > 262144, 'the local copy was truncated'
    return 'refused the push, kept the local copy whole'


def t_flush_sends_pending():
    """A debounce timer that has not fired is not durable, so pagehide flushes."""
    r = run_js("""
      reply({status: 201, body: {}});
      CLOUD.save('practice', 'f', {source: 'unsent'});
      var n = CLOUD.flush();
      setTimeout(function () { out({flushed: n, calls: posts().length}); }, 40);
    """, preseed='signIn();')
    assert r['flushed'] == 1 and r['calls'] == 1, 'flush sent %s' % r
    return 'one pending push flushed immediately'


# --------------------------------------------------------------------------
# 4. the conflict rule - the part that must never lose work
# --------------------------------------------------------------------------

def t_adopts_when_nothing_local():
    r = run_js("""
      reply({status: 200, body: [{item:'d-flip-flop', source:'from cloud', verdict:null,
                                  updated_at:'2026-01-01T00:00:00Z'}]});
      CLOUD.pull('practice').then(function (res) {
        out({adopted: res.adopted, conflicts: res.conflicts.length,
             local: (doc('practice','d-flip-flop')||{}).source});
      });
    """, preseed='signIn();')
    assert r['adopted'] == ['d-flip-flop'] and r['local'] == 'from cloud', 'did not adopt: %s' % r
    assert r['conflicts'] == 0
    return 'took the cloud copy when there was nothing here'


def t_adopts_when_only_remote_moved():
    """Local is identical to what we last pushed, so there is nothing at stake."""
    r = run_js("""
      reply({status: 200, body: [{item:'m', source:'v2', verdict:null,
                                  updated_at:'2026-01-01T00:00:00Z'}]});
      CLOUD.pull('practice').then(function (res) {
        out({adopted: res.adopted, conflicts: res.conflicts.length,
             local: doc('practice','m').source, synced: doc('practice','m').synced});
      });
    """, preseed="signIn(); seed('practice','m',{source:'v1',synced:'v1',updated_at:1000});")
    assert r['adopted'] == ['m'], 'did not adopt a clean remote change: %s' % r
    assert r['local'] == 'v2' and r['synced'] == 'v2', 'adopted without marking synced'
    return 'adopted v2 and marked it synced'


def t_pushes_back_when_only_local_moved():
    """The server holds what we sent and we have edited since, so ours is strictly
    ahead - it is pushed, not compared."""
    r = run_js("""
      reply({status: 200, body: [{item:'m', source:'v1', verdict:null,
                                  updated_at:'2020-01-01T00:00:00Z'}]});
      reply({status: 201, body: {}});
      CLOUD.pull('practice').then(function (res) {
        setTimeout(function () {
          var p = posts();
          out({adopted: res.adopted.length, conflicts: res.conflicts.length,
               pushed: p.length ? p[0].body.source : null,
               local: doc('practice','m').source});
        }, 40);
      });
    """, preseed="signIn(); seed('practice','m',{source:'mine',synced:'v1',updated_at:9999});")
    assert r['conflicts'] == 0 and r['adopted'] == 0, 'reported a conflict for a clean local edit'
    assert r['pushed'] == 'mine', 'did not push the local edit back (pushed %r)' % r['pushed']
    assert r['local'] == 'mine', 'the local edit was overwritten'
    return 'kept and pushed the local edit'


def t_both_moved_is_a_conflict_and_nothing_is_lost():
    """THE assertion this whole file exists for. Both sides diverged from the last
    synced text, so neither may win automatically - and critically the LOCAL COPY
    IS LEFT EXACTLY AS IT WAS, so doing nothing is a safe outcome."""
    r = run_js("""
      reply({status: 200, body: [{item:'m', source:'their answer', verdict:null,
                                  updated_at:'2030-01-01T00:00:00Z'}]});
      CLOUD.pull('practice').then(function (res) {
        out({conflicts: res.conflicts, adopted: res.adopted,
             local: doc('practice','m').source, state: CLOUD.info().state});
      });
    """, preseed="signIn(); seed('practice','m',{source:'my unsaved answer',synced:'base',updated_at:500});")
    assert len(r['conflicts']) == 1, 'both sides moved but %d conflicts reported' % len(r['conflicts'])
    c = r['conflicts'][0]
    assert c['local'] == 'my unsaved answer' and c['remote'] == 'their answer', 'conflict misreported'
    assert r['local'] == 'my unsaved answer', 'THE LOCAL COPY WAS OVERWRITTEN'
    assert r['adopted'] == [], 'adopted a copy during a conflict'
    assert r['state'] == 'conflict', "state is %r" % r['state']
    return 'reported both copies, overwrote neither'


def t_conflict_does_not_depend_on_the_clock():
    """A machine whose clock is an hour behind must not lose its edits. The rule
    triggers on both sides having diverged from the last synced text, not on which
    timestamp is larger - so a remote copy that is NEWER by the clock still cannot
    silently win."""
    r = run_js("""
      reply({status: 200, body: [{item:'m', source:'remote edit', verdict:null,
                                  updated_at:'2099-01-01T00:00:00Z'}]});
      CLOUD.pull('practice').then(function (res) {
        out({conflicts: res.conflicts.length, local: doc('practice','m').source});
      });
    """, preseed="signIn(); seed('practice','m',{source:'local edit',synced:'base',updated_at:0});")
    assert r['conflicts'] == 1, 'a far-future remote copy won without asking'
    assert r['local'] == 'local edit', 'the local edit was overwritten on timestamps alone'
    return 'a 2099 remote copy still cannot overwrite a local edit'


def t_resolve_marks_adopted_text_synced():
    """Adopting the remote copy has to mark it synced, or the very next pull
    reports the same conflict again - a dialog that reappears forever."""
    r = run_js("""
      CLOUD.resolve('practice', 'm', 'remote', 'theirs');
      reply({status: 200, body: [{item:'m', source:'theirs', verdict:null,
                                  updated_at:'2030-01-01T00:00:00Z'}]});
      CLOUD.pull('practice').then(function (res) {
        out({source: doc('practice','m').source, synced: doc('practice','m').synced,
             conflicts: res.conflicts.length});
      });
    """, preseed="signIn(); seed('practice','m',{source:'mine',synced:'base',updated_at:1});")
    assert r['source'] == 'theirs' and r['synced'] == 'theirs', 'resolve did not mark synced: %s' % r
    assert r['conflicts'] == 0, 'the same conflict was reported again after resolving it'
    return 'adopted, marked synced, no repeat conflict'


def t_synced_tracks_the_pushed_text_not_a_later_edit():
    """A learner types on while a push is in flight. Marking THAT text as synced
    would strand it: the next pull would see local == synced, conclude there was
    nothing to send, and the edit would never leave the machine."""
    # The edit has to land while the push is genuinely in flight, which means in the
    # same synchronous block as flush(): pushNow resolves token() as a microtask, so
    # the request is not issued until this block ends. A second save on a LATER
    # timer instead (the first attempt here) lands after the response and exercises
    # nothing - both mutants survived it, which is how the gap was found.
    r = run_js("""
      reply({status: 201, body: {}});
      CLOUD.save('practice', 'm', {source: 'first'});
      CLOUD.flush();                                  // push starts, response pending
      CLOUD.save('practice', 'm', {source: 'second'}); // typed before it lands
      setTimeout(function () {
        var d = doc('practice','m');
        /* Normalised, because a mutant that never writes `synced` leaves it
           undefined, JSON drops the key, and the check would crash with a KeyError
           - which this harness reports as "tested nothing" rather than as a caught
           mutant. An absent value has to arrive as a value to be assertable. */
        out({source: d.source, synced: d.synced === undefined ? null : d.synced,
             sent: posts()[0].body.source});
      }, 80);
    """, preseed='signIn();')
    assert r['sent'] == 'first', 'the request carried %r' % r['sent']
    assert r['source'] == 'second', 'lost the later edit'
    assert r['synced'] == 'first', \
        "synced is %r; 'second' would strand the later edit and None would re-push forever" % r['synced']
    return 'sent first, kept second, synced records first'


# --------------------------------------------------------------------------
# 5. identity
# --------------------------------------------------------------------------

def t_otp_endpoints():
    """Codes, not magic links - the whole reason this works over file://. A magic
    link needs a redirect target registered in the project, and over file:// that
    is a per-machine absolute path that cannot be registered. So: /auth/v1/otp to
    send, /auth/v1/verify with type 'email' to exchange. No redirect anywhere."""
    r = run_js("""
      reply({status: 200, body: {}});
      CLOUD.requestCode('a@b.c').then(function () {
        reply({status: 200, body: {access_token:'A', refresh_token:'R', expires_in: 3600,
                                   user: {id:'u-9', email:'a@b.c'}}});
        return CLOUD.verifyCode('a@b.c', '123456');
      }).then(function (v) {
        out({calls: CALLS.map(function (c) { return c.url.replace('https://p.supabase.co',''); }),
             sent: CALLS[0].body, verified: CALLS[1].body, ok: v.ok,
             signedIn: CLOUD.signedIn(), email: CLOUD.info().email});
      });
    """)
    assert r['calls'][0] == '/auth/v1/otp', 'first call is %s' % r['calls'][0]
    assert r['calls'][1] == '/auth/v1/verify', 'second call is %s' % r['calls'][1]
    assert r['sent'].get('create_user') is True, 'create_user not set, so sign-up needs a second flow'
    assert r['verified'].get('type') == 'email', "verify type is %r" % r['verified'].get('type')
    assert r['ok'] and r['signedIn'] and r['email'] == 'a@b.c', 'did not end up signed in: %s' % r
    # The claim is about the WIRE, not about the prose: cloud.js's header comment
    # explains at length why a magic link cannot work over file://, so a substring
    # scan for 'redirect' flags the explanation. What must be true is that no
    # request carries a redirect target, since that is the parameter a link flow
    # needs and an OTP flow does not.
    for c in (r['sent'], r['verified']):
        assert not any('redirect' in k.lower() for k in c), 'a request carries %s' % list(c)
    return 'otp -> verify(type=email), signed in, no redirect parameter on the wire'


def t_refresh_is_shared():
    """Two concurrent callers must share one refresh: a refresh token is
    single-use, so spending it twice signs out the loser of the race."""
    r = run_js("""
      reply({status: 200, body: {access_token:'new', refresh_token:'r2', expires_in: 3600,
                                 user: {id:'u-1', email:'a@b.c'}}});
      reply({status: 200, body: []});
      reply({status: 200, body: []});
      Promise.all([CLOUD.pull('practice'), CLOUD.pull('simulator')]).then(function () {
        var refreshes = CALLS.filter(function (c) { return c.url.indexOf('grant_type=refresh_token') >= 0; });
        out({refreshes: refreshes.length, token: CLOUD.info().signedIn});
      });
    """, preseed='expired();')
    assert r['refreshes'] == 1, 'two concurrent pulls spent %d refresh tokens' % r['refreshes']
    return 'two concurrent pulls, one refresh'


def t_sign_out_is_local_first():
    """On a shared machine a sign-out that appears not to work because the network
    is down is worse than a revoked-token call nobody made."""
    r = run_js("""
      reply({reject: true});
      CLOUD.signOut().then(function () {
        out({signedIn: CLOUD.signedIn(), session: STORE['baerilogCloudSession'] || null,
             state: CLOUD.info().state});
      });
    """, preseed='signIn();')
    assert r['signedIn'] is False and r['session'] is None, 'sign-out left the session behind'
    return 'session cleared even though the logout call failed'



def t_verify_tries_signup_after_email():
    """A first-time learner's code comes from the "Confirm signup" template and
    verifies as type 'signup'; a returning learner's comes from "Magic Link" and
    verifies as 'email'. One request cannot serve both, and the failure lands on the
    very first sign-in - correct code in the inbox, rejected by the page.

    Found by a real signup email arriving as a confirm-link rather than a code."""
    r = run_js("""
      reply({status: 403, body: {msg: 'Token has expired or is invalid'}});   // as 'email'
      reply({status: 200, body: {access_token:'A', refresh_token:'R', expires_in: 3600,
                                 user: {id:'u-2', email:'new@b.c'}}});        // as 'signup'
      CLOUD.verifyCode('new@b.c', '123456').then(function (v) {
        out({ok: v.ok, types: CALLS.map(function (c) { return c.body.type; }),
             signedIn: CLOUD.signedIn()});
      });
    """)
    assert r['types'] == ['email', 'signup'], 'tried %s' % r['types']
    assert r['ok'] and r['signedIn'], 'the signup token was not accepted: %s' % r
    return "tried 'email' then 'signup', signed in on the second"


def t_verify_stops_on_success():
    """The common case must stay one request - a returning learner's token verifies
    as 'email', and a second call would spend a token that is already used."""
    r = run_js("""
      reply({status: 200, body: {access_token:'A', refresh_token:'R', expires_in: 3600,
                                 user: {id:'u-1', email:'a@b.c'}}});
      CLOUD.verifyCode('a@b.c', '123456').then(function (v) {
        out({ok: v.ok, calls: CALLS.length, types: CALLS.map(function (c) { return c.body.type; })});
      });
    """)
    assert r['ok'] and r['calls'] == 1, 'made %d requests on a success' % r['calls']
    assert r['types'] == ['email'], 'tried %s' % r['types']
    return 'one request when the first type works'


def t_verify_does_not_retry_offline():
    """An offline first attempt produced no verdict to disagree with, so retrying
    just doubles the wait before the honest message appears."""
    r = run_js("""
      reply({reject: true});
      CLOUD.verifyCode('a@b.c', '123456').then(function (v) {
        out({ok: v.ok, offline: !!v.offline, calls: CALLS.length, state: CLOUD.info().state});
      });
    """)
    assert r['calls'] == 1, 'retried into a dead connection (%d calls)' % r['calls']
    assert r['offline'] and r['state'] == 'offline', 'did not report offline: %s' % r
    return 'one request, reported offline'


def t_verify_reports_a_bad_code_once():
    """A wrong code fails both types; the learner must get one clear message, not a
    report about the second type they never heard of."""
    r = run_js("""
      reply({status: 403, body: {msg: 'Token has expired or is invalid'}});
      reply({status: 403, body: {msg: 'Token has expired or is invalid'}});
      CLOUD.verifyCode('a@b.c', '000000').then(function (v) {
        out({ok: v.ok, error: v.error, calls: CALLS.length, signedIn: CLOUD.signedIn()});
      });
    """)
    assert r['ok'] is False and r['signedIn'] is False, 'a bad code signed someone in'
    assert r['calls'] == 2, 'made %d requests' % r['calls']
    assert 'invalid' in r['error'], 'reported %r' % r['error']
    return 'both types tried, one message, not signed in'


# --------------------------------------------------------------------------
# 6. the wiring: what the pages load, and in what order
# --------------------------------------------------------------------------

def t_pages_load_all_four_in_order():
    manifest = re.findall(r'"slug":\s*"([^"]+)"', read('manifest.js'))
    for slug in manifest:
        page = read('%s.html' % slug)
        at = [page.find('src="%s"' % f) for f in CLOUD_FILES]
        assert all(i >= 0 for i in at), '%s.html is missing a cloud script' % slug
        assert at == sorted(at), '%s.html loads the cloud scripts out of order' % slug
        # The ordering that actually matters: cloud-sync.js seeds the editor and so
        # must run after practice.js has put the skeleton there.
        assert page.find('src="practice.js"') < at[3], \
            '%s.html loads cloud-sync.js before practice.js' % slug
    return '%d pages, four scripts each, after practice.js' % len(manifest)


def t_three_apps_declare_themselves():
    """CLOUD_APP is declared, not detected: the simulator and the synthesizer
    already collide on six top-level names, so sniffing for a global would pick the
    wrong app the first time a seventh was added."""
    for app, rel in (('simulator', 'simulator.html'), ('synthesis', 'synthesis.html'),
                     ('compiler', 'compiler.html')):
        text = read(rel)
        assert "CLOUD_APP = '%s'" % app in text, '%s does not declare CLOUD_APP' % rel
        for f in CLOUD_FILES:
            assert 'src="%s"' % f in text, '%s does not load %s' % (rel, f)
    return 'three apps declare their own name and load all four'


def t_hub_loads_before_its_own_script():
    """The hub's renderer reads CLOUD.load for each row's badge and runs at parse
    time, so cloud.js has to already exist."""
    hub = read('index.html')
    assert hub.find('src="cloud.js"') < hub.find('function progressBadge'), \
        'index.html defines its renderer before loading cloud.js'
    # The badge must not wear .gh-label: the two Labels are what the chips filter
    # on, and Baerilog/test.py counts that class exactly to assert two per row.
    # Scoped to progressBadge's own body rather than the whole file, which also
    # contains the comment explaining this rule.
    body = hub[hub.index('function progressBadge'):hub.index('function render()')]
    assert 'gh-label' not in body, 'the badge was given the gh-label class'
    assert body.count('gh-prog') >= 3, 'the badge does not use its own class'
    return 'cloud.js precedes the renderer; the badge is gh-prog, not gh-label'


def t_no_raw_colour_in_injected_css():
    """cloud-ui.js injects its own stylesheet, which tools/check_theme.py does not
    scan - it reads the six apps' inline CSS. So the rule that every colour is a
    token is asserted here instead, or this file becomes the one place a literal
    can hide. rgba(0,0,0,.5) is the modal scrim and is allowed: there is no
    overlay-scrim token, and it is deliberately mode-independent."""
    css = re.search(r'var CSS = \[(.*?)\]\.join', read('cloud-ui.js'), re.S).group(1)
    stripped = css.replace('rgba(0,0,0,.5)', '')
    bad = re.findall(r'#[0-9a-fA-F]{3,8}\b|\brgb\(', stripped)
    assert not bad, 'raw colours in the injected CSS: %s' % bad
    return '%d declarations, every colour a token' % css.count(':')



# --------------------------------------------------------------------------
# 6b. cloud-ui.js and cloud-sync.js against the stub DOM
# --------------------------------------------------------------------------

# Baerilog/test.py boots all twenty pages but does NOT load the cloud scripts, so a
# load-time throw from one of them would not be caught there. This is the narrow
# version of that boot: the elements these two files actually reach for, and nothing
# else. The full page boot stays test.py's job - what has to be proved here is that
# these files are inert when unconfigured and correct when not.
DOM_DRIVER = r"""
const fs = require('fs'), path = require('path');
const { makeDom } = require(TOOLS + '/fakedom.js');
const HERE = APP_DIR;

const dom = makeDom();
const grid = dom.mk('__grid');
const nav = dom.mk('__nav', 'nav', grid);
nav.classList.add('gh-nav');
const editor = dom.mk('codeInput', 'textarea', grid);
const runBtn = dom.mk('runBtn', 'button', grid);
const box = dom.mk('consoleBox', 'div', grid);

/* querySelector is one simple selector at a time in this stub, which is exactly
   what cloud-ui.js asks of it - it looks up '.gh-nav' and nothing else. */
dom.document.querySelector = function (sel) {
  return sel === '.gh-nav' ? nav : null;
};

const STORE = PRESEED_JSON;
const win = {
  localStorage: {
    getItem: k => Object.prototype.hasOwnProperty.call(STORE, k) ? STORE[k] : null,
    setItem: (k, v) => { STORE[k] = String(v); },
    removeItem: k => { delete STORE[k]; }
  },
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: id => clearTimeout(id),
  addEventListener: () => {},
  fetch: () => Promise.reject(new Error('offline')),   // the network is always down here
  BAERILOG_CLOUD_CONFIG: CONFIG_JSON,
  PRACTICE_SLUG: 'd-flip-flop',
  document: dom.document
};
win.window = win;
global.AbortController = function () { this.signal = {}; this.abort = function () {}; };

editor.value = 'STARTER TEXT';

/* The app's own document accessors, when the scenario asks for them. cloud-sync
   reaches the simulator through `window`, and only FUNCTION declarations land
   there - a top-level `let` does not, however correct `window.editorFullSource`
   looks. Modelling that is the whole point: without it this suite stubs the
   editor as a bare textarea, every app path falls back to `editor.value`, and a
   save that drops half the document passes all 36 checks. Which is what shipped. */
const APP = APP_STUB_JSON;
if (APP.enabled) {
  // a two-view document, exactly like the split editors: design | marker | testbench
  const tbArea = dom.mk('tbInput', 'textarea', grid);
  let fullSource = APP.doc;
  const MARK = /^[ \t]*\/\/[ \t]*=+[ \t]*TESTBENCH[ \t]*=+[ \t]*$/m;
  const split = (doc) => {
    const m = MARK.exec(doc);
    if (!m) return [doc, null, ''];
    const nl = doc.indexOf('\n', m.index);
    return [doc.slice(0, m.index), doc.slice(m.index, nl + 1), doc.slice(nl + 1)];
  };
  const show = () => { const [d, , t] = split(fullSource); editor.value = d; tbArea.value = t; };
  show();
  win.spliceEditorChangesBack = () => {
    const [, boundary] = split(fullSource);
    fullSource = boundary === null ? editor.value : editor.value + boundary + tbArea.value;
  };
  /* Models the APP's own accessor, merge included - because that is where the
     merge lives in simulator.html (currentFullSource calls spliceEditorChangesBack
     before returning). APP.merges is what lets a mutant delete it here too, so the
     check can state that the merge is load-bearing rather than assume it. */
  if (APP.currentFullSource) win.currentFullSource = () => {
    if (APP.merges !== false) win.spliceEditorChangesBack();
    return fullSource;
  };
  if (APP.loadFullSource) win.loadFullSource = (t) => { fullSource = t; show(); };
  win.setEditorText = (t) => { editor.value = t; };
  win.resetEditorHierarchyState = () => {};
  win.tryApplyAutoFinishTime = () => {};
  // repairSplit reads the exercise's own starter to find the boundary
  if (APP.starter) win.PRACTICE_EX = { starter: APP.starter };
  win.__doc = () => fullSource;
  win.__views = () => [editor.value, tbArea.value];
}

/* The four files as four classic scripts sharing one scope, which is how a page
   runs them - so `var CLOUD_APP` and the like are visible across the boundary, and
   a file that throws takes the ones after it with it exactly as in a browser. */
const EDITS = EDITS_JSON;          // {file: [find, replace]} applied in memory
const load = n => {
  let s = fs.readFileSync(path.join(HERE, n), 'utf8');
  if (EDITS[n]) {
    if (s.indexOf(EDITS[n][0]) < 0) throw new Error('mutant pattern absent in ' + n);
    s = s.replace(EDITS[n][0], EDITS[n][1]);
  }
  return s;
};
let threw = null;
try {
  new Function('window', 'document', 'localStorage', 'AbortController',
    load('cloud-config.js') + '\n' + load('cloud.js') + '\n' +
    load('cloud-ui.js') + '\n' + load('cloud-sync.js')
  )(win, dom.document, win.localStorage, global.AbortController);
} catch (e) { threw = (e && e.message) || String(e); }

function tick(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const res = { threw, keysAtLoad: Object.keys(STORE).slice(), editorAtLoad: editor.value };
  // the two views AS RESTORED, before this driver's own edit below overwrites them
  if (APP.enabled) res.viewsAtLoad = win.__views();
  res.hasControl = !!dom.document.getElementById('cloudAcct');
  res.hasStyle = !!dom.document.getElementById('cloudStyles');

  // an edit, then long enough for the debounce to have tried and failed
  editor.value = 'MY ANSWER';
  editor.dispatch ? editor.dispatch('input') : null;
  await tick(60);
  res.keysAfterEdit = Object.keys(STORE).slice();
  res.saved = STORE['baerilog:doc:practice:d-flip-flop'] || null;
  res.editorAfter = editor.value;
  if (APP.enabled) { res.doc = win.__doc(); res.views = win.__views(); }
  console.log('__RESULT__' + JSON.stringify(res));
})();
"""


def run_dom(config, preseed=None, edits=None, app=None):
    src = (DOM_DRIVER
           .replace('APP_STUB_JSON', json.dumps(app or {'enabled': False}))
           .replace('TOOLS', json.dumps(str(ROOT / 'tools')))
           .replace('APP_DIR', json.dumps(str(ROOT)))
           .replace('PRESEED_JSON', json.dumps(preseed or {}))
           .replace('EDITS_JSON', json.dumps(edits or {}))
           .replace('CONFIG_JSON', json.dumps(config)))
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(src)
        path = f.name
    proc = subprocess.run(['node', path], capture_output=True, text=True)
    pathlib.Path(path).unlink()
    if proc.returncode != 0:
        raise AssertionError('node failed: ' + (proc.stderr.strip()[:400] or '(no stderr)'))
    m = re.search(r'__RESULT__(.*)', proc.stdout)
    assert m, 'no result. stdout=%r stderr=%r' % (proc.stdout[:200], proc.stderr[:300])
    return json.loads(m.group(1))


# --------------------------------------------------------------------------
# 6c. the account control and its drawer (the practice pages' UI)
# --------------------------------------------------------------------------

# A driver of its own rather than more fields on the one above: this one has to sign
# in, open a panel, walk three views and save a name, and threading that through a
# driver whose job is "load and edit once" would make both harder to read. Everything
# it asserts is behaviour no other check here reaches - the bar's two states, the
# drawer, My Design's local+remote merge, and the display name round trip.
ACCT_DRIVER = r"""
const fs = require('fs'), path = require('path');
const { makeDom } = require(TOOLS + '/fakedom.js');
const HERE = APP_DIR;
const dom = makeDom();
const grid = dom.mk('__grid');
const nav = dom.mk('__nav', 'nav', grid);
nav.classList.add('gh-nav');
dom.document.querySelector = (sel) => (sel === '.gh-nav' ? nav : null);

const calls = [];
dom.window.fetch = function (url, opts) {
  const u = String(url), method = (opts && opts.method) || 'GET';
  calls.push(method + ' ' + u.replace(/^https:\/\/[^/]+/, ''));
  const body = (o) => Promise.resolve({ ok: true, status: 200,
                                        text: () => Promise.resolve(JSON.stringify(o)) });
  if (u.indexOf('/auth/v1/verify') >= 0) return body({
    access_token: 'a', refresh_token: 'r', expires_in: 3600,
    user: { id: 'u1', email: 'jeremyjbae@gmail.com', user_metadata: {} } });
  if (u.indexOf('/auth/v1/user') >= 0) return body({ user_metadata: { full_name: 'Jeremy Bae' } });
  /* TWO rows, and the second one is deliberately a document this browser also holds:
     with only a cloud-only row, filtering the merge and not filtering it give the same
     list, so the de-duplication would be unfalsifiable. */
  if (u.indexOf('/rest/v1/progress') >= 0) return body([
    { app: 'practice', item: 'mux-2to1', updated_at: new Date(Date.now() - 7200e3).toISOString(),
      verdict: { state: 'pass', pass: 5 } },
    { app: 'practice', item: 'shift-register-4bit',
      updated_at: new Date(Date.now() - 60e3).toISOString(), verdict: { state: 'fail', fail: 2 } }]);
  return body({});
};
dom.window.BAERILOG_CLOUD_CONFIG = CONFIG_JSON;
/* Deliberately NO PRACTICE_SLUG: this is the configuration the three menu apps boot in,
   and the account control was gated on that global while the practice pages were the
   only ones with the new UI. Driving with it set would let a re-introduced gate hide
   behind these checks - the mutant below is what proves it cannot. */
dom.window.window = dom.window;
dom.window.document = dom.document;
if (!dom.window.setTimeout) dom.window.setTimeout = setTimeout;
if (!dom.window.clearTimeout) dom.window.clearTimeout = clearTimeout;
global.AbortController = function () { this.signal = {}; this.abort = function () {}; };

/* innerHTML -> which drawing it is, so the check can assert the ARTWORK rather than the
   element's own label about itself. Derived from the committed assets on the Python side. */
const ART = ART_JSON;
const EDITS = EDITS_JSON;
const load = (n) => {
  let s = fs.readFileSync(path.join(HERE, n), 'utf8');
  if (EDITS[n]) {
    if (s.indexOf(EDITS[n][0]) < 0) throw new Error('mutant pattern absent in ' + n);
    s = s.replace(EDITS[n][0], EDITS[n][1]);
  }
  return s;
};
let threw = null;
try {
  new Function('window', 'document', 'localStorage', 'AbortController',
    load('cloud-config.js') + '\n' + load('cloud.js') + '\n' + load('cloud-ui.js')
  )(dom.window, dom.document, dom.localStorage, global.AbortController);
} catch (e) { threw = (e && e.message) || String(e); }

const $ = (id) => dom.document.getElementById(id);
const seen = (id) => { const e = $(id); return e ? { text: e.textContent, hidden: e.style.display === 'none' } : null; };
const tick = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const res = { threw, calls: null };
  const conn = () => { const e = $('cloudConn'); return e ? {
    hidden: e.style.display === 'none', cls: e.className,
    form: e.getAttribute('data-form'), label: e.getAttribute('aria-label'),
    art: ART[e.innerHTML] || ('other:' + String(e.innerHTML || '').slice(0, 60)) } : null; };
  res.out = { sign: seen('cloudSignBtn'), avatar: seen('cloudAvatarBtn') };
  res.connOut = conn();
  await dom.window.CLOUD.requestCode('jeremyjbae@gmail.com');
  await dom.window.CLOUD.verifyCode('jeremyjbae@gmail.com', '123456');
  res.in = { sign: seen('cloudSignBtn'), avatar: seen('cloudAvatarBtn') };
  res.connIn = conn();
  /* Every state, driven through the same status() the network paths use, so the sweep
     covers the table rather than the handful of states a scripted sign-in happens to
     pass through. The drawer's dot is sampled at the same instant: the two encodings
     must agree in EVERY state, which is the claim, not just in the ones we can reach. */
  res.states = {};
  const STATES = STATES_JSON;
  for (const s of STATES) {
    dom.window.CLOUD._setState(s);
    const c = conn(), d = $('cloudState');
    res.states[s] = { conn: c, dot: d ? d.children.map(x => x.className).join('|') : null,
                      word: d ? d.textContent : null };
  }
  dom.window.CLOUD._setState('synced');

  dom.window.CLOUD.save('practice', 'shift-register-4bit',
                        { source: 'module a; endmodule', verdict: { state: 'fail', fail: 2 } });
  dom.window.CLOUD.save('simulator', 'default', { source: 'module b; endmodule' });

  $('cloudAvatarBtn').dispatch('click');
  res.open = !!($('cloudDrawer') && $('cloudDrawer').classList.contains('open'));
  res.head = { face: seen('cloudFace'), name: seen('cloudName'),
               mail: seen('cloudEmail'), state: seen('cloudState') };
  res.menu = ['cloudProfileRow', 'cloudDesignsRow', 'cloudSignOutRow'].filter(id => !!$(id));
  res.menuText = res.menu.map(id => $(id).textContent);
  // each row's glyph, which is set as innerHTML before the label span is appended
  res.menuIcons = res.menu.map(id => $(id).innerHTML.indexOf('<svg') === 0);

  $('cloudDesignsRow').dispatch('click');
  await tick(20);
  res.docs = ($('cloudDesignList') ? $('cloudDesignList').children : []).map(c => ({
    text: c.textContent, href: c.getAttribute('href') || '' }));

  $('cloudBackRow').dispatch('click');
  $('cloudProfileRow').dispatch('click');
  res.profileFields = [!!$('cloudNameInput'), !!$('cloudMailRead')];
  $('cloudNameInput').value = 'Jeremy Bae';
  $('cloudNameSave').dispatch('click');
  await tick(20);
  res.note = $('cloudProfileNote') ? $('cloudProfileNote').textContent : null;
  res.nameNow = dom.window.CLOUD.info().name;
  res.avatarNow = $('cloudAvatarBtn').textContent;

  /* A click INSIDE the panel must not dismiss it, and one on the backdrop must -
     the panel is a child of the backdrop, so the guard is what tells them apart. */
  $('cloudDrawerBack').dispatch('click', { target: $('cloudDrawer') });
  res.stillOpen = $('cloudDrawer').classList.contains('open');
  $('cloudDrawerBack').dispatch('click', { target: $('cloudDrawerBack') });
  res.closed = !$('cloudDrawer').classList.contains('open');

  dom.window.CLOUD.signOut();
  res.afterOut = { sign: seen('cloudSignBtn'), avatar: seen('cloudAvatarBtn') };
  res.calls = calls;
  console.log('__RESULT__' + JSON.stringify(res));
})();
"""


def inline_art():
    """The two artworks as cloud-ui.js must carry them, derived from the committed assets.
    Used both to compare the source string and - the part that matters - to identify which
    drawing actually reached the DOM: a check that reads the element's own data-form label
    is satisfied by artwork that contradicts it, which is exactly how the swap mutant
    survived its first sweep."""
    out = {}
    for name in ('connected', 'disconnected'):
        a = (ROOT.parent / (name + '.svg')).read_text()
        body = a[a.index('>', a.index('<svg')) + 1: a.rindex('</svg>')]
        out[name] = '<svg viewBox="0 0 67 40">' + re.sub(r'\s+', ' ', body).strip() + '</svg>'
    return out


def words_table():
    """cloud-ui.js's WORDS, parsed out of the shipped file: [dot class, word, connection
    form] per state. The checks below derive what they expect from THIS rather than
    restating it, so adding a state or changing a mapping cannot leave the test asserting
    a table the app no longer has - it would have to be a deliberate edit here too."""
    src = read('cloud-ui.js')
    body = src[src.index('var WORDS = {'):]
    body = body[:body.index('};')]
    out = {}
    for m in re.finditer(r"'([a-z-]+)':\s*\['([a-z]*)',\s*'([^']*)',\s*(null|'on'|'off')\]", body):
        state, cls, word, form = m.groups()
        out[state] = (cls, word, None if form == 'null' else form.strip("'"))
    assert len(out) >= 12, 'parsed only %d WORDS rows' % len(out)
    return out


def run_account(edits=None):
    src = (ACCT_DRIVER
           .replace('TOOLS', json.dumps(str(ROOT / 'tools')))
           .replace('APP_DIR', json.dumps(str(ROOT)))
           .replace('STATES_JSON', json.dumps(sorted(words_table())))
           .replace('ART_JSON', json.dumps({v: k for k, v in inline_art().items()}))
           .replace('EDITS_JSON', json.dumps(edits or {}))
           .replace('CONFIG_JSON', json.dumps({'url': 'https://p.supabase.co',
                                               'anonKey': 'anon-key'})))
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(src)
        path = f.name
    proc = subprocess.run(['node', path], capture_output=True, text=True)
    pathlib.Path(path).unlink()
    if proc.returncode != 0:
        raise AssertionError('node failed: ' + (proc.stderr.strip()[:400] or '(no stderr)'))
    m = re.search(r'__RESULT__(.*)', proc.stdout)
    assert m, 'no result. stdout=%r stderr=%r' % (proc.stdout[:200], proc.stderr[:300])
    return json.loads(m.group(1))


def t_bar_is_one_control_at_a_time():
    """Signed out it is a Sign In button and nothing else; signed in it is the avatar,
    with initials out of the email until a name is set. The signed-out half is the
    check this feature shipped without: `subscribe()` calls back immediately, but
    cloud-ui.js's WORDS table sat BELOW the code that builds the control, so that first
    render read a hoisted-but-undefined var, threw, and had it swallowed by subscribe's
    own try/catch - leaving a grey dot and an EMPTY button until the next state change,
    which for a signed-out idle page never comes."""
    r = run_account()
    assert r['threw'] is None, 'a cloud file threw at load: %s' % r['threw']
    assert r['out']['sign'] and r['out']['sign']['text'] == 'Sign In',            'signed out, the button reads %r' % (r['out']['sign'] and r['out']['sign']['text'])
    assert r['out']['sign']['hidden'] is False, 'the Sign In button is hidden while signed out'
    assert r['out']['avatar']['hidden'] is True, 'the avatar shows while signed out'
    assert r['in']['sign']['hidden'] is True, 'the Sign In button survives signing in'
    assert r['in']['avatar']['hidden'] is False, 'no avatar after signing in'
    assert r['in']['avatar']['text'] == 'JE',            'the avatar reads %r, not JE from the email' % r['in']['avatar']['text']
    assert r['afterOut']['sign']['hidden'] is False and r['afterOut']['avatar']['hidden'] is True,        'signing out did not put the Sign In button back'
    return 'Sign In -> JE -> Sign In, and the button has text before any emit'


def t_account_drawer_and_its_views():
    """The panel: identity and sync state in its head, three rows, and My Progress
    listing what is HERE plus what is only on the server - the second half being what
    makes it honest on a machine that has never held these documents. A remote row is
    listed, never adopted: merging is pull()'s job under the conflict rule."""
    r = run_account()
    assert r['open'] is True, 'the avatar did not open the drawer'
    assert r['head']['face']['text'] == 'JE', 'the panel face reads %r' % r['head']['face']['text']
    assert r['head']['name']['text'] == 'jeremyjbae@gmail.com',        'with no display name the name line should fall back to the email, got %r' % r['head']['name']['text']
    assert 'sav' in r['head']['state']['text'], 'the sync state is %r' % r['head']['state']['text']
    assert r['menu'] == ['cloudProfileRow', 'cloudDesignsRow', 'cloudSignOutRow'],        'the menu is %s' % r['menu']
    # The wording, not just the row: the ids still say Designs (everything wired to
    # them keeps working, as exReopenBtn did when it became a tab), so nothing else
    # would notice the label going back.
    assert r['menuText'] == ['Profile', 'My Progress', 'Sign out'],        'the menu reads %s' % r['menuText']
    assert r['menuIcons'] == [True, True, True], 'a menu row has no glyph: %s' % r['menuIcons']

    items = [d['text'] for d in r['docs']]
    assert len(items) == 3, 'My Progress lists %s' % items
    local = [t for t in items if 'shift-register-4bit' in t]
    cloud = [t for t in items if 'mux-2to1' in t]
    assert local and 'failing' in local[0], 'the local document lost its verdict: %s' % local
    assert cloud and 'cloud' in cloud[0], 'the server-only document is not marked: %s' % cloud
    hrefs = [d['href'] for d in r['docs']]
    assert 'shift-register-4bit.html' in hrefs and 'simulator.html' in hrefs,        'a row does not link to its page: %s' % hrefs
    assert '../' not in ' '.join(hrefs), 'a row walks out of Baerilog/: %s' % hrefs
    assert r['stillOpen'] is True, 'a click inside the panel dismissed it'
    assert r['closed'] is True, 'a click on the backdrop did not dismiss it'
    return '3 rows, 2 local + 1 cloud-only, backdrop guard honoured'


def t_display_name_round_trip():
    """Profile writes the name to GoTrue's user_metadata - no table, no policy - and
    the avatar follows it, which is the only reason the initials can be JB rather than
    the JE an email can give. The session's copy comes from the RESPONSE, so what the
    panel shows is what the server accepted."""
    r = run_account()
    assert r['profileFields'] == [True, True], 'Profile is missing the name or the email field'
    assert r['note'] == 'Saved.', 'saving the name reported %r' % r['note']
    assert r['nameNow'] == 'Jeremy Bae', 'the session name is %r' % r['nameNow']
    assert r['avatarNow'] == 'JB', 'the avatar still reads %r after naming' % r['avatarNow']
    assert 'PUT /auth/v1/user' in r['calls'], 'no user_metadata write: %s' % r['calls']
    assert not [c for c in r['calls'] if 'profiles' in c], 'it invented a table: %s' % r['calls']
    return 'name saved to user_metadata, avatar JE -> JB'


def t_connection_indicator():
    """The bar's connection icon, over EVERY state in the table rather than the few a
    sign-in passes through. Three claims: the artwork follows WORDS' third field, the
    colour class IS the drawer dot's class (so the two surfaces cannot disagree about one
    state), and it is absent entirely when signed out - where the Sign In button beside it
    already says so, and where an icon reading "connected" would answer nothing."""
    words = words_table()
    r = run_account()
    assert r['threw'] is None, 'a cloud file threw at load: %s' % r['threw']
    assert r['connOut'] is not None, 'no #cloudConn element in the bar at all'
    assert r['connOut']['hidden'] is True, 'the indicator shows while signed out'
    assert r['connIn']['hidden'] is False, 'no indicator after signing in'
    bad = []
    for state, (cls, word, form) in sorted(words.items()):
        got = r['states'][state]
        c = got['conn']
        if form is None:
            if not c['hidden']:
                bad.append('%s: should show no icon, but it is visible' % state)
            continue
        if c['hidden']:
            bad.append('%s: icon hidden, expected %s' % (state, form))
            continue
        if c['form'] != form:
            bad.append('%s: artwork is %r, expected %r' % (state, c['form'], form))
        # the colour class is the DOT's class - compared against the dot actually rendered
        want = 'cloud-conn' + ((' ' + cls) if cls else '')
        if c['cls'] != want:
            bad.append('%s: class %r, expected %r (the dot\'s own class)' % (state, c['cls'], want))
        if got['dot'] is not None and cls and cls not in got['dot']:
            bad.append('%s: the drawer dot %r disagrees with the icon' % (state, got['dot']))
        if word and word not in (c['label'] or ''):
            bad.append('%s: label %r does not carry the word %r' % (state, c['label'], word))
        want_art = 'connected' if form == 'on' else 'disconnected'
        if c['art'] != want_art:
            bad.append('%s: the DRAWING is %r, expected %s.svg' % (state, c['art'][:60], want_art))
    assert not bad, 'the indicator disagrees with WORDS:\n  ' + '\n  '.join(bad)
    on = [s for s, v in words.items() if v[2] == 'on']
    off = [s for s, v in words.items() if v[2] == 'off']
    return '%d states: %d connected, %d disconnected, 1 hidden' % (len(words), len(on), len(off))


def t_connection_artwork_is_the_committed_asset():
    """The inline copies and the two root assets are the same drawing, compared rather than
    trusted: this is the one glyph in the repo that exists twice, and a re-export that never
    reached cloud-ui.js would go stale in silence. Also the OmniGraffle trap, which these
    two carried in its INVERTED form - a full-canvas opaque black rect over white artwork,
    where bae.svg and the row glyphs arrived white-over-black. Left in, it paints a black
    box on the bar; and a literal colour would defeat the token that drives the state."""
    ui = read('cloud-ui.js')
    problems = []
    for name, key in (('connected.svg', 'connected'), ('disconnected.svg', 'disconnected')):
        asset = (ROOT.parent / name).read_text()
        if 'fill="black"' in asset or 'white' in asset:
            problems.append('%s still carries a literal colour - re-clean it' % name)
        if 'currentColor' not in asset:
            problems.append('%s has no currentColor, so nothing can colour it' % name)
        m = re.search(r"\n    %s: '(<svg.*?)',?\n" % key, ui, re.S)
        if not m:
            problems.append('cloud-ui.js has no GLYPH.%s' % key)
            continue
        inline = m.group(1)
        if inline != inline_art()[key]:
            problems.append('GLYPH.%s is not %s - re-paste it' % (key, name))
    # both artworks must share one viewBox, or the slot changes width when the state flips
    boxes = re.findall(r"(?:connected|disconnected): '<svg viewBox=\"([^\"]+)\"", ui)
    if len(set(boxes)) != 1:
        problems.append('the two artworks have different viewBoxes %s, so a state change reflows the bar' % boxes)
    assert not problems, '\n  '.join(problems)
    return 'both inline copies byte-identical to their assets, one shared viewBox %s' % boxes[0]


def t_connection_css_is_bar_safe():
    """Four claims no headless check here can see, so they are asserted against the CSS text -
    the same standin the netlist viewer's rules get. Comments are stripped first: this file
    EXPLAINS the token choice in prose that names both sets, and a regex over the raw text
    would match the explanation and pass while comparing nothing (that is exactly how the
    busy-button colour check was once vacuous)."""
    css = read('cloud-ui.js')
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = '\n'.join(l for l in css.splitlines() if l.strip().startswith("'."))
    problems = []
    # 1. sized by HEIGHT with width auto - a 67:40 ratio squashes in a square box, and the
    #    ratio is not stable across a re-export (the wordmark's rule).
    if 'height:14px;width:auto' not in css:
        problems.append('the icon is not sized by height with width auto')
    # 2. the paint is driven by `color`, so it reaches stroke AND fill (.gh-row-icon's lesson)
    if 'color:var(--header-muted)' not in css:
        problems.append('the resting colour is not --header-muted via `color`')
    # 3. the three status hues are the BAR set, not the page-following ones. The bar is dark
    #    in both modes, where --success-fg measures 2.88:1 and --danger-fg 2.74:1 - under the
    #    3:1 floor for non-text graphics.
    for cls, want, avoid in (('ok', '--header-success', '--success-fg'),
                             ('busy', '--header-attention', '--attention-fg'),
                             ('bad', '--header-danger', '--danger-fg')):
        rule = [l for l in css.splitlines() if '.cloud-conn.' + cls in l]
        if not rule:
            problems.append('no .cloud-conn.%s rule' % cls)
        elif want not in rule[0]:
            problems.append('.cloud-conn.%s does not use %s: %s' % (cls, want, rule[0].strip()))
        elif 'var(' + avoid + ')' in rule[0]:
            problems.append('.cloud-conn.%s uses the page token %s on the dark bar' % (cls, avoid))
    # 4. and those tokens have to exist, identically, everywhere cloud-ui.js is loaded
    for f in ('app.css', 'simulator.html', 'synthesis.html', 'compiler.html'):
        text = read(f)
        missing = [n for n in ('--header-success', '--header-attention', '--header-danger')
                   if n + ':' not in text]
        if missing:
            problems.append('%s defines none of %s' % (f, ', '.join(missing)))
    assert not problems, '\n  '.join(problems)
    return 'height-driven, colour-driven, three bar hues, resolving in 4 stylesheets'


def t_account_mutants():
    """Twelve, and the first is the bug this replaced: each must break a check above."""
    MUTANTS = [
        # Reproduces the shipped bug exactly rather than approximating it: WORDS is
        # left undefined at the moment build() subscribes, so the immediate render
        # throws on its first line and subscribe swallows it - which is what left the
        # control half-drawn. The literal table survives under a dead name so the
        # rest of the file still parses.
        ('WORDS undefined when the control is built, as it was before the fix',
         {'cloud-ui.js': ['  var WORDS = {',
                          '  var WORDS = undefined; var WORDS_MOVED = {']}),
        ('the bar never swaps control',
         {'cloud-ui.js': ["    signInBtn.style.display = i.signedIn ? 'none' : '';",
                          "    signInBtn.style.display = '';"]}),
        ('initials ignore the display name',
         {'cloud-ui.js': ['    var src = String(name || \'\').trim();', '    var src = \'\';']}),
        ('the panel click closes the drawer',
         {'cloud-ui.js': ["dBack.addEventListener('click', function (ev) { if (ev.target === dBack) closeDrawer(); });",
                          "dBack.addEventListener('click', function () { closeDrawer(); });"]}),
        # The gate is gone: every app gets the avatar and the drawer. Re-introducing it
        # would leave the three menu apps on a control that no longer exists in the file,
        # so the mutant reproduces the state this replaced rather than a hypothetical one.
        ('the practice-only gate re-introduced',
         {'cloud-ui.js': ['  function buildAccount(nav) {',
                          '  function buildAccount(nav) {\n    if (!window.PRACTICE_SLUG) return;']}),
        ('a server-only document is listed twice',
         {'cloud.js': ['      var extra = r.rows.filter(function (d) { return !(seen[d.app] && seen[d.app][d.item]); });',
                       '      var extra = r.rows;']}),
        # ---- the bar's connection indicator ----
        ('the connected and disconnected artworks are swapped',
         {'cloud-ui.js': ["    var glyph = form === 'on' ? GLYPH.connected : GLYPH.disconnected;",
                          "    var glyph = form === 'on' ? GLYPH.disconnected : GLYPH.connected;"]}),
        # The whole point of reading w[0]: a second mapping is free to drift from the dot.
        ('the icon colours itself instead of taking the dot\'s class',
         {'cloud-ui.js': ["    connEl.className = 'cloud-conn' + (w[0] ? ' ' + w[0] : '');",
                          "    connEl.className = 'cloud-conn' + (form === 'on' ? ' ok' : ' bad');"]}),
        ('the icon stays visible when signed out',
         {'cloud-ui.js': ['    var form = i.signedIn ? w[2] : null;',
                          '    var form = w[2] || \'on\';']}),
        ('offline shows no icon, as it did before',
         {'cloud-ui.js': ["    'offline':    ['', 'offline — saved on this device', 'off'],",
                          "    'offline':    ['', 'offline — saved on this device', null],"]}),
        ('the label drops the word, so red-and-disconnected cannot be told apart',
         {'cloud-ui.js': ["              + (w[1] ? ' \\u2014 ' + w[1] : '');", "              + '';"]}),
        ('the artwork is never re-rendered after the first state',
         {'cloud-ui.js': ["    if (connEl.getAttribute('data-form') !== form) {",
                          "    if (connEl.getAttribute('data-form') === null) {"]}),
    ]
    caught = []
    for name, edits in MUTANTS:
        try:
            r = run_account(edits)
        except AssertionError as e:
            caught.append(name + ' (driver: ' + str(e)[:40] + ')')
            continue
        broke = False
        for fn in (t_bar_is_one_control_at_a_time, t_account_drawer_and_its_views,
                   t_display_name_round_trip, t_connection_indicator):
            try:
                _assert_with(fn, r)
            except AssertionError:
                broke = True
                break
        if broke:
            caught.append(name)
        else:
            raise AssertionError('mutant survived: ' + name)
    return '%d of %d mutants caught' % (len(caught), len(MUTANTS))


def _assert_with(fn, r):
    """Re-run one check's assertions against an already-driven result. The three
    checks above each call run_account() themselves, which a mutant sweep must not
    do (it would drive the unmutated files), so the body is reused by handing the
    result in through a one-shot patch of run_account."""
    global run_account
    real = run_account
    run_account = lambda edits=None: r
    try:
        fn()
    finally:
        run_account = real


def t_dom_unconfigured_is_a_non_event():
    """THE offline-neutrality claim, and the one worth the most: with no project
    named, loading all four files must not throw, must add no control, and must
    leave both the editor and localStorage untouched - so a page carrying these
    tags is the page it was before they existed."""
    r = run_dom({'url': '', 'anonKey': ''})
    assert r['threw'] is None, 'a cloud file threw at load: %s' % r['threw']
    assert r['hasControl'] is False, 'built an account control with no project'
    assert r['keysAtLoad'] == [] and r['keysAfterEdit'] == [],         'wrote storage with no project: %s' % r['keysAfterEdit']
    assert r['editorAfter'] == 'MY ANSWER', 'the editor was disturbed'
    return 'no throw, no control, no storage, editor untouched'


def t_dom_configured_saves_and_restores():
    """Configured: the control appears, an edit is stored under the slug, and a
    stored answer supersedes the skeleton that practice.js seeded. The stub's fetch
    always rejects, so this is also the offline path - the local half must work with
    the network permanently down."""
    r = run_dom({'url': 'https://p.supabase.co', 'anonKey': 'anon-key'})
    assert r['threw'] is None, 'a cloud file threw at load: %s' % r['threw']
    assert r['hasControl'] and r['hasStyle'], 'no account control or stylesheet'
    assert r['saved'], 'the edit was not stored'
    rec = json.loads(r['saved'])
    assert rec['source'] == 'MY ANSWER', 'stored %r' % rec['source']

    seeded = {'baerilog:doc:practice:d-flip-flop':
              json.dumps({'source': 'WORK FROM LAST TIME', 'synced': None, 'updated_at': 1})}
    r2 = run_dom({'url': 'https://p.supabase.co', 'anonKey': 'anon-key'}, preseed=seeded)
    assert r2['editorAtLoad'] == 'WORK FROM LAST TIME', \
        'the skeleton was not superseded (editor held %r)' % r2['editorAtLoad']
    return 'control built, edit stored, saved work restored over the skeleton'



DOC = ('module dff(input clk, input d, output reg q);\n'
       '  always @(posedge clk) q <= d;\n'
       'endmodule\n\n'
       '// ======== TESTBENCH ========\n\n'
       'module dff_tb;\n'
       '  reg clk, d; wire q;\n'
       '  dff u_dut (.clk(clk), .d(d), .q(q));\n'
       'endmodule\n')
APP = {'enabled': True, 'doc': DOC, 'currentFullSource': True, 'loadFullSource': True}


def t_dom_saves_the_whole_document_not_the_visible_half():
    """What is saved must be the DOCUMENT, and what is restored must go back into
    both editors.

    This is the check that was missing, and its absence is exactly why a real bug
    shipped: the design/testbench split made codeInput hold only the design half,
    while cloud-sync reached the document as `window.editorFullSource` - which is
    `undefined` in a browser, because a top-level `let` is not a property of
    `window` (a function declaration is). So it silently fell back to the textarea
    and saved half of every file; restoring one then put a markerless document on
    screen, and the Testbench card correctly reported that there was no marker to
    split on. Every one of the other 36 checks passed throughout, because they stub
    the editor as a bare textarea with no app behind it."""
    cfg = {'url': 'https://p.supabase.co', 'anonKey': 'anon-key'}
    r = run_dom(cfg, app=APP)
    assert r['threw'] is None, 'a cloud file threw at load: %s' % r['threw']
    assert r['saved'], 'the edit was not stored'
    rec = json.loads(r['saved'])
    # the edit went into the DESIGN half; what is saved must still be the whole file
    assert 'MY ANSWER' in rec['source'], 'the edit is missing from the save'
    assert 'module dff_tb' in rec['source'], \
        'the testbench half was dropped from the save: %r' % rec['source'][:120]
    assert '======== TESTBENCH ========' in rec['source'], 'the marker was dropped from the save'

    # and a stored document must come back split across both editors
    seeded = {'baerilog:doc:practice:d-flip-flop':
              json.dumps({'source': DOC.replace('q <= d;', 'q <= ~d;'),
                          'synced': None, 'updated_at': 1})}
    r2 = run_dom(cfg, preseed=seeded, app=APP)
    design, tb = r2['viewsAtLoad']
    assert 'q <= ~d;' in design, 'the restored design is not on screen: %r' % design[:80]
    assert 'module dff_tb' in tb, 'the restore left the testbench editor empty: %r' % tb[:80]
    assert 'module dff_tb' not in design, 'the restore put the testbench in the design editor'
    # The merge inside currentFullSource is load-bearing, and nothing else here
    # would notice it going: without it the accessor returns the document as it was
    # BEFORE the visible edit, so a save quietly stores stale work. Asserted by
    # running the same scenario with the stub's merge removed.
    r3 = run_dom(cfg, app=dict(APP, merges=False))
    stale = json.loads(r3['saved'])
    assert 'MY ANSWER' not in stale['source'], \
        'the merge in currentFullSource is not load-bearing - the save survived without it'

    return 'saved the whole document, restored it into both editors, merge pinned'


def t_dom_a_half_document_saved_before_the_split_is_repaired():
    """A document saved BEFORE the design/testbench split has no marker, because at
    the time it was written the save was silently taking only the design half. This
    is the migration for those: restoring one repairs it against the exercise's own
    starter, so the learner gets their answer back WITH a testbench to run it.

    Three things make the repair safe rather than clever, and each is asserted: the
    design half restored is the STORED text (the answer), not the starter's; a
    document that already has a marker is passed through untouched; and a page with
    no exercise data has nothing to repair against and must leave the text alone."""
    cfg = {'url': 'https://p.supabase.co', 'anonKey': 'anon-key'}

    # what the broken save produced: the design half only, no marker
    half = ('module dff(input clk, input d, output reg q);\n'
            '  always @(posedge clk) q <= ~d;   // MY ANSWER FROM BEFORE\n'
            'endmodule\n')
    seeded = {'baerilog:doc:practice:d-flip-flop':
              json.dumps({'source': half, 'synced': None, 'updated_at': 1})}
    r = run_dom(cfg, preseed=seeded, app=dict(APP, starter=DOC))
    design, tb = r['viewsAtLoad']
    assert 'MY ANSWER FROM BEFORE' in design, \
        'the repair lost the stored answer: %r' % design[:120]
    assert 'module dff_tb' in tb, 'the repair did not restore a testbench: %r' % tb[:120]
    assert 'MY ANSWER FROM BEFORE' not in tb, 'the answer leaked into the testbench half'
    doc = r['doc']
    assert doc.count('======== TESTBENCH ========') == 1, 'the repair wrote %d markers' % \
        doc.count('======== TESTBENCH ========')
    assert 'q <= d;' not in design, "the repair overwrote the answer with the starter's design"

    # An UNEDITED page must not restore at all: the stored copy equals the seeded
    # document, and comparing it against the textarea (the design half) makes every
    # page look edited - which restores, and so repairs, work nobody did.
    seeded3 = {'baerilog:doc:practice:d-flip-flop':
               json.dumps({'source': DOC, 'synced': None, 'updated_at': 1})}
    r0 = run_dom(cfg, preseed=seeded3, app=dict(APP, starter=DOC))
    d0, t0 = r0['viewsAtLoad']
    assert 'module dff_tb' not in d0, \
        'an unedited page restored its own document into the design editor: %r' % d0[:120]
    assert 'module dff_tb' in t0, 'the testbench half went missing on an unedited page'
    # r0['doc'] is captured AFTER the driver's own edit, so the at-load views are
    # what says whether a restore happened - the halves, not the merged document.
    assert d0.count('======== TESTBENCH ========') == 0, 'the marker leaked into the design half'

    # a document that already has a marker is not touched
    intact = DOC.replace('q <= d;', 'q <= ~d;')
    seeded2 = {'baerilog:doc:practice:d-flip-flop':
               json.dumps({'source': intact, 'synced': None, 'updated_at': 1})}
    r2 = run_dom(cfg, preseed=seeded2, app=dict(APP, starter=DOC))
    assert r2['doc'] == intact, 'a document with a marker was rewritten by the repair'

    # and with no exercise data there is nothing to repair against
    r3 = run_dom(cfg, preseed=seeded, app=APP)          # APP carries no starter
    assert r3['doc'] == half, 'repaired without an exercise to repair against: %r' % r3['doc'][:80]
    return 'half-document repaired, marked document untouched, no-exercise page left alone'


def t_dom_guard_mutants():
    """The two guards that make the unconfigured case inert, each deleted in turn.
    Read as a pair with t_dom_unconfigured_is_a_non_event: that check states the
    property, these prove it is the guards holding it up rather than luck."""
    cases = [
        ('cloud-sync.js writes storage with no project configured',
         'cloud-sync.js',
         ("if (!window.CLOUD || !window.CLOUD.configured()) return;",
          "if (!window.CLOUD) return;")),
        ('cloud-ui.js builds an account control with no project configured',
         'cloud-ui.js',
         ("if (!window.CLOUD.configured()) return;", "if (false) return;")),
    ]
    caught = 0
    survived = []
    for name, fname, (find, repl) in cases:
        try:
            r = run_dom({'url': '', 'anonKey': ''}, edits={fname: [find, repl]})
        except AssertionError as e:
            # includes 'mutant pattern absent', which is a hard failure not a skip
            survived.append('%s (%s)' % (name, e))
            continue
        # The mutant is caught if the unconfigured page stops being a non-event.
        broke = (r['threw'] is not None or r['hasControl'] or r['keysAfterEdit'])
        if broke:
            caught += 1
        else:
            survived.append(name)
    assert not survived, 'SURVIVED: ' + '; '.join(survived)
    return '%d of %d guard mutants caught' % (caught, len(cases))


# --------------------------------------------------------------------------
# 7. mutants - each must be caught
# --------------------------------------------------------------------------

MUTANTS = [
    ('the conflict branch removed, so a newer cloud copy wins silently',
     ("conflicts.push({", "adopted.push(row.item); localPut(app, row.item, {source: row.source,"
      " verdict: row.verdict, updated_at: remoteAt, synced: row.source}); ({"),
     t_both_moved_is_a_conflict_and_nothing_is_lost),

    ('last-write-wins by timestamp instead of by divergence',
     ("if (!remoteMoved) {", "if (remoteAt > (rec.updated_at || 0)) { localPut(app, row.item,"
      " {source: row.source, verdict: row.verdict, updated_at: remoteAt, synced: row.source});"
      " adopted.push(row.item); return; }\n          if (!remoteMoved) {"),
     t_conflict_does_not_depend_on_the_clock),

    ('the push never records what the server accepted, so every pull re-conflicts',
     ("cur.synced = rec.source;", "cur.synced = cur.synced;"),
     t_synced_tracks_the_pushed_text_not_a_later_edit),

    ('synced set from the text on screen rather than the text sent',
     ("cur.synced = rec.source;", "cur.synced = cur.source;"),
     t_synced_tracks_the_pushed_text_not_a_later_edit),

    ('an offline refresh signs the learner out',
     ("if (!r.offline) { saveSession(null); status('signed-out'); }",
      "saveSession(null); status('signed-out');"),
     t_offline_keeps_the_session),

    ('the upsert Prefer header dropped, so every second save is a 409',
     ("prefer: 'resolution=merge-duplicates,return=minimal'", "prefer: 'return=minimal'"),
     t_push_is_an_upsert),

    ('concurrent refreshes each spend the single-use token',
     ("if (!refreshing) {", "if (true) {"),
     t_refresh_is_shared),

    ('an oversized document is pushed anyway',
     ("if (rec.source != null && rec.source.length > SOURCE_LIMIT) {",
      "if (false) {"),
     t_oversize_is_refused),

    ('the debounce never cancels, so every keystroke schedules its own push',
     ("if (pushTimers[app][item]) window.clearTimeout(pushTimers[app][item]);",
      "if (false) window.clearTimeout(pushTimers[app][item]);"),
     t_push_coalesces_per_document),

    ('configured() accepts a URL with no key',
     ("return !!(URL_BASE && ANON_KEY);", "return !!URL_BASE;"),
     t_half_configured_is_inert),

    ('sign-out waits for the server',
     ("saveSession(null);\n    status('signed-out');", "status('signed-out');"),
     t_sign_out_is_local_first),

    ('only the magic-link token type is tried, so a first sign-in always fails',
     ("var VERIFY_TYPES = ['email', 'signup'];", "var VERIFY_TYPES = ['email'];"),
     t_verify_tries_signup_after_email),

    ('verify retries into a dead connection',
     ("if (!r.offline && i + 1 < VERIFY_TYPES.length) return attempt(i + 1);",
      "if (i + 1 < VERIFY_TYPES.length) return attempt(i + 1);"),
     t_verify_does_not_retry_offline),
]


def t_mutants():
    src = read('cloud.js')
    caught, missed, inert = 0, [], []
    for name, (find, repl), probe in MUTANTS:
        if find not in src:
            # A pattern that is not present is a HARD FAILURE, not a skip: it means
            # the mutant tested nothing while reporting a pass. This suite's
            # siblings in this repo learned that the expensive way.
            missed.append('%s (pattern absent)' % name)
            continue
        mutated = src.replace(find, repl, 1)
        try:
            probe_src = mutated
            # Run the probe against the mutated engine by swapping what run_js loads.
            global _OVERRIDE
            _OVERRIDE = probe_src
            try:
                probe()
            finally:
                _OVERRIDE = None
        except AssertionError:
            caught += 1
            continue
        except Exception as e:
            inert.append('%s (%s)' % (name, type(e).__name__))
            continue
        missed.append(name)
    assert not missed, 'SURVIVED: ' + '; '.join(missed)
    assert not inert, 'tested nothing (crashed): ' + '; '.join(inert)
    return '%d of %d mutants caught' % (caught, len(MUTANTS))


# run_js consults this so a mutant probe runs against mutated source without
# every check having to take the engine as a parameter.
_OVERRIDE = None
_run_js_plain = run_js


def run_js(body, config=None, cloud_js=None, preseed=''):   # noqa: F811 - deliberate shadow
    return _run_js_plain(body, config,
                         cloud_js if cloud_js is not None else _OVERRIDE, preseed)


# --------------------------------------------------------------------------

CHECKS = [
    ('the four cloud files parse', t_parse),
    ('neither build.py-banned spelling appears, comments included', t_no_module_spelling),
    ('the committed key is public-grade, and its URL agrees', t_config_key_is_public_grade),
    ('a service-role key in any format is caught', t_service_role_key_is_caught),
    ('the client size limit equals the column constraint', t_limit_matches_schema),
    ('the app whitelist equals the column constraint', t_apps_match_schema),
    ('RLS is enabled and all four policies are complete', t_rls_is_enabled_and_complete),
    ('an unconfigured project is completely inert', t_unconfigured_is_inert),
    ('a URL with no key does not count as configured', t_half_configured_is_inert),
    ('signed out, work is saved locally and nothing is sent', t_signed_out_never_calls),
    ('a network failure resolves and reports offline, not error', t_network_failure_resolves),
    ('an offline refresh keeps the session', t_offline_keeps_the_session),
    ('a refused refresh clears it', t_refused_refresh_signs_out),
    ('save() is durable before it returns', t_save_is_synchronous),
    ('pushes coalesce per document, not globally', t_push_coalesces_per_document),
    ('the push is an upsert carrying both auth headers', t_push_is_an_upsert),
    ('an oversized document is refused, not truncated', t_oversize_is_refused),
    ('flush sends what the debounce still held', t_flush_sends_pending),
    ('a remote row is adopted when there is nothing local', t_adopts_when_nothing_local),
    ('a remote change is adopted when only it moved', t_adopts_when_only_remote_moved),
    ('a local edit is kept and pushed when only it moved', t_pushes_back_when_only_local_moved),
    ('both moved: reported as a conflict, NEITHER overwritten', t_both_moved_is_a_conflict_and_nothing_is_lost),
    ('the conflict rule does not depend on the clock', t_conflict_does_not_depend_on_the_clock),
    ('resolving marks the adopted text synced', t_resolve_marks_adopted_text_synced),
    ('synced tracks the text sent, not a later edit', t_synced_tracks_the_pushed_text_not_a_later_edit),
    ('identity is email codes with no redirect anywhere', t_otp_endpoints),
    ('a first-time signup token is accepted, not just a magic-link one',
     t_verify_tries_signup_after_email),
    ('a returning sign-in still costs one request', t_verify_stops_on_success),
    ('verify does not retry into a dead connection', t_verify_does_not_retry_offline),
    ('a wrong code is reported once and signs nobody in', t_verify_reports_a_bad_code_once),
    ('concurrent callers share one token refresh', t_refresh_is_shared),
    ('sign-out clears locally even when the server is unreachable', t_sign_out_is_local_first),
    ('all twenty pages load four scripts, after practice.js', t_pages_load_all_four_in_order),
    ('the three menu apps declare their own CLOUD_APP', t_three_apps_declare_themselves),
    ('the hub loads cloud.js before its renderer', t_hub_loads_before_its_own_script),
    ('the injected stylesheet contains no raw colour', t_no_raw_colour_in_injected_css),
    ('unconfigured, all four files load and change nothing', t_dom_unconfigured_is_a_non_event),
    ('configured and offline, an edit is stored and saved work is restored',
     t_dom_configured_saves_and_restores),
    ('a save is the whole document, a restore fills both editors',
     t_dom_saves_the_whole_document_not_the_visible_half),
    ('a half-document saved before the split is repaired on restore',
     t_dom_a_half_document_saved_before_the_split_is_repaired),
    ('both offline-neutrality guards are load-bearing', t_dom_guard_mutants),
    ('the bar is one control at a time, with text before any emit',
     t_bar_is_one_control_at_a_time),
    ('the account drawer, its three views and My Progress', t_account_drawer_and_its_views),
    ('the display name round trips through user_metadata', t_display_name_round_trip),
    ('the bar names the connection, in every state, agreeing with the dot', t_connection_indicator),
    ('the connection artwork is the committed asset, cleaned', t_connection_artwork_is_the_committed_asset),
    ('the indicator is sized and coloured for the dark bar', t_connection_css_is_bar_safe),
    ('every account-UI mutant is caught', t_account_mutants),
    ('every mutant is caught', t_mutants),
]


def main():
    for name, fn in CHECKS:
        check(name, fn)
    width = max(len(n) for _, n, _ in results)
    failed = 0
    for ok, name, detail in results:
        print('  %s  %-*s  %s' % ('PASS' if ok else 'FAIL', width, name, detail))
        if not ok:
            failed += 1
    print()
    print('%d CHECK(S) FAILED' % failed if failed else '%d checks passed' % len(results))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
