import logging
from typing import List
try:
    from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
    from presidio_analyzer.nlp_engine import NlpEngineProvider
except ImportError:
    AnalyzerEngine = None
    NlpEngineProvider = None
    PatternRecognizer = None
    Pattern = None

# Configure Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PIIDetector:
    _instance = None

    def __init__(self):
        self.analyzer = None
        if not AnalyzerEngine:
            logger.error("Presidio Analyzer not installed.")
            return

        try:
            # Explicitly use the small model to save memory
            configuration = {
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
            }
            provider = NlpEngineProvider(nlp_configuration=configuration)
            nlp_engine = provider.create_engine()
            self.analyzer = AnalyzerEngine(nlp_engine=nlp_engine)
            
            # Add Custom Phone Regex (Broad coverage for 10-digit formats)
            # Catches: (123) 456-7890, 123-456-7890, 1234567890, +1 123 456 7890
            try:
                phone_pattern = Pattern(
                    name="generic_phone_robust", 
                    regex=r"\b(?:\+?\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b", 
                    score=0.6
                )
                phone_recognizer = PatternRecognizer(supported_entity="PHONE_NUMBER", patterns=[phone_pattern])
                self.analyzer.registry.add_recognizer(phone_recognizer)
                logger.info("Custom Phone Regex added successfully.")
            except Exception as e:
                logger.warning(f"Could not add custom phone regex: {e}")

            logger.info("PII Detector initialized successfully (en_core_web_sm).")
        except Exception as e:
            logger.error(f"Failed to initialize PII Detector: {e}")

    def analyze(self, text: str) -> List[str]:
        """
        Analyzes text for PII and returns a list of detected entity types.
        Returns empty list on failure (Fail Open).
        """
        if not self.analyzer or not text:
            return []

        try:
            # Analyze text
            results = self.analyzer.analyze(text=text, language='en')
            
            # Extract unique entity types found (e.g., "EMAIL_ADDRESS", "PHONE_NUMBER")
            # We filter for high confidence if needed, but default is usually 0.5
            entities = list(set([res.entity_type for res in results]))
            
            if entities:
                logger.info(f"PII Detected: {entities}")
            
            return entities

        except Exception as e:
            logger.error(f"Error during PII analysis: {e}")
            return []

# Singleton helper (optional, but good for caching the model)
def get_pii_detector():
    if PIIDetector._instance is None:
        PIIDetector._instance = PIIDetector()
    return PIIDetector._instance
