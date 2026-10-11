
import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Environment-based AI service configuration."""

    def __init__(self) -> None:
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv(
            "GEMINI_MODEL",
            "gemini-2.5-flash",
        )
        self.gemini_timeout_seconds = float(
            os.getenv("GEMINI_TIMEOUT_SECONDS", "60")
        )
        self.max_input_chars = int(
            os.getenv("MAX_INPUT_CHARS", "200000")
        )

    def validate_llm_config(self) -> None:
        if not self.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is missing from the environment."
            )

        if self.gemini_timeout_seconds <= 0:
            raise RuntimeError(
                "GEMINI_TIMEOUT_SECONDS must be positive."
            )

        if self.max_input_chars < 1:
            raise RuntimeError("MAX_INPUT_CHARS must be positive.")


settings = Settings()