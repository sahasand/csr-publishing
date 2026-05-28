'use client';

import { useState } from 'react';
import { ValidationRuleList } from '@/components/validation-rules/validation-rule-list';
import { ValidationRuleDialog } from '@/components/validation-rules/validation-rule-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function ValidationRulesPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Validation Rules</h1>
          <p className="text-muted-foreground mt-1">
            Manage the PDF compliance and eCTD technical checks run against
            uploaded documents.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <ValidationRuleList />

      <ValidationRuleDialog
        rule={null}
        open={showCreate}
        onOpenChange={setShowCreate}
      />
    </div>
  );
}
