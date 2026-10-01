import type { DailyPrediction, HealthEvent, ISODate } from './types';
import { addDays, dateInEvent } from './dates';
import { buildMenstruationModel, menstruationReasons } from './menstruationForecast';
import { buildMigraineModel, migraineReasons } from './migraineForecast';

export function buildForecast(events: HealthEvent[], anchorDate: ISODate, horizon = 180) {
  const menstruation = buildMenstruationModel(events, anchorDate, horizon);
  const migraine = buildMigraineModel(events, menstruation, anchorDate, horizon);
  const daily = new Map<ISODate, DailyPrediction>();

  for (let i = 0; i <= horizon; i++) {
    const date = addDays(anchorDate, i);
    const confirmedMigraine = events.some((e) => e.type === 'migraine' && dateInEvent(date, e));
    const confirmedMenstruation = events.some((e) => e.type === 'menstruation' && dateInEvent(date, e));
    daily.set(date, {
      date,
      migraineProbability: confirmedMigraine ? 1 : (migraine.dailyOccupancy.get(date) ?? migraine.baselineDailyRate),
      menstruationProbability: confirmedMenstruation ? 1 : (menstruation.dailyOccupancy.get(date) ?? 0),
      migraineStartProbability: migraine.dailyStart.get(date) ?? 0,
      menstruationStartProbability: menstruation.dailyStart.get(date) ?? 0,
      confirmedMigraine,
      confirmedMenstruation,
      migraineReasons: migraineReasons(migraine, date, events),
      menstruationReasons: menstruationReasons(menstruation, date, events)
    });
  }

  return { daily, migraine, menstruation };
}
