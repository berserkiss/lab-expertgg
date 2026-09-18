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
    """Any failure talking to PandaScore. `status_code` is set when there was a response."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


def _get(url, params=None):
    """
    One request, with every failure mode arriving as PandaScoreError.

    Callers settle money after the feed loops, so an uncaught
    requests.HTTPError from a single upstream 5xx used to abort the whole
    run before that work happened. This is the boundary: past it, there is
    exactly one exception type to handle.
    """
    if not settings.PANDASCORE_API_KEY:
        raise PandaScoreError(
            "PANDASCORE_API_KEY is not set - add it to backend/.env "
            "(see backend/.env.example)."
        )
    try:
        response = requests.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {settings.PANDASCORE_API_KEY}"},
            timeout=15,
        )
    except requests.RequestException as e:
        raise PandaScoreError(f"PandaScore request failed: {e}") from e

    if response.status_code == 429:
        raise PandaScoreError(
            f"PandaScore rate limit hit (429). Retry-After: "
            f"{response.headers.get('Retry-After', '?')}s",
            status_code=429,
        )
    try:
        response.raise_for_status()
    except requests.HTTPError as e:
        raise PandaScoreError(
            f"PandaScore returned {response.status_code} for {url}",
            status_code=response.status_code,
        ) from e
    try:
        return response.json()
    except ValueError as e:
        raise PandaScoreError(f"PandaScore returned a non-JSON body for {url}") from e


def fetch_match(external_id):
    """
    Fetch a single match by its PandaScore id.

    The feed endpoint only ever returns a recency window, so a match that
    finished a while ago drops out of it. Settling a bet placed on such a
    match needs the match asked for by id, not waited for in the feed.
    Returns the raw match object, or None if PandaScore no longer has it.
    """
    try:
        return _get(f"{PANDASCORE_BASE_URL}/matches/{external_id}")
    except PandaScoreError as e:
        # A match the feed no longer knows about is an answer, not a failure.
        if e.status_code == 404:
            return None
        raise


def fetch_matches(videogame_slug, status, per_page=50, sort=None):
    """
    Fetch one page of matches for a single videogame + status filter.

    `status` is one of PandaScore's own values: not_started | running |
    finished | canceled | postponed. Returns the parsed JSON list (each item
    is a raw PandaScore match object) - mapping into our models happens in
    the sync command, not here.
    """
    params = {
        "filter[videogame]": videogame_slug,
        "filter[status]": status,
        "per_page": per_page,
    }
    if sort:
        params["sort"] = sort
    return _get(f"{PANDASCORE_BASE_URL}/matches", params=params)
