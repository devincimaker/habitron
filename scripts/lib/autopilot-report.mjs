// Renders one autopilot run (run.json) to the markdown the user reads the
// morning after. Pure: no filesystem, no network, no git. The sections come in
// the order the user acts on them — decisions first, then the walk through the
// app, then what was filed, then the bot's own calls, then the raw tick log.

const ISSUE_URL = 'https://linear.app/fioris/issue';
const PR_URL = 'https://github.com/devincimaker/habitron/pull';

const pad = (n) => String(n).padStart(2, '0');

// Local time, to the minute. A 20-hour run crosses midnight, so the date stays.
function fmt(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const issue = (id) => `[${id}](${ISSUE_URL}/${id})`;
const pr = (n) => `[#${n}](${PR_URL}/${n})`;
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function state(run) {
  if (run.closedAt) return `${run.ended} · ${fmt(run.closedAt)}`;
  if (run.idleSince) return `idle since ${fmt(run.idleSince)} · nothing Ready`;
  return `running · last tick ${fmt(run.lastTickAt)}`;
}

function counts(run) {
  const base = `${run.landed.length} landed, ${run.parked.length} parked, ${run.refused.length} refused, ${run.filed.length} filed`;
  return run.reverted.length ? `${base}, ${run.reverted.length} reverted` : base;
}

function section(title, count, body, empty) {
  const heading = count ? `## ${title} (${count})` : `## ${title}`;
  while (body.at(-1) === '') body.pop();
  return [heading, '', ...(body.length ? body : [`_${empty}_`]), ''];
}

function needsDecision(run) {
  const body = [];
  for (const p of run.parked) {
    body.push(
      `### ${issue(p.issue)} · ${p.class} · PR ${pr(p.pr)} · parked, In Review`,
      `- Built: ${p.title}`,
      `- Blocked on: ${p.blockedOn}`,
      `- Decide: ${p.decide}`,
      `- Resume: ${p.resume}`,
      '',
    );
  }
  const todo = run.refused.filter((r) => r.routedTo === 'Todo');
  for (const r of todo) {
    body.push(
      `### ${issue(r.issue)} · ${r.class} · refused, back in Todo`,
      `- Why: ${r.why}`,
      '- Decide: re-spec it and promote it again, or cancel it',
      '',
    );
  }
  for (const r of run.reverted) {
    body.push(
      `### ${issue(r.issue)} · ${r.class} · PR ${pr(r.pr)} · reverted, back in Todo`,
      `- Why: master went red on its merge — ${r.why}`,
      `- Revert: ${r.sha}`,
      '- Decide: fix forward and promote it again, or cancel it',
      '',
    );
  }
  return section(
    'Needs your decision',
    run.parked.length + todo.length + run.reverted.length,
    body,
    'Nothing waiting on you.',
  );
}

function landed(run) {
  const rows = run.landed.map((l) => {
    const where = l.class === 'A' || l.class === 'C' ? 'nothing on screen' : l.seeIt;
    return `| ${issue(l.issue)} · ${l.class} | ${pr(l.pr)} | ${cell(l.title)} | ${cell(where)} | ${cell(l.proof)} |`;
  });
  const body = rows.length
    ? ['| Issue | PR | What changed | Where to look | Proof |', '| --- | --- | --- | --- | --- |', ...rows]
    : [];
  return section('Landed — check in the app', run.landed.length, body, 'Nothing landed yet.');
}

function filed(run) {
  const body = run.filed.map((f) => `- ${issue(f.issue)} · ${f.title} — ${f.why} _(during ${f.during})_`);
  return section('Filed for you', run.filed.length, body, 'Nothing filed.');
}

function decisions(run) {
  const body = run.decisions.map((d) => `- ${issue(d.issue)}: ${d.note}`);
  for (const r of run.refused.filter((r) => r.routedTo === 'Canceled')) {
    body.push(`- ${issue(r.issue)}: refused and canceled — ${r.why}`);
  }
  return section('Decisions the bot made', body.length, body, 'None recorded.');
}

function tickLog(run) {
  const body = run.log.length ? ['```', ...run.log, '```'] : [];
  return section('Tick log', 0, body, 'No ticks yet.');
}

export function renderReport(run) {
  return [
    `# Autopilot run · started ${fmt(run.startedAt)} · ${state(run)} · ${counts(run)}`,
    '',
    ...needsDecision(run),
    ...landed(run),
    ...filed(run),
    ...decisions(run),
    ...tickLog(run),
  ].join('\n');
}
