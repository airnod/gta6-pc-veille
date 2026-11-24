"""Vérifie site/tracker.json (données de la course au portage) avant publication."""
import json
import re
import sys
from urllib.parse import urlparse

SUSPECT = re.compile(r"<\s*script|javascript:|on\w+\s*=|https?://", re.I)


def fail(msg):
    print(f"ERREUR tracker : {msg}")
    sys.exit(1)


def text(v, field, n):
    if not isinstance(v, str) or len(v) > n:
        fail(f"{field} invalide ou trop long")
    if SUSPECT.search(v):
        fail(f"{field} contient un lien ou du contenu suspect")


raw = open(sys.argv[1], "rb").read()
if len(raw) > 200_000:
    fail("fichier trop gros")
d = json.loads(raw)
text(d.get("updated", ""), "updated", 30)
src = d.get("source", {})
if urlparse(src.get("url", "")).scheme != "https":
    fail("source.url doit être en https")
text(src.get("name", ""), "source.name", 60)
if "leak" in d:
    text(d["leak"].get("status", ""), "leak.status", 300)
eff = d.get("efforts")
if not isinstance(eff, list) or not 1 <= len(eff) <= 80:
    fail("'efforts' doit contenir entre 1 et 80 projets")
for i, e in enumerate(eff):
    w = f"efforts[{i}]"
    for k in ("name", "approach", "target"):
        text(e.get(k, ""), f"{w}.{k}", 80)
    if e.get("tier") not in ("tracked", "watchlist"):
        fail(f"{w}.tier invalide")
    if set(e) & {"repo", "url", "link", "download"}:
        fail(f"{w} ne doit contenir aucun lien vers le projet")
    for k in ("loader", "shaders", "graphics", "proven"):
        v = e.get("groundwork", {}).get(k)
        if not isinstance(v, (int, float)) or not 0 <= v <= 1:
            fail(f"{w}.groundwork.{k} doit être entre 0 et 1")
    g = e.get("gta", {})
    for k in ("loads", "boots", "menu", "ingame"):
        if g.get(k) not in (0, 0.5, 1, 0.0, 1.0):
            fail(f"{w}.gta.{k} doit valoir 0, 0.5 ou 1")
    if not isinstance(g.get("fps", 0), (int, float)) or not 0 <= g.get("fps", 0) <= 240:
        fail(f"{w}.gta.fps invalide")
    text(str(g.get("stability", "unknown")), f"{w}.gta.stability", 30)
    if not isinstance(e.get("stars", 0), int) or e.get("stars", 0) < 0:
        fail(f"{w}.stars invalide")
print(f"OK : {len(eff)} projet(s) valides")
