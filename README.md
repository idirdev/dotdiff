# dotdiff

> **[EN]** Compare and diff .env files side by side.
> **[FR]** Comparer et visualiser les differences entre fichiers .env cote a cote.

---

## Features / Fonctionnalites

**[EN]**
- Side-by-side diff of two .env files
- Color-coded output (added, removed, changed, unchanged)
- Detect value changes for same keys
- Mask sensitive values (passwords, tokens)
- JSON output option
- Exit code for CI: 0 = identical, 1 = different

**[FR]**
- Diff cote a cote de deux fichiers .env
- Sortie coloree (ajoute, supprime, modifie, inchange)
- Detection des changements de valeur pour les memes cles
- Masquage des valeurs sensibles (mots de passe, tokens)
- Option de sortie JSON
- Code de sortie CI : 0 = identique, 1 = different

---

## Installation

```bash
npm install -g @idirdev/dotdiff
```

---

## CLI Usage / Utilisation CLI

```bash
# Compare two .env files
dotdiff .env.production .env.staging

# Mask sensitive values
dotdiff .env.prod .env.dev --mask

# JSON output
dotdiff .env.prod .env.dev --json
```

### Example Output / Exemple de sortie

```
$ dotdiff .env.production .env.staging

  KEY           | .env.production   | .env.staging
  --------------|-------------------|------------------
  DB_HOST       | prod.db.com       | staging.db.com    [CHANGED]
  DB_PORT       | 5432              | 5432
+ REDIS_URL     |                   | redis://localhost  [ADDED]
- SENTRY_DSN    | https://sentry... |                    [REMOVED]
  NODE_ENV      | production        | staging            [CHANGED]

  Summary: 2 changed, 1 added, 1 removed, 1 identical
```

---

## API (Programmatic) / API (Programmation)

```js
const { diffEnvFiles, formatDiff } = require('dotdiff');

const diff = diffEnvFiles('.env.prod', '.env.dev');
// => { added: [...], removed: [...], changed: [...], unchanged: [...] }

console.log(formatDiff(diff));
```

---

## License

MIT - idirdev
