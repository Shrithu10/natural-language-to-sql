from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    default_model: str = "llama3"
    default_temperature: float = 0.1
    default_max_tokens: int = 1024
    max_agent_iterations: int = 4
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env"}


settings = Settings()

AVAILABLE_MODELS = {
    "llama3":   "ollama_chat/llama3",
    "mistral":  "ollama_chat/mistral",
    "sqlcoder": "ollama_chat/sqlcoder",
}

MODEL_DISPLAY_NAMES = {
    "llama3":   "LLaMA 3",
    "mistral":  "Mistral",
    "sqlcoder": "SQLCoder",
}
