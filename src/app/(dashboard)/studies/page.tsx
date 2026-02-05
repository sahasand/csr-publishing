'use client';

import { useState } from 'react';
import { StudyList } from '@/components/studies/study-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateStudy } from '@/hooks/use-studies';
import { Plus, X } from 'lucide-react';

export default function StudiesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [studyId, setStudyId] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [phase, setPhase] = useState('');

  const createStudy = useCreateStudy();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createStudy.mutateAsync({
      studyId,
      sponsor,
      therapeuticArea: therapeuticArea || undefined,
      phase: phase || undefined,
    });
    setShowCreate(false);
    setStudyId('');
    setSponsor('');
    setTherapeuticArea('');
    setPhase('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Studies</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Study
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Create New Study</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCreate(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Study ID (Protocol Number) *
                  </label>
                  <Input
                    value={studyId}
                    onChange={(e) => setStudyId(e.target.value)}
                    placeholder="e.g., ABC-123-001"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Sponsor *
                  </label>
                  <Input
                    value={sponsor}
                    onChange={(e) => setSponsor(e.target.value)}
                    placeholder="e.g., Acme Pharma"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Therapeutic Area
                  </label>
                  <Input
                    value={therapeuticArea}
                    onChange={(e) => setTherapeuticArea(e.target.value)}
                    placeholder="e.g., Oncology"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Phase
                  </label>
                  <Input
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    placeholder="e.g., Phase 3"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createStudy.isPending}>
                  {createStudy.isPending ? 'Creating...' : 'Create Study'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <StudyList />
    </div>
  );
}
