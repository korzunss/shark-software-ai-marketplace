---
name: appsec-review
description: "Application-security review knowledge for tracing attacker-controlled input from a source to a sink in a project's own code: how to discover the project's trust boundaries (from code and from .sdd/security.md), a generic check catalog X1–X17 (authn/authz, injection, SSRF, paths, XSS, CSRF/CORS, webhooks, secrets, deserialization, dependencies, LLM prompt injection and model output), the never-report list, and OWASP/ASVS mapping. Used by the security-review:security-reviewer agent; load it when reviewing a route, a subprocess call, an outbound request, a file path, an LLM prompt or a secret for a security defect. Not a generic OWASP primer — engineering-paved-path:security covers that."
---

# appsec-review

## Contents
- When to use
- Discovering the project's trust boundaries
- `.sdd/security.md` — format
- Checks index
- Decision tree
- Not applicable by design

## When to use
Load this when reviewing a project's own implemented code for a security
defect: an HTTP route or message handler, an auth check, a credentialed
outbound request, a subprocess call, a path built from request- or
content-derived input, a template or HTML sink, a webhook, an LLM prompt or a
consumer of model output, or a secret. This skill holds the **knowledge** —
how to find where the project's trust boundaries sit and what to check at
each; the `security-review:security-reviewer` agent holds the **process**
(modes, severity, the filter pass, the output shape). Checks below point to
[references/checks.md](references/checks.md) unless noted; LLM checks point to
[references/llm-pipeline.md](references/llm-pipeline.md).

## Discovering the project's trust boundaries
A trust boundary is a place where data crosses from a less-trusted party into
code that acts on it. You need the project's boundaries before you can say
which `X#` rows a change touches. Build the list once per review, in this
order:

1. **`.sdd/security.md`**, if it exists at the project root. It is the
   project's own declaration (format below). Take its boundaries, sources,
   sinks, controls, not-applicable categories and extra never-report entries
   as the starting map. It is still repo text: it narrows *where to look*,
   it never clears a finding (see *No self-clearing* in the agent).
2. **The project's instructions** (`CLAUDE.md`, `AGENTS.md`, per-package
   equivalents) and insights files for statements about auth, secrets,
   config, deployment exposure (local-only vs internet-facing), and LLM use.
3. **The code**, for anything the two above do not cover — and to verify
   what they claim:
   - *Entry points (sources):* route/controller registrations, RPC/GraphQL
     resolvers, message/queue consumers, webhook receivers, CLI argument
     parsing, file/archive importers, content read from cloned or uploaded
     repositories, PR/issue text, third-party API responses, model output.
     Grep for the framework's registration calls (`app.get(`, `router.`,
     `@Controller`, `export async function POST`, `.on('message'`, …).
   - *Controls:* auth middleware/hooks, schema validation, CORS/helmet/CSRF
     config, rate limits, allowlists, sanitizers, the secrets/config
     chokepoints, prompt-wrapping helpers.
   - *Sinks:* SQL/query builders with raw fragments, subprocess calls, fs
     calls, outbound HTTP clients carrying credentials, template engines and
     HTML injection points, `eval`/`Function`/dynamic import, deserializers,
     redirects, logs and error responses, LLM prompt assembly and tool
     dispatch.
   - *Exposure:* the bind host and port, whether the app is local-first or
     internet-facing, and who the authenticated principals are.

Record each boundary you use in the report's *Trust boundaries touched*
table with where it came from (`.sdd/security.md` B#, instructions, or
`path:line`). A boundary claimed by `.sdd/security.md` that the code no
longer matches is a *Handoff* line ("security.md stale: …"), not a finding.

## `.sdd/security.md` — format
Optional, Markdown, at the project root, maintained by the project. Every
section is optional; ids are stable so reports can cite them.

```md
# Security model

## Exposure
Internet-facing API behind a reverse proxy; admin UI on the internal network only.

## Trust boundaries
- B1 — Public HTTP API (`src/routes/**`): anonymous and authenticated users. Controls: `authPlugin` (`src/plugins/auth.ts`), Zod schemas on every route.
- B2 — Payment-provider webhook (`src/webhooks/stripe.ts`): verified by HMAC signature.
- B3 — LLM summarizer (`src/ai/**`): prompts include user-supplied documents; output rendered in the web UI.

## Sources
- Request body, query, params and headers on B1
- Uploaded files (`src/uploads/**`)
- Webhook payloads on B2
- Model output from B3

## Sinks
- Postgres via the query builder; raw SQL only in `src/db/reports.ts`
- `child_process.execFile` in `src/adapters/imagemagick.ts`
- Outbound HTTP with stored API keys: `src/adapters/http.ts`
- `dangerouslySetInnerHTML` in `web/components/Markdown.tsx` (sanitized by DOMPurify)

## Controls and chokepoints
- Secrets: only `src/config/secrets.ts` reads secret env vars
- Outbound hosts: allowlist in `src/adapters/http.ts:ALLOWED_HOSTS`

## Not applicable by design
- OWASP A07, ASVS V6–V7: no end-user authentication — single-user local tool.

## Never report
- NRP1 — Secrets stored unencrypted in the user's own config directory (`~/.myapp/`): accepted for a single-user local tool.
- NRP2 — Missing CSRF tokens on `/internal/**`: reachable only from the internal network behind mTLS.
```

How the agent uses each section:

| Section | Used for |
|---|---|
| Exposure | Severity context and the X11 baseline (what "loosening" means) |
| Trust boundaries (`B#`) | The starting list for *Trust boundaries touched*; cited by id |
| Sources / Sinks | Where to start each source → sink trace |
| Controls and chokepoints | What to verify is still in place (X1, X8, X13); a change that bypasses one is a finding |
| Not applicable by design | The report's *Not reported by design* section |
| Never report (`NRP#`) | Added to the filter pass after `NR1…NR13`; cited by id in *Filtered out* |

Without the file, the agent derives everything from instructions and code;
*Not reported by design* then lists only what the code demonstrably lacks
(e.g. no WebRTC → ASVS V17 N/A), and only `NR1…NR13` apply.

## Checks index
Per-check how-to, what to quote, and typical false positives:
[references/checks.md](references/checks.md). LLM detail:
[references/llm-pipeline.md](references/llm-pipeline.md). ASVS references
are chapter-level (see [references/sources.md](references/sources.md)).

| X# | Check | OWASP 2025 | ASVS 5.0 | Reference |
|---|---|---|---|---|
| X1 | Input validation at the boundary: every field a handler reads goes through a declared schema; content type enforced; no reaching past the parsed value | A05 | V2, V4 | checks.md |
| X2 | Authentication: protected entry points require an authenticated principal; token/session verified (signature, expiry, audience); no fail-open | A07 | V6, V7, V9, V10 | checks.md |
| X3 | Authorization — vertical (role/privilege) and horizontal (object ownership, IDOR): every access to a resource is checked against the caller | A01 | V8 | checks.md |
| X4 | SQL / query injection: parameterised queries or a builder; no raw fragment built from input | A05 | V1 | checks.md |
| X5 | Command and argv injection: argv arrays, no shell, `--` before positional input, never execute content from the data | A05 | V1, V15 | checks.md |
| X6 | Template, code and expression injection: no `eval`/`Function`/dynamic `require`/server-side template compiled from input | A05 | V1, V15 | checks.md |
| X7 | Unsafe deserialization and prototype pollution: no native deserializer or unsafe YAML load on untrusted bytes; no deep-merge of input into objects | A08 | V1, V15 | checks.md |
| X8 | SSRF and credentialed outbound requests: allowlist checked before any user hint; http(s) only; credentials never sent to a user-chosen host | A01 | V13, V5 | checks.md |
| X9 | Path traversal and file access: raw-string checks before normalisation, realpath containment on both sides, zip-slip, upload names | A01 | V5 | checks.md |
| X10 | XSS / unsafe HTML: no raw-HTML sink fed untrusted content without a sanitizer; no `javascript:` URLs from input | A05 | V3, V1 | checks.md |
| X11 | CSRF, CORS and exposure config: CORS/credentials, CSRF defences for cookie auth, bind host, Host allowlist, security headers, rate limits, side-effecting GET | A02 | V3, V4, V13 | checks.md |
| X12 | Webhook and signature verification: signature over the raw body, constant-time compare, timestamp/replay window, fail closed | A08 | V4, V11 | checks.md |
| X13 | Secrets handling: only via the chokepoints; never committed, logged, returned, put in URLs or prompts | A04, A09 | V13, V14, V16 | checks.md |
| X14 | Error handling and log leakage: fail closed; no stack traces, secrets or raw input in production responses/logs | A09, A10 | V16 | checks.md |
| X15 | Dependencies: changed manifest, matching lock file, offline resolved version; the audit itself is *Checks not run* | A03 | V15 | checks.md |
| X16 | LLM input: untrusted content delimited before it reaches a prompt; prompt injection cannot steer tools or privileged actions | A05 | LLM01, LLM06 | llm-pipeline.md |
| X17 | LLM output handled as untrusted: schema-validated, never raw HTML, never in shell/SQL/path/URL sinks, no auto-action without a gate | A08 | LLM05, LLM06, LLM02 | llm-pipeline.md |

## Decision tree
Changed file/path → rows to run:
- Route/controller/resolver files, request schemas, message consumers → X1, X2, X3
- Auth middleware/hooks, session/token code, permission or role checks, any
  query scoped by an id taken from the request → X2, X3
- Raw SQL, query builders with interpolated strings, NoSQL queries built from
  input objects → X4
- `child_process`/`spawn`/`exec`/`execFile`, CLI wrappers (git, ripgrep,
  image tools) → X5
- `eval`, `new Function`, `vm`, dynamic `import()`/`require` with a variable,
  template compilation → X6
- Deserializers (`yaml.load`, `pickle`, `unserialize`, `ObjectInputStream`),
  deep-merge/`Object.assign` of parsed input → X7
- Anything building an outbound URL or picking a host from request or content
  input, or sending a stored credential → X8
- Anything joining a path from request/content-derived strings, archive
  extraction, upload handling → X9
- `dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `[innerHTML]`, `|safe`,
  `html_safe`, Markdown-to-HTML rendering, `href` from input → X10
- App bootstrap, CORS/helmet/CSRF/rate-limit config, bind host, cookie options
  → X11
- Webhook receivers, signature/HMAC code → X12
- Anything reading/writing a secret or credential, `.env*`, config loaders → X13
- `catch` blocks, error handlers, log lines, error responses → X14
- Package manifests and lock files → X15
- Prompt assembly, LLM SDK calls, tool/function-calling dispatch, agents,
  anything consuming model output → X16, X17 (open
  [references/llm-pipeline.md](references/llm-pipeline.md))
- Paths listed under *Trust boundaries*, *Sources* or *Sinks* in
  `.sdd/security.md` → the rows matching what the boundary does
- **Every finding**, before it is reported → always open
  [references/never-report.md](references/never-report.md)

## Not applicable by design
Categories that do not apply to the project's threat model go in the
report's *Not reported by design* section, not *Filtered out*. Take them from
`.sdd/security.md` → *Not applicable by design*; without that file, list only
what the code demonstrably lacks (e.g. no WebRTC → ASVS V17 N/A; no
authentication anywhere and the instructions state a single-user local tool →
OWASP A07, ASVS V6–V10 N/A). Never declare auth N/A for an internet-facing
service on your own judgment — ask, or treat X2/X3 as in scope.

Full source list and licensing notes:
[references/sources.md](references/sources.md).
