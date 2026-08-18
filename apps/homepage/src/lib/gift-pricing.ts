export type GiftQuoteSettings = {
  id: number;
  materialId: string;
  materialName: string;
  materialCategory: string;
  printProcess: string;
  descriptionZh: string | null;
  densityGPerCm3: number;
  materialPricePerG: number;
  surfacePricePerMm2: number;
  minimumPrice: number;
  wasteRate: number;
  marginRate: number;
  leadDays: number | null;
  status: 'active' | 'inactive';
  versionNumber: number;
};

export type GiftQuoteMeasurement = {
  volumeCm3: number;
  surfaceAreaMm2: number;
  scalePercent: number;
};

export type GiftQuoteEstimate = {
  quantity: number;
  weightG: number;
  materialFee: number;
  surfaceFee: number;
  wasteFee: number;
  subtotal: number;
  unitPrice: number;
  totalPrice: number;
  settingsId: number;
  versionNumber: number;
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateGiftQuote(settings: GiftQuoteSettings, measurement: GiftQuoteMeasurement, quantity = 1): GiftQuoteEstimate {
  const safeQuantity = Math.max(1, Math.min(10000, Math.trunc(quantity || 1)));
  const weightG = measurement.volumeCm3 * settings.densityGPerCm3;
  const materialFee = weightG * settings.materialPricePerG;
  const surfaceFee = measurement.surfaceAreaMm2 * settings.surfacePricePerMm2;
  const wasteFee = (materialFee + surfaceFee) * settings.wasteRate;
  const subtotal = materialFee + surfaceFee + wasteFee;
  const unitPrice = Math.max(settings.minimumPrice, subtotal * (1 + settings.marginRate));
  return {
    quantity: safeQuantity,
    weightG: Number(weightG.toFixed(4)),
    materialFee: money(materialFee),
    surfaceFee: money(surfaceFee),
    wasteFee: money(wasteFee),
    subtotal: money(subtotal),
    unitPrice: money(unitPrice),
    totalPrice: money(unitPrice * safeQuantity),
    settingsId: settings.id,
    versionNumber: settings.versionNumber,
  };
}

export function parseGiftQuoteMeasurement(value: unknown): GiftQuoteMeasurement | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const volumeCm3 = Number(input.volumeCm3);
  const surfaceAreaMm2 = Number(input.surfaceAreaMm2);
  const scalePercent = Number(input.scalePercent ?? 100);
  if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0 || volumeCm3 > 1e9) return null;
  if (!Number.isFinite(surfaceAreaMm2) || surfaceAreaMm2 <= 0 || surfaceAreaMm2 > 1e12) return null;
  if (!Number.isInteger(scalePercent) || scalePercent < 10 || scalePercent > 99999) return null;
  return { volumeCm3, surfaceAreaMm2, scalePercent };
}
