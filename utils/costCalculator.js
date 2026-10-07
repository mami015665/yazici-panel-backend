/**
 * Ürün maliyetini hesaplar.
 * @param {Object} data - { filamentUsed, filamentPrice, printTime, electricityKw, electricityPrice }
 * @returns {number} Toplam maliyet (₺)
 */
function calculateCost(data) {
  const used = parseFloat(data.filamentUsed) || 0; // gram
  const fPrice = parseFloat(data.filamentPrice) || 0; // ₺/kg
  const time = parseFloat(data.printTime) || 0; // saat
  const kw = parseFloat(data.electricityKw) || 0;
  const ePrice = parseFloat(data.electricityPrice) || 0;

  const filamentCost = (used / 1000) * fPrice;
  const electricityCost = time * kw * ePrice;

  return Number((filamentCost + electricityCost).toFixed(2));
}

module.exports = { calculateCost };
