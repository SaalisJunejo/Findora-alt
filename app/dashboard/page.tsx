'use client';

/**
 * FINDORA USER DASHBOARD
 * =======================
 * Dual-role dashboard for Reporters (Family) and Finders (Public).
 * Uses /api/dashboard to bypass RLS limitations while strictly enforcing ownership checks.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/db/supabase';
import { Header } from '@/components/Header';

interface SightingDetail {
  id: string;
  photo_url: string;
  location_lat: number;
  location_lng: number;
  notes: string | null;
  created_at: string;
}

interface MatchItem {
  id: string;
  case_id: string;
  sighting_id: string;
  confidence_score: number;
  tier: 'strong' | 'notify' | 'possible';
  contact_shared: boolean;
  family_action: 'none' | 'different_person' | 'resolved';
  created_at: string;
  sighting: SightingDetail | null;
}

interface CaseItem {
  id: string;
  name: string;
  age: number;
  description: string;
  last_seen_location: string;
  last_seen_date: string;
  photo_url: string;
  contact_share_enabled: boolean;
  status: 'active' | 'resolved';
  created_at: string;
  prominentMatches: MatchItem[];
  possibleMatches: MatchItem[];
}

interface SightingMatchItem {
  id: string;
  case_id: string;
  confidence_score: number;
  tier: 'strong' | 'notify' | 'possible';
  contact_shared: boolean;
  caseName: string;
  reporterContact: {
    email: string | null;
    phone: string | null;
  } | null;
}

interface SightingItem {
  id: string;
  photo_url: string;
  location_lat: number;
  location_lng: number;
  notes: string | null;
  status: 'pending' | 'matched' | 'expired';
  created_at: string;
  matches: SightingMatchItem[];
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [myCases, setMyCases] = useState<CaseItem[]>([]);
  const [mySightings, setMySightings] = useState<SightingItem[]>([]);

  // UI state for collapsed possible matches sections per case ID
  const [expandedPossibleMatches, setExpandedPossibleMatches] = useState<
    Record<string, boolean>
  >({});

  // Action loading states (e.g. updating a match or resolving a case)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchDashboardData = async (token: string) => {
    try {
      setError(null);
      const res = await fetch('/api/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch dashboard data.');
      }

      const data = await res.json();
      setMyCases(data.myCases || []);
      setMySightings(data.mySightings || []);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'An error occurred while loading dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !session.user) {
        router.push('/login');
      } else {
        setUser(session.user);
        setSessionToken(session.access_token);
        fetchDashboardData(session.access_token);
      }
    });
  }, [router]);

  const handleAction = async (payload: any, key: string) => {
    if (!sessionToken) return;

    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Action failed');
      }

      // Refresh dashboard state
      await fetchDashboardData(sessionToken);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const togglePossibleMatches = (caseId: string) => {
    setExpandedPossibleMatches((prev) => ({
      ...prev,
      [caseId]: !prev[caseId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col justify-center items-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-400 mt-4">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 w-full space-y-12">
        {/* Dashboard Title & Quick Stats Banner */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-2">
              👤 Signed in as {user?.email}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Findora Dashboard</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Manage your reported cases, view AI matches, and track sighting submissions.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/report-case"
              className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/30"
            >
              + Report Missing Person
            </Link>
            <Link
              href="/report-sighting"
              className="flex-1 sm:flex-none text-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all border border-slate-700/80"
            >
              + Report Sighting
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION 1: MY REPORTED CASES (REPORTER / FAMILY VIEW)              */}
        {/* =================================================================== */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                📋 My Reported Cases ({myCases.length})
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Cases you have created. Case photos are private and used solely for AI matching.
              </p>
            </div>
          </div>

          {myCases.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-slate-300 text-sm font-semibold mb-1">No missing person cases reported yet</p>
              <p className="text-slate-500 text-xs mb-4">
                If you have a missing family member or loved one, create a case to initiate AI face matching.
              </p>
              <Link
                href="/report-case"
                className="inline-flex px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Report a Missing Person
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {myCases.map((caseItem) => {
                const isResolved = caseItem.status === 'resolved';

                return (
                  <div
                    key={caseItem.id}
                    className={`bg-slate-900/80 border ${
                      isResolved ? 'border-slate-800/60 opacity-80' : 'border-slate-800'
                    } rounded-2xl p-6 shadow-xl backdrop-blur-xl space-y-6`}
                  >
                    {/* Case Header Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
                      <div className="flex items-start gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={caseItem.photo_url}
                          alt={caseItem.name}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-800 shadow-md"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white">{caseItem.name}</h3>
                            <span className="text-xs text-slate-400 font-medium">(Age {caseItem.age})</span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isResolved
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                              }`}
                            >
                              {isResolved ? 'RESOLVED' : 'ACTIVE MATCHING'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Last seen: <span className="text-slate-200">{caseItem.last_seen_location}</span> on{' '}
                            <span className="text-slate-200">{caseItem.last_seen_date}</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Auto-share contact on strong match:{' '}
                            <span className={caseItem.contact_share_enabled ? 'text-indigo-400 font-medium' : 'text-slate-400'}>
                              {caseItem.contact_share_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Resolve Case Action */}
                      {!isResolved && (
                        <button
                          onClick={() => handleAction({ action: 'resolve_case', caseId: caseItem.id }, `resolve-${caseItem.id}`)}
                          disabled={actionLoading[`resolve-${caseItem.id}`]}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all border border-slate-700/80 disabled:opacity-50"
                        >
                          {actionLoading[`resolve-${caseItem.id}`] ? 'Updating status...' : '✓ Mark Case as Resolved'}
                        </button>
                      )}
                    </div>

                    {/* PROMINENT MATCHES SECTION (Strong & Notify Tiers) */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        🎯 Prominent Matches ({caseItem.prominentMatches.length})
                      </h4>

                      {caseItem.prominentMatches.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500 text-center">
                          No strong or notify matches detected yet. Findora continuously checks new sightings against this case.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {caseItem.prominentMatches.map((match) => {
                            const isDifferentPerson = match.family_action === 'different_person';
                            const isStrong = match.tier === 'strong';

                            return (
                              <div
                                key={match.id}
                                className={`p-4 rounded-xl border transition-all ${
                                  isDifferentPerson
                                    ? 'bg-slate-950/50 border-slate-800/50 opacity-60'
                                    : isStrong
                                    ? 'bg-indigo-950/30 border-indigo-500/40 shadow-lg shadow-indigo-950/20'
                                    : 'bg-slate-900/90 border-slate-800'
                                }`}
                              >
                                <div className="flex gap-4 items-start">
                                  {match.sighting?.photo_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={match.sighting.photo_url}
                                      alt="Sighting"
                                      className="w-20 h-20 rounded-lg object-cover border border-slate-800 shrink-0"
                                    />
                                  )}

                                  <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                                          isStrong
                                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                            : 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                                        }`}
                                      >
                                        {isStrong ? 'STRONG MATCH' : 'NOTIFY MATCH'}
                                      </span>
                                      <span className="text-xs font-black text-white bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full">
                                        {match.confidence_score}% Match
                                      </span>
                                    </div>

                                    {match.sighting?.notes && (
                                      <p className="text-xs text-slate-300 italic line-clamp-2 leading-relaxed">
                                        &quot;{match.sighting.notes}&quot;
                                      </p>
                                    )}

                                    {match.sighting?.created_at && (
                                      <p className="text-[11px] text-slate-500">
                                        Sighting logged on {new Date(match.sighting.created_at).toLocaleDateString()}
                                      </p>
                                    )}

                                    {/* Action Status Indicators */}
                                    <div className="pt-1 flex flex-wrap gap-2 text-[11px]">
                                      {match.contact_shared && (
                                        <span className="text-emerald-400 font-semibold bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded">
                                          ✓ Contact info shared with finder
                                        </span>
                                      )}
                                      {isDifferentPerson && (
                                        <span className="text-amber-400 font-semibold bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded">
                                          ⚠️ Marked as different person
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                {!isResolved && (
                                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
                                    {!match.contact_shared && (
                                      <button
                                        onClick={() =>
                                          handleAction(
                                            { action: 'update_match', matchId: match.id, contact_shared: true },
                                            `share-${match.id}`
                                          )
                                        }
                                        disabled={actionLoading[`share-${match.id}`]}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-all disabled:opacity-50"
                                      >
                                        {actionLoading[`share-${match.id}`] ? 'Sharing...' : 'Share contact info with finder'}
                                      </button>
                                    )}

                                    {!isDifferentPerson && (
                                      <button
                                        onClick={() =>
                                          handleAction(
                                            { action: 'update_match', matchId: match.id, family_action: 'different_person' },
                                            `flag-${match.id}`
                                          )
                                        }
                                        disabled={actionLoading[`flag-${match.id}`]}
                                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] transition-all border border-slate-700/80 disabled:opacity-50"
                                      >
                                        {actionLoading[`flag-${match.id}`] ? 'Updating...' : 'Mark as different person'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* COLLAPSIBLE SECTION: OTHER POSSIBLE MATCHES (Possible Tier) */}
                    {caseItem.possibleMatches.length > 0 && (
                      <div className="border-t border-slate-800/80 pt-4">
                        <button
                          onClick={() => togglePossibleMatches(caseItem.id)}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-2 transition-all"
                        >
                          <span>{expandedPossibleMatches[caseItem.id] ? '▼' : '▶'}</span>
                          <span>Other possible matches ({caseItem.possibleMatches.length})</span>
                          <span className="text-[10px] text-slate-500 font-normal">(Medium confidence 40–59%)</span>
                        </button>

                        {expandedPossibleMatches[caseItem.id] && (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {caseItem.possibleMatches.map((match) => (
                              <div
                                key={match.id}
                                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
                              >
                                <div className="flex gap-3 items-start">
                                  {match.sighting?.photo_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={match.sighting.photo_url}
                                      alt="Sighting"
                                      className="w-14 h-14 rounded-lg object-cover border border-slate-800 shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                                        POSSIBLE MATCH
                                      </span>
                                      <span className="font-bold text-slate-300">{match.confidence_score}%</span>
                                    </div>
                                    {match.sighting?.notes && (
                                      <p className="text-[11px] text-slate-400 italic leading-snug">
                                        &quot;{match.sighting.notes}&quot;
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {!isResolved && (
                                  <div className="flex gap-2 text-[11px]">
                                    {!match.contact_shared && (
                                      <button
                                        onClick={() =>
                                          handleAction(
                                            { action: 'update_match', matchId: match.id, contact_shared: true },
                                            `share-${match.id}`
                                          )
                                        }
                                        className="px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-800"
                                      >
                                        Share contact info
                                      </button>
                                    )}
                                    {match.family_action !== 'different_person' && (
                                      <button
                                        onClick={() =>
                                          handleAction(
                                            { action: 'update_match', matchId: match.id, family_action: 'different_person' },
                                            `flag-${match.id}`
                                          )
                                        }
                                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700"
                                      >
                                        Mark different person
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* =================================================================== */}
        {/* SECTION 2: MY SIGHTINGS (FINDER VIEW)                              */}
        {/* =================================================================== */}
        <section className="space-y-6 pt-6 border-t border-slate-800/80">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                👁️ My Sightings ({mySightings.length})
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Sightings you have submitted to help reunite missing persons.
              </p>
            </div>
          </div>

          {mySightings.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
              <div className="text-3xl mb-2">📍</div>
              <p className="text-slate-300 text-sm font-semibold mb-1">No sightings submitted yet</p>
              <p className="text-slate-500 text-xs mb-4">
                If you spot someone you believe is reported missing, submit a sighting with a photo and location.
              </p>
              <Link
                href="/report-sighting"
                className="inline-flex px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Submit a Sighting
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mySightings.map((sighting) => {
                const sharedMatch = sighting.matches.find((m) => m.contact_shared);

                return (
                  <div
                    key={sighting.id}
                    className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl space-y-4"
                  >
                    <div className="flex gap-4 items-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sighting.photo_url}
                        alt="Sighting photo"
                        className="w-20 h-20 rounded-xl object-cover border border-slate-800 shrink-0"
                      />

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              sighting.status === 'matched'
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            STATUS: {sighting.status}
                          </span>
                        </div>

                        <p className="text-slate-300">
                          Location: <span className="font-mono text-[11px] text-slate-400">{sighting.location_lat.toFixed(4)}, {sighting.location_lng.toFixed(4)}</span>
                        </p>

                        {sighting.notes && (
                          <p className="text-slate-400 italic line-clamp-2 leading-relaxed">
                            &quot;{sighting.notes}&quot;
                          </p>
                        )}

                        <p className="text-[11px] text-slate-500">
                          Submitted on {new Date(sighting.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* SHARED CONTACT INFO CARD FOR FINDER */}
                    {sharedMatch && sharedMatch.reporterContact && (
                      <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 space-y-2 shadow-lg shadow-emerald-950/40">
                        <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                          <span>🌟</span>
                          <span>This looks like a strong match — here&apos;s how to reach the family:</span>
                        </div>

                        <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                          The family of <strong className="text-white">{sharedMatch.caseName}</strong> has enabled contact-sharing for strong matches so you can coordinate directly.
                        </p>

                        <div className="pt-2 border-t border-emerald-800/60 space-y-1 text-xs">
                          {sharedMatch.reporterContact.email && (
                            <div className="flex items-center gap-2 text-slate-200">
                              <span className="text-emerald-400 font-medium">Email:</span>
                              <a
                                href={`mailto:${sharedMatch.reporterContact.email}`}
                                className="underline text-emerald-300 hover:text-emerald-200 font-medium"
                              >
                                {sharedMatch.reporterContact.email}
                              </a>
                            </div>
                          )}

                          {sharedMatch.reporterContact.phone && (
                            <div className="flex items-center gap-2 text-slate-200">
                              <span className="text-emerald-400 font-medium">Phone:</span>
                              <a
                                href={`tel:${sharedMatch.reporterContact.phone}`}
                                className="underline text-emerald-300 hover:text-emerald-200 font-medium"
                              >
                                {sharedMatch.reporterContact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
