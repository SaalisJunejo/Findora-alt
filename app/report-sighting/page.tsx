'use client';

/**
 * Report a Sighting Page (Client-Side Face Embedding)
 * ===================================================
 * Note: Replaced server-side face embedding with client-side @vladmandic/face-api
 * execution in browser due to Windows native module compilation issues.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/db/supabase';
import { Header } from '@/components/Header';
import {
  loadClientModels,
  generateClientEmbeddingFromFile,
} from '@/lib/ai-matching/embeddings';

// Dynamically import LocationPickerMap with SSR disabled (Leaflet requires window)
const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
      Loading Leaflet Map...
    </div>
  ),
});

export default function ReportSightingPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Form states
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Client-Side Face Embedding States
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [analyzingFace, setAnalyzingFace] = useState(false);
  const [faceWarning, setFaceWarning] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Auth Guard & Preload Client Face Models
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
      } else {
        setUserId(user.id);
        setCheckingAuth(false);
        // Pre-load face-api browser models in background
        loadClientModels().catch((err) =>
          console.warn('Failed to pre-load face models:', err)
        );
      }
    });
  }, [router]);

  // Handle Photo selection & analyze face embedding in browser
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setPhoto(selectedFile);
      setPhotoPreview(URL.createObjectURL(selectedFile));
      setFaceWarning(null);
      setEmbedding(null);
      setAnalyzingFace(true);

      // Compute 128-d face embedding directly in browser
      const res = await generateClientEmbeddingFromFile(selectedFile);
      setEmbedding(res.embedding);
      setFaceWarning(res.warning);
      setAnalyzingFace(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError('You must be signed in to submit a sighting.');
      return;
    }

    if (!photo) {
      setError('Please upload a photo of the person you spotted.');
      return;
    }

    if (selectedLat === null || selectedLng === null) {
      setError('Please select a precise location on the map by dropping a pin.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Upload photo to "sighting-photos" bucket in Supabase Storage
      const fileExt = photo.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sighting-photos')
        .upload(fileName, photo, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Photo upload failed: ${uploadError.message}`);
      }

      // 2. Get Public URL for the uploaded photo
      const { data: publicUrlData } = supabase.storage
        .from('sighting-photos')
        .getPublicUrl(uploadData.path);

      const photoUrl = publicUrlData.publicUrl;

      // 3. Insert row into sightings table including the browser-computed embedding
      const { data: sightingData, error: insertError } = await supabase
        .from('sightings')
        .insert({
          finder_id: userId,
          photo_url: photoUrl,
          location_lat: selectedLat,
          location_lng: selectedLng,
          notes: notes.trim() || null,
          embedding: embedding, // Included directly in insert (null if no face detected)
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Failed to submit sighting: ${insertError.message}`);
      }

      // 4. Trigger server-side face matching via /api/run-matching route
      if (sightingData?.id) {
        await fetch('/api/run-matching', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sightingId: sightingData.id }),
        });
      }

      setSubmittedSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while saving the sighting.');
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

            <h1 className="text-2xl font-bold text-white mb-2">
              Thanks — we&apos;re checking this against active cases now.
            </h1>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Your sighting photo and precise location have been logged securely. If a match is made, the reporting family will be notified.
            </p>

            {faceWarning && (
              <div className="mb-6 p-3.5 rounded-xl bg-amber-950/60 border border-amber-700/50 text-amber-200 text-xs leading-relaxed">
                ⚠️ {faceWarning}
              </div>
            )}

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
                  setPhoto(null);
                  setPhotoPreview(null);
                  setSelectedLat(null);
                  setSelectedLng(null);
                  setNotes('');
                  setEmbedding(null);
                  setFaceWarning(null);
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all"
              >
                Submit Another Sighting
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-white">Report a Sighting</h1>
              <p className="text-sm text-slate-400 mt-2">
                If you believe you have spotted a missing person, upload a clear photo and pin the precise location where you saw them.
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
                  Sighting Photo <span className="text-red-400">*</span>
                </label>

                <div className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-6 transition-all bg-slate-950/50">
                  {photoPreview ? (
                    <div className="flex flex-col items-center gap-3 w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded-xl border border-slate-800 shadow-md"
                      />

                      {analyzingFace && (
                        <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
                          <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          Analyzing face features in browser...
                        </div>
                      )}

                      {!analyzingFace && embedding && (
                        <div className="text-[11px] text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800/50 px-3 py-1 rounded-full">
                          ✓ Face detected (128-d embedding ready)
                        </div>
                      )}

                      {!analyzingFace && faceWarning && (
                        <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-200 text-xs text-center leading-relaxed">
                          ⚠️ {faceWarning}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          setPhotoPreview(null);
                          setEmbedding(null);
                          setFaceWarning(null);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 font-medium mt-1"
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
                        <span>Upload sighting photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          required
                          onChange={handlePhotoChange}
                          className="sr-only"
                        />
                      </label>
                      <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, or WEBP required</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Location Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Precise Sighting Location (Click map to drop pin) <span className="text-red-400">*</span>
                </label>
                <LocationPickerMap
                  onLocationSelect={handleLocationSelect}
                  selectedLat={selectedLat}
                  selectedLng={selectedLng}
                />
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Approximate time seen, clothing, direction of movement, condition..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600 resize-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || analyzingFace}
                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Uploading photo & submitting sighting...' : 'Submit Sighting Report'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
