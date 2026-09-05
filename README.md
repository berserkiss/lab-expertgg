# Lab Expertgg

Мобильное приложение для прогнозов на киберспортивные матчи (CS, LoL) с виртуальной валютой gg.

## Структура репозитория

```
lab-expertgg/
├── backend/     # Django + DRF API
└── mobile/      # React Native (Android)
```

## Стек

- Backend: Python / Django / Django REST Framework / PostgreSQL
- Mobile: React Native
- Хостинг: Digital Ocean (1 Droplet)
- CI/CD: GitLab CI

## Локальная разработка

### Backend

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

### Mobile

```
cd mobile
npm install
npx react-native run-android
```
