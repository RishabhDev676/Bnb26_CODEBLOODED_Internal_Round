import React, { useState, useEffect } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { InterventionPanel, type Diagnosis } from '../components/InterventionPanel';
import { supabase } from '../lib/supabase';
import { Play, Key, RefreshCw, AlertTriangle } from 'lucide-react';
import { diagnoseWithGemini, geminiKeyManager } from '../services/geminiService';

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
  const [rotationMessage, setRotationMessage] = useState<string | null>(null);
  const [keyCount, setKeyCount] = useState<number>(0);
  const [currentKeyIndex, setCurrentKeyIndex] = useState<number>(0);

  useEffect(() => {
    setKeyCount(geminiKeyManager.getKeyCount());
    setCurrentKeyIndex(geminiKeyManager.getCurrentKeyIndex());
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setRotationMessage(null);

    try {
      let result: Diagnosis | null = null;

      // 1. Try Gemini with auto-cycling key pool if keys exist
      if (geminiKeyManager.getKeyCount() > 0) {
        result = await diagnoseWithGemini(
          challenge.title,
          challenge.description,
          code,
          challenge.language,
          (notice) => {
            setRotationMessage(notice);
            setCurrentKeyIndex(geminiKeyManager.getCurrentKeyIndex());
          }
        );
        setCurrentKeyIndex(geminiKeyManager.getCurrentKeyIndex());
      } else {
        // 2. Try Supabase Edge Function
        const userId = '00000000-0000-0000-0000-000000000000';
        const { data, error } = await supabase.functions.invoke('diagnose-misconception', {
          body: {
            challengeId: challenge.id,
            challengeTitle: challenge.title,
            challengeDescription: challenge.description,
            code,
            language: challenge.language,
            userId,
          },
        });

        if (error) throw error;
        result = data?.diagnosis;
      }

      if (result) {
        setDiagnosis(result);

        // Record attempt to Supabase attempts table if available
        try {
          await supabase.from('attempts').insert([
            {
              challenge_id: challenge.id,
              code,
              language: challenge.language,
              is_correct: result.is_correct,
              diagnosis: result,
            },
          ]);
        } catch (dbErr) {
          console.warn('Could not record attempt to Supabase (check RLS / table):', dbErr);
        }
      }
    } catch (error: any) {
      console.error('Error submitting code:', error);

      // Graceful fallback for UI testing if no API keys configured or network offline
      setDiagnosis({
        is_correct: false,
        misconception: "Assignment operator '=' used in comparison context",
        explanation: "In Python, a single '=' assigns a value to a variable, whereas '==' compares two values. Inside the condition 'n % 2 = 0', Python expects an expression that evaluates to True/False, not an assignment statement.",
        intervention: "Take a closer look at line 2. How do you check if the remainder of dividing by 2 equals 0 without reassigning?"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextChallenge = () => {
    setChallenge(RESOLUTION_CHALLENGE);
    setCode(RESOLUTION_CHALLENGE.initialCode);
    setDiagnosis(null);
    setRotationMessage(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-xl shadow-blue-500/20 shadow-md">
            R
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Re:Learn
          </h1>
          <span className="text-xs text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded border border-gray-700">
            Adaptive AI Pedagogy
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          {keyCount > 0 ? (
            <div className="flex items-center gap-2 text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-3 py-1.5 rounded-full">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Key Pool: <strong>{keyCount} keys</strong></span>
              <span className="text-emerald-500 font-mono">(Active: #{currentKeyIndex + 1})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs bg-amber-950/50 text-amber-300 border border-amber-800/50 px-3 py-1.5 rounded-full">
              <Key className="w-3.5 h-3.5" />
              <span>No Gemini keys (Demo Fallback)</span>
            </div>
          )}

          <div className="text-sm text-gray-300 bg-gray-800 px-3 py-1 rounded-full font-mono font-medium border border-gray-700">
            {challenge.language.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Rotation Notice Banner if a key failed over */}
      {rotationMessage && (
        <div className="bg-amber-900/30 border-b border-amber-800/50 px-6 py-2.5 flex items-center gap-2 text-amber-200 text-sm animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{rotationMessage}</span>
        </div>
      )}

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Challenge & Editor */}
        <div className="flex-1 flex flex-col border-r border-gray-800 w-1/2">
          <div className="p-6 bg-gray-900/80 border-b border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold tracking-tight">{challenge.title}</h2>
              {challenge.id.includes('resolution') && (
                <span className="text-xs font-semibold uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-800 px-2.5 py-1 rounded-md">
                  Resolution Assessment
                </span>
              )}
            </div>
            <p className="text-gray-300 leading-relaxed bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 text-sm">
              {challenge.description}
            </p>
          </div>

          <div className="flex-1 relative p-4 flex flex-col bg-gray-950">
            <div className="flex justify-between items-center mb-2 px-2">
              <span className="text-xs font-mono font-semibold text-gray-400">solution.py</span>
            </div>
            <div className="flex-1 min-h-0">
              <CodeEditor
                language={challenge.language}
                code={code}
                onChange={(val) => setCode(val || '')}
              />
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-300">Run Code</kbd> to initiate semantic misconception analysis
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/30 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Diagnosing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Intervention Panel */}
        <div className="w-[480px] bg-gray-900 overflow-y-auto p-4 border-l border-gray-800/50">
          <InterventionPanel
            diagnosis={diagnosis}
            isLoading={isSubmitting}
            onRetry={() => {
              setDiagnosis(null);
              setRotationMessage(null);
            }}
            onNextChallenge={handleNextChallenge}
          />
        </div>
      </div>
    </div>
  );
};
