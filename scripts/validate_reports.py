"""Vérifie reports.json avant déploiement : structure, tailles, liens https uniquement.
Bloque le déploiement si un rapport est malformé ou contient un contenu suspect."""
import json
import re
import sys
from urllib.parse import urlparse

MAX_BYTES = 300_000
MAX_REPORTS = 200
STATUTS = {"ok", "partiel", "non"}
SUSPECT = re.compile(r"<\s*script|javascript:|on\w+\s*=", re.I)


def fail(msg):
    print(f"ERREUR : {msg}")
    sys.exit(1)


def check_text(value, field, max_len):
    if not isinstance(value, str):
        fail(f"{field} doit être un texte")
    if len(value) > max_len:
        fail(f"{field} trop long ({len(value)} > {max_len})")
    if SUSPECT.search(value):
        fail(f"{field} contient du contenu suspect")


path = sys.argv[1]
raw = open(path, "rb").read()
if len(raw) > MAX_BYTES:
    fail(f"fichier trop gros ({len(raw)} octets)")
data = json.loads(raw)

reports = data.get("reports")
if not isinstance(reports, list) or not reports:
    fail("'reports' doit être une liste non vide")
if len(reports) > MAX_REPORTS:
    fail(f"trop de rapports ({len(reports)} > {MAX_REPORTS})")

for i, r in enumerate(reports):
    where = f"reports[{i}]"
    check_text(r.get("date"), f"{where}.date", 30)
    check_text(r.get("titre", ""), f"{where}.titre", 200)
    check_text(r.get("resume", ""), f"{where}.resume", 800)
    if r.get("statut") not in STATUTS:
        fail(f"{where}.statut invalide")
    for j, p in enumerate(r.get("points", [])):
        check_text(p.get("categorie", ""), f"{where}.points[{j}].categorie", 80)
        check_text(p.get("texte", ""), f"{where}.points[{j}].texte", 500)
        if p.get("statut") not in STATUTS:
            fail(f"{where}.points[{j}].statut invalide")
    for j, s in enumerate(r.get("sources", [])):
        check_text(s.get("titre", ""), f"{where}.sources[{j}].titre", 200)
        url = s.get("url", "")
        if urlparse(url).scheme != "https":
            fail(f"{where}.sources[{j}].url doit être en https")

print(f"OK : {len(reports)} rapport(s) valides")
