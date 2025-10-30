import express from "express";
import authRoutes from "../routes/auth.js";
import profileRoutes from "./profile.js";

const app = express();

// Basic middleware
app.use(express.json());

// Test route to verify API is running
app.get("/api/test", (req, res) => {
  res.json({ status: "API is running" });
});

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);

// Vercel serverless handler
export default async function handler(req, res) {
  return app(req, res);
}
