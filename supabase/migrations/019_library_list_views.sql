-- Slim list views so library pages don't pull full draft / bulk / clip JSON.
-- Underlying tables still store the blobs; these views only return card fields.
-- security_invoker: RLS on the base tables still applies for authenticated clients.

drop view if exists public.drafts_library;
create view public.drafts_library
  with (security_invoker = true)
as
select
  d.id,
  d.user_id,
  d.kind,
  d.created_at,
  d.updated_at,
  jsonb_strip_nulls(
    jsonb_build_object(
      '_templateName', d.state->'_templateName',
      'draftPreviewKey', coalesce(d.state->'draftPreviewKey', d.state->'draftPreviewPath'),
      'draftPreviewPath', d.state->'draftPreviewPath',
      'draftPreviewUrl', d.state->'draftPreviewUrl',
      'templatePreviewUrl', d.state->'templatePreviewUrl',
      'formatId', d.state->'formatId',
      'source', d.state->'source',
      'coverImageUrl', (
        select img
        from (
          select nullif(btrim(v), '') as img
          from unnest(
            array[
              d.state#>>'{bgImagesByTemplate,news,0}',
              d.state#>>'{bgImagesByTemplate,blank,0}',
              d.state#>>'{bgImagesByTemplate,photoStory,0}',
              d.state#>>'{bgImagesByTemplate,imageQuote,0}',
              d.state#>>'{bgImagesByTemplate,videoStory,0}',
              d.state#>>'{bgImagesByTemplate,textCarousel,0}',
              d.state#>>'{bgImagesByTemplate,blackText,0}',
              d.state#>>'{bgImagesByTemplate,tweet,0}',
              d.state#>>'{bgImagesByTemplate,article,0}',
              d.state#>>'{bgImagesByTemplate,brandStack,0}'
            ]
          ) as u(v)
        ) x
        where img is not null
          and (
            img like 'https://%'
            or img like 'http://%'
          )
          and length(img) < 2000
        limit 1
      ),
      'slides', case
        when jsonb_typeof(d.state->'slides') = 'array' then (
          select jsonb_agg(s.elem order by s.ord)
          from (
            select t.elem, t.ord
            from jsonb_array_elements(d.state->'slides') with ordinality as t(elem, ord)
            order by t.ord
            limit 12
          ) s
        )
        else d.state->'slides'
      end
    )
  ) as state
from public.drafts d;

drop view if exists public.bulk_workspaces_library;
create view public.bulk_workspaces_library
  with (security_invoker = true)
as
select
  w.id,
  w.user_id,
  w.title,
  w.topic,
  w.thumbnail_url,
  w.clip_project_id,
  w.selected_show_id,
  w.created_at,
  w.updated_at,
  coalesce(jsonb_array_length(w.shows), 0) as show_count,
  (
    select coalesce(jsonb_agg(x.obj order by x.ord), '[]'::jsonb)
    from (
      select
        t.ordinality as ord,
        jsonb_build_object(
          'id', s->>'id',
          'title', coalesce(nullif(btrim(s->>'title'), ''), 'Untitled'),
          'fromVideoClips', coalesce(s->>'fromVideoClips', '') in ('true', 't', '1'),
          'slideCount', greatest(1, coalesce(jsonb_array_length(s->'slides'), 0)),
          'headline', left(coalesce(s->'slides'->0->>'headline', ''), 400),
          'thumb', coalesce(
            nullif(s->'slides'->0->>'mediaThumb', ''),
            case
              when s->'slides'->0->>'mediaKind' = 'video' then ''
              else nullif(s->'slides'->0->>'mediaUrl', '')
            end,
            ''
          ),
          'template', coalesce(nullif(s->'slides'->0->>'template', ''), 'news'),
          'durationSec', (
            select coalesce(
              sum(
                greatest(
                  0,
                  coalesce(sl.clip_end, 0) - coalesce(sl.clip_start, 0)
                )
              ),
              0
            )
            from (
              select
                case
                  when (el->>'clipStart') ~ '^[0-9]+(\.[0-9]+)?$' then (el->>'clipStart')::double precision
                  else 0
                end as clip_start,
                case
                  when (el->>'clipEnd') ~ '^[0-9]+(\.[0-9]+)?$' then (el->>'clipEnd')::double precision
                  else 0
                end as clip_end
              from jsonb_array_elements(coalesce(s->'slides', '[]'::jsonb)) el
            ) sl
          ),
          'coverSlide', jsonb_build_object(
            'id', coalesce(s->'slides'->0->>'id', 'cover'),
            'template', coalesce(s->'slides'->0->>'template', 'news'),
            'headline', left(coalesce(s->'slides'->0->>'headline', ''), 400),
            'body', left(coalesce(s->'slides'->0->>'body', ''), 600),
            'mediaKind', s->'slides'->0->>'mediaKind',
            'mediaThumb', s->'slides'->0->>'mediaThumb',
            'mediaUrl', case
              when s->'slides'->0->>'mediaKind' = 'video' then null
              else s->'slides'->0->>'mediaUrl'
            end,
            'clipStart', s->'slides'->0->'clipStart',
            'clipEnd', s->'slides'->0->'clipEnd'
          )
        ) as obj
      from jsonb_array_elements(coalesce(w.shows, '[]'::jsonb)) with ordinality as t(s, ordinality)
      order by t.ordinality
      limit 24
    ) x
  ) as library_shows
from public.bulk_workspaces w;

drop view if exists public.video_clip_projects_library;
create view public.video_clip_projects_library
  with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.title,
  p.thumbnail_url,
  left(coalesce(p.summary, ''), 500) as summary,
  p.updated_at,
  p.created_at,
  jsonb_strip_nulls(
    jsonb_build_object(
      'kind', p.source->>'kind',
      'title', p.source->>'title',
      'durationSec', p.source->'durationSec',
      'thumbnailUrl', p.source->>'thumbnailUrl',
      'youtubeId', p.source->>'youtubeId',
      'topicHint', p.source->>'topicHint'
    )
  ) as source,
  (
    select coalesce(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', c->>'id',
            'title', c->>'title',
            'startSec', c->'startSec',
            'endSec', c->'endSec',
            'newsHeadline', c->>'newsHeadline',
            'videoHook', c->>'videoHook',
            'hook', c->>'hook',
            'thumbnailUrl', c->>'thumbnailUrl',
            'thumbnailR2Key', c->>'thumbnailR2Key'
          )
        )
        order by t.ordinality
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(coalesce(p.clips, '[]'::jsonb)) with ordinality as t(c, ordinality)
  ) as clips,
  (
    p.bulk_shows is not null
    and jsonb_typeof(p.bulk_shows) = 'array'
    and jsonb_array_length(p.bulk_shows) > 0
  ) as has_bulk_shows
from public.video_clip_projects p;

grant select on public.drafts_library to authenticated, service_role;
grant select on public.bulk_workspaces_library to authenticated, service_role;
grant select on public.video_clip_projects_library to authenticated, service_role;
