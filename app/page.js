'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Package, 
  Search, 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  AlertTriangle, 
  RefreshCw,
  Wine,
  CheckCircle2
} from 'lucide-react';

export default function Home() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  
  // Estado para Modal de Movimentação Rápida
  const [selectedProduto, setSelectedProduto] = useState(null);
  const [qtdMovimentacao, setQtdMovimentacao] = useState('');
  const [tipoMovimentacao, setTipoMovimentacao] = useState('SAIDA');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProdutos();
  }, []);

  async function fetchProdutos() {
    setLoading(true);
    const { data, error } = await supabase
      .from('v_saldo_estoque')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao buscar produtos:', error);
    } else {
      setProdutos(data || []);
    }
    setLoading(false);
  }

  async function handleRegistrarMovimentacao(e) {
    e.preventDefault();
    if (!selectedProduto || !qtdMovimentacao) return;

    setSaving(true);
    const qtd = parseInt(qtdMovimentacao, 10);

    const { error } = await supabase.from('movimentacoes').insert([
      {
        produto_id: selectedProduto.id,
        tipo_movimentacao: tipoMovimentacao,
        quantidade: qtd,
        observacao: observacao || `Lançamento rápido (${tipoMovimentacao})`
      }
    ]);

    if (error) {
      alert('Erro ao registrar movimentação: ' + error.message);
    } else {
      setSelectedProduto(null);
      setQtdMovimentacao('');
      setObservacao('');
      fetchProdutos();
    }
    setSaving(false);
  }

  // Listas para filtros
  const fornecedores = ['TODOS', ...Array.from(new Set(produtos.map(p => p.fornecedor)))];
  const tipos = ['TODOS', ...Array.from(new Set(produtos.map(p => p.tipo)))];

  // Filtragem
  const produtosFiltrados = produtos.filter(p => {
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase());
    const matchForn = filtroFornecedor === 'TODOS' || p.fornecedor === filtroFornecedor;
    const matchTipo = filtroTipo === 'TODOS' || p.tipo === filtroTipo;
    return matchBusca && matchForn && matchTipo;
  });

  // Métricas do Dashboard
  const totalItens = produtos.reduce((acc, p) => acc + (p.estoque_atual || 0), 0);
  const totalValorEstoque = produtos.reduce((acc, p) => acc + ((p.estoque_atual || 0) * (p.preco_custo || 0)), 0);
  const alertasBaixoEstoque = produtos.filter(p => (p.estoque_atual || 0) <= p.estoque_minimo).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm tracking-wider uppercase">
              <Wine size={18} /> Cabana do Sol • Gestão de Bar
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mt-1">Controle de Estoque & Bebidas</h1>
          </div>
          <button 
            onClick={fetchProdutos}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-4 py-2.5 rounded-lg transition text-sm font-medium"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar Saldo
          </button>
        </div>

        {/* CARDS DE MÉTRICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total de Unidades</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalItens.toLocaleString('pt-BR')} <span className="text-sm font-normal text-slate-400">und</span></h3>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
              <Package size={24} />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Valor em Estoque (Custo)</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                R$ {totalValorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp size={24} />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Alertas de Estoque Baixo</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">{alertasBaixoEstoque} <span className="text-sm font-normal text-slate-400">itens</span></h3>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>

        {/* FILTROS E BUSCA */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar produto pelo nome..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
            <select 
              value={filtroFornecedor}
              onChange={(e) => setFiltroFornecedor(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
            >
              <option value="TODOS">Todos os Fornecedores</option>
              {fornecedores.filter(f => f !== 'TODOS').map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <select 
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
            >
              <option value="TODOS">Todos os Tipos</option>
              {tipos.filter(t => t !== 'TODOS').map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TABELA DE PRODUTOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Produto</th>
                  <th className="p-4">Fornecedor</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4 text-right">Preço Custo</th>
                  <th className="p-4 text-center">Saldo Atual</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      Carregando dados do bar...
                    </td>
                  </tr>
                ) : produtosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  produtosFiltrados.map((item) => {
                    const isBaixo = item.estoque_atual <= item.estoque_minimo;
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-4 font-medium text-white">{item.nome}</td>
                        <td className="p-4 text-slate-400">{item.fornecedor}</td>
                        <td className="p-4">
                          <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full border border-slate-700">
                            {item.tipo}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono text-slate-300">
                          R$ {Number(item.preco_custo).toFixed(2)}
                        </td>
                        <td className="p-4 text-center font-bold text-base font-mono">
                          {item.estoque_atual} <span className="text-xs font-normal text-slate-500">{item.unidade}</span>
                        </td>
                        <td className="p-4 text-center">
                          {isBaixo ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                              Baixo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => { setSelectedProduto(item); setTipoMovimentacao('SAIDA'); }}
                              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 p-1.5 rounded-lg transition"
                              title="Registrar Saída"
                            >
                              <MinusCircle size={18} />
                            </button>
                            <button
                              onClick={() => { setSelectedProduto(item); setTipoMovimentacao('ENTRADA'); }}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-1.5 rounded-lg transition"
                              title="Registrar Entrada"
                            >
                              <PlusCircle size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DE REGISTRO RÁPIDO */}
        {selectedProduto && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Movimentar: <span className="text-amber-400">{selectedProduto.nome}</span>
              </h3>

              <form onSubmit={handleRegistrarMovimentacao} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Movimentação</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoMovimentacao('SAIDA')}
                      className={`py-2 text-sm font-semibold rounded-lg border transition ${
                        tipoMovimentacao === 'SAIDA' 
                          ? 'bg-rose-600 border-rose-500 text-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Saída (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoMovimentacao('ENTRADA')}
                      className={`py-2 text-sm font-semibold rounded-lg border transition ${
                        tipoMovimentacao === 'ENTRADA' 
                          ? 'bg-emerald-600 border-emerald-500 text-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Entrada (+)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Quantidade ({selectedProduto.unidade})</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qtdMovimentacao}
                    onChange={(e) => setQtdMovimentacao(e.target.value)}
                    placeholder="Ex: 12"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Observação / Turno (Opcional)</label>
                  <input
                    type="text"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex: Contagem Bar Principal"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProduto(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition"
                  >
                    {saving ? 'Gravando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}