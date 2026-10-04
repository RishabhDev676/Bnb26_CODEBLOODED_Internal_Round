import React from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import type { LearnerModelStats } from '../types';
import { BrainCircuit, Target, AlertTriangle } from 'lucide-react';

interface LearnerAnalyticsProps {
  stats: LearnerModelStats;
  onClose: () => void;
}

export const LearnerAnalytics: React.FC<LearnerAnalyticsProps> = ({ stats, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92dvh]">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <BrainCircuit className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-400 flex-shrink-0" />
            <h2 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
              Learner Model Analytics
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-full transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          
          {/* Top Stats Cards */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            <div className="bg-gray-800/50 p-4 sm:p-6 rounded-xl border border-gray-700/50 flex flex-col">
              <span className="text-gray-400 text-xs sm:text-sm uppercase tracking-wider mb-2">Total Submissions</span>
              <span className="text-3xl sm:text-4xl font-bold text-white">{stats.totalAttempts}</span>
            </div>
            <div className="bg-gray-800/50 p-4 sm:p-6 rounded-xl border border-gray-700/50 flex flex-col">
              <span className="text-gray-400 text-xs sm:text-sm uppercase tracking-wider mb-2">Resolution Rate</span>
              <div className="flex items-end gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-emerald-400">{stats.resolutionRate}%</span>
                <span className="text-xs sm:text-sm text-gray-500 mb-1">of misconceptions resolved</span>
              </div>
            </div>
            <div className="bg-gray-800/50 p-4 sm:p-6 rounded-xl border border-gray-700/50 flex flex-col">
              <span className="text-gray-400 text-xs sm:text-sm uppercase tracking-wider mb-2">Active Misconceptions</span>
              <span className="text-3xl sm:text-4xl font-bold text-amber-400">{stats.recurringMisconceptions.length}</span>
            </div>
          </div>

          {/* Radar Chart: Concept Mastery */}
          <div className="bg-gray-800/30 p-4 sm:p-6 rounded-xl border border-gray-700 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4 sm:mb-6 w-full">
              <Target className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-200">Concept Mastery</h3>
            </div>
            <div className="w-full h-[220px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats.conceptMastery}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6B7280' }} />
                  <Radar
                    name="Mastery"
                    dataKey="score"
                    stroke="#38BDF8"
                    fill="#38BDF8"
                    fillOpacity={0.4}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#E5E7EB' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart: Recurring Misconceptions */}
          <div className="bg-gray-800/30 p-4 sm:p-6 rounded-xl border border-gray-700 flex flex-col">
            <div className="flex items-center gap-2 mb-4 sm:mb-6 w-full">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-200">Recurring Misconceptions</h3>
            </div>
            <div className="w-full h-[220px] sm:h-[300px]">
              {stats.recurringMisconceptions.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.recurringMisconceptions} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" stroke="#9CA3AF" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#9CA3AF" 
                      width={120} 
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#374151' }}
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-900" />
                  <p>No active misconceptions detected!</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// We need to import CheckCircle2 above
import { CheckCircle2 } from 'lucide-react';
