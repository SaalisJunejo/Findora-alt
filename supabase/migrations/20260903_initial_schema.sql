-- Findora Initial Database Schema Migration with RLS Policies
-- Compatible with Supabase PostgreSQL

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Extends Supabase auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own profile only
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- RLS Policy: Users can insert their own profile row upon registration
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can update their own profile only
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger function to automatically create a profile entry when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, contact_email, contact_phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 2. CASES TABLE (Missing Persons Reported by Family/Reporters)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT NOT NULL,
  description TEXT NOT NULL,
  last_seen_location TEXT NOT NULL,
  last_seen_date DATE NOT NULL,
  photo_url TEXT NOT NULL,
  embedding JSONB, -- Stores face embedding float array [x1, x2, ...]
  contact_share_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on cases
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Reporters can select only their own reported cases directly from client
-- (Face-matching engine accesses all active cases via service role on server side)
CREATE POLICY "Reporters can view own cases"
  ON public.cases
  FOR SELECT
  USING (auth.uid() = reporter_id);

-- RLS Policy: Reporters can create cases linked to their own account
CREATE POLICY "Reporters can insert own cases"
  ON public.cases
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- RLS Policy: Reporters can update their own cases (e.g. mark resolved or change contact share setting)
CREATE POLICY "Reporters can update own cases"
  ON public.cases
  FOR UPDATE
  USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id);

-- RLS Policy: Reporters can delete their own cases
CREATE POLICY "Reporters can delete own cases"
  ON public.cases
  FOR DELETE
  USING (auth.uid() = reporter_id);


-- -----------------------------------------------------------------------------
-- 3. SIGHTINGS TABLE (Submitted by Finders/Public)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  embedding JSONB, -- Stores face embedding float array [x1, x2, ...]
  location_lat NUMERIC NOT NULL,
  location_lng NUMERIC NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'matched', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on sightings
ALTER TABLE public.sightings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Finders can view only sightings submitted by themselves
-- (Reporting family views sighting info via match results, not directly querying sightings table)
CREATE POLICY "Finders can view own sightings"
  ON public.sightings
  FOR SELECT
  USING (auth.uid() = finder_id);

-- RLS Policy: Finders can insert sightings linked to their own account
CREATE POLICY "Finders can insert own sightings"
  ON public.sightings
  FOR INSERT
  WITH CHECK (auth.uid() = finder_id);


-- -----------------------------------------------------------------------------
-- 4. MATCHES TABLE (Face Match Results linked to Case & Sighting)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  sighting_id UUID NOT NULL REFERENCES public.sightings(id) ON DELETE CASCADE,
  confidence_score NUMERIC NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('strong', 'notify', 'possible')),
  contact_shared BOOLEAN DEFAULT FALSE NOT NULL,
  family_action TEXT DEFAULT 'none' NOT NULL CHECK (family_action IN ('none', 'different_person', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ
);

-- Enable RLS on matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Case reporters can view matches for their own reported cases
CREATE POLICY "Reporters can view matches for their cases"
  ON public.matches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = matches.case_id
        AND cases.reporter_id = auth.uid()
    )
  );

-- RLS Policy: Finders can view matches for their own submitted sightings
-- (Note: Finder gets family contact info via a separate server/service call when contact_shared = true)
CREATE POLICY "Finders can view matches for their sightings"
  ON public.matches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sightings
      WHERE sightings.id = matches.sighting_id
        AND sightings.finder_id = auth.uid()
    )
  );

-- RLS Policy: Case reporters can update match records (e.g. update family_action, reviewed_at, or manually share contact)
CREATE POLICY "Reporters can update matches for their cases"
  ON public.matches
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = matches.case_id
        AND cases.reporter_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = matches.case_id
        AND cases.reporter_id = auth.uid()
    )
  );
