import asyncio
import json
import logging
from typing import TypeVar

from groq import APIStatusError, AsyncGroq, RateLimitError
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.providers.base import LLMProvider

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def _clean_json_content(content: str) -> str:
    """Strip markdown code fences and extraneous whitespace if present."""
    stripped = content.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return stripped


class GroqProvider(LLMProvider):
    """Asynchronous Groq provider for structured agent responses."""

    def __init__(self) -> None:
        settings.validate_llm_config()

        self.client = AsyncGroq(
            api_key=settings.groq_api_key,
            timeout=settings.groq_timeout_seconds,
        )
        self.model = settings.groq_model
        self.max_completion_tokens = settings.groq_max_completion_tokens

    async def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[T],
        agent_name: str | None = None,
    ) -> T:
        """Generate JSON and validate it against the Pydantic model."""

        schema = response_model.model_json_schema()

        structured_user_prompt = (
            f"{user_prompt}\n\n"
            "OUTPUT REQUIREMENTS:\n"
            "Return exactly one valid JSON object. Do not include Markdown "
            "fences or text before or after the JSON.\n"
            "The JSON must match this schema:\n"
            f"{json.dumps(schema, ensure_ascii=False)}"
        )

        agent_label = agent_name or "UnknownAgent"
        logger.info(
            "Calling Groq: agent=%s model=%s response_model=%s max_completion_tokens=%d",
            agent_label,
            self.model,
            response_model.__name__,
            self.max_completion_tokens,
        )

        max_rate_limit_retries = 3
        retry_delay = 5.0

        for attempt in range(max_rate_limit_retries + 1):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": system_prompt,
                        },
                        {
                            "role": "user",
                            "content": structured_user_prompt,
                        },
                    ],
                    response_format={"type": "json_object"},
                    max_completion_tokens=self.max_completion_tokens,
                )

                choice = response.choices[0]
                content = choice.message.content

                if not content:
                    raise ValueError("Groq returned an empty response.")

                logger.info(
                    "Groq response received: agent=%s model=%s request_id=%s finish_reason=%s",
                    agent_label,
                    response.model,
                    response.id,
                    choice.finish_reason,
                )

                clean_content = _clean_json_content(content)
                data = json.loads(clean_content)
                result = response_model.model_validate(data)

                logger.info(
                    "Groq response passed Pydantic validation: agent=%s model=%s",
                    agent_label,
                    response_model.__name__,
                )

                return result

            except RateLimitError as exc:
                if attempt < max_rate_limit_retries:
                    logger.warning(
                        "Groq rate limit (429) on attempt %d/%d for agent=%s. Waiting %.1fs before retrying...",
                        attempt + 1,
                        max_rate_limit_retries,
                        agent_label,
                        retry_delay,
                    )
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                safe_msg = getattr(exc, "message", str(exc))[:300]
                logger.error(
                    "Groq rate limit exceeded after retries: agent=%s model=%s response_model=%s status_code=%s message=%s",
                    agent_label,
                    self.model,
                    response_model.__name__,
                    getattr(exc, "status_code", 429),
                    safe_msg,
                )
                raise

            except APIStatusError as exc:
                safe_msg = getattr(exc, "message", str(exc))[:300]
                logger.error(
                    "Groq API request failed: agent=%s model=%s response_model=%s status_code=%s message=%s",
                    agent_label,
                    self.model,
                    response_model.__name__,
                    getattr(exc, "status_code", "unknown"),
                    safe_msg,
                )
                raise

            except json.JSONDecodeError:
                logger.exception(
                    "Groq returned invalid JSON for agent=%s response_model=%s",
                    agent_label,
                    response_model.__name__,
                )
                raise

            except ValidationError:
                logger.exception(
                    "Groq JSON failed Pydantic validation for agent=%s response_model=%s",
                    agent_label,
                    response_model.__name__,
                )
                raise

            except ValueError:
                logger.exception(
                    "Groq returned an empty or invalid response for agent=%s response_model=%s",
                    agent_label,
                    response_model.__name__,
                )
                raise

    async def close(self) -> None:
        """Close the asynchronous Groq client."""
        await self.client.close()