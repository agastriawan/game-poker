-- ============================================================================
-- SKEMA DATABASE SUPABASE UNTUK GAME POKER ONLINE (ATURAN KUMPUL 3 & BOM POKER)
-- Jalankan script ini di menu "SQL Editor" pada Dashboard Supabase Anda.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_rooms (
  room_code TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'waiting',
  round_number INTEGER NOT NULL DEFAULT 0,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk pencarian cepat dan pembersihan room lama
CREATE INDEX IF NOT EXISTS idx_game_rooms_updated_at ON public.game_rooms (updated_at DESC);

-- Aktifkan Row Level Security (RLS) dengan kebijakan akses publik untuk Room Kode
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read game_rooms" ON public.game_rooms;
CREATE POLICY "Allow public read game_rooms"
  ON public.game_rooms
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public insert game_rooms" ON public.game_rooms;
CREATE POLICY "Allow public insert game_rooms"
  ON public.game_rooms
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update game_rooms" ON public.game_rooms;
CREATE POLICY "Allow public update game_rooms"
  ON public.game_rooms
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Aktifkan Supabase Realtime pada tabel game_rooms
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;

