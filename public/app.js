// Motorcito dashboard — vanilla JS SPA over the internal API.
const api = (p, o) => fetch(p, o).then((r) => r.json());
const el = (id) => document.getElementById(id);
let TEAMS = {}; // code -> {name, flag, group}

function team(code) {
  const t = TEAMS[code];
  if (!t) return `<span>${code ?? '—'}</span>`;
  return `<span class="flag">${t.flag ?? ''}</span> ${t.name} <span class="muted">(${code})</span>`;
}
function teamShort(code) {
  const t = TEAMS[code];
  return t ? `${t.flag ?? ''} ${code}` : (code ?? '—');
}
function pct(x) { return (x * 100).toFixed(0) + '%'; }
function probBar(p) {
  return `<div class="bar" title="L ${pct(p.home)} · E ${pct(p.draw)} · V ${pct(p.away)}">
    <div class="h" style="width:${p.home * 100}%"></div>
    <div class="d" style="width:${p.draw * 100}%"></div>
    <div class="a" style="width:${p.away * 100}%"></div></div>`;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Tabs ──
document.querySelectorAll('#tabs button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    el(b.dataset.tab).classList.add('active');
    render(b.dataset.tab);
  };
});

// ── Sync ──
el('sync-btn').onclick = async () => {
  el('sync-btn').textContent = 'Sincronizando…';
  const r = await api('/api/results/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'dashboard' }) });
  el('sync-btn').textContent = 'Sincronizar resultados';
  toast(`${r.changes.length} cambio(s) · llave ${r.qualifiersChanged ? 'recalculada' : 'sin cambios'}`);
  boot();
};

// ── Renderers ──
async function renderDashboard() {
  const [t, models, bracket, matches] = await Promise.all([
    api('/api/tournament'),
    api('/api/models'),
    api('/api/bracket'),
    api('/api/matches'),
  ]);
  const proj = bracket.projected ?? bracket;
  const played = matches.filter((m) => m.official_score).length;
  const recent = matches.filter((m) => m.official_score).slice(-6).reverse();
  const pending = matches.filter((m) => !m.official_score && m.stage === 'group_stage').slice(0, 6);
  const top = proj.qualifiers ? null : null;
  el('dashboard').innerHTML = `
    <div class="grid cards">
      <div class="card"><h3>Torneo</h3><div class="big">${t.counts.matches}</div><div class="sub">${t.counts.teams} equipos · ${t.counts.groups} grupos</div></div>
      <div class="card"><h3>Partidos jugados</h3><div class="big">${played}</div><div class="sub">de ${t.counts.matches} (oficiales)</div></div>
      <div class="card"><h3>Modelos</h3><div class="big">${models.total}</div><div class="sub">benchmark + runtime</div></div>
      <div class="card"><h3>Campeón proyectado</h3><div class="big">${teamShort(proj.champion)}</div><div class="sub">consenso + Elo</div></div>
    </div>
    <h3 class="section-title">Resultados recientes</h3>
    <div class="card">${recent.length ? recent.map(matchRow).join('') : '<div class="muted">Aún sin resultados. Pulsa «Sincronizar resultados».</div>'}</div>
    <h3 class="section-title">Próximos partidos (fase de grupos)</h3>
    <div class="card">${pending.length ? pending.map(matchRow).join('') : '<div class="muted">Sin pendientes.</div>'}</div>`;
}

function matchRow(m) {
  const sc = m.official_score;
  return `<div class="match-row" onclick="openMatch('${m.matchId}')">
    <div><span class="tag">${m.matchId}</span> <span class="match-teams">${teamShort(m.home)} <span class="muted">vs</span> ${teamShort(m.away)}</span></div>
    <div>${sc ? `<span class="score">${sc.home} - ${sc.away}</span> <span class="tag official">oficial</span>` : `<span class="muted">${m.date ?? ''} ${m.group ?? m.round}</span>`}</div>
  </div>`;
}

async function renderGroups() {
  const data = await api('/api/groups/projected');
  const blocks = Object.keys(data.standings).sort().map((g) => {
    const rows = data.standings[g].map((s, i) => `
      <tr class="${i === 0 ? 'qual1' : i === 1 ? 'qual2' : i === 2 ? 'qual3' : ''}">
        <td>${i + 1}. ${teamShort(s.code)}</td>
        <td>${s.played}</td><td>${s.won}-${s.drawn}-${s.lost}</td>
        <td>${s.goalsFor}:${s.goalsAgainst}</td><td>${s.goalDifference >= 0 ? '+' : ''}${s.goalDifference}</td>
        <td><b>${s.points}</b></td></tr>`).join('');
    return `<div class="card"><h3>Grupo ${g}</h3>
      <table><thead><tr><th>Equipo</th><th>PJ</th><th>G-E-P</th><th>GF:GC</th><th>DG</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  el('groups').innerHTML = `
    <p class="muted">Clasificación viva. Las posiciones combinan resultados oficiales con proyección Elo de los partidos no jugados. <span class="qual3">▌</span> = mejores terceros candidatos. Desempates: Pts → DG → GF → directo → Elo.</p>
    <div class="grid groups-grid">${blocks}</div>`;
}

async function renderBracket() {
  const b = await api('/api/bracket');
  const ko = (b.projected ?? b).knockout;
  const projSet = new Set((b.projected ?? b).projected_matches ?? []);
  const rounds = [['R32', 'Dieciseisavos'], ['R16', 'Octavos'], ['QF', 'Cuartos'], ['SF', 'Semis'], ['TP', '3er puesto'], ['F', 'Final']];
  const cols = rounds.map(([r, label]) => {
    const ms = ko.filter((k) => k.round === r);
    return `<div class="round-col"><h4>${label}</h4>${ms.map((k) => koCard(k, projSet.has(k.matchId))).join('')}</div>`;
  }).join('');
  el('bracket').innerHTML = `
    <p class="muted">Llave completa con arrastre automático de clasificados. <span class="tag official">oficial</span> = resultado real · <span class="tag proj">proy</span> = proyección del modelo. Campeón proyectado: <b>${teamShort((b.projected ?? b).champion)}</b>.</p>
    <div class="rounds">${cols}</div>`;
}
function koCard(k, projected) {
  const tagW = (c) => (k.winner === c ? 'w' : '');
  const sc = k.score ? `${k.score.home}-${k.score.away}` : 'vs';
  return `<div class="ko">
    <div class="muted"><span class="tag">${k.matchId}</span> ${projected ? '<span class="tag proj">proy</span>' : '<span class="tag official">oficial</span>'}</div>
    <div class="${tagW(k.home)}">${teamShort(k.home) || k.slot1}</div>
    <div class="muted score">${sc}</div>
    <div class="${tagW(k.away)}">${teamShort(k.away) || k.slot2}</div>
  </div>`;
}

async function renderModels() {
  const [data, ens] = await Promise.all([api('/api/models'), api('/api/predictions/ensemble')]);
  const rows = data.models.map((m) => `
    <tr><td>${m.rank}</td><td><b>${m.model_name}</b></td>
      <td>${m.total_evaluated}</td><td>${pct(m.accuracy)}</td>
      <td>${m.exact_scores}</td><td>${m.brier_avg != null ? m.brier_avg.toFixed(3) : '—'}</td>
      <td>${m.bracket_points}</td><td>${teamShort(m.champion)}</td></tr>`).join('');
  const cons = ens.tournament.champion.slice(0, 6).map((c) => `<tr><td>${teamShort(c.code)}</td><td>${pct(c.prob)}</td><td>${probBarMini(c.prob)}</td></tr>`).join('');
  el('models').innerHTML = `
    <h3 class="section-title">Leaderboard · ${data.total} modelos</h3>
    <div class="card"><table>
      <thead><tr><th>#</th><th>Modelo</th><th>Eval</th><th>Acc</th><th>Exactos</th><th>Brier</th><th>Bracket</th><th>Campeón</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="muted" style="margin-top:8px">Acc = acierto de resultado · Brier = error probabilístico (menor es mejor) · Bracket = puntos por clasificados acertados.</p>
    </div>
    <h3 class="section-title">Consenso de campeón (ponderado por desempeño)</h3>
    <div class="card"><table><thead><tr><th>Equipo</th><th>Prob</th><th></th></tr></thead><tbody>${cons}</tbody></table></div>`;
}
function probBarMini(p) { return `<div class="bar"><div class="h" style="width:${p * 100}%"></div></div>`; }

async function renderAudit() {
  const a = await api('/api/audit');
  const entries = a.entries.map((e) => `
    <tr><td>${new Date(e.timestamp).toLocaleString()}</td><td>${e.actor}</td>
      <td><span class="tag">${e.action}</span></td><td>${e.summary}</td><td class="muted">${e.versionHash}</td></tr>`).join('');
  const versions = a.versions.slice().reverse().map((v) => `<tr><td>${v.versionHash}</td><td>${new Date(v.createdAt).toLocaleString()}</td><td>${v.reason}</td></tr>`).join('');
  el('audit').innerHTML = `
    <h3 class="section-title">Trazabilidad de cambios</h3>
    <div class="card"><table><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Resumen</th><th>Versión</th></tr></thead>
      <tbody>${entries || '<tr><td colspan="5" class="muted">Sin eventos todavía.</td></tr>'}</tbody></table></div>
    <h3 class="section-title">Versiones del estado</h3>
    <div class="card"><table><thead><tr><th>Hash</th><th>Creada</th><th>Motivo</th></tr></thead>
      <tbody>${versions || '<tr><td colspan="3" class="muted">Sin versiones.</td></tr>'}</tbody></table></div>`;
}

// ── Match detail modal ──
window.openMatch = async (id) => {
  const d = await api('/api/matches/' + id);
  const m = d.match;
  const three = (label, p, cls) => p ? `<tr><td>${label}</td><td>${probBar(p)}</td><td>L ${pct(p.home)} · E ${pct(p.draw)} · V ${pct(p.away)}</td></tr>` : '';
  const perModel = d.per_model.map((x) => `<tr><td>${x.model}</td><td>${x.predicted_score.home}-${x.predicted_score.away}</td><td>${x.result}</td><td>L ${pct(x.probs.home)}/E ${pct(x.probs.draw)}/V ${pct(x.probs.away)}</td></tr>`).join('');
  el('modal-body').innerHTML = `
    <h2>${team(m.home)} <span class="muted">vs</span> ${team(m.away)}</h2>
    <p class="muted">${m.matchId} · ${m.stage} · ${m.group ?? m.round} · ${m.date ?? ''} ${m.venue ? '· ' + m.venue : ''}</p>
    ${d.official_result ? `<div class="card"><h3>Resultado real</h3><div class="big">${d.official_result.home} - ${d.official_result.away}</div></div>` : '<p class="muted">Partido pendiente.</p>'}
    <h3 class="section-title">Señales</h3>
    <table>
      ${three('Mercado (Elo)', d.market)}
      ${d.consensus ? three('Consenso', d.consensus.probs) : ''}
    </table>
    ${d.consensus ? `<p class="muted">Consenso: marcador ${d.consensus.predicted_score.home}-${d.consensus.predicted_score.away} · confianza ${pct(d.consensus.confidence)} · ${d.consensus.contributors} modelos.</p>` : ''}
    ${perModel ? `<h3 class="section-title">Por modelo</h3><table><thead><tr><th>Modelo</th><th>Marcador</th><th>Result</th><th>Probabilidades</th></tr></thead><tbody>${perModel}</tbody></table>` : ''}`;
  el('modal').classList.remove('hidden');
};
el('modal-close').onclick = () => el('modal').classList.add('hidden');
el('modal').onclick = (e) => { if (e.target === el('modal')) el('modal').classList.add('hidden'); };

// ── Boot ──
const rendered = {};
function render(tab) {
  ({ dashboard: renderDashboard, groups: renderGroups, bracket: renderBracket, models: renderModels, audit: renderAudit }[tab] || renderDashboard)();
}
async function boot() {
  const t = await api('/api/tournament');
  TEAMS = {};
  t.teams.forEach((x) => (TEAMS[x.code] = x));
  el('version').textContent = 'v ' + (t.version || '—').slice(0, 8);
  el('subtitle').textContent = `${t.name} · ${t.counts.teams} equipos · ${t.counts.matches} partidos`;
  render(document.querySelector('#tabs button.active').dataset.tab);
}
boot();
