/**
 * Folder Structure Utilities
 *
 * Utilities for generating eCTD-compliant folder paths and file names
 * from structure node codes and source file names.
 */

import type { PackageFile, FolderNode } from './types';

/**
 * Convert a node code like "16.2.1" to an eCTD folder path
 *
 * The structure follows a simplified eCTD module 5 pattern:
 *   m5/{study-number}/{code-with-dashes}/
 *
 * Examples:
 *   "16" -> "m5/STUDY-001/16"
 *   "16.1" -> "m5/STUDY-001/16-1"
 *   "16.2.1" -> "m5/STUDY-001/16-2-1"
 *
 * @param code - The structure node code (e.g., "16.2.1")
 * @param studyNumber - The protocol/study number
 * @returns The eCTD folder path
 */
export function codeToFolderPath(code: string, studyNumber: string): string {
  // Sanitize the study number for use in path
  const sanitizedStudyNumber = sanitizePathComponent(studyNumber);

  // Convert dots to dashes in the code
  const codePath = code.replace(/\./g, '-');

  // Build the path
  return `m5/${sanitizedStudyNumber}/${codePath}`;
}

/**
 * Sanitize a path component (folder or file name segment)
 *
 * - Replace spaces with hyphens
 * - Remove special characters except hyphens and underscores
 * - Convert to lowercase
 * - Collapse multiple hyphens
 *
 * @param component - The raw path component
 * @returns The sanitized component
 */
export function sanitizePathComponent(component: string): string {
  return component
    .toLowerCase()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/[^a-z0-9\-_]/g, '') // remove special chars
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

/**
 * Generate a valid eCTD file name from source file name
 *
 * - Replace spaces with hyphens
 * - Remove special characters (keep alphanumeric, hyphen, underscore, dot)
 * - Lowercase
 * - Ensure proper extension
 * - Handle edge cases (empty name, too long, etc.)
 *
 * @param fileName - The original file name
 * @returns The sanitized file name
 */
export function sanitizeFileName(fileName: string): string {
  // Split into name and extension
  const lastDotIndex = fileName.lastIndexOf('.');
  let name: string;
  let extension: string;

  if (lastDotIndex > 0) {
    name = fileName.substring(0, lastDotIndex);
    extension = fileName.substring(lastDotIndex + 1).toLowerCase();
  } else {
    name = fileName;
    extension = '';
  }

  // Sanitize the name part
  let sanitizedName = name
    .toLowerCase()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/[^a-z0-9\-_]/g, '') // remove special chars
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens

  // Handle empty name
  if (!sanitizedName) {
    sanitizedName = 'document';
  }

  // Truncate if too long (eCTD recommends max 64 chars for file names)
  const maxNameLength = 50; // Leave room for extension
  if (sanitizedName.length > maxNameLength) {
    sanitizedName = sanitizedName.substring(0, maxNameLength);
    // Don't end with a hyphen
    sanitizedName = sanitizedName.replace(/-$/, '');
  }

  // Build final name
  if (extension) {
    return `${sanitizedName}.${extension}`;
  }
  return sanitizedName;
}

/**
 * Build a folder tree structure from a list of package files
 *
 * Creates a hierarchical folder structure based on file target paths.
 *
 * @param files - List of package files with target paths
 * @returns Array of root folder nodes
 */
export function buildFolderTree(files: PackageFile[]): FolderNode[] {
  // Map to track folders by their full path
  const folderMap = new Map<string, FolderNode>();

  // Root nodes (will typically be just "m5")
  const roots: FolderNode[] = [];

  // Process each file
  for (const file of files) {
    const pathParts = file.targetPath.split('/');

    // The last part is the file name
    const fileName = pathParts.pop()!;

    // Build folder hierarchy
    let currentPath = '';

    for (let i = 0; i < pathParts.length; i++) {
      const folderName = pathParts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

      // Check if folder already exists
      if (!folderMap.has(currentPath)) {
        const newFolder: FolderNode = {
          name: folderName,
          path: currentPath,
          children: [],
          files: [],
        };
        folderMap.set(currentPath, newFolder);

        // Add to parent or roots
        if (parentPath) {
          const parent = folderMap.get(parentPath);
          if (parent) {
            parent.children.push(newFolder);
          }
        } else {
          roots.push(newFolder);
        }
      }
    }

    // Add file to its containing folder
    if (currentPath) {
      const folder = folderMap.get(currentPath);
      if (folder) {
        folder.files.push(fileName);
      }
    }
  }

  // Sort children and files at each level
  const sortFolder = (folder: FolderNode): void => {
    folder.children.sort((a, b) => a.name.localeCompare(b.name));
    folder.files.sort((a, b) => a.localeCompare(b));
    folder.children.forEach(sortFolder);
  };

  roots.forEach(sortFolder);
  roots.sort((a, b) => a.name.localeCompare(b.name));

  return roots;
}

/**
 * Get the full target path for a document
 *
 * Combines folder path and sanitized file name.
 *
 * @param code - The structure node code
 * @param studyNumber - The protocol/study number
 * @param fileName - The original file name
 * @returns The full target path
 */
export function getTargetPath(
  code: string,
  studyNumber: string,
  fileName: string
): string {
  const folderPath = codeToFolderPath(code, studyNumber);
  const sanitizedName = sanitizeFileName(fileName);
  return `${folderPath}/${sanitizedName}`;
}

/**
 * Parse a target path into its components
 *
 * @param targetPath - The full target path
 * @returns Object with folder path and file name
 */
export function parseTargetPath(targetPath: string): {
  folderPath: string;
  fileName: string;
} {
  const lastSlash = targetPath.lastIndexOf('/');
  if (lastSlash === -1) {
    return {
      folderPath: '',
      fileName: targetPath,
    };
  }
  return {
    folderPath: targetPath.substring(0, lastSlash),
    fileName: targetPath.substring(lastSlash + 1),
  };
}
