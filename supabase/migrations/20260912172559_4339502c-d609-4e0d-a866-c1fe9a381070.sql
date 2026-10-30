CREATE TABLE public.races (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  track text not null,
  race_number integer not null,
  race_date date not null default current_date,
  status text not null default 'open',
  winner_horse_id uuid,
  created_at timestamptz not null default now()
);

CREATE TABLE public.horses (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  number integer not null,
  name text not null,
  multiplier numeric(8,2) not null default 2,
  created_at timestamptz not null default now()
);

CREATE TABLE public.tickets (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  horse_id uuid not null references public.horses(id) on delete cascade,
  code text not null unique,
  player_name text not null,
  amount numeric(12,2) not null,
  multiplier numeric(8,2) not null,
  status text not null default 'pending',
  payout numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

CREATE INDEX idx_horses_race ON public.horses(race_id);
CREATE INDEX idx_tickets_race ON public.tickets(race_id);

GRANT SELECT ON public.races TO anon;
GRANT SELECT ON public.horses TO anon;
GRANT SELECT ON public.tickets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.races TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.races TO service_role;
GRANT ALL ON public.horses TO service_role;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "races_public_read" ON public.races FOR SELECT USING (true);
CREATE POLICY "races_owner_write" ON public.races FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "horses_public_read" ON public.horses FOR SELECT USING (true);
CREATE POLICY "horses_owner_write" ON public.horses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.races r WHERE r.id = horses.race_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.races r WHERE r.id = horses.race_id AND r.owner_id = auth.uid()));

CREATE POLICY "tickets_public_read" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "tickets_owner_write" ON public.tickets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.races r WHERE r.id = tickets.race_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.races r WHERE r.id = tickets.race_id AND r.owner_id = auth.uid()));
