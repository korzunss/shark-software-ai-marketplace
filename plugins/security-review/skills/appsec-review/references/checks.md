# Checks — how to run each, per X row

## Contents
- X1 — input validation at the boundary
- X2 — authentication
- X3 — authorization (vertical and horizontal)
- X4 — SQL / query injection
- X5 — command and argv injection
- X6 — template, code and expression injection
- X7 — unsafe deserialization and prototype pollution
- X8 — SSRF and credentialed outbound requests
- X9 — path traversal and file access
- X10 — XSS / unsafe HTML
- X11 — CSRF, CORS and exposure config
- X12 — webhook and signature verification
- X13 — secrets handling
- X14 — error handling and log leakage
- X15 — dependencies

X16 and X17 (LLM input and output) are in
[llm-pipeline.md](llm-pipeline.md), not here.

Every row ends in a quoted **source** and a quoted **sink** (or, for config
rows, the quoted config line). Where `.sdd/security.md` names a control or
chokepoint for the row, verify it is still in place and still reached.

## X1 — input validation at the boundary
**How to check:** open the handler's declared schema (framework route schema,
a validation middleware, a DTO/validator class, a `schema.parse` at the top of
the handler). The finding is a field the handler reads with **no** schema
covering it, or a handler that reaches past the parsed value (`req.raw`, an
unparsed header, `req.body` alongside a parsed copy) to get raw input. Check
the content-type parsers too: an extra parser (e.g. `text/plain`, form
bodies) widens what reaches a handler.
**Quote:** source = the unschemaed field access; sink = wherever it is used
(a query, a URL, a path, a subprocess arg, a template).
**False positives:** a field already narrowed by an enum, a format (`uuid`,
`url` with a scheme check) or a numeric range needs no further check; a GET
route with no body needs no body schema.

## X2 — authentication
**How to check:** list the entry points the change adds or touches and find
how each is protected: a global auth hook/middleware with an allow-list of
public routes, a per-route guard/decorator, or nothing. Then read the
verification itself when it is touched: token signature verified with the
expected algorithm (no `alg: none`, no decode-without-verify), expiry and
audience/issuer checked, session looked up server-side, comparison of secrets
or tokens in constant time. Fail-open is the classic bug: a `catch` that
continues as anonymous-but-allowed, a missing `return` after sending 401, a
route added to the public allow-list by pattern (`/api/*`).
**Quote:** source = the request reaching the handler (route registration and
the absent/bypassed guard); sink = the privileged action the handler performs.
**False positives:** routes explicitly public by design (health check, login,
public assets) that perform no privileged action; projects that declare no
authentication in `.sdd/security.md` → *Not applicable by design*.

## X3 — authorization (vertical and horizontal)
**How to check:**
- *Vertical:* an action restricted to a role or permission (admin, owner,
  billing) checks that role on the server for **this** route — not only in the
  UI, not only on a sibling route.
- *Horizontal (IDOR):* every read or write of a resource addressed by an id
  from the request (`params.id`, `body.orgId`, a query filter) is scoped to the
  caller — `WHERE id = $1 AND owner_id = $caller`, a tenant filter, or an
  explicit ownership check before the action. A lookup by id alone, followed
  by an action, is the finding.
- Mass assignment: a request object spread into an update (`{...req.body}`)
  can set `role`, `ownerId`, `isAdmin` unless the schema strips them.
**Quote:** source = the id/field from the request; sink = the query or action
that uses it without the caller check.
**False positives:** resources that are public by design; ids that come from
the authenticated session rather than the request.

## X4 — SQL / query injection
**How to check:** every raw SQL fragment — tagged templates, `raw(...)`,
`query(string)`, string concatenation into a query, ORM `whereRaw`/`$queryRawUnsafe`
— and NoSQL queries built from input objects (`{ $where }`, operator
injection via `{"$gt": ""}` in a JSON body). Confirm request-derived text is
bound as a parameter (placeholder or the library's tagged-template binding),
never concatenated; identifiers (column, table, sort direction) come from a
code-side allowlist.
**Quote:** the interpolated value's source; the raw query sink.
**False positives:** a raw fragment built from a fixed, code-only literal
(e.g. a column chosen by a `switch` over a narrow enum).

## X5 — command and argv injection
**How to check:** every `spawn`/`execFile`/`exec`/`system`/backtick call. Args
must be an array (never a shell string via `shell: true`, `exec`, or string
concatenation); the executable path itself must not be attacker-controlled;
a request- or content-derived value passed **positionally** needs a `--`
separator before it (or another guarantee it cannot be read as a flag, e.g.
rejecting a leading `-`). Tools invoked on untrusted repositories or files
must not execute content from them (git hooks, `core.fsmonitor`, build
scripts, `npm install` lifecycle scripts).
**Quote:** source = the argv element's origin; sink = the spawned command
line.
**False positives:** an argument that is always a fixed literal chosen by
code, never by request or content.

## X6 — template, code and expression injection
**How to check:** `eval`, `new Function`, `vm.runIn*`, `setTimeout(string)`,
dynamic `import()`/`require()` with a variable path, server-side template
engines compiling a template string that contains input (SSTI), expression
languages and `RegExp` built from input that is then executed as code.
**Quote:** source = the input reaching the compiled/evaluated string; sink =
the evaluation call.
**False positives:** templates that are fixed files and receive input only as
escaped variables; dynamic imports chosen from a code-side map.

## X7 — unsafe deserialization and prototype pollution
**How to check:** native/object deserializers on untrusted bytes
(`pickle.loads`, `yaml.load` without a safe loader, PHP `unserialize`, Java
`ObjectInputStream`, `node-serialize`), and deep merges or path setters
(`_.merge`, `_.set`, hand-written recursive merge) applied to parsed input
without blocking `__proto__`, `constructor` and `prototype` keys.
**Quote:** source = the untrusted payload; sink = the deserialize/merge call
and the property that becomes reachable.
**False positives:** `JSON.parse` into a value that is then schema-validated;
safe YAML loaders; merges of code-owned objects.

## X8 — SSRF and credentialed outbound requests
**How to check:** find where a user- or content-supplied host, URL, or "hint"
reaches an HTTP client, SDK call, image fetcher or webhook sender — especially
one that also carries a stored credential (an API key, a token, cloud
metadata access). Confirm:
- the allowlist check runs — and can reject — **before** the hint is used to
  pick among allowed values; a hint may disambiguate among trusted hosts, it
  must never be able to add one;
- the scheme is restricted to `http(s)` (a bare URL validator often accepts
  `file:`, `gopher:` and others);
- redirects are not followed to a non-allowed host, and private/link-local
  ranges (cloud metadata `169.254.169.254`, `localhost`, RFC 1918) are
  rejected after DNS resolution when arbitrary hosts are allowed at all.
**Quote:** source = the request field naming the host/URL; sink = the outbound
request (name the credential header that would be sent).
**False positives:** a URL built entirely from configuration, with no
request-derived host, port or scheme (a path-only variation is NR9).

## X9 — path traversal and file access
**How to check:** any `path.join`/`resolve`/`new URL`/file open fed a request-
or content-derived string (a file path from a diff, an archive entry, an
upload filename, a clone-relative path). Two sequencing bugs to check for
specifically:
- A `..`/null-byte/leading-`-`/absolute-path guard must run on the **raw
  string**, before `new URL()` or path normalisation — the WHATWG URL parser
  silently strips `..` segments, so a guard placed after it never fires.
- A `realpath` containment check must resolve **both** the target and the
  allowed root before comparing (`p === root || p.startsWith(root + sep)`) —
  resolving only the target fails closed the moment the allowed root itself
  sits behind a symlink, and a plain `startsWith(root)` without the separator
  accepts sibling directories (`/data-evil` for root `/data`).
Archive extraction must reject entries that escape the target (zip-slip) and
symlink entries pointing outside it; uploads must not keep the client-chosen
filename as a path.
**Quote:** source = the raw joined/parsed string; sink = the file-system or
tool call.
**False positives:** a path built only from server-controlled segments (a
fixed subfolder name, a generated id).

## X10 — XSS / unsafe HTML
**How to check:** raw-HTML sinks — `dangerouslySetInnerHTML`, `v-html`,
`innerHTML`/`outerHTML`/`insertAdjacentHTML`, Angular `[innerHTML]` with
`bypassSecurityTrust*`, `|safe`/`html_safe`/`{{{ }}}` in server templates,
Markdown rendered to HTML with raw HTML enabled — fed content that originates
from users, repositories, third-party APIs or model output. Confirm a
sanitizer (e.g. DOMPurify with a conservative config) runs on the exact value
reaching the sink. Also `href`/`src` attributes from input without a scheme
allowlist (`javascript:`), and JSON embedded in a `<script>` tag without
escaping `</script>`.
**Quote:** source = where the content comes from; sink = the raw-HTML
assignment.
**False positives:** framework text interpolation with default escaping (NR10).

## X11 — CSRF, CORS and exposure config
**How to check:** the app bootstrap and server entry for the bind host, CORS
options, CSRF defences, cookie flags (`SameSite`, `Secure`, `HttpOnly`),
security headers, rate-limit registration, and whether any mutating route
accepts a non-JSON or `text/plain`/form body (which a plain HTML form can send
cross-origin — CORS only stops the browser from *reading* the response, not
from *sending* the request, so CORS is not a CSRF control). For cookie-based
auth, state-changing requests need a CSRF defence (token, `SameSite=Lax/Strict`
plus no side-effecting GET, or an `Origin`/custom-header check). For local
services, a non-loopback bind or a missing Host-header allowlist exposes the
service to the network or to DNS rebinding. The finding is a change that
**widens** any of these: `origin: '*'` or a reflected origin with
`credentials: true`, a dropped CSRF check, rate limiting removed outside
tests, binding to `0.0.0.0`, a side-effecting GET.
**Quote:** the config line changed.
**False positives:** an explicit test-environment branch; settings declared
in `.sdd/security.md` → *Exposure* that the change does not alter (report a
pre-existing weak setting as informational, never as a new CRITICAL, unless
the change makes it worse).

## X12 — webhook and signature verification
**How to check:** every inbound webhook or signed callback. The signature is
computed over the **raw** request body (not a re-serialised parsed object),
with the provider's documented algorithm and secret, and compared in constant
time (`timingSafeEqual`, `hmac.compare_digest`); a timestamp or nonce is
checked against a replay window when the provider supplies one; a missing or
invalid signature rejects the request **before** any side effect; the handler
does not trust event fields it could re-fetch from the provider instead.
**Quote:** source = the webhook payload/headers; sink = the side effect the
handler performs, and the verification line (or its absence).
**False positives:** endpoints authenticated another way (mTLS, a private
network declared in `.sdd/security.md`).

## X13 — secrets handling
**How to check:** grep the changed files for secret-pattern shapes (a
provider token prefix, `AKIA…`, `-----BEGIN … PRIVATE KEY-----`, a
`key`/`secret`/`token`/`password` assignment from a literal) and confirm any
real secret flows only through the project's secrets/config chokepoints
(named in `.sdd/security.md` or the instructions) — never into a log call, an
HTTP response body, a URL query string, an error message, client-side
bundles (`NEXT_PUBLIC_*`, `VITE_*` prefixed variables), or an LLM prompt. A
secret or credential committed in the diff is CRITICAL.
**Quote:** the logging/response/prompt call, and the secret's origin.
**False positives:** a variable named `token`/`key` holding a non-secret id
(a run id, a cache key); placeholder values in `.env.example`.

## X14 — error handling and log leakage
**How to check:** every `catch` block and error handler touched by the
change. It must fail closed (return or throw an error response, never
proceed as if the request succeeded, never skip an auth or validation step on
error), and the logged or returned message must not include a stack trace, a
secret, or raw sensitive input in a production code path.
**Quote:** the `catch` block or error handler.
**False positives:** a `catch` in test-only code, or a development-only
branch that is explicitly gated.

## X15 — dependencies
**How to check:** `git diff <base> -- '**/package.json'` (or the stack's
manifest: `pyproject.toml`, `requirements*.txt`, `go.mod`, `Cargo.toml`, …);
confirm the matching lock file changed with it, from the package manager the
project uses (the lock file already in the repo tells you which). Resolve the
installed version **offline** (`npm ls <pkg>` or `pnpm ls <pkg>`) when the
dependency is a JavaScript one; for other stacks, read the lock file. The audit itself
(`npm audit`, `pnpm audit`, `pip-audit`, …) calls the network — list it under
*Checks not run*, not as a check you ran. A new dependency installed from a
git URL, a tarball URL or a typo-similar name to a popular package is worth a
finding with its quote.
**Quote:** the changed dependency line(s).
**False positives:** a devDependency bump with no runtime reach.
