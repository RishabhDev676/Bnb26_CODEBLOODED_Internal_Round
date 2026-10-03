import React, { useState, useEffect, useRef } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { AIAssistantPanel } from '../components/AIAssistantPanel';
import { LearnerAnalytics } from '../components/LearnerAnalytics';
import { ModelEvaluationModal } from '../components/ModelEvaluationModal';
import { InstitutionalDashboard } from '../components/InstitutionalDashboard';
import { supabase } from '../lib/supabase';
import { 
  Play, Key, AlertTriangle, Activity, Code2, Image, 
  X, Cpu, Layers, Sparkles, ChevronRight, HelpCircle, GraduationCap
} from 'lucide-react';
import { diagnoseWithGemini, geminiKeyManager } from '../services/geminiService';
import { CHALLENGES_CATALOG } from '../data/misconceptionsDataset';
import type { Attempt, LearnerModelStats, Diagnosis, Challenge, DomainType } from '../types';

export const LearningModule: React.FC = () => {
  const [selectedDomain, setSelectedDomain] = useState<DomainType | 'all'>('all');
  const [challenge, setChallenge] = useState<Challenge>(CHALLENGES_CATALOG[0]);
  const [code, setCode] = useState<string>(challenge.initialCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showInstructor, setShowInstructor] = useState(false);
  const [rotationMessage, setRotationMessage] = useState<string | null>(null);

  // Multimodal image attachment state
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageMime, setAttachedImageMime] = useState<string>('image/jpeg');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Learner Model Stats
  const [stats, setStats] = useState<LearnerModelStats>({
    conceptMastery: [
      { subject: 'Operators & Conditionals', score: 45, fullMark: 100 },
      { subject: 'Variable Scoping', score: 85, fullMark: 100 },
      { subject: 'Type Identity', score: 70, fullMark: 100 },
      { subject: 'Binomial Expansion', score: 50, fullMark: 100 },
      { subject: 'Kinematics Signs', score: 60, fullMark: 100 },
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

  // Sync code when challenge changes
  const handleSelectChallenge = (c: Challenge) => {
    setChallenge(c);
    setCode(c.initialCode);
    setAttempts([]);
    setAttachedImage(null);
    setRotationMessage(null);
  };

  // Dynamic Learner Analytics update
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

  // Handle image upload for handwritten math/physics working
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedImageMime(file.type || 'image/jpeg');
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setRotationMessage(null);

    const newAttempt: Attempt = {
      id: Date.now().toString(),
      code,
      timestamp: new Date(),
      status: 'analyzing',
      diagnosis: null,
      imageBase64: attachedImage || undefined,
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
          },
          attachedImage || undefined,
          attachedImageMime
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
      setTimeout(() => {
        setAttempts(prev => prev.map(a => a.id === newAttempt.id ? {
          ...a,
          status: 'analyzed',
          diagnosis: {
            is_correct: false,
            misconception: "Assignment operator '=' used in comparison context",
            explanation: "In Python, a single '=' assigns a value to a variable, whereas '==' compares two values. Inside 'n % 2 = 0', Python expects a boolean evaluation, not an assignment statement.",
            intervention: "Notice the difference between creating a variable and checking its value. How do you test equality in an if condition?"
          }
        } : a));
        setIsSubmitting(false);
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextChallenge = () => {
    if (challenge.resolutionChallengeId) {
      const resolutionChallenge = CHALLENGES_CATALOG.find(c => c.id === challenge.resolutionChallengeId);
      if (resolutionChallenge) {
        setChallenge(resolutionChallenge);
        setCode(resolutionChallenge.initialCode);
        setAttempts([]);
        setAttachedImage(null);
        setRotationMessage(null);
        return;
      }
    }

    // Next sequential challenge
    const currentIndex = CHALLENGES_CATALOG.findIndex(c => c.id === challenge.id);
    const nextChallenge = CHALLENGES_CATALOG[(currentIndex + 1) % CHALLENGES_CATALOG.length];
    setChallenge(nextChallenge);
    setCode(nextChallenge.initialCode);
    setAttempts([]);
    setAttachedImage(null);
  };

  const filteredChallenges = selectedDomain === 'all' 
    ? CHALLENGES_CATALOG.filter(c => !c.id.includes('resolution'))
    : CHALLENGES_CATALOG.filter(c => c.domain === selectedDomain && !c.id.includes('resolution'));

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-gray-200 font-sans selection:bg-blue-500/30">
      {/* Top Navbar */}
      <header className="px-6 py-2.5 border-b border-gray-800/80 bg-[#161b22] flex justify-between items-center z-20 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-gray-100">Re:Learn</h1>
              <span className="text-[10px] uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800/80 px-2 py-0.5 rounded-full font-bold">
                Adaptive Multimodal
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Cognitive Misconception Diagnosis & Resolution Engine
            </p>
          </div>
        </div>

        {/* Action Controls & Resilience Status */}
        <div className="flex items-center gap-3">
          {keyCount > 0 && (
            <div className="flex items-center gap-2 text-xs bg-[#0b0f15] border border-gray-700/80 px-3 py-1.5 rounded-lg text-gray-300">
              <Key className="w-3.5 h-3.5 text-blue-400" />
              <span>Pool: <strong>{keyCount} Keys</strong></span>
              <span className="text-emerald-400 font-mono text-[11px] bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.2 rounded">
                Active #{currentKeyIndex + 1}
              </span>
            </div>
          )}

          {/* Model Evaluation Benchmark Button */}
          <button
            onClick={() => setShowEvaluation(true)}
            className="flex items-center gap-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Model Benchmark</span>
          </button>

          {/* Learner Analytics Dashboard Button */}
          <button
            onClick={() => setShowAnalytics(true)}
            className="flex items-center gap-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Activity className="w-4 h-4 text-indigo-400" />
            <span>Learner Model</span>
          </button>

          {/* Institutional / Instructor Dashboard Button */}
          <button
            onClick={() => setShowInstructor(true)}
            className="flex items-center gap-1.5 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <GraduationCap className="w-4 h-4 text-purple-400" />
            <span>Instructor View</span>
          </button>
        </div>
      </header>

      {/* Rotation Notice Banner */}
      {rotationMessage && (
        <div className="bg-amber-950/40 border-b border-amber-700/50 px-6 py-2 flex items-center gap-2 text-amber-200 text-xs animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{rotationMessage}</span>
        </div>
      )}

      {/* Main Multi-Pane Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Column: Challenge Catalog & Problem Context */}
        <div className="w-[360px] flex flex-col border-r border-gray-800/80 bg-[#12161f] overflow-y-auto">
          {/* Domain Filter Tabs */}
          <div className="p-3 border-b border-gray-800/80 bg-[#161b22]">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-400">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Domain Selector</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-[11px] font-medium">
              {(['all', 'programming', 'algebra', 'physics'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDomain(d)}
                  className={`py-1 px-1.5 rounded text-center capitalize transition-colors ${
                    selectedDomain === d
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Challenge Selector Chips */}
          <div className="p-3 border-b border-gray-800/80 space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block px-1">
              Select Problem
            </span>
            {filteredChallenges.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectChallenge(c)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                  challenge.id === c.id || challenge.resolutionChallengeId === c.id
                    ? 'bg-blue-950/60 border border-blue-700/70 text-blue-200 shadow-sm'
                    : 'bg-gray-800/30 hover:bg-gray-800/60 text-gray-300 border border-transparent'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="font-semibold truncate">{c.title}</div>
                  <div className="text-[10px] text-gray-400">{c.concept}</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              </button>
            ))}
          </div>

          {/* Active Challenge Details */}
          <div className="p-5 flex-1 space-y-4">
            {challenge.id.includes('resolution') && (
              <div className="bg-purple-950/40 border border-purple-800/60 text-purple-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>
                  <strong>Resolution Assessment Mode</strong>: Testing if your cognitive misconception was genuinely resolved.
                </span>
              </div>
            )}

            <div>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/50">
                {challenge.concept}
              </span>
              <h2 className="text-xl font-bold text-gray-100 mt-2 mb-2 leading-tight">
                {challenge.title}
              </h2>
              <div className="text-gray-300 text-sm leading-relaxed bg-gray-800/40 p-3.5 rounded-lg border border-gray-700/50">
                {challenge.description}
              </div>
            </div>

            {challenge.hints && challenge.hints.length > 0 && (
              <div className="bg-gray-800/20 p-3 rounded-lg border border-gray-700/40 text-xs text-gray-400 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-300 font-semibold mb-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Guidance</span>
                </div>
                {challenge.hints.map((hint, i) => (
                  <p key={i}>• {hint}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Editor, Multimodal Attachment, & Run Controls */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e14] relative">
          <div className="flex-1 p-5 flex flex-col relative">
            <div className="bg-[#1e1e1e] border border-gray-700/80 rounded-xl overflow-hidden flex-1 shadow-2xl flex flex-col">
              <div className="px-4 py-2 bg-[#252526] border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  <span className="ml-2 text-xs font-mono text-gray-400">
                    {challenge.language === 'javascript' ? 'solution.js' : 'solution.py'}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-gray-400 uppercase">
                  {challenge.language}
                </span>
              </div>

              <div className="flex-1 relative">
                <CodeEditor
                  language={challenge.language}
                  code={code}
                  onChange={(val) => setCode(val || '')}
                />
              </div>
            </div>

            {/* Multimodal Image Attachment Preview */}
            {attachedImage && (
              <div className="mt-3 bg-gray-900 border border-cyan-800/60 rounded-xl p-3 flex items-center justify-between animate-fadeIn shadow-md">
                <div className="flex items-center gap-3">
                  <img
                    src={attachedImage}
                    alt="Handwritten work preview"
                    className="w-14 h-14 object-cover rounded-lg border border-gray-700 shadow-sm"
                  />
                  <div>
                    <span className="text-xs font-semibold text-cyan-300 block">
                      📷 Multimodal Handwritten Work Attached
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Gemini will analyze your diagram / algebraic steps alongside code
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleRemoveImage}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Run Bar & Multimodal Attach Button */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                  title="Attach handwritten working or diagram for multimodal diagnosis"
                >
                  <Image className="w-4 h-4 text-cyan-400" />
                  <span>Attach Work / Diagram</span>
                </button>
                <span className="text-xs text-gray-500 hidden sm:inline">
                  Supports handwritten math, formulas, & physics diagrams
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 px-7 rounded-xl transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="text-sm">Diagnosing Mental Model...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span className="text-sm">Submit for Diagnosis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: AI Assistant Timeline */}
        <div className="w-[440px] border-l border-gray-800/80 shadow-2xl z-10 flex flex-col bg-[#161b22]">
          <AIAssistantPanel
            attempts={attempts}
            isAnalyzing={isSubmitting}
            onNextChallenge={handleNextChallenge}
          />
        </div>
      </div>

      {/* Learner Analytics Dashboard Modal */}
      {showAnalytics && (
        <LearnerAnalytics stats={stats} onClose={() => setShowAnalytics(false)} />
      )}

      {/* Model Evaluation Benchmark Modal */}
      {showEvaluation && (
        <ModelEvaluationModal onClose={() => setShowEvaluation(false)} />
      )}

      {/* Institutional & Instructor Dashboard Modal */}
      {showInstructor && (
        <InstitutionalDashboard onClose={() => setShowInstructor(false)} />
      )}
    </div>
  );
};
