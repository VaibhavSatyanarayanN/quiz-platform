
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import settings
from app.providers.base import LLMProvider


class OpenAIProvider(LLMProvider):
    """OpenAI-backed implementation of the structured LLM contract."""

    def __init__(self) -> None:
        settings.validate_llm_config()

        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=settings.openai_timeout_seconds,
            max_retries=settings.openai_max_retries,
        )
        self.model = settings.openai_model

    async def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
    ) -> BaseModel:
        completion = await self.client.beta.chat.completions.parse(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=response_model,
        )

        if not completion.choices:
            raise RuntimeError("The LLM returned no completion choices.")

        message = completion.choices[0].message

        if message.refusal:
            raise RuntimeError("The LLM refused the generation request.")

        if message.parsed is None:
            finish_reason = completion.choices[0].finish_reason
            raise RuntimeError(
                "The LLM did not return a valid structured response. "
                f"Finish reason: {finish_reason}"
            )

        return message.parsed

    async def close(self) -> None:
        await self.client.close()