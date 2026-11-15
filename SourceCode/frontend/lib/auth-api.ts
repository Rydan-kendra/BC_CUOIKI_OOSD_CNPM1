import { keycloak, khoiTaoKeycloak } from "./keycloak";

export async function layAccessToken(): Promise<string> {
  const daDangNhap = await khoiTaoKeycloak();

  if (!daDangNhap || !keycloak.authenticated) {
    throw new Error("Bạn cần đăng nhập để thực hiện chức năng này.");
  }

  try {
    await keycloak.updateToken(30);
  } catch {
    throw new Error(
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    );
  }

  if (!keycloak.token) {
    throw new Error("Không tìm thấy access token.");
  }

  return keycloak.token;
}
