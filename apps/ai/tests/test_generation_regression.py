import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from groq import APIStatusError

from app.core.config import Settings
from app.providers.groq_provider import GroqProvider
from app.schemas.agents import (
    CurriculumPlan,
    GeneratedQuestion,
    LearningObjective,
    PedagogyReport,
    QuestionOption,
    QuestionSet,
    TopicCoverage,
    ValidationReport,
)
from app.schemas.generation import GenerationRequest
from app.services.pdf_extraction import (
    MAX_EXTRACTED_CHARS,
    PDFExtractionError,
    extract_text_from_pdf,
)
from app.agents.question_generator import QuestionGeneratorAgent
from app.orchestration.workflow import GenerationWorkflow
from app.agents.knowledge_mode_router import KnowledgeModeRouter


@pytest.fixture
def dummy_settings():
    s = Settings()
    s.groq_api_key = "dummy-test-key"
    s.groq_model = "openai/gpt-oss-120b"
    s.groq_max_completion_tokens = 8192
    return s


# 1. Existing topic-based generation (mocked)
@pytest.mark.asyncio
async def test_topic_based_generation_workflow(dummy_settings):
    with patch("app.providers.groq_provider.settings", dummy_settings):
        fake_plan = CurriculumPlan(
            title="Topic Quiz",
            learning_objectives=[
                LearningObjective(
                    objective_id="obj-1",
                    description="Understand Python basics",
                    topic="Python",
                )
            ],
            topic_coverage=[TopicCoverage(topic="Python", question_count=1)],
            difficulty_distribution={"easy": 1, "medium": 0, "hard": 0},
        )
        fake_questions = QuestionSet(
            questions=[
                GeneratedQuestion(
                    question_id="Q1",
                    question_type="mcq",
                    question_text="What is Python?",
                    options=[
                        QuestionOption(option_id="A", text="A language"),
                        QuestionOption(option_id="B", text="A snake only"),
                    ],
                    correct_answer="A",
                    explanation="Python is a programming language.",
                    difficulty="easy",
                    cognitive_level="remember",
                    learning_objective_id="obj-1",
                )
            ]
        )
        fake_val = ValidationReport(
            approved=True,
            results=[
                {
                    "question_id": "Q1",
                    "is_correct": True,
                    "is_unambiguous": True,
                    "is_grounded": True,
                    "issues": [],
                }
            ],
            summary="All good",
        )
        fake_ped = PedagogyReport(
            approved=True,
            assessments=[
                {
                    "question_id": "Q1",
                    "difficulty_appropriate": True,
                    "cognitive_level_appropriate": True,
                    "educational_value": 5,
                    "feedback": "Great question",
                }
            ],
            summary="All good",
        )

        planner = MagicMock()
        planner.plan = AsyncMock(return_value=fake_plan)
        q_gen = MagicMock()
        q_gen.generate = AsyncMock(return_value=fake_questions)
        val = MagicMock()
        val.validate = AsyncMock(return_value=fake_val)
        ped = MagicMock()
        ped.assess = AsyncMock(return_value=fake_ped)

        wf = GenerationWorkflow(
            router=KnowledgeModeRouter(),
            planner=planner,
            question_generator=q_gen,
            validator=val,
            pedagogy=ped,
        )

        req = GenerationRequest(
            topic="Python",
            question_count=1,
            difficulty_distribution={"easy": 1, "medium": 0, "hard": 0},
        )
        res = await wf.run(req)
        assert res.status == "completed"
        assert len(res.question_set.questions) == 1
        assert res.question_set.questions[0].question_id == "Q1"


# 2. Document-mode question generation with verbatim evidence matching
@pytest.mark.asyncio
async def test_document_mode_grounding_valid(dummy_settings):
    source = "Python was created by Guido van Rossum and released in 1991."
    plan = CurriculumPlan(
        title="Plan",
        learning_objectives=[
            LearningObjective(
                objective_id="obj-1",
                description="History of Python",
                topic="History",
            )
        ],
        topic_coverage=[TopicCoverage(topic="History", question_count=1)],
        difficulty_distribution={"easy": 1, "medium": 0, "hard": 0},
    )
    q_set = QuestionSet(
        questions=[
            GeneratedQuestion(
                question_id="Q1",
                question_type="mcq",
                question_text="Who created Python?",
                options=[
                    QuestionOption(option_id="A", text="Guido van Rossum"),
                    QuestionOption(option_id="B", text="Dennis Ritchie"),
                ],
                correct_answer="A",
                explanation="Guido van Rossum created Python.",
                difficulty="easy",
                cognitive_level="remember",
                learning_objective_id="obj-1",
                source_evidence=["created by Guido van Rossum"],
            )
        ]
    )

    req = GenerationRequest(
        topic="History",
        source_text=source,
        question_count=1,
        difficulty_distribution={"easy": 1, "medium": 0, "hard": 0},
    )

    # Should not raise ValueError
    QuestionGeneratorAgent._validate_question_set(
        question_set=q_set,
        request=req,
        curriculum_plan=plan,
        knowledge_mode="document",
        source_text=source,
    )


# 3. Document-mode source grounding mismatch detection
def test_document_mode_grounding_mismatch():
    source = "Python was created by Guido van Rossum and released in 1991."
    plan = CurriculumPlan(
        title="Plan",
        learning_objectives=[
            LearningObjective(
                objective_id="obj-1",
                description="History of Python",
                topic="History",
            )
        ],
        topic_coverage=[TopicCoverage(topic="History", question_count=1)],
        difficulty_distribution={"easy": 1, "medium": 0, "hard": 0},
    )
    q_set = QuestionSet(
        questions=[
            GeneratedQuestion(
                question_id="Q1",
                question_type="mcq",
                question_text="Who created Python?",
                options=[
                    QuestionOption(option_id="A", text="James Gosling"),
                    QuestionOption(option_id="B", text="Bjarne Stroustrup"),
                ],
                correct_answer="A",
                explanation="James Gosling created Java, not Python.",
                difficulty="easy",
                cognitive_level="remember",
                learning_objective_id="obj-1",
                source_evidence=["created by James Gosling in 1995"],
            )
        ]
    )
    req = GenerationRequest(
        topic="History",
        source_text=source,
        question_count=1,
        difficulty_distribution={"easy": 1, "medium": 0, "hard": 0},
    )

    with pytest.raises(ValueError, match="does not match the retrieved source"):
        QuestionGeneratorAgent._validate_question_set(
            question_set=q_set,
            request=req,
            curriculum_plan=plan,
            knowledge_mode="document",
            source_text=source,
        )


# 4. Malformed JSON handling in GroqProvider
@pytest.mark.asyncio
async def test_groq_provider_malformed_json(dummy_settings):
    with patch("app.providers.groq_provider.settings", dummy_settings):
        provider = GroqProvider()
        mock_choice = MagicMock()
        mock_choice.message.content = "Not a JSON string {"
        mock_choice.finish_reason = "stop"
        mock_resp = MagicMock(choices=[mock_choice], model="openai/gpt-oss-120b", id="req-123")

        provider.client.chat.completions.create = AsyncMock(return_value=mock_resp)

        with pytest.raises(json.JSONDecodeError):
            await provider.generate_structured(
                system_prompt="sys",
                user_prompt="usr",
                response_model=QuestionSet,
                agent_name="TestAgent",
            )
        await provider.close()


# 5. Missing required fields in Pydantic schema validation
@pytest.mark.asyncio
async def test_groq_provider_missing_fields(dummy_settings):
    with patch("app.providers.groq_provider.settings", dummy_settings):
        provider = GroqProvider()
        # Missing 'questions' key
        mock_choice = MagicMock()
        mock_choice.message.content = json.dumps({"wrong_key": []})
        mock_choice.finish_reason = "stop"
        mock_resp = MagicMock(choices=[mock_choice], model="openai/gpt-oss-120b", id="req-123")

        provider.client.chat.completions.create = AsyncMock(return_value=mock_resp)

        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            await provider.generate_structured(
                system_prompt="sys",
                user_prompt="usr",
                response_model=QuestionSet,
                agent_name="TestAgent",
            )
        await provider.close()


# 6. Invalid MCQ correct answer (does not match option_id)
def test_invalid_mcq_correct_answer():
    from pydantic import ValidationError
    with pytest.raises(ValidationError, match="MCQ correct_answer must match an option_id"):
        GeneratedQuestion(
            question_id="Q1",
            question_type="mcq",
            question_text="What is Python?",
            options=[
                QuestionOption(option_id="A", text="Option A"),
                QuestionOption(option_id="B", text="Option B"),
            ],
            correct_answer="C",  # Not in [A, B]
            explanation="Invalid answer key.",
            difficulty="easy",
            cognitive_level="remember",
            learning_objective_id="obj-1",
        )


# 7. Oversized and empty PDF extraction tests
def test_empty_pdf_extraction():
    with pytest.raises(PDFExtractionError, match="uploaded PDF is empty"):
        extract_text_from_pdf(b"")

def test_invalid_header_pdf_extraction():
    with pytest.raises(PDFExtractionError, match="not a valid PDF"):
        extract_text_from_pdf(b"NOT_A_PDF_CONTENT")


# 8. Regression test: max_completion_tokens passed to chat.completions.create
@pytest.mark.asyncio
async def test_max_completion_tokens_passed_to_api(dummy_settings):
    with patch("app.providers.groq_provider.settings", dummy_settings):
        provider = GroqProvider()
        mock_choice = MagicMock()
        mock_choice.message.content = json.dumps({
            "title": "Title",
            "learning_objectives": [
                {"objective_id": "o1", "description": "Desc with length >= 10", "topic": "Top"}
            ],
            "topic_coverage": [{"topic": "Top", "question_count": 1}],
            "difficulty_distribution": {"easy": 1, "medium": 0, "hard": 0},
        })
        mock_choice.finish_reason = "stop"
        mock_resp = MagicMock(choices=[mock_choice], model="openai/gpt-oss-120b", id="req-123")

        provider.client.chat.completions.create = AsyncMock(return_value=mock_resp)

        await provider.generate_structured(
            system_prompt="sys",
            user_prompt="usr",
            response_model=CurriculumPlan,
            agent_name="CurriculumAgent",
        )

        # Verify max_completion_tokens is explicitly passed
        call_kwargs = provider.client.chat.completions.create.call_args.kwargs
        assert "max_completion_tokens" in call_kwargs
        assert call_kwargs["max_completion_tokens"] == 8192
        assert call_kwargs["response_format"] == {"type": "json_object"}
        await provider.close()


# 9. Error reporting diagnostics: APIStatusError safely logged with agent, model, status
@pytest.mark.asyncio
async def test_error_reporting_diagnostics(dummy_settings):
    with patch("app.providers.groq_provider.settings", dummy_settings):
        provider = GroqProvider()
        err_response = MagicMock()
        err_response.status_code = 400
        api_error = APIStatusError(
            message="json_validate_failed",
            response=err_response,
            body={"error": {"message": "Failed to validate JSON", "code": "json_validate_failed"}},
        )

        provider.client.chat.completions.create = AsyncMock(side_effect=api_error)

        with patch("app.providers.groq_provider.logger.error") as mock_log:
            with pytest.raises(APIStatusError):
                await provider.generate_structured(
                    system_prompt="sys",
                    user_prompt="usr",
                    response_model=QuestionSet,
                    agent_name="QuestionGeneratorAgent",
                )
            mock_log.assert_called_once()
            log_args = mock_log.call_args[0]
            assert "QuestionGeneratorAgent" in log_args
            assert "openai/gpt-oss-120b" in log_args
            assert "QuestionSet" in log_args
        await provider.close()


# 10. Gemini schema preparation tests
def test_gemini_schema_preparation():
    from app.providers.gemini_provider import _prepare_gemini_schema

    schema = _prepare_gemini_schema(CurriculumPlan)

    # Must not contain $defs or $ref
    schema_str = json.dumps(schema)
    assert "$defs" not in schema
    assert "$ref" not in schema_str
    assert "additionalProperties" not in schema_str
    assert "maxItems" not in schema_str
    assert "minItems" not in schema_str
    assert "maxLength" not in schema_str
    assert "minLength" not in schema_str

    # Must provide properties for difficulty_distribution
    diff_props = schema["properties"]["difficulty_distribution"]
    assert "properties" in diff_props
    assert set(diff_props["properties"].keys()) == {"easy", "medium", "hard"}
    assert set(diff_props["required"]) == {"easy", "medium", "hard"}


# 11. GeminiProvider generate_structured success (mocked)
@pytest.mark.asyncio
async def test_gemini_provider_generate_structured():
    from app.providers.gemini_provider import GeminiProvider

    with patch("app.providers.gemini_provider.settings") as mock_settings:
        mock_settings.gemini_api_key = "dummy-key"
        mock_settings.gemini_model = "gemini-3.8-flash"
        mock_settings.gemini_timeout_seconds = 30
        mock_settings.gemini_max_output_tokens = 4096
        mock_settings.validate_llm_config = MagicMock()

        provider = GeminiProvider()
        mock_resp = MagicMock()
        mock_resp.parsed = None
        mock_resp.text = json.dumps({
            "title": "Python Quiz",
            "learning_objectives": [
                {"objective_id": "obj1", "description": "Learn Python basics in detail", "topic": "Basics"}
            ],
            "topic_coverage": [{"topic": "Basics", "question_count": 2}],
            "difficulty_distribution": {"easy": 1, "medium": 1, "hard": 0},
        })

        provider.client.aio.models.generate_content = AsyncMock(return_value=mock_resp)

        result = await provider.generate_structured(
            system_prompt="sys",
            user_prompt="usr",
            response_model=CurriculumPlan,
            agent_name="CurriculumAgent",
        )

        assert isinstance(result, CurriculumPlan)
        assert result.title == "Python Quiz"
        assert result.difficulty_distribution == {"easy": 1, "medium": 1, "hard": 0}
        await provider.close()


# 12. GeminiProvider retry on 503 transient error (mocked)
@pytest.mark.asyncio
async def test_gemini_provider_retry_on_503():
    from app.providers.gemini_provider import GeminiProvider
    from google.genai.errors import ServerError

    with patch("app.providers.gemini_provider.settings") as mock_settings:
        mock_settings.gemini_api_key = "dummy-key"
        mock_settings.gemini_model = "gemini-3.8-flash"
        mock_settings.gemini_timeout_seconds = 30
        mock_settings.gemini_max_output_tokens = 4096
        mock_settings.validate_llm_config = MagicMock()

        provider = GeminiProvider()
        err_response = MagicMock()
        err_response.status_code = 503
        server_err = ServerError(503, {"error": {"code": 503, "message": "High demand"}}, err_response)

        success_resp = MagicMock()
        success_resp.parsed = None
        success_resp.text = json.dumps({
            "title": "Python Quiz",
            "learning_objectives": [
                {"objective_id": "obj1", "description": "Learn Python basics in detail", "topic": "Basics"}
            ],
            "topic_coverage": [{"topic": "Basics", "question_count": 2}],
            "difficulty_distribution": {"easy": 1, "medium": 1, "hard": 0},
        })

        provider.client.aio.models.generate_content = AsyncMock(side_effect=[server_err, success_resp])

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await provider.generate_structured(
                system_prompt="sys",
                user_prompt="usr",
                response_model=CurriculumPlan,
                agent_name="CurriculumAgent",
            )

        assert isinstance(result, CurriculumPlan)
        assert provider.client.aio.models.generate_content.call_count == 2
        await provider.close()
