/**
 * Tests for claim-state lint logic
 * 
 * Run with: npm test -- tests/claim-state.test.ts
 */

import { checkViolations, hasLabel, isAssigned } from '../../src/lint/claim-state';

describe('claim-state lint', () => {
  describe('hasLabel', () => {
    it('returns true when label exists', () => {
      const state = {
        assignee: null,
        assignees: [],
        labels: [{ name: 'ready' }, { name: 'agent-eligible' }],
      };
      expect(hasLabel(state, 'ready')).toBe(true);
    });

    it('returns false when label does not exist', () => {
      const state = {
        assignee: null,
        assignees: [],
        labels: [{ name: 'ready' }],
      };
      expect(hasLabel(state, 'in-progress')).toBe(false);
    });
  });

  describe('isAssigned', () => {
    it('returns true when assignee exists', () => {
      const state = {
        assignee: { login: 'jlwaugh' },
        assignees: [{ login: 'jlwaugh' }],
        labels: [],
      };
      expect(isAssigned(state)).toBe(true);
    });

    it('returns false when no assignee', () => {
      const state = {
        assignee: null,
        assignees: [],
        labels: [],
      };
      expect(isAssigned(state)).toBe(false);
    });
  });

  describe('checkViolations', () => {
    describe('Violation 1: assigned + ready', () => {
      it('detects assigned + ready as violation', () => {
        const state = {
          assignee: { login: 'jlwaugh' },
          assignees: [{ login: 'jlwaugh' }],
          labels: [{ name: 'ready' }],
        };
        const result = checkViolations(state);
        expect(result.violation).toBe(true);
        expect(result.type).toBe('assigned-plus-ready');
        expect(result.fix).toContain('Remove');
      });

      it('allows assigned + in-progress (valid state)', () => {
        const state = {
          assignee: { login: 'jlwaugh' },
          assignees: [{ login: 'jlwaugh' }],
          labels: [{ name: 'in-progress' }],
        };
        const result = checkViolations(state);
        expect(result.violation).toBe(false);
      });

      it('allows unassigned + ready (valid state)', () => {
        const state = {
          assignee: null,
          assignees: [],
          labels: [{ name: 'ready' }],
        };
        const result = checkViolations(state);
        expect(result.violation).toBe(false);
      });
    });

    describe('Violation 2: in-progress + no assignee', () => {
      it('detects in-progress + no assignee as violation', () => {
        const state = {
          assignee: null,
          assignees: [],
          labels: [{ name: 'in-progress' }],
        };
        const result = checkViolations(state);
        expect(result.violation).toBe(true);
        expect(result.type).toBe('in-progress-plus-no-assignee');
        expect(result.fix).toContain('Assign');
      });

      it('allows in-progress + assignee (valid state)', () => {
        const state = {
          assignee: { login: 'jlwaugh' },
          assignees: [{ login: 'jlwaugh' }],
          labels: [{ name: 'in-progress' }],
        };
        const result = checkViolations(state);
        expect(result.violation).toBe(false);
      });

      it('allows ready + no assignee (valid state)', () => {
        const state = {
          assignee: null,
          assignees: [],
          labels: [{ name: 'ready' }],
        };
        const result = checkViolations(state);
        expect(result.violation).toBe(false);
      });
    });

    describe('Valid states', () => {
      it('allows ready alone', () => {
        const state = {
          assignee: null,
          assignees: [],
          labels: [{ name: 'ready' }],
        };
        expect(checkViolations(state).violation).toBe(false);
      });

      it('allows in-progress + assignee', () => {
        const state = {
          assignee: { login: 'jlwaugh' },
          assignees: [{ login: 'jlwaugh' }],
          labels: [{ name: 'in-progress' }],
        };
        expect(checkViolations(state).violation).toBe(false);
      });

      it('allows blocked + assignee', () => {
        const state = {
          assignee: { login: 'jlwaugh' },
          assignees: [{ login: 'jlwaugh' }],
          labels: [{ name: 'blocked' }],
        };
        expect(checkViolations(state).violation).toBe(false);
      });

      it('allows closed issues', () => {
        const state = {
          assignee: { login: 'jlwaugh' },
          assignees: [{ login: 'jlwaugh' }],
          labels: [],
        };
        expect(checkViolations(state).violation).toBe(false);
      });
    });
  });
});
