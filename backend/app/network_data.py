"""
Demo network data generator for TechnoFilter.
Creates realistic financial flow networks between government entities,
companies, intermediaries, and offshore entities.
Now also generates contract documents backing each flow.
"""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Tuple

# =============================================
# GEOGRAPHIC COORDINATES FOR ENTITIES
# =============================================

KZ_CITIES = {
    "Астана": (51.1694, 71.4491),
    "Алматы": (43.2220, 76.8512),
    "Шымкент": (42.3417, 69.5901),
    "Караганда": (49.8047, 73.1094),
    "Актобе": (50.2839, 57.1670),
    "Туркестан": (43.3019, 68.2514),
    "Атырау": (47.1065, 51.9032),
    "Павлодар": (52.2873, 76.9674),
    "Костанай": (53.2198, 63.6354),
    "Мангистау": (43.3480, 52.0673),
    "Кызылорда": (44.8488, 65.5022),
    "Жамбыл": (42.9000, 71.3785),
    "Семей": (50.4263, 80.2276),
    "Актау": (43.6353, 51.1688),
    "Талдыкорган": (45.0153, 78.3931),
}

WORLD_CITIES = {
    "Dubai, UAE": (25.2048, 55.2708),
    "London, UK": (51.5074, -0.1278),
    "Zurich, Switzerland": (47.3769, 8.5417),
    "Singapore": (1.3521, 103.8198),
    "Hong Kong": (22.3193, 114.1694),
    "Istanbul, Turkey": (41.0082, 28.9784),
    "Moscow, Russia": (55.7558, 37.6173),
    "Beijing, China": (39.9042, 116.4074),
    "Tbilisi, Georgia": (41.7151, 44.8271),
    "Bishkek, Kyrgyzstan": (42.8746, 74.5698),
    "Tashkent, Uzbekistan": (41.2995, 69.2401),
    "Panama City, Panama": (8.9824, -79.5199),
    "Nicosia, Cyprus": (35.1856, 33.3823),
    "Cayman Islands": (19.3133, -81.2546),
}

# =============================================
# ENTITY TEMPLATES
# =============================================

GOVERNMENT_ENTITIES = [
    {"name": "Управление здравоохранения г. Алматы", "region": "Алматы", "type": "government", "bin": "050240000123", "ceo": "Ахметов Серік Нұрланұлы", "ceo_iin": "850415300123", "founded": 2005, "employees": 340, "suspicion": "Систематическое завышение цен при закупке медоборудования"},
    {"name": "Департамент образования Астаны", "region": "Астана", "type": "government", "bin": "060140000456", "ceo": "Жумабаев Арман Қайратұлы", "ceo_iin": "780320400456", "founded": 2000, "employees": 450, "suspicion": ""},
    {"name": "Акимат Туркестанской области", "region": "Туркестан", "type": "government", "bin": "070340000789", "ceo": "Тілеуберді Ерболат Мұратұлы", "ceo_iin": "820115500789", "founded": 2018, "employees": 1200, "suspicion": "Выявлены признаки аффилированности с подрядчиками строительных проектов"},
    {"name": "ГУ «Управление строительства» Караганды", "region": "Караганда", "type": "government", "bin": "080440001012", "ceo": "Касымов Дәулет Ерланұлы", "ceo_iin": "900612600012", "founded": 2010, "employees": 280, "suspicion": ""},
    {"name": "Управление цифровизации Актобе", "region": "Актобе", "type": "government", "bin": "090540001345", "ceo": "Нурпеисов Бакыт Серікұлы", "ceo_iin": "880730700345", "founded": 2019, "employees": 95, "suspicion": ""},
    {"name": "Департамент полиции г. Шымкент", "region": "Шымкент", "type": "government", "bin": "100640001678", "ceo": "Сұлтанов Мұхтар Әлиұлы", "ceo_iin": "760425800678", "founded": 1999, "employees": 2800, "suspicion": ""},
    {"name": "Управление автодорог Атырау", "region": "Атырау", "type": "government", "bin": "110740001901", "ceo": "Жәнібеков Ержан Бауыржанұлы", "ceo_iin": "830916900901", "founded": 2008, "employees": 520, "suspicion": "Неоднократное превышение смет при ремонте дорог на 30-50%"},
    {"name": "Областная больница Павлодара", "region": "Павлодар", "type": "government", "bin": "120840002234", "ceo": "Омаров Қанат Сейілханұлы", "ceo_iin": "790301100234", "founded": 1970, "employees": 1800, "suspicion": ""},
    {"name": "Министерство цифрового развития РК", "region": "Астана", "type": "government", "bin": "130940002567", "ceo": "Мұқанов Асхат Бағланұлы", "ceo_iin": "850617200567", "founded": 2019, "employees": 650, "suspicion": ""},
    {"name": "Комитет информационной безопасности", "region": "Астана", "type": "government", "bin": "141040002890", "ceo": "Ибраев Тимур Маратұлы", "ceo_iin": "870222300890", "founded": 2020, "employees": 180, "suspicion": ""},
    {"name": "Управление ЖКХ Мангистау", "region": "Мангистау", "type": "government", "bin": "151140003123", "ceo": "Кәрімов Нұрлан Сәбитұлы", "ceo_iin": "810508400123", "founded": 2012, "employees": 380, "suspicion": "Подозрение в завышении смет на коммунальные проекты"},
    {"name": "Акимат Кызылординской области", "region": "Кызылорда", "type": "government", "bin": "161240003456", "ceo": "Байғабылов Серік Мұратұлы", "ceo_iin": "840715500456", "founded": 2000, "employees": 950, "suspicion": ""},
]

COMPANY_ENTITIES = [
    {"name": "ТОО «КазТехСервис»", "region": "Алматы", "type": "company", "bin": "180140100001", "ceo": "Тұрсынов Алмас Маратұлы", "ceo_iin": "900115100001", "founded": 2015, "employees": 85, "suspicion": "Выиграл 12 тендеров у одного заказчика за год, CEO — родственник чиновника"},
    {"name": "ТОО «Алма-IT Solutions»", "region": "Алматы", "type": "company", "bin": "190240100002", "ceo": "Мәдиев Рүстем Ерланұлы", "ceo_iin": "920320200002", "founded": 2018, "employees": 45, "suspicion": "Зарегистрирована за 2 месяца до крупного тендера на 500М тенге"},
    {"name": "ТОО «Smart Systems KZ»", "region": "Астана", "type": "company", "bin": "200340100003", "ceo": "Исаев Данияр Бауыржанұлы", "ceo_iin": "870425300003", "founded": 2016, "employees": 120, "suspicion": ""},
    {"name": "ТОО «Digital Bridge Group»", "region": "Астана", "type": "company", "bin": "210440100004", "ceo": "Нұрғалиев Тимур Серікұлы", "ceo_iin": "880530400004", "founded": 2017, "employees": 75, "suspicion": "Систематически получает субподряды от аффилированных компаний"},
    {"name": "ТОО «Инфосистемы»", "region": "Караганда", "type": "company", "bin": "220540100005", "ceo": "Бекбауов Асхан Қайратұлы", "ceo_iin": "850615500005", "founded": 2010, "employees": 200, "suspicion": ""},
    {"name": "ТОО «АстанаСтройМонтаж»", "region": "Астана", "type": "company", "bin": "230640100006", "ceo": "Жұмағалиев Нұрлан Ерболұлы", "ceo_iin": "800720600006", "founded": 2012, "employees": 350, "suspicion": "На 100М тендере закупил материалы лишь на 25М — где остальные 75М?"},
    {"name": "ТОО «ТуранКомплект»", "region": "Шымкент", "type": "company", "bin": "240740100007", "ceo": "Шәкіров Бақтияр Маратұлы", "ceo_iin": "910825700007", "founded": 2019, "employees": 30, "suspicion": "Компания без сотрудников победила тендер на 200М — признаки фиктивности"},
    {"name": "ТОО «SilkWay Technologies»", "region": "Алматы", "type": "company", "bin": "250840100008", "ceo": "Кенжебаев Арман Тұрсынұлы", "ceo_iin": "860930800008", "founded": 2014, "employees": 95, "suspicion": ""},
    {"name": "ТОО «Прогресс Сервис»", "region": "Актобе", "type": "company", "bin": "260940100009", "ceo": "Байсалов Ерлан Мұхтарұлы", "ceo_iin": "881035900009", "founded": 2013, "employees": 60, "suspicion": ""},
    {"name": "ТОО «Национальные IT Решения»", "region": "Астана", "type": "company", "bin": "271040100010", "ceo": "Аманов Жандос Серікұлы", "ceo_iin": "930140010010", "founded": 2020, "employees": 25, "suspicion": "Выиграл тендер на 70М, закупки лишь на 20М. CEO летал в Дубай 5 раз за квартал"},
    {"name": "ТОО «МедТехПоставка»", "region": "Алматы", "type": "company", "bin": "281140100011", "ceo": "Оразов Қуат Болатұлы", "ceo_iin": "870245110011", "founded": 2009, "employees": 110, "suspicion": ""},
    {"name": "ТОО «GlobalBuild KZ»", "region": "Караганда", "type": "company", "bin": "291240100012", "ceo": "Сатыбалдиев Ержан Нұрланұлы", "ceo_iin": "891350120012", "founded": 2017, "employees": 180, "suspicion": ""},
    {"name": "ТОО «ЭнергоСнаб»", "region": "Атырау", "type": "company", "bin": "301340100013", "ceo": "Мұхамеджанов Ғалым Бағланұлы", "ceo_iin": "840455130013", "founded": 2011, "employees": 230, "suspicion": "Регулярные переводы в оффшоры после получения госконтрактов"},
    {"name": "ТОО «БайтерекИнвест»", "region": "Астана", "type": "company", "bin": "311440100014", "ceo": "Досанов Берік Сәбитұлы", "ceo_iin": "820560140014", "founded": 2016, "employees": 40, "suspicion": ""},
    {"name": "ТОО «КаспийСервисГруп»", "region": "Мангистау", "type": "company", "bin": "321540100015", "ceo": "Қалиев Дәурен Маратұлы", "ceo_iin": "900665150015", "founded": 2018, "employees": 55, "suspicion": ""},
]

INTERMEDIARY_ENTITIES = [
    {"name": "Intermed Consulting LLP", "region": "Алматы", "type": "intermediary", "bin": "330140200001", "ceo": "Smith James Richard", "ceo_iin": "", "founded": 2019, "employees": 5, "suspicion": "Фиктивная фирма-посредник, 90% оборота уходит в оффшоры"},
    {"name": "Central Asia Trade Corp", "region": "Астана", "type": "intermediary", "bin": "340240200002", "ceo": "Ким Виктор Александрович", "ceo_iin": "850330200002", "founded": 2020, "employees": 8, "suspicion": "Транзитная компания, CEO — номинал"},
    {"name": "Silk Route Advisory", "region": "Алматы", "type": "intermediary", "bin": "350340200003", "ceo": "Волков Андрей Петрович", "ceo_iin": "870440300003", "founded": 2021, "employees": 3, "suspicion": "Зарегистрирована на подставное лицо"},
    {"name": "Steppe Capital Partners", "region": "Астана", "type": "intermediary", "bin": "360440200004", "ceo": "Хасанов Рашид Ильдарович", "ceo_iin": "880550400004", "founded": 2018, "employees": 12, "suspicion": ""},
    {"name": "Nomad Financial Services", "region": "Алматы", "type": "intermediary", "bin": "370540200005", "ceo": "Brown Michael L.", "ceo_iin": "", "founded": 2020, "employees": 4, "suspicion": "Все поступления в течение 48ч перечисляются в Дубай"},
    {"name": "Aral Consulting Group", "region": "Кызылорда", "type": "intermediary", "bin": "380640200006", "ceo": "Сәдуақасов Мәди Ержанұлы", "ceo_iin": "910660600006", "founded": 2022, "employees": 2, "suspicion": "Компания из 2 человек получает контракты на десятки миллионов"},
]

OFFSHORE_ENTITIES = [
    {"name": "GulfStream Holdings Ltd", "city": "Dubai, UAE", "type": "offshore"},
    {"name": "Zenith Capital Partners", "city": "London, UK", "type": "offshore"},
    {"name": "Alpine Asset Management AG", "city": "Zurich, Switzerland", "type": "offshore"},
    {"name": "Pacific Rim Trading Pte", "city": "Singapore", "type": "offshore"},
    {"name": "Silk Road Ventures HK", "city": "Hong Kong", "type": "offshore"},
    {"name": "Bosporus Trade Corp", "city": "Istanbul, Turkey", "type": "offshore"},
    {"name": "Eurasia Investments LLC", "city": "Moscow, Russia", "type": "offshore"},
    {"name": "Dragon Gate Holdings", "city": "Beijing, China", "type": "offshore"},
    {"name": "Black Sea Financial Ltd", "city": "Tbilisi, Georgia", "type": "offshore"},
    {"name": "Central Holdings Ltd", "city": "Nicosia, Cyprus", "type": "offshore"},
    {"name": "Pacific Shell Corp", "city": "Panama City, Panama", "type": "offshore"},
    {"name": "Island Capital Ltd", "city": "Cayman Islands", "type": "offshore"},
]

FLOW_TYPES = [
    "contract_payment",
    "subcontract",
    "consulting_fee",
    "equipment_purchase",
    "service_fee",
    "donation",
    "investment",
    "loan",
    "commission",
    "unknown",
    "flight",
    "purchase",
    "cash_out",
    "director",
    "founder",
    "relative",
]

CONTRACT_TITLES = [
    "Поставка медицинского оборудования",
    "Услуги по разработке информационной системы",
    "Строительство административного здания",
    "Ремонт автомобильных дорог",
    "Поставка компьютерной техники",
    "Услуги по техническому обслуживанию",
    "Поставка лабораторного оборудования",
    "Консалтинговые услуги по цифровизации",
    "Строительно-монтажные работы",
    "Поставка серверного оборудования",
    "Услуги по информационной безопасности",
    "Поставка офисной мебели",
    "Модернизация инженерных сетей",
    "Разработка программного обеспечения",
    "Поставка медикаментов",
    "Установка систем видеонаблюдения",
    "Услуги по проектированию",
    "Поставка строительных материалов",
    "Техническое обследование зданий",
    "Обслуживание IT-инфраструктуры",
]

BUDGET_CODES = ["011", "012", "021", "031", "041", "051", "061", "071", "091", "111"]

SUSPICIOUS_NOTES = [
    "Сумма оплаты превышает контрактную стоимость на {pct}%",
    "Подрядчик зарегистрирован за 3 месяца до подписания контракта",
    "Единственный участник тендера",
    "Контракт заключен без проведения тендера",
    "Субподрядчик аффилирован с заказчиком",
    "Услуги не были фактически оказаны",
    "Дублирование оплат по одному контракту",
    "Несоответствие спецификации закупленного оборудования",
    "Оплата выполнена до подписания акта приемки",
    "Круговое движение средств через посредника",
]


def generate_network_data() -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """
    Generate network entities, money flows, and contract documents.
    Returns (entities, flows, documents).
    """
    entities = []
    flows = []
    documents = []
    entity_counter = 1
    flow_counter = 1
    doc_counter = 1
    entity_map = {}  # entity_id -> entity dict

    # --- Create government entities ---
    for gov in GOVERNMENT_ENTITIES:
        coords = KZ_CITIES.get(gov["region"], (48.0, 68.0))
        eid = f"GOV-{entity_counter:03d}"
        has_suspicion = bool(gov.get("suspicion", "").strip())
        entity = {
            "entity_id": eid,
            "name": gov["name"],
            "entity_type": "government",
            "region": gov["region"],
            "country": "Kazakhstan",
            "lat": coords[0] + random.uniform(-0.2, 0.2),
            "lng": coords[1] + random.uniform(-0.2, 0.2),
            # Risk score consistent with suspicion data
            "risk_score": random.uniform(55, 85) if has_suspicion else random.uniform(5, 30),
            "total_inflow": 0,
            "total_outflow": 0,
            "transaction_count": 0,
            "is_suspicious": has_suspicion,
            "bin": gov.get("bin", ""),
            "ceo_name": gov.get("ceo", ""),
            "ceo_iin": gov.get("ceo_iin", ""),
            "founded_year": gov.get("founded", 0),
            "employee_count": gov.get("employees", 0),
            "suspicion_summary": gov.get("suspicion", ""),
        }
        entities.append(entity)
        entity_map[eid] = entity
        entity_counter += 1

    # --- Create company entities ---
    for comp in COMPANY_ENTITIES:
        coords = KZ_CITIES.get(comp["region"], (48.0, 68.0))
        eid = f"COM-{entity_counter:03d}"
        tender_won = random.uniform(50_000_000, 500_000_000) if random.random() > 0.3 else 0
        actual_spent = tender_won * random.uniform(0.2, 0.7) if tender_won > 0 else 0
        has_suspicion = bool(comp.get("suspicion", "").strip())
        entity = {
            "entity_id": eid,
            "name": comp["name"],
            "entity_type": "company",
            "region": comp["region"],
            "country": "Kazakhstan",
            "lat": coords[0] + random.uniform(-0.3, 0.3),
            "lng": coords[1] + random.uniform(-0.3, 0.3),
            # Only mark suspicious if they have actual suspicion text
            "risk_score": random.uniform(60, 90) if has_suspicion else random.uniform(8, 40),
            "total_inflow": 0,
            "total_outflow": 0,
            "transaction_count": 0,
            "is_suspicious": has_suspicion,
            "bin": comp.get("bin", ""),
            "ceo_name": comp.get("ceo", ""),
            "ceo_iin": comp.get("ceo_iin", ""),
            "founded_year": comp.get("founded", 0),
            "employee_count": comp.get("employees", 0),
            "suspicion_summary": comp.get("suspicion", ""),
            "tender_won_amount": round(tender_won, 2),
            "actual_spent_amount": round(actual_spent, 2),
        }
        entities.append(entity)
        entity_map[eid] = entity
        entity_counter += 1

    # --- Create intermediary entities ---
    for inter in INTERMEDIARY_ENTITIES:
        coords = KZ_CITIES.get(inter["region"], (48.0, 68.0))
        eid = f"INT-{entity_counter:03d}"
        has_suspicion = bool(inter.get("suspicion", "").strip())
        entity = {
            "entity_id": eid,
            "name": inter["name"],
            "entity_type": "intermediary",
            "region": inter["region"],
            "country": "Kazakhstan",
            "lat": coords[0] + random.uniform(-0.2, 0.2),
            "lng": coords[1] + random.uniform(-0.2, 0.2),
            # Intermediaries: naturally higher risk but not all suspicious
            "risk_score": random.uniform(65, 95) if has_suspicion else random.uniform(25, 55),
            "total_inflow": 0,
            "total_outflow": 0,
            "transaction_count": 0,
            "is_suspicious": has_suspicion,
            "bin": inter.get("bin", ""),
            "ceo_name": inter.get("ceo", ""),
            "ceo_iin": inter.get("ceo_iin", ""),
            "founded_year": inter.get("founded", 0),
            "employee_count": inter.get("employees", 0),
            "suspicion_summary": inter.get("suspicion", ""),
        }
        entities.append(entity)
        entity_map[eid] = entity
        entity_counter += 1

    # --- Create offshore entities ---
    for off in OFFSHORE_ENTITIES:
        coords = WORLD_CITIES.get(off["city"], (30.0, 50.0))
        eid = f"OFF-{entity_counter:03d}"
        entity = {
            "entity_id": eid,
            "name": off["name"],
            "entity_type": "offshore",
            "region": off["city"],
            "country": off["city"].split(", ")[-1] if ", " in off["city"] else off["city"],
            "lat": coords[0],
            "lng": coords[1],
            "risk_score": random.uniform(60, 100),
            "total_inflow": 0,
            "total_outflow": 0,
            "transaction_count": 0,
            "is_suspicious": True,
            "bin": "",
            "ceo_name": "",
            "ceo_iin": "",
            "founded_year": 0,
            "employee_count": 0,
            "suspicion_summary": "Офшорная юрисдикция — высокий риск отмывания",
        }
        entities.append(entity)
        entity_map[eid] = entity
        entity_counter += 1

    # Collect entity ids by type
    gov_ids = [e["entity_id"] for e in entities if e["entity_type"] == "government"]
    com_ids = [e["entity_id"] for e in entities if e["entity_type"] == "company"]
    int_ids = [e["entity_id"] for e in entities if e["entity_type"] == "intermediary"]
    off_ids = [e["entity_id"] for e in entities if e["entity_type"] == "offshore"]

    # --- Create individual / natural-person (NP) entities ---
    # suspicion = "" means the person is clean; non-empty means corrupt/under investigation
    INDIVIDUALS = [
        {"name": "Сейткали Арман Нурланұлы",    "iin": "850415300123", "role": "Директор",   "link_to": 0, "link_type": "director",  "suspicion": "Подозревается в сговоре при тендерах ГПО-2024"},
        {"name": "Ахметова Зарина Талгатовна",   "iin": "900824400567", "role": "Учредитель", "link_to": 1, "link_type": "founder",   "suspicion": ""},
        {"name": "Жаксыбеков Марат Ильясович",   "iin": "780310300789", "role": "Директор",   "link_to": 2, "link_type": "director",  "suspicion": ""},
        {"name": "Нурланов Данияр Сериккалиевич", "iin": "920617450112", "role": "Родственник","link_to": 0, "link_type": "relative",  "suspicion": "Родственник чиновника, получил контракт на ₸180 млн без конкурса"},
        {"name": "Байжанов Руслан Казбекович",    "iin": "870920300234", "role": "Учредитель", "link_to": 3, "link_type": "founder",   "suspicion": "Учредитель офшорных структур, связанных с гос.контрактами"},
        {"name": "Дюсебаева Айгуль Расуловна",    "iin": "950102400345", "role": "Директор",   "link_to": 4, "link_type": "director",  "suspicion": ""},
        {"name": "Ергалиев Бауыржан Рамазанович", "iin": "800715300678", "role": "Родственник","link_to": 1, "link_type": "relative",  "suspicion": "Родственник депутата, бенефициар ТОО получившего 3 гос.контракта"},
        {"name": "Смагулова Гульнара Асхатовна",  "iin": "880228400901", "role": "Учредитель", "link_to": 2, "link_type": "founder",   "suspicion": ""},
        {"name": "Касымов Еркебулан Жанатович",   "iin": "910505300456", "role": "Директор",   "link_to": 3, "link_type": "director",  "suspicion": ""},
        {"name": "Абдикаримова Лейла Санжаровна", "iin": "960920400678", "role": "Родственник","link_to": 4, "link_type": "relative",  "suspicion": "Сестра акима, фигурирует в схеме завышения смет на ₸95 млн"},
    ]

    np_ids = []
    for person in INDIVIDUALS:
        coords = KZ_CITIES.get("Астана", (51.18, 71.45))
        eid = f"NP-{entity_counter:03d}"
        # Link to a com_id by index
        linked_company = com_ids[person["link_to"] % len(com_ids)] if com_ids else None
        has_suspicion = bool(person.get("suspicion", "").strip())
        entity = {
            "entity_id": eid,
            "name": person["name"],
            "entity_type": "individual",
            "region": "Астана",
            "country": "Kazakhstan",
            "lat": coords[0] + random.uniform(-1.5, 1.5),
            "lng": coords[1] + random.uniform(-1.5, 1.5),
            "risk_score": random.uniform(65, 95) if has_suspicion else random.uniform(8, 38),
            "total_inflow": 0, "total_outflow": 0, "transaction_count": 0,
            "is_suspicious": has_suspicion,
            "bin": "", "ceo_name": "", "ceo_iin": person["iin"],
            "founded_year": 0, "employee_count": 0,
            "suspicion_summary": person.get("suspicion", ""),
        }
        entities.append(entity)
        entity_map[eid] = entity
        np_ids.append((eid, linked_company, person["link_type"]))
        entity_counter += 1

    base_date = datetime(2024, 1, 1)

    # --- Pattern 0: Director / Founder / Relative connections (NP → Company) ---
    for (np_eid, comp_eid, rel_type) in np_ids:
        if not comp_eid:
            continue
        flow_date = base_date + timedelta(days=random.randint(0, 400))
        fid = f"FLW-{flow_counter:04d}"
        np_entity = entity_map[np_eid]
        comp_entity = entity_map[comp_eid]
        rel_labels = {"director": "Директор компании", "founder": "Учредитель компании", "relative": "Родственная связь"}
        desc = f"{rel_labels.get(rel_type, rel_type)}: {np_entity['name']} → {comp_entity['name']}"
        flows.append({
            "flow_id": fid, "source_id": np_eid, "target_id": comp_eid,
            "amount": 0.0, "flow_date": flow_date.isoformat(),
            "description": desc,
            "document_id": None, "is_suspicious": True,
            "risk_score": random.uniform(55, 90), "flow_type": rel_type,
            "tender_id": None
        })
        flow_counter += 1



    def make_document(src_eid, tgt_eid, amount, flow_date, is_suspicious, tender_id=None, flow_type="contract_payment"):
        """Helper to generate a contract document for a flow."""
        nonlocal doc_counter
        src_e = entity_map[src_eid]
        tgt_e = entity_map[tgt_eid]

        contract_amount = amount
        if is_suspicious:
            discrepancy = random.uniform(5, 45)
            actual_paid = contract_amount * (1 + discrepancy / 100)
        else:
            discrepancy = random.uniform(0, 3)
            actual_paid = contract_amount * (1 + discrepancy / 100)

        signed = flow_date - timedelta(days=random.randint(5, 60))
        end = flow_date + timedelta(days=random.randint(30, 365))

        doc_type_map = {
            "contract_payment": "contract", "subcontract": "contract",
            "consulting_fee": "invoice", "equipment_purchase": "contract",
            "service_fee": "invoice", "investment": "supplement",
            "loan": "supplement", "commission": "invoice", "unknown": "act",
        }

        did = f"DOC-{doc_counter:04d}"
        lot_id = f"LOT-{random.randint(100000, 999999)}" if tender_id else ""
        risk_note = ""
        if is_suspicious:
            risk_note = random.choice(SUSPICIOUS_NOTES).format(pct=f"{discrepancy:.1f}")

        doc = {
            "doc_id": did,
            "contract_number": f"ДГЗ-{random.randint(2024,2025)}/{random.randint(1000,9999)}",
            "title": random.choice(CONTRACT_TITLES),
            "document_type": doc_type_map.get(flow_type, "contract"),
            "customer_name": src_e["name"],
            "customer_bin": src_e.get("bin", ""),
            "contractor_name": tgt_e["name"],
            "contractor_bin": tgt_e.get("bin", ""),
            "contract_amount": round(contract_amount, 2),
            "actual_paid": round(actual_paid, 2),
            "budget_code": random.choice(BUDGET_CODES),
            "goszakup_url": f"https://goszakup.gov.kz/ru/announce/index/{random.randint(100000,999999)}" if tender_id else "",
            "goszakup_lot_id": lot_id,
            "signed_date": signed.isoformat(),
            "start_date": signed.isoformat(),
            "end_date": end.isoformat(),
            "region": src_e["region"],
            "status": random.choice(["active", "completed", "completed", "completed"]),
            "description": f"{src_e['name']} → {tgt_e['name']}",
            "risk_notes": risk_note,
            "is_suspicious": is_suspicious,
            "discrepancy_percent": round(discrepancy, 2),
        }
        documents.append(doc)
        doc_counter += 1
        return did

    # --- Pattern 1: Government → Company (contract payments) ---
    # Only 20 flows — suspicious only if the target company actually has suspicion data
    for _ in range(20):
        src = random.choice(gov_ids)
        tgt = random.choice(com_ids)
        amount = random.uniform(5_000_000, 200_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        tgt_entity = entity_map[tgt]
        is_sus = tgt_entity.get("is_suspicious", False) and random.random() > 0.3
        tender_id = f"GZ-2024-{random.randint(10000,19999)}"
        fid = f"FLW-{flow_counter:04d}"
        doc_id = make_document(src, tgt, amount, flow_date, is_sus, tender_id, "contract_payment")
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": f"Оплата госконтракта {tender_id}",
            "tender_id": tender_id, "document_id": doc_id,
            "is_suspicious": is_sus, "risk_score": random.uniform(60, 90) if is_sus else random.uniform(5, 40),
            "flow_type": "contract_payment",
        })
        entity_map[src]["total_outflow"] += amount
        entity_map[tgt]["total_inflow"] += amount
        entity_map[src]["transaction_count"] += 1
        entity_map[tgt]["transaction_count"] += 1
        flow_counter += 1

    # --- Pattern 2: Company → Intermediary (suspicious subcontracts) ---
    # Only 10 flows — only from suspicious companies
    sus_com_ids = [cid for cid in com_ids if entity_map[cid].get("is_suspicious", False)]
    for _ in range(min(10, len(sus_com_ids) * 3)):
        src = random.choice(sus_com_ids) if sus_com_ids else random.choice(com_ids)
        tgt = random.choice(int_ids)
        amount = random.uniform(2_000_000, 50_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        ftype = random.choice(["subcontract", "consulting_fee", "service_fee"])
        fid = f"FLW-{flow_counter:04d}"
        doc_id = make_document(src, tgt, amount, flow_date, True, None, ftype)
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": "Консалтинговые услуги / субподряд",
            "document_id": doc_id, "is_suspicious": True,
            "risk_score": random.uniform(55, 90), "flow_type": ftype,
        })
        entity_map[src]["total_outflow"] += amount
        entity_map[tgt]["total_inflow"] += amount
        entity_map[src]["transaction_count"] += 1
        entity_map[tgt]["transaction_count"] += 1
        flow_counter += 1

    # --- Pattern 3: Intermediary → Offshore (money laundering) ---
    # Reduce to 8: only suspicious intermediaries
    sus_int_ids = [iid for iid in int_ids if entity_map[iid].get("is_suspicious", False)]
    for _ in range(min(8, max(1, len(sus_int_ids) * 2))):
        src = random.choice(sus_int_ids) if sus_int_ids else random.choice(int_ids)
        tgt = random.choice(off_ids)
        amount = random.uniform(5_000_000, 100_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        ftype = random.choice(["investment", "loan", "commission", "unknown"])
        fid = f"FLW-{flow_counter:04d}"
        doc_id = make_document(src, tgt, amount, flow_date, True, None, ftype)
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": "Перевод в офшорную юрисдикцию",
            "document_id": doc_id, "is_suspicious": True,
            "risk_score": random.uniform(70, 100), "flow_type": ftype,
        })
        entity_map[src]["total_outflow"] += amount
        entity_map[tgt]["total_inflow"] += amount
        entity_map[src]["transaction_count"] += 1
        entity_map[tgt]["transaction_count"] += 1
        flow_counter += 1

    # --- Pattern 4: Company → Company (inter-company transfers) ---
    # Only 6 flows between suspicious companies
    for _ in range(6):
        src = random.choice(sus_com_ids) if sus_com_ids else random.choice(com_ids)
        tgt = random.choice([c for c in com_ids if c != src])
        amount = random.uniform(1_000_000, 30_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        is_sus = random.random() > 0.5
        ftype = random.choice(["equipment_purchase", "service_fee", "subcontract"])
        fid = f"FLW-{flow_counter:04d}"
        doc_id = make_document(src, tgt, amount, flow_date, is_sus, None, ftype)
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": "Межфирменный перевод",
            "document_id": doc_id, "is_suspicious": is_sus,
            "risk_score": random.uniform(30, 70), "flow_type": ftype,
        })
        entity_map[src]["total_outflow"] += amount
        entity_map[tgt]["total_inflow"] += amount
        entity_map[src]["transaction_count"] += 1
        entity_map[tgt]["transaction_count"] += 1
        flow_counter += 1

    # --- Pattern 5: Offshore → Company (return investment / circular) ---
    for _ in range(5):
        src = random.choice(off_ids)
        tgt = random.choice(com_ids)
        amount = random.uniform(10_000_000, 80_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        ftype = random.choice(["investment", "loan"])
        fid = f"FLW-{flow_counter:04d}"
        doc_id = make_document(src, tgt, amount, flow_date, True, None, ftype)
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": "Обратный инвестиционный поток",
            "document_id": doc_id, "is_suspicious": True,
            "risk_score": random.uniform(80, 100), "flow_type": ftype,
        })
        entity_map[src]["total_outflow"] += amount
        entity_map[tgt]["total_inflow"] += amount
        entity_map[src]["transaction_count"] += 1
        entity_map[tgt]["transaction_count"] += 1
        flow_counter += 1

    # --- Pattern 6: Company → Offshore (direct) ---
    for _ in range(6):
        src = random.choice(com_ids)
        tgt = random.choice(off_ids)
        amount = random.uniform(3_000_000, 60_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        ftype = random.choice(["commission", "investment", "unknown"])
        fid = f"FLW-{flow_counter:04d}"
        doc_id = make_document(src, tgt, amount, flow_date, True, None, ftype)
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": "Прямой перевод в офшор",
            "document_id": doc_id, "is_suspicious": True,
            "risk_score": random.uniform(60, 95), "flow_type": ftype,
        })
        entity_map[src]["total_outflow"] += amount
        entity_map[tgt]["total_inflow"] += amount
        entity_map[src]["transaction_count"] += 1
        entity_map[tgt]["transaction_count"] += 1
        flow_counter += 1

    # --- Pattern 7: Offshore → Offshore (layering) ---
    for _ in range(4):
        src = random.choice(off_ids)
        tgt = random.choice([o for o in off_ids if o != src])
        amount = random.uniform(10_000_000, 150_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        fid = f"FLW-{flow_counter:04d}"
        doc_id = make_document(src, tgt, amount, flow_date, True, None, "unknown")
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": "Межофшорный трансфер (layering)",
            "document_id": doc_id, "is_suspicious": True,
            "risk_score": random.uniform(85, 100), "flow_type": "unknown",
        })
        entity_map[src]["total_outflow"] += amount
        entity_map[tgt]["total_inflow"] += amount
        entity_map[src]["transaction_count"] += 1
        entity_map[tgt]["transaction_count"] += 1
        flow_counter += 1

    # --- Pattern 8: Flights (перелеты) ---
    for _ in range(8):
        src = random.choice(com_ids + int_ids)
        tgt = random.choice(off_ids)
        tgt_country = random.choice(["Dubai, UAE", "London, UK", "Zurich, Switzerland", "Singapore", "Hong Kong"])
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        fid = f"FLW-{flow_counter:04d}"
        amount = random.uniform(500_000, 5_000_000)
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": f"Перелет и проживание ({tgt_country})",
            "document_id": None, "is_suspicious": True,
            "risk_score": random.uniform(60, 90), "flow_type": "flight",
            "tender_id": None
        })
        flow_counter += 1

    # --- Pattern 9: High-value Purchases (покупки) ---
    for _ in range(6):
        src = random.choice(int_ids + com_ids)
        tgt = random.choice(com_ids + off_ids)
        items = ["Элитная недвижимость", "Люксовый автомобиль", "Ювелирные изделия", "Предметы искусства"]
        item = random.choice(items)
        amount = random.uniform(20_000_000, 300_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        fid = f"FLW-{flow_counter:04d}"
        flows.append({
            "flow_id": fid, "source_id": src, "target_id": tgt,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": f"Покупка ({item})",
            "document_id": None, "is_suspicious": True,
            "risk_score": random.uniform(70, 95), "flow_type": "purchase",
            "tender_id": None
        })
        flow_counter += 1

    # --- Pattern 10: Cash-out / обналичивание (self-loops, source==target) ---
    kz_banks = ["Kaspi Bank", "Halyk Bank", "Jusan Bank", "Bank CenterCredit", "Forte Bank"]
    cashout_places = ["г.Алматы, ул.Абая", "г.Астана, пр.Сарыарка", "г.Шымкент, ул.Байтурсынова",
                      "г.Атырау, пр.Азаттык", "г.Актобе, ул.Маресьева"]
    ip_names = ["ИП «Ромашка»", "ИП «Сункар»", "ИП «Алтын Нур»", "ИП «Стройсервис»", "ИП «Консалт Плюс»"]
    cashout_items = ["офисные услуги", "транспортные услуги", "консалтинг", "аренда оборудования", "охранные услуги"]
    for _ in range(8):
        entity = random.choice(com_ids + int_ids)
        amount = random.uniform(5_000_000, 80_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        fid = f"FLW-{flow_counter:04d}"
        place = random.choice(cashout_places)
        bank = random.choice(kz_banks)
        ip = random.choice(ip_names)
        item = random.choice(cashout_items)
        account = f"KZ{random.randint(10**17, 10**18-1)}"
        method = random.choice(["наличными", "через банкомат", "через подставные счета"])
        desc = (f"Обналичивание через {ip}, {place} | {bank} | счёт {account} | "
                f"{method} | назначение: «{item}» | {flow_date.strftime('%d.%m.%Y')}")
        flows.append({
            "flow_id": fid, "source_id": entity, "target_id": entity,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": desc,
            "document_id": None, "is_suspicious": True,
            "risk_score": random.uniform(80, 100), "flow_type": "cash_out",
            "tender_id": None
        })
        entity_map[entity]["transaction_count"] += 1
        flow_counter += 1

    # --- Pattern 11: Flight self-loops (person flies, same entity) ---
    airlines = ["Air Astana", "SCAT", "FLY Arystan", "Emirates", "Turkish Airlines", "Lufthansa"]
    kz_airports = ["Алматы", "Астана", "Шымкент", "Атырау", "Актобе"]
    destinations = ["Дубай, ОАЭ", "Лондон, Великобритания", "Цюрих, Швейцария",
                    "Сингапур", "Гонконг", "Стамбул, Турция", "Мальта", "Монако"]
    cabin_classes = ["Бизнес-класс", "Первый класс", "Бизнес-класс (двое)", "Бизнес-класс (с сопровождением)"]
    for _ in range(15):
        entity = random.choice(com_ids + int_ids + gov_ids)
        dest = random.choice(destinations)
        origin = random.choice(kz_airports)
        airline = random.choice(airlines)
        flight_num = f"{airline[:2].upper()}{random.randint(100,999)}"
        cabin = random.choice(cabin_classes)
        amount = random.uniform(300_000, 3_000_000)
        flow_date = base_date + timedelta(days=random.randint(0, 700))
        fid = f"FLW-{flow_counter:04d}"
        ceo = entity_map[entity].get("ceo_name", "Руководитель")
        # 40% chance of co-traveler on same flight at different ticket time
        co_traveler = ""
        if random.random() < 0.4:
            co_names = ["Сейткали А.Б.", "Нурланов Д.С.", "Ахметова З.Т.", "Байжанов Р.К.", "Жаксыбеков М.И."]
            co = random.choice(co_names)
            offset_min = random.randint(5, 120)
            co_traveler = f" | Попутчик: {co} (билет куплен на {offset_min} мин ранее)"
        desc = (f"Перелёт {origin}→{dest} | {airline} рейс {flight_num} | "
                f"{cabin} | {ceo}{co_traveler} | {flow_date.strftime('%d.%m.%Y')}")
        flows.append({
            "flow_id": fid, "source_id": entity, "target_id": entity,
            "amount": round(amount, 2), "flow_date": flow_date.isoformat(),
            "description": desc,
            "document_id": None, "is_suspicious": True,
            "risk_score": random.uniform(50, 85), "flow_type": "flight",
            "tender_id": None
        })
        entity_map[entity]["transaction_count"] += 1
        flow_counter += 1


    # Round entity totals
    for e in entities:
        eid = e["entity_id"]
        e["total_inflow"] = round(entity_map[eid]["total_inflow"], 2)
        e["total_outflow"] = round(entity_map[eid]["total_outflow"], 2)
        e["transaction_count"] = entity_map[eid]["transaction_count"]
        if e["total_inflow"] > 0 and e["total_outflow"] > 0:
            ratio = e["total_outflow"] / e["total_inflow"]
            if ratio > 0.8 and e["entity_type"] in ("intermediary", "company"):
                e["is_suspicious"] = True
                e["risk_score"] = min(100, e["risk_score"] + 20)

    return entities, flows, documents
