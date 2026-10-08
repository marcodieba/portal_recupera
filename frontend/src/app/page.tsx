"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 overflow-hidden relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-4xl text-center space-y-8 z-10"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-4">
          <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
          Sistema Ativo e Sincronizado
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-500">
          Recuperação de Crédito <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Inteligente.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Plataforma web escalável integrada em tempo real com seu ERP. Transforme inadimplência em receita com zero atrito e pagamentos via PIX.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/admin">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-8 py-4 bg-white text-zinc-950 rounded-full font-semibold hover:bg-zinc-100 transition-colors"
            >
              Acessar Dashboard
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl w-full z-10"
      >
        <div className="glass-card p-6 flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Sincronização Real-time</h3>
          <p className="text-sm text-zinc-400">Tokens gerados no ERP sobem para nuvem instantaneamente.</p>
        </div>
        
        <div className="glass-card p-6 flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Pagamento Seguro PIX</h3>
          <p className="text-sm text-zinc-400">Acordos pagos direto na conta da empresa com baixa automática.</p>
        </div>
        
        <div className="glass-card p-6 flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-full text-purple-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Métricas Precisas</h3>
          <p className="text-sm text-zinc-400">Acompanhe a fila inteligente e conversões pelo dashboard.</p>
        </div>
      </motion.div>
    </div>
  );
}
