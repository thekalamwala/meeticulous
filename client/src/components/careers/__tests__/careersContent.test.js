import { describe, it, expect } from 'vitest';
import { jobs, company, getOpenJobs, getJobBySlug, HIRING_EMAIL } from '../careersContent';

describe('careersContent', () => {
  it('exposes the three seed roles', () => {
    const slugs = jobs.map((j) => j.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(['digital-marketeer', 'mern-stack-developer', 'sales-associate'])
    );
  });

  it('every job has the required fields', () => {
    for (const j of jobs) {
      expect(j.slug).toMatch(/^[a-z0-9-]+$/);
      expect(typeof j.title).toBe('string');
      expect(j.team).toBeTruthy();
      expect(j.location).toBeTruthy();
      expect(j.type).toBeTruthy();
      expect(j.comp).toBeTruthy();
      expect(typeof j.summary).toBe('string');
      expect(Array.isArray(j.responsibilities)).toBe(true);
      expect(Array.isArray(j.requirements)).toBe(true);
      expect(Array.isArray(j.niceToHaves)).toBe(true);
      expect(['open', 'closed']).toContain(j.status);
    }
  });

  it('getOpenJobs returns only open roles', () => {
    expect(getOpenJobs().length).toBeGreaterThan(0);
    expect(getOpenJobs().every((j) => j.status === 'open')).toBe(true);
  });

  it('getJobBySlug finds a role or returns undefined', () => {
    expect(getJobBySlug('digital-marketeer')?.title).toBe('Digital Marketeer');
    expect(getJobBySlug('does-not-exist')).toBeUndefined();
  });

  it('company carries marketing + reused team blurb', () => {
    expect(company.missionBlurb).toBeTruthy();
    expect(company.values.length).toBeGreaterThan(0);
    expect(company.perks.length).toBeGreaterThan(0);
    expect(company.aboutTeam).toBeTruthy();
    expect(HIRING_EMAIL).toContain('@');
  });
});
