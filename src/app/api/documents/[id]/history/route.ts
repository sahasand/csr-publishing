import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify document exists
    const document = await db.document.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get status history
    const history = await db.documentStatusHistory.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: history });
  } catch (error) {
    console.error('Failed to fetch document history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document history' },
      { status: 500 }
    );
  }
}
