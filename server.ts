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

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
  });

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Web Share Target Handler
  app.post("/share-target", upload.single('receipt'), (req: any, res) => {
    console.log("Receive share-target request");
    if (!req.file) {
      console.log("No file received in share-target");
      return res.redirect("/");
    }
    
    console.log(`File received: ${req.file.originalname}, size: ${req.file.size}`);
    const sharedId = Math.random().toString(36).substring(2, 11);
    sharedContents.set(sharedId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype
    });
    
    // Clean up after 5 minutes to allow more time for app to load and auth
    setTimeout(() => {
      if (sharedContents.has(sharedId)) {
        console.log(`Cleaning up shared content ${sharedId}`);
        sharedContents.delete(sharedId);
      }
    }, 300000);
    
    console.log(`Redirecting to /?sharedId=${sharedId}`);
    res.redirect(303, `/?sharedId=${sharedId}`);
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
