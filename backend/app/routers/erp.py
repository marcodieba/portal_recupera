"""Rotas usadas pelo ERP (autenticadas por API key da loja)."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db, Loja, Acordo, FilaItem, EventoAuditoria
from app.schemas import SyncIn, SyncOut
from app.security import loja_autenticada, agora

router = APIRouter(prefix="/erp", tags=["ERP"])

# Status finais não voltam para PENDENTE (evita "ressuscitar" acordo pago por sync atrasado)
FINAIS = {"PAGO", "CANCELADO", "EXPIRADO"}


def _utc_naive(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.get("/ping")
def ping(loja: Loja = Depends(loja_autenticada)):
    return {"ok": True, "loja": loja.nome, "alias": loja.alias}


@router.post("/sync", response_model=SyncOut)
def sync(payload: SyncIn, loja: Loja = Depends(loja_autenticada), db: Session = Depends(get_db)):
    criados = atualizados = ignorados = 0

    if payload.loja_nome and payload.loja_nome.strip() and payload.loja_nome != loja.nome:
        loja.nome = payload.loja_nome.strip()[:120]

    hashes = [a.token_hash for a in payload.acordos]
    existentes = {}
    if hashes:
        for a in db.query(Acordo).filter(Acordo.token_hash.in_(hashes)).all():
            existentes[a.token_hash] = a

    for item in payload.acordos:
        ac = existentes.get(item.token_hash)
        if ac is not None and ac.loja_id != loja.id:
            ignorados += 1  # hash pertence a outra loja: nunca sobrescrever
            continue

        if ac is None:
            ac = Acordo(loja_id=loja.id, token_hash=item.token_hash)
            db.add(ac)
            criados += 1
        else:
            if ac.status in FINAIS and item.status == "PENDENTE":
                ignorados += 1
                continue
            atualizados += 1

        ac.cliente_nome = item.cliente_nome
        ac.valor_original = round(item.valor_original, 2)
        ac.valor_acordo = round(item.valor_acordo, 2)
        ac.qtd_titulos = item.qtd_titulos
        ac.pix_copia_cola = item.pix_copia_cola if item.status == "PENDENTE" else None
        ac.pix_dinamico = item.pix_dinamico
        ac.status = item.status
        ac.expira_em = _utc_naive(item.expira_em)
        if item.status == "PAGO":
            ac.pago_em = _utc_naive(item.pago_em) or ac.pago_em or agora()
        ac.atualizado_em = agora()

    qtd_fila = None
    if payload.fila is not None:
        db.query(FilaItem).filter(FilaItem.loja_id == loja.id).delete(synchronize_session=False)
        for f in payload.fila[:1000]:
            db.add(FilaItem(
                loja_id=loja.id, cliente_id_erp=f.cliente_id, cliente_nome=f.cliente_nome,
                telefone=f.telefone, dias_atraso=f.dias_atraso, qtd_titulos=f.qtd_titulos,
                valor_original=round(f.valor_original, 2), valor_atualizado=round(f.valor_atualizado, 2),
                score=f.score, status_caso=f.status_caso, atualizado_em=agora(),
            ))
        qtd_fila = min(len(payload.fila), 1000)

    loja.ultimo_sync_em = agora()
    db.add(EventoAuditoria(loja_id=loja.id, tipo="SYNC", detalhe=json.dumps({
        "recebidos": len(payload.acordos), "criados": criados, "atualizados": atualizados,
        "ignorados": ignorados, "fila": qtd_fila,
    })))
    db.commit()

    # Eventos de engajamento do devedor (o ERP registra como interação no caso)
    eventos = []
    pend = (db.query(Acordo)
            .filter(Acordo.loja_id == loja.id, Acordo.status == "PENDENTE")
            .filter((Acordo.visualizado_em.isnot(None)) | (Acordo.pix_copiado_em.isnot(None)))
            .all())
    for a in pend:
        eventos.append({
            "token_hash": a.token_hash,
            "visualizado_em": a.visualizado_em.isoformat() + "Z" if a.visualizado_em else None,
            "pix_copiado_em": a.pix_copiado_em.isoformat() + "Z" if a.pix_copiado_em else None,
        })

    return SyncOut(recebidos=len(payload.acordos), criados=criados, atualizados=atualizados,
                   ignorados=ignorados, fila=qtd_fila, eventos=eventos)
