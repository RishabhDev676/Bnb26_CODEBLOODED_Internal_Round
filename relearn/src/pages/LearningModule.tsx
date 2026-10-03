import React, { useState, useEffect } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { AIAssistantPanel } from '../components/AIAssistantPanel';
import { LearnerAnalytics } from '../components/LearnerAnalytics';
import { supabase } from '../lib/supabase';
import { Play, Key, AlertTriangle, Activity, Code2 } from 'lucide-react';
import { diagnoseWithGemini, geminiKeyManager } from '../services/geminiService';
import type { Attempt, LearnerModelStats, Diagnosis } from '../types';

const DUMMY_CHALLENGE = {
  id: 'challenge-1',
  title: 'Check Even Number',
  description: 'Write a Python function called `is_even(n)` that returns True if the given number `n` is even, and False otherwise. Watch out for how you compare values!',
  initialCode: 'def is_even(n):\n    if n % 2 = 0:\n        return True\n    else:\n        return False\n',
  language: 'python',
  concept: 'Control Flow & Operators'
};

const RESOLUTION_CHALLENGE = {
  id: 'challenge-1-resolution',
  title: 'Check Odd Number (Resolution Assessment)',
  description: 'To confirm you have resolved the misconception regarding assignment vs equality, write a Python function called `is_odd(n)` that returns True if `n` is odd.',
  initialCode: 'def is_odd(n):\n    # Write your code here\n    pass\n',
  language: 'python',
  concept: 'Control Flow & Operators'
};

export const LearningModule: React.FC = () => {
  const [challenge, setChallenge] = useState(DUMMY_CHALLENGE);
  const [code, setCode] = useState(challenge.initialCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [rotationMessage, setRotationMessage] = useState<string | null>(null);
  
  // Stats derivation for Learner Analytics
  const [stats, setStats] = useState<LearnerModelStats>({
    conceptMastery: [
      { subject: 'Variables', score: 90, fullMark: 100 },
      { subject: 'Control Flow', score: 40, fullMark: 100 },
      { subject: 'Functions', score: 80, fullMark: 100 },
      { subject: 'Loops', score: 60, fullMark: 100 },
      { subject: 'Data Types', score: 85, fullMark: 100 },
    ],
    recurringMisconceptions: [],
    totalAttempts: 0,
    resolutionRate: 0,
  });

  const [keyCount, setKeyCount] = useState<number>(0);
  const [currentKeyIndex, setCurrentKeyIndex] = useState<number>(0);

  useEffect(() => {
    setKeyCount(geminiKeyManager.getKeyCount());
    setCurrentKeyIndex(geminiKeyManager.getCurrentKeyIndex());
  }, []);

  // Update stats dynamically as attempts grow
  useEffect(() => {
    const errorMap: Record<string, number> = {};
    let resolvedCount = 0;
    
    attempts.forEach(a => {
      if (a.diagnosis?.misconception) {
        errorMap[a.diagnosis.misconception] = (errorMap[a.diagnosis.misconception] || 0) + 1;
      }
      if (a.diagnosis?.is_correct) {
        resolvedCount++;
      }
    });

    const recurring = Object.entries(errorMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const resRate = attempts.length > 0 ? Math.round((resolvedCount / attempts.length) * 100) : 0;

    setStats(prev => ({
      ...prev,
      totalAttempts: attempts.length,
      resolutionRate: resRate,
      recurringMisconceptions: recurring,
    }));
  }, [attempts]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setRotationMessage(null);

    const newAttempt: Attempt = {
      id: Date.now().toString(),
      code,
      timestamp: new Date(),
      status: 'analyzing',
      diagnosis: null
    };

    setAttempts(prev => [...prev, newAttempt]);

    try {
      let result: Diagnosis | null = null;

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
        setAttempts(prev => prev.map(a => a.id === newAttempt.id ? { ...a, status: 'analyzed', diagnosis: result } : a));
        try {
          await supabase.from('attempts').insert([{
            challenge_id: challenge.id,
            code,
            language: challenge.language,
            is_correct: result.is_correct,
            diagnosis: result,
          }]);
        } catch (dbErr) {
          console.warn('DB recording skipped:', dbErr);
        }
      }
    } catch (error: any) {
      console.error('Error submitting code:', error);
      // Demo Fallback
      setTimeout(() => {
        setAttempts(prev => prev.map(a => a.id === newAttempt.id ? {
          ...a, 
          status: 'analyzed',
          diagnosis: {
            is_correct: false,
            misconception: "Assignment operator '=' used in comparison context",
            explanation: "In Python, a single '=' assigns a value to a variable, whereas '==' compares two values. Inside the condition 'n % 2 = 0', Python expects an expression that evaluates to True/False, not an assignment statement.",
            intervention: "Take a closer look at line 2. How do you check if the remainder of dividing by 2 equals 0 without reassigning?"
          }
        } : a));
        setIsSubmitting(false);
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextChallenge = () => {
    setChallenge(RESOLUTION_CHALLENGE);
    setCode(RESOLUTION_CHALLENGE.initialCode);
    setAttempts([]);
    setRotationMessage(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-gray-200 font-sans selection:bg-blue-500/30">
      {/* Navbar */}
      <header className="px-6 py-3 border-b border-gray-800/60 bg-[#161b22] flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-100">Re:Learn</h1>
            <p className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold">Adaptive Multimodal Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {keyCount > 0 && (
            <div className="flex items-center gap-2 text-xs bg-[#0d1117] border border-gray-700 px-3 py-1.5 rounded-md text-gray-300">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>Key Pool: {keyCount}</span>
              <span className="text-blue-400 font-mono">#{currentKeyIndex + 1}</span>
            </div>
          )}
          
          <button 
            onClick={() => setShowAnalytics(true)}
            className="flex items-center gap-2 bg-indigo-900/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <Activity className="w-4 h-4" />
            Learner Model
          </button>
        </div>
      </header>

      {rotationMessage && (
        <div className="bg-amber-900/40 border-b border-amber-700/50 px-6 py-2 flex items-center gap-2 text-amber-200 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          {rotationMessage}
        </div>
      )}

      {/* Main Grid */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left: Challenge Context */}
        <div className="w-[350px] flex flex-col border-r border-gray-800/60 bg-[#161b22] overflow-y-auto">
          <div className="p-6">
            <div className="inline-block px-2.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-400 mb-4">
              {challenge.concept}
            </div>
            <h2 className="text-2xl font-bold text-gray-100 mb-4 tracking-tight leading-tight">
              {challenge.title}
            </h2>
            {challenge.id.includes('resolution') && (
              <div className="bg-purple-900/20 border border-purple-800/40 text-purple-300 text-xs px-3 py-2 rounded-lg mb-4 font-medium uppercase tracking-wider">
                Resolution Assessment Active
              </div>
            )}
            <div className="prose prose-invert prose-sm">
              <p className="text-gray-300 leading-relaxed opacity-90">{challenge.description}</p>
            </div>
          </div>
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117] relative">
          <div className="flex-1 p-6 flex flex-col relative">
            <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl overflow-hidden flex-1 shadow-2xl flex flex-col">
              <div className="px-4 py-2 bg-[#2d2d2d] border-b border-gray-700 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                <span className="ml-2 text-xs font-mono text-gray-400">solution.py</span>
              </div>
              <div className="flex-1 relative">
                <CodeEditor
                  language={challenge.language}
                  code={code}
                  onChange={(val) => setCode(val || '')}
                />
              </div>
            </div>

            {/* Run Bar */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="group relative overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:shadow-none flex items-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Running Analysis...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Submit for Diagnosis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: AI Assistant Timeline */}
        <div className="w-[450px] border-l border-gray-800/60 shadow-xl z-10 flex flex-col bg-[#161b22]">
          <AIAssistantPanel 
            attempts={attempts} 
            isAnalyzing={isSubmitting} 
            onNextChallenge={handleNextChallenge}
          />
        </div>
      </div>

      {showAnalytics && (
        <LearnerAnalytics stats={stats} onClose={() => setShowAnalytics(false)} />
      )}
    </div>
  );
};
