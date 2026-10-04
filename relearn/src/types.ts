export interface Diagnosis {
  is_correct: boolean;
  misconception: string | null;
  specific_error?: string | null;
  evidence?: string | null;
  explanation: string | null;
  intervention: string | null;
  follow_up_question?: string | null;
  confidence?: number | null;
  next_step?: string | null;
  fixed_code?: string | null;
}

export interface Attempt {
  id: string;
  problemId?: string | null;
  problemTitle?: string;
  problemText?: string;
  domain?: string;
  language?: string;
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

export type DomainType = 'programming' | 'algebra' | 'physics' | 'mathematics' | 'chemistry' | 'logic' | 'other' | string;

export interface Challenge {
  id: string;
  domain: string;
  subdomain?: string;
  title: string;
  description: string;
  initialCode: string;
  language: string;
  concept: string;
  isDemo?: boolean;
  resolutionChallengeId?: string;
  hints?: string[];
}

export interface BenchmarkCase {
  id: string;
  title: string;
  domain: string;
  input: string;
  expectedIsCorrect: boolean;
  expectedMisconception: string;
  isUnseen: boolean;
  actualDiagnosis?: Diagnosis;
  passed?: boolean;
}
