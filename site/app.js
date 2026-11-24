(() => {
  // 19/11/2026 00:00 et 19/02/2027 00:00, heure de Paris
  const START = Date.parse("2026-11-18T23:00:00Z");
  const END   = Date.parse("2027-02-18T23:00:00Z");
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, "0");

  function tick(){
    const now = Date.now();
    let left = Math.max(0, END - now);
    const d = Math.floor(left / 864e5); left -= d * 864e5;
    const h = Math.floor(left / 36e5);  left -= h * 36e5;
    const m = Math.floor(left / 6e4);   left -= m * 6e4;
    const s = Math.floor(left / 1e3);
    $("d").textContent = d; $("h").textContent = pad(h); $("m").textContent = pad(m); $("s").textContent = pad(s);
    const p = Math.min(100, Math.max(0, (now - START) / (END - START) * 100));
    $("bar").style.width = p.toFixed(2) + "%";
    $("pct").textContent = p.toFixed(1) + " %";
  }
  tick(); setInterval(tick, 1000);

  // ---- rendu sûr (les données sont traitées comme du texte) ----
  function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  function safeUrl(u){ try { const x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : null; } catch { return null; } }
  const STATUTS = { ok:["p-ok","Jouable"], partiel:["p-warn","En approche"], non:["p-ko","Pas encore"] };
  function pill(st){ const [c, l] = STATUTS[st] || STATUTS.non; return el("span", "pill " + c, l); }
  function fmt(iso){ try { return new Date(iso).toLocaleString("fr-FR", { timeZone:"Europe/Paris", dateStyle:"medium", timeStyle:"short" }); } catch { return iso; } }
  // Le Remote Play et le cloud ne sont ni du portage ni de l'émulation : on ne les affiche pas
  const HORS_SUJET = /remote\s*play|cloud|streaming/i;

  function renderBody(r, host){
    if (r.resume) host.append(el("p", "lead", r.resume));
    const pts = (Array.isArray(r.points) ? r.points : []).filter(p => !HORS_SUJET.test(p.categorie || ""));
    if (pts.length){
      const list = el("div", "facts");
      pts.forEach(p => {
        const row = el("div", "fact");
        const head = el("div", "fact-h");
        head.append(el("span", "dot d-" + (STATUTS[p.statut] ? p.statut : "non")), el("span", null, p.categorie || ""));
        row.append(head, el("p", null, p.texte || ""));
        list.append(row);
      });
      host.append(list);
    }
    if (Array.isArray(r.sources) && r.sources.length){
      const s = el("div", "src");
      r.sources.forEach(x => { const u = safeUrl(x && x.url); if (!u) return; const a = el("a", "chip", x.titre || new URL(u).hostname); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; s.append(a); });
      host.append(s);
    }
  }

  function render(list){
    const latest = $("latest"), hist = $("history");
    latest.replaceChildren(); hist.replaceChildren();
    if (!list.length){ latest.append(el("div", "empty", "Aucun rapport pour l'instant. Le premier arrive à la prochaine recherche.")); return; }
    // Les vérifications « rien de nouveau » n'ont pas de points : on affiche le dernier vrai rapport
    const full = list.filter(r => Array.isArray(r.points) && r.points.length);
    const first = full[0] || list[0];
    const head = el("div", "rep-h");
    const titles = el("div"); titles.append(el("h3", "rep-t", first.titre || "Rapport"), el("div", "meta", fmt(first.date) + (list[0] !== first ? " · dernière vérification " + fmt(list[0].date) : "")));
    head.append(titles, pill(first.statut));
    latest.append(head);
    renderBody(first, latest);
    const rest = full.slice(1);
    if (!rest.length){ hist.append(el("div", "empty", "L'historique se remplira au fil des rapports.")); return; }
    rest.forEach(r => {
      const d = el("details", "hist"), sm = el("summary");
      sm.append(el("span", "hd", fmt(r.date)), el("span", "ht", r.titre || ""), pill(r.statut));
      const b = el("div", "body"); renderBody(r, b);
      d.append(sm, b); hist.append(d);
    });
  }

  // ---- données : fichier JSON public mis à jour par la veille automatique ----
  // reports.json est déposé dans le même dossier que la page par le déploiement GitHub Actions
  const JSON_URL = "reports.json";
  async function load(){
    try {
      const r = await fetch(JSON_URL + (JSON_URL.includes("?") ? "&" : "?") + "t=" + Math.floor(Date.now() / 6e5), { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const list = (Array.isArray(j.reports) ? j.reports : []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
      render(list);
    } catch (e) {
      $("latest").replaceChildren(el("div", "empty", "Impossible de charger les rapports pour le moment."));
    }
  }
  load(); setInterval(load, 10 * 60 * 1000);


  // ---- course au portage : données et barème de PortWatch VI (copie fidèle de leur scoring.js) ----
  const MILESTONES = [["groundwork","Préparation",0],["loads","Exe lancé",25],["boots","1re image",40],["menu","Menu principal",55],["ingame","En jeu",70],["fps30","30 FPS",85],["stable","Stable",100]];
  const TICK = Object.fromEntries(MILESTONES.map(m => [m[0], m[2]]));
  const GW_WEIGHTS = { loader: 0.2, shaders: 0.28, graphics: 0.32, proven: 0.2 };
  const STAB = { unknown: 0, constant: 0, often: 0.25, sometimes: 0.55, rarely: 0.8, stable: 1 };
  const clamp01 = (v) => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : 0);
  function scoreEffort(e){
    const gw = Object.keys(GW_WEIGHTS).reduce((s, k) => s + GW_WEIGHTS[k] * clamp01((e.groundwork || {})[k]), 0);
    const gta = e.gta || {};
    let score = TICK.loads * gw, reached = "groundwork", prev = score;
    for (const k of ["loads", "boots", "menu", "ingame"]){
      const v = clamp01(gta[k]);
      if (v >= 1){ score = TICK[k]; prev = score; reached = k; continue; }
      if (v > 0) score = Math.max(score, prev + v * (TICK[k] - prev));
      break;
    }
    if (reached === "ingame"){
      const fps = clamp01((+gta.fps || 0) / 30), st = STAB[gta.stability] || 0;
      score = TICK.ingame + fps * (TICK.fps30 - TICK.ingame) + st * (TICK.stable - TICK.fps30);
      if (fps >= 1) reached = "fps30";
      if (fps >= 1 && st >= 1) reached = "stable";
    }
    return { score: Math.round(score * 10) / 10, reached, gw };
  }
  const label = (k) => (MILESTONES.find(m => m[0] === k) || MILESTONES[0])[1];
  const APPROCHES = { "Compatibility layer": "Couche de compatibilité", "Compatibility runtime": "Runtime de compatibilité",
    "HLE emulator": "Émulateur HLE", "Emulator": "Émulateur", "Static recompilation": "Recompilation statique",
    "Static recompilation (DX12)": "Recompilation statique (DX12)", "Relinker": "Relinker", "Relinker (PS5 route)": "Relinker (version PS5)",
    "Relinker + shader recompiler": "Relinker + recompilation des shaders", "API bridge": "Pont d'API", "Research probes": "Recherches" };
  const isGta = (e) => /GTA VI|PS5 build/i.test(e.target || "") && !/^Any/i.test(e.target || "");
  let raceData = [], raceFilter = "all";
  function renderRace(){
    const host = $("racelist"); host.replaceChildren();
    let list;
    if (raceFilter === "watch") list = raceData.filter(e => e.tier === "watchlist" && !e.nuked);
    else if (raceFilter === "off") list = raceData.filter(e => e.nuked || e.missing);
    else {
      list = raceData.filter(e => e.tier !== "watchlist" && !e.nuked);
      if (raceFilter === "gta") list = list.filter(isGta);
      if (raceFilter === "any") list = list.filter(e => !isGta(e));
    }
    list.sort((a, b) => b._s.score - a._s.score || (b.stars || 0) - (a.stars || 0));
    if (!list.length){ host.append(el("div", "empty", "Aucun projet dans cette catégorie.")); return; }
    list.forEach((e, i) => {
      const row = el("div", "row");
      const left = el("div");
      const nm = el("div", "nm"); nm.append(el("span", "rk", String(i + 1)), el("span", null, e.name || "?"));
      if (isGta(e)) nm.append(el("span", "tag", "GTA VI"));
      if (e.verification === "self-reported") nm.append(el("span", "tag", "auto-déclaré"));
      if (e.nuked) nm.append(el("span", "tag t-ko", "supprimé"));
      else if (e.missing) nm.append(el("span", "tag t-ko", "dépôt disparu"));
      left.append(nm, el("div", "sub2", (APPROCHES[e.approach] || e.approach || "") + " · " + (isGta(e) ? "GTA VI" : "tout jeu Xbox Series") + " · ★ " + (e.stars || 0).toLocaleString("fr-FR")));
      const bars = el("div", "bars"); const pb = el("div", "pbar"); const fill = el("i"); fill.style.width = e._s.score + "%"; pb.append(fill);
      [25, 40, 55, 70, 85].forEach(x => { const t = el("span", "tk"); t.style.left = x + "%"; pb.append(t); });
      const steps = el("div", "steps");
      const idx = MILESTONES.findIndex(m => m[0] === e._s.reached);
      MILESTONES.slice(1).forEach((m, k) => {
        const reached = k + 1 <= idx;
        const partial = idx > 0 && !reached && k + 1 === idx + 1 && e._s.score > MILESTONES[idx][2];
        steps.append(el("em", reached ? "full" : partial ? "half" : "", m[1]));
      });
      bars.append(pb, steps);
      const right = el("div", "pct"); right.append(el("b", null, e._s.score + " %"), el("small", null, label(e._s.reached)));
      row.append(left, bars, right);
      host.append(row);
    });
  }
  document.querySelectorAll(".filters button").forEach(b => b.addEventListener("click", () => {
    raceFilter = b.dataset.f;
    document.querySelectorAll(".filters button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    renderRace();
  }));
  async function loadRace(){
    try {
      const r = await fetch("tracker.json?t=" + Math.floor(Date.now() / 6e5), { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      raceData = (Array.isArray(j.efforts) ? j.efforts : []).map(e => Object.assign({}, e, { _s: scoreEffort(e) }));
      // Même calcul que PortWatch : classement sans les projets supprimés, tous les projets comptés
      const ranked = raceData.filter(e => !e.nuked).sort((a, b) => b._s.score - a._s.score || (b.stars || 0) - (a.stars || 0));
      const leader = ranked[0], top = ranked.slice(0, 3);
      const best = leader ? leader._s.score : 0;
      $("ovpct").textContent = best + " %"; $("ovbar").style.width = best + "%";
      $("ovleader").textContent = leader ? "En tête : " + leader.name + " · a atteint « " + label(leader._s.reached) + " »" : "";
      const furthest = ranked.reduce((m, e) => Math.max(m, MILESTONES.findIndex(x => x[0] === e._s.reached)), 0);
      $("t-mile").textContent = MILESTONES[furthest][1];
      $("t-top3").textContent = top.length ? Math.round(top.reduce((a, e) => a + e._s.score, 0) / top.length * 10) / 10 + " %" : "–";
      $("t-boot").textContent = raceData.filter(e => clamp01((e.gta || {}).boots) >= 1).length + " / " + raceData.length;
      $("t-count").textContent = String(raceData.length);
      const note = $("racenote"); note.replaceChildren();
      note.append(el("span", null, "Données et barème : "));
      const src = j.source && safeUrl(j.source.url);
      if (src){ const a = el("a", null, (j.source && j.source.name) || "source"); a.href = src; a.target = "_blank"; a.rel = "noopener noreferrer"; note.append(a); }
      note.append(el("span", null, ", mises à jour " + fmt(j.updated) + ". 0-25 % = préparation, puis Exe lancé 25 %, 1re image 40 %, Menu 55 %, En jeu 70 %, 30 FPS 85 %, Stable 100 %. Chiffres auto-déclarés par les projets. Aucun lien vers les projets ni vers la fuite."));
      renderRace();
    } catch (e) {
      $("racelist").replaceChildren(el("div", "empty", "Impossible de charger la course pour le moment."));
    }
  }
  loadRace(); setInterval(loadRace, 10 * 60 * 1000);

  // ---- easter egg ----
  const box = $("eggbox"), img = $("eggimg");
  $("egg").addEventListener("click", () => { if (!img.src) img.src = "chats.jpg"; box.hidden = false; });
  box.addEventListener("click", () => { box.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") box.hidden = true; });
})();
