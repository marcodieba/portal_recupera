"""Configuração da API Recupera+ Cloud (lida de variáveis de ambiente)."""
import os


def _lista(valor: str):
    return [v.strip() for v in (valor or "").split(",") if v.strip()]


# Banco: em produção use PostgreSQL, ex.: postgresql+psycopg2://user:pass@host:5432/recupera
DATABASE_URL = os.getenv("RECUPERA_DATABASE_URL", "sqlite:///./recupera_cloud.db")

# Chave mestre da BLM: usada SOMENTE para gerenciar configurações se necessário.
MASTER_KEY = os.getenv("RECUPERA_MASTER_KEY", "")

# Chave pública Ed25519 (gerada pela API Ativador) para validar assinaturas
PUBLIC_KEY_PEM = os.getenv("RECUPERA_PUBLIC_KEY_PEM", "")

# URL da API Ativador para checar a senha do portal web
API_ATIVADOR_URL = os.getenv("API_ATIVADOR_URL", "http://localhost:8000")

# Origens permitidas no CORS (frontend Next.js). Ex.: https://*.blmservicos.com.br
CORS_ORIGINS = _lista(os.getenv("RECUPERA_CORS_ORIGINS", "http://localhost:3000"))
# Regex opcional para subdomínios white-label (ex.: ^https://[a-z0-9-]+\.blmservicos\.com\.br$)
CORS_ORIGIN_REGEX = os.getenv("RECUPERA_CORS_ORIGIN_REGEX", "") or None
