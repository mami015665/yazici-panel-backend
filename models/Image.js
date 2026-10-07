const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true }, // binary veri
    contentType: { type: String, required: true }, // "image/jpeg"
    size: { type: Number, required: true }, // byte
    width: { type: Number },
    height: { type: Number },
  },
  { timestamps: true },
);

// Buffer'ı JSON'a çevirirken hariç tut (gereksiz transfer olmasın)
imageSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.data;
    return ret;
  },
});

module.exports = mongoose.model("Image", imageSchema);
