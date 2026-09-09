"""
Local development settings. Behavior is unchanged from base - the .env file
(DEBUG=True, CORS_ALLOW_ALL_ORIGINS=True, etc.) already drives every dev vs
prod difference in base.py. This module exists as the documented seam for a
dev-only setting (e.g. a debug toolbar app) to be added later without
touching base.py or prod.py.
"""

from .base import *  # noqa: F401,F403
