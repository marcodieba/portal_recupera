"""Conexão e modelos do Recupera+ Cloud.

Princípio: a nuvem é uma VITRINE. Ela não gera PIX, não conhece credenciais
bancárias e não dá baixa em nada. Quem gera o PIX (pelo gateway da própria loja)
e confirma o pagamento é sempre o ERP. Aqui só guardamos o que o ERP publicou.
"""
from datetime import datetime

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Boolean, Text,
    ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship

from app.config import DATABASE_URL

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Loja(Base):
    """Cliente da BLM (mercado/farmácia). Cada loja tem sua própria API key."""
    __tablename__ = "lojas"

    id = Column(Integer, primary_key=True)
    cnpj = Column(String(14), unique=True, nullable=False, index=True)
    nome = Column(String(120), nullable=False)
    alias = Column(String(60), unique=True, nullable=False, index=True)  # subdomínio white-label
    api_key_hash = Column(String(64), nullable=True) # Legado, substituído por assinatura Ed25519
    web_token = Column(String(64), nullable=True, index=True) # Token gerado após login do lojista
    ativo = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow)
    ultimo_sync_em = Column(DateTime, nullable=True)

    acordos = relationship("Acordo", back_populates="loja")


class Acordo(Base):
    """Proposta publicada pelo ERP para um devedor (1 link = 1 acordo)."""
    __tablename__ = "portal_acordos"

    id = Column(Integer, primary_key=True)
    loja_id = Column(Integer, ForeignKey("lojas.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)  # sha256 do token do link
    cliente_nome = Column(String(150), nullable=False)
    valor_original = Column(Float, nullable=False)   # principal + encargos (atualizado)
    valor_acordo = Column(Float, nullable=False)     # valor do PIX
    qtd_titulos = Column(Integer, default=1, nullable=False)
    pix_copia_cola = Column(Text, nullable=True)     # gerado pelo gateway DA LOJA
    pix_dinamico = Column(Boolean, default=True, nullable=False)  # False = PIX estático (baixa manual)
    status = Column(String(20), default="PENDENTE", nullable=False)  # PENDENTE|PAGO|CANCELADO|EXPIRADO
    expira_em = Column(DateTime, nullable=False)
    visualizado_em = Column(DateTime, nullable=True)
    pix_copiado_em = Column(DateTime, nullable=True)
    pago_em = Column(DateTime, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    loja = relationship("Loja", back_populates="acordos")


class FilaItem(Base):
    """Snapshot da Fila Inteligente do ERP (substituído a cada sincronização)."""
    __tablename__ = "portal_fila"

    id = Column(Integer, primary_key=True)
    loja_id = Column(Integer, ForeignKey("lojas.id"), nullable=False, index=True)
    cliente_id_erp = Column(Integer, nullable=False)
    cliente_nome = Column(String(150), nullable=False)
    telefone = Column(String(30), nullable=True)
    dias_atraso = Column(Integer, default=0, nullable=False)
    qtd_titulos = Column(Integer, default=0, nullable=False)
    valor_original = Column(Float, default=0, nullable=False)
    valor_atualizado = Column(Float, default=0, nullable=False)
    score = Column(Float, default=0, nullable=False)
    status_caso = Column(String(30), nullable=True)
    atualizado_em = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("loja_id", "cliente_id_erp", name="uq_fila_loja_cliente"),
        Index("ix_fila_loja_score", "loja_id", "score"),
    )


class EventoAuditoria(Base):
    """Trilha mínima de auditoria (sync, mudanças de status, acessos admin)."""
    __tablename__ = "portal_auditoria"

    id = Column(Integer, primary_key=True)
    loja_id = Column(Integer, nullable=True, index=True)
    tipo = Column(String(40), nullable=False)
    detalhe = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)
