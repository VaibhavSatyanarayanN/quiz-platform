
from app.agents.knowledge_mode_router import KnowledgeModeRouter
from app.agents.planner import CurriculumAgent
from app.agents.question_generator import QuestionGeneratorAgent
from app.orchestration.workflow import GenerationWorkflow
from app.providers.gemini_provider import GeminiProvider
from app.agents.validator import ValidationAgent
from app.agents.pedagogy import PedagogyAgent


def create_generation_workflow() -> GenerationWorkflow:
    provider = GeminiProvider()

    return GenerationWorkflow(
        router=KnowledgeModeRouter(),
        planner=CurriculumAgent(provider),
        question_generator=QuestionGeneratorAgent(provider),
        validator=ValidationAgent(provider),
        pedagogy=PedagogyAgent(provider),
    )