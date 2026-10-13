
import pytest

from app.agents.knowledge_mode_router import KnowledgeModeRouter
from app.orchestration.workflow import GenerationWorkflow
from app.schemas.agents import (
    CurriculumPlan,
    LearningObjective,
    QuestionOption,
    QuestionSet,
    GeneratedQuestion,
)
from app.schemas.generation import GenerationRequest



class FakePlanner:
    async def plan(self, request, *, knowledge_mode="open_world"):
        assert knowledge_mode == "document"
        assert request.source_text == "Facts extracted from the PDF."

        return CurriculumPlan(
            title="PDF quiz",
            learning_objectives=[
                LearningObjective(
                    objective_id="obj-1",
                    description="Understand the supplied PDF facts",
                    topic="PDF content",
                )
            ],
            topic_coverage=[
                {"topic": "PDF content", "question_count": 1}
            ],
            difficulty_distribution={
                "easy": 1,
                "medium": 0,
                "hard": 0,
            },
        )



class FakeQuestionGenerator:
    async def generate(
        self,
        request,
        curriculum_plan,
        *,
        knowledge_mode="open_world",
        revision_feedback=None,
    ):
        assert knowledge_mode == "document"
        assert request.source_text == "Facts extracted from the PDF."

        # Keep your existing QuestionSet return value here.
        return QuestionSet(
            questions=[
                GeneratedQuestion(
                    question_id="q-1",
                    question_type="mcq",
                    question_text="Which option matches the source?",
                    options=[
                        QuestionOption(option_id="A", text="Source fact"),
                        QuestionOption(option_id="B", text="Unsupported claim"),
                    ],
                    correct_answer="A",
                    explanation="The source states this fact.",
                    difficulty="easy",
                    cognitive_level="remember",
                    learning_objective_id="obj-1",
                    source_pages=[1],
                )
            ]
        )

class FakeValidator:
    async def validate(
        self,
        question_set,
        curriculum_plan,
        *,
        knowledge_mode,
        source_text=None,
    ):
        from app.schemas.agents import ValidationReport

        return ValidationReport(
            approved=True,
            results=[
                {
                    "question_id": question.question_id,
                    "is_correct": True,
                    "is_unambiguous": True,
                    "is_grounded": True,
                    "issues": [],
                }
                for question in question_set.questions
            ],
            summary="All test questions passed validation.",
        )


class FakePedagogy:
    async def assess(
        self,
        question_set,
        curriculum_plan,
        *,
        knowledge_mode,
        source_text=None,
    ):
        from app.schemas.agents import PedagogyReport

        return PedagogyReport(
            approved=True,
            assessments=[
                {
                    "question_id": question.question_id,
                    "difficulty_appropriate": True,
                    "cognitive_level_appropriate": True,
                    "educational_value": 4,
                    "feedback": "Appropriate for the intended learning objective.",
                }
                for question in question_set.questions
            ],
            summary="All test questions passed the pedagogy assessment.",
        )    


@pytest.mark.asyncio
async def test_pdf_source_is_selected():
    workflow = GenerationWorkflow(
        router=KnowledgeModeRouter(),
        planner=FakePlanner(),
        question_generator=FakeQuestionGenerator(),
        validator=FakeValidator(),
        pedagogy=FakePedagogy(),
    )

    request = GenerationRequest(
        topic="General topic",
        question_count=1,
        difficulty_distribution={"easy": 1, "medium": 0, "hard": 0},
    )

    result = await workflow.run(
        request,
        has_pdf_upload=True,
        extracted_pdf_text="Facts extracted from the PDF.",
        reference_url="https://example.com/article",
    )

    assert result.status == "completed"
    assert len(result.question_set.questions) == 1
    assert result.validation_report.approved is True
    assert result.pedagogy_report.approved is True
    assert result.revision_attempts == 0
    assert len(result.question_set.questions) == 1