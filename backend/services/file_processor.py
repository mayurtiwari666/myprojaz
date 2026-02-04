import boto3
import pypdf
import io
import os
from docx import Document
from pptx import Presentation
from backend.config import settings
import pytesseract
from pdf2image import convert_from_bytes

s3_client = boto3.client('s3', region_name=settings.AWS_REGION)

# NOTE: Textract Client removed in favor of Tesseract (Local OCR)

def extract_text_from_s3(file_key: str) -> str:
    """
    Downloads a file from S3 and extracts its text based on extension.
    Supports: .pdf (with Tesseract fallback), .docx, .pptx, .txt
    """
    try:
        ext = os.path.splitext(file_key)[1].lower()
        print(f"Extraction started for {file_key} ({ext})")
        
        response = s3_client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=file_key)
        file_content = response['Body'].read()
        file_stream = io.BytesIO(file_content)
        
        if ext == '.pdf':
            print(f"PDF detected: {file_key}. Attempting pypdf first...")
            return _extract_from_pdf(file_stream, file_content)
        elif ext in ['.docx', '.doc']:
            return _extract_from_docx(file_stream)
        elif ext in ['.pptx', '.ppt']:
            return _extract_from_pptx(file_stream)
        elif ext in ['.txt', '.md']:
            return file_content.decode('utf-8', errors='ignore')
        elif ext in ['.jpg', '.jpeg', '.png']:
            print("Image file detected. Using Tesseract for OCR.")
            return _extract_with_tesseract(file_content)
        else:
            print(f"Unsupported file type for extraction: {ext}")
            return ""
            
    except Exception as e:
        print(f"Error extracting text from {file_key}: {e}")
        raise e

def _extract_from_pdf(file_stream, file_bytes) -> str:
    """
    Hybrid extraction: pypdf first, Tesseract fallback if empty.
    """
    text = ""
    try:
        reader = pypdf.PdfReader(file_stream)
        for page in reader.pages:
            extract = page.extract_text()
            if extract:
                text += extract + "\n"
    except Exception as e:
        print(f"pypdf failed: {e}")
    
    # Check if scanned (empty or very short text)
    print(f"pypdf extracted {len(text)} chars. Preview: {text[:200]!r}")

    # Check 1: Length (Too short?)
    # Increased to 500 because "Naac_appLetter.pdf" had ~250 chars of metadata/header text.
    if not text or len(text.strip()) < 500:
        print(f"PDF text length ({len(text.strip())}) < 500. Marking as scanned. Falling back to Tesseract...")
        return _extract_with_tesseract(file_bytes)

    # Check 2: Density (Garbage/Symbols?)
    alphanumeric_count = sum(c.isalnum() for c in text)
    density = alphanumeric_count / len(text) if len(text) > 0 else 0
    
    if density < 0.5:
        print(f"PDF text density ({density:.2f}) < 0.5. likely garbage OCR or symbols. Falling back to Tesseract...")
        return _extract_with_tesseract(file_bytes)
        
    return text

def _extract_with_tesseract(file_bytes) -> str:
    """
    Uses Tesseract (Local OCR) to detect text in a document using raw bytes.
    Requires: 'tesseract' installed on system, 'poppler' installed on system.
    """
    try:
        print("Starting Tesseract OCR...")
        images = convert_from_bytes(file_bytes)
        text = ""
        for i, image in enumerate(images):
            print(f"OCR Processing Page {i+1}...")
            text += pytesseract.image_to_string(image) + "\n"
        
        print(f"Tesseract successfully extracted {len(text)} chars.")
        return text
    except Exception as e:
        print(f"Tesseract failed: {e}")
        return ""

def _extract_from_docx(file_stream) -> str:
    try:
        doc = Document(file_stream)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
    except Exception as e:
        print(f"Docx extraction failed: {e}")
        return ""

def _extract_from_pptx(file_stream) -> str:
    try:
        prs = Presentation(file_stream)
        text = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text.append(shape.text)
        return "\n".join(text)
    except Exception as e:
        print(f"PPTX extraction failed: {e}")
        return ""
