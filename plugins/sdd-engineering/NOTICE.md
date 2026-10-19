# Notice

The components of this plugin are adapted from an upstream open-source project
and generalized for use in any repository. The upstream material is used under
the MIT License reproduced below.

## What was adapted

- `agents/spec-creator.md`, `agents/implementation-planner.md`, `agents/implementer.md`, `agents/plan-verifier.md`, `agents/test-writer.md`, `agents/doc-writer.md`, `agents/brainstormer.md`: the upstream agents of the same names, with project-specific paths, package layout, commands, test helpers and protected paths replaced by `.sdd/config.json` keys and the project's own instructions.
- `skills/run-plan/`: the upstream spec-driven pipeline skill (renamed), its stage and review-loop detail, its scripts, and plan/spec templates derived from the upstream plan and spec indexes and pipeline rules.
- `skills/workflow-retro/`: the upstream per-plan workflow retro skill.
- `README.md`: adapted in part from the upstream agents map (pipeline diagram, plan status per agent, inputs and outputs, shared conventions, shared ids).

No third-party skills are bundled in this plugin. The skills its agents preload come from the `engineering-paved-path` plugin, which carries its own attribution.

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
