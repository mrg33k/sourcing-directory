import React from 'react';
import { AdminSection } from './AdminUI.jsx';

export default function ArticlesSection({ pendingArticles, articleCompanyMap, handleArticleAction, V }) {
  return (
    <AdminSection title={`Pending Content (${pendingArticles.length})`} V={V}>
      {pendingArticles.length === 0 ? (
        <div style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 10, padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 6 }}>
            No pending content
          </div>
          <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
            All submitted content has been reviewed.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingArticles.map(article => {
            const company = articleCompanyMap[article.id];
            const postedDate = new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <div key={article.id} style={{
                background: V.card, border: `1px solid rgba(234,179,8,0.2)`,
                borderRadius: 10, padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 4 }}>
                      {article.title}
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: V.mono,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '2px 8px', borderRadius: 4,
                        background: article.category === 'article' ? 'rgba(59,130,246,0.15)' : article.category === 'job' ? 'rgba(16,185,129,0.15)' : article.category === 'event' ? 'rgba(168,85,247,0.15)' : 'rgba(234,179,8,0.15)',
                        color: article.category === 'article' ? '#93C5FD' : article.category === 'job' ? '#6EE7B7' : article.category === 'event' ? '#C4B5FD' : '#FDE68A',
                      }}>
                        {article.category || 'article'}
                      </span>
                      <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                        <span style={{ color: V.muted, fontWeight: 600 }}>Author</span>{' '}
                        {company?.name || 'Unknown Company'}
                      </span>
                      <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                        <span style={{ color: V.muted, fontWeight: 600 }}>Submitted</span>{' '}
                        {postedDate}
                      </span>
                      {article.vertical && (
                        <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                          {article.vertical}
                        </span>
                      )}
                      {article.read_time_min && (
                        <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                          {article.read_time_min} min read
                        </span>
                      )}
                    </div>
                    {article.excerpt && (
                      <div style={{
                        fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {article.excerpt}
                      </div>
                    )}
                    {!article.excerpt && article.body && (
                      <div style={{
                        fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {article.body}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => handleArticleAction(article.id, 'approve')} style={{
                      background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                      color: '#86EFAC', borderRadius: 6, padding: '6px 14px', fontSize: 12,
                      fontWeight: 700, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                      Approve
                    </button>
                    <button onClick={() => handleArticleAction(article.id, 'reject')} style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#FCA5A5', borderRadius: 6, padding: '6px 14px', fontSize: 12,
                      fontWeight: 700, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminSection>
  );
}
