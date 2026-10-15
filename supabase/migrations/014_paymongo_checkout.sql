alter table public.orders
  add column if not exists payment_method text
    check (payment_method in ('card', 'gcash', 'cod')),
  add column if not exists paymongo_checkout_session_id text;

create unique index if not exists orders_paymongo_checkout_session_idx
  on public.orders(paymongo_checkout_session_id)
  where paymongo_checkout_session_id is not null;

drop function if exists public.checkout_cart(jsonb, text, numeric, uuid[]);

create function public.checkout_cart(
  p_shipping_address jsonb,
  p_payment_method text,
  p_shipping_fee numeric default 0,
  p_selected_item_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_cart_id uuid;
  item record;
  product record;
  subtotal numeric(12,2) := 0;
  order_row public.orders%rowtype;
begin
  if current_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_payment_method is null or p_payment_method not in ('card', 'gcash', 'cod') then
    raise exception 'Unsupported payment method.' using errcode = 'P0001';
  end if;

  select id into current_cart_id
  from public.carts
  where user_id = current_user_id
  limit 1;

  if current_cart_id is null then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.cart_items
    where cart_id = current_cart_id
      and (p_selected_item_ids is null or id = any(p_selected_item_ids))
  ) then
    raise exception 'Please select at least one cart item.' using errcode = 'P0001';
  end if;

  for item in
    select product_id, quantity
    from public.cart_items
    where cart_id = current_cart_id
      and (p_selected_item_ids is null or id = any(p_selected_item_ids))
  loop
    select id, name, price, stock into product
    from public.products
    where id = item.product_id
    for update;

    if product.id is null then
      raise exception 'A product in your cart is no longer available.' using errcode = 'P0001';
    end if;
    if product.stock < item.quantity then
      raise exception 'Not enough stock for "%".' , product.name using errcode = 'P0001';
    end if;

    subtotal := subtotal + product.price * item.quantity;
  end loop;

  insert into public.orders (
    order_number,
    customer_id,
    customer_name,
    customer_email,
    total_amount,
    status,
    payment_status,
    payment_method,
    shipping_address
  ) values (
    'BC-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    current_user_id,
    coalesce(p_shipping_address->>'fullName', ''),
    auth.email(),
    subtotal + coalesce(p_shipping_fee, 0),
    'pending',
    'pending',
    p_payment_method,
    p_shipping_address::text
  ) returning * into order_row;

  for item in
    select product_id, quantity
    from public.cart_items
    where cart_id = current_cart_id
      and (p_selected_item_ids is null or id = any(p_selected_item_ids))
  loop
    select id, name, price, stock into product
    from public.products
    where id = item.product_id
    for update;

    insert into public.order_items (order_id, product_id, product_name, quantity, price)
    values (order_row.id, product.id, product.name, item.quantity, product.price);

    update public.products
    set stock = product.stock - item.quantity,
        updated_at = now()
    where id = product.id;
  end loop;

  delete from public.cart_items
  where cart_id = current_cart_id
    and (p_selected_item_ids is null or id = any(p_selected_item_ids));

  return jsonb_build_object('order', to_jsonb(order_row));
end;
$$;

revoke all on function public.checkout_cart(jsonb, text, numeric, uuid[]) from public;
grant execute on function public.checkout_cart(jsonb, text, numeric, uuid[]) to authenticated;

create or replace function public.attach_paymongo_checkout_session(
  p_order_id uuid,
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  update public.orders
  set paymongo_checkout_session_id = p_session_id,
      updated_at = now()
  where id = p_order_id
    and customer_id = auth.uid()
    and payment_method in ('card', 'gcash')
    and payment_status = 'pending'
    and paymongo_checkout_session_id is null;

  if not found then
    raise exception 'Unable to attach PayMongo session to this order.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.attach_paymongo_checkout_session(uuid, text) from public;
grant execute on function public.attach_paymongo_checkout_session(uuid, text) to authenticated;
