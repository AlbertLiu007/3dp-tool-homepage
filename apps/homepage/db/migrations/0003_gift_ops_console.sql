ALTER TABLE gift_employees
  ADD COLUMN department_names JSON NULL AFTER department_ids,
  ADD COLUMN application_reason VARCHAR(500) NULL AFTER approval_note;

CREATE TABLE IF NOT EXISTS gift_ops_audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_employee_id BIGINT UNSIGNED NULL,
  action_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  summary_text VARCHAR(500) NOT NULL,
  event_payload JSON NULL,
  request_ip VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_gift_ops_audit_created (created_at),
  KEY idx_gift_ops_audit_actor (actor_employee_id, created_at),
  KEY idx_gift_ops_audit_entity (entity_type, entity_id, created_at),
  CONSTRAINT fk_gift_ops_audit_actor
    FOREIGN KEY (actor_employee_id) REFERENCES gift_employees (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE gift_ai_usage_events
  ADD COLUMN provider_name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER usage_status,
  ADD COLUMN model_name VARCHAR(128) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER provider_name,
  ADD COLUMN duration_ms INT UNSIGNED NULL AFTER error_message;
