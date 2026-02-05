import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { db } from '@/lib/db';
import { getPackageZipPath, exportExists } from '@/lib/packaging/exporter';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/studies/[id]/package/[packageId]
 *
 * Download the package ZIP file.
 * Streams the ZIP file to the client with appropriate headers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; packageId: string }> }
) {
  try {
    const { id, packageId } = await params;

    // Validate UUID formats
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid study ID format' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(packageId)) {
      return NextResponse.json(
        { error: 'Invalid package ID format' },
        { status: 400 }
      );
    }

    // Check if study exists
    const study = await db.study.findUnique({
      where: { id },
      select: {
        id: true,
        studyId: true,
      },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    // Check if export exists
    const exists = await exportExists(id, packageId);
    if (!exists) {
      return NextResponse.json(
        { error: 'Package not found or has expired' },
        { status: 404 }
      );
    }

    // Get ZIP file path and stats
    const zipPath = getPackageZipPath(id, packageId);
    let fileStats;
    try {
      fileStats = await stat(zipPath);
    } catch {
      return NextResponse.json(
        { error: 'Package file not found' },
        { status: 404 }
      );
    }

    // Create readable stream
    const stream = createReadStream(zipPath);

    // Convert Node.js readable stream to web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      },
    });

    // Generate download filename
    // Format: {studyNumber}_ectd_package_{timestamp}.zip
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeStudyNumber = study.studyId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const downloadFileName = `${safeStudyNumber}_ectd_package_${timestamp}.zip`;

    // Return streaming response with appropriate headers
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(fileStats.size),
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Failed to download package:', error);
    return NextResponse.json(
      { error: 'Failed to download package' },
      { status: 500 }
    );
  }
}
