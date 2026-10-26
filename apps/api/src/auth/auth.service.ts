import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type {
  AuthResponse,
  AuthUser,
  LoginInput,
  OrganizationMembershipRole,
  OrganizationType,
  PlatformRole,
  RegisterInput,
  UserStatus,
} from '@bloodlink/contracts';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedPrincipal } from './auth.types';

const BCRYPT_ROUNDS = 12;
const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_REFRESH_TOKEN = 'Invalid refresh token';
const dummyPasswordHash = bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  role: PlatformRole;
  status: UserStatus;
};

type RefreshClaims = { sub?: unknown; jti?: unknown };
type TokenStore = Pick<PrismaService, 'refreshToken'>;
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const accountType = input.accountType ?? 'INDIVIDUAL';
    const isOrganization =
      accountType === 'HOSPITAL' || accountType === 'BLOOD_CENTRE';
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    let user: UserRecord;
    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: {
            email,
            passwordHash,
            role: 'INDIVIDUAL',
          },
        });
        if (isOrganization) {
          const { latitude, longitude } = input.location!;
          const organizationId = randomUUID();
          await transaction.$executeRaw`
            INSERT INTO "Organization"
              ("id", "name", "type", "location", "createdAt", "updatedAt")
            VALUES (
              ${organizationId}::uuid,
              ${input.organizationName!},
              ${accountType}::"OrganizationType",
              ST_SetSRID(
                ST_MakePoint(${longitude}, ${latitude}),
                4326
              )::geography,
              NOW(),
              NOW()
            )
          `;
          await transaction.organizationMembership.create({
            data: {
              userId: createdUser.id,
              organizationId,
              role:
                accountType === 'HOSPITAL'
                  ? 'HOSPITAL_ADMIN'
                  : 'BLOOD_CENTRE_ADMIN',
            },
          });
        }

        return createdUser;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }

    return this.issueTokens(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(input.email) },
    });
    const passwordHash = user ? user.passwordHash : await dummyPasswordHash;
    const passwordMatches = await bcrypt.compare(input.password, passwordHash);

    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { storedToken, user } =
      await this.getActiveRefreshToken(refreshToken);
    const now = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
      }

      return this.issueTokens(user, transaction);
    });
  }

  async logout(refreshToken: string): Promise<{ loggedOut: true }> {
    const { storedToken } = await this.getActiveRefreshToken(refreshToken);
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: storedToken.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    return { loggedOut: true };
  }

  async authenticateAccessToken(
    token: string,
  ): Promise<AuthenticatedPrincipal> {
    let claims: { sub?: unknown };
    try {
      claims = await this.jwt.verifyAsync<{ sub?: unknown }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Authentication required');
    }

    if (typeof claims.sub !== 'string') {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
    };
  }

  async userHasRole(
    user: AuthenticatedPrincipal,
    role: PlatformRole | OrganizationType | OrganizationMembershipRole,
  ): Promise<boolean> {
    if (user.role === role) return true;

    if (role === 'HOSPITAL' || role === 'BLOOD_CENTRE') {
      const membership = await this.prisma.organizationMembership.findFirst({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          organization: { type: role, status: 'ACTIVE' },
        },
        select: { id: true },
      });
      return Boolean(membership);
    }

    if (isMembershipRole(role)) {
      const organizationType = role.startsWith('HOSPITAL_')
        ? 'HOSPITAL'
        : 'BLOOD_CENTRE';
      const membership = await this.prisma.organizationMembership.findFirst({
        where: {
          userId: user.id,
          role,
          status: 'ACTIVE',
          organization: { status: 'ACTIVE', type: organizationType },
        },
        select: { id: true },
      });
      return Boolean(membership);
    }

    return false;
  }

  async verifyOrganizationMembership(
    userId: string,
    organizationId: string,
    roles: OrganizationMembershipRole[],
  ) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        role: { in: roles },
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      include: { organization: true },
    });

    if (
      !membership ||
      !rolesBelongToOrganization(roles, membership.organization.type)
    ) {
      return null;
    }
    return membership;
  }

  async toAuthUser(
    user: Pick<UserRecord, 'id' | 'email' | 'status' | 'role'>,
  ): Promise<AuthUser> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: {
        role: true,
        organization: {
          select: { id: true, name: true, type: true },
        },
      },
    });
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      organizations: memberships.map(({ role, organization }) => ({
        ...organization,
        role,
      })),
    };
  }

  private async getActiveRefreshToken(refreshToken: string) {
    let claims: RefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshClaims>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    if (typeof claims.sub !== 'string' || typeof claims.jti !== 'string') {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ revokedAt: { not: null } }, { expiresAt: { lte: new Date() } }],
      },
    });

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    const now = new Date();
    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= now ||
      storedToken.userId !== claims.sub ||
      storedToken.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    return { storedToken, user: storedToken.user as UserRecord };
  }

  private async issueTokens(
    user: UserRecord,
    tokenStore: TokenStore = this.prisma,
  ): Promise<AuthResponse> {
    const accessExpiresIn = this.config.getOrThrow<string>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    const accessOptions = {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn,
    } as unknown as JwtSignOptions;
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      accessOptions,
    );
    const tokenId = randomUUID();
    const expiresIn = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');
    const refreshOptions = {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn,
    } as unknown as JwtSignOptions;
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: tokenId },
      refreshOptions,
    );

    await tokenStore.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + durationInSeconds(expiresIn) * 1000),
      },
    });

    return {
      user: await this.toAuthUser(user),
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function durationInSeconds(value: string): number {
  const match = /^([1-9]\d*)([smhd])$/.exec(value);
  if (!match) throw new Error('Invalid token expiration configuration');
  const amounts: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * amounts[match[2]];
}

function isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function isMembershipRole(
  role: PlatformRole | OrganizationType | OrganizationMembershipRole,
): role is OrganizationMembershipRole {
  return [
    'HOSPITAL_ADMIN',
    'HOSPITAL_STAFF',
    'BLOOD_CENTRE_ADMIN',
    'BLOOD_CENTRE_STAFF',
  ].includes(role);
}

function rolesBelongToOrganization(
  roles: OrganizationMembershipRole[],
  type: OrganizationType,
): boolean {
  return roles.some((role) =>
    type === 'HOSPITAL'
      ? role === 'HOSPITAL_ADMIN' || role === 'HOSPITAL_STAFF'
      : role === 'BLOOD_CENTRE_ADMIN' || role === 'BLOOD_CENTRE_STAFF',
  );
}
