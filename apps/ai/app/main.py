import logging

from fastapi import FastAPI
from app.schemas.generation import GenerationRequest, GenerationResponse
from app.orchestration.factory import create_generation_workflow

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Quiz Platform AI Service",
    version="1.0.0",
)

# Create the workflow once and reuse it across requests.
workflow = create_generation_workflow()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ai",
    }


@app.post("/generate", response_model=GenerationResponse)
async def generate_quiz(request: GenerationRequest):
    try:
        result = await workflow.run(request)
        return result
    except Exception:
        logger.exception("Quiz generation failed")
        raise