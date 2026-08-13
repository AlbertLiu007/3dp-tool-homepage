CREATE TABLE IF NOT EXISTS gift_ai_provider_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usage_request_uid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  operation_type VARCHAR(24) NOT NULL,
  processing_stage VARCHAR(64) NOT NULL,
  slot_index TINYINT UNSIGNED NULL,
  attempt_role VARCHAR(24) NOT NULL,
  provider_name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  model_name VARCHAR(128) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  base_host VARCHAR(255) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  attempt_status VARCHAR(24) NOT NULL DEFAULT 'submitting',
  http_status SMALLINT UNSIGNED NULL,
  provider_job_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  accepted_billable TINYINT(1) NOT NULL DEFAULT 0,
  cache_hit TINYINT(1) NOT NULL DEFAULT 0,
  duration_ms INT UNSIGNED NULL,
  error_message VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_gift_ai_provider_attempt_request (usage_request_uid, created_at),
  KEY idx_gift_ai_provider_attempt_model (model_name, created_at),
  KEY idx_gift_ai_provider_attempt_status (attempt_status, created_at),
  CONSTRAINT fk_gift_ai_provider_attempt_usage
    FOREIGN KEY (usage_request_uid) REFERENCES gift_ai_usage_events (request_uid) ON DELETE CASCADE,
  CONSTRAINT chk_gift_ai_provider_attempt_operation
    CHECK (operation_type IN ('generation', 'edit')),
  CONSTRAINT chk_gift_ai_provider_attempt_role
    CHECK (attempt_role IN ('primary', 'fallback', 'cache')),
  CONSTRAINT chk_gift_ai_provider_attempt_status
    CHECK (attempt_status IN ('submitting', 'accepted', 'succeeded', 'failed', 'skipped', 'cache_hit'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE gift_assets
  ADD COLUMN transformation_cache_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin
    GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.transformationCacheKey'))) STORED,
  ADD KEY idx_gift_asset_transformation_cache (transformation_cache_key, asset_kind, asset_status);
