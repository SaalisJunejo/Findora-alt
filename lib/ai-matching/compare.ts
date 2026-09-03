/**
 * THRESHOLD CONSTANTS
 * ===================
 * Configurable thresholds for face matching confidence scores (0-100).
 */
export const STRONG_THRESHOLD = 85;
export const NOTIFY_THRESHOLD = 70;
export const POSSIBLE_THRESHOLD = 40;

/**
 * Computes cosine similarity between two face embedding vectors (float arrays)
 * and returns a confidence score between 0 and 100.
 *
 * @param a First embedding array (e.g., 128-d vector)
 * @param b Second embedding array (e.g., 128-d vector)
 * @returns Score from 0 to 100
 */
export function compareEmbeddings(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  const score = Math.max(0, Math.min(100, similarity * 100));
  return Math.round(score);
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
