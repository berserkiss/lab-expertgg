import io

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APITestCase

User = get_user_model()

ME_URL = "/api/auth/me/"


def make_image_file(name="avatar.jpg", fmt="JPEG", content_type="image/jpeg", pad_bytes=0):
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color="red").save(buf, format=fmt)
    buf.write(b"0" * pad_bytes)
    return SimpleUploadedFile(name, buf.getvalue(), content_type=content_type)


class MeViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com", username="original", password="TestPass123!"
        )
        self.client.force_authenticate(user=self.user)

    def test_updates_username(self):
        response = self.client.patch(ME_URL, {"username": "newname"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "newname")

    def test_uploads_valid_avatar(self):
        response = self.client.patch(
            ME_URL, {"avatar": make_image_file()}, format="multipart"
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.avatar)

    def test_rejects_oversized_avatar(self):
        big_file = make_image_file(pad_bytes=6 * 1024 * 1024)
        response = self.client.patch(ME_URL, {"avatar": big_file}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("avatar", response.data)

    def test_rejects_disallowed_content_type(self):
        gif_file = make_image_file(name="avatar.gif", fmt="GIF", content_type="image/gif")
        response = self.client.patch(ME_URL, {"avatar": gif_file}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("avatar", response.data)

    def test_rejects_non_image_file(self):
        fake_file = SimpleUploadedFile(
            "not-an-image.jpg", b"this is not image data", content_type="image/jpeg"
        )
        response = self.client.patch(ME_URL, {"avatar": fake_file}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("avatar", response.data)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.patch(ME_URL, {"username": "x"}, format="json")
        self.assertEqual(response.status_code, 401)
