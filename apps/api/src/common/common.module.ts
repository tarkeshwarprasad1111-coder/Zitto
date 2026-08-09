import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit/audit.service';

/** Global module for cross-cutting services that every feature needs. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class CommonModule {}
