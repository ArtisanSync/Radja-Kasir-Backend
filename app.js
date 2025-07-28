import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server is running!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Test route works!",
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/test`);
});

export default app;
