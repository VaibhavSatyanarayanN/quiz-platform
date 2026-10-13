
from dataclasses import dataclass

from app.agents.knowledge_mode_router import KnowledgeModeRouter
from app.agents.planner import CurriculumAgent
from app.agents.question_generator import QuestionGeneratorAgent
from app.agents.validator import ValidationAgent
from app.agents.pedagogy import PedagogyAgent

from app.schemas.generation import (
    GenerationRequest,
    GenerationResponse,
)
from app.schemas.routing import KnowledgeModeDecision


@dataclass(frozen=True)
class WorkflowResult:
    knowledge_mode: KnowledgeModeDecision
    response: GenerationResponse


class GenerationWorkflow:
    def __init__(
        self,
        *,
        router: KnowledgeModeRouter,
        planner: CurriculumAgent,
        question_generator: QuestionGeneratorAgent,
        validator: ValidationAgent,
        pedagogy: PedagogyAgent,
    ) -> None:
        self.router = router
        self.planner = planner
        self.question_generator = question_generator
        self.validator = validator
        self.pedagogy = pedagogy

    async def run(
        self,
        request: GenerationRequest,
        *,
        has_pdf_upload: bool = False,
        extracted_pdf_text: str | None = None,
        reference_url: str | None = None,
        retrieved_url_text: str | None = None,
    ) -> GenerationResponse:
        # Fail closed if the selected source is unavailable.
        if has_pdf_upload and not (
            extracted_pdf_text and extracted_pdf_text.strip()
        ):
            raise ValueError(
                "A PDF was uploaded, but extracted PDF text is missing."
            )

        if (
            reference_url
            and not has_pdf_upload
            and not (retrieved_url_text and retrieved_url_text.strip())
        ):
            raise ValueError(
                "The reference URL has not been retrieved successfully."
            )

        decision = self.router.route(
            has_pdf_upload=has_pdf_upload,
            reference_url=reference_url,
            topic=request.topic,
            source_text=request.source_text,
        )

        if decision.mode == "document":
            source_text = extracted_pdf_text
        elif decision.mode == "reference_url":
            source_text = retrieved_url_text
        else:
            source_text = request.source_text

        if decision.mode in ("document", "reference_url"):
            if not source_text or not source_text.strip():
                raise ValueError(
                    f"{decision.mode} mode requires source content."
                )

        effective_request = request.model_copy(
            update={"source_text": source_text}
        )

        # Plan once; every retry must follow the same curriculum.
        curriculum_plan = await self.planner.plan(
            effective_request,
            knowledge_mode=decision.mode,
        )

        revision_feedback: str | None = None
        revision_attempts = 0

        # Initial generation + up to max_revision_attempts retries.
        while True:
            question_set = await self.question_generator.generate(
                effective_request,
                curriculum_plan,
                knowledge_mode=decision.mode,
                revision_feedback=revision_feedback,
            )

            validation_report = await self.validator.validate(
                question_set,
                curriculum_plan,
                knowledge_mode=decision.mode,
                source_text=source_text,
            )

            pedagogy_report = await self.pedagogy.assess(
                question_set,
                curriculum_plan,
                knowledge_mode=decision.mode,
                source_text=source_text,
            )

            validation_passed = validation_report.approved
            pedagogy_passed = pedagogy_report.approved

            if validation_passed and pedagogy_passed:
                status = "completed"
                break

            if revision_attempts >= request.max_revision_attempts:
                status = "needs_review"
                break

            # Include concrete feedback for the next generation attempt.
            feedback_parts: list[str] = []

            if not validation_passed:
                feedback_parts.append(
                    "FACTUAL VALIDATION FAILED:\n"
                    + validation_report.model_dump_json(indent=2)
                )

            if not pedagogy_passed:
                feedback_parts.append(
                    "PEDAGOGY ASSESSMENT FAILED:\n"
                    + pedagogy_report.model_dump_json(indent=2)
                )

            revision_feedback = "\n\n".join(feedback_parts)
            revision_attempts += 1

        return GenerationResponse(
            status=status,
            curriculum_plan=curriculum_plan,
            question_set=question_set,
            validation_report=validation_report,
            pedagogy_report=pedagogy_report,
            revision_attempts=revision_attempts,
        )