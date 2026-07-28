import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/",
  },
});

export const config = {
  matcher: [
    "/empresas/:path*",
    "/cadastro-empresa/:path*",
    "/documentos/:path*",
    "/preenchimento-documentos/:path*",
    "/apuracao/:path*",
  ],
};
