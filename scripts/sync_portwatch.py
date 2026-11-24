"""Convertit le tracker.json public de PortWatch VI en site/tracker.json.

Usage : python3 scripts/sync_portwatch.py <tracker PortWatch> <sortie>
On ne garde que les champs utiles au classement : aucun lien vers les dépôts des projets.
"""
import json
import re
import sys

URL = re.compile(r"https?://\S+", re.I)


def clean(v, n=80):
    return URL.sub("", str(v or ""))[:n].strip()


def num(v):
    try:
        return min(1.0, max(0.0, float(v)))
    except (TypeError, ValueError):
        return 0.0


src = json.load(open(sys.argv[1], encoding="utf-8"))
efforts = []
for e in src.get("efforts", []):
    stats = e.get("stats") or {}
    gw = e.get("groundwork")
    g = e.get("gta") or {}
    efforts.append({
        "name": clean(e.get("name")),
        "tier": "watchlist" if e.get("tier") == "watchlist" else "tracked",
        "approach": clean(e.get("approach")),
        "target": clean(e.get("target")),
        "groundwork": {k: num(gw.get(k)) for k in ("loader", "shaders", "graphics", "proven")} if isinstance(gw, dict) else None,
        "gta": {
            "loads": num(g.get("loads")), "boots": num(g.get("boots")),
            "menu": num(g.get("menu")), "ingame": num(g.get("ingame")),
            "fps": max(0.0, min(240.0, float(g.get("fps") or 0))),
            "stability": clean(g.get("stability") or "unknown", 20),
        },
        "stars": int(e.get("stars", stats.get("stars", 0)) or 0),
        "missing": bool(e.get("missing", stats.get("missing", False))),
        "nuked": bool(e.get("nuked")),
        "verification": clean(e.get("verification") or "self-reported", 20),
    })

if not efforts:
    sys.exit("PortWatch : aucun projet trouvé, on garde l'ancien fichier")

out = {
    "updated": clean(src.get("updated"), 30),
    "source": {"name": "PortWatch VI", "url": "https://portwatch-vi.xyz/"},
    "efforts": efforts,
}
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"PortWatch : {len(efforts)} projets, mis à jour {out['updated']}")
