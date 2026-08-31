'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Senha de segurança para autorizar edição de estoque e preços
const SENHA_ADMIN = '1234';

export default function GestaoEstoqueBar() {
  // Dados do banco
  const [produtos, setProdutos] = useState([]);
  const [tiposBebida, setTiposBebida] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensagemErro, setMensagemErro] = useState('');

  // Navegação por Abas
  // 'estoque' | 'entradas' | 'saidas' | 'retornos' | 'perdas'
  const [abaAtiva, setAbaAtiva] = useState('estoque');

  // Filtros Globais (Multi-seleção)
  const [buscaNome, setBuscaNome] = useState('');
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [distribuidoraSelecionada, setDistribuidoraSelecionada] = useState('TODAS');
  const [tiposSelecionados, setTiposSelecionados] = useState([]);
  const [motivosPerdaSelecionados, setMotivosPerdaSelecionados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Modais de Controle
  const [modalNovoProduto, setModalNovoProduto] = useState(false);
  const [modalNovoTipo, setModalNovoTipo] = useState(false);
  const [modalEditarProduto, setModalEditarProduto] = useState(null);
  const [modalMovimentacao, setModalMovimentacao] = useState(null); // 'ENTRADA' | 'SAIDA' | 'RETORNO' | 'PERDA'
  const [modalSenhaOpen, setModalSenhaOpen] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [produtoParaEditar, setProdutoParaEditar] = useState(null);

  // Form de Novo Produto
  const [novoProd, setNovoProd] = useState({
    nome: '',
    distribuidora: 'AMBEV',
    tipo: 'Cerveja',
    preco_custo: 0,
    preco_venda: 0,
    quantidade_estoque: 0,
    estoque_critico: 5
  });

  // Form de Novo Tipo de Bebida
  const [novoTipoNome, setNovoTipoNome] = useState('');

  // Form de Movimentação (Entrada/Saída/Retorno/Perda)
  const [formMov, setFormMov] = useState({
    produto_id: '',
    quantidade: 1,
    motivo_perda: 'Validade',
    observacao: ''
  });

  // --- CARREGAMENTO DE DADOS ---
  const carregarDados = async () => {
    setLoading(true);
    setMensagemErro('');
    try {
      // 1. Tipos de Bebida
      const { data: dataTipos, error: errTipos } = await supabase
        .from('tipos_bebida')
        .select('*')
        .order('nome');
      if (errTipos) throw errTipos;
      setTiposBebida(dataTipos || []);

      // 2. Produtos
      const { data: dataProds, error: errProds } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');
      if (errProds) throw errProds;
      setProdutos(dataProds || []);

      // 3. Movimentações
      const { data: dataMovs, error: errMovs } = await supabase
        .from('movimentacoes')
        .select('*, produtos(nome, tipo, distribuidora)')
        .order('created_at', { ascending: false });
      if (errMovs) throw errMovs;
      setMovimentacoes(dataMovs || []);

    } catch (err) {
      console.error('Erro no Supabase:', err);
      setMensagemErro('Erro ao carregar dados do Supabase: ' + (err.message || 'Verifique as tabelas.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // --- AÇÕES DO SISTEMA ---

  // Cadastrar Novo Tipo de Bebida
  const handleSalvarNovoTipo = async (e) => {
    e.preventDefault();
    if (!novoTipoNome.trim()) return;
    try {
      const { error } = await supabase.from('tipos_bebida').insert([{ nome: novoTipoNome.trim() }]);
      if (error) throw error;
      setNovoTipoNome('');
      setModalNovoTipo(false);
      carregarDados();
    } catch (err) {
      alert('Erro ao criar tipo de bebida: ' + err.message);
    }
  };

  // Cadastrar Novo Produto
  const handleSalvarNovoProduto = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('produtos').insert([novoProd]);
      if (error) throw error;
      setModalNovoProduto(false);
      setNovoProd({
        nome: '',
        distribuidora: 'AMBEV',
        tipo: tiposBebida[0]?.nome || 'Cerveja',
        preco_custo: 0,
        preco_venda: 0,
        quantidade_estoque: 0,
        estoque_critico: 5
      });
      carregarDados();
    } catch (err) {
      alert('Erro ao cadastrar produto: ' + err.message);
    }
  };

  // Abrir Edição com Validação de Senha
  const solicitarEdicaoEstoque = (produto) => {
    setProdutoParaEditar({ ...produto });
    setSenhaInput('');
    setModalSenhaOpen(true);
  };

  const confirmarSenhaAutenticacao = (e) => {
    e.preventDefault();
    if (senhaInput === SENHA_ADMIN) {
      setModalSenhaOpen(false);
      setModalEditarProduto(produtoParaEditar);
    } else {
      alert('Senha incorreta! Acesso negado.');
    }
  };

  // Salvar Atualização do Produto
  const handleSalvarEdicaoProduto = async (e) => {
    e.preventDefault();
    try {
      const { id, nome, distribuidora, tipo, preco_custo, preco_venda, quantidade_estoque, estoque_critico } = modalEditarProduto;
      const { error } = await supabase
        .from('produtos')
        .update({
          nome,
          distribuidora,
          tipo,
          preco_custo: Number(preco_custo),
          preco_venda: Number(preco_venda),
          quantidade_estoque: Number(quantidade_estoque),
          estoque_critico: Number(estoque_critico)
        })
        .eq('id', id);

      if (error) throw error;
      setModalEditarProduto(null);
      carregarDados();
    } catch (err) {
      alert('Erro ao atualizar produto: ' + err.message);
    }
  };

  // Registrar Movimentação (Entrada / Saída / Retorno / Perda)
  const handleRegistrarMovimentacao = async (e) => {
    e.preventDefault();
    if (!formMov.produto_id) return alert('Selecione um produto!');

    const prod = produtos.find((p) => p.id.toString() === formMov.produto_id.toString());
    if (!prod) return alert('Produto não encontrado!');

    const qtd = Number(formMov.quantidade);
    if (qtd <= 0) return alert('Quantidade deve ser maior que zero!');

    let novoEstoque = prod.quantidade_estoque;
    if (modalMovimentacao === 'ENTRADA' || modalMovimentacao === 'RETORNO') {
      novoEstoque += qtd;
    } else if (modalMovimentacao === 'SAIDA' || modalMovimentacao === 'PERDA') {
      if (prod.quantidade_estoque < qtd) {
        if (!confirm(`Atenção: O estoque atual é de ${prod.quantidade_estoque} und. Deseja registrar a movimentação mesmo assim?`)) {
          return;
        }
      }
      novoEstoque -= qtd;
    }

    try {
      // 1. Grava a movimentação CONGELANDO o preço do momento
      const { error: errMov } = await supabase.from('movimentacoes').insert([
        {
          produto_id: prod.id,
          tipo_movimentacao: modalMovimentacao,
          quantidade: qtd,
          preco_custo_momento: prod.preco_custo,
          preco_venda_momento: prod.preco_venda,
          motivo_perda: modalMovimentacao === 'PERDA' ? formMov.motivo_perda : null,
          observacao: formMov.observacao
        }
      ]);

      if (errMov) throw errMov;

      // 2. Atualiza o estoque atual do produto
      const { error: errProd } = await supabase
        .from('produtos')
        .update({ quantidade_estoque: Math.max(0, novoEstoque) })
        .eq('id', prod.id);

      if (errProd) throw errProd;

      setModalMovimentacao(null);
      setFormMov({ produto_id: '', quantidade: 1, motivo_perda: 'Validade', observacao: '' });
      carregarDados();
    } catch (err) {
      alert('Erro ao registrar movimentação: ' + err.message);
    }
  };

  // --- FILTRAGEM DE DADOS ---

  const toggleSelecaoMultipla = (item, lista, setLista) => {
    if (lista.includes(item)) {
      setLista(lista.filter((i) => i !== item));
    } else {
      setLista([...lista, item]);
    }
  };

  // Filtragem de Produtos na Tabela Principal
  const produtosFiltrados = produtos.filter((p) => {
    const atendeNome = p.nome.toLowerCase().includes(buscaNome.toLowerCase());
    const atendeProdutos = produtosSelecionados.length === 0 || produtosSelecionados.includes(p.nome);
    const atendeDistribuidora = distribuidoraSelecionada === 'TODAS' || p.distribuidora === distribuidoraSelecionada;
    const atendeTipo = tiposSelecionados.length === 0 || tiposSelecionados.includes(p.tipo);
    return atendeNome && atendeProdutos && atendeDistribuidora && atendeTipo;
  });

  // Filtragem de Históricos por Data e Tipos
  const movimentacoesFiltradas = movimentacoes.filter((m) => {
    const dataMov = new Date(m.created_at);

    if (dataInicio && dataMov < new Date(dataInicio + 'T00:00:00')) return false;
    if (dataFim && dataMov > new Date(dataFim + 'T23:59:59')) return false;

    if (produtosSelecionados.length > 0 && !produtosSelecionados.includes(m.produtos?.nome)) return false;
    if (tiposSelecionados.length > 0 && !tiposSelecionados.includes(m.produtos?.tipo)) return false;

    if (abaAtiva === 'entradas' && m.tipo_movimentacao !== 'ENTRADA') return false;
    if (abaAtiva === 'saidas' && m.tipo_movimentacao !== 'SAIDA') return false;
    if (abaAtiva === 'retornos' && m.tipo_movimentacao !== 'RETORNO') return false;
    if (abaAtiva === 'perdas') {
      if (m.tipo_movimentacao !== 'PERDA') return false;
      if (motivosPerdaSelecionados.length > 0 && !motivosPerdaSelecionados.includes(m.motivo_perda)) return false;
    }

    return true;
  });

  // Métricas do Topo
  const totalUnidades = produtos.reduce((acc, p) => acc + (p.quantidade_estoque || 0), 0);
  const valorEstoqueCusto = produtos.reduce((acc, p) => acc + (p.quantidade_estoque || 0) * (p.preco_custo || 0), 0);
  const alertasEstoqueBaixo = produtos.filter((p) => p.quantidade_estoque <= p.estoque_critico).length;
  const totalPerdasQtd = movimentacoes
    .filter((m) => m.tipo_movimentacao === 'PERDA')
    .reduce((acc, m) => acc + m.quantidade, 0);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 p-4 md:p-8 font-sans">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-500 font-semibold">Cabana do Sol • Gestão de Bar</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Controle de Estoque & Bebidas</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModalNovoTipo(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-3 py-2 rounded-lg font-medium transition"
          >
            + Tipo de Bebida
          </button>
          <button
            onClick={() => setModalNovoProduto(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
          >
            + Novo Produto
          </button>
          <button
            onClick={() => { setModalMovimentacao('SAIDA'); setFormMov({ produto_id: produtos[0]?.id || '', quantidade: 1 }); }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
          >
            ↗ Saída Bar
          </button>
          <button
            onClick={() => { setModalMovimentacao('ENTRADA'); setFormMov({ produto_id: produtos[0]?.id || '', quantidade: 1 }); }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
          >
            ↙ Entrada Estoque
          </button>
          <button
            onClick={() => { setModalMovimentacao('PERDA'); setFormMov({ produto_id: produtos[0]?.id || '', quantidade: 1, motivo_perda: 'Validade' }); }}
            className="bg-rose-700 hover:bg-rose-600 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
          >
            ⚠ Registrar Perda
          </button>
        </div>
      </div>

      {mensagemErro && (
        <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs p-3 rounded-xl mb-6">
          {mensagemErro}
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl">
          <p className="text-xs text-slate-400 font-medium">TOTAL DE UNIDADES</p>
          <p className="text-2xl font-bold text-white mt-1">{totalUnidades} <span className="text-xs text-slate-500 font-normal">und</span></p>
        </div>
        <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl">
          <p className="text-xs text-slate-400 font-medium">VALOR EM ESTOQUE (CUSTO)</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            R$ {valorEstoqueCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl">
          <p className="text-xs text-slate-400 font-medium">ALERTAS DE ESTOQUE BAIXO</p>
          <p className={`text-2xl font-bold mt-1 ${alertasEstoqueBaixo > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {alertasEstoqueBaixo} <span className="text-xs font-normal">itens críticos</span>
          </p>
        </div>
        <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl">
          <p className="text-xs text-slate-400 font-medium">TOTAL DE PERDAS REGISTRADAS</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">
            {totalPerdasQtd} <span className="text-xs text-slate-500 font-normal">und</span>
          </p>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="flex border-b border-slate-800 mb-6 space-x-2 overflow-x-auto pb-1">
        {[
          { id: 'estoque', label: 'Estoque Principal' },
          { id: 'entradas', label: 'Histórico de Entradas' },
          { id: 'saidas', label: 'Saídas para o Bar' },
          { id: 'retornos', label: 'Retornos ao Estoque' },
          { id: 'perdas', label: 'Perdas & Descartes' },
        ].map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
              abaAtiva === aba.id
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* Área de Filtros Avançados Múltiplos */}
      <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Busca por Texto */}
        <div>
          <label className="block text-slate-400 mb-1">Buscar Produto:</label>
          <input
            type="text"
            placeholder="Digite o nome..."
            value={buscaNome}
            onChange={(e) => setBuscaNome(e.target.value)}
            className="w-full bg-[#0a0e17] border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Múltiplos Tipos de Bebida */}
        <div>
          <label className="block text-slate-400 mb-1">Tipos (Múltipla Seleção):</label>
          <div className="max-h-24 overflow-y-auto bg-[#0a0e17] border border-slate-700/80 rounded-lg p-2 space-y-1">
            {tiposBebida.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={tiposSelecionados.includes(t.nome)}
                  onChange={() => toggleSelecaoMultipla(t.nome, tiposSelecionados, setTiposSelecionados)}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>{t.nome}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Múltiplos Produtos */}
        <div>
          <label className="block text-slate-400 mb-1">Produtos (Múltipla Seleção):</label>
          <div className="max-h-24 overflow-y-auto bg-[#0a0e17] border border-slate-700/80 rounded-lg p-2 space-y-1">
            {produtos.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={produtosSelecionados.includes(p.nome)}
                  onChange={() => toggleSelecaoMultipla(p.nome, produtosSelecionados, setProdutosSelecionados)}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span className="truncate">{p.nome}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Intervalo de Datas / Filtro por Perda */}
        <div>
          {abaAtiva === 'perdas' ? (
            <>
              <label className="block text-slate-400 mb-1">Motivos de Perda:</label>
              <div className="max-h-24 overflow-y-auto bg-[#0a0e17] border border-slate-700/80 rounded-lg p-2 space-y-1">
                {['Validade', 'Má conservação', 'Acidental', 'Erro de pedido', 'Outro'].map((m) => (
                  <label key={m} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={motivosPerdaSelecionados.includes(m)}
                      onChange={() => toggleSelecaoMultipla(m, motivosPerdaSelecionados, setMotivosPerdaSelecionados)}
                      className="rounded border-slate-700 accent-rose-500"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="block text-slate-400 mb-1">Período por Data:</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-slate-700/80 rounded-lg px-2 py-2 text-slate-200"
                />
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-slate-700/80 rounded-lg px-2 py-2 text-slate-200"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* TABELA PRINCIPAL DE ESTOQUE */}
      {abaAtiva === 'estoque' && (
        <div className="bg-[#111726] border border-slate-800/80 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0a0e17] text-slate-400 border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="p-3">Produto</th>
                <th className="p-3">Distribuidora</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Preço Custo</th>
                <th className="p-3">Preço Venda</th>
                <th className="p-3">Quantidade em Estoque</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    Nenhum produto cadastrado ou encontrado nos filtros.
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map((p) => {
                  const isCritico = p.quantidade_estoque <= p.estoque_critico;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-semibold text-white">{p.nome}</td>
                      <td className="p-3 text-amber-500 font-medium">{p.distribuidora}</td>
                      <td className="p-3 text-slate-400">{p.tipo}</td>
                      <td className="p-3">R$ {Number(p.preco_custo).toFixed(2)}</td>
                      <td className="p-3">R$ {Number(p.preco_venda).toFixed(2)}</td>
                      <td className="p-3 font-bold text-white">{p.quantidade_estoque} und</td>
                      <td className="p-3">
                        {isCritico ? (
                          <span className="px-2 py-1 text-[10px] font-bold rounded border border-amber-500/50 bg-amber-500/10 text-amber-400">
                            CRÍTICO (&le; {p.estoque_critico})
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-[10px] font-bold rounded border border-emerald-500/50 bg-emerald-500/10 text-emerald-400">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => solicitarEdicaoEstoque(p)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-[11px] px-3 py-1.5 rounded font-medium transition"
                        >
                          🔒 Atualizar Estoque
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TABELAS DE HISTÓRICOS (ENTRADAS, SAÍDAS, RETORNOS, PERDAS) */}
      {abaAtiva !== 'estoque' && (
        <div className="bg-[#111726] border border-slate-800/80 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0a0e17] text-slate-400 border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Produto</th>
                <th className="p-3">Tipo Bebida</th>
                <th className="p-3">Quantidade</th>
                <th className="p-3">Preço Época</th>
                {abaAtiva === 'perdas' && <th className="p-3">Motivo da Perda</th>}
                <th className="p-3">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {movimentacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    Nenhum registro encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                movimentacoesFiltradas.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3 text-slate-400">
                      {new Date(m.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 font-semibold text-white">{m.produtos?.nome || 'Produto Removido'}</td>
                    <td className="p-3 text-slate-400">{m.produtos?.tipo || '-'}</td>
                    <td className="p-3 font-bold text-slate-200">{m.quantidade} und</td>
                    <td className="p-3">
                      R$ {Number(m.tipo_movimentacao === 'SAIDA' ? m.preco_venda_momento : m.preco_custo_momento).toFixed(2)}
                    </td>
                    {abaAtiva === 'perdas' && (
                      <td className="p-3 text-rose-400 font-semibold">{m.motivo_perda || 'Não informado'}</td>
                    )}
                    <td className="p-3 text-slate-400">{m.observacao || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* --- MODAIS DE AÇÃO --- */}

      {/* Modal Autenticação por Senha */}
      {modalSenhaOpen && (
        <div className="fixed inset-[#0a0e17]/80 inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-sm">
            <h3 className="text-base font-bold text-white mb-2">Acesso Restrito</h3>
            <p className="text-xs text-slate-400 mb-4">Digite a senha de administrador para alterar estoques e preços:</p>
            <form onSubmit={confirmarSenhaAutenticacao} className="space-y-4">
              <input
                type="password"
                placeholder="Senha de acesso (Padrão: 1234)"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                autoFocus
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setModalSenhaOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-500"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Produto / Estoque */}
      {modalEditarProduto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Atualizar Produto & Estoque</h3>
            <form onSubmit={handleSalvarEdicaoProduto} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome do Produto:</label>
                <input
                  type="text"
                  value={modalEditarProduto.nome}
                  onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, nome: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Distribuidora:</label>
                  <input
                    type="text"
                    value={modalEditarProduto.distribuidora}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, distribuidora: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Tipo / Segmento:</label>
                  <select
                    value={modalEditarProduto.tipo}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, tipo: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    {tiposBebida.map((t) => (
                      <option key={t.id} value={t.nome}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Preço Custo (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={modalEditarProduto.preco_custo}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, preco_custo: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preço Venda (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={modalEditarProduto.preco_venda}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, preco_venda: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-amber-400 mb-1 font-semibold">Quantidade em Estoque:</label>
                  <input
                    type="number"
                    value={modalEditarProduto.quantidade_estoque}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, quantidade_estoque: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-amber-500/50 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Nível de Estoque Crítico:</label>
                  <input
                    type="number"
                    value={modalEditarProduto.estoque_critico}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, estoque_critico: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalEditarProduto(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cadastrar Novo Produto */}
      {modalNovoProduto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Cadastrar Novo Produto</h3>
            <form onSubmit={handleSalvarNovoProduto} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome do Produto:</label>
                <input
                  type="text"
                  placeholder="Ex: CERVEJA HEINEKEN LONG NECK"
                  value={novoProd.nome}
                  onChange={(e) => setNovoProd({ ...novoProd, nome: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Distribuidora:</label>
                  <input
                    type="text"
                    placeholder="Ex: AMBEV"
                    value={novoProd.distribuidora}
                    onChange={(e) => setNovoProd({ ...novoProd, distribuidora: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Tipo:</label>
                  <select
                    value={novoProd.tipo}
                    onChange={(e) => setNovoProd({ ...novoProd, tipo: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    {tiposBebida.map((t) => (
                      <option key={t.id} value={t.nome}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Preço Custo (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoProd.preco_custo}
                    onChange={(e) => setNovoProd({ ...novoProd, preco_custo: Number(e.target.value) })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preço Venda (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoProd.preco_venda}
                    onChange={(e) => setNovoProd({ ...novoProd, preco_venda: Number(e.target.value) })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Quantidade Inicial:</label>
                  <input
                    type="number"
                    value={novoProd.quantidade_estoque}
                    onChange={(e) => setNovoProd({ ...novoProd, quantidade_estoque: Number(e.target.value) })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Estoque Crítico:</label>
                  <input
                    type="number"
                    value={novoProd.estoque_critico}
                    onChange={(e) => setNovoProd({ ...novoProd, estoque_critico: Number(e.target.value) })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalNovoProduto(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold"
                >
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Tipo de Bebida */}
      {modalNovoTipo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-sm">
            <h3 className="text-base font-bold text-white mb-3">Cadastrar Novo Tipo de Bebida</h3>
            <form onSubmit={handleSalvarNovoTipo} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome do Segmento / Tipo:</label>
                <input
                  type="text"
                  placeholder="Ex: Cachaça, Gin, Liqueur..."
                  value={novoTipoNome}
                  onChange={(e) => setNovoTipoNome(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoTipo(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimentação (Entrada / Saída / Perda) */}
      {modalMovimentacao && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-base font-bold text-white mb-3">
              Registrar {modalMovimentacao === 'PERDA' ? 'Perda / Descarte' : modalMovimentacao}
            </h3>
            <form onSubmit={handleRegistrarMovimentacao} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Selecione o Produto:</label>
                <select
                  value={formMov.produto_id}
                  onChange={(e) => setFormMov({ ...formMov, produto_id: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  required
                >
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Atual: {p.quantidade_estoque} und)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Quantidade:</label>
                <input
                  type="number"
                  min="1"
                  value={formMov.quantidade}
                  onChange={(e) => setFormMov({ ...formMov, quantidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>

              {modalMovimentacao === 'PERDA' && (
                <div>
                  <label className="block text-rose-400 mb-1 font-semibold">Motivo da Perda:</label>
                  <select
                    value={formMov.motivo_perda}
                    onChange={(e) => setFormMov({ ...formMov, motivo_perda: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-rose-500/50 rounded-lg p-2 text-slate-200"
                  >
                    <option value="Validade">Validade</option>
                    <option value="Má conservação">Má conservação</option>
                    <option value="Acidental">Acidental</option>
                    <option value="Erro de pedido">Erro de pedido</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Observações / Detalhes:</label>
                <input
                  type="text"
                  placeholder="Ex: Garrafa quebrada durante o transporte..."
                  value={formMov.observacao}
                  onChange={(e) => setFormMov({ ...formMov, observacao: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMovimentacao(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg font-semibold ${
                    modalMovimentacao === 'PERDA' ? 'bg-rose-700 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  Confirmar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}