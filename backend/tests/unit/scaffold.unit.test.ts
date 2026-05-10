import { describe, it, expect } from 'vitest';
import { createMockRepo } from '../helpers/mocks/mockRepository.js';
import { makeUser, makeStudent, makeTeacher } from '../helpers/fixtures/user.fixture.js';

interface SampleRepo {
  findById(id: string): Promise<{ id: string } | null>;
  save(doc: unknown): Promise<void>;
}

describe('scaffold (test infrastructure smoke)', () => {
  it('createMockRepo returns vi.fn() for any method access', async () => {
    const repo = createMockRepo<SampleRepo>();
    repo.findById.mockResolvedValue({ id: '42' });
    await expect(repo.findById('42')).resolves.toEqual({ id: '42' });
    expect(repo.findById).toHaveBeenCalledWith('42');
  });

  it('user fixtures produce well-formed shapes', () => {
    const user = makeUser();
    expect(user._id).toBeDefined();
    expect(user.email).toMatch(/@/);
    expect(user.roles).toEqual(['student']);
    expect(makeStudent().roles).toEqual(['student']);
    expect(makeTeacher().roles).toEqual(['teacher']);
  });

  it('fixture overrides take precedence', () => {
    const u = makeUser({ email: 'override@test.local' });
    expect(u.email).toBe('override@test.local');
  });
});
