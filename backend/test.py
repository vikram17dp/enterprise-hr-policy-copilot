from app.core.config import get_settings

settings = get_settings();

print(f"APP name: {settings.app_name}")
print(f"App name :{settings.embedding_model}")