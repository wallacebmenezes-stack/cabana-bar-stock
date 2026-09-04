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

// Converter vírgula (1,23) para ponto (1.23) e evitar valores NaN/0 zerados
const parseNumero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 0;
  const str = valor.toString().replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export default function GestaoEstoqueBar() {
  const [produtos, setProdutos] = useState([]);
  const [tiposBebida, setTiposBebida] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensagemErro, setMensagemErro] = useState('');

  const [abaAtiva, setAbaAtiva] = useState('bar'); // Padrão iniciando no PDV / Bar

  // Estado do Carrinho / Comanda do Bar
  const [carrinhoBar, setCarrinhoBar] = useState([]);
  const [filtroTipoBar, setFiltroTipoBar] = useState('TODOS');
  const [buscaBar, setBuscaBar] = useState('');

  // Filtros Globais
  const [buscaNome, setBuscaNome] = useState('');
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [tiposSelecionados, setTiposSelecionados] = useState([]);
  const [motivosPerdaSelecionados, setMotivosPerdaSelecionados] = useState([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Modais
  const [modalFiltros, setModalFiltros] = useState(false);
  const [modalNovoProduto, setModalNovoProduto] = useState(false);
  const [modalNovoTipo, setModalNovoTipo] = useState(false);
  const [modalEditarProduto, setModalEditarProduto] = useState(null);
  
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [modalRetorno, setModalRetorno] = useState(false);
  const [modalPerda, setModalPerda] = useState(false);

  const [novoProd, setNovoProd] = useState({
    nome: '',
    distribuidora: 'AMBEV',
    tipo: '',
    preco_custo: '',
    preco_venda: '',
    quantidade_entrada: '',
    estoque_critico: 5
  });

  const [novoTipoNome, setNovoTipoNome] = useState('');

  const [formEntrada, setFormEntrada] = useState({
    produto_id: '',
    preco_unidade: '',
    quantidade: 1
  });

  const [formSaida, setFormSaida] = useState({
    produto_id: '',
    preco_venda: '',
    quantidade: 1,
    observacao: 'Venda / Consumo'
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

  // LÓGICA DO BAR / COMANDA (CARRINHO)
  const adicionarAoCarrinho = (prod) => {
    const estoqueAtual = parseNumero(prod.quantidade_estoque);
    const itemExistente = carrinhoBar.find((i) => i.produto.id === prod.id);
    const qtdNoCarrinho = itemExistente ? itemExistente.quantidade : 0;

    if (qtdNoCarrinho + 1 > estoqueAtual) {
      return alert(`Estoque insuficiente! Apenas ${estoqueAtual} und em estoque.`);
    }

    if (itemExistente) {
      setCarrinhoBar(
        carrinhoBar.map((i) =>
          i.produto.id === prod.id ? { ...i, quantidade: i.quantidade + 1 } : i
        )
      );
    } else {
      setCarrinhoBar([...carrinhoBar, { produto: prod, quantidade: 1 }]);
    }
  };

  const alterarQtdCarrinho = (prodId, delta) => {
    const item = carrinhoBar.find((i) => i.produto.id === prodId);
    if (!item) return;

    const novaQtd = item.quantidade + delta;
    const estoqueAtual = parseNumero(item.produto.quantidade_estoque);

    if (novaQtd > estoqueAtual) {
      return alert(`Estoque insuficiente! Apenas ${estoqueAtual} und disponíveis.`);
    }

    if (novaQtd <= 0) {
      setCarrinhoBar(carrinhoBar.filter((i) => i.produto.id !== prodId));
    } else {
      setCarrinhoBar(
        carrinhoBar.map((i) =>
          i.produto.id === prodId ? { ...i, quantidade: novaQtd } : i
        )
      );
    }
  };

  const finalizarVendaBar = async () => {
    if (carrinhoBar.length === 0) return alert('A comanda do cliente está vazia!');

    // Re-validar estoques
    for (const item of carrinhoBar) {
      const prodNoBanco = produtos.find((p) => p.id === item.produto.id);
      if (!prodNoBanco || parseNumero(prodNoBanco.quantidade_estoque) < item.quantidade) {
        return alert(`Estoque insuficiente para o produto: ${item.produto.nome}`);
      }
    }

    try {
      setLoading(true);

      for (const item of carrinhoBar) {
        const prod = item.produto;
        const qtd = item.quantidade;
        const novoEstoque = parseNumero(prod.quantidade_estoque) - qtd;
        const precoVenda = parseNumero(prod.preco_venda);

        // 1. Registra Saída na tabela de movimentações
        const { error: errMov } = await supabase.from('movimentacoes').insert([
          {
            produto_id: prod.id,
            tipo_movimentacao: 'SAIDA',
            quantidade: qtd,
            observacao: `Venda Bar / Cliente (Preço Venda: R$ ${precoVenda})`
          }
        ]);
        if (errMov) throw errMov;

        // 2. Deduz do Estoque Principal
        const { error: errProd } = await supabase
          .from('produtos')
          .update({ quantidade_estoque: novoEstoque })
          .eq('id', prod.id);

        if (errProd) throw errProd;
      }

      setCarrinhoBar([]);
      await carregarDados();
      alert('Saída para o cliente registrada com sucesso!');
    } catch (err) {
      alert('Erro ao registrar saída do bar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // CADASTRAR NOVO PRODUTO
  const handleSalvarNovoProduto = async (e) => {
    e.preventDefault();
    if (!novoProd.nome.trim()) return alert('Informe o nome do produto!');

    try {
      const tipoFinal = novoProd.tipo || (tiposBebida[0]?.nome || 'Cerveja');
      const qtdInicial = parseNumero(novoProd.quantidade_entrada);
      const precoCusto = parseNumero(novoProd.preco_custo);
      const precoVenda = parseNumero(novoProd.preco_venda);
      const estoqueCritico = parseNumero(novoProd.estoque_critico) || 5;

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
            estoque_critico: estoqueCritico
          }
        ])
        .select();

      if (error) throw error;

      if (data && data[0] && qtdInicial > 0) {
        await supabase.from('movimentacoes').insert([
          {
            produto_id: data[0].id,
            tipo_movimentacao: 'ENTRADA',
            quantidade: qtdInicial,
            observacao: 'Estoque Inicial de Cadastro'
          }
        ]);
      }

      setModalNovoProduto(false);
      setNovoProd({
        nome: '',
        distribuidora: 'AMBEV',
        tipo: tiposBebida[0]?.nome || 'Cerveja',
        preco_custo: '',
        preco_venda: '',
        quantidade_entrada: '',
        estoque_critico: 5
      });

      await carregarDados();
      alert('Produto cadastrado com sucesso!');
    } catch (err) {
      alert('Erro ao cadastrar produto: ' + err.message);
    }
  };

  // SALVAR EDIÇÃO DE PRODUTO
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
          preco_custo: parseNumero(preco_custo),
          preco_venda: parseNumero(preco_venda),
          quantidade_estoque: parseNumero(quantidade_estoque),
          estoque_critico: parseNumero(estoque_critico)
        })
        .eq('id', id);

      if (error) throw error;
      
      setModalEditarProduto(null);
      await carregarDados();
      alert('Produto atualizado com sucesso!');
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

    const qtd = parseNumero(formEntrada.quantidade);
    const precoUnit = parseNumero(formEntrada.preco_unidade);
    if (qtd <= 0) return alert('Quantidade deve ser maior que zero!');

    try {
      const novoEstoque = parseNumero(prod.quantidade_estoque) + qtd;

      const { error: errMov } = await supabase.from('movimentacoes').insert([
        {
          produto_id: prod.id,
          tipo_movimentacao: 'ENTRADA',
          quantidade: qtd,
          observacao: `Entrada - Custo R$ ${precoUnit}`
        }
      ]);
      if (errMov) throw errMov;

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

  // REGISTRAR SAÍDA
  const handleRegistrarSaida = async (e) => {
    e.preventDefault();
    if (!formSaida.produto_id) return alert('Selecione um produto!');

    const prod = produtos.find((p) => p.id.toString() === formSaida.produto_id.toString());
    if (!prod) return alert('Produto não encontrado!');

    const qtd = parseNumero(formSaida.quantidade);
    const precoVendaAtualizado = parseNumero(formSaida.preco_venda);
    if (qtd <= 0) return alert('Quantidade deve ser maior que zero!');

    if (parseNumero(prod.quantidade_estoque) < qtd) {
      return alert('Estoque insuficiente para registrar esta saída!');
    }

    try {
      const novoEstoque = parseNumero(prod.quantidade_estoque) - qtd;

      const { error: errMov } = await supabase.from('movimentacoes').insert([
        {
          produto_id: prod.id,
          tipo_movimentacao: 'SAIDA',
          quantidade: qtd,
          observacao: `${formSaida.observacao} (Preço Venda: R$ ${precoVendaAtualizado || prod.preco_venda})`
        }
      ]);
      if (errMov) throw errMov;

      const { error: errProd } = await supabase
        .from('produtos')
        .update({ 
          quantidade_estoque: novoEstoque,
          preco_venda: precoVendaAtualizado || prod.preco_venda 
        })
        .eq('id', prod.id);

      if (errProd) throw errProd;

      setModalSaida(false);
      await carregarDados();
      alert('Saída registrada com sucesso!');
    } catch (err) {
      alert('Erro ao registrar saída: ' + err.message);
    }
  };

  // REGISTRAR RETORNO AO ESTOQUE
  const handleRegistrarRetorno = async (e) => {
    e.preventDefault();
    if (!formRetorno.produto_id) return alert('Selecione um produto!');

    const prod = produtos.find((p) => p.id.toString() === formRetorno.produto_id.toString());
    if (!prod) return alert('Produto não encontrado!');

    const qtd = parseNumero(formRetorno.quantidade);
    if (qtd <= 0) return alert('Quantidade deve ser maior que zero!');

    try {
      const novoEstoque = parseNumero(prod.quantidade_estoque) + qtd;

      const { error: errMov } = await supabase.from('movimentacoes').insert([
        {
          produto_id: prod.id,
          tipo_movimentacao: 'ENTRADA',
          quantidade: qtd,
          observacao: `Retorno ao Estoque: ${formRetorno.motivo}`
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

    const qtd = parseNumero(formPerda.quantidade);
    if (qtd <= 0) return alert('Quantidade deve ser maior que zero!');

    try {
      const novoEstoque = Math.max(0, parseNumero(prod.quantidade_estoque) - qtd);

      const { error: errMov } = await supabase.from('movimentacoes').insert([
        {
          produto_id: prod.id,
          tipo_movimentacao: 'PERDA',
          quantidade: qtd,
          observacao: `Perda (${formPerda.motivo_perda}): ${formPerda.observacao || '-'}`
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

  // EXCLUIR / CANCELAR MOVIMENTAÇÃO (Revertendo estoque)
  const handleExcluirMovimentacao = async (mov) => {
    if (!confirm('Deseja realmente cancelar/excluir esta movimentação? O estoque do produto será revertido.')) return;

    try {
      const prod = produtos.find((p) => p.id.toString() === mov.produto_id.toString());
      if (!prod) throw new Error('Produto associado não encontrado ou removido!');

      let novoEstoque = parseNumero(prod.quantidade_estoque);
      const qtdMov = parseNumero(mov.quantidade);

      if (mov.tipo_movimentacao === 'ENTRADA') {
        novoEstoque -= qtdMov;
      } else if (mov.tipo_movimentacao === 'SAIDA' || mov.tipo_movimentacao === 'PERDA') {
        novoEstoque += qtdMov;
      }

      const { error: errProd } = await supabase
        .from('produtos')
        .update({ quantidade_estoque: Math.max(0, novoEstoque) })
        .eq('id', prod.id);
      if (errProd) throw errProd;

      const { error: errMov } = await supabase
        .from('movimentacoes')
        .delete()
        .eq('id', mov.id);
      if (errMov) throw errMov;

      await carregarDados();
      alert('Movimentação cancelada e estoque revertido com sucesso!');
    } catch (err) {
      alert('Erro ao cancelar movimentação: ' + err.message);
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

  const produtosFiltrados = produtos.filter((p) => {
    const atendeNome = p.nome.toLowerCase().includes(buscaNome.toLowerCase());
    const atendeProdutos = produtosSelecionados.length === 0 || produtosSelecionados.includes(p.nome);
    const atendeTipo = tiposSelecionados.length === 0 || tiposSelecionados.includes(p.tipo);
    return atendeNome && atendeProdutos && atendeTipo;
  });

  const produtosBarFiltrados = produtos.filter((p) => {
    const atendeTipo = filtroTipoBar === 'TODOS' || p.tipo === filtroTipoBar;
    const atendeBusca = p.nome.toLowerCase().includes(buscaBar.toLowerCase());
    return atendeTipo && atendeBusca;
  });

  const movimentacoesFiltradas = movimentacoes.filter((m) => {
    const dataMov = new Date(m.created_at);
    if (dataInicio && dataMov < new Date(dataInicio + 'T00:00:00')) return false;
    if (dataFim && dataMov > new Date(dataFim + 'T23:59:59')) return false;

    if (produtosSelecionados.length > 0 && !produtosSelecionados.includes(m.produtos?.nome)) return false;
    if (tiposSelecionados.length > 0 && !tiposSelecionados.includes(m.produtos?.tipo)) return false;

    if (abaAtiva === 'entradas' && m.tipo_movimentacao !== 'ENTRADA') return false;
    if (abaAtiva === 'saidas' && m.tipo_movimentacao !== 'SAIDA') return false;
    if (abaAtiva === 'retornos' && !(m.tipo_movimentacao === 'ENTRADA' && m.observacao?.includes('Retorno'))) return false;
    if (abaAtiva === 'perdas' && m.tipo_movimentacao !== 'PERDA') return false;
    return true;
  });

  const totalUnidades = produtos.reduce((acc, p) => acc + parseNumero(p.quantidade_estoque), 0);
  const valorEstoqueCusto = produtos.reduce((acc, p) => acc + parseNumero(p.quantidade_estoque) * parseNumero(p.preco_custo), 0);
  const alertasEstoqueBaixo = produtos.filter((p) => parseNumero(p.quantidade_estoque) <= parseNumero(p.estoque_critico)).length;
  
  const totalPerdasReais = movimentacoes
    .filter((m) => m.tipo_movimentacao === 'PERDA')
    .reduce((acc, m) => {
      const prod = produtos.find((p) => p.id.toString() === m.produto_id.toString());
      const precoCusto = prod ? parseNumero(prod.preco_custo) : 0;
      return acc + (parseNumero(m.quantidade) * precoCusto);
    }, 0);

  const totalCarrinhoBar = carrinhoBar.reduce((acc, item) => {
    return acc + (item.quantidade * parseNumero(item.produto.preco_venda));
  }, 0);

  const totalFiltrosAtivos =
    produtosSelecionados.length + tiposSelecionados.length + motivosPerdaSelecionados.length + (dataInicio ? 1 : 0) + (dataFim ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 p-4 md:p-8 font-sans">
      
      {/* HEADER DE TÍTULO E BOTÕES DE MOVIMENTAÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-500 font-semibold">Cabana do Sol • Gestão de Bar</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Controle de Estoque & Bebidas</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (produtos.length === 0) return alert('Cadastre ao menos um produto!');
              const p1 = produtos[0];
              setFormEntrada({ produto_id: p1.id, preco_unidade: p1.preco_custo || 0, quantidade: 1 });
              setModalEntrada(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-lg font-semibold transition"
          >
            ↙ Entrada
          </button>

          <button
            onClick={() => {
              if (produtos.length === 0) return alert('Cadastre ao menos um produto!');
              const p1 = produtos[0];
              setFormSaida({ produto_id: p1.id, preco_venda: p1.preco_venda || 0, quantidade: 1, observacao: 'Venda / Consumo' });
              setModalSaida(true);
            }}
            className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3.5 py-2 rounded-lg font-semibold transition"
          >
            ↗ Saída
          </button>

          <button
            onClick={() => {
              if (produtos.length === 0) return alert('Cadastre ao menos um produto!');
              setFormRetorno({ produto_id: produtos[0].id, quantidade: 1, motivo: 'Sobra do Bar' });
              setModalRetorno(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 rounded-lg font-semibold transition"
          >
            ↩ Retorno
          </button>

          <button
            onClick={() => {
              if (produtos.length === 0) return alert('Cadastre ao menos um produto!');
              setFormPerda({ produto_id: produtos[0].id, quantidade: 1, motivo_perda: 'Validade', observacao: '' });
              setModalPerda(true);
            }}
            className="bg-rose-700 hover:bg-rose-600 text-white text-xs px-3.5 py-2 rounded-lg font-semibold transition"
          >
            ⚠ Perda
          </button>
        </div>
      </div>

      {mensagemErro && (
        <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs p-3 rounded-xl mb-6">
          {mensagemErro}
        </div>
      )}

      {/* CARDS DE RESUMO DA DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl">
          <p className="text-xs text-slate-400 font-medium">TOTAL DE UNIDADES</p>
          <p className="text-2xl font-bold text-white mt-1">{totalUnidades} <span className="text-xs text-slate-500 font-normal">und</span></p>
        </div>
        <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl">
          <p className="text-xs text-slate-400 font-medium">VALOR EM ESTOQUE (CUSTO)</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            R$ {valorEstoqueCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl">
          <p className="text-xs text-slate-400 font-medium">ALERTAS DE ESTOQUE BAIXO</p>
          <p className={`text-2xl font-bold mt-1 ${alertasEstoqueBaixo > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {alertasEstoqueBaixo} <span className="text-xs font-normal">itens críticos</span>
          </p>
        </div>
        <div className="bg-[#111726] border border-slate-800/80 p-4 rounded-xl">
          <p className="text-xs text-slate-400 font-medium">TOTAL DE PERDAS (CUSTO)</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">
            {totalPerdasReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex border-b border-slate-800 mb-6 space-x-2 overflow-x-auto pb-1">
        {[
          { id: 'bar', label: '🍸 PDV / Atendimento Bar' },
          { id: 'estoque', label: 'Estoque Principal' },
          { id: 'entradas', label: 'Histórico de Entradas' },
          { id: 'saidas', label: 'Histórico de Saídas' },
          { id: 'retornos', label: 'Retornos ao Estoque' },
          { id: 'perdas', label: 'Perdas & Descartes' },
        ].map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition whitespace-nowrap ${
              abaAtiva === aba.id
                ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* 1. ABA DE ATENDIMENTO DO BAR (PDV DE SAÍDA RÁPIDA) */}
      {abaAtiva === 'bar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PAINEL DE SELEÇÃO DE PRODUTOS */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* BUSCA E FILTROS RÁPIDOS POR TIPO */}
            <div className="bg-[#111726] border border-slate-800 p-4 rounded-xl space-y-3">
              <input
                type="text"
                placeholder="🔍 Buscar bebida no bar..."
                value={buscaBar}
                onChange={(e) => setBuscaBar(e.target.value)}
                className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setFiltroTipoBar('TODOS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    filtroTipoBar === 'TODOS'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Todos
                </button>
                {tiposBebida.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFiltroTipoBar(t.nome)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                      filtroTipoBar === t.nome
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {t.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* GRID DE CARDS DE BEBIDAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {produtosBarFiltrados.length === 0 ? (
                <div className="col-span-full bg-[#111726] border border-slate-800 p-8 rounded-xl text-center text-slate-500 text-xs">
                  Nenhuma bebida encontrada para este filtro.
                </div>
              ) : (
                produtosBarFiltrados.map((p) => {
                  const qtdEstoque = parseNumero(p.quantidade_estoque);
                  const isEsgotado = qtdEstoque <= 0;
                  const isCritico = qtdEstoque <= parseNumero(p.estoque_critico);

                  return (
                    <div
                      key={p.id}
                      className={`bg-[#111726] border rounded-xl p-3.5 flex flex-col justify-between transition ${
                        isEsgotado
                          ? 'border-slate-800/40 opacity-50'
                          : 'border-slate-800 hover:border-amber-500/50'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{p.tipo}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              isEsgotado
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : isCritico
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {qtdEstoque} und
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1 leading-snug">{p.nome}</h4>
                        <p className="text-xs font-semibold text-emerald-400 mt-2">
                          R$ {parseNumero(p.preco_venda).toFixed(2)}
                        </p>
                      </div>

                      <button
                        onClick={() => adicionarAoCarrinho(p)}
                        disabled={isEsgotado}
                        className={`mt-4 w-full py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isEsgotado
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        }`}
                      >
                        <span>+ Adicionar ao Cliente</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PAINEL DA COMANDA / CARRINHO DO CLIENTE */}
          <div className="bg-[#111726] border border-slate-800 p-5 rounded-xl flex flex-col justify-between h-fit sticky top-6">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🍸 Comanda / Saída Atual</span>
                </h3>
                {carrinhoBar.length > 0 && (
                  <button
                    onClick={() => setCarrinhoBar([])}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {carrinhoBar.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <p className="text-2xl mb-2">🍹</p>
                  Clique nos produtos ao lado para registrar a saída para o cliente.
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {carrinhoBar.map((item) => (
                    <div
                      key={item.produto.id}
                      className="bg-[#0a0e17] border border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="max-w-[140px]">
                        <p className="font-semibold text-white truncate">{item.produto.nome}</p>
                        <p className="text-slate-400 text-[11px]">
                          R$ {parseNumero(item.produto.preco_venda).toFixed(2)} un
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-700 rounded-lg bg-[#111726]">
                          <button
                            onClick={() => alterarQtdCarrinho(item.produto.id, -1)}
                            className="px-2 py-0.5 text-slate-300 hover:text-white font-bold"
                          >
                            -
                          </button>
                          <span className="px-2 font-bold text-amber-400 text-xs">{item.quantidade}</span>
                          <button
                            onClick={() => alterarQtdCarrinho(item.produto.id, 1)}
                            className="px-2 py-0.5 text-slate-300 hover:text-white font-bold"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-bold text-white min-w-[55px] text-right">
                          R$ {(item.quantidade * parseNumero(item.produto.preco_venda)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {carrinhoBar.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-4">
                <div className="flex justify-between items-center text-sm font-bold text-white">
                  <span>TOTAL SAÍDA:</span>
                  <span className="text-emerald-400 text-lg">
                    R$ {totalCarrinhoBar.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={finalizarVendaBar}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-emerald-950/50"
                >
                  🚀 Confirmar Saída para Cliente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. DEMAIS ABAS (ESTOQUE PRINCIPAL E HISTÓRICOS) */}
      {abaAtiva !== 'bar' && (
        <>
          {/* BARRA DE PESQUISA, FILTROS E NOVOS CADASTROS */}
          <div className="bg-[#111726] border border-slate-800/80 p-3 rounded-xl mb-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="w-full md:w-80 flex gap-2">
              <input
                type="text"
                placeholder="🔍 Buscar produto por nome..."
                value={buscaNome}
                onChange={(e) => setBuscaNome(e.target.value)}
                className="w-full bg-[#0a0e17] border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
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
                    tipo: tiposBebida[0]?.nome || '',
                    preco_custo: '',
                    preco_venda: '',
                    quantidade_entrada: '',
                    estoque_critico: 5
                  });
                  setModalNovoProduto(true);
                }}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
              >
                + Novo Produto
              </button>

              <div className="w-px h-6 bg-slate-700 mx-1 hidden md:block"></div>

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

          {/* TABELA DE ESTOQUE PRINCIPAL */}
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
                      const isCritico = parseNumero(p.quantidade_estoque) <= parseNumero(p.estoque_critico);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setModalEditarProduto({ ...p })}
                          className="hover:bg-slate-800/50 cursor-pointer transition"
                          title="Clique para editar este produto"
                        >
                          <td className="p-3 font-semibold text-white">{p.nome}</td>
                          <td className="p-3 text-amber-500 font-medium">{p.distribuidora}</td>
                          <td className="p-3 text-slate-400">{p.tipo || '-'}</td>
                          <td className="p-3">R$ {parseNumero(p.preco_custo).toFixed(2)}</td>
                          <td className="p-3">R$ {parseNumero(p.preco_venda).toFixed(2)}</td>
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
                    <th className="p-3">Detalhes / Observação</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {movimentacoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        Nenhum registro encontrado para este filtro de datas ou produtos.
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
                        <td className="p-3 text-slate-400">{m.observacao || '-'}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleExcluirMovimentacao(m)}
                            className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 px-2.5 py-1 rounded-md text-[11px] font-medium transition"
                            title="Cancelar / Excluir movimentação e reverter estoque"
                          >
                            🗑 Cancelar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* MODAL FILTROS (DIÁRIO / PERÍODO) */}
      {modalFiltros && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-lg space-y-4">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2">Filtros de Seleção (Diário / Histórico)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="col-span-2 border-b border-slate-800 pb-3">
                <label className="block text-amber-400 mb-1 font-semibold">🔍 Filtrar por Período de Data:</label>
                <div className="flex gap-2">
                  <div className="w-full">
                    <span className="text-slate-500 block mb-1">Data Início:</span>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
                    />
                  </div>
                  <div className="w-full">
                    <span className="text-slate-500 block mb-1">Data Fim:</span>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200"
                    />
                  </div>
                </div>
              </div>

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
                    value={novoProd.distribuidora || ''}
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
                    value={novoProd.tipo || ''}
                    onChange={(e) => setNovoProd({ ...novoProd, tipo: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="" disabled>Selecione um tipo...</option>
                    {tiposBebida.map((t, index) => (
                      <option key={t.id || index} value={t.nome}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Preço Custo (R$):</label>
                  <input
                    type="text"
                    value={novoProd.preco_custo || ''}
                    onChange={(e) => setNovoProd({ ...novoProd, preco_custo: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preço Venda (R$):</label>
                  <input
                    type="text"
                    value={novoProd.preco_venda || ''}
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
                    value={novoProd.quantidade_entrada || ''}
                    onChange={(e) => setNovoProd({ ...novoProd, quantidade_entrada: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-amber-500/50 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Estoque Crítico:</label>
                  <input
                    type="number"
                    value={novoProd.estoque_critico || ''}
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

      {/* MODAL EDITAR PRODUTO */}
      {modalEditarProduto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Editar Produto & Quantidade</h3>
            <form onSubmit={handleSalvarEdicaoProduto} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Nome do Produto:</label>
                <input
                  type="text"
                  value={modalEditarProduto.nome || ''}
                  onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, nome: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Distribuidora:</label>
                  <select
                    value={modalEditarProduto.distribuidora || ''}
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
                    value={modalEditarProduto.tipo || ''}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, tipo: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  >
                    <option value="" disabled>Selecione um tipo...</option>
                    {tiposBebida.map((t, index) => (
                      <option key={t.id || index} value={t.nome}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Preço Custo (R$):</label>
                  <input
                    type="text"
                    value={modalEditarProduto.preco_custo || ''}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, preco_custo: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preço Venda (R$):</label>
                  <input
                    type="text"
                    value={modalEditarProduto.preco_venda || ''}
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
                    value={modalEditarProduto.quantidade_estoque ?? ''}
                    onChange={(e) => setModalEditarProduto({ ...modalEditarProduto, quantidade_estoque: e.target.value })}
                    className="w-full bg-[#0a0e17] border border-amber-500/50 rounded-lg p-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Estoque Crítico:</label>
                  <input
                    type="number"
                    value={modalEditarProduto.estoque_critico ?? ''}
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

      {/* MODAL REGISTRAR ENTRADA */}
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
                      preco_unidade: p ? p.preco_custo : ''
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
                <label className="block text-slate-400 mb-1 font-semibold">Preço Custo Unidade (R$):</label>
                <input
                  type="text"
                  value={formEntrada.preco_unidade || ''}
                  onChange={(e) => setFormEntrada({ ...formEntrada, preco_unidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-emerald-400 mb-1 font-semibold">Quantidade de Entrada:</label>
                <input
                  type="number"
                  min="1"
                  value={formEntrada.quantidade || ''}
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

      {/* MODAL REGISTRAR SAÍDA */}
      {modalSaida && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111726] border border-slate-800 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-base font-bold text-white mb-3">Registrar Saída (Consumo/Venda)</h3>
            <form onSubmit={handleRegistrarSaida} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Produto:</label>
                <select
                  value={formSaida.produto_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const p = produtos.find((item) => item.id.toString() === id);
                    setFormSaida({
                      ...formSaida,
                      produto_id: id,
                      preco_venda: p ? p.preco_venda : ''
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
                <label className="block text-sky-400 mb-1 font-semibold">Quantidade Vendida/Consumida:</label>
                <input
                  type="number"
                  min="1"
                  value={formSaida.quantidade || ''}
                  onChange={(e) => setFormSaida({ ...formSaida, quantidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-sky-500/50 rounded-lg p-2.5 text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Preço Venda Unidade (R$):</label>
                <input
                  type="text"
                  value={formSaida.preco_venda || ''}
                  onChange={(e) => setFormSaida({ ...formSaida, preco_venda: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Observação:</label>
                <input
                  type="text"
                  value={formSaida.observacao || ''}
                  onChange={(e) => setFormSaida({ ...formSaida, observacao: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalSaida(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-500"
                >
                  Confirmar Saída
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
                  value={formRetorno.quantidade || ''}
                  onChange={(e) => setFormRetorno({ ...formRetorno, quantidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-indigo-500/50 rounded-lg p-2.5 text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Motivo do Retorno:</label>
                <input
                  type="text"
                  value={formRetorno.motivo || ''}
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
                  value={formPerda.quantidade || ''}
                  onChange={(e) => setFormPerda({ ...formPerda, quantidade: e.target.value })}
                  className="w-full bg-[#0a0e17] border border-rose-500/50 rounded-lg p-2 text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Motivo da Perda:</label>
                <select
                  value={formPerda.motivo_perda || ''}
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
                  value={formPerda.observacao || ''}
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
