const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const Image = require("../models/Image");

// Bellekte tut, diske yazma
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB ham yükleme
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Sadece resim dosyaları yüklenebilir."));
    }
    cb(null, true);
  },
});

// ── Görsel yükle ──
// POST /api/images
// Body: multipart/form-data, "image" alanı
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resim bulunamadı" });
    }

    // ── sharp ile optimize et ──
    const optimized = await sharp(req.file.buffer)
      .resize({
        width: 1000,
        height: 1000,
        fit: "inside", // oranı koru
        withoutEnlargement: true, // büyütme
      })
      .jpeg({ quality: 80, progressive: true }) // JPEG, kalite 80
      .toBuffer({ resolveWithObject: true });

    const image = new Image({
      data: optimized.data,
      contentType: "image/jpeg",
      size: optimized.info.size,
      width: optimized.info.width,
      height: optimized.info.height,
    });

    const saved = await image.save();

    res.status(201).json({
      _id: saved._id,
      size: saved.size,
      width: saved.width,
      height: saved.height,
    });
  } catch (err) {
    console.error("Görsel yükleme hatası:", err);
    res.status(400).json({ message: err.message });
  }
});

// ── Görsel getir ──
// GET /api/images/:id
router.get("/:id", async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).json({ message: "Görsel bulunamadı" });

    res.set("Content-Type", image.contentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(image.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Görsel sil ──
router.delete("/:id", async (req, res) => {
  try {
    await Image.findByIdAndDelete(req.params.id);
    res.json({ message: "Görsel silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
