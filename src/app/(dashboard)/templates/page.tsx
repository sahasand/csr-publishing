'use client';

import { useState } from 'react';
import { TemplateList } from '@/components/templates/template-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateTemplate } from '@/hooks/use-templates';
import { Plus, X } from 'lucide-react';

export default function TemplatesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [useStandardSections, setUseStandardSections] = useState(true);

  const createTemplate = useCreateTemplate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTemplate.mutateAsync({
      name,
      isDefault,
      useStandardSections,
    });
    setShowCreate(false);
    setName('');
    setIsDefault(false);
    setUseStandardSections(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Structure Templates</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Create New Template</CardTitle>
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
                <label className="text-sm font-medium text-gray-700">
                  Template Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Phase 3 FDA Standard"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useStandardSections"
                  checked={useStandardSections}
                  onChange={(e) => setUseStandardSections(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="useStandardSections" className="text-sm text-gray-700">
                  Start with ICH E3 standard sections (18 sections for Module 16)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-700">
                  Set as default template for new studies
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createTemplate.isPending}>
                  {createTemplate.isPending ? 'Creating...' : 'Create Template'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <TemplateList />
    </div>
  );
}
