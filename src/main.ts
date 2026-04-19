import express from "express";

const app = express();
const PORT = 8001;

app.get("/", (req, res) => {
  res.send("Hello, Express + TypeScript!");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});