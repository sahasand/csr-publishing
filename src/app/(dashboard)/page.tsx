'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import {
  FileText,
  FolderTree,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Plus,
  Upload,
  Package,
} from 'lucide-react';

interface Study {
  id: string;
  studyId: string;
  sponsor: string;
  status: string;
  _count?: { documents: number };
}

interface Template {
  id: string;
  name: string;
  isDefault: boolean;
}

export default function DashboardPage() {
  const { data: studies = [], isLoading: studiesLoading } = useQuery<Study[]>({
    queryKey: ['studies'],
    queryFn: async () => {
      const res = await fetch('/api/studies');
      const json = await res.json();
      return json.data || [];
    },
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates');
      const json = await res.json();
      return json.data || [];
    },
  });

  const isLoading = studiesLoading || templatesLoading;

  const activeStudies = studies.filter(s => s.status === 'ACTIVE');
  const totalDocuments = studies.reduce((acc, s) => acc + (s._count?.documents || 0), 0);
  const hasDefaultTemplate = templates.some(t => t.isDefault);

  // Determine workflow state
  const workflowState = {
    hasTemplates: templates.length > 0,
    hasDefaultTemplate,
    hasStudies: studies.length > 0,
    hasDocuments: totalDocuments > 0,
  };

  const getNextStep = () => {
    if (!workflowState.hasTemplates) return 'template';
    if (!workflowState.hasStudies) return 'study';
    if (!workflowState.hasDocuments) return 'upload';
    return 'review';
  };

  const nextStep = getNextStep();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-[110px]" />
          ))}
        </div>

        <SkeletonCard className="h-[220px]" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard className="h-[260px]" />
          <SkeletonCard className="h-[260px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Clinical Study Report Publishing</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Studies
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStudies.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Templates
            </CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Documents
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocuments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Guide */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>Follow these steps to prepare your submission package</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Step 1: Template */}
            <div className={`relative p-4 rounded-lg border-2 ${
              nextStep === 'template'
                ? 'border-primary bg-primary/10'
                : workflowState.hasTemplates
                  ? 'border-success/30 bg-success/10'
                  : 'border-border'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  workflowState.hasTemplates ? 'bg-success text-white' : 'bg-muted/60 text-muted-foreground'
                }`}>
                  {workflowState.hasTemplates ? '✓' : '1'}
                </div>
                <span className="font-medium">Create Template</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Define the eCTD document structure with sections and requirements
              </p>
              {nextStep === 'template' && (
                <Link href="/templates">
                  <Button size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Create Template
                  </Button>
                </Link>
              )}
              {workflowState.hasTemplates && (
                <Badge variant="success" className="absolute top-2 right-2">Done</Badge>
              )}
            </div>

            {/* Step 2: Study */}
            <div className={`relative p-4 rounded-lg border-2 ${
              nextStep === 'study'
                ? 'border-primary bg-primary/10'
                : workflowState.hasStudies
                  ? 'border-success/30 bg-success/10'
                  : 'border-border'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  workflowState.hasStudies ? 'bg-success text-white' : 'bg-muted/60 text-muted-foreground'
                }`}>
                  {workflowState.hasStudies ? '✓' : '2'}
                </div>
                <span className="font-medium">Create Study</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Set up your clinical study with protocol number and sponsor info
              </p>
              {nextStep === 'study' && (
                <Link href="/studies">
                  <Button size="sm" className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Create Study
                  </Button>
                </Link>
              )}
              {workflowState.hasStudies && (
                <Badge variant="success" className="absolute top-2 right-2">Done</Badge>
              )}
            </div>

            {/* Step 3: Upload */}
            <div className={`relative p-4 rounded-lg border-2 ${
              nextStep === 'upload'
                ? 'border-primary bg-primary/10'
                : workflowState.hasDocuments
                  ? 'border-success/30 bg-success/10'
                  : 'border-border'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  workflowState.hasDocuments ? 'bg-success text-white' : 'bg-muted/60 text-muted-foreground'
                }`}>
                  {workflowState.hasDocuments ? '✓' : '3'}
                </div>
                <span className="font-medium">Upload Documents</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Upload PDFs to each section, validate, and review
              </p>
              {nextStep === 'upload' && activeStudies.length > 0 && (
                <Link href={`/studies/${activeStudies[0].id}`}>
                  <Button size="sm" className="w-full">
                    <Upload className="h-4 w-4 mr-1" />
                    Open Study
                  </Button>
                </Link>
              )}
              {workflowState.hasDocuments && (
                <Badge variant="success" className="absolute top-2 right-2">Done</Badge>
              )}
            </div>

            {/* Step 4: Export */}
            <div className={`relative p-4 rounded-lg border-2 ${
              nextStep === 'review'
                ? 'border-primary bg-primary/10'
                : 'border-border'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-muted/60 text-muted-foreground">
                  4
                </div>
                <span className="font-medium">Export Package</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Generate eCTD-compliant ZIP package for submission
              </p>
              {nextStep === 'review' && activeStudies.length > 0 && (
                <Link href={`/studies/${activeStudies[0].id}`}>
                  <Button size="sm" className="w-full">
                    <Package className="h-4 w-4 mr-1" />
                    Review & Export
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Studies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Studies</CardTitle>
            <Link href="/studies">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {studies.length > 0 ? (
              <div className="space-y-3">
                {studies.slice(0, 5).map((study) => (
                  <Link
                    key={study.id}
                    href={`/studies/${study.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{study.studyId}</p>
                      <p className="text-sm text-muted-foreground">{study.sponsor}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={study.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {study.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground/70">
                        {study._count?.documents || 0} docs
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>No studies yet</p>
                <Link href="/studies">
                  <Button variant="outline" size="sm" className="mt-2">
                    Create your first study
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Templates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Templates</CardTitle>
            <Link href="/templates">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {templates.length > 0 ? (
              <div className="space-y-3">
                {templates.slice(0, 5).map((template) => (
                  <Link
                    key={template.id}
                    href={`/templates/${template.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-muted-foreground/70" />
                      <p className="font-medium text-foreground">{template.name}</p>
                    </div>
                    {template.isDefault && (
                      <Badge variant="outline">Default</Badge>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderTree className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>No templates yet</p>
                <Link href="/templates">
                  <Button variant="outline" size="sm" className="mt-2">
                    Create your first template
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
