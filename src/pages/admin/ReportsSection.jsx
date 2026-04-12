import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { AdminSection } from './AdminUI.jsx';

export default function ReportsSection({ reports, setReports, reportsLoading, V, adminSupabase, selectedTenantId, fetchReports }) {
  const [reportsSearch, setReportsSearch] = useState('');
  const [editingReport, setEditingReport] = useState(null);
  const [reportForm, setReportForm] = useState({
    title: '', category: 'government', access: 'free', description: '', published_at: '', file_url: '',
  });
  const [reportFormStatus, setReportFormStatus] = useState('');
  const [reportFileUploading, setReportFileUploading] = useState(false);

  const resetReportEditor = useCallback(() => {
    setEditingReport(null);
    setReportForm({
      title: '',
      category: 'government',
      access: 'free',
      description: '',
      published_at: '',
      file_url: '',
    });
    setReportFormStatus('');
  }, []);

  const handleReportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !adminSupabase) return;
    setReportFileUploading(true);
    setReportFormStatus('Uploading file...');
    try {
      let safeName = file.name
        .replace(/\s+/g, '-')
        .replace(/[#?&%]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/-+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '')
        .slice(0, 100);

      if (!safeName) safeName = 'report-file.pdf';

      const filePath = `${Date.now()}_${safeName}`;
      const { data: uploadData, error: uploadError } = await adminSupabase.storage
        .from('sourcing-reports')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = adminSupabase.storage.from('sourcing-reports').getPublicUrl(uploadData.path);
      setReportForm(prev => ({ ...prev, file_url: publicUrl }));
      setReportFormStatus('File uploaded successfully. Save changes to update this report.');
    } catch (err) {
      setReportFormStatus('Error: ' + err.message);
    } finally {
      setReportFileUploading(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!adminSupabase || !editingReport) return;
    setReportFormStatus('Saving...');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('You must be signed in as an admin to update reports.');

      const payload = {
        title: reportForm.title.trim(),
        description: reportForm.description.trim() || null,
        category: reportForm.category || null,
        access: reportForm.access || 'free',
        file_url: reportForm.file_url.trim() || null,
        published_at: reportForm.published_at || null,
      };

      const response = await fetch(`/api/sourcing/admin-reports?id=${editingReport.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to update report.');

      setReports(prev => prev.map(report => report.id === editingReport.id ? result : report));
      setEditingReport(result);
      setReportForm({
        title: result.title || '',
        category: result.category || 'government',
        access: result.access || 'free',
        description: result.description || '',
        published_at: result.published_at ? result.published_at.slice(0, 10) : '',
        file_url: result.file_url || '',
      });
      setReportFormStatus('Report updated successfully.');
      await fetchReports();
    } catch (err) {
      setReportFormStatus('Error: ' + err.message);
    }
  };

  const handleReportEdit = (report) => {
    setEditingReport(report);
    setReportForm({
      title: report.title || '',
      category: report.category || 'government',
      access: report.access || 'free',
      description: report.description || '',
      published_at: report.published_at ? report.published_at.slice(0, 10) : '',
      file_url: report.file_url || '',
    });
    setReportFormStatus('');
  };

  const handleReportDelete = async (report) => {
    if (!adminSupabase) return;
    if (!window.confirm(`Delete "${report.title}"?`)) return;
    try {
      // Delete file from storage if present
      if (report.file_url) {
        const url = new URL(report.file_url);
        const pathParts = url.pathname.split('/object/public/reports/');
        if (pathParts.length === 2) {
          await adminSupabase.storage.from('reports').remove([pathParts[1]]);
        }
      }
      await adminSupabase.from('directory_reports').delete().eq('id', report.id);
      await fetchReports();
      resetReportEditor();
    } catch (err) {
      console.error('Delete report error:', err);
    }
  };

  return (
    <AdminSection
      title="Directory Reports"
      V={V}
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={reportsSearch}
            onChange={e => setReportsSearch(e.target.value)}
            placeholder="Search reports by title or category..."
            style={{
              width: 220, maxWidth: '45vw', background: V.card2, border: `1px solid ${V.border}`,
              borderRadius: 6, padding: '7px 10px', color: V.text,
              fontSize: 12, fontFamily: V.space, outline: 'none',
            }}
          />
          <button
            onClick={resetReportEditor}
            style={{
              background: 'transparent', border: `1px solid ${V.border}`,
              color: V.muted, borderRadius: 6, padding: '5px 12px',
              fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
            }}
          >
            Clear Selection
          </button>
        </div>
      }
    >
      {reportFormStatus && (
        <div style={{
          marginBottom: 16,
          background: reportFormStatus.startsWith('Error') ? 'rgba(239,68,68,0.12)' : V.accentDim,
          border: reportFormStatus.startsWith('Error') ? '1px solid rgba(239,68,68,0.35)' : `1px solid ${V.accentBrd}`,
          color: reportFormStatus.startsWith('Error') ? '#FCA5A5' : V.accent,
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: 12,
          fontFamily: V.mono,
        }}>
          {reportFormStatus}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${V.border}`, background: V.card2 }}>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Existing Reports
            </div>
          </div>
          <div style={{ maxHeight: 620, overflowY: 'auto' }}>
            {reportsLoading && (
              <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>Loading...</div>
            )}
            {!reportsLoading && reports.filter(report => {
              const query = reportsSearch.trim().toLowerCase();
              if (!query) return true;
              return [report.title, report.category, report.access, report.description]
                .filter(Boolean)
                .some(value => value.toLowerCase().includes(query));
            }).map(report => {
              const isSelected = editingReport?.id === report.id;
              const fileName = report.file_url ? report.file_url.split('/').pop() : '';
              return (
                <button
                  key={report.id}
                  onClick={() => handleReportEdit(report)}
                  style={{
                    width: '100%', textAlign: 'left', background: isSelected ? `${V.accent}12` : 'transparent',
                    border: 'none', borderLeft: isSelected ? `3px solid ${V.accent}` : '3px solid transparent',
                    borderBottom: `1px solid ${V.border}`, padding: '14px 16px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.space, color: isSelected ? V.accent : V.text, lineHeight: 1.4 }}>
                      {report.title}
                    </div>
                    <span style={{
                      background: (report.access || 'free') === 'free' || report.access === 'public' ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                      border: `1px solid ${(report.access || 'free') === 'free' || report.access === 'public' ? 'rgba(34,197,94,0.35)' : 'rgba(59,130,246,0.35)'}`,
                      color: (report.access || 'free') === 'free' || report.access === 'public' ? '#86EFAC' : '#93C5FD',
                      fontSize: 10, fontWeight: 700, fontFamily: V.mono, padding: '2px 7px', borderRadius: 999,
                      textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                    }}>
                      {report.access === 'public' ? 'free' : (report.access || 'free')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: V.dim, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {report.category || 'uncategorized'}
                    </span>
                    <span style={{ fontSize: 10, color: V.dim, fontFamily: V.mono }}>
                      {report.published_at ? new Date(report.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No publish date'}
                    </span>
                  </div>
                  {fileName && (
                    <div style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fileName}
                    </div>
                  )}
                </button>
              );
            })}
            {!reportsLoading && reports.filter(report => {
              const query = reportsSearch.trim().toLowerCase();
              if (!query) return true;
              return [report.title, report.category, report.access, report.description]
                .filter(Boolean)
                .some(value => value.toLowerCase().includes(query));
            }).length === 0 && (
              <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>No reports match your search.</div>
            )}
          </div>
        </div>

        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '20px 24px' }}>
          {!editingReport ? (
            <div style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
                  Select a report to edit
                </div>
                <div style={{ fontSize: 13, fontFamily: V.space, color: V.dim, maxWidth: 420, lineHeight: 1.6 }}>
                  Choose a report from the list to update its title, description, category, access level, published date, or replace the attached PDF.
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReportSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading }}>Edit Report</div>
                  <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, marginTop: 4 }}>Report ID: {editingReport.id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleReportDelete(editingReport)}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#FCA5A5', borderRadius: 6, padding: '6px 10px',
                    fontSize: 11, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Title *</div>
                <input
                  required
                  value={reportForm.title}
                  onChange={e => setReportForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Report title"
                  style={{
                    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
                    borderRadius: 6, padding: '9px 10px', color: V.text,
                    fontSize: 13, fontFamily: V.space, outline: 'none',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Category</div>
                <select
                  value={reportForm.category}
                  onChange={e => setReportForm(p => ({ ...p, category: e.target.value }))}
                  style={{
                    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
                    borderRadius: 6, padding: '9px 10px', color: V.text,
                    fontSize: 13, fontFamily: V.space, outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="government">Government Affairs</option>
                  <option value="acquisition">Acquisitions & Contracts</option>
                  <option value="economic">Economic Development</option>
                  <option value="quarterly">Quarterly Intelligence</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Access</div>
                <select
                  value={reportForm.access}
                  onChange={e => setReportForm(p => ({ ...p, access: e.target.value }))}
                  style={{
                    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
                    borderRadius: 6, padding: '9px 10px', color: V.text,
                    fontSize: 13, fontFamily: V.space, outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="free">Free</option>
                  <option value="member">Members Only</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Published Date</div>
                <input
                  type="date"
                  value={reportForm.published_at}
                  onChange={e => setReportForm(p => ({ ...p, published_at: e.target.value }))}
                  style={{
                    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
                    borderRadius: 6, padding: '9px 10px', color: V.text,
                    fontSize: 13, fontFamily: V.space, outline: 'none',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Current File</div>
                <div style={{
                  minHeight: 40, background: V.card2, border: `1px solid ${V.border}`,
                  borderRadius: 6, padding: '10px', color: reportForm.file_url ? V.accent : V.dim,
                  fontSize: 11, fontFamily: V.mono, display: 'flex', alignItems: 'center',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {reportForm.file_url ? reportForm.file_url.split('/').pop() : 'No file attached'}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Replace PDF</div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleReportFileChange}
                  disabled={reportFileUploading}
                  style={{
                    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
                    borderRadius: 6, padding: '8px 10px', color: V.muted,
                    fontSize: 12, fontFamily: V.space, cursor: reportFileUploading ? 'not-allowed' : 'pointer',
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description</div>
                <textarea
                  value={reportForm.description}
                  onChange={e => setReportForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of the report"
                  rows={5}
                  style={{
                    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
                    borderRadius: 6, padding: '10px', color: V.text,
                    fontSize: 13, fontFamily: V.space, outline: 'none', resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                <button
                  type="submit"
                  disabled={reportFileUploading}
                  style={{
                    background: V.accent, border: 'none', color: '#fff',
                    borderRadius: 6, padding: '9px 18px', fontSize: 13,
                    fontWeight: 700, fontFamily: V.space, cursor: reportFileUploading ? 'not-allowed' : 'pointer',
                    opacity: reportFileUploading ? 0.6 : 1,
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={resetReportEditor}
                  style={{
                    background: 'transparent', border: `1px solid ${V.border}`, color: V.muted,
                    borderRadius: 6, padding: '9px 16px', fontSize: 13,
                    fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AdminSection>
  );
}
