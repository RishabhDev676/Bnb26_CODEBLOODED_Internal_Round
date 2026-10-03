import React from 'react';
import { AlertCircle, CheckCircle2, Lightbulb, RefreshCw } from 'lucide-react';

export interface Diagnosis {
  is_correct: boolean;
  misconception: string | null;
  explanation: string | null;
  intervention: string | null;
}

interface InterventionPanelProps {
  diagnosis: Diagnosis | null;
  isLoading: boolean;
  onRetry: () => void;
  onNextChallenge?: () => void;
}

export const InterventionPanel: React.FC<InterventionPanelProps> = ({ 
  diagnosis, 
  isLoading, 
  onRetry,
  onNextChallenge
}) => {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-900 rounded-lg border border-gray-700 animate-pulse text-gray-300">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500" />
        <p className="text-lg">Analyzing your code for misconceptions...</p>
      </div>
    );
  }

  if (!diagnosis) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-900 rounded-lg border border-gray-700 text-gray-400">
        <Lightbulb className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-center">Submit your code to see AI-driven feedback and interventions.</p>
      </div>
    );
  }

  if (diagnosis.is_correct) {
    return (
      <div className="h-full flex flex-col p-6 bg-green-900/20 rounded-lg border border-green-700 text-green-100">
        <div className="flex items-center gap-3 mb-4 text-green-400">
          <CheckCircle2 className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Great Job!</h2>
        </div>
        <p className="text-lg mb-6">Your code is completely correct and shows a solid understanding of the concepts.</p>
        
        {onNextChallenge && (
          <button 
            onClick={onNextChallenge}
            className="mt-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Move to Next Challenge
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 bg-red-900/10 rounded-lg border border-red-800 text-gray-200">
      <div className="flex items-center gap-3 mb-6 text-red-400">
        <AlertCircle className="w-8 h-8" />
        <h2 className="text-2xl font-bold">Misconception Detected</h2>
      </div>
      
      <div className="space-y-6 flex-grow">
        <div>
          <h3 className="text-sm uppercase tracking-wider text-red-300 font-semibold mb-2">The Misconception</h3>
          <div className="bg-red-950/50 p-4 rounded-md border border-red-900/50">
            <p className="font-medium text-red-200">{diagnosis.misconception}</p>
          </div>
        </div>
        
        <div>
          <h3 className="text-sm uppercase tracking-wider text-gray-400 font-semibold mb-2">Explanation</h3>
          <p className="text-gray-300 leading-relaxed">{diagnosis.explanation}</p>
        </div>
        
        <div>
          <h3 className="text-sm uppercase tracking-wider text-blue-400 font-semibold mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Targeted Intervention
          </h3>
          <div className="bg-blue-900/20 p-4 rounded-md border border-blue-800/50">
            <p className="text-blue-100 italic leading-relaxed">{diagnosis.intervention}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <button 
          onClick={onRetry}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Try Again
        </button>
      </div>
    </div>
  );
};
