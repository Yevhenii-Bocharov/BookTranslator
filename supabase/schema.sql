-- Create a table for books in our reading list
CREATE TABLE
IF NOT EXISTS public.books
(
  id UUID DEFAULT gen_random_uuid
() PRIMARY KEY,
  user_id UUID REFERENCES auth.users
(id) ON
DELETE CASCADE NOT NULL,
  title TEXT
NOT NULL,
  author TEXT DEFAULT 'Unknown Author',
  cover_url TEXT,
  gutenberg_id INTEGER,                                       -- NULL if custom uploaded book
  file_type TEXT CHECK
(file_type IN
('epub', 'pdf', 'gutenberg_text')) NOT NULL,
  file_url TEXT,                                              -- Link to external assets or CDN URLs
  file_data TEXT,                                             -- Base64 or plain text data payload
  current_page INTEGER DEFAULT 1 NOT NULL,
  total_pages INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP
WITH TIME ZONE DEFAULT timezone
('utc'::text, now
()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Create dynamic security policies
CREATE POLICY "Users can manage their own books"
  ON public.books
  FOR ALL
  TO authenticated
  USING
(auth.uid
() = user_id)
  WITH CHECK
(auth.uid
() = user_id);