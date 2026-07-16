const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require("@whiskeysockets/baileys");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ENGINE_SECRET = process.env.WHATSAPP_ENGINE_SECRET || "super-engine-secret";
const AUTH_DIR = process.env.WHATSAPP_ENGINE_AUTH_DIR || path.join(__dirname, "auth_info");

// In-memory store for active socket sessions
const activeSessions = {};

const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";

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
      body: JSON.stringify({
        sessionId,
        data: credsData,
      }),
    });

    if (!response.ok) {
      console.error(`[Engine] Failed to sync credentials to DB: ${response.statusText}`);
    } else {
      console.log(`[Engine] Successfully synced credentials to DB for ${sessionId}`);
    }
  } catch (err) {
    console.error(`[Engine] Sync credentials error: ${err.message}`);
  }
}

async function loadCredsFromDatabase(sessionId, sessionDir) {
  try {
    const credsPath = path.join(sessionDir, "creds.json");
    // If already exists locally, don't overwrite
    if (fs.existsSync(credsPath)) return true;

    console.log(`[Engine] Attempting to load credentials from DB for ${sessionId}...`);
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
      console.log(`[Engine] Loaded credentials from DB for ${sessionId}`);
      return true;
    }
  } catch (err) {
    console.error(`[Engine] Load credentials error: ${err.message}`);
  }
  return false;
}

// Authentication Middleware
function authMiddleware(req, res, next) {
  const secret = req.headers["x-engine-secret"];
  if (!secret || secret !== ENGINE_SECRET) {
    return res.status(401).json({ error: "Unauthorized: Invalid Engine Secret" });
  }
  next();
}

app.use(authMiddleware);

// Initialize a session
app.post("/engine/sessions/start", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  // If session already exists and is connected, don't restart
  if (activeSessions[sessionId]) {
    const s = activeSessions[sessionId];
    if (s.status === "connected") {
      return res.json({ sessionId, status: "connected", phoneNumber: s.phoneNumber });
    }
    // Otherwise clean up old socket connection
    try {
      s.sock.ev.removeAllListeners();
      s.sock.end();
    } catch (e) {}
  }

  console.log(`[Engine] Initializing session ${sessionId}`);

  const sessionDir = path.join(AUTH_DIR, sessionId);

  // Clean up directory ONLY on fresh start (not on reconnect)
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.error(`[Engine] Failed to clean auth directory: ${e.message}`);
  }
  fs.mkdirSync(sessionDir, { recursive: true });

  const sessionObj = {
    sessionId,
    sock: null,
    status: "pending",
    qr: null,
    phoneNumber: null,
    expiresAt: Date.now() + 119 * 1000, // Expires in 2 minutes
  };
  activeSessions[sessionId] = sessionObj;

  async function connectSession(isReconnect = false) {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`[Engine] Connecting session ${sessionId} (reconnect: ${isReconnect}) using version ${version.join(".")}`);

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        browser: Browsers.appropriate("Desktop"),
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
          console.log(`[Engine] Connection closed for ${sessionId}. Reconnecting: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => {
              connectSession(true).catch(console.error);
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
          console.log(`[Engine] WhatsApp session ${sessionId} successfully connected as ${sessionObj.phoneNumber}`);
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
            console.log(`[Engine] Incoming message from ${from}: ${message}`);
            const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
            try {
              const response = await fetch(`${dashboardUrl}/api/webhook/whatsapp`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-engine-secret": ENGINE_SECRET,
                },
                body: JSON.stringify({
                  sessionId,
                  from,
                  message,
                  messageId,
                }),
              });
              if (!response.ok) {
                console.error(`[Engine] Webhook forward failed: ${response.statusText}`);
              }
            } catch (err) {
              console.error(`[Engine] Webhook error: ${err.message}`);
            }
          }
        }
      });

    } catch (err) {
      console.error(`[Engine] Error in session ${sessionId}:`, err);
    }
  }

  // Start connection
  await connectSession(false);

  // Give Baileys a moment to emit the QR code before returning
  setTimeout(() => {
    res.json({
      sessionId,
      status: sessionObj.status,
      qrCode: sessionObj.qr,
      expiresAt: new Date(sessionObj.expiresAt).toISOString(),
    });
  }, 1000);
});

// Get session status
app.get("/engine/sessions/:sessionId/status", (req, res) => {
  const { sessionId } = req.params;
  const s = activeSessions[sessionId];
  if (!s) {
    return res.json({ status: "disconnected" });
  }

  // Check if expired
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

// Send message
app.post("/engine/sessions/:sessionId/send", async (req, res) => {
  const { sessionId } = req.params;
  const { to, message, mediaUrl, mediaType } = req.body;

  const s = activeSessions[sessionId];
  if (!s || s.status !== "connected") {
    return res.status(400).json({ error: "WhatsApp account is not connected" });
  }

  try {
    const formattedTo = to.includes("@s.whatsapp.net") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
    let payload = {};

    if (mediaUrl) {
      // Auto-detect media type from file extension if not provided
      let type = mediaType;
      if (!type) {
        const ext = mediaUrl.split('.').pop().toLowerCase().split('?')[0];
        if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
          type = "image";
        } else if (["mp4", "3gp", "m4v", "mov"].includes(ext)) {
          type = "video";
        } else if (["mp3", "ogg", "wav", "m4a"].includes(ext)) {
          type = "audio";
        } else {
          type = "document";
        }
      }

      if (type === "image") {
        payload = { image: { url: mediaUrl }, caption: message };
      } else if (type === "video") {
        payload = { video: { url: mediaUrl }, caption: message };
      } else if (type === "audio") {
        payload = { audio: { url: mediaUrl }, mimetype: "audio/mp4" };
      } else {
        const ext = mediaUrl.split('.').pop().toLowerCase().split('?')[0];
        let mimetype = "application/octet-stream";
        if (ext === "pdf") mimetype = "application/pdf";
        else if (ext === "doc" || ext === "docx") mimetype = "application/msword";
        else if (ext === "xls" || ext === "xlsx") mimetype = "application/vnd.ms-excel";

        payload = { 
          document: { url: mediaUrl }, 
          mimetype, 
          fileName: `File.${ext}`,
          caption: message 
        };
      }
    } else {
      payload = { text: message };
    }

    const sentMsg = await s.sock.sendMessage(formattedTo, payload);
    res.json({
      success: true,
      messageId: sentMsg.key.id,
    });
  } catch (err) {
    console.error(`[Engine] Send error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Disconnect session
app.post("/engine/sessions/:sessionId/disconnect", async (req, res) => {
  const { sessionId } = req.params;
  const s = activeSessions[sessionId];

  if (!s) {
    return res.json({ success: true, message: "Session already inactive" });
  }

  try {
    await s.sock.logout();
    s.sock.end();
  } catch (e) {}

  delete activeSessions[sessionId];
  const sessionDir = path.join(AUTH_DIR, sessionId);
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch (e) {}

  res.json({ success: true });
});

// Function to restore saved sessions on startup
async function restoreSessions() {
  const authRoot = AUTH_DIR;
  if (!fs.existsSync(authRoot)) {
    fs.mkdirSync(authRoot, { recursive: true });
  }

  try {
    let sessionIds = [];

    // 1. Get session IDs from local directory
    const localDirs = fs.readdirSync(authRoot).filter(file => {
      return fs.statSync(path.join(authRoot, file)).isDirectory();
    });
    sessionIds = [...localDirs];

    // 2. Fetch active session IDs from Next.js database list
    console.log(`[Engine] Fetching active sessions from database...`);
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
      console.error(`[Engine] Failed to fetch session list from DB: ${e.message}`);
    }

    console.log(`[Engine] Found ${sessionIds.length} sessions to restore:`, sessionIds);

    for (const sessionId of sessionIds) {
      const sessionDir = path.join(authRoot, sessionId);
      
      // Create session object in memory
      const sessionObj = {
        sessionId,
        sock: null,
        status: "pending",
        qr: null,
        phoneNumber: null,
        expiresAt: null, // Restored sessions don't expire like QR scans
      };
      activeSessions[sessionId] = sessionObj;

      const connect = async (isReconnect = false) => {
        try {
          // Try to load credentials from database if they don't exist locally
          await loadCredsFromDatabase(sessionId, sessionDir);

          const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
          const { version } = await fetchLatestBaileysVersion();
          console.log(`[Engine] Restoring session ${sessionId} (reconnect: ${isReconnect}) using version ${version.join(".")}`);
          
          const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            syncFullHistory: false,
            browser: Browsers.appropriate("Desktop"),
          });

          sessionObj.sock = sock;

          sock.ev.on("creds.update", async () => {
            await saveCreds();
            await saveCredsToDatabase(sessionId, sessionDir);
          });

          sock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
              const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== DisconnectReason.loggedOut;
              console.log(`[Engine] Restored connection closed for ${sessionId}. Reconnecting: ${shouldReconnect}`);
              if (shouldReconnect) {
                setTimeout(() => connect(true).catch(console.error), 3000);
              } else {
                sessionObj.status = "disconnected";
                delete activeSessions[sessionId];
                try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
              }
            } else if (connection === "open") {
              sessionObj.status = "connected";
              sessionObj.phoneNumber = sock.user.id.split(":")[0];
              console.log(`[Engine] Restored session ${sessionId} successfully connected as ${sessionObj.phoneNumber}`);
            }
          });
        } catch (e) {
          console.error(`[Engine] Failed to restore session ${sessionId}:`, e);
        }
      };

      connect(false).catch(console.error);
    }
  } catch (err) {
    console.error("[Engine] Error restoring sessions:", err);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Engine listening on port ${PORT}`);
  restoreSessions().catch(console.error);
});
