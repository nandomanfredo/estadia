-- =====================================================================
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
  if admin_password like 'TROQUE%' or guest_password like 'TROQUE%' or demo_password like 'TROQUE%' then
    raise exception 'Defina as três senhas no topo do script antes de rodar.';
  end if;

  delete from auth.users where email in ('ana@exemplo.com', 'carlos@exemplo.com', 'marina@exemplo.com', 'joao@exemplo.com', 'jacson@exemplo.com', 'jana@exemplo.com');

  -- Ana Souza
  new_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', 'ana@exemplo.com',
          extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('name', 'Ana Souza'),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text,
          jsonb_build_object('sub', new_id::text, 'email', 'ana@exemplo.com', 'email_verified', true),
          'email', now(), now(), now());
  update public.profiles set username = 'ana', is_admin = false, bio = 'Arquiteta apaixonada por receber bem. Moro no Rio e cuido de casas no litoral.',
         avatar = 'https://i.pravatar.cc/200?u=ana@exemplo.com', created_at = now() - interval '900 days'
   where id = new_id;
  u := u || new_id;
  -- Carlos Lima
  new_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', 'carlos@exemplo.com',
          extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('name', 'Carlos Lima'),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text,
          jsonb_build_object('sub', new_id::text, 'email', 'carlos@exemplo.com', 'email_verified', true),
          'email', now(), now(), now());
  update public.profiles set username = 'carlos', is_admin = false, bio = 'Serrano de coração, adoro indicar trilhas e restaurantes para os hóspedes.',
         avatar = 'https://i.pravatar.cc/200?u=carlos@exemplo.com', created_at = now() - interval '780 days'
   where id = new_id;
  u := u || new_id;
  -- Marina Costa
  new_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', 'marina@exemplo.com',
          extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('name', 'Marina Costa'),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text,
          jsonb_build_object('sub', new_id::text, 'email', 'marina@exemplo.com', 'email_verified', true),
          'email', now(), now(), now());
  update public.profiles set username = 'marina', is_admin = false, bio = 'Viajante, fotógrafa e fã de café da manhã caprichado.',
         avatar = 'https://i.pravatar.cc/200?u=marina@exemplo.com', created_at = now() - interval '660 days'
   where id = new_id;
  u := u || new_id;
  -- João Pereira
  new_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', 'joao@exemplo.com',
          extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('name', 'João Pereira'),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text,
          jsonb_build_object('sub', new_id::text, 'email', 'joao@exemplo.com', 'email_verified', true),
          'email', now(), now(), now());
  update public.profiles set username = 'joao', is_admin = false, bio = 'Trabalho remoto e procuro lugares com bom Wi-Fi e vista bonita.',
         avatar = 'https://i.pravatar.cc/200?u=joao@exemplo.com', created_at = now() - interval '540 days'
   where id = new_id;
  u := u || new_id;
  -- Jacson
  new_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', 'jacson@exemplo.com',
          extensions.crypt(admin_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('name', 'Jacson'),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text,
          jsonb_build_object('sub', new_id::text, 'email', 'jacson@exemplo.com', 'email_verified', true),
          'email', now(), now(), now());
  update public.profiles set username = 'jacson', is_admin = true, bio = 'Administrador do Estadia e anfitrião de casas no litoral e na serra.',
         avatar = 'https://i.pravatar.cc/200?u=jacson@exemplo.com', created_at = now() - interval '420 days'
   where id = new_id;
  u := u || new_id;
  -- Jana
  new_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', 'jana@exemplo.com',
          extensions.crypt(guest_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('name', 'Jana'),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text,
          jsonb_build_object('sub', new_id::text, 'email', 'jana@exemplo.com', 'email_verified', true),
          'email', now(), now(), now());
  update public.profiles set username = 'jana', is_admin = false, bio = 'Adoro viajar com a família e descobrir lugares novos pelo Brasil.',
         avatar = 'https://i.pravatar.cc/200?u=jana@exemplo.com', created_at = now() - interval '300 days'
   where id = new_id;
  u := u || new_id;

  -- Anúncios
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[1], 'Apartamento com vista para o Pão de Açúcar', 'Apartamento claro e ventilado em Botafogo, a poucos passos do metrô. Varanda com vista para o Pão de Açúcar, cozinha completa e uma mesa ótima para trabalhar.', 'Apartamento', 'Rio de Janeiro', 'RJ', -22.9519, -43.1806, 420, 120, 4, 2, 2, 1, array['Wi-Fi', 'Cozinha', 'Ar-condicionado', 'TV', 'Vista para o mar', 'Espaço de trabalho']::text[], array['https://picsum.photos/seed/estadia-0-0/1200/800', 'https://picsum.photos/seed/estadia-0-1/1200/800', 'https://picsum.photos/seed/estadia-0-2/1200/800', 'https://picsum.photos/seed/estadia-0-3/1200/800', 'https://picsum.photos/seed/estadia-0-4/1200/800']::text[], true, now() - interval '200 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 100 — Rio de Janeiro');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[5], 'Casa pé na areia em Búzios', 'Casa ampla com piscina e acesso direto à praia de Geribá. Perfeita para famílias e grupos de amigos.', 'Casa', 'Armação dos Búzios', 'RJ', -22.7469, -41.8817, 890, 250, 8, 4, 5, 3, array['Wi-Fi', 'Cozinha', 'Piscina', 'Churrasqueira', 'Vista para o mar', 'Estacionamento gratuito', 'Ar-condicionado']::text[], array['https://picsum.photos/seed/estadia-1-0/1200/800', 'https://picsum.photos/seed/estadia-1-1/1200/800', 'https://picsum.photos/seed/estadia-1-2/1200/800', 'https://picsum.photos/seed/estadia-1-3/1200/800', 'https://picsum.photos/seed/estadia-1-4/1200/800']::text[], false, now() - interval '190 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 107 — Armação dos Búzios');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[5], 'Chalé com lareira em Gramado', 'Chalé romântico no meio do verde, a 5 minutos da Rua Coberta. Lareira, banheira de hidromassagem e café colonial.', 'Chalé', 'Gramado', 'RS', -29.3788, -50.8736, 560, 150, 2, 1, 1, 1, array['Wi-Fi', 'Lareira', 'Hidromassagem', 'Café da manhã', 'Estacionamento gratuito']::text[], array['https://picsum.photos/seed/estadia-2-0/1200/800', 'https://picsum.photos/seed/estadia-2-1/1200/800', 'https://picsum.photos/seed/estadia-2-2/1200/800', 'https://picsum.photos/seed/estadia-2-3/1200/800', 'https://picsum.photos/seed/estadia-2-4/1200/800']::text[], true, now() - interval '180 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 114 — Gramado');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[2], 'Cabana na mata em Campos do Jordão', 'Cabana rústica e aconchegante rodeada de araucárias. Ideal para desconectar — e seu pet é bem-vindo.', 'Cabana', 'Campos do Jordão', 'SP', -22.7394, -45.5914, 480, 100, 4, 2, 3, 1, array['Lareira', 'Cozinha', 'Aceita animais', 'Churrasqueira', 'Estacionamento gratuito']::text[], array['https://picsum.photos/seed/estadia-3-0/1200/800', 'https://picsum.photos/seed/estadia-3-1/1200/800', 'https://picsum.photos/seed/estadia-3-2/1200/800', 'https://picsum.photos/seed/estadia-3-3/1200/800', 'https://picsum.photos/seed/estadia-3-4/1200/800']::text[], false, now() - interval '170 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 121 — Campos do Jordão');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[1], 'Loft moderno na Vila Madalena', 'Loft com pé-direito duplo no coração da Vila Madalena, perto de bares, galerias e do metrô.', 'Loft', 'São Paulo', 'SP', -23.5568, -46.6912, 310, 80, 2, 1, 1, 1, array['Wi-Fi', 'Ar-condicionado', 'Espaço de trabalho', 'TV', 'Máquina de lavar', 'Academia']::text[], array['https://picsum.photos/seed/estadia-4-0/1200/800', 'https://picsum.photos/seed/estadia-4-1/1200/800', 'https://picsum.photos/seed/estadia-4-2/1200/800', 'https://picsum.photos/seed/estadia-4-3/1200/800', 'https://picsum.photos/seed/estadia-4-4/1200/800']::text[], true, now() - interval '160 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 128 — São Paulo');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[2], 'Pousada charmosa no centro histórico de Paraty', 'Quarto em casarão colonial restaurado, com café da manhã servido no jardim. Tudo a pé no centro histórico.', 'Pousada', 'Paraty', 'RJ', -23.2178, -44.7131, 380, 0, 3, 1, 2, 1, array['Wi-Fi', 'Café da manhã', 'Ar-condicionado', 'Piscina']::text[], array['https://picsum.photos/seed/estadia-5-0/1200/800', 'https://picsum.photos/seed/estadia-5-1/1200/800', 'https://picsum.photos/seed/estadia-5-2/1200/800', 'https://picsum.photos/seed/estadia-5-3/1200/800', 'https://picsum.photos/seed/estadia-5-4/1200/800']::text[], false, now() - interval '150 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 135 — Paraty');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[5], 'Casa com piscina em Florianópolis', 'Casa na Lagoa da Conceição, com piscina e deck. A 10 minutos das praias Mole e Joaquina.', 'Casa', 'Florianópolis', 'SC', -27.6028, -48.4596, 650, 200, 6, 3, 4, 2, array['Wi-Fi', 'Cozinha', 'Piscina', 'Churrasqueira', 'Estacionamento gratuito', 'Máquina de lavar']::text[], array['https://picsum.photos/seed/estadia-6-0/1200/800', 'https://picsum.photos/seed/estadia-6-1/1200/800', 'https://picsum.photos/seed/estadia-6-2/1200/800', 'https://picsum.photos/seed/estadia-6-3/1200/800', 'https://picsum.photos/seed/estadia-6-4/1200/800']::text[], true, now() - interval '140 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 142 — Florianópolis');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[2], 'Quarto aconchegante em Ouro Preto', 'Quarto privativo em casa de família, com vista para as igrejas barrocas. Café mineiro incluso.', 'Quarto', 'Ouro Preto', 'MG', -20.3856, -43.5035, 150, 0, 2, 1, 1, 1, array['Wi-Fi', 'Café da manhã']::text[], array['https://picsum.photos/seed/estadia-7-0/1200/800', 'https://picsum.photos/seed/estadia-7-1/1200/800', 'https://picsum.photos/seed/estadia-7-2/1200/800', 'https://picsum.photos/seed/estadia-7-3/1200/800', 'https://picsum.photos/seed/estadia-7-4/1200/800']::text[], true, now() - interval '130 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 149 — Ouro Preto');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[1], 'Bangalô frente ao mar em Jericoacoara', 'Bangalô a poucos metros da Duna do Pôr do Sol. Redes na varanda e brisa o dia inteiro.', 'Casa', 'Jijoca de Jericoacoara', 'CE', -2.7956, -40.5137, 720, 180, 4, 2, 2, 2, array['Wi-Fi', 'Ar-condicionado', 'Vista para o mar', 'Café da manhã', 'Cozinha']::text[], array['https://picsum.photos/seed/estadia-8-0/1200/800', 'https://picsum.photos/seed/estadia-8-1/1200/800', 'https://picsum.photos/seed/estadia-8-2/1200/800', 'https://picsum.photos/seed/estadia-8-3/1200/800', 'https://picsum.photos/seed/estadia-8-4/1200/800']::text[], false, now() - interval '120 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 156 — Jijoca de Jericoacoara');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[2], 'Sítio com cachoeira em Bonito', 'Sítio com cachoeira particular, pomar e muito espaço. Base perfeita para os passeios de flutuação.', 'Sítio', 'Bonito', 'MS', -21.1261, -56.4836, 540, 150, 10, 4, 6, 3, array['Cozinha', 'Churrasqueira', 'Aceita animais', 'Estacionamento gratuito', 'Piscina']::text[], array['https://picsum.photos/seed/estadia-9-0/1200/800', 'https://picsum.photos/seed/estadia-9-1/1200/800', 'https://picsum.photos/seed/estadia-9-2/1200/800', 'https://picsum.photos/seed/estadia-9-3/1200/800', 'https://picsum.photos/seed/estadia-9-4/1200/800']::text[], false, now() - interval '110 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 163 — Bonito');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[1], 'Apartamento no Pelourinho', 'Apartamento colorido em prédio histórico, no meio da cultura e da música do Pelourinho.', 'Apartamento', 'Salvador', 'BA', -12.9714, -38.5108, 260, 60, 3, 1, 2, 1, array['Wi-Fi', 'Ar-condicionado', 'TV', 'Cozinha']::text[], array['https://picsum.photos/seed/estadia-10-0/1200/800', 'https://picsum.photos/seed/estadia-10-1/1200/800', 'https://picsum.photos/seed/estadia-10-2/1200/800', 'https://picsum.photos/seed/estadia-10-3/1200/800', 'https://picsum.photos/seed/estadia-10-4/1200/800']::text[], true, now() - interval '100 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 170 — Salvador');
  lid := lid || bid;
  insert into public.listings (host_id, title, description, property_type, city, state, lat, lng,
         price_per_night, cleaning_fee, max_guests, bedrooms, beds, bathrooms, amenities, photos,
         instant_book, created_at)
  values (u[5], 'Casa de vidro na serra de Itaipava', 'Projeto contemporâneo com paredes de vidro e vista para as montanhas. Uma experiência única na serra.', 'Casa', 'Petrópolis', 'RJ', -22.3833, -43.1333, 990, 300, 6, 3, 3, 3, array['Wi-Fi', 'Lareira', 'Hidromassagem', 'Piscina', 'Cozinha', 'Espaço de trabalho', 'Estacionamento gratuito']::text[], array['https://picsum.photos/seed/estadia-11-0/1200/800', 'https://picsum.photos/seed/estadia-11-1/1200/800', 'https://picsum.photos/seed/estadia-11-2/1200/800', 'https://picsum.photos/seed/estadia-11-3/1200/800', 'https://picsum.photos/seed/estadia-11-4/1200/800']::text[], false, now() - interval '90 days')
  returning id into bid;
  insert into public.listing_private (listing_id, address) values (bid, 'Rua Exemplo, 177 — Petrópolis');
  lid := lid || bid;

  -- Estadias passadas, com avaliações
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[1], u[4], public.today_br() + -60, public.today_br() + -57, 2, 3, 420, 120, 1380, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[1], u[4], 5, 'Lugar incrível, exatamente como nas fotos. Anfitrião super atencioso!', now() - interval '57 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[2], u[3], public.today_br() + -117, public.today_br() + -114, 2, 3, 890, 250, 2920, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[2], u[3], 5, 'Voltaria com certeza. Limpo, confortável e muito bem localizado.', now() - interval '114 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[2], u[4], public.today_br() + -58, public.today_br() + -55, 2, 3, 890, 250, 2920, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[2], u[4], 4, 'Ótima estadia. Só achei o chuveiro um pouco fraco, mas nada que atrapalhe.', now() - interval '55 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[3], u[3], public.today_br() + -114, public.today_br() + -111, 2, 3, 560, 150, 1830, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[3], u[3], 5, 'Melhor hospedagem que já tive. Cada detalhe pensado com carinho.', now() - interval '111 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[4], u[4], public.today_br() + -54, public.today_br() + -51, 2, 3, 480, 100, 1540, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[4], u[4], 4, 'Muito bom custo-benefício, recomendo.', now() - interval '51 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[5], u[3], public.today_br() + -108, public.today_br() + -105, 2, 3, 310, 80, 1010, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[5], u[3], 5, 'Lugar incrível, exatamente como nas fotos. Anfitrião super atencioso!', now() - interval '105 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[5], u[4], public.today_br() + -52, public.today_br() + -49, 2, 3, 310, 80, 1010, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[5], u[4], 5, 'Voltaria com certeza. Limpo, confortável e muito bem localizado.', now() - interval '49 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[6], u[3], public.today_br() + -105, public.today_br() + -102, 2, 3, 380, 0, 1140, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[6], u[3], 4, 'Ótima estadia. Só achei o chuveiro um pouco fraco, mas nada que atrapalhe.', now() - interval '102 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[7], u[4], public.today_br() + -48, public.today_br() + -45, 2, 3, 650, 200, 2150, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[7], u[4], 5, 'Melhor hospedagem que já tive. Cada detalhe pensado com carinho.', now() - interval '45 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[8], u[3], public.today_br() + -99, public.today_br() + -96, 2, 3, 150, 0, 450, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[8], u[3], 4, 'Muito bom custo-benefício, recomendo.', now() - interval '96 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[8], u[4], public.today_br() + -46, public.today_br() + -43, 2, 3, 150, 0, 450, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[8], u[4], 5, 'Lugar incrível, exatamente como nas fotos. Anfitrião super atencioso!', now() - interval '43 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[9], u[3], public.today_br() + -96, public.today_br() + -93, 2, 3, 720, 180, 2340, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[9], u[3], 5, 'Voltaria com certeza. Limpo, confortável e muito bem localizado.', now() - interval '93 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[10], u[4], public.today_br() + -42, public.today_br() + -39, 2, 3, 540, 150, 1770, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[10], u[4], 4, 'Ótima estadia. Só achei o chuveiro um pouco fraco, mas nada que atrapalhe.', now() - interval '39 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[11], u[3], public.today_br() + -90, public.today_br() + -87, 2, 3, 260, 60, 840, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[11], u[3], 5, 'Melhor hospedagem que já tive. Cada detalhe pensado com carinho.', now() - interval '87 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[11], u[4], public.today_br() + -40, public.today_br() + -37, 2, 3, 260, 60, 840, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[11], u[4], 4, 'Muito bom custo-benefício, recomendo.', now() - interval '37 days');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[12], u[3], public.today_br() + -87, public.today_br() + -84, 2, 3, 990, 300, 3270, 'confirmed')
  returning id into bid;
  insert into public.reviews (booking_id, listing_id, author_id, rating, comment, created_at)
  values (bid, lid[12], u[3], 5, 'Lugar incrível, exatamente como nas fotos. Anfitrião super atencioso!', now() - interval '84 days');

  -- Estadia concluída sem avaliação (para testar o formulário)
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[5], u[3], public.today_br() + -10, public.today_br() + -8, 2, 2, 310, 80, 700, 'confirmed')
  returning id into bid;

  -- Reservas futuras
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[1], u[3], public.today_br() + 14, public.today_br() + 18, 2, 4, 420, 120, 1800, 'confirmed')
  returning id into bid;
  insert into public.messages (booking_id, sender_id, body) values (bid, u[3], 'Oi Ana! Chegaremos por volta das 15h. Tem lugar para deixar as malas antes?');
  insert into public.messages (booking_id, sender_id, body) values (bid, u[1], 'Oi Marina! Claro, pode deixar com o porteiro a partir das 10h. Boa viagem!');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[2], u[4], public.today_br() + 25, public.today_br() + 30, 6, 5, 890, 250, 4700, 'pending')
  returning id into bid;
  insert into public.messages (booking_id, sender_id, body) values (bid, u[4], 'Olá! Somos 6 amigos comemorando um aniversário. Tudo bem?');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[4], u[3], public.today_br() + 30, public.today_br() + 33, 2, 3, 480, 100, 1540, 'pending')
  returning id into bid;
  insert into public.messages (booking_id, sender_id, body) values (bid, u[3], 'Vamos levar nossa cachorrinha, ela é pequena e bem tranquila.');
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[3], u[4], public.today_br() + 40, public.today_br() + 43, 2, 3, 560, 150, 1830, 'confirmed')
  returning id into bid;
  insert into public.bookings (listing_id, guest_id, check_in, check_out, guests, nights,
         price_per_night, cleaning_fee, total_price, status)
  values (lid[7], u[4], public.today_br() + 8, public.today_br() + 10, 2, 2, 650, 200, 1500, 'cancelled')
  returning id into bid;

  raise notice 'Dados de demonstração criados: % usuários, % anúncios.', cardinality(u), cardinality(lid);
end
$seed$;
