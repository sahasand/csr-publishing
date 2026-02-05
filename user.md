# CSR Publishing - User Guide

## What Does This App Do?

CSR Publishing helps you prepare clinical study documents for regulatory submission (FDA, EMA, etc.) in the eCTD format.

**In simple terms:**
1. You create a folder structure (template) for your documents
2. You create a study and link it to that structure
3. You upload PDFs to the right folders
4. You export everything as a submission package

---

## Quick Start (4 Steps)

### Step 1: Create a Template

A template defines the document structure. Think of it as creating folders for your filing cabinet.

1. Go to **Templates** in the sidebar
2. Click **New Template**
3. Name it (e.g., "Phase 3 CSR")
4. Check "Set as default" so new studies use it automatically
5. Click **Create**

**Now add sections to your template:**
1. Click on your new template
2. Click **Add Node**
3. Add sections like:
   - Code: `16.1.1` | Title: `Protocol`
   - Code: `16.1.2` | Title: `Sample CRF`
   - Code: `16.2.1` | Title: `Statistical Analysis Plan`

Each section is a slot where you'll upload a document later.

---

### Step 2: Create a Study

A study represents one clinical trial. It uses the template structure.

1. Go to **Studies** in the sidebar
2. Click **New Study**
3. Fill in:
   - **Study ID**: Your protocol number (e.g., `ABC-001`)
   - **Sponsor**: Company name
4. Click **Create**

The study automatically gets the default template's structure.

---

### Step 3: Upload Documents

Now fill in the sections with your actual PDFs.

1. Click on your study to open it
2. You'll see three panels:
   - **Left**: Document sections (from your template)
   - **Center**: Documents for selected section
   - **Right**: Study info
3. Click a section on the left (e.g., "Protocol")
4. Click **Upload Document** in the center
5. Select your PDF file
6. Repeat for each section

---

### Step 4: Export Package

When all documents are uploaded and approved:

1. Open your study
2. Click **Export Package**
3. Download the ZIP file

The ZIP contains all your documents organized in eCTD folder structure.

---

## The Three-Panel Study View

When you open a study, you see:

```
┌─────────────────┬────────────────────────┬──────────────────┐
│                 │                        │                  │
│  SECTIONS       │  DOCUMENTS             │  STUDY INFO      │
│  (left panel)   │  (center panel)        │  (right panel)   │
│                 │                        │                  │
│  Click a        │  Shows documents       │  Shows study     │
│  section to     │  in the selected       │  details and     │
│  select it      │  section               │  statistics      │
│                 │                        │                  │
└─────────────────┴────────────────────────┴──────────────────┘
```

**Workflow:**
1. Click section on left → center shows that section's documents
2. Upload or view documents in center panel
3. Right panel shows context info

---

## Key Concepts

| Term | What It Means |
|------|---------------|
| **Template** | A reusable document structure (folder hierarchy) |
| **Node/Section** | One slot in the structure where a document goes |
| **Study** | One clinical trial project |
| **Document** | A PDF uploaded to a section |

---

## Document Status Flow

```
DRAFT → PROCESSING → PROCESSED → IN_REVIEW → APPROVED → PUBLISHED
```

- **DRAFT**: Just uploaded
- **PROCESSING**: System extracting metadata
- **PROCESSED**: Ready for review
- **IN_REVIEW**: Being reviewed
- **APPROVED**: Ready for submission
- **PUBLISHED**: Included in exported package

---

## Common Tasks

### View a Document
1. Open study → click section → see document list
2. Hover over document → click eye icon
3. Document opens in full-screen viewer

### Add Comments (Annotations)
1. Open a document in viewer
2. Click **Add Annotation** in right panel
3. Select type, page number, and enter comment
4. Click **Save**

### Change Document Status
1. Open document in viewer
2. Use status controls to mark as approved/rejected

---

## Tips

1. **Start with templates** - You can't create a useful study without a template first
2. **Use default template** - Mark one template as default so new studies get it automatically
3. **One document per section** - Each section holds one document (multiple versions supported)
4. **Check the dashboard** - The "How It Works" section shows your next step

---

## Troubleshooting

### "No template assigned" in study
Your study wasn't linked to a template. Go to Templates, create one, then it will be available for new studies.

### Upload button doesn't work
Make sure you've selected a section in the left panel first. You upload documents *into* a section.

### Can't find my document
Documents are organized by section. Click through the sections in the left panel to find it.

---

## Need Help?

Contact your system administrator.
