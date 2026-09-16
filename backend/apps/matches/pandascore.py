"""
Thin client for the PandaScore matches feed.

Only wraps what the sync command needs (GET /matches, paginated, filtered
by videogame + status). No caching, retries, or webhook/live support -
that's beyond Simplified 2's scope (see code.md).
"""
import requests
from django.conf import settings

PANDASCORE_BASE_URL = "https://api.pandascore.co"


class PandaScoreError(Exception):
    pass


def fetch_matches(videogame_slug, status, per_page=50, sort=None):
    """
    Fetch one page of matches for a single videogame + status filter.

    `status` is one of PandaScore's own values: not_started | running |
    finished | canceled | postponed. Returns the parsed JSON list (each item
    is a raw PandaScore match object) - mapping into our models happens in
    the sync command, not here.
    """
    if not settings.PANDASCORE_API_KEY:
        raise PandaScoreError(
            "PANDASCORE_API_KEY is not set - add it to backend/.env "
            "(see backend/.env.example)."
        )

    params = {
        "filter[videogame]": videogame_slug,
        "filter[status]": status,
        "per_page": per_page,
    }
    if sort:
        params["sort"] = sort

    response = requests.get(
        f"{PANDASCORE_BASE_URL}/matches",
        params=params,
        headers={"Authorization": f"Bearer {settings.PANDASCORE_API_KEY}"},
        timeout=15,
    )
    if response.status_code == 429:
        raise PandaScoreError(
            f"PandaScore rate limit hit (429). Retry-After: "
            f"{response.headers.get('Retry-After', '?')}s"
        )
    response.raise_for_status()
    return response.json()
