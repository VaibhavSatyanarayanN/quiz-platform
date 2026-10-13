
from typing import cast
import re

from app.core.config import settings
from app.providers.base import LLMProvider
from app.schemas.agents import CurriculumPlan, QuestionSet
from app.schemas.generation import GenerationRequest
from app.core.source_policy import get_source_policy
from app.schemas.routing import KnowledgeMode

class QuestionGeneratorAgent:
    """Generates curriculum-aligned quiz questions using an LLM."""

    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    async def generate(
        self,
        request: GenerationRequest,
        curriculum_plan: CurriculumPlan,
        *,
        knowledge_mode: KnowledgeMode = "open_world",
        revision_feedback: str | None = None,
    ) -> QuestionSet:
        """Generate a structured question set from a curriculum plan."""

        source_text = (request.source_text or "")[
            : settings.max_input_chars
        ]

        context_parts: list[str] = []

        if request.topic:
            context_parts.append(f"Requested topic:\n{request.topic}")

        if source_text:
            context_parts.append(
                "Reference material:\n"
                "Use this material as the factual source for questions. "
                "Do not invent unsupported source-specific claims.\n"
                f"{source_text}"
            )

        context = "\n\n".join(context_parts)

        plan_json = curriculum_plan.model_dump_json(indent=2)

        system_prompt = """
You are an expert educational assessment designer.

Generate high-quality quiz questions using the supplied curriculum plan.

GENERAL REQUIREMENTS
1. Return the requested number of questions exactly.
2. Follow the requested question types and difficulty distribution.
3. Cover the learning objectives and topic allocations in the plan.
4. Use clear, unambiguous language appropriate for the target audience.
5. Avoid duplicate questions and superficial rewordings.
6. Ensure every question has one meaningful educational purpose.
7. Match every learning_objective_id to an ID in the curriculum plan.
8. Use the requested language.
9. When source material is provided, ground questions and explanations
   in it. Do not fabricate source-specific information.

QUESTION TYPES
- mcq: Provide at least two distinct options. Use option_id values to
  identify options. The correct_answer field MUST contain the option_id
  of the correct option, not the option text.
- true_false: Provide no options. correct_answer must be "true" or "false".
- open_ended: Provide no options. correct_answer must contain a concise,
  reference-quality expected answer.

EXPLANATIONS
Every question must include an explanation that clarifies why its answer
is correct. Do not include contradictory answers or misleading distractors.

SOURCE REFERENCES
If source material is supplied, populate source_pages only with page
numbers that are actually provided as source metadata. If page metadata
is unavailable, leave source_pages empty. Never invent page numbers.

Return only data matching the provided structured response schema.
"""
        system_prompt += "\n\n" + get_source_policy(knowledge_mode)

        user_prompt = f"""
Generate quiz questions from this input.

SOURCE CONTEXT:
{context if context else "No separate source text was supplied."}

CURRICULUM PLAN:
{plan_json}

GENERATION REQUIREMENTS:
- Question count: {request.question_count}
- Allowed question types: {request.question_types}
- Difficulty distribution: {request.difficulty_distribution}
- Target audience: {request.target_audience}
- Language: {request.language}

Return exactly {request.question_count} questions.

Distribute questions across the curriculum plan's topic coverage and
learning objectives. Match the specified difficulty counts exactly.
Use only the allowed question types.
"""
        if revision_feedback:
            user_prompt += f"""

        REVISION REQUIRED:
        The previous question set failed one or more quality checks.

        Review feedback:
        {revision_feedback}

        Generate a corrected question set that addresses every issue.
        Do not repeat the identified mistakes.
        Preserve the requested question count, question types, difficulty
        distribution, learning objectives, and source restrictions.
        """

        question_set = cast(
            QuestionSet,
            await self.provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_model=QuestionSet,
            ),
        )

        self._validate_question_set(
            question_set=question_set,
            request=request,
            curriculum_plan=curriculum_plan,
            knowledge_mode=knowledge_mode,
            source_text=source_text,
        )

        return question_set

    @staticmethod
    def _validate_question_set(
        *,
        question_set: QuestionSet,
        request: GenerationRequest,
        curriculum_plan: CurriculumPlan,
        knowledge_mode: KnowledgeMode,
        source_text: str,
    ) -> None:
        questions = question_set.questions

        if len(questions) != request.question_count:
            raise ValueError(
                f"Expected {request.question_count} questions, "
                f"received {len(questions)}."
            )

        allowed_types = set(request.question_types)

        for question in questions:
            if question.question_type not in allowed_types:
                raise ValueError(
                    f"Question {question.question_id} uses unsupported "
                    f"type: {question.question_type}."
                )

        actual_difficulty_counts = {
            level: sum(
                question.difficulty == level for question in questions
            )
            for level in ("easy", "medium", "hard")
        }

        if actual_difficulty_counts != request.difficulty_distribution:
            raise ValueError(
                "Generated question difficulty counts do not match "
                f"the request. Expected {request.difficulty_distribution}; "
                f"received {actual_difficulty_counts}."
            )

        question_ids = [q.question_id for q in questions]

        if len(question_ids) != len(set(question_ids)):
            raise ValueError("Generated question IDs must be unique.")

        objective_ids = {
            objective.objective_id
            for objective in curriculum_plan.learning_objectives
        }

        def normalize_text(value: str) -> str:
                """Normalize whitespace for matching extracted PDF/web text."""
                return re.sub(r"\s+", " ", value).strip()

        if knowledge_mode in ("document", "reference_url"):
            normalized_source = normalize_text(source_text)

            for question in question_set.questions:
                if not question.source_evidence:
                    raise ValueError(
                        f"Question {question.question_id} has no source evidence."
                    )

                for evidence in question.source_evidence:
                    if normalize_text(evidence) not in normalized_source:
                        raise ValueError(
                            f"Question {question.question_id} contains evidence "
                            "that does not match the retrieved source."
                        )

        for question in questions:
            if question.learning_objective_id not in objective_ids:
                raise ValueError(
                    f"Question {question.question_id} references unknown "
                    f"learning objective: {question.learning_objective_id}."
                )