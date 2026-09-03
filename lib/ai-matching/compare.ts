/**
 * THRESHOLD CONSTANTS
 * ===================
 * Configurable thresholds for face matching confidence scores (0-100).
 */
export const STRONG_THRESHOLD = 80;
export const NOTIFY_THRESHOLD = 60;
export const POSSIBLE_THRESHOLD = 40;

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function compareEmbeddings(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  const distance = euclideanDistance(a, b);
  const midpoint = 0.55;
  const steepness = 15;
  const score = 100 / (1 + Math.exp((distance - midpoint) * steepness));
  console.log('[Matching Engine] Raw Euclidean distance:', distance, '-> Score:', Math.round(score));
  return Math.round(Math.max(0, Math.min(100, score)));
}

export interface MatchResultRecord {
  id?: string;
  case_id: string;
  sighting_id: string;
  confidence_score: number;
  tier: 'strong' | 'notify' | 'possible';
  contact_shared: boolean;
}

/**
 * Helper function to trigger face matching via the server-side /api/run-matching API route.
 * Bypasses client-side RLS restrictions by utilizing Supabase Admin (Service Role) on the server.
 *
 * @param sightingId UUID of the sighting
 * @returns The created match record or null if no match was made / on failure.
 */
export async function runMatchingForSighting(
  sightingId: string
): Promise<MatchResultRecord | null> {
  try {
    const res = await fetch('/api/run-matching', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sightingId }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('[Matching Client Helper] API returned error:', errData);
      return null;
    }

    const data = await res.json();
    return data.match || null;
  } catch (err) {
    console.error('[Matching Client Helper] Failed to trigger /api/run-matching:', err);
    return null;
  }
}
