import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const issuer = 'http://localhost:8080/realms/quan-ly-ca-truc';
const clientId = 'quan-ly-ca-truc-frontend';

const jwks = createRemoteJWKSet(
  new URL(`${issuer}/protocol/openid-connect/certs`),
);

@Injectable()
export class QuanLyGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
    }>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Bạn cần đăng nhập để thực hiện chức năng này',
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Access token không hợp lệ');
    }

    let payload;

    try {
      const verified = await jwtVerify(token, jwks, {
        issuer,
        algorithms: ['RS256'],
      });

      payload = verified.payload;
    } catch {
      throw new UnauthorizedException(
        'Access token không hợp lệ hoặc đã hết hạn',
      );
    }

    if (payload.azp !== clientId || !payload.sub) {
      throw new UnauthorizedException(
        'Token không thuộc ứng dụng hoặc thiếu định danh',
      );
    }

    const realmAccess = payload.realm_access as
      | { roles?: string[] }
      | undefined;

    const roles = realmAccess?.roles ?? [];

    if (!roles.includes('QuanLy')) {
      throw new ForbiddenException(
        'Chỉ tài khoản Quản lý mới được thực hiện chức năng này',
      );
    }

    const rows: Array<{
      maTaiKhoan: string;
      nhomQuyen: string;
      trangThai: string;
    }> = await this.dataSource.query(
      `
      SELECT TOP (1)
        maTaiKhoan,
        nhomQuyen,
        trangThai
      FROM TaiKhoan
      WHERE oidcSubject = @0
      `,
      [payload.sub],
    );

    const taiKhoan = rows[0];

    if (
      !taiKhoan ||
      taiKhoan.nhomQuyen !== 'QuanLy' ||
      taiKhoan.trangThai !== 'HoatDong'
    ) {
      throw new ForbiddenException(
        'Tài khoản không có quyền quản lý trong hệ thống',
      );
    }

    return true;
  }
}
