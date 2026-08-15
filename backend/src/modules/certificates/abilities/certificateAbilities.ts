import {AuthenticatedUser} from '#root/shared/index.js';
import {AbilityBuilder} from '@casl/ability';
import {CertificatePermissionSubject} from '../constants.js';

export enum CertificateActions {
  Manage = 'manage',
  View = 'view',
}

/**
 * Kept intentionally simple for v1: a student can only ever view their own
 * certificates (enforced by scoping the query to their own userId in the
 * service layer, not by CASL conditions here — certificates aren't filtered
 * client-side data, they're issued server-side). Admins can view all, for
 * support/debugging when a student says "my certificate didn't generate".
 *
 * The public verification endpoint (GET /certificates/:certificateId)
 * deliberately does NOT go through this ability check — it's meant to be
 * checkable by anyone with the link, same as a real paper certificate.
 */
export async function setupCertificateAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) {
  const {can} = builder;

  if (user.globalRole === 'admin') {
    can(CertificateActions.Manage, CertificatePermissionSubject.CERTIFICATE);
    return;
  }

  can(CertificateActions.View, CertificatePermissionSubject.CERTIFICATE, {
    userId: user.userId,
  });
}
