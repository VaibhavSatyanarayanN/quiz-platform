
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.agents import (
    CurriculumPlan,
    PedagogyReport,
    QuestionSet,
    ValidationReport,
    StrictSchema,
)


QuestionType = Literal["mcq", "true_false", "open_ended"]
Difficulty = Literal["easy", "medium", "hard"]


class GenerationRequest(StrictSchema):
    topic: str | None = Field(default=None, min_length=2, max_length=500)
    source_text: str | None = Field(
        default=None,
        min_length=1,
        max_length=200_000,
    )
    question_count: int = Field(default=10, ge=1, le=100)
    question_types: list[QuestionType] = Field(
        default_factory=lambda: ["mcq"],
        min_length=1,
    )
    difficulty_distribution: dict[Difficulty, int] = Field(
        default_factory=lambda: {
            "easy": 3,
            "medium": 5,
            "hard": 2,
        }
    )
    target_audience: str = Field(
        default="General learners",
        min_length=1,
        max_length=200,
    )
    language: str = Field(default="English", min_length=1, max_length=50)
    max_revision_attempts: int = Field(default=1, ge=0, le=2)

    @model_validator(mode="after")
    def validate_request(self):
        if not self.topic and not self.source_text:
            raise ValueError(
                "Provide a topic, source text, or both."
            )

        if len(self.question_types) != len(set(self.question_types)):
            raise ValueError("Question types must be unique.")

        if sum(self.difficulty_distribution.values()) != self.question_count:
            raise ValueError(
                "Difficulty distribution must sum to question_count."
            )

        if any(count < 0 for count in self.difficulty_distribution.values()):
            raise ValueError(
                "Difficulty counts cannot be negative."
            )

        return self



class GenerationResponse(StrictSchema):
    status: Literal["completed", "needs_review"]
    curriculum_plan: CurriculumPlan
    question_set: QuestionSet
    validation_report: ValidationReport
    pedagogy_report: PedagogyReport
    revision_attempts: int = Field(ge=0, le=2)