/* cloud.js - the whole client side of cloud progress, with no dependencies.
 *
 * There is no Supabase SDK here and there cannot be: @supabase/supabase-js is an
 * ES-module bundle fetched from a CDN, so using it would need a module script
 * type and a network import, and a page opened over file:// can load neither.
 * What it actually offers over these ~200 lines is realtime subscriptions,
 * storage and a query builder, none of which this feature uses. So the two REST
 * surfaces are called directly: GoTrue under /auth/v1 for identity, PostgREST
 * under /rest/v1 for the one table in tools/schema.sql.
 *
 * NOTE the two banned spellings are not written out anywhere in this file, not
 * even in this comment. build.py greps these four files for them as plain
 * substrings, so quoting one in prose fails the build for a comment - which is
 * the same trap CLAUDE.md already records for a literal script tag in
 * workbench/index.html's markup. Describe them; do not spell them.
 *
 * EMAIL CODES, NOT MAGIC LINKS, and this is a correction rather than a
 * preference. A magic link works by emailing a URL that redirects back to the
 * page with tokens in the fragment, which requires a redirect target registered
 * in the project's allow-list. Over file:// the target is a per-machine absolute
 * path (file:///Users/<someone>/.../index.html) that differs for every learner
 * and cannot be registered, so the link would have to point at a hosted copy -
 * landing the learner somewhere other than the page holding their work. The
 * six-digit code has no redirect in it at all: the page asks /auth/v1/otp to
 * send one and hands what the learner types to /auth/v1/verify, which is a plain
 * API call and so works identically from a file:// page and a served one. Same
 * email identity, same rows, no URL.
 *
 * LOCAL FIRST, ALWAYS. localStorage is the source of truth and the cloud is a
 * mirror: every save writes locally and synchronously before any network call is
 * considered, and every public method here resolves rather than rejects. So an
 * unconfigured project, a signed-out learner, a dropped connection and a CORS
 * refusal are all the same non-event - the page behaves exactly as it did before
 * this file existed. That is the property the whole design is arranged around,
 * because the alternative is an editor that loses work when the wifi does.
 *
 * NOTHING HERE TOUCHES THE DOM. cloud-ui.js owns every pixel; this file owns
 * state and the network, and reports through subscribe(). That split is what
 * lets the harnesses drive it headlessly with no stub DOM at all.
 */
'use strict';

window.CLOUD = (function () {

  /* ---- configuration -------------------------------------------------- */

  var cfg = window.BAERILOG_CLOUD_CONFIG || {};
  var URL_BASE = (cfg.url || '').replace(/\/+$/, '');     // tolerate a trailing slash
  var ANON_KEY = cfg.anonKey || '';

  /* The one predicate the rest of the file (and all of cloud-ui.js) branches on.
     Both halves must be present: a URL with no key produces a 401 on every call,
     which would surface as a broken feature rather than an absent one. */
  function configured() { return !!(URL_BASE && ANON_KEY); }

  var SOURCE_LIMIT = 262144;   // must match schema.sql's check constraint
  var NET_TIMEOUT_MS = 12000;
  /* Every app that may own a row, and `save` refuses anything else - which is what makes a
     typo'd caller a returned null rather than a row that is written and never read back.
     `learn` is here because a topic's quiz reports a verdict now; it was NOT, so cloud-sync's
     own learn branch stored nothing at all and the hub's badge could never appear. Kept in step
     with the CHECK constraint in tools/schema.sql, which test_cloud.py compares them for. */
  var APPS = ['practice', 'learn', 'simulator', 'synthesis', 'compiler', 'pnr',
  'code2silicon'];

  /* ---- storage -------------------------------------------------------- */

  /* localStorage is wrapped because this file runs on pages opened over file://,
     where a browser may present it as an opaque origin and THROW on access
     rather than returning null. app.js reads it unguarded and has got away with
     it for years, but a throw from here would happen at load and take the page
     with it - so the failure mode is "cloud sync is unavailable", not a blank
     screen. */
  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function lsDel(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* nothing to undo */ }
  }

  var SESSION_KEY = 'baerilogCloudSession';
  /* One constant, so the writer and the prefix scan in listLocal() cannot disagree
     about where records live - two copies of a string key is how an index goes stale. */
  var DOC_PREFIX = 'baerilog:doc:';
  function docKey(app, item) { return DOC_PREFIX + app + ':' + item; }

  function readJson(key) {
    var raw = lsGet(key);
    if (!raw) return null;
    /* A corrupt record is DROPPED rather than propagated. It can only come from a
       half-written value or a hand-edited key, and returning null puts the page
       on the "nothing saved yet" path, which is a state it already handles. */
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /* ---- the network primitive ------------------------------------------ */

  /* Every request in this file goes through here, so timeout, JSON handling and
     error shape exist once. It RESOLVES on failure - {ok:false, ...} - because
     an unhandled rejection from a background sync is a console error the learner
     can do nothing about, and because every caller has to handle failure anyway.
     `offline` is distinguished from `error` deliberately: one is a state to sit
     in quietly and retry, the other is worth showing. */
  function req(path, opts) {
    opts = opts || {};
    var url = URL_BASE + path;
    var headers = { 'apikey': ANON_KEY };
    if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.prefer) headers['Prefer'] = opts.prefer;

    /* AbortController rather than a bare Promise.race, so a hung connection is
       actually torn down instead of left running behind a resolved promise. */
    var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctl) ctl.abort(); }, NET_TIMEOUT_MS);

    return window.fetch(url, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }
        if (res.ok) return { ok: true, status: res.status, data: data };
        /* Supabase reports errors under several key names depending on which of
           the two services answered, so all of them are folded into one string
           rather than the UI having to know which service it was talking to. */
        var msg = (data && (data.msg || data.message || data.error_description ||
                            data.error || data.hint)) || ('HTTP ' + res.status);
        return { ok: false, status: res.status, error: String(msg), data: data };
      });
    }).catch(function (err) {
      /* A CORS refusal, a DNS failure, a dropped connection and our own abort
         are indistinguishable here by design - the browser deliberately withholds
         the detail. All of them mean "the server was not reached". */
      var aborted = err && err.name === 'AbortError';
      return { ok: false, offline: true, error: aborted ? 'timed out' : 'no connection' };
    }).then(function (out) {
      window.clearTimeout(timer);
      return out;
    });
  }

  /* ---- session -------------------------------------------------------- */

  /* {access_token, refresh_token, expires_at (ms epoch), email, user_id} */
  var session = readJson(SESSION_KEY);

  function saveSession(s) {
    session = s;
    if (s) lsSet(SESSION_KEY, JSON.stringify(s));
    else lsDel(SESSION_KEY);
    emit();
  }

  /* GoTrue answers /verify and /token with the same envelope, so one reader
     serves both and a refresh cannot end up shaped differently from a sign-in. */
  function adoptTokens(data) {
    if (!data || !data.access_token) return false;
    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      /* expires_in is seconds from now. Sixty seconds are shaved off so a request
         is never sent with a token that expires while it is in flight. */
      expires_at: Date.now() + ((Number(data.expires_in) || 3600) - 60) * 1000,
      email: (data.user && data.user.email) || (session && session.email) || '',
      user_id: (data.user && data.user.id) || (session && session.user_id) || '',
      /* The display name, out of GoTrue's own user_metadata rather than a table of
         our own: it needs no migration, no RLS policy and no second request, and it
         comes back inside the very envelope this function already reads. `||` down to
         the previous value because a refresh answers without `user`, and dropping the
         name on every token refresh would make it look like it had not saved. */
      name: (data.user && data.user.user_metadata && data.user.user_metadata.full_name)
            || (session && session.name) || ''
    });
    return true;
  }

  function signedIn() { return !!(session && session.access_token && session.user_id); }

  /* Returns a usable access token, refreshing first if it is due. Every REST
     call goes through this rather than reading session.access_token directly,
     which is what stops a long editing session from failing its first save after
     an hour with an error the learner cannot interpret. */
  var refreshing = null;
  function token() {
    if (!signedIn()) return Promise.resolve(null);
    if (Date.now() < (session.expires_at || 0)) return Promise.resolve(session.access_token);
    /* Concurrent callers share one refresh: a page that saves a document and
        pulls a list at the same moment would otherwise spend its single-use
        refresh token twice, and the loser of that race is signed out. */
    if (!refreshing) {
      refreshing = req('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: session.refresh_token }
      }).then(function (r) {
        refreshing = null;
        if (r.ok && adoptTokens(r.data)) return session.access_token;
        /* A REFUSED refresh means the session is genuinely finished (revoked, or
           the token already spent), so it is cleared - leaving it in place would
           show a signed-in account whose every save fails. An OFFLINE refresh is
           not that: the session may well be fine, so it is kept and the caller
           simply gets nothing this time. Conflating the two signs people out
           every time their wifi drops. */
        if (!r.offline) { saveSession(null); status('signed-out'); }
        return null;
      });
    }
    return refreshing;
  }

  /* ---- identity ------------------------------------------------------- */

  /* Ask for a code. `create_user: true` makes this one call serve both sign-up
     and sign-in, which is the whole appeal of a code: there is no separate
     registration step and no password to recover. */
  function requestCode(email) {
    if (!configured()) return Promise.resolve({ ok: false, error: 'no Supabase project configured' });
    email = String(email || '').trim();
    if (!email || email.indexOf('@') < 1) return Promise.resolve({ ok: false, error: 'that does not look like an email address' });
    status('sending');
    return req('/auth/v1/otp', { method: 'POST', body: { email: email, create_user: true } })
      .then(function (r) {
        status(r.ok ? 'code-sent' : (r.offline ? 'offline' : 'error'));
        return r.ok ? { ok: true, email: email } : { ok: false, error: r.error, offline: r.offline };
      });
  }

  /* Exchange the typed code for a session.
     
     TWO TYPES ARE TRIED, and that is not belt-and-braces - it is the difference
     between a learner's first sign-in and every one after it. Supabase decides
     which email to send by whether the address already exists: a brand-new one
     gets the "Confirm signup" template and a token that verifies as
     type 'signup', while a returning one gets "Magic Link" and a token that
     verifies as 'email'. One request cannot cover both, and the failure is at its
     worst on a learner's very first attempt - the code in their inbox is correct
     and the page rejects it, which reads as the whole feature being broken.

     'email' is tried first because it is the steady state (a project accumulates
     returning users), and 'signup' is the fallback. The retry is deliberately NOT
     attempted when the first answer was `offline` - there was no verdict to
     disagree with, and firing a second request into a dead connection just
     doubles the wait before the honest message appears.

     Note this costs a spent token at most once: a wrong code fails both types and
     reports the second error, which says the same thing as the first. */
  var VERIFY_TYPES = ['email', 'signup'];

  function verifyCode(email, code) {
    if (!configured()) return Promise.resolve({ ok: false, error: 'no Supabase project configured' });
    code = String(code || '').replace(/\s+/g, '');
    if (!code) return Promise.resolve({ ok: false, error: 'enter the code from the email' });
    email = String(email || '').trim();
    status('verifying');

    function attempt(i) {
      return req('/auth/v1/verify', {
        method: 'POST', body: { email: email, token: code, type: VERIFY_TYPES[i] }
      }).then(function (r) {
        if (r.ok && adoptTokens(r.data)) { status('signed-in'); return { ok: true }; }
        if (!r.offline && i + 1 < VERIFY_TYPES.length) return attempt(i + 1);
        status(r.offline ? 'offline' : 'error');
        return { ok: false, error: r.error || 'that code was not accepted', offline: r.offline };
      });
    }
    return attempt(0);
  }

  function signOut() {
    var had = session;
    /* Local state is cleared FIRST and unconditionally. Telling the server is a
       courtesy that may fail offline, and a sign-out that appears not to work
       because the network is down is worse than a revoked-token call nobody
       made - especially on a shared machine. */
    saveSession(null);
    status('signed-out');
    if (had && had.access_token && configured()) {
      req('/auth/v1/logout', { method: 'POST', token: had.access_token, body: {} });
    }
    return Promise.resolve({ ok: true });
  }

  /* ---- local records -------------------------------------------------- */

  /* A record is {source, verdict, updated_at, synced}:
       updated_at - when the EDIT happened, by the client's clock
       synced     - the source text last confirmed accepted by the server, which
                    is what makes "there are unpushed edits" answerable without a
                    round trip, and is what the conflict rule below reads. */
  function localGet(app, item) { return readJson(docKey(app, item)); }

  function localPut(app, item, rec) {
    lsSet(docKey(app, item), JSON.stringify(rec));
    return rec;
  }

  /* ---- pushing -------------------------------------------------------- */

  /* Pushes are COALESCED PER DOCUMENT, not globally: one timer per (app, item),
     so typing in the editor produces one request a second or so instead of one
     per keystroke, while a save to a different document is never delayed behind
     an unrelated one.

     Keyed as app -> item -> timer id, NOT by a joined string. Joining the pair
     into one key and splitting it back out worked and was still wrong: an `item`
     containing the separator would flush the wrong document, and since `item` is a
     manifest slug today that bug would have waited for the first exercise named
     with whatever the separator happened to be. A nested map has no encoding to
     get wrong, so the question does not arise. */
  var pushTimers = {};
  var PUSH_DEBOUNCE_MS = 1200;
  var inFlight = 0;


  function pushNow(app, item) {
    var rec = localGet(app, item);
    if (!rec || !configured() || !signedIn()) return Promise.resolve({ ok: false });
    if (rec.source != null && rec.source.length > SOURCE_LIMIT) {
      status('too-big');
      return Promise.resolve({ ok: false, error: 'this document is too large to sync (over 256 KB)' });
    }
    inFlight++;
    status('syncing');
    return token().then(function (tok) {
      if (!tok) { inFlight--; settle(); return { ok: false }; }
      var row = {
        user_id: session.user_id,
        app: app,
        item: item,
        source: rec.source == null ? null : rec.source,
        verdict: rec.verdict || null,
        /* Sent as ISO because the column is timestamptz. The value is the edit
           time, so an offline edit keeps its own moment and cannot be beaten by
           a stale copy that merely happened to reach the server later. */
        updated_at: new Date(rec.updated_at || Date.now()).toISOString()
      };
      return req('/rest/v1/progress', {
        method: 'POST', token: tok, body: row,
        /* merge-duplicates is what turns this POST into an upsert against the
           (user_id, app, item) primary key; without it a second save to the same
           document is a 409 for the rest of time. return=minimal keeps the
           response empty, since nothing here reads the row back. */
        prefer: 'resolution=merge-duplicates,return=minimal'
      }).then(function (r) {
        inFlight--;
        if (r.ok) {
          /* Record what the server now holds, so a later pull can tell a local
             edit from a local copy. Re-read rather than reusing `rec`: the
             learner may well have typed more while this was in flight, and
             marking THAT text as synced would strand it.

             AND IF IT IS GONE, IT STAYS GONE - no `|| rec` fallback. `forget` may
             have run while this push was in the air, and writing the captured
             record back RESURRECTED it in the reader's own browser: the row
             reappeared in My Projects moments after they removed it, with the
             server row already deleted. The note on `forget` accepts that a POST
             may land after the DELETE - that is the server's ordering, and
             local-first accepts it - but it never meant the local record could
             come back. Found by the Remove button's own test, which deleted a
             project while its seeding push was still pending. */
          var cur = localGet(app, item);
          if (cur) {
            cur.synced = rec.source;
            localPut(app, item, cur);
          }
          lastError = null;
        } else if (!r.offline) {
          lastError = r.error;
        }
        settle(r);
        return r;
      });
    });
  }

  function settle(r) {
    if (inFlight > 0) return;
    if (r && r.offline) status('offline');
    else if (lastError) status('error');
    else status(signedIn() ? 'synced' : 'signed-out');
  }

  /* ---- the public save/load pair -------------------------------------- */

  /* Writes locally and SYNCHRONOUSLY, then pushes in the background. The order is
     the whole contract: by the time this returns, the work is durable to the
     extent the page can make it durable, whatever the network then does. */
  function save(app, item, fields) {
    if (APPS.indexOf(app) < 0) return null;               // guards a typo'd caller
    var prev = localGet(app, item) || {};
    var rec = {
      source: fields && 'source' in fields ? fields.source : prev.source,
      verdict: fields && 'verdict' in fields ? fields.verdict : prev.verdict,
      updated_at: Date.now(),
      synced: prev.synced
    };
    localPut(app, item, rec);

    if (configured() && signedIn()) {
      if (!pushTimers[app]) pushTimers[app] = {};
      if (pushTimers[app][item]) window.clearTimeout(pushTimers[app][item]);
      pushTimers[app][item] = window.setTimeout(function () {
        delete pushTimers[app][item];
        pushNow(app, item);
      }, PUSH_DEBOUNCE_MS);
      status('pending');
    }
    return rec;
  }

  /* Synchronous by design: a page seeds its editor from this during load, and an
     async read would mean either a flash of the wrong document or a spinner over
     a feature that is meant to be invisible. */
  function load(app, item) { return localGet(app, item); }

  /* Delete a record outright - the only destructive operation here, and the only one
     that is not "write something new". A practice page's Reset calls it: that button
     returns the exercise to the state a first visit finds, which means the hub must stop
     badging it and the exercise sheet must greet the next load, and BOTH of those are
     read off the existence of this row. Clearing the verdict alone leaves the row, which
     is what `in progress` means - the right answer for the Console's Clear, and the wrong
     one for a Reset.

     A PENDING PUSH CANNOT RESURRECT THE ROW, and it is worth saying why rather than
     guarding against it: `pushNow` re-reads the record when the debounce expires and
     returns immediately if there is none. So deleting locally is what disarms the push,
     and a `clearTimeout` here would be belt over braces - it was written, and a mutation
     sweep correctly reported that removing it changed nothing observable. (Nothing can
     help with a push already IN FLIGHT when this is called: that POST may land after the
     DELETE. Local-first accepts that, as every other operation here does.)

     Local first, as everywhere here: the row is gone before the request is made, so an
     offline Reset still un-starts the exercise on this machine. A failed DELETE therefore
     leaves a server row this browser no longer has - which the conflict rule already
     handles as "only the remote moved", i.e. the next pull adopts it. That is the same
     trade every other operation in this file makes, and the alternative (refusing to
     forget while offline) would make Reset depend on the network. */
  function forget(app, item) {
    if (APPS.indexOf(app) < 0) return;                    // guards a typo'd caller
    lsDel(docKey(app, item));
    if (!configured() || !signedIn()) return;
    inFlight++;
    status('syncing');
    token().then(function (tok) {
      if (!tok) { inFlight--; settle(); return; }
      /* Filtered on app and item only - the row's third key column is user_id, and RLS
         (progress_delete_own in tools/schema.sql) is what confines this to the caller's
         own rows. Naming user_id here as well would be belt and braces over a policy
         that is the actual guarantee. */
      return req('/rest/v1/progress?app=eq.' + encodeURIComponent(app)
                 + '&item=eq.' + encodeURIComponent(item),
                 { method: 'DELETE', token: tok }).then(function (r) {
        inFlight--;
        if (r.ok) lastError = null;
        else if (!r.offline) lastError = r.error;
        settle(r);
      });
    });
  }

  /* ---- minting a document name ---------------------------------------- */

  /* A NEW `item`, for an app that has more than one document. Code2Silicon's Save mints one when
     it turns the scratch document into a named project, and projects.html mints one when it
     imports a file - two callers, so the rule lives here rather than in whichever of them was
     written first. It is a fact about how a row is keyed, which is this file's business.

     OPAQUE AND PERMANENT, AND DELIBERATELY NOT DERIVED FROM THE NAME. A name is the reader's: it
     can be changed and it can be repeated - two projects may both be called `Counter` - and a
     name-derived key would silently merge them, then un-merge them on a rename. This is a primary
     key column (see tools/schema.sql), so it has to outlive whatever the row is called.

     Time in base 36 so a listing sorts and reads sensibly, plus four random characters so two
     mints in the same millisecond - two tabs, a double press - cannot collide. Not a UUID:
     there is no crypto dependency in this file and the collision domain is one person's own
     documents. */
  function newItem() {
    var t = Date.now().toString(36), r = '';
    for (var i = 0; i < 4; i++) {
      r += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)];
    }
    return 'p-' + t + '-' + r;
  }

  /* ---- the document list, for "My Design" ------------------------------ */

  /* Every document this browser has stored, newest first. Enumerated out of
     localStorage rather than kept as an index alongside it, because an index is a
     second source of truth that can disagree with the records - and the prefix scan
     cannot: whatever `save()` wrote is what this finds.

     `length`/`key(i)` rather than Object.keys, which returns nothing useful for a
     real Storage object. Wrapped for the same reason every other access here is:
     a page opened over file:// may have no storage at all. */
  function listLocal() {
    var out = [];
    var n = 0;
    try { n = window.localStorage.length; } catch (e) { return out; }
    for (var i = 0; i < n; i++) {
      var k = null;
      try { k = window.localStorage.key(i); } catch (e) { break; }
      if (!k || k.indexOf(DOC_PREFIX) !== 0) continue;
      /* app is the next segment and item is ALL of the rest: an item may contain a
         colon, so splitting and taking [3] would silently truncate one. */
      var rest = k.slice(DOC_PREFIX.length);
      var cut = rest.indexOf(':');
      if (cut < 0) continue;
      var app = rest.slice(0, cut), item = rest.slice(cut + 1);
      var rec = readJson(k);
      if (!rec) continue;
      out.push({
        app: app, item: item,
        updatedAt: rec.updated_at || 0,
        verdict: rec.verdict || null,
        /* "is the server holding what we hold" - the same comparison the conflict
           rule turns on, so this column cannot disagree with the sync layer. */
        synced: rec.source !== undefined ? rec.source === rec.synced : true,
        bytes: rec.source ? rec.source.length : 0,
        here: true
      });
    }
    return out.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }

  /* The same list from the server, for the case the local one cannot answer: a
     learner who signs in on a second machine has rows in the cloud and nothing in
     this browser, and a "My Design" that showed an empty list there would be
     lying about their own work.

     It deliberately does NOT write what it finds into localStorage. Adopting rows
     is `pull()`'s job, under the conflict rule; doing it from a listing would
     resurrect documents behind the learner's back and give this read the power to
     destroy an edit. So the rows come back marked `here: false` and are displayed,
     not merged. Resolves rather than rejects, like every other method here. */
  function listRemote() {
    if (!configured() || !signedIn()) return Promise.resolve({ ok: false, rows: [] });
    return token().then(function (tok) {
      if (!tok) return { ok: false, rows: [] };
      return req('/rest/v1/progress?select=app,item,updated_at,verdict', { token: tok })
        .then(function (r) {
          if (!r.ok) return { ok: false, offline: r.offline, error: r.error, rows: [] };
          return {
            ok: true,
            rows: (r.data || []).map(function (row) {
              return {
                app: row.app, item: row.item,
                updatedAt: Date.parse(row.updated_at) || 0,
                verdict: row.verdict || null,
                synced: true, bytes: 0, here: false
              };
            })
          };
        });
    });
  }

  /* Local first, as everywhere else: a document this browser holds is described by
     what it holds, and a remote row only appears when there is no local copy of it. */
  function list() { return listLocal(); }
  function listAll() {
    var mine = listLocal();
    return listRemote().then(function (r) {
      /* A NESTED map, app -> item -> true, and not a joined string key. That is the
         same rule pushTimers follows and for the same two reasons: an `item` may
         contain whatever separator is chosen, and a separator that is not printable
         makes the file silently un-greppable. This code had a NUL in it for exactly
         one commit, which is why tools/build.py now scans these four files for
         control bytes. */
      var seen = {};
      mine.forEach(function (d) {
        if (!seen[d.app]) seen[d.app] = {};
        seen[d.app][d.item] = true;
      });
      var extra = r.rows.filter(function (d) { return !(seen[d.app] && seen[d.app][d.item]); });
      return { ok: r.ok, offline: r.offline, error: r.error,
               docs: mine.concat(extra).sort(function (a, b) { return b.updatedAt - a.updatedAt; }) };
    });
  }

  /* ---- the display name ------------------------------------------------ */

  /* Written to GoTrue's user_metadata, which is why there is no schema change and
     no policy to get right. The session's copy is updated from the response rather
     than from the argument, so what the panel shows is what the server accepted. */
  function setName(name) {
    var clean = String(name === undefined || name === null ? '' : name).trim().slice(0, 60);
    if (!configured() || !signedIn()) return Promise.resolve({ ok: false, error: 'not signed in' });
    return token().then(function (tok) {
      if (!tok) return { ok: false, error: 'not signed in' };
      return req('/auth/v1/user', {
        method: 'PUT', token: tok, body: { data: { full_name: clean } }
      }).then(function (r) {
        if (!r.ok) {
          lastError = r.offline ? null : r.error;
          status(r.offline ? 'offline' : 'error');
          return { ok: false, offline: r.offline, error: r.error };
        }
        var got = (r.data && r.data.user_metadata && r.data.user_metadata.full_name);
        session.name = got === undefined ? clean : (got || '');
        saveSession(session);                   // persists AND emits, so the UI follows
        return { ok: true, name: session.name };
      });
    });
  }

  /* Flush every pending push immediately. Called on pagehide, where a debounce
     timer that has not fired yet would otherwise lose the last edit. */
  function flush() {
    var sent = 0;
    Object.keys(pushTimers).forEach(function (app) {
      Object.keys(pushTimers[app]).forEach(function (item) {
        window.clearTimeout(pushTimers[app][item]);
        delete pushTimers[app][item];
        pushNow(app, item);
        sent++;
      });
    });
    return sent;
  }

  /* ---- pulling, and the conflict rule -------------------------------- */

  /* The one rule worth stating plainly: A NEWER CLOUD COPY NEVER SILENTLY
     REPLACES UNPUSHED LOCAL WORK. Last-write-wins is fine when one side has
     nothing at stake, and unacceptable otherwise - the loser is somebody's
     unsaved editor. So the three cases are separated:
       - no local copy, or local is already identical to what we pushed  -> adopt
       - local is newer                                                 -> keep, and push
       - both changed since the last sync                               -> CONFLICT,
         reported to the caller and left entirely alone for the learner to resolve.
     Client clocks make the comparison approximate (a machine set an hour behind
     will think its edits are older), which is exactly why the conflict branch
     does not depend on the clock being right: it triggers on both sides having
     diverged from the last synced text, not on which timestamp is larger. */
  function pull(app) {
    if (!configured() || !signedIn()) return Promise.resolve({ ok: false, adopted: [], conflicts: [] });
    status('syncing');
    return token().then(function (tok) {
      if (!tok) return { ok: false, adopted: [], conflicts: [] };
      return req('/rest/v1/progress?select=item,source,verdict,updated_at&app=eq.' +
                 encodeURIComponent(app), { token: tok }).then(function (r) {
        if (!r.ok) {
          if (!r.offline) lastError = r.error;
          status(r.offline ? 'offline' : 'error');
          return { ok: false, offline: r.offline, error: r.error, adopted: [], conflicts: [] };
        }
        var adopted = [], conflicts = [], pushBack = [];
        (r.data || []).forEach(function (row) {
          var remoteAt = Date.parse(row.updated_at) || 0;
          var rec = localGet(app, row.item);

          if (!rec) {                                     // nothing here: take it
            localPut(app, row.item, {
              source: row.source, verdict: row.verdict,
              updated_at: remoteAt, synced: row.source
            });
            adopted.push(row.item);
            return;
          }

          var localDirty = rec.source !== rec.synced;     // edits we never pushed
          var remoteMoved = row.source !== rec.synced;    // the server has moved on

          if (!remoteMoved) {                             // server holds what we sent
            if (localDirty) pushBack.push(row.item);      // ours is strictly ahead
            return;
          }
          if (!localDirty) {                              // only the server moved
            localPut(app, row.item, {
              source: row.source, verdict: row.verdict,
              updated_at: remoteAt, synced: row.source
            });
            adopted.push(row.item);
            return;
          }
          /* Both moved. Nothing is overwritten; the remote text is handed to the
             caller so the UI can offer it, and the local record is untouched so
             doing nothing is a safe outcome. */
          conflicts.push({
            item: row.item, remote: row.source, remoteAt: remoteAt,
            local: rec.source, localAt: rec.updated_at || 0
          });
        });
        pushBack.forEach(function (item) { pushNow(app, item); });
        lastError = null;
        status(conflicts.length ? 'conflict' : 'synced');
        return { ok: true, adopted: adopted, conflicts: conflicts };
      });
    });
  }

  /* Resolving a conflict is the caller's decision, taken explicitly. Adopting
     the remote text is the only branch that needs help, because it has to mark
     the adopted text as synced or the very next pull reports the same conflict
     again; keeping the local copy is just a push. */
  function resolve(app, item, choice, remoteText) {
    var rec = localGet(app, item) || {};
    if (choice === 'remote') {
      localPut(app, item, {
        source: remoteText, verdict: rec.verdict,
        updated_at: Date.now(), synced: remoteText
      });
      emit();
      return localGet(app, item);
    }
    rec.updated_at = Date.now();
    localPut(app, item, rec);
    pushNow(app, item);
    return rec;
  }

  /* ---- status and subscribers ---------------------------------------- */

  /* One string, and cloud-ui.js renders it. 'off' is not an error and never
     shows: it is what an unconfigured project reports, which is the state this
     repo ships in. */
  var state = configured() ? (signedIn() ? 'synced' : 'signed-out') : 'off';
  var lastError = null;
  var subs = [];

  function status(s) { if (s) state = s; emit(); }
  function emit() {
    var snap = info();
    subs.forEach(function (fn) {
      /* A throwing subscriber must not take the others down with it, nor break
         the network call that emitted. */
      try { fn(snap); } catch (e) { /* a UI bug is not a sync failure */ }
    });
  }

  function info() {
    return {
      configured: configured(),
      signedIn: signedIn(),
      email: (session && session.email) || '',
      name: (session && session.name) || '',
      state: state,
      error: lastError,
      pending: Object.keys(pushTimers).reduce(function (n, app) {
        return n + Object.keys(pushTimers[app]).length;
      }, 0) + inFlight
    };
  }

  function subscribe(fn) {
    subs.push(fn);
    try { fn(info()); } catch (e) { /* as above */ }
    return function () { subs = subs.filter(function (f) { return f !== fn; }); };
  }

  /* A pending debounce is not durable, so it is flushed when the page goes away.
     pagehide rather than beforeunload: it fires on mobile backgrounding too, and
     unlike unload it does not disable the request. */
  window.addEventListener('pagehide', function () { flush(); });

  return {
    configured: configured, signedIn: signedIn, info: info, subscribe: subscribe,
    requestCode: requestCode, verifyCode: verifyCode, signOut: signOut,
    save: save, load: load, forget: forget, pull: pull, flush: flush, resolve: resolve,
    setName: setName, list: list, listAll: listAll, newItem: newItem,
    /* Exposed for the harnesses only - they assert the limit and the app list
       agree with schema.sql rather than restating either. */
    _limits: { source: SOURCE_LIMIT, apps: APPS },
    /* Also harness-only: drive the state machine to one named state and emit, so a
       renderer can be checked against EVERY entry of its table instead of the four or
       five a scripted sign-in happens to pass through. It is `status` and nothing more -
       no session, no request, no storage - so it cannot be a way in to anything a caller
       could not already reach; the states it sets are the same strings the network paths
       set. Named with the underscore prefix _limits already uses, for the same reason. */
    _setState: status
  };
})();
