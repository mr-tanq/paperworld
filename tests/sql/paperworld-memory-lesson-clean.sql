\set ON_ERROR_STOP on
CREATE TABLE public.paperworld_director_memory(id serial primary key,title text,body text,source_type text);
\ir ../../sql/paperworld_memory_lesson_clean_v1.sql
INSERT INTO public.paperworld_director_memory(title,body,source_type) VALUES
 ('Μάθημα: x',E'Εργασία: «x».\nΑιτία: y\n\nΑποτέλεσμα: ok','verified_result'),
 ('Owner',E'line1\nline2','owner_note');
DO $$ BEGIN
 ASSERT (SELECT body FROM public.paperworld_director_memory WHERE id=1)='Εργασία: «x». · Αιτία: y · Αποτέλεσμα: ok';
 ASSERT (SELECT body FROM public.paperworld_director_memory WHERE id=2)=E'line1\nline2','other memories untouched';
END $$;
SELECT 'lesson clean ok';
