from markdown_pdf import MarkdownPdf, Section
import sys

def convert_md_to_pdf(md_path, pdf_path):
    try:
        pdf = MarkdownPdf()
        with open(md_path, "r", encoding="utf-8") as f:
            text = f.read()
        pdf.add_section(Section(text))
        pdf.save(pdf_path)
        print(f"PDF saved to {pdf_path}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    md_file = r"C:\Users\brunn\.gemini\antigravity-ide\brain\99508f53-27e2-44d6-bd9b-85b2c85daea1\Roteiro_Apresentacao_Marx.md"
    pdf_file = r"C:\Users\brunn\Documents\PROGRAMACAO\Nova pasta (2)\Roteiro_Apresentacao_Marx_Final.pdf"
    convert_md_to_pdf(md_file, pdf_file)
