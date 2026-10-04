import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CodeEditor } from '../components/CodeEditor';
import { AIAssistantPanel } from '../components/AIAssistantPanel';
import { getDomainThoughtSteps } from '../utils/thoughtSteps';
import { LearnerAnalytics } from '../components/LearnerAnalytics';
import { ModelEvaluationModal } from '../components/ModelEvaluationModal';
import { InstitutionalDashboard } from '../components/InstitutionalDashboard';
import { supabase } from '../lib/supabase';
import { 
  Play, AlertTriangle, Activity, Code2, Image, 
  X, Cpu, Layers, Sparkles, ChevronRight, HelpCircle, GraduationCap, BrainCircuit
} from 'lucide-react';
import BranchedMenu, { type BranchedMenuItem } from '../components/BranchedMenu';
import {
  SourceCodeIcon,
  FunctionSquareIcon,
  Atom01Icon,
  Rocket01Icon
} from '@hugeicons/core-free-icons';
import { callGeminiLastResort, extractCodeFromImage } from '../services/geminiService';
import { diagnoseCodeSemantically } from '../services/semanticDiagnoseCode';
import { MISCONCEPTIONS_DICTIONARY, CHALLENGES_CATALOG } from '../data/misconceptionsDataset';
import type { Attempt, LearnerModelStats, Diagnosis, Challenge, DomainType } from '../types';
import confetti from 'canvas-confetti';
import { AnimatePresence } from 'framer-motion';
import { WelcomeSplash } from '../components/WelcomeSplash';
import GooeyNav, { type GooeyNavItem } from '../components/GooeyNav';

function isRandomSentence(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  // Detect genuine programming syntax or mathematical formulas
  const codeKeywords = /\b(def|class|function|return|if|else|elif|for|while|import|from|var|let|const|print|console|echo|int|float|str|bool|void|public|private|lambda|yield|async|await|try|except|catch|finally|throw|raise)\b/;
  const codeSymbols = /[{}()[\];=+\-*/%^&|<>!:]/;
  const mathSymbols = /\b(sin|cos|tan|sqrt|log|exp|lim|sum|theta|omega|pi|alpha|beta)\b/i;
  const assignmentOrCalc = /\d+\s*[\^+\-*/]\s*\d+|[a-zA-Z]\s*[\^+\-*/=]\s*[a-zA-Z0-9]/;

  const hasCodeConstructs = codeKeywords.test(trimmed) || codeSymbols.test(trimmed) || mathSymbols.test(trimmed) || assignmentOrCalc.test(trimmed);

  if (!hasCodeConstructs) {
    return true;
  }

  // Conversational sentence check without code statements
  const conversationalLead = /^(hi|hello|hey|good\s+morning|good\s+evening|how\s+are\s+you|what\s+is\s+up|i\s+am|i\s+think|my\s+name\s+is|this\s+is\s+a\s+sentence|testing\s+123)\b/i;
  if (conversationalLead.test(trimmed) && !codeKeywords.test(trimmed) && !trimmed.includes('{') && !trimmed.includes('def ')) {
    return true;
  }

  return false;
}

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

  // 9. Mutable Default Parameter (Python)
  if (challenge.id === 'ch-py-mutable-default' || challenge.id === 'ch-py-mutable-default-res') {
    if (/container\s*=\s*None/i.test(cleanCode) || /if\s+container\s+is\s+None/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Correct! Using None as the default sentinel pattern creates a fresh container on every call without cross-call contamination.",
        intervention: null
      };
    }
    if (/def\s+\w+\(.*=\s*\[\]\)/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Mutable default argument state retention",
        explanation: "In Python, default arguments are evaluated once at function definition time. The empty list [] is shared across all function calls.",
        intervention: "Use 'container=None' and write 'if container is None: container = []' inside the function."
      };
    }
  }

  // 10. Loop Bounds (Python)
  if (challenge.id === 'ch-py-loop-bounds' || challenge.id === 'ch-py-loop-bounds-res') {
    if (/for\s+\w+\s+in\s+numbers\s*:/i.test(cleanCode) || /range\(\s*1\s*,\s*len\(numbers\)\s*\)/i.test(cleanCode) || /range\(\s*len\(numbers\)\s*\)/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Perfect! You correctly respected 0-based indexing limits up to len(numbers) - 1.",
        intervention: null
      };
    }
    if (/range\(.*,\s*len\([^)]+\)\s*\+\s*1\s*\)/i.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Index out of bounds / range upper bound inclusive assumption",
        explanation: "Python lists are 0-indexed up to len(numbers) - 1. range(1, len(numbers) + 1) attempts to access index len(numbers), raising an IndexError.",
        intervention: "What is the highest valid index in a 3-element list? Remember range(start, stop) is exclusive of stop."
      };
    }
  }

  // 11. Async / Await (JavaScript)
  if (challenge.id === 'ch-js-async-promise' || challenge.id === 'ch-js-async-promise-res') {
    if (/await\s+/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Great job! Awaiting the asynchronous API call unwrap the promise before accessing its properties.",
        intervention: null
      };
    }
    return {
      is_correct: false,
      misconception: "Missing await on async operation (Promise unwrapping omitted)",
      explanation: "Without the 'await' keyword, calling an async function immediately returns a pending Promise object, not the resolved data payload.",
      intervention: "Which JavaScript keyword halts execution until a Promise resolves before accessing its data?"
    };
  }

  // 12. Negative Sign Distribution (Algebra)
  if (challenge.id === 'ch-alg-negative-dist' || challenge.id === 'ch-alg-negative-dist-res') {
    if (/-3x\s*\+\s*12/i.test(cleanCode) || /12\s*-\s*3x/i.test(cleanCode) || /-8x\s*\+\s*18/i.test(cleanCode) || /18\s*-\s*8x/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Excellent! You properly distributed the negative factor to both terms inside the parentheses: 5 - 3x + 7 = 12 - 3x.",
        intervention: null
      };
    }
    if (/-3x\s*-\s*2/i.test(cleanCode) || /-7/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Sign Distribution Error (Negative multiplier omitted on second term)",
        explanation: "When subtracting (3x - 7), the negative sign applies to both terms: -(3x) + (-(-7)) = -3x + 7. The constant is 5 + 7 = 12, not 5 - 7.",
        intervention: "Rewrite -(3x - 7) as (-1) * (3x) + (-1) * (-7). What is (-1) * (-7)?"
      };
    }
  }

  // 13. Rational Fractions (Algebra)
  if (challenge.id === 'ch-alg-rational-fractions' || challenge.id === 'ch-alg-rational-fractions-res') {
    if (/5x\s*\+\s*2/i.test(cleanCode) || /\(5x\s*\+\s*2\)\s*\/\s*x\(x\s*\+\s*1\)/i.test(cleanCode) || /\(b\s*\+\s*a\)\s*\/\s*\(a\s*\*\s*b\)/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Superb! You correctly identified the common denominator x(x + 1) and cross-multiplied: 2(x + 1) + 3x = 5x + 2.",
        intervention: null
      };
    }
    if (/5\s*\/\s*\(2x\s*\+\s*1\)/i.test(cleanCode) || /5\s*\/\s*2x/i.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Direct Addition of Numerators and Denominators",
        explanation: "Fractions cannot be added by directly summing their numerators and denominators: (a/b) + (c/d) ≠ (a+c)/(b+d). You must find a common denominator first.",
        intervention: "What is the common multiple of denominators x and (x + 1)? Multiply each fraction by 1 in the form of the missing factor."
      };
    }
  }

  // 14. Freefall Mass Independence (Physics)
  if (challenge.id === 'ch-phys-freefall-mass' || challenge.id === 'ch-phys-freefall-mass-res') {
    if (/same|simultaneous|together|cancels|independent/i.test(cleanCode) && !/heavier.*faster/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Physics confirmed! Because a = F/m = (mg)/m = g, acceleration in a vacuum is completely independent of mass. Both objects land at the exact same instant.",
        intervention: null
      };
    }
    if (/heavier|20kg|lands first|faster/i.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Mass-Dependent Gravitational Acceleration Fallacy",
        explanation: "While gravitational force F = mg is greater on the heavier object, its inertia (resistance to acceleration) is also proportionally greater: a = F/m = (mg)/m = g.",
        intervention: "Newton's Second Law says a = F / m. If F = m * g, what is a? Does mass remain in the formula?"
      };
    }
  }

  // 15. Normal Force on Ramp (Physics)
  if (challenge.id === 'ch-phys-normal-incline' || challenge.id === 'ch-phys-normal-incline-res') {
    if (/cos\s*\(\s*theta\s*\)|cos\s*θ|m\s*\*\s*g\s*\*\s*cos/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Correct! On an inclined plane, the normal force balances the perpendicular component of gravity: N = mg cos(θ).",
        intervention: null
      };
    }
    if (/N\s*=\s*m\s*\*\s*g/i.test(cleanCode) && !/cos/i.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Normal Force Equals Weight (N = mg) Assumption",
        explanation: "Normal force is the perpendicular contact force from the surface. On an angle θ, only the perpendicular component mg cos(θ) acts against the ramp, while mg sin(θ) accelerates the block down the ramp.",
        intervention: "Resolve the weight vector into components parallel and perpendicular to the inclined ramp. Which trigonometric function represents the adjacent/perpendicular component?"
      };
    }
  }

  // 16. Global Variable Scope & UnboundLocalError (Python)
  if (challenge.id === 'ch-py-global-scope') {
    if (/global\s+counter/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Mastery achieved! Declaring 'global counter' informs Python that assignments to 'counter' target the module-level variable rather than binding a new local scope.",
        intervention: null
      };
    }
    if (/counter\s*=\s*counter\s*\+\s*1|counter\s*\+=\s*1/.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "UnboundLocalError from Missing 'global' Declaration",
        explanation: "Assigning to 'counter' inside increment() makes Python treat it as a local variable. Since it hasn't been defined locally before being read, it triggers UnboundLocalError.",
        intervention: "Add 'global counter' at the top of the function to modify the global variable."
      };
    }
  }

  // 17. Mutating List During Iteration (Python)
  if (challenge.id === 'ch-py-mutate-iter') {
    if (/nums\[\:\]|list\(nums\)|\.copy\(\)|\[\s*x\s+for\s+x\s+in\s+nums\s+if/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Mastery achieved! Iterating over a copy (nums[:]) or using a list comprehension avoids mutation index-shifting bugs.",
        intervention: null
      };
    }
    if (/for\s+\w+\s+in\s+nums\s*:[\s\S]*nums\.(remove|pop)\(/i.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Mutating Collection During Iteration",
        explanation: "Modifying nums with .remove() or .pop() while iterating over it shifts indices dynamically, causing Python to skip elements silently.",
        intervention: "Iterate over a copy 'for x in nums[:]:' or return a list comprehension '[x for x in nums if x % 2 != 0]'."
      };
    }
  }

  // 18. Recursive Factorial Base Case (Python)
  if (challenge.id === 'ch-py-recursion-base') {
    if (/if\s+n\s*(<=|<|==)\s*1\s*:\s*return\s+1/i.test(cleanCode) || /return\s+1\s+if\s+n\s*(<=|<|==)\s*1/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Mastery achieved! You provided a clean base case (if n <= 1: return 1) allowing the recursion stack to unwind correctly.",
        intervention: null
      };
    }
    return {
      is_correct: false,
      misconception: "Missing Recursion Base Case (Infinite Recursion)",
      explanation: "Without a terminating base condition (e.g., if n <= 1: return 1), the recursive calls never stop, leading to a RecursionError: maximum recursion depth exceeded.",
      intervention: "Define when the function should stop recursing: if n <= 1: return 1."
    };
  }

  // 19. Floating Point Precision Equality (Python)
  if (challenge.id === 'ch-py-float-precision') {
    if (/math\.isclose|isclose|abs\(\s*\(?\s*a\s*\+\s*b\s*\)?\s*-\s*expected\s*\)\s*<\s*1e-9|abs\(\s*\(?\s*a\s*\+\s*b\s*\)?\s*-\s*0\.3\s*\)\s*<\s*1e-9/i.test(cleanCode)) {
      return {
        is_correct: true,
        misconception: null,
        explanation: "Mastery achieved! You used tolerance/delta comparison (abs(diff) < 1e-9 or math.isclose) to bypass IEEE-754 precision limits.",
        intervention: null
      };
    }
    if (/==\s*(?:expected|0\.3)/i.test(cleanCode)) {
      return {
        is_correct: false,
        misconception: "Floating-Point Precision Equality Assumption",
        explanation: "In binary floating-point arithmetic (IEEE-754), 0.1 + 0.2 evaluates to 0.30000000000000004. Comparing directly with '==' fails.",
        intervention: "Use an epsilon tolerance check: abs((a + b) - expected) < 1e-9, or import math and use math.isclose()."
      };
    }
  }

  // Generic fallback (unknown code pattern for this challenge)
  return {
    is_correct: false,
    misconception: challenge.concept,
    explanation: `Check your approach for "${challenge.title}". Verify your conditions and syntax carefully.`,
    intervention: challenge.hints?.[0] || "Review the problem description carefully."
  };
}

export const LearningModule: React.FC = () => {
  const [challenge, setChallenge] = useState<Challenge>(CHALLENGES_CATALOG[0]);
  const [code, setCode] = useState<string>(challenge.initialCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showInstructor, setShowInstructor] = useState(false);
  const [rotationMessage, setRotationMessage] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [hasStarted, setHasStarted] = useState(true);
  const [mobileTab, setMobileTab] = useState<'problem' | 'editor' | 'assistant'>('editor');

  // Branched Menu Tree for Domains & Challenges
  const branchedMenuItems: BranchedMenuItem[] = useMemo(() => [
    {
      label: 'Free Input',
      children: [
        {
          value: 'ch-free-input-sandbox',
          label: 'Custom Problem Sandbox',
          icon: Rocket01Icon
        },
        {
          value: 'ch-free-input-blank',
          label: 'Blank Freeform Editor',
          icon: SourceCodeIcon
        }
      ]
    },
    {
      label: 'Programming',
      children: CHALLENGES_CATALOG.filter(c => c.domain === 'programming' && !c.id.startsWith('ch-free')).map(c => ({
        value: c.id,
        label: c.title.replace(/^\d+\.\s*/, ''),
        icon: c.id.includes('resolution') ? Rocket01Icon : SourceCodeIcon
      }))
    },
    {
      label: 'Algebra',
      children: CHALLENGES_CATALOG.filter(c => c.domain === 'algebra').map(c => ({
        value: c.id,
        label: c.title.replace(/^\d+\.\s*/, ''),
        icon: c.id.includes('resolution') ? Rocket01Icon : FunctionSquareIcon
      }))
    },
    {
      label: 'Physics',
      children: CHALLENGES_CATALOG.filter(c => c.domain === 'physics').map(c => ({
        value: c.id,
        label: c.title.replace(/^\d+\.\s*/, ''),
        icon: c.id.includes('resolution') ? Rocket01Icon : Atom01Icon
      }))
    }
  ], []);

  // Custom Colab ML Model Endpoint State (Connected to user Cloudflare tunnel by default)
  const DEFAULT_MODEL_URL = 'https://chronic-wisconsin-belief-reflect.trycloudflare.com';
  const [customModelUrl, setCustomModelUrl] = useState<string>(() => {
    const saved = localStorage.getItem('relearn_model_url');
    return (saved && saved.trim()) ? saved.trim() : DEFAULT_MODEL_URL;
  });
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [tempModelUrl, setTempModelUrl] = useState(customModelUrl);
  const [modelTestStatus, setModelTestStatus] = useState<string | null>(null);

  // GooeyNav top bar items with existing cyber theme colors
  const gooeyNavItems: GooeyNavItem[] = useMemo(() => [
    {
      label: customModelUrl ? 'Colab Active' : 'Colab Model',
      icon: <Cpu className={`w-3.5 h-3.5 ${customModelUrl ? 'text-emerald-400' : 'text-indigo-400'}`} />,
      badge: (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            customModelUrl ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`}
        />
      ),
      onClick: () => {
        setTimeout(() => {
          setTempModelUrl(customModelUrl);
          setModelTestStatus(null);
          setShowModelConfig(true);
        }, 1000);
      }
    },
    {
      label: 'Model Benchmark',
      icon: <Cpu className="w-3.5 h-3.5 text-cyan-400" />,
      onClick: () => {
        setTimeout(() => setShowEvaluation(true), 1000);
      }
    },
    {
      label: 'Learner Model',
      icon: <Activity className="w-3.5 h-3.5 text-indigo-400" />,
      onClick: () => {
        setTimeout(() => setShowAnalytics(true), 1000);
      }
    },
    {
      label: 'Instructor View',
      icon: <GraduationCap className="w-3.5 h-3.5 text-purple-400" />,
      onClick: () => {
        setTimeout(() => setShowInstructor(true), 1000);
      }
    }
  ], [customModelUrl]);

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

  const learnFromMistake = (learnedCode: string, diagnosis: Diagnosis) => {
    try {
      const stored = localStorage.getItem('relearn_learned_db');
      const db: { code: string; diagnosis: Diagnosis }[] = stored ? JSON.parse(stored) : [];
      if (!db.some(e => e.code.trim() === learnedCode.trim())) {
        db.push({ code: learnedCode.trim(), diagnosis });
        localStorage.setItem('relearn_learned_db', JSON.stringify(db));
        setLearnedCount(db.length);
        console.log('[Self-Learning DB] New misconception pattern learned! Total patterns:', db.length);
      }
    } catch { /* non-fatal */ }
  };

  const lookupLearnedDB = (submittedCode: string): Diagnosis | null => {
    try {
      const stored = localStorage.getItem('relearn_learned_db');
      if (!stored) return null;
      const db: { code: string; diagnosis: Diagnosis }[] = JSON.parse(stored);
      const match = db.find(e => e.code === submittedCode.trim());
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

  // Handle image upload for handwritten math/physics working or code screenshots
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const mime = file.type || 'image/jpeg';
      setAttachedImageMime(mime);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setAttachedImage(base64);
        setRotationMessage('📷 Reading image and transcribing code...');
        try {
          const ocrText = await extractCodeFromImage(base64, mime);
          if (ocrText && ocrText.trim()) {
            setCode(ocrText.trim());
            setRotationMessage('✅ Image transcribed into code editor! Review code or click Run / Submit for diagnosis.');
            setTimeout(() => setRotationMessage(null), 6000);
          } else {
            setRotationMessage(null);
          }
        } catch (err) {
          console.warn('[OCR Transcription Failed]', err);
          setRotationMessage(null);
        }
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

    const startTime = Date.now();
    const thoughtSteps = getDomainThoughtSteps(challenge.domain);

    const newAttempt: Attempt = {
      id: Date.now().toString(),
      code,
      timestamp: new Date(),
      status: 'analyzing',
      diagnosis: null,
      imageBase64: attachedImage || undefined,
      thoughtSteps,
    };

    setAttempts(prev => [...prev, newAttempt]);

    try {
      // 1. Validation check: If input is not recognized (e.g. just a random sentence)
      if (isRandomSentence(code)) {
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs < 1200) {
          await new Promise(resolve => setTimeout(resolve, 1200 - elapsedMs));
        }
        const sentenceResult: Diagnosis = {
          is_correct: false,
          misconception: "Invalid Submission Format",
          explanation: "Please give a proper submission, not just a sentence.",
          intervention: "Provide functional code, an algorithm, or a mathematical formula to diagnose."
        };
        setAttempts(prev => prev.map(a => a.id === newAttempt.id ? { 
          ...a, 
          status: 'analyzed', 
          diagnosis: sentenceResult,
          thoughtSteps: [
            'Reading submission input & analyzing structure',
            'Evaluating syntax & programming tokens',
            'Unrecognized submission: natural language sentence detected'
          ],
          thoughtTime: 1.2
        } : a));
        setIsSubmitting(false);
        return;
      }

      let result: Diagnosis | null = null;

      // 2. Challenge-specific Pedagogical Evaluator (Accurate domain misconceptions for all catalog challenges)
      if (!challenge.id.startsWith('ch-free')) {
        const localCheck = evaluateChallengeLocally(challenge, code);
        // If it specifically identified a misconception or verified mastery:
        if (localCheck.is_correct || (localCheck.misconception && localCheck.misconception !== challenge.concept)) {
          result = localCheck;
        }
      }

      // 3. Universal Syntax / Type / Language Diagnostics (Guarantees Python 2/3 print, TypeErrors like str+int, missing colons)
      if (!result) {
        const semanticCheck = diagnoseCodeSemantically(code, challenge.description);
        if (!semanticCheck.is_correct) {
          result = semanticCheck;
        }
      }

      // 4. Primary Intelligent AI Engine (Gemini 3.5 Flash): Deep pedagogical reasoning for ANY custom code
      if (!result) {
        try {
          const aiResult = await callGeminiLastResort(
            challenge.title,
            challenge.description,
            code,
            challenge.language,
            attachedImage || undefined,
            attachedImageMime
          );
          if (aiResult) {
            result = {
              is_correct: aiResult.is_correct,
              misconception: aiResult.misconception,
              explanation: aiResult.explanation,
              intervention: aiResult.intervention || (aiResult.fixed_code ? `Corrected solution:\n${aiResult.fixed_code}` : null)
            };
            learnFromMistake(code, result);
          }
        } catch (aiErr) {
          console.warn('[AI Engine Error]', aiErr);
        }
      }

      // 5. Connected Custom Colab Model (with strict anti-hallucination / anti-echo guard)
      if (!result && customModelUrl && customModelUrl.trim()) {
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
              problem: challenge.description || challenge.title,
              code
            }),
            signal: AbortSignal.timeout(3000)
          });
          if (resp.ok) {
            const data = await resp.json();
            const rawOutput = (data.raw_output || data.output || data.prediction || data.explanation || '') as string;
            const cleanRaw = rawOutput ? rawOutput.trim() : '';

            // Guard against prompt echoes and single-phrase dictionary hallucinations
            const isEcho = cleanRaw && (
              cleanRaw.toLowerCase() === (challenge.description || '').trim().toLowerCase() ||
              cleanRaw.toLowerCase() === (challenge.title || '').trim().toLowerCase() ||
              cleanRaw.length < 5
            );

            if (cleanRaw && !isEcho) {
              const lower = cleanRaw.toLowerCase();
              let isCorrect = Boolean(data.is_correct);
              if (data.is_correct === undefined) {
                isCorrect = lower.includes('correct') || lower.includes('mastery') || lower.includes('valid');
              }

              result = {
                is_correct: isCorrect,
                misconception: data.misconception || (isCorrect ? null : 'FLAN-T5 Model Diagnosis'),
                explanation: data.explanation || cleanRaw,
                intervention: data.intervention || (data.fixed_code ? `Model fix:\n${data.fixed_code}` : `Model output:\n${cleanRaw}`),
                fixed_code: data.fixed_code || undefined
              };
            }
          }
        } catch (colabErr) {
          console.warn('[Colab ML Model Offline]', colabErr);
        }
      }

      // 5. Dynamic Pedagogical AI Engine: handles ANY problem and ANY code input
      if (!result) {
        try {
          const aiResult = await callGeminiLastResort(
            challenge.title,
            challenge.description,
            code,
            challenge.language,
            attachedImage || undefined,
            attachedImageMime
          );
          if (aiResult) {
            result = {
              is_correct: aiResult.is_correct,
              misconception: aiResult.misconception,
              explanation: aiResult.explanation,
              intervention: aiResult.intervention || (aiResult.fixed_code ? `Corrected solution:\n${aiResult.fixed_code}` : null)
            };
            learnFromMistake(code, result);
          }
        } catch (aiErr) {
          console.warn('[AI Model Engine] Failed:', aiErr);
        }
      }

      // 6. Offline Fallback: Self-learning database & semantic analyzer
      if (!result) {
        const learnedMatch = lookupLearnedDB(code);
        if (learnedMatch) {
          result = learnedMatch;
        } else if (!challenge.id.startsWith('ch-free')) {
          result = evaluateChallengeLocally(challenge, code);
        } else {
          result = diagnoseCodeSemantically(code, challenge.description);
        }
      }

      // Natural thought duration so ThoughtLine displays all cognitive steps
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs < 1650) {
        await new Promise(resolve => setTimeout(resolve, 1650 - elapsedMs));
      }
      const finalThoughtTime = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

      if (result) {
        setAttempts(prev => prev.map(a => a.id === newAttempt.id ? { 
          ...a, 
          status: 'analyzed', 
          diagnosis: result,
          thoughtSteps,
          thoughtTime: finalThoughtTime
        } : a));

        if (result.is_correct) {
          setXp(prev => prev + 100);
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3B82F6', '#8B5CF6', '#10B981']
          });
        }

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
      const fallbackDiagnosis = evaluateChallengeLocally(challenge, code);
      setTimeout(() => {
        setAttempts(prev => prev.map(a => a.id === newAttempt.id ? {
          ...a,
          status: 'analyzed',
          diagnosis: fallbackDiagnosis
        } : a));
        setIsSubmitting(false);
      }, 500);
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

  return (
    <div className="relative flex flex-col h-[100dvh] min-h-[100dvh] w-full bg-[#080c14] text-gray-200 font-sans selection:bg-blue-500/30 overflow-hidden">


      <AnimatePresence>
        {!hasStarted && <WelcomeSplash onStart={() => setHasStarted(true)} />}
      </AnimatePresence>
      {/* Top Navbar */}
      <header className="px-3 sm:px-6 py-2 border-b border-gray-800/80 bg-[#121721]/80 backdrop-blur-md flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 z-20 shadow-md">
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
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto py-1 max-w-full">
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

          {/* GooeyNav Top Action Navigation */}
          <div className="flex-shrink-0">
            <GooeyNav items={gooeyNavItems} initialActiveIndex={-1} />
          </div>
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
          className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mobileTab === 'problem' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>1. Problem</span>
        </button>
        <button 
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            mobileTab === 'editor' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>2. Code Editor</span>
        </button>
        <button 
          onClick={() => setMobileTab('assistant')}
          className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer relative ${
            mobileTab === 'assistant' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5 text-cyan-300" />
          <span>3. AI Pedagogue</span>
          {attempts.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
          )}
        </button>
      </div>

      {/* Main Multi-Pane Workspace */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative h-full w-full">
        
        {/* Left Column: Challenge Catalog & Problem Context */}
        <div className={`w-full lg:w-[320px] xl:w-[360px] h-full flex-col border-r border-gray-800/80 bg-[#12161f]/85 backdrop-blur-md overflow-y-auto ${
          mobileTab === 'problem' ? 'flex flex-1 min-h-full' : 'hidden lg:flex'
        }`}>
          {/* Branched Menu: Domain & Problem Navigation */}
          <div className="p-3.5 border-b border-gray-800/80 bg-[#161b22]/70 backdrop-blur-sm">
            <div className="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-gray-400">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Domain & Problem Tree</span>
            </div>
            <BranchedMenu
              items={branchedMenuItems}
              defaultOpen={[0, 1, 2]}
              defaultActive={challenge.id}
              onSelect={(val) => {
                const found = CHALLENGES_CATALOG.find(c => c.id === val);
                if (found) {
                  handleSelectChallenge(found);
                }
              }}
              color="#cbd5e1"
              accentColor="#38bdf8"
              lineColor="#334155"
              width={340}
              rowHeight={34}
              indent={36}
              trunk={14}
              radius={8}
              lineWidth={1.5}
              fontSize={13}
            />
          </div>

          {/* Active Challenge Details */}
          <div className="p-4 sm:p-5 flex-1 space-y-4 pb-16 flex flex-col justify-between min-h-[350px]">
            <div className="space-y-4">
              {challenge.id.startsWith('ch-free') && (
                <div className="bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>
                    <strong>Free Input Mode</strong>: Test any custom code, algorithm, or formula. The AI & ML model will diagnose it on the fly.
                  </span>
                </div>
              )}

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
        </div>

        {/* Center Column: Editor, Multimodal Attachment, & Run Controls */}
        <div className={`flex-1 w-full h-full flex-col min-w-0 bg-[#090d16]/75 backdrop-blur-sm relative overflow-y-auto ${
          mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="flex-1 p-3 sm:p-5 flex flex-col relative">
            <div className="bg-[#161b26]/90 border border-gray-700/80 backdrop-blur-md rounded-xl overflow-hidden flex-1 shadow-2xl flex flex-col min-h-[360px]">
              <div className="px-4 py-2 bg-[#202636]/90 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  {challenge.id.startsWith('ch-free') ? (
                    <div className="flex items-center gap-1 ml-2 bg-gray-800/80 p-0.5 rounded-lg border border-gray-700">
                      <button
                        type="button"
                        onClick={() => setChallenge(prev => ({ ...prev, language: 'python' }))}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                          challenge.language === 'python' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Python (.py)
                      </button>
                      <button
                        type="button"
                        onClick={() => setChallenge(prev => ({ ...prev, language: 'javascript' }))}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                          challenge.language === 'javascript' ? 'bg-amber-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        JavaScript (.js)
                      </button>
                    </div>
                  ) : (
                    <span className="ml-2 text-xs font-mono text-gray-400">
                      {challenge.language === 'javascript' ? 'solution.js' : 'solution.py'}
                    </span>
                  )}
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
                    className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-lg border border-gray-700 shadow-sm"
                  />
                  <div>
                    <span className="text-xs font-semibold text-cyan-300 block">
                      📷 Multimodal Handwritten Work Attached
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-gray-400">
                      Multimodal engine will analyze your diagram / algebraic steps alongside code
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
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 items-center justify-between">
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
                  <span className="hidden sm:inline">Attach Work / Diagram</span>
                  <span className="sm:hidden">Attach Diagram</span>
                </button>
                <span className="text-xs text-gray-500 hidden md:inline">
                  Supports handwritten math & diagrams
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-2 sm:py-2.5 px-5 sm:px-7 rounded-xl transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 cursor-pointer flex-shrink-0"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
          </div>
        </div>

        {/* Right Column: AI Assistant Timeline */}
        <div className={`w-full lg:w-[360px] xl:w-[440px] h-full border-l border-gray-800/80 shadow-2xl z-10 flex-col bg-[#141924]/85 backdrop-blur-md ${
          mobileTab === 'assistant' ? 'flex flex-1 min-h-full' : 'hidden lg:flex'
        }`}>
          <AIAssistantPanel
            attempts={attempts}
            isAnalyzing={isSubmitting}
            onNextChallenge={handleNextChallenge}
            domain={challenge.domain}
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-700/80 rounded-2xl w-full max-w-2xl shadow-2xl p-6 flex flex-col gap-5">
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
