'use client';

import { useEffect, useState } from 'react';
import { useUpdateStudy } from '@/hooks/use-studies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/** Minimal study shape the edit dialog needs. */
export interface EditableStudy {
  id: string;
  studyId: string;
  sponsor: string;
  therapeuticArea?: string | null;
  phase?: string | null;
  status: string;
}

export interface EditStudyDialogProps {
  study: EditableStudy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for editing an existing study's details.
 *
 * Editable: sponsor, therapeutic area, phase, status. The protocol number
 * (studyId) is shown read-only — it is the study's immutable identifier and
 * is rejected by the API.
 */
export function EditStudyDialog({ study, open, onOpenChange }: EditStudyDialogProps) {
  const updateStudy = useUpdateStudy();

  const [sponsor, setSponsor] = useState('');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [phase, setPhase] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  // Re-seed the form whenever the dialog opens for a (possibly different) study
  useEffect(() => {
    if (open && study) {
      setSponsor(study.sponsor ?? '');
      setTherapeuticArea(study.therapeuticArea ?? '');
      setPhase(study.phase ?? '');
      setStatus(study.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
    }
  }, [open, study]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!study) return;
    try {
      await updateStudy.mutateAsync({
        id: study.id,
        data: {
          sponsor: sponsor.trim(),
          therapeuticArea: therapeuticArea.trim() || undefined,
          phase: phase.trim() || undefined,
          status,
        },
      });
      toast.success('Study updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update study');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Study</DialogTitle>
          <DialogDescription className="text-left">
            Update study details. The protocol number cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Protocol number — read-only */}
          <div>
            <label className="text-sm font-medium text-foreground/80">
              Study ID (Protocol Number)
            </label>
            <Input value={study?.studyId ?? ''} disabled readOnly />
            <p className="text-xs text-muted-foreground mt-1">
              The protocol number is immutable.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground/80">
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
              <label className="text-sm font-medium text-foreground/80">
                Status
              </label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'ARCHIVED')}
              >
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Therapeutic Area
              </label>
              <Input
                value={therapeuticArea}
                onChange={(e) => setTherapeuticArea(e.target.value)}
                placeholder="e.g., Oncology"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Phase
              </label>
              <Input
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="e.g., Phase 3"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateStudy.isPending || !sponsor.trim()}>
              {updateStudy.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
