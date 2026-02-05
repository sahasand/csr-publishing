'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useStudy } from '@/hooks/use-studies';
import { useStudyDocuments } from '@/hooks/use-documents';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DocumentViewer } from '@/components/studies/document-viewer';
import { DocumentUpload } from '@/components/studies/document-upload';
import { ExportButton } from '@/components/packaging/export-button';
import { formatBytes } from '@/lib/utils';
import {
  ArrowLeft,
  Loader2,
  FileText,
  FolderTree,
  Info,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
} from 'lucide-react';
import type { StructureNode, Document } from '@/types';
import { StudyValidationPanel } from '@/components/studies/study-validation-panel';

interface Template {
  id: string;
  name: string;
  version: number;
  isDefault: boolean;
}

export default function StudyWorkspacePage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data: study, isLoading, error } = useStudy(id);
  const { data: documents = [] } = useStudyDocuments(id);

  // Fetch available templates for assignment
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates');
      const json = await res.json();
      return json.data || [];
    },
    enabled: !study?.activeTemplate, // Only fetch if no template assigned
  });

  // Mutation to assign template
  const assignTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/studies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeTemplateId: templateId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies', id] });
    },
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  // Find the selected node from the template nodes
  const selectedNode = selectedNodeId && study?.activeTemplate?.nodes
    ? study.activeTemplate.nodes.find((node: StructureNode) => node.id === selectedNodeId)
    : null;

  // Get documents for the selected node
  const nodeDocuments = useMemo(() => {
    if (!selectedNodeId || !documents) return [];
    return documents
      .filter((doc: Document) => doc.slotId === selectedNodeId)
      .sort((a: Document, b: Document) => b.version - a.version);
  }, [selectedNodeId, documents]);

  // Calculate section progress
  const sectionProgress = useMemo(() => {
    if (!study?.activeTemplate?.nodes || !documents) return { filled: 0, total: 0 };
    const nodes = study.activeTemplate.nodes;
    const filledSections = new Set(documents.map((d: Document) => d.slotId));
    return {
      filled: filledSections.size,
      total: nodes.length,
    };
  }, [study?.activeTemplate?.nodes, documents]);

  // Handle document selection
  const handleSelectDocument = (documentId: string) => {
    setSelectedDocumentId(documentId);
  };

  // Handle back from document viewer
  const handleBackFromViewer = () => {
    setSelectedDocumentId(null);
  };

  // Handle upload complete
  const handleUploadComplete = () => {
    // Refresh documents list (correct query key from use-documents.ts)
    queryClient.invalidateQueries({ queryKey: ['documents', 'study', id] });
    // Also refresh study data
    queryClient.invalidateQueries({ queryKey: ['studies', id] });
  };

  // Check if a node has documents
  const nodeHasDocuments = (nodeId: string) => {
    return documents.some((doc: Document) => doc.slotId === nodeId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/studies">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Studies
          </Button>
        </Link>
        <div className="text-center py-12 text-destructive">
          Failed to load study: {error.message}
        </div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="space-y-4">
        <Link href="/studies">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Studies
          </Button>
        </Link>
        <div className="text-center py-12 text-muted-foreground">
          Study not found
        </div>
      </div>
    );
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'ARCHIVED':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // If no template assigned, auto-assign if only one exists, otherwise show picker
  if (!study.activeTemplate) {
    // Auto-assign if there's exactly one template
    if (templates.length === 1 && !assignTemplate.isPending && !assignTemplate.isSuccess) {
      assignTemplate.mutate(templates[0].id);
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
          <span className="ml-3 text-muted-foreground">Setting up study...</span>
        </div>
      );
    }

    // No templates - need to create one first
    if (templates.length === 0) {
      return (
        <div className="max-w-md mx-auto py-12 text-center">
          <Link href="/studies" className="inline-block mb-6">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>

          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderTree className="h-8 w-8 text-warning" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Create a Template First</h2>
          <p className="text-muted-foreground mb-6">
            A template defines the document sections for your study (like "Protocol", "Statistical Analysis Plan", etc.)
          </p>
          <Link href="/templates">
            <Button size="lg">
              <FolderTree className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </Link>
        </div>
      );
    }

    // Multiple templates - let user pick
    return (
      <div className="max-w-lg mx-auto py-12">
        <Link href="/studies" className="inline-block mb-6">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <h2 className="text-xl font-bold text-foreground mb-2">Choose Document Structure</h2>
        <p className="text-muted-foreground mb-6">
          Select which sections this study should have:
        </p>

        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => assignTemplate.mutate(template.id)}
              disabled={assignTemplate.isPending}
              className="w-full flex items-center justify-between p-4 border border-border rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors text-left disabled:opacity-50"
            >
              <div>
                <p className="font-medium text-foreground">{template.name}</p>
                <p className="text-sm text-muted-foreground">Version {template.version}</p>
              </div>
              {template.isDefault && (
                <Badge variant="outline">Recommended</Badge>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // If a document is selected, show the document viewer in full-screen mode
  if (selectedDocumentId) {
    return (
      <div className="h-full flex flex-col -m-8">
        {/* Document Viewer Header */}
        <header className="flex-shrink-0 border-b border-border bg-card px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackFromViewer}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Study
            </Button>
            <div className="h-4 w-px bg-muted/60" />
            <span className="text-sm text-muted-foreground">
              {study.studyId}
              {selectedNode && (
                <>
                  <span className="mx-2 text-muted-foreground/70">/</span>
                  <span className="font-mono text-xs">{selectedNode.code}</span>
                  <span className="mx-1">-</span>
                  {selectedNode.title}
                </>
              )}
            </span>
          </div>
        </header>

        {/* Document Viewer */}
        <div className="flex-1 overflow-hidden">
          <DocumentViewer documentId={selectedDocumentId} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col -m-8">
      {/* Study Header */}
      <header className="flex-shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/studies">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">
                  {study.studyId}
                </h1>
                <Badge variant={getStatusVariant(study.status)}>
                  {study.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {study.sponsor}
                {study.therapeuticArea && ` | ${study.therapeuticArea}`}
                {study.phase && ` | ${study.phase}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {sectionProgress.filled} of {sectionProgress.total} sections filled
            </span>
            <ExportButton studyId={id} />
          </div>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Structure Tree */}
        <aside className="w-[280px] flex-shrink-0 border-r border-border bg-muted/40 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm text-foreground/80">
                Document Sections
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Click a section to upload or view documents
            </p>

            <div className="space-y-1">
              {study.activeTemplate.nodes?.filter((node: StructureNode) => !node.parentId).map((node: StructureNode) => {
                const hasDoc = nodeHasDocuments(node.id);
                const isSelected = selectedNodeId === node.id;

                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                      isSelected
                        ? 'bg-primary/10 text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {hasDoc ? (
                      <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs text-muted-foreground/70 mr-1">
                        {node.code}
                      </span>
                      <span className="truncate">{node.title}</span>
                    </div>
                    {isSelected && (
                      <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
              {(!study.activeTemplate.nodes || study.activeTemplate.nodes.length === 0) && (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No sections in template</p>
                  <Link href={`/templates/${study.activeTemplate.id}`}>
                    <Button variant="outline" size="sm" className="mt-2">
                      Edit Template
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Center Panel - Document Workspace */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6">
            {selectedNode ? (
              <div className="space-y-6">
                {/* Section Header */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <span>Section</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="font-mono">{selectedNode.code}</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {selectedNode.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedNode.documentType && (
                      <Badge variant="outline">{selectedNode.documentType}</Badge>
                    )}
                    {selectedNode.required && (
                      <Badge variant="destructive">Required</Badge>
                    )}
                  </div>
                </div>

                {/* Upload Area */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Upload Document for "{selectedNode.title}"
                    </CardTitle>
                    <CardDescription>
                      {selectedNode.documentType === 'PDF'
                        ? 'Upload a PDF file for this section'
                        : selectedNode.documentType === 'DATASET'
                        ? 'Upload a dataset file (.xpt, .csv) for this section'
                        : 'Upload a document for this section (PDF, Word, CSV, etc.)'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DocumentUpload
                      studyId={id}
                      slotId={selectedNode.id}
                      onUploadComplete={handleUploadComplete}
                    />
                  </CardContent>
                </Card>

                {/* Existing Documents */}
                {nodeDocuments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Uploaded Documents ({nodeDocuments.length})
                      </CardTitle>
                      <CardDescription>
                        Documents already uploaded to this section
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {nodeDocuments.map((doc: Document) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 bg-muted/40 rounded-lg hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-5 w-5 text-muted-foreground/70 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {doc.sourceFileName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  v{doc.version} | {formatBytes(doc.fileSize)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant={
                                  doc.status === 'APPROVED' || doc.status === 'PUBLISHED'
                                    ? 'success'
                                    : doc.status === 'PROCESSING'
                                    ? 'warning'
                                    : 'secondary'
                                }
                              >
                                {doc.status}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectDocument(doc.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              /* No Section Selected - Show Instructions */
              <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
                <div className="max-w-md text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ChevronLeft className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Select a Section
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Choose a section from the list on the left to upload documents.
                    Each section represents a part of your submission package.
                  </p>

                  <div className="bg-muted/40 rounded-lg p-4 text-left">
                    <p className="text-sm font-medium text-foreground/80 mb-2">How it works:</p>
                    <ol className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                        <span>Click a section in the left panel</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                        <span>Upload a document (PDF, Word, etc.)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
                        <span>Repeat for each section</span>
                      </li>
                    </ol>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-muted-foreground">= section has a document</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Panel - Context Sidebar */}
        <aside className="w-[280px] flex-shrink-0 border-l border-border bg-muted/40 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm text-foreground/80">
                Study Info
              </h2>
            </div>

            <div className="space-y-4">
              {/* Progress */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground/80">Progress</span>
                    <span className="text-sm text-muted-foreground">
                      {sectionProgress.filled}/{sectionProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-muted/60 rounded-full h-2">
                    <div
                      className="bg-success h-2 rounded-full transition-all"
                      style={{
                        width: `${sectionProgress.total > 0
                          ? (sectionProgress.filled / sectionProgress.total) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {sectionProgress.total - sectionProgress.filled} sections remaining
                  </p>
                </CardContent>
              </Card>

              {/* Study Validation Dashboard */}
              <StudyValidationPanel
                studyId={id}
                onDocumentClick={(documentId) => {
                  setSelectedDocumentId(documentId);
                }}
              />

              {/* Study Metadata */}
              <Card>
                <CardContent className="pt-4">
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Study ID</dt>
                      <dd className="font-medium text-foreground">{study.studyId}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Sponsor</dt>
                      <dd className="font-medium text-foreground">{study.sponsor}</dd>
                    </div>
                    {study.therapeuticArea && (
                      <div>
                        <dt className="text-muted-foreground">Therapeutic Area</dt>
                        <dd className="font-medium text-foreground">{study.therapeuticArea}</dd>
                      </div>
                    )}
                    {study.phase && (
                      <div>
                        <dt className="text-muted-foreground">Phase</dt>
                        <dd className="font-medium text-foreground">{study.phase}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* Template Info */}
              {study.activeTemplate && (
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground mb-1">Template</p>
                    <p className="text-sm font-medium text-foreground">
                      {study.activeTemplate.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      v{study.activeTemplate.version} | {study.activeTemplate.nodes?.length || 0} sections
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
