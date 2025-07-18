// askGemini.js

require("dotenv").config();
const axios = require("axios");
const { MongoClient } = require("mongodb");

// --- Constants & Configs ---
const API_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI = process.env.MONGODB_URI;

const GEMINI_CHAT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${API_KEY}`;

// --- Embedding Function ---
async function embedText(text) {
  try {
    const res = await axios.post(EMBEDDING_URL, {
      content: { parts: [{ text }] },
    });

    const values = res?.data?.embedding?.values;
    if (!values) {
      console.error("❗ Invalid embedding response:", res?.data);
      throw new Error("Embedding values not found in response.");
    }

    return values;
  } catch (error) {
    console.error("❌ Error during embedding:", error.response?.data || error.message);
    throw new Error("Failed to get embedding.");
  }
}

// --- Vector Search Function ---
async function searchMongo(embedding, topK = 5) {
  const client = new MongoClient(MONGO_URI, { tls: true });

  try {
    await client.connect();
    const collection = client.db("edtech_bot").collection("course_chunks");

    const results = await collection.aggregate([
      {
        $vectorSearch: {
          queryVector: embedding,
          path: "embedding",
          numCandidates: 100,
          limit: topK,
          index: "vector_index",
          similarity: "cosine",
        },
      },
    ]).toArray();

    return results.map(r => r.text);
  } catch (error) {
    console.error("❌ MongoDB search error:", error.message);
    throw new Error("Failed to search embeddings in MongoDB.");
  } finally {
    await client.close();
  }
}

// --- Main RAG Handler ---
async function askGemini(prompt) {
  try {
    const embedding = await embedText(prompt);
    const topChunks = await searchMongo(embedding);
    const context = topChunks.join("\n---\n").slice(0, 9000); // Trim to prevent overflow

    const systemInstruction = `
You are Zakbot, an AI Customer Service Manager for ZAKTOMATE. Your primary role is to assist users with inquiries regarding ZAKTOMATE's products and services: Zakbot (Chatbot), Zakdeck (Content Generator), and OpsMate (Service Plans). You also handle questions about ZAKTOMATE's shared features and overall company information.

Your persona and rules are:
- Helpful and Informative: Provide accurate, concise, and direct answers based on the ZAKTOMATE information you have.
- Problem-Solving: Aim to resolve user queries efficiently. If you don't have enough information, politely ask clarifying questions to guide the user.
- Professional and Friendly: Maintain a polite, approachable, and professional tone.
- Do not over use the symbol ** in your response.
- Focus on ZAKTOMATE: Keep all responses relevant to ZAKTOMATE's offerings. Do not engage in topics outside this scope.
- Prioritize User Needs: Understand the user's intent and provide the most relevant information first.
- Detail-Oriented: When describing features, pricing, or processes, be specific and include all relevant details provided in your knowledge base.
- Maintain Context: Remember previous turns in the conversation to provide coherent and continuous support.
    `.trim();

    const fullPrompt = `${systemInstruction}\n\nHere is some data from the platform:\n${context}\n\nNow answer the user's question:\n${prompt}`;

    const response = await axios.post(GEMINI_CHAT_URL, {
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    });

    const answer = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return answer || "Sorry, I couldn't generate a reply. Please contact support.";
  } catch (error) {
    console.error("❌ Gemini RAG error:", error.response?.data?.error?.message || error.message);
    return "Something went wrong. Please contact support@zaktai.com";
  }
}

module.exports = askGemini;
