-- PAPERWORLD — automatic lessons are stored on one line (2026-11-21).
-- The phase 3 lessons used line breaks, which the server's memory policy
-- rejects; one such row made a Director's whole memory fail to load. This
-- trigger turns control characters into " · " for system-written lessons
-- (source_type 'verified_result') before they are stored. Nothing else changes.
-- ROLLBACK: drop trigger paperworld_memory_lesson_clean on public.paperworld_director_memory;
--           drop function public.paperworld_memory_lesson_clean();
begin;
create or replace function public.paperworld_memory_lesson_clean()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.source_type='verified_result' then
  new.title:=btrim(regexp_replace(new.title,'[\x01-\x1f\x7f]+',' ','g'));
  new.body:=btrim(regexp_replace(regexp_replace(new.body,'[\x01-\x1f\x7f]+',' · ','g'),'( · )+',' · ','g'),' ·');
 end if;
 return new;
end $$;
drop trigger if exists paperworld_memory_lesson_clean on public.paperworld_director_memory;
create trigger paperworld_memory_lesson_clean before insert or update on public.paperworld_director_memory
 for each row execute function public.paperworld_memory_lesson_clean();
commit;
