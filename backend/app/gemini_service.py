"""
Gemini AI Integration Service for TechnoFilter
Deep analysis of financial flows and corruption patterns using Google Gemini.
"""

import httpx
import json
import random
from typing import Dict, List, Optional
from app.config import settings


# Models to try in order (fallback chain for quota limits)
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]

def _gemini_url(model: str) -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _generate_local_network_analysis(nodes: List[Dict], transactions: List[Dict]) -> Dict:
    """Generate a smart local analysis when Gemini API is unavailable (quota exceeded)."""
    total_amount = sum(t.get("amount", 0) for t in transactions)
    suspicious_txs = [t for t in transactions if t.get("is_suspicious")]
    suspicious_amount = sum(t.get("amount", 0) for t in suspicious_txs)
    flight_txs = [t for t in transactions if t.get("flow_type") == "flight"]
    cashout_txs = [t for t in transactions if t.get("flow_type") == "cash_out"]
    offshore_nodes = [n for n in nodes if n.get("type") == "offshore"]
    high_risk_nodes = [n for n in nodes if n.get("risk_score", 0) > 70]

    patterns = []
    if cashout_txs:
        patterns.append({
            "pattern_type": "Схема обналичивания",
            "description": f"Обнаружено {len(cashout_txs)} операций обналичивания на сумму ₸{sum(t['amount'] for t in cashout_txs):,.0f}",
            "severity": "critical",
            "involved_entities": list(set(t.get("source_name", "?") for t in cashout_txs))[:5]
        })
    if offshore_nodes and suspicious_txs:
        offshore_names = [n.get("name", "?") for n in offshore_nodes]
        offshore_txs = [t for t in suspicious_txs if t.get("target_name") in offshore_names or t.get("source_name") in offshore_names]
        if offshore_txs:
            patterns.append({
                "pattern_type": "Вывод средств в офшоры",
                "description": f"{len(offshore_txs)} подозрительных транзакций связаны с офшорными компаниями на сумму ₸{sum(t['amount'] for t in offshore_txs):,.0f}",
                "severity": "critical",
                "involved_entities": [n.get("name", "?") for n in offshore_nodes][:5]
            })
    if flight_txs:
        patterns.append({
            "pattern_type": "Подозрительные перелёты",
            "description": f"{len(flight_txs)} перелётов на сумму ₸{sum(t['amount'] for t in flight_txs):,.0f}. Возможна связь с личным обогащением.",
            "severity": "high",
            "involved_entities": list(set(t.get("source_name", "?") for t in flight_txs))[:5]
        })
    circular_pairs = set()
    for t in transactions:
        sn = t.get("source_name", "")
        tn = t.get("target_name", "")
        if sn and tn:
            pair = (sn, tn)
            reverse = (tn, sn)
            if reverse in circular_pairs:
                patterns.append({
                    "pattern_type": "Циклический поток",
                    "description": f"Обнаружен двусторонний поток между {sn} и {tn}. Возможная схема отмывания.",
                    "severity": "critical",
                    "involved_entities": [sn, tn]
                })
            circular_pairs.add(pair)

    risk_score = min(100, int(
        15
        + (len(suspicious_txs) / max(1, len(transactions))) * 45
        + len(patterns) * 7
        + len(offshore_nodes) * 5
        + (1 if any(t.get("flow_type") == "cash_out" for t in transactions) else 0) * 10
        + min(15, len(high_risk_nodes) * 3)
    ))

    findings = []
    if suspicious_amount > 0:
        pct = (suspicious_amount / max(1, total_amount)) * 100
        findings.append(f"Общий объём подозрительных операций: ₸{suspicious_amount:,.0f} ({pct:.0f}% от общего)")
    if high_risk_nodes:
        names = ", ".join(n.get("name", "?") for n in high_risk_nodes[:5])
        findings.append(f"Организации с высоким риском: {names}")
    for n in nodes:
        won = n.get("tender_won_amount", 0)
        spent = n.get("actual_spent_amount", 0)
        if won > 0 and spent > 0:
            diff = won - spent
            if diff > won * 0.15:
                findings.append(f'{n.get("name", "?")}: разница между выигранными тендерами и расходами — ₸{diff:,.0f} ({diff/won*100:.0f}%)')

    recommendations = [
        "Провести проверку всех офшорных транзакций за последние 12 месяцев",
        "Запросить документы о реальных бенефициарах подозрительных компаний",
    ]
    if cashout_txs:
        recommendations.append("Инициировать расследование схем обналичивания через фиктивные ИП")
    if flight_txs:
        recommendations.append("Проверить связь командировочных расходов с рабочей деятельностью")

    # Build a narrative assessment
    assessment_parts = [
        f"Анализ сети из {len(nodes)} организаций и {len(transactions)} транзакций.",
        f"Обнаружено {len(suspicious_txs)} подозрительных операций на сумму ₸{suspicious_amount:,.0f}."
    ]
    if cashout_txs:
        assessment_parts.append(
            f"Выявлено {len(cashout_txs)} операций обналичивания на общую сумму ₸{sum(t['amount'] for t in cashout_txs):,.0f}. "
            f"Это указывает на возможные схемы вывода бюджетных средств."
        )
    if offshore_nodes:
        offshore_names = ", ".join(n.get("name", "?") for n in offshore_nodes[:3])
        assessment_parts.append(
            f"В сети присутствуют оффшорные компании: {offshore_names}. "
            f"Переводы в оффшоры требуют особого внимания."
        )
    if flight_txs:
        flight_amount = sum(t['amount'] for t in flight_txs)
        assessment_parts.append(
            f"Зафиксировано {len(flight_txs)} перелётов на сумму ₸{flight_amount:,.0f}. "
            f"Необходимо проверить связь с рабочей деятельностью."
        )
    for n in nodes[:5]:
        won = n.get("tender_won_amount", 0)
        spent = n.get("actual_spent_amount", 0)
        if won > 0 and spent > 0 and (won - spent) > won * 0.2:
            diff = won - spent
            assessment_parts.append(
                f'{n.get("name", "?")}: выиграно тендеров на ₸{won:,.0f}, потрачено ₸{spent:,.0f}. '
                f'Разница ₸{diff:,.0f} ({diff/won*100:.0f}%) — возможное хищение.'
            )
    assessment_parts.append(f"Общий уровень риска: {risk_score}/100.")

    return {
        "risk_assessment": " ".join(assessment_parts),
        "suspicious_patterns": patterns,
        "key_findings": findings[:8],
        "recommended_investigations": recommendations,
        "network_risk_score": risk_score,
    }


async def gemini_analyze_tender(
    text: str,
    metadata: Dict = None,
    language: str = "ru"
) -> Dict:
    """
    Send tender text to Gemini for deep AI analysis.
    Returns structured risk assessment.
    """
    meta_str = ""
    if metadata:
        meta_str = f"""
Additional metadata:
- Customer: {metadata.get('customer_name', 'N/A')}
- Amount: {metadata.get('amount', 'N/A')} KZT
- Region: {metadata.get('region', 'N/A')}
- Delivery days: {metadata.get('delivery_days', 'N/A')}
- Participants: {metadata.get('participant_count', 'N/A')}
"""

    lang_instruction = {
        "ru": "Respond in Russian.",
        "kz": "Respond in Kazakh.",
        "en": "Respond in English."
    }.get(language, "Respond in English.")

    prompt = f"""You are an expert AI anti-corruption analyst for Kazakhstan government procurement.
Analyze the following tender technical specification for signs of manipulation and corruption.

{lang_instruction}

TENDER TEXT:
\"\"\"
{text[:4000]}
\"\"\"
{meta_str}

Analyze for these red flags:
1. BRAND_LOCK — Specific brand/model requirements excluding competitors
2. TIMELINE — Unrealistic deadlines favoring one supplier
3. CERTIFICATION — Excessive/niche certifications limiting competition
4. FINANCIAL — Suspicious pricing patterns  
5. SINGLE_BID — Indicators of restricted competition
6. LINGUISTIC — Deliberately complex language to obscure requirements

Return a JSON object with this exact structure:
{{
  "risk_score": <number 0-100>,
  "risk_level": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "summary": "<2-3 sentence overall assessment>",
  "flags": [
    {{
      "type": "<flag type>",
      "severity": "<low|medium|high>", 
      "description": "<detailed explanation>",
      "evidence": "<exact quote from text>"
    }}
  ],
  "recommendations": ["<action item 1>", "<action item 2>"],
  "suspicious_entities": ["<brand/company names found>"],
  "money_flow_risk": "<assessment of financial flow concerns>"
}}

Return ONLY valid JSON, no markdown formatting.
"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            last_error = None
            for model in GEMINI_MODELS:
                response = await client.post(
                    f"{_gemini_url(model)}?key={settings.GEMINI_API_KEY}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.3,
                            "maxOutputTokens": 4096,
                            "responseMimeType": "application/json",
                        }
                    }
                )
                if response.status_code in (429, 404, 503):
                    print(f"[Gemini] Model {model} returned {response.status_code}, trying next...")
                    last_error = f"Error {response.status_code} for {model}"
                    continue
                break
            else:
                return {"error": "Все модели Gemini исчерпали лимит бесплатного использования. Попробуйте позже или используйте другой API ключ.", "raw": last_error}

            if response.status_code != 200:
                error_text = response.text[:500]
                print(f"[Gemini] API error {response.status_code}: {error_text}")
                return {"error": f"Gemini API error: {response.status_code}", "raw": error_text}

            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return {"error": "Gemini returned empty response", "raw": str(data)[:500]}

            text_response = candidates[0]["content"]["parts"][0]["text"]
            
            # Clean markdown formatting if present
            cleaned = text_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            result = json.loads(cleaned)
            return result

    except json.JSONDecodeError as e:
        print(f"[Gemini] JSON decode error: {e}")
        raw = text_response[:500] if 'text_response' in locals() else "Unknown"
        return {
            "risk_score": 50,
            "risk_level": "MEDIUM",
            "summary": raw,
            "flags": [],
            "recommendations": ["Manual review recommended"],
            "suspicious_entities": [],
            "money_flow_risk": "Unable to assess"
        }
    except httpx.TimeoutException:
        return {"error": "Gemini API timeout — try again"}
    except Exception as e:
        print(f"[Gemini] Exception: {e}")
        return {"error": str(e)}


async def gemini_analyze_network(
    nodes: List[Dict],
    transactions: List[Dict],
    language: str = "ru"
) -> Dict:
    """
    Analyze a financial network for suspicious patterns using Gemini.
    Includes enriched entity data: CEO, tender budgets, suspicion summaries.
    """
    if not settings.GEMINI_API_KEY:
        print("[Gemini Network] No GEMINI_API_KEY configured")
        return {
            "error": "Gemini API key not configured",
            "risk_assessment": "API ключ Gemini не настроен. Добавьте GEMINI_API_KEY в файл .env",
            "suspicious_patterns": [],
            "key_findings": [],
            "recommended_investigations": [],
            "network_risk_score": 0,
        }

    lang_instruction = {
        "ru": "Respond in Russian.",
        "kz": "Respond in Kazakh.",
        "en": "Respond in English."
    }.get(language, "Respond in English.")

    # Build rich entity summaries including CEO and budget data
    entity_lines = []
    for n in nodes[:60]:
        parts = [f"{n.get('name', n.get('id'))}"]
        parts.append(f"type={n.get('type')}")
        if n.get('region'): parts.append(f"region={n['region']}")
        if n.get('ceo_name'): parts.append(f"CEO={n['ceo_name']}")
        if n.get('employee_count'): parts.append(f"employees={n['employee_count']}")
        if n.get('tender_won_amount'):
            parts.append(f"tender_won={n['tender_won_amount']}KZT")
        if n.get('actual_spent_amount'):
            parts.append(f"actual_spent={n['actual_spent_amount']}KZT")
        if n.get('suspicion_summary'):
            parts.append(f"SUSPICION: {n['suspicion_summary']}")
        total = n.get('total_amount', 0)
        if total: parts.append(f"total_flow={total}KZT")
        entity_lines.append("- " + ", ".join(parts))
    nodes_summary = "\n".join(entity_lines)

    txn_summary = "\n".join([
        f"- {t.get('source')} → {t.get('target')}: {t.get('amount', 0)} KZT | type={t.get('flow_type', 'payment')} | {t.get('description', '')}" + (" [SUSPICIOUS]" if t.get('is_suspicious') else "")
        for t in transactions[:120]
    ])

    prompt = f"""You are an elite investigative journalist and forensic accountant specializing in government procurement corruption in Kazakhstan.
{lang_instruction}

Your task is to analyze the provided financial network and money flows, and write a dramatic, easy-to-understand "detective-style" story revealing exactly what happened.

IMPORTANT: Pay special attention to:
- Companies where tender_won amount is much higher than actual_spent — the difference is likely stolen
- Flows to offshore companies — almost always money laundering
- Flight and purchase flows — these often reveal personal enrichment by officials
- CEO names linked to multiple entities — potential front-person schemes
- Intermediary companies with few employees but huge money flows — shell companies

EXPLAIN the scheme in plain language. Example: "Компания X выиграла тендер на 100 миллионов тенге. Должна была потратить 70 млн на закупки, но потратила лишь 20 млн. Остальные 50 млн ушли через посредника Y в оффшор Z на Кипре."

Make the `risk_assessment` field a gripping narrative explaining the suspected corruption scheme step-by-step.

ENTITIES:
{nodes_summary}

MONEY FLOWS:
{txn_summary}

Detect:
1. Circular money flows (A→B→C→A)
2. Shell company patterns (entities receiving large sums then distributing)
3. Budget discrepancy (tender won vs actual spent — the gap = stolen funds)
4. Repeat winner patterns in government contracts
5. Flights and luxury purchases by officials
6. Cross-region flows that don't match business logic
7. Offshore transfers

Return JSON:
{{
  "risk_assessment": "<overall network risk assessment — a detective story>",
  "suspicious_patterns": [
    {{
      "pattern_type": "<circular_flow|shell_company|budget_theft|repeat_winner|offshore_transfer|personal_enrichment>",
      "description": "<detailed description>",
      "involved_entities": ["entity1", "entity2"],
      "estimated_risk_amount": <number>,
      "severity": "<low|medium|high|critical>"
    }}
  ],
  "key_findings": ["<finding 1>", "<finding 2>"],
  "recommended_investigations": ["<action 1>", "<action 2>"],
  "network_risk_score": <0-100>
}}

Return ONLY valid JSON.
"""

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            last_error = None
            for model in GEMINI_MODELS:
                response = await client.post(
                    f"{_gemini_url(model)}?key={settings.GEMINI_API_KEY}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.4,
                            "maxOutputTokens": 8192,
                            "responseMimeType": "application/json",
                        }
                    }
                )
                if response.status_code in (429, 404, 503):
                    print(f"[Gemini Network] Model {model} returned {response.status_code}, trying next...")
                    last_error = f"Error {response.status_code} for {model}"
                    continue
                break
            else:
                # All models exhausted — return local analysis
                print("[Gemini Network] All models exhausted. Using local analysis fallback.")
                return _generate_local_network_analysis(nodes, transactions)

            if response.status_code != 200:
                error_text = response.text[:500]
                print(f"[Gemini Network] API error {response.status_code}: {error_text}")
                return {
                    "error": f"Gemini API error: {response.status_code}. {error_text}",
                    "risk_assessment": f"Ошибка API Gemini ({response.status_code})",
                    "suspicious_patterns": [],
                    "key_findings": [],
                    "recommended_investigations": [],
                    "network_risk_score": 0,
                }

            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                block_reason = data.get("promptFeedback", {}).get("blockReason", "unknown")
                print(f"[Gemini Network] Empty candidates. blockReason={block_reason}")
                return {
                    "error": f"Gemini вернул пустой ответ (причина: {block_reason})",
                    "risk_assessment": "Gemini не смог сформировать ответ",
                    "suspicious_patterns": [],
                    "key_findings": [],
                    "recommended_investigations": [],
                    "network_risk_score": 0,
                }

            text_response = candidates[0]["content"]["parts"][0]["text"]

            cleaned = text_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            result = json.loads(cleaned)
            # Ensure all expected fields exist
            result.setdefault("risk_assessment", "")
            result.setdefault("suspicious_patterns", [])
            result.setdefault("key_findings", [])
            result.setdefault("recommended_investigations", [])
            result.setdefault("network_risk_score", 50)
            return result

    except json.JSONDecodeError as e:
        raw_text = text_response[:800] if 'text_response' in locals() else "N/A"
        print(f"[Gemini Network] JSON decode error: {e}, raw: {raw_text}")
        return {
            "risk_assessment": raw_text,
            "suspicious_patterns": [],
            "key_findings": ["Gemini вернул невалидный JSON — показан сырой текст"],
            "recommended_investigations": [],
            "network_risk_score": 50,
        }
    except httpx.TimeoutException:
        return {
            "error": "Gemini API timeout — повторите попытку",
            "risk_assessment": "Таймаут при обращении к Gemini. Попробуйте ещё раз.",
            "suspicious_patterns": [],
            "key_findings": [],
            "recommended_investigations": [],
            "network_risk_score": 0,
        }
    except Exception as e:
        print(f"[Gemini Network] Exception: {e}")
        return {
            "error": str(e),
            "risk_assessment": f"Ошибка: {str(e)}",
            "suspicious_patterns": [],
            "key_findings": [],
            "recommended_investigations": [],
            "network_risk_score": 0,
        }
