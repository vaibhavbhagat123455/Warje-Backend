import express from "express";
import authRoutes from "./routes/index.js";
import profileRoutes from "./api/profile.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "API is running"
  });
});

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);

// Basic root route
app.get("/", (req, res) => {
  res.json({ message: "Warje Police Project API" });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ 
    error: "Not Found",
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ 
    error: "Internal Server Error",
    message: err.message 
  });
});

// Start local server only when not running in production
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server running locally at http://localhost:${PORT}`);
  });
}

// For Vercel deployment: export the app
export default app;