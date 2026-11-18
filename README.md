# Estadia — aluguel de temporada (MVP, sem pagamentos)

Plataforma no estilo marketplace de hospedagem: anfitriões anunciam espaços, hóspedes buscam, reservam,
conversam com o anfitrião e avaliam a estadia. Um administrador acompanha todas as reservas e valores.
**O pagamento ainda não está implementado** — a reserva mostra o valor total, mas nada é cobrado.

- **Site:** GitHub Pages (pasta [`docs/`](docs)) — HTML, CSS e JavaScript puro, sem build.
- **Dados e login:** [Supabase](https://supabase.com) (Postgres + Auth + Storage), plano gratuito.
- **Regras de negócio e segurança** ficam no banco ([`supabase/schema.sql`](supabase/schema.sql)):
  datas sobrepostas, quem confirma, quem vê o endereço, quem avalia etc. — o site é público e o navegador
  não é confiável.

## Contas para simular a locação

| Login    | Papel |
|----------|-------|
| `jacson` | **Administrador** e dono de 4 imóveis (Búzios, Gramado, Florianópolis, Itaipava). Vê todas as reservas, valores, anúncios e usuários em **🛡️ Administração** e as próprias locações no **Painel do anfitrião**. |
| `jana`   | **Hóspede**: busca, reserva, conversa com o anfitrião e avalia. Começa sem reservas. |

Outras contas de exemplo: `ana`, `carlos` (anfitriões), `marina`, `joao` (hóspedes).
As senhas **não estão no repositório**: são definidas por você ao rodar o `seed.sql`.
O login aceita o nome de usuário ou o e-mail.

Roteiro: entre como **jana**, reserve *Casa pé na areia em Búzios* ou *Casa de vidro na serra de Itaipava*
(exigem aprovação) → saia, entre como **jacson** e confirme em Administração ou no Painel do anfitrião →
volte como **jana** e veja a reserva confirmada com o endereço. Como os dados ficam no Supabase, isso
funciona em aparelhos diferentes.

## Como colocar no ar (uma vez)

1. **Supabase** — crie um projeto gratuito em <https://supabase.com/dashboard>.
2. **Banco** — em *SQL Editor*, rode [`supabase/schema.sql`](supabase/schema.sql) inteiro.
3. **Dados de exemplo** — abra [`supabase/seed.sql`](supabase/seed.sql), **troque as três senhas no topo**
   (no próprio editor do Supabase, não no GitHub) e rode.
4. **Cadastro sem confirmação de e-mail** (recomendado para o MVP) — *Authentication → Sign In / Providers →
   Email*: desative **Confirm email**. Assim quem se cadastra no site já entra direto.
5. **Conectar o site** — em *Project Settings → API*, copie a **Project URL** e a chave **anon public** para
   [`docs/config.js`](docs/config.js) e faça commit. (A chave anon é pública por natureza; a proteção está no RLS.)
6. **GitHub Pages** — já configurado: *Settings → Pages → Deploy from a branch → `main` / `/docs`*.
   O site fica em <https://nandomanfredo.github.io/estadia/>.

### Endereço www.nextproject.com.br/estadia (opcional)

O domínio está no Cloudflare. Crie um Worker com o código de
[`deploy/cloudflare-worker.js`](deploy/cloudflare-worker.js) e adicione as rotas
`www.nextproject.com.br/estadia*` e `nextproject.com.br/estadia*`. Só esse caminho é afetado.

## Rodar localmente

```bash
python3 -m http.server 8090 -d docs   # abra http://localhost:8090
```

O site local usa o mesmo Supabase configurado em `docs/config.js`.

## Funcionalidades

**Hóspede** — busca por destino, datas (só mostra o que está livre), hóspedes, tipo, preço e comodidades;
ordenação e mapa; página do anúncio com galeria, calendário de disponibilidade, avaliações e mapa;
reserva imediata ou por solicitação; minhas viagens; cancelamento antes do check-in; chat por reserva;
favoritos; avaliação após a estadia; endereço exato só após a confirmação.

**Anfitrião** — painel com métricas, solicitações (confirmar/recusar), próximas estadias e histórico;
criar/editar anúncio com fotos (upload no Supabase Storage), mapa, comodidades, preço, taxa de limpeza e
reserva imediata; pausar/ativar e excluir (bloqueado se houver reservas).

**Administração** (`jacson`) — volume pendente, confirmado e concluído, noites vendidas; todas as reservas
com anfitrião, hóspede, período e valores (com filtros e ações); faturamento por anúncio; por usuário,
quanto gastou como hóspede e recebeu como anfitrião.

## Estrutura

```
docs/                 site publicado no GitHub Pages
  index.html          página única
  app.js              telas e navegação (SPA com rotas por #)
  backend.js          acesso ao Supabase (mesmas "rotas" que a interface usa)
  config.js           URL e chave anon do Supabase
  styles.css
supabase/
  schema.sql          tabelas, RLS, funções (reservar, confirmar, avaliar...), storage
  seed.sql            dados de demonstração (gerado)
scripts/
  gen_seed_sql.py     gera o seed.sql
deploy/
  cloudflare-worker.js  encaminha nextproject.com.br/estadia para o GitHub Pages
```

## Próximos passos sugeridos
- **Pagamentos** (ex.: Stripe ou Mercado Pago) com status `awaiting_payment` antes de `confirmed`
- Notificações por e-mail, bloqueio manual de datas pelo anfitrião, preço por temporada

> Fotos de exemplo: picsum.photos (imagens aleatórias). Mapas: OpenStreetMap.
