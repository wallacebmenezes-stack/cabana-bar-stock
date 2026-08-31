'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Package, AlertTriangle, TrendingUp, ArrowUpRight, 
  ShoppingBag, Plus, Filter, Search, AlertCircle
} from 'lucide-react';

const LISTA_DISTRIBUIDORAS = [
  'AMBEV',
  'BRASIL KIRIN',
  'DONNA',
  'LIGA DISTRIBUIDORA',
  'COCA COLA',
  'OUTRAS'
];

export default function Dashboard() {
  const [produtos, setProdutos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erroSupabase, setErroSupabase] = useState(null);

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
    setErroSupabase(null);

    try {
      const { data: dataProdutos, error: errProd } = await supabase.from('produtos').select('*').order('nome');
      const { data: dataMov, error: errMov } = await supabase.from('movimentacoes').select('*, produtos(nome, tipo, distribuidora)').order('created_at', { ascending: false });
      const { data: dataVendas, error: errVendas } = await supabase.from('vendas').select('*, produtos(nome, tipo, distribuidora, preco_custo)').order('created_at', { ascending: false });

      if (errProd) throw errProd;

      setProdutos(dataProdutos || []);
      setMovimentacoes(dataMov || []);
      setVendas(dataVendas || []);
    } catch (err) {
      console.error("Erro ao carregar do Supabase:", err);
      setErroSupabase(err.message || 'Erro de conexão com o banco de dados');
    } finally {
      setLoading(false);
    }
  }

  // CÁLCULOS DASHBOARD
  const totalUnidades = produtos.reduce((acc, p) => acc + (p.quantidade_estoque || 0), 0);
  const valorTotalEstoque = produtos.reduce((acc, p) => acc + ((p.quantidade_estoque || 0) * Number(p.preco_custo || 0)), 0);
  const itensCriticos = produtos.filter(p => (p.quantidade_estoque || 0) <= (p.estoque_minimo || 0));

  // AÇÕES
  async function salvarProduto(e) {
    e.preventDefault();
    const { error } = await supabase.from('produtos').insert([{
      ...novoProduto,
      fornecedor: novoProduto.distribuidora,
      preco_custo: parseFloat(novoProduto.preco_custo || 0),
      preco_venda: parseFloat(novoProduto.preco_venda || 0),
      quantidade_estoque: parseInt(novoProduto.quantidade_estoque || 0),
      estoque_minimo: parseInt(novoProduto.estoque_minimo || 5)
    }]);

    if (error) return alert(`Erro ao salvar: ${error.message}`);

    setNovoProduto({ nome: '', distribuidora: 'AMBEV', tipo: 'Cerveja', preco_custo: '', preco_venda: '', quantidade_estoque: '', estoque_minimo: '' });
    setModalProduto(false);
    carregarDados();
  }

  async function registrarMovimentacao(e) {
    e.preventDefault();
    const prod = produtos.find(p => p.id === novoMovimento.produto_id);
    if (!prod) return alert('Selecione um produto válido');

    const qtd = parseInt(novoMovimento.quantidade);
    const saldoAtual = prod.quantidade_estoque || 0;
    const novoSaldo = novoMovimento.tipo_movimentacao === 'SAIDA_BAR' 
      ? saldoAtual - qtd 
      : saldoAtual + qtd;

    if (novoSaldo < 0) return alert('Estoque insuficiente para esta saída!');

    const { error: errMov } = await supabase.from('movimentacoes').insert([{
      produto_id: novoMovimento.produto_id,
      tipo_movimentacao: novoMovimento.tipo_movimentacao,
      quantidade: qtd,
      motivo: novoMovimento.tipo_movimentacao === 'RETORNO_ESTOQUE' ? novoMovimento.motivo : null
    }]);

    if (errMov) return alert(`Erro no registro: ${errMov.message}`);

    await supabase.from('produtos').update({ quantidade_estoque: novoSaldo }).eq('id', prod.id);

    setNovoMovimento({ produto_id: '', tipo_movimentacao: 'SAIDA_BAR', quantidade: '', motivo: '' });
    setModalMovimento(false);
    carregarDados();
  }

  async function registrarVenda(e) {
    e.preventDefault();
    const prod = produtos.find(p => p.id === novaVenda.produto_id);
    if (!prod) return alert('Selecione um produto válido');

    const qtd = parseInt(novaVenda.quantidade);
    const lucro = ((prod.preco_venda || 0) - (prod.preco_custo || 0)) * qtd;

    const { error } = await supabase.from('vendas').insert([{
      produto_id: prod.id,
      quantidade: qtd,
      valor_unitario: prod.preco_venda || 0,
      lucro_total: lucro
    }]);

    if (error) return alert(`Erro na venda: ${error.message}`);

    setNovaVenda({ produto_id: '', quantidade: '' });
    setModalVenda(false);
    carregarDados();
  }

  // FILTRAGEM
  const produtosFiltrados = produtos.filter(p => {
    const nomeValido = (p.nome || '').toLowerCase().includes(buscaNome.toLowerCase());
    const distValida = filtroDistribuidora === 'TODAS' || p.distribuidora === filtroDistribuidora || p.fornecedor === filtroDistribuidora;
    const tipoValido = filtroTipo === 'TODOS' || p.tipo === filtroTipo;
    return nomeValido && distValida && tipoValido;
  });

  const vendasFiltradas = vendas.filter(v => {
    const distValida = filtroDistribuidora === 'TODAS' || v.produtos?.distribuidora === filtroDistribuidora || v.produtos?.fornecedor === filtroDistribuidora;
    const tipoValido = filtroTipo === 'TODOS' || v.produtos?.tipo === filtroTipo;
    const dataVenda = v.created_at?.split('T')[0];
    const inicioValido = !filtroDataInicio || dataVenda >= filtroDataInicio;
    const fimValido = !filtroDataFim || dataVenda <= filtroDataFim;
    return distValida && tipoValido && inicioValido && fimValido;
  });

  const lucroTotalFiltrado = vendasFiltradas.reduce((acc, v) => acc + Number(v.lucro_total || 0), 0);

  // OPÇÕES AGRUPADAS
  const renderOptionsAgrupadas = (incluirPreco = false) => {
    if (loading) return <option disabled value="">Carregando dados do banco...</option>;
    if (produtos.length === 0) return <option disabled value="">Nenhum produto encontrado no banco</option>;

    const grupos = produtos.reduce((acc, prod) => {
      const dist = prod.distribuidora || prod.fornecedor || 'OUTRAS';
      if (!acc[dist]) acc[dist] = [];
      acc[dist].push(prod);
      return acc;
    }, {});

    return Object.keys(grupos).map(dist => (
      <optgroup key={dist} label={`--- ${dist} ---`}>
        {grupos[dist].map(p => (
          <option key={p.id} value={p.id}>
            {p.nome} {incluirPreco ? `(R$ ${Number(p.preco_venda || 0).toFixed(2)})` : `(Saldo: ${p.quantidade_estoque ?? 0})`}
          </option>
        ))}
      </optgroup>
    ));
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 font-sans">
      {/* Banner de Erro caso a conexão falhe */}
      {erroSupabase && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg mb-4 flex items-center gap-2 text-xs">
          <AlertCircle size={16} />
          <span><strong>Erro de Conexão:</strong> {erroSupabase}. Verifique as permissões SQL no Supabase.</span>
        </div>
      )}

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

      {/* Cards */}
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

      {/* Busca e Filtros */}
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
          {LISTA_DISTRIBUIDORAS.map(d => <option key={d} value={d}>{d}</option>)}
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
            {produtosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-4 text-center text-slate-500 text-xs">
                  {loading ? 'Carregando produtos...' : 'Nenhum produto cadastrado na tabela.'}
                </td>
              </tr>
            ) : (
              produtosFiltrados.map(p => {
                const critico = (p.quantidade_estoque || 0) <= (p.estoque_minimo || 0);
                return (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-semibold text-slate-100">{p.nome}</td>
                    <td className="p-3.5 text-amber-500/90 font-medium">{p.distribuidora || p.fornecedor || 'OUTRAS'}</td>
                    <td className="p-3.5 text-slate-400">{p.tipo}</td>
                    <td className="p-3.5">R$ {Number(p.preco_custo || 0).toFixed(2)}</td>
                    <td className="p-3.5">R$ {Number(p.preco_venda || 0).toFixed(2)}</td>
                    <td className="p-3.5 font-bold text-slate-100">{p.quantidade_estoque ?? 0} und</td>
                    <td className="p-3.5">
                      {critico ? (
                        <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded border border-amber-500/20 font-bold">CRÍTICO</span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 font-bold">NORMAL</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: NOVO PRODUTO */}
      {modalProduto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <form onSubmit={salvarProduto} className="bg-[#0f172a] border border-slate-800 p-5 rounded-xl w-full max-w-md space-y-3">
            <h2 className="text-base font-bold text-slate-100">Cadastrar Novo Item Adicional</h2>
            <input required placeholder="Nome do Item" value={novoProduto.nome} onChange={e => setNovoProduto({...novoProduto, nome: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <select value={novoProduto.distribuidora} onChange={e => setNovoProduto({...novoProduto, distribuidora: e.target.value})} className="bg-[#090d16] border border-slate-800 p-2 rounded text-xs">
                {LISTA_DISTRIBUIDORAS.map(d => <option key={d} value={d}>{d}</option>)}
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
            
            <select required value={novoMovimento.produto_id} onChange={e => setNovoMovimento({...novoMovimento, produto_id: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs text-slate-100">
              <option value="">Selecione o Item na lista...</option>
              {renderOptionsAgrupadas(false)}
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
            
            <select required value={novaVenda.produto_id} onChange={e => setNovaVenda({...novaVenda, produto_id: e.target.value})} className="w-full bg-[#090d16] border border-slate-800 p-2 rounded text-xs text-slate-100">
              <option value="">Selecione o Item na lista...</option>
              {renderOptionsAgrupadas(true)}
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