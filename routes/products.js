const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Image = require("../models/Image");
const { calculateCost } = require("../utils/costCalculator");

// ── Multer: bellekte tut ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Sadece resim dosyaları yüklenebilir."));
    }
    cb(null, true);
  },
});

// ── Yardımcı: body temizle ──
function parseProductBody(body) {
  const num = (v) =>
    v === "" || v === undefined || v === null ? 0 : parseFloat(v) || 0;
  return {
    name: body.name?.trim(),
    filament: body.filament,
    filamentBrand: body.filamentBrand || "",
    filamentUsed: num(body.filamentUsed),
    filamentPrice: num(body.filamentPrice),
    printTime: num(body.printTime),
    electricityKw: num(body.electricityKw),
    electricityPrice: num(body.electricityPrice),
    defaultPrice: num(body.defaultPrice),
    notes: body.notes || "",
  };
}

// ── Yardımcı: görseli optimize et + kaydet ──
async function saveOptimizedImage(fileBuffer) {
  const optimized = await sharp(fileBuffer)
    .resize({
      width: 1000,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer({ resolveWithObject: true });

  const image = new Image({
    data: optimized.data,
    contentType: "image/jpeg",
    size: optimized.info.size,
    width: optimized.info.width,
    height: optimized.info.height,
  });

  return await image.save();
}

// ═══════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════

// ── GET /api/products ──
router.get("/", async (req, res) => {
  try {
    const { includeArchived } = req.query;
    const filter =
      includeArchived === "true" ? {} : { archived: { $ne: true } };
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/archived/list ──
router.get("/archived/list", async (req, res) => {
  try {
    const products = await Product.find({ archived: true }).sort({
      archivedAt: -1,
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/:id ──
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });

    const salesCount = await Sale.countDocuments({ product: product._id });
    const totalQuantity = await Sale.aggregate([
      { $match: { product: product._id } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);

    res.json({
      ...product.toObject(),
      salesInfo: {
        salesCount,
        totalQuantity: totalQuantity[0]?.total || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/products ──
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const data = parseProductBody(req.body);
    if (!data.name)
      return res.status(400).json({ message: "Ürün adı zorunlu" });
    if (!data.filament)
      return res.status(400).json({ message: "Filament türü zorunlu" });

    const cost = calculateCost(data);

    // Görsel varsa önce kaydet
    let imageId = null;
    if (req.file) {
      const img = await saveOptimizedImage(req.file.buffer);
      imageId = img._id;
    }

    const product = new Product({
      ...data,
      cost,
      image: imageId,
    });
    const saved = await product.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Ürün ekleme hatası:", err);
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/products/:id ──
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const data = parseProductBody(req.body);
    const cost = calculateCost(data);

    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Ürün bulunamadı" });

    const update = { ...data, cost };

    // Yeni görsel varsa: eskiyi sil, yenisini kaydet
    if (req.file) {
      const oldImageId = existing.image;
      const img = await saveOptimizedImage(req.file.buffer);
      update.image = img._id;

      // Eski görseli sil (varsa)
      if (oldImageId) {
        await Image.findByIdAndDelete(oldImageId).catch(() => {});
      }
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    res.json(updated);
  } catch (err) {
    console.error("Ürün güncelleme hatası:", err);
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/products/:id/archive ──
router.patch("/:id/archive", async (req, res) => {
  try {
    const { archived } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        archived: !!archived,
        archivedAt: archived ? new Date() : null,
      },
      { new: true },
    );
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/products/:id/sales-count ──
router.get("/:id/sales-count", async (req, res) => {
  try {
    const salesCount = await Sale.countDocuments({ product: req.params.id });
    const agg = await Sale.aggregate([
      {
        $match: {
          product: new mongoose.Types.ObjectId(req.params.id),
        },
      },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);
    res.json({ salesCount, totalQuantity: agg[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/products/:id ──
router.delete("/:id", async (req, res) => {
  try {
    const { cascade } = req.query;
    const saleCount = await Sale.countDocuments({ product: req.params.id });

    if (saleCount > 0 && cascade !== "true") {
      return res.status(409).json({
        message: `Bu ürüne ait ${saleCount} satış kaydı var.`,
        code: "HAS_SALES",
        salesCount: saleCount,
      });
    }

    let deletedSales = 0;
    if (cascade === "true") {
      const result = await Sale.deleteMany({ product: req.params.id });
      deletedSales = result.deletedCount;
    }

    // Ürünün görselini de sil
    const product = await Product.findById(req.params.id);
    if (product?.image) {
      await Image.findByIdAndDelete(product.image).catch(() => {});
    }

    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Ürün bulunamadı" });

    res.json({
      message: "Ürün silindi",
      id: req.params.id,
      deletedSales,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
