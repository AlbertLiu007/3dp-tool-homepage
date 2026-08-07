ALTER TABLE gift_assets
  DROP CHECK chk_gift_asset_kind,
  ADD CONSTRAINT chk_gift_asset_kind CHECK (asset_kind IN ('reference_image', 'render_image', 'edit_mask', 'model_file', 'model_preview', 'model_preview_3d', 'business_attachment'));

ALTER TABLE gift_models
  ADD COLUMN preview_model_asset_id BIGINT UNSIGNED NULL AFTER preview_asset_id,
  ADD KEY idx_gift_model_preview_model_asset (preview_model_asset_id),
  ADD CONSTRAINT fk_gift_model_preview_model FOREIGN KEY (preview_model_asset_id) REFERENCES gift_assets (id) ON DELETE SET NULL;

ALTER TABLE gift_model_asset_links
  DROP CHECK chk_gift_model_asset_link_role,
  ADD CONSTRAINT chk_gift_model_asset_link_role CHECK (asset_role IN ('model_file', 'model_preview', 'model_preview_3d', 'reference'));

ALTER TABLE gift_request_attachments
  DROP CHECK chk_gift_request_attachment_role,
  ADD CONSTRAINT chk_gift_request_attachment_role CHECK (attachment_role IN ('source_model', 'model_preview_3d', 'reference', 'production', 'delivery', 'other'));
