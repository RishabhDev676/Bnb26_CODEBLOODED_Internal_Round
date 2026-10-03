export interface Diagnosis {
  is_correct: boolean;
  misconception: string | null;
  explanation: string | null;
  intervention: string | null;
}

export interface Attempt {
  id: string;
  code: string;
  timestamp: Date;
  diagnosis: Diagnosis | null;
  status: 'analyzing' | 'analyzed' | 'error';

}

export interface LearnerModelStats {
  conceptMastery: { subject: string; score: number; fullMark: number }[];
  recurringMisconceptions: { name: string; count: number }[];
  totalAttempts: number;
  resolutionRate: number; // percentage
}
