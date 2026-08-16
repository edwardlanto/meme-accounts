-- Add a lightweight cover image URL to drafts_library for cards that never got a
-- rasterized draftPreviewKey (export/save thumbnail). Prefer remote http(s) only —
-- skip data: / r2: / blob: so list payloads stay small.

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
