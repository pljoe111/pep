/**
 * TestController — spec §9.10
 */
import { inject } from 'tsyringe';
import {
  Controller,
  Get,
  Post,
  Patch,
  Route,
  Tags,
  Body,
  Request,
  Security,
  Path,
  Query,
  OperationId,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { TestService } from '../services/test.service';
import type { TestDto, CreateTestDto, UpdateTestDto } from 'common';
import type { JwtPayload } from '../middleware/auth.middleware';

@Route('tests')
@Tags('Tests')
export class TestController extends Controller {
  constructor(@inject(TestService) private readonly testService: TestService) {
    super();
  }

  /** GET /tests */
  @Get('/')
  @OperationId('GetAllTests')
  public async getAll(@Query() active_only?: boolean): Promise<TestDto[]> {
    return this.testService.findAll(active_only);
  }

  /** POST /tests — admin required */
  @Post('/')
  @Security('jwt')
  @OperationId('CreateTest')
  public async create(
    @Body() body: CreateTestDto,
    @Request() req: ExpressRequest
  ): Promise<TestDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.testService.create(body, user.userId);
  }

  /** PATCH /tests/:id — admin required */
  @Patch('{id}')
  @Security('jwt')
  @OperationId('UpdateTestRecord')
  public async update(
    @Path() id: string,
    @Body() body: UpdateTestDto,
    @Request() req: ExpressRequest
  ): Promise<TestDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user as JwtPayload;
    return this.testService.update(id, body, user.userId);
  }
}
