"""PDF redactor implementation powered by PyMuPDF."""

from __future__ import annotations

import hashlib
from typing import List

import fitz  # type: ignore

from .base_redactor import BaseRedactor, RedactionRegion, RedactionRequest, RedactionResult


class PDFRedactor(BaseRedactor):
    """Applies permanent redactions to a PDF using PyMuPDF."""

    def apply_redactions(self) -> RedactionResult:
        redacted_terms: List[str] = []
        doc = fitz.open(self.request.source_path)
        try:
            for page_index in range(doc.page_count):
                page = doc.load_page(page_index)
                for term in self.request.matched_texts:
                    if not term:
                        continue
                    found = page.search_for(term)
                    for rect in found:
                        annot = page.add_redact_annot(rect, fill=(0, 0, 0))
                        if annot:
                            annot.update()
                    if found:
                        redacted_terms.append(term)
            for region in self.request.regions:
                if region.page < 0 or region.page >= doc.page_count:
                    continue
                page = doc.load_page(region.page)
                rect = fitz.Rect(
                    region.x,
                    region.y,
                    region.x + region.w,
                    region.y + region.h,
                )
                annot = page.add_redact_annot(rect, fill=(0, 0, 0))
                if annot:
                    annot.update()
            for page_index in range(doc.page_count):
                page = doc.load_page(page_index)
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE)
            doc.save(self.request.output_path, garbage=4, deflate=True)
        finally:
            doc.close()

        sha256 = hashlib.sha256(self.request.output_path.read_bytes()).hexdigest()
        unique_terms = sorted(set(redacted_terms))

        return RedactionResult(
            redacted_path=self.request.output_path,
            sha256=sha256,
            total_regions=len(self.request.regions),
            removed_terms=unique_terms,
        )

