
from typing import cast

from app.core.source_policy import get_source_policy
from app.providers.base import LLMProvider
from app.schemas.agents import (
    CurriculumPlan,
    QuestionSet,
    ValidationReport,
)
from app.schemas.routing import KnowledgeMode


class ValidationAgent:
    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    async def validate(
        self,
        question_set: QuestionSet,
        curriculum_plan: CurriculumPlan,
        *,
        knowledge_mode: KnowledgeMode,
        source_text: str | None = None,
    ) -> ValidationReport:
        source = source_text or ""

        system_prompt = """
You are a rigorous educational assessment quality reviewer.

Evaluate every generated question independently.

For each question, assess:
1. Factual correctness.
2. Whether the wording is clear and unambiguous.
3. Whether the correct answer is actually supported by the permitted source.
4. Whether the explanation agrees with the correct answer.
5. Whether MCQ options are plausible and there is one defensible correct answer.
6. Whether the question matches its assigned learning objective.
7. Whether the answer is consistent with the question type.

Rules:
- Return one result for every input question.
- Preserve the exact question_id.
- Do not approve unsupported factual claims.
- In document mode, the supplied document is the exclusive factual source.
- Do not use outside knowledge to fill gaps in a document or URL.
- If evidence is insufficient, mark is_grounded=false and explain why.
- Add actionable issues when a question fails.
- Set approved=true only if every question passes all required checks.
- Do not rewrite the questions in this step.
Return only the requested structured schema.
"""

        system_prompt += "\n\n" + get_source_policy(knowledge_mode)

        user_prompt = f"""
KNOWLEDGE MODE:
{knowledge_mode}

PERMITTED SOURCE TEXT:
{source if source else "[No source text supplied]"}

CURRICULUM PLAN:
{curriculum_plan.model_dump_json(indent=2)}

QUESTIONS TO REVIEW:
{question_set.model_dump_json(indent=2)}

Return a ValidationReport containing exactly one result per question.
"""

        report = cast(
            ValidationReport,
            await self.provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_model=ValidationReport,
            ),
        )

        self._validate_report(
            report=report,
            question_set=question_set,
        )

        return report

    @staticmethod
    def _validate_report(
        *,
        report: ValidationReport,
        question_set: QuestionSet,
    ) -> None:
        expected_ids = [
            question.question_id for question in question_set.questions
        ]
        actual_ids = [result.question_id for result in report.results]

        if len(actual_ids) != len(set(actual_ids)):
            raise ValueError(
                "Validation report contains duplicate question IDs."
            )

        if set(actual_ids) != set(expected_ids):
            raise ValueError(
                "Validation report must contain exactly one result "
                "for every generated question."
            )

        failed_ids = {
            result.question_id
            for result in report.results
            if not (
                result.is_correct
                and result.is_unambiguous
                and result.is_grounded
            )
        }

        if report.approved and failed_ids:
            raise ValueError(
                "Validator approved a report containing failed questions."
            )

        if failed_ids and report.approved:
            raise ValueError(
                "A report with failed questions cannot be approved."
            )