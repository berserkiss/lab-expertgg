from django.apps import AppConfig


class VotesConfig(AppConfig):
    name = 'apps.votes'
    label = 'votes'

    def ready(self):
        from . import signals  # noqa: F401
