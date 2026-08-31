'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Package, AlertTriangle, TrendingUp, ArrowUpRight, 
  ShoppingBag, Plus, Filter, Search
} from 'lucide-react';

export default function Dashboard() {
  const [produtos, setProdutos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [buscaNome, setBuscaNome] = useState('');
  const [filtroDistribuidora, setFiltroDistribuidora] = useState('TODAS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Modais
  const [modalProduto, setModalProduto] = useState(false);
  const [modalMovimento, setModalMovimento] = useState(false);
  const [modalVenda, setModalVenda] = useState(false);

  // Formulários
  const [novoProduto, setNovoProduto] = useState({ 
    nome: '', distribuidora: 'AMBEV', tipo: 'Cerveja', 
    preco_custo: '', preco_venda: '', quantidade_estoque: '', estoque_minimo: '' 
  });
  const [novoMovimento, setNovoMovimento] = useState({ produto_id: '', tipo_movimentacao: 'SAIDA_BAR', quantidade: '', motivo: '' });
  const [novaVenda, setNovaVenda] = useState({ produto_id: '', quantidade: '' });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    const { data: dataProdutos } = await supabase.from('produtos').select('*').order('nome');
    const { data: dataMov } = await supabase.from('movimentacoes').select('*, produtos(nome, tipo, distribuidora)').order('created_at', { ascending: false });
    const { data: dataVendas } = await supabase.from('vendas').select('*, produtos(nome, tipo, distribuidora, preco_custo)').order('created_at', { ascending: false });

    if (dataProdutos) setProdutos(dataProdutos);
    if (dataMov) setMovimentacoes(dataMov);
    if (dataVendas) setVendas(dataVendas);
    setLoading(false);
  }

  // CÁLCULOS DASHBOARD
  const hoje = new Date().toISOString().split('T')[0];
  const itensCriticos = produtos.filter(p => p.quantidade_estoque <= p.estoque_minimo);
  const totalUnidades = produtos.reduce((acc, p) => acc + p.quantidade_estoque, 0);
  const valorTotalEstoque = produtos.reduce((acc, p) => acc + (p.quantidade_estoque * Number(p.preco_custo)), 0);

  const saidasHoje = movimentacoes
    .filter(m => m.tipo_movimentacao === 'SAIDA_BAR' && m.created_at.startsWith(hoje))
    .reduce((acc, cur) => acc + cur.quantidade, 0);

  // AÇÕES
  async function salvarProduto(e) {
    e.preventDefault();
    await supabase.from('produtos').insert([{
      ...novoProduto,
      preco_custo: parseFloat(novoProduto.preco_custo || 0),
      preco_venda: parseFloat(novoProduto.preco_venda || 0),
      quantidade_estoque: parseInt(novoProduto.quantidade_estoque || 0),
      estoque_minimo: parseInt(novoProduto.estoque_minimo || 5)
    }]);
    setModalProduto(false);
    carregarDados();
  }

  async function registrarMovimentacao(e) {
    e.preventDefault();
    const prod = produtos.find(p => p.id === novoMovimento.produto_id);
    if (!prod) return;

    const qtd = parseInt(novoMovimento.quantidade);
    const novoSaldo = novoMovimento.tipo_movimentacao === 'SAIDA_BAR' 
      ? prod.quantidade_estoque - qtd 
      : prod.quantidade_estoque + qtd;

    if (novoSaldo < 0) return alert('Estoque insuficiente!');

    await supabase.from('movimentacoes').insert([{
      produto_id: novoMovimento.produto_id,
      tipo_movimentacao: novoMovimento.tipo_movimentacao,
      quantidade: qtd,
      motivo: novoMovimento.tipo_movimentacao === 'RETORNO_ESTOQUE' ? novoMovimento.motivo : null
    }]);

    await supabase.from('produtos').update({ quantidade_estoque: novoSaldo }).eq('id', prod.id);

    setModalMovimento(false);
    carregarDados();
  }

  async function registrarVenda(e) {
    e.preventDefault();
    const prod = produtos.find(p => p.id === novaVenda.produto_id);
    if (!prod) return;

    const qtd = parseInt(novaVenda.quantidade);
    const lucro = (prod.preco_venda - prod.preco_custo) * qtd;

    await supabase.from('vendas').insert([{
      produto_id: prod.id,
      quantidade: qtd,
      valor_unitario: prod.preco_venda,
      lucro_total: lucro
    }]);

    setModalVenda(false);
    carregarDados();
  }

  // FILTRAGEM
  const produtosFiltrados = produtos.filter(p => {
    const nomeValido = p.nome.toLowerCase().includes(buscaNome.toLowerCase());
    const distValida = filtroDistribuidora === 'TODAS' || p.distribuidora === filtroDistribuidora;
    const tipoValido = filtroTipo === 'TODOS' || p.tipo === filtroTipo;
    return nomeValido && distValida && tipoValido;
  });

  const vendasFiltradas = vendas.filter(v => {
    const distValida = filtroDistribuidora === 'TODAS' || v.produtos?.distribuidora === filtroDistribuidora;
    const tipoValido = filtroTipo === 'TODOS' || v.produtos?.tipo === filtroTipo;
    const dataVenda = v.created_at.split('T')[0];
    const inicioValido = !filtroDataInicio || dataVenda >= filtroDataInicio;
    const fimValido = !filtroDataFim || dataVenda <= filtroDataFim;
    return distValida && tipoValido && inicioValido && fimValido;
  });

  const lucroTotalFiltrado = vendasFiltradas.reduce((acc, v) => acc + Number(v.lucro_total), 0);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
        <div>
          <p className="text-amber-500 font-semibold text-xs tracking-wider uppercase">Cabana do Sol • Gestão de Bar</p>
          <h1 className="text-2xl font-bold tracking-tight">Controle de Estoque & Bebidas</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalProduto(true)} className="bg-amber-600 hover:bg-amber-500 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
            <Plus size={15} /> NOVO PRODUTO
          </button>
          <button onClick={() => setModalMovimento(true)} className="bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition">
            <ArrowUpRight size={15} /> SAÍDA / RETORNO
          </button>
          <button onClick={() => setModalVenda(true)} className="bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
            <ShoppingBag size={15} /> REGISTRAR VENDA
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0f172a]/70 border border-slate-800 p-4 rounded-xl">
          <p className="text-slate-400 text-[11px] font-bold tracking-wider uppercase mb-1">TOTAL DE UNIDADES</p>
          <div className="flex justify-between items-end">
            <p className="text-2xl font-extrabold">{totalUnidades} <span className="text-xs font-normal text-slate-500">und</span></p>
            <Package className="text-blue-500 mb-1" size={20} />
          </div>
        </div>

        <div className="bg-[#0f172a]/70 border border-slate-800 p-4 rounded-xl">
          <p className="text-slate-400 text-[11px] font-bold tracking-wider uppercase mb-1">VALOR EM ESTOQUE (CUSTO)</p>
          <div className="flex justify-between items-end">
            <p className="text-2xl font-extrabold text-emerald-400">R$ {valorTotalEstoque.toFixed(2)}</p>
            <TrendingUp className="text-emerald-500 mb-1" size={20} />
          </div>
        </div>

        <div className="bg-[#0f172a]/70 border border-slate-800 p-4 rounded-xl">
          <p className="text-slate-400 text-[11px] font-bold tracking-wider uppercase mb-1">ALERTAS DE ESTOQUE BAIXO</p>
          <div className="flex justify-between items-end">
            <p className={`text-2xl font-extrabold ${itensCriticos.length > 0 ? 'text-amber-400' : 'text-slate-200'}`}>{itensCriticos.length} <span className="text-xs font-normal text-slate-500">itens</span></p>
            <AlertTriangle className={itensCriticos.length > 0 ? "text-amber-500 mb-1" : "text-slate-600 mb-1"} size={20} />
          </div>
        </div>

        <div className="bg-[#0f172a]/70 border border-slate-800 p-4 rounded-xl">
          <p className="text-slate-400 text-[11px] font-bold tracking-wider uppercase mb-1">LUCRO FILTRADO</p>
          <div className="flex justify-between items-end">
            <p className="text-2xl font-extrabold text-emerald-400">R$ {lucroTotalFiltrado.toFixed(2)}</p>
            <Filter className="text-slate-500 mb-1" size={18} />
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-[#0f172a]/70 border border-slate-800 p-3.5 rounded-xl mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="Buscar produto pelo nome..." 
            value={buscaNome} 
            onChange={e => setBuscaNome(e.target.value)} 
            className="w-full bg-[#090d16] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <select value={filtroDistribuidora} onChange={e => setFiltroDistribuidora(e.target.value)} className="bg-[#090d16] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
          <option value="TODAS">Todas as Distribuidoras</option>
          <option value="AMBEV">AMBEV</option>
          <option value="BRASIL KIRIN">BRASIL KIRIN</option>
          <option value="DONNA">DONNA</option>
          <option value="LIGA DISTRIBUIDORA">LIGA DISTRIBUIDORA</option>
          <option value="COCA COLA">COCA COLA</option>
          <option value="OUTRAS">OUTRAS</option>
        </select>

        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="bg-[#090d16] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
          <option value="TODOS">Todos os Tipos</option>
          <option value="Cerveja">Cerveja</option>
          <option value="Refrigerante">Refrigerante</option>
          <option value="Água / Tônica">Água / Tônica</option>
          <option value="Energético">Energético</option>
        </select>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>De:</span>
          <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="bg-[#090d16] border border-slate-800 rounded px-2 py-1 text-xs" />
          <span>Até:</span>
          <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="bg-[#090d16] border border-slate-800 rounded px-2 py-1 text-xs" />
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-[#0f172a]/70 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#090d16] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3.5">PRODUTO</th>
              <th className="p-3.5">DISTRIBUIDORA</th>
              <th className="p-3.5">TIPO</th>
              <th className="p-3.5">PREÇO CUSTO</th>
              <th className="p-3.5">PREÇO VENDA</th>
              <th className="p-3.5">SALDO ATUAL</th>
              <th className="p-3.5">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {produtosFiltrados.map(p => {
              const critico = p.quantidade_estoque <= p.estoque_minimo;
              return (
                <tr key={p.id} className="hover:bg-slate-800/30 transition">
                  <td className="p-3.5 font-semibold text-slate-100">{p.nome}</td>
                  <td className="p-3.5 text-amber-500/90 font-medium">{p.distribuidora}</td>
                  <td className="p-3.5 text-slate-400">{p.tipo}</td>
                  <td className="p-3.5">R$ {Number(p.preco_custo).toFixed(2)}</td>
                  <td className="p-3.5">R$ {Number(p.preco_venda).toFixed(2)}</td>
                  <td className="p-3.5 font-bold text-slate-100">{p.quantidade_estoque} und</td>
                  <td className="p-3.5">
                    {critico ? (
                      <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded border border-amber-500/20 font-bold">CRÍTICO</span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 font-bold">NORMAL</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL: NOVO PRODUTO */}
      {modalProduto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <form onSubmit={salvarProduto} className="bg-[#0f172a] border border-slate-800 p-5 rounded-xl w-full max-w-md space-y-3">
            <h2 className="text-base font-bold text-slate-100">Cadastrar Novo Item</h2>
            <input required placeholder="Nome do Item" value={novoProduto.nome} onChange={e => setNovoProduto({...novoProduto, nome: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <select value={novoProduto.distribuidora} onChange={e => setNovoProduto({...novoProduto, distribuidora: e.target.value})} className="bg-[#090d16] border border-slate-800 p-2 rounded text-xs">
                <option value="AMBEV">AMBEV</option>
                <option value="BRASIL KIRIN">BRASIL KIRIN</option>
                <option value="DONNA">DONNA</option>
                <option value="LIGA DISTRIBUIDORA">LIGA DISTRIBUIDORA</option>
                <option value="COCA COLA">COCA COLA</option>
                <option value="OUTRAS">OUTRAS</option>
              </select>
              <select value={novoProduto.tipo} onChange={e => setNovoProduto({...novoProduto, tipo: e.target.value})} className="bg-[#090d16] border border-slate-800 p-2 rounded text-xs">
                <option value="Cerveja">Cerveja</option>
                <option value="Refrigerante">Refrigerante</option>
                <option value="Água / Tônica">Água / Tônica</option>
                <option value="Energético">Energético</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input required type="number" step="0.01" placeholder="Custo (R$)" value={novoProduto.preco_custo} onChange={e => setNovoProduto({...novoProduto, preco_custo: e.target.value})} className="bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
              <input required type="number" step="0.01" placeholder="Venda (R$)" value={novoProduto.preco_venda} onChange={e => setNovoProduto({...novoProduto, preco_venda: e.target.value})} className="bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input required type="number" placeholder="Estoque Inicial" value={novoProduto.quantidade_estoque} onChange={e => setNovoProduto({...novoProduto, quantidade_estoque: e.target.value})} className="bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
              <input required type="number" placeholder="Estoque Mínimo" value={novoProduto.estoque_minimo} onChange={e => setNovoProduto({...novoProduto, estoque_minimo: e.target.value})} className="bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalProduto(false)} className="px-3 py-1.5 bg-slate-800 text-xs rounded">Cancelar</button>
              <button type="submit" className="px-3 py-1.5 bg-amber-600 text-xs rounded font-medium">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: SAÍDA / RETORNO */}
      {modalMovimento && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <form onSubmit={registrarMovimentacao} className="bg-[#0f172a] border border-slate-800 p-5 rounded-xl w-full max-w-md space-y-3">
            <h2 className="text-base font-bold">Saída / Retorno de Estoque</h2>
            <select required value={novoMovimento.produto_id} onChange={e => setNovoMovimento({...novoMovimento, produto_id: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs">
              <option value="">Selecione o Item...</option>
              {produtos.map(p => <option key={p.id} value={p.id}>[{p.distribuidora}] {p.nome} (Saldo: {p.quantidade_estoque})</option>)}
            </select>
            <select value={novoMovimento.tipo_movimentacao} onChange={e => setNovoMovimento({...novoMovimento, tipo_movimentacao: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs">
              <option value="SAIDA_BAR">Saída para o Bar</option>
              <option value="RETORNO_ESTOQUE">Retorno do Bar para Estoque</option>
            </select>
            <input required type="number" placeholder="Quantidade" value={novoMovimento.quantidade} onChange={e => setNovoMovimento({...novoMovimento, quantidade: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
            
            {novoMovimento.tipo_movimentacao === 'RETORNO_ESTOQUE' && (
              <input required placeholder="Motivo da Devolução (Avaria, Sobra...)" value={novoMovimento.motivo} onChange={e => setNovoMovimento({...novoMovimento, motivo: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalMovimento(false)} className="px-3 py-1.5 bg-slate-800 text-xs rounded">Cancelar</button>
              <button type="submit" className="px-3 py-1.5 bg-amber-600 text-xs rounded font-medium">Confirmar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VENDA */}
      {modalVenda && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <form onSubmit={registrarVenda} className="bg-[#0f172a] border border-slate-800 p-5 rounded-xl w-full max-w-md space-y-3">
            <h2 className="text-base font-bold">Registrar Venda ao Cliente</h2>
            <select required value={novaVenda.produto_id} onChange={e => setNovaVenda({...novaVenda, produto_id: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs">
              <option value="">Selecione o Item...</option>
              {produtos.map(p => <option key={p.id} value={p.id}>[{p.distribuidora}] {p.nome} - R$ {p.preco_venda}</option>)}
            </select>
            <input required type="number" placeholder="Quantidade Vendida" value={novaVenda.quantidade} onChange={e => setNovaVenda({...novaVenda, quantidade: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
            
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalVenda(false)} className="px-3 py-1.5 bg-slate-800 text-xs rounded">Cancelar</button>
              <button type="submit" className="px-3 py-1.5 bg-emerald-600 text-xs rounded font-medium">Confirmar Venda</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}