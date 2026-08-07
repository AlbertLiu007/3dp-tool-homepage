ALTER TABLE gift_models
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER category,
  ADD KEY idx_gift_model_publication_sort (publication_status, sort_order, id);

UPDATE gift_models
SET sort_order = id;

ALTER TABLE gift_model_asset_links
  DROP CHECK chk_gift_model_asset_link_role,
  ADD CONSTRAINT chk_gift_model_asset_link_role CHECK (asset_role IN ('model_file', 'model_preview', 'model_preview_3d', 'main_image', 'reference'));

UPDATE gift_model_asset_links
SET asset_role = 'main_image'
WHERE asset_role = 'model_preview';

ALTER TABLE gift_model_asset_links
  DROP CHECK chk_gift_model_asset_link_role,
  ADD CONSTRAINT chk_gift_model_asset_link_role CHECK (asset_role IN ('model_file', 'model_preview_3d', 'main_image', 'reference'));
