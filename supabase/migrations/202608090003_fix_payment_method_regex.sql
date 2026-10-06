alter table payment_methods
drop constraint if exists valid_upi;

alter table payment_methods
drop constraint if exists valid_bank;

alter table payment_methods
add constraint valid_upi check (
  type <> 'upi'
  or (
    upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z]+$'
    and length(split_part(upi_id, '@', 1)) between 2 and 256
    and length(split_part(upi_id, '@', 2)) between 2 and 64
  )
);

alter table payment_methods
add constraint valid_bank check (
  type <> 'bank'
  or (
    account_holder_name is not null
    and length(trim(account_holder_name)) >= 2
    and bank_name is not null
    and length(trim(bank_name)) >= 2
    and account_number ~ '^[0-9]{9,18}$'
    and ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'
  )
);
