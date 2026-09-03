import Link from 'next/link';
import { Header } from '@/components/Header';
import { getSupabaseAdmin } from '@/lib/db/supabase-admin';

// Force dynamic rendering so the counter reflects real-time database updates
export const revalidate = 0;

export default async function HomePage() {
  let resolvedCount = 0;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { count, error } = await supabaseAdmin
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved');

    if (!error && count !== null) {
      resolvedCount = count;
    }
  } catch (err) {
    console.error('Failed to fetch resolved cases count:', err);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Header />

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 max-w-4xl mx-auto text-center">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-400 mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Private AI-Assisted Reunification</span>
        </div>

        {/* Title & Tagline */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-100 max-w-3xl leading-tight">
          Reuniting families using <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">smart face matching</span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          Findora automatically matches public sighting photos with missing person reports safely and privately. No public feeds, complete privacy protection.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          <Link
            href="/report-case"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 text-center active:scale-[0.98]"
          >
            Report Missing Person
          </Link>

          <Link
            href="/report-sighting"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-semibold text-sm transition-all text-center active:scale-[0.98]"
          >
            Report a Sighting
          </Link>
        </div>

        {/* PROMINENT REUNIFICATION COUNTER BANNER */}
        <div className="mt-14 w-full max-w-xl p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-indigo-950/40 border border-emerald-500/30 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-center gap-5 text-left">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl shadow-inner shrink-0">
              💚
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-2">
                <span className="text-emerald-400 font-mono text-3xl sm:text-4xl">{resolvedCount}</span>
                <span>{resolvedCount === 1 ? 'person reunited with their family' : 'people reunited with their families'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
                Cases safely resolved using Findora&apos;s privacy-first AI face matching.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="mt-12 pt-8 border-t border-slate-800/60 flex flex-wrap items-center justify-center gap-8 text-center">
          <div>
            <div className="text-2xl font-extrabold text-white">100%</div>
            <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Private & Encrypted</div>
          </div>
          <div className="w-px h-8 bg-slate-800 hidden sm:block" />
          <div>
            <div className="text-2xl font-extrabold text-indigo-400">Zero</div>
            <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Public Search / Feeds</div>
          </div>
          <div className="w-px h-8 bg-slate-800 hidden sm:block" />
          <div>
            <div className="text-2xl font-extrabold text-emerald-400">Instant</div>
            <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Strong Match Alerts</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} Findora. All rights reserved.
      </footer>
    </div>
  );
}
