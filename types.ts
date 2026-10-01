export type EventType = 'migraine' | 'menstruation';
export type ISODate = string;

export interface HealthEvent {
  id: string;
  type: EventType;
  startDate: ISODate;
  endDate: ISODate;
  confirmed: true;
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export type Confidence = 'Low' | 'Moderate' | 'High';

export interface DailyPrediction {
  date: ISODate;
  migraineProbability: number;
  menstruationProbability: number;
  migraineStartProbability: number;
  menstruationStartProbability: number;
  confirmedMigraine: boolean;
  confirmedMenstruation: boolean;
  migraineReasons: string[];
  menstruationReasons: string[];
}

export interface ForecastSummary {
  type: EventType;
  nextLikelyStart: ISODate | null;
  nextStartProbability: number;
  windowStart: ISODate | null;
  windowEnd: ISODate | null;
  durationLabel: string;
  confidence: Confidence;
}
