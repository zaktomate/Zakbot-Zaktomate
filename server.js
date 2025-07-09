// server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const askGemini = require("./bot");

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
      console.warn("❗ Empty or invalid message received:", req.body);
      return res.status(400).json({ error: "Invalid or empty 'message' in request body." });
    }

    console.log("💬 Incoming:", userMessage);
    const reply = await askGemini(userMessage);
    res.status(200).json({ reply });
  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ error: "Internal error. Please try again later." });
  }
});

// Server startup
const PORT = process.env.PORT || 3000;
const ENV = process.env.ENVIRONMENT || 'local';
const PUBLIC_URL = process.env.PUBLIC_URL;

app.listen(PORT, () => {
  console.log(`✅ Backend API running on port ${PORT} [${ENV}]`);

  if (ENV === 'local' && PUBLIC_URL) {
    console.log(`🌐 Public URL (via Cloudflare Tunnel): ${PUBLIC_URL}/api/chat`);
  }
  
  if (ENV === 'production') {
    console.log(`🌐 Running in production mode.`);
  }
});

