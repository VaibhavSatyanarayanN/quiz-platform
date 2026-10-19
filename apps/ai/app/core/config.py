
import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Environment-based AI service configuration."""

    def __init__(self) -> None:
        self.max_input_chars = int(
            os.getenv("MAX_INPUT_CHARS", "200000")
        )

        # Gemini configuration
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv(
            "GEMINI_MODEL",
            "gemini-3.8-flash",
        )
        self.gemini_timeout_seconds = float(
            os.getenv("GEMINI_TIMEOUT_SECONDS", "60")
        )
        self.gemini_max_output_tokens = int(
            os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "8192")
        )

        # Groq configuration
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.groq_model = os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b",
        )
        self.groq_timeout_seconds = float(
            os.getenv("GROQ_TIMEOUT_SECONDS", "60")
        )
        self.groq_max_completion_tokens = int(
            os.getenv("GROQ_MAX_COMPLETION_TOKENS", "8192")
        )

    def validate_gemini_config(self) -> None:
        if not self.gemini_api_key.strip():
            raise RuntimeError(
                "GEMINI_API_KEY is missing from the environment."
            )
        if not self.gemini_model.strip():
            raise RuntimeError("GEMINI_MODEL must not be empty.")
        if self.gemini_timeout_seconds <= 0:
            raise RuntimeError(
                "GEMINI_TIMEOUT_SECONDS must be positive."
            )
        if self.gemini_max_output_tokens <= 0:
            raise RuntimeError(
                "GEMINI_MAX_OUTPUT_TOKENS must be positive."
            )

    def validate_groq_config(self) -> None:
        if not self.groq_api_key.strip():
            raise RuntimeError(
                "GROQ_API_KEY is missing from the environment."
            )
        if not self.groq_model.strip():
            raise RuntimeError("GROQ_MODEL must not be empty.")
        if self.groq_timeout_seconds <= 0:
            raise RuntimeError(
                "GROQ_TIMEOUT_SECONDS must be positive."
            )
        if self.groq_max_completion_tokens <= 0:
            raise RuntimeError(
                "GROQ_MAX_COMPLETION_TOKENS must be positive."
            )

    def validate_llm_config(self) -> None:
        if self.max_input_chars < 1:
            raise RuntimeError("MAX_INPUT_CHARS must be positive.")

        if self.gemini_api_key.strip():
            self.validate_gemini_config()
        elif self.groq_api_key.strip():
            self.validate_groq_config()
        else:
            raise RuntimeError(
                "Neither GEMINI_API_KEY nor GROQ_API_KEY is set in the environment."
            )


settings = Settings()
