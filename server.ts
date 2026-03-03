import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";
import { createServer } from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inisialisasi Database
const db = new Database("inventory.db");

// Bikin tabel kalau belum ada
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    name TEXT PRIMARY KEY,
    quantity INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    person_name TEXT NOT NULL,
    items TEXT NOT NULL,
    proof_image TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Pastikan kolom proof_image ada
try {
  const tableInfo = db.prepare("PRAGMA table_info(transactions)").all() as any[];
  if (!tableInfo.some(col => col.name === 'proof_image')) {
    db.prepare("ALTER TABLE transactions ADD COLUMN proof_image TEXT").run();
  }
} catch (e) {}

// Isi stok awal kalau kosong
const rowCount = db.prepare("SELECT COUNT(*) as count FROM inventory").get() as { count: number };
if (rowCount.count === 0) {
  const insert = db.prepare("INSERT INTO inventory (name, quantity) VALUES (?, ?)");
  insert.run("Kabel Roll", 10);
  insert.run("Speaker", 5);
  insert.run("Spidol", 20);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const broadcastUpdates = () => {
    const invRows = db.prepare("SELECT * FROM inventory").all();
    const inventory = invRows.reduce((acc: any, row: any) => {
      acc[row.name] = row.quantity;
      return acc;
    }, {});
    const histRows = db.prepare("SELECT * FROM transactions ORDER BY timestamp DESC").all();
    const history = histRows.map((row: any) => ({
      ...row,
      items: JSON.parse(row.items)
    }));
    io.emit("data_updated", { inventory, history });
  };

  app.get("/api/inventory", (req, res) => {
    const rows = db.prepare("SELECT * FROM inventory").all();
    const inventory = rows.reduce((acc: any, row: any) => {
      acc[row.name] = row.quantity;
      return acc;
    }, {});
    res.json(inventory);
  });

  app.get("/api/history", (req, res) => {
    const rows = db.prepare("SELECT * FROM transactions ORDER BY timestamp DESC").all();
    res.json(rows.map((row: any) => ({ ...row, items: JSON.parse(row.items) })));
  });

  app.get("/api/download-db", (req, res) => {
    res.download(path.resolve("inventory.db"));
  });

  app.post("/api/borrow", (req, res) => {
    const { person_name, items, proof_image } = req.body;
    try {
      db.transaction(() => {
        for (const [name, qty] of Object.entries(items)) {
          if ((qty as number) <= 0) continue;
          const item = db.prepare("SELECT quantity FROM inventory WHERE name = ?").get(name) as any;
          if (!item || item.quantity < (qty as number)) throw new Error(`Stok ${name} habis!`);
          db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE name = ?").run(qty, name);
        }
        db.prepare("INSERT INTO transactions (type, person_name, items, proof_image) VALUES (?, ?, ?, ?)").run('borrow', person_name, JSON.stringify(items), proof_image || null);
      })();
      broadcastUpdates();
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/return", (req, res) => {
    const { person_name, items } = req.body;
    try {
      db.transaction(() => {
        for (const [name, qty] of Object.entries(items)) {
          if ((qty as number) <= 0) continue;
          db.prepare("UPDATE inventory SET quantity = quantity + ? WHERE name = ?").run(qty, name);
        }
        db.prepare("INSERT INTO transactions (type, person_name, items) VALUES (?, ?, ?)").run('return', person_name, JSON.stringify(items));
      })();
      broadcastUpdates();
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
  app.use("*", async (req, res) => {
    let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
    template = await vite.transformIndexHtml(req.originalUrl, template);
    res.status(200).set({ "Content-Type": "text/html" }).end(template);
  });

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server: http://localhost:${PORT}`));
}

startServer();