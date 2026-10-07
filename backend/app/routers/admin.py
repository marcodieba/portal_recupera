"""Administração BLM: cadastro de lojas e rotação de API key (chave mestre)."""
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, Loja, EventoAuditoria
from app.schemas import LojaIn, LojaOut
from app.security import exigir_master, nova_api_key, sha256

router = APIRouter(prefix="/admin", tags=["Admin BLM"], dependencies=[Depends(exigir_master)])


def _out(l: Loja, api_key: str | None = None) -> LojaOut:
    return LojaOut(id=l.id, cnpj=l.cnpj, nome=l.nome, alias=l.alias, ativo=l.ativo,
                   ultimo_sync_em=l.ultimo_sync_em, api_key=api_key)


@router.get("/lojas", response_model=list[LojaOut])
def listar(db: Session = Depends(get_db)):
    return [_out(l) for l in db.query(Loja).order_by(Loja.nome).all()]


@router.post("/lojas", response_model=LojaOut, status_code=201)
def criar(dados: LojaIn, db: Session = Depends(get_db)):
    cnpj = re.sub(r"\D", "", dados.cnpj)
    if len(cnpj) != 14:
        raise HTTPException(status_code=422, detail="CNPJ deve ter 14 dígitos.")
    if db.query(Loja).filter((Loja.cnpj == cnpj) | (Loja.alias == dados.alias)).first():
        raise HTTPException(status_code=409, detail="CNPJ ou alias já cadastrado.")
    chave = nova_api_key()
    loja = Loja(cnpj=cnpj, nome=dados.nome.strip(), alias=dados.alias, api_key_hash=sha256(chave))
    db.add(loja)
    db.flush()
    db.add(EventoAuditoria(loja_id=loja.id, tipo="LOJA_CRIADA", detalhe=dados.alias))
    db.commit()
    return _out(loja, api_key=chave)


@router.post("/lojas/{loja_id}/rotacionar-chave", response_model=LojaOut)
def rotacionar(loja_id: int, db: Session = Depends(get_db)):
    loja = db.get(Loja, loja_id)
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")
    chave = nova_api_key()
    loja.api_key_hash = sha256(chave)
    db.add(EventoAuditoria(loja_id=loja.id, tipo="CHAVE_ROTACIONADA"))
    db.commit()
    return _out(loja, api_key=chave)


@router.post("/lojas/{loja_id}/ativo/{ativo}", response_model=LojaOut)
def ativar(loja_id: int, ativo: bool, db: Session = Depends(get_db)):
    loja = db.get(Loja, loja_id)
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")
    loja.ativo = ativo
    db.add(EventoAuditoria(loja_id=loja.id, tipo="LOJA_ATIVA" if ativo else "LOJA_INATIVA"))
    db.commit()
    return _out(loja)
