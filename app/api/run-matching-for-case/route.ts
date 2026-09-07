import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabase-admin';
import {
  compareEmbeddings,
  STRONG_THRESHOLD,
  NOTIFY_THRESHOLD,
  POSSIBLE_THRESHOLD,
} from '@/lib/ai-matching/compare';

/**
 * REVERSE MATCHING — Run when a new CASE is created
 * ==================================================
 * Compares a newly reported missing-person case against ALL existing sightings
 * (not just pending ones) so that sightings submitted before the case existed
 * are also evaluated. Unlike forward matching (which inserts at most one match
 * per sighting), this route can create multiple match rows — one per qualifying
 * sighting — because a single missing person may genuinely have been spotted in
 * several different places.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId } = body;

    if (!caseId || typeof caseId !== 'string') {
      return NextResponse.json(
        { error: 'caseId is required and must be a string.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // -------------------------------------------------------------------------
    // 1. Fetch the new case's embedding + contact_share_enabled
    // -------------------------------------------------------------------------
    const { data: caseRow, error: caseError } = await supabaseAdmin
      .from('cases')
      .select('id, embedding, contact_share_enabled')
      .eq('id', caseId)
      .single();

    if (caseError || !caseRow) {
      console.warn(`[Reverse Matching] Case ${caseId} not found:`, caseError);
      return NextResponse.json(
        { error: `Case ${caseId} not found.` },
        { status: 404 }
      );
    }

    let caseEmbedding: number[] | null = null;
    if (Array.isArray(caseRow.embedding)) {
      caseEmbedding = caseRow.embedding;
    } else if (typeof caseRow.embedding === 'string') {
      try {
        caseEmbedding = JSON.parse(caseRow.embedding);
      } catch (e) {
        console.error('[Reverse Matching] Failed to parse case embedding string:', e);
        return NextResponse.json(
          { error: 'Failed to parse case embedding.' },
          { status: 400 }
        );
      }
    }

    if (!caseEmbedding || caseEmbedding.length === 0) {
      console.log(`[Reverse Matching] Case ${caseId} has no embedding. Skipping reverse matching.`);
      return NextResponse.json({
        success: true,
        matches: [],
        message: 'No face embedding found for case.',
      });
    }

    const contactShareEnabled = caseRow.contact_share_enabled === true;

    // -------------------------------------------------------------------------
    // 2. Fetch ALL sightings that have an embedding (no status filter)
    // -------------------------------------------------------------------------
    const { data: sightings, error: sightingsError } = await supabaseAdmin
      .from('sightings')
      .select('id, embedding')
      .not('embedding', 'is', null);

    if (sightingsError) {
      console.error('[Reverse Matching] Error fetching sightings:', sightingsError);
      return NextResponse.json(
        { error: `Error fetching sightings: ${sightingsError.message}` },
        { status: 500 }
      );
    }

    if (!sightings || sightings.length === 0) {
      console.log('[Reverse Matching] No sightings with embeddings found.');
      return NextResponse.json({
        success: true,
        matches: [],
        message: 'No sightings with embeddings found.',
      });
    }

    // -------------------------------------------------------------------------
    // 3. Compare case embedding against each sighting & collect qualifying rows
    // -------------------------------------------------------------------------
    interface MatchInsert {
      case_id: string;
      sighting_id: string;
      confidence_score: number;
      tier: 'strong' | 'notify' | 'possible';
      contact_shared: boolean;
    }

    const matchesToInsert: MatchInsert[] = [];

    for (const sighting of sightings) {
      let sightingEmbedding: number[] | null = null;
      if (Array.isArray(sighting.embedding)) {
        sightingEmbedding = sighting.embedding;
      } else if (typeof sighting.embedding === 'string') {
        try {
          sightingEmbedding = JSON.parse(sighting.embedding);
        } catch {
          continue;
        }
      }

      if (!sightingEmbedding || sightingEmbedding.length === 0) continue;

      const score = compareEmbeddings(caseEmbedding, sightingEmbedding);

      if (score < POSSIBLE_THRESHOLD) continue;

      let tier: 'strong' | 'notify' | 'possible';
      if (score >= STRONG_THRESHOLD) {
        tier = 'strong';
      } else if (score >= NOTIFY_THRESHOLD) {
        tier = 'notify';
      } else {
        tier = 'possible';
      }

      // Auto-share contact only on Strong tier when the case has it enabled
      const contactShared = tier === 'strong' && contactShareEnabled;

      matchesToInsert.push({
        case_id: caseId,
        sighting_id: sighting.id,
        confidence_score: score,
        tier,
        contact_shared: contactShared,
      });
    }

    if (matchesToInsert.length === 0) {
      console.log(
        `[Reverse Matching] No sightings scored >= ${POSSIBLE_THRESHOLD} for case ${caseId}.`
      );
      return NextResponse.json({
        success: true,
        matches: [],
        message: 'No sightings met the minimum confidence threshold.',
      });
    }

    // -------------------------------------------------------------------------
    // 4. Batch-insert all qualifying match rows
    // -------------------------------------------------------------------------
    const { data: insertedMatches, error: insertError } = await supabaseAdmin
      .from('matches')
      .insert(matchesToInsert)
      .select();

    if (insertError) {
      console.error('[Reverse Matching] Error inserting match records:', insertError);
      return NextResponse.json(
        { error: `Failed to insert match records: ${insertError.message}` },
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------------
    // 5. Update sighting statuses to 'matched' for any newly matched sightings
    // -------------------------------------------------------------------------
    const matchedSightingIds = matchesToInsert.map((m) => m.sighting_id);
    if (matchedSightingIds.length > 0) {
      await supabaseAdmin
        .from('sightings')
        .update({ status: 'matched' })
        .in('id', matchedSightingIds);
    }

    console.log(
      `[Reverse Matching] Created ${insertedMatches?.length ?? 0} match(es) for case ${caseId}.`
    );

    return NextResponse.json({
      success: true,
      matches: insertedMatches ?? [],
    });
  } catch (err: any) {
    console.error('[Reverse Matching] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred during reverse matching.' },
      { status: 500 }
    );
  }
}
