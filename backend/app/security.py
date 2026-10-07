"""Autenticação: API key por loja (ERP e painel web) e chave mestre (BLM)."""
import base64
import json
import re
from datetime import datetime

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import PUBLIC_KEY_PEM
from app.database import get_db, Loja

def load_public_key() -> Ed25519PublicKey:
    if not PUBLIC_KEY_PEM:
        raise ValueError("RECUPERA_PUBLIC_KEY_PEM não configurada na nuvem.")
    pem_str = PUBLIC_KEY_PEM.strip().replace("\\n", "\n")
    if "-----BEGIN" in pem_str and "\n" not in pem_str:
        pem_str = pem_str.replace("-----BEGIN PUBLIC KEY-----", "-----BEGIN PUBLIC KEY-----\n")
        pem_str = pem_str.replace("-----END PUBLIC KEY-----", "\n-----END PUBLIC KEY-----")
    return serialization.load_pem_public_key(pem_str.encode("utf-8"))

def verificar_licenca(licenca_json: str) -> dict:
    try:
        dados = json.loads(licenca_json)
        payload = dados["payload"]
        sig_b64 = dados["sig"]
        
        # Verify signature
        pub_key = load_public_key()
        msg_bytes = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        
        # Restore padding and decode
        sig_b64 += "=" * ((4 - len(sig_b64) % 4) % 4)
        sig_bytes = base64.urlsafe_b64decode(sig_b64)
        
        pub_key.verify(sig_bytes, msg_bytes)
        
        # Check module
        modulos = payload.get("modulos", [])
        if "RECUPERA_PLUS" not in modulos:
            raise ValueError("Licença Autêntica, mas não possui o módulo RECUPERA_PLUS adquirido.")
            
        return payload
    except ValueError as ve:
        raise HTTPException(status_code=403, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Assinatura da licença inválida: {e}")

def loja_autenticada(
    x_license_token: str = Header(default="", alias="X-License-Token"),
    authorization: str = Header(default="", alias="Authorization"),
    db: Session = Depends(get_db),
) -> Loja:
    """Verifica a assinatura da licença do ERP e providencia acesso seguro, ou usa token web do painel."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        loja = db.query(Loja).filter(Loja.web_token == token).first()
        if loja and loja.ativo:
            return loja
            
    if not x_license_token:
        raise HTTPException(status_code=401, detail="X-License-Token ou Authorization ausente.")
        
    payload = verificar_licenca(x_license_token)
    cnpj = payload.get("cnpj")
    if not cnpj:
        raise HTTPException(status_code=400, detail="CNPJ ausente no payload da licença.")
        
    # Limpa CNPJ para alias (somente numeros)
    cnpj_clean = re.sub(r"\D", "", cnpj)
    
    loja = db.query(Loja).filter(Loja.cnpj == cnpj).first()
    if not loja:
        loja = Loja(cnpj=cnpj, nome="Loja " + cnpj, alias="loja-" + cnpj_clean, ativo=True)
        db.add(loja)
        db.commit()
        db.refresh(loja)
        
    if not loja.ativo:
        raise HTTPException(status_code=403, detail="Loja inativa na nuvem.")
        
    return loja

def agora() -> datetime:
    return datetime.utcnow()
