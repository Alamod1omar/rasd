import { Controller, Get, Post, Patch, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, UserRole, EntityStatus } from '../common/types';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN)
  async findAll() {
    return this.companiesService.findAll();
  }

  @Get('current')
  async getCurrent(@CurrentUser() user: AuthUser) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    return this.companiesService.findOne(user.companyId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (user.role !== UserRole.SYSTEM_ADMIN && user.companyId !== id) {
      throw new ForbiddenException('غير مصرح لك بالوصول لبيانات شركة أخرى');
    }
    return this.companiesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  async create(@Body() body: { name: string; code: string }) {
    return this.companiesService.create(body);
  }

  @Patch('current')
  @Roles(UserRole.COMPANY_ADMIN)
  async updateCurrent(@CurrentUser() user: AuthUser, @Body() body: { name?: string; logo?: string }) {
    if (!user.companyId) {
      throw new ForbiddenException('غير مرتبط بشركة');
    }
    return this.companiesService.update(user.companyId, body);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; status?: EntityStatus; logo?: string },
  ) {
    return this.companiesService.update(id, body);
  }

  @Post(':id/initial-admin')
  @Roles(UserRole.SYSTEM_ADMIN)
  async createInitialAdmin(
    @Param('id') id: string,
    @Body() body: { fullName: string; username: string; password: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.companiesService.createInitialAdmin(id, body, user.id);
  }

  @Get(':id/branches')
  @Roles(UserRole.SYSTEM_ADMIN)
  async getCompanyBranches(@Param('id') id: string) {
    return this.companiesService.findCompanyBranches(id);
  }

  @Get(':id/users')
  @Roles(UserRole.SYSTEM_ADMIN)
  async getCompanyUsers(@Param('id') id: string) {
    return this.companiesService.findCompanyUsers(id);
  }
}

