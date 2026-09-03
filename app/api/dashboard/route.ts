import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = getSupabaseAdmin();

    // Verify authenticated user via token
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const userId = user.id;

    // -------------------------------------------------------------------------
    // 1. FETCH MY REPORTED CASES (Reporter view)
    // -------------------------------------------------------------------------
    const { data: rawCases, error: casesError } = await supabaseAdmin
      .from('cases')
      .select('*')
      .eq('reporter_id', userId)
      .order('created_at', { ascending: false });

    if (casesError) {
      console.error('[Dashboard API] Error fetching cases:', casesError);
      return NextResponse.json({ error: casesError.message }, { status: 500 });
    }

    const cases = rawCases || [];
    const caseIds = cases.map((c) => c.id);

    // Fetch all matches for reporter's cases
    let matchesForCases: any[] = [];
    if (caseIds.length > 0) {
      const { data: matchData, error: matchError } = await supabaseAdmin
        .from('matches')
        .select('*')
        .in('case_id', caseIds)
        .order('confidence_score', { ascending: false });

      if (matchError) {
        console.error('[Dashboard API] Error fetching matches for cases:', matchError);
      } else {
        matchesForCases = matchData || [];
      }
    }

    // Fetch sighting details for those matches
    const sightingIdsForCases = Array.from(
      new Set(matchesForCases.map((m) => m.sighting_id))
    );

    let sightingsMap: Record<string, any> = {};
    if (sightingIdsForCases.length > 0) {
      const { data: sightingData } = await supabaseAdmin
        .from('sightings')
        .select('id, photo_url, location_lat, location_lng, notes, created_at')
        .in('id', sightingIdsForCases);

      if (sightingData) {
        sightingData.forEach((s) => {
          sightingsMap[s.id] = s;
        });
      }
    }

    // Attach matches & sighting details to each case
    const enrichedCases = cases.map((caseItem) => {
      const caseMatches = matchesForCases
        .filter((m) => m.case_id === caseItem.id)
        .map((m) => ({
          ...m,
          sighting: sightingsMap[m.sighting_id] || null,
        }));

      const prominentMatches = caseMatches.filter(
        (m) => m.tier === 'strong' || m.tier === 'notify'
      );
      const possibleMatches = caseMatches.filter((m) => m.tier === 'possible');

      return {
        ...caseItem,
        prominentMatches,
        possibleMatches,
      };
    });

    // -------------------------------------------------------------------------
    // 2. FETCH MY SIGHTINGS (Finder view)
    // -------------------------------------------------------------------------
    const { data: rawSightings, error: sightingsError } = await supabaseAdmin
      .from('sightings')
      .select('*')
      .eq('finder_id', userId)
      .order('created_at', { ascending: false });

    if (sightingsError) {
      console.error('[Dashboard API] Error fetching sightings:', sightingsError);
      return NextResponse.json({ error: sightingsError.message }, { status: 500 });
    }

    const mySightings = rawSightings || [];
    const mySightingIds = mySightings.map((s) => s.id);

    // Fetch matches linked to my sightings
    let matchesForSightings: any[] = [];
    if (mySightingIds.length > 0) {
      const { data: matchData } = await supabaseAdmin
        .from('matches')
        .select('*')
        .in('sighting_id', mySightingIds)
        .order('confidence_score', { ascending: false });

      if (matchData) {
        matchesForSightings = matchData;
      }
    }

    // Identify cases & reporter profile IDs for matches where contact_shared = true
    const sharedMatches = matchesForSightings.filter((m) => m.contact_shared);
    const caseIdsToFetch = Array.from(new Set(sharedMatches.map((m) => m.case_id)));

    let casesMap: Record<string, any> = {};
    let profilesMap: Record<string, any> = {};

    if (caseIdsToFetch.length > 0) {
      const { data: matchedCasesData } = await supabaseAdmin
        .from('cases')
        .select('id, name, reporter_id')
        .in('id', caseIdsToFetch);

      if (matchedCasesData) {
        matchedCasesData.forEach((c) => {
          casesMap[c.id] = c;
        });

        const reporterIds = Array.from(
          new Set(matchedCasesData.map((c) => c.reporter_id))
        );

        const { data: profilesData } = await supabaseAdmin
          .from('profiles')
          .select('id, contact_email, contact_phone')
          .in('id', reporterIds);

        if (profilesData) {
          profilesData.forEach((p) => {
            profilesMap[p.id] = p;
          });
        }
      }
    }

    // Attach match info & family contact info to each sighting
    const enrichedSightings = mySightings.map((sighting) => {
      const sightingMatches = matchesForSightings
        .filter((m) => m.sighting_id === sighting.id)
        .map((m) => {
          const matchedCase = casesMap[m.case_id];
          const reporterProfile = matchedCase
            ? profilesMap[matchedCase.reporter_id]
            : null;

          return {
            ...m,
            caseName: matchedCase?.name || 'Missing Person',
            reporterContact: m.contact_shared
              ? {
                  email: reporterProfile?.contact_email || null,
                  phone: reporterProfile?.contact_phone || null,
                }
              : null,
          };
        });

      return {
        ...sighting,
        matches: sightingMatches,
      };
    });

    return NextResponse.json({
      myCases: enrichedCases,
      mySightings: enrichedSightings,
    });
  } catch (err: any) {
    console.error('[Dashboard API] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST Route to Handle Family Actions (Update Match / Resolve Case)
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = getSupabaseAdmin();

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const body = await req.json();
    const { action, matchId, caseId, family_action, contact_shared } = body;

    // Action: Update Match (e.g. mark different_person or share contact)
    if (action === 'update_match') {
      if (!matchId) {
        return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
      }

      // Verify that user is reporter of the case linked to this match
      const { data: match, error: fetchError } = await supabaseAdmin
        .from('matches')
        .select('id, case_id')
        .eq('id', matchId)
        .single();

      if (fetchError || !match) {
        return NextResponse.json({ error: 'Match record not found' }, { status: 404 });
      }

      const { data: caseItem } = await supabaseAdmin
        .from('cases')
        .select('reporter_id')
        .eq('id', match.case_id)
        .single();

      if (!caseItem || caseItem.reporter_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not own this case.' },
          { status: 403 }
        );
      }

      const updateData: any = {};
      if (family_action !== undefined) updateData.family_action = family_action;
      if (contact_shared !== undefined) updateData.contact_shared = contact_shared;
      updateData.reviewed_at = new Date().toISOString();

      const { data: updatedMatch, error: updateError } = await supabaseAdmin
        .from('matches')
        .update(updateData)
        .eq('id', matchId)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, match: updatedMatch });
    }

    // Action: Resolve Case
    if (action === 'resolve_case') {
      if (!caseId) {
        return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
      }

      const { data: caseItem } = await supabaseAdmin
        .from('cases')
        .select('reporter_id')
        .eq('id', caseId)
        .single();

      if (!caseItem || caseItem.reporter_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not own this case.' },
          { status: 403 }
        );
      }

      const { data: updatedCase, error: resolveError } = await supabaseAdmin
        .from('cases')
        .update({ status: 'resolved' })
        .eq('id', caseId)
        .select()
        .single();

      if (resolveError) {
        return NextResponse.json({ error: resolveError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, case: updatedCase });
    }

    return NextResponse.json({ error: 'Invalid action requested' }, { status: 400 });
  } catch (err: any) {
    console.error('[Dashboard Action API] Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
