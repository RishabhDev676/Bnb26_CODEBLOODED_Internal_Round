import type { Challenge, BenchmarkCase } from '../types';

export interface MisconceptionEntry {
  id: string;
  domain: 'programming' | 'algebra' | 'physics';
  pattern: string;
  title: string;
  description: string;
  commonExamples: string[];
  interventionStrategy: string;
}

export const MISCONCEPTIONS_DICTIONARY: MisconceptionEntry[] = [
  {
    id: 'misc-py-assign-eq',
    domain: 'programming',
    pattern: 'if x = y',
    title: 'Assignment vs Equality Check',
    description: 'Confusing single equal assignment (=) with comparative boolean equality (==).',
    commonExamples: ['if n % 2 = 0:', 'while count = 5:'],
    interventionStrategy: 'Guide learner to examine assignment vs evaluation context in boolean expressions.',
  },
  {
    id: 'misc-py-mutable-default',
    domain: 'programming',
    pattern: 'def f(x=[]):',
    title: 'Mutable Default Argument',
    description: 'Believing default parameters are freshly instantiated on each invocation rather than at definition time.',
    commonExamples: ['def add_item(item, basket=[]): basket.append(item)'],
    interventionStrategy: 'Ask learner what happens across multiple invocations without passing a parameter.',
  },
  {
    id: 'misc-py-off-by-one',
    domain: 'programming',
    pattern: 'for i in range(len(arr)): arr[i+1]',
    title: 'Index Out of Bounds / Off-By-One',
    description: 'Misunderstanding 0-based indexing limits and inclusive vs exclusive range boundaries.',
    commonExamples: ['for i in range(1, len(arr)):', 'arr[len(arr)]'],
    interventionStrategy: 'Trace indices of a 3-element list step by step.',
  },
  {
    id: 'misc-js-type-coercion',
    domain: 'programming',
    pattern: 'val == "0"',
    title: 'Loose Equality Type Coercion',
    description: 'Assuming == checks strict type and value equality without implicit conversion.',
    commonExamples: ['if (userAge == "18")', '0 == false'],
    interventionStrategy: 'Contrast abstract equality comparison with strict identity comparison (===).',
  },
  {
    id: 'misc-alg-freshman-dream',
    domain: 'algebra',
    pattern: '(a+b)^2 = a^2 + b^2',
    title: "Freshman's Dream (Binomial Expansion)",
    description: 'Distributing exponentiation over addition without expanding cross-terms.',
    commonExamples: ['(x + 4)^2 = x^2 + 16'],
    interventionStrategy: 'Ask learner to expand (x + 4)(x + 4) using FOIL or geometric area models.',
  },
  {
    id: 'misc-alg-negative-dist',
    domain: 'algebra',
    pattern: '-(x - y) = -x - y',
    title: 'Sign Distribution Error',
    description: 'Failing to distribute the negative multiplier to every term in parentheses.',
    commonExamples: ['5 - (2x - 7) = 5 - 2x - 7'],
    interventionStrategy: 'Prompt learner to rewrite -(a - b) as (-1) * (a - b).',
  },
  {
    id: 'misc-phys-gravity-mass',
    domain: 'physics',
    pattern: 'Heavier falls faster in vacuum',
    title: 'Mass-Dependent Gravitational Acceleration',
    description: 'Believing gravitational acceleration depends on object mass in freefall.',
    commonExamples: ['a = m * g', 'Heavier ball reaches ground first in vacuum'],
    interventionStrategy: 'Remind learner that F = mg and a = F/m, meaning m cancels out.',
  },
  {
    id: 'misc-phys-deceleration-sign',
    domain: 'physics',
    pattern: 'Negative acceleration always means slowing down',
    title: 'Deceleration vs Negative Acceleration Sign Confusion',
    description: 'Equating a negative acceleration value with slowing down regardless of velocity direction.',
    commonExamples: ['Object moving left (v < 0) with a < 0 is assumed to be decelerating'],
    interventionStrategy: 'Examine vectors: when velocity and acceleration share the same sign, magnitude of speed increases.',
  }
];

export const CHALLENGES_CATALOG: Challenge[] = [
  {
    id: 'ch-py-is-even',
    domain: 'programming',
    title: '1. Even Number Check (Python)',
    description: 'Write a Python function called `is_even(n)` that returns True if the integer `n` is even, and False otherwise.',
    initialCode: `def is_even(n):
    # Check if remainder is 0
    if n % 2 = 0:
        return True
    else:
        return False
`,
    language: 'python',
    concept: 'Conditionals & Operators',
    resolutionChallengeId: 'ch-py-is-odd-resolution',
    hints: ['Check the operator you are using to compare values.']
  },
  {
    id: 'ch-py-is-odd-resolution',
    domain: 'programming',
    title: 'Resolution: Odd Number Check (Python)',
    description: 'Verify your resolution: Write a Python function called `is_odd(n)` that returns True if `n` is odd. Apply correct comparative logic.',
    initialCode: `def is_odd(n):
    # Apply what you learned about comparative operators
    pass
`,
    language: 'python',
    concept: 'Conditionals & Operators',
    hints: ['Use the equality operator == or inequality !=.']
  },
  {
    id: 'ch-js-equality',
    domain: 'programming',
    title: '2. Strict Authentication Guard (JavaScript)',
    description: 'Write a function `isValidToken(role, tier)` that verifies if role is strictly "admin" and tier is strictly integer 1. Guard against string "1" being passed.',
    initialCode: `function isValidToken(role, tier) {
    if (role == "admin" && tier == 1) {
        return true;
    }
    return false;
}
`,
    language: 'javascript',
    concept: 'Type Coercion & Identity',
    resolutionChallengeId: 'ch-js-equality-resolution',
    hints: ['Consider what happens when tier is passed as the string "1". Which operator prevents coercion?']
  },
  {
    id: 'ch-js-equality-resolution',
    domain: 'programming',
    title: 'Resolution: Strict Validation (JavaScript)',
    description: 'Confirm resolution: Write `isPositiveInteger(val)` returning true ONLY if val is strictly a number and greater than 0.',
    initialCode: `function isPositiveInteger(val) {
    // Return true only if val is strictly of type 'number' and > 0
}
`,
    language: 'javascript',
    concept: 'Type Coercion & Identity',
  },
  {
    id: 'ch-alg-binomial',
    domain: 'algebra',
    title: '3. Algebraic Expansion (Algebra)',
    description: 'Simplify the expression (2x + 3)^2. Provide your algebraic working or upload an image of your handwritten steps.',
    initialCode: `# Simplify (2x + 3)^2
# Student Working:
# Step 1: Square the first term = 4x^2
# Step 2: Square the second term = 9
# Result: 4x^2 + 9
`,
    language: 'python',
    concept: 'Binomial Expansion & Polynomials',
    resolutionChallengeId: 'ch-alg-binomial-resolution',
    hints: ['Remember FOIL: First, Outside, Inside, Last.']
  },
  {
    id: 'ch-alg-binomial-resolution',
    domain: 'algebra',
    title: 'Resolution: Binomial Expansion (Algebra)',
    description: 'Confirm resolution: Expand and simplify (3x - 5)^2 fully, including the cross-product term.',
    initialCode: `# Expand (3x - 5)^2 fully
result = ""
`,
    language: 'python',
    concept: 'Binomial Expansion & Polynomials',
  },
  {
    id: 'ch-phys-kinematics',
    domain: 'physics',
    title: '4. Freefall & Deceleration (Physics)',
    description: 'A ball is launched vertically upward at 20 m/s with g = -9.8 m/s^2. Explain the signs of velocity and acceleration during ascent and descent.',
    initialCode: `# Physics Analysis:
# During ascent: v > 0, a = -9.8 (slowing down)
# During descent: v < 0, a = +9.8 (because speed is increasing, so acceleration must become positive)
`,
    language: 'python',
    concept: 'Kinematics & Vector Signs',
    resolutionChallengeId: 'ch-phys-kinematics-resolution',
    hints: ['Does gravitational acceleration vector change direction when an object reverses velocity?']
  },
  {
    id: 'ch-phys-kinematics-resolution',
    domain: 'physics',
    title: 'Resolution: Vector Direction in Kinematics',
    description: 'Confirm resolution: Write the signs of velocity and acceleration for an elevator descending while braking.',
    initialCode: `# Elevator moving downwards (down is negative) and slowing down:
# v_sign = 
# a_sign = 
`,
    language: 'python',
    concept: 'Kinematics & Vector Signs',
  }
];

export const BENCHMARK_TEST_SUITE: BenchmarkCase[] = [
  {
    id: 'bm-1',
    title: 'Assignment inside conditional (Seen)',
    domain: 'programming',
    input: `def check(n):\n    if n = 10:\n        return True`,
    expectedIsCorrect: false,
    expectedMisconception: 'Assignment operator used instead of equality check',
    isUnseen: false,
  },
  {
    id: 'bm-2',
    title: 'Correct comparative logic (Seen)',
    domain: 'programming',
    input: `def check(n):\n    if n == 10:\n        return True\n    return False`,
    expectedIsCorrect: true,
    expectedMisconception: '',
    isUnseen: false,
  },
  {
    id: 'bm-3',
    title: 'Freshman\'s dream expansion (Seen)',
    domain: 'algebra',
    input: `(x + 5)^2 = x^2 + 25`,
    expectedIsCorrect: false,
    expectedMisconception: 'Freshman\'s dream / Missing cross-term in binomial expansion',
    isUnseen: false,
  },
  {
    id: 'bm-4',
    title: 'Unseen: Mutable default argument aliasing',
    domain: 'programming',
    input: `def add_record(name, records=[]):\n    records.append(name)\n    return records`,
    expectedIsCorrect: false,
    expectedMisconception: 'Mutable default argument retaining state across invocations',
    isUnseen: true,
  },
  {
    id: 'bm-5',
    title: 'Unseen: Reversing loop boundary error in JavaScript',
    domain: 'programming',
    input: `function reverseList(arr) {\n    let rev = [];\n    for (let i = arr.length; i >= 0; i--) {\n        rev.push(arr[i]);\n    }\n    return rev;\n}`,
    expectedIsCorrect: false,
    expectedMisconception: 'Index out of bounds at arr.length (off-by-one initial index)',
    isUnseen: true,
  },
  {
    id: 'bm-6',
    title: 'Unseen: Gravity acceleration mass-dependence confusion',
    domain: 'physics',
    input: `A 10kg bowling ball falls faster in a vacuum than a 1kg feather because the gravitational force F = mg is 10x larger, so acceleration is higher.`,
    expectedIsCorrect: false,
    expectedMisconception: 'Belief that gravitational acceleration depends on mass in freefall',
    isUnseen: true,
  },
];
