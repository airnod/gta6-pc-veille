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

  // ---- easter egg ----
  const box = $("eggbox"), img = $("eggimg");
  $("egg").addEventListener("click", () => { if (!img.src) img.src = "chats.jpg"; box.hidden = false; });
  box.addEventListener("click", () => { box.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") box.hidden = true; });
})();
