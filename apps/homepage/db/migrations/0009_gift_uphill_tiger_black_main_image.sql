-- The existing black tiger product image was imported as a reference asset.
-- It is part of the published gift gallery and must be exposed as a main image.
UPDATE gift_model_asset_links AS l
INNER JOIN gift_models AS m ON m.id = l.model_id
INNER JOIN gift_assets AS a ON a.id = l.asset_id
SET l.asset_role = 'main_image',
    l.version_number = 2,
    l.is_current = 0
WHERE m.slug = 'uphill-tiger'
  AND l.asset_role = 'reference'
  AND a.original_filename = 'tiger-black.png'
  AND a.asset_status = 'active';
