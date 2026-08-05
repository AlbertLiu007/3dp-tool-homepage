ALTER TABLE gift_employees
  ADD COLUMN position_name VARCHAR(128) NULL AFTER department_ids,
  ADD COLUMN approval_status VARCHAR(24) NOT NULL DEFAULT 'pending' AFTER employment_status,
  ADD COLUMN applied_at DATETIME(3) NULL AFTER approval_status,
  ADD COLUMN reviewed_at DATETIME(3) NULL AFTER applied_at,
  ADD COLUMN reviewed_by_employee_id BIGINT UNSIGNED NULL AFTER reviewed_at,
  ADD COLUMN approval_note VARCHAR(500) NULL AFTER reviewed_by_employee_id,
  ADD KEY idx_gift_employee_approval (approval_status, applied_at),
  ADD KEY idx_gift_employee_reviewer (reviewed_by_employee_id),
  ADD CONSTRAINT fk_gift_employee_reviewer
    FOREIGN KEY (reviewed_by_employee_id) REFERENCES gift_employees (id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_gift_employee_approval
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

UPDATE gift_employees
SET applied_at = COALESCE(last_login_at, created_at)
WHERE applied_at IS NULL;

CREATE TABLE IF NOT EXISTS gift_employee_approval_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  actor_employee_id BIGINT UNSIGNED NULL,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NOT NULL,
  note_text VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_gift_approval_event_employee (employee_id, created_at),
  KEY idx_gift_approval_event_actor (actor_employee_id, created_at),
  CONSTRAINT fk_gift_approval_event_employee
    FOREIGN KEY (employee_id) REFERENCES gift_employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_gift_approval_event_actor
    FOREIGN KEY (actor_employee_id) REFERENCES gift_employees (id) ON DELETE SET NULL,
  CONSTRAINT chk_gift_approval_event_from
    CHECK (from_status IS NULL OR from_status IN ('pending', 'approved', 'rejected', 'suspended')),
  CONSTRAINT chk_gift_approval_event_to
    CHECK (to_status IN ('pending', 'approved', 'rejected', 'suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS gift_ai_quota_policies (
  employee_id BIGINT UNSIGNED NOT NULL,
  render_daily_limit SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  edit_daily_limit SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  model_daily_limit SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  max_concurrent_jobs TINYINT UNSIGNED NOT NULL DEFAULT 1,
  updated_by_employee_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (employee_id),
  KEY idx_gift_quota_policy_updater (updated_by_employee_id),
  CONSTRAINT fk_gift_quota_policy_employee
    FOREIGN KEY (employee_id) REFERENCES gift_employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_gift_quota_policy_updater
    FOREIGN KEY (updated_by_employee_id) REFERENCES gift_employees (id) ON DELETE SET NULL,
  CONSTRAINT chk_gift_quota_policy_concurrency CHECK (max_concurrent_jobs > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS gift_ai_daily_usage (
  employee_id BIGINT UNSIGNED NOT NULL,
  usage_date DATE NOT NULL,
  usage_type VARCHAR(24) NOT NULL,
  used_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  in_flight_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (employee_id, usage_date, usage_type),
  KEY idx_gift_ai_usage_date (usage_date, usage_type),
  CONSTRAINT fk_gift_ai_daily_usage_employee
    FOREIGN KEY (employee_id) REFERENCES gift_employees (id) ON DELETE CASCADE,
  CONSTRAINT chk_gift_ai_daily_usage_type
    CHECK (usage_type IN ('render', 'image_edit', 'image_to_3d'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS gift_ai_usage_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_uid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  usage_date DATE NOT NULL,
  usage_type VARCHAR(24) NOT NULL,
  usage_status VARCHAR(24) NOT NULL DEFAULT 'reserved',
  provider_job_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  error_message VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_gift_ai_usage_request (request_uid),
  KEY idx_gift_ai_usage_employee_created (employee_id, created_at),
  KEY idx_gift_ai_usage_provider_job (provider_job_id),
  CONSTRAINT fk_gift_ai_usage_event_employee
    FOREIGN KEY (employee_id) REFERENCES gift_employees (id) ON DELETE RESTRICT,
  CONSTRAINT chk_gift_ai_usage_event_type
    CHECK (usage_type IN ('render', 'image_edit', 'image_to_3d')),
  CONSTRAINT chk_gift_ai_usage_event_status
    CHECK (usage_status IN ('reserved', 'running', 'succeeded', 'refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
