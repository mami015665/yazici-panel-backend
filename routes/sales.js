const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const Product = require("../models/Product");

// Tüm satışlar
router.get("/", async (req, res) => {
  try {
    const sales = await Sale.find().populate("product").sort({ saleDate: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Satış istatistikleri
router.get("/stats", async (req, res) => {
  try {
    const sales = await Sale.find();

    // Günlük veri (son 14 gün)
    const dailyMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { revenue: 0, profit: 0, cost: 0, count: 0 };
    }
    sales.forEach((s) => {
      const key = new Date(s.saleDate).toISOString().split("T")[0];
      if (dailyMap[key]) {
        dailyMap[key].revenue += s.totalRevenue;
        dailyMap[key].profit += s.totalProfit;
        dailyMap[key].cost += s.totalCost;
        dailyMap[key].count += s.quantity;
      }
    });

    // Ürün bazlı istatistik
    const productMap = {};
    sales.forEach((s) => {
      const id = s.product._id
        ? s.product._id.toString()
        : s.product.toString();
      if (!productMap[id]) {
        productMap[id] = {
          productId: id,
          name: s.productName,
          totalQuantity: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalCost: 0,
        };
      }
      productMap[id].totalQuantity += s.quantity;
      productMap[id].totalRevenue += s.totalRevenue;
      productMap[id].totalProfit += s.totalProfit;
      productMap[id].totalCost += s.totalCost;
    });

    res.json({
      daily: Object.entries(dailyMap).map(([date, val]) => ({
        date,
        label: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
        ...val,
      })),
      byProduct: Object.values(productMap).sort(
        (a, b) => b.totalQuantity - a.totalQuantity,
      ),
      totals: {
        revenue: sales.reduce((s, x) => s + x.totalRevenue, 0),
        profit: sales.reduce((s, x) => s + x.totalProfit, 0),
        cost: sales.reduce((s, x) => s + x.totalCost, 0),
        quantity: sales.reduce((s, x) => s + x.quantity, 0),
        count: sales.length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Satış ekle
router.post("/", async (req, res) => {
  try {
    const { productId, quantity, salePrice, note, saleDate } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });

    const qty = parseInt(quantity) || 1;
    const price = parseFloat(salePrice) || product.defaultPrice;
    const cost = product.cost || 0;
    const profit = price - cost;

    const sale = new Sale({
      product: productId,
      productName: product.name,
      quantity: qty,
      salePrice: price,
      cost,
      profit,
      totalRevenue: price * qty,
      totalProfit: profit * qty,
      totalCost: cost * qty,
      filament: product.filament,
      note,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
    });

    const saved = await sale.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("HATA:", err.message);
    res.status(400).json({ message: err.message });
  }
});

// Satış sil
router.delete("/:id", async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: "Satış silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
