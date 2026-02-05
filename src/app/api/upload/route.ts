import { NextRequest, NextResponse } from 'next/server';
import { saveFile } from '@/lib/storage';
import { db } from '@/lib/db';
import { processDocumentWithTracking } from '@/lib/process-document';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/rtf',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const studyId = formData.get('studyId') as string | null;
    const slotId = formData.get('slotId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!studyId || !slotId) {
      return NextResponse.json(
        { error: 'studyId and slotId are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.xpt')) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum size of 100MB' },
        { status: 400 }
      );
    }

    // Verify study and slot exist
    const study = await db.study.findUnique({ where: { id: studyId } });
    if (!study) {
      return NextResponse.json({ error: 'Study not found' }, { status: 404 });
    }

    const slot = await db.structureNode.findUnique({ where: { id: slotId } });
    if (!slot) {
      return NextResponse.json(
        { error: 'Structure node not found' },
        { status: 404 }
      );
    }

    // Save file
    const { path, size } = await saveFile(file);

    // Get next version
    const existingCount = await db.document.count({
      where: { studyId, slotId },
    });

    // Create document record with PROCESSING status
    const document = await db.document.create({
      data: {
        studyId,
        slotId,
        version: existingCount + 1,
        sourceFileName: file.name,
        sourcePath: path,
        mimeType: file.type,
        fileSize: size,
        status: 'PROCESSING',
      },
      include: { slot: true },
    });

    // Create processing job record
    const processingJob = await db.processingJob.create({
      data: {
        documentId: document.id,
        jobType: 'METADATA_EXTRACTION',
        status: 'PENDING',
      },
    });

    // Process synchronously (metadata extraction takes ~1-2 sec)
    await processDocumentWithTracking(
      processingJob.id,
      document.id,
      path,
      'METADATA_EXTRACTION'
    );

    // Fetch updated document and job
    const [updatedDocument, updatedJob] = await Promise.all([
      db.document.findUnique({
        where: { id: document.id },
        include: { slot: true },
      }),
      db.processingJob.findUnique({
        where: { id: processingJob.id },
      }),
    ]);

    return NextResponse.json(
      {
        data: {
          ...updatedDocument,
          processingJob: {
            id: updatedJob!.id,
            jobType: updatedJob!.jobType,
            status: updatedJob!.status,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
