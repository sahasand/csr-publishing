import { Skeleton, SkeletonList } from '@/components/ui/skeleton';

export default function StudiesLoading() {
  return (
    <div className="space-y-6">
      {/* Header with title and button */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Study cards */}
      <SkeletonList count={3} />
    </div>
  );
}
