import type { TemplateId } from './template-ids';
import { coerceTemplateId } from './template-ids';

export type SavedStudioTemplateMeta = {
	id: string;
	name: string;
	baseTemplate: TemplateId;
	updatedAt: string;
};

export const SAVED_STUDIO_TEMPLATE_PREFIX = 'saved:';

export function isSavedStudioTemplateSelectId(v: string): boolean {
	return String(v ?? '').startsWith(SAVED_STUDIO_TEMPLATE_PREFIX);
}

export function savedStudioTemplateIdFromSelectId(v: string): string {
	return isSavedStudioTemplateSelectId(v) ? v.slice(SAVED_STUDIO_TEMPLATE_PREFIX.length) : '';
}

export function templatesFromSavedDraftState(
	state: Record<string, unknown> | null | undefined,
): TemplateId[] {
	const raw = Array.isArray(state?.slideTemplates) ? (state!.slideTemplates as unknown[]) : [];
	const templates = raw
		.map((t) => coerceTemplateId(String(t ?? '')))
		.filter(Boolean) as TemplateId[];
	if (templates.length) return templates;
	const primary = coerceTemplateId(String(state?.templateId ?? state?.activeTemplate ?? ''));
	return primary ? [primary] : [];
}

export function primaryTemplateFromSavedDraftState(
	state: Record<string, unknown> | null | undefined,
): TemplateId {
	const templates = templatesFromSavedDraftState(state);
	return templates[0] ?? 'news';
}

export function savedStudioTemplateMetaFromRow(row: {
	id: string;
	state?: Record<string, unknown> | null;
	updated_at?: string;
}): SavedStudioTemplateMeta | null {
	const id = String(row.id ?? '').trim();
	if (!id) return null;
	const state = row.state ?? null;
	return {
		id,
		name: String(state?._templateName ?? '').trim() || 'Untitled template',
		baseTemplate: primaryTemplateFromSavedDraftState(state),
		updatedAt: String(row.updated_at ?? ''),
	};
}
