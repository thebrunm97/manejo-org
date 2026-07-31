create table if not exists public.rag_run_judgments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.rag_experiment_runs(id) on delete cascade,
  judge_provider_name text not null,
  judge_model_name text not null,
  prompt_version text not null default 'judge_v1',
  status text not null default 'pending',
  error_type text,
  latency_ms int,
  tokens_used_prompt int,
  tokens_used_completion int,
  estimated_cost_usd numeric,
  overall_score numeric,
  groundedness_score numeric,
  hallucination_risk_score numeric,
  regulatory_compliance_score numeric,
  usefulness_score numeric,
  verdict text,
  short_rationale text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  raw_judgment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, judge_model_name, prompt_version)
);

create index if not exists idx_rag_run_judgments_run_id
  on public.rag_run_judgments(run_id);

create index if not exists idx_rag_run_judgments_status
  on public.rag_run_judgments(status);

alter table public.rag_run_judgments enable row level security;

create policy "Admins can manage rag_run_judgments"
on public.rag_run_judgments
for all
to authenticated
using (coalesce((auth.jwt() ->> 'role') = 'admin', false))
with check (coalesce((auth.jwt() ->> 'role') = 'admin', false));

create or replace function public.set_updated_at_rag_run_judgments()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_rag_run_judgments on public.rag_run_judgments;
create trigger trg_set_updated_at_rag_run_judgments
before update on public.rag_run_judgments
for each row
execute function public.set_updated_at_rag_run_judgments();
