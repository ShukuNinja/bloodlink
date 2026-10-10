import type { PrismaService } from '../database/prisma.service';

/**
 * OWNER: D3
 * PURPOSE: Resolve the HOSPITAL organizations in which a user holds an
 * ACTIVE membership with a hospital review role. Every D3 query scopes by
 * this set, so hospital staff can only ever see or mutate records belonging
 * to their own active hospitals.
 * AUTHORIZATION: Membership status ACTIVE, organization status ACTIVE and
 * typed HOSPITAL, role HOSPITAL_ADMIN or HOSPITAL_STAFF.
 */
export async function findMemberHospitalIds(
  prisma: PrismaService,
  userId: string,
): Promise<string[]> {
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      role: { in: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'] },
      organization: { status: 'ACTIVE', type: 'HOSPITAL' },
    },
    select: { organizationId: true },
  });
  return memberships.map((membership) => membership.organizationId);
}
