# Veille GTA VI sur PC

Site statique (compte à rebours + rapports). Les rapports sont écrits dans `site/reports.json`
par une tâche planifiée Claude, puis GitHub Actions déploie `site/` sur l'hébergeur en FTPS.

Le site ne contient **aucune clé ni aucun accès** à GitHub ou à Claude : il lit seulement `reports.json`.

## Structure
- `site/` : ce qui est publié (index.html, app.js, reports.json, .htaccess)
- `scripts/validate_reports.py` : bloque le déploiement si `reports.json` est malformé ou suspect
- `.github/workflows/deploy.yml` : déploiement FTPS

## Secrets GitHub Actions (Settings > Secrets and variables > Actions)
| Nom | Exemple |
|---|---|
| `FTP_HOST` | `ftp.airnod.fr` |
| `FTP_USER` | compte FTP **dédié**, limité au dossier du site |
| `FTP_PASS` | mot de passe long et unique |
| `FTP_DIR` | `/` (le compte dédié est déjà enfermé dans son dossier) |
