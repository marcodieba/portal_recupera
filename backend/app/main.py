"""
Recupera+ Cloud API (vitrine do portal de negociação).

Arquitetura:
  ERP da loja ──(gera PIX no gateway DA LOJA)──► POST /erp/sync ──► Nuvem
  Devedor ──► GET /p/{token} e /p/{token}/pix  (só exibe o que o ERP publicou)
  Pagamento cai direto na conta da loja; o ERP confirma pelo próprio gateway,
  dá a baixa e publica status=PAGO no próximo sync.

A nuvem NÃO gera PIX, NÃO guarda credenciais bancárias e NÃO dá baixa.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS, CORS_ORIGIN_REGEX
from app.database import init_db
from app.routers import erp, portal, loja, admin

app = FastAPI(title="Recupera+ Cloud API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "X-License-Token", "Authorization"],
)


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/")
def root():
    return {"status": "Recupera+ Cloud API Online", "version": app.version}


app.include_router(erp.router)
app.include_router(portal.router)
app.include_router(loja.router)
app.include_router(admin.router)
