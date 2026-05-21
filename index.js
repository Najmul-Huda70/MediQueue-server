// ==========================================
//TODO 0. IMPORT
// ==========================================
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

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

// global variable define
let tutorsCollection;

// ==========================================
//TODO 2. INDUSTRIAL SECURITY MIDDLEWARES
// ==========================================
app.use(helmet());
app.use(express.json());

// Optimized Cross resources sharing (CORS)
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  "https://medi-queue-app.vercel.app",
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

// DDoS protection
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

async function connectDB() {
  try {
    await client.connect();
    const db = client.db("medidb");
    tutorsCollection = db.collection("tutors");
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

connectDB();

// ==========================================
//TODO 4. APPLICATION ROUTES
// ==========================================

app.get("/", (req, res) => {
  res.send("Hello World!");
});
//GET Route Handler or API Endpoint
app.get("/tutors", async (req, res, next) => {
  //Asynchronous Callback Function
  try {
    //Safety Guard / Early Return ,Fail-Fast Defense / Connection Guard Clause।
    if (!tutorsCollection) {
      return res.status(503).json({
        success: false,
        message: "Database is initializing, try again.",
      });
    }
    const cursor = tutorsCollection.find(); //MongoDB Cursor Optimization
    const result = await cursor.toArray();
    //find() মেথডটি ডাটাবেস থেকে সরাসরি সব ডাটা একসাথে মেমরিতে লোড করে না, বরং একটি Cursor (পয়েন্টার) রিটার্ন করে। পরবর্তীতে .toArray() ব্যবহার করে সেই কার্সার থেকে অ্যাসিনক্রোনাসলি (await দিয়ে) ডেটাগুলোকে জাভাস্ক্রিপ্ট অ্যারেতে কনভার্ট করা হয়।
    res.json(result);
  } catch (error) {
    //Centralized Error Forwarding
    next(error);
  }
});
app.get("/tutors/:id", async (req, res, next) => {
  //Asynchronous Callback Function
  try {
    //Safety Guard / Early Return ,Fail-Fast Defense / Connection Guard Clause।
    if (!tutorsCollection) {
      return res.status(503).json({
        success: false,
        message: "Database is initializing, try again.",
      });
    }
    const { id } = await req.params;
    const query = { _id: new ObjectId(id) };
    const result = await tutorsCollection.findOne(query);
    // findOne(): এই মেথডটির কাজ হলো কালেকশনের ভেতর খোঁজা এবং ফিল্টারের সাথে মিলে যাওয়া প্রথম এবং শুধুমাত্র একটি ডকুমেন্ট রিটার্ন করা।
    res.json(result);
  } catch (error) {
    //Centralized Error Forwarding
    next(error);
  }
});
// ==========================================
// TODO 6. GLOBAL ERROR HANDLING & NOT FOUND (একদম শেষে থাকবে)
// ==========================================

// 404 handler (সব রুটের শেষে থাকতে হবে)
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
