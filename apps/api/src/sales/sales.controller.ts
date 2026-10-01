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
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, UserRole, SalesRequestStatus } from '../common/types';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('active')
  async getActive(@CurrentUser() user: AuthUser, @Query('branchId') branchId?: string) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    const bId = branchId || user.currentBranchId;
    if (!bId) return null;
    return this.salesService.getActiveRequest(user.companyId, bId);
  }

  @Get('check-item')
  async checkItem(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('partNumber') partNumber?: string,
    @Query('brand') brand?: string,
    @Query('productId') productId?: string,
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
    }
    const bId = branchId || user.currentBranchId;
    if (!bId || !partNumber) return { exists: false };
    return this.salesService.checkItemInActiveRequest(user.companyId, bId, partNumber, brand, productId);
  }

  @Post()
  async createSaleRequest(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      branchId?: string;
      customer: {
        id?: string;
        name: string;
        phone?: string;
        taxNumber?: string;
        city?: string;
      };
      items: Array<{
        productId?: string;
        partNumber: string;
        partName?: string;
        brand: string;
        quantity: number;
        unitPrice: number;
        note?: string;
      }>;
    },
  ) {
    return this.salesService.createSaleRequest(user, body);
  }

  @Post('register-item')
  async registerItem(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      branchId?: string;
      productId?: string;
      partNumber: string;
      partName?: string;
      brand: string;
      quantity: number;
      unitPrice: number;
      soldTo: string;
      note?: string;
    },
  ) {
    return this.salesService.registerItem(user, body);
  }

  @Get()
  @Roles(UserRole.OPERATOR, UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: SalesRequestStatus,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.salesService.findAll(user, {
      status,
      branchId,
      search,
      dateFrom,
      dateTo,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 15,
    });
  }

  @Get(':id')
  @Roles(UserRole.OPERATOR, UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.findOne(id, user);
  }

  @Post(':id/mark-invoiced')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async markInvoiced(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { officialInvoiceNumber: string; officialInvoiceDate?: string },
  ) {
    return this.salesService.markInvoiced(id, user, body);
  }

  @Patch('items/:itemId')
  @Roles(UserRole.OPERATOR, UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async updateItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { quantity?: number; unitPrice?: number; soldTo?: string; note?: string },
  ) {
    return this.salesService.updateItem(itemId, user, body);
  }

  @Delete('items/:itemId')
  @Roles(UserRole.OPERATOR, UserRole.COMPANY_ADMIN, UserRole.SYSTEM_ADMIN)
  async deleteItem(@Param('itemId') itemId: string, @CurrentUser() user: AuthUser) {
    return this.salesService.deleteItem(itemId, user);
  }
}

