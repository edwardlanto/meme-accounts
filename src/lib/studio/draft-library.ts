/** List-page draft rows: slim `state` (preview keys + title), not full editor JSON. */

export type DraftLibraryRow = {
	id: string;
	updated_at: string;
	created_at?: string;
	state?: Record<string, unknown>;
};

const DRAFT_LIBRARY_COLUMNS = 'id,updated_at,created_at,state';

type QueryClient = { from: (table: string) => any };

function viewMissing(message: string): boolean {
	return /schema cache|does not exist|PGRST205/i.test(message);
}

export async function fetchDraftLibraryRows(
	client: QueryClient,
	opts: { userId: string; kind: string; limit: number },
): Promise<DraftLibraryRow[]> {
	const run = (table: string) =>
		client
			.from(table)
			.select(DRAFT_LIBRARY_COLUMNS)
			.eq('user_id', opts.userId)
			.eq('kind', opts.kind)
			.order('updated_at', { ascending: false })
			.limit(opts.limit);

	const slim = await run('drafts_library');
	if (!slim.error) return (slim.data ?? []) as DraftLibraryRow[];
	if (!viewMissing(String(slim.error.message ?? ''))) {
		console.warn('[draft-library] drafts_library:', slim.error.message);
	}

	const fat = await run('drafts');
	if (fat.error) {
		console.warn('[draft-library]', fat.error.message);
		return [];
	}
	return (fat.data ?? []) as DraftLibraryRow[];
}
