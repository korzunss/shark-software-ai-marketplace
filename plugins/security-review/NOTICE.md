# Notice

The components of this plugin are adapted from an upstream open-source project
and generalized for use in any repository. The upstream material is used under
the MIT License reproduced below.

## What was adapted

- `agents/security-reviewer.md`: the upstream `security-reviewer` agent. Its project-bound trust boundaries were replaced by a generic check catalog; the severity scale and closed CRITICAL catalog it referenced from an upstream review-gate skill (not ported) are inlined.
- `skills/appsec-review/`: generalized from the upstream project's application-security skill and its references (`checks.md`, `llm-pipeline.md`, `never-report.md`, `sources.md`).

## Third-party material

- `skills/appsec-review/references/never-report.md` adapts the exclusion list of [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review) (`claudecode/findings_filter.py`), MIT License, Copyright (c) 2025 Anthropic. The full notice is kept at the bottom of that file.
- Skill layout (lean `SKILL.md` + `references/`, decision tree to references) follows the method of [trailofbits/skills](https://github.com/trailofbits/skills) (CC-BY-SA-4.0); structure only, no text copied.
- OWASP Top 10:2025, OWASP ASVS 5.0, the OWASP Top 10 for LLM Applications 2025 and the OWASP Cheat Sheet Series (CC-BY-SA-4.0) are referenced by id and link, with short paraphrased bullets only. See `skills/appsec-review/references/sources.md`.

## Upstream license

```text
MIT License

Copyright (c) 2026 Ivan Lapa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```
