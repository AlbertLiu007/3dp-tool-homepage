import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { databasePool, GiftAccessError, type GiftEmployeeAccess } from '@/lib/gift-db';
import { calculateGiftQuote, type GiftQuoteSettings } from '@/lib/gift-pricing';

function toSettings(row: RowDataPacket): GiftQuoteSettings {
  return {
    id: Number(row.id), materialId: String(row.material_id), materialName: String(row.material_name),
    materialCategory: String(row.material_category || ''), printProcess: String(row.print_process || ''),
    descriptionZh: row.description_zh ? String(row.description_zh) : null,
    densityGPerCm3: Number(row.density_g_cm3), materialPricePerG: Number(row.material_price_per_g),
    surfacePricePerMm2: Number(row.surface_price_per_mm2), minimumPrice: Number(row.minimum_price),
    wasteRate: Number(row.waste_rate), marginRate: Number(row.margin_rate),
    leadDays: row.lead_days === null ? null : Number(row.lead_days),
    status: row.setting_status === 'inactive' ? 'inactive' : 'active', versionNumber: Number(row.version_number || 1),
  };
}

export async function getActiveGiftQuoteSettings() {
  const [rows] = await databasePool().execute<RowDataPacket[]>(`SELECT * FROM gift_quote_settings WHERE setting_status = 'active' ORDER BY id ASC LIMIT 1`);
  if (!rows[0]) throw new GiftAccessError('Gift quote settings are not configured.', 503, 'configuration');
  return toSettings(rows[0]);
}

export async function listGiftQuoteSettings() {
  const [rows] = await databasePool().execute<RowDataPacket[]>('SELECT * FROM gift_quote_settings ORDER BY setting_status DESC, id ASC');
  return rows.map(toSettings);
}

export async function updateGiftQuoteSettings(actor: GiftEmployeeAccess, input: Record<string, unknown>, ip?: string) {
  const id = Number(input.id);
  if (!Number.isInteger(id) || id <= 0) throw new GiftAccessError('Quote setting ID is invalid.', 400, 'validation');
  const number = (key: string, min: number, max: number) => {
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < min || value > max) throw new GiftAccessError(`${key} is invalid.`, 400, 'validation');
    return value;
  };
  const density = number('densityGPerCm3', 0.0001, 1000);
  const materialPrice = number('materialPricePerG', 0, 100000);
  const surfacePrice = number('surfacePricePerMm2', 0, 100000);
  const minimumPrice = number('minimumPrice', 0, 10000000);
  const wasteRate = number('wasteRate', 0, 10);
  const marginRate = number('marginRate', 0, 10);
  const leadDays = Math.trunc(number('leadDays', 0, 365));
  const enabled = input.status !== 'inactive';
  await databasePool().execute<ResultSetHeader>(`
    UPDATE gift_quote_settings SET material_name = ?, material_category = ?, print_process = ?, description_zh = ?,
      density_g_cm3 = ?, material_price_per_g = ?, surface_price_per_mm2 = ?, minimum_price = ?, waste_rate = ?,
      margin_rate = ?, lead_days = ?, setting_status = ?, version_number = version_number + 1, updated_by_employee_id = ?, updated_at = CURRENT_TIMESTAMP(3)
    WHERE id = ?
  `, [String(input.materialName || '').trim().slice(0, 255), String(input.materialCategory || '').trim().slice(0, 128), String(input.printProcess || '').trim().slice(0, 64), String(input.descriptionZh || '').trim().slice(0, 500) || null, density, materialPrice, surfacePrice, minimumPrice, wasteRate, marginRate, leadDays, enabled ? 'active' : 'inactive', actor.id, id]);
  await databasePool().execute<ResultSetHeader>(`
    INSERT INTO gift_ops_audit_events (actor_employee_id, action_type, entity_type, entity_id, summary_text, event_payload, request_ip)
    VALUES (?, 'quote_settings_updated', 'gift_quote_settings', ?, ?, ?, ?)
  `, [actor.id, String(id), `${actor.name} 更新了礼品报价设置`, JSON.stringify({ id, materialName: input.materialName, version: 'incremented' }), ip || null]);
  return getActiveGiftQuoteSettings();
}

export async function estimateGiftQuote(measurement: Parameters<typeof calculateGiftQuote>[1], quantity = 1) {
  const settings = await getActiveGiftQuoteSettings();
  return { settings, estimate: calculateGiftQuote(settings, measurement, quantity) };
}
