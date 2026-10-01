import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, UserRole, EntityStatus } from '../common/types';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findAll(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    return this.usersService.findAll(user, companyId);
  }

  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const cId = user.role === UserRole.SYSTEM_ADMIN ? undefined : user.companyId!;
    return this.usersService.findOne(id, cId || user.companyId!);
  }

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      companyId?: string;
      fullName: string;
      username: string;
      password: string;
      role: UserRole;
      branchIds?: string[];
    },
  ) {
    const targetCompanyId = user.role === UserRole.SYSTEM_ADMIN ? (body.companyId || user.companyId) : user.companyId;
    if (!targetCompanyId) {
      throw new ForbiddenException('يرجى تحديد الشركة');
    }
    return this.usersService.create(targetCompanyId, user.id, body);
  }

  @Patch(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      fullName?: string;
      password?: string;
      status?: EntityStatus;
      role?: UserRole;
      branchIds?: string[];
    },
  ) {
    if (!user.companyId && user.role !== UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    return this.usersService.update(id, user.companyId || '', user.id, body);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { newPassword: string; mustChangePassword?: boolean },
  ) {
    return this.usersService.resetPassword(id, user, body);
  }

  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.deleteOrDeactivate(id, user);
  }
}
