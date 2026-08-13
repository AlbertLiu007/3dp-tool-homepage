ALTER TABLE gift_ai_usage_events
  DROP CHECK chk_gift_ai_usage_event_status;

ALTER TABLE gift_ai_usage_events
  ADD CONSTRAINT chk_gift_ai_usage_event_status
    CHECK (usage_status IN ('reserved', 'running', 'succeeded', 'partial', 'refunded'));
