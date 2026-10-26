import type { AuthUser } from '@bloodlink/contracts';

export function defaultLandingPath(user: AuthUser): string {
  if (user.role === 'ADMIN') return '/admin';
  if (
    user.organizations.some((organization) => organization.type === 'HOSPITAL')
  ) {
    return '/hospital/patient-needs';
  }
  if (
    user.organizations.some(
      (organization) => organization.type === 'BLOOD_CENTRE',
    )
  ) {
    return '/blood-centre';
  }
  return '/hospitals';
}

export function canAccessRoute(user: AuthUser, pathname: string): boolean {
  const individualAccount =
    user.role === 'INDIVIDUAL' && user.organizations.length === 0;
  if (pathname.startsWith('/donor')) return individualAccount;
  if (pathname.startsWith('/admin')) return user.role === 'ADMIN';
  if (pathname.startsWith('/blood-centre')) {
    return user.organizations.some(
      (organization) => organization.type === 'BLOOD_CENTRE',
    );
  }
  // Match the plural Individual discovery route before the singular Hospital
  // workspace prefix; `/hospitals` also starts with `/hospital`.
  if (pathname === '/hospitals' || pathname.startsWith('/patient-needs')) {
    return individualAccount;
  }
  if (pathname.startsWith('/hospital')) {
    return user.organizations.some(
      (organization) => organization.type === 'HOSPITAL',
    );
  }
  return true;
}

export function safePostAuthPath(
  user: AuthUser,
  requestedPath: string | null,
): string {
  if (
    requestedPath?.startsWith('/') &&
    !requestedPath.startsWith('//') &&
    canAccessRoute(user, requestedPath)
  ) {
    return requestedPath;
  }
  return defaultLandingPath(user);
}
