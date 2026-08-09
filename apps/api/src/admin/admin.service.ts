import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ActorType, LedgerType, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { LEDGER_SOURCE } from '../common/constants';
import { buildPage } from '../common/dto/pagination.dto';
import { assertNoBannedPhrases } from '../analytics/analytics.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async getDashboard() {
    const [totalUsers, activeRooms, openTickets, activeRounds] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.gameRoom.count({ where: { status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.gameRound.count({ where: { state: 'BETTING' } }),
    ]);
    return { totalUsers, activeRooms, openTickets, activeRounds, ts: new Date().toISOString() };
  }

  async listUsers(q?: string, status?: UserStatus, cursor?: string, limit = 20) {
    const rows = await this.prisma.user.findMany({
      where: {
        ...(q ? { OR: [{ email: { contains: q } }, { displayName: { contains: q } }] } : {}),
        ...(status ? { status } : {}),
      },
      // Prisma's cursor follows the sort order; an `id < cursor` filter does not,
      // so pages would skip and repeat rows.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true, displayName: true, email: true, mobile: true,
        status: true, emailVerifiedAt: true, createdAt: true,
      },
    });
    return buildPage(rows, limit);
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
        sessions: { take: 5, orderBy: { createdAt: 'desc' } },
        roles: { include: { role: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async setUserStatus(adminId: string, userId: string, status: UserStatus, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Reason is required for status changes.');
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status } });
    await this.prisma.auditLog.create({
      data: {
        actorType: 'ADMIN', actorId: adminId,
        action: `user.status.${status.toLowerCase()}`,
        targetType: 'user', targetId: userId,
        payloadJson: { reason, newStatus: status },
      },
    });
    // Revoke all sessions on suspension
    if (status === UserStatus.SUSPENDED || status === UserStatus.SELF_EXCLUDED) {
      await this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return user;
  }

  async creditUser(adminId: string, userId: string, amount: bigint, reason: string, idempotencyKey: string) {
    if (!reason?.trim()) throw new BadRequestException('Reason is required for admin credits.');
    const result = await this.wallet.credit({
      userId,
      amount,
      type: LedgerType.ADMIN_CREDIT,
      sourceType: LEDGER_SOURCE.ADMIN,
      sourceId: adminId,
      idempotencyKey,
      actorType: ActorType.ADMIN,
      actorId: adminId,
      metadata: { reason },
    });
    await this.prisma.auditLog.create({
      data: {
        actorType: 'ADMIN', actorId: adminId,
        action: 'wallet.admin_credit',
        targetType: 'user', targetId: userId,
        payloadJson: { amount: amount.toString(), reason },
      },
    });
    return result;
  }

  async getAuditLogs(actor?: string, action?: string, target?: string, from?: Date, to?: Date, cursor?: string, limit = 20) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(actor ? { actorId: actor } : {}),
        ...(action ? { action: { contains: action } } : {}),
        ...(target ? { targetId: target } : {}),
        ...(from || to ? { createdAt: { gte: from, lte: to } } : {}),
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildPage(rows, limit);
  }

  /** Validates admin-authored model notes for banned phrases before persisting. */
  validateModelNote(note: string) {
    assertNoBannedPhrases(note); // throws if banned phrase found
    return { valid: true };
  }

  async upsertAppSetting(adminId: string, key: string, value: string) {
    const result = await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    await this.prisma.auditLog.create({
      data: {
        actorType: 'ADMIN', actorId: adminId,
        action: 'settings.update',
        targetType: 'app_setting', targetId: key,
        payloadJson: { key, value },
      },
    });
    return result;
  }
}
