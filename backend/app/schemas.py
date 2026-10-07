"""Contratos (Pydantic) da API."""
from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, Field

StatusAcordo = Literal["PENDENTE", "PAGO", "CANCELADO", "EXPIRADO"]


# ---------------------------------------------------------------- ERP -> Nuvem
class AcordoIn(BaseModel):
    token_hash: str = Field(min_length=64, max_length=64)
    cliente_nome: str = Field(max_length=150)
    valor_original: float = Field(ge=0)
    valor_acordo: float = Field(ge=0)
    qtd_titulos: int = Field(default=1, ge=0)
    pix_copia_cola: Optional[str] = None
    pix_dinamico: bool = True
    status: StatusAcordo = "PENDENTE"
    expira_em: datetime
    pago_em: Optional[datetime] = None


class FilaIn(BaseModel):
    cliente_id: int
    cliente_nome: str = Field(max_length=150)
    telefone: Optional[str] = None
    dias_atraso: int = 0
    qtd_titulos: int = 0
    valor_original: float = 0
    valor_atualizado: float = 0
    score: float = 0
    status_caso: Optional[str] = None


class SyncIn(BaseModel):
    loja_nome: Optional[str] = None
    acordos: List[AcordoIn] = []
    fila: Optional[List[FilaIn]] = None  # None = não mexe na fila; [] = limpa


class SyncOut(BaseModel):
    recebidos: int
    criados: int
    atualizados: int
    ignorados: int
    fila: Optional[int] = None
    # Eventos do portal que o ERP pode registrar como interação
    eventos: List[dict] = []


# ---------------------------------------------------------------- Portal público
class PortalAcordoOut(BaseModel):
    lojaNome: str
    clienteNome: str
    valorOriginal: float
    valorAcordo: float
    descontoPerc: int
    qtdTitulos: int
    status: StatusAcordo
    expiraEm: datetime
    pixDinamico: bool


class PortalPixOut(BaseModel):
    pixCopiaCola: str
    qrSvg: Optional[str] = None


# ---------------------------------------------------------------- Admin BLM
class LojaIn(BaseModel):
    cnpj: str = Field(min_length=14, max_length=18)
    nome: str = Field(max_length=120)
    alias: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9-]+$")


class LojaOut(BaseModel):
    id: int
    cnpj: str
    nome: str
    alias: str
    ativo: bool
    ultimo_sync_em: Optional[datetime] = None
    api_key: Optional[str] = None  # só é devolvida na criação/rotação
