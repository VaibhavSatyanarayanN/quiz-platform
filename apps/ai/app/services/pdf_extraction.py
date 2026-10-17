
from io import BytesIO

from pypdf import PdfReader


MAX_PDF_PAGES = 200
MAX_EXTRACTED_CHARS = 200_000


class PDFExtractionError(ValueError):
    """Raised when a PDF cannot be safely processed."""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from a PDF, preserving page boundaries."""

    if not pdf_bytes:
        raise PDFExtractionError("The uploaded PDF is empty.")

    if not pdf_bytes.startswith(b"%PDF-"):
        raise PDFExtractionError("The uploaded file is not a valid PDF.")

    try:
        reader = PdfReader(BytesIO(pdf_bytes), strict=True)

        if reader.is_encrypted:
            raise PDFExtractionError(
                "Password-protected PDFs are not supported."
            )

        if len(reader.pages) == 0:
            raise PDFExtractionError("The PDF contains no pages.")

        if len(reader.pages) > MAX_PDF_PAGES:
            raise PDFExtractionError(
                f"The PDF exceeds the {MAX_PDF_PAGES}-page limit."
            )

        extracted_pages: list[str] = []
        total_chars = 0

        for page_number, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text() or ""
            page_text = page_text.strip()

            if not page_text:
                continue

            page_section = f"[Page {page_number}]\n{page_text}"
            total_chars += len(page_section)

            if total_chars > MAX_EXTRACTED_CHARS:
                raise PDFExtractionError(
                    "The extracted PDF text exceeds the "
                    f"{MAX_EXTRACTED_CHARS}-character limit."
                )

            extracted_pages.append(page_section)

        if not extracted_pages:
            raise PDFExtractionError(
                "No extractable text was found. "
                "The PDF may contain scanned images; OCR is not "
                "implemented yet."
            )

        return "\n\n".join(extracted_pages)

    except PDFExtractionError:
        raise
    except Exception as exc:
        raise PDFExtractionError(
            "The PDF could not be read. Please upload a valid PDF."
        ) from exc
