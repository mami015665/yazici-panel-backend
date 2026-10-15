const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["Alet", "Sarf Malzeme", "Filament", "Elektrik", "Kargo", "Diğer"],
      default: "Diğer",
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 1, min: 1 },
    date: { type: Date, default: Date.now, index: true },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

expenseSchema.index({ date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
