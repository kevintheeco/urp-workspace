"""Make fixed-layout question images for the writable 2024 CSAT worksheets."""

from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parent
SOURCE = Path(r"C:\Users\kevin\Desktop\Obsidian Business\작업\Provee-IR-45초\video\product-explainer-v5\audit-2026-09-15\seungju-notion\tmp\pdfs\2024-math-source.pdf")

# Source is the locally verified KICE 2024 CSAT mathematics question paper.
# Rectangles use PDF points and retain the question and all five options.
CROPS = {
    3: (0, fitz.Rect(425, 224, 790, 337)),
    10: (2, fitz.Rect(425, 148, 795, 382)),
    14: (4, fitz.Rect(425, 155, 795, 427)),
}


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    with fitz.open(SOURCE) as document:
        for number, (page_index, clip) in CROPS.items():
            pixmap = document[page_index].get_pixmap(matrix=fitz.Matrix(4, 4), clip=clip, alpha=False)
            pixmap.save(ROOT / f"ink-film-{number}-exam.png")


if __name__ == "__main__":
    main()
