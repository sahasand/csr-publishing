'use client';

import { useState } from 'react';
import { StudyList } from '@/components/studies/study-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateStudy } from '@/hooks/use-studies';
import { Plus, X } from 'lucide-react';

export default function StudiesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [studyId, setStudyId] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [phase, setPhase] = useState('');
  const [title, setTitle] = useState('');
  const [productName, setProductName] = useState('');
  const [indication, setIndication] = useState('');
  const [applicationNumber, setApplicationNumber] = useState('');
  const [applicationType, setApplicationType] = useState('');
  const [sponsorAddress, setSponsorAddress] = useState('');

  const createStudy = useCreateStudy();

  const resetForm = () => {
    setStudyId('');
    setSponsor('');
    setTherapeuticArea('');
    setPhase('');
    setTitle('');
    setProductName('');
    setIndication('');
    setApplicationNumber('');
    setApplicationType('');
    setSponsorAddress('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Protocol number and sponsor are required
    if (!studyId.trim() || !sponsor.trim()) return;
    await createStudy.mutateAsync({
      studyId: studyId.trim(),
      sponsor: sponsor.trim(),
      therapeuticArea: therapeuticArea || undefined,
      phase: phase || undefined,
      title: title || undefined,
      productName: productName || undefined,
      indication: indication || undefined,
      applicationNumber: applicationNumber || undefined,
      applicationType: applicationType || undefined,
      sponsorAddress: sponsorAddress || undefined,
    });
    setShowCreate(false);
    resetForm();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Studies</h1>
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
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Study Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., A Phase 3 Randomized Study of Drug X in ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
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
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
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
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Product / Drug Name
                  </label>
                  <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g., Compound AX-101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Indication
                  </label>
                  <Input
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                    placeholder="e.g., Metastatic breast cancer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Therapeutic Area
                  </label>
                  <Input
                    value={therapeuticArea}
                    onChange={(e) => setTherapeuticArea(e.target.value)}
                    placeholder="e.g., Oncology"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Phase
                  </label>
                  <Input
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    placeholder="e.g., Phase 3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Application Type
                  </label>
                  <Select
                    value={applicationType}
                    onChange={(e) => setApplicationType(e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="IND">IND</option>
                    <option value="NDA">NDA</option>
                    <option value="BLA">BLA</option>
                    <option value="ANDA">ANDA</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Application Number
                  </label>
                  <Input
                    value={applicationNumber}
                    onChange={(e) => setApplicationNumber(e.target.value)}
                    placeholder="e.g., 123456"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Sponsor Address
                </label>
                <Input
                  value={sponsorAddress}
                  onChange={(e) => setSponsorAddress(e.target.value)}
                  placeholder="e.g., 123 Pharma Way, Boston, MA 02110"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createStudy.isPending || !studyId.trim() || !sponsor.trim()}
                >
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
