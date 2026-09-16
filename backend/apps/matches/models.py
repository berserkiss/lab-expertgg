from django.db import models


class Game(models.Model):
    name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    icon = models.ImageField(upload_to="games/", null=True, blank=True)

    def __str__(self):
        return self.name


class Tournament(models.Model):
    name = models.CharField(max_length=100)
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="tournaments")
    # PandaScore's league id, when this tournament was synced from the feed
    # rather than entered by hand in admin. Nullable so manually-created
    # tournaments keep working.
    external_id = models.CharField(max_length=32, unique=True, null=True, blank=True)

    def __str__(self):
        return self.name


class Team(models.Model):
    name = models.CharField(max_length=100)
    logo = models.ImageField(upload_to="teams/", null=True, blank=True)
    # PandaScore's own hosted logo URL (opponent.image_url) for teams synced
    # from the feed - used when no locally-uploaded `logo` file exists (see
    # TeamSerializer.get_logo).
    logo_url = models.URLField(max_length=500, null=True, blank=True)
    # PandaScore's opponent id - see Tournament.external_id.
    external_id = models.CharField(max_length=32, unique=True, null=True, blank=True)

    def __str__(self):
        return self.name


class Match(models.Model):
    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        LIVE = "live", "Live"
        FINISHED = "finished", "Finished"

    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="matches")
    team_a = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="matches_as_a")
    team_b = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="matches_as_b")
    start_time = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UPCOMING, db_index=True)
    winner = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    # PandaScore's match id - see Tournament.external_id.
    external_id = models.CharField(max_length=32, unique=True, null=True, blank=True)

    def __str__(self):
        return f"{self.team_a} vs {self.team_b}"
