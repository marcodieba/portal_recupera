"""Rotas públicas do portal do devedor (acesso pelo link enviado no WhatsApp)."""
import io

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db, Acordo
from app.schemas import PortalAcordoOut, PortalPixOut
from app.security import sha256, agora

router = APIRouter(prefix="/p", tags=["Portal"])


def _buscar(token: str, db: Session) -> Acordo:
    if not token or len(token) < 8 or len(token) > 64:
        raise HTTPException(status_code=404, detail="Link inválido.")
    ac = db.query(Acordo).filter(Acordo.token_hash == sha256(token)).first()
    if not ac or not ac.loja or not ac.loja.ativo:
        raise HTTPException(status_code=404, detail="Link inválido ou expirado.")
    if ac.status == "PENDENTE" and ac.expira_em and ac.expira_em < agora():
        ac.status = "EXPIRADO"
        ac.pix_copia_cola = None
        db.commit()
    return ac


def _primeiro_nome(nome: str) -> str:
    partes = (nome or "").strip().split()
    return partes[0].title() if partes else "Cliente"


def _qr_svg(texto: str):
    try:
        import qrcode
        import qrcode.image.svg
        img = qrcode.make(texto, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
        buf = io.BytesIO()
        img.save(buf)
        return buf.getvalue().decode("utf-8")
    except Exception:
        return None  # o frontend mostra só o copia e cola


@router.get("/{token}", response_model=PortalAcordoOut)
def ver_acordo(token: str, db: Session = Depends(get_db)):
    ac = _buscar(token, db)
    if ac.visualizado_em is None:
        ac.visualizado_em = agora()
        db.commit()
    desconto = 0
    if ac.valor_original > 0 and ac.valor_acordo < ac.valor_original:
        desconto = round((1 - ac.valor_acordo / ac.valor_original) * 100)
    return PortalAcordoOut(
        lojaNome=ac.loja.nome,
        clienteNome=_primeiro_nome(ac.cliente_nome),
        valorOriginal=ac.valor_original,
        valorAcordo=ac.valor_acordo,
        descontoPerc=desconto,
        qtdTitulos=ac.qtd_titulos,
        status=ac.status,
        expiraEm=ac.expira_em,
        pixDinamico=ac.pix_dinamico,
    )


@router.get("/{token}/pix", response_model=PortalPixOut)
def ver_pix(token: str, db: Session = Depends(get_db)):
    ac = _buscar(token, db)
    if ac.status != "PENDENTE":
        raise HTTPException(status_code=409, detail=f"Acordo {ac.status.lower()}.")
    if not ac.pix_copia_cola:
        raise HTTPException(status_code=425, detail="O PIX ainda está sendo gerado pela loja. Tente novamente em alguns minutos.")
    if ac.pix_copiado_em is None:
        ac.pix_copiado_em = agora()
        db.commit()
    return PortalPixOut(pixCopiaCola=ac.pix_copia_cola, qrSvg=_qr_svg(ac.pix_copia_cola))


@router.get("/{token}/status")
def ver_status(token: str, db: Session = Depends(get_db)):
    ac = _buscar(token, db)
    return {"status": ac.status, "pagoEm": ac.pago_em.isoformat() + "Z" if ac.pago_em else None}
