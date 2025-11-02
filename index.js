const express = require("express");
const dotenv = require("dotenv");
const authRoutes = require("./routes/index.js");

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// Mount routes
app.use("/routes", authRoutes);

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

// For Vercel deployment
module.exports = app;
