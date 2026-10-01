import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, UserRole, EntityStatus } from '../common/types';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findAll(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    const targetCompanyId =
      user.role === UserRole.SYSTEM_ADMIN ? companyId || user.companyId : user.companyId;

    if (!targetCompanyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    return this.branchesService.findAllForCompany(targetCompanyId);
  }

  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (!user.companyId && user.role !== UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    return this.branchesService.findOne(id, user.companyId || '');
  }

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; code: string; companyId?: string },
  ) {
    const targetCompanyId =
      user.role === UserRole.SYSTEM_ADMIN ? body.companyId || user.companyId : user.companyId;

    if (!targetCompanyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    return this.branchesService.create(targetCompanyId, user.id, body);
  }

  @Patch(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { name?: string; code?: string; status?: EntityStatus },
  ) {
    if (!user.companyId && user.role !== UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    return this.branchesService.update(id, user.companyId || '', user.id, body);
  }

  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.branchesService.deleteOrDeactivate(id, user);
  }
}
