import type { HealthEvent } from './types';

const DB_NAME = 'cycle-forecast-db';
const DB_VERSION = 1;
const STORE = 'events';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function getEvents(): Promise<HealthEvent[]> {
  const rows = await tx<HealthEvent[]>('readonly', (store) => store.getAll());
  return rows.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function putEvent(event: HealthEvent): Promise<void> {
  await tx<IDBValidKey>('readwrite', (store) => store.put(event));
}

export async function deleteEvent(id: string): Promise<void> {
  await tx<undefined>('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}

export async function replaceAllEvents(events: HealthEvent[]): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(STORE, 'readwrite');
  const store = transaction.objectStore(STORE);
  store.clear();
  events.forEach((event) => store.put(event));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearAllEvents(): Promise<void> {
  await replaceAllEvents([]);
}
