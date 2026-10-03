-- Seed Misconceptions Dictionary Table
INSERT INTO misconceptions (id, language, error_pattern, description, intervention_text)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'python',
    'if x = y',
    'Assignment instead of equality check: Confusing single equal assignment (=) with comparative boolean equality (==).',
    'Guide learner to examine assignment vs evaluation context in boolean expressions.'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'python',
    'def f(x=[]):',
    'Mutable default argument: Believing default parameters are freshly instantiated on each invocation rather than at definition time.',
    'Ask learner what happens across multiple invocations without passing a parameter.'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'python',
    'for i in range(len(arr)): arr[i+1]',
    'Index Out of Bounds / Off-By-One: Misunderstanding 0-based indexing limits and inclusive vs exclusive range boundaries.',
    'Trace indices of a 3-element list step by step.'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'javascript',
    'val == "0"',
    'Loose Equality Type Coercion: Assuming == checks strict type and value equality without implicit conversion.',
    'Contrast abstract equality comparison with strict identity comparison (===).'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'algebra',
    '(a+b)^2 = a^2 + b^2',
    'Freshman''s Dream: Distributing exponentiation over addition without expanding cross-terms.',
    'Ask learner to expand (x + 4)(x + 4) using FOIL or geometric area models.'
  ),
  (
    '00000000-0000-0000-0000-000000000006',
    'physics',
    'Heavier falls faster in vacuum',
    'Mass-Dependent Gravitational Acceleration: Believing gravitational acceleration depends on object mass in freefall.',
    'Remind learner that F = mg and a = F/m, meaning mass cancels out in vacuum.'
  )
ON CONFLICT (id) DO NOTHING;
