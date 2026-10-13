
from app.schemas.routing import KnowledgeModeDecision


class KnowledgeModeRouter:
    """
    Selects the knowledge source for quiz generation.

    has_pdf_upload must come from trusted server-side upload metadata,
    not from an LLM-generated value.
    """

    def route(
        self,
        *,
        has_pdf_upload: bool,
        reference_url: str | None,
        topic: str | None,
        source_text: str | None = None,
    ) -> KnowledgeModeDecision:

        # An uploaded PDF takes priority over other sources.
        if has_pdf_upload:
            return KnowledgeModeDecision(
                mode="document",
                reason=(
                    "A PDF was uploaded. Its extracted content "
                    "must be the exclusive factual source."
                ),
                requires_retrieval=True,
                requires_document_extraction=True,
            )

        # An explicitly supplied reference URL selects URL mode.
        if reference_url:
            return KnowledgeModeDecision(
                mode="reference_url",
                reason=(
                    "A reference URL was supplied. Retrieve and use "
                    "its accessible content as the factual source."
                ),
                requires_retrieval=True,
                requires_document_extraction=False,
            )

        # Without a PDF or URL, use the topic/prompt and model knowledge.
        if topic and topic.strip():
            return KnowledgeModeDecision(
                mode="open_world",
                reason=(
                    "No PDF or reference URL was supplied. "
                    "Generate from the user's topic and general knowledge."
                ),
                requires_retrieval=False,
                requires_document_extraction=False,
            )

        # Pasted text alone can be used as the request's context,
        # but it does not establish that a PDF was uploaded.
        if source_text and source_text.strip():
            return KnowledgeModeDecision(
                mode="open_world",
                reason=(
                    "User-provided text is available, but no PDF or "
                    "reference URL was identified. Open-world generation "
                    "may use the text alongside general knowledge."
                ),
                requires_retrieval=False,
                requires_document_extraction=False,
            )

        raise ValueError(
            "Cannot determine the knowledge source. Provide a topic, "
            "reference URL, or upload a PDF."
        )