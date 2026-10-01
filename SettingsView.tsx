import { useRef, type ChangeEvent } from 'react';
import type { HealthEvent } from './types';
import { normalizeImportedPayload } from './importExport';

export function SettingsView({events,onImport,onReset}:{events:HealthEvent[];onImport:(e:HealthEvent[])=>void;onReset:()=>void}){
 const ref=useRef<HTMLInputElement | null>(null);
 function exportJson(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),events},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cycle-forecast-data.json';a.click();URL.revokeObjectURL(a.href)}
 async function importFile(file?:File){if(!file)return; const raw=JSON.parse(await file.text()); onImport(normalizeImportedPayload(raw));}
 return <div><div className="page-intro"><h1>Settings</h1><p>Data stays in this browser unless you export it yourself.</p></div><section className="settings-card"><h2>Data</h2><button className="primary" onClick={exportJson}>Export JSON</button><button className="secondary" onClick={()=>ref.current?.click()}>Import JSON</button><input ref={ref} hidden type="file" accept="application/json" onChange={(e: ChangeEvent<HTMLInputElement>)=>importFile(e.target.files?.[0]).catch(err=>alert(err.message))}/><button className="danger secondary" onClick={()=>{if(confirm('Delete all locally stored events?'))onReset()}}>Clear all data</button></section><section className="settings-card"><h2>Privacy & limits</h2><p>No telemetry, analytics, accounts or server storage. Forecasts are statistical estimates from confirmed events and are not medical advice.</p></section></div>;
}
