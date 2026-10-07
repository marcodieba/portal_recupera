"""Painel web do lojista (mesma API key da loja)."""
from datetime import datetime, timedelta

import json
import secrets
import urllib.request
import re

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.config import API_ATIVADOR_URL
from app.database import get_db, Loja, Acordo, FilaItem
from app.security import loja_autenticada, agora

router = APIRouter(prefix="/loja", tags=["Painel do Lojista"])

class LoginRequest(BaseModel):
    cnpj: str
    senha_web: str

@router.post("/login")
def login(dados: LoginRequest, db: Session = Depends(get_db)):
    # Remove máscaras do CNPJ
    cnpj_limpo = re.sub(r"\D", "", dados.cnpj)
    
    # Valida CNPJ e Senha na API Ativador
    req_data = json.dumps({"cnpj": cnpj_limpo, "senha_web": dados.senha_web}).encode("utf-8")
    req = urllib.request.Request(
        f"{API_ATIVADOR_URL}/api/v1/auth-web", 
        data=req_data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            resp_data = json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=401, detail="CNPJ ou Senha inválidos.")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erro ao validar senha na API Ativador: {e}")
        
    # Se OK, gera um token, e cadastra ou atualiza a loja
    token = secrets.token_urlsafe(32)
    loja = db.query(Loja).filter(Loja.cnpj == cnpj_limpo).first()
    if not loja:
        loja = Loja(cnpj=cnpj_limpo, nome=resp_data.get("nome", "Loja " + cnpj_limpo), alias="loja-" + cnpj_limpo, ativo=True)
        db.add(loja)
    
    loja.web_token = token
    db.commit()
    
    return {"token": token, "nome": loja.nome}


@router.get("/resumo")
def resumo(loja: Loja = Depends(loja_autenticada), db: Session = Depends(get_db)):
    hoje = agora()
    inicio_mes = datetime(hoje.year, hoje.month, 1)
    janela = hoje - timedelta(days=30)

    base = db.query(Acordo).filter(Acordo.loja_id == loja.id)

    recuperado_mes = (base.with_entities(func.coalesce(func.sum(Acordo.valor_acordo), 0.0))
                      .filter(Acordo.status == "PAGO", Acordo.pago_em >= inicio_mes).scalar())
    qtd_pagos_mes = base.filter(Acordo.status == "PAGO", Acordo.pago_em >= inicio_mes).count()
    em_aberto = (base.with_entities(func.coalesce(func.sum(Acordo.valor_acordo), 0.0))
                 .filter(Acordo.status == "PENDENTE").scalar())
    qtd_abertos = base.filter(Acordo.status == "PENDENTE").count()

    recentes = base.filter(Acordo.criado_em >= janela)
    total_30 = recentes.count()
    pagos_30 = recentes.filter(Acordo.status == "PAGO").count()
    vistos_30 = recentes.filter(Acordo.visualizado_em.isnot(None)).count()

    fila_q = db.query(FilaItem).filter(FilaItem.loja_id == loja.id)
    fila_qtd = fila_q.count()
    fila_valor = fila_q.with_entities(func.coalesce(func.sum(FilaItem.valor_atualizado), 0.0)).scalar()

    return {
        "loja": loja.nome,
        "ultimoSync": loja.ultimo_sync_em.isoformat() + "Z" if loja.ultimo_sync_em else None,
        "recuperadoMes": round(float(recuperado_mes or 0), 2),
        "qtdPagosMes": qtd_pagos_mes,
        "emAbertoLinks": round(float(em_aberto or 0), 2),
        "qtdLinksAbertos": qtd_abertos,
        "conversao30d": round(pagos_30 / total_30 * 100, 1) if total_30 else 0.0,
        "abertura30d": round(vistos_30 / total_30 * 100, 1) if total_30 else 0.0,
        "filaQtd": fila_qtd,
        "filaValor": round(float(fila_valor or 0), 2),
    }


@router.get("/fila")
def fila(limite: int = Query(100, ge=1, le=1000), loja: Loja = Depends(loja_autenticada),
         db: Session = Depends(get_db)):
    itens = (db.query(FilaItem).filter(FilaItem.loja_id == loja.id)
             .order_by(FilaItem.score.desc()).limit(limite).all())
    return [{
        "clienteId": f.cliente_id_erp, "cliente": f.cliente_nome, "telefone": f.telefone,
        "diasAtraso": f.dias_atraso, "qtdTitulos": f.qtd_titulos,
        "valorOriginal": f.valor_original, "valorAtualizado": f.valor_atualizado,
        "score": round(f.score, 1), "status": f.status_caso or "SEM_CASO",
    } for f in itens]


@router.get("/acordos")
def acordos(status: str | None = None, limite: int = Query(100, ge=1, le=500),
            loja: Loja = Depends(loja_autenticada), db: Session = Depends(get_db)):
    q = db.query(Acordo).filter(Acordo.loja_id == loja.id)
    if status:
        q = q.filter(Acordo.status == status.upper())
    itens = q.order_by(Acordo.criado_em.desc()).limit(limite).all()
    return [{
        "cliente": a.cliente_nome, "valorOriginal": a.valor_original, "valorAcordo": a.valor_acordo,
        "status": a.status, "criadoEm": a.criado_em.isoformat() + "Z" if a.criado_em else None,
        "visualizado": a.visualizado_em is not None, "pixCopiado": a.pix_copiado_em is not None,
        "pagoEm": a.pago_em.isoformat() + "Z" if a.pago_em else None,
        "expiraEm": a.expira_em.isoformat() + "Z" if a.expira_em else None,
    } for a in itens]
