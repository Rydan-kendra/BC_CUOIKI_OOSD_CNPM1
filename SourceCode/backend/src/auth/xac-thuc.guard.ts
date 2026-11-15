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
export class XacThucGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
    }>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Bạn cần đăng nhập để truy cập chức năng này',
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

    const roles = Array.isArray(realmAccess?.roles)
      ? realmAccess.roles
      : [];

    const rows: Array<{
      maTaiKhoan: string;
      maNhanSu: string;
      nhomQuyen: string;
      trangThai: string;
    }> = await this.dataSource.query(
      `
      SELECT TOP (1)
        maTaiKhoan,
        maNhanSu,
        nhomQuyen,
        trangThai
      FROM TaiKhoan
      WHERE oidcSubject = @0
      `,
      [payload.sub],
    );

    const taiKhoan = rows[0];

    if (!taiKhoan || taiKhoan.trangThai !== 'HoatDong') {
      throw new ForbiddenException(
        'Tài khoản chưa được cấp quyền hoặc đã bị vô hiệu hóa',
      );
    }

    if (
      !['NhanVien', 'QuanLy'].includes(taiKhoan.nhomQuyen) ||
      !roles.includes(taiKhoan.nhomQuyen)
    ) {
      throw new ForbiddenException(
        'Vai trò Keycloak không khớp quyền tài khoản trong hệ thống',
      );
    }

    return true;
  }
}
