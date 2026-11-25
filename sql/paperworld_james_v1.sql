-- PAPERWORLD 2026-11-25: James, the shop Director (digital products).
-- Lets the database accept his chat thread, approved memory, weekly ideas and,
-- later, his own coding missions. Only widens the allowed-value lists; nothing
-- else changes. Safe to run more than once.
alter table public.paperworld_agent_threads drop constraint if exists paperworld_agent_threads_agent_id_check;
alter table public.paperworld_agent_threads add constraint paperworld_agent_threads_agent_id_check
 check (agent_id = any (array['matt','listening-director','listening-developer','pokemon-director',
  'wellbeing-director','studio-director','shop-director']));
alter table public.paperworld_director_memory drop constraint if exists paperworld_director_memory_project_id_check;
alter table public.paperworld_director_memory add constraint paperworld_director_memory_project_id_check
 check (project_id = any (array['town','workshop','pokemon','wellbeing','studio','shop']));
alter table public.paperworld_tasks drop constraint if exists paperworld_tasks_room_check;
alter table public.paperworld_tasks add constraint paperworld_tasks_room_check
 check (room = any (array['town','workshop','pokemon','wellbeing','studio','shop']));
alter table public.paperworld_proposals_v1 drop constraint if exists paperworld_proposals_v1_director_id_check;
alter table public.paperworld_proposals_v1 add constraint paperworld_proposals_v1_director_id_check
 check (director_id = any (array['listening-director','pokemon-director','studio-director','wellbeing-director','shop-director']));
alter table public.paperworld_autonomous_missions_v5 drop constraint if exists paperworld_autonomous_missions_v5_project_id_check;
alter table public.paperworld_autonomous_missions_v5 add constraint paperworld_autonomous_missions_v5_project_id_check
 check (project_id = any (array['listening','pokemon','studio','wellbeing','shop']));
alter table public.paperworld_autonomous_steps_v5 drop constraint if exists paperworld_autonomous_steps_v5_role_id_check;
alter table public.paperworld_autonomous_steps_v5 add constraint paperworld_autonomous_steps_v5_role_id_check
 check (role_id = any (array['matt','listening-director','pokemon-director','studio-director','wellbeing-director',
  'listening-developer','pokemon-developer','studio-creative','wellbeing-research','shop-director','shop-developer']));
