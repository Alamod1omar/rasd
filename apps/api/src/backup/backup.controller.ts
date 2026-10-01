import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, UserRole } from '../common/types';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('list')
  @Roles(UserRole.COMPANY_ADMIN)
  async listBackups(@CurrentUser() user: AuthUser) {
    const companyId = user.role === UserRole.SYSTEM_ADMIN ? null : user.companyId;
    return this.backupService.listBackups(companyId);
  }

  @Post('create')
  @Roles(UserRole.COMPANY_ADMIN)
  async createBackup(
    @CurrentUser() user: AuthUser,
    @Body() body: { note?: string },
  ) {
    const companyId = user.role === UserRole.SYSTEM_ADMIN ? null : user.companyId;
    return this.backupService.createBackup(companyId, user.id, body?.note);
  }

  @Get('download/:filename')
  @Roles(UserRole.COMPANY_ADMIN)
  async downloadBackup(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const companyId = user.role === UserRole.SYSTEM_ADMIN ? null : user.companyId;
    const { filePath, filename: cleanFilename } = await this.backupService.getBackupFile(
      filename,
      user.id,
      companyId,
    );

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    return res.sendFile(filePath);
  }

  @Post('validate')
  @Roles(UserRole.COMPANY_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async validateBackup(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const companyId = user.role === UserRole.SYSTEM_ADMIN ? null : user.companyId;
    let payload = body;
    if (file && file.buffer) {
      try {
        payload = JSON.parse(file.buffer.toString('utf-8'));
      } catch (e) {
        throw new BadRequestException('ملف النسخة الاحتياطية غير صالح (صيغة JSON غير صحيحة)');
      }
    } else if (body && body.filename) {
      const { filePath } = await this.backupService.getBackupFile(body.filename, user.id, companyId);
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      payload = JSON.parse(content);
    } else if (body && body.payload) {
      payload = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload;
    }

    return this.backupService.validateBackupPayload(payload);
  }

  @Post('restore')
  @Roles(UserRole.COMPANY_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async restoreBackup(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const companyId = user.role === UserRole.SYSTEM_ADMIN ? null : user.companyId;
    let payload = body;
    if (file && file.buffer) {
      try {
        payload = JSON.parse(file.buffer.toString('utf-8'));
      } catch (e) {
        throw new BadRequestException('تعذر قراءة ملف النسخة الاحتياطية المرفوع');
      }
    } else if (body && body.filename) {
      const { filePath } = await this.backupService.getBackupFile(body.filename, user.id, companyId);
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      payload = JSON.parse(content);
    } else if (body && body.payload) {
      payload = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload;
    }

    return this.backupService.restoreBackup(companyId, user.id, payload);
  }

  @Delete(':filename')
  @Roles(UserRole.COMPANY_ADMIN)
  async deleteBackup(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
  ) {
    const companyId = user.role === UserRole.SYSTEM_ADMIN ? null : user.companyId;
    return this.backupService.deleteBackup(filename, user.id, companyId);
  }
}
