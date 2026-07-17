-- =========================================================
-- BookTranslator schema
-- Run this whole file in the Supabase SQL editor.
-- Safe to re-run: everything uses IF NOT EXISTS / OR REPLACE.
-- =========================================================

-- ---------------------------------------------------------
-- profiles: one row per user, auto-created on signup
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  theme TEXT DEFAULT 'light' NOT NULL CHECK (theme IN ('light', 'dark')),
  app_language TEXT DEFAULT 'en' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill profiles for any user that already exists but has no row yet
-- (e.g. accounts created before this trigger was added).
INSERT INTO public.profiles (id)
SELECT u.id FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ---------------------------------------------------------
-- reading_list: Gutenberg books a user has saved to read
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reading_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE NOT NULL,
  gutenberg_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  authors TEXT,
  cover_url TEXT,
  languages TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, gutenberg_id)
);

ALTER TABLE public.reading_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own reading list" ON public.reading_list;
CREATE POLICY "Users can manage their own reading list"
  ON public.reading_list
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------
-- saved_words: vocabulary a user has clicked & starred while reading
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE NOT NULL,
  gutenberg_id INTEGER NOT NULL,
  word TEXT NOT NULL,
  translation TEXT,
  context_sentence TEXT,
  source_lang TEXT,
  target_lang TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.saved_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own saved words" ON public.saved_words;
CREATE POLICY "Users can manage their own saved words"
  ON public.saved_words
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------
-- books: legacy table for user-uploaded PDF/EPUB files
-- (kept for the older /book/:id upload flow)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT DEFAULT 'Unknown Author',
  cover_url TEXT,
  gutenberg_id INTEGER,
  file_type TEXT CHECK (file_type IN ('epub', 'pdf', 'gutenberg_text')) NOT NULL,
  file_url TEXT,
  file_data TEXT,
  current_page INTEGER DEFAULT 1 NOT NULL,
  total_pages INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own books" ON public.books;
CREATE POLICY "Users can manage their own books"
  ON public.books
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
