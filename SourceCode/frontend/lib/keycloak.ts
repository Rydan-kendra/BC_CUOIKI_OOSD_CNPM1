import Keycloak from "keycloak-js";

export const keycloak = new Keycloak({
  url: "http://localhost:8080",
  realm: "quan-ly-ca-truc",
  clientId: "quan-ly-ca-truc-frontend",
});

let khoiTao: Promise<boolean> | null = null;

export function khoiTaoKeycloak(): Promise<boolean> {
  if (!khoiTao) {
    khoiTao = keycloak
      .init({
        onLoad: "check-sso",
        pkceMethod: "S256",
        checkLoginIframe: false,
      })
      .catch((error) => {
        khoiTao = null;
        throw error;
      });
  }

  return khoiTao;
}
