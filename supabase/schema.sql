-- ============================================================
-- COMPASSO · Schema de dados (Sprint J — Sincronização Inteligente)
-- Rode este arquivo inteiro no SQL Editor do painel do Supabase
-- (Project → SQL Editor → New query → colar e rodar).
-- Idempotente: pode ser rodado mais de uma vez sem duplicar nada.
--
-- Limitações conhecidas e aceitas nesta versão (dívida técnica
-- documentada, não bugs — decisões explícitas para o MVP):
--
-- 1. Migração tudo-ou-nada: a migração automática (implementada em
--    js/database.js, não neste arquivo) cobre "primeiro login,
--    localStorage existe, banco vazio". Ela NÃO faz merge registro
--    a registro entre dois dispositivos que nunca sincronizaram e
--    têm dados locais divergentes; nesse cenário, apenas o primeiro
--    dispositivo a logar migra seus dados, e o segundo é tratado
--    como já migrado.
--
-- 2. Soft delete sem purge: linhas com deleted_at preenchido nunca
--    são removidas de fato — não existe rotina de arquivamento ou
--    expurgo ainda. Sem impacto na escala-alvo (dezenas de milhares
--    de usuários); revisar se o volume de exclusões crescer muito.
--
-- 3. Concorrência entre abas do mesmo dispositivo: a resolução de
--    conflito (trigger set_updated_at + comparação de updated_at em
--    js/database.js) cobre dois DISPOSITIVOS diferentes editando o
--    mesmo registro. Ela NÃO cobre duas ABAS do mesmo navegador
--    editando campos diferentes do mesmo registro quase ao mesmo
--    tempo — cada aba tem seu próprio mutex de sincronização, então
--    nenhuma detecta a outra, e a última gravação no Postgres leva
--    a linha inteira (sem corrupção — o Postgres serializa updates
--    concorrentes normalmente — só sem merge campo a campo). Fora
--    de escopo do MVP por decisão explícita.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- profiles (1:1 com auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  medicamento text,
  dose_atual text,
  unidade text,
  dia_aplicacao smallint,
  data_inicio date,
  peso_inicial numeric,
  peso_meta numeric,
  altura smallint,
  meta_agua numeric,
  meta_proteina smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- weighings (peso + medidas corporais) ----------
create table if not exists weighings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  peso numeric not null,
  cintura numeric,
  quadril numeric,
  abdomen numeric,
  coxa numeric,
  braco numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- applications (aplicações do medicamento) ----------
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  dose text,
  medicamento text,
  local text,
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- daily_logs (check-in diário: água, proteína, humor, sintomas...) ----------
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  agua numeric,
  proteina smallint,
  protein_sources jsonb,
  humor smallint,
  apetite text,
  fome_emocional text,
  sintomas text[],
  exercicios text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- exams (exames laboratoriais) ----------
create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  tipo text,
  valor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- bioimpedance (composição corporal) ----------
create table if not exists bioimpedance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  gordura numeric,
  massa_magra numeric,
  musculo numeric,
  agua numeric,
  visceral numeric,
  tmb numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- agenda (compromissos: consultas, retornos...) ----------
create table if not exists agenda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  tipo text,
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- pens (controle da caneta — singleton por usuário) ----------
create table if not exists pens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  capacidade_mg numeric,
  dose_mg numeric,
  usadas integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================
-- Índices — só os que alguma consulta em js/database.js realmente
-- usa hoje. Nenhum índice especulativo "para o futuro": se uma
-- funcionalidade nova justificar um índice, ele entra numa
-- migração específica quando essa funcionalidade existir.
--
-- weighings/daily_logs/bioimpedance/pens: o índice único (parcial,
-- onde deleted_at é nulo) já cobre sozinho toda busca por
-- (user_id, date) ou (user_id) nas linhas ativas — não há índice
-- comum adicional.
-- applications/exams/agenda: sem índice único (o app permite mais
-- de um registro por dia); mantido só o índice de sincronização.
-- profiles/pens: pullProfile()/pullPen() buscam sempre a única
-- linha do usuário por igualdade (id / user_id) — a chave primária
-- e o uq_pens_user já resolvem essa busca sozinhos, então não há
-- índice de (updated_at) aqui como existe nas outras 6 tabelas
-- (essas sim fazem sincronização incremental por timestamp).
-- ============================================================
create index if not exists idx_weighings_user_updated on weighings (user_id, updated_at);
create unique index if not exists uq_weighings_user_date on weighings (user_id, date) where deleted_at is null;

create index if not exists idx_applications_user_updated on applications (user_id, updated_at);

create index if not exists idx_daily_logs_user_updated on daily_logs (user_id, updated_at);
create unique index if not exists uq_daily_logs_user_date on daily_logs (user_id, date) where deleted_at is null;

create index if not exists idx_exams_user_updated on exams (user_id, updated_at);

create index if not exists idx_bioimpedance_user_updated on bioimpedance (user_id, updated_at);
create unique index if not exists uq_bioimpedance_user_date on bioimpedance (user_id, date) where deleted_at is null;

create index if not exists idx_agenda_user_updated on agenda (user_id, updated_at);

create unique index if not exists uq_pens_user on pens (user_id) where deleted_at is null;

-- ============================================================
-- Trigger de updated_at — garante que o timestamp é sempre
-- definido pelo servidor (nunca pelo relógio do cliente), tanto
-- em UPDATE quanto em upsert que atualiza uma linha existente.
-- Sem isso, um upsert só preencheria updated_at via default no
-- INSERT — numa atualização, o valor antigo permaneceria, e a
-- resolução de conflito por timestamp real não funcionaria.
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_updated_at on profiles;
create trigger trg_updated_at before update on profiles for each row execute function set_updated_at();
drop trigger if exists trg_updated_at on weighings;
create trigger trg_updated_at before update on weighings for each row execute function set_updated_at();
drop trigger if exists trg_updated_at on applications;
create trigger trg_updated_at before update on applications for each row execute function set_updated_at();
drop trigger if exists trg_updated_at on daily_logs;
create trigger trg_updated_at before update on daily_logs for each row execute function set_updated_at();
drop trigger if exists trg_updated_at on exams;
create trigger trg_updated_at before update on exams for each row execute function set_updated_at();
drop trigger if exists trg_updated_at on bioimpedance;
create trigger trg_updated_at before update on bioimpedance for each row execute function set_updated_at();
drop trigger if exists trg_updated_at on agenda;
create trigger trg_updated_at before update on agenda for each row execute function set_updated_at();
drop trigger if exists trg_updated_at on pens;
create trigger trg_updated_at before update on pens for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security — select/insert/update apenas, nunca delete.
-- Sem exclusão permanente via API nesta versão: se uma
-- funcionalidade legítima de apagar registro existir no futuro,
-- ela ganha sua própria policy "for delete" nessa ocasião. Até lá,
-- a única forma de "remover" um registro é marcar deleted_at via
-- update — o que preserva o mecanismo de tombstone que a
-- sincronização depende para avisar outros dispositivos.
-- ============================================================
alter table profiles enable row level security;
alter table weighings enable row level security;
alter table applications enable row level security;
alter table daily_logs enable row level security;
alter table exams enable row level security;
alter table bioimpedance enable row level security;
alter table agenda enable row level security;
alter table pens enable row level security;

drop policy if exists "owner_only" on profiles;
drop policy if exists "select_own" on profiles;
drop policy if exists "insert_own" on profiles;
drop policy if exists "update_own" on profiles;
create policy "select_own" on profiles for select using (auth.uid() = id);
create policy "insert_own" on profiles for insert with check (auth.uid() = id);
create policy "update_own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "owner_only" on weighings;
drop policy if exists "select_own" on weighings;
drop policy if exists "insert_own" on weighings;
drop policy if exists "update_own" on weighings;
create policy "select_own" on weighings for select using (auth.uid() = user_id);
create policy "insert_own" on weighings for insert with check (auth.uid() = user_id);
create policy "update_own" on weighings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_only" on applications;
drop policy if exists "select_own" on applications;
drop policy if exists "insert_own" on applications;
drop policy if exists "update_own" on applications;
create policy "select_own" on applications for select using (auth.uid() = user_id);
create policy "insert_own" on applications for insert with check (auth.uid() = user_id);
create policy "update_own" on applications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_only" on daily_logs;
drop policy if exists "select_own" on daily_logs;
drop policy if exists "insert_own" on daily_logs;
drop policy if exists "update_own" on daily_logs;
create policy "select_own" on daily_logs for select using (auth.uid() = user_id);
create policy "insert_own" on daily_logs for insert with check (auth.uid() = user_id);
create policy "update_own" on daily_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_only" on exams;
drop policy if exists "select_own" on exams;
drop policy if exists "insert_own" on exams;
drop policy if exists "update_own" on exams;
create policy "select_own" on exams for select using (auth.uid() = user_id);
create policy "insert_own" on exams for insert with check (auth.uid() = user_id);
create policy "update_own" on exams for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_only" on bioimpedance;
drop policy if exists "select_own" on bioimpedance;
drop policy if exists "insert_own" on bioimpedance;
drop policy if exists "update_own" on bioimpedance;
create policy "select_own" on bioimpedance for select using (auth.uid() = user_id);
create policy "insert_own" on bioimpedance for insert with check (auth.uid() = user_id);
create policy "update_own" on bioimpedance for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_only" on agenda;
drop policy if exists "select_own" on agenda;
drop policy if exists "insert_own" on agenda;
drop policy if exists "update_own" on agenda;
create policy "select_own" on agenda for select using (auth.uid() = user_id);
create policy "insert_own" on agenda for insert with check (auth.uid() = user_id);
create policy "update_own" on agenda for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner_only" on pens;
drop policy if exists "select_own" on pens;
drop policy if exists "insert_own" on pens;
drop policy if exists "update_own" on pens;
create policy "select_own" on pens for select using (auth.uid() = user_id);
create policy "insert_own" on pens for insert with check (auth.uid() = user_id);
create policy "update_own" on pens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
