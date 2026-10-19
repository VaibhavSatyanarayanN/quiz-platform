import asyncio
import copy
import logging
import re
from typing import Type

from google import genai
from google.genai import types
from google.genai.errors import APIError, ClientError, ServerError
from pydantic import BaseModel

from app.core.config import settings
from app.providers.base import LLMProvider

logger = logging.getLogger(__name__)


def _clean_json_content(content: str) -> str:
    """Strip markdown code block fences and extra whitespace."""
    trimmed = content.strip()
    if trimmed.startswith("```"):
        trimmed = re.sub(r"^```(?:json)?\s*", "", trimmed)
        trimmed = re.sub(r"\s*```$", "", trimmed)
    return trimmed.strip()


def _prepare_gemini_schema(model_cls: Type[BaseModel]) -> dict:
    """Prepares an OpenAPI/JSON Schema strictly compatible with Gemini Developer API.

    1. Inlines $defs and resolves all $ref pointers.
    2. Strips additionalProperties / additional_properties (which triggers Gemini
       Enterprise Agent Platform errors).
    3. Strips validation keywords unsupported or rejected by Gemini Schema proto
       (e.g., minItems, maxItems, minLength, maxLength, minimum, maximum).
    """
    raw_schema = model_cls.model_json_schema()
    defs = raw_schema.pop("$defs", {})

    unsupported_keys = {
        "additionalProperties",
        "additional_properties",
        "maxItems",
        "minItems",
        "maxLength",
        "minLength",
        "maximum",
        "minimum",
        "$schema",
    }

    def clean_node(node):
        if not isinstance(node, dict):
            return node

        if "$ref" in node:
            ref_name = node["$ref"].split("/")[-1]
            if ref_name in defs:
                target = copy.deepcopy(defs[ref_name])
                for k, v in node.items():
                    if k != "$ref":
                        target[k] = v
                return clean_node(target)

        cleaned = {}
        for k, v in node.items():
            if k in unsupported_keys:
                continue
            if isinstance(v, dict):
                cleaned[k] = clean_node(v)
            elif isinstance(v, list):
                cleaned[k] = [clean_node(x) if isinstance(x, dict) else x for x in v]
            else:
                cleaned[k] = v

        # Free-form object schemas (like dict[str, int]) lose additionalProperties.
        # For difficulty_distribution, define explicit easy/medium/hard properties.
        if cleaned.get("type") in ("object", "OBJECT") and not cleaned.get("properties"):
            desc = (cleaned.get("description") or "").lower()
            title = (cleaned.get("title") or "").lower()
            if "difficult" in desc or "difficult" in title:
                cleaned["properties"] = {
                    "easy": {"type": "integer"},
                    "medium": {"type": "integer"},
                    "hard": {"type": "integer"},
                }
                cleaned["required"] = ["easy", "medium", "hard"]

        return cleaned

    return clean_node(raw_schema)


class GeminiProvider(LLMProvider):
    """Gemini implementation of the structured LLM interface."""

    def __init__(self) -> None:
        settings.validate_llm_config()

        self.client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(
                async_client_args={"timeout": settings.gemini_timeout_seconds}
            ),
        )
        self.model = settings.gemini_model
        self.max_output_tokens = settings.gemini_max_output_tokens

    async def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
        agent_name: str | None = None,
    ) -> BaseModel:
        clean_schema = _prepare_gemini_schema(response_model)
        max_retries = 3

        for attempt in range(max_retries + 1):
            try:
                response = await self.client.aio.models.generate_content(
                    model=self.model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        response_schema=clean_schema,
                        max_output_tokens=self.max_output_tokens,
                    ),
                )

                if response.parsed is not None:
                    if isinstance(response.parsed, response_model):
                        return response.parsed
                    return response_model.model_validate(response.parsed)

                if response.text:
                    cleaned_text = _clean_json_content(response.text)
                    return response_model.model_validate_json(cleaned_text)

                raise RuntimeError("Gemini returned an empty structured response.")

            except (ClientError, ServerError, APIError) as e:
                status_code = getattr(e, "code", None)
                if status_code is None and hasattr(e, "response"):
                    status_code = getattr(e.response, "status_code", None)

                # Retry on 429 (quota / rate limit) and 503 (high demand / unavailable)
                if status_code in (429, 503) and attempt < max_retries:
                    backoff = 2 ** attempt
                    logger.warning(
                        "Gemini API returned status %s for agent '%s'. Retrying in %ss (attempt %s/%s)...",
                        status_code,
                        agent_name or "Unknown",
                        backoff,
                        attempt + 1,
                        max_retries,
                    )
                    await asyncio.sleep(backoff)
                    continue

                logger.error(
                    "Gemini API error during structured generation: "
                    "agent='%s', model='%s', response_model='%s', status_code=%s, error='%s'",
                    agent_name or "Unknown",
                    self.model,
                    response_model.__name__,
                    status_code,
                    str(e)[:300],
                )
                raise

        raise RuntimeError("Failed to generate structured response after retries.")

    async def close(self) -> None:
        await self.client.aio.aclose()