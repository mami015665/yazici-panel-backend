const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ═══════════════════════════════════════════
// 1. MIDDLEWARE (önce bunlar)
// ═══════════════════════════════════════════

// CORS — Express 5 uyumlu
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ═══════════════════════════════════════════
// 2. ROUTES (sonra bunlar)
// ═══════════════════════════════════════════

app.use("/api/products", require("./routes/products"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/images", require("./routes/images"));
app.use("/api/expenses", require("./routes/expenses"));

// ── Health check ──
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ═══════════════════════════════════════════
// 3. ERROR HANDLER
// ═══════════════════════════════════════════

app.use((err, req, res, next) => {
  console.error("Sunucu hatası:", err);
  res.status(500).json({ message: err.message || "Sunucu hatası" });
});

// ═══════════════════════════════════════════
// 4. BAŞLAT
// ═══════════════════════════════════════════

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✓ MongoDB bağlandı");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server çalışıyor: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("✗ MongoDB hatası:", err);
    process.exit(1);
  });
