
from typing import Literal

from pydantic import Field

from app.schemas.agents import StrictSchema


KnowledgeMode = Literal[
    "open_world",
    "reference_url",
    "document",
]


class KnowledgeModeDecision(StrictSchema):
    mode: KnowledgeMode

    reason: str = Field(
        min_length=1,
        max_length=1000,
    )

    requires_retrieval: bool

    requires_document_extraction: bool