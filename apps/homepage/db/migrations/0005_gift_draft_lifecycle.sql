-- Allow an employee to permanently remove an AI design draft while keeping
-- an auditable timeline entry for the soft-deleted request record.
ALTER TABLE gift_request_events
  DROP CHECK chk_gift_request_event_type,
  ADD CONSTRAINT chk_gift_request_event_type
    CHECK (event_type IN ('created', 'status_changed', 'assigned', 'commented', 'updated', 'cancelled', 'deleted'));
