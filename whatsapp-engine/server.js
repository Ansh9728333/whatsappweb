const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const path = require("path");
const fs = require("fs");

dotenv.config();

// ── Structured Logging Utility ────────────────────────────────────────────────
const logger = {
  info: (msg, meta = {}) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "INFO", message: msg, ...meta }));
  },
  warn: (msg, meta = {}) => {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: "WARN", message: msg, ...meta }));
  },
  error: (msg, meta = {}) => {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "ERROR", message: msg, ...meta }));
  }
};

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ENGINE_SECRET = process.env.WHATSAPP_ENGINE_SECRET || "super-engine-secret";
const AUTH_DIR = process.env.WHATSAPP_ENGINE_AUTH_DIR || path.join(__dirname, "auth_info");

// In-memory active socket sessions with message queues
const activeSessions = {};
let dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";

// ── Rate Limiter ──────────────────────────────────────────────────────────────
const requestCounts = {};
setInterval(() => {
  // Clear rate limits every minute
  for (const ip in requestCounts) {
    delete requestCounts[ip];
  }
}, 60000);

function rateLimitMiddleware(req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  requestCounts[ip] = (requestCounts[ip] || 0) + 1;

  if (requestCounts[ip] > 300) { // Limit to 300 API requests per minute per IP
    logger.warn("Rate limit exceeded", { ip });
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }
  next();
}

app.use(rateLimitMiddleware);

// ── Credentials Storage Hooks ─────────────────────────────────────────────────
async function saveCredsToDatabase(sessionId, sessionDir) {
  try {
    const credsPath = path.join(sessionDir, "creds.json");
    if (!fs.existsSync(credsPath)) return;
    const credsData = fs.readFileSync(credsPath, "utf-8");

    const response = await fetch(`${dashboardUrl}/api/webhook/whatsapp/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-secret": ENGINE_SECRET,
      },
      body: JSON.stringify({ sessionId, data: credsData }),
    });

    if (!response.ok) {
      logger.error("Failed to sync credentials to database", { sessionId, status: response.statusText });
    } else {
      logger.info("Successfully synced credentials to database", { sessionId });
    }
  } catch (err) {
    logger.error("Sync credentials error", { sessionId, error: err.message });
  }
}

async function loadCredsFromDatabase(sessionId, sessionDir) {
  try {
    const credsPath = path.join(sessionDir, "creds.json");
    if (fs.existsSync(credsPath)) return true;

    logger.info("Loading credentials from database", { sessionId });
    const response = await fetch(`${dashboardUrl}/api/webhook/whatsapp/session?sessionId=${sessionId}`, {
      method: "GET",
      headers: {
        "x-engine-secret": ENGINE_SECRET,
      },
    });

    if (!response.ok) return false;
    const resData = await response.json();
    if (resData.data) {
      fs.mkdirSync(sessionDir, { recursive: true });
      fs.writeFileSync(credsPath, resData.data, "utf-8");
      logger.info("Successfully restored credentials from database", { sessionId });
      return true;
    }
  } catch (err) {
    logger.error("Load credentials error", { sessionId, error: err.message });
  }
  return false;
}

// ── Authentication Middleware ─────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const secret = req.headers["x-engine-secret"];
  if (!secret || secret !== ENGINE_SECRET) {
    logger.warn("Unauthorized API access attempt");
    return res.status(401).json({ error: "Unauthorized: Invalid Engine Secret" });
  }

  const nextDashboardUrl = req.headers["x-dashboard-url"];
  if (nextDashboardUrl) {
    dashboardUrl = nextDashboardUrl;
  }
  next();
}

app.use(authMiddleware);

// ── Isolated Queue Processing Worker ──────────────────────────────────────────
async function processMessageQueue(sessionId) {
  const session = activeSessions[sessionId];
  if (!session || session.isProcessing) return;

  session.isProcessing = true;
  logger.info("Starting message queue worker", { sessionId });

  while (session.queue.length > 0) {
    const job = session.queue[0];
    let attempts = 0;
    let success = false;
    let result = null;
    let lastError = null;

    logger.info("Processing queue message", { sessionId, to: job.to });

    while (attempts < 2) {
      try {
        if (!session.sock || session.status !== "connected") {
          throw new Error("Connection Closed");
        }
        result = await session.sock.sendMessage(job.to, job.payload);
        success = true;
        break; // Message sent successfully
      } catch (err) {
        attempts++;
        lastError = err;
        const isConnClosed = err.message && (
          err.message.includes("Connection Closed") || 
          err.message.includes("closed") || 
          err.message.includes("not opened")
        );

        if (isConnClosed && attempts < 2) {
          logger.warn("Message sending failed. Waiting for auto-reconnection...", { sessionId, attempt: attempts, error: err.message });
          await new Promise(resolve => setTimeout(resolve, 2500));
        } else {
          break;
        }
      }
    }

    if (success && result) {
      logger.info("Message sent successfully via queue", { sessionId, messageId: result.key.id });
      job.resolve({ success: true, messageId: result.key.id });
    } else {
      logger.error("Message delivery failed in queue after retries", { sessionId, error: lastError?.message });
      job.reject(lastError || new Error("Failed to send message"));
    }

    // Cooldown delay between messages to maintain rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Remove completed job from the queue
    session.queue.shift();
  }

  session.isProcessing = false;
  logger.info("Message queue worker went idle", { sessionId });
}

// ── Connection Manager ────────────────────────────────────────────────────────
async function connectSession(sessionId, isRestore = false) {
  const sessionDir = path.join(AUTH_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  let sessionObj = activeSessions[sessionId];
  if (!sessionObj) {
    sessionObj = {
      sessionId,
      sock: null,
      status: "pending",
      qr: null,
      phoneNumber: null,
      expiresAt: isRestore ? null : (Date.now() + 119 * 1000),
      queue: [],
      isProcessing: false,
    };
    activeSessions[sessionId] = sessionObj;
  } else {
    // Safely tear down existing connection
    if (sessionObj.sock) {
      try {
        sessionObj.sock.ev.removeAllListeners();
        sessionObj.sock.end();
      } catch (e) {}
    }
    sessionObj.status = "pending";
    sessionObj.qr = null;
    if (!isRestore) {
      sessionObj.expiresAt = Date.now() + 119 * 1000;
    }
  }

  const connect = async (isReconnect = false) => {
    try {
      if (isRestore) {
        await loadCredsFromDatabase(sessionId, sessionDir);
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion();
      logger.info("Initiating connection handshake", { sessionId, isReconnect, isRestore });

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        browser: ["Windows", "Chrome", "122.0.0.0"],
      });

      sessionObj.sock = sock;

      sock.ev.on("creds.update", async () => {
        await saveCreds();
        await saveCredsToDatabase(sessionId, sessionDir);
      });

      sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          sessionObj.qr = qr;
          sessionObj.status = "pending";
        }

        if (connection === "close") {
          const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
          logger.warn("WhatsApp connection closed", { sessionId, shouldReconnect, reason: lastDisconnect?.error?.message });

          if (shouldReconnect) {
            setTimeout(() => {
              connect(true).catch(err => logger.error("Reconnection error", { sessionId, error: err.message }));
            }, 3000);
          } else {
            sessionObj.status = "disconnected";
            sessionObj.qr = null;
            sessionObj.phoneNumber = null;
            delete activeSessions[sessionId];
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch (e) {}
          }
        } else if (connection === "open") {
          sessionObj.status = "connected";
          sessionObj.qr = null;
          sessionObj.phoneNumber = sock.user.id.split(":")[0];
          sessionObj.expiresAt = null;
          logger.info("WhatsApp session successfully connected", { sessionId, phone: sessionObj.phoneNumber });

          // Start queue processing if queue has backlog
          processMessageQueue(sessionId).catch(err => logger.error("Worker process error", { sessionId, error: err.message }));
        }
      });

      sock.ev.on("messages.upsert", async (m) => {
        if (m.type !== "notify") return;
        for (const msg of m.messages) {
          if (msg.key.fromMe) continue;

          const from = msg.key.remoteJid;
          const message = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
          const messageId = msg.key.id;

          if (message && from) {
            logger.info("Forwarding incoming webhook message", { sessionId, from });
            try {
              const response = await fetch(`${dashboardUrl}/api/webhook/whatsapp`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-engine-secret": ENGINE_SECRET,
                },
                body: JSON.stringify({ sessionId, from, message, messageId }),
              });
              if (!response.ok) {
                logger.error("Forwarding message webhook failed", { sessionId, status: response.statusText });
              }
            } catch (err) {
              logger.error("Forwarding webhook error", { sessionId, error: err.message });
            }
          }
        }
      });

    } catch (err) {
      logger.error("Connection helper fatal failure", { sessionId, error: err.message });
    }
  };

  await connect(false);
}

// ── HTTP API Routes ───────────────────────────────────────────────────────────

// Initialize/Start a session
app.post("/engine/sessions/start", async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    if (activeSessions[sessionId]) {
      const s = activeSessions[sessionId];
      if (s.status === "connected") {
        return res.json({ sessionId, status: "connected", phoneNumber: s.phoneNumber });
      }
    }

    logger.info("Initializing session setup", { sessionId });
    const sessionDir = path.join(AUTH_DIR, sessionId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (e) {
      logger.error("Auth directory cleanup failure", { sessionId, error: e.message });
    }

    await connectSession(sessionId, false);
    const sessionObj = activeSessions[sessionId];

    setTimeout(() => {
      res.json({
        sessionId,
        status: sessionObj.status,
        qrCode: sessionObj.qr,
        expiresAt: sessionObj.expiresAt ? new Date(sessionObj.expiresAt).toISOString() : null,
      });
    }, 1000);
  } catch (err) {
    next(err);
  }
});

// Fetch session status
app.get("/engine/sessions/:sessionId/status", (req, res) => {
  const { sessionId } = req.params;
  const s = activeSessions[sessionId];
  if (!s) {
    return res.json({ status: "disconnected" });
  }

  if (s.status === "pending" && s.expiresAt && Date.now() > s.expiresAt) {
    s.status = "expired";
    s.qr = null;
    try {
      s.sock.end();
    } catch (e) {}
    delete activeSessions[sessionId];
    return res.json({ status: "expired" });
  }

  res.json({
    status: s.status,
    qrCode: s.qr,
    phoneNumber: s.phoneNumber,
  });
});

// Enqueue message send
app.post("/engine/sessions/:sessionId/send", (req, res, next) => {
  const { sessionId } = req.params;
  const { to, message, mediaUrl, mediaType } = req.body;

  const s = activeSessions[sessionId];
  if (!s || s.status !== "connected") {
    return res.status(400).json({ error: "WhatsApp account is not connected" });
  }

  // 1. Resolve payloads
  const formattedTo = to.includes("@s.whatsapp.net") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
  let payload = {};

  (async () => {
    if (mediaUrl) {
      let type = mediaType;
      let detectedFilename = "file";
      let detectedMimetype = "application/octet-stream";

      try {
        const headRes = await fetch(mediaUrl, { method: "HEAD" });
        if (headRes.ok) {
          const contentType = headRes.headers.get("content-type");
          if (contentType) {
            detectedMimetype = contentType.split(";")[0].trim();
            if (detectedMimetype.startsWith("image/")) type = "image";
            else if (detectedMimetype.startsWith("video/")) type = "video";
            else if (detectedMimetype.startsWith("audio/")) type = "audio";
            else if (!type || type === "text") type = "document";
          }
          const contentDisp = headRes.headers.get("content-disposition");
          if (contentDisp) {
            const filenameMatch = contentDisp.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
              detectedFilename = filenameMatch[1];
            }
          }
        }
      } catch (e) {
        logger.warn("HEAD request failed for media URL", { mediaUrl, error: e.message });
      }

      if (!type) {
        const ext = mediaUrl.split('.').pop().toLowerCase().split('?')[0];
        if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) type = "image";
        else if (["mp4", "3gp", "m4v", "mov"].includes(ext)) type = "video";
        else if (["mp3", "ogg", "wav", "m4a"].includes(ext)) type = "audio";
        else type = "document";
      }

      if (detectedFilename === "file") {
        const ext = mediaUrl.split('.').pop().toLowerCase().split('?')[0];
        if (ext && ext.length <= 4 && !ext.includes("/")) {
          detectedFilename = `attachment.${ext}`;
        } else {
          const defaultExtensions = { image: "jpg", video: "mp4", audio: "mp3", document: "pdf" };
          detectedFilename = `attachment.${defaultExtensions[type] || "bin"}`;
        }
      }

      const lowerFilename = detectedFilename.toLowerCase();
      if (lowerFilename.endsWith(".pdf")) detectedMimetype = "application/pdf";
      else if (lowerFilename.endsWith(".png")) detectedMimetype = "image/png";
      else if (lowerFilename.endsWith(".jpg") || lowerFilename.endsWith(".jpeg")) detectedMimetype = "image/jpeg";
      else if (lowerFilename.endsWith(".docx")) detectedMimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (lowerFilename.endsWith(".xlsx")) detectedMimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      if (detectedMimetype === "application/pdf" && !lowerFilename.endsWith(".pdf")) detectedFilename = `${detectedFilename}.pdf`;
      else if (detectedMimetype === "image/png" && !lowerFilename.endsWith(".png")) detectedFilename = `${detectedFilename}.png`;
      else if (detectedMimetype === "image/jpeg" && !lowerFilename.endsWith(".jpg") && !lowerFilename.endsWith(".jpeg")) detectedFilename = `${detectedFilename}.jpg`;

      if (type === "image") payload = { image: { url: mediaUrl }, caption: message };
      else if (type === "video") payload = { video: { url: mediaUrl }, caption: message };
      else if (type === "audio") payload = { audio: { url: mediaUrl }, mimetype: "audio/mp4" };
      else payload = { document: { url: mediaUrl }, mimetype: detectedMimetype, fileName: detectedFilename, caption: message };
    } else {
      payload = { text: message };
    }

    // 2. Add send task to the session's isolated memory queue
    return new Promise((resolve, reject) => {
      s.queue.push({ to: formattedTo, payload, resolve, reject });
      logger.info("Enqueued message task", { sessionId, to: formattedTo });
      processMessageQueue(sessionId).catch(next);
    });
  })()
  .then((queueRes) => {
    res.json(queueRes);
  })
  .catch((err) => {
    logger.error("API send handler failure", { sessionId, error: err.message });
    res.status(500).json({ error: err.message });
  });
});

// Restore credentials session (self-healing)
app.post("/engine/sessions/:sessionId/restore", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: "Missing session credentials data" });
    }

    logger.info("On-demand session restore triggered", { sessionId });
    const sessionDir = path.join(AUTH_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const credsPath = path.join(sessionDir, "creds.json");
    fs.writeFileSync(credsPath, data, "utf-8");

    await connectSession(sessionId, true);
    res.json({ success: true, message: "Session restore triggered successfully" });
  } catch (err) {
    next(err);
  }
});

// Safe Disconnect Session & File cleanup
app.post("/engine/sessions/:sessionId/disconnect", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const s = activeSessions[sessionId];

    if (!s) {
      return res.json({ success: true, message: "Session already inactive" });
    }

    logger.info("Explicit session disconnect triggered", { sessionId });
    try {
      s.sock.ev.removeAllListeners();
      await s.sock.logout();
      s.sock.end();
    } catch (e) {}

    delete activeSessions[sessionId];
    const sessionDir = path.join(AUTH_DIR, sessionId);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (e) {}

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Centralized Error Handling Middleware ─────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error("Unhandled exception caught by middleware", {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// Restore saved sessions on startup
async function restoreSessions() {
  const authRoot = AUTH_DIR;
  if (!fs.existsSync(authRoot)) {
    fs.mkdirSync(authRoot, { recursive: true });
  }

  try {
    let sessionIds = [];

    // Get directories from local auth folder
    const localDirs = fs.readdirSync(authRoot).filter(file => {
      return fs.statSync(path.join(authRoot, file)).isDirectory();
    });
    sessionIds = [...localDirs];

    // Fetch from dashboard DB list
    logger.info("Fetching active sessions from database list for restore...");
    try {
      const response = await fetch(`${dashboardUrl}/api/webhook/whatsapp/session`, {
        method: "GET",
        headers: { "x-engine-secret": ENGINE_SECRET },
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.sessions && Array.isArray(resData.sessions)) {
          for (const sid of resData.sessions) {
            if (!sessionIds.includes(sid)) {
              sessionIds.push(sid);
            }
          }
        }
      }
    } catch (e) {
      logger.error("Failed to fetch session list from database during startup", { error: e.message });
    }

    logger.info("Starting restoration of saved sessions", { count: sessionIds.length, sessions: sessionIds });

    for (const sessionId of sessionIds) {
      connectSession(sessionId, true).catch(err => {
        logger.error("Failed to restore session on startup", { sessionId, error: err.message });
      });
    }
  } catch (err) {
    logger.error("Startup session restoration fatal error", { error: err.message });
  }
}

app.listen(PORT, () => {
  logger.info(`🚀 WhatsApp Engine server online on port ${PORT}`);
  logger.info("Waiting 15 seconds for deploy rolling cleanup before restoring sessions...");
  setTimeout(() => {
    restoreSessions().catch(err => logger.error("Post-startup restore failure", { error: err.message }));
  }, 15000);
});
