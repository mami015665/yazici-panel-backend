const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    filament: { type: String, required: true },
    filamentBrand: { type: String, default: "" },

    filamentUsed: { type: Number, default: 0 },
    filamentPrice: { type: Number, default: 0 },
    printTime: { type: Number, default: 0 },
    electricityKw: { type: Number, default: 0 },
    electricityPrice: { type: Number, default: 0 },

    cost: { type: Number, default: 0, min: 0 },
    defaultPrice: { type: Number, required: true, min: 0 },

    // ── GÖRSEL: Artık bir ID ──
    image: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Image",
      default: null,
    },
    notes: { type: String, default: "" },

    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

productSchema.virtual("defaultProfit").get(function () {
  return (this.defaultPrice || 0) - (this.cost || 0);
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
