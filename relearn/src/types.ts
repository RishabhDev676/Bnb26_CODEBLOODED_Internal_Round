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
  imageBase64?: string;
  thoughtSteps?: string[];
  thoughtTime?: number;
}

export interface LearnerModelStats {
  conceptMastery: { subject: string; score: number; fullMark: number }[];
  recurringMisconceptions: { name: string; count: number }[];
  totalAttempts: number;
  resolutionRate: number;
}

export type DomainType = 'programming' | 'algebra' | 'physics';

export interface Challenge {
  id: string;
  domain: DomainType;
  title: string;
  description: string;
  initialCode: string;
  language: string;
  concept: string;
  resolutionChallengeId?: string;
  hints?: string[];
}

export interface BenchmarkCase {
  id: string;
  title: string;
  domain: DomainType;
  input: string;
  expectedIsCorrect: boolean;
  expectedMisconception: string;
  isUnseen: boolean;
  actualDiagnosis?: Diagnosis;
  passed?: boolean;
}
