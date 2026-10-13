import json
import logging
from typing import TypeVar

from groq import AsyncGroq
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)
from app.providers.base import LLMProvider

class GroqProvider(LLMProvider):
    """Asynchronous Groq provider for structured agent responses."""

    def __init__(self) -> None:
        settings.validate_llm_config()

        self.client = AsyncGroq(
            api_key=settings.groq_api_key,
            timeout=settings.groq_timeout_seconds,
        )
        self.model = settings.groq_model

    async def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[T],
    ) -> T:
        """Generate and validate a structured Pydantic response."""

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
                        "content": user_prompt,
                    },
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "agent_response",
                        "strict": False,
                        "schema": response_model.model_json_schema(),
                    },
                },
            )

            choice = response.choices[0]
            content = choice.message.content

            if not content:
                raise ValueError(
                    "Groq returned an empty structured response."
                )

            data = json.loads(content)
            return response_model.model_validate(data)

        except (json.JSONDecodeError, ValueError):
            logger.exception(
                "Groq returned an invalid response for %s",
                response_model.__name__,
            )
            raise

    async def close(self) -> None:
        """Close the asynchronous Groq client."""
        await self.client.close()