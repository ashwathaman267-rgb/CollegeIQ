import fs from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '@/lib/db';
import { notFound } from '@/server/api/errors';
import { storage } from '@/lib/storage';
import type { FileKind } from '@prisma/client';

/**
 * File asset service — the single place where bytes meet the database.
 * Storage location is decided by FILE_STORAGE_DRIVER (local by default, S3-style
 * REST when FILE_STORAGE_URL/KEY are supplied).
 */
export interface StoredUpload {
  assetId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export async function storeUpload(input: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  kind: FileKind;
  ownerId?: string | null;
  key?: string;
}): Promise<StoredUpload> {
  const key = input.key ?? (await uniqueKey(input.kind, input.filename));
  const stored = await storage().put(key, input.buffer, input.mimeType);

  const asset = await prisma.fileAsset.create({
    data: {
      filename: path.basename(key),
      originalName: input.filename,
      mimeType: input.mimeType,
      sizeBytes: stored.size,
      storageKey: stored.key,
      storageDriver: stored.driver,
      checksum: stored.checksum,
      kind: input.kind,
      ownerId: input.ownerId ?? null,
    },
  });

  return {
    assetId: asset.id,
    storageKey: stored.key,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    checksum: stored.checksum,
  };
}

async function uniqueKey(kind: FileKind, filename: string) {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = path.extname(filename).toLowerCase().slice(0, 8) || '.bin';
  const base = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${kind.toLowerCase()}/${stamp}-${base || 'file'}-${rand}${ext}`;
}

export async function readAsset(assetId: string) {
  const asset = await prisma.fileAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.deletedAt) throw notFound('That file is no longer available.');
  const buffer = await storage().get(asset.storageKey);
  return { asset, buffer };
}

export async function softDeleteAsset(assetId: string) {
  await prisma.fileAsset.update({ where: { id: assetId }, data: { deletedAt: new Date() } }).catch(() => undefined);
}

export async function purgeMissingAssets() {
  const assets = await prisma.fileAsset.findMany({ where: { deletedAt: { not: null } }, select: { id: true, storageKey: true } });
  for (const asset of assets) {
    await storage().delete(asset.storageKey).catch(() => undefined);
  }
  return { removed: assets.length };
}

export async function ensureUploadDir() {
  const dir = process.env.UPLOAD_DIR ? path.resolve(process.cwd(), process.env.UPLOAD_DIR) : path.resolve(process.cwd(), '.data/uploads');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
