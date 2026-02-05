import { writeFile, mkdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function ensureUploadDir(): Promise<void> {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'source'), { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'processed'), { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

export async function saveFile(
  file: File,
  subdir: 'source' | 'processed' = 'source'
): Promise<{ path: string; size: number }> {
  await ensureUploadDir();

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split('.').pop() || 'bin';
  const filename = `${uuid()}.${ext}`;
  const relativePath = join(subdir, filename);
  const fullPath = join(UPLOAD_DIR, relativePath);

  await writeFile(fullPath, buffer);

  return {
    path: relativePath,
    size: buffer.length,
  };
}

export async function deleteFile(relativePath: string): Promise<void> {
  const fullPath = join(UPLOAD_DIR, relativePath);
  try {
    await unlink(fullPath);
  } catch (error) {
    // File doesn't exist, ignore
  }
}

export async function getFileStats(relativePath: string): Promise<{
  size: number;
  exists: boolean;
}> {
  const fullPath = join(UPLOAD_DIR, relativePath);
  try {
    const stats = await stat(fullPath);
    return { size: stats.size, exists: true };
  } catch {
    return { size: 0, exists: false };
  }
}

export function getFullPath(relativePath: string): string {
  return join(UPLOAD_DIR, relativePath);
}
