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
  const STATUTS = { ok:["p-ok","Jouable"], partiel:["p-warn","Partiel / contournement"], non:["p-ko","Pas encore"] };
  function pill(st){ const [c, l] = STATUTS[st] || STATUTS.non; return el("span", "pill " + c, l); }
  function fmt(iso){ try { return new Date(iso).toLocaleString("fr-FR", { timeZone:"Europe/Paris", dateStyle:"medium", timeStyle:"short" }); } catch { return iso; } }

  function renderBody(r, host){
    if (r.resume) host.append(el("p", "resume", r.resume));
    if (Array.isArray(r.points) && r.points.length){
      const g = el("div", "grid");
      r.points.forEach(p => {
        const box = el("div", "pt");
        const h3 = el("h3"); h3.append(el("span", null, p.categorie || "")); if (p.statut) h3.append(pill(p.statut));
        box.append(h3, el("p", null, p.texte || ""));
        g.append(box);
      });
      host.append(g);
    }
    if (Array.isArray(r.sources) && r.sources.length){
      const s = el("div", "src"); s.append(el("span", "meta", "Sources : "));
      r.sources.forEach(x => { const u = safeUrl(x && x.url); if (!u) return; const a = el("a", null, x.titre || new URL(u).hostname); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; s.append(a); });
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
    const rest = full.slice(1);
    const v = el("div", "verdict");
    v.append(pill(list[0].statut), el("span", "meta", "Dernière vérif : " + fmt(list[0].date) + " · rapport du " + fmt(first.date)));
    latest.append(v);
    if (list[0] !== first && list[0].resume) latest.append(el("p", "meta", list[0].resume));
    renderBody(first, latest);
    if (!rest.length){ hist.append(el("div", "empty", "L'historique se remplira au fil des rapports.")); return; }
    rest.forEach(r => {
      const d = el("details"), sm = el("summary");
      sm.append(pill(r.statut), el("span", "meta", fmt(r.date)), el("span", null, r.titre || ""));
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


  // ---- course au portage (données PortWatch VI, barème inspiré de leur méthode) ----
  const STAB = { stable: 1, playable: 0.66, "crashes often": 0.33, crashes: 0.33 };
  const APPROCHES = { "Compatibility layer": "Couche de compatibilité", "Compatibility runtime": "Runtime de compatibilité",
    "HLE emulator": "Émulateur HLE", "Emulator": "Émulateur", "Static recompilation": "Recompilation statique",
    "Static recompilation (DX12)": "Recompilation statique (DX12)", "Relinker": "Relinker", "Relinker (PS5 route)": "Relinker (version PS5)",
    "Relinker + shader recompiler": "Relinker + recompilation des shaders", "Fork of XCL": "Dérivé de XCL", "Boot harness": "Banc de démarrage", "Unknown": "Méthode non publiée", "API bridge": "Pont d'API", "Research probes": "Recherches" };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; };
  function score(e){
    const g = e.groundwork || {}, t = e.gta || {};
    // un projet qui démarre vraiment GTA VI a forcément terminé son travail préparatoire
    const gw = num(t.boots) > 0 ? 25 : (num(g.loader) + num(g.shaders) + num(g.graphics) + num(g.proven)) / 4 * 25;
    const ms = (num(t.loads) + num(t.boots) + num(t.menu) + num(t.ingame)) * 11.25;
    const fps = num((Number(t.fps) || 0) / 30) * 15;
    const st = (STAB[String(t.stability || "").toLowerCase()] || 0) * 15;
    return Math.round((gw + ms + (fps + st) * num(t.ingame)) * 10) / 10;
  }
  const JALONS = [["loads", "Charge"], ["boots", "Démarre"], ["menu", "Menu"], ["ingame", "En jeu"]];
  function bestMilestone(list){
    let best = "Aucun";
    JALONS.forEach(([k, l]) => { if (list.some(e => num((e.gta || {})[k]) > 0)) best = l + (list.some(e => num((e.gta || {})[k]) >= 1) ? "" : " (partiel)"); });
    return best;
  }
  let raceData = [], raceFilter = "all";
  function renderRace(){
    const host = $("racelist"); host.replaceChildren();
    let list = raceData.filter(e => raceFilter === "watch" ? e.tier === "watchlist" : e.tier !== "watchlist");
    if (raceFilter === "gta") list = raceData.filter(e => e.gtaSpecific);
    list.sort((a, b) => b._s - a._s || (b.stars || 0) - (a.stars || 0));
    if (!list.length){ host.append(el("div", "empty", "Aucun projet dans cette catégorie.")); return; }
    list.forEach(e => {
      const row = el("div", "row");
      const left = el("div"); const nm = el("div", "nm", e.name || "?");
      if (e.gtaSpecific) nm.append(el("span", "tag", "GTA VI"));
      if (e.verification === "self-reported") nm.append(el("span", "tag", "auto-déclaré"));
      if (e.verification === "unverified") nm.append(el("span", "tag", "non vérifié"));
      if (e.note) nm.append(el("span", "tag", e.note));
      left.append(nm, el("div", "sub2", (APPROCHES[e.approach] || e.approach || "") + " · " + (e.gtaSpecific ? "GTA VI" : "tout jeu Xbox Series") + " · ★ " + (e.stars || 0).toLocaleString("fr-FR")));
      const bars = el("div", "bars"); const pb = el("div", "pbar"); const fill = el("i"); fill.style.width = e._s + "%"; pb.append(fill, el("span", "gw"));
      const steps = el("div", "steps");
      JALONS.forEach(([k, l]) => { const v = num((e.gta || {})[k]); steps.append(el("em", v >= 1 ? "full" : v > 0 ? "half" : "", l)); });
      bars.append(pb, steps);
      row.append(left, bars, el("div", "pct", e._s.toFixed(1) + " %"));
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
      raceData = (Array.isArray(j.efforts) ? j.efforts : []).map(e => Object.assign({}, e, { _s: score(e) }));
      const tracked = raceData.filter(e => e.tier !== "watchlist");
      const sorted = tracked.map(e => e._s).sort((a, b) => b - a);
      const best = sorted[0] || 0, top3 = sorted.slice(0, 3);
      $("ovpct").textContent = best.toFixed(1) + " %"; $("ovbar").style.width = best + "%";
      const booted = raceData.some(e => num((e.gta || {}).boots) > 0);
      $("t-boot").textContent = booted ? "Oui" : "Pas encore";
      $("t-mile").textContent = bestMilestone(raceData);
      $("t-top3").textContent = top3.length ? (top3.reduce((a, b) => a + b, 0) / top3.length).toFixed(1) + " %" : "–";
      $("t-count").textContent = tracked.length + " (+" + (raceData.length - tracked.length) + ")";
      const note = $("racenote"); note.replaceChildren();
      note.append(el("span", null, "Progression = projet le plus avancé. Les 25 premiers % = travail préparatoire (chargeur, shaders, rendu, preuve sur d'autres jeux) ; au-delà, seuls de vrais jalons GTA VI comptent (charge, démarre, menu, en jeu), puis FPS et stabilité. Jalon partiel = moitié. Données : "));
      const src = j.source && safeUrl(j.source.url);
      if (src){ const a = el("a", null, (j.source && j.source.name) || "source"); a.href = src; a.target = "_blank"; a.rel = "noopener noreferrer"; note.append(a); }
      note.append(el("span", null, " · mise à jour " + fmt(j.updated) + (j.leak && j.leak.status ? " · Fuite : " + j.leak.status : "") + ". Aucun lien vers les projets ni vers la fuite."));
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
