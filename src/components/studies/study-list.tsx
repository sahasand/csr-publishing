'use client';

import Link from 'next/link';
import { useStudies, useDeleteStudy } from '@/hooks/use-studies';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { Trash2, ExternalLink } from 'lucide-react';

export function StudyList() {
  const { data: studies, isLoading, error } = useStudies();
  const deleteStudy = useDeleteStudy();

  if (isLoading) {
    return (
      <SkeletonList count={3} />
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Failed to load studies: {error.message}
      </div>
    );
  }

  if (!studies?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No studies found. Create your first study to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {studies.map((study) => (
        <Card key={study.id}>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg">{study.studyId}</CardTitle>
              <CardDescription>
                {study.sponsor}
                {study.therapeuticArea && ` · ${study.therapeuticArea}`}
                {study.phase && ` · ${study.phase}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={study.status === 'ACTIVE' ? 'success' : 'secondary'}
              >
                {study.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <span>{study._count?.documents || 0} documents</span>
                <span className="mx-2">·</span>
                <span>Updated {formatDate(study.updatedAt)}</span>
                {study.activeTemplate && (
                  <>
                    <span className="mx-2">·</span>
                    <span>Template: {study.activeTemplate.name}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/studies/${study.id}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm('Delete this study?')) {
                      deleteStudy.mutate(study.id);
                    }
                  }}
                  disabled={deleteStudy.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
