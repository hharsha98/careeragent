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
    """Open a connection with pgvector types registered, commit on success."""
    with psycopg.connect(settings.database_url) as conn:
        register_vector(conn)  # lets us pass Python lists as vector(1024) values
        yield conn
