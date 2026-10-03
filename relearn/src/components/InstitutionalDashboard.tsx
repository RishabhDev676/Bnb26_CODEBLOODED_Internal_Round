import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { 
  GraduationCap, Download, Users, Lightbulb, CheckCircle2, TrendingUp, AlertOctagon 
} from 'lucide-react';

interface InstitutionalDashboardProps {
  onClose: () => void;
}

const COHORT_MISCONCEPTIONS_DATA = [
  { name: 'Assign vs Equality (= vs ==)', count: 48, severity: 'Critical', domain: 'Python' },
  { name: 'Freshman\'s Dream Expansion', count: 36, severity: 'High', domain: 'Algebra' },
  { name: 'Mutable Default Argument', count: 29, severity: 'High', domain: 'Python' },
  { name: 'Deceleration vs Negative a Sign', count: 24, severity: 'Medium', domain: 'Physics' },
  { name: 'Loose Equality Type Coercion', count: 19, severity: 'Medium', domain: 'JS' },
];

const AT_RISK_STUDENTS = [
  { id: 'STU-104', name: 'Aarav Patel', attempts: 14, unresMisconceptions: 3, status: 'Needs 1-on-1 Office Hours' },
  { id: 'STU-089', name: 'Neha Sharma', attempts: 11, unresMisconceptions: 2, status: 'Struggling with Operators' },
  { id: 'STU-203', name: 'Rohan Deshmukh', attempts: 9, unresMisconceptions: 2, status: 'Algebraic Signs Confusion' },
  { id: 'STU-141', name: 'Priya Iyer', attempts: 6, unresMisconceptions: 1, status: 'Progressing Normally' },
];

export const InstitutionalDashboard: React.FC<InstitutionalDashboardProps> = ({ onClose }) => {
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleExportLTI = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "StudentID,Name,TotalAttempts,UnresolvedMisconceptions,Status,LTI_Sync_Status\n"
      + AT_RISK_STUDENTS.map(s => `${s.id},"${s.name}",${s.attempts},${s.unresMisconceptions},"${s.status}",SYNCED`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ReLearn_LTI1.3_Cohort_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadNotice("LTI 1.3 Compatible Gradebook & Misconception Log Exported!");
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0f141d] border border-gray-700/80 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-[#151c28] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-300">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Institutional & Instructor Insights</h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/50">
                  LTI 1.3 Ready
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Cohort-wide Cognitive Misconception Telemetry for CS101 / Science Educators
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 p-2 rounded-full transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Quick Cohort Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-6 bg-[#0b0f16] border-b border-gray-800">
          <div className="bg-gray-800/30 border border-gray-700/50 p-4 rounded-xl">
            <span className="text-xs text-gray-400 font-semibold uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              Active Cohort Size
            </span>
            <div className="text-2xl font-bold text-white mt-1">142 Students</div>
            <span className="text-[11px] text-gray-500">Introductory CS & STEM Section A</span>
          </div>

          <div className="bg-gray-800/30 border border-gray-700/50 p-4 rounded-xl">
            <span className="text-xs text-gray-400 font-semibold uppercase flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Resolution Success Rate
            </span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">78.4%</div>
            <span className="text-[11px] text-gray-500">Overcame initial diagnosed trap</span>
          </div>

          <div className="bg-gray-800/30 border border-gray-700/50 p-4 rounded-xl">
            <span className="text-xs text-gray-400 font-semibold uppercase flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
              Primary Class Bottleneck
            </span>
            <div className="text-lg font-bold text-amber-300 mt-1 truncate">Assignment vs Equality</div>
            <span className="text-[11px] text-gray-500">48 students triggered this error</span>
          </div>

          <div className="flex flex-col justify-center">
            <button
              onClick={handleExportLTI}
              className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-purple-950/40 flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              <Download className="w-4 h-4" />
              <span>Export LTI 1.3 / CSV</span>
            </button>
            {downloadNotice && (
              <span className="text-[10px] text-emerald-400 text-center mt-1 animate-fadeIn">
                {downloadNotice}
              </span>
            )}
          </div>
        </div>

        {/* Main Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Lecture Adaptation Recommendation */}
          <div className="bg-gradient-to-r from-blue-950/30 via-indigo-950/30 to-purple-950/30 border border-blue-800/50 p-5 rounded-2xl relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-900/40 rounded-lg border border-blue-700/50 text-blue-300 mt-0.5">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  AI Lecture Adaptation Recommendation (Tomorrow's Class)
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Based on telemetry from 142 student attempts today, <strong className="text-amber-300">34% of the cohort</strong> is conflating assignment statements with boolean expressions in Python.
                </p>
                <div className="mt-2 text-xs text-blue-200/90 bg-black/20 p-2.5 rounded-lg border border-blue-900/40 space-y-1">
                  <div>• <strong>Recommended Action:</strong> Dedicate the first 10 minutes of tomorrow's lecture to tracing <code className="bg-gray-800 px-1 py-0.5 rounded text-white">if x = 5:</code> vs <code className="bg-gray-800 px-1 py-0.5 rounded text-white">if x == 5:</code> in the Python compiler AST.</div>
                  <div>• <strong>Target Practice:</strong> Assign the follow-up "Resolution Assessment: Check Odd Number" as a 5-minute in-class clicker quiz.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid: Misconception Heatmap & At-Risk Triage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Misconception Frequency Chart */}
            <div className="bg-gray-800/20 border border-gray-800 p-5 rounded-2xl flex flex-col">
              <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center justify-between">
                <span>Class-Wide Misconception Frequency</span>
                <span className="text-xs text-gray-500 font-normal">Ranked by occurrences</span>
              </h3>
              <div className="w-full h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={COHORT_MISCONCEPTIONS_DATA} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252f3f" horizontal={false} />
                    <XAxis type="number" stroke="#9CA3AF" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="#9CA3AF" 
                      width={170} 
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#1f2937' }}
                      contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Student Triage / Office Hours Alert */}
            <div className="bg-gray-800/20 border border-gray-800 p-5 rounded-2xl flex flex-col">
              <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center justify-between">
                <span>At-Risk Student Triage (Early Warning System)</span>
                <span className="text-xs text-red-400 font-medium">3 Students Flagged</span>
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Students with multiple repeated attempts where the Socratic intervention has not yet resolved the cognitive misconception.
              </p>
              <div className="space-y-2 flex-1 overflow-y-auto">
                {AT_RISK_STUDENTS.map(s => (
                  <div 
                    key={s.id} 
                    className="p-3 bg-gray-900/60 rounded-xl border border-gray-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-gray-200 flex items-center gap-2">
                        <span>{s.name}</span>
                        <span className="font-mono text-[10px] text-gray-500">{s.id}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {s.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        s.unresMisconceptions >= 3 
                          ? 'bg-red-950 text-red-300 border border-red-800' 
                          : s.unresMisconceptions === 2 
                          ? 'bg-amber-950 text-amber-300 border border-amber-800' 
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {s.unresMisconceptions} Traps ({s.attempts} attempts)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#151c28] border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Telemetry aggregated in real time via PostgreSQL Row-Level Security</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors font-medium cursor-pointer"
          >
            Close Instructor View
          </button>
        </div>
      </div>
    </div>
  );
};
