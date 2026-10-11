const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const Product = require("../models/Product");

// ── GET /api/sales ──
// Query: ?includeCancelled=true ile iptaller de gelir
router.get("/", async (req, res) => {
  try {
    const { includeCancelled, limit } = req.query;
    const filter =
      includeCancelled === "true" ? {} : { cancelled: { $ne: true } };

    let query = Sale.find(filter)
      .populate("product", "name image filament")
      .sort({ saleDate: -1 });
    if (limit) query = query.limit(parseInt(limit));

    const sales = await query;
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/sales/stats ──
// İptal edilenler istatistiklere DAHİL EDİLMEZ
router.get("/stats", async (req, res) => {
  try {
    // Sadece iptal edilmemiş satışlar
    const sales = await Sale.find({ cancelled: { $ne: true } }).lean();

    // ── Genel toplamlar ──
    const totals = {
      revenue: 0,
      profit: 0,
      cost: 0,
      quantity: 0,
      count: sales.length,
    };

    // ── Günlük veri (son 14 gün) ──
    const dailyMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { revenue: 0, profit: 0, cost: 0, count: 0 };
    }

    // ── Aylık veri (son 6 ay) ──
    const monthlyMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { revenue: 0, profit: 0, cost: 0, count: 0 };
    }

    // ── Ürün bazlı ──
    const productMap = {};

    // ── Filament bazlı ──
    const filamentMap = {};

    sales.forEach((s) => {
      totals.revenue += s.totalRevenue || 0;
      totals.profit += s.totalProfit || 0;
      totals.cost += s.totalCost || 0;
      totals.quantity += s.quantity || 0;

      const dayKey = new Date(s.saleDate).toISOString().split("T")[0];
      if (dailyMap[dayKey]) {
        dailyMap[dayKey].revenue += s.totalRevenue || 0;
        dailyMap[dayKey].profit += s.totalProfit || 0;
        dailyMap[dayKey].cost += s.totalCost || 0;
        dailyMap[dayKey].count += s.quantity || 0;
      }

      const sd = new Date(s.saleDate);
      const monthKey = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyMap[monthKey]) {
        monthlyMap[monthKey].revenue += s.totalRevenue || 0;
        monthlyMap[monthKey].profit += s.totalProfit || 0;
        monthlyMap[monthKey].cost += s.totalCost || 0;
        monthlyMap[monthKey].count += s.quantity || 0;
      }

      const pid = String(s.product);
      if (!productMap[pid]) {
        productMap[pid] = {
          productId: pid,
          name: s.productName || "İsimsiz",
          totalQuantity: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalCost: 0,
        };
      }
      productMap[pid].totalQuantity += s.quantity || 0;
      productMap[pid].totalRevenue += s.totalRevenue || 0;
      productMap[pid].totalProfit += s.totalProfit || 0;
      productMap[pid].totalCost += s.totalCost || 0;

      const f = s.filament || "Diğer";
      if (!filamentMap[f]) {
        filamentMap[f] = { quantity: 0, revenue: 0, profit: 0 };
      }
      filamentMap[f].quantity += s.quantity || 0;
      filamentMap[f].revenue += s.totalRevenue || 0;
      filamentMap[f].profit += s.totalProfit || 0;
    });

    const byProduct = Object.values(productMap).sort(
      (a, b) => b.totalProfit - a.totalProfit,
    );
    const byQuantity = Object.values(productMap).sort(
      (a, b) => b.totalQuantity - a.totalQuantity,
    );

    // ── İptal edilen satışlar (bilgi amaçlı) ──
    const cancelledSales = await Sale.find({ cancelled: true }).lean();
    const cancelledTotals = cancelledSales.reduce(
      (acc, s) => {
        acc.count += 1;
        acc.quantity += s.quantity || 0;
        acc.revenue += s.totalRevenue || 0;
        acc.profit += s.totalProfit || 0;
        return acc;
      },
      { count: 0, quantity: 0, revenue: 0, profit: 0 },
    );

    res.json({
      daily: Object.entries(dailyMap).map(([date, val]) => ({
        date,
        label: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
        ...val,
      })),
      monthly: Object.entries(monthlyMap).map(([date, val]) => ({
        date,
        label: `${new Date(date).toLocaleDateString("tr-TR", { month: "short" })}`,
        ...val,
      })),
      byProduct,
      byQuantity,
      byFilament: Object.entries(filamentMap).map(([name, val]) => ({
        name,
        ...val,
      })),
      totals,
      cancelled: cancelledTotals,
    });
  } catch (err) {
    console.error("İstatistik hatası:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/sales ──
router.post("/", async (req, res) => {
  try {
    const { productId, quantity, salePrice, note, saleDate } = req.body;

    if (!productId) return res.status(400).json({ message: "Ürün ID gerekli" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });

    const qty = Math.max(1, parseInt(quantity) || 1);
    const price = parseFloat(salePrice) || product.defaultPrice || 0;
    const unitCost = product.cost || 0;
    const unitProfit = Number((price - unitCost).toFixed(2));

    const sale = new Sale({
      product: product._id,
      productName: product.name,
      filament: product.filament,
      quantity: qty,
      salePrice: price,
      cost: unitCost,
      profit: unitProfit,
      totalRevenue: Number((price * qty).toFixed(2)),
      totalProfit: Number((unitProfit * qty).toFixed(2)),
      totalCost: Number((unitCost * qty).toFixed(2)),
      note: note || "",
      saleDate: saleDate ? new Date(saleDate) : new Date(),
    });

    const saved = await sale.save();
    const populated = await saved.populate("product", "name image filament");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Satış ekleme hatası:", err);
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /api/sales/:id/cancel ── (iptal et / geri al)
router.patch("/:id/cancel", async (req, res) => {
  try {
    const { cancel, reason } = req.body;
    const update = {
      cancelled: !!cancel,
      cancelledAt: cancel ? new Date() : null,
      cancelReason: cancel ? reason || "" : "",
    };

    const sale = await Sale.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).populate("product", "name image filament");

    if (!sale) return res.status(404).json({ message: "Satış bulunamadı" });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/sales/:id ── (kalıcı sil)
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Sale.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Satış bulunamadı" });
    res.json({ message: "Satış kalıcı olarak silindi", id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
