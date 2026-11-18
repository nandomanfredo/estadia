/**
 * Cloudflare Worker (opcional): faz www.nextproject.com.br/estadia mostrar o site do GitHub Pages.
 * O restante do domínio não é afetado.
 *
 * Rotas do Worker:  www.nextproject.com.br/estadia*   e   nextproject.com.br/estadia*
 */
const ORIGIN = 'https://nandomanfredo.github.io'; // o site está em /estadia/ lá também

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // /estadia (sem barra) -> /estadia/ para os caminhos relativos funcionarem
    if (url.pathname === '/estadia') {
      return Response.redirect(url.origin + '/estadia/' + url.search, 301);
    }
    const target = new URL(url.pathname + url.search, ORIGIN);
    const response = await fetch(new Request(target, request), { redirect: 'manual' });
    return response;
  },
};
