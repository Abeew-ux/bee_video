import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YTDLP = path.join(__dirname, "yt-dlp");

const app = express();
app.use(cors());
app.use(express.json());

// Sert index.html directement depuis ce dossier (pas de sous-dossier public/).
app.use(express.static(__dirname));

const ALLOWED_HOSTS = [
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
];

function isAllowed(url) {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.some((h) => hostname.endsWith(h));
  } catch {
    return false;
  }
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err || `yt-dlp a échoué (code ${code})`));
    });
  });
}

app.post("/api/analyze", async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isAllowed(url)) {
    return res
      .status(400)
      .json({ success: false, message: "Lien non pris en charge." });
  }
  try {
    const raw = await runYtDlp(["-j", "--no-warnings", url]);
    const info = JSON.parse(raw.trim().split("\n")[0]);
    res.json({
      success: true,
      title: info.title || "Vidéo détectée",
      thumbnail: info.thumbnail || null,
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Vidéo non disponible ou lien invalide.",
    });
  }
});

app.post("/api/download", (req, res) => {
  const { url } = req.body || {};
  if (!url || !isAllowed(url)) {
    return res
      .status(400)
      .json({ success: false, message: "Lien non pris en charge." });
  }
  res.json({
    success: true,
    download_url: `/api/file?url=${encodeURIComponent(url)}`,
  });
});

app.get("/api/file", (req, res) => {
  const { url } = req.query;
  if (!url || !isAllowed(url)) return res.status(400).end();

  res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');
  res.setHeader("Content-Type", "video/mp4");

  const proc = spawn(YTDLP, ["-f", "best", "-o", "-", url]);
  proc.stdout.pipe(res);
  proc.on("error", () => res.end());
  proc.stderr.on("data", () => {});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bee Video prêt sur http://localhost:${PORT}`);
});
