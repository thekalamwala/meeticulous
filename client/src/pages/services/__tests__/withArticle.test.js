import { describe, it, expect } from 'vitest';
import { withArticle } from '../professionSeoContent';

describe('withArticle', () => {
  it('picks a/an by sound for profession labels', () => {
    expect(withArticle('AI Engineer')).toBe('an AI Engineer');
    expect(withArticle('Executive Coach')).toBe('an Executive Coach');
    expect(withArticle('HR Consultant')).toBe('an HR Consultant');
    expect(withArticle('UX Designer')).toBe('a UX Designer');
    expect(withArticle('IELTS Coach')).toBe('an IELTS Coach');
    expect(withArticle('Software Engineer')).toBe('a Software Engineer');
    expect(withArticle('User Researcher')).toBe('a User Researcher');
    expect(withArticle('Interior Designer')).toBe('an Interior Designer');
  });
});
