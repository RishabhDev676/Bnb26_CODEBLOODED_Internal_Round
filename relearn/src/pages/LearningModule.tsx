import React, { useState } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { InterventionPanel, Diagnosis } from '../components/InterventionPanel';
import { supabase } from '../lib/supabase';
import { Play } from 'lucide-react';

const DUMMY_CHALLENGE = {
  id: 'challenge-1',
  title: 'Check Even Number',
  description: 'Write a Python function called `is_even(n)` that returns True if the given number `n` is even, and False otherwise.',
  initialCode: 'def is_even(n):\n    if n % 2 = 0:\n        return True\n    else:\n        return False\n',
  language: 'python'
};

const RESOLUTION_CHALLENGE = {
  id: 'challenge-1-resolution',
  title: 'Check Odd Number (Resolution Assessment)',
  description: 'Now, write a Python function called `is_odd(n)` that returns True if `n` is odd. Apply what you just learned!',
  initialCode: 'def is_odd(n):\n    # Write your code here\n    pass\n',
  language: 'python'
};

export const LearningModule: React.FC = () => {
  const [challenge, setChallenge] = useState(DUMMY_CHALLENGE);
  const [code, setCode] = useState(challenge.initialCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // In a real app, you'd get the userId from Supabase Auth
      const userId = '00000000-0000-0000-0000-000000000000'; // Dummy ID for demo
      
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('diagnose-misconception', {
        body: {
          challengeId: challenge.id,
          code,
          language: challenge.language,
          userId
        }
      });

      if (error) throw error;
      
      setDiagnosis(data.diagnosis);
    } catch (error) {
      console.error('Error submitting code:', error);
      // Fallback for demo if Edge Function fails (e.g. no internet, no valid key)
      setTimeout(() => {
        setDiagnosis({
          is_correct: false,
          misconception: "Assignment instead of equality check",
          explanation: "In Python, a single `=` is used for assigning a value to a variable, whereas `==` is used to check if two values are equal. Your code tries to assign 0 to `n % 2` inside the if condition.",
          intervention: "Can you change the if condition to use the equality operator to compare the remainder with 0?"
        });
        setIsSubmitting(false);
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextChallenge = () => {
    setChallenge(RESOLUTION_CHALLENGE);
    setCode(RESOLUTION_CHALLENGE.initialCode);
    setDiagnosis(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <header className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-xl">R</div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Re:Learn</h1>
        </div>
        <div className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
          {challenge.language.toUpperCase()}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Challenge & Editor */}
        <div className="flex-1 flex flex-col border-r border-gray-800 w-1/2">
          <div className="p-6 bg-gray-900 border-b border-gray-800 shadow-sm">
            <h2 className="text-2xl font-bold mb-3">{challenge.title}</h2>
            <p className="text-gray-300 leading-relaxed bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              {challenge.description}
            </p>
          </div>
          
          <div className="flex-1 relative p-4 flex flex-col">
            <div className="flex justify-between items-center mb-2 px-2">
              <span className="text-sm font-medium text-gray-400">main.py</span>
            </div>
            <div className="flex-1 min-h-0">
              <CodeEditor 
                language={challenge.language}
                code={code}
                onChange={(val) => setCode(val || '')}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Analyzing...</span>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Run Code
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Intervention Panel */}
        <div className="w-[450px] bg-gray-900 overflow-y-auto p-4">
          <InterventionPanel 
            diagnosis={diagnosis} 
            isLoading={isSubmitting} 
            onRetry={() => setDiagnosis(null)}
            onNextChallenge={handleNextChallenge}
          />
        </div>
      </div>
    </div>
  );
};
