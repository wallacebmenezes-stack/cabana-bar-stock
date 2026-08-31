'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Package, AlertTriangle, TrendingUp, ArrowUpRight, 
  ArrowDownLeft, ShoppingBag, Plus, Filter, RefreshCw 
} from 'lucide-react';

export default function Dashboard() {
  const [produtos, setProdutos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('TODOS');

  // Modais
  const [modalProduto, setModalProduto] = useState(false);
  const [modalMovimento, setModalMovimento] = useState(false);
  const [modalVenda, setModalVenda] = useState(false);

  // Formulários
  const [novoProduto, setNovoProduto] = useState({ nome: '', tipo: 'Cerveja', preco_custo: '', preco_venda: '', quantidade_estoque: '', estoque_minimo: '' });
  const [novoMovimento, setNovoMovimento] = useState({ produto_id: '', tipo_movimentacao: 'SAIDA_BAR', quantidade: '', motivo: '' });
  const [novaVenda, setNovaVenda] = useState({ produto_id: '', quantidade: '' });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    const { data: dataProdutos } = await supabase.from('produtos').select('*').order('nome');
    const { data: dataMov } = await supabase.from('movimentacoes').select('*, produtos(nome, tipo)').order('created_at', { ascending: false });
    const { data: dataVendas } = await supabase.from('vendas').select('*, produtos(nome, tipo, preco_custo)').order('created_at', { ascending: false });

    if (dataProdutos) setProdutos(dataProdutos);
    if (dataMov) setMovimentacoes(dataMov);
    if (dataVendas) setVendas(dataVendas);
    setLoading(false);
  }

  // --- CÁLCULOS DA DASHBOARD ---
  const hoje = new Date().toISOString().split('T')[0];
  
  const itensCriticos = produtos.filter(p => p.quantidade_estoque <= p.estoque_minimo);
  
  const saidasHoje = movimentacoes
    .filter(m => m.tipo_movimentacao === 'SAIDA_BAR' && m.created_at.startsWith(hoje))
    .reduce((acc, cur) => acc + cur.quantidade, 0);

  // Vendas acumuladas por produto para cálculo de Mais/Menos Vendido
  const vendasPorProduto = vendas.reduce((acc, v) => {
    const pId = v.produto_id;
    acc[pId] = (acc[pId] || { nome: v.produtos?.nome || 'Item', qtd: 0 });
    acc[pId].qtd += v.quantidade;
    return acc;
  }, {});

  const listaMaisVendidos = Object.values(vendasPorProduto).sort((a, b) => b.qtd - a.qtd);
  const produtoMaisVendido = listaMaisVendidos[0]?.nome || 'Nenhum';
  const produtoMenosVendido = listaMaisVendidos.length > 0 ? listaMaisVendidos[listaMaisVendidos.length - 1]?.nome : 'Nenhum';

  // --- AÇÕES ---
  async function salvarProduto(e) {
    e.preventDefault();
    await supabase.from('produtos').insert([{
      ...novoProduto,
      preco_custo: parseFloat(novoProduto.preco_custo),
      preco_venda: parseFloat(novoProduto.preco_venda),
      quantidade_estoque: parseInt(novoProduto.quantidade_estoque),
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

    if (novoSaldo < 0) return alert('Estoque insuficiente para saída!');

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
    const valorTotal = qtd * prod.preco_venda;
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

  // --- FILTRAGEM DE RELATÓRIO ---
  const vendasFiltradas = vendas.filter(v => {
    const tipoBatente = filtroTipo === 'TODOS' || v.produtos?.tipo === filtroTipo;
    const dataVenda = v.created_at.split('T')[0];
    const inicioBatente = !filtroDataInicio || dataVenda >= filtroDataInicio;
    const fimBatente = !filtroDataFim || dataVenda <= filtroDataFim;
    return tipoBatente && inicioBatente && fimBatente;
  });

  const lucroTotalFiltrado = vendasFiltradas.reduce((acc, v) => acc + Number(v.lucro_total), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <p className="text-amber-500 font-semibold text-xs tracking-wider uppercase">Cabana do Sol • Gestão de Bar</p>
          <h1 className="text-2xl font-bold">Controle de Estoque & Bebidas</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalProduto(true)} className="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> Novo Produto
          </button>
          <button onClick={() => setModalMovimento(true)} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-slate-700">
            <ArrowUpRight size={16} /> Saída / Retorno
          </button>
          <button onClick={() => setModalVenda(true)} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <ShoppingBag size={16} /> Registrar Venda
          </button>
        </div>
      </div>

      {/* Cards da Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
            <span>SAÍDAS DO DIA (BAR)</span>
            <ArrowUpRight className="text-amber-500" size={18} />
          </div>
          <p className="text-2xl font-bold">{saidasHoje} <span className="text-xs text-slate-500">und</span></p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
            <span>ITENS CRÍTICOS</span>
            <AlertTriangle className={itensCriticos.length > 0 ? "text-red-500" : "text-slate-500"} size={18} />
          </div>
          <p className={`text-2xl font-bold ${itensCriticos.length > 0 ? "text-red-400" : ""}`}>
            {itensCriticos.length} <span className="text-xs text-slate-500">produtos</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
            <span>MAIS VENDIDO</span>
            <TrendingUp className="text-emerald-500" size={18} />
          </div>
          <p className="text-lg font-bold truncate text-emerald-400">{produtoMaisVendido}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
            <span>MENOS VENDIDO</span>
            <Package className="text-slate-500" size={18} />
          </div>
          <p className="text-lg font-bold truncate text-slate-400">{produtoMenosVendido}</p>
        </div>
      </div>

      {/* Seção de Filtros & Lucro */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl mb-8">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-amber-500">
          <Filter size={16} /> Relatório de Lucro e Filtros
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Tipo de Produto</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded-lg text-sm">
              <option value="TODOS">Todos os Tipos</option>
              <option value="Cerveja">Cerveja</option>
              <option value="Refrigerante">Refrigerante</option>
              <option value="Água">Água</option>
              <option value="Destilado">Destilado</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Data Início</label>
            <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Data Fim</label>
            <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded-lg text-sm" />
          </div>
          <div className="bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-lg">
            <span className="text-xs text-emerald-400 font-medium block">LUCRO NO PERÍODO</span>
            <span className="text-xl font-bold text-emerald-400">R$ {lucroTotalFiltrado.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 font-semibold text-sm">Estoque Atual</div>
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3">Produto</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Custo</th>
              <th className="p-3">Venda</th>
              <th className="p-3">Saldo</th>
              <th className="p-3">Mínimo</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {produtos.map(p => {
              const critico = p.quantidade_estoque <= p.estoque_minimo;
              return (
                <tr key={p.id} className="hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-slate-100">{p.nome}</td>
                  <td className="p-3 text-slate-400">{p.tipo}</td>
                  <td className="p-3">R$ {Number(p.preco_custo).toFixed(2)}</td>
                  <td className="p-3">R$ {Number(p.preco_venda).toFixed(2)}</td>
                  <td className="p-3 font-bold">{p.quantidade_estoque}</td>
                  <td className="p-3 text-slate-500">{p.estoque_minimo}</td>
                  <td className="p-3">
                    {critico ? (
                      <span className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded border border-red-500/20 font-medium">Crítico</span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded border border-emerald-500/20 font-medium">Normal</span>
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={salvarProduto} className="bg-slate-900 border border-slate-800 p-6 rounded-xl w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold">Cadastrar Novo Produto</h2>
            <input required placeholder="Nome do Produto (ex: Heineken 600ml)" value={novoProduto.nome} onChange={e => setNovoProduto({...novoProduto, nome: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm" />
            <select value={novoProduto.tipo} onChange={e => setNovoProduto({...novoProduto, tipo: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm">
              <option value="Cerveja">Cerveja</option>
              <option value="Refrigerante">Refrigerante</option>
              <option value="Água">Água</option>
              <option value="Destilado">Destilado</option>
              <option value="Outro">Outro</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input required type="number" step="0.01" placeholder="Preço Custo" value={novoProduto.preco_custo} onChange={e => setNovoProduto({...novoProduto, preco_custo: e.target.value})} className="bg-slate-950 border border-slate-700 p-2 rounded text-sm" />
              <input required type="number" step="0.01" placeholder="Preço Venda" value={novoProduto.preco_venda} onChange={e => setNovoProduto({...novoProduto, preco_venda: e.target.value})} className="bg-slate-950 border border-slate-700 p-2 rounded text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input required type="number" placeholder="Qtd Inicial" value={novoProduto.quantidade_estoque} onChange={e => setNovoProduto({...novoProduto, quantidade_estoque: e.target.value})} className="bg-slate-950 border border-slate-700 p-2 rounded text-sm" />
              <input required type="number" placeholder="Estoque Mínimo" value={novoProduto.estoque_minimo} onChange={e => setNovoProduto({...novoProduto, estoque_minimo: e.target.value})} className="bg-slate-950 border border-slate-700 p-2 rounded text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalProduto(false)} className="px-4 py-2 bg-slate-800 text-sm rounded">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-amber-600 text-sm rounded font-medium">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: SAÍDA / RETORNO */}
      {modalMovimento && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={registrarMovimentacao} className="bg-slate-900 border border-slate-800 p-6 rounded-xl w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold">Lançar Movimentação de Estoque</h2>
            <select required value={novoMovimento.produto_id} onChange={e => setNovoMovimento({...novoMovimento, produto_id: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm">
              <option value="">Selecione o Produto...</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} (Atual: {p.quantidade_estoque})</option>)}
            </select>
            <select value={novoMovimento.tipo_movimentacao} onChange={e => setNovoMovimento({...novoMovimento, tipo_movimentacao: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm">
              <option value="SAIDA_BAR">Saída para o Bar</option>
              <option value="RETORNO_ESTOQUE">Retorno do Bar para Estoque</option>
            </select>
            <input required type="number" placeholder="Quantidade" value={novoMovimento.quantidade} onChange={e => setNovoMovimento({...novoMovimento, quantidade: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm" />
            
            {novoMovimento.tipo_movimentacao === 'RETORNO_ESTOQUE' && (
              <input required placeholder="Motivo do Retorno (ex: Avaria, Sobra de evento)" value={novoMovimento.motivo} onChange={e => setNovoMovimento({...novoMovimento, motivo: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm" />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalMovimento(false)} className="px-4 py-2 bg-slate-800 text-sm rounded">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-amber-600 text-sm rounded font-medium">Confirmar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VENDA */}
      {modalVenda && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={registrarVenda} className="bg-slate-900 border border-slate-800 p-6 rounded-xl w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold">Registrar Venda ao Cliente</h2>
            <select required value={novaVenda.produto_id} onChange={e => setNovaVenda({...novaVenda, produto_id: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm">
              <option value="">Selecione o Produto...</option>
              {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} - R$ {p.preco_venda}</option>)}
            </select>
            <input required type="number" placeholder="Quantidade Vendida" value={novaVenda.quantidade} onChange={e => setNovaVenda({...novaVenda, quantidade: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-sm" />
            
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalVenda(false)} className="px-4 py-2 bg-slate-800 text-sm rounded">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-emerald-600 text-sm rounded font-medium">Registrar Venda</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}