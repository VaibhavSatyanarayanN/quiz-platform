
from typing import cast

from app.core.source_policy import get_source_policy
from app.providers.base import LLMProvider
from app.schemas.agents import (
    CurriculumPlan,
    PedagogyReport,
    QuestionSet,
)
from app.schemas.routing import KnowledgeMode


class PedagogyAgent:
    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    async def assess(
        self,
        question_set: QuestionSet,
        curriculum_plan: CurriculumPlan,
        *,
        knowledge_mode: KnowledgeMode,
        source_text: str | None = None,
    ) -> PedagogyReport:
        system_prompt = """
You are an expert educational assessment and instructional design reviewer.

Assess every generated question for:
1. Appropriate difficulty for its assigned difficulty level and target audience.
2. Appropriate cognitive level: remember, understand, apply, analyze,
   evaluate, or create.
3. Educational value and relevance to the assigned learning objective.
4. Whether the question tests meaningful understanding rather than
   unnecessary wording tricks or superficial recall.
5. Whether the question is clear and suitable for its question type.

Rules:
- Return exactly one assessment for every question.
- Preserve each question_id exactly.
- Do not change questions, answers, or explanations.
- Do not introduce new factual claims.
- Base assessments on the supplied curriculum plan and questions.
- Educational value must be an integer from 1 to 5.
- Set approved=true only if all questions meet the required standards.
- Give specific, actionable feedback when a question needs improvement.
Return only the requested structured schema.
"""

        system_prompt += "\n\n" + get_source_policy(knowledge_mode)

        user_prompt = f"""
KNOWLEDGE MODE:
{knowledge_mode}

TARGET AUDIENCE:
Use the target audience specified in the curriculum request context.

SOURCE TEXT:
{source_text or "[No reference source supplied]"}

CURRICULUM PLAN:
{curriculum_plan.model_dump_json(indent=2)}

QUESTIONS:
{question_set.model_dump_json(indent=2)}

Return a PedagogyReport with exactly one assessment per question.
"""

        report = cast(
            PedagogyReport,
            await self.provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_model=PedagogyReport,
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
        report: PedagogyReport,
        question_set: QuestionSet,
    ) -> None:
        expected_ids = {
            question.question_id for question in question_set.questions
        }
        actual_ids = [
            assessment.question_id
            for assessment in report.assessments
        ]

        if len(actual_ids) != len(set(actual_ids)):
            raise ValueError(
                "Pedagogy report contains duplicate question IDs."
            )

        if set(actual_ids) != expected_ids:
            raise ValueError(
                "Pedagogy report must contain exactly one assessment "
                "for every generated question."
            )

        failures = [
            assessment
            for assessment in report.assessments
            if not (
                assessment.difficulty_appropriate
                and assessment.cognitive_level_appropriate
                and assessment.educational_value >= 3
            )
        ]

        if report.approved and failures:
            raise ValueError(
                "Pedagogy report approved questions that failed "
                "the required educational quality checks."
            )