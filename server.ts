import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary in-memory storage for shared files/text
const sharedContents = new Map<string, { buffer?: Buffer, mimetype?: string, text?: string }>();

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
  app.all("/share-receiver", (req, res, next) => {
    console.log(`[SHARE] Hit: ${req.method} ${req.url}`);
    if (req.method === 'GET') {
      return res.redirect("/");
    }
    next();
  }, upload.fields([{ name: 'receipt', maxCount: 1 }, { name: 'files', maxCount: 1 }, { name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]), (req: any, res) => {
    console.log("[SHARE] Processing payload...");
    
    // Find the file or text in any of the possible fields
    const file = req.files?.receipt?.[0] || req.files?.files?.[0] || req.files?.file?.[0] || req.files?.image?.[0];
    const sharedText = req.body.text || req.body.title || req.body.url;

    if (!file && !sharedText) {
      console.log("[SHARE] Empty payload received. Body keys:", Object.keys(req.body || {}));
      return res.redirect("/");
    }
    
    const sharedId = Math.random().toString(36).substring(2, 11);
    
    if (file) {
      console.log(`[SHARE] Received file: ${file.originalname} (${file.mimetype})`);
      sharedContents.set(sharedId, {
        buffer: file.buffer,
        mimetype: file.mimetype
      });
    } else if (sharedText) {
      console.log(`[SHARE] Received text/url: ${sharedText.substring(0, 50)}...`);
      sharedContents.set(sharedId, {
        text: sharedText
      });
    }
    
    setTimeout(() => sharedContents.delete(sharedId), 300000);
    res.redirect(303, `/?sharedId=${sharedId}`);
  });

  // API to fetch shared data
  app.get("/api/shared/:id", (req, res) => {
    const content = sharedContents.get(req.params.id);
    if (!content) {
      return res.status(404).json({ error: "Content not found or expired" });
    }
    
    const responseData: any = {};
    if (content.buffer && content.mimetype) {
      const base64 = content.buffer.toString("base64");
      responseData.base64Data = `data:${content.mimetype};base64,${base64}`;
      responseData.mimeType = content.mimetype;
      responseData.type = 'image';
    } else if (content.text) {
      responseData.text = content.text;
      responseData.type = 'text';
    }

    sharedContents.delete(req.params.id); // One-time use
    res.json(responseData);
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
