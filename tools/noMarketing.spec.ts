import fs from "fs"; 
import path from "path";

const banned = [/world[-\s]?class/i, /breakthrough/i, /revolutionary/i, /best[-\s]?in[-\s]?class/i];
const allow = [/README|COPY|LICENSE|marketing|docs|\.md$/i];

function files(dir:string, acc:string[]=[]):string[]{ 
  for(const f of fs.readdirSync(dir)){ 
    const p=path.join(dir,f);
    const st=fs.statSync(p); 
    if(st.isDirectory()) files(p,acc); 
    else if(/\.(ts|tsx|js|json)$/.test(p)) acc.push(p);
  } 
  return acc;
}

test("no marketing language in server code/responses", () => {
  if (!fs.existsSync("server")) return;
  for (const f of files("server")) {
    if (allow.some(r=>r.test(f))) continue;
    const t = fs.readFileSync(f,"utf8");
    for (const b of banned) expect(b.test(t)).toBe(false);
  }
});