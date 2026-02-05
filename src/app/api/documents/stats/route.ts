import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const pendingReviewCount = await db.document.count({
      where: { status: 'IN_REVIEW' },
    });

    return NextResponse.json({
      data: { pendingReviewCount },
    });
  } catch (error) {
    console.error('Failed to fetch document stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document stats' },
      { status: 500 }
    );
  }
}
