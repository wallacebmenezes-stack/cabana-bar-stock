'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DISTRIBUIDORAS_PADRAO = [
  'AMBEV',
  'COCA-COLA / SOLAR',
  'HEINEKEN',
  'INDAPO',
  'OUTRA'
];

export default function GestaoEstoqueBar() {
  // Dados do Banco
  const [produtos, setProdutos] = useState([]);
  const [tiposBebida, setTiposBebida] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensagemErro, setMensagemErro] = useState('');

  // Navegação por Abas ('estoque' | 'entradas' | 'retornos' | 'perdas')
  const [abaAtiva, setAbaAtiva] = useState('estoque');

  // Filtros Globais
  const [buscaNome, setBuscaNome] = useState('');
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [tiposSelecionados, setTiposSelecionados] = useState([]);
  const [motivosPerdaSelecionados, setMotivosPerdaSelecionados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Controle de Modais
  const [modalFiltros, setModalFiltros] = useState(false);
  const [modalNovoProduto, setModalNovoProduto] = useState(false);
  const [modalNovoTipo, setModalNovoTipo] = useState(false);
  const [modalEditarProduto, setModalEditarProduto] = useState(null);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalRetorno, setModalRetorno] = useState(false);
  const [modalPerda, setModalPerda] = useState(false);

  // Forms
  const [novoProd, setNovoProd] = useState({
    nome: '',
    distribuidora: 'AMBEV',
    tipo: '',
    preco_custo: 0,
    preco_venda: 0,
    quantidade_entrada: 0,
    estoque_critico: 5
  });

  const [novoTipoNome, setNovoTipoNome] = useState('');

  const [formEntrada, setFormEntrada] = useState({
    produto_id: '',
    preco_unidade: 0,
    quantidade: 1
  });

  const [formRetorno, setFormRetorno] = useState({
    produto_id: '',
    quantidade: 1,
    motivo: 'Sobra do Bar'
  });

  const [formPerda, setFormPerda] = useState({
    produto_id: '',
    quantidade: 1,
    motivo_perda: 'Validade',
    observacao: ''
  });

  // CARREGAR DADOS
  const carregarDados = async () => {
    setLoading(true);
    setMensagemErro('');
    try {
      const { data: dataTipos, error: errTipos } = await supabase
        .from('tipos_bebida')
        .select('*')
        .order('nome');
      if (errTipos) throw errTipos;
      setTiposBebida(dataTipos || []);

      const { data: dataProds, error: errProds } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');
      if (errProds) throw errProds;
      setProdutos(dataProds || []);

      const { data: dataMovs, error: errMovs } = await supabase
        .from('movimentacoes')
        .select('*, produtos(nome, tipo, distribuidora)')
        .order('created_at', { ascending: false });
      if (errMovs) throw errMovs;
      setMovimentacoes(dataMovs || []);

    } catch (err) {
      console.error('Erro no Supabase:', err);
      setMensagemErro('Erro ao carregar dados do Supabase: ' + (err.message || 'Verifique sua conexão.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // CADASTRAR NOVO PRODUTO COM ENTRADA AUTOMÁTICA
  const handleSalvarNovoProduto = async (e) => {
    e.preventDefault();
    if (!novoProd.nome.trim()) return alert('Informe o nome do produto!');

    try {
      const tipoFinal = novoProd.tipo || (tiposBebida[0]?.nome || 'Cerveja');
      const qtdInicial = Number(novoProd.quantidade_entrada) || 0;
      const precoCusto = Number(novoProd.preco_custo) || 0;
      const precoVenda = Number(novoProd.preco_venda) || 0;

      // 1. Inserir produto
      const { data, error } = await supabase
        .from('produtos')
        .insert([
          {
            nome: novoProd.nome.trim().toUpperCase(),
            distribuidora: novoProd.distribuidora,
            tipo: tipoFinal,
            preco_custo: precoCusto,
            preco_venda: precoVenda,
            quantidade_estoque: qtdInicial,
            estoque_critico: Number(novoProd.estoque_critico) || 5
          }
        ])
        .select();

      if (error) throw error;

      // 2. Registra histórico inicial de entrada se houver quantidade
      if (data && data[0] && qtdInicial > 0) {
        await supabase.from('movimentacoes').insert([
          {
            produto_id: data[0].id,
            tipo_movimentacao: 'ENTRADA',
            quantidade: qtdInicial,
            preco_custo_momento: precoCusto,
            preco_venda_momento: precoVenda,
            observacao: 'Estoque Inicial de Cadastro'
          }
        ]);
      }

      setModalNovoProduto(false);
      setNovoProd({
        nome: '',
        distribuidora: 'AMBEV',
        tipo: tiposBebida[0]?.nome || 'Cerveja',
        preco_custo: 0,
        preco_venda: 0,
        quantidade_entrada: 0,
        estoque_critico: 5
      });

      await carregarDados();
      alert('Produto cadastrado com sucesso!');
    } catch (err) {
      alert('Erro ao cadastrar produto: ' + err.message);
    }
  };

  // SALVAR EDIÇÃO DE PRODUTO (SEM SENHA)
  const handleSalvarEdicaoProduto = async (e) => {
    e.preventDefault();
    try {
      const { id, nome, distribuidora, tipo, preco_custo, preco_venda, quantidade_estoque, estoque_critico } = modalEditarProduto;

      const { error } = await supabase
        .from('produtos')
        .update({
          nome: nome.trim().toUpperCase(),
          distribuidora,
          tipo,
          preco_custo: Number(preco_custo) || 0,
          preco_venda: Number(preco_venda) || 0,
          quantidade_estoque: Number(quantidade_estoque) || 0,
          estoque_critico: Number(estoque_critico) || 0
        })
        .eq('id', id);

      if (error) throw error;
      setModalEditarProduto(null);
      await carregarDados();
    } catch (err) {
      alert('Erro ao atualizar produto: ' + err.message);
    }
  };

  // REGISTRAR ENTRADA
  const handleRegistrarEntrada = async (e) => {
    e.preventDefault();
    if (!formEntrada.produto_id) return alert('Selecione um produto!');

    const prod = produtos.find((p) => p.id.toString() === formEntrada.produto_id.toString());
    if (!prod) return alert('Produto não encontrado!');

    const qtd = Number(formEntrada.quantidade);
    const precoUnit = Number(formEntrada.preco_unidade);
    if (qtd <= 0) return alert('Quantidade deve ser maior que zero!');

    try {
      const novoEstoque = Number(prod.quantidade_estoque) + qtd;

      // 1. Grava movimentação
      const { error: errMov } = await supabase.from('movimentacoes').insert([
        {
          produto_id: prod.id,
          tipo_movimentacao: 'ENTRADA',
          quantidade: qtd,
          preco_custo_momento: precoUnit,
          preco_venda_momento: prod.preco_venda
        }
      ]);
      if (errMov) throw errMov;

      // 2. Atualiza estoque e preço de custo atual
      const { error: errProd } = await supabase
        .from('produtos')
        .update({
          quantidade_estoque: novoEstoque,
          preco_custo: precoUnit
        })
        .eq('id', prod.id);

      if (errProd) throw errProd;

      setModalEntrada(false);
      await carregarDados();
      alert('Entrada registrada com sucesso!');
    } catch (err) {
      alert('Erro ao registrar entrada: ' + err.message);
    }
  };

  // REGISTRAR RETORNO AO ESTOQUE
  const handleRegistrarRetorno = async (e) => {
    e.preventDefault();
    if (!formRetorno.produto_id) return alert('Selecione um produto!');

    const prod = produtos.find((p) => p.id.toString() === formRetorno.produto_id.toString());
    if (!prod) return alert('Produto não encontrado!');

    const qtd = Number(formRetorno.quantidade);
    if (qtd <= 0) return alert('Quantidade deve ser maior que zero!');

    try {
      const novoEstoque = Number(prod.quantidade_estoque) + qtd;

      const { error: errMov } = await supabase.from('movimentacoes').insert([
        {
          produto_id: prod.id,
          tipo_movimentacao: 'RETORNO',
          quantidade: qtd,
          preco_custo_momento: prod.preco_custo,
          preco_venda_momento: prod.preco_venda,
          observacao: formRetorno.motivo
        }
      ]);
      if (errMov) throw errMov;

      const { error: errProd } = await supabase
        .from('produtos')
        .update({ quantidade_estoque: novoEstoque })
        .eq('id', prod.id);

      if (errProd) throw errProd;

      setModalRetorno(false);
      await carregarDados();
      alert('Retorno ao estoque registrado!');
    } catch (err) {
      alert('Erro ao registrar retorno: ' + err.message);
    }
  };

  // REGISTRAR PERDA
  const handleRegistrarPerda = async (e) => {
    e.preventDefault();
    if (!formPerda.produto_id) return alert('Selecione um produto!');

    const prod = produtos.find((p) => p.id.toString() === formPerda.produto_id.toString());
    if (!prod) return alert('Produto não encontrado!');

    const qtd = Number(formPerda.quantidade);
    if (qtd <= 0) return alert('Quantidade deve ser maior que zero!');

    try {
      const novoEstoque = Math.max(0, Number(prod.quantidade_estoque) - qtd);

      const { error: errMov } = await supabase.from('movimentacoes').insert([
        {
          produto_id: prod.id,
          tipo_movimentacao: 'PERDA',
          quantidade: qtd,
          preco_custo_momento: prod.preco_custo,
          preco_venda_momento: prod.preco_venda,
          motivo_perda: formPerda.motivo_perda,
          observacao: formPerda.observacao
        }
      ]);
      if (errMov) throw errMov;

      const { error: errProd } = await supabase
        .from('produtos')
        .update({ quantidade_estoque: novoEstoque })
        .eq('id', prod.id);

      if (errProd) throw errProd;

      setModalPerda(false);
      await carregarDados();
      alert('Perda registrada!');
    } catch (err) {
      alert('Erro ao registrar perda: ' + err.message);
    }
  };

  // CADASTRAR TIPO DE BEBIDA
  const handleSalvarNovoTipo = async (e) => {
    e.preventDefault();
    if (!novoTipoNome.trim()) return;
    try {
      const { error } = await supabase.from('tipos_bebida').insert([{ nome: novoTipoNome.trim() }]);
      if (error) throw error;
      setNovoTipoNome('');
      setModalNovoTipo(false);
      await carregarDados();
    } catch (err) {
      alert('Erro ao criar tipo de bebida: ' + err.message);
    }
  };

  // AUXILIARES DE FILTRO
  const toggleSelecaoMultipla = (item, lista, setLista) => {
    if (lista.includes(item)) {
      setLista(lista.filter((i) => i !== item));
    } else {
      setLista([...lista, item]);
    }
  };

  const limparFiltros = () => {
    setBuscaNome('');
    setProdutosSelecionados([]);
    setTiposSelecionados([]);
    setMotivosPerdaSelecionados([]);
    setDataInicio('');
    setDataFim('');
  };

  // FILTRAGEM DE PRODUTOS
  const produtosFiltrados = produtos.filter((p) => {
    const atendeNome = p.nome.toLowerCase().includes(buscaNome.toLowerCase());
    const atendeProdutos = produtosSelecionados.length === 0 || produtosSelecionados.includes(p.nome);
    const atendeTipo = tiposSelecionados.length === 0 || tiposSelecionados.includes(p.tipo);
    return atendeNome && atendeProdutos && atendeTipo;
  });

  // FILTRAGEM DE HISTÓRICOS
  const movimentacoesFiltradas = movimentacoes.filter((m) => {
    const dataMov = new Date(m.created_at);
    if (dataInicio && dataMov < new Date(dataInicio + 'T00:00:00')) return false;
    if (dataFim && dataMov > new Date(dataFim + 'T23:59:59')) return false;

    if (produtosSelecionados.length > 0 && !produtosSelecionados.includes(m.produtos?.nome)) return false;
    if (tiposSelecionados.length > 0 && !tiposSelecionados.includes(m.produtos?.tipo)) return false;

    if (abaAtiva === 'entradas' && m.tipo_movimentacao !== 'ENTRADA') return false;
    if (abaAtiva === 'retornos' && m.tipo_movimentacao !== 'RETORNO') return false;
    if (abaAtiva === 'perdas') {
      if (m.tipo_movimentacao !== 'PERDA') return false;
      if (motivosPerdaSelecionados.length > 0 && !motivosPerdaSelecionados.includes(m.motivo_perda)) return false;
    }
    return true;
  });

  // MÉTRICAS
  const totalUnidades = produtos.reduce((acc, p) => acc + (p.quantidade_estoque || 0), 0);
  const valorEstoqueCusto = produtos.reduce((acc, p) => acc + (p.quantidade_estoque || 0) * (p.preco_custo || 0), 0);
  const alertasEstoqueBaixo = produtos.filter((p) => p.quantidade_estoque <= p.estoque_critico).length;
  const totalPerdasQtd = movimentacoes
    .filter((m) => m.tipo_movimentacao === 'PERDA')
    .reduce((acc, m) => acc + m.quantidade, 0);

  const totalFiltrosAtivos =
    produtosSelecionados.length + tiposSelecionados.length + motivosPerdaSelecionados.length + (dataInicio ? 1 : 0) + (dataFim ? 1 : 0);

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
            onClick={() => {
              setNovoProd({
                nome: '',
                distribuidora: 'AMBEV',
                tipo: tiposBebida[0]?.nome || 'Cerveja',
                preco_custo: 0,
                preco_venda: 0,
                quantidade_entrada: 0,
                estoque_critico: 5
              });
              setModalNovoProduto(true);
            }}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
          >
            + Novo Produto
          </button>

          <button
            onClick={() => {
              if (produtos.length === 0) return alert('Cadastre ao menos um produto!');
              const p1 = produtos[0];
              setFormEntrada({ produto_id: p1.id, preco_unidade: p1.preco_custo || 0, quantidade: 1 });
              setModalEntrada(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
          >
            ↙ Registrar Entrada
          </button>

          <button
            onClick={() => {
              if (produtos.length === 0) return alert('Cadastre ao menos um produto!');
              setFormRetorno({ produto_id: produtos[0].id, quantidade: 1, motivo: 'Sobra do Bar' });
              setModalRetorno(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
          >
            ↩ Retorno ao Estoque
          </button>

          <button
            onClick={() => {
              if (produtos.length === 0) return alert('Cadastre ao menos um produto!');
              setFormPerda({ produto_id: produtos[0].id, quantidade: 1, motivo_perda: 'Validade', observacao: '' });
              setModalPerda(true);
            }}
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

      {/* Barra de Filtros e Busca Limpa */}
      <div className="bg-[#111726] border border-slate-800/80 p-3 rounded-xl mb-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="🔍 Buscar produto por nome..."
            value={buscaNome}
            onChange={(e) => setBuscaNome(e.target.value)}
            className="w-full bg-[#0a0e17] border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {totalFiltrosAtivos > 0 && (
            <button
              onClick={limparFiltros}
              className="text-slate-400 hover:text-rose-400 px-3 py-2 text-xs transition"
            >
              Limpar Filtros
            </button>
          )}

          <button
            onClick={() => setModalFiltros(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
          >
            <span>⚙ Filtros de Seleção</span>
            {totalFiltrosAtivos > 0 && (
              <span className="bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                {totalFiltrosAtivos}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TABELA PRINCIPAL DE ESTOQUE (Clique na linha para editar) */}
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
                <th className="p-3">Qtd em Estoque</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    Nenhum produto cadastrado ou encontrado nos filtros.
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map((p) => {
                  const isCritico = p.quantidade_estoque <= p.estoque_critico;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setModalEditarProduto({ ...p })}
                      className="hover:bg-slate-800/50 cursor-pointer transition"
                      title="Clique para editar este produto"
                    >
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 p-3 italic">💡 Clique em qualquer linha para editar o produto ou atualizar a quantidade.</p>
        </div>
      )}

      {/* TABELAS DE HISTÓRICOS */}
      {abaAtiva !== 'estoque' && (
        <div className="bg-[#111726] border border-slate-800/80 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0a0e17] text-slate-400 border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Produto</th>
                <th className="p-3">Tipo Bebida</th>
                <th className="p-3">Quantidade</th>
                <th className="p-3">Preço Unidade</th>
                {abaAtiva === 'perdas' && <th className="p-3">Motivo da Perda</th>}
                <th className="p-3">Observação / Detalhe</th>
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
                    <td className="p-3">R$ {Number(m.preco_custo_momento).toFixed(2)}</td>
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

      {/* POP-UP MODAL DE FILTROS */}
      {modalFiltros && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-lg space-y-4">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2">Filtros de Seleção</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Filtro Tipos */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Tipos de Bebida:</label>
                <div className="max-h-36 overflow-y-auto bg-[#0a0e17] border border-slate-700 rounded-lg p-2 space-y-1">
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

              {/* Filtro Produtos */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Produtos:</label>
                <div className="max-h-36 overflow-y-auto bg-[#0a0e17] border border-slate-700 rounded-lg p-2 space-y-1">
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

              {/* Filtro Motivos Perda (se aba de perdas) */}
              {abaAtiva === 'perdas' && (
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">Motivos de Perda:</label>
                  <div className="flex flex-wrap gap-2">
                    {['Validade', 'Má conservação', 'Acidental', 'Erro de pedido', 'Outro'].map((m) => (
                      <label key={m} className="flex items-center gap-1.5 bg-[#0a0e17] border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={motivosPerdaSelecionados.includes(m)}
                          onChange={() => toggleSelecaoMultipla(m, motivosPerdaSelecionados, setMotivosPerdaSelecionados)}
                          className="accent-rose-500"
                        />
                        <span>{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Filtro Datas */}
              <div className="col-span-2 border-t border-slate-800 pt-3">
                <label className="block text-slate-400 mb-1 font-semibold">Período por Data:</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
                  />
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setModalFiltros(false)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-500"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRAR NOVO PRODUTO */}
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
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Distribuidora:</label>
                  <select
                    value={novoProd.distribuidora}
                    onChange={(e) => setNovoProd({ ...novoProd, distribuidora: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    {DISTRIBUIDORAS_PADRAO.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tipo do Produto:</label>
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
                    onChange={(e) => setNovoProd({ ...novoProd, preco_custo: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preço Venda (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoProd.preco_venda}
                    onChange={(e) => setNovoProd({ ...novoProd, preco_venda: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-amber-400 mb-1 font-semibold">Quantidade Entrada:</label>
                  <input
                    type="number"
                    min="0"
                    value={novoProd.quantidade_entrada}
                    onChange={(e) => setNovoProd({ ...novoProd, quantidade_entrada: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-amber-500/50 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Estoque Crítico:</label>
                  <input
                    type="number"
                    value={novoProd.estoque_critico}
                    onChange={(e) => setNovoProd({ ...novoProd, estoque_critico: e.target.value })}
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
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-500"
                >
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR ENTRADA (SIMPLIFICADO) */}
      {modalEntrada && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-base font-bold text-white mb-3">Registrar Entrada no Estoque</h3>
            <form onSubmit={handleRegistrarEntrada} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Produto:</label>
                <select
                  value={formEntrada.produto_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const p = produtos.find((item) => item.id.toString() === id);
                    setFormEntrada({
                      ...formEntrada,
                      produto_id: id,
                      preco_unidade: p ? p.preco_custo : 0
                    });
                  }}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200"
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
                <label className="block text-slate-400 mb-1 font-semibold">Preço Unidade (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  value={formEntrada.preco_unidade}
                  onChange={(e) => setFormEntrada({ ...formEntrada, preco_unidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-emerald-400 mb-1 font-semibold">Quantidade Total (Entrada):</label>
                <input
                  type="number"
                  min="1"
                  value={formEntrada.quantidade}
                  onChange={(e) => setFormEntrada({ ...formEntrada, quantidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-emerald-500/50 rounded-lg p-2.5 text-white font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalEntrada(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500"
                >
                  Confirmar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RETORNO AO ESTOQUE */}
      {modalRetorno && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-base font-bold text-white mb-3">Retorno ao Estoque</h3>
            <form onSubmit={handleRegistrarRetorno} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Lista de Produtos:</label>
                <select
                  value={formRetorno.produto_id}
                  onChange={(e) => setFormRetorno({ ...formRetorno, produto_id: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200"
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
                <label className="block text-indigo-400 mb-1 font-semibold">Quantidade que está retornando:</label>
                <input
                  type="number"
                  min="1"
                  value={formRetorno.quantidade}
                  onChange={(e) => setFormRetorno({ ...formRetorno, quantidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-indigo-500/50 rounded-lg p-2.5 text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Motivo do Retorno:</label>
                <input
                  type="text"
                  placeholder="Ex: Sobra do Bar, Evento Encerrado..."
                  value={formRetorno.motivo}
                  onChange={(e) => setFormRetorno({ ...formRetorno, motivo: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalRetorno(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500"
                >
                  Confirmar Retorno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PRODUTO (DIRETO AO CLICAR NA LINHA) */}
      {modalEditarProduto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Editar Produto & Quantidade</h3>
            <form onSubmit={handleSalvarEdicaoProduto} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Nome do Produto:</label>
                <input
                  type="text"
                  value={modalEditarProduto.nome}
                  onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, nome: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Distribuidora:</label>
                  <select
                    value={modalEditarProduto.distribuidora}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, distribuidora: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    {DISTRIBUIDORAS_PADRAO.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
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
                  <label className="block text-amber-400 mb-1 font-semibold">Quantidade Atual:</label>
                  <input
                    type="number"
                    value={modalEditarProduto.quantidade_estoque}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, quantidade_estoque: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-amber-500/50 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Estoque Crítico:</label>
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
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-500"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PERDA */}
      {modalPerda && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-base font-bold text-white mb-3">Registrar Perda / Descarte</h3>
            <form onSubmit={handleRegistrarPerda} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Produto:</label>
                <select
                  value={formPerda.produto_id}
                  onChange={(e) => setFormPerda({ ...formPerda, produto_id: e.target.value })}
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
                <label className="block text-rose-400 mb-1 font-semibold">Quantidade Perda:</label>
                <input
                  type="number"
                  min="1"
                  value={formPerda.quantidade}
                  onChange={(e) => setFormPerda({ ...formPerda, quantidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-rose-500/50 rounded-lg p-2 text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Motivo da Perda:</label>
                <select
                  value={formPerda.motivo_perda}
                  onChange={(e) => setFormPerda({ ...formPerda, motivo_perda: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  <option value="Validade">Validade</option>
                  <option value="Má conservação">Má conservação</option>
                  <option value="Acidental">Acidental</option>
                  <option value="Erro de pedido">Erro de pedido</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Observação:</label>
                <input
                  type="text"
                  placeholder="Ex: Quebrada no manuseio..."
                  value={formPerda.observacao}
                  onChange={(e) => setFormPerda({ ...formPerda, observacao: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalPerda(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-700 text-white rounded-lg font-semibold hover:bg-rose-600"
                >
                  Confirmar Perda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TIPO DE BEBIDA */}
      {modalNovoTipo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-sm">
            <h3 className="text-base font-bold text-white mb-3">Cadastrar Novo Tipo de Bebida</h3>
            <form onSubmit={handleSalvarNovoTipo} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome do Segmento / Tipo:</label>
                <input
                  type="text"
                  placeholder="Ex: Cachaça, Gin..."
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
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-500"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}