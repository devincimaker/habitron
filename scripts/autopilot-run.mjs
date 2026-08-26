#!/usr/bin/env node
// The autopilot run ledger. One run is one Claude Code session's /loop
// /autopilot. It lives at tmp/autopilot/<YYYY-MM-DD-HHMM>/ in the main
// checkout: run.json is the structured truth, report.md is rendered from it
// after every write. The session id (CLAUDE_CODE_SESSION_ID) is the only run
// boundary: `tick` from a different session closes the newest open run
// retroactively and opens a new one. Idle never closes a run.
//
//   tick                    open or continue this session's run; stamps lastTickAt
//   add <kind> <payload>    landed | parked | refused | filed | decision take JSON;
//                           log | idle take a string
//   close <reason>          "stopped" or "halted: <why>"; renders one last time
//   status                  the report's header line and path
//   render                  re-render report.md for the newest run

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderReport } from './lib/autopilot-report.mjs';

const REQUIRED = {
  landed: ['issue', 'class', 'pr', 'title', 'proof'],
  parked: ['issue', 'class', 'pr', 'title', 'blockedOn', 'decide', 'resume'],
  refused: ['issue', 'class', 'why', 'routedTo'],
  filed: ['issue', 'title', 'why', 'during'],
  decision: ['issue', 'note'],
};
const LIST = { landed: 'landed', parked: 'parked', refused: 'refused', filed: 'filed', decision: 'decisions' };
const CLASSES = ['A', 'B', 'C', 'D'];
const ROUTES = ['Todo', 'Canceled'];

function fail(msg) {
  console.error(`autopilot-run: ${msg}`);
  process.exit(1);
}

// The main checkout's tmp/, whichever worktree this runs from: a tick opens the
// run in the main checkout and records from inside its worktree.
function runsDir() {
  if (process.env.AUTOPILOT_RUNS_DIR) return process.env.AUTOPILOT_RUNS_DIR;
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    encoding: 'utf8',
  }).trim();
  return join(dirname(common), 'tmp', 'autopilot');
}

function sessionId() {
  const id = process.env.CLAUDE_CODE_SESSION_ID;
  if (!id) fail('CLAUDE_CODE_SESSION_ID is not set — run this from a Claude Code session');
  return id;
}

const now = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, '0');
const dirName = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

function newest(root) {
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root)
    .filter((n) => existsSync(join(root, n, 'run.json')))
    .sort();
  return dirs.length ? join(root, dirs.at(-1)) : null;
}

const read = (dir) => JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8'));

function write(dir, run) {
  writeFileSync(join(dir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(join(dir, 'report.md'), renderReport(run));
}

function openRun(root, sid) {
  const at = now();
  const base = join(root, dirName(new Date(at)));
  let dir = base;
  for (let i = 2; existsSync(dir); i++) dir = `${base}-${i}`;
  mkdirSync(dir, { recursive: true });
  const run = {
    sessionId: sid,
    startedAt: at,
    lastTickAt: at,
    closedAt: null,
    ended: null,
    idleSince: null,
    ticks: 0,
    consecutiveRefusals: 0,
    cap: null,
    landed: [],
    parked: [],
    refused: [],
    filed: [],
    decisions: [],
    log: [],
  };
  return { dir, run };
}

function current(root) {
  const dir = newest(root);
  if (!dir) fail('no run yet — `tick` opens one');
  const run = read(dir);
  if (run.closedAt) fail(`the newest run is closed (${run.ended}); the next \`tick\` opens a new one`);
  return { dir, run };
}

function parseEntry(kind, payload) {
  let entry;
  try {
    entry = JSON.parse(payload);
  } catch {
    fail(`${kind} takes a JSON object`);
  }
  const missing = REQUIRED[kind].filter((k) => entry[k] === undefined || entry[k] === '');
  if (missing.length) fail(`${kind} needs ${missing.join(', ')}`);
  if ('class' in entry && !CLASSES.includes(entry.class)) fail(`class must be one of ${CLASSES.join('/')}`);
  if (kind === 'refused' && !ROUTES.includes(entry.routedTo)) fail(`routedTo must be ${ROUTES.join(' or ')}`);
  if (kind === 'landed' && entry.class !== 'A' && entry.class !== 'C' && !entry.seeIt) {
    fail('a B or D landing needs seeIt — where in the app to look');
  }
  return entry;
}

const commands = {
  tick() {
    const root = runsDir();
    const sid = sessionId();
    let dir = newest(root);
    let run = dir && read(dir);
    let note = 'continuing';
    if (!run || run.closedAt || run.sessionId !== sid) {
      if (run && !run.closedAt) {
        run.closedAt = run.lastTickAt;
        run.ended = 'session ended';
        write(dir, run);
        note = `closed ${dir} (session ended, last tick ${run.lastTickAt}) · opened new run`;
      } else {
        note = 'opened new run';
      }
      ({ dir, run } = openRun(root, sid));
    }
    run.ticks += 1;
    run.lastTickAt = now();
    write(dir, run);
    const { ticks, consecutiveRefusals, cap } = run;
    console.log(note);
    console.log(JSON.stringify({ dir, tick: ticks, consecutiveRefusals, cap, landed: run.landed.length }));
  },

  add(kind, payload) {
    if (!kind || payload === undefined) fail('usage: add <kind> <payload>');
    const { dir, run } = current(runsDir());
    if (kind === 'log' || kind === 'idle') {
      run.log.push(kind === 'idle' ? `[idle · tick ${run.ticks}] ${payload}` : payload);
      if (kind === 'idle') run.idleSince ??= run.lastTickAt;
      else run.idleSince = null;
    } else {
      if (!REQUIRED[kind]) fail(`unknown kind ${kind}; one of ${[...Object.keys(REQUIRED), 'log', 'idle'].join(', ')}`);
      run[LIST[kind]].push(parseEntry(kind, payload));
      if (kind === 'refused') run.consecutiveRefusals += 1;
      if (kind === 'landed' || kind === 'parked') run.consecutiveRefusals = 0;
      run.idleSince = null;
    }
    write(dir, run);
    console.log(`${kind} recorded · ${join(dir, 'report.md')}`);
  },

  close(reason) {
    if (!reason) fail('usage: close <stopped | "halted: <why>">');
    const { dir, run } = current(runsDir());
    run.closedAt = now();
    run.ended = reason;
    write(dir, run);
    console.log(`closed · ${reason}`);
    console.log(join(dir, 'report.md'));
  },

  status() {
    const dir = newest(runsDir());
    if (!dir) {
      console.log('no run yet');
      return;
    }
    console.log(renderReport(read(dir)).split('\n')[0]);
    console.log(join(dir, 'report.md'));
  },

  render() {
    const dir = newest(runsDir());
    if (!dir) fail('no run to render');
    write(dir, read(dir));
    console.log(join(dir, 'report.md'));
  },
};

const [command, ...rest] = process.argv.slice(2);
if (!commands[command]) fail('usage: tick | add <kind> <payload> | close <reason> | status | render');
commands[command](...rest);
