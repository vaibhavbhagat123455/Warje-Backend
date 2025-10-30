import express from "express";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./api/profile.js";

const app = express();

app.use(express.json());

// mount routes under /api/auth
app.use("/api/auth", authRoutes);

// mount profile route at /api/profile
app.use("/api/profile", profileRoutes);

// Basic root route
app.get("/", (req, res) => {
  res.send("Node js server is running");
});

// Start local server only when not running in production (Vercel will import the app)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running locally at http://localhost:${PORT}`);
  });
}

// Export the app for Vercel serverless runtime
export default app;