
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictSchema(BaseModel):
    """Base contract for all agent data."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class LearningObjective(StrictSchema):
    objective_id: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=10, max_length=500)
    topic: str = Field(min_length=1, max_length=200)


class TopicCoverage(StrictSchema):
    topic: str = Field(min_length=1, max_length=200)
    question_count: int = Field(ge=0, le=100)


class CurriculumPlan(StrictSchema):
    title: str = Field(min_length=1, max_length=200)
    learning_objectives: list[LearningObjective] = Field(
        min_length=1,
        max_length=50,
    )
    topic_coverage: list[TopicCoverage] = Field(
        min_length=1,
        max_length=50,
    )
    difficulty_distribution: dict[str, int] = Field(
        description="Question counts by difficulty: easy, medium, hard."
    )

    @model_validator(mode="after")
    def validate_difficulty_distribution(self):
        allowed = {"easy", "medium", "hard"}

        if set(self.difficulty_distribution) - allowed:
            raise ValueError("Unsupported difficulty level.")

        if any(value < 0 for value in self.difficulty_distribution.values()):
            raise ValueError("Difficulty counts cannot be negative.")

        return self


class QuestionOption(StrictSchema):
    option_id: str = Field(min_length=1, max_length=20)
    text: str = Field(min_length=1, max_length=1000)


class GeneratedQuestion(StrictSchema):
    question_id: str = Field(min_length=1, max_length=50)
    question_type: Literal["mcq", "true_false", "open_ended"]
    question_text: str = Field(min_length=5, max_length=3000)
    options: list[QuestionOption] = Field(default_factory=list)
    correct_answer: str = Field(min_length=1, max_length=2000)
    explanation: str = Field(min_length=1, max_length=3000)
    difficulty: Literal["easy", "medium", "hard"]
    cognitive_level: Literal[
        "remember",
        "understand",
        "apply",
        "analyze",
        "evaluate",
        "create",
    ]
    learning_objective_id: str = Field(min_length=1, max_length=50)
    source_pages: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_question(self):
        if any(page < 1 for page in self.source_pages):
            raise ValueError("Source page numbers must be positive.")

        if self.question_type == "mcq":
            if len(self.options) < 2:
                raise ValueError("MCQs require at least two options.")

            option_ids = [option.option_id for option in self.options]

            if len(option_ids) != len(set(option_ids)):
                raise ValueError("Option IDs must be unique.")

            if self.correct_answer not in option_ids:
                raise ValueError(
                    "MCQ correct_answer must match an option_id."
                )

        elif self.question_type == "true_false":
            if self.options:
                raise ValueError(
                    "True/false questions do not use option objects."
                )

            if self.correct_answer.lower() not in {"true", "false"}:
                raise ValueError(
                    "True/false correct_answer must be true or false."
                )

        elif self.options:
            raise ValueError(
                "Open-ended questions do not use option objects."
            )

        return self


class QuestionSet(StrictSchema):
    questions: list[GeneratedQuestion] = Field(
        min_length=1,
        max_length=100,
    )


class QuestionValidation(StrictSchema):
    question_id: str
    is_correct: bool
    is_unambiguous: bool
    is_grounded: bool
    issues: list[str] = Field(default_factory=list)
    suggested_revision: str | None = None


class ValidationReport(StrictSchema):
    approved: bool
    results: list[QuestionValidation]
    summary: str = Field(min_length=1, max_length=2000)


class PedagogyAssessment(StrictSchema):
    question_id: str
    difficulty_appropriate: bool
    cognitive_level_appropriate: bool
    educational_value: int = Field(ge=1, le=5)
    feedback: str = Field(min_length=1, max_length=2000)
    suggested_revision: str | None = None


class PedagogyReport(StrictSchema):
    approved: bool
    assessments: list[PedagogyAssessment]
    summary: str = Field(min_length=1, max_length=2000)