import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary in-memory storage for shared files
const sharedContents = new Map<string, { buffer: Buffer, mimetype: string }>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const upload = multer({ storage: multer.memoryStorage() });

  app.use(express.json({ limit: '10mb' }));

  // Web Share Target Handler
  app.post("/share-target", upload.single('receipt'), (req: any, res) => {
    if (!req.file) {
      return res.redirect("/");
    }
    const sharedId = Math.random().toString(36).substring(2, 11);
    sharedContents.set(sharedId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype
    });
    
    // Clean up after 1 minute to avoid memory leaks
    setTimeout(() => sharedContents.delete(sharedId), 60000);
    
    res.redirect(`/?sharedId=${sharedId}`);
  });

  // API to fetch shared data
  app.get("/api/shared/:id", (req, res) => {
    const content = sharedContents.get(req.params.id);
    if (!content) {
      return res.status(404).json({ error: "Content not found or expired" });
    }
    const base64 = content.buffer.toString("base64");
    sharedContents.delete(req.params.id); // One-time use
    res.json({
      base64Data: `data:${content.mimetype};base64,${base64}`,
      mimeType: content.mimetype
    });
  });

  // API Route for AI Parsing
  app.post("/api/parse-receipt", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: "Ekstrak data JSON dari struk ini. Format: {tanggal, waktu, kodeReferensi, bankTujuan, noRekening, namaPenerima, nominal}" },
            {
              inlineData: {
                data: base64Data.split(",")[1],
                mimeType: mimeType
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
        }
      });

      res.json(JSON.parse(result.text || "{}"));
    } catch (error: any) {
      console.error("AI Error:", error);
      res.status(500).json({ error: error.message || "Gagal memproses gambar." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
