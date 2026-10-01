import { Controller, Get, Post, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('search')
  async search(
    @CurrentUser() user: AuthUser,
    @Query('q') q: string = '',
    @Query('limit') limit?: string,
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم غير مرتبط بشركة');
    }
    const take = limit ? parseInt(limit, 10) : 10;
    const results = await this.customersService.search(user.companyId, q, take);
    return { customers: results };
  }

  @Get()
  async getAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم غير مرتبط بشركة');
    }
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    return this.customersService.getAll(user.companyId, p, ps, search);
  }
}
