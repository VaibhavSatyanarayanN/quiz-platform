
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.core.config import settings
from app.providers.base import LLMProvider


class GeminiProvider(LLMProvider):
    """Gemini implementation of the structured LLM interface."""

    def __init__(self) -> None:
        settings.validate_llm_config()

        self.client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(
                timeout=int(settings.gemini_timeout_seconds * 1000)
            ),
        )
        self.model = settings.gemini_model

    async def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
        agent_name: str | None = None,
    ) -> BaseModel:
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=response_model,
            ),
        )

        # Prefer the SDK's parsed Pydantic result.
        if response.parsed is not None:
            if isinstance(response.parsed, response_model):
                return response.parsed

            return response_model.model_validate(response.parsed)

        # Some responses may contain JSON text without a parsed object.
        if response.text:
            return response_model.model_validate_json(response.text)

        raise RuntimeError(
            "Gemini returned no structured response."
        )

    async def close(self) -> None:
        await self.client.aio.aclose()