"""Database access. One connection per request — simple and correct for our
traffic. Supabase's "transaction pooler" (port 6543) does the heavy pooling
on the server side, so we don't need a client-side pool library.
"""
from contextlib import contextmanager

import psycopg
from pgvector.psycopg import register_vector

from app.config import settings


@contextmanager
def get_conn():
    """Open a connection with pgvector types registered, commit on success.
    prepare_threshold=None disables psycopg's auto-prepared-statements, which
    Supabase's transaction pooler (pgbouncer) does not support — without it,
    repeated queries on one pooled connection raise DuplicatePreparedStatement."""
    with psycopg.connect(settings.database_url, prepare_threshold=None) as conn:
        register_vector(conn)  # lets us pass Python lists as vector(1024) values
        yield conn
