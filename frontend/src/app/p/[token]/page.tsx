"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Info, CheckCircle2, ChevronRight, Copy, Clock, Store, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { apiGet, ApiError, formatCurrency, formatDate } from "@/lib/api";

type Status = "PENDENTE" | "PAGO" | "CANCELADO" | "EXPIRADO";

interface Acordo {
  lojaNome: string;
  clienteNome: string;
  valorOriginal: number;
  valorAcordo: number;
  descontoPerc: number;
  qtdTitulos: number;
  status: Status;
  expiraEm: string;
  pixDinamico: boolean;
}

interface Pix {
  pixCopiaCola: string;
  qrSvg: string | null;
}

const POLL_MS = 10000;

export default function PaymentPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Carregando…</div>
      }
    >
      <PaymentPortal />
    </Suspense>
  );
}

function PaymentPortal() {
  const params = useParams();
  const token = params.token as string;

  const [acordo, setAcordo] = useState<Acordo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const [pixErro, setPixErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;
    apiGet<Acordo>(`/p/${encodeURIComponent(token)}`)
      .then(setAcordo)
      .catch((e: ApiError) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Status real vindo do ERP (o ERP confirma no gateway da loja e publica PAGO)
  const verificarStatus = useCallback(async () => {
    try {
      const s = await apiGet<{ status: Status }>(`/p/${encodeURIComponent(token)}/status`);
      setAcordo((a) => (a && a.status !== s.status ? { ...a, status: s.status } : a));
    } catch {
      /* rede instável: tenta no próximo ciclo */
    }
  }, [token]);

  useEffect(() => {
    if (acordo?.status === "PENDENTE" && pix && acordo.pixDinamico) {
      pollRef.current = setInterval(verificarStatus, POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [acordo?.status, acordo?.pixDinamico, pix, verificarStatus]);

  const revelarPix = async () => {
    setGerando(true);
    setPixErro(null);
    try {
      setPix(await apiGet<Pix>(`/p/${encodeURIComponent(token)}/pix`));
    } catch (e) {
      setPixErro((e as ApiError).message);
    } finally {
      setGerando(false);
    }
  };

  const copiar = async () => {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.pixCopiaCola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setPixErro("Não foi possível copiar automaticamente. Selecione o código e copie manualmente.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  if (erro || !acordo) {
    return (
      <Tela icone={<Info className="w-8 h-8" />} cor="rose" titulo="Link indisponível">
        {erro || "Este link é inválido ou expirou."} Fale com a loja para receber um novo link.
      </Tela>
    );
  }

  if (acordo.status === "EXPIRADO" || acordo.status === "CANCELADO") {
    return (
      <Tela icone={acordo.status === "EXPIRADO" ? <Clock className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
        cor="amber" titulo={acordo.status === "EXPIRADO" ? "Proposta expirada" : "Proposta encerrada"}>
        Entre em contato com {acordo.lojaNome} para receber uma nova proposta.
      </Tela>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="glass-panel w-full max-w-md p-8 relative z-10"
      >
        <header className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <p className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">{acordo.lojaNome}</p>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">Proposta de Quitação</h1>
          <p className="text-zinc-400 text-sm mt-1">Olá, {acordo.clienteNome}</p>
        </header>

        <AnimatePresence mode="wait">
          {acordo.status === "PAGO" ? (
            <motion.div key="pago" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center py-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-emerald-400 mb-2">Pagamento confirmado!</h2>
              <p className="text-zinc-400 mb-6">Obrigado! Seu débito com {acordo.lojaNome} foi quitado.</p>
              <div className="w-full bg-zinc-900/50 rounded-xl p-4 border border-white/5 text-sm flex justify-between">
                <span className="text-zinc-500">Valor</span>
                <span className="text-white font-medium">{formatCurrency(acordo.valorAcordo)}</span>
              </div>
            </motion.div>
          ) : !pix ? (
            <motion.div key="proposta" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <div className="space-y-4 mb-6">
                {acordo.descontoPerc > 0 && (
                  <div className="flex justify-between items-center p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
                    <span className="text-zinc-400">Valor atualizado</span>
                    <span className="text-zinc-300 line-through decoration-rose-500/50">{formatCurrency(acordo.valorOriginal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                  <div>
                    <span className="block text-emerald-400 text-sm font-semibold mb-1">Pagamento à vista no PIX</span>
                    <span className="text-3xl font-bold text-white">{formatCurrency(acordo.valorAcordo)}</span>
                  </div>
                  {acordo.descontoPerc > 0 && (
                    <div className="text-right">
                      <span className="block text-xs text-zinc-400 mb-1">Desconto</span>
                      <span className="text-lg font-bold text-emerald-400">{acordo.descontoPerc}%</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  {acordo.qtdTitulos} título(s) · Proposta válida até {formatDate(acordo.expiraEm)}
                </p>
              </div>

              <button id="btn-ver-pix" onClick={revelarPix} disabled={gerando}
                className="w-full py-4 px-4 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 group disabled:opacity-70">
                {gerando ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Pagar com PIX <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
              {pixErro && <p className="mt-4 text-sm text-amber-400 text-center">{pixErro}</p>}

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
                <ShieldCheck className="w-4 h-4" />
                O pagamento vai direto para a conta de {acordo.lojaNome}
              </div>
            </motion.div>
          ) : (
            <motion.div key="pix" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
              <h2 className="text-lg font-medium text-white mb-1">Pague via PIX</h2>
              <p className="text-2xl font-bold text-emerald-400 mb-5">{formatCurrency(acordo.valorAcordo)}</p>

              {pix.qrSvg && (
                <div className="w-52 h-52 bg-white rounded-xl mb-6 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="QR Code PIX" className="w-full h-full"
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(pix.qrSvg)}`} />
                </div>
              )}

              <div className="w-full space-y-3">
                <p className="text-sm text-zinc-400 text-center">Ou copie o código PIX:</p>
                <button id="btn-copiar-pix" onClick={copiar}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-white/10 hover:bg-zinc-800 transition-colors group">
                  <span className="text-zinc-500 text-sm truncate max-w-[220px]">{pix.pixCopiaCola}</span>
                  <span className="flex items-center gap-2 text-indigo-400">
                    <span className="text-xs font-semibold">{copiado ? "COPIADO!" : "COPIAR"}</span>
                    <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </span>
                </button>
                {pixErro && <p className="text-sm text-amber-400 text-center">{pixErro}</p>}
              </div>

              <div className="mt-8 flex items-center gap-3 text-sm text-zinc-400 bg-zinc-900/50 py-2 px-4 rounded-full border border-white/5 text-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {acordo.pixDinamico
                  ? "Aguardando confirmação do banco. Esta tela atualiza sozinha."
                  : "Após pagar, a loja confirmará o recebimento."}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}

function Tela({ icone, cor, titulo, children }: { icone: ReactNode; cor: "rose" | "amber"; titulo: string; children: ReactNode }) {
  const tons = cor === "rose" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-400";
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className={`w-16 h-16 rounded-full ${tons} flex items-center justify-center mb-6`}>{icone}</div>
      <h1 className="text-2xl font-bold text-white mb-2">{titulo}</h1>
      <p className="text-zinc-400 text-center max-w-sm">{children}</p>
    </main>
  );
}
