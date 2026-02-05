create table issuing_bodies (
    id serial primary key,
    name text not null unique,
    abbreviation text,
    description text,
    display_order integer,
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index idx_issuing_bodies_name on issuing_bodies (name);
create index idx_issuing_bodies_active on issuing_bodies (is_active)
where (is_active = true);

-- Populate with existing issuing bodies from documents table
insert into issuing_bodies (name, display_order)
select distinct issuing_body,
    row_number() over (order by issuing_body) as display_order
from documents
where issuing_body is not null
    and issuing_body != ''
on conflict (name) do nothing;

-- Add well-known abbreviations for common UN bodies
update issuing_bodies set abbreviation = 'GA' where name = 'General Assembly';
update issuing_bodies set abbreviation = 'SC' where name = 'Security Council';
update issuing_bodies set abbreviation = 'ECOSOC' where name = 'Economic and Social Council';
update issuing_bodies set abbreviation = 'TC' where name = 'Trusteeship Council';
update issuing_bodies set abbreviation = 'ICJ' where name = 'International Court of Justice';
update issuing_bodies set abbreviation = 'HRC' where name = 'Human Rights Council';