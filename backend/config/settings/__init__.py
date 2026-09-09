"""
Picks the dev or prod settings module so every existing reference to
DJANGO_SETTINGS_MODULE=config.settings (manage.py, wsgi.py, asgi.py) keeps
working unchanged. Set DJANGO_ENV=prod on the Droplet's .env to opt in to
config.settings.prod; anything else (including local dev, where it's unset)
uses config.settings.dev.
"""

import os

if os.environ.get("DJANGO_ENV") == "prod":
    from .prod import *  # noqa: F401,F403
else:
    from .dev import *  # noqa: F401,F403
