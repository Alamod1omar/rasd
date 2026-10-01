import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, EntityStatus, getRolePermissions } from '../common/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: any) => {
          return request?.cookies?.['rasd_token'] || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'rasd_jwt_secret_key_production_2026_secured_b2b'),
    });
  }

  async validate(payload: any): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        company: true,
        userBranchAccess: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!user || user.status !== EntityStatus.ACTIVE) {
      throw new UnauthorizedException('المستخدم غير موجود أو تم إيقاف حسابه');
    }

    if (user.companyId && user.company && user.company.status !== EntityStatus.ACTIVE) {
      throw new UnauthorizedException('تم إيقاف حساب الشركة، يرجى التواصل مع الإدارة');
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

    return {
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
  }
}
