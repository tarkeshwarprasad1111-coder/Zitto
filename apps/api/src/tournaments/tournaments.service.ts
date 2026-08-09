import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ActorType, LedgerType, TournamentState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { LEDGER_SOURCE } from '../common/constants';
import { buildPage } from '../common/dto/pagination.dto';

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async list(status?: string, cursor?: string, limit = 20) {
    const stateMap: Record<string, TournamentState[]> = {
      upcoming: [TournamentState.UPCOMING],
      live: [TournamentState.LIVE],
      ended: [TournamentState.ENDED, TournamentState.CANCELLED],
    };
    const states = status ? (stateMap[status] ?? []) : Object.values(TournamentState);

    const rows = await this.prisma.tournament.findMany({
      where: { state: { in: states } },
      // Prisma's own cursor keys off the sort order; filtering on `id` instead
      // would skip and duplicate rows, because id and startsAt are unrelated.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    return buildPage(rows, limit);
  }

  async getById(id: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { players: true } } },
    });
    if (!t) throw new NotFoundException('Tournament not found.');
    return t;
  }

  async join(userId: string, tournamentId: string, idempotencyKey: string) {
    const tournament = await this.getById(tournamentId);
    if (tournament.state !== TournamentState.UPCOMING && tournament.state !== TournamentState.LIVE)
      throw new BadRequestException('Tournament is not accepting entries.');
    if (tournament.maxPlayers && tournament._count.players >= tournament.maxPlayers)
      throw new ConflictException('Tournament is full.');

    const existing = await this.prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
    });
    if (existing) throw new ConflictException('Already joined this tournament.');

    if (tournament.entryFee > 0n) {
      await this.wallet.debit({
        userId,
        amount: tournament.entryFee,
        type: LedgerType.TOURNAMENT_ENTRY,
        sourceType: LEDGER_SOURCE.TOURNAMENT,
        sourceId: tournamentId,
        idempotencyKey,
        actorType: ActorType.USER,
        actorId: userId,
      });
    }

    return this.prisma.tournamentPlayer.create({ data: { tournamentId, userId } });
  }

  async leaderboard(tournamentId: string, cursor?: string, limit = 50) {
    const rows = await this.prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      // Same reason as `list()`: the cursor must ride the sort order, not the id.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    return buildPage(rows, limit);
  }
}
