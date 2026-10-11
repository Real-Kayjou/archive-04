-- Run after schema.sql to publish the existing portfolio projects.
insert into public.projects (id, bucket, title, type, note, description, tools, tone, status, media, files, sig)
values
('001', 'archive', 'Untitled Spatial Study', '3D / IN PROGRESS', 'A room that keeps changing its mind.', 'An early spatial experiment about rooms that behave more like thoughts than buildings.', '["SketchUp", "Blender", "Spatial studies"]'::jsonb, 'iris', 'in-progress', '["RENDER / 01", "PLAN / 02", "DETAIL / 03"]'::jsonb, 3, .72),
('002', 'archive', 'Mod Archive', 'CODE / EXPERIMENT', 'Small interventions inside familiar games.', 'A growing collection of modifications, tests, and ideas for changing how games feel from inside.', '["JavaScript", "Game modding", "Reverse engineering"]'::jsonb, 'slate', 'in-progress', '["CAPTURE / 01", "SYSTEM / 02", "PLAYTEST / 03"]'::jsonb, 3, .58),
('003', 'dead', 'Signal / Noise', 'VISUAL SYSTEM', 'A study of interfaces that feel observed.', 'A broken prototype for a visual language built from scanning, interruptions, and quiet pressure.', '["React", "Motion", "Interface studies"]'::jsonb, 'chrome', 'failed-experiment', '["FRAME / 01", "GLITCH / 02", "LOG / 03"]'::jsonb, 3, .91)
on conflict (bucket, id) do nothing;
