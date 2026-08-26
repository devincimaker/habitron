import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderReport } from './lib/autopilot-report.mjs';

process.env.TZ = 'UTC';

const SCRIPT = new URL('./autopilot-run.mjs', import.meta.url).pathname;

function ledger() {
  const root = mkdtempSync(join(tmpdir(), 'autopilot-'));
  const cli = (session, ...args) =>
    execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, AUTOPILOT_RUNS_DIR: root, CLAUDE_CODE_SESSION_ID: session, TZ: 'UTC' },
    });
  const runs = () => readdirSync(root).sort();
  const read = (name) => JSON.parse(readFileSync(join(root, name, 'run.json'), 'utf8'));
  const report = (name) => readFileSync(join(root, name, 'report.md'), 'utf8');
  return { cli, runs, read, report };
}

const failsWith = (fn, text) =>
  assert.throws(fn, (e) => e.status === 1 && String(e.stderr).includes(text), `expected failure: ${text}`);

const base = {
  sessionId: 's1',
  startedAt: '2026-08-26T21:40:00Z',
  lastTickAt: '2026-08-27T03:10:00Z',
  closedAt: null,
  ended: null,
  idleSince: null,
  ticks: 4,
  consecutiveRefusals: 0,
  cap: null,
  landed: [],
  parked: [],
  refused: [],
  filed: [],
  decisions: [],
  log: [],
};

test('renders every section from one of each entry kind', () => {
  const md = renderReport({
    ...base,
    landed: [
      { issue: 'HAB-88', class: 'B', pr: 71, title: 'composer clears on echo', seeIt: 'session screen, send a message', proof: 'jest + one shot' },
      { issue: 'HAB-107', class: 'C', pr: 73, title: 'extracted streak math', proof: '14 vitest cases' },
    ],
    parked: [
      { issue: 'HAB-111', class: 'D', pr: 75, title: 'habit ordering', blockedOn: 'drag never activates', decide: 'fix the gesture or split it', resume: '/merge 75 from wt/hab-111' },
    ],
    refused: [
      { issue: 'HAB-90', class: 'B', why: 'needs a design call on the tab bar', routedTo: 'Todo' },
      { issue: 'HAB-92', class: 'A', why: 'token no longer exists', routedTo: 'Canceled' },
    ],
    filed: [{ issue: 'HAB-131', title: 'review-day prints scale only when review exists', why: 'blocks the voice pre-fill', during: 'HAB-129' }],
    decisions: [{ issue: 'HAB-88', note: 'premise correction — the line had moved to Composer.tsx:41' }],
    log: ['[HAB-88 · B · tick 1] merged #71 · composer clears on echo · jest + one shot'],
  });

  assert.match(md, /^# Autopilot run · started 2026-08-26 21:40 · running · last tick 2026-08-27 03:10 · 2 landed, 1 parked, 2 refused, 1 filed$/m);
  assert.match(md, /^## Needs your decision \(2\)$/m);
  assert.match(md, /### \[HAB-111\]\(https:\/\/linear\.app\/fioris\/issue\/HAB-111\) · D · PR \[#75\]\(https:\/\/github\.com\/devincimaker\/habitron\/pull\/75\) · parked, In Review\n- Built: habit ordering\n- Blocked on: drag never activates\n- Decide: fix the gesture or split it\n- Resume: \/merge 75 from wt\/hab-111/);
  assert.match(md, /### \[HAB-90\][^\n]* · B · refused, back in Todo\n- Why: needs a design call on the tab bar\n- Decide: re-spec/);
  assert.match(md, /^## Landed — check in the app \(2\)$/m);
  assert.match(md, /\| \[HAB-88\][^|]*· B \| \[#71\][^|]* \| composer clears on echo \| session screen, send a message \| jest \+ one shot \|/);
  assert.match(md, /\| \[HAB-107\][^|]*· C \| \[#73\][^|]* \| extracted streak math \| nothing on screen \| 14 vitest cases \|/);
  assert.match(md, /^## Filed for you \(1\)\n\n- \[HAB-131\][^\n]* · review-day prints scale only when review exists — blocks the voice pre-fill _\(during HAB-129\)_$/m);
  assert.match(md, /^## Decisions the bot made \(2\)\n\n- \[HAB-88\][^\n]*: premise correction[^\n]*\n- \[HAB-92\][^\n]*: refused and canceled — token no longer exists$/m);
  assert.match(md, /^## Tick log\n\n```\n\[HAB-88 · B · tick 1\] merged #71[^\n]*\n```$/m);
  assert.doesNotMatch(md, /HAB-92[^\n]*Needs your decision/);
});

test('an empty run renders the header and every empty section', () => {
  const md = renderReport(base);
  assert.match(md, /^# Autopilot run · started 2026-08-26 21:40 · running · last tick 2026-08-27 03:10 · 0 landed, 0 parked, 0 refused, 0 filed$/m);
  for (const empty of ['Nothing waiting on you.', 'Nothing landed yet.', 'Nothing filed.', 'None recorded.', 'No ticks yet.']) {
    assert.ok(md.includes(`_${empty}_`), empty);
  }
});

test('the header names each run state', () => {
  const at = '2026-08-27T03:10:00Z';
  assert.match(renderReport({ ...base, idleSince: at }), /· idle since 2026-08-27 03:10 · nothing Ready ·/);
  assert.match(renderReport({ ...base, closedAt: at, ended: 'stopped' }), /· stopped · 2026-08-27 03:10 ·/);
  assert.match(renderReport({ ...base, closedAt: at, ended: 'halted: three consecutive refusals' }), /· halted: three consecutive refusals · 2026-08-27 03:10 ·/);
  assert.match(renderReport({ ...base, closedAt: at, ended: 'session ended' }), /· session ended · 2026-08-27 03:10 ·/);
});

test('table cells survive pipes and newlines', () => {
  const md = renderReport({
    ...base,
    landed: [{ issue: 'HAB-1', class: 'B', pr: 1, title: 'a | b', seeIt: 'line one\nline two', proof: 'x' }],
  });
  assert.match(md, /\| a \\\| b \| line one line two \| x \|/);
});

test('tick opens a run, continues it in the same session, and closes it from another', () => {
  const { cli, runs, read } = ledger();

  assert.match(cli('s1', 'tick'), /^opened new run/);
  assert.equal(runs().length, 1);
  const [first] = runs();
  assert.equal(read(first).sessionId, 's1');
  assert.equal(read(first).ticks, 1);

  assert.match(cli('s1', 'tick'), /^continuing/);
  assert.equal(runs().length, 1);
  assert.equal(read(first).ticks, 2);
  const lastTick = read(first).lastTickAt;

  const out = cli('s2', 'tick');
  assert.match(out, /^closed .* \(session ended, last tick .*\) · opened new run/);
  assert.equal(runs().length, 2);
  assert.equal(read(first).ended, 'session ended');
  assert.equal(read(first).closedAt, lastTick);
  const second = runs()[1];
  assert.equal(read(second).sessionId, 's2');
  assert.equal(read(second).ticks, 1);
});

test('add records entries, keeps the refusal counter, and re-renders', () => {
  const { cli, runs, read, report } = ledger();
  cli('s1', 'tick');
  const [dir] = runs();

  failsWith(() => cli('s1', 'add', 'landed', '{"issue":"HAB-1"}'), 'landed needs class, pr, title, proof');
  failsWith(() => cli('s1', 'add', 'landed', '{"issue":"HAB-1","class":"B","pr":1,"title":"t","proof":"p"}'), 'needs seeIt');
  failsWith(() => cli('s1', 'add', 'refused', '{"issue":"HAB-1","class":"B","why":"w","routedTo":"Done"}'), 'routedTo must be Todo or Canceled');
  failsWith(() => cli('s1', 'add', 'landed', 'not json'), 'takes a JSON object');
  failsWith(() => cli('s1', 'add', 'bogus', '{}'), 'unknown kind');

  cli('s1', 'add', 'refused', '{"issue":"HAB-1","class":"B","why":"w","routedTo":"Todo"}');
  cli('s1', 'add', 'refused', '{"issue":"HAB-2","class":"B","why":"w","routedTo":"Canceled"}');
  assert.equal(read(dir).consecutiveRefusals, 2);

  cli('s1', 'add', 'landed', '{"issue":"HAB-3","class":"C","pr":9,"title":"lifted","proof":"3 cases"}');
  assert.equal(read(dir).consecutiveRefusals, 0);
  cli('s1', 'add', 'filed', '{"issue":"HAB-4","title":"t","why":"w","during":"HAB-3"}');
  cli('s1', 'add', 'decision', '{"issue":"HAB-3","note":"n"}');
  cli('s1', 'add', 'log', '[HAB-3 · C · tick 1] merged #9 · lifted · 3 cases');

  const run = read(dir);
  assert.equal(run.landed.length, 1);
  assert.equal(run.refused.length, 2);
  assert.equal(run.filed.length, 1);
  assert.equal(run.decisions.length, 1);
  assert.deepEqual(run.log, ['[HAB-3 · C · tick 1] merged #9 · lifted · 3 cases']);
  assert.match(report(dir), /1 landed, 0 parked, 2 refused, 1 filed/);
  assert.match(report(dir), /nothing on screen \| 3 cases/);
});

test('idle marks the run idle until something else is recorded', () => {
  const { cli, runs, read } = ledger();
  cli('s1', 'tick');
  const [dir] = runs();
  cli('s1', 'add', 'idle', 'nothing Ready · 2 blocked behind HAB-111');
  const firstIdle = read(dir).idleSince;
  assert.equal(firstIdle, read(dir).lastTickAt);
  assert.deepEqual(read(dir).log, ['[idle · tick 1] nothing Ready · 2 blocked behind HAB-111']);

  cli('s1', 'tick');
  cli('s1', 'add', 'idle', 'nothing Ready');
  assert.equal(read(dir).idleSince, firstIdle);
  assert.match(cli('s1', 'status'), /idle since/);

  cli('s1', 'add', 'log', '[HAB-5 · A · tick 3] merged #12');
  assert.equal(read(dir).idleSince, null);
});

test('close ends the run; add refuses after it; the next tick opens a new one', () => {
  const { cli, runs, read } = ledger();
  cli('s1', 'tick');
  const [dir] = runs();
  assert.match(cli('s1', 'close', 'stopped'), /^closed · stopped/);
  assert.equal(read(dir).ended, 'stopped');
  assert.ok(read(dir).closedAt);
  failsWith(() => cli('s1', 'add', 'log', 'x'), 'the newest run is closed (stopped)');
  assert.match(cli('s1', 'status'), /· stopped ·/);

  assert.match(cli('s1', 'tick'), /^opened new run/);
  assert.equal(runs().length, 2);
});

test('status and add without a run say so', () => {
  const { cli } = ledger();
  assert.equal(cli('s1', 'status').trim(), 'no run yet');
  failsWith(() => cli('s1', 'add', 'log', 'x'), 'no run yet');
  failsWith(() => cli('', 'tick'), 'CLAUDE_CODE_SESSION_ID is not set');
});
