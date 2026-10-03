import React from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, Sparkles, ArrowRight, Code2 } from 'lucide-react';

interface WelcomeSplashProps {
  onStart: () => void;
}

export const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ onStart }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 1.1 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Deep blurred background over the actual app */}
      <div className="absolute inset-0 bg-[#06090e]/80 backdrop-blur-xl"></div>

      {/* Animated Mesh Gradients */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-blob"></div>
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-1/4 left-1/3 w-[600px] h-[600px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[150px] animate-blob animation-delay-4000"></div>

      <motion.div 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center max-w-3xl px-6 text-center"
      >
        <div className="mb-6 p-4 bg-white/5 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
          <BrainCircuit className="w-16 h-16 text-indigo-400" />
        </div>

        <h1 className="text-6xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 tracking-tight mb-4 drop-shadow-sm">
          Re:Learn
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 font-light mb-8 max-w-2xl leading-relaxed">
          Traditional auto-graders tell you <span className="font-semibold text-red-400">what</span> failed.<br/>
          We diagnose the cognitive misconception to tell you <span className="font-semibold text-emerald-400">why</span>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 w-full max-w-3xl">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-2 backdrop-blur-sm">
            <Code2 className="w-6 h-6 text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-200">Semantic Analysis</h3>
            <p className="text-[11px] text-gray-400 text-center">Moving beyond syntax errors to understand mental models.</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-2 backdrop-blur-sm">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h3 className="text-sm font-semibold text-gray-200">Socratic Pedagogy</h3>
            <p className="text-[11px] text-gray-400 text-center">Guiding students to the answer without revealing it.</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-2 backdrop-blur-sm">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
            <h3 className="text-sm font-semibold text-gray-200">Multimodal Telemetry</h3>
            <p className="text-[11px] text-gray-400 text-center">Analyze code & handwritten diagrams simultaneously.</p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="group relative px-8 py-4 bg-white text-gray-950 font-bold text-lg rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-white to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="relative flex items-center gap-3">
            Initialize Cognitive Engine
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
};
