import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary in-memory storage for shared files/text
const sharedContents = new Map<string, { buffer?: Buffer, mimetype?: string, text?: string }>();

// Track pending requests to avoid race conditions
const pendingRequests = new Map<string, Promise<any>>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
  });

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Web Share Target Handler - Enhanced
  app.all("/share-receiver", (req, res, next) => {
    console.log(`[SHARE] Hit: ${req.method} ${req.url}`);
    console.log(`[SHARE] Headers:`, req.headers);
    
    if (req.method === 'GET') {
      return res.redirect("/");
    }
    next();
  }, upload.fields([
    { name: 'receipt', maxCount: 1 }, 
    { name: 'files', maxCount: 1 }, 
    { name: 'file', maxCount: 1 }, 
    { name: 'image', maxCount: 1 }
  ]), (req: any, res) => {
    console.log("[SHARE] Processing payload...");
    console.log("[SHARE] Body keys:", Object.keys(req.body || {}));
    console.log("[SHARE] Files:", req.files ? Object.keys(req.files) : 'none');
    
    try {
      // Find the file or text in any of the possible fields
      const file = req.files?.receipt?.[0] || req.files?.files?.[0] || req.files?.file?.[0] || req.files?.image?.[0];
      const sharedText = req.body.text || req.body.title || req.body.url;

      if (!file && !sharedText) {
        console.log("[SHARE] Empty payload received. Body keys:", Object.keys(req.body || {}));
        console.log("[SHARE] Redirecting to home (empty payload)");
        return res.redirect("/");
      }
      
      const sharedId = Math.random().toString(36).substring(2, 11);
      console.log(`[SHARE] Generated ID: ${sharedId}`);
      
      if (file) {
        console.log(`[SHARE] Received file: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`);
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
      
      // Store with 5-minute expiry instead of 5 minutes
      const timeoutHandle = setTimeout(() => {
        console.log(`[SHARE] Expiring shared content: ${sharedId}`);
        sharedContents.delete(sharedId);
        pendingRequests.delete(sharedId);
      }, 300000);

      // Store timeout handle for potential cleanup
      if (!sharedContents.has(sharedId)) {
        sharedContents.set(sharedId, { text: sharedText });
      }
      
      console.log(`[SHARE] Redirecting to /?sharedId=${sharedId}`);
      // Use 303 See Other for POST-to-GET redirect (better for browser behavior)
      res.redirect(303, `/?sharedId=${sharedId}`);
    } catch (error) {
      console.error("[SHARE] Error processing share:", error);
      res.status(500).json({ error: "Failed to process share" });
    }
  });

  // API to fetch shared data - Enhanced with better error handling
  app.get("/api/shared/:id", async (req, res) => {
    const { id } = req.params;
    console.log(`[API] Fetching shared content: ${id}`);
    
    try {
      // Check if request is already pending
      if (pendingRequests.has(id)) {
        console.log(`[API] Request already pending for: ${id}`);
        await pendingRequests.get(id);
      }

      const content = sharedContents.get(id);
      if (!content) {
        console.log(`[API] Content not found or expired: ${id}`);
        return res.status(404).json({ 
          error: "Content not found or expired",
          id: id
        });
      }
      
      const responseData: any = {};
      if (content.buffer && content.mimetype) {
        const base64 = content.buffer.toString("base64");
        responseData.base64Data = `data:${content.mimetype};base64,${base64}`;
        responseData.mimeType = content.mimetype;
        responseData.type = 'image';
        console.log(`[API] Sending image: ${content.mimetype}`);
      } else if (content.text) {
        responseData.text = content.text;
        responseData.type = 'text';
        console.log(`[API] Sending text`);
      }

      // Set proper headers for caching
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      // One-time use - delete after retrieval
      sharedContents.delete(id);
      pendingRequests.delete(id);
      
      res.json(responseData);
    } catch (error) {
      console.error(`[API] Error fetching shared content ${id}:`, error);
      res.status(500).json({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
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
    console.log(`Share receiver endpoint: http://localhost:${PORT}/share-receiver`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
