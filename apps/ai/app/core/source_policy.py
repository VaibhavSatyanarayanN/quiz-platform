
from app.schemas.routing import KnowledgeMode


def get_source_policy(mode: KnowledgeMode) -> str:
    if mode == "document":
        return """
STRICT DOCUMENT-ONLY MODE:
- The uploaded document is the exclusive factual source.
- Do not use external websites, outside retrieval, or model memory
  to add factual claims.
- The user's topic is only an instruction about what to assess;
  it is not an additional factual source.
- Every question, correct answer, and explanation must be supported
  by the extracted document.
- Include short verbatim source_evidence excerpts for each question.
- Focus questions strictly on the concepts, definitions, and facts that
  are explicitly stated in the document. Do not invent facts or extrapolate.
- Do not invent PDF page numbers.
- Always output a valid JSON object matching the requested schema.
"""

    if mode == "reference_url":
        return """
REFERENCE-URL MODE:
- Use the retrieved content of the supplied URL as the factual source.
- Do not silently fall back to general model knowledge if retrieval
  fails or the page contains insufficient information.
- Include short verbatim source_evidence excerpts for each question.
- Do not invent facts, quotations, or source metadata.
- Always output a valid JSON object matching the requested schema.
"""

    return """
OPEN-WORLD MODE:
- General model knowledge may be used to create the assessment.
- Follow the requested topic, audience, language, and difficulty.
- If optional reference text is supplied, distinguish its claims
  from unsupported claims and do not fabricate quotations.
"""