import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db/supabase-admin';
import {
  compareEmbeddings,
  STRONG_THRESHOLD,
  NOTIFY_THRESHOLD,
  POSSIBLE_THRESHOLD,
} from '@/lib/ai-matching/compare';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sightingId } = body;

    if (!sightingId || typeof sightingId !== 'string') {
      return NextResponse.json(
        { error: 'sightingId is required and must be a string.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch sighting embedding via Supabase Admin (bypasses RLS)
    const { data: sighting, error: sightingError } = await supabaseAdmin
      .from('sightings')
      .select('id, embedding')
      .eq('id', sightingId)
      .single();

    if (sightingError || !sighting) {
      console.warn(`[Matching API] Sighting ${sightingId} not found:`, sightingError);
      return NextResponse.json(
        { error: `Sighting ${sightingId} not found.` },
        { status: 404 }
      );
    }

    let sightingEmbedding: number[] | null = null;
    if (Array.isArray(sighting.embedding)) {
      sightingEmbedding = sighting.embedding;
    } else if (typeof sighting.embedding === 'string') {
      try {
        sightingEmbedding = JSON.parse(sighting.embedding);
      } catch (e) {
        console.error('[Matching API] Failed to parse sighting embedding string:', e);
        return NextResponse.json(
          { error: 'Failed to parse sighting embedding.' },
          { status: 400 }
        );
      }
    }

    if (!sightingEmbedding || sightingEmbedding.length === 0) {
      console.log(`[Matching API] Sighting ${sightingId} has no embedding. Skipping matching.`);
      return NextResponse.json({
        success: true,
        match: null,
        message: 'No face embedding found for sighting.',
      });
    }

    // 2. Fetch embeddings for ALL active cases (bypasses RLS)
    const { data: activeCases, error: casesError } = await supabaseAdmin
      .from('cases')
      .select('id, embedding, contact_share_enabled')
      .eq('status', 'active')
      .not('embedding', 'is', null);

    if (casesError) {
      console.error('[Matching API] Error fetching active cases:', casesError);
      return NextResponse.json(
        { error: `Error fetching active cases: ${casesError.message}` },
        { status: 500 }
      );
    }

    if (!activeCases || activeCases.length === 0) {
      console.log('[Matching API] No active cases with embeddings found.');
      return NextResponse.json({
        success: true,
        match: null,
        message: 'No active cases with embeddings found.',
      });
    }

    // 3. Compare sighting embedding against each active case
    let highestScore = -1;
    let bestMatchingCase: {
      id: string;
      contact_share_enabled: boolean;
    } | null = null;

    for (const c of activeCases) {
      let caseEmbedding: number[] | null = null;
      if (Array.isArray(c.embedding)) {
        caseEmbedding = c.embedding;
      } else if (typeof c.embedding === 'string') {
        try {
          caseEmbedding = JSON.parse(c.embedding);
        } catch {
          continue;
        }
      }

      if (!caseEmbedding || caseEmbedding.length === 0) continue;

      const score = compareEmbeddings(sightingEmbedding, caseEmbedding);
      if (score > highestScore) {
        highestScore = score;
        bestMatchingCase = {
          id: c.id,
          contact_share_enabled: c.contact_share_enabled ?? false,
        };
      }
    }

    // 4. Classify highest-scoring match into tiers
    if (!bestMatchingCase || highestScore < POSSIBLE_THRESHOLD) {
      console.log(
        `[Matching API] Best match score (${highestScore}) is below threshold (${POSSIBLE_THRESHOLD}). No match record created.`
      );
      return NextResponse.json({
        success: true,
        match: null,
        highestScore,
        message: 'No match meeting minimum confidence threshold.',
      });
    }

    let tier: 'strong' | 'notify' | 'possible';
    if (highestScore >= STRONG_THRESHOLD) {
      tier = 'strong';
    } else if (highestScore >= NOTIFY_THRESHOLD) {
      tier = 'notify';
    } else {
      tier = 'possible';
    }

    // 5. Determine contact_shared condition (strong tier + case contact_share_enabled = true)
    const contactShared = tier === 'strong' && bestMatchingCase.contact_share_enabled === true;

    // 6. Insert row into "matches" table using Admin Client (bypasses RLS)
    const { data: insertedMatch, error: matchInsertError } = await supabaseAdmin
      .from('matches')
      .insert({
        case_id: bestMatchingCase.id,
        sighting_id: sightingId,
        confidence_score: highestScore,
        tier: tier,
        contact_shared: contactShared,
      })
      .select()
      .single();

    if (matchInsertError) {
      console.error('[Matching API] Error inserting match record:', matchInsertError);
      return NextResponse.json(
        { error: `Failed to insert match record: ${matchInsertError.message}` },
        { status: 500 }
      );
    }

    // Update sighting status to 'matched'
    await supabaseAdmin
      .from('sightings')
      .update({ status: 'matched' })
      .eq('id', sightingId);

    console.log(
      `[Matching API] Match created successfully: case_id=${bestMatchingCase.id}, sighting_id=${sightingId}, score=${highestScore}, tier=${tier}, contact_shared=${contactShared}`
    );

    return NextResponse.json({
      success: true,
      match: insertedMatch,
    });
  } catch (err: any) {
    console.error('[Matching API] Unexpected error during face matching:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred during face matching.' },
      { status: 500 }
    );
  }
}
