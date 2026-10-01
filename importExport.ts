import type { HealthEvent } from './types';

export function normalizeImportedPayload(raw: unknown): HealthEvent[] {
  const rows = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && 'events' in raw ? (raw as { events: unknown }).events : null);
  if (!Array.isArray(rows)) throw new Error('Invalid file: expected an events array.');
  const now = Date.now();
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`Invalid event at row ${index + 1}.`);
    const e = row as Partial<HealthEvent>;
    if (e.type !== 'migraine' && e.type !== 'menstruation') throw new Error(`Invalid event type at row ${index + 1}.`);
    if (typeof e.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.startDate)) throw new Error(`Invalid start date at row ${index + 1}.`);
    if (typeof e.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.endDate)) throw new Error(`Invalid end date at row ${index + 1}.`);
    if (e.endDate < e.startDate) throw new Error(`End date precedes start date at row ${index + 1}.`);
    return {
      id: typeof e.id === 'string' && e.id ? e.id : crypto.randomUUID(),
      type: e.type,
      startDate: e.startDate,
      endDate: e.endDate,
      confirmed: true,
      createdAt: typeof e.createdAt === 'number' ? e.createdAt : now,
      updatedAt: now,
      notes: typeof e.notes === 'string' ? e.notes : undefined
    };
  });
}
