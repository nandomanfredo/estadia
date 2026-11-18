# Estadia — aluguel de temporada (sem pagamentos)

Plataforma no estilo marketplace de hospedagem: anfitriões anunciam espaços, hóspedes buscam, reservam,
conversam com o anfitrião e avaliam a estadia. **O pagamento ainda não está implementado** — a reserva
mostra o valor total, mas nada é cobrado.

## Como rodar

Precisa só do Python 3.8+ (já vem no macOS). Nenhuma dependência para instalar.

```bash
python3 seed.py      # cria o banco com dados de exemplo (apaga o anterior)
python3 server.py    # inicia em http://localhost:8000
```

Use `PORT=3000 python3 server.py` para mudar a porta.

### Configuração (variáveis de ambiente)

| Variável        | Padrão      | Para que serve |
|-----------------|-------------|----------------|
| `PORT`          | `8000`      | Porta HTTP |
| `HOST`          | `127.0.0.1` | Use `0.0.0.0` em servidor/contêiner |
| `BASE_PATH`     | *(vazio)*   | Subcaminho do site, ex.: `/estadia` → `dominio.com/estadia/` |
| `COOKIE_SECURE` | *(vazio)*   | `1` quando o site estiver em HTTPS |
| `ESTADIA_DB`    | `data/estadia.db` | Caminho do banco SQLite |

Exemplo, simulando o endereço final `www.nextproject.com.br/estadia`:

```bash
BASE_PATH=/estadia python3 server.py   # abra http://localhost:8000/estadia/
```

### Contas para simular a locação

| Login    | Senha    | Papel |
|----------|----------|-------|
| `jacson` | `jacson` | **Administrador** e dono de 4 imóveis (Búzios, Gramado, Florianópolis, Itaipava). Vê todas as reservas, valores, anúncios e usuários em **🛡️ Administração**, e as próprias locações no **Painel do anfitrião**. Pode confirmar/recusar qualquer reserva. |
| `jana`   | `jana`   | **Hóspede**: busca, reserva, conversa com o anfitrião e avalia. Começa sem reservas. |

Roteiro sugerido: entre como **jana**, reserve *Casa pé na areia em Búzios* ou *Casa de vidro na serra
de Itaipava* (exigem aprovação). Saia, entre como **jacson** e confirme a solicitação em
Administração ou no Painel do anfitrião. Volte como **jana** para ver a reserva confirmada e o endereço.

Outras contas de exemplo (senha `senha123`): `ana`, `carlos`, `marina`, `joao`.
O login aceita o nome de usuário ou o e-mail.

## Funcionalidades

**Hóspede**
- Busca por destino, datas (só mostra o que está livre), nº de hóspedes, tipo de imóvel, faixa de preço e comodidades
- Ordenação (recentes, preço, avaliação) e visualização em **mapa** com preços
- Página do anúncio: galeria com lightbox, comodidades, calendário de disponibilidade, avaliações, mapa e anfitrião
- Reserva imediata ou solicitação de reserva (o anfitrião aprova); cálculo de noites + taxa de limpeza
- Minhas viagens (próximas, pendentes, anteriores, canceladas), cancelamento antes do check-in
- Chat por reserva, caixa de mensagens, favoritos, avaliação (1–5 ★) após a estadia
- Endereço exato só aparece após a reserva ser confirmada

**Anfitrião**
- Painel com métricas, solicitações (confirmar/recusar), próximas estadias e histórico
- Criar/editar anúncio: fotos (upload com redimensionamento ou link), capa, localização no mapa,
  comodidades, preço, taxa de limpeza, reserva imediata
- Pausar/ativar e excluir anúncios (exclusão bloqueada se já houver reservas)

**Administração** (`jacson`)
- Painel com volume pendente, confirmado, concluído, noites vendidas, usuários e anúncios
- Todas as reservas com anfitrião, hóspede, período, diária, limpeza, total e status (com filtros), com ação de confirmar/recusar
- Faturamento por anúncio e, por usuário, quanto gastou como hóspede e recebeu como anfitrião
- Acesso ao detalhe e às mensagens de qualquer reserva

**Conta**
- Cadastro, login (senha com PBKDF2 + sal; sessão em cookie HttpOnly), perfil com foto e bio, perfil público

## Estrutura

```
server.py        API JSON + servidor de arquivos estáticos (biblioteca padrão)
db.py            esquema SQLite, tipos de imóvel, comodidades, hash de senha
seed.py          dados de exemplo
public/          frontend (index.html, app.js, styles.css) — SPA em JS puro
data/            banco SQLite (gerado)
uploads/         fotos enviadas (gerado)
```

### API principal

| Método | Rota                                  | Descrição                         |
|--------|---------------------------------------|-----------------------------------|
| POST   | /api/auth/register, /login, /logout   | Autenticação                      |
| GET    | /api/listings?q=&check_in=&check_out=&guests=&type=&min_price=&max_price=&amenities=&sort= | Busca |
| GET/POST/PUT/DELETE | /api/listings[/:id]      | Anúncios                          |
| POST   | /api/bookings                         | Criar reserva                     |
| POST   | /api/bookings/:id/confirm, /decline, /cancel | Mudar status               |
| GET/POST | /api/bookings/:id, /:id/messages, /:id/review | Detalhe, chat, avaliação  |
| GET    | /api/host/listings, /api/host/bookings | Painel do anfitrião              |
| GET/POST/DELETE | /api/favorites[/:id]         | Favoritos                         |

## Publicação em www.nextproject.com.br/estadia

O app precisa de um servidor que rode Python (não funciona em hospedagem estática como GitHub Pages).
Qualquer opção serve, desde que as requisições para `/estadia` cheguem a ele:

- **VPS própria (Linux):** rode `HOST=127.0.0.1 PORT=8000 BASE_PATH=/estadia COOKIE_SECURE=1 python3 server.py`
  como serviço (systemd) e, no Nginx do domínio, adicione:
  ```nginx
  location /estadia {
      proxy_pass http://127.0.0.1:8000;
      proxy_set_header Host $host;
  }
  ```
- **Render (configurado):** o arquivo [`render.yaml`](render.yaml) cria o serviço sozinho
  (New → Blueprint → este repositório). As senhas de `jacson` e `jana` são pedidas no painel
  (`ADMIN_PASSWORD`, `GUEST_PASSWORD`) e não ficam no código. No plano gratuito, os dados voltam à
  demonstração a cada reinício; para guardar dados, use o plano Starter com o disco indicado no arquivo.
- **Domínio:** o Worker em [`deploy/cloudflare-worker.js`](deploy/cloudflare-worker.js) encaminha
  `www.nextproject.com.br/estadia*` para o Render, sem afetar o resto do domínio.

> ⚠️ As senhas padrão (`jacson`, `jana`, `senha123`) só valem localmente. Em produção use `ADMIN_PASSWORD`,
> `GUEST_PASSWORD` e `DEMO_PASSWORD` — o repositório é público.

## Próximos passos sugeridos
- **Pagamentos** (ex.: Stripe ou Mercado Pago): adicionar status `awaiting_payment` entre a criação/confirmação e `confirmed`
- Notificações por e-mail, bloqueio manual de datas pelo anfitrião, preço por temporada
- Migrar para um framework (ex.: FastAPI/Django ou Next.js) e Postgres quando for para produção

> As fotos de exemplo vêm do picsum.photos (imagens aleatórias) e os mapas do OpenStreetMap — ambos precisam de internet.
