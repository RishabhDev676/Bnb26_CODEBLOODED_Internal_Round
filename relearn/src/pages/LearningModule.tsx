import React, { useState, useEffect, useRef } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { AIAssistantPanel } from '../components/AIAssistantPanel';
import { LearnerAnalytics } from '../components/LearnerAnalytics';
import { ModelEvaluationModal } from '../components/ModelEvaluationModal';
import { InstitutionalDashboard } from '../components/InstitutionalDashboard';
import { supabase } from '../lib/supabase';
import { 
  Play, AlertTriangle, Activity, Code2, Image, 
  X, Cpu, Layers, Sparkles, ChevronRight, HelpCircle, GraduationCap, BrainCircuit
} from 'lucide-react';
import { diagnoseCognitiveMisconception } from '../services/geminiService';
import { MISCONCEPTIONS_DICTIONARY, CHALLENGES_CATALOG } from '../data/misconceptionsDataset';
import type { Attempt, LearnerModelStats, Diagnosis, Challenge, DomainType } from '../types';
import confetti from 'canvas-confetti';
import { WelcomeSplash } from '../components/WelcomeSplash';
import { AnimatePresence } from 'framer-motion';

export interface CustomPreset {
  id: string;
  name: string;
  domain: string;
  language: string;
  concept: string;
  title: string;
  question: string;
  initialWork: string;
}

export const CUSTOM_PRESETS: CustomPreset[] = [
  {
    id: 'preset-math-quadratic',
    name: 'Algebra: Quadratic Factoring',
    domain: 'mathematics',
    language: 'markdown',
    concept: 'Quadratic Equations & Factoring',
    title: 'Factoring Quadratic Trinomial',
    question: 'Solve x² - 5x + 6 = 0 by factoring. State the factored form and find all roots for x.',
    initialWork: '# Problem: Solve x^2 - 5x + 6 = 0\n# Factored expression:\n(x - 2)(x + 3) = 0\n\n# Roots:\nx = 2 or x = -3\n'
  },
  {
    id: 'preset-py-even',
    name: 'Python: Even Parity Function',
    domain: 'programming',
    language: 'python',
    concept: 'Arithmetic & Modulo Operations',
    title: 'Even Number Parity Function',
    question: 'Write a Python function called `is_even(n)` that returns True if the integer `n` is even, and False otherwise.',
    initialWork: 'def is_even(n):\n    # Return True if number is even\n    if n / 2 == 0:\n        return True\n    return False\n'
  },
  {
    id: 'preset-js-auth',
    name: 'JavaScript: Auth Boolean Logic',
    domain: 'programming',
    language: 'javascript',
    concept: 'Boolean Logic & Truthiness',
    title: 'Strict Role Authentication Guard',
    question: 'Write a JavaScript function `isAuthenticated(user)` that returns true if `user.isLoggedIn` and `user.role === "admin"`.',
    initialWork: 'function isAuthenticated(user) {\n    // Check if user is logged in and is admin\n    if (user.isLoggedIn = true && user.role == "admin") {\n        return true;\n    }\n    return false;\n}\n'
  },
  {
    id: 'preset-phys-accel',
    name: 'Physics: Deceleration & Signs',
    domain: 'physics',
    language: 'markdown',
    concept: 'Newtonian Kinematics & Signs',
    title: 'Deceleration Vector Coordinates',
    question: 'A 2 kg cart rolling forward at +10 m/s applies brakes and decelerates at 4 m/s² for 2 seconds. What is its acceleration vector a and final velocity v?',
    initialWork: '# Problem Data:\n# v_initial = +10 m/s\n# Deceleration rate = 4 m/s^2\n# Since it is decelerating, acceleration is positive: a = +4 m/s^2\n# v_final = v_initial + a*t = 10 + (4)(2) = 18 m/s\n'
  },
  {
    id: 'preset-chem-stoich',
    name: 'Chemistry: Stoichiometry Moles',
    domain: 'chemistry',
    language: 'markdown',
    concept: 'Stoichiometry & Molar Ratios',
    title: 'Reaction Molar Yield',
    question: 'How many moles of H₂O are produced when 4 moles of H₂ react with excess O₂ according to the equation 2H₂ + O₂ → 2H₂O?',
    initialWork: '# Reaction: 2H2 + O2 -> 2H2O\n# Calculation:\n# Since 4 moles H2 react and formula has 2 moles,\n# Moles of H2O = 4 / 2 = 2 moles\n'
  }
];

export const getFilenameForLanguage = (lang: string): string => {
  switch (lang?.toLowerCase()) {
    case 'javascript': return 'solution.js';
    case 'typescript': return 'solution.ts';
    case 'python': return 'solution.py';
    case 'java': return 'Solution.java';
    case 'cpp': case 'c++': return 'solution.cpp';
    case 'c': return 'solution.c';
    case 'sql': return 'query.sql';
    case 'markdown': return 'solution.math';
    default: return 'working.txt';
  }
};

export const getMonacoLanguage = (lang: string): string => {
  switch (lang?.toLowerCase()) {
    case 'python': return 'python';
    case 'javascript': return 'javascript';
    case 'typescript': return 'typescript';
    case 'java': return 'java';
    case 'cpp': case 'c++': case 'c': return 'cpp';
    case 'sql': return 'sql';
    case 'markdown': return 'markdown';
    default: return 'plaintext';
  }
};

function evaluateChallengeLocally(challenge: Challenge, code: string): Diagnosis {
  const cleanCode = code.replace(/\r/g, '').trim();

  // â”€â”€ Universal cross-challenge pattern detectors (checked FIRST) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // These must fire regardless of which challenge is active, because a student
  // can introduce a cross-cutting misconception in any challenge's code.

  // Universal Pattern 1: Shadowing built-in names
  const BUILTINS_RE = /\b(list|sum|dict|str|int|max|min|type|print|len|range|map|filter|zip|set|tuple|input|open)\s*=/;
  const shadowMatch = cleanCode.match(BUILTINS_RE);
  if (shadowMatch) {
    const shadowedName = shadowMatch[1];
    const renameHints: Record<string, string> = { sum: 'total', list: 'items', dict: 'mapping', str: 'text', int: 'value', max: 'maximum', min: 'minimum', len: 'length', range: 'span' };
    const suggestion = renameHints[shadowedName] || `${shadowedName}_val`;
    return {
      is_correct: false,
      misconception: `Built-in name shadowing ('${shadowedName}' overwritten)`,
      explanation: `Assigning to a variable named '${shadowedName}' overwrites Python's built-in function of the same name in the current scope. Any subsequent call to ${shadowedName}() in that scope will fail with a TypeError because it now refers to your variable, not the built-in.`,
      intervention: `Rename your variable to something descriptive like '${suggestion}' to avoid overriding Python's built-in '${shadowedName}'.`
    };
  }

  // Universal Pattern 2: Mutating collection during iteration
  if (/for\s+(\w+)\s+in\s+(\w+)\s*:[\s\S]*\2\.(remove|pop|append)\(/i.test(cleanCode)) {
    return {
      is_correct: false,
      misconception: "Mutating a collection during iteration",
      explanation: "Modifying a list (using .remove() or .pop()) while iterating over it alters the underlying indices dynamically, causing Python to skip subsequent elements silently.",
      intervention: "To safely filter elements, iterate over a slice copy 'for x in list[:]:' or use a list comprehension: [x for x in list if condition]."
    };
  }

  // Universal Pattern 3: Missing base case in recursion
  if (/def\s+(\w+)\s*\([^)]*\):[\s\S]*\1\s*\(/i.test(cleanCode) && !/if\b/.test(cleanCode)) {
    return {
      is_correct: false,
      misconception: "Missing base case in recursion (infinite recursion)",
      explanation: "The recursive function calls itself without an 'if' base-case condition to terminate recursion, which causes a RecursionError (stack overflow).",
      intervention: "What is the terminating condition where the function should stop recursing and return a constant value?"
    };
  }

  // Universal Pattern 4: Floating point precision equality
  if (/(0\.1\s*\+\s*0\.2|==\s*0\.3)/.test(cleanCode)) {
    return {
      is_correct: false,
      misconception: "Floating-point precision equality assumption",
      explanation: "In IEEE-754 floating point arithmetic, 0.1 + 0.2 evaluates to 0.30000000000000004. Comparing floats directly with '==' fails due to binary representation limits.",
      intervention: "Use math.isclose() or check if abs(a - b) < 1e-9 instead of exact equality."
    };
  }


  // 1. Python Even Number Check: is_even(n)
  if (challenge.id === 'ch-py-is-even') {
    if (
      /n\s*%\s*2\s*==\s*0/.test(cleanCode) ||
      /n\s*%\s*2\s*!=\s*1/.test(cleanCode) ||
      /not\s*\(\s*n\s*%\s*2\s*\)/.test(cleanCode) ||
      /return\s+n\s*%\s*2\s*==\s*0/.test(cleanCode) ||
      /\(?\s*n\s*&\s*1\s*\)?\s*==\s*0/.test(cleanCode) ||
      /return\s+not\s*\(?\s*n\s*&\s*1\s*\)?/.test(cleanCode) ||
      /return\s+\(?\s*n\s*&\s*1\s*\)?\s*==\s*0/.test(cleanCode)
    ) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Excellent! You used comparative/bitwise logic to correctly verify even parity.",
        intervention: null
      };
    }
    if (/if\s+n\s*%\s*2\s*:\s*return\s+True/i.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Truthy remainder inverted logic",
        explanation: "In Python, non-zero integers evaluate to True. When n is odd, n % 2 is 1 (True); when n is even, n % 2 is 0 (False). This function inverts the logic and returns True for odd numbers.",
        intervention: "What is 4 % 2 vs 5 % 2? In Python, does 0 evaluate to True or False in an if condition?"
      };
    }
    if (/def\s+\w+\(.*=\s*\[\]\)/.test(cleanCode) || /=\s*\{\}/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Mutable default argument state retention",
        explanation: "In Python, default arguments are instantiated once when the function is defined, not per call. A mutable default like [] or {} will retain state and accumulate changes across repeated function calls.",
        intervention: "What happens across multiple invocations? Use None as default and initialize the list inside the function."
      };
    }
    if (/range\(.*len\(.*\)\s*\+\s*1\)/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Index out of bounds / range upper bound inclusive assumption",
        explanation: "Python sequences are 0-indexed with valid indices from 0 to len - 1. Iterating up to len + 1 attempts to access an out-of-bounds index, raising an IndexError.",
        intervention: "What is the highest valid index in a list of N elements? Does range(len(arr)) already reach the last item?"
      };
    }
    if (/n\s*%\s*2\s*=\s*0/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Assignment operator '=' used in comparison context",
        explanation: "In Python, a single '=' assigns a value to a variable, whereas '==' compares two values. Inside 'if n % 2 = 0:', Python encounters a syntax error because it expects a boolean expression, not an assignment statement.",
        intervention: "Notice the difference between creating a variable and checking its value. How do you test equality in an if condition?"
      };
    }
    return {
      is_correct: false,
      misconception: "Modulo arithmetic logic error",
      explanation: "A number is even if and only if dividing by 2 leaves a remainder of exactly 0.",
      intervention: "Examine your condition with the modulo operator %. What should n % 2 equal for even numbers?"
    };
  }

  // 2. Python Odd Number Resolution: is_odd(n)
  if (challenge.id === 'ch-py-is-odd-resolution') {
    if (/n\s*%\s*2\s*(==\s*1|!=\s*0)/.test(cleanCode) || /return\s+bool\(\s*n\s*%\s*2\s*\)/.test(cleanCode) || /return\s+n\s*%\s*2\s*!=\s*0/.test(cleanCode) || /return\s+n\s*%\s*2\s*==\s*1/.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Resolution confirmed! You successfully applied comparative operators ('!=' or '==') to test for odd parity.",
        intervention: null
      };
    }
    if (/n\s*%\s*2\s*=\s*1/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Assignment operator '=' used in comparison context",
        explanation: "You are still using a single '=' assignment instead of the '==' equality or '!=' inequality operator.",
        intervention: "Remember the resolution goal: use comparison operators (== or !=) in boolean expressions."
      };
    }
    return {
      is_correct: false,
      misconception: "Incomplete resolution implementation",
      explanation: "The function is_odd(n) must check if the remainder when dividing n by 2 is 1 (or not 0).",
      intervention: "Write: if n % 2 == 1: return True else: return False (or return n % 2 != 0)."
    };
  }

  // 3. JavaScript Strict Equality: isValidToken
  if (challenge.id === 'ch-js-equality') {
    if (/===/.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Perfect! By using strict equality (===), JavaScript checks both type and value, preventing string '1' from coercing to number 1.",
        intervention: null
      };
    }
    if (/==/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Loose equality (==) allows implicit type coercion",
        explanation: "Loose equality (==) coerces string '1' into number 1, which causes unauthorized tokens to pass verification.",
        intervention: "Which operator in JavaScript checks both the data type and the value without coercion?"
      };
    }
    return {
      is_correct: false,
      misconception: "Missing authentication condition",
      explanation: "Both role and tier need to be strictly compared against their expected values.",
      intervention: "Check both role === 'admin' and tier === 1."
    };
  }

  // 4. JavaScript Strict Validation Resolution
  if (challenge.id === 'ch-js-equality-resolution') {
    if (/typeof\s+val\s*===\s*['"]number['"]/.test(cleanCode) && />\s*0/.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Resolution verified! You accurately checked both the strict type 'number' and positive magnitude.",
        intervention: null
      };
    }
    return {
      is_correct: false,
      misconception: "Incomplete type guard",
      explanation: "Ensure you check both typeof val === 'number' and that val > 0.",
      intervention: "Use typeof val === 'number' && val > 0."
    };
  }

  // 5. Algebra Binomial Expansion: (2x + 3)^2
  if (challenge.id === 'ch-alg-binomial') {
    if (/12\s*\*?\s*x/.test(cleanCode) && /4\s*\*?\s*x\^?2/.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Correct! The full expansion is 4x^2 + 12x + 9. You avoided the Freshman's Dream error and correctly computed the 2ab cross-product term.",
        intervention: null
      };
    }
    if (/4x\^?2\s*\+\s*9/.test(cleanCode) && !/12x/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Freshman's Dream (Binomial Expansion)",
        explanation: "You distributed the exponent as (2x)^2 + 3^2 = 4x^2 + 9, missing the middle cross term 2 * (2x) * (3) = 12x.",
        intervention: "Remember (a + b)^2 = a^2 + 2ab + b^2. What is 2 * (2x) * 3?"
      };
    }
    return {
      is_correct: false,
      misconception: "Polynomial expansion incomplete",
      explanation: "Expand (2x + 3)(2x + 3) completely by multiplying all terms.",
      intervention: "Apply FOIL: First (2x * 2x), Outer (2x * 3), Inner (3 * 2x), Last (3 * 3)."
    };
  }

  // 6. Algebra Binomial Resolution: (3x - 5)^2
  if (challenge.id === 'ch-alg-binomial-resolution') {
    if (/9\s*\*?\s*x\^?2/.test(cleanCode) && /-?\s*30\s*\*?\s*x/.test(cleanCode) && /25/.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Mastery achieved! (3x - 5)^2 = 9x^2 - 30x + 25. You properly included the negative cross-term -30x.",
        intervention: null
      };
    }
    return {
      is_correct: false,
      misconception: "Missing cross-term or sign in expansion",
      explanation: "(3x - 5)^2 expands to (3x)^2 - 2*(3x)*(5) + (-5)^2 = 9x^2 - 30x + 25.",
      intervention: "Don't forget the middle term: 2 * (3x) * (-5)."
    };
  }

  // 7. Physics Freefall: kinematics
  if (challenge.id === 'ch-phys-kinematics') {
    if (cleanCode.includes("-9.8") && (!cleanCode.includes("+9.8") || cleanCode.includes("both") || cleanCode.includes("always -9.8") || cleanCode.includes("downward"))) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Outstanding! You correctly recognized that acceleration due to gravity is always directed downward (-9.8 m/s^2), regardless of whether the ball is moving up or down.",
        intervention: null
      };
    }
    if (cleanCode.includes("+9.8")) {
      return {
        is_correct: false,
        misconception: "Deceleration vs Negative Acceleration Sign Confusion",
        explanation: "During descent, the ball is speeding up in the negative direction. Because velocity is negative (v < 0) and acceleration is negative (a = -9.8), speed increases. Gravity does not become +9.8!",
        intervention: "Does Earth's gravity suddenly push upwards when the ball turns around at the peak?"
      };
    }
    return {
      is_correct: false,
      misconception: "Kinematic sign ambiguity",
      explanation: "State the signs of velocity and acceleration clearly for both ascent and descent.",
      intervention: "Note that downward vectors have negative signs in standard coordinate systems."
    };
  }

  // 8. Physics Resolution: Elevator descending while braking
  if (challenge.id === 'ch-phys-kinematics-resolution') {
    if (/v.*[-<]\s*0/.test(cleanCode) || /a.*[+>]\s*0/.test(cleanCode) || (/v_sign\s*=\s*['"]?-/i.test(cleanCode) && /a_sign\s*=\s*['"]?\+/i.test(cleanCode))) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Resolution confirmed! Moving downward means v < 0. Braking (slowing down) means acceleration opposes velocity, so a > 0.",
        intervention: null
      };
    }
    return {
      is_correct: false,
      misconception: "Vector opposition confusion",
      explanation: "When an object slows down, its acceleration vector points in the opposite direction of its velocity vector.",
      intervention: "If velocity is negative (downward), which direction must acceleration point to slow it down?"
    };
  }

  // â”€â”€ Generic fallback (unknown code pattern for this challenge) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return {
    is_correct: false,
    misconception: challenge.concept,
    explanation: `Check your approach for "${challenge.title}". Verify your conditions and syntax carefully.`,
    intervention: challenge.hints?.[0] || "Review the problem description carefully."
  };
}

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
  const [xp, setXp] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [mobileTab, setMobileTab] = useState<'problem' | 'editor' | 'assistant'>('editor');

  // Problem Mode: 'demo' (existing catalog) vs 'custom' (enter any problem)
  const [problemMode, setProblemMode] = useState<'demo' | 'custom'>('demo');
  const [customProblem, setCustomProblem] = useState({
    title: 'Custom Problem',
    question: 'Solve x² - 5x + 6 = 0 by factoring. Find the roots for x.',
    domain: 'mathematics',
    language: 'markdown',
    concept: 'Quadratic Equations & Factoring'
  });

  // Custom Colab ML Model Endpoint State
  const [customModelUrl, setCustomModelUrl] = useState<string>(() => localStorage.getItem('relearn_model_url') || '');
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [tempModelUrl, setTempModelUrl] = useState(customModelUrl);
  const [modelTestStatus, setModelTestStatus] = useState<string | null>(null);

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

  // Self-Learning Knowledge Base State
  const [learnedCount, setLearnedCount] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('relearn_learned_db');
      return stored ? JSON.parse(stored).length : 0;
    } catch {
      return 0;
    }
  });

  const learnFromMistake = (challengeId: string, learnedCode: string, diagnosis: Diagnosis) => {
    try {
      const stored = localStorage.getItem('relearn_learned_db');
      const db: { challengeId?: string; code: string; diagnosis: Diagnosis }[] = stored ? JSON.parse(stored) : [];
      if (!db.some(e => e.challengeId === challengeId && e.code.trim() === learnedCode.trim())) {
        db.push({ challengeId, code: learnedCode.trim(), diagnosis });
        localStorage.setItem('relearn_learned_db', JSON.stringify(db));
        setLearnedCount(db.length);
        console.log('[Self-Learning DB] New misconception pattern learned! Total patterns:', db.length);
      }
    } catch { /* non-fatal */ }
  };

  const lookupLearnedDB = (challengeId: string, submittedCode: string): Diagnosis | null => {
    try {
      const stored = localStorage.getItem('relearn_learned_db');
      if (!stored) return null;
      const db: { challengeId?: string; code: string; diagnosis: Diagnosis }[] = JSON.parse(stored);
      const match = db.find(e => (e.challengeId ? e.challengeId === challengeId : true) && e.code.trim() === submittedCode.trim());
      return match ? match.diagnosis : null;
    } catch { return null; }
  };

  const searchMisconceptionsDB = (ch: Challenge, submittedCode: string): Diagnosis | null => {
    const cleanCode = submittedCode.toLowerCase();
    for (const entry of MISCONCEPTIONS_DICTIONARY) {
      if (entry.domain !== ch.domain && entry.domain !== 'general') continue;
      const exampleHit = entry.commonExamples.some(ex =>
        ex.toLowerCase().split(/\s+/).filter(w => w.length > 3).some(w => cleanCode.includes(w))
      );
      const patternHit = entry.pattern.toLowerCase().split(/\s+/).filter(w => w.length > 3).some(w => cleanCode.includes(w));
      if (exampleHit || patternHit) {
        return {
          is_correct: false,
          misconception: entry.title,
          explanation: entry.description,
          intervention: entry.interventionStrategy,
        };
      }
    }
    return null;
  };

  // Sync code when challenge changes
  const handleSelectChallenge = (c: Challenge) => {
    setChallenge(c);
    setCode(c.initialCode);
    setAttempts([]);
    setAttachedImage(null);
    setRotationMessage(null);
    setMobileTab('editor');
  };

  // Switch domain, select domain's challenge, and reset misconception state
  const handleSelectDomain = (d: DomainType | 'all') => {
    setSelectedDomain(d);
    const domainChallenges = d === 'all'
      ? CHALLENGES_CATALOG.filter(c => !c.id.includes('resolution'))
      : CHALLENGES_CATALOG.filter(c => c.domain === d && !c.id.includes('resolution'));

    if (domainChallenges.length > 0) {
      const isCurrentInDomain = d === 'all' ? true : domainChallenges.some(c => c.id === challenge.id);
      if (!isCurrentInDomain) {
        handleSelectChallenge(domainChallenges[0]);
      } else {
        setAttempts([]);
        setAttachedImage(null);
        setRotationMessage(null);
      }
    } else {
      setAttempts([]);
      setAttachedImage(null);
      setRotationMessage(null);
    }
  };

  const handleSetProblemMode = (mode: 'demo' | 'custom') => {
    setProblemMode(mode);
    setAttempts([]);
    setAttachedImage(null);
    setRotationMessage(null);
    if (mode === 'demo') {
      setCode(challenge.initialCode);
    } else {
      if (code === challenge.initialCode || !code.trim()) {
        setCode('# Write or paste your solution, equations, or reasoning steps below:\n');
      }
    }
  };

  const handleApplyCustomPreset = (preset: CustomPreset) => {
    setCustomProblem({
      title: preset.title,
      question: preset.question,
      domain: preset.domain,
      language: preset.language,
      concept: preset.concept
    });
    setCode(preset.initialWork);
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
    setMobileTab('assistant');

    const submittedCode = code;
    const currentProblemText = problemMode === 'custom'
      ? (customProblem.question?.trim() || customProblem.title || 'Custom Problem')
      : (challenge.description || challenge.title);
    const currentDomain = problemMode === 'custom' ? customProblem.domain : challenge.domain;
    const currentLanguage = problemMode === 'custom' ? customProblem.language : challenge.language;
    const currentTitle = problemMode === 'custom' ? (customProblem.title || 'Custom Problem') : challenge.title;

    const newAttempt: Attempt = {
      id: Date.now().toString(),
      problemId: problemMode === 'demo' ? challenge.id : null,
      problemTitle: currentTitle,
      problemText: currentProblemText,
      domain: currentDomain,
      language: currentLanguage,
      code: submittedCode,
      timestamp: new Date(),
      status: 'analyzing',
      diagnosis: null,
      imageBase64: attachedImage || undefined,
    };

    setAttempts([newAttempt]);

    try {
      let result: Diagnosis | null = null;

      // ── TIER 1: Custom Colab ML Model (if tunnel active) ──
      if (customModelUrl.trim()) {
        try {
          const endpoint = customModelUrl.trim().replace(/\/$/, '') + '/diagnose';
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
              'bypass-tunnel-reminder': '1',
              'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({
              problem: currentProblemText,
              code: submittedCode,
              domain: currentDomain,
              language: currentLanguage,
              image: attachedImage || null
            })
          });
          if (resp.ok) {
            const data = await resp.json();
            console.log('[Colab API] Response:', data);

            let isCorrect = Boolean(data.is_correct);
            let misconception = typeof data.misconception === 'string' && data.misconception.trim() ? data.misconception.trim() : null;
            let explanation = typeof data.explanation === 'string' && data.explanation.trim() ? data.explanation.trim() : null;
            let intervention = typeof data.intervention === 'string' && data.intervention.trim() ? data.intervention.trim() : null;

            const rawStr = typeof data.raw_output === 'string' ? data.raw_output : (typeof data === 'string' ? data : null);
            if (rawStr) {
              try {
                const parsedRaw = JSON.parse(rawStr);
                if (parsedRaw.is_correct !== undefined) isCorrect = Boolean(parsedRaw.is_correct);
                if (parsedRaw.misconception) misconception = String(parsedRaw.misconception).trim() || misconception;
                if (parsedRaw.explanation) explanation = String(parsedRaw.explanation).trim() || explanation;
                if (parsedRaw.intervention) intervention = String(parsedRaw.intervention).trim() || intervention;
              } catch {
                if (/"is_correct":\s*true/i.test(rawStr)) isCorrect = true;
                const miscMatch = rawStr.match(/"misconception":\s*"([^"]+)"/i);
                if (miscMatch) misconception = miscMatch[1];
                const expMatch = rawStr.match(/"explanation":\s*"([^"]+)"/i);
                if (expMatch) explanation = expMatch[1];
                const intMatch = rawStr.match(/"intervention":\s*"([^"]+)"/i);
                if (intMatch) intervention = intMatch[1];
              }
            }

            const TRIVIAL = new Set(['false', 'true', 'none', 'null', 'undefined', '']);
            const isTrivialExp = !explanation || TRIVIAL.has(explanation.toLowerCase()) || explanation.trim().length < 15;
            const isTrivialMisc = !misconception || TRIVIAL.has(misconception.toLowerCase()) || misconception.trim().length < 3;

            if (!isTrivialExp || !isTrivialMisc || isCorrect) {
              result = {
                is_correct: isCorrect,
                misconception: isCorrect ? null : ((!isTrivialMisc ? misconception : null) ?? 'Logical Misconception Detected'),
                explanation: (!isTrivialExp ? explanation : null) ?? (isCorrect ? 'Solution is logically sound!' : 'Review your reasoning steps.'),
                intervention: isCorrect ? null : intervention
              };
            }
          }
        } catch (colabErr) {
          console.error('[Colab API] Failed:', colabErr);
        }
      }

      // ── TIER 2: General Pedagogical AI Engine (Gemini Multi-Modal Vision & Reasoning) ──
      if (!result) {
        try {
          console.log('[Pedagogical AI] Querying Universal Cognitive Engine via Gemini...');
          const aiResult = await diagnoseCognitiveMisconception({
            problemTitle: currentTitle,
            problemText: currentProblemText,
            studentWork: submittedCode,
            domain: currentDomain,
            language: currentLanguage,
            imageBase64: attachedImage || undefined,
            imageMimeType: attachedImageMime,
            previousAttempts: attempts.map(a => ({ code: a.code, misconception: a.diagnosis?.misconception }))
          });

          if (aiResult) {
            console.log('[Pedagogical AI] Diagnosis successfully generated:', aiResult);
            result = aiResult;
            const cacheKey = problemMode === 'demo' ? challenge.id : 'custom';
            learnFromMistake(cacheKey, submittedCode, result);
          }
        } catch (aiErr) {
          console.error('[Pedagogical AI] Universal Engine error:', aiErr);
        }
      }

      // ── TIER 3: Local Learned Knowledge Base ──
      if (!result) {
        const cacheKey = problemMode === 'demo' ? challenge.id : 'custom';
        const learnedMatch = lookupLearnedDB(cacheKey, submittedCode);
        if (learnedMatch) {
          console.log('[LearnDB] Exact pattern hit in learned database!');
          result = learnedMatch;
        }
      }

      // ── TIER 4: Misconceptions Catalog Semantic Match ──
      if (!result) {
        const currentChallengeObj: Challenge = {
          id: problemMode === 'demo' ? challenge.id : 'custom',
          domain: currentDomain,
          title: currentTitle,
          description: currentProblemText,
          initialCode: submittedCode,
          language: currentLanguage,
          concept: problemMode === 'demo' ? challenge.concept : (customProblem.concept || 'General Problem Solving')
        };
        const dbMatch = searchMisconceptionsDB(currentChallengeObj, submittedCode);
        if (dbMatch) {
          result = dbMatch;
        }
      }

      // ── TIER 5: Fallback Rule / Safety Engine ──
      if (!result) {
        if (problemMode === 'demo') {
          result = evaluateChallengeLocally(challenge, submittedCode);
        } else {
          result = {
            is_correct: false,
            misconception: "Conceptual Inconsistency Detected",
            explanation: `Review your solution steps for: "${currentProblemText}". Ensure your formula, syntax, or reasoning steps align with the underlying principles.`,
            intervention: "Try tracing your steps one by one or attach a diagram/working sheet to pinpoint where the logic deviates."
          };
        }
      }

      const finalDiagnosis: Diagnosis = {
        is_correct: Boolean(result.is_correct),
        misconception: result.is_correct ? null : (result.misconception || 'Logical Misconception Detected'),
        specific_error: result.specific_error || null,
        evidence: result.evidence || null,
        explanation: result.explanation || (result.is_correct ? "Your reasoning is logically sound and accurate!" : "Review your solution logic."),
        intervention: result.is_correct ? null : result.intervention,
        follow_up_question: result.follow_up_question || null,
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.95,
        next_step: result.next_step || null,
      };

      setAttempts([{
        ...newAttempt,
        status: 'analyzed',
        diagnosis: finalDiagnosis,
      }]);

      if (finalDiagnosis.is_correct) {
        setXp(prev => prev + 100);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3B82F6', '#8B5CF6', '#10B981']
        });
      }

      setStats(prev => {
        const newTotal = prev.totalAttempts + 1;
        const prevResolved = Math.round((prev.resolutionRate * prev.totalAttempts) / 100);
        const newResolved = prevResolved + (finalDiagnosis.is_correct ? 1 : 0);
        const newRate = Math.round((newResolved / newTotal) * 100);

        const errorMap: Record<string, number> = {};
        prev.recurringMisconceptions.forEach(m => { errorMap[m.name] = m.count; });
        if (finalDiagnosis.misconception) {
          errorMap[finalDiagnosis.misconception] = (errorMap[finalDiagnosis.misconception] || 0) + 1;
        }
        const recurring = Object.entries(errorMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        return {
          ...prev,
          totalAttempts: newTotal,
          resolutionRate: newRate,
          recurringMisconceptions: recurring,
        };
      });

      try {
        await supabase.from('attempts').insert([{
          challenge_id: problemMode === 'demo' ? challenge.id : null,
          code: submittedCode,
          language: currentLanguage,
          is_correct: finalDiagnosis.is_correct,
          diagnosis: finalDiagnosis,
        }]);
      } catch (dbErr) {
        console.warn('DB recording skipped:', dbErr);
      }
    } catch (error: any) {
      console.error('Error submitting code:', error);
      const fallbackDiagnosis = problemMode === 'demo'
        ? evaluateChallengeLocally(challenge, submittedCode)
        : {
            is_correct: false,
            misconception: 'Submission Analysis Timeout',
            explanation: 'The system encountered a network delay while evaluating your solution.',
            intervention: 'Please verify your network connection and retry your submission.'
          };
      setAttempts([{
        ...newAttempt,
        status: 'analyzed',
        diagnosis: {
          is_correct: Boolean(fallbackDiagnosis.is_correct),
          misconception: fallbackDiagnosis.is_correct ? null : fallbackDiagnosis.misconception,
          explanation: fallbackDiagnosis.explanation,
          intervention: fallbackDiagnosis.is_correct ? null : fallbackDiagnosis.intervention
        }
      }]);
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
        setMobileTab('editor');
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
    setMobileTab('editor');
  };

  const filteredChallenges = selectedDomain === 'all' 
    ? CHALLENGES_CATALOG.filter(c => !c.id.includes('resolution'))
    : CHALLENGES_CATALOG.filter(c => c.domain === selectedDomain && !c.id.includes('resolution'));

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100dvh] w-full bg-[#0d1117] text-gray-200 font-sans selection:bg-blue-500/30 overflow-hidden">
      <AnimatePresence>
        {!hasStarted && <WelcomeSplash onStart={() => setHasStarted(true)} />}
      </AnimatePresence>
      {/* Top Navbar */}
      <header className="px-3 sm:px-6 py-2 border-b border-gray-800/80 bg-[#161b22] flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 z-20 shadow-md">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/30 flex-shrink-0">
            <Code2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-gray-100">Re:Learn</h1>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800/80 px-1.5 sm:px-2 py-0.5 rounded-full font-bold">
                Adaptive
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-400 hidden sm:block">
              Cognitive Misconception Diagnosis & Resolution Engine
            </p>
          </div>
        </div>

        {/* Action Controls & Resilience Status */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto py-1 max-w-full flex-nowrap scrollbar-none w-full sm:w-auto">
          {/* XP Bar */}
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-950 to-orange-950 border border-amber-800/50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg shadow-[0_0_10px_rgba(217,119,6,0.3)] flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 font-bold text-xs sm:text-sm tracking-wide">{xp} XP</span>
          </div>

          {/* Knowledge Base & Self-Learning Database Indicator */}
          <div className="flex items-center gap-1.5 text-xs bg-[#0b0f15] border border-purple-800/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-gray-300 flex-shrink-0" title={`${MISCONCEPTIONS_DICTIONARY.length} curated patterns + ${learnedCount} dynamically learned patterns`}>
            <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">Knowledge Base: <strong className="text-purple-300">{MISCONCEPTIONS_DICTIONARY.length + learnedCount} Patterns</strong></span>
            <span className="md:hidden font-mono text-[11px] text-purple-300">
              {MISCONCEPTIONS_DICTIONARY.length + learnedCount} DB
            </span>
            {learnedCount > 0 && (
              <span className="text-emerald-400 font-mono text-[10px] sm:text-[11px] bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.2 rounded" title="Patterns learned from past mistakes">
                +{learnedCount} learned
              </span>
            )}
          </div>

          {/* Connect Colab ML Model Button */}
          <button
            onClick={() => {
              setTempModelUrl(customModelUrl);
              setModelTestStatus(null);
              setShowModelConfig(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer flex-shrink-0 ${
              customModelUrl
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 shadow-sm shadow-emerald-950'
                : 'bg-indigo-950/40 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/60 shadow-sm'
            }`}
            title="Connect Colab ML Model"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">{customModelUrl ? 'Colab Active' : 'Colab Model'}</span>
            <span className="md:hidden">Colab</span>
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${customModelUrl ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          </button>

          {/* Model Evaluation Benchmark Button */}
          <button
            onClick={() => setShowEvaluation(true)}
            className="flex items-center gap-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer flex-shrink-0"
            title="Model Evaluation Benchmark"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Model Benchmark</span>
            <span className="md:hidden">Benchmark</span>
          </button>

          {/* Learner Analytics Dashboard Button */}
          <button
            onClick={() => setShowAnalytics(true)}
            className="flex items-center gap-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer flex-shrink-0"
            title="Learner Model Analytics"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Learner Model</span>
            <span className="md:hidden">Analytics</span>
          </button>

          {/* Institutional / Instructor Dashboard Button */}
          <button
            onClick={() => setShowInstructor(true)}
            className="flex items-center gap-1.5 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer flex-shrink-0"
            title="Institutional & Instructor Dashboard"
          >
            <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">Instructor View</span>
            <span className="md:hidden">Instructor</span>
          </button>
        </div>
      </header>

      {/* Rotation Notice Banner */}
      {rotationMessage && (
        <div className="bg-amber-950/40 border-b border-amber-700/50 px-4 sm:px-6 py-2 flex items-center gap-2 text-amber-200 text-xs animate-fadeIn flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{rotationMessage}</span>
        </div>
      )}

      {/* Responsive View Switcher for Mobile / Tablet / Portrait (Visible on < 1024px) */}
      <div className="lg:hidden bg-[#161b22] border-b border-gray-800 px-3 py-1.5 flex items-center justify-around gap-2 text-xs font-semibold z-10 flex-shrink-0">
        <button 
          onClick={() => setMobileTab('problem')}
          className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-0 ${
            mobileTab === 'problem' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">1. Problem</span>
        </button>
        <button 
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-0 ${
            mobileTab === 'editor' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">2. Editor</span>
        </button>
        <button 
          onClick={() => setMobileTab('assistant')}
          className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer relative min-w-0 ${
            mobileTab === 'assistant' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
          <span className="truncate">3. AI Pedagogue</span>
          {attempts.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-0.5 flex-shrink-0" />
          )}
        </button>
      </div>

      {/* Main Multi-Pane Workspace */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative h-full w-full">
        
        {/* Left Column: Challenge Catalog & Problem Context */}
        <div className={`w-full lg:w-[280px] xl:w-[320px] 2xl:w-[360px] h-full flex-col border-r border-gray-800/80 bg-[#12161f] overflow-y-auto flex-shrink-0 ${
          mobileTab === 'problem' ? 'flex flex-1 min-h-full' : 'hidden lg:flex'
        }`}>
          {/* Mode Switcher: Demo Problems vs Custom Problem */}
          <div className="p-3 border-b border-gray-800/80 bg-[#161b22]">
            <div className="flex rounded-xl bg-gray-900/90 p-1 border border-gray-800 gap-1">
              <button
                onClick={() => handleSetProblemMode('demo')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  problemMode === 'demo'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Demo Problems</span>
              </button>
              <button
                onClick={() => handleSetProblemMode('custom')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  problemMode === 'custom'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>+ Custom Problem</span>
              </button>
            </div>
          </div>

          {problemMode === 'demo' ? (
            <>
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
                      onClick={() => handleSelectDomain(d)}
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
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between cursor-pointer ${
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
              <div className="p-3 sm:p-5 flex-1 space-y-4 pb-16 flex flex-col justify-between min-h-0">
                <div className="space-y-4">
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
                    <h2 className="text-lg sm:text-xl font-bold text-gray-100 mt-2 mb-2 leading-tight">
                      {challenge.title}
                    </h2>
                    <div className="text-gray-300 text-sm leading-relaxed bg-gray-800/40 p-3.5 rounded-lg border border-gray-700/50">
                      {challenge.description}
                    </div>
                  </div>

                  {challenge.hints && challenge.hints.length > 0 && (
                    <div className="bg-gray-800/20 p-3 rounded-lg border border-gray-700/40 text-xs text-gray-400 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-gray-300 font-semibold mb-1">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Guidance</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-gray-300">
                        {challenge.hints.map((hint, i) => (
                          <li key={i}>{hint}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Quick jump to editor button on mobile */}
                <div className="lg:hidden pt-4">
                  <button
                    onClick={() => setMobileTab('editor')}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-900/40"
                  >
                    <span>Open in Code Editor</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Custom Problem Creator Form */
            <div className="p-4 sm:p-5 flex-1 space-y-4 pb-16 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>General-Purpose AI Mode</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono bg-purple-950/70 border border-purple-800/40 px-2 py-0.5 rounded-full">
                    Any Subject
                  </span>
                </div>

                {/* Quick Preset Templates */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                    Quick Sample Presets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyCustomPreset(preset)}
                        className={`text-[11px] px-2 py-1 rounded-lg border transition-all text-left cursor-pointer ${
                          customProblem.title === preset.title
                            ? 'bg-purple-900/60 border-purple-500 text-purple-100 font-semibold shadow-sm'
                            : 'bg-gray-800/60 hover:bg-gray-700/80 border-gray-700 text-gray-300'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Problem Statement Textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                    <span>Problem / Question Statement</span>
                    <span className="text-[10px] text-gray-500 font-normal">Math, Code, Physics, etc.</span>
                  </label>
                  <textarea
                    rows={4}
                    value={customProblem.question}
                    onChange={(e) => setCustomProblem(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="Enter your problem here (e.g., 'Solve 2x² + 5x - 3 = 0', 'Write a Java method to...', 'Calculate acceleration...')"
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-y"
                  />
                </div>

                {/* Domain & Subject Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    Subject / Domain
                  </label>
                  <select
                    value={customProblem.domain}
                    onChange={(e) => setCustomProblem(prev => ({ ...prev, domain: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
                  >
                    <option value="mathematics">Mathematics (Algebra, Calculus, Geometry, Probability)</option>
                    <option value="programming">Computer Science & Programming</option>
                    <option value="physics">Physics (Mechanics, Kinematics, Dynamics, Optics)</option>
                    <option value="chemistry">Chemistry (Stoichiometry, Equilibrium)</option>
                    <option value="logic">Logic, Discrete Math & Reasoning</option>
                    <option value="other">Other Academic Concept</option>
                  </select>
                </div>

                {/* Language / Input Format Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    Language / Working Format
                  </label>
                  <select
                    value={customProblem.language}
                    onChange={(e) => setCustomProblem(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 transition-all cursor-pointer"
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="java">Java</option>
                    <option value="cpp">C / C++</option>
                    <option value="sql">SQL</option>
                    <option value="markdown">Math & Formula Working (.math)</option>
                    <option value="plaintext">Plain Text / Reasoning Steps</option>
                  </select>
                </div>

                {/* Topic / Concept Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    Topic / Concept Title
                  </label>
                  <input
                    type="text"
                    value={customProblem.concept}
                    onChange={(e) => setCustomProblem(prev => ({ ...prev, concept: e.target.value, title: e.target.value || 'Custom Problem' }))}
                    placeholder="e.g. Quadratic Factoring, Array Pointers, Vector Kinematics..."
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="bg-purple-950/20 border border-purple-800/30 rounded-xl p-3 text-xs text-purple-200/90 space-y-1">
                  <span className="font-semibold text-purple-300 block">Multimodal Reasoning Active:</span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Type your work in the editor, or click <strong>Attach Work / Diagram</strong> to upload a photo of your handwritten calculation or diagram. The AI diagnostician analyzes both!
                  </p>
                </div>
              </div>

              {/* Quick jump to editor button on mobile */}
              <div className="lg:hidden pt-4">
                <button
                  onClick={() => setMobileTab('editor')}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-900/40"
                >
                  <span>Open in Workspace</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Column: Editor, Multimodal Attachment, & Run Controls */}
        <div className={`flex-1 w-full h-full flex-col min-w-0 bg-[#0b0e14] relative overflow-y-auto ${
          mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="flex-1 p-2 sm:p-3.5 lg:p-4 flex flex-col relative min-h-0">
            <div className="bg-[#1e1e1e] border border-gray-700/80 rounded-xl overflow-hidden flex-1 shadow-2xl flex flex-col min-h-[180px] sm:min-h-[220px] md:min-h-[260px]">
              <div className="px-3 sm:px-4 py-2 bg-[#252526] border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500/80"></div>
                  <span className="ml-1 sm:ml-2 text-xs font-mono text-gray-400">
                    {getFilenameForLanguage(problemMode === 'custom' ? customProblem.language : challenge.language)}
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 uppercase">
                  {problemMode === 'custom' ? customProblem.language : challenge.language}
                </span>
              </div>

              <div className="flex-1 relative min-h-0">
                <CodeEditor
                  language={getMonacoLanguage(problemMode === 'custom' ? customProblem.language : challenge.language)}
                  code={code}
                  onChange={(val) => setCode(val || '')}
                />
              </div>
            </div>

            {/* Run Bar & Multimodal Attach Button */}
            <div className="mt-2.5 sm:mt-3.5 flex flex-wrap gap-2 items-center justify-between flex-shrink-0 order-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 sm:gap-2 bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm flex-shrink-0"
                  title="Attach handwritten working or diagram for multimodal diagnosis"
                >
                  <Image className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                  <span className="hidden sm:inline">Attach Work / Diagram</span>
                  <span className="sm:hidden">Attach Diagram</span>
                </button>
                <span className="text-[11px] text-gray-500 hidden md:inline">
                  Supports handwritten math & diagrams
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-2 sm:py-2.5 px-3.5 sm:px-6 rounded-xl transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 cursor-pointer flex-shrink-0"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="text-xs sm:text-sm">Diagnosing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                    <span className="text-xs sm:text-sm">Submit for Diagnosis</span>
                  </>
                )}
              </button>
            </div>

            {/* Multimodal Image Attachment Preview */}
            {attachedImage && (
              <div className="mt-2.5 sm:mt-3 bg-gray-900 border border-cyan-800/60 rounded-xl p-2.5 sm:p-3 flex items-center justify-between animate-fadeIn shadow-md flex-shrink-0 order-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <img
                    src={attachedImage}
                    alt="Handwritten work preview"
                    className="w-10 h-10 sm:w-14 sm:h-14 object-cover rounded-lg border border-gray-700 shadow-sm flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-cyan-300 block truncate">
                      📷 Multimodal Work Attached
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-gray-400 block line-clamp-1">
                      Pedagogical AI will analyze your diagram / handwriting alongside your answer
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleRemoveImage}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer flex-shrink-0 ml-2"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Assistant Timeline */}
        <div className={`w-full lg:w-[300px] xl:w-[350px] 2xl:w-[400px] h-full border-l border-gray-800/80 shadow-2xl z-10 flex-col bg-[#161b22] flex-shrink-0 min-h-0 ${
          mobileTab === 'assistant' ? 'flex flex-1 min-h-full' : 'hidden lg:flex'
        }`}>
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

      {/* Connect Colab Trained Model Modal */}
      {showModelConfig && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-gray-700/80 rounded-2xl w-full max-w-2xl max-h-[92dvh] overflow-y-auto shadow-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-950/80 rounded-lg border border-indigo-700/50">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">Connect Custom Trained ML Model (Google Colab)</h3>
                  <p className="text-[11px] text-gray-400">Run your fine-tuned CodeT5 model in Google Colab for free with a T4 GPU</p>
                </div>
              </div>
              <button
                onClick={() => setShowModelConfig(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#0d1117] p-4 rounded-xl border border-gray-800 text-xs text-gray-300 space-y-2">
              <p className="font-semibold text-indigo-300">How to Train & Connect in Google Colab (100% Free):</p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-400 leading-relaxed">
                <li>Open <a href="https://colab.research.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline font-medium">Google Colab</a> in your browser.</li>
                <li>Click <strong>Upload</strong> and select <code className="bg-gray-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[11px]">ReLearn_Model_Training.ipynb</code> (from your project folder).</li>
                <li>Click <strong>Runtime &gt; Change runtime type</strong> and select <strong>T4 GPU</strong>.</li>
                <li>Click <strong>Runtime &gt; Run all</strong>. It will train the model and launch a live API!</li>
                <li>Copy the public URL printed at Step 7 (e.g. <code className="text-emerald-400 font-mono text-[11px]">https://xxxx.loca.lt</code>) and paste it below.</li>
              </ol>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-300">Colab Public Tunnel URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://xxxx.loca.lt or https://xxxx.ngrok-free.app"
                  value={tempModelUrl}
                  onChange={(e) => setTempModelUrl(e.target.value)}
                  className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  onClick={async () => {
                    if (!tempModelUrl.trim()) {
                      setModelTestStatus('Please enter a URL');
                      return;
                    }
                    setModelTestStatus('Testing connection to model...');
                    try {
                      const res = await fetch(tempModelUrl.trim().replace(/\/$/, '') + '/', {
                        headers: {
                          'Bypass-Tunnel-Reminder': 'true',
                          'bypass-tunnel-reminder': '1',
                          'ngrok-skip-browser-warning': 'true',
                        }
                      });
                      if (res.ok) {
                        localStorage.setItem('relearn_model_url', tempModelUrl.trim());
                        setCustomModelUrl(tempModelUrl.trim());
                        setModelTestStatus('✅ Connected successfully to custom FLAN-T5 model!');
                      } else {
                        localStorage.setItem('relearn_model_url', tempModelUrl.trim());
                        setCustomModelUrl(tempModelUrl.trim());
                        setModelTestStatus('Saved! If prompted by tunnel, open the URL in your browser and click "Click to Continue".');
                      }
                    } catch (err: any) {
                      localStorage.setItem('relearn_model_url', tempModelUrl.trim());
                      setCustomModelUrl(tempModelUrl.trim());
                      setModelTestStatus('Saved! If using localtunnel, visit the link in your browser once to click "Continue".');
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                >
                  Save & Connect
                </button>
              </div>
              {modelTestStatus && (
                <p className="text-xs text-indigo-300 mt-1">{modelTestStatus}</p>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-800">
              {customModelUrl ? (
                <button
                  onClick={() => {
                    localStorage.removeItem('relearn_model_url');
                    setCustomModelUrl('');
                    setTempModelUrl('');
                    setModelTestStatus('Disconnected custom model. Reverted to built-in evaluator.');
                  }}
                  className="text-xs text-red-400 hover:underline cursor-pointer"
                >
                  Disconnect Model (Use Local Fallback)
                </button>
              ) : (
                <span className="text-xs text-gray-500">Currently using built-in evaluator</span>
              )}
              <button
                onClick={() => setShowModelConfig(false)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
