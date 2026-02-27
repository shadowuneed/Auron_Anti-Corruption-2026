"""
TechnoFilter AI Risk Scoring Engine

Hybrid approach:
  Step 1 → Rule-based + Feature extraction (fast, runs on all tenders)
  Step 2 → ML model scoring (XGBoost classifier)
  Step 3 → LLM deep analysis (optional, for MEDIUM+ risk only)
"""

import re
import math
import random
from typing import List, Dict, Optional, Tuple
from datetime import datetime


# =============================================
# KNOWN BRAND NAMES DATABASE
# =============================================

KNOWN_BRANDS = [
    "cisco", "huawei", "hp", "hewlett-packard", "dell", "lenovo", "apple",
    "samsung", "lg", "sony", "panasonic", "caterpillar", "komatsu", "volvo",
    "mercedes", "bmw", "toyota", "hyundai", "bosch", "siemens", "abb",
    "schneider", "mitsubishi", "hitachi", "toshiba", "nec", "oracle",
    "sap", "microsoft", "ibm", "vmware", "kaspersky", "checkpoint",
    "fortinet", "juniper", "aruba", "netgear", "d-link", "tp-link",
    "axis", "hikvision", "dahua", "honeywell", "emerson", "yokogawa",
    "endress", "krohne", "vega", "rosemount", "fisher", "danfoss",
    "grundfos", "ksb", "wilo", "daikin", "carrier", "trane",
    "1c", "1с", "bitrix", "bitrix24", "autodesk", "autocad",
]

# Phrases that REDUCE suspicion (openness to alternatives)
EQUIVALENT_PHRASES_RU = [
    "или эквивалент", "или аналог", "эквивалентный", "аналогичный",
    "не ниже", "совместимый с", "поддерживающий стандарт",
]

EQUIVALENT_PHRASES_KZ = [
    "немесе баламасы", "немесе ұқсас", "баламалы", "үйлесімді",
]

# Suspicious restriction phrases
RESTRICTION_PHRASES_RU = [
    "только", "исключительно", "строго", "обязательно должен быть",
    "единственный", "не допускается замена", "конкретно",
    "именно", "в точности", "без альтернатив",
]

RESTRICTION_PHRASES_KZ = [
    "тек", "тек қана", "міндетті түрде", "нақты",
    "ауыстыруға жол берілмейді", "балама жоқ",
]

# Suspicious certification patterns
NICHE_CERTIFICATIONS = [
    "ISO 27799", "ISO 22301", "ISO 20000", "CMMI Level 5",
    "FIPS 140-3", "Common Criteria EAL4+",
]


class RiskAnalyzer:
    """
    Core risk analysis engine.
    Extracts features from tender text and metadata,
    applies rule-based scoring with weighted flags.
    """

    def __init__(self):
        self.brand_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(b) for b in KNOWN_BRANDS) + r')\b',
            re.IGNORECASE
        )
        self.model_pattern = re.compile(
            r'[A-Z]{2,}[\-\s]?\d{3,}[A-Z\-]*\d*',
            re.IGNORECASE
        )

    def analyze(
        self,
        text: str,
        title: str = "",
        amount: float = 0,
        delivery_days: int = 0,
        participant_count: int = 0,
        region: str = "",
        oked_code: str = "",
        customer_name: str = "",
        winner_name: str = "",
    ) -> Dict:
        """
        Full risk analysis pipeline.
        Returns risk score, level, flags, and recommendation.
        """
        flags = []
        full_text = f"{title} {text}".lower()

        # ---- 1. BRAND & SPECIFICITY ANALYSIS ----
        brand_flags = self._analyze_brands(full_text)
        flags.extend(brand_flags)

        # ---- 2. TIMELINE ANALYSIS ----
        timeline_flags = self._analyze_timeline(delivery_days, oked_code, amount)
        flags.extend(timeline_flags)

        # ---- 3. CERTIFICATION ANALYSIS ----
        cert_flags = self._analyze_certifications(full_text)
        flags.extend(cert_flags)

        # ---- 4. FINANCIAL ANALYSIS ----
        financial_flags = self._analyze_financial(amount, full_text)
        flags.extend(financial_flags)

        # ---- 5. COMPETITION ANALYSIS ----
        competition_flags = self._analyze_competition(participant_count)
        flags.extend(competition_flags)

        # ---- 6. LINGUISTIC ANALYSIS ----
        linguistic_flags = self._analyze_linguistics(full_text)
        flags.extend(linguistic_flags)

        # ---- 7. RESTRICTION PHRASES ----
        restriction_flags = self._analyze_restrictions(full_text)
        flags.extend(restriction_flags)

        # Calculate composite risk score
        raw_score = sum(f["score_contribution"] for f in flags)
        risk_score = min(100.0, max(0.0, raw_score))

        # Determine risk level
        risk_level = self._score_to_level(risk_score)

        # Confidence based on number of signals
        confidence = min(0.95, 0.4 + len(flags) * 0.08)

        # Generate recommendation
        recommendation = self._generate_recommendation(risk_level, flags)

        return {
            "risk_score": round(risk_score, 1),
            "risk_level": risk_level,
            "triggered_flags": flags,
            "recommendation": recommendation,
            "confidence": round(confidence, 2),
            "similar_corrupt_cases": [],
        }

    def _analyze_brands(self, text: str) -> List[Dict]:
        flags = []
        brands_found = self.brand_pattern.findall(text)
        model_numbers = self.model_pattern.findall(text)

        # Check for "or equivalent" phrases
        has_equivalent = any(
            phrase in text
            for phrase in EQUIVALENT_PHRASES_RU + EQUIVALENT_PHRASES_KZ
        )

        if brands_found:
            unique_brands = list(set(b.lower() for b in brands_found))
            severity = "high" if len(unique_brands) <= 2 and not has_equivalent else "medium"
            score = 25 if not has_equivalent else 10

            if has_equivalent:
                severity = "low"

            flags.append({
                "flag_type": "BRAND_LOCK",
                "description": f"Found brand references: {', '.join(unique_brands)}. "
                               f"{'No equivalent clause found — potential vendor lock-in.' if not has_equivalent else 'Equivalent clause present — reduced risk.'}",
                "severity": severity,
                "evidence": f"Brands: {', '.join(unique_brands[:5])}",
                "score_contribution": score,
            })

        if model_numbers:
            unique_models = list(set(model_numbers))[:5]
            score = 20 if not has_equivalent else 8
            flags.append({
                "flag_type": "BRAND_LOCK",
                "description": f"Found {len(model_numbers)} specific model number(s): {', '.join(unique_models)}. "
                               f"Highly specific models narrow the supplier field.",
                "severity": "high" if not has_equivalent else "medium",
                "evidence": f"Models: {', '.join(unique_models)}",
                "score_contribution": score,
            })

        return flags

    def _analyze_timeline(self, delivery_days: int, oked_code: str, amount: float) -> List[Dict]:
        flags = []
        if delivery_days and delivery_days > 0:
            # Heuristic: very short delivery for large contracts is suspicious
            if amount and amount > 10_000_000 and delivery_days < 15:
                flags.append({
                    "flag_type": "TIMELINE",
                    "description": f"Delivery timeline of {delivery_days} days is unusually short "
                                   f"for a contract worth {amount:,.0f} KZT. "
                                   f"Only a pre-selected vendor could meet this deadline.",
                    "severity": "high",
                    "evidence": f"Delivery: {delivery_days} days, Amount: {amount:,.0f} KZT",
                    "score_contribution": 20,
                })
            elif amount and amount > 5_000_000 and delivery_days < 10:
                flags.append({
                    "flag_type": "TIMELINE",
                    "description": f"Extremely tight delivery deadline of {delivery_days} days "
                                   f"for contract of {amount:,.0f} KZT.",
                    "severity": "high",
                    "evidence": f"Delivery: {delivery_days} days",
                    "score_contribution": 18,
                })
            elif delivery_days < 7:
                flags.append({
                    "flag_type": "TIMELINE",
                    "description": f"Very short delivery window: {delivery_days} days. "
                                   f"May limit competition.",
                    "severity": "medium",
                    "evidence": f"Delivery: {delivery_days} days",
                    "score_contribution": 12,
                })
        return flags

    def _analyze_certifications(self, text: str) -> List[Dict]:
        flags = []
        # Count certificate/certification mentions
        cert_pattern = re.compile(
            r'(сертификат|certificate|ISO\s*\d+|ГОСТ|лицензи[яю]|аттестац|аккредитац|куәлік|лицензия)',
            re.IGNORECASE
        )
        cert_matches = cert_pattern.findall(text)

        if len(cert_matches) > 5:
            flags.append({
                "flag_type": "CERTIFICATION",
                "description": f"Excessive certification requirements: {len(cert_matches)} mentions. "
                               f"May be designed to exclude competitors.",
                "severity": "medium",
                "evidence": f"Certificate mentions: {len(cert_matches)}",
                "score_contribution": 15,
            })

        # Check for niche certifications
        for cert in NICHE_CERTIFICATIONS:
            if cert.lower() in text:
                flags.append({
                    "flag_type": "CERTIFICATION",
                    "description": f"Niche certification required: {cert}. "
                                   f"This certification is rare and significantly limits competition.",
                    "severity": "high",
                    "evidence": f"Required: {cert}",
                    "score_contribution": 18,
                })
                break  # Only flag once

        return flags

    def _analyze_financial(self, amount: float, text: str) -> List[Dict]:
        flags = []
        if amount and amount > 0:
            # Check price precision — suspiciously specific amounts
            amount_str = f"{amount:.0f}"
            if len(amount_str) > 6 and not amount_str.endswith("000") and not amount_str.endswith("00"):
                flags.append({
                    "flag_type": "FINANCIAL",
                    "description": f"Starting price {amount:,.0f} KZT is suspiciously precise. "
                                   f"Non-round amounts may indicate price tailoring to a specific vendor.",
                    "severity": "medium",
                    "evidence": f"Amount: {amount:,.0f} KZT",
                    "score_contribution": 12,
                })

        return flags

    def _analyze_competition(self, participant_count: int) -> List[Dict]:
        flags = []
        if participant_count == 1:
            flags.append({
                "flag_type": "SINGLE_BID",
                "description": "Single-bid tender: only one participant. "
                               "This is a high-risk indicator of restricted competition.",
                "severity": "high",
                "evidence": "Participants: 1",
                "score_contribution": 25,
            })
        elif participant_count == 2:
            flags.append({
                "flag_type": "SINGLE_BID",
                "description": "Only 2 participants in tender. Low competition level.",
                "severity": "medium",
                "evidence": "Participants: 2",
                "score_contribution": 10,
            })
        return flags

    def _analyze_linguistics(self, text: str) -> List[Dict]:
        flags = []
        if not text or len(text) < 100:
            return flags

        # Average sentence length (complexity indicator)
        sentences = re.split(r'[.!?;]\s', text)
        sentences = [s for s in sentences if len(s.strip()) > 10]

        if sentences:
            avg_sentence_len = sum(len(s.split()) for s in sentences) / len(sentences)
            if avg_sentence_len > 40:
                flags.append({
                    "flag_type": "LINGUISTIC",
                    "description": "Unusually complex language detected. "
                                   "Average sentence length exceeds 40 words, "
                                   "which may indicate intentional obfuscation.",
                    "severity": "low",
                    "evidence": f"Avg sentence length: {avg_sentence_len:.0f} words",
                    "score_contribution": 8,
                })

        # Passive voice detection (Russian)
        passive_patterns = re.findall(
            r'(должен быть|должна быть|должно быть|является|требуется|необходимо)',
            text, re.IGNORECASE
        )
        passive_ratio = len(passive_patterns) / max(1, len(sentences))
        if passive_ratio > 2.0:
            flags.append({
                "flag_type": "LINGUISTIC",
                "description": "High passive voice usage in requirements, "
                               "potentially obscuring responsible parties.",
                "severity": "low",
                "evidence": f"Passive constructions: {len(passive_patterns)}",
                "score_contribution": 5,
            })

        return flags

    def _analyze_restrictions(self, text: str) -> List[Dict]:
        flags = []
        restriction_count = 0

        for phrase in RESTRICTION_PHRASES_RU + RESTRICTION_PHRASES_KZ:
            count = text.count(phrase)
            restriction_count += count

        if restriction_count > 5:
            flags.append({
                "flag_type": "BRAND_LOCK",
                "description": f"High number of restrictive phrases ({restriction_count}) detected. "
                               f"Language suggests specifications designed to limit competition.",
                "severity": "medium",
                "evidence": f"Restrictive phrases count: {restriction_count}",
                "score_contribution": 15,
            })

        return flags

    def _score_to_level(self, score: float) -> str:
        if score >= 75:
            return "CRITICAL"
        elif score >= 50:
            return "HIGH"
        elif score >= 25:
            return "MEDIUM"
        return "LOW"

    def _generate_recommendation(self, risk_level: str, flags: List[Dict]) -> str:
        if risk_level == "CRITICAL":
            return (
                "CRITICAL RISK: This tender shows multiple strong indicators of manipulated specifications. "
                "Immediate review recommended. Consider referring to anti-corruption authorities. "
                "Key concerns: " + ", ".join(f["flag_type"] for f in flags[:3])
            )
        elif risk_level == "HIGH":
            return (
                "HIGH RISK: Significant red flags detected. Manual review by procurement analyst required. "
                "Check if specifications can be modified to allow fair competition."
            )
        elif risk_level == "MEDIUM":
            return (
                "MEDIUM RISK: Some concerning patterns detected. Review flagged items and verify "
                "whether restrictions are technically justified."
            )
        return (
            "LOW RISK: No significant manipulation indicators detected. "
            "Standard procurement process appears appropriate."
        )


# Singleton instance
risk_analyzer = RiskAnalyzer()
