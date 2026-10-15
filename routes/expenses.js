const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");
// ── GET /api/expenses ──
router.get("/", async (req, res) => {
  try {
    const { category, limit } = req.query;
    const filter = {};
    if (category) filter.category = category;

    let query = Expense.find(filter).sort({ date: -1 });
    if (limit) query = query.limit(parseInt(limit));

    const expenses = await query;
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/expenses/stats ──
router.get("/stats", async (req, res) => {
  try {
    const expenses = await Expense.find().lean();

    const totals = {
      amount: 0,
      count: expenses.length,
    };

    const categoryMap = {};

    const monthlyMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = 0;
    }

    const dailyMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = 0;
    }

    expenses.forEach((e) => {
      totals.amount += e.amount || 0;

      const cat = e.category || "Diğer";
      if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
      categoryMap[cat].amount += e.amount || 0;
      categoryMap[cat].count += 1;

      const ed = new Date(e.date);
      const monthKey = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyMap[monthKey] !== undefined) {
        monthlyMap[monthKey] += e.amount || 0;
      }

      const dayKey = ed.toISOString().split("T")[0];
      if (dailyMap[dayKey] !== undefined) {
        dailyMap[dayKey] += e.amount || 0;
      }
    });

    res.json({
      totals,
      byCategory: Object.entries(categoryMap)
        .map(([name, val]) => ({ name, ...val }))
        .sort((a, b) => b.amount - a.amount),
      monthly: Object.entries(monthlyMap).map(([date, amount]) => ({
        date,
        label: new Date(date + "-01").toLocaleDateString("tr-TR", {
          month: "short",
        }),
        amount,
      })),
      daily: Object.entries(dailyMap).map(([date, amount]) => ({
        date,
        label: `${new Date(date).getDate()}/${new Date(date).getMonth() + 1}`,
        amount,
      })),
    });
  } catch (err) {
    console.error("Gider istatistik hatası:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/expenses ──
router.post("/", async (req, res) => {
  try {
    const { name, category, amount, quantity, date, note } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Gider adı zorunlu" });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: "Tutar girin" });
    }

    const expense = new Expense({
      name: name.trim(),
      category: category || "Diğer",
      amount: parseFloat(amount),
      quantity: parseInt(quantity) || 1,
      date: date ? new Date(date) : new Date(),
      note: note || "",
    });

    const saved = await expense.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Gider ekleme hatası:", err);
    res.status(400).json({ message: err.message });
  }
});

// ── PUT /api/expenses/:id ──
router.put("/:id", async (req, res) => {
  try {
    const { name, category, amount, quantity, date, note } = req.body;

    const update = {
      name: name?.trim(),
      category,
      amount: parseFloat(amount),
      quantity: parseInt(quantity) || 1,
      date: date ? new Date(date) : new Date(),
      note: note || "",
    };

    const updated = await Expense.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ message: "Gider bulunamadı" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/expenses/:id ──
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Gider bulunamadı" });
    res.json({ message: "Gider silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
