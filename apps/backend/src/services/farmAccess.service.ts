import { prisma } from '@farmassist/database';

/**
 * Whether a user may write against a farm.
 *
 * Several endpoints accept `farmId` in the request body — tasks, farm notes,
 * scans. A farm id is not a secret and is easy to guess or to have seen once,
 * so every one of those writes has to be checked against the caller's tenant
 * memberships rather than trusted.
 *
 * Access is membership in the farm's tenant, in any role. Role-level
 * distinctions (VIEWER should not write) are a separate concern and are not
 * decided here.
 */
export async function userCanAccessFarm(userId: string, farmId: string): Promise<boolean> {
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, tenant: { members: { some: { userId } } } },
    select: { id: true },
  });
  return farm !== null;
}
