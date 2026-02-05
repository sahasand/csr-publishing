/**
 * Package Assembly Service
 *
 * Core service for assembling eCTD packages from study documents.
 * Walks the structure template tree, collects approved documents,
 * and generates the package manifest with folder hierarchy.
 */

import { db } from '@/lib/db';
import type {
  PackageManifest,
  PackageFile,
  ReadinessCheck,
  MissingRequiredNode,
  PendingDocument,
  AssemblyOptions,
} from './types';
import {
  codeToFolderPath,
  sanitizeFileName,
  buildFolderTree,
} from './folder-structure';
import { DEFAULT_ASSEMBLY_OPTIONS } from './types';

/**
 * Check if a study is ready for packaging
 *
 * Performs comprehensive readiness checks:
 * - All required nodes have approved/published documents
 * - No pending documents that should be approved
 * - No validation errors
 * - No unresolved correction annotations
 *
 * @param studyId - The study database ID
 * @returns Detailed readiness information
 */
export async function checkReadiness(studyId: string): Promise<ReadinessCheck> {
  // Fetch study with template and nodes
  const study = await db.study.findUnique({
    where: { id: studyId },
    include: {
      activeTemplate: {
        include: {
          nodes: {
            orderBy: [{ code: 'asc' }],
          },
        },
      },
      documents: {
        include: {
          slot: true,
          validationResults: {
            where: { passed: false },
          },
          annotations: {
            where: {
              status: 'OPEN',
              type: 'CORRECTION_REQUIRED',
            },
          },
        },
      },
    },
  });

  if (!study) {
    throw new Error(`Study not found: ${studyId}`);
  }

  if (!study.activeTemplate) {
    throw new Error(`Study ${studyId} has no active template`);
  }

  const nodes = study.activeTemplate.nodes;
  const documents = study.documents;

  // Build a map of slotId -> latest documents by status
  const documentsBySlot = new Map<
    string,
    {
      approved: typeof documents[number] | null;
      published: typeof documents[number] | null;
      pending: typeof documents[number][];
    }
  >();

  for (const doc of documents) {
    if (!documentsBySlot.has(doc.slotId)) {
      documentsBySlot.set(doc.slotId, {
        approved: null,
        published: null,
        pending: [],
      });
    }

    const slotDocs = documentsBySlot.get(doc.slotId)!;

    if (doc.status === 'PUBLISHED') {
      // Keep the highest version published doc
      if (!slotDocs.published || doc.version > slotDocs.published.version) {
        slotDocs.published = doc;
      }
    } else if (doc.status === 'APPROVED') {
      // Keep the highest version approved doc
      if (!slotDocs.approved || doc.version > slotDocs.approved.version) {
        slotDocs.approved = doc;
      }
    } else if (
      doc.status === 'DRAFT' ||
      doc.status === 'PROCESSED' ||
      doc.status === 'IN_REVIEW' ||
      doc.status === 'CORRECTIONS_NEEDED'
    ) {
      // Track pending documents
      slotDocs.pending.push(doc);
    }
  }

  // Check for missing required nodes
  const missingRequired: MissingRequiredNode[] = [];
  const requiredNodes = nodes.filter((n) => n.required);

  for (const node of requiredNodes) {
    const slotDocs = documentsBySlot.get(node.id);
    const hasApprovedOrPublished =
      slotDocs && (slotDocs.approved || slotDocs.published);

    if (!hasApprovedOrPublished) {
      missingRequired.push({
        code: node.code,
        title: node.title,
        nodeId: node.id,
      });
    }
  }

  // Collect pending approval documents
  const pendingApproval: PendingDocument[] = [];

  for (const [slotId, slotDocs] of documentsBySlot) {
    // Find documents that exist but aren't approved/published
    for (const doc of slotDocs.pending) {
      pendingApproval.push({
        documentId: doc.id,
        fileName: doc.sourceFileName,
        status: doc.status,
        nodeCode: doc.slot.code,
        nodeTitle: doc.slot.title,
      });
    }
  }

  // Count validation errors across all documents
  let validationErrors = 0;
  for (const doc of documents) {
    validationErrors += doc.validationResults.length;
  }

  // Count unresolved correction annotations
  let unresolvedAnnotations = 0;
  for (const doc of documents) {
    unresolvedAnnotations += doc.annotations.length;
  }

  // Count total files that would be included
  let totalFiles = 0;
  for (const [, slotDocs] of documentsBySlot) {
    if (slotDocs.published || slotDocs.approved) {
      totalFiles++;
    }
  }

  // Determine if ready
  const ready =
    missingRequired.length === 0 &&
    validationErrors === 0 &&
    unresolvedAnnotations === 0;

  return {
    ready,
    missingRequired,
    pendingApproval,
    validationErrors,
    unresolvedAnnotations,
    totalFiles,
    totalRequiredNodes: requiredNodes.length,
  };
}

/**
 * Assemble package manifest for a study
 *
 * Walks the structure template tree and collects the latest
 * approved/published document for each node. Generates eCTD-compliant
 * file paths and folder structure.
 *
 * @param studyId - The study database ID
 * @param options - Assembly options (what document statuses to include)
 * @returns Complete package manifest
 */
export async function assemblePackage(
  studyId: string,
  options: AssemblyOptions = DEFAULT_ASSEMBLY_OPTIONS
): Promise<PackageManifest> {
  // Fetch study with template and documents
  const study = await db.study.findUnique({
    where: { id: studyId },
    include: {
      activeTemplate: {
        include: {
          nodes: {
            orderBy: [{ code: 'asc' }],
          },
        },
      },
      documents: {
        include: {
          slot: true,
        },
        orderBy: [{ version: 'desc' }],
      },
    },
  });

  if (!study) {
    throw new Error(`Study not found: ${studyId}`);
  }

  if (!study.activeTemplate) {
    throw new Error(`Study ${studyId} has no active template`);
  }

  const studyNumber = study.studyId; // Protocol number
  const nodes = study.activeTemplate.nodes;
  const documents = study.documents;

  // Build map of slotId -> best document to include
  const selectedDocuments = new Map<string, typeof documents[number]>();

  // Group documents by slot
  const documentsBySlot = new Map<string, typeof documents>();

  for (const doc of documents) {
    if (!documentsBySlot.has(doc.slotId)) {
      documentsBySlot.set(doc.slotId, []);
    }
    documentsBySlot.get(doc.slotId)!.push(doc);
  }

  // For each node, select the best document based on options
  for (const node of nodes) {
    const slotDocs = documentsBySlot.get(node.id) || [];

    // Sort by version descending (already done in query, but be safe)
    const sortedDocs = [...slotDocs].sort((a, b) => b.version - a.version);

    // Find the best document based on priority: PUBLISHED > APPROVED > DRAFT
    let selected: (typeof documents)[number] | null = null;

    for (const doc of sortedDocs) {
      if (doc.status === 'PUBLISHED' && options.includePublished) {
        selected = doc;
        break;
      }
      if (doc.status === 'APPROVED' && options.includeApproved) {
        if (!selected || selected.status !== 'PUBLISHED') {
          selected = doc;
        }
      }
      if (
        options.includeDrafts &&
        (doc.status === 'DRAFT' || doc.status === 'PROCESSED')
      ) {
        if (
          !selected ||
          (selected.status !== 'PUBLISHED' && selected.status !== 'APPROVED')
        ) {
          selected = doc;
        }
      }
    }

    if (selected) {
      selectedDocuments.set(node.id, selected);
    }
  }

  // Build package files list
  const files: PackageFile[] = [];

  for (const [slotId, doc] of selectedDocuments) {
    const node = nodes.find((n) => n.id === slotId);
    if (!node) continue;

    const folderPath = codeToFolderPath(node.code, studyNumber);
    const sanitizedName = sanitizeFileName(doc.sourceFileName);
    const targetPath = `${folderPath}/${sanitizedName}`;

    files.push({
      sourceDocumentId: doc.id,
      sourcePath: doc.sourcePath,
      targetPath,
      nodeCode: node.code,
      nodeTitle: node.title,
      fileName: sanitizedName,
      version: doc.version,
      pageCount: doc.pageCount ?? undefined,
      fileSize: doc.fileSize,
    });
  }

  // Sort files by node code for consistent ordering
  files.sort((a, b) => {
    // Sort by code segments numerically
    const aParts = a.nodeCode.split('.').map(Number);
    const bParts = b.nodeCode.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] ?? 0;
      const bVal = bParts[i] ?? 0;
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    return 0;
  });

  // Get readiness check
  const readiness = await checkReadiness(studyId);

  // Build folder structure
  const folderStructure = buildFolderTree(files);

  return {
    studyId,
    studyNumber,
    generatedAt: new Date(),
    files,
    readiness,
    folderStructure,
  };
}

/**
 * Get a summary of package contents without full assembly
 *
 * Lighter-weight operation for UI display.
 *
 * @param studyId - The study database ID
 * @returns Summary information
 */
export async function getPackageSummary(studyId: string): Promise<{
  studyNumber: string;
  totalNodes: number;
  requiredNodes: number;
  documentsReady: number;
  readiness: ReadinessCheck;
}> {
  const study = await db.study.findUnique({
    where: { id: studyId },
    include: {
      activeTemplate: {
        include: {
          nodes: true,
        },
      },
    },
  });

  if (!study) {
    throw new Error(`Study not found: ${studyId}`);
  }

  if (!study.activeTemplate) {
    throw new Error(`Study ${studyId} has no active template`);
  }

  const readiness = await checkReadiness(studyId);

  return {
    studyNumber: study.studyId,
    totalNodes: study.activeTemplate.nodes.length,
    requiredNodes: study.activeTemplate.nodes.filter((n) => n.required).length,
    documentsReady: readiness.totalFiles,
    readiness,
  };
}
