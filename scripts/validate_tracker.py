"""Vérifie site/tracker.json (classement de la course, données PortWatch VI) avant publication."""
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


def unit(v, field):
    if not isinstance(v, (int, float)) or isinstance(v, bool) or not 0 <= v <= 1:
        fail(f"{field} doit être un nombre entre 0 et 1")


raw = open(sys.argv[1], "rb").read()
if len(raw) > 200_000:
    fail("fichier trop gros")
d = json.loads(raw)
text(d.get("updated", ""), "updated", 30)
src = d.get("source", {})
if urlparse(src.get("url", "")).scheme != "https":
    fail("source.url doit être en https")
text(src.get("name", ""), "source.name", 60)
eff = d.get("efforts")
if not isinstance(eff, list) or not 1 <= len(eff) <= 120:
    fail("'efforts' doit contenir entre 1 et 120 projets")
for i, e in enumerate(eff):
    w = f"efforts[{i}]"
    for k in ("name", "approach", "target"):
        text(e.get(k, ""), f"{w}.{k}", 80)
    if e.get("tier") not in ("tracked", "watchlist"):
        fail(f"{w}.tier invalide")
    if set(e) & {"url", "link", "download"}:
        fail(f"{w} ne doit contenir aucun lien brut")
    repo = e.get("repo")
    if repo is not None and not (isinstance(repo, str) and re.match(r"^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$", repo)):
        fail(f"{w}.repo doit être de la forme propriétaire/projet")
    gw = e.get("groundwork")
    if gw is not None:
        for k in ("loader", "shaders", "graphics", "proven"):
            unit(gw.get(k, 0), f"{w}.groundwork.{k}")
    g = e.get("gta", {})
    for k in ("loads", "boots", "menu", "ingame"):
        unit(g.get(k, 0), f"{w}.gta.{k}")
    fps = g.get("fps", 0)
    if not isinstance(fps, (int, float)) or not 0 <= fps <= 240:
        fail(f"{w}.gta.fps invalide")
    text(str(g.get("stability", "unknown")), f"{w}.gta.stability", 20)
    text(str(e.get("verification", "")), f"{w}.verification", 20)
    for k in ("missing", "nuked"):
        if not isinstance(e.get(k, False), bool):
            fail(f"{w}.{k} doit être vrai ou faux")
    if not isinstance(e.get("stars", 0), int) or e.get("stars", 0) < 0:
        fail(f"{w}.stars invalide")
print(f"OK : {len(eff)} projet(s) valides")
