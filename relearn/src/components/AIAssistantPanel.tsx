import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Lightbulb, Bot, Terminal, Code2, Volume2, VolumeX, Sparkles } from 'lucide-react';
import type { Attempt, DomainType } from '../types';
import { TypewriterText } from './TypewriterText';
import ThoughtLine from './ThoughtLine';

import { getDomainThoughtSteps } from '../utils/thoughtSteps';

interface AIAssistantPanelProps {
  attempts: Attempt[];
  isAnalyzing: boolean;
  onNextChallenge?: () => void;
  domain?: DomainType;
}

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ 
  attempts, 
  isAnalyzing,
  onNextChallenge,
  domain
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const toggleSpeech = (attemptId: string, textToSpeak: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingId === attemptId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(attemptId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Progressive ThoughtLine steps for live pedagogical reasoning
  const domainSteps = useMemo(() => getDomainThoughtSteps(domain), [domain]);
  const [activeStepCount, setActiveStepCount] = useState(1);

  useEffect(() => {
    if (isAnalyzing) {
      setActiveStepCount(1);
      const timer1 = setTimeout(() => setActiveStepCount(2), 350);
      const timer2 = setTimeout(() => setActiveStepCount(3), 750);
      const timer3 = setTimeout(() => setActiveStepCount(4), 1150);
      const timer4 = setTimeout(() => setActiveStepCount(5), 1550);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
      };
    } else {
      setActiveStepCount(domainSteps.length);
    }
  }, [isAnalyzing, domainSteps.length]);

  // Auto-scroll to bottom when new attempt comes in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [attempts, isAnalyzing, activeStepCount]);

  return (
    <div className="h-full flex flex-col bg-[#0d1117] relative">
      <div className="p-4 border-b border-gray-800/60 bg-[#161b22] sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-700/50">
          <Bot className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-200">Re:Learn Pedagogue</h2>
          <p className="text-xs text-gray-500">AI Misconception Analysis</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {attempts.length === 0 && !isAnalyzing && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
            <Code2 className="w-16 h-16 mb-4" />
            <p className="text-center max-w-[250px]">Submit your code to receive deep semantic feedback on your mental model.</p>
          </div>
        )}

        <AnimatePresence>
          {attempts.map((attempt, idx) => (
            <motion.div 
              key={attempt.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col gap-4"
            >
              {/* User Code Bubble */}
              <div className="self-end max-w-[85%] bg-gray-800 border border-gray-700 rounded-2xl rounded-tr-sm p-4 shadow-md">
                <div className="flex items-center justify-between mb-2 text-xs text-gray-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3 h-3" />
                    Attempt #{idx + 1}
                  </span>
                  {attempt.imageBase64 && (
                    <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full font-sans">
                      📷 Attached Work
                    </span>
                  )}
                </div>
                {attempt.imageBase64 && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-gray-700 max-h-48 bg-black/40">
                    <img
                      src={attempt.imageBase64}
                      alt="Student Working"
                      className="w-full h-auto object-contain max-h-48"
                    />
                  </div>
                )}
                <pre className="text-sm font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
                  {attempt.code}
                </pre>
              </div>

              {/* AI Diagnosis Bubble */}
              {attempt.status === 'analyzed' && attempt.diagnosis && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className={`self-start max-w-[95%] border rounded-2xl rounded-tl-sm p-5 shadow-lg ${
                    attempt.diagnosis.is_correct 
                      ? 'bg-emerald-950/30 border-emerald-900/50' 
                      : 'bg-red-950/20 border-red-900/40'
                  }`}
                >
                  {/* Settled ThoughtLine summarizing the cognitive reasoning process */}
                  <div className="mb-3.5 pb-2.5 border-b border-white/10">
                    <ThoughtLine
                      working={false}
                      elapsed={attempt.thoughtTime || 1.6}
                      steps={attempt.thoughtSteps || domainSteps}
                      doneLabel="Thought for"
                      glyph="sparkle"
                      fontSize={12.5}
                      color={attempt.diagnosis.is_correct ? '#86efac' : '#cbd5e1'}
                      glyphColor={attempt.diagnosis.is_correct ? '#34d399' : '#38bdf8'}
                      collapsible={true}
                      collapseOnSettle={true}
                      showTimer={true}
                    />
                  </div>

                  {attempt.diagnosis.is_correct ? (
                    <div className="text-emerald-100">
                      <div className="flex items-center gap-2 mb-3 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        {attempt.diagnosis.explanation?.includes('Resolution') ? 'Misconception Resolved!' : 'Correct Solution!'}
                      </div>
                      <p className="mb-4 text-emerald-200/90 leading-relaxed">
                        {attempt.diagnosis.explanation || "Your code logic is perfectly sound. You've demonstrated a clear understanding of the concept!"}
                      </p>
                      {onNextChallenge && idx === attempts.length - 1 && (
                        <button 
                          onClick={onNextChallenge}
                          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
                        >
                          Proceed to Resolution Assessment ➔
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-red-900/30 pb-2">
                        <div className="flex items-center gap-2 text-red-400 font-semibold">
                          <AlertCircle className="w-5 h-5" />
                          <span>Identified Misconception</span>
                        </div>
                        {attempt.diagnosis.intervention && (
                          <button
                            onClick={() => toggleSpeech(
                              attempt.id,
                              `${attempt.diagnosis?.explanation}. Hint: ${attempt.diagnosis?.intervention}`
                            )}
                            className="flex items-center gap-1.5 text-xs bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-800/60 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                            title="Listen to Voice Pedagogue Explanation"
                          >
                            {speakingId === attempt.id ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                                <span>Stop Voice</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Listen (TTS)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      
                      {attempt.diagnosis.misconception ? (
                        <div className="bg-red-900/20 px-3 py-2 rounded-lg border border-red-800/30 inline-block">
                          <span className="text-red-300 font-medium text-sm">
                            {attempt.diagnosis.misconception}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-red-900/20 px-3 py-2 rounded-lg border border-red-800/30 inline-block">
                          <span className="text-red-300 font-medium text-sm">
                            Logical Misconception Detected
                          </span>
                        </div>
                      )}

                      <div className="text-gray-300 text-sm leading-relaxed min-h-[3rem]">
                        <TypewriterText 
                          text={attempt.diagnosis.explanation || "The model identified that the logic does not satisfy the problem criteria. Review your condition and return values."} 
                          delay={15} 
                        />
                      </div>

                      {attempt.diagnosis.intervention && (
                        <div className="mt-4 bg-blue-950/30 p-4 rounded-xl border border-blue-900/50 relative overflow-hidden backdrop-blur-sm">
                          {/* Mesh gradient glow inside the blue hint box */}
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-indigo-600/10 pointer-events-none"></div>
                          
                          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                          <div className="flex gap-3 relative z-10">
                            <Lightbulb className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
                            <p className="text-blue-100 italic text-sm leading-relaxed min-h-[2rem]">
                              "<TypewriterText text={attempt.diagnosis.intervention} delay={25} />"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="self-start w-full bg-[#161b26]/95 border border-cyan-500/30 rounded-2xl rounded-tl-sm p-4 shadow-xl shadow-cyan-950/40 backdrop-blur-md"
          >
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-gray-800/80">
              <div className="w-5 h-5 rounded-full bg-cyan-950/80 flex items-center justify-center border border-cyan-600/50">
                <Bot className="w-3 h-3 text-cyan-400" />
              </div>
              <span className="text-xs font-semibold text-cyan-300">Pedagogue Diagnosis in Progress</span>
            </div>
            
            <ThoughtLine
              working={true}
              steps={domainSteps.slice(0, activeStepCount)}
              label="Diagnosing mental model…"
              glyph="sparkle"
              fontSize={13.5}
              breathPeriod={1.4}
              breathDepth={0.4}
              shimmer={true}
              color="#38bdf8"
              glyphColor="#38bdf8"
              collapsible={true}
              collapseOnSettle={false}
              showTimer={true}
            />
          </motion.div>
        )}
        
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
