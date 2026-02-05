import { Skeleton } from '@/components/ui/skeleton';

export default function StudyDetailLoading() {
  return (
    <div className="flex h-full">
      {/* Structure tree sidebar */}
      <div className="w-72 border-r border-gray-200 p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 16}px` }}>
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>

      {/* Context sidebar */}
      <div className="w-80 border-l border-gray-200 p-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
