-- Rode este script no SQL Editor do seu projeto Supabase

CREATE TABLE IF NOT EXISTS public.ftth_projects (
    id integer PRIMARY KEY,
    name text,
    data jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Ativa o RLS (Row Level Security) mas permite acesso anônimo total (já que não temos login ainda)
ALTER TABLE public.ftth_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total anonimo" ON public.ftth_projects
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
