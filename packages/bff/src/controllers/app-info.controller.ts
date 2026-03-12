import { Controller, Get, Route, Tags, SuccessResponse } from 'tsoa';
import type { AppInfoDto } from 'common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { env } from '../config/env.config';

@Route('info')
@Tags('AppInfo')
export class AppInfoController extends Controller {
  @Get('/')
  @SuccessResponse('200', 'OK')
  public getAppInfo(): AppInfoDto {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as {
      name: string;
      version: string;
    };

    return {
      name: pkg.name,
      version: pkg.version,
      environment: env.NODE_ENV,
    };
  }
}
