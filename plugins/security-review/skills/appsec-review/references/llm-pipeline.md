# LLM applications — the seven controls (X16, X17)

Code that feeds untrusted content (user messages, documents, web pages,
repository files, PR text, tool results) to an LLM and then acts on or
renders its output has a trust boundary on **both** sides of the model. The
controls live in prompt assembly, tool dispatch and output handling, not in
the model.

## Contents
- Finding the LLM boundary
- The seven controls
- Prompt injection stays in scope

## Finding the LLM boundary
Grep for the SDK and the assembly points: LLM client imports (`openai`,
`@anthropic-ai/sdk`, `ai`, `langchain`, provider HTTP endpoints), prompt
builders (functions returning `messages` or a system prompt), tool/function
definitions and their dispatch (`tools:`, `tool_calls`, `function_call`,
agent loops), and every consumer of the model's reply. `.sdd/security.md`
may name these under *Trust boundaries* / *Sinks*.

## The seven controls
Check each one whenever prompt assembly, tool dispatch or a consumer of
model output is in scope. A change that weakens any of these is X16 (input
side) or X17 (output side).

OWASP Top 10 for LLM Applications 2025, per control:
controls 1–2 → [LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) ·
controls 3–5 → [LLM05 Improper Output Handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/) ·
control 6 → LLM06 Excessive Agency ([link](https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/), legacy slug) ·
control 7 → LLM02 Sensitive Information Disclosure ([link](https://genai.owasp.org/llmrisk/llm02-insecure-output-handling/), legacy slug).

1. **Untrusted fields are delimited before concatenation.** Every
   untrusted string reaching a prompt goes through the project's wrapping
   helper (explicit delimiters or tags, "spotlighting"), and sits in the
   user/data part of the conversation, not in the system prompt. A new
   untrusted input added to prompt assembly without the wrapper — or raw
   string concatenation into the system prompt — is the finding.
2. **The closing delimiter cannot be forged.** The wrapper escapes or strips
   any occurrence of its own closing delimiter inside the content before
   wrapping, so untrusted content cannot close the block and inject text the
   model reads as trusted framing.
3. **Model output is schema-validated before use**, not parsed from
   free-form text with a regex. Structured output / JSON-schema mode, or a
   schema parse (e.g. Zod) of the reply, rejects a reply that does not match
   before any field is used.
4. **No raw-HTML rendering of a model field.** Any model-authored string
   reaching a UI goes through normal escaped text rendering, or through a
   sanitizer when rendered as Markdown/HTML (see X10).
5. **No model output in shell/SQL/path/URL sinks unvalidated.** A file path,
   command, query fragment, URL or id produced by the model is never
   interpolated into a subprocess argv, a raw query, a file path or an
   outbound request without the same validation an attacker-supplied value
   would get (X4, X5, X8, X9) — the model is an attacker-influenced source.
6. **No privileged action without a gate (excessive agency).** Tools exposed
   to a model that reads untrusted content are least-privilege: no tool can
   write, delete, send, pay, merge or push on the model's say-so unless a
   human confirmation or a code-side policy gates it; tool arguments are
   schema-validated and scoped to the caller (X3); a model-controlled field
   cannot raise its own permissions or switch tools on. Prompt injection
   *into tools* — untrusted content steering a tool call — is checked here.
7. **No secrets or system text in prompts or echoed output.** API keys,
   tokens and other users' data never enter a prompt that untrusted content
   shares; the system prompt and guard text are not echoed to an end user,
   a log line shown to the user, or an API response.

## Prompt injection stays in scope
Anthropic's generic `claude-code-security-review` excludes AI prompt
injection as a finding (see [never-report.md](never-report.md)). **This
skill does not carry that exclusion.** When the project builds on an LLM, a
broken, bypassed or missing control above (X16, X17) is a real, reportable
defect, at CRITICAL or HIGH per the agent's severity rules. A project that
does not use an LLM simply has no X16/X17 rows in scope.
