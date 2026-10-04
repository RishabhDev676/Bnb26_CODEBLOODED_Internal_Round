import type { DomainType } from '../types';

export const getDomainThoughtSteps = (domain?: DomainType | string): string[] => {
  switch (domain) {
    case 'algebra':
      return [
        'Reading algebraic expressions & operator relationships',
        'Validating polynomial expansions & exponent rules',
        'Comparing with algebraic cognitive fallacy models',
        'Isolating structural misconception in mathematical reasoning',
        'Formulating conceptual intervention & scaffolding hint'
      ];
    case 'physics':
      return [
        'Parsing physical parameters & coordinate system',
        'Evaluating force balance & kinematic conservation laws',
        'Detecting intuitive vs rigorous physics fallacies',
        'Testing boundary conditions & directional signs',
        'Constructing targeted pedagogical guidance'
      ];
    case 'programming':
    default:
      return [
        'Reading submitted code & tokenizing syntax structure',
        'Parsing abstract syntax tree & tracing variable state',
        'Querying Colab neural model & local diagnostic rules',
        'Detecting mental model deviation & cognitive misconceptions',
        'Synthesizing pedagogical scaffolding & conceptual guidance'
      ];
  }
};
