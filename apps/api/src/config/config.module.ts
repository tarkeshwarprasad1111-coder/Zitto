import { Global, Module } from '@nestjs/common';

import { AppConfigService } from './app-config.service';

/**
 * Global typed-config module. `ConfigModule.forRoot()` itself is registered in
 * `AppModule` (it owns env loading + validation); this module only exposes the
 * typed façade everywhere.
 */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
