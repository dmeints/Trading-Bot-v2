#!/usr/bin/env bash
set -euo pipefail
echo "Applying Skippy tiny patch..."

# Copy files into project root
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
copy() { mkdir -p "$(dirname "$2")"; cp -f "$SRC_DIR/$1" "$2"; echo "  + $2"; }

copy server/bootstrap/config.ts server/bootstrap/config.ts
copy server/observability/metrics.ts server/observability/metrics.ts
copy server/middleware/security.ts server/middleware/security.ts
copy server/utils/resilience.ts server/utils/resilience.ts
copy server/routes/health.ts server/routes/health.ts
copy server/routes/metrics.ts server/routes/metrics.ts
copy server/routes/clientErrors.ts server/routes/clientErrors.ts
copy server/utils/errorJournal.ts server/utils/errorJournal.ts
copy server/middleware/chaos.ts server/middleware/chaos.ts
copy server/docs/openapi.ts server/docs/openapi.ts
copy server/bootstrap/dbReady.ts server/bootstrap/dbReady.ts
copy client/src/lib/errorReporter.ts client/src/lib/errorReporter.ts
copy tests/contract/config.json tests/contract/config.json
copy tests/contract/loadRoutes.mjs tests/contract/loadRoutes.mjs
copy tests/contract/run.mjs tests/contract/run.mjs
copy scripts/start_and_test.sh scripts/start_and_test.sh
copy scripts/triage.js scripts/triage.js
copy SLO_RUNBOOK.md SLO_RUNBOOK.md

# Ensure package.json scripts
node - <<'NODE'
const fs = require('fs');
if (!fs.existsSync('package.json')) process.exit(0);
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts["start:logged"] = pkg.scripts["start:logged"] || "node server/index.js 2>&1 | tee -a logs/app.log";
pkg.scripts["triage"] = pkg.scripts["triage"] || "node scripts/triage.js";
pkg.scripts["test:contract"] = pkg.scripts["test:contract"] || "bash scripts/start_and_test.sh";
pkg.scripts["ready:check"] = pkg.scripts["ready:check"] || "node server/bootstrap/dbReady.ts";
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log("  + package.json scripts ensured");
NODE

echo "Done. Next steps:"
echo "  npm install helmet cors express-rate-limit zod prom-client swagger-ui-express swagger-jsdoc --save"
echo "  npm run start:logged &"
echo "  curl -s localhost:5000/api/health | jq"
