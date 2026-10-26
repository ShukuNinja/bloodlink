import { Injectable } from '@nestjs/common';
import type {
  AdminAccountView,
  AdminMetrics,
  AdminOrganizationView,
  AdminRecordListQuery,
  PaginationMeta,
} from '@bloodlink/contracts';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<AdminMetrics> {
    const [
      totalUsers,
      individuals,
      admins,
      activeUsers,
      suspendedUsers,
      totalOrganizations,
      hospitals,
      bloodCentres,
      activeOrganizations,
      suspendedOrganizations,
      patientNeeds,
      bloodRequests,
      individualResponders,
      donorResponses,
      organizationResponses,
      hospitalSubscriptions,
      donationRecords,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { role: 'INDIVIDUAL', memberships: { none: {} } },
      }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { type: 'HOSPITAL' } }),
      this.prisma.organization.count({ where: { type: 'BLOOD_CENTRE' } }),
      this.prisma.organization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.patientNeed.count(),
      this.prisma.bloodRequest.count(),
      this.prisma.user.count({
        where: { donorResponses: { some: { status: 'ACCEPTED' } } },
      }),
      this.prisma.donorResponse.count(),
      this.prisma.organizationResponse.count(),
      this.prisma.organizationSubscription.count(),
      this.prisma.donationRecord.count(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      accounts: {
        total: totalUsers,
        individuals,
        admins,
        active: activeUsers,
        suspended: suspendedUsers,
      },
      organizations: {
        total: totalOrganizations,
        hospitals,
        bloodCentres,
        active: activeOrganizations,
        suspended: suspendedOrganizations,
      },
      workflows: {
        patientNeeds,
        bloodRequests,
        individualResponders,
        donorResponses,
        organizationResponses,
        hospitalSubscriptions,
        donationRecords,
      },
    };
  }

  async listAccounts(query: AdminRecordListQuery) {
    const pagination = normalizePagination(query);
    const [accounts, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          memberships: {
            select: {
              role: true,
              status: true,
              organization: {
                select: { id: true, name: true, type: true, status: true },
              },
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);
    const data: AdminAccountView[] = accounts.map((account) => ({
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      organizations: account.memberships.map((membership) => ({
        ...membership.organization,
        role: membership.role,
        membershipStatus: membership.status,
      })),
    }));

    return { data, meta: paginationMeta(pagination, total) };
  }

  async listOrganizations(query: AdminRecordListQuery) {
    const pagination = normalizePagination(query);
    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        skip: pagination.skip,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { memberships: true } },
        },
      }),
      this.prisma.organization.count(),
    ]);
    const data: AdminOrganizationView[] = organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      type: organization.type,
      status: organization.status,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
      memberCount: organization._count.memberships,
    }));

    return { data, meta: paginationMeta(pagination, total) };
  }
}

function normalizePagination(query: AdminRecordListQuery) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 20, 100);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function paginationMeta(
  pagination: ReturnType<typeof normalizePagination>,
  total: number,
): PaginationMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.ceil(total / pagination.pageSize),
  };
}
