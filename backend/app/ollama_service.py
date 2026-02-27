"""
Ollama Local AI Service for TechnoFilter
=========================================
Локальный ИИ-сервис для глубокого анализа тендерных документов
и обнаружения коррупционных паттернов через Ollama.

Поддерживаемые модели:
  - llama3:latest  — основной анализ тендерных спецификаций
  - deepseek-r1:8b — углублённый reasoning для сложных кейсов

Преимущества локального ИИ:
  ✓ Данные не покидают сервер (конфиденциальность)
  ✓ Нет зависимости от внешних API
  ✓ Нет лимитов по запросам
  ✓ Работает офлайн
"""

import httpx
import json
import logging
from typing import Dict, List, Optional

logger = logging.getLogger("technofilter.ollama")

# =============================================
# КОНФИГУРАЦИЯ OLLAMA
# =============================================

OLLAMA_BASE_URL = "http://localhost:11434"

# Модели в порядке приоритета
OLLAMA_MODELS = [
    "deepseek-r1:8b",   # Лучший reasoning для анализа коррупции
    "llama3:latest",     # Быстрый анализ, хорошее качество
]

# Системные промпты для различных задач
SYSTEM_PROMPTS = {
    "tender_analysis": """Ты — эксперт-аналитик по государственным закупкам Казахстана.
Твоя задача — проанализировать техническую спецификацию тендера и выявить признаки коррупции.

Обращай внимание на:
1. Привязка к конкретному бренду/модели без указания "или эквивалент"
2. Нереалистичные сроки поставки (менее 5 рабочих дней для сложного оборудования)
3. Избыточные сертификационные требования
4. Подозрительно точная цена (до копейки)
5. Чрезмерно сложные формулировки, скрывающие суть требований
6. Требования, которым соответствует только один поставщик

Ответ дай в формате JSON со следующей структурой:
{
    "risk_level": "low|medium|high|critical",
    "risk_score": 0-100,
    "findings": [...],
    "recommendation": "..."
}""",

    "financial_flow": """Ты — эксперт по финансовому анализу и противодействию отмыванию денег.
Проанализируй финансовые потоки и выяви подозрительные паттерны:

1. Циклические транзакции (A→B→C→A)
2. Дробление сумм для обхода контроля
3. Транзакции с офшорными юрисдикциями
4. Необычная частота или время операций
5. Связи между компаниями через общих бенефициаров

Ответ в формате JSON:
{
    "suspicious_patterns": [...],
    "risk_assessment": "...",
    "total_risk_score": 0-100,
    "recommended_actions": [...]
}""",

    "document_check": """Ты — юрист-эксперт по госзакупкам РК.
Проанализируй документ на соответствие законодательству:
- Закон РК "О государственных закупках" (№ 434-V)
- Правила осуществления государственных закупок
- Антикоррупционное законодательство РК

Укажи конкретные статьи закона при обнаружении нарушений.""",
}


async def check_ollama_status() -> Dict:
    """Проверяет доступность Ollama и список установленных моделей."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Проверяем сервер
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m["name"] for m in data.get("models", [])]
                available = [m for m in OLLAMA_MODELS if m in models]
                return {
                    "status": "online",
                    "models_installed": models,
                    "models_available": available,
                    "preferred_model": available[0] if available else None,
                }
            return {"status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning(f"Ollama недоступен: {e}")
        return {"status": "offline", "detail": str(e)}


async def _ollama_generate(
    prompt: str,
    model: str = None,
    system: str = None,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> Optional[str]:
    """
    Отправляет запрос к Ollama API и возвращает ответ.
    Автоматически пробует fallback-модели при ошибке.
    """
    models_to_try = [model] if model else OLLAMA_MODELS

    for m in models_to_try:
        try:
            payload = {
                "model": m,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                    "top_p": 0.9,
                    "repeat_penalty": 1.1,
                },
            }
            if system:
                payload["system"] = system

            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json=payload,
                )
                if resp.status_code == 200:
                    result = resp.json()
                    logger.info(
                        f"Ollama [{m}]: {result.get('eval_count', '?')} tokens, "
                        f"{result.get('eval_duration', 0) / 1e9:.1f}s"
                    )
                    return result.get("response", "")
                else:
                    logger.warning(f"Ollama [{m}] вернул HTTP {resp.status_code}")
        except httpx.TimeoutException:
            logger.warning(f"Ollama [{m}] таймаут")
        except Exception as e:
            logger.error(f"Ollama [{m}] ошибка: {e}")

    return None


def _parse_json_response(text: str) -> Optional[Dict]:
    """Извлекает JSON из ответа LLM (может содержать markdown-блоки)."""
    if not text:
        return None
    # Убираем markdown-обёртку ```json ... ```
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Пробуем найти JSON-объект в тексте
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
    return None


async def analyze_tender_specification(
    title: str,
    description: str,
    requirements: List[str],
    budget: float,
    deadline_days: int,
    category: str = "IT",
) -> Dict:
    """
    Полный AI-анализ тендерной спецификации через локальную модель.
    
    Args:
        title: Название тендера
        description: Описание закупки
        requirements: Список технических требований
        budget: Бюджет в тенге
        deadline_days: Срок исполнения в днях
        category: Категория закупки
    
    Returns:
        Результат анализа с оценкой рисков
    """
    requirements_text = "\n".join(f"  - {r}" for r in requirements)
    
    prompt = f"""Проанализируй следующую тендерную спецификацию:

📋 Название: {title}
📂 Категория: {category}
💰 Бюджет: ₸{budget:,.0f}
⏱ Срок исполнения: {deadline_days} дней

📝 Описание:
{description}

📌 Технические требования:
{requirements_text}

Проведи детальный анализ и выяви все признаки возможных манипуляций."""

    response = await _ollama_generate(
        prompt=prompt,
        system=SYSTEM_PROMPTS["tender_analysis"],
        temperature=0.2,
    )

    parsed = _parse_json_response(response)
    if parsed:
        parsed["ai_model"] = "ollama-local"
        parsed["analysis_type"] = "tender_specification"
        return parsed

    # Fallback — структурированный ответ
    return {
        "risk_level": "medium",
        "risk_score": 50,
        "findings": [
            {
                "type": "ai_analysis",
                "description": response or "Анализ недоступен",
                "severity": "medium",
            }
        ],
        "recommendation": "Требуется ручная проверка экспертом",
        "ai_model": "ollama-local",
        "raw_response": response,
    }


async def analyze_financial_network(
    nodes: List[Dict],
    transactions: List[Dict],
) -> Dict:
    """
    AI-анализ финансовой сети на предмет подозрительных паттернов.
    
    Args:
        nodes: Список узлов (компании, лица, счета)
        transactions: Список транзакций между узлами
    """
    total_amount = sum(t.get("amount", 0) for t in transactions)
    suspicious_count = sum(1 for t in transactions if t.get("is_suspicious"))

    # Формируем сводку для LLM
    node_summary = []
    for n in nodes[:20]:  # Ограничиваем для контекста
        node_summary.append(
            f"  • {n.get('name', '?')} (тип: {n.get('type', '?')}, "
            f"риск: {n.get('risk_score', 0)})"
        )

    tx_summary = []
    for t in transactions[:30]:
        flag = "⚠️" if t.get("is_suspicious") else "✓"
        tx_summary.append(
            f"  {flag} {t.get('source_name', '?')} → {t.get('target_name', '?')}: "
            f"₸{t.get('amount', 0):,.0f} ({t.get('flow_type', 'transfer')})"
        )

    prompt = f"""Проанализируй финансовую сеть:

📊 Общая статистика:
  • Узлов: {len(nodes)}
  • Транзакций: {len(transactions)}
  • Общая сумма: ₸{total_amount:,.0f}
  • Подозрительных: {suspicious_count}

🏢 Участники:
{chr(10).join(node_summary)}

💸 Транзакции:
{chr(10).join(tx_summary)}

Выяви подозрительные паттерны и схемы."""

    response = await _ollama_generate(
        prompt=prompt,
        system=SYSTEM_PROMPTS["financial_flow"],
        temperature=0.2,
        max_tokens=6000,
    )

    parsed = _parse_json_response(response)
    if parsed:
        parsed["ai_model"] = "ollama-local"
        parsed["analysis_type"] = "financial_network"
        return parsed

    return {
        "suspicious_patterns": [],
        "risk_assessment": response or "Анализ недоступен",
        "total_risk_score": 50,
        "recommended_actions": ["Ручная проверка финансовых потоков"],
        "ai_model": "ollama-local",
    }


async def check_document_compliance(
    document_text: str,
    document_type: str = "technical_specification",
) -> Dict:
    """
    Проверка документа на соответствие законодательству РК о госзакупках.
    """
    prompt = f"""Тип документа: {document_type}

Текст документа:
{document_text[:8000]}

Проверь соответствие законодательству РК и укажи все нарушения."""

    response = await _ollama_generate(
        prompt=prompt,
        system=SYSTEM_PROMPTS["document_check"],
        temperature=0.1,
    )

    return {
        "compliance_check": response or "Проверка недоступна",
        "ai_model": "ollama-local",
        "document_type": document_type,
    }


async def generate_risk_explanation(
    tender_data: Dict,
    risk_score: int,
    risk_factors: List[str],
) -> str:
    """
    Генерирует человекочитаемое объяснение оценки рисков.
    Используется для отчётов и UI.
    """
    factors_text = "\n".join(f"  {i+1}. {f}" for i, f in enumerate(risk_factors))

    prompt = f"""Тендер: {tender_data.get('title', 'Без названия')}
Оценка риска: {risk_score}/100
Категория риска: {'Критический' if risk_score > 80 else 'Высокий' if risk_score > 60 else 'Средний' if risk_score > 40 else 'Низкий'}

Выявленные факторы риска:
{factors_text}

Составь краткое (3-5 предложений), понятное объяснение для аналитика, 
почему этот тендер получил такую оценку и какие действия рекомендуются."""

    response = await _ollama_generate(
        prompt=prompt,
        model="llama3:latest",  # Быстрая модель для коротких ответов
        temperature=0.4,
        max_tokens=1024,
    )

    return response or f"Тендер получил оценку риска {risk_score}/100 на основании {len(risk_factors)} факторов."


# =============================================
# УТИЛИТЫ
# =============================================

async def list_available_models() -> List[str]:
    """Возвращает список моделей, установленных в Ollama."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                return [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        pass
    return []


async def warm_up_model(model: str = None) -> bool:
    """Прогревает модель (загружает в VRAM) коротким запросом."""
    model = model or OLLAMA_MODELS[0]
    logger.info(f"Прогрев модели {model}...")
    result = await _ollama_generate(
        prompt="Скажи 'готов' одним словом.",
        model=model,
        temperature=0.0,
        max_tokens=10,
    )
    if result:
        logger.info(f"Модель {model} прогрета и готова к работе")
        return True
    return False
