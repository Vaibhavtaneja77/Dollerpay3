alter type payment_method_type add value if not exists 'qr';

alter type deposit_request_status add value if not exists 'EXPIRED';
