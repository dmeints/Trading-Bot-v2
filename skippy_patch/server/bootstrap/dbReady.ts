export async function dbReady() {
  const url = process.env.DATABASE_URL || "";
  try {
    if (!url) return { ok: true };

    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      const { Pool } = require("pg");
      const pool = new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 3000, connectionTimeoutMillis: 3000 });
      const { rows } = await pool.query("SELECT 1");
      await pool.end();
      return { ok: rows?.length >= 0, driver: "pg" };
    }

    if (url.startsWith("mysql://") || url.startsWith("mysql2://")) {
      const mysql = require("mysql2/promise");
      const conn = await mysql.createConnection(url.replace("mysql2://","mysql://"));
      const [rows] = await conn.query("SELECT 1 AS ok");
      await conn.end();
      return { ok: Array.isArray(rows), driver: "mysql2" };
    }

    if (url.startsWith("file:") || url.endsWith(".sqlite") || url.endsWith(".db")) {
      try {
        const Database = require("better-sqlite3");
        const db = new Database(url.replace("file:",""));
        db.prepare("SELECT 1").get();
        db.close();
        return { ok: true, driver: "better-sqlite3" };
      } catch {
        const sqlite3 = require("sqlite3").verbose();
        const path = url.replace("file:","");
        const db = new sqlite3.Database(path);
        await new Promise((resolve, reject) => {
          db.get("SELECT 1", (err) => err ? reject(err) : resolve(null));
        });
        db.close();
        return { ok: true, driver: "sqlite3" };
      }
    }

    return { ok: true, driver: "unknown" };
  } catch (e:any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

if (require.main === module) {
  (async () => {
    const res = await dbReady();
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.ok ? 0 : 1);
  })();
}
