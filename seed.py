#!/usr/bin/env python3
"""Recria o banco com dados de exemplo.  Uso:  python3 seed.py

Contas principais para simular a locação (login = senha):
  jacson / jacson   administrador e dono de imóveis (vê todas as reservas)
  jana   / jana     hóspede (busca e reserva)

Outras contas de demonstração (senha: senha123): ana, carlos, marina, joao
"""
import datetime
import json
import os

import db

# Em produção, defina as senhas por variável de ambiente (o repositório é público).
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "senha123")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "jacson")
GUEST_PASSWORD = os.environ.get("GUEST_PASSWORD", "jana")

# (nome, usuário, e-mail, senha, admin, bio)
USERS = [
    ("Ana Souza", "ana", "ana@exemplo.com", DEMO_PASSWORD, False,
     "Arquiteta apaixonada por receber bem. Moro no Rio e cuido de casas no litoral."),
    ("Carlos Lima", "carlos", "carlos@exemplo.com", DEMO_PASSWORD, False,
     "Serrano de coração, adoro indicar trilhas e restaurantes para os hóspedes."),
    ("Marina Costa", "marina", "marina@exemplo.com", DEMO_PASSWORD, False,
     "Viajante, fotógrafa e fã de café da manhã caprichado."),
    ("João Pereira", "joao", "joao@exemplo.com", DEMO_PASSWORD, False,
     "Trabalho remoto e procuro lugares com bom Wi-Fi e vista bonita."),
    ("Jacson", "jacson", "jacson@exemplo.com", ADMIN_PASSWORD, True,
     "Administrador do Estadia e anfitrião de casas no litoral e na serra."),
    ("Jana", "jana", "jana@exemplo.com", GUEST_PASSWORD, False,
     "Adoro viajar com a família e descobrir lugares novos pelo Brasil."),
]
JACSON = 4

# (host_idx, title, type, city, state, lat, lng, price, cleaning, guests, bedrooms, beds, baths, amenities, instant, description)
LISTINGS = [
    (0, "Apartamento com vista para o Pão de Açúcar", "Apartamento", "Rio de Janeiro", "RJ", -22.9519, -43.1806, 420, 120, 4, 2, 2, 1,
     ["Wi-Fi", "Cozinha", "Ar-condicionado", "TV", "Vista para o mar", "Espaço de trabalho"], True,
     "Apartamento claro e ventilado em Botafogo, a poucos passos do metrô. Varanda com vista para o Pão de Açúcar, cozinha completa e uma mesa ótima para trabalhar."),
    (JACSON, "Casa pé na areia em Búzios", "Casa", "Armação dos Búzios", "RJ", -22.7469, -41.8817, 890, 250, 8, 4, 5, 3,
     ["Wi-Fi", "Cozinha", "Piscina", "Churrasqueira", "Vista para o mar", "Estacionamento gratuito", "Ar-condicionado"], False,
     "Casa ampla com piscina e acesso direto à praia de Geribá. Perfeita para famílias e grupos de amigos."),
    (JACSON, "Chalé com lareira em Gramado", "Chalé", "Gramado", "RS", -29.3788, -50.8736, 560, 150, 2, 1, 1, 1,
     ["Wi-Fi", "Lareira", "Hidromassagem", "Café da manhã", "Estacionamento gratuito"], True,
     "Chalé romântico no meio do verde, a 5 minutos da Rua Coberta. Lareira, banheira de hidromassagem e café colonial."),
    (1, "Cabana na mata em Campos do Jordão", "Cabana", "Campos do Jordão", "SP", -22.7394, -45.5914, 480, 100, 4, 2, 3, 1,
     ["Lareira", "Cozinha", "Aceita animais", "Churrasqueira", "Estacionamento gratuito"], False,
     "Cabana rústica e aconchegante rodeada de araucárias. Ideal para desconectar — e seu pet é bem-vindo."),
    (0, "Loft moderno na Vila Madalena", "Loft", "São Paulo", "SP", -23.5568, -46.6912, 310, 80, 2, 1, 1, 1,
     ["Wi-Fi", "Ar-condicionado", "Espaço de trabalho", "TV", "Máquina de lavar", "Academia"], True,
     "Loft com pé-direito duplo no coração da Vila Madalena, perto de bares, galerias e do metrô."),
    (1, "Pousada charmosa no centro histórico de Paraty", "Pousada", "Paraty", "RJ", -23.2178, -44.7131, 380, 0, 3, 1, 2, 1,
     ["Wi-Fi", "Café da manhã", "Ar-condicionado", "Piscina"], False,
     "Quarto em casarão colonial restaurado, com café da manhã servido no jardim. Tudo a pé no centro histórico."),
    (JACSON, "Casa com piscina em Florianópolis", "Casa", "Florianópolis", "SC", -27.6028, -48.4596, 650, 200, 6, 3, 4, 2,
     ["Wi-Fi", "Cozinha", "Piscina", "Churrasqueira", "Estacionamento gratuito", "Máquina de lavar"], True,
     "Casa na Lagoa da Conceição, com piscina e deck. A 10 minutos das praias Mole e Joaquina."),
    (1, "Quarto aconchegante em Ouro Preto", "Quarto", "Ouro Preto", "MG", -20.3856, -43.5035, 150, 0, 2, 1, 1, 1,
     ["Wi-Fi", "Café da manhã"], True,
     "Quarto privativo em casa de família, com vista para as igrejas barrocas. Café mineiro incluso."),
    (0, "Bangalô frente ao mar em Jericoacoara", "Casa", "Jijoca de Jericoacoara", "CE", -2.7956, -40.5137, 720, 180, 4, 2, 2, 2,
     ["Wi-Fi", "Ar-condicionado", "Vista para o mar", "Café da manhã", "Cozinha"], False,
     "Bangalô a poucos metros da Duna do Pôr do Sol. Redes na varanda e brisa o dia inteiro."),
    (1, "Sítio com cachoeira em Bonito", "Sítio", "Bonito", "MS", -21.1261, -56.4836, 540, 150, 10, 4, 6, 3,
     ["Cozinha", "Churrasqueira", "Aceita animais", "Estacionamento gratuito", "Piscina"], False,
     "Sítio com cachoeira particular, pomar e muito espaço. Base perfeita para os passeios de flutuação."),
    (0, "Apartamento no Pelourinho", "Apartamento", "Salvador", "BA", -12.9714, -38.5108, 260, 60, 3, 1, 2, 1,
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


def photos_for(i):
    return ["https://picsum.photos/seed/estadia-%d-%d/1200/800" % (i, n) for n in range(5)]


def main():
    for suffix in ("", "-wal", "-shm"):
        if os.path.exists(db.DB_PATH + suffix):
            os.remove(db.DB_PATH + suffix)
    db.init_schema()
    conn = db.connect()
    today = datetime.date.today()

    user_ids = []
    for i, (name, username, email, password, is_admin, bio) in enumerate(USERS):
        salt, pw_hash = db.hash_password(password)
        created = (today - datetime.timedelta(days=900 - i * 120)).isoformat() + " 12:00:00"
        cur = conn.execute("INSERT INTO users (name, username, email, password_hash, salt, is_admin, bio, avatar, "
                           "created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                           (name, username, email, pw_hash, salt, int(is_admin), bio,
                            "https://i.pravatar.cc/200?u=" + email, created))
        user_ids.append(cur.lastrowid)

    listing_ids = []
    for i, row in enumerate(LISTINGS):
        (host, title, ptype, city, state, lat, lng, price, cleaning, guests, bedrooms, beds, baths,
         amenities, instant, desc) = row
        cur = conn.execute(
            "INSERT INTO listings (host_id, title, description, property_type, city, state, address, lat, lng, "
            "price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos, instant_book, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (user_ids[host], title, desc, ptype, city, state, "Rua Exemplo, %d — %s" % (100 + i * 7, city),
             lat, lng, price, cleaning, guests, bedrooms, beds, baths,
             json.dumps(amenities, ensure_ascii=False), json.dumps(photos_for(i)), int(instant),
             (today - datetime.timedelta(days=200 - i * 10)).isoformat() + " 10:00:00"))
        listing_ids.append(cur.lastrowid)

    marina, joao = user_ids[2], user_ids[3]

    def book(listing_idx, guest, start_offset, nights, status, guests=2, msg=None, review=None):
        price, cleaning = LISTINGS[listing_idx][7], LISTINGS[listing_idx][8]
        ci = today + datetime.timedelta(days=start_offset)
        co = ci + datetime.timedelta(days=nights)
        cur = conn.execute(
            "INSERT INTO bookings (listing_id, guest_id, check_in, check_out, guests, nights, price_per_night, "
            "cleaning_fee, total_price, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (listing_ids[listing_idx], guest, ci.isoformat(), co.isoformat(), guests, nights,
             price, cleaning, nights * price + cleaning, status))
        bid = cur.lastrowid
        if msg:
            conn.execute("INSERT INTO messages (booking_id, sender_id, body) VALUES (?, ?, ?)", (bid, guest, msg))
        if review:
            conn.execute("INSERT INTO reviews (booking_id, listing_id, author_id, rating, comment, created_at) "
                         "VALUES (?, ?, ?, ?, ?, ?)",
                         (bid, listing_ids[listing_idx], guest, review[0], review[1],
                          co.isoformat() + " 18:00:00"))
        return bid

    # Estadias passadas com avaliações
    r = 0
    for idx in range(len(LISTINGS)):
        for guest, offset in ((marina, -120 + idx * 3), (joao, -60 + idx * 2)):
            if (idx + guest) % 3 == 0:
                continue
            book(idx, guest, offset, 3, "confirmed", review=REVIEW_TEXTS[r % len(REVIEW_TEXTS)])
            r += 1

    # Uma estadia concluída ainda sem avaliação (para testar o formulário)
    book(4, marina, -10, 2, "confirmed")

    # Reservas futuras
    bid = book(0, marina, 14, 4, "confirmed", msg="Oi Ana! Chegaremos por volta das 15h. Tem lugar para deixar as malas antes?")
    conn.execute("INSERT INTO messages (booking_id, sender_id, body) VALUES (?, ?, ?)",
                 (bid, user_ids[0], "Oi Marina! Claro, pode deixar com o porteiro a partir das 10h. Boa viagem!"))
    book(1, joao, 25, 5, "pending", guests=6, msg="Olá! Somos 6 amigos comemorando um aniversário. Tudo bem?")
    book(3, marina, 30, 3, "pending", guests=2, msg="Vamos levar nossa cachorrinha, ela é pequena e bem tranquila.")
    book(2, joao, 40, 3, "confirmed")
    book(6, joao, 8, 2, "cancelled")

    conn.commit()
    conn.close()
    print("Banco recriado em %s" % db.DB_PATH)
    print("%d usuários, %d anúncios." % (len(USERS), len(LISTINGS)))
    if "ADMIN_PASSWORD" in os.environ:
        print("Usuários: jacson (admin) e jana (hóspede), com as senhas definidas no ambiente.")
    else:
        print("Admin/anfitrião: jacson / jacson  ·  Hóspede: jana / jana  ·  Demais contas: senha %s" % DEMO_PASSWORD)


if __name__ == "__main__":
    main()
