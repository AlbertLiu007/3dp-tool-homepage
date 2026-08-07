import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import OSS from 'ali-oss';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { databasePool, GiftAccessError, type GiftEmployeeAccess } from '@/lib/gift-db';
import { recordGiftOpsAudit } from '@/lib/gift-ops-db';
import { createGiftPreviewGlb } from '@/lib/model/create-preview-glb';

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

async function ossClient(options: { internal?: boolean } = {}) {
  const credential = await getEcsRoleCredential();
  return new OSS({
    region: process.env.GIFT_OSS_REGION?.trim() || 'oss-cn-shanghai',
    bucket: required('GIFT_OSS_BUCKET'),
    accessKeyId: credential.AccessKeyId!,
    accessKeySecret: credential.AccessKeySecret!,
    stsToken: credential.SecurityToken!,
    internal: options.internal ?? process.env.GIFT_OSS_INTERNAL !== 'false',
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
  return { client, sha256, buffer };
}

export type GiftDraftAsset = {
  assetId: number;
  requestId: number;
  kind: 'reference_image' | 'render_image' | 'edit_mask' | 'model_file' | 'model_preview' | 'model_preview_3d';
  filename: string;
  contentType: string;
  extension: string;
  size: number;
  url: string;
  previewModelAssetId?: number;
};

type GiftDraftAssetKind = GiftDraftAsset['kind'];

const draftAssetDescriptor: Record<GiftDraftAssetKind, { attachmentRole: 'source_model' | 'model_preview_3d' | 'reference' | 'other'; maxBytes: number }> = {
  reference_image: { attachmentRole: 'reference', maxBytes: 15 * 1024 * 1024 },
  render_image: { attachmentRole: 'reference', maxBytes: 20 * 1024 * 1024 },
  edit_mask: { attachmentRole: 'other', maxBytes: 10 * 1024 * 1024 },
  model_file: { attachmentRole: 'source_model', maxBytes: 500 * 1024 * 1024 },
  model_preview: { attachmentRole: 'reference', maxBytes: 20 * 1024 * 1024 },
  // The attachment table intentionally keeps the role vocabulary small; the
  // asset kind still distinguishes this cached GLB from ordinary references.
  model_preview_3d: { attachmentRole: 'model_preview_3d', maxBytes: 30 * 1024 * 1024 },
};

function safeAssetExtension(filename: string, contentType: string, kind: GiftDraftAssetKind) {
  const fromName = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  if (fromName && fromName.length <= 8) return fromName === 'jpeg' ? 'jpg' : fromName;
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'model/stl' || contentType === 'application/sla') return 'stl';
  if (contentType.includes('gltf-binary')) return 'glb';
  if (contentType.includes('gltf')) return 'gltf';
  return kind === 'model_file' ? 'stl' : 'png';
}

function normalizedDraftAsset(row: RowDataPacket): GiftDraftAsset {
  const assetId = Number(row.id);
  return {
    assetId,
    requestId: Number(row.request_id),
    kind: String(row.asset_kind) as GiftDraftAssetKind,
    filename: String(row.original_filename || 'gift-asset'),
    contentType: String(row.content_type || 'application/octet-stream'),
    extension: String(row.file_extension || ''),
    size: Number(row.size_bytes || 0),
    url: `/api/gift/assets/${assetId}`,
  };
}

async function ownedDraftRequest(actor: GiftEmployeeAccess, requestId: number) {
  if (!Number.isInteger(requestId) || requestId <= 0) throw new GiftAccessError('Draft request ID is invalid.', 400, 'validation');
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT id, request_no FROM gift_print_requests
    WHERE id = ? AND requester_employee_id = ? AND request_type = 'ai_gift' AND request_status = 'draft'
    LIMIT 1
  `, [requestId, actor.id]);
  if (!rows[0]) throw new GiftAccessError('AI gift draft was not found.', 404, 'not_found');
  return { id: Number(rows[0].id), requestNo: String(rows[0].request_no) };
}

async function findDraftAsset(requestId: number, kind: GiftDraftAssetKind, filters: { sha256?: string; providerJobId?: string }) {
  const clauses = ['ra.request_id = ?', 'a.asset_kind = ?', "a.asset_status = 'active'"];
  const parameters: (string | number)[] = [requestId, kind];
  if (filters.sha256) { clauses.push('a.sha256 = ?'); parameters.push(filters.sha256); }
  if (filters.providerJobId) {
    clauses.push("JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.providerJobId')) = ?");
    parameters.push(filters.providerJobId);
  }
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT a.*, ra.request_id FROM gift_request_attachments ra
    INNER JOIN gift_assets a ON a.id = ra.asset_id
    WHERE ${clauses.join(' AND ')} ORDER BY a.id DESC LIMIT 1
  `, parameters);
  return rows[0] ? normalizedDraftAsset(rows[0]) : null;
}

export async function findGiftDraftGeneratedAsset(actor: GiftEmployeeAccess, requestId: number, providerJobId: string, kind: GiftDraftAssetKind) {
  await ownedDraftRequest(actor, requestId);
  return findDraftAsset(requestId, kind, { providerJobId });
}

export async function assertGiftDraftAsset(actor: GiftEmployeeAccess, requestId: number, assetId: number) {
  await ownedDraftRequest(actor, requestId);
  if (!Number.isInteger(assetId) || assetId <= 0) throw new GiftAccessError('Source asset ID is invalid.', 400, 'validation');
  const [rows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT a.*, ra.request_id FROM gift_request_attachments ra
    INNER JOIN gift_assets a ON a.id = ra.asset_id AND a.asset_status = 'active'
    WHERE ra.request_id = ? AND ra.asset_id = ? LIMIT 1
  `, [requestId, assetId]);
  if (!rows[0]) throw new GiftAccessError('The source asset does not belong to this draft.', 404, 'not_found');
  return normalizedDraftAsset(rows[0]);
}

async function registerDraftAsset(input: {
  actor: GiftEmployeeAccess;
  requestId: number;
  kind: GiftDraftAssetKind;
  objectKey: string;
  filename: string;
  contentType: string;
  extension: string;
  size: number;
  sha256: string;
  metadata: Record<string, unknown>;
}) {
  const bucket = required('GIFT_OSS_BUCKET');
  const region = process.env.GIFT_OSS_REGION?.trim() || 'oss-cn-shanghai';
  const connection = await databasePool().getConnection();
  try {
    await connection.beginTransaction();
    const [requestRows] = await connection.execute<RowDataPacket[]>(`
      SELECT id FROM gift_print_requests
      WHERE id = ? AND requester_employee_id = ? AND request_type = 'ai_gift' AND request_status = 'draft'
      FOR UPDATE
    `, [input.requestId, input.actor.id]);
    if (!requestRows[0]) throw new GiftAccessError('AI gift draft was not found.', 404, 'not_found');
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_assets (
        owner_employee_id, asset_kind, storage_region, bucket_name, object_key, object_key_hash,
        original_filename, content_type, file_extension, size_bytes, sha256, visibility, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', ?)
    `, [
      input.actor.id, input.kind, region, bucket, input.objectKey, createHash('sha256').update(input.objectKey).digest('hex'),
      input.filename.slice(0, 255), input.contentType, input.extension, input.size, input.sha256, JSON.stringify(input.metadata),
    ]);
    const assetId = Number(result.insertId);
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_attachments (request_id, asset_id, attachment_role, uploaded_by_employee_id, visible_to_requester)
      VALUES (?, ?, ?, ?, 1)
    `, [input.requestId, assetId, draftAssetDescriptor[input.kind].attachmentRole, input.actor.id]);
    await connection.execute<ResultSetHeader>(`
      UPDATE gift_print_requests SET source_asset_id = IF(? = 'model_file', ?, source_asset_id), updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
    `, [input.kind, assetId, input.requestId]);
    await connection.commit();
    return {
      assetId,
      requestId: input.requestId,
      kind: input.kind,
      filename: input.filename,
      contentType: input.contentType,
      extension: input.extension,
      size: input.size,
      url: `/api/gift/assets/${assetId}`,
    } satisfies GiftDraftAsset;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function persistGiftDraftBufferAsset(input: {
  actor: GiftEmployeeAccess;
  requestId: number;
  kind: GiftDraftAssetKind;
  buffer: Buffer;
  filename: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}): Promise<GiftDraftAsset & { previewModelAssetId?: number }> {
  const request = await ownedDraftRequest(input.actor, input.requestId);
  const descriptor = draftAssetDescriptor[input.kind];
  if (!input.buffer.byteLength || input.buffer.byteLength > descriptor.maxBytes) throw new GiftAccessError('Gift asset exceeds the storage limit.', 413, 'validation');
  const sha256 = createHash('sha256').update(input.buffer).digest('hex');
  const existing = await findDraftAsset(input.requestId, input.kind, { sha256 });
  if (existing) return existing;
  const extension = safeAssetExtension(input.filename, input.contentType, input.kind);
  const objectKey = `drafts/${input.actor.id}/${request.requestNo}/${input.kind}/${randomUUID()}.${extension}`;
  const client = await ossClient();
  await client.put(objectKey, input.buffer, {
    mime: input.contentType,
    headers: { 'Cache-Control': input.kind === 'model_preview_3d' ? 'private, max-age=31536000, immutable' : 'private, no-store', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(input.filename)}` },
  });
  try {
    const asset = await registerDraftAsset({ ...input, objectKey, extension, size: input.buffer.byteLength, sha256, metadata: input.metadata || {} });
    if (input.kind === 'model_file' && extension === 'stl') {
      try {
        const previewBuffer = await createGiftPreviewGlb(input.buffer, extension);
        if (previewBuffer) {
          const preview: GiftDraftAsset & { previewModelAssetId?: number } = await persistGiftDraftBufferAsset({
            actor: input.actor,
            requestId: input.requestId,
            kind: 'model_preview_3d',
            buffer: previewBuffer,
            filename: input.filename.replace(/\.[^.]+$/, '-preview.glb'),
            contentType: 'model/gltf-binary',
            metadata: { ...(input.metadata || {}), previewOfAssetId: asset.assetId },
          });
          return { ...asset, previewModelAssetId: preview.assetId };
        }
      } catch (error) {
        console.error('[gift] preview GLB generation failed', error);
      }
    }
    return asset;
  } catch (error) {
    await client.delete(objectKey).catch(() => undefined);
    throw error;
  }
}

export async function persistGiftDraftFileAsset(input: {
  actor: GiftEmployeeAccess;
  requestId: number;
  kind: Extract<GiftDraftAssetKind, 'reference_image' | 'edit_mask'>;
  file: File;
  metadata?: Record<string, unknown>;
}) {
  return persistGiftDraftBufferAsset({
    actor: input.actor,
    requestId: input.requestId,
    kind: input.kind,
    buffer: Buffer.from(await input.file.arrayBuffer()),
    filename: input.file.name || (input.kind === 'edit_mask' ? 'edit-mask.png' : 'reference-image.png'),
    contentType: input.file.type || 'image/png',
    metadata: input.metadata,
  });
}

export async function persistGiftDraftGeneratedImage(input: {
  actor: GiftEmployeeAccess;
  requestId: number;
  image: { dataUrl?: string; url?: string };
  filename: string;
  kind?: Extract<GiftDraftAssetKind, 'render_image' | 'model_preview'>;
  metadata?: Record<string, unknown>;
}) {
  let buffer: Buffer;
  let contentType = 'image/png';
  if (input.image.dataUrl) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(input.image.dataUrl);
    if (!match) throw new GiftAccessError('Generated image data is invalid.', 502, 'validation');
    contentType = match[1];
    buffer = Buffer.from(match[2], 'base64');
  } else if (input.image.url) {
    const sourceUrl = new URL(input.image.url);
    if (sourceUrl.protocol !== 'https:') throw new GiftAccessError('Generated image URL is invalid.', 502, 'validation');
    const response = await fetch(input.image.url, { cache: 'no-store', signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new GiftAccessError('Unable to download the generated image.', 502, 'configuration');
    contentType = response.headers.get('content-type')?.split(';')[0] || contentType;
    if (!contentType.startsWith('image/')) throw new GiftAccessError('Generated image content type is invalid.', 502, 'validation');
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    throw new GiftAccessError('Generated image is empty.', 502, 'validation');
  }
  const asset = await persistGiftDraftBufferAsset({
    actor: input.actor, requestId: input.requestId, kind: input.kind || 'render_image', buffer,
    filename: input.filename, contentType, metadata: input.metadata,
  });
  return { assetId: asset.assetId, url: asset.url };
}

export async function persistGiftDraftRemoteAsset(input: {
  actor: GiftEmployeeAccess;
  requestId: number;
  kind: Extract<GiftDraftAssetKind, 'model_file' | 'model_preview'>;
  sourceUrl: string;
  filename: string;
  contentType: string;
  providerJobId: string;
  metadata?: Record<string, unknown>;
}): Promise<GiftDraftAsset & { previewModelAssetId?: number }> {
  const existing = await findGiftDraftGeneratedAsset(input.actor, input.requestId, input.providerJobId, input.kind);
  if (existing) return existing;
  const sourceUrl = new URL(input.sourceUrl);
  if (sourceUrl.protocol !== 'https:') throw new GiftAccessError('Generated asset URL is invalid.', 502, 'validation');
  const request = await ownedDraftRequest(input.actor, input.requestId);
  const response = await fetch(input.sourceUrl, { cache: 'no-store', signal: AbortSignal.timeout(300_000) });
  if (!response.ok || !response.body) throw new GiftAccessError('Unable to download the generated asset.', 502, 'configuration');
  const declaredSize = Number(response.headers.get('content-length') || 0);
  const maxBytes = draftAssetDescriptor[input.kind].maxBytes;
  if (declaredSize > maxBytes) throw new GiftAccessError('Generated asset exceeds the storage limit.', 413, 'validation');
  const contentType = response.headers.get('content-type')?.split(';')[0] || input.contentType;
  const extension = safeAssetExtension(input.filename, contentType, input.kind);
  const objectKey = `drafts/${input.actor.id}/${request.requestNo}/${input.kind}/${randomUUID()}.${extension}`;
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'unionam-gift-'));
  const temporaryFile = path.join(temporaryDirectory, `asset.${extension}`);
  const hash = createHash('sha256');
  let size = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) return callback(new GiftAccessError('Generated asset exceeds the storage limit.', 413, 'validation'));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  const client = await ossClient();
  try {
    await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(temporaryFile, { mode: 0o600 }));
    await client.multipartUpload(objectKey, temporaryFile, {
      parallel: 3,
      partSize: 5 * 1024 * 1024,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(input.filename)}` },
    });
    try {
      const asset = await registerDraftAsset({
        actor: input.actor, requestId: input.requestId, kind: input.kind, objectKey, filename: input.filename,
        contentType, extension, size, sha256: hash.digest('hex'), metadata: { ...(input.metadata || {}), providerJobId: input.providerJobId },
      });
      if (input.kind === 'model_file' && extension === 'stl') {
        try {
          const previewBuffer = await createGiftPreviewGlb(await readFile(temporaryFile), extension);
          if (previewBuffer) {
            const preview = await persistGiftDraftBufferAsset({
              actor: input.actor,
              requestId: input.requestId,
              kind: 'model_preview_3d',
              buffer: previewBuffer,
              filename: input.filename.replace(/\.[^.]+$/, '-preview.glb'),
              contentType: 'model/gltf-binary',
              metadata: { ...(input.metadata || {}), providerJobId: input.providerJobId, previewOfAssetId: asset.assetId },
            });
            return { ...asset, previewModelAssetId: preview.assetId };
          }
        } catch (error) {
          console.error('[gift] remote model preview generation failed', error);
        }
      }
      return asset;
    } catch (error) {
      await client.delete(objectKey).catch(() => undefined);
      throw error;
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function persistGiftOpsModelPreviewAsset(actorId: number | null, modelId: number, sourceAssetId: number, sourceFilename: string, sourceBuffer: Buffer) {
  const previewBuffer = await createGiftPreviewGlb(sourceBuffer, 'stl');
  if (!previewBuffer) return null;
  const objectKey = `model-library/previews/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.glb`;
  const bucket = required('GIFT_OSS_BUCKET');
  const region = process.env.GIFT_OSS_REGION?.trim() || 'oss-cn-shanghai';
  const client = await ossClient();
  await client.put(objectKey, previewBuffer, {
    mime: 'model/gltf-binary',
    headers: { 'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(sourceFilename.replace(/\.[^.]+$/, '-preview.glb'))}` },
  });
  try {
    const connection = await databasePool().getConnection();
    try {
      await connection.beginTransaction();
      const [assetResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO gift_assets (
          owner_employee_id, asset_kind, storage_region, bucket_name, object_key, object_key_hash,
          original_filename, content_type, file_extension, size_bytes, sha256, visibility, metadata
        ) VALUES (?, 'model_preview_3d', ?, ?, ?, ?, ?, 'model/gltf-binary', 'glb', ?, ?, 'internal', ?)
      `, [actorId, region, bucket, objectKey, createHash('sha256').update(objectKey).digest('hex'), sourceFilename.replace(/\.[^.]+$/, '-preview.glb').slice(0, 255), previewBuffer.byteLength, createHash('sha256').update(previewBuffer).digest('hex'), JSON.stringify({ uploadedFrom: 'ops', modelId, previewOfAssetId: sourceAssetId })]);
      const assetId = Number(assetResult.insertId);
      const [versionRows] = await connection.execute<RowDataPacket[]>('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM gift_model_asset_links WHERE model_id = ? AND asset_role = \'model_preview_3d\'', [modelId]);
      const version = Number(versionRows[0]?.next_version || 1);
      await connection.execute<ResultSetHeader>('UPDATE gift_model_asset_links SET is_current = 0 WHERE model_id = ? AND asset_role = \'model_preview_3d\'', [modelId]);
      await connection.execute<ResultSetHeader>('INSERT INTO gift_model_asset_links (model_id, asset_id, asset_role, version_number, is_current, uploaded_by_employee_id) VALUES (?, ?, \'model_preview_3d\', ?, 1, ?)', [modelId, assetId, version, actorId]);
      await connection.execute<ResultSetHeader>('UPDATE gift_models SET preview_model_asset_id = ? WHERE id = ?', [assetId, modelId]);
      await connection.commit();
      return assetId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    await client.delete(objectKey).catch(() => undefined);
    throw error;
  }
}

async function persistGiftRequestModelPreviewAsset(input: { requestId: number; ownerId: number; sourceAssetId: number; sourceFilename: string; sourceBuffer: Buffer }) {
  const previewBuffer = await createGiftPreviewGlb(input.sourceBuffer, 'stl');
  if (!previewBuffer) return null;
  const [existingRows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT a.id FROM gift_request_attachments ra
    INNER JOIN gift_assets a ON a.id = ra.asset_id AND a.asset_status = 'active'
    WHERE ra.request_id = ? AND a.asset_kind = 'model_preview_3d'
      AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.previewOfAssetId')) = ? LIMIT 1
  `, [input.requestId, input.sourceAssetId]);
  if (existingRows[0]) return Number(existingRows[0].id);
  const bucket = required('GIFT_OSS_BUCKET');
  const region = process.env.GIFT_OSS_REGION?.trim() || 'oss-cn-shanghai';
  const objectKey = `print-requests/previews/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.glb`;
  const client = await ossClient();
  await client.put(objectKey, previewBuffer, {
    mime: 'model/gltf-binary',
    headers: { 'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(input.sourceFilename.replace(/\.[^.]+$/, '-preview.glb'))}` },
  });
  try {
    const connection = await databasePool().getConnection();
    try {
      await connection.beginTransaction();
      const [assetResult] = await connection.execute<ResultSetHeader>(`
        INSERT INTO gift_assets (
          owner_employee_id, asset_kind, storage_region, bucket_name, object_key, object_key_hash,
          original_filename, content_type, file_extension, size_bytes, sha256, visibility, metadata
        ) VALUES (?, 'model_preview_3d', ?, ?, ?, ?, ?, 'model/gltf-binary', 'glb', ?, ?, 'private', ?)
      `, [input.ownerId, region, bucket, objectKey, createHash('sha256').update(objectKey).digest('hex'), input.sourceFilename.replace(/\.[^.]+$/, '-preview.glb').slice(0, 255), previewBuffer.byteLength, createHash('sha256').update(previewBuffer).digest('hex'), JSON.stringify({ source: 'preview-backfill', previewOfAssetId: input.sourceAssetId })]);
      const assetId = Number(assetResult.insertId);
      await connection.execute<ResultSetHeader>(`
        INSERT INTO gift_request_attachments (request_id, asset_id, attachment_role, uploaded_by_employee_id, visible_to_requester)
        VALUES (?, ?, 'model_preview_3d', ?, 1)
      `, [input.requestId, assetId, input.ownerId]);
      await connection.commit();
      return assetId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    await client.delete(objectKey).catch(() => undefined);
    throw error;
  }
}

export async function backfillGiftModelPreviews(limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const client = await ossClient();
  let catalogConverted = 0;
  let requestConverted = 0;
  const [modelRows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT m.id AS model_id, m.model_asset_id, a.owner_employee_id, a.object_key, a.original_filename, a.file_extension
    FROM gift_models m INNER JOIN gift_assets a ON a.id = m.model_asset_id AND a.asset_status = 'active'
    WHERE m.preview_model_asset_id IS NULL AND a.file_extension = 'stl'
    ORDER BY m.id LIMIT ${safeLimit}
  `);
  for (const row of modelRows) {
    const result = await client.get(String(row.object_key));
    const buffer = Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content as Uint8Array);
    const previewId = await persistGiftOpsModelPreviewAsset(row.owner_employee_id ? Number(row.owner_employee_id) : null, Number(row.model_id), Number(row.model_asset_id), String(row.original_filename || 'gift-model.stl'), buffer);
    if (previewId) catalogConverted += 1;
  }
  const [requestRows] = await databasePool().execute<RowDataPacket[]>(`
    SELECT r.id AS request_id, r.requester_employee_id, a.id AS source_asset_id, a.object_key, a.original_filename
    FROM gift_print_requests r
    INNER JOIN gift_request_attachments source_ra ON source_ra.request_id = r.id AND source_ra.attachment_role = 'source_model'
    INNER JOIN gift_assets a ON a.id = source_ra.asset_id AND a.asset_status = 'active' AND a.file_extension = 'stl'
    WHERE NOT EXISTS (
      SELECT 1 FROM gift_request_attachments preview_ra
      INNER JOIN gift_assets preview_a ON preview_a.id = preview_ra.asset_id AND preview_a.asset_status = 'active' AND preview_a.asset_kind = 'model_preview_3d'
      WHERE preview_ra.request_id = r.id
    )
    ORDER BY r.id LIMIT ${safeLimit}
  `);
  for (const row of requestRows) {
    const result = await client.get(String(row.object_key));
    const buffer = Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content as Uint8Array);
    const previewId = await persistGiftRequestModelPreviewAsset({ requestId: Number(row.request_id), ownerId: Number(row.requester_employee_id), sourceAssetId: Number(row.source_asset_id), sourceFilename: String(row.original_filename || 'gift-model.stl'), sourceBuffer: buffer });
    if (previewId) requestConverted += 1;
  }
  return { catalogConverted, requestConverted, scanned: modelRows.length + requestRows.length };
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
  const { client, sha256, buffer } = await uploadObject(file, objectKey, descriptor.kind === 'model_preview' ? 'private, max-age=86400' : 'private, no-store');
  const connection = await databasePool().getConnection();
  const linkRole = descriptor.kind === 'model_preview' ? 'main_image' : 'model_file';
  let uploaded: { assetId: number; kind: 'model_file' | 'model_preview'; filename: string; size: number; version: number } | null = null;
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_assets (
        owner_employee_id, asset_kind, storage_region, bucket_name, object_key, object_key_hash,
        original_filename, content_type, file_extension, size_bytes, sha256, visibility, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'internal', ?)
    `, [actor.id, descriptor.kind, region, bucket, objectKey, createHash('sha256').update(objectKey).digest('hex'), file.name.slice(0, 255), file.type || null, descriptor.extension, file.size, sha256, JSON.stringify({ uploadedFrom: 'ops', modelId })]);
    const [versionRows] = await connection.execute<RowDataPacket[]>('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM gift_model_asset_links WHERE model_id = ? AND asset_role = ?', [modelId, linkRole]);
    const version = Number(versionRows[0]?.next_version || 1);
    if (linkRole === 'model_file') {
      await connection.execute<ResultSetHeader>('UPDATE gift_model_asset_links SET is_current = 0 WHERE model_id = ? AND asset_role = ?', [modelId, linkRole]);
    }
    await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_model_asset_links (model_id, asset_id, asset_role, version_number, is_current, uploaded_by_employee_id)
      VALUES (?, ?, ?, ?, 1, ?)
    `, [modelId, result.insertId, linkRole, version, actor.id]);
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
  if (descriptor.kind === 'model_file' && descriptor.extension === 'stl') {
    try {
      await persistGiftOpsModelPreviewAsset(actor.id, modelId, uploaded!.assetId, file.name, buffer);
    } catch (error) {
      console.error('[gift] ops model preview generation failed', error);
    }
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
  const { client, sha256, buffer } = await uploadObject(file, objectKey, 'private, no-store');
  const isSourceModel = attachmentRole === 'source_model' && ['stl', 'obj', '3mf', 'glb', 'gltf'].includes(extension);
  const assetKind = isSourceModel ? 'model_file' : 'business_attachment';
  const connection = await databasePool().getConnection();
  let uploaded: { assetId: number; filename: string; role: string; size: number } | null = null;
  try {
    await connection.beginTransaction();
    const [assetResult] = await connection.execute<ResultSetHeader>(`
      INSERT INTO gift_assets (
        owner_employee_id, asset_kind, storage_region, bucket_name, object_key, object_key_hash,
        original_filename, content_type, file_extension, size_bytes, sha256, visibility, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', ?)
    `, [actor.id, assetKind, region, bucket, objectKey, createHash('sha256').update(objectKey).digest('hex'), file.name.slice(0, 255), file.type || null, extension, file.size, sha256, JSON.stringify({ requestId, attachmentRole })]);
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
  if (isSourceModel && extension === 'stl') {
    try {
      await persistGiftRequestModelPreviewAsset({ requestId, ownerId: Number(requestRows[0].requester_employee_id), sourceAssetId: uploaded!.assetId, sourceFilename: file.name, sourceBuffer: buffer });
    } catch (error) {
      console.error('[gift] request model preview generation failed', error);
    }
  }
  if (operator) await recordGiftOpsAudit({ actorId: actor.id, action: 'request_attachment_uploaded', entityType: 'print_request', entityId: requestId, summary: `${actor.name} 为申请 ${requestRows[0].request_no} 上传了 ${file.name}`, payload: { assetId: uploaded!.assetId, role: attachmentRole }, requestIp: ip }).catch(() => undefined);
  return uploaded!;
}

export async function deleteGiftDraft(actor: GiftEmployeeAccess, requestId: number, ip?: string) {
  if (!Number.isInteger(requestId) || requestId <= 0) throw new GiftAccessError('Request ID is invalid.', 400, 'validation');
  const connection = await databasePool().getConnection();
  let requestNo = '';
  let title = '';
  let assets: { id: number; object_key: string }[] = [];
  try {
    const [requestRows] = await connection.execute<RowDataPacket[]>(`
      SELECT id, request_no, title, request_status FROM gift_print_requests
      WHERE id = ? AND requester_employee_id = ? AND request_type = 'ai_gift' LIMIT 1
    `, [requestId, actor.id]);
    const request = requestRows[0];
    if (!request) throw new GiftAccessError('Print request was not found.', 404, 'not_found');
    if (String(request.request_status) !== 'draft') throw new GiftAccessError('Only an AI design draft can be deleted.', 409, 'validation');
    requestNo = String(request.request_no);
    title = String(request.title);
    const [assetRows] = await connection.execute<RowDataPacket[]>(`
      SELECT a.id, a.object_key
      FROM gift_request_attachments ra
      INNER JOIN gift_assets a ON a.id = ra.asset_id AND a.asset_status = 'active'
      WHERE ra.request_id = ?
    `, [requestId]);
    assets = assetRows.map((row) => ({ id: Number(row.id), object_key: String(row.object_key) }));
  } finally {
    connection.release();
  }

  const client = await ossClient();
  for (const asset of assets) await client.delete(asset.object_key);

  const updateConnection = await databasePool().getConnection();
  try {
    await updateConnection.beginTransaction();
    const [lockedRows] = await updateConnection.execute<RowDataPacket[]>(`
      SELECT request_status FROM gift_print_requests
      WHERE id = ? AND requester_employee_id = ? AND request_type = 'ai_gift' FOR UPDATE
    `, [requestId, actor.id]);
    if (!lockedRows[0] || String(lockedRows[0].request_status) !== 'draft') {
      throw new GiftAccessError('The draft changed before deletion. Refresh and try again.', 409, 'validation');
    }
    await updateConnection.execute<ResultSetHeader>('UPDATE gift_assets a INNER JOIN gift_request_attachments ra ON ra.asset_id = a.id SET a.asset_status = \'deleted\', a.deleted_at = CURRENT_TIMESTAMP(3) WHERE ra.request_id = ? AND a.asset_status = \'active\'', [requestId]);
    await updateConnection.execute<ResultSetHeader>('UPDATE gift_print_requests SET request_status = \'cancelled\', updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [requestId]);
    await updateConnection.execute<ResultSetHeader>(`
      INSERT INTO gift_request_events (request_id, actor_employee_id, event_type, from_status, to_status, comment_text)
      VALUES (?, ?, 'deleted', 'draft', 'cancelled', '员工删除 AI 礼品设计草稿')
    `, [requestId, actor.id]);
    await updateConnection.commit();
  } catch (error) {
    await updateConnection.rollback();
    throw error;
  } finally {
    updateConnection.release();
  }
  await recordGiftOpsAudit({ actorId: actor.id, action: 'gift_draft_deleted', entityType: 'print_request', entityId: requestId, summary: `${actor.name} 删除了 AI 礼品草稿 ${requestNo}`, payload: { title, assetIds: assets.map((asset) => asset.id) }, requestIp: ip }).catch(() => undefined);
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
    if (current.asset_role === 'model_preview_3d') throw new GiftAccessError('The preview model is generated automatically and cannot be edited or deleted.', 409, 'validation');
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
      const pointer = current.asset_role === 'main_image' ? 'preview_asset_id' : current.asset_role === 'model_preview_3d' ? 'preview_model_asset_id' : 'model_asset_id';
      await connection.execute<ResultSetHeader>(`UPDATE gift_models SET ${pointer} = ? WHERE id = ?`, [replacementId, modelId]);
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
  // Browser requests arrive from outside the ECS VPC. Sign public OSS URLs for
  // display/download; uploads and server-side reads continue using the internal endpoint.
  const client = await ossClient({ internal: false });
  return client.signatureUrl(String(asset.object_key), { expires: 300, response: { 'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(String(asset.original_filename || 'unionam-asset'))}` } });
}

export const getGiftOpsAssetUrl = getGiftAssetUrl;
