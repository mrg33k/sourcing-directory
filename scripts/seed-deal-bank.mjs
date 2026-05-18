/**
 * Seed sample data for Deal Bank tables.
 * 2 rows per table, with 1 approved + 1 pending for each table that has status-based approval.
 * This gives the AOM-EA UI rounds real data to render during build.
 */

// Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF env vars before running.
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'kzzvjtthknsozktmpvak';
if (!ACCESS_TOKEN) { console.error('Set SUPABASE_ACCESS_TOKEN env var'); process.exit(1); }
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runSQL(sql, label) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) {
    const msg = body[0]?.message || body.message || JSON.stringify(body);
    console.error(`  ❌ ${label}: ${msg}`);
    return false;
  }
  console.log(`  ✅ ${label}`);
  return true;
}

async function main() {
  console.log('Seeding Deal Bank sample data...\n');

  // --- deal_bank_listings (linked to Iridium and StandardAero) ---
  // Row 1: Approved listing
  await runSQL(`
    INSERT INTO deal_bank_listings (
      company_id, deck_url, exec_summary, leadership, capital_sought, round_stage,
      revenue_y1, revenue_y2, revenue_y3, status, reviewed_at, reviewed_by
    ) VALUES (
      '652fb540-820c-4d25-92d0-6cfb48a60010',  -- Iridium Communications
      'https://example.com/iridium-deck.pdf',
      'Iridium is raising a Series B to expand its next-generation LEO satellite constellation. The company has a proven track record with 66 active satellites and over 1.8M subscribers globally.',
      '[{"name":"Matt Desch","title":"CEO","photo_url":"","bio":"25+ years in satellite communications. Led Iridium through bankruptcy reorganization to profitability.","linkedin_url":"https://linkedin.com/in/mattdesch"},{"name":"Tom Fitzpatrick","title":"CFO","photo_url":"","bio":"Former CFO at SiriusXM. Deep expertise in capital markets and investor relations.","linkedin_url":""}]'::jsonb,
      '$50M',
      'Series B',
      12000000, 18500000, 28000000,
      'approved',
      now(),
      'admin@spacerising.com'
    )
    ON CONFLICT DO NOTHING;
  `, 'Seed deal_bank_listings row 1 (Iridium, approved)');

  // Row 2: Pending listing
  await runSQL(`
    INSERT INTO deal_bank_listings (
      company_id, deck_url, exec_summary, leadership, capital_sought, round_stage,
      revenue_y1, revenue_y2, revenue_y3, status
    ) VALUES (
      'd5b03cb6-84d2-457f-b791-fe0e88608b06',  -- StandardAero
      'https://example.com/standardaero-deck.pdf',
      'StandardAero is seeking growth capital to accelerate its aerospace MRO expansion into the space launch vehicle market. Currently serving 8 of the top 10 global launch providers.',
      '[{"name":"Russell Ford","title":"CEO","photo_url":"","bio":"Former VP at United Technologies Aerospace Systems. 20 years in aerospace MRO.","linkedin_url":""},{"name":"Daniel Satterfield","title":"CTO","photo_url":"","bio":"Led the engineering integration for SpaceX Falcon 9 ground support equipment.","linkedin_url":""}]'::jsonb,
      '$25M',
      'Series A',
      8500000, 14000000, 22000000,
      'pending'
    )
    ON CONFLICT DO NOTHING;
  `, 'Seed deal_bank_listings row 2 (StandardAero, pending)');

  // --- deal_bank_investors ---
  // Row 1: Approved investor
  await runSQL(`
    INSERT INTO deal_bank_investors (
      firm_name, website, criteria, check_size_min, check_size_max, deal_types,
      deals_last_18mo, linkedin_url, contact_email_internal, status,
      reviewed_at, reviewed_by
    ) VALUES (
      'Space Capital',
      'https://spacecapital.com',
      'We invest exclusively in space technology — launch vehicles, satellites, Earth observation, and in-space services. Focus on seed through Series B with strong technical founders.',
      500000, 10000000,
      ARRAY['VC', 'Seed', 'Series A', 'Series B'],
      14,
      'https://linkedin.com/company/space-capital',
      'deals@spacecapital.com',
      'approved',
      now(),
      'admin@spacerising.com'
    )
    ON CONFLICT DO NOTHING;
  `, 'Seed deal_bank_investors row 1 (Space Capital, approved)');

  // Row 2: Pending investor
  await runSQL(`
    INSERT INTO deal_bank_investors (
      firm_name, website, criteria, check_size_min, check_size_max, deal_types,
      deals_last_18mo, linkedin_url, contact_email_internal, status
    ) VALUES (
      'Seraphim Capital',
      'https://seraphimcapital.com',
      'World''s first dedicated space tech VC fund. We back the defining companies of the space economy — from launch to applications. Particularly interested in dual-use technologies.',
      1000000, 20000000,
      ARRAY['VC', 'Series A', 'Series B', 'Growth'],
      8,
      'https://linkedin.com/company/seraphim-capital',
      'hello@seraphimcapital.com',
      'pending'
    )
    ON CONFLICT DO NOTHING;
  `, 'Seed deal_bank_investors row 2 (Seraphim, pending)');

  // --- deal_bank_completed_rounds ---
  // Row 1: SpaceX Series N (public knowledge)
  await runSQL(`
    INSERT INTO deal_bank_completed_rounds (
      company, amount_raised, round, date, source_url, notes
    ) VALUES (
      'SpaceX',
      '$750M',
      'Private Round',
      '2024-06-01',
      'https://techcrunch.com/2024/06/spacex-funding',
      'SpaceX raised at an $180B valuation to fund Starship development and Starlink expansion.'
    )
    ON CONFLICT DO NOTHING;
  `, 'Seed deal_bank_completed_rounds row 1 (SpaceX)');

  // Row 2: Astra Space (public knowledge)
  await runSQL(`
    INSERT INTO deal_bank_completed_rounds (
      company, amount_raised, round, date, source_url, notes
    ) VALUES (
      'Rocket Lab',
      '$355M',
      'SPAC / Public Offering',
      '2021-08-25',
      'https://rocketlabusa.com/investors',
      'Rocket Lab went public via SPAC merger with Vector Acquisition Corp, raising $355M to fund Neutron development.'
    )
    ON CONFLICT DO NOTHING;
  `, 'Seed deal_bank_completed_rounds row 2 (Rocket Lab)');

  console.log('\nVerifying row counts...');
  const countsRes = await fetch(API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        SELECT 'deal_bank_listings' AS t, COUNT(*) AS cnt FROM deal_bank_listings
        UNION ALL
        SELECT 'deal_bank_investors', COUNT(*) FROM deal_bank_investors
        UNION ALL
        SELECT 'deal_bank_completed_rounds', COUNT(*) FROM deal_bank_completed_rounds;
      `,
    }),
  });
  const counts = await countsRes.json();
  counts.forEach(r => console.log(`  ${r.t}: ${r.cnt} rows`));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
