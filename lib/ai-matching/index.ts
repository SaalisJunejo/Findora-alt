/**
 * AI Matching Engine Module (face-api.js & vector similarity)
 * 
 * Face detection, embedding generation, and cosine similarity matching
 * logic will be implemented here per PRD Section 3.3 and 4.
 */

export type MatchTier = 'strong' | 'notify' | 'possible' | 'discarded';

export interface MatchResult {
  confidenceScore: number;
  tier: MatchTier;
  shouldNotify: boolean;
  shouldAutoShareContact: boolean;
}

/**
 * Evaluates a match confidence score against PRD confidence tiers:
 * - Strong: >= 85% (Notify immediate + Auto-share contact if family enabled)
 * - Notify: 70% - 84% (Notify immediate, no auto-share)
 * - Possible: 40% - 69% (Dashboard list quietly, no push notify)
 * - Discarded: < 40% (Not stored/shown)
 */
export function classifyMatchScore(confidenceScore: number): MatchResult {
  const score = Math.round(confidenceScore);
  
  if (score >= 85) {
    return {
      confidenceScore: score,
      tier: 'strong',
      shouldNotify: true,
      shouldAutoShareContact: true,
    };
  }
  
  if (score >= 70) {
    return {
      confidenceScore: score,
      tier: 'notify',
      shouldNotify: true,
      shouldAutoShareContact: false,
    };
  }
  
  if (score >= 40) {
    return {
      confidenceScore: score,
      tier: 'possible',
      shouldNotify: false,
      shouldAutoShareContact: false,
    };
  }
  
  return {
    confidenceScore: score,
    tier: 'discarded',
    shouldNotify: false,
    shouldAutoShareContact: false,
  };
}
