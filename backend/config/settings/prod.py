"""
Production settings. Behavior is unchanged from base - base.py already gates
DEBUG, SECRET_KEY, and the HTTPS/HSTS block on environment variables read
from the Droplet's .env file. This module exists as the documented seam for
a prod-only setting (e.g. STATICFILES_STORAGE, Sentry) to be added later
without touching base.py or dev.py.
"""

from .base import *  # noqa: F401,F403
