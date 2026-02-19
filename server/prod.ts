import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { app } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.WEB_PORT || 5173);

// Serve built frontend
const distDir = path.resolve(__dirname, "../dist");
app.use(express.static(distDir));

// SPA fallback
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`payphone listening on http://0.0.0.0:${port}`);
});
