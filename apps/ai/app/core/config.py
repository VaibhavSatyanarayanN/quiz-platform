import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Environment-based AI service configuration."""

    def __init__(self) -> None:
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.groq_model = os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b",
        )
        self.groq_timeout_seconds = float(
            os.getenv("GROQ_TIMEOUT_SECONDS", "60")
        )
        self.max_input_chars = int(
            os.getenv("MAX_INPUT_CHARS", "200000")
        )
        self.groq_max_completion_tokens = int(
            os.getenv("GROQ_MAX_COMPLETION_TOKENS", "8192")
        )

    def validate_llm_config(self) -> None:
        if not self.groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY is missing from the environment."
            )

        if not self.groq_model.strip():
            raise RuntimeError("GROQ_MODEL must not be empty.")

        if self.groq_timeout_seconds <= 0:
            raise RuntimeError(
                "GROQ_TIMEOUT_SECONDS must be positive."
            )

        if self.max_input_chars < 1:
            raise RuntimeError("MAX_INPUT_CHARS must be positive.")

        if self.groq_max_completion_tokens <= 0:
            raise RuntimeError(
                "GROQ_MAX_COMPLETION_TOKENS must be positive."
            )


settings = Settings()
