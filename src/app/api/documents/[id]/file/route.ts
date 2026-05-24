import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, statSync } from 'fs';
import { resolve, sep } from 'path';
import { db } from '@/lib/db';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch document from database
    const document = await db.document.findUnique({
      where: { id },
      select: {
        id: true,
        sourcePath: true,
        processedPath: true,
        sourceFileName: true,
        mimeType: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Prefer processed path if available, otherwise use source
    const relativePath = document.processedPath || document.sourcePath;

    // Defense-in-depth: ensure the resolved path stays within UPLOAD_DIR.
    // Stored paths should always be UUID-based, but never trust them blindly.
    const baseDir = resolve(UPLOAD_DIR);
    const fullPath = resolve(baseDir, relativePath);
    if (fullPath !== baseDir && !fullPath.startsWith(baseDir + sep)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check if file exists and get stats
    let fileStats;
    try {
      fileStats = statSync(fullPath);
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Create readable stream
    const stream = createReadStream(fullPath);

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

    // Determine content type
    const contentType = document.mimeType || 'application/pdf';

    // Return streaming response with appropriate headers
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileStats.size),
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.sourceFileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Failed to stream document file:', error);
    return NextResponse.json(
      { error: 'Failed to stream document file' },
      { status: 500 }
    );
  }
}
