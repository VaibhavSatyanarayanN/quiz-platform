
import json
import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import ValidationError

from app.schemas.generation import GenerationRequest, GenerationResponse
from app.orchestration.factory import create_generation_workflow
from app.services.pdf_extraction import (
    PDFExtractionError,
    extract_text_from_pdf,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Quiz Platform AI Service",
    version="1.0.0",
)

workflow = create_generation_workflow()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ai",
    }


@app.post("/generate", response_model=GenerationResponse)
async def generate_quiz(request: GenerationRequest):
    try:
        return await workflow.run(request)
    except Exception:
        logger.exception("Quiz generation failed")
        raise


@app.post("/generate-from-pdf", response_model=GenerationResponse)
async def generate_quiz_from_pdf(
    file: UploadFile = File(...),
    question_count: int = Form(10),
    question_types: str = Form('["mcq"]'),
    difficulty_distribution: str = Form(
        '{"easy": 3, "medium": 5, "hard": 2}'
    ),
    target_audience: str = Form("General learners"),
    language: str = Form("English"),
    max_revision_attempts: int = Form(1),
):
    try:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Please upload a file with a .pdf extension.",
            )

        # Read at most one byte beyond the limit to detect oversized files.
        pdf_bytes = await file.read(MAX_UPLOAD_BYTES + 1)

        if len(pdf_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail="PDF file exceeds the 10 MB upload limit.",
            )

        if file.content_type not in (None, "application/pdf",
                                     "application/octet-stream"):
            raise HTTPException(
                status_code=415,
                detail="Unsupported content type. Upload a PDF.",
            )

        extracted_text = extract_text_from_pdf(pdf_bytes)
        
        question_types_value = question_types.strip()
        difficulty_value = difficulty_distribution.strip()

        if not question_types_value:
            question_types_value = '["mcq"]'

        if not difficulty_value:
            difficulty_value = '{"easy": 3, "medium": 5, "hard": 2}'

        try:
            parsed_question_types = json.loads(question_types_value)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid question_types JSON: {exc.msg}",
            ) from exc

        try:
            parsed_difficulty = json.loads(difficulty_value)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid difficulty_distribution JSON: {exc.msg}",
            ) from exc

        if not isinstance(parsed_question_types, list):
            raise HTTPException(
                status_code=400,
                detail='question_types must be a JSON array, e.g. ["mcq"].',
            )

        if not isinstance(parsed_difficulty, dict):
            raise HTTPException(
                status_code=400,
                detail="difficulty_distribution must be a JSON object.",
            )

        request = GenerationRequest(
            topic=f"Assessment from {file.filename}" if file.filename else "Assessment from uploaded document",
            source_text=None,
            question_count=question_count,
            question_types=parsed_question_types,
            difficulty_distribution=parsed_difficulty,
            target_audience=target_audience,
            language=language,
            max_revision_attempts=max_revision_attempts,
        )

        return await workflow.run(
            request,
            has_pdf_upload=True,
            extracted_pdf_text=extracted_text,
        )

    except HTTPException:
        raise
    except PDFExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=exc.errors(include_input=False),
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.exception("PDF quiz generation failed")
        raise HTTPException(
            status_code=500,
            detail="Quiz generation failed. Check the service logs.",
        )
    finally:
        await file.close()
