/**
 * Cloudflare Worker: encaminha www.nextproject.com.br/estadia* para o app no Render.
 * O restante do domínio não é afetado.
 *
 * 1. Troque ORIGIN pela URL do serviço no Render (sem barra no final).
 * 2. Rotas do Worker:  www.nextproject.com.br/estadia*   e   nextproject.com.br/estadia*
 */
const ORIGIN = 'https://estadia.onrender.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, ORIGIN);
    // Mantém método, cabeçalhos (inclui o cookie de sessão) e corpo da requisição.
    const proxied = new Request(target, request);
    const response = await fetch(proxied, { redirect: 'manual' });
    // Redirecionamentos do app usam caminhos relativos, então continuam no domínio público.
    return response;
  },
};
