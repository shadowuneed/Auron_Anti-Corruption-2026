# 🛡️ TechnoFilter — AI Anti-Corruption System

<div align="center">

**AI-Powered Detection of Manipulative Specifications in Government Procurement**

*Kazakhstan National AI Hackathon — Financial Security & Anti-Corruption*

[English](#english) | [Русский](#russian) | [Қазақша](#kazakh)

</div>

---

<a name="english"></a>

## 🇬🇧 English

### Problem

Government procurement in Kazakhstan amounts to **~5 trillion KZT annually**. A significant portion of tenders contain technical specifications deliberately crafted to favor a single pre-selected vendor, eliminating fair competition. This is one of the most common and hardest-to-prove forms of corruption.

### Solution

**TechnoFilter** is a hybrid AI system that automatically analyzes tender documents and detects manipulation patterns:

- 🔍 **Brand Lock Detection** — Finds brand/model-specific requirements designed to exclude competitors
- ⏱️ **Timeline Analysis** — Detects unrealistic delivery deadlines only achievable by one supplier
- 📜 **Certification Screening** — Identifies excessive or niche certification requirements
- 💰 **Financial Analysis** — Flags suspiciously precise pricing that matches specific vendors
- 👤 **Competition Analysis** — Detects single-bid tenders and repeat winner patterns
- 📝 **Linguistic Analysis** — Identifies obfuscation through complex language

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Data Source    │────▶│  Backend (API)   │────▶│    Frontend      │
│  goszakup.gov.kz│     │  FastAPI + ML    │     │  React + Charts  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Risk Analysis    │
                    │  Engine           │
                    │  • Rule-based     │
                    │  • Feature Ext.   │
                    │  • NLP Pipeline   │
                    └───────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy, SQLite/PostgreSQL |
| ML/AI | scikit-learn, XGBoost, SHAP, spaCy, NLP |
| Frontend | React, TypeScript, Tailwind CSS, Recharts |
| DevOps | Docker, docker-compose, Vite |

### Quick Start

#### Option 1: Run locally (recommended for demo)

**Backend:**
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

#### Option 2: Docker
```bash
docker-compose up --build
```

#### Option 3: Windows batch
```
Double-click START.bat
```

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation (Swagger)**: http://localhost:8000/docs

### Pages

1. **Dashboard** — Risk overview with KPI cards, charts, heatmap
2. **Analyze Tender** — Paste text to get instant AI risk analysis
3. **Tender Database** — Browse/filter all analyzed tenders
4. **Analytics** — Deep charts: trends, regions, flag types
5. **About** — Project description and methodology

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/analyze` | Analyze tender text for risk |
| GET | `/api/v1/tenders` | List tenders (paginated, filtered) |
| GET | `/api/v1/tenders/{id}` | Get tender details with flags |
| GET | `/api/v1/stats/dashboard` | Dashboard statistics |
| GET | `/api/v1/customers/{tin}/risk-profile` | Customer risk profile |
| POST | `/api/v1/feedback` | Submit analyst feedback |

### Risk Scoring

Each tender receives a **composite risk score (0-100)** based on weighted signals:

| Risk Level | Score | Action |
|-----------|-------|--------|
| 🟢 LOW | 0-24 | Standard process |
| 🟡 MEDIUM | 25-49 | Review recommended |
| 🔴 HIGH | 50-74 | Manual review required |
| ⚫ CRITICAL | 75-100 | Immediate investigation |

---

<a name="russian"></a>

## 🇷🇺 Русский

### Проблема

Объём государственных закупок в Казахстане составляет **~5 трлн тенге в год**. Значительная часть тендеров содержит технические спецификации, намеренно составленные в пользу одного заранее выбранного поставщика, что исключает честную конкуренцию.

### Решение

**TechnoFilter** — гибридная ИИ-система, автоматически анализирующая тендерные документы и обнаруживающая паттерны манипуляций:

- 🔍 **Привязка к бренду** — Обнаружение требований к конкретным маркам/моделям
- ⏱️ **Анализ сроков** — Нереально короткие сроки поставки
- 📜 **Сертификация** — Избыточные или нишевые требования к сертификатам
- 💰 **Финансовый анализ** — Подозрительно точные суммы контрактов
- 👤 **Конкуренция** — Тендеры с одним участником, повторные победители
- 📝 **Лингвистика** — Намеренное усложнение языка спецификаций

### Быстрый старт

```bash
# Бэкенд
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload

# Фронтенд (в другом терминале)
cd frontend
npm install
npm run dev
```

Или запустите `START.bat` для автоматического старта.

### Страницы

1. **Панель управления** — Обзор рисков, графики, KPI
2. **Анализ тендера** — Вставьте текст для мгновенного анализа
3. **База тендеров** — Просмотр и фильтрация тендеров
4. **Аналитика** — Глубокие графики по регионам, отраслям
5. **О системе** — Описание проекта и методологии

---

<a name="kazakh"></a>

## 🇰🇿 Қазақша

### Мәселе

Қазақстандағы мемлекеттік сатып алу көлемі **жылына ~5 трлн теңгені** құрайды. Тендерлердің елеулі бөлігі алдын ала таңдалған жеткізушіге арналған техникалық спецификацияларды қамтиды, бұл әділ бәсекелестікті жояды.

### Шешім

**TechnoFilter** — тендерлік құжаттарды автоматты түрде талдайтын және манипуляция заңдылықтарын анықтайтын гибридті ЖИ жүйесі:

- 🔍 **Брендке байлау** — Бәсекелестерді шығаруға арналған нақты бренд/модельге қойылатын талаптарды анықтау
- ⏱️ **Мерзімдер талдауы** — Тек бір жеткізуші орындай алатын шынайы емес мерзімдерді анықтау
- 📜 **Сертификаттау** — Артық немесе тар сертификат талаптарын анықтау
- 💰 **Қаржылық талдау** — Нақты жеткізушілерге сәйкес келетін күдікті баға белгілеу
- 👤 **Бәсекелестік** — Жалғыз қатысушы тендерлері, қайталанатын жеңімпаздар
- 📝 **Лингвистикалық** — Күрделі тіл арқылы бұрмалау

### Жылдам бастау

```bash
# Бэкенд
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload

# Фронтенд (басқа терминалда)
cd frontend
npm install
npm run dev
```

Немесе автоматты іске қосу үшін `START.bat` іске қосыңыз.

### Беттер

1. **Басқару тақтасы** — Тәуекелдерге шолу, графиктер, KPI
2. **Тендерді талдау** — Мәтінді қойып, лезде талдау алыңыз
3. **Тендерлер базасы** — Тендерлерді қарау және сүзу
4. **Аналитика** — Аймақтар, салалар бойынша терең графиктер
5. **Жүйе туралы** — Жоба сипаттамасы мен әдістемесі

---

## 📊 Impact Metrics / Көрсеткіштер

- **500+** tenders analyzed / талданған тендерлер
- **100+** high-risk cases flagged / жоғары тәуекелді жағдайлар
- **~₸2B+** value at risk identified / анықталған тәуекелдегі сома
- **< 5 sec** analysis per tender / тендерге талдау жылдамдығы

---

## 📜 License

MIT License — Built for Kazakhstan AI Hackathon 2026

