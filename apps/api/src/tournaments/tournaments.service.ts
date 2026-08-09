import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { TournamentState } from '@prisma/client';
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
      upcoming: [TournamentState.SCHEDULED],
      live: [TournamentState.LIVE],
      ended: [TournamentState.COMPLETED, TournamentState.CANCELLED],
    };
    const states = status ? (stateMap[status] ?? []) : Object.values(TournamentState);

    const rows = await this.prisma.tournament.findMany({
      where: {
        state: { in: states },
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { startsAt: 'asc' },
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
    if (tournament.state !== TournamentState.SCHEDULED && tournament.state !== TournamentState.LIVE)
      throw new BadRequestException('Tournament is not accepting entries.');
    if (tournament.maxPlayers && tournament._count.players >= tournament.maxPlayers)
      throw new ConflictException('Tournament is full.');

    const existing = await this.prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
    });
    if (existing) throw new ConflictException('Already joined this tournament.');

    if (tournament.entryFee > 0n) {
      await this.wallet.debit(userId, tournament.entryFee, LEDGER_SOURCE.TOURNAMENT, tournamentId, idempotencyKey);
    }

    return this.prisma.tournamentPlayer.create({ data: { tournamentId, userId } });
  }

  async leaderboard(tournamentId: string, cursor?: string, limit = 50) {
    const rows = await this.prisma.tournamentPlayer.findMany({
      where: {
        tournamentId,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }],
      take: limit + 1,
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    return buildPage(rows, limit);
  }
}
