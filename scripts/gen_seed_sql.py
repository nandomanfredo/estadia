#!/usr/bin/env python3
"""Gera supabase/seed.sql com os dados de demonstração.  Uso:  python3 scripts/gen_seed_sql.py

O SQL gerado não contém senhas: elas são preenchidas no topo do arquivo,
no SQL Editor do Supabase, na hora de rodar.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "supabase", "seed.sql")

# (nome, usuário, e-mail, variável de senha, admin, bio)
USERS = [
    ("Ana Souza", "ana", "ana@exemplo.com", "demo_password", False,
     "Arquiteta apaixonada por receber bem. Moro no Rio e cuido de casas no litoral."),
    ("Carlos Lima", "carlos", "carlos@exemplo.com", "demo_password", False,
     "Serrano de coração, adoro indicar trilhas e restaurantes para os hóspedes."),
    ("Marina Costa", "marina", "marina@exemplo.com", "demo_password", False,
     "Viajante, fotógrafa e fã de café da manhã caprichado."),
    ("João Pereira", "joao", "joao@exemplo.com", "demo_password", False,
     "Trabalho remoto e procuro lugares com bom Wi-Fi e vista bonita."),
    ("Jacson", "jacson", "jacson@exemplo.com", "admin_password", True,
     "Administrador do Estadia e anfitrião de casas no litoral e na serra."),
    ("Jana", "jana", "jana@exemplo.com", "guest_password", False,
     "Adoro viajar com a família e descobrir lugares novos pelo Brasil."),
]
ANA, CARLOS, MARINA, JOAO, JACSON, JANA = range(6)

# (anfitrião, título, tipo, cidade, UF, lat, lng, diária, limpeza, hóspedes, quartos, camas, banheiros,
#  comodidades, reserva imediata, descrição)
LISTINGS = [
    (ANA, "Apartamento com vista para o Pão de Açúcar", "Apartamento", "Rio de Janeiro", "RJ", -22.9519, -43.1806, 420, 120, 4, 2, 2, 1,
     ["Wi-Fi", "Cozinha", "Ar-condicionado", "TV", "Vista para o mar", "Espaço de trabalho"], True,
     "Apartamento claro e ventilado em Botafogo, a poucos passos do metrô. Varanda com vista para o Pão de Açúcar, cozinha completa e uma mesa ótima para trabalhar."),
    (JACSON, "Casa pé na areia em Búzios", "Casa", "Armação dos Búzios", "RJ", -22.7469, -41.8817, 890, 250, 8, 4, 5, 3,
     ["Wi-Fi", "Cozinha", "Piscina", "Churrasqueira", "Vista para o mar", "Estacionamento gratuito", "Ar-condicionado"], False,
     "Casa ampla com piscina e acesso direto à praia de Geribá. Perfeita para famílias e grupos de amigos."),
    (JACSON, "Chalé com lareira em Gramado", "Chalé", "Gramado", "RS", -29.3788, -50.8736, 560, 150, 2, 1, 1, 1,
     ["Wi-Fi", "Lareira", "Hidromassagem", "Café da manhã", "Estacionamento gratuito"], True,
     "Chalé romântico no meio do verde, a 5 minutos da Rua Coberta. Lareira, banheira de hidromassagem e café colonial."),
    (CARLOS, "Cabana na mata em Campos do Jordão", "Cabana", "Campos do Jordão", "SP", -22.7394, -45.5914, 480, 100, 4, 2, 3, 1,
     ["Lareira", "Cozinha", "Aceita animais", "Churrasqueira", "Estacionamento gratuito"], False,
     "Cabana rústica e aconchegante rodeada de araucárias. Ideal para desconectar — e seu pet é bem-vindo."),
    (ANA, "Loft moderno na Vila Madalena", "Loft", "São Paulo", "SP", -23.5568, -46.6912, 310, 80, 2, 1, 1, 1,
     ["Wi-Fi", "Ar-condicionado", "Espaço de trabalho", "TV", "Máquina de lavar", "Academia"], True,
     "Loft com pé-direito duplo no coração da Vila Madalena, perto de bares, galerias e do metrô."),
    (CARLOS, "Pousada charmosa no centro histórico de Paraty", "Pousada", "Paraty", "RJ", -23.2178, -44.7131, 380, 0, 3, 1, 2, 1,
     ["Wi-Fi", "Café da manhã", "Ar-condicionado", "Piscina"], False,
     "Quarto em casarão colonial restaurado, com café da manhã servido no jardim. Tudo a pé no centro histórico."),
    (JACSON, "Casa com piscina em Florianópolis", "Casa", "Florianópolis", "SC", -27.6028, -48.4596, 650, 200, 6, 3, 4, 2,
     ["Wi-Fi", "Cozinha", "Piscina", "Churrasqueira", "Estacionamento gratuito", "Máquina de lavar"], True,
     "Casa na Lagoa da Conceição, com piscina e deck. A 10 minutos das praias Mole e Joaquina."),
    (CARLOS, "Quarto aconchegante em Ouro Preto", "Quarto", "Ouro Preto", "MG", -20.3856, -43.5035, 150, 0, 2, 1, 1, 1,
     ["Wi-Fi", "Café da manhã"], True,
     "Quarto privativo em casa de família, com vista para as igrejas barrocas. Café mineiro incluso."),
    (ANA, "Bangalô frente ao mar em Jericoacoara", "Casa", "Jijoca de Jericoacoara", "CE", -2.7956, -40.5137, 720, 180, 4, 2, 2, 2,
     ["Wi-Fi", "Ar-condicionado", "Vista para o mar", "Café da manhã", "Cozinha"], False,
     "Bangalô a poucos metros da Duna do Pôr do Sol. Redes na varanda e brisa o dia inteiro."),
    (CARLOS, "Sítio com cachoeira em Bonito", "Sítio", "Bonito", "MS", -21.1261, -56.4836, 540, 150, 10, 4, 6, 3,
     ["Cozinha", "Churrasqueira", "Aceita animais", "Estacionamento gratuito", "Piscina"], False,
     "Sítio com cachoeira particular, pomar e muito espaço. Base perfeita para os passeios de flutuação."),
    (ANA, "Apartamento no Pelourinho", "Apartamento", "Salvador", "BA", -12.9714, -38.5108, 260, 60, 3, 1, 2, 1,
     ["Wi-Fi", "Ar-condicionado", "TV", "Cozinha"], True,
     "Apartamento colorido em prédio histórico, no meio da cultura e da música do Pelourinho."),
    (JACSON, "Casa de vidro na serra de Itaipava", "Casa", "Petrópolis", "RJ", -22.3833, -43.1333, 990, 300, 6, 3, 3, 3,
     ["Wi-Fi", "Lareira", "Hidromassagem", "Piscina", "Cozinha", "Espaço de trabalho", "Estacionamento gratuito"], False,
     "Projeto contemporâneo com paredes de vidro e vista para as montanhas. Uma experiência única na serra."),
]

REVIEW_TEXTS = [
    (5, "Lugar incrível, exatamente como nas fotos. Anfitrião super atencioso!"),
    (5, "Voltaria com certeza. Limpo, confortável e muito bem localizado."),
    (4, "Ótima estadia. Só achei o chuveiro um pouco fraco, mas nada que atrapalhe."),
    (5, "Melhor hospedagem que já tive. Cada detalhe pensado com carinho."),
    (4, "Muito bom custo-benefício, recomendo."),
]


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def arr(items):
    return "array[" + ", ".join(q(i) for i in items) + "]::text[]"


def main():
    out = []
    w = out.append
    w("""-- =====================================================================
-- Estadia — dados de demonstração (gerado por scripts/gen_seed_sql.py)
--
-- 1. Rode antes o supabase/schema.sql.
-- 2. TROQUE AS TRÊS SENHAS logo abaixo (o repositório é público!).
-- 3. Rode este arquivo no SQL Editor do Supabase.
--
-- Rodar de novo recria os dados de demonstração do zero (apaga os
-- usuários de exemplo e tudo ligado a eles; contas criadas no site ficam).
-- =====================================================================
do $seed$
declare
  admin_password text := 'TROQUE-A-SENHA-DO-JACSON';  -- login: jacson
  guest_password text := 'TROQUE-A-SENHA-DA-JANA';    -- login: jana
  demo_password  text := 'TROQUE-A-SENHA-DEMO';       -- logins: ana, carlos, marina, joao

  u uuid[] := array[]::uuid[];
  lid bigint[] := array[]::bigint[];
  bid bigint;
  new_id uuid;
begin
  if admin_password like 'TROQUE%%' or guest_password like 'TROQUE%%' or demo_password like 'TROQUE%%' then
    raise exception 'Defina as três senhas no topo do script antes de rodar.';
  end if;

  delete from auth.users where email in (%s);
""" % ", ".join(q(e) for _, _, e, _, _, _ in USERS))

    for i, (name, username, email, pw_var, is_admin, bio) in enumerate(USERS):
        w("""
  -- %(name)s
  new_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', %(email)s,
          extensions.crypt(%(pw)s, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('name', %(nameq)s),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text,
          jsonb_build_object('sub', new_id::text, 'email', %(email)s, 'email_verified', true),
          'email', now(), now(), now());
  update public.profiles set username = %(username)s, is_admin = %(admin)s, bio = %(bio)s,
         avatar = %(avatar)s, created_at = now() - interval '%(age)d days'
   where id = new_id;
  u := u || new_id;""" % {
            "name": name, "nameq": q(name), "email": q(email), "pw": pw_var, "username": q(username),
            "admin": "true" if is_admin else "false", "bio": q(bio),
            "avatar": q("https://i.pravatar.cc/200?u=" + email), "age": 900 - i * 120})

    w("\n\n  -- Anúncios")
    for i, (host, title, ptype, city, state, lat, lng, price, cleaning, guests, bedrooms, beds, baths,
            amenities, instant, desc) in enumerate(LISTINGS):
        photos = ["https://picsum.photos/seed/estadia-%d-%d/1200/800" % (i, n) for n in range(5)]
        w("""
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[%d], %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now() - interval '%d days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, %s);
  lid := lid || bid;""" % (
            host + 1, q(title), q(desc), q(ptype), q(city), q(state), lat, lng, price, cleaning, guests,
            bedrooms, beds, baths, arr(amenities), arr(photos), "true" if instant else "false",
            200 - i * 10, q("Rua Exemplo, %d — %s" % (100 + i * 7, city))))

    def book(listing_idx, guest, start, nights, status, guests=2, msgs=(), review=None):
        price, cleaning = LISTINGS[listing_idx][7], LISTINGS[listing_idx][8]
        s = """
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[%d], u[%d], public.today_br() + %d, public.today_br() + %d, %d, %d, %s, %s, %s, %s)
  returning id into bid;""" % (listing_idx + 1, guest + 1, start, start + nights, guests, nights,
                                price, cleaning, nights * price + cleaning, q(status))
        for sender, body in msgs:
            s += "\n  insert into public.messages (booking_id, sender_id, body) values (bid, u[%d], %s);" % (
                sender + 1, q(body))
        if review:
            s += ("\n  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)"
                  "\n  values (bid, lid[%d], u[%d], %d, %s, now() - interval '%d days');"
                  % (listing_idx + 1, guest + 1, review[0], q(review[1]), max(0, -(start + nights))))
        w(s)

    w("\n\n  -- Estadias passadas, com avaliações")
    r = 0
    for idx in range(len(LISTINGS)):
        # Mesma regra do seed original (ids 3 = Marina, 4 = João no SQLite).
        for guest, guest_n, offset in ((MARINA, 3, -120 + idx * 3), (JOAO, 4, -60 + idx * 2)):
            if (idx + guest_n) % 3 == 0:
                continue
            book(idx, guest, offset, 3, "confirmed", review=REVIEW_TEXTS[r % len(REVIEW_TEXTS)])
            r += 1

    w("\n\n  -- Estadia concluída sem avaliação (para testar o formulário)")
    book(4, MARINA, -10, 2, "confirmed")

    w("\n\n  -- Reservas futuras")
    book(0, MARINA, 14, 4, "confirmed", msgs=[
        (MARINA, "Oi Ana! Chegaremos por volta das 15h. Tem lugar para deixar as malas antes?"),
        (ANA, "Oi Marina! Claro, pode deixar com o porteiro a partir das 10h. Boa viagem!")])
    book(1, JOAO, 25, 5, "pending", guests=6, msgs=[
        (JOAO, "Olá! Somos 6 amigos comemorando um aniversário. Tudo bem?")])
    book(3, MARINA, 30, 3, "pending", msgs=[
        (MARINA, "Vamos levar nossa cachorrinha, ela é pequena e bem tranquila.")])
    book(2, JOAO, 40, 3, "confirmed")
    book(6, JOAO, 8, 2, "cancelled")

    w("""

  raise notice 'Dados de demonstração criados: % usuários, % anúncios.', cardinality(u), cardinality(lid);
end
$seed$;
""")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("".join(out))
    print("Gerado:", OUT)


if __name__ == "__main__":
    main()
