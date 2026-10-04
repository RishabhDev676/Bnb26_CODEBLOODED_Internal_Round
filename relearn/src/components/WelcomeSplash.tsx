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
      exit={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex justify-center items-start sm:items-center overflow-y-auto overflow-x-hidden p-4 sm:p-6"
    >
      {/* Deep dark backdrop to prevent underlying text bleed-through when resized */}
      <div className="fixed inset-0 bg-[#070a11]/95 backdrop-blur-2xl"></div>

      {/* Animated Mesh Gradients */}
      <div className="fixed top-1/4 left-1/4 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] sm:blur-[120px] animate-blob pointer-events-none"></div>
      <div className="fixed top-1/3 right-1/4 w-[300px] sm:w-[400px] h-[300px] sm:h-[400px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[90px] sm:blur-[100px] animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="fixed bottom-1/4 left-1/3 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[110px] sm:blur-[150px] animate-blob animation-delay-4000 pointer-events-none"></div>

      <motion.div 
        initial={{ y: 25, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center max-w-3xl w-full my-auto py-6 sm:py-8 text-center"
      >
        <div className="mb-3 sm:mb-5 p-2.5 sm:p-4 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
          <BrainCircuit className="w-10 h-10 sm:w-14 sm:h-14 text-indigo-400" />
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 tracking-tight mb-2 sm:mb-4 drop-shadow-sm">
          Re:Learn
        </h1>
        
        <p className="text-sm sm:text-lg md:text-xl text-gray-300 font-light mb-5 sm:mb-8 max-w-2xl leading-relaxed px-2">
          Traditional auto-graders tell you <span className="font-semibold text-red-400">what</span> failed.<br/>
          We figure out the exact mistake in your thinking to tell you <span className="font-semibold text-emerald-400">why</span>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-6 sm:mb-8 w-full max-w-3xl px-2">
          <div className="bg-white/[0.04] border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center gap-1.5 sm:gap-2 backdrop-blur-sm">
            <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-gray-200">Deep Understanding</h3>
            <p className="text-[10px] sm:text-[11px] text-gray-400 text-center leading-normal">
              Looking past simple typos to understand how you think.
            </p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center gap-1.5 sm:gap-2 backdrop-blur-sm">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-gray-200">Smart Hints</h3>
            <p className="text-[10px] sm:text-[11px] text-gray-400 text-center leading-normal">
              Helping you find the answer without just giving it away.
            </p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center gap-1.5 sm:gap-2 backdrop-blur-sm">
            <BrainCircuit className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-gray-200">Visual & Text AI</h3>
            <p className="text-[10px] sm:text-[11px] text-gray-400 text-center leading-normal">
              Reads your code, math, and handwritten notes all at once.
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onStart}
          className="group relative px-6 sm:px-8 py-3 sm:py-3.5 bg-white text-gray-950 font-bold text-sm sm:text-base md:text-lg rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_0_35px_rgba(255,255,255,0.3)] transition-all hover:shadow-[0_0_55px_rgba(255,255,255,0.5)] cursor-pointer flex-shrink-0"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-white to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="relative flex items-center gap-2.5">
            Start Learning Engine
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
};
