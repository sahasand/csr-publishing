import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-gray-100 p-4">
            <FileQuestion className="h-8 w-8 text-gray-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
          <p className="text-gray-600">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <Link href="/">
          <Button>
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
