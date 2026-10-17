
from typing import cast

from app.providers.base import LLMProvider
from app.schemas.agents import CurriculumPlan
from app.schemas.generation import GenerationRequest
from app.core.config import settings
from app.core.source_policy import get_source_policy
from app.schemas.routing import KnowledgeMode


class CurriculumAgent:
    """Creates a structured learning plan for quiz generation."""

    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    async def plan(
        self,
        request: GenerationRequest,
        *,
        knowledge_mode: KnowledgeMode = "open_world",
    ) -> CurriculumPlan:
        """Generate and validate a curriculum plan."""

        settings.validate_llm_config()

        source_text = request.source_text or ""
        source_text = source_text[: settings.max_input_chars]

        context_parts: list[str] = []

        if knowledge_mode == "document":
            context_parts.append(
                "DOCUMENT CONTENT (Extracted from uploaded PDF):\n"
                f"{source_text}"
            )
        elif knowledge_mode == "reference_url":
            context_parts.append(
                "REFERENCE CONTENT (Retrieved from URL):\n"
                f"{source_text}"
            )
        else:
            if request.topic:
                context_parts.append(f"Requested topic:\n{request.topic}")
            if source_text:
                context_parts.append(
                    "Source material:\n"
                    "Treat this material as the primary source of facts.\n"
                    f"{source_text}"
                )

        context = "\n\n".join(context_parts)

        system_prompt = """
You are an expert instructional designer and curriculum planner.

Your responsibility is to create a curriculum plan for an AI-powered
educational quiz platform.

Requirements:
1. Identify clear, specific, measurable learning objectives.
2. Divide the material into meaningful topic areas.
3. Allocate the exact requested number of questions across those areas.
4. Use only the requested difficulty distribution.
5. Adapt the plan to the target audience and requested language.
6. Respect the requested question types.
7. When source material is supplied, ground the plan in that material.
8. Do not invent facts or claim that the source covers concepts it does not.
9. Give every learning objective a unique objective_id.
10. Keep the plan focused; avoid redundant learning objectives.

The topic_coverage question counts MUST sum to the requested question count.
The difficulty_distribution MUST exactly match the requested distribution.

Return only data matching the provided structured response schema.
"""

        system_prompt += "\n\n" + get_source_policy(knowledge_mode)
        user_prompt = f"""
Create a curriculum plan using the following input.

{context}

Generation requirements:
- Number of questions: {request.question_count}
- Question types: {", ".join(request.question_types)}
- Difficulty distribution: {request.difficulty_distribution}
- Target audience: {request.target_audience}
- Language: {request.language}

Create enough learning objectives to provide meaningful coverage.
Allocate all {request.question_count} questions across the topic areas.
Use the supplied difficulty distribution without changing its counts.
"""

        plan = cast(
            CurriculumPlan,
            await self.provider.generate_structured(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                response_model=CurriculumPlan,
                agent_name="CurriculumAgent",
            ),
        )

        # Enforce business rules that go beyond the Pydantic field schema.
        allocated_questions = sum(
            topic.question_count for topic in plan.topic_coverage
        )

        if allocated_questions != request.question_count:
            raise ValueError(
                "Curriculum plan allocated "
                f"{allocated_questions} questions, but "
                f"{request.question_count} were requested."
            )

        if plan.difficulty_distribution != request.difficulty_distribution:
            raise ValueError(
                "Curriculum plan difficulty distribution does not "
                "match the requested distribution."
            )

        objective_ids = [
            objective.objective_id
            for objective in plan.learning_objectives
        ]

        if len(objective_ids) != len(set(objective_ids)):
            raise ValueError(
                "Curriculum plan contains duplicate learning objective IDs."
            )

        return plan