import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/** Global so feature modules never re-declare the database client. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
