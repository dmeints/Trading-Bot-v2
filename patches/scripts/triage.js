const fs = require('fs'); const path = require('path');
const log = path.join('logs','app.log'); const outDir = 'reports';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
const ts = new Date().toISOString().replace(/[:\.]/g,'-');
const out = path.join(outDir, `triage-${ts}.md`);
let data = fs.existsSync(log) ? fs.readFileSync(log,'utf8') : '';
const lines = data.split(/\r?\n/).slice(-5000);
const errors = lines.filter(l => /error|ERR|UnhandledPromiseRejection|uncaught/i.test(l));
const summary = `# Triage Report (${new Date().toISOString()})
- total lines scanned: ${lines.length}
- error lines: ${errors.length}

## Top error signatures
${Object.entries(errors.reduce((a,l)=>{ const sig=l.replace(/\d+/g,'N').slice(0,160); a[sig]=(a[sig]||0)+1; return a;},{}))
  .sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=>`- (${v}) ${k}`).join('\n')}

## Recent errors (tail)
\\`\\`\\`
${errors.slice(-50).join('\n')}
\\`\\`\\`
`;
fs.writeFileSync(out, summary); console.log("Triage written:", out);
