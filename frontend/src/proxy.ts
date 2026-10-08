import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // Permitir que localhost e domínios base passem normalmente
  const currentHost =
    process.env.NODE_ENV === 'production' && process.env.VERCEL === '1'
      ? hostname
          .replace(`.blmservicos.com.br`, '') // Troque para o domínio real se for diferente
          .replace(`.vercel.app`, '')
      : hostname.replace(`.localhost:3000`, '');

  // Se não tem subdomínio ou é 'www', 'painel' (o painel de vocês), ignoramos o alias
  if (
    currentHost === 'localhost:3000' || 
    currentHost === 'blmservicos.com.br' || 
    currentHost === 'www' || 
    currentHost === 'painel' ||
    currentHost === hostname
  ) {
    return NextResponse.next();
  }

  // A esse ponto, currentHost é o alias da loja (ex: loja-123456789)
  // Se for a página inicial do subdomínio, redirecionamos internamente para /[alias]
  if (url.pathname === '/') {
    url.pathname = `/${currentHost}`;
    return NextResponse.rewrite(url);
  }

  // Para qualquer outra rota dentro do subdomínio, injetamos o alias silenciosamente
  // Exceto para a rota /p (que já é global para devedores e não deve quebrar)
  if (!url.pathname.startsWith('/p')) {
      url.pathname = `/${currentHost}${url.pathname}`;
      return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Faz o match em tudo, exceto:
     * - api (rotas de API do next)
     * - _next/static (arquivos estáticos)
     * - _next/image (arquivos de imagem otimizada)
     * - favicon.ico (favicon)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
