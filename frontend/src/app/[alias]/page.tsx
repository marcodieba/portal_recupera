"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { DollarSign, Users, Target, Link2, LogOut, RefreshCw, KeyRound, Eye, Copy as CopyIcon } from "lucide-react";
import Link from "next/link";
import { apiGet, apiPost, ApiError, formatCurrency, formatDate } from "@/lib/api";

interface Resumo {
  loja: string;
  ultimoSync: string | null;
  recuperadoMes: number;
  qtdPagosMes: number;
  emAbertoLinks: number;
  qtdLinksAbertos: number;
  conversao30d: number;
  abertura30d: number;
  filaQtd: number;
  filaValor: number;
}

interface FilaItem {
  clienteId: number;
  cliente: string;
  telefone: string | null;
  diasAtraso: number;
  qtdTitulos: number;
  valorAtualizado: number;
  score: number;
  status: string;
}

interface AcordoItem {
  cliente: string;
  valorOriginal: number;
  valorAcordo: number;
  status: string;
  criadoEm: string | null;
  visualizado: boolean;
  pixCopiado: boolean;
  pagoEm: string | null;
}

const CHAVE_STORAGE = "recupera_api_key";

export default function PainelLojista({ params }: { params?: { alias?: string } }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [fila, setFila] = useState<FilaItem[]>([]);
  const [acordos, setAcordos] = useState<AcordoItem[]>([]);
  const [aba, setAba] = useState<"fila" | "acordos">("fila");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(sessionStorage.getItem(CHAVE_STORAGE));
  }, []);

  const carregar = useCallback(async (chave: string) => {
    setLoading(true);
    setErro(null);
    try {
      const [r, f, a] = await Promise.all([
        apiGet<Resumo>("/loja/resumo", chave),
        apiGet<FilaItem[]>("/loja/fila?limite=200", chave),
        apiGet<AcordoItem[]>("/loja/acordos?limite=200", chave),
      ]);
      setResumo(r);
      setFila(f);
      setAcordos(a);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) {
        sessionStorage.removeItem(CHAVE_STORAGE);
        setApiKey(null);
      }
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) carregar(apiKey);
  }, [apiKey, carregar]);

  const sair = () => {
    sessionStorage.removeItem(CHAVE_STORAGE);
    setApiKey(null);
    setResumo(null);
  };

  if (!apiKey) {
    return <Login onEntrar={(k) => { sessionStorage.setItem(CHAVE_STORAGE, k); setApiKey(k); }} />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="flex items-center justify-between mb-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400 font-bold text-xl">R+</div>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{resumo?.loja || "Painel do Lojista"}</h1>
            <p className="text-sm text-zinc-400">
              Recupera+ · última sincronização do ERP: {resumo?.ultimoSync ? new Date(resumo.ultimoSync).toLocaleString("pt-BR") : "nunca"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button id="btn-atualizar" onClick={() => carregar(apiKey)} title="Atualizar"
            className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button id="btn-sair" onClick={sair} title="Sair"
            className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {erro && <p className="text-amber-400 text-sm">{erro}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card titulo="Recuperado no mês" valor={formatCurrency(resumo?.recuperadoMes || 0)}
            sub={`${resumo?.qtdPagosMes || 0} pagamento(s) via portal`} icone={<DollarSign className="text-emerald-400 w-5 h-5" />} delay={0.1} />
          <Card titulo="Links em aberto" valor={formatCurrency(resumo?.emAbertoLinks || 0)}
            sub={`${resumo?.qtdLinksAbertos || 0} proposta(s) aguardando`} icone={<Link2 className="text-indigo-400 w-5 h-5" />} delay={0.2} />
          <Card titulo="Conversão (30 dias)" valor={`${resumo?.conversao30d ?? 0}%`}
            sub={`${resumo?.abertura30d ?? 0}% abriram o link`} icone={<Target className="text-purple-400 w-5 h-5" />} delay={0.3} />
          <Card titulo="Fila de cobrança" valor={formatCurrency(resumo?.filaValor || 0)}
            sub={`${resumo?.filaQtd || 0} cliente(s) em atraso`} icone={<Users className="text-amber-400 w-5 h-5" />} delay={0.4} />
        </div>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="glass-panel p-6">
          <div className="flex items-center gap-6 mb-6 border-b border-white/5">
            <TabBtn ativo={aba === "fila"} onClick={() => setAba("fila")}>Fila Inteligente ({fila.length})</TabBtn>
            <TabBtn ativo={aba === "acordos"} onClick={() => setAba("acordos")}>Propostas enviadas ({acordos.length})</TabBtn>
          </div>

          <div className="overflow-x-auto">
            {aba === "fila" ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-400 text-sm">
                    <th className="pb-3 font-medium px-4">Cliente</th>
                    <th className="pb-3 font-medium px-4">Atraso</th>
                    <th className="pb-3 font-medium px-4">Títulos</th>
                    <th className="pb-3 font-medium px-4">Valor atualizado</th>
                    <th className="pb-3 font-medium px-4">Prioridade</th>
                    <th className="pb-3 font-medium px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fila.map((f) => (
                    <tr key={f.clienteId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-medium text-white">{f.cliente}</div>
                        <div className="text-xs text-zinc-500">{f.telefone || "sem telefone"}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-md text-xs ${f.diasAtraso > 90 ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"}`}>{f.diasAtraso} dias</span>
                      </td>
                      <td className="py-4 px-4 text-zinc-300">{f.qtdTitulos}</td>
                      <td className="py-4 px-4 font-medium text-white">{formatCurrency(f.valorAtualizado)}</td>
                      <td className="py-4 px-4 text-zinc-300">{f.score.toFixed(1)}</td>
                      <td className="py-4 px-4 text-zinc-400 text-sm">{f.status.replace("_", " ")}</td>
                    </tr>
                  ))}
                  {fila.length === 0 && <Vazio cols={6} texto="Nenhum cliente em atraso sincronizado pelo ERP." />}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-400 text-sm">
                    <th className="pb-3 font-medium px-4">Cliente</th>
                    <th className="pb-3 font-medium px-4">Proposta</th>
                    <th className="pb-3 font-medium px-4">Enviada</th>
                    <th className="pb-3 font-medium px-4">Engajamento</th>
                    <th className="pb-3 font-medium px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {acordos.map((a, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 font-medium text-white">{a.cliente}</td>
                      <td className="py-4 px-4">
                        <div className="text-white font-medium">{formatCurrency(a.valorAcordo)}</div>
                        {a.valorAcordo < a.valorOriginal && <div className="text-xs text-zinc-500 line-through">{formatCurrency(a.valorOriginal)}</div>}
                      </td>
                      <td className="py-4 px-4 text-zinc-400 text-sm">{formatDate(a.criadoEm)}</td>
                      <td className="py-4 px-4 text-zinc-400 text-sm">
                        <span className={`inline-flex items-center gap-1 mr-3 ${a.visualizado ? "text-indigo-300" : "text-zinc-600"}`}><Eye className="w-4 h-4" />abriu</span>
                        <span className={`inline-flex items-center gap-1 ${a.pixCopiado ? "text-emerald-300" : "text-zinc-600"}`}><CopyIcon className="w-4 h-4" />PIX</span>
                      </td>
                      <td className="py-4 px-4"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                  {acordos.length === 0 && <Vazio cols={5} texto="Nenhuma proposta publicada ainda." />}
                </tbody>
              </table>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
}

function Login({ onEntrar }: { onEntrar: (k: string) => void }) {
  const [cnpj, setCnpj] = useState("");
  const [senhaWeb, setSenhaWeb] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!cnpj.trim() || !senhaWeb.trim()) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await apiPost<{ token: string }>("/loja/login", { cnpj: cnpj.trim(), senha_web: senhaWeb.trim() });
      onEntrar(res.token);
    } catch (err: any) {
      setErro(err.message || "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={enviar} className="glass-panel w-full max-w-sm p-8 space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <KeyRound className="w-7 h-7 text-indigo-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold">Painel do Lojista</h1>
          <p className="text-sm text-zinc-400 mt-1">Acesse com seu CNPJ e a Senha Web (PIN).</p>
        </div>
        <input id="input-cnpj" type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)}
          placeholder="CNPJ"
          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 focus:border-indigo-500 outline-none text-white" />
        
        <input id="input-senha" type="password" value={senhaWeb} onChange={(e) => setSenhaWeb(e.target.value)}
          placeholder="Senha Web (PIN de 6 dígitos)"
          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 focus:border-indigo-500 outline-none text-white" />
          
        {erro && <p className="text-sm text-rose-400">{erro}</p>}
        <button id="btn-entrar" type="submit" disabled={loading} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition-colors disabled:opacity-50">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}

function Card({ titulo, valor, sub, icone, delay }: { titulo: string; valor: string; sub: string; icone: ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }} className="glass-card p-5 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <p className="text-sm font-medium text-zinc-400">{titulo}</p>
        <div className="p-2 rounded-lg bg-zinc-800/50">{icone}</div>
      </div>
      <h3 className="text-2xl font-bold text-white tracking-tight">{valor}</h3>
      <p className="text-xs text-zinc-500">{sub}</p>
    </motion.div>
  );
}

function TabBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`pb-3 -mb-px text-sm font-semibold border-b-2 transition-colors ${ativo ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    PAGO: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PENDENTE: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    EXPIRADO: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    CANCELADO: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cores[status] || cores.PENDENTE}`}>{status}</span>;
}

function Vazio({ cols, texto }: { cols: number; texto: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 text-center text-zinc-500 text-sm">{texto}</td>
    </tr>
  );
}
