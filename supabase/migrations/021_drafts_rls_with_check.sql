-- drafts INSERT needs an explicit WITH CHECK (same pattern as bulk_workspaces).
-- FOR ALL with only USING can reject inserts when the session/JWT is edge-case null
-- or when Postgres doesn't default WITH CHECK as expected on some setups.

drop policy if exists "Users manage own drafts" on public.drafts;

create policy "Users manage own drafts"
  on public.drafts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
