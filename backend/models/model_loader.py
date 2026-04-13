"""Model loader — returns the LiteLLM model string for a given model name."""
from config import AVAILABLE_MODELS, settings


def get_model_string(model_name: str) -> str:
    """Return the LiteLLM model string for Ollama."""
    if model_name in AVAILABLE_MODELS:
        return AVAILABLE_MODELS[model_name]
    # Allow arbitrary ollama models
    return f"ollama_chat/{model_name}"


def detect_difficulty(question: str) -> str:
    """Classify query difficulty: 'simple' or 'complex'."""
    q = question.lower()
    complex_signals = [
        "join", "multiple", "subquery", "nested", "having", "group by",
        "aggregate", "average", "total", "rank", "window", "partition",
        "across", "compare", "difference", "between", "among",
    ]
    if any(s in q for s in complex_signals):
        return "complex"
    return "simple"
