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

// In-memory store for active socket sessions
const activeSessions = {};

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

  const sessionDir = path.join(__dirname, "auth_info", sessionId);

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

      sock.ev.on("creds.update", saveCreds);

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
  const { to, message } = req.body;

  const s = activeSessions[sessionId];
  if (!s || s.status !== "connected") {
    return res.status(400).json({ error: "WhatsApp account is not connected" });
  }

  try {
    const formattedTo = to.includes("@s.whatsapp.net") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
    const sentMsg = await s.sock.sendMessage(formattedTo, { text: message });
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
  const sessionDir = path.join(__dirname, "auth_info", sessionId);
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch (e) {}

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Engine listening on port ${PORT}`);
});
