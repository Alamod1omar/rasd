import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, UserRole, EntityStatus } from '../common/types';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  private async resolveCompanyId(user: AuthUser, explicitCompanyId?: string): Promise<string> {
    if (explicitCompanyId) return explicitCompanyId;
    if (user.companyId) return user.companyId;
    const defaultId = await this.productsService.getDefaultCompanyId();
    if (defaultId) return defaultId;
    throw new ForbiddenException('المستخدم ليس مرتبطاً بشركة');
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN)
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('brand') brand?: string,
    @Query('status') status?: EntityStatus,
    @Query('companyId') companyId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const cId = await this.resolveCompanyId(user, companyId);
    return this.productsService.findAll(cId, {
      search,
      brand,
      status,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
  }

  @Get('search')
  async search(
    @CurrentUser() user: AuthUser,
    @Query('q') query: string,
    @Query('companyId') companyId?: string,
  ) {
    const cId = await this.resolveCompanyId(user, companyId);
    return this.productsService.searchCatalog(cId, query);
  }

  @Get('brands-by-part')
  async getBrandsByPart(
    @CurrentUser() user: AuthUser,
    @Query('partNumber') partNumber: string,
    @Query('companyId') companyId?: string,
  ) {
    const cId = await this.resolveCompanyId(user, companyId);
    return this.productsService.getBrandsForPartNumber(cId, partNumber);
  }

  @Get('template')
  @Roles(UserRole.COMPANY_ADMIN)
  async downloadTemplate(@Res() res: any) {
    const buffer = await this.productsService.getImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="RASD_Products_Template.xlsx"',
    );
    return res.send(buffer);
  }

  @Get('export')
  @Roles(UserRole.COMPANY_ADMIN)
  async exportProducts(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId: string,
    @Res() res: any,
  ) {
    const cId = await this.resolveCompanyId(user, companyId);
    const buffer = await this.productsService.exportProducts(cId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="RASD_Products_Export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    return res.send(buffer);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    const cId = await this.resolveCompanyId(user, companyId);
    return this.productsService.findOne(id, cId);
  }

  @Post()
  @Roles(UserRole.COMPANY_ADMIN)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: { partNumber: string; partName: string; brand: string; alternativeNumbers?: string[]; companyId?: string },
  ) {
    const cId = await this.resolveCompanyId(user, body.companyId);
    return this.productsService.create(cId, user.id, body);
  }

  @Patch(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { partNumber?: string; partName?: string; brand?: string; status?: EntityStatus; alternativeNumbers?: string[]; companyId?: string },
  ) {
    const cId = await this.resolveCompanyId(user, body.companyId);
    return this.productsService.update(id, cId, user.id, body);
  }

  @Post('import/preview')
  @Roles(UserRole.COMPANY_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async previewExcel(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('companyId') companyId?: string,
  ) {
    const cId = await this.resolveCompanyId(user, companyId);
    if (!file) {
      throw new BadRequestException('يرجى تحديد ملف Excel أو CSV لرفعه');
    }
    return this.productsService.parseExcel(file.buffer, cId);
  }

  @Post('import/confirm')
  @Roles(UserRole.COMPANY_ADMIN)
  async confirmImport(
    @CurrentUser() user: AuthUser,
    @Body() body: { validRows: Array<{ partNumber: string; partName: string; brand: string; alternativeNumbers?: string[] }>; companyId?: string },
  ) {
    const cId = await this.resolveCompanyId(user, body.companyId);
    return this.productsService.confirmImport(cId, user.id, body.validRows);
  }
}
