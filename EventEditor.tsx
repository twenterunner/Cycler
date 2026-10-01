import { useEffect, useState, type ChangeEvent, type MouseEvent } from 'react';
import type { HealthEvent } from './types';
import { durationDays } from './dates';

export function EventEditor({ event, onSave, onDelete, onClose }: {
  event: HealthEvent;
  onSave: (event: HealthEvent) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(event);
  useEffect(() => setDraft(event), [event]);
  const valid = draft.startDate <= draft.endDate;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="sheet" onMouseDown={(e: MouseEvent<HTMLElement>) => e.stopPropagation()}>
        <div className="sheet-head"><h2>Edit event</h2><button className="icon-btn" onClick={onClose}>×</button></div>
        <label>Type
          <select value={draft.type} onChange={(e: ChangeEvent<HTMLSelectElement>) => setDraft({ ...draft, type: e.target.value as HealthEvent['type'] })}>
            <option value="migraine">Migraine</option>
            <option value="menstruation">Menstruation</option>
          </select>
        </label>
        <div className="form-grid">
          <label>Start date<input type="date" value={draft.startDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, startDate: e.target.value })} /></label>
          <label>End date<input type="date" value={draft.endDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, endDate: e.target.value })} /></label>
        </div>
        <div className="duration-chip">Duration: {valid ? durationDays(draft) : 'invalid'} day{valid && durationDays(draft) === 1 ? '' : 's'}</div>
        <label>Notes (optional)<textarea rows={3} value={draft.notes ?? ''} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, notes: e.target.value })} /></label>
        {!valid && <p className="error-text">End date must be on or after start date.</p>}
        <div className="sheet-actions">
          <button className="danger secondary" onClick={() => onDelete(event.id)}>Delete</button>
          <button className="primary" disabled={!valid} onClick={() => onSave({ ...draft, updatedAt: Date.now() })}>Save</button>
        </div>
      </section>
    </div>
  );
}
