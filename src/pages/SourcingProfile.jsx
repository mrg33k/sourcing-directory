import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import { trackEvent } from './sourcingAnalytics.js';
import { getVerticalImage } from './SourcingLanding.jsx';

const VERTICALS = {
  semiconductor: { label: 'Semiconductor', color: '#29B6F6' },
  space:         { label: 'Space & Aerospace', color: '#7C3AED' },
  biotech:       { label: 'Biotech', color: '#22C55E' },
  defense:       { label: 'Defense', color: '#EF4444' },
};

const LISTING_ICONS = {
  equipment: '🔧',
  job:       '💼',
  event:     '📅',
  article:   '📄',
};

function verticalColor(v) {
  return VERTICALS[v]?.color || '#9ca3af';
}

function Chip({ children, color, V }) {
  return (
    <span style={{
      background: `${color || V.muted}15`,
      border: `1px solid ${color || V.muted}40`,
      color: color || V.muted,
      fontSize: 11, fontWeight: 600, fontFamily: V.mono,
      padding: '3px 9px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: '0.07em',
    }}>
      {children}
    </span>
  );
}

function CertGrid({ certs, V }) {
  if (!certs || certs.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {certs.map(cert => (
        <div key={cert.id} style={{
          background: V.accentDim,
          border: `1px solid ${V.accentBrd}`,
          borderRadius: 6, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: `${V.accent}20`,
            border: `1px solid ${V.accent}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: V.accent, flexShrink: 0,
          }}>
            ✓
          </div>
          <span style={{ fontSize: 12, color: V.text, fontFamily: V.mono }}>
            {cert.cert_name}
          </span>
        </div>
      ))}
    </div>
  );
}

function ListingCard({ listing, V }) {
  const icon = LISTING_ICONS[listing.category] || '📋';
  const isExpired = listing.expires_at && new Date(listing.expires_at) < new Date();

  return (
    <div style={{
      background: V.card2, border: `1px solid ${V.border}`,
      borderRadius: 8, padding: '14px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      opacity: isExpired ? 0.5 : 1,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: V.accentDim,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text, marginBottom: 4 }}>
          {listing.title}
        </div>
        {listing.description && (
          <div style={{
            fontSize: 12, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {listing.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Chip color={V.muted} V={V}>{listing.category}</Chip>
          {listing.price && (
            <span style={{ fontSize: 13, fontWeight: 700, color: V.accent, fontFamily: V.mono }}>
              ${listing.price.toLocaleString()}
            </span>
          )}
          {isExpired && <Chip color="#EF4444" V={V}>Expired</Chip>}
        </div>
      </div>
      {listing.contact_email && (
        <a
          href={`mailto:${listing.contact_email}`}
          style={{
            background: V.accent, color: '#fff', textDecoration: 'none',
            borderRadius: 5, padding: '5px 10px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, flexShrink: 0,
          }}
        >
          Contact
        </a>
      )}
    </div>
  );
}

function Section({ title, children, action, V }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${V.border}`,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, fontFamily: V.mono,
          color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Star Rating ─────────────────────────────────────────────────────────────
function StarRating({ rating, size = 14, interactive = false, onRate }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span
          key={i}
          onClick={interactive ? () => onRate(i) : undefined}
          style={{
            fontSize: size, color: i <= rating ? '#F59E0B' : 'rgba(255,255,255,0.15)',
            cursor: interactive ? 'pointer' : 'default',
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ─── Unclaimed Banner ────────────────────────────────────────────────────────
function UnclaimedBanner({ slug, tenantSlug, V }) {
  return (
    <div style={{
      border: '1px solid rgba(232,93,38,0.35)',
      background: 'rgba(232,93,38,0.06)',
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      marginBottom: 20,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: V.space, color: '#E85D26', marginBottom: 2 }}>
          Is this your business?
        </div>
        <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space }}>
          Claim this listing to update your info, add photos, and respond to reviews.
        </div>
      </div>
      <Link
        to={(tenantSlug ? `/${tenantSlug}/signup` : '/sc3/signup') + `?claim=${slug}`}
        style={{
          background: '#E85D26', color: '#fff', textDecoration: 'none',
          borderRadius: 6, padding: '7px 16px', fontSize: 12,
          fontWeight: 700, fontFamily: V.space, whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        Claim This Listing
      </Link>
    </div>
  );
}

// ─── Photo Gallery ───────────────────────────────────────────────────────────
function PhotoGallery({ photos, tier, V }) {
  const [lightboxIdx, setLightboxIdx] = useState(null);

  if (!photos || photos.length === 0) return null;

  const maxPhotos = tier === 'enterprise' ? 10 : tier === 'pro' ? 5 : tier === 'basic' ? 2 : 0;
  if (maxPhotos === 0) return null;

  const visiblePhotos = photos.slice(0, maxPhotos);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted,
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14,
        paddingBottom: 10, borderBottom: `1px solid ${V.border}`,
      }}>
        Photos ({visiblePhotos.length})
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: tier === 'enterprise' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
        gap: 8,
      }}>
        {visiblePhotos.map((url, i) => (
          <div
            key={i}
            onClick={() => setLightboxIdx(i)}
            style={{
              position: 'relative', borderRadius: 8, overflow: 'hidden',
              cursor: 'pointer', aspectRatio: '16/10',
              border: `1px solid ${V.border}`,
            }}
          >
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s ease' }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.04)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          onClick={() => setLightboxIdx(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '85vh' }}>
            <img
              src={visiblePhotos[lightboxIdx]}
              alt=""
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
            />
            <button
              onClick={() => setLightboxIdx(null)}
              style={{
                position: 'absolute', top: -16, right: -16,
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', borderRadius: '50%', width: 32, height: 32,
                cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
            {visiblePhotos.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.max(0, i - 1)); }}
                  style={{
                    position: 'absolute', left: -48, top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', borderRadius: 6, width: 36, height: 36,
                    cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ‹
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.min(visiblePhotos.length - 1, i + 1)); }}
                  style={{
                    position: 'absolute', right: -48, top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', borderRadius: 6, width: 36, height: 36,
                    cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reviews Section ─────────────────────────────────────────────────────────
function ReviewCard({ review, V }) {
  return (
    <div style={{
      background: V.card2, border: `1px solid ${V.border}`,
      borderRadius: 8, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <StarRating rating={review.rating} size={13} />
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: V.space, color: V.text }}>
              {review.reviewer_name}
            </span>
            {review.verified && (
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: V.mono,
                color: V.accent, background: `${V.accent}15`, border: `1px solid ${V.accent}30`,
                borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Verified
              </span>
            )}
          </div>
          {review.title && (
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.space, color: V.text, marginBottom: 6 }}>
              {review.title}
            </div>
          )}
          {review.body && (
            <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.6 }}>
              {review.body}
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
        {new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

function ReviewsSection({ companyId, reviews, V }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', rating: 5, title: '', body: '' });
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const PER_PAGE = 5;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const visibleReviews = reviews.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabase || !companyId) return;
    setStatus('sending');
    try {
      const { error } = await supabase.from('directory_reviews').insert({
        company_id: companyId,
        reviewer_name: form.name,
        reviewer_email: form.email || null,
        rating: form.rating,
        title: form.title || null,
        body: form.body || null,
        status: 'pending',
      });
      if (error) throw error;
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const inputStyle = (V) => ({
    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 7, padding: '9px 12px',
    fontSize: 13, fontFamily: V.space, boxSizing: 'border-box',
  });

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${V.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Reviews
          </div>
          {avgRating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <StarRating rating={Math.round(parseFloat(avgRating))} size={12} />
              <span style={{ fontSize: 12, color: V.text, fontFamily: V.mono }}>
                {avgRating} ({reviews.length})
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: V.accent, border: 'none', color: '#fff',
            borderRadius: 6, padding: '5px 14px', fontSize: 12,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}
        >
          Write a Review
        </button>
      </div>

      {reviews.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '28px 16px',
          background: V.card2, borderRadius: 8, border: `1px dashed ${V.border}`,
        }}>
          <div style={{ fontSize: 13, color: V.dim, fontFamily: V.space }}>No reviews yet. Be the first.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleReviews.map(r => <ReviewCard key={r.id} review={r} V={V} />)}
          </div>
          {reviews.length > PER_PAGE && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  background: 'transparent', border: `1px solid ${V.border}`,
                  color: page === 0 ? V.dim : V.muted, borderRadius: 5, padding: '5px 12px',
                  fontSize: 12, fontFamily: V.space, cursor: page === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: 12, color: V.dim, fontFamily: V.mono, alignSelf: 'center' }}>
                {page + 1} / {Math.ceil(reviews.length / PER_PAGE)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * PER_PAGE >= reviews.length}
                style={{
                  background: 'transparent', border: `1px solid ${V.border}`,
                  color: (page + 1) * PER_PAGE >= reviews.length ? V.dim : V.muted, borderRadius: 5, padding: '5px 12px',
                  fontSize: 12, fontFamily: V.space, cursor: (page + 1) * PER_PAGE >= reviews.length ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Write a Review Modal */}
      {showModal && (
        <div
          onClick={() => { setShowModal(false); setStatus(''); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: V.bg, border: `1px solid ${V.border}`,
              borderRadius: 12, padding: '28px 24px',
              width: '100%', maxWidth: 480,
              maxHeight: '85vh', overflowY: 'auto',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.text }}>
                Write a Review
              </div>
              <button
                onClick={() => { setShowModal(false); setStatus(''); }}
                style={{ background: 'transparent', border: 'none', color: V.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {status === 'success' ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 6 }}>
                  Review submitted
                </div>
                <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
                  Thanks! Your review is pending approval and will appear shortly.
                </div>
                <button
                  onClick={() => { setShowModal(false); setStatus(''); setForm({ name: '', email: '', rating: 5, title: '', body: '' }); }}
                  style={{
                    marginTop: 16, background: V.accent, border: 'none', color: '#fff',
                    borderRadius: 6, padding: '8px 20px', fontSize: 13, fontFamily: V.space,
                    cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <style>{`
                  .review-form input::placeholder,
                  .review-form textarea::placeholder { color: ${V.dim}; }
                  .review-form input:focus,
                  .review-form textarea:focus { outline: none; border-color: ${V.accent} !important; }
                `}</style>
                <div className="review-form" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Rating *</label>
                    <StarRating rating={form.rating} size={22} interactive onRate={r => setForm(f => ({ ...f, rating: r }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Your Name *</label>
                      <input
                        required type="text" placeholder="Jane Smith"
                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        style={inputStyle(V)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Email (optional)</label>
                      <input
                        type="email" placeholder="jane@company.com"
                        value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        style={inputStyle(V)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Review Title</label>
                    <input
                      type="text" placeholder="Great partner for semiconductor sourcing"
                      value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      style={inputStyle(V)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Review *</label>
                    <textarea
                      required rows={4} placeholder="Share your experience..."
                      value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                      style={{ ...inputStyle(V), resize: 'vertical', lineHeight: 1.5 }}
                    />
                  </div>
                  {status === 'error' && (
                    <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space }}>Something went wrong. Please try again.</div>
                  )}
                  <button
                    type="submit" disabled={status === 'sending'}
                    style={{
                      background: status === 'sending' ? `${V.accent}70` : V.accent,
                      border: 'none', color: '#fff', borderRadius: 7,
                      padding: '10px 24px', fontSize: 13, fontWeight: 700,
                      fontFamily: V.space, cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {status === 'sending' ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Map Embed ────────────────────────────────────────────────────────────────
function MapEmbed({ company, V }) {
  const mapsKey = typeof window !== 'undefined' ? (window.__VITE_GOOGLE_MAPS_KEY || import.meta.env?.VITE_GOOGLE_MAPS_KEY || '') : '';
  const location = [company.city, company.state].filter(Boolean).join(', ');
  if (!location) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted,
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
      }}>
        Location
      </div>
      {mapsKey ? (
        <iframe
          title="Company location"
          width="100%" height="180"
          style={{ border: 0, borderRadius: 8, display: 'block' }}
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(`${company.name} ${location}`)}&zoom=13`}
          allowFullScreen
        />
      ) : (
        <div style={{
          background: V.card2, border: `1px solid ${V.border}`,
          borderRadius: 8, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>📍</span>
          <span style={{ fontSize: 13, color: V.text, fontFamily: V.space }}>{location}</span>
        </div>
      )}
    </div>
  );
}

// ─── Contact / RFQ Form ───────────────────────────────────────────────────────
function ContactForm({ company, tenantId, V }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', type: 'contact' });
  const [status, setStatus] = useState(''); // '', 'sending', 'success', 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabase || !tenantId) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const { error } = await supabase.from('directory_contacts').insert({
        tenant_id: tenantId,
        company_id: company.id,
        sender_name: form.name,
        sender_email: form.email,
        sender_phone: form.phone || null,
        message: form.message,
        type: form.type,
      });
      if (error) throw error;
      // Track contact click
      trackEvent(tenantId, 'contact_click', { company_id: company.id, type: form.type }, company.id);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  };

  const inputStyle = {
    width: '100%', background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 7, padding: '9px 12px',
    fontSize: 13, fontFamily: V.space,
    boxSizing: 'border-box',
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: open ? 14 : 0,
        paddingBottom: open ? 10 : 0,
        borderBottom: open ? `1px solid ${V.border}` : 'none',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, fontFamily: V.mono,
          color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Contact This Company
        </div>
        <button
          onClick={() => { setOpen(o => !o); setStatus(''); setErrorMsg(''); }}
          style={{
            background: open ? 'transparent' : V.accent,
            border: open ? `1px solid ${V.border}` : 'none',
            color: open ? V.muted : '#fff',
            borderRadius: 6, padding: '5px 14px',
            fontSize: 12, fontWeight: 700, fontFamily: V.space,
            cursor: 'pointer',
          }}
        >
          {open ? 'Cancel' : 'Send Message / Request Quote'}
        </button>
      </div>

      {open && (
        <div style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 10, padding: '20px 20px',
        }}>
          <style>{`
            .sourcing-contact-form input::placeholder,
            .sourcing-contact-form textarea::placeholder { color: ${V.dim}; }
            .sourcing-contact-form input:focus,
            .sourcing-contact-form textarea:focus,
            .sourcing-contact-form select:focus { outline: none; border-color: ${V.accentBrd} !important; }
          `}</style>

          {status === 'success' ? (
            <div style={{
              textAlign: 'center', padding: '24px 0',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 6 }}>
                Message sent to {company.name}
              </div>
              <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
                Your message has been sent to {company.name}. They will be in touch shortly.
              </div>
              <button
                onClick={() => { setStatus(''); setForm({ name: '', email: '', phone: '', message: '', type: 'contact' }); }}
                style={{
                  marginTop: 16, background: 'transparent', border: `1px solid ${V.border}`,
                  color: V.muted, borderRadius: 6, padding: '6px 16px',
                  fontSize: 12, fontFamily: V.space, cursor: 'pointer',
                }}
              >
                Send another
              </button>
            </div>
          ) : (
            <form className="sourcing-contact-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>
                    Your Name *
                  </label>
                  <input
                    required type="text" placeholder="Jane Smith"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>
                    Email *
                  </label>
                  <input
                    required type="email" placeholder="jane@company.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>
                    Phone (optional)
                  </label>
                  <input
                    type="tel" placeholder="(480) 555-0000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="contact">General Inquiry</option>
                    <option value="rfq">Request for Quote</option>
                    <option value="inquiry">Partnership Inquiry</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>
                  Message *
                </label>
                <textarea
                  required rows={4}
                  placeholder="Describe your needs, project, or question..."
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              {status === 'error' && (
                <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  style={{
                    background: status === 'sending' ? `${V.accent}70` : V.accent,
                    border: 'none', color: '#fff', borderRadius: 7,
                    padding: '10px 24px', fontSize: 13,
                    fontWeight: 700, fontFamily: V.space,
                    cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {status === 'sending' ? 'Sending...' : 'Send Message'}
                </button>
                <span style={{ fontSize: 12, color: V.dim, fontFamily: V.space }}>
                  Your info will only be shared with {company.name}.
                </span>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────
function SourcingProfileInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { slug, tenantSlug } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [certs, setCerts] = useState([]);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [org, setOrg] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // SEO meta tags
  useEffect(() => {
    if (!company) return;
    const tenantName = 'Sourcing Directory';
    document.title = `${company.name} | ${tenantName}`;

    const setMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', company.description);
    setMeta('property', 'og:title', company.name);
    setMeta('property', 'og:description', company.description);
    if (company.logo_url) setMeta('property', 'og:image', company.logo_url);

    return () => { document.title = 'Sourcing Directory | Find Certified Suppliers'; };
  }, [company]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('directory_companies')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          // If no company found, check if this slug is a tenant -- redirect to its directory
          try {
            const { data: tenantMatch } = await supabase
              .from('directory_tenants')
              .select('slug')
              .eq('slug', slug)
              .eq('status', 'active')
              .single();
            if (tenantMatch) { navigate(`/${tenantMatch.slug}`, { replace: true }); return; }
          } catch { /* not a tenant either */ }
          setNotFound(true); setLoading(false); return;
        }

        setCompany(data);

        const [certsRes, listingsRes, orgRes, tenantRes, reviewsRes] = await Promise.all([
          supabase.from('directory_certifications').select('*').eq('company_id', data.id),
          supabase.from('directory_listings').select('*').eq('company_id', data.id).eq('status', 'active').order('created_at', { ascending: false }),
          data.organization_id
            ? supabase.from('directory_organizations').select('*').eq('id', data.organization_id).single()
            : Promise.resolve({ data: null }),
          data.tenant_id
            ? supabase.from('directory_tenants').select('id').eq('id', data.tenant_id).single()
            : Promise.resolve({ data: null }),
          supabase.from('directory_reviews').select('*').eq('company_id', data.id).eq('status', 'approved').order('created_at', { ascending: false }),
        ]);

        setCerts(certsRes.data || []);
        setListings(listingsRes.data || []);
        setReviews(reviewsRes.data || []);
        setOrg(orgRes.data || null);
        if (tenantRes.data) {
          setTenant(tenantRes.data);
          trackEvent(tenantRes.data.id, 'profile_view', { company_id: data.id, company_name: data.name }, data.id);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
        <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } } * { box-sizing: border-box; }`}</style>
        {/* Skeleton Nav */}
        <div style={{ borderBottom: `1px solid ${V.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 60, background: V.navBg }}>
          <div style={{ height: 13, width: 36, borderRadius: 4, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 13, width: 8, borderRadius: 4, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 13, width: 60, borderRadius: 4, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 13, width: 8, borderRadius: 4, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 13, width: 120, borderRadius: 4, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>
          {/* Skeleton Hero */}
          <div style={{ padding: '36px 0 28px', borderBottom: `1px solid ${V.border}`, marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: 14, background: V.card2, flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ height: 28, borderRadius: 6, background: V.card2, width: '55%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ height: 14, borderRadius: 4, background: V.card2, width: '40%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ height: 22, width: 90, borderRadius: 4, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 22, width: 80, borderRadius: 4, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <div style={{ height: 36, width: 120, borderRadius: 8, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ height: 36, width: 120, borderRadius: 8, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 13, borderRadius: 4, background: V.card2, width: '100%', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: 13, borderRadius: 4, background: V.card2, width: '90%', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: 13, borderRadius: 4, background: V.card2, width: '75%', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          </div>
          {/* Skeleton Certifications section */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ height: 11, borderRadius: 4, background: V.card2, width: 130, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[90, 110, 80, 130, 95].map((w, i) => (
                <div key={i} style={{ height: 34, width: w, borderRadius: 6, background: V.card2, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          </div>
          {/* Skeleton content block */}
          <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '20px', marginBottom: 32, animation: 'pulse 1.5s ease-in-out infinite' }}>
            <div style={{ height: 11, borderRadius: 4, background: V.card2, width: 80, marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 13, borderRadius: 4, background: V.card2, width: '100%' }} />
              <div style={{ height: 13, borderRadius: 4, background: V.card2, width: '80%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48, color: V.text }}>404</div>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V.syne, color: V.text }}>Company not found</div>
        <Link to={tenantSlug ? `/${tenantSlug}` : '/'} style={{ color: V.accent, fontFamily: V.space, fontSize: 14 }}>Back to directory</Link>
      </div>
    );
  }

  const vColor = verticalColor(company.vertical);
  const vLabel = VERTICALS[company.vertical]?.label || company.vertical;
  const tierColors = {
    enterprise: { bg: `${V.accent}18`, border: V.accent, text: V.accent },
    pro:        { bg: 'rgba(59,130,246,0.12)', border: '#3B82F6', text: '#93C5FD' },
    basic:      { bg: 'rgba(34,197,94,0.12)', border: '#22C55E', text: '#86EFAC' },
    free:       { bg: 'rgba(138,132,124,0.1)', border: '#8A847C', text: '#8A847C' },
  };
  const tierColor = tierColors[company.membership_tier] || tierColors.free;

  const listingsByCategory = listings.reduce((acc, l) => {
    if (!acc[l.category]) acc[l.category] = [];
    acc[l.category].push(l);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text, overflowX: 'hidden', maxWidth: '100vw' }}>
      <style>{`* { box-sizing: border-box; } a { color: inherit; }`}</style>

      {/* Nav */}
      <div style={{
        borderBottom: `1px solid ${V.border}`,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16, height: 60,
        background: V.navBg,
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: V.syne, color: V.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            AOM
          </span>
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <Link to={tenantSlug ? `/${tenantSlug}` : '/'} style={{ textDecoration: 'none', fontSize: 13, color: V.muted, fontFamily: V.space }}>
          Directory
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: V.text, fontFamily: V.space }}>
          {company.name}
        </span>
      </div>

      {/* Profile Hero Banner with industry background */}
      <div style={{
        position: 'relative',
        width: '100%',
        minHeight: 180,
        backgroundImage: `linear-gradient(to top, ${V.bg} 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.35) 100%), url(${getVerticalImage(company.vertical)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div style={{
          maxWidth: 860, margin: '0 auto', padding: '32px 24px 0',
          display: 'flex', alignItems: 'flex-end', gap: 20,
          position: 'relative',
        }}>
          {/* Logo / Avatar - overlapping the banner bottom */}
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              style={{
                width: 96, height: 96, borderRadius: 16,
                objectFit: 'contain', background: V.bg,
                border: `3px solid ${V.bg}`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                flexShrink: 0,
                position: 'relative',
                top: 24,
              }}
            />
          ) : (
            <div style={{
              width: 96, height: 96, borderRadius: 16, flexShrink: 0,
              background: V.bg,
              border: `3px solid ${V.bg}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 38, fontWeight: 800, fontFamily: V.syne, color: vColor,
              position: 'relative',
              top: 24,
            }}>
              {company.name.charAt(0)}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{
                fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, fontFamily: V.syne,
                color: '#fff', margin: 0, lineHeight: 1.1,
                textShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}>
                {company.name}
              </h1>
              {company.claimed && (
                <span style={{
                  background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)',
                  color: '#86EFAC', fontSize: 10, fontWeight: 700, fontFamily: V.mono,
                  padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  ✓ Verified Listing
                </span>
              )}
              {company.featured && (
                <span style={{
                  background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)',
                  color: '#6ee7b7', fontSize: 10, fontWeight: 700, fontFamily: V.mono,
                  padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  Featured
                </span>
              )}
            </div>
            <div style={{
              fontSize: 14, color: 'rgba(255,255,255,0.75)', fontFamily: V.space, lineHeight: 1.5,
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}>
              {[company.city, company.state, company.country !== 'US' ? company.country : null].filter(Boolean).join(', ')}
              {company.year_founded && ` · Founded ${company.year_founded}`}
              {company.employee_count && ` · ${company.employee_count} employees`}
              {company.website && (
                <>
                  {' · '}
                  <a href={company.website} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'underline' }}>
                    {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Contact CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, paddingBottom: 12 }}>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: V.accent, color: '#fff', textDecoration: 'none',
                  borderRadius: 7, padding: '8px 16px', fontSize: 13,
                  fontWeight: 700, fontFamily: V.space, textAlign: 'center',
                }}
              >
                Visit Website
              </a>
            )}
            {company.email && (
              <a
                href={`mailto:${company.email}`}
                style={{
                  background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, padding: '7px 16px',
                  fontSize: 13, fontWeight: 600, fontFamily: V.space, textAlign: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                Send Email
              </a>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>
        {/* Unclaimed Banner */}
        {!company.claimed && (
          <div style={{ paddingTop: 20 }}>
            <UnclaimedBanner slug={company.slug} tenantSlug={tenantSlug} V={V} />
          </div>
        )}

        {/* Chips below hero */}
        <div style={{
          padding: company.claimed ? '32px 0 28px' : '12px 0 28px',
          borderBottom: `1px solid ${V.border}`,
          marginBottom: 32,
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <Chip color={vColor} V={V}>{vLabel}</Chip>
          <span style={{
            background: tierColor.bg, border: `1px solid ${tierColor.border}`,
            color: tierColor.text, fontSize: 10, fontWeight: 700,
            fontFamily: V.mono, padding: '3px 8px', borderRadius: 4,
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            {company.membership_tier} member
          </span>
          {reviews.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <StarRating rating={Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)} size={13} />
              <span style={{ fontSize: 12, color: V.muted, fontFamily: V.mono }}>
                {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}
          {org && (
            <span style={{ fontSize: 12, color: V.muted, fontFamily: V.space }}>
              via {org.name}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
          {/* Left column */}
          <div>
            {company.description && (
              <Section title="About" V={V}>
                <p style={{ fontSize: 15, color: V.muted, fontFamily: V.space, lineHeight: 1.7, margin: 0 }}>
                  {company.description}
                </p>
              </Section>
            )}

            {/* Photo Gallery */}
            {company.photos && company.photos.length > 0 && (
              <PhotoGallery
                photos={company.photos}
                tier={company.membership_tier}
                V={V}
              />
            )}

            {tenant && (
              <ContactForm company={company} tenantId={tenant.id} V={V} />
            )}

            {certs.length > 0 && (
              <Section title={`Certifications (${certs.length})`} V={V}>
                <CertGrid certs={certs} V={V} />
              </Section>
            )}

            {Object.entries(listingsByCategory).map(([category, items]) => (
              <Section key={category} title={`${category.charAt(0).toUpperCase() + category.slice(1)}s (${items.length})`} V={V}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(l => <ListingCard key={l.id} listing={l} V={V} />)}
                </div>
              </Section>
            ))}

            {listings.length === 0 && (
              <Section title="Listings" V={V}>
                <div style={{
                  textAlign: 'center', padding: '36px 16px',
                  background: V.card2, borderRadius: 8,
                  border: `1px dashed ${V.border}`,
                }}>
                  <svg width="36" height="36" fill="none" stroke={V.dim} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 10, opacity: 0.5 }}>
                    <rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8M8 11h5"/>
                  </svg>
                  <div style={{ color: V.dim, fontSize: 13, fontFamily: V.space, marginBottom: 6 }}>
                    No active listings yet
                  </div>
                  <div style={{ color: V.dim, fontSize: 11, fontFamily: V.space, opacity: 0.7 }}>
                    Jobs, equipment, and events from this company will appear here.
                  </div>
                </div>
              </Section>
            )}

            {/* Reviews */}
            <ReviewsSection companyId={company.id} reviews={reviews} V={V} />
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Contact info */}
            <div style={{
              background: V.card, border: `1px solid ${V.border}`,
              borderRadius: 10, padding: '18px 16px',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
              }}>
                Contact
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {company.phone && (
                  <a href={`tel:${company.phone}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>📞</span>
                    <span style={{ fontSize: 13, color: V.text, fontFamily: V.mono }}>{company.phone}</span>
                  </a>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>✉️</span>
                    <span style={{ fontSize: 13, color: V.blue, fontFamily: V.mono, wordBreak: 'break-all' }}>{company.email}</span>
                  </a>
                )}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🌐</span>
                    <span style={{ fontSize: 13, color: V.blue, fontFamily: V.mono, wordBreak: 'break-all' }}>
                      {company.website.replace(/^https?:\/\//, '')}
                    </span>
                  </a>
                )}
                {!company.phone && !company.email && !company.website && (
                  <span style={{ fontSize: 12, color: V.dim, fontFamily: V.space }}>No contact info listed.</span>
                )}
              </div>
            </div>

            {/* Company details */}
            <div style={{
              background: V.card, border: `1px solid ${V.border}`,
              borderRadius: 10, padding: '18px 16px',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
              }}>
                Company Info
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Industry', value: vLabel },
                  { label: 'Location', value: [company.city, company.state].filter(Boolean).join(', ') || 'N/A' },
                  { label: 'Founded', value: company.year_founded || 'N/A' },
                  { label: 'Employees', value: company.employee_count || 'N/A' },
                  { label: 'Member Since', value: new Date(company.created_at).getFullYear() },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: V.dim, fontFamily: V.space }}>{label}</span>
                    <span style={{ fontSize: 12, color: V.text, fontFamily: V.space, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {org && (
              <div style={{
                background: `${vColor}10`,
                border: `1px solid ${vColor}30`,
                borderRadius: 10, padding: '16px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Member Organization
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 4 }}>
                  {org.name}
                </div>
                {org.description && (
                  <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, lineHeight: 1.5, marginBottom: 10 }}>
                    {org.description.slice(0, 120)}{org.description.length > 120 ? '...' : ''}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link
                    to={`/org/${org.slug}`}
                    style={{ fontSize: 12, color: vColor, fontFamily: V.space, textDecoration: 'none', fontWeight: 600 }}
                  >
                    View Organization →
                  </Link>
                  {org.website && (
                    <a
                      href={org.website} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: V.muted, fontFamily: V.space, textDecoration: 'none', fontWeight: 600 }}
                    >
                      Website
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Map */}
            <MapEmbed company={company} V={V} />

            <Link
              to={tenantSlug ? `/${tenantSlug}` : '/'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                color: V.muted, textDecoration: 'none', fontSize: 13,
                fontFamily: V.space, padding: '12px 0',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back to Directory
            </Link>
          </div>
        </div>
      </div>

      <div style={{ height: 60 }} />
    </div>
  );
}

export default function SourcingProfile() {
  return (
    <SourcingThemeProvider>
      <SourcingProfileInner />
    </SourcingThemeProvider>
  );
}
