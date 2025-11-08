import express from "express";
import apiRoutes from "./routes/index.js";
import dotenv from "dotenv";
import { apiKeyGuard } from "./apiKeyGuard.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api", apiRoutes, apiRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Warje Police Project API" });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.url}`,
  });
});


app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server running locally at http://localhost:${PORT}`);
  });
}

export default app;
