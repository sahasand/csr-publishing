/**
 * Checksum Calculation Service
 *
 * Calculates MD5 checksums for files as required by eCTD specifications.
 * All leaf elements in eCTD XML must include a checksum for integrity verification.
 */

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { getFullPath } from '@/lib/storage';

/**
 * Calculate MD5 checksum of a file using streaming
 *
 * More memory-efficient for large files.
 *
 * @param filePath - Path to the file (relative to storage root)
 * @returns MD5 hash as lowercase hex string
 */
export async function calculateMd5(filePath: string): Promise<string> {
  const fullPath = getFullPath(filePath);

  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = createReadStream(fullPath);

    stream.on('data', (data) => {
      hash.update(data);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex').toLowerCase());
    });

    stream.on('error', (error) => {
      reject(new Error(`Failed to calculate checksum for ${filePath}: ${error.message}`));
    });
  });
}

/**
 * Calculate MD5 checksum of a file synchronously
 *
 * Useful for smaller files where streaming overhead isn't needed.
 *
 * @param filePath - Path to the file (relative to storage root)
 * @returns MD5 hash as lowercase hex string
 */
export async function calculateMd5Sync(filePath: string): Promise<string> {
  const fullPath = getFullPath(filePath);
  const data = await readFile(fullPath);
  return createHash('md5').update(data).digest('hex').toLowerCase();
}

/**
 * Calculate MD5 checksum from a buffer
 *
 * @param buffer - The data buffer
 * @returns MD5 hash as lowercase hex string
 */
export function calculateMd5FromBuffer(buffer: Buffer): string {
  return createHash('md5').update(buffer).digest('hex').toLowerCase();
}

/**
 * Calculate checksums for multiple files in parallel
 *
 * @param filePaths - Array of file paths (relative to storage root)
 * @returns Map of filePath -> checksum
 */
export async function calculateChecksums(
  filePaths: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Process in batches to avoid overwhelming the filesystem
  const batchSize = 10;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    const checksums = await Promise.all(
      batch.map(async (path) => {
        try {
          const checksum = await calculateMd5(path);
          return { path, checksum };
        } catch (error) {
          console.error(`[Checksum] Failed to calculate checksum for ${path}:`, error);
          return { path, checksum: '' };
        }
      })
    );

    for (const { path, checksum } of checksums) {
      if (checksum) {
        results.set(path, checksum);
      }
    }
  }

  return results;
}

/**
 * Verify a file's checksum matches expected value
 *
 * @param filePath - Path to the file
 * @param expectedChecksum - Expected MD5 hash (lowercase hex)
 * @returns True if checksum matches
 */
export async function verifyChecksum(
  filePath: string,
  expectedChecksum: string
): Promise<boolean> {
  try {
    const actualChecksum = await calculateMd5(filePath);
    return actualChecksum === expectedChecksum.toLowerCase();
  } catch {
    return false;
  }
}
