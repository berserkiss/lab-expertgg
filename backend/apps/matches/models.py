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

    def __str__(self):
        return self.name


class Team(models.Model):
    name = models.CharField(max_length=100)
    logo = models.ImageField(upload_to="teams/", null=True, blank=True)

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

    def __str__(self):
        return f"{self.team_a} vs {self.team_b}"
