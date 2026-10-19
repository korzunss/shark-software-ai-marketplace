#!/usr/bin/env node
// Summarize a `claude plugin eval` result (the --json file or aggregate-result.json) plus its
// traces. Token counts live only in the traces, so run the suite with --keep-temp.
//   node scripts/eval-metrics.mjs <result.json> [--md]
//   npm run evals:metrics -- plugins/<plugin>/evals/results/<timestamp>/aggregate-result.json --md
// Per case and overall: pass rate, median/min/max cost and latency, median tokens,
// API calls (assistant messages with a distinct message id) and tool calls.
import fs from 'node:fs';

const [file, flag] = process.argv.slice(2);
const res = JSON.parse(fs.readFileSync(file, 'utf8'));

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const min = (xs) => Math.min(...xs.filter(Number.isFinite));
const max = (xs) => Math.max(...xs.filter(Number.isFinite));

function traceStats(tracePath) {
  const out = { input: NaN, output: NaN, cacheRead: NaN, cacheWrite: NaN, apiCalls: NaN, toolCalls: NaN, durationApiMs: NaN };
  if (!tracePath || !fs.existsSync(tracePath)) return out;
  const lines = fs.readFileSync(tracePath, 'utf8').split('\n').filter(Boolean);
  const msgIds = new Set();
  let tools = 0;
  for (const line of lines) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type === 'assistant' && ev.message) {
      if (ev.message.id) msgIds.add(ev.message.id);
      for (const block of ev.message.content ?? []) if (block.type === 'tool_use') tools++;
    }
    if (ev.type === 'result') {
      const usage = Object.values(ev.modelUsage ?? {});
      const sum = (k) => usage.reduce((a, u) => a + (u[k] ?? 0), 0);
      Object.assign(out, {
        input: sum('inputTokens'), output: sum('outputTokens'),
        cacheRead: sum('cacheReadInputTokens'), cacheWrite: sum('cacheCreationInputTokens'),
        durationApiMs: ev.duration_api_ms,
      });
    }
  }
  out.apiCalls = msgIds.size;
  out.toolCalls = tools;
  return out;
}

const rows = [];
for (const c of res.cases) {
  for (const run of c.arms?.with ?? []) {
    rows.push({ case: c.name, passed: !!run.passed, score: run.score, cost: run.costUsd, judge: run.judgeCostUsd,
      seconds: run.durationSeconds, turns: run.turns, error: run.error ?? null, ...traceStats(run.tracePath) });
  }
}

function summary(rs) {
  return {
    runs: rs.length,
    passRate: rs.filter((r) => r.passed).length / rs.length,
    meanScore: rs.reduce((a, r) => a + (r.score ?? 0), 0) / rs.length,
    costMedian: median(rs.map((r) => r.cost)), costMin: min(rs.map((r) => r.cost)), costMax: max(rs.map((r) => r.cost)),
    costTotal: rs.reduce((a, r) => a + (r.cost ?? 0), 0),
    secMedian: median(rs.map((r) => r.seconds)), secMin: min(rs.map((r) => r.seconds)), secMax: max(rs.map((r) => r.seconds)),
    input: median(rs.map((r) => r.input)), output: median(rs.map((r) => r.output)),
    cacheRead: median(rs.map((r) => r.cacheRead)), cacheWrite: median(rs.map((r) => r.cacheWrite)),
    apiCalls: median(rs.map((r) => r.apiCalls)), toolCalls: median(rs.map((r) => r.toolCalls)),
    errors: rs.filter((r) => r.error).map((r) => `${r.case}: ${r.error}`),
    failed: rs.filter((r) => !r.passed).map((r) => r.case),
  };
}

const byCase = {};
for (const r of rows) (byCase[r.case] ??= []).push(r);
const report = { file, overall: summary(rows), cases: Object.fromEntries(Object.entries(byCase).map(([k, v]) => [k, summary(v)])) };

if (flag !== '--md') {
  console.log(JSON.stringify(report, null, 2));
} else {
  const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
  const k = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '—');
  console.log('| Case | Runs | Pass rate | Cost median (min–max), $ | Latency median (min–max), s | Input | Output | Cache read | Cache write | API calls | Tool calls |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, s] of [...Object.entries(report.cases), ['**All**', report.overall]]) {
    console.log(`| ${name} | ${s.runs} | ${f(s.passRate * 100, 0)}% | ${f(s.costMedian)} (${f(s.costMin)}–${f(s.costMax)}) | ${f(s.secMedian, 0)} (${f(s.secMin, 0)}–${f(s.secMax, 0)}) | ${k(s.input)} | ${k(s.output)} | ${k(s.cacheRead)} | ${k(s.cacheWrite)} | ${f(s.apiCalls, 0)} | ${f(s.toolCalls, 0)} |`);
  }
  console.log(`\nTotal cost: $${f(report.overall.costTotal)}. Failed runs: ${report.overall.failed.join(', ') || 'none'}. Errors: ${report.overall.errors.join('; ') || 'none'}.`);
}
