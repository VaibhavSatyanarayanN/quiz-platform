
import pytest

from app.agents.knowledge_mode_router import KnowledgeModeRouter


@pytest.fixture
def router():
    return KnowledgeModeRouter()


def test_pdf_takes_priority_over_url_and_topic(router):
    decision = router.route(
        has_pdf_upload=True,
        reference_url="https://example.com/article",
        topic="Database indexing",
    )

    assert decision.mode == "document"
    assert decision.requires_document_extraction is True


def test_url_selects_reference_mode(router):
    decision = router.route(
        has_pdf_upload=False,
        reference_url="https://example.com/article",
        topic="Database indexing",
    )

    assert decision.mode == "reference_url"
    assert decision.requires_retrieval is True


def test_topic_selects_open_world_mode(router):
    decision = router.route(
        has_pdf_upload=False,
        reference_url=None,
        topic="Database indexing",
    )

    assert decision.mode == "open_world"
    assert decision.requires_retrieval is False


def test_missing_source_is_rejected(router):
    with pytest.raises(ValueError):
        router.route(
            has_pdf_upload=False,
            reference_url=None,
            topic=None,
        )