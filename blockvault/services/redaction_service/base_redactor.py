"""Shared abstractions for document redaction backends."""

from __future__ import annotations

import abc
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Protocol


@dataclass
class RedactionRegion:
    """Absolute coordinates (PDF points) describing a rectangle to redact."""

    page: int
    x: float
    y: float
    w: float
    h: float


@dataclass
class RedactionRequest:
    """Normalized payload received from the frontend for redaction."""

    file_id: str
    source_path: Path
    output_path: Path
    regions: List[RedactionRegion]
    patterns_applied: List[str]
    custom_terms: List[str]
    matched_texts: List[str]
    requested_by: str


@dataclass
class RedactionResult:
    """Outcome of a redaction operation."""

    redacted_path: Path
    sha256: str
    total_regions: int
    removed_terms: List[str]


class BaseRedactor(abc.ABC):
    """Common interface for applying true redactions to documents."""

    def __init__(self, request: RedactionRequest) -> None:
        self.request = request

    @abc.abstractmethod
    def apply_redactions(self) -> RedactionResult:
        """Perform true redaction and return metadata about the new document."""


class TextExtractor(Protocol):
    """Optional helper used by PDF redaction to discover regex matches."""

    def iter_matches(self) -> Iterable[RedactionRegion]:  # pragma: no cover - interface only
        ...

