import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-bold text-slate-950 text-lg shadow-lg shadow-indigo-500/20">
              F
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Findora</h1>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 max-w-4xl mx-auto text-center">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 mb-8">
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

        {/* Anonymized Aggregate Counter */}
        <div className="mt-16 pt-8 border-t border-slate-800/60 flex items-center justify-center gap-8 text-center">
          <div>
            <div className="text-3xl font-extrabold text-white">0</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-medium">Reunited Persons</div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <div className="text-3xl font-extrabold text-emerald-400">100%</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-medium">Private & Encrypted</div>
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
