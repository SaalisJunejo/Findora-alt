'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/db/supabase';
import { Header } from '@/components/Header';

export default function ReportCasePage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [description, setDescription] = useState('');
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [lastSeenDate, setLastSeenDate] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [contactShareEnabled, setContactShareEnabled] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Auth Guard
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      } else {
        setUserId(user.id);
        setCheckingAuth(false);
      }
    });
  }, [router]);

  // Handle Photo selection & preview
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setPhoto(selectedFile);
      setPhotoPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError('You must be signed in to submit a report.');
      return;
    }

    if (!photo) {
      setError('Please upload a photo of the missing person.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Upload photo to "case-photos" bucket in Supabase Storage
      const fileExt = photo.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('case-photos')
        .upload(fileName, photo, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Photo upload failed: ${uploadError.message}`);
      }

      // 2. Get Public URL for the uploaded photo
      const { data: publicUrlData } = supabase.storage
        .from('case-photos')
        .getPublicUrl(uploadData.path);

      const photoUrl = publicUrlData.publicUrl;

      // 3. Insert row into cases table
      const { error: insertError } = await supabase.from('cases').insert({
        reporter_id: userId,
        name,
        age: parseInt(age, 10),
        description,
        last_seen_location: lastSeenLocation,
        last_seen_date: lastSeenDate,
        photo_url: photoUrl,
        contact_share_enabled: contactShareEnabled,
        status: 'active',
      });

      if (insertError) {
        throw new Error(`Failed to save report: ${insertError.message}`);
      }

      setSubmittedSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while saving the report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full">
        {submittedSuccess ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
              ✓
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Report Submitted Successfully</h1>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Your missing person report has been created and is active in Findora&apos;s face-matching engine. Case photos are private and never publicly listed.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={() => {
                  setSubmittedSuccess(false);
                  setName('');
                  setAge('');
                  setDescription('');
                  setLastSeenLocation('');
                  setLastSeenDate('');
                  setPhoto(null);
                  setPhotoPreview(null);
                  setContactShareEnabled(false);
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
              >
                Submit Another Report
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-white">Report a Missing Person</h1>
              <p className="text-sm text-slate-400 mt-2">
                Provide details and a photo to help reunite your loved one. All photos remain private.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs leading-relaxed">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Photo of Missing Person <span className="text-red-400">*</span>
                </label>

                <div className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-6 transition-all bg-slate-950/50">
                  {photoPreview ? (
                    <div className="flex flex-col items-center gap-4 w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-xl border border-slate-800 shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          setPhotoPreview(null);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        Remove photo
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-900 text-slate-400 flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                        📷
                      </div>
                      <label className="cursor-pointer text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                        <span>Upload a clear face photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onChange={handlePhotoChange}
                          className="sr-only"
                        />
                      </label>
                      <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, or WEBP up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Name & Age */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Age <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={120}
                    placeholder="Age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Physical Description & Distinctive Features <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Height, hair color, eye color, clothing when last seen, birthmarks, tattoos..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600 resize-none"
                />
              </div>

              {/* Last Seen Location & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Last Seen Location <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="City, area, or landmark"
                    value={lastSeenLocation}
                    onChange={(e) => setLastSeenLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Last Seen Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={lastSeenDate}
                    onChange={(e) => setLastSeenDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Contact Share Checkbox */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactShareEnabled}
                    onChange={(e) => setContactShareEnabled(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500/40 focus:ring-offset-slate-950"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-200 block">
                      Automatically share my contact info on a Strong Match
                    </span>
                    <span className="text-slate-400 leading-relaxed block mt-0.5">
                      If enabled, finders will automatically receive your contact info only when the face matching confidence is 85% or higher.
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Uploading photo & submitting report...' : 'Submit Missing Person Report'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
