import {describe, it, expect, vi} from 'vitest';
import {EjectionPolicyService} from '../services/EjectionPolicyService.js';

/**
 * A policy created through this service must never be live.
 *
 * Auto-ejection unenrolls students without anyone asking it to, so switching it
 * on has to be a separate, deliberate act (the toggle/update path, which the UI
 * confirms first). Creation is not that act. DI is bypassed the same way the
 * other service unit tests in this repo do it: the prototype is instantiated
 * directly and only the collaborators this call path touches are stubbed.
 */

const CREATED_BY = 'admin-1';

function makeService() {
  const service: any = Object.create(EjectionPolicyService.prototype);

  service._withTransaction = async (fn: any) => fn({} as any);

  const create = vi.fn().mockResolvedValue('policy-1');

  service.policyRepo = {
    findByCohort: async () => null,
    create,
    // Echoes back what create() was handed, so the assertions below read the
    // object as it would actually be persisted.
    findById: async () => create.mock.calls[0][0],
  };

  // The triggers/actions shape is validated separately; this path only cares
  // about isActive, so validation is stubbed out.
  service.validatePolicyData = () => undefined;

  return {service, create};
}

const basePolicy = {
  name: 'Progress policy',
  courseId: 'course-1',
  courseVersionId: 'version-1',
  cohortId: 'cohort-1',
};

describe('EjectionPolicyService.createPolicy', () => {
  it('creates the policy inactive when isActive was not supplied', async () => {
    const {service, create} = makeService();

    await service.createPolicy({...basePolicy}, CREATED_BY);

    expect(create.mock.calls[0][0].isActive).toBe(false);
  });

  it('creates the policy inactive even when the caller asks for isActive: true', async () => {
    const {service, create} = makeService();

    await service.createPolicy(
      {...basePolicy, isActive: true} as any,
      CREATED_BY,
    );

    // A client that posts isActive: true — including an older frontend build —
    // must not be able to bring up a live ejection policy in one call.
    expect(create.mock.calls[0][0].isActive).toBe(false);
  });

  it('still records the rest of the policy it was given', async () => {
    const {service, create} = makeService();

    await service.createPolicy({...basePolicy} as any, CREATED_BY);

    const created = create.mock.calls[0][0];
    expect(created.name).toBe('Progress policy');
    expect(created.cohortId).toBe('cohort-1');
    expect(created.createdBy).toBe(CREATED_BY);
  });
});
