import { createHash, randomUUID } from 'node:crypto';
import OSS from 'ali-oss';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { databasePool, GiftAccessError, type GiftEmployeeAccess } from '@/lib/gift-db';
import { recordGiftOpsAudit } from '@/lib/gift-ops-db';

type EcsRoleCredential = {
  AccessKeyId?: string;
  AccessKeySecret?: string;
  SecurityToken?: string;
  Expiration?: string;
  Code?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var unionamGiftOssCredential: (EcsRoleCredential & { expiresAt: number }) | undefined;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new GiftAccessError(`${name} is not configured.`, 503, 'configuration');
  return value;
}

async function getMetadataToken() {
  const response = await fetch('http://100.100.100.200/latest/api/token', {
    method: 'PUT',
    cache: 'no-store',
    headers: { 'X-aliyun-ecs-metadata-token-ttl-seconds': '21600' },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new GiftAccessError('Unable to obtain an ECS metadata token.', 503, 'configuration');
  return response.text();
}

async function getEcsRoleCredential() {
  const cached = globalThis.unionamGiftOssCredential;
  if (cached && cached.expiresAt > Date.now() + 5 * 60_000) return cached;
  const roleName = process.env.GIFT_OSS_ECS_ROLE?.trim() || 'UnionAMLiantaiGiftEcsRole';
  const token = await getMetadataToken();
  const response = await fetch(`http://100.100.100.200/latest/meta-data/ram/security-credentials/${encodeURIComponent(roleName)}`, {
    cache: 'no-store',
    headers: { 'X-aliyun-ecs-metadata-token': token },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new GiftAccessError('Unable to obtain the ECS RAM role credential.', 503, 'configuration');
  const credential = await response.json() as EcsRoleCredential;
  if (credential.Code !== 'Success' || !credential.AccessKeyId || !credential.AccessKeySecret || !credential.SecurityToken || !credential.Expiration) {
    throw new GiftAccessError('The ECS RAM role credential is invalid.', 503, 'configuration');
  }
  const result = { ...credential, expiresAt: new Date(credential.Expiration).getTime() };
  globalThis.unionamGiftOssCredential = result;
  return result;
}

async function ossClient() {
  const credential = await getEcsRoleCredential();
  return new OSS({
    region: process.env.GIFT_OSS_REGION?.trim() || 'oss-cn-shanghai',
    bucket: required('GIFT_OSS_BUCKET'),
    accessKeyId: credential.AccessKeyId!,
    accessKeySecret: credential.AccessKeySecret!,
    stsToken: credential.SecurityToken!,
    internal: process.env.GIFT_OSS_INTERNAL !== 'false',
    secure: true,
    timeout: 120_000,
  });
}

const supportedFiles: Record<string, { kind: 'model_file' | 'model_preview'; extension: string }> = {
  'model/stl': { kind: 'model_file', extension: 'stl' },
  'application/sla': { kind: 'model_file', extension: 'stl' },
  'text/plain': { kind: 'model_file', extension: 'obj' },
  'model/obj': { kind: 'model_file', extension: 'obj' },
  'model/3mf': { kind: 'model_file', extension: '3mf' },
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml': { kind: 'model_file', extension: '3mf' },
  'model/gltf-binary': { kind: 'model_file', extension: 'glb' },
  'model/gltf+json': { kind: 'model_file', extension: 'gltf' },
  'image/png': { kind: 'model_preview', extension: 'png' },
  'image/jpeg': { kind: 'model_preview', extension: 'jpg' },
  'image/webp': { kind: 'model_preview', extension: 'webp' },
};

function fileDescriptor(file: File, requestedKind: string) {
  const byMime = supportedFiles[file.type];
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const image = ['png', 'jpg', 'jpeg', 'webp'].includes(extension);
  const model = ['stl', 'obj', '3mf', 'glb', 'gltf'].includes(extension);
  const kind = requestedKind === 'model_preview' && image ? 'model_preview' : requestedKind === 'model_file' && model ? 'model_file' : byMime?.kind;
  if (!kind || (kind === 'model_preview' && !image) || (kind === 'model_file' && !model)) throw new GiftAccessError('Unsupported model or preview file.', 400, 'not_found');
  return { kind, extension: extension === 'jpeg' ? 'jpg' : extension || byMime.extension } as const;
}

function attachmentDescriptor(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const allowed = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf', 'zip', 'stl', 'obj', '3mf', 'glb', 'gltf']);
  if (!allowed.has(extension)) throw new GiftAccessError('Unsupported attachment file.', 400, 'validation');
  return extension === 'jpeg' ? 'jpg' : extension;
}

async function uploadObject(file: File, objectKey: string, cacheControl: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const client = await ossClient();
  await client.put(objectKey, buffer, {
    mime: file.type || 'application/octet-stream',
    headers: {
      'Cache-Control': cacheControl,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
  });
  return { client, sha256 };
}

export async function uploadGiftOpsAsset(actor: GiftEmployeeAccess, modelId: number, file: File, requestedKind: string, ip?: string) {
  if (!(file instanceof File) || file.size === 0) throw new GiftAccessError('A file is required.', 400, 'not_found');
  if (file.size > 50 * 1024 * 1024) throw new GiftAccessError('The file must not exceed 50MB.', 413, 'not_found');
  const descriptor = fileDescriptor(file, requestedKind);
  const [modelRows] = await databasePool().execute<RowDataPacket[]>('SELECT id FROM gift_models WHERE id = ? LIMIT 1', [modelId]);
  if (!modelRows[0]) throw new GiftAccessError('Model was not found.', 404, 'not_found');
  const objectKey = `model-library/${descriptor.kind === 'model_preview' ? 'previews' : 'models'}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${descriptor.extension}`;
  const bucket = required('GIFT_OSS_BUCKET');
  const region = process.env.GIFT_OSS_REGION?.trim() || 'oss-cn-shanghai';
  const { client, sha256 } = await uploadObject(file, objectKey, descriptor.kind === 'model_preview' ? 'private, max-age=86400' : 'private, no-store');
  const connection = await databasePool().getConnection();
  let uploaded: { assetId: number; kind: 'model_file' | 'model_preview'; filename: string; size: number; version: number } | null = null;
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_assets (
        owner_employee_id, asset_kind, storage_region, bucket_name, object_key, object_key_hash,
        original_filename, content_type, file_extension, size_bytes, sha256, visibility, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'internal', ?)
    `, [actor.id, descriptor.kind, region, bucket, objectKey, createHash('sha256').update(objectKey).digest('hex'), file.name.slice(0, 255), file.type || null, descriptor.extension, file.size, sha256, JSON.stringify({ uploadedFrom: 'ops', modelId })]);
    const [versionRows] = await connection.execute<RowDataPacket[]>('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM gift_model_asset_links WHERE model_id = ? AND asset_role = ?', [modelId, descriptor.kind]);
    const version = Number(versionRows[0]?.next_version || 1);
    await connection.execute<ResultSetHeader>('UPDATE gift_model_asset_links SET is_current = 0 WHERE model_id = ? AND asset_role = ?', [modelId, descriptor.kind]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_model_asset_links (model_id, asset_id, asset_role, version_number, is_current, uploaded_by_employee_id)
      VALUES (?, ?, ?, ?, 1, ?)
    `, [modelId, result.insertId, descriptor.kind, version, actor.id]);
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_models SET ${descriptor.kind === 'model_preview' ? 'preview_asset_id' : 'model_asset_id'} = ?,
        model_format = IF(? = 'model_file', ?, model_format),
        version_number = IF(? = 'model_file', GREATEST(version_number, ?), version_number)
      WHERE id = ?
    `, [result.insertId, descriptor.kind, descriptor.extension, descriptor.kind, version, modelId]);
    await connection.commit();
    uploaded = { assetId: Number(result.insertId), kind: descriptor.kind, filename: file.name, size: file.size, version };
  } catch (error) {
    await connection.rollback();
    await client.delete(objectKey).catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
  await recordGiftOpsAudit({ actorId: actor.id, action: 'model_asset_uploaded', entityType: 'model', entityId: modelId, summary: `${actor.name} 上传了 ${file.name}`, payload: { assetId: uploaded!.assetId, kind: descriptor.kind, size: file.size }, requestIp: ip }).catch(() => undefined);
  return uploaded!;
}

export async function uploadGiftRequestAttachment(actor: GiftEmployeeAccess, requestId: number, file: File, role: string, visibleToRequester = true, ip?: string) {
  if (!(file instanceof File) || file.size === 0) throw new GiftAccessError('A file is required.', 400, 'validation');
  if (file.size > 50 * 1024 * 1024) throw new GiftAccessError('The file must not exceed 50MB.', 413, 'validation');
  const extension = attachmentDescriptor(file);
  const allowedRoles = new Set(['source_model', 'reference', 'production', 'delivery', 'other']);
  const attachmentRole = allowedRoles.has(role) ? role : 'other';
  const operator = ['operator', 'admin'].includes(actor.role);
  const [requestRows] = await databasePool().execute<RowDataPacket[]>(`SELECT id, requester_employee_id, request_no, request_status FROM gift_print_requests WHERE id = ? ${operator ? '' : 'AND requester_employee_id = ?'} LIMIT 1`, operator ? [requestId] : [requestId, actor.id]);
  if (!requestRows[0]) throw new GiftAccessError('Print request was not found.', 404, 'not_found');
  if (!operator && ['rejected', 'completed', 'cancelled'].includes(String(requestRows[0].request_status))) {
    throw new GiftAccessError('Attachments can no longer be added to this request.', 409, 'validation');
  }
  const [usageRows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT COUNT(*) AS attachment_count, COALESCE(SUM(a.size_bytes), 0) AS total_bytes
    FROM gift_request_attachments ra INNER JOIN gift_assets a ON a.id = ra.asset_id AND a.asset_status = 'active'
    WHERE ra.request_id = ?
  `, [requestId]);
  const maxCount = operator ? 50 : 20;
  const maxBytes = operator ? 2 * 1024 * 1024 * 1024 : 500 * 1024 * 1024;
  if (Number(usageRows[0]?.attachment_count || 0) >= maxCount || Number(usageRows[0]?.total_bytes || 0) + file.size > maxBytes) {
    throw new GiftAccessError('The attachment count or total storage limit for this request has been reached.', 413, 'validation');
  }
  const objectKey = `print-requests/${new Date().toISOString().slice(0, 7)}/${requestRows[0].request_no}/${randomUUID()}.${extension}`;
  const bucket = required('GIFT_OSS_BUCKET');
  const region = process.env.GIFT_OSS_REGION?.trim() || 'oss-cn-shanghai';
  const { client, sha256 } = await uploadObject(file, objectKey, 'private, no-store');
  const connection = await databasePool().getConnection();
  let uploaded: { assetId: number; filename: string; role: string; size: number } | null = null;
  try {
    await connection.beginTransaction();
    const [assetResult] = await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_assets (
        owner_employee_id, asset_kind, storage_region, bucket_name, object_key, object_key_hash,
        original_filename, content_type, file_extension, size_bytes, sha256, visibility, metadata
      ) VALUES (?, 'business_attachment', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', ?)
    `, [actor.id, region, bucket, objectKey, createHash('sha256').update(objectKey).digest('hex'), file.name.slice(0, 255), file.type || null, extension, file.size, sha256, JSON.stringify({ requestId, attachmentRole })]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_attachments (request_id, asset_id, attachment_role, uploaded_by_employee_id, visible_to_requester)
      VALUES (?, ?, ?, ?, ?)
    `, [requestId, assetResult.insertId, attachmentRole, actor.id, visibleToRequester ? 1 : 0]);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_events (request_id, actor_employee_id, event_type, comment_text, event_payload)
      VALUES (?, ?, 'updated', ?, ?)
    `, [requestId, actor.id, `上传附件：${file.name}`, JSON.stringify({ assetId: Number(assetResult.insertId), role: attachmentRole })]);
    await connection.commit();
    uploaded = { assetId: Number(assetResult.insertId), filename: file.name, role: attachmentRole, size: file.size };
  } catch (error) {
    await connection.rollback();
    await client.delete(objectKey).catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
  if (operator) await recordGiftOpsAudit({ actorId: actor.id, action: 'request_attachment_uploaded', entityType: 'print_request', entityId: requestId, summary: `${actor.name} 为申请 ${requestRows[0].request_no} 上传了 ${file.name}`, payload: { assetId: uploaded!.assetId, role: attachmentRole }, requestIp: ip }).catch(() => undefined);
  return uploaded!;
}

export async function deleteGiftOpsModelAsset(actor: GiftEmployeeAccess, modelId: number, assetId: number, ip?: string) {
  const connection = await databasePool().getConnection();
  let objectKey = '';
  let title = '';
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(`
      SELECT l.*, a.object_key, m.publication_status, m.title_zh
      FROM gift_model_asset_links l INNER JOIN gift_assets a ON a.id = l.asset_id
      INNER JOIN gift_models m ON m.id = l.model_id
      WHERE l.model_id = ? AND l.asset_id = ? FOR UPDATE
    `, [modelId, assetId]);
    const current = rows[0];
    if (!current) throw new GiftAccessError('Model asset was not found.', 404, 'not_found');
    if (current.publication_status === 'published' && current.is_current) throw new GiftAccessError('Replace the current file or archive the model before deleting it.', 409, 'validation');
    objectKey = String(current.object_key);
    title = String(current.title_zh);
    await connection.execute<ResultSetHeader>('UPDATE gift_assets SET asset_status = \'deleted\', deleted_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [assetId]);
    await connection.execute<ResultSetHeader>('UPDATE gift_model_asset_links SET is_current = 0 WHERE asset_id = ?', [assetId]);
    if (current.is_current) {
      const [previousRows] = await connection.execute<RowDataPacket[]>(`
        SELECT l.asset_id FROM gift_model_asset_links l INNER JOIN gift_assets a ON a.id = l.asset_id AND a.asset_status = 'active'
        WHERE l.model_id = ? AND l.asset_role = ? ORDER BY l.version_number DESC LIMIT 1
      `, [modelId, current.asset_role]);
      const replacementId = previousRows[0]?.asset_id || null;
      if (replacementId) await connection.execute<ResultSetHeader>('UPDATE gift_model_asset_links SET is_current = 1 WHERE asset_id = ?', [replacementId]);
      await connection.execute<ResultSetHeader>(`UPDATE gift_models SET ${current.asset_role === 'model_preview' ? 'preview_asset_id' : 'model_asset_id'} = ? WHERE id = ?`, [replacementId, modelId]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  await (await ossClient()).delete(objectKey).catch(() => undefined);
  await recordGiftOpsAudit({ actorId: actor.id, action: 'model_asset_deleted', entityType: 'model', entityId: modelId, summary: `${actor.name} 删除了模型 ${title} 的文件`, payload: { assetId }, requestIp: ip }).catch(() => undefined);
}

export async function getGiftAssetUrl(assetId: number, disposition: 'inline' | 'attachment' = 'inline') {
  const [rows] = await databasePool().execute<RowDataPacket[]>('SELECT bucket_name, object_key, original_filename FROM gift_assets WHERE id = ? AND asset_status = \'active\' LIMIT 1', [assetId]);
  const asset = rows[0];
  if (!asset) throw new GiftAccessError('Asset was not found.', 404, 'not_found');
  if (String(asset.bucket_name) !== required('GIFT_OSS_BUCKET')) throw new GiftAccessError('Asset bucket is not configured for this service.', 409, 'configuration');
  const client = await ossClient();
  return client.signatureUrl(String(asset.object_key), { expires: 300, response: { 'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(String(asset.original_filename || 'unionam-asset'))}` } });
}

export const getGiftOpsAssetUrl = getGiftAssetUrl;
