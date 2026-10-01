import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { AuthUser, EntityStatus, UserRole, getRolePermissions } from '../common/types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: loginDto.username.trim() },
      include: {
        company: true,
        userBranchAccess: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    if (user.status !== EntityStatus.ACTIVE) {
      throw new UnauthorizedException('تم إيقاف هذا الحساب، يرجى مراجعة المسؤول');
    }

    if (user.companyId && user.company && user.company.status !== EntityStatus.ACTIVE) {
      throw new UnauthorizedException('تم إيقاف حساب الشركة المرتبطة');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    const branches = user.userBranchAccess
      .filter((uba) => uba.branch.status === EntityStatus.ACTIVE)
      .map((uba) => ({
        id: uba.branch.id,
        name: uba.branch.name,
        code: uba.branch.code,
      }));

    const branchIds = branches.map((b) => b.id);
    const currentBranchId = branchIds.length > 0 ? branchIds[0] : null;

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as any,
      permissions: getRolePermissions(user.role as any),
      companyId: user.companyId,
      companyName: user.company?.name || null,
      companyLogo: user.company?.logo || null,
      branchIds,
      branches,
      currentBranchId,
    };

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user: authUser,
      accessToken,
    };
  }

  async getMe(user: AuthUser) {
    return user;
  }
}
