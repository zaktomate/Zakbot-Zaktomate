// server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const askGemini = require("./bot");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const ENV = process.env.ENVIRONMENT || 'local';
const PUBLIC_URL = process.env.PUBLIC_URL;
const MONGO_URI = process.env.MONGODB_URI;

let db, statsCollection;

// Connect to MongoDB
async function connectToDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db("zakbot");
  statsCollection = db.collection("usage_stats");
  console.log("✅ Connected to MongoDB");
}

// Function to update stats
async function updateStats(source = "website") {
  await statsCollection.updateOne(
    { name: "global" },
    {
      $inc: {
        message_count: 1,
        total_time_saved_seconds: 10 // arbitrary time saved per message
      },
      $setOnInsert: {
        created_at: new Date()
      },
      $currentDate: {
        last_updated: true
      }
    },
    { upsert: true }
  );
}

// Shared handler
async function handleMessage(message, source = "website", res) {
  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "Invalid or empty 'message' in request body." });
  }

  console.log(`💬 [${source}] Incoming:`, message);
  const reply = await askGemini(message);

  await updateStats(source);
  res.status(200).json({ reply });
}

// 🌐 Website
app.post("/api/chat", async (req, res) => {
  try {
    await handleMessage(req.body.message, "website", res);
  } catch (err) {
    console.error("❌ Website Handler Error:", err);
    res.status(500).json({ error: "Internal error. Please try again later." });
  }
});

// 🌐 Messenger Webhook
app.post("/webhook/msngr", async (req, res) => {
  try {
    const message = req.body?.entry?.[0]?.messaging?.[0]?.message?.text;
    await handleMessage(message, "messenger", res);
  } catch (err) {
    console.error("❌ Messenger Handler Error:", err);
    res.status(500).json({ error: "Internal error." });
  }
});

// 🌐 WhatsApp Webhook
app.post("/webhook/whatsapp", async (req, res) => {
  try {
    const message = req.body?.messages?.[0]?.text?.body;
    await handleMessage(message, "whatsapp", res);
  } catch (err) {
    console.error("❌ WhatsApp Handler Error:", err);
    res.status(500).json({ error: "Internal error." });
  }
});

// 📊 API to fetch stats for dashboard
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await statsCollection.findOne({ name: "global" }) || {};
    res.status(200).json(stats);
  } catch (err) {
    console.error("❌ Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

// Startup
app.listen(PORT, async () => {
  await connectToDB();
  console.log(`✅ Backend API running on port ${PORT} [${ENV}]`);

  if (ENV === 'local' && PUBLIC_URL) {
    console.log(`🌐 Public URL: ${PUBLIC_URL}/api/chat`);
  }
});
