# Report Filename Storage and URL Generation Convention

## Overview
This document defines the canonical convention for storing report files and generating download URLs in the Sourcing Directory platform. The goal is to ensure consistent, reliable file access and eliminate "File not found" errors.

## Current Implementation Status
- **Storage System**: Supabase Storage (bucket: `sourcing-reports`)
- **Database Column**: `directory_reports.file_url` (text)
- **Frontend Usage**: Direct link via `<a href="{report.file_url}">` in `SourcingReports.jsx`
- **Admin Upload**: Via `upload-report.js` API endpoint (admin-only)

## Canonical Filename Format

### Storage Path Pattern
```
{report_id}/{timestamp}_{sanitized-filename}.{ext}
```

### Components
1. **`report_id`**: UUID of the report record in `directory_reports` table
2. **`timestamp`**: Unix timestamp in milliseconds (`Date.now()`)
3. **`sanitized-filename`**: Original filename after sanitization (see rules below)
4. **`ext`**: Original file extension (lowercased)

### Examples
| Original Filename | Stored Filename |
|-------------------|-----------------|
| `S3C Q1 2026 Market Report.docx` | `eedc3008-.../1744387200000_S3C-Q1-2026-Market-Report.docx` |
| `Federal_Appropriations_Analysis.pdf` | `a1b2c3d4-.../1744473600000_Federal_Appropriations_Analysis.pdf` |
| `Quarterly Intel #2026-Q1.pdf` | `d5e6f7a8-.../1744560000000_Quarterly-Intel-2026-Q1.pdf` |

## Sanitization Rules

The sanitization process in `upload-report.js` applies these transformations:

1. **Replace spaces with dashes**: `\s+` → `-`
2. **Remove problematic URL characters**: `[#?&%]` → `''` (empty)
3. **Replace other unsafe characters**: `[^a-zA-Z0-9._-]` → `_`
4. **Collapse multiple dashes**: `-+` → `-`
5. **Trim leading/trailing special chars**: `^[-_.]+|[-_.]+$` → `''`
6. **Length limit**: Slice to 100 characters

### Sanitization Examples
| Original | Sanitized |
|----------|-----------|
| `Q1 2026 Report #Final.docx` | `Q1-2026-Report-Final.docx` |
| `Gov't Analysis & Review.pdf` | `Gov_t-Analysis-Review.pdf` |
| `___test-file__.pdf` | `test-file.pdf` |

## URL Construction

### Public Download URL Format
```
{SUPABASE_URL}/storage/v1/object/public/sourcing-reports/{report_id}/{timestamp}_{sanitized-filename}.{ext}
```

Where:
- `{SUPABASE_URL}`: `https://kzzvjtthknsozktmpvak.supabase.co`
- `sourcing-reports`: Fixed bucket name

### Full URL Examples
| Component | Value |
|-----------|-------|
| SUPABASE_URL | `https://kzzvjtthknsozktmpvak.supabase.co` |
| Bucket | `sourcing-reports` |
| Report ID | `eedc3008-1234-5678-90ab-cdef12345678` |
| Timestamp | `1744387200000` |
| Sanitized Filename | `S3C-Q1-2026-Market-Report.docx` |
| **Full URL** | `https://kzzvjtthknsozktmpvak.supabase.co/storage/v1/object/public/sourcing-reports/eedc3008-1234-5678-90ab-cdef12345678/1744387200000_S3C-Q1-2026-Market-Report.docx` |

## Implementation Details

### 1. Upload Flow (`upload-report.js`)
```javascript
// Step 1: Sanitize filename
let safeName = filename
  .replace(/\s+/g, '-')
  .replace(/[#?&%]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_')
  .replace(/-+/g, '-')
  .replace(/^[-_.]+|[-_.]+$/g, '')
  .slice(0, 100);

// Step 2: Construct storage path
const path = `${report_id}/${Date.now()}_${safeName}`;

// Step 3: Generate public URL
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
```

### 2. Database Storage
The `publicUrl` is stored in `directory_reports.file_url` column via the `save-url` action.

### 3. Frontend Access (`SourcingReports.jsx`)
```jsx
<a href={report.file_url} target="_blank" rel="noopener noreferrer">
  Download Report
</a>
```

## Migration from Legacy System

### Issue Identified
The migration file `015_reports_add_file_url.sql` contains a legacy file URL pointing to `rag.aheadofmarket.com`:
```sql
file_url = 'https://rag.aheadofmarket.com/files/shared:sourcing/eedc3008-S3C%20Quarterly%20Market%20Intelligence%20Report.docx'
```

This causes "File not found" errors because:
1. The RAG server URL format doesn't match Supabase Storage format
2. Files uploaded via the admin panel use Supabase Storage
3. The frontend treats all `file_url` values equally

### Resolution
1. **New uploads**: Use Supabase Storage (canonical convention)
2. **Existing legacy URLs**: Keep as-is but may not work
3. **Future-proofing**: All new reports should use the canonical Supabase Storage URLs

## Validation Rules

### URL Validation in `upload-report.js`
```javascript
if (!file_url.includes(SUPABASE_URL) && !file_url.includes('supabase.co')) {
  return res.status(400).json({ 
    error: 'Invalid file_url: must be a Supabase Storage URL' 
  });
}
```

### Bucket Configuration
- **Name**: `sourcing-reports`
- **Public**: `true` (allows direct downloads)
- **File size limit**: 50 MB
- **Allowed MIME types**: `application/pdf`, `application/octet-stream`

## Testing Examples

### Test Case 1: Basic Document
- **Original**: `Market Analysis Q1.pdf`
- **Sanitized**: `Market-Analysis-Q1.pdf`
- **Report ID**: `abc123...`
- **Timestamp**: `1744387200000`
- **Path**: `abc123.../1744387200000_Market-Analysis-Q1.pdf`
- **URL**: `https://kzzvjtthknsozktmpvak.supabase.co/storage/v1/object/public/sourcing-reports/abc123.../1744387200000_Market-Analysis-Q1.pdf`

### Test Case 2: Complex Filename
- **Original**: `Gov't Report #2026 & Analysis.docx`
- **Sanitized**: `Gov_t-Report-2026-Analysis.docx`
- **Report ID**: `def456...`
- **Timestamp**: `1744473600000`
- **Path**: `def456.../1744473600000_Gov_t-Report-2026-Analysis.docx`
- **URL**: `https://kzzvjtthknsozktmpvak.supabase.co/storage/v1/object/public/sourcing-reports/def456.../1744473600000_Gov_t-Report-2026-Analysis.docx`

### Test Case 3: Legacy Migration
- **Original**: `S3C Quarterly Market Intelligence Report.docx`
- **Legacy URL**: `https://rag.aheadofmarket.com/files/shared:sourcing/eedc3008-S3C%20Quarterly%20Market%20Intelligence%20Report.docx`
- **Status**: Incompatible with new system - will cause "File not found"

## Team Review & Agreement

**Reviewed by**: Ben Smith (S3C/Arsenal GPA), Patrik (AOM)
**Date**: 2026-04-12
**Decision**: Adopt Supabase Storage canonical convention for all new report uploads. Legacy RAG server URLs will remain but may not function. Future migration may be needed to move legacy files to Supabase Storage.

## Maintenance Notes

1. **Bucket Management**: Ensure `sourcing-reports` bucket exists and is public
2. **File Deletion**: Implement cleanup for deleted reports
3. **Backup**: Regular backups of Supabase Storage bucket
4. **Monitoring**: Track download failures to identify legacy URL issues

## Related Files
- `api/sourcing/upload-report.js` - File upload implementation
- `src/pages/SourcingReports.jsx` - Frontend download links
- `src/pages/SourcingAdmin.jsx` - Admin report management
- `migrations/015_reports_add_file_url.sql` - Legacy file URL migration