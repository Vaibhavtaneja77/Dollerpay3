alter table payment_methods
drop constraint if exists valid_upi;

alter table payment_methods
add constraint valid_upi check (
  type <> 'upi'
  or (
    upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z]+$'
    and length(split_part(upi_id, '@', 1)) between 2 and 256
    and length(split_part(upi_id, '@', 2)) between 2 and 64
  )
);
