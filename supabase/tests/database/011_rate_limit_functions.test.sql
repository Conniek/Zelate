begin;
select plan(11);

select ok(public.consume_rate_limit('t_phone', '+33612345678', 5, 3600), '1st call is allowed');
select ok(public.consume_rate_limit('t_phone', '+33612345678', 5, 3600), '2nd call is allowed');
select ok(public.consume_rate_limit('t_phone', '+33612345678', 5, 3600), '3rd call is allowed');
select ok(public.consume_rate_limit('t_phone', '+33612345678', 5, 3600), '4th call is allowed');
select ok(not public.is_rate_limited('t_phone', '+33612345678', 5, 3600), 'not limited after 4 of 5');
select ok(public.consume_rate_limit('t_phone', '+33612345678', 5, 3600), '5th call is allowed');
select ok(public.is_rate_limited('t_phone', '+33612345678', 5, 3600), 'limited after 5 of 5');
select ok(not public.consume_rate_limit('t_phone', '+33612345678', 5, 3600), '6th call is refused');

select is(
  (select r.count from private.rate_limits r
   where r.bucket = 't_phone' and r.key_hash = extensions.digest('+33612345678', 'sha256')),
  5,
  'a refused call leaves the counter at the limit'
);

select ok(public.consume_rate_limit('t_phone', '+33698765432', 5, 3600), 'another key has its own counter');
select ok(public.consume_rate_limit('t_ip', '+33612345678', 5, 3600), 'another bucket has its own counter');

select * from finish();
rollback;
