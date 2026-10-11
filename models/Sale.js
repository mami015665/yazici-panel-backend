const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String, required: true },
    filament: { type: String },

    quantity: { type: Number, required: true, min: 1, default: 1 },
    salePrice: { type: Number, required: true, min: 0 },
    cost: { type: Number, required: true, min: 0 },
    profit: { type: Number, required: true },

    totalRevenue: { type: Number, required: true },
    totalProfit: { type: Number, required: true },
    totalCost: { type: Number, required: true },

    note: { type: String, default: "" },
    saleDate: { type: Date, default: Date.now, index: true },

    // ── YENİ: İptal sistemi ──
    cancelled: { type: Boolean, default: false, index: true },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: "" },
  },
  { timestamps: true },
);

saleSchema.index({ product: 1, saleDate: -1 });

module.exports = mongoose.model("Sale", saleSchema);
