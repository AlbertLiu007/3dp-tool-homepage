CREATE TABLE IF NOT EXISTS gift_model_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(64) NOT NULL,
  name_zh VARCHAR(128) NOT NULL,
  name_en VARCHAR(128) NULL,
  description_zh VARCHAR(500) NULL,
  description_en VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  category_status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_by_employee_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_gift_model_category_slug (slug),
  KEY idx_gift_model_category_status_sort (category_status, sort_order),
  CONSTRAINT fk_gift_model_category_creator FOREIGN KEY (created_by_employee_id) REFERENCES gift_employees (id) ON DELETE SET NULL,
  CONSTRAINT chk_gift_model_category_status CHECK (category_status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO gift_model_categories (slug, name_zh, name_en, sort_order) VALUES
  ('business', '商务礼品', 'Business gifts', 10),
  ('culture', '文化创意', 'Cultural gifts', 20),
  ('technology', '科技展示', 'Technology', 30),
  ('custom', '个性定制', 'Custom', 40);

INSERT IGNORE INTO gift_model_categories (slug, name_zh, name_en, sort_order)
SELECT DISTINCT category, category, category, 100
FROM gift_models
WHERE category IS NOT NULL AND category <> '';

ALTER TABLE gift_models
  ADD CONSTRAINT fk_gift_model_category FOREIGN KEY (category) REFERENCES gift_model_categories (slug) ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS gift_model_asset_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  model_id BIGINT UNSIGNED NOT NULL,
  asset_id BIGINT UNSIGNED NOT NULL,
  asset_role VARCHAR(24) NOT NULL,
  version_number INT UNSIGNED NOT NULL DEFAULT 1,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  uploaded_by_employee_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_gift_model_asset_link_asset (asset_id),
  KEY idx_gift_model_asset_link_current (model_id, asset_role, is_current, version_number),
  CONSTRAINT fk_gift_model_asset_link_model FOREIGN KEY (model_id) REFERENCES gift_models (id) ON DELETE CASCADE,
  CONSTRAINT fk_gift_model_asset_link_asset FOREIGN KEY (asset_id) REFERENCES gift_assets (id) ON DELETE CASCADE,
  CONSTRAINT fk_gift_model_asset_link_uploader FOREIGN KEY (uploaded_by_employee_id) REFERENCES gift_employees (id) ON DELETE SET NULL,
  CONSTRAINT chk_gift_model_asset_link_role CHECK (asset_role IN ('model_file', 'model_preview', 'reference')),
  CONSTRAINT chk_gift_model_asset_link_version CHECK (version_number > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO gift_model_asset_links (model_id, asset_id, asset_role, version_number, is_current, uploaded_by_employee_id)
SELECT id, model_asset_id, 'model_file', version_number, 1, created_by_employee_id
FROM gift_models WHERE model_asset_id IS NOT NULL;

INSERT IGNORE INTO gift_model_asset_links (model_id, asset_id, asset_role, version_number, is_current, uploaded_by_employee_id)
SELECT id, preview_asset_id, 'model_preview', version_number, 1, created_by_employee_id
FROM gift_models WHERE preview_asset_id IS NOT NULL;

ALTER TABLE gift_print_requests
  ADD COLUMN production_batch_no VARCHAR(64) NULL AFTER assigned_to_employee_id,
  ADD COLUMN scheduled_start_at DATETIME(3) NULL AFTER production_batch_no,
  ADD COLUMN scheduled_complete_at DATETIME(3) NULL AFTER scheduled_start_at,
  ADD COLUMN delivery_method VARCHAR(24) NULL AFTER scheduled_complete_at,
  ADD COLUMN delivery_recipient VARCHAR(128) NULL AFTER delivery_method,
  ADD COLUMN delivery_notes VARCHAR(500) NULL AFTER delivery_recipient,
  ADD COLUMN delivered_at DATETIME(3) NULL AFTER delivery_notes,
  ADD COLUMN completed_at DATETIME(3) NULL AFTER delivered_at;

CREATE TABLE IF NOT EXISTS gift_request_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  asset_id BIGINT UNSIGNED NOT NULL,
  attachment_role VARCHAR(24) NOT NULL DEFAULT 'other',
  uploaded_by_employee_id BIGINT UNSIGNED NULL,
  visible_to_requester TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_gift_request_attachment_asset (asset_id),
  KEY idx_gift_request_attachment_request (request_id, created_at),
  CONSTRAINT fk_gift_request_attachment_request FOREIGN KEY (request_id) REFERENCES gift_print_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_gift_request_attachment_asset FOREIGN KEY (asset_id) REFERENCES gift_assets (id) ON DELETE CASCADE,
  CONSTRAINT fk_gift_request_attachment_uploader FOREIGN KEY (uploaded_by_employee_id) REFERENCES gift_employees (id) ON DELETE SET NULL,
  CONSTRAINT chk_gift_request_attachment_role CHECK (attachment_role IN ('source_model', 'reference', 'production', 'delivery', 'other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO gift_request_attachments (request_id, asset_id, attachment_role, uploaded_by_employee_id)
SELECT id, source_asset_id, 'source_model', requester_employee_id
FROM gift_print_requests WHERE source_asset_id IS NOT NULL;
