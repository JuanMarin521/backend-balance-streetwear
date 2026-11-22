-- Balance Streetwear: initial schema, RLS and transactional stock functions.
-- Money is stored as integer COP (pesos). Stock model:
--   available = stock_on_hand - stock_reserved
--   order created  -> reserved += qty
--   payment approved -> on_hand -= qty, reserved -= qty
--   payment failed / cancelled / expired -> reserved -= qty

create type order_status as enum
  ('pending','paid','shipped','delivered','cancelled','failed','payment_review');
create type user_role as enum ('customer','admin');

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);
insert into categories (slug, name) values
  ('pants','Pants'), ('hoodies','Hoodies'), ('t-shirts','T-shirts'), ('sets','Sets');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  category_id uuid not null references categories(id),
  gender text not null check (gender in ('male','female','unisex')),
  showroom_slot text check (showroom_slot in ('top','bottom','full')),
  image_urls text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null unique,
  size text not null,
  design text not null default 'default',
  color text,
  price_cop integer not null check (price_cop > 0),
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reserved_within_stock check (stock_reserved <= stock_on_hand)
);
create unique index product_variants_unique_combo
  on product_variants (product_id, size, design, coalesce(color, ''));

create table orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  status order_status not null default 'pending',
  email text not null,
  customer_name text not null,
  phone text not null,
  shipping_address jsonb not null,
  subtotal_cop integer not null default 0,
  shipping_cop integer not null default 0,
  total_cop integer not null default 0,
  currency text not null default 'COP',
  payment_provider text,
  provider_transaction_id text,
  tracking_number text,
  holds_reservation boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_created_idx on orders (status, created_at desc);
create index orders_user_idx on orders (user_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete restrict,
  product_name text not null,
  sku text not null,
  size text not null,
  design text not null,
  unit_price_cop integer not null,
  quantity integer not null check (quantity > 0)
);
create index order_items_order_idx on order_items (order_id);

create table payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  order_id uuid references orders(id) on delete set null,
  status text not null,
  outcome text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger products_updated before update on products
  for each row execute function set_updated_at();
create trigger variants_updated before update on product_variants
  for each row execute function set_updated_at();
create trigger orders_updated before update on orders
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- functions

create function create_order_with_reservation(
  p_items jsonb, p_customer jsonb, p_user_id uuid,
  p_shipping_cop integer, p_ttl_minutes integer default 30
) returns table (order_id uuid, reference text, total_cop integer)
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb; v_row record; v_qty integer;
  v_subtotal integer := 0; v_order uuid; v_ref text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_ref := 'BAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into orders (reference, user_id, email, customer_name, phone,
                      shipping_address, shipping_cop, expires_at)
  values (v_ref, p_user_id, p_customer->>'email', p_customer->>'fullName',
          p_customer->>'phone', p_customer->'shippingAddress', p_shipping_cop,
          now() + make_interval(mins => p_ttl_minutes))
  returning id into v_order;

  -- Deterministic lock order avoids deadlocks between concurrent checkouts.
  for v_item in
    select e.value from jsonb_array_elements(p_items) e order by e.value->>'variantId'
  loop
    v_qty := (v_item->>'quantity')::integer;
    select v.id, v.sku, v.size, v.design, v.price_cop, v.stock_on_hand,
           v.stock_reserved, v.is_active, p.name as product_name,
           p.is_active as product_active
      into v_row
      from product_variants v join products p on p.id = v.product_id
     where v.id = (v_item->>'variantId')::uuid
       for update of v;

    if not found or not v_row.is_active or not v_row.product_active then
      raise exception 'VARIANT_UNAVAILABLE' using detail = v_item->>'variantId';
    end if;
    if v_row.stock_on_hand - v_row.stock_reserved < v_qty then
      raise exception 'INSUFFICIENT_STOCK' using detail = v_item->>'variantId';
    end if;

    update product_variants set stock_reserved = stock_reserved + v_qty
     where id = v_row.id;
    insert into order_items (order_id, variant_id, product_name, sku, size,
                             design, unit_price_cop, quantity)
    values (v_order, v_row.id, v_row.product_name, v_row.sku, v_row.size,
            v_row.design, v_row.price_cop, v_qty);
    v_subtotal := v_subtotal + v_row.price_cop * v_qty;
  end loop;

  update orders set subtotal_cop = v_subtotal,
                    total_cop = v_subtotal + p_shipping_cop
   where id = v_order;

  return query select v_order, v_ref, v_subtotal + p_shipping_cop;
end $$;

create function release_order(p_order_id uuid, p_new_status order_status)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  if p_new_status not in ('cancelled','failed') then
    raise exception 'INVALID_RELEASE_STATUS';
  end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.status not in ('pending','payment_review') then
    return false;
  end if;
  if v_order.holds_reservation then
    update product_variants v
       set stock_reserved = v.stock_reserved - i.quantity
      from order_items i
     where i.order_id = p_order_id and v.id = i.variant_id;
  end if;
  update orders set status = p_new_status, holds_reservation = false
   where id = p_order_id;
  return true;
end $$;

create function release_expired_reservations() returns integer
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_count integer := 0;
begin
  for v_id in select id from orders
               where status = 'pending' and expires_at < now() loop
    if release_order(v_id, 'cancelled') then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $$;

create function apply_payment_event(
  p_provider text, p_event_id text, p_reference text, p_status text,
  p_amount_cop numeric, p_transaction_id text, p_payload jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare v_order orders; v_event bigint; v_outcome text;
begin
  insert into payment_events (provider, event_id, status, payload)
  values (p_provider, p_event_id, p_status, p_payload)
  on conflict (provider, event_id) do nothing
  returning id into v_event;
  if v_event is null then return 'duplicate'; end if;

  select * into v_order from orders where reference = p_reference for update;
  if not found then
    update payment_events set outcome = 'order_not_found' where id = v_event;
    return 'order_not_found';
  end if;

  if p_status = 'approved' then
    if v_order.status = 'pending' then
      if p_amount_cop <> v_order.total_cop then
        update orders set status = 'payment_review',
               provider_transaction_id = p_transaction_id
         where id = v_order.id;
        v_outcome := 'amount_mismatch';
      else
        update product_variants v
           set stock_on_hand = v.stock_on_hand - i.quantity,
               stock_reserved = v.stock_reserved - i.quantity
          from order_items i
         where i.order_id = v_order.id and v.id = i.variant_id;
        update orders set status = 'paid', holds_reservation = false,
               provider_transaction_id = p_transaction_id
         where id = v_order.id;
        v_outcome := 'paid';
      end if;
    elsif v_order.status in ('cancelled','failed') then
      -- Paid after the reservation was released: needs manual handling.
      update orders set status = 'payment_review',
             provider_transaction_id = p_transaction_id
       where id = v_order.id;
      v_outcome := 'paid_after_release';
    else
      v_outcome := 'ignored_' || v_order.status;
    end if;
  elsif p_status in ('declined','voided','error') then
    if v_order.status = 'pending' then
      perform release_order(v_order.id,
        case when p_status = 'voided' then 'cancelled' else 'failed' end::order_status);
      v_outcome := 'released';
    else
      v_outcome := 'ignored_' || v_order.status;
    end if;
  else
    v_outcome := 'pending_noop';
  end if;

  update payment_events set order_id = v_order.id, outcome = v_outcome
   where id = v_event;
  return v_outcome;
end $$;

revoke execute on function create_order_with_reservation, release_order,
  release_expired_reservations, apply_payment_event
  from public, anon, authenticated;
grant execute on function create_order_with_reservation, release_order,
  release_expired_reservations, apply_payment_event to service_role;

-- ---------------------------------------------------------------------- RLS

alter table categories enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payment_events enable row level security;

create policy categories_read on categories for select using (true);
create policy products_read on products for select using (is_active);
create policy variants_read on product_variants for select using (is_active);
create policy profiles_read_own on profiles for select using (id = auth.uid());
create policy orders_read_own on orders for select using (user_id = auth.uid());
create policy order_items_read_own on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

-- Browser roles never write directly and never see exact stock figures.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke all on payment_events from anon, authenticated;
revoke select on product_variants from anon, authenticated;
grant select (id, product_id, sku, size, design, color, price_cop, is_active)
  on product_variants to anon, authenticated;
