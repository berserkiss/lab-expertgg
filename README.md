# Lab Expertgg

A mobile app for predicting esports matches (CS, LoL), where you bet with a
virtual in-app currency called gg.

## Repository structure

```
lab-expertgg/
├── backend/     # Django + DRF API
└── mobile/      # React Native (Android)
```

## Stack

- Backend: Python / Django / Django REST Framework / PostgreSQL
- Mobile: React Native
- Hosting: Digital Ocean (1 Droplet)
- CI/CD: GitLab CI (primary), plus a mirrored GitHub Actions workflow

## Local development

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

### Mobile

```bash
cd mobile
npm install
npx react-native run-android
```
