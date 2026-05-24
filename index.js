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
const { success } = require("better-auth");

// ==========================================
//TODO 1. CONFIGURATIONS & INITIALIZATION
// ==========================================
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
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
    bookedCollection = db.collection("booked");
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

connectDB();

// ========================
//TODO 4. VERIFY TOKEN
// ========================
const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorize" });
  }
  // console.log("verify token: ", token);
  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );
    const { payload } = await jwtVerify(token, JWKS);
    // return payload;
    req.user = payload;
    // console.log("req?.user : ", req.user);
    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(401).json({ message: "Unauthorize" });
  }
};
// ==========================================
//TODO 5. APPLICATION ROUTES
// ==========================================

app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.get("/tutors", async (req, res, next) => {
  try {
    //Database connection Guard or Fail-Fast Defense
    if (!tutorsCollection) {
      return res.status(503).json({
        success: false,
        message: "Database is initializing, try again.",
      });
    }

    //Fetching Data from Database
    const cursor = tutorsCollection.find();
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    next(error);
  }
});
app.get("/tutors/:id", verifyToken, async (req, res, next) => {
  try {
    //Database connection Guard or Fail-Fast Defense
    if (!tutorsCollection) {
      return res.status(503).json({
        success: false,
        message: "Database is initializing, try again.",
      });
    }
    const { id } = req.params;
    const query = { _id: new ObjectId(id) };
    console.log("id: ", id);
    //Fetching Data from Database

    const result = await tutorsCollection.findOne(query);

    res.send(result);
  } catch (error) {
    next(error);
  }
});
app.get("/booked", verifyToken, async (req, res, next) => {
  try {
    //Database connection Guard or Fail-Fast Defense
    if (!bookedCollection) {
      return res.status(503).json({
        success: false,
        message: "Database is initializing, try again.",
      });
    }
    const userEmail = req.query.email;
    let query = {};
    if (userEmail) {
      query = { studentEmail: userEmail };
    }
    const cursor = bookedCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
  } catch (error) {
    next(error);
  }
});
app.get("/booked/:id", verifyToken, async (req, res, next) => {
  try {
    //Database connection Guard or Fail-Fast Defense
    if (!bookedCollection) {
      return res.status(503).json({
        success: false,
        message: "Database is initializing, try again.",
      });
    }
    const { id } = req.params;
    // console.log("booked ID: ", id);
    let query = { _id: new ObjectId(id) };
    const cursor = bookedCollection.find(query);
    const result = await cursor.toArray();
    // console.log("booked result: ", result);
    res.send(result);
  } catch (error) {
    next(error);
  }
});
app.patch("/booked/:id", verifyToken, async (req, res, next) => {
  try {
    //Database connection Guard or Fail-Fast Defense
    if (!bookedCollection || !tutorsCollection) {
      return res.status(503).json({
        success: false,
        message: "Database is initializing, try again.",
      });
    }
    const { id } = req.params;
    const bookedData = req.body;
    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Tutor ID format" });
    }
    let query = { _id: new ObjectId(id) };
    console.log("query._id: ", query);
    //tutorsCollection find
    const tutor = await tutorsCollection.findOne(query);
    console.log("tutors: ", tutor);
    if (!tutor) {
      return res
        .status(404)
        .json({ success: false, message: "Tutor not found!" });
    }
    //tutorsCollection Update
    await tutorsCollection.updateOne(query, {
      $inc: { bookedCount: 1 },
      $set: { lastbookedAt: new Date() },
    });
    //bookedCollection Insert
    const result = await bookedCollection.insertOne({
      ...bookedData,
      // tutorId: id,
      bookedAt: new Date(),
    });

    console.log("booked result: ", result);
    res.send(result);
  } catch (error) {
    console.error("Booking error:", error);
    next(error);
  }
});

// ==========================================
// TODO 6. GLOBAL ERROR HANDLING & NOT FOUND
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
