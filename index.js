// ==========================================
//TODO 0.IMPORT
// ==========================================
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const helmet = require("helmet"); //security injection protection
const rateLimit = require("express-rate-limit"); // brute force or spaming attack off
// ==========================================
//TODO 1. CONFIGURATIONS & INITIALIZATION
// ==========================================
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const JWKS = `${process.env.CLIENT_URL}/api/auth/jwks`;
if (!MONGODB_URI) {
  console.error("CRITICAL ERROR: MONGODB_URI is not defined in .env file.");
  process.exit(1);
}
// ==========================================
//TODO 2. INDUSTRIAL SECURITY MIDDLEWARES
// ==========================================
app.use(helmet()); // security header set
app.use(express.json());

// Optimized Cross resurces sharing (CORS)
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  "https://medi-queue-app.vercel.app", //frontend URL
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS Security Policy"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

// DDoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);
// ==================================================
//TODO 3. DATABASE CONNECTION (Singleton Pattern)
// ==================================================
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    const db = client.db("medidb");
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});
// ==========================================
// 6. GLOBAL ERROR HANDLING & NOT FOUND
// ==========================================

// 404 handler
app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: "Requested resource route not found." });
});

// Global Centralized Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Caught:", err.stack);
  res.status(500).json({
    success: false,
    message: err.message || "A critical server error occurred.",
  });
});
// ==========================================
//TODO 7. SERVER LISTENER
// ==========================================
app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
