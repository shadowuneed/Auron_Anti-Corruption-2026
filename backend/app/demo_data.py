"""
Demo data generator for TechnoFilter
Generates realistic synthetic tender data for hackathon demonstration.
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict

# =============================================
# REGIONS OF KAZAKHSTAN
# =============================================
REGIONS = [
    "Алматы", "Астана", "Шымкент", "Актобе", "Караганда",
    "Павлодар", "Костанай", "Атырау", "Мангистау", "Туркестан",
    "Кызылорда", "Жамбыл", "Восточно-Казахстанская",
    "Западно-Казахстанская", "Северо-Казахстанская", "Акмолинская",
    "Улытау", "Жетісу", "Абай",
]

# =============================================
# CUSTOMER ORGANIZATIONS
# =============================================
CUSTOMERS = [
    {"name": "Управление здравоохранения г. Алматы", "tin": "123456789011", "region": "Алматы"},
    {"name": "Департамент образования Астаны", "tin": "123456789012", "region": "Астана"},
    {"name": "Акимат Туркестанской области", "tin": "123456789013", "region": "Туркестан"},
    {"name": "ГУ «Управление строительства» Караганды", "tin": "123456789014", "region": "Караганда"},
    {"name": "Управление цифровизации Актобе", "tin": "123456789015", "region": "Актобе"},
    {"name": "Департамент полиции г. Шымкент", "tin": "123456789016", "region": "Шымкент"},
    {"name": "Управление автомобильных дорог Атырау", "tin": "123456789017", "region": "Атырау"},
    {"name": "Областная больница Павлодара", "tin": "123456789018", "region": "Павлодар"},
    {"name": "Коммунальные службы Костаная", "tin": "123456789019", "region": "Костанай"},
    {"name": "Управление ЖКХ Мангистау", "tin": "123456789020", "region": "Мангистау"},
    {"name": "Министерство цифрового развития РК", "tin": "123456789021", "region": "Астана"},
    {"name": "Комитет информационной безопасности МЦР РК", "tin": "123456789022", "region": "Астана"},
    {"name": "Управление спорта Жамбылской области", "tin": "123456789023", "region": "Жамбыл"},
    {"name": "Департамент экологии Кызылорды", "tin": "123456789024", "region": "Кызылорда"},
    {"name": "Акимат города Актау", "tin": "123456789025", "region": "Мангистау"},
]

# =============================================
# WINNER COMPANIES
# =============================================
WINNERS = [
    {"name": "ТОО «КазТехСервис»", "tin": "987654321011"},
    {"name": "ТОО «Алма-IT Solutions»", "tin": "987654321012"},
    {"name": "ТОО «Smart Systems KZ»", "tin": "987654321013"},
    {"name": "ТОО «Digital Bridge Group»", "tin": "987654321014"},
    {"name": "ТОО «Инфосистемы»", "tin": "987654321015"},
    {"name": "ТОО «АстанаСтройМонтаж»", "tin": "987654321016"},
    {"name": "ТОО «ТуранКомплект»", "tin": "987654321017"},
    {"name": "ТОО «SilkWay Technologies»", "tin": "987654321018"},
    {"name": "ТОО «Национальные IT Решения»", "tin": "987654321019"},
    {"name": "ТОО «Прогресс Сервис»", "tin": "987654321020"},
]

OKED_CATEGORIES = [
    {"code": "62.01", "name": "Разработка ПО", "name_en": "Software Development"},
    {"code": "46.51", "name": "Компьютерное оборудование", "name_en": "Computer Equipment"},
    {"code": "41.20", "name": "Строительные работы", "name_en": "Construction Works"},
    {"code": "71.12", "name": "Инженерные услуги", "name_en": "Engineering Services"},
    {"code": "86.10", "name": "Медицинское оборудование", "name_en": "Medical Equipment"},
    {"code": "35.11", "name": "Электрооборудование", "name_en": "Electrical Equipment"},
    {"code": "42.11", "name": "Дорожное строительство", "name_en": "Road Construction"},
    {"code": "80.10", "name": "Охранные услуги", "name_en": "Security Services"},
    {"code": "63.11", "name": "Обработка данных", "name_en": "Data Processing"},
    {"code": "33.12", "name": "Ремонт оборудования", "name_en": "Equipment Repair"},
]

# =============================================
# TENDER TEMPLATES
# =============================================

# HIGH RISK tender texts (manipulated)
HIGH_RISK_TENDERS = [
    {
        "title": "Закупка сетевого оборудования для серверной инфраструктуры",
        "text": """Техническая спецификация: Требуется поставка межсетевого экрана Cisco ASA 5506-X 
с функцией FirePOWER. Устройство должно быть именно данной модели, замена на аналоги 
не допускается. Требуется сертификат авторизованного партнера Cisco уровня Gold. 
Срок поставки — 5 рабочих дней. Поставщик обязательно должен иметь опыт работы 
с государственными органами Туркестанской области не менее 5 лет. Требуется наличие 
сервисного центра исключительно в г. Туркестан. ISO 27001, ISO 27799, CMMI Level 5.""",
        "category": "46.51",
        "amount_range": (5_000_000, 25_000_000),
        "delivery_days": 5,
        "participants": 1,
    },
    {
        "title": "Поставка медицинского оборудования для областной больницы",
        "text": """Аппарат УЗИ Samsung Medison RS85 Prestige с конвексным датчиком CA2-9A. 
Строго данная модель. Поставщик должен иметь сертификат официального дилера Samsung Medison 
на территории РК. Опыт поставок в Павлодарскую область — не менее 3 лет. 
Гарантийное обслуживание только на базе сервисного центра в г. Павлодар. 
Срок поставки — 7 календарных дней. Наличие лицензии Министерства здравоохранения 
на ввоз медицинских изделий класса IIb.""",
        "category": "86.10",
        "amount_range": (15_000_000, 80_000_000),
        "delivery_days": 7,
        "participants": 1,
    },
    {
        "title": "Разработка информационной системы электронного документооборота",
        "text": """Система должна быть построена исключительно на платформе 1С:Предприятие 8.3. 
Разработчик должен иметь статус «1С:Франчайзи» и сертификат «1С:Специалист-консультант» 
у не менее 5 сотрудников. Интеграция только с программным обеспечением 1С:Документооборот КОРП. 
Не допускается использование альтернативных платформ. Срок выполнения — 10 рабочих дней. 
Поставщик должен иметь опыт внедрения в государственных органах Алматы не менее 7 лет.""",
        "category": "62.01",
        "amount_range": (20_000_000, 100_000_000),
        "delivery_days": 10,
        "participants": 1,
    },
    {
        "title": "Закупка системы видеонаблюдения для административных зданий",
        "text": """Камеры видеонаблюдения Hikvision DS-2CD2T47G2-L строго данной модели. 
Видеорегистраторы Hikvision DS-7732NI-K4 без альтернатив. Поставщик должен быть 
официальным дистрибьютором Hikvision в Казахстане. Монтаж и настройка только 
сертифицированными специалистами Hikvision. Гарантия — 3 года с обслуживанием 
исключительно в Атырауской области. Срок выполнения работ — 3 рабочих дня.""",
        "category": "46.51",
        "amount_range": (8_000_000, 35_000_000),
        "delivery_days": 3,
        "participants": 1,
    },
    {
        "title": "Услуги по обеспечению кибербезопасности государственной инфраструктуры",
        "text": """Требуется внедрение системы SIEM на базе решения Kaspersky KUMA. 
Альтернативные решения не рассматриваются. Поставщик обязан иметь статус 
Kaspersky Platinum Partner. Необходима сертификация FIPS 140-3, Common Criteria EAL4+. 
Специалисты должны иметь сертификаты CISSP и CISM. Опыт работы с критической 
инфраструктурой — не менее 10 лет. Срок реализации — 14 дней. Поставщик 
должен иметь офис исключительно в г. Астана.""",
        "category": "63.11",
        "amount_range": (50_000_000, 200_000_000),
        "delivery_days": 14,
        "participants": 2,
    },
]

# MEDIUM RISK tenders
MEDIUM_RISK_TENDERS = [
    {
        "title": "Поставка офисной техники для государственного учреждения",
        "text": """МФУ формата A3 со скоростью печати не менее 35 стр/мин. 
Разрешение печати не ниже 1200x1200 dpi. Дуплексная печать. Встроенный степлер. 
Поддержка PCL6 и PostScript 3. Объем подачи — не менее 2500 листов. 
Предпочтительно оборудование HP LaserJet или эквивалент. Поставщик должен иметь 
сервисный центр в регионе заказчика. Срок поставки — 20 рабочих дней. 
Гарантия не менее 2 лет.""",
        "category": "46.51",
        "amount_range": (3_000_000, 15_000_000),
        "delivery_days": 20,
        "participants": 3,
    },
    {
        "title": "Ремонт автомобильной дороги участок км 45-52",
        "text": """Ремонт асфальтобетонного покрытия методом холодной регенерации. 
Толщина покрытия — 80 мм. Марка асфальтобетона — тип Б, марка II. Подрядчик 
должен иметь лицензию на строительно-монтажные работы I категории. Опыт 
выполнения аналогичных работ — не менее 3 лет. Наличие собственной техники: 
асфальтоукладчик и каток. Срок выполнения — 30 календарных дней.""",
        "category": "42.11",
        "amount_range": (50_000_000, 300_000_000),
        "delivery_days": 30,
        "participants": 4,
    },
    {
        "title": "Закупка серверного оборудования для дата-центра",
        "text": """Сервер: 2 процессора Intel Xeon Silver 4314 или аналог. ОЗУ: 128 ГБ DDR4 ECC. 
Накопители: 4 x 1.92TB SSD SAS. RAID-контроллер с кэш-памятью 4 ГБ. 2 блока питания 
с горячей заменой. Форм-фактор: 2U rackmount. Гарантия: 3 года с заменой на следующий 
рабочий день. Сертификат поставщика серверного оборудования. Срок поставки — 25 дней.""",
        "category": "46.51",
        "amount_range": (10_000_000, 50_000_000),
        "delivery_days": 25,
        "participants": 3,
    },
]

# LOW RISK tenders (clean)
LOW_RISK_TENDERS = [
    {
        "title": "Закупка канцелярских товаров для государственного учреждения",
        "text": """Бумага формата А4, плотность 80 г/м², белизна не менее 146%. 
Ручки шариковые синие — 500 шт. Папки-регистраторы А4 — 200 шт. 
Степлеры настольные — 30 шт. Скобы для степлера — 100 упаковок. 
Маркеры текстовые — 100 шт. Корректирующая жидкость — 50 шт. 
Срок поставки — 15 рабочих дней. Поставщик должен иметь свидетельство 
о государственной регистрации.""",
        "category": "46.51",
        "amount_range": (500_000, 3_000_000),
        "delivery_days": 15,
        "participants": 8,
    },
    {
        "title": "Услуги по уборке административного здания",
        "text": """Ежедневная влажная уборка помещений общей площадью 2500 кв.м. 
Мытье окон — 2 раза в месяц. Уборка прилегающей территории. 
Количество уборщиков — не менее 5. Контракт на 12 месяцев. 
Исполнитель должен обеспечить моющие средства и инвентарь. 
Наличие опыта оказания клининговых услуг — не менее 1 года.""",
        "category": "81.21",
        "amount_range": (2_000_000, 8_000_000),
        "delivery_days": 365,
        "participants": 12,
    },
    {
        "title": "Поставка продуктов питания для школьной столовой",
        "text": """Мясо говядины — 500 кг/мес. Мясо курицы — 300 кг/мес. 
Молоко пастеризованное 3.2% — 200 л/мес. Масло сливочное — 50 кг/мес. 
Овощи свежие (картофель, морковь, лук) — 400 кг/мес. Крупы — 100 кг/мес. 
Все продукты должны иметь сертификат соответствия. Срок поставки — еженедельно. 
Контракт на учебный год.""",
        "category": "56.29",
        "amount_range": (5_000_000, 20_000_000),
        "delivery_days": 270,
        "participants": 6,
    },
    {
        "title": "Техническое обслуживание лифтового оборудования",
        "text": """Ежемесячное техническое обслуживание 12 пассажирских лифтов. 
Грузоподъемность лифтов: 400 кг и 630 кг. Проведение ежеквартального 
технического осмотра. Замена расходных материалов. Аварийное обслуживание 
с временем реагирования не более 2 часов. Исполнитель должен иметь 
лицензию на обслуживание подъемных сооружений.""",
        "category": "33.12",
        "amount_range": (3_000_000, 10_000_000),
        "delivery_days": 365,
        "participants": 5,
    },
    {
        "title": "Закупка учебников для общеобразовательных школ",
        "text": """Учебники для 1-4 классов по государственному стандарту образования РК. 
Математика, Русский язык, Қазақ тілі, Естествознание. Тираж: 5000 экземпляров. 
Формат А4, твёрдый переплёт, бумага офсетная. Соответствие утверждённому перечню 
МОН РК. Срок поставки — 30 календарных дней.""",
        "category": "58.11",
        "amount_range": (10_000_000, 30_000_000),
        "delivery_days": 30,
        "participants": 4,
    },
]


def generate_demo_tenders(count: int = 500) -> List[Dict]:
    """Generate a list of demo tenders with realistic data."""
    tenders = []
    base_date = datetime(2024, 1, 1)
    
    # Distribution: ~20% high risk, ~30% medium, ~50% low
    high_count = int(count * 0.20)
    medium_count = int(count * 0.30)
    low_count = count - high_count - medium_count

    tender_id_counter = 10000

    # Generate HIGH risk tenders
    for i in range(high_count):
        template = random.choice(HIGH_RISK_TENDERS)
        customer = random.choice(CUSTOMERS)
        # For high risk, same winner appears repeatedly
        winner = random.choice(WINNERS[:3])  # Only 3 winners for high risk = repeat pattern
        
        amount = random.uniform(*template["amount_range"])
        # Make some amounts suspiciously precise
        if random.random() > 0.5:
            amount = round(amount, 0) + random.randint(100, 999) * 100
        
        pub_date = base_date + timedelta(days=random.randint(0, 700))
        
        tenders.append({
            "tender_id": f"GZ-2024-{tender_id_counter}",
            "title": template["title"],
            "description": template["text"][:200],
            "full_text": template["text"],
            "customer_name": customer["name"],
            "customer_tin": customer["tin"],
            "winner_name": winner["name"],
            "winner_tin": winner["tin"],
            "amount": round(amount, 2),
            "region": customer["region"],
            "oked_code": template["category"],
            "category": next(
                (o["name"] for o in OKED_CATEGORIES if o["code"] == template["category"]),
                "Прочее"
            ),
            "publication_date": pub_date.isoformat(),
            "deadline_date": (pub_date + timedelta(days=template["delivery_days"] + 5)).isoformat(),
            "delivery_days": template["delivery_days"],
            "participant_count": template["participants"],
            "status": "completed",
            "expected_risk": "HIGH",
        })
        tender_id_counter += 1

    # Generate MEDIUM risk tenders
    for i in range(medium_count):
        template = random.choice(MEDIUM_RISK_TENDERS)
        customer = random.choice(CUSTOMERS)
        winner = random.choice(WINNERS)
        
        amount = random.uniform(*template["amount_range"])
        pub_date = base_date + timedelta(days=random.randint(0, 700))
        
        tenders.append({
            "tender_id": f"GZ-2024-{tender_id_counter}",
            "title": template["title"],
            "description": template["text"][:200],
            "full_text": template["text"],
            "customer_name": customer["name"],
            "customer_tin": customer["tin"],
            "winner_name": winner["name"],
            "winner_tin": winner["tin"],
            "amount": round(amount, 2),
            "region": customer["region"],
            "oked_code": template["category"],
            "category": next(
                (o["name"] for o in OKED_CATEGORIES if o["code"] == template["category"]),
                "Прочее"
            ),
            "publication_date": pub_date.isoformat(),
            "deadline_date": (pub_date + timedelta(days=template["delivery_days"] + 10)).isoformat(),
            "delivery_days": template["delivery_days"],
            "participant_count": template["participants"],
            "status": "completed",
            "expected_risk": "MEDIUM",
        })
        tender_id_counter += 1

    # Generate LOW risk tenders
    for i in range(low_count):
        template = random.choice(LOW_RISK_TENDERS)
        customer = random.choice(CUSTOMERS)
        winner = random.choice(WINNERS)
        
        amount = random.uniform(*template["amount_range"])
        amount = round(amount / 1000) * 1000  # Round to thousands (less suspicious)
        pub_date = base_date + timedelta(days=random.randint(0, 700))
        
        tenders.append({
            "tender_id": f"GZ-2024-{tender_id_counter}",
            "title": template["title"],
            "description": template["text"][:200],
            "full_text": template["text"],
            "customer_name": customer["name"],
            "customer_tin": customer["tin"],
            "winner_name": winner["name"],
            "winner_tin": winner["tin"],
            "amount": round(amount, 2),
            "region": customer["region"],
            "oked_code": template["category"],
            "category": next(
                (o["name"] for o in OKED_CATEGORIES if o["code"] == template["category"]),
                "Прочее"
            ),
            "publication_date": pub_date.isoformat(),
            "deadline_date": (pub_date + timedelta(days=template["delivery_days"] + 15)).isoformat(),
            "delivery_days": template["delivery_days"],
            "participant_count": template["participants"],
            "status": "completed",
            "expected_risk": "LOW",
        })
        tender_id_counter += 1

    random.shuffle(tenders)
    return tenders
