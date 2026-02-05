'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  HardDrive,
  FileCheck,
  FolderTree,
  Star,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  version: number;
  isDefault: boolean;
}

interface ValidationRule {
  id: string;
  name: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: templates, isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates');
      const json = await res.json();
      return json.data || [];
    },
  });

  const { data: rules, isLoading: rulesLoading } = useQuery<ValidationRule[]>({
    queryKey: ['validation-rules'],
    queryFn: async () => {
      const res = await fetch('/api/validation-rules');
      const json = await res.json();
      return json.data || [];
    },
  });

  const setDefaultTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const defaultTemplate = templates?.find(t => t.isDefault);
  const activeRulesCount = rules?.filter(r => r.isActive).length || 0;
  const totalRulesCount = rules?.length || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage application configuration</p>
      </div>

      <div className="grid gap-6">
        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Application Info
            </CardTitle>
            <CardDescription>System information and status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Application</p>
                <p className="text-sm">CSR Publishing</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Database</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                    Connected
                  </Badge>
                  <span className="text-sm text-muted-foreground">SQLite</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Version</p>
                <p className="text-sm">1.0.0</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Environment</p>
                <p className="text-sm">{process.env.NODE_ENV || 'development'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage
            </CardTitle>
            <CardDescription>File upload configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Max File Size</p>
                <p className="text-sm">100 MB</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Allowed Types</p>
                <p className="text-sm">PDF, DOCX, DOC, TXT, CSV, RTF, XPT</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Default Template
            </CardTitle>
            <CardDescription>Template automatically assigned to new studies</CardDescription>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="animate-pulse h-10 bg-muted rounded" />
            ) : templates && templates.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                  <div className="flex items-center gap-3">
                    {defaultTemplate ? (
                      <>
                        <Star className="h-5 w-5 text-warning fill-warning" />
                        <div>
                          <p className="font-medium">{defaultTemplate.name}</p>
                          <p className="text-sm text-muted-foreground">Version {defaultTemplate.version}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-foreground/70">No default template set</p>
                    )}
                  </div>
                  <Link href="/templates">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Manage Templates
                    </Button>
                  </Link>
                </div>

                {!defaultTemplate && templates.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-foreground/70 mb-3">Select a default template:</p>
                    <div className="space-y-2">
                      {templates.slice(0, 5).map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between p-2 hover:bg-muted/40 rounded"
                        >
                          <span className="text-sm">{template.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultTemplate.mutate(template.id)}
                            disabled={setDefaultTemplate.isPending}
                          >
                            Set as Default
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-3">No templates created yet</p>
                <Link href="/templates">
                  <Button>Create Template</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validation Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Validation Rules
            </CardTitle>
            <CardDescription>PDF compliance and formatting checks</CardDescription>
          </CardHeader>
          <CardContent>
            {rulesLoading ? (
              <div className="animate-pulse h-10 bg-muted rounded" />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted/40 rounded-lg text-center">
                    <p className="text-2xl font-bold text-foreground">{totalRulesCount}</p>
                    <p className="text-sm text-muted-foreground">Total Rules</p>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg text-center">
                    <p className="text-2xl font-bold text-success">{activeRulesCount}</p>
                    <p className="text-sm text-success">Active</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg text-center">
                    <p className="text-2xl font-bold text-muted-foreground/70">{totalRulesCount - activeRulesCount}</p>
                    <p className="text-sm text-muted-foreground">Inactive</p>
                  </div>
                </div>

                {rules && rules.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-foreground/80 mb-2">Recent Rules</p>
                    <div className="space-y-1">
                      {rules.slice(0, 5).map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="text-sm">{rule.name}</span>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh All Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
