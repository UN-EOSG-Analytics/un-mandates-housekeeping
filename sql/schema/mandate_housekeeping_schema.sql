create table entities (
    entity text not null primary key,
    entity_long text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);
comment on table entities is 'Local copy of UN entities. Sync from systemchart.entities';
create index idx_entities_entity_long on entities (entity_long);
create table users (
    id uuid default gen_random_uuid() not null primary key,
    email text not null unique,
    entity text references entities on delete
    set null,
        created_at timestamp with time zone default now(),
        updated_at timestamp with time zone default now(),
        last_login_at timestamp with time zone
);
create table magic_tokens (
    token text not null primary key,
    email text not null,
    expires_at timestamp with time zone not null,
    used_at timestamp with time zone
);
create index idx_magic_tokens_expires on magic_tokens (expires_at);
create index idx_magic_tokens_cleanup on magic_tokens (expires_at)
where (used_at IS NULL);
create table allowed_reviewers (email text not null primary key);
comment on table allowed_reviewers is 'Allowlist of email addresses that can have the reviewer role. Only users with emails in this table will be assigned reviewer status.';
create table allowed_domains (
    entity text not null,
    domain text not null,
    primary key (entity, domain)
);
comment on table allowed_domains is 'Allowed email domains. Entity ''*'' means global (allowed for all entities).';
create table mandate_decisions (
    id uuid default gen_random_uuid() not null primary key,
    document_symbol text not null,
    entity text not null references entities on delete restrict,
    subprogramme text,
    decision text not null constraint mandate_decisions_decision_check check (
        decision = ANY (
            ARRAY ['retain'::text, 'remove'::text, 'add'::text, 'update'::text, 'cancel'::text]
        )
    ),
    new_symbol text,
    manual_metadata jsonb,
    decision_reason text,
    other_reason text,
    user_email text not null references users (email) on delete restrict,
    created_at timestamp with time zone default now(),
    approved_by text references users (email) on delete restrict,
    approved_at timestamp with time zone
);
comment on column mandate_decisions.manual_metadata is 'For manual add decisions: {title, body, year, link}';
comment on column mandate_decisions.decision_reason is 'Primary reason for the decision (from predefined list)';
comment on column mandate_decisions.other_reason is 'Freetext explanation when reason is "other"';
create index idx_mandate_decisions_lookup on mandate_decisions (
    entity asc,
    document_symbol asc,
    COALESCE(subprogramme, ''::text) asc,
    created_at desc
);
create index idx_mandate_decisions_polling on mandate_decisions (entity asc, created_at desc);
create index idx_mandate_decisions_symbol on mandate_decisions (document_symbol);
create table mandate_comments (
    id uuid default gen_random_uuid() not null primary key,
    document_symbol text not null,
    entity text not null references entities on delete restrict,
    subprogramme text,
    comment text not null,
    user_email text not null references users (email) on delete restrict,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    resolved_at timestamp with time zone,
    resolved_by text references users (email) on delete restrict
);
create index idx_mandate_comments_lookup on mandate_comments (
    entity asc,
    document_symbol asc,
    COALESCE(subprogramme, ''::text) asc,
    created_at desc
);
create index idx_mandate_comments_polling on mandate_comments (entity asc, created_at desc);
create index idx_mandate_comments_unresolved on mandate_comments (entity, document_symbol)
where (resolved_at IS NULL);
create table docx_uploads (
    id uuid default gen_random_uuid() not null primary key,
    filename text not null,
    blob_url text not null,
    blob_name text not null,
    content_type text default 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text,
    size_bytes bigint,
    entity text not null references entities on delete restrict,
    subprogramme text,
    user_email text not null references users (email) on delete restrict,
    created_at timestamp with time zone default now(),
    metadata jsonb
);
comment on table docx_uploads is 'Tracks DOCX file submissions uploaded by reviewers';
comment on column docx_uploads.blob_url is 'Full Azure Blob Storage URL for the file';
comment on column docx_uploads.blob_name is 'Azure blob path/name for management operations';
create index idx_docx_uploads_entity on docx_uploads (entity asc, created_at desc);
create index idx_docx_uploads_user on docx_uploads (user_email asc, created_at desc);
create table entity_review_mode (
    entity text not null primary key references entities on delete restrict,
    started_by text not null references users (email) on delete restrict,
    started_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    ended_at timestamp with time zone,
    ended_by text references users (email) on delete restrict
);
comment on table entity_review_mode is 'Tracks when entities are under review. When started_at is set and ended_at is NULL, the entity is locked for review.';
create index idx_entity_review_mode_active on entity_review_mode (entity)
where (ended_at IS NULL);