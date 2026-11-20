# Veille GTA VI sur PC

Site statique (compte à rebours + rapports) publié sur GitHub Pages.
Les rapports sont écrits dans `site/reports.json` par une tâche planifiée Claude ;
le workflow `.github/workflows/deploy.yml` vérifie le fichier puis publie `site/`.

Le site ne contient **aucune clé ni aucun accès** à GitHub ou à Claude : il lit seulement `reports.json`.

## Structure
- `site/` : ce qui est publié (index.html, app.js, reports.json)
- `scripts/validate_reports.py` : bloque la publication si `reports.json` est malformé ou suspect
- `.github/workflows/deploy.yml` : publication GitHub Pages
