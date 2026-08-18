CREATE TABLE IF NOT EXISTS gift_quote_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  material_id VARCHAR(64) NOT NULL,
  material_name VARCHAR(255) NOT NULL,
  material_category VARCHAR(128) NOT NULL DEFAULT '',
  print_process VARCHAR(64) NOT NULL DEFAULT '',
  description_zh VARCHAR(500) NULL,
  density_g_cm3 DECIMAL(10,4) NOT NULL,
  material_price_per_g DECIMAL(12,6) NOT NULL,
  surface_price_per_mm2 DECIMAL(12,8) NOT NULL,
  minimum_price DECIMAL(12,2) NOT NULL,
  waste_rate DECIMAL(8,6) NOT NULL DEFAULT 0,
  margin_rate DECIMAL(8,6) NOT NULL DEFAULT 0,
  lead_days INT UNSIGNED NULL,
  setting_status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  version_number INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by_employee_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id), UNIQUE KEY uq_gift_quote_material (material_id),
  KEY idx_gift_quote_status (setting_status),
  CONSTRAINT fk_gift_quote_updated_by FOREIGN KEY (updated_by_employee_id) REFERENCES gift_employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO gift_quote_settings (
  material_id, material_name, material_category, print_process, description_zh,
  density_g_cm3, material_price_per_g, surface_price_per_mm2, minimum_price, waste_rate, margin_rate, lead_days, setting_status
) VALUES ('material1', '【灰琉璃】UFS3009', '光固化', 'SLA', '表面细腻光滑，灰度均匀，适合高精度外观件和展示模型', 1.3, 1, 0.0001, 25, 0.06, 0.3, 2, 'active')
ON DUPLICATE KEY UPDATE material_name = VALUES(material_name), material_category = VALUES(material_category), print_process = VALUES(print_process), description_zh = VALUES(description_zh), density_g_cm3 = VALUES(density_g_cm3), material_price_per_g = VALUES(material_price_per_g), surface_price_per_mm2 = VALUES(surface_price_per_mm2), minimum_price = VALUES(minimum_price), waste_rate = VALUES(waste_rate), margin_rate = VALUES(margin_rate), lead_days = VALUES(lead_days), setting_status = VALUES(setting_status);

ALTER TABLE gift_print_requests
  ADD COLUMN quote_setting_id BIGINT UNSIGNED NULL,
  ADD COLUMN estimated_unit_price DECIMAL(12,2) NULL,
  ADD COLUMN estimated_total_price DECIMAL(14,2) NULL,
  ADD COLUMN estimated_weight_g DECIMAL(14,4) NULL,
  ADD COLUMN estimated_volume_cm3 DECIMAL(14,4) NULL,
  ADD COLUMN estimated_surface_area_mm2 DECIMAL(16,2) NULL,
  ADD COLUMN quote_scale_percent INT UNSIGNED NULL,
  ADD COLUMN quote_snapshot JSON NULL,
  ADD KEY idx_gift_request_quote_setting (quote_setting_id),
  ADD CONSTRAINT fk_gift_request_quote_setting FOREIGN KEY (quote_setting_id) REFERENCES gift_quote_settings(id) ON DELETE SET NULL;
