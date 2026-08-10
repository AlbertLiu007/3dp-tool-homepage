ALTER TABLE gift_notification_outbox
  DROP FOREIGN KEY fk_gift_notification_request;

ALTER TABLE gift_notification_outbox
  MODIFY COLUMN request_id BIGINT UNSIGNED NULL,
  ADD COLUMN employee_id BIGINT UNSIGNED NULL AFTER request_id,
  ADD KEY idx_gift_notification_employee (employee_id),
  ADD CONSTRAINT fk_gift_notification_request FOREIGN KEY (request_id) REFERENCES gift_print_requests (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_gift_notification_employee FOREIGN KEY (employee_id) REFERENCES gift_employees (id) ON DELETE CASCADE,
  ADD CONSTRAINT chk_gift_notification_entity CHECK (
    (request_id IS NOT NULL AND employee_id IS NULL)
    OR (request_id IS NULL AND employee_id IS NOT NULL)
  );
