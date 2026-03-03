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

// Initialize Database
const db = new Database("inventory.db");

// Create tables if they don't exist
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

// Ensure proof_image column exists if table was created before
try {
  const tableInfo = db.prepare("PRAGMA table_info(transactions)").all() as any[];
  const hasProofImage = tableInfo.some(col => col.name === 'proof_image');
  if (!hasProofImage) {
    console.log("Adding proof_image column to transactions table...");
    db.prepare("ALTER TABLE transactions ADD COLUMN proof_image TEXT").run();
  }
} catch (e) {
  console.error("Error checking/adding proof_image column:", e);
}

// Seed initial inventory if empty
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

  // Helper to broadcast updates
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

  // --- API Routes ---

  // Get current inventory
  app.get("/api/inventory", (req, res) => {
    const rows = db.prepare("SELECT * FROM inventory").all();
    const inventory = rows.reduce((acc: any, row: any) => {
      acc[row.name] = row.quantity;
      return acc;
    }, {});
    res.json(inventory);
  });

  // Get transaction history
  app.get("/api/history", (req, res) => {
    const rows = db.prepare("SELECT * FROM transactions ORDER BY timestamp DESC").all();
    res.json(rows.map((row: any) => ({
      ...row,
      items: JSON.parse(row.items)
    })));
  });

  // Download database
  app.get("/api/download-db", (req, res) => {
    const dbPath = path.resolve("inventory.db");
    if (fs.existsSync(dbPath)) {
      res.download(dbPath, "inventory.db");
    } else {
      res.status(404).send("Database file not found.");
    }
  });

  // Debug database schema and data
  app.get("/api/debug-db", (req, res) => {
    try {
      const tableInfo = db.prepare("PRAGMA table_info(transactions)").all();
      const lastRows = db.prepare("SELECT id, type, person_name, timestamp, length(proof_image) as img_len FROM transactions ORDER BY timestamp DESC LIMIT 10").all();
      res.json({ tableInfo, lastRows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Borrow items
  app.post("/api/borrow", (req, res) => {
    const { person_name, items, proof_image } = req.body;
    console.log(`[Borrow Request] Name: ${person_name}, Image Length: ${proof_image ? proof_image.length : 0}`);
    
    try {
      const transaction = db.transaction(() => {
        for (const [name, qty] of Object.entries(items)) {
          if ((qty as number) <= 0) continue;
          
          const item = db.prepare("SELECT quantity FROM inventory WHERE name = ?").get(name) as { quantity: number };
          if (!item || item.quantity < (qty as number)) {
            throw new Error(`Stok ${name} tidak mencukupi`);
          }
          
          db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE name = ?").run(qty, name);
        }
        
        db.prepare("INSERT INTO transactions (type, person_name, items, proof_image) VALUES (?, ?, ?, ?)").run(
          'borrow',
          person_name,
          JSON.stringify(items),
          proof_image || null
        );
      });
      
      transaction();
      broadcastUpdates();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Return items
  app.post("/api/return", (req, res) => {
    const { person_name, items } = req.body;
    
    try {
      const transaction = db.transaction(() => {
        for (const [name, qty] of Object.entries(items)) {
          if ((qty as number) <= 0) continue;
          db.prepare("UPDATE inventory SET quantity = quantity + ? WHERE name = ?").run(qty, name);
        }
        
        db.prepare("INSERT INTO transactions (type, person_name, items) VALUES (?, ?, ?)").run(
          'return',
          person_name,
          JSON.stringify(items)
        );
      });
      
      transaction();
      broadcastUpdates();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  // Fallback for SPA
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith('/api')) return next();

    try {
      let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
