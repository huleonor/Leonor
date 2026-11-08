/* INOVACAR Gestão: carros, clientes e tempos, com a Google Sheet como base de dados. */
(() => {
  'use strict';

  const CFG = window.GESTAO || {};
  const ICONES = window.ICONES || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------------------------------------------------------------- utilidades
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icone = (nome, extra = '') =>
    `<svg class="ico ${extra}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${ICONES[nome] || ''}</svg>`;
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const soDigitos = (s) => String(s || '').replace(/\D/g, '');

  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço ou privado */ } };
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

  // Matrículas: guardadas como AA-00-AA; procuradas sem hífenes.
  const matChave = (m) => String(m || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matFormatar = (m) => {
    const k = matChave(m);
    return k.length === 6 ? `${k.slice(0, 2)}-${k.slice(2, 4)}-${k.slice(4)}` : k;
  };
  const placa = (m, grande = false) => m
    ? `<span class="placa${grande ? ' grande' : ''}" aria-label="Matrícula ${esc(m)}"><span>${esc(m)}</span></span>`
    : `<span class="placa vazia${grande ? ' grande' : ''}"><span>Sem matrícula</span></span>`;
  const telFormatar = (t) => {
    const d = soDigitos(t);
    return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(t || '');
  };

  // ---------------------------------------------------------------- datas e tempos
  // Na sheet as datas ficam legíveis, na hora local: "2026-11-08 09:12".
  const pad = (n) => String(n).padStart(2, '0');
  const paraTexto = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const agoraTexto = () => paraTexto(new Date());
  const data = (s) => {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (m && !/Z|[+-]\d{2}:?\d{2}$/.test(String(s))) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };
  const paraInput = (s) => { const d = data(s); return d ? paraTexto(d).replace(' ', 'T') : ''; };
  const deInput = (v) => (v ? v.replace('T', ' ').slice(0, 16) : '');
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  function quando(s, comHora = true) {
    const d = data(s);
    if (!d) return '';
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
    let dia;
    if (mesmoDia(d, hoje)) dia = 'hoje';
    else if (mesmoDia(d, ontem)) dia = 'ontem';
    else if (mesmoDia(d, amanha)) dia = 'amanhã';
    else dia = `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoje.getFullYear() ? ' ' + d.getFullYear() : ''}`;
    return comHora ? `${dia}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : dia;
  }
  const MIN = 60000, HORA = 60 * MIN, DIA = 24 * HORA;
  function duracao(ms) {
    if (ms == null || isNaN(ms)) return '';
    ms = Math.max(0, ms);
    if (ms < HORA) return `${Math.max(1, Math.round(ms / MIN))} min`;
    if (ms < DIA) { const h = Math.floor(ms / HORA), m = Math.round((ms % HORA) / MIN); return m ? `${h} h ${m} min` : `${h} h`; }
    const d = Math.floor(ms / DIA), h = Math.round((ms % DIA) / HORA);
    return h ? `${d} d ${h} h` : `${d} d`;
  }

  // Horas de abertura entre dois instantes (seg a sex, 09:00 às 18:30 por defeito).
  const HOR = CFG.horario || { dias: [1, 2, 3, 4, 5], abre: '09:00', fecha: '18:30' };
  const minutosDe = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const ABRE = minutosDe(HOR.abre), FECHA = minutosDe(HOR.fecha);
  const DIA_UTIL = (FECHA - ABRE) * MIN;
  function horasUteis(a, b) {
    if (!a || !b || b <= a) return 0;
    let total = 0;
    const d = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    for (let i = 0; d <= b && i < 3660; i++) {
      if (HOR.dias.includes(d.getDay())) {
        const ini = new Date(d.getTime() + ABRE * MIN), fim = new Date(d.getTime() + FECHA * MIN);
        const s = Math.max(ini, a), e = Math.min(fim, b);
        if (e > s) total += e - s;
      }
      d.setDate(d.getDate() + 1);
    }
    return total;
  }
  // Uma duração em horas de abertura: "3 h 20 min", ou "2 dias e 3 h" a partir de um dia inteiro.
  function duracaoUtil(ms) {
    if (ms == null || isNaN(ms)) return '';
    if (ms < DIA_UTIL) return ms < MIN ? '0 min' : duracao(ms);
    const dias = Math.floor(ms / DIA_UTIL), resto = Math.round((ms % DIA_UTIL) / HORA);
    const d = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
    return resto ? `${d} e ${resto} h` : d;
  }

  // ---------------------------------------------------------------- estados
  const ESTADOS = {
    espera: { nome: 'À espera', curto: 'À espera', acao: 'Começar', carimbo: 'inicio' },
    curso: { nome: 'Em trabalho', curto: 'Em curso', acao: 'Marcar pronto', carimbo: 'pronto' },
    pronto: { nome: 'Pronto a levantar', curto: 'Pronto', acao: 'Entregar', carimbo: 'entregue' },
    entregue: { nome: 'Entregue', curto: 'Entregue', acao: '', carimbo: '' },
  };
  const ORDEM = ['espera', 'curso', 'pronto', 'entregue'];
  const seguinte = (e) => ORDEM[ORDEM.indexOf(e) + 1];
  const CARIMBO_DE = { curso: 'inicio', pronto: 'pronto', entregue: 'entregue' };

  // ---------------------------------------------------------------- estado da página
  const st = {
    clientes: [], carros: [], trabalhos: [],
    carregado: false, erro: null, codigoErro: null,
    pendentes: ler('ig.pendentes', []),
    enviando: false, lendo: false,
    faixa: 'espera', periodo: '30', busca: { oficina: '', clientes: '', carros: '' },
  };

  const ligacao = () => {
    const l = ler('ig.ligacao', {});
    return { apiUrl: (l.apiUrl || CFG.apiUrl || '').trim(), pin: l.pin || '' };
  };
  const emDemo = () => !ligacao().apiUrl;

  // ---------------------------------------------------------------- índices
  let idx = { cliente: new Map(), carro: new Map(), trabalho: new Map(), carroPorMat: new Map(), trabalhosDoCarro: new Map(), carrosDoCliente: new Map() };
  function indexar() {
    const i = { cliente: new Map(), carro: new Map(), trabalho: new Map(), carroPorMat: new Map(), trabalhosDoCarro: new Map(), carrosDoCliente: new Map() };
    st.clientes.forEach((c) => i.cliente.set(c.id, c));
    st.carros.forEach((c) => {
      i.carro.set(c.id, c);
      if (c.matricula) i.carroPorMat.set(matChave(c.matricula), c);
      if (!i.carrosDoCliente.has(c.cliente_id)) i.carrosDoCliente.set(c.cliente_id, []);
      i.carrosDoCliente.get(c.cliente_id).push(c);
    });
    st.trabalhos.forEach((t) => {
      i.trabalho.set(t.id, t);
      if (!i.trabalhosDoCarro.has(t.carro_id)) i.trabalhosDoCarro.set(t.carro_id, []);
      i.trabalhosDoCarro.get(t.carro_id).push(t);
    });
    i.trabalhosDoCarro.forEach((l) => l.sort((a, b) => (data(b.entrada) || 0) - (data(a.entrada) || 0)));
    idx = i;
  }
  const carroDe = (t) => idx.carro.get(t.carro_id);
  const clienteDe = (carro) => (carro ? idx.cliente.get(carro.cliente_id) : null);
  const nomeCarro = (c) => (c ? [c.marca, c.modelo].filter(Boolean).join(' ') || 'Carro sem marca' : 'Carro apagado');
  const trabalhosDoCliente = (cid) => (idx.carrosDoCliente.get(cid) || []).flatMap((c) => idx.trabalhosDoCarro.get(c.id) || [])
    .sort((a, b) => (data(b.entrada) || 0) - (data(a.entrada) || 0));

  function tempos(t, ate = new Date()) {
    const e = data(t.entrada), i = data(t.inicio), p = data(t.pronto);
    const fimOficina = p || (t.estado === 'entregue' ? data(t.entregue) : null) || ate;
    return {
      espera: e ? horasUteis(e, i || (t.estado === 'espera' ? ate : fimOficina)) : null,
      trabalho: i ? horasUteis(i, p || ate) : null,
      oficina: e ? horasUteis(e, fimOficina) : null,
      calendario: e ? fimOficina - e : null,
      concluido: !!p,
    };
  }
  const atrasado = (t) => {
    if (!t.previsto || t.estado === 'pronto' || t.estado === 'entregue') return false;
    const d = data(t.previsto);
    if (!d) return false;
    const fimDoDia = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
    return fimDoDia < new Date();
  };
  const cumpriuPrazo = (t) => {
    if (!t.previsto || !t.pronto) return null;
    const d = data(t.previsto), p = data(t.pronto);
    return p <= new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
  };

  // ---------------------------------------------------------------- servidor (Apps Script) ou demonstração
  async function chamar(corpo) {
    const { apiUrl, pin } = ligacao();
    if (!apiUrl) return demo.chamar(corpo);
    const r = await fetch(apiUrl, {
      method: 'POST',
      // text/plain evita o pedido prévio de CORS, que o Apps Script não atende.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...corpo, pin }),
      redirect: 'follow',
    });
    if (!r.ok) throw Object.assign(new Error(`A sheet respondeu ${r.status}.`), { codigo: 'rede' });
    let j;
    try { j = await r.json(); } catch { throw Object.assign(new Error('A resposta não veio do script de gestão. Confirme o URL /exec.'), { codigo: 'url' }); }
    if (!j.ok) throw Object.assign(new Error(j.erro || 'Erro na sheet.'), { codigo: j.codigo || 'sheet' });
    return j;
  }

  function aplicar(base, ops) {
    ops.forEach((o) => {
      const lista = base[o.tabela];
      if (!lista) return;
      const i = lista.findIndex((r) => r.id === o.id);
      if (o.op === 'apagar') { if (i >= 0) lista.splice(i, 1); return; }
      if (o.op === 'criar' && i < 0) { lista.push({ ...o.dados, id: o.id }); return; }
      if (i >= 0) lista[i] = { ...lista[i], ...o.dados, id: o.id };
    });
  }

  function guardarCache() {
    if (emDemo()) return;
    guardar('ig.cache', { url: ligacao().apiUrl, clientes: st.clientes, carros: st.carros, trabalhos: st.trabalhos });
  }

  async function carregar({ silencioso = false } = {}) {
    if (st.lendo) return;
    st.lendo = true;
    if (!silencioso) atualizarSync();
    try {
      // Primeiro o que está por gravar, para a leitura já o trazer.
      if (st.pendentes.length) await enviar();
      const j = await chamar({ action: 'listar' });
      const base = { clientes: j.clientes || [], carros: j.carros || [], trabalhos: j.trabalhos || [] };
      aplicar(base, st.pendentes);
      Object.assign(st, base, { carregado: true, erro: null, codigoErro: null });
      indexar();
      guardarCache();
    } catch (err) {
      st.erro = err.message || String(err);
      st.codigoErro = err.codigo || 'rede';
      if (err.codigo === 'pin' || err.codigo === 'sem-pin') abrirPainel('ligacao');
    } finally {
      st.lendo = false;
      desenhar();
    }
  }

  function gravar(ops, msg) {
    const base = { clientes: st.clientes, carros: st.carros, trabalhos: st.trabalhos };
    aplicar(base, ops);
    indexar();
    st.pendentes.push(...ops);
    guardar('ig.pendentes', st.pendentes);
    guardarCache();
    desenhar();
    if (msg) toast(msg);
    enviar();
  }

  let tentarDeNovo = null;
  async function enviar() {
    if (st.enviando || !st.pendentes.length) return;
    st.enviando = true;
    atualizarSync();
    const lote = st.pendentes.slice();
    try {
      await chamar({ action: 'gravar', operacoes: lote });
      st.pendentes = st.pendentes.slice(lote.length);
      guardar('ig.pendentes', st.pendentes);
      if (st.erro && st.carregado) { st.erro = null; st.codigoErro = null; desenharAviso(); }
    } catch (err) {
      st.erro = err.message || String(err);
      st.codigoErro = err.codigo || 'rede';
      desenharAviso();
      clearTimeout(tentarDeNovo);
      tentarDeNovo = setTimeout(enviar, 15000);
    } finally {
      st.enviando = false;
      atualizarSync();
    }
    if (st.pendentes.length && !st.erro) enviar();
  }

  // ---------------------------------------------------------------- demonstração (dados só neste navegador)
  const demo = {
    dados() {
      let d = ler('ig.demo', null);
      if (!d) { d = semente(); guardar('ig.demo', d); }
      return d;
    },
    async chamar(corpo) {
      await new Promise((r) => setTimeout(r, 250));
      const d = this.dados();
      if (corpo.action === 'listar') return { ok: true, ...JSON.parse(JSON.stringify(d)) };
      if (corpo.action === 'gravar') { aplicar(d, corpo.operacoes || []); guardar('ig.demo', d); return { ok: true }; }
      return { ok: true };
    },
  };

  function semente() {
    const agora = new Date();
    const em = (dias, h = 9, m = 0) => { const d = new Date(agora); d.setDate(d.getDate() + dias); d.setHours(h, m, 0, 0); return paraTexto(d > agora ? new Date(agora - 20 * MIN) : d); };
    // O n-ésimo dia de abertura para trás (0: hoje, ou o último dia aberto).
    const util = (n) => {
      const d = new Date(agora); d.setHours(12, 0, 0, 0);
      while (!HOR.dias.includes(d.getDay())) d.setDate(d.getDate() - 1);
      for (let k = 0; k < -n; k++) { d.setDate(d.getDate() - 1); while (!HOR.dias.includes(d.getDay())) d.setDate(d.getDate() - 1); }
      const hoje = new Date(agora); hoje.setHours(12, 0, 0, 0);
      return Math.round((d - hoje) / DIA);
    };
    const clientes = [
      ['Ana Sousa', '934000001'], ['Bruno Martins', '934000002'], ['Jorge Abrantes', '928021473'],
      ['Marta Pinho', '912345118'], ['Rui Teixeira', '965220871'], ['Sofia Ramos', '936418002'],
      ['Carlos Neves', '917003455'], ['Inês Matos', '932118740'],
    ].map(([nome, telemovel], k) => ({ id: 'cli' + k, nome, telemovel, email: '', nif: '', notas: '', criado_em: em(-80) }));
    const carros = [
      ['cli0', '45-QX-12', 'Peugeot', '208', '2019', '84200'], ['cli1', 'AB-12-CD', 'Renault', 'Clio', '2017', '132500'],
      ['cli2', '27-LM-88', 'Volkswagen', 'Golf', '2015', '188900'], ['cli3', 'BE-04-RT', 'Toyota', 'Yaris', '2021', '41300'],
      ['cli4', '91-TT-30', 'BMW', 'Série 1', '2016', '159000'], ['cli5', 'AK-77-PX', 'Seat', 'Ibiza', '2020', '67800'],
      ['cli6', '12-HG-09', 'Opel', 'Corsa', '2012', '214000'], ['cli7', 'BJ-31-SM', 'Fiat', '500', '2022', '22100'],
      ['cli2', '66-PO-41', 'Citroën', 'Berlingo', '2014', '241700'],
    ].map(([cliente_id, matricula, marca, modelo, ano, km], k) => ({ id: 'car' + k, cliente_id, matricula, marca, modelo, ano, km, notas: '', criado_em: em(-80) }));
    const S = CFG.servicos || [];
    const t = [];
    const add = (carro, servico, descricao, estado, entrada, inicio, pronto, entregue, previsto) =>
      t.push({ id: 'tr' + t.length, carro_id: carro, servico, descricao, estado, entrada, inicio: inicio || '', pronto: pronto || '', entregue: entregue || '', previsto: previsto || '', notas: '', criado_em: entrada });
    // Na oficina agora
    const d0 = util(0);
    add('car0', S[1], 'Pastilhas da frente a chiar.', 'espera', em(d0, 9, 5), '', '', '', em(d0, 18, 0).slice(0, 10));
    add('car3', S[0], 'Revisão dos 40 mil.', 'espera', em(d0, 10, 40));
    add('car4', S[2], 'Luz do motor acesa, perde força a subir.', 'curso', em(util(-1), 15, 20), em(d0, 9, 30), '', '', em(util(-1), 18, 0).slice(0, 10));
    add('car6', S[5], 'Embraiagem a patinar.', 'curso', em(util(-2), 9, 15), em(util(-2), 11, 0), '', '', em(d0, 18, 0).slice(0, 10));
    add('car5', S[3], 'Não pega de manhã.', 'pronto', em(d0, 8, 55), em(d0, 9, 10), em(d0, 10, 25), '', em(d0, 18, 0).slice(0, 10));
    // Histórico
    const hist = [
      ['car1', 0, 1.6], ['car2', 6, 9], ['car7', 0, 1.2], ['car8', 4, 14], ['car0', 0, 1.4], ['car3', 7, 5.5],
      ['car4', 1, 3.2], ['car5', 2, 6.5], ['car1', 1, 2.6], ['car2', 4, 11], ['car6', 3, 4.5], ['car7', 7, 3],
      ['car8', 5, 8], ['car0', 2, 7], ['car3', 0, 1.1], ['car1', 6, 20], ['car2', 1, 2.4], ['car5', 0, 1.3],
    ];
    hist.forEach(([carro, s, horas], k) => {
      const dias = -(3 + k * 4);
      const entrada = new Date(agora); entrada.setDate(entrada.getDate() + dias);
      while (!HOR.dias.includes(entrada.getDay())) entrada.setDate(entrada.getDate() - 1);
      entrada.setHours(9 + (k % 3), (k * 17) % 60, 0, 0);
      const inicio = new Date(entrada.getTime() + (20 + (k % 4) * 25) * MIN);
      let pronto = new Date(inicio), resto = horas * HORA;
      // Avança só nas horas de abertura.
      while (resto > 0) {
        const fecho = new Date(pronto); fecho.setHours(Math.floor(FECHA / 60), FECHA % 60, 0, 0);
        const cabe = fecho - pronto;
        if (HOR.dias.includes(pronto.getDay()) && cabe > 0) {
          const usa = Math.min(cabe, resto); pronto = new Date(pronto.getTime() + usa); resto -= usa;
          if (resto <= 0) break;
        }
        pronto.setDate(pronto.getDate() + 1); pronto.setHours(Math.floor(ABRE / 60), ABRE % 60, 0, 0);
      }
      const entregue = new Date(pronto.getTime() + 2 * HORA);
      const prev = new Date(entrada); prev.setDate(prev.getDate() + (horas > 8 ? 2 : 0));
      add(carro, S[s], '', 'entregue', paraTexto(entrada), paraTexto(inicio), paraTexto(pronto), paraTexto(entregue), k % 3 === 0 ? '' : paraTexto(prev).slice(0, 10));
    });
    return { clientes, carros, trabalhos: t };
  }

  // ---------------------------------------------------------------- navegação
  const VISTAS = [
    { id: 'oficina', nome: 'Oficina', icone: 'wrench' },
    { id: 'clientes', nome: 'Clientes', icone: 'users-three' },
    { id: 'carros', nome: 'Carros', icone: 'car' },
    { id: 'tempos', nome: 'Tempos', icone: 'timer' },
  ];
  const vistaAtual = () => { const h = location.hash.slice(1); return VISTAS.some((v) => v.id === h) ? h : 'oficina'; };

  function desenharNav() {
    const v = vistaAtual();
    const naOficina = st.trabalhos.filter((t) => t.estado !== 'entregue').length;
    $('[data-nav]').innerHTML = VISTAS.map((x) => `<a href="#${x.id}"${x.id === v ? ' aria-current="page"' : ''}>${x.nome}${x.id === 'oficina' && st.carregado ? ` <span class="conta-aba" aria-label="${naOficina} carros na oficina">${naOficina}</span>` : ''}</a>`).join('');
    $('[data-nav-baixo]').innerHTML = VISTAS.map((x) => `<a href="#${x.id}"${x.id === v ? ' aria-current="page"' : ''}>${icone(x.icone)}<span>${x.nome}</span></a>`).join('');
  }

  function atualizarSync() {
    const el = $('[data-sync]');
    let estado = 'ok', txt = 'Sheet em dia';
    if (emDemo()) { estado = 'demo'; txt = 'Demonstração'; }
    else if (st.enviando || st.lendo) { estado = 'a-gravar'; txt = st.enviando ? 'A gravar...' : 'A ler a sheet...'; }
    else if (st.pendentes.length) { estado = 'offline'; txt = `${st.pendentes.length} por gravar`; }
    else if (st.erro) { estado = 'offline'; txt = 'Sem ligação'; }
    el.dataset.estado = estado;
    el.textContent = txt;
    el.title = txt;
  }

  function desenharAviso() {
    const el = $('[data-aviso]');
    let html = '';
    if (emDemo()) {
      html = `<div class="aviso-dentro">${icone('cloud-slash')}<p><strong>Modo de demonstração.</strong> Estes dados de exemplo ficam só neste navegador.</p><button class="btn pequeno escuro" type="button" data-abrir="ligacao">Ligar à sheet</button></div>`;
    } else if (st.erro) {
      const pend = st.pendentes.length ? ` ${st.pendentes.length === 1 ? 'Uma alteração fica' : st.pendentes.length + ' alterações ficam'} guardada${st.pendentes.length === 1 ? '' : 's'} aqui e segue${st.pendentes.length === 1 ? '' : 'm'} quando a ligação voltar.` : '';
      html = `<div class="aviso-dentro erro">${icone('warning')}<p><strong>Não foi possível falar com a sheet.</strong> ${esc(st.erro)}${pend}</p><button class="btn pequeno" type="button" data-acao="recarregar">${icone('arrows-clockwise')}Tentar de novo</button></div>`;
    }
    el.innerHTML = html;
    el.hidden = !html;
  }

  function desenhar() {
    desenharNav();
    atualizarSync();
    desenharAviso();
    const main = $('[data-conteudo]');
    const ativo = document.activeElement;
    const focoBusca = ativo && ativo.matches && ativo.matches('[data-busca]') ? { v: ativo.dataset.busca, s: ativo.selectionStart } : null;
    const v = vistaAtual();
    main.innerHTML = ({ oficina: vistaOficina, clientes: vistaClientes, carros: vistaCarros, tempos: vistaTempos }[v])();
    document.title = `${VISTAS.find((x) => x.id === v).nome}: INOVACAR Gestão`;
    if (focoBusca) {
      const i = $(`[data-busca="${focoBusca.v}"]`);
      if (i) { i.focus(); try { i.setSelectionRange(focoBusca.s, focoBusca.s); } catch { /* */ } }
    }
  }

  const esqueletos = (n) => Array.from({ length: n }, () => '<div class="esqueleto" aria-hidden="true"><i></i><i></i><i></i></div>').join('');
  const caixaPesquisa = (vista, ph) => `<label class="pesquisa">${icone('magnifying-glass')}<span class="so-leitor">${ph}</span><input type="search" data-busca="${vista}" placeholder="${ph}" value="${esc(st.busca[vista])}" autocomplete="off"></label>`;

  // ---------------------------------------------------------------- vista: oficina
  function bateBusca(t, q) {
    if (!q) return true;
    const c = carroDe(t), cl = clienteDe(c);
    const alvo = sem([c && c.matricula, c && matChave(c.matricula), nomeCarro(c), cl && cl.nome, cl && cl.telemovel, t.servico, t.descricao].join(' '));
    return sem(q).split(/\s+/).every((p) => alvo.includes(p.replace(/-/g, '')) || alvo.includes(p));
  }

  function vistaOficina() {
    const q = st.busca.oficina.trim();
    const ativos = st.trabalhos.filter((t) => t.estado !== 'entregue');
    const por = { espera: [], curso: [], pronto: [] };
    ativos.filter((t) => bateBusca(t, q)).forEach((t) => (por[t.estado] || por.espera).push(t));
    por.espera.sort((a, b) => (data(a.entrada) || 0) - (data(b.entrada) || 0));
    por.curso.sort((a, b) => (data(a.inicio) || 0) - (data(b.inicio) || 0));
    por.pronto.sort((a, b) => (data(a.pronto) || 0) - (data(b.pronto) || 0));
    const n = (e) => ativos.filter((t) => t.estado === e).length;
    const total = ativos.length;
    const resumo = !st.carregado ? 'A ler a sheet...'
      : total === 0 ? 'Nenhum carro na oficina.'
      : `${total} ${total === 1 ? 'carro' : 'carros'}: ${n('espera')} à espera, ${n('curso')} em trabalho, ${n('pronto')} ${n('pronto') === 1 ? 'pronto' : 'prontos'} a levantar.`;

    const VAZIO = {
      espera: ['Ninguém à espera.', 'Quando um carro chegar, carregue em Dar entrada.'],
      curso: ['Nada em trabalho.', 'Em À espera, carregue em Começar quando pegar num carro.'],
      pronto: ['Nada por levantar.', 'Marque um carro como pronto e ele aparece aqui até ser entregue.'],
    };
    const faixa = (e) => `
      <section class="faixa${st.faixa === e ? ' ativa' : ''}" data-estado="${e}" id="faixa-${e}" role="tabpanel" aria-labelledby="seg-${e}">
        <header class="faixa-cabeca"><span class="ponto" aria-hidden="true"></span><h2>${ESTADOS[e].nome}</h2><span class="conta">${st.carregado ? por[e].length : ''}</span></header>
        ${!st.carregado ? `<div class="cartoes">${esqueletos(e === 'curso' ? 2 : 1)}</div>`
          : por[e].length ? `<ol class="cartoes">${por[e].map(cartao).join('')}</ol>`
          : `<div class="faixa-vazia">${q ? '<strong>Nada encontrado.</strong>Experimente outra matrícula ou nome.' : `<strong>${VAZIO[e][0]}</strong>${VAZIO[e][1]}`}</div>`}
      </section>`;

    return `
      <div class="vista-cabeca">
        <div><h1>Na oficina</h1><p class="resumo">${resumo}</p></div>
        <div class="acoes">${caixaPesquisa('oficina', 'Matrícula, cliente ou serviço')}</div>
      </div>
      <div class="segmentos" role="tablist" aria-label="Estado">
        ${['espera', 'curso', 'pronto'].map((e) => `<button type="button" role="tab" id="seg-${e}" aria-controls="faixa-${e}" aria-selected="${st.faixa === e}" data-faixa="${e}"><span class="ponto" data-estado="${e}" aria-hidden="true"></span>${ESTADOS[e].curto}${st.carregado ? ` <span class="fraco">${por[e].length}</span>` : ''}</button>`).join('')}
      </div>
      <div class="faixas">${faixa('espera')}${faixa('curso')}${faixa('pronto')}</div>`;
  }

  function cartao(t) {
    const c = carroDe(t), cl = clienteDe(c);
    const tp = tempos(t);
    let tempo;
    if (t.estado === 'espera') tempo = `${icone('clock')}chegou ${quando(t.entrada).replace(/^hoje, /, 'às ')}`;
    else if (t.estado === 'curso') tempo = `${icone('wrench')}${duracaoUtil(tp.trabalho)} em trabalho`;
    else tempo = `${icone('check')}pronto ${quando(t.pronto).replace(/^hoje, /, 'às ')}`;
    const late = atrasado(t);
    const prazo = t.previsto
      ? `<span class="prazo${late ? ' atraso' : ''}">${icone(late ? 'warning' : 'calendar-blank')}${late ? 'Prometido para ' + quando(t.previsto, false) : 'Para ' + quando(t.previsto, false)}</span>`
      : '<span></span>';
    const prox = seguinte(t.estado);
    const acao = ESTADOS[t.estado].acao;
    const cls = t.estado === 'curso' ? 'pronto' : t.estado === 'pronto' ? 'escuro' : 'primario';
    return `<li><article class="cartao${late ? ' atrasado' : ''}">
      <button class="cartao-abrir" type="button" data-abrir="trabalho" data-id="${t.id}" aria-label="Abrir ${esc(c ? c.matricula : '')} ${esc(nomeCarro(c))}">
        <span class="cartao-linha">${placa(c && c.matricula)}<span class="cartao-tempo">${tempo}</span></span>
        <p class="cartao-carro">${esc(nomeCarro(c))}</p>
        <p class="cartao-servico">${esc(t.servico || 'Serviço por definir')}${t.descricao ? ': ' + esc(t.descricao) : ''}</p>
        <p class="cartao-cliente">${esc(cl ? cl.nome : 'Sem cliente')}</p>
      </button>
      <div class="cartao-rodape">${prazo}${prox ? `<button class="btn pequeno ${cls}" type="button" data-avancar="${t.id}">${acao}</button>` : ''}</div>
    </article></li>`;
  }

  // ---------------------------------------------------------------- vista: clientes
  function vistaClientes() {
    const q = sem(st.busca.clientes.trim());
    const linhas = st.clientes
      .map((c) => {
        const carros = idx.carrosDoCliente.get(c.id) || [];
        const tr = trabalhosDoCliente(c.id);
        return { c, carros, visitas: tr.length, ultima: tr[0] ? tr[0].entrada : '' };
      })
      .filter(({ c, carros }) => !q || sem([c.nome, c.telemovel, soDigitos(c.telemovel), c.email, c.nif, ...carros.map((k) => k.matricula + ' ' + matChave(k.matricula))].join(' ')).includes(q.replace(/\s+/g, ' ')))
      .sort((a, b) => (data(b.ultima) || 0) - (data(a.ultima) || 0) || a.c.nome.localeCompare(b.c.nome, 'pt'));

    const corpo = !st.carregado ? `<div style="padding:16px;display:grid;gap:10px">${esqueletos(4)}</div>`
      : !st.clientes.length ? `<div class="lista-vazia"><strong>Ainda não há clientes.</strong>Os clientes entram quando dá entrada a um carro, ou aqui.<br><button class="btn primario" type="button" data-abrir="cliente">${icone('plus')}Novo cliente</button></div>`
      : !linhas.length ? '<div class="lista-vazia"><strong>Nenhum cliente encontrado.</strong>Procure pelo nome, telemóvel ou matrícula.</div>'
      : `<table><thead><tr><th>Nome</th><th>Telemóvel</th><th>Carros</th><th class="num">Visitas</th><th class="num">Última visita</th></tr></thead><tbody>
        ${linhas.map(({ c, carros, visitas, ultima }) => `<tr data-abrir-linha="cliente" data-id="${c.id}" tabindex="0">
          <td class="nome-linha">${esc(c.nome)}</td>
          <td data-rotulo="Telemóvel">${esc(telFormatar(c.telemovel)) || '<span class="fraco">sem número</span>'}</td>
          <td><div class="placas">${carros.map((k) => placa(k.matricula)).join('') || '<span class="fraco">sem carros</span>'}</div></td>
          <td class="num esconder-telemovel">${visitas}</td>
          <td class="num" data-rotulo="Última visita">${ultima ? esc(quando(ultima, false)) : '<span class="fraco">nunca</span>'}</td>
        </tr>`).join('')}</tbody></table>`;

    return `
      <div class="vista-cabeca">
        <div><h1>Clientes</h1><p class="resumo">${st.carregado ? `${st.clientes.length} ${st.clientes.length === 1 ? 'cliente' : 'clientes'}` : 'A ler a sheet...'}</p></div>
        <div class="acoes">${caixaPesquisa('clientes', 'Nome, telemóvel ou matrícula')}<button class="btn" type="button" data-abrir="cliente">${icone('plus')}Novo cliente</button></div>
      </div>
      <div class="tabela-caixa responsiva">${corpo}</div>`;
  }

  // ---------------------------------------------------------------- vista: carros
  function vistaCarros() {
    const q = sem(st.busca.carros.trim());
    const linhas = st.carros
      .map((k) => {
        const tr = idx.trabalhosDoCarro.get(k.id) || [];
        const feitos = tr.filter((t) => t.pronto);
        const media = feitos.length ? feitos.reduce((s, t) => s + tempos(t).oficina, 0) / feitos.length : null;
        return { k, cl: clienteDe(k), visitas: tr.length, ultima: tr[0] ? tr[0].entrada : '', media, naOficina: tr.some((t) => t.estado !== 'entregue') };
      })
      .filter(({ k, cl }) => !q || sem([k.matricula, matChave(k.matricula), k.marca, k.modelo, k.ano, cl && cl.nome].join(' ')).includes(q))
      .sort((a, b) => (b.naOficina - a.naOficina) || (data(b.ultima) || 0) - (data(a.ultima) || 0));

    const corpo = !st.carregado ? `<div style="padding:16px;display:grid;gap:10px">${esqueletos(4)}</div>`
      : !st.carros.length ? `<div class="lista-vazia"><strong>Ainda não há carros.</strong>Cada carro entra com a primeira entrada na oficina.<br><button class="btn primario" type="button" data-abrir="entrada">${icone('plus')}Dar entrada</button></div>`
      : !linhas.length ? '<div class="lista-vazia"><strong>Nenhum carro encontrado.</strong>Procure pela matrícula, marca, modelo ou cliente.</div>'
      : `<table><thead><tr><th>Matrícula</th><th>Carro</th><th>Cliente</th><th class="num">Visitas</th><th class="num">Última visita</th><th class="num">Tempo médio</th></tr></thead><tbody>
        ${linhas.map(({ k, cl, visitas, ultima, media, naOficina }) => `<tr data-abrir-linha="carro" data-id="${k.id}" tabindex="0">
          <td>${placa(k.matricula)}</td>
          <td class="nome-linha">${esc(nomeCarro(k))}${k.ano ? ` <span class="fraco">${esc(k.ano)}</span>` : ''}${naOficina ? ' <span class="selo ok">Na oficina</span>' : ''}</td>
          <td data-rotulo="Cliente">${cl ? esc(cl.nome) : '<span class="fraco">sem cliente</span>'}</td>
          <td class="num esconder-telemovel">${visitas}</td>
          <td class="num" data-rotulo="Última visita">${ultima ? esc(quando(ultima, false)) : '<span class="fraco">nunca</span>'}</td>
          <td class="num esconder-telemovel">${media != null ? esc(duracaoUtil(media)) : '<span class="fraco">sem dados</span>'}</td>
        </tr>`).join('')}</tbody></table>`;

    return `
      <div class="vista-cabeca">
        <div><h1>Carros</h1><p class="resumo">${st.carregado ? `${st.carros.length} ${st.carros.length === 1 ? 'carro' : 'carros'}` : 'A ler a sheet...'}</p></div>
        <div class="acoes">${caixaPesquisa('carros', 'Matrícula, marca ou cliente')}<button class="btn" type="button" data-abrir="carro">${icone('plus')}Novo carro</button></div>
      </div>
      <div class="tabela-caixa responsiva">${corpo}</div>`;
  }

  // ---------------------------------------------------------------- vista: tempos
  const PERIODOS = [['30', '30 dias'], ['90', '90 dias'], ['365', '12 meses'], ['tudo', 'Tudo']];
  function vistaTempos() {
    const desde = st.periodo === 'tudo' ? null : new Date(Date.now() - Number(st.periodo) * DIA);
    const feitos = st.trabalhos.filter((t) => t.pronto && data(t.entrada) && (!desde || data(t.pronto) >= desde))
      .map((t) => ({ t, tp: tempos(t) }))
      .sort((a, b) => data(b.t.pronto) - data(a.t.pronto));
    const media = (l, k) => { const v = l.map((x) => x.tp[k]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
    const comPrazo = feitos.filter(({ t }) => cumpriuPrazo(t) !== null);
    const noPrazo = comPrazo.filter(({ t }) => cumpriuPrazo(t)).length;

    const porServico = new Map();
    feitos.forEach((x) => { const k = x.t.servico || 'Sem serviço'; if (!porServico.has(k)) porServico.set(k, []); porServico.get(k).push(x); });
    const servicos = [...porServico.entries()].map(([nome, l]) => {
      const ofi = l.map((x) => x.tp.oficina);
      return { nome, n: l.length, oficina: media(l, 'oficina'), trabalho: media(l, 'trabalho'), espera: media(l, 'espera'), min: Math.min(...ofi), max: Math.max(...ofi) };
    }).sort((a, b) => b.oficina - a.oficina);
    const maxMedia = Math.max(1, ...servicos.map((s) => s.oficina || 0));

    const periodo = `<div class="periodo" role="group" aria-label="Período">${PERIODOS.map(([v, n]) => `<button type="button" data-periodo="${v}" aria-pressed="${st.periodo === v}">${n}</button>`).join('')}</div>`;
    const cabeca = `<div class="vista-cabeca"><div><h1>Tempos</h1><p class="resumo">Quanto demora cada carro, contado nas horas em que a oficina está aberta (${esc(HOR.abre)} às ${esc(HOR.fecha)}).</p></div><div class="acoes">${periodo}</div></div>`;
    if (!st.carregado) return cabeca + `<div style="display:grid;gap:10px">${esqueletos(3)}</div>`;
    if (!feitos.length) return cabeca + `<div class="tabela-caixa"><div class="lista-vazia"><strong>Ainda sem carros prontos neste período.</strong>Os tempos aparecem quando um carro passa a Pronto.</div></div>`;

    return cabeca + `
      <dl class="numeros">
        <div><dt>Carros prontos</dt><dd>${feitos.length}</dd></div>
        <div><dt>Tempo médio na oficina</dt><dd>${esc(duracaoUtil(media(feitos, 'oficina')))}</dd></div>
        <div><dt>Tempo médio de trabalho</dt><dd>${esc(duracaoUtil(media(feitos, 'trabalho')))}</dd></div>
        <div><dt>Prontos no dia prometido</dt><dd>${comPrazo.length ? Math.round((noPrazo / comPrazo.length) * 100) + '%' : 'sem prazos'}${comPrazo.length ? `<small>${noPrazo} de ${comPrazo.length}</small>` : ''}</dd></div>
      </dl>

      <section class="bloco">
        <h2>Por serviço</h2>
        <p class="nota">Na oficina: da chegada até estar pronto. Trabalho: de começar até estar pronto.</p>
        <div class="tabela-caixa responsiva"><table>
          <thead><tr><th>Serviço</th><th class="num">Carros</th><th>Média na oficina</th><th class="num">Média de trabalho</th><th class="num">Mais rápido</th><th class="num">Mais lento</th></tr></thead>
          <tbody>${servicos.map((s) => `<tr>
            <td class="nome-linha">${esc(s.nome)}</td>
            <td class="num" data-rotulo="Carros">${s.n}</td>
            <td data-rotulo="Média na oficina"><div style="display:flex;align-items:center;gap:12px"><span style="min-width:96px">${esc(duracaoUtil(s.oficina))}</span><span class="barra esconder-telemovel" style="flex:1" aria-hidden="true"><i style="width:${Math.max(3, (s.oficina / maxMedia) * 100)}%"></i></span></div></td>
            <td class="num" data-rotulo="Média de trabalho">${esc(duracaoUtil(s.trabalho))}</td>
            <td class="num esconder-telemovel">${esc(duracaoUtil(s.min))}</td>
            <td class="num esconder-telemovel">${esc(duracaoUtil(s.max))}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>

      <section class="bloco">
        <h2>Carros prontos</h2>
        <p class="nota">Os mais recentes primeiro. Toque num para ver ou corrigir as horas.</p>
        <div class="tabela-caixa responsiva"><table>
          <thead><tr><th>Pronto</th><th>Matrícula</th><th>Carro</th><th>Serviço</th><th class="num">Na oficina</th><th class="num">Trabalho</th><th>Prazo</th></tr></thead>
          <tbody>${feitos.slice(0, 200).map(({ t, tp }) => {
            const c = carroDe(t), ok = cumpriuPrazo(t);
            return `<tr data-abrir-linha="trabalho" data-id="${t.id}" tabindex="0">
              <td data-rotulo="Pronto">${esc(quando(t.pronto))}</td>
              <td>${placa(c && c.matricula)}</td>
              <td class="nome-linha">${esc(nomeCarro(c))}</td>
              <td class="esconder-telemovel">${esc(t.servico || '')}</td>
              <td class="num" data-rotulo="Na oficina">${esc(duracaoUtil(tp.oficina))}</td>
              <td class="num" data-rotulo="Trabalho">${tp.trabalho != null ? esc(duracaoUtil(tp.trabalho)) : '<span class="fraco">sem início</span>'}</td>
              <td>${ok === null ? '<span class="fraco">sem prazo</span>' : ok ? `<span class="selo ok">${icone('check')}No prazo</span>` : `<span class="selo tarde">${icone('warning')}Atrasado</span>`}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </section>`;
  }

  // ---------------------------------------------------------------- painéis
  const painel = $('[data-painel]');
  let painelAtual = null;

  function abrirPainel(tipo, opcoes = {}) {
    painelAtual = { tipo, ...opcoes };
    const html = ({ trabalho: painelTrabalho, entrada: painelEntrada, cliente: painelCliente, carro: painelCarro, ligacao: painelLigacao }[tipo])(opcoes);
    if (!html) return;
    painel.innerHTML = html;
    if (!painel.open) painel.showModal();
    const foco = $('[data-focar]', painel);
    if (foco) foco.focus(); else $('.painel-corpo', painel)?.focus?.();
    painel.scrollTop = 0;
    ligarPainel(tipo);
  }
  function fecharPainel() { if (painel.open) painel.close(); }
  painel.addEventListener('close', () => { painelAtual = null; painel.innerHTML = ''; });
  painel.addEventListener('click', (e) => { if (e.target === painel) fecharPainel(); });

  const cabecaPainel = (titulo, sub = '', antes = '') => `
    <header class="painel-cabeca">
      <div style="min-width:0">${antes}<h2 id="painel-titulo">${titulo}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
      <button class="btn-icone" type="button" data-fechar aria-label="Fechar">${icone('x')}</button>
    </header>`;

  const campo = (nome, rotulo, valor = '', o = {}) => `
    <label class="campo${o.classe ? ' ' + o.classe : ''}"><span>${rotulo}${o.opcional ? ' <em>(opcional)</em>' : ''}</span>
      <input name="${nome}" type="${o.tipo || 'text'}" value="${esc(valor)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.obrig ? ' required' : ''}${o.foco ? ' data-focar' : ''}${o.extra || ''}>
      ${o.ajuda ? `<span class="ajuda">${o.ajuda}</span>` : ''}
    </label>`;
  const area = (nome, rotulo, valor = '', o = {}) => `
    <label class="campo"><span>${rotulo}${o.opcional ? ' <em>(opcional)</em>' : ''}</span><textarea name="${nome}" rows="${o.linhas || 3}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${esc(valor)}</textarea></label>`;
  const escolhaServico = (atual) => {
    const lista = [...(CFG.servicos || [])];
    if (atual && !lista.includes(atual)) lista.unshift(atual);
    return `<fieldset class="grupo"><legend>Serviço</legend><div class="chips">${lista.map((s) => `<label class="chip"><input type="radio" name="servico" value="${esc(s)}"${s === atual ? ' checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></fieldset>`;
  };

  function historicoHtml(lista, mostrarCarro = false) {
    if (!lista.length) return '<p class="historico-vazio">Ainda sem visitas.</p>';
    return `<ul class="historico">${lista.map((t) => {
      const c = carroDe(t), tp = tempos(t);
      const dur = t.pronto ? duracaoUtil(tp.oficina) : ESTADOS[t.estado]?.nome || '';
      return `<li><button type="button" data-abrir="trabalho" data-id="${t.id}">
        <span class="ponto" data-estado="${t.estado}" aria-hidden="true"></span>
        <span class="h-servico">${esc(t.servico || 'Serviço')}</span>
        <span class="h-data">${esc(quando(t.entrada, false))}${mostrarCarro && c ? ', ' + esc(c.matricula) : ''}</span>
        <span class="h-dur">${esc(dur)}</span>
      </button></li>`;
    }).join('')}</ul>`;
  }

  // --- Dar entrada a um carro
  function painelEntrada(o = {}) {
    const carro = o.carroId ? idx.carro.get(o.carroId) : null;
    return `<form class="painel-forma" data-form="entrada" novalidate>
      ${cabecaPainel('Dar entrada', 'Um carro chegou à oficina.')}
      <div class="painel-corpo">
        <div class="grupo">
          ${campo('matricula', 'Matrícula', carro ? carro.matricula : '', { classe: 'campo-matricula', ph: 'AA-00-AA', obrig: true, foco: !carro, extra: ' autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12"' })}
          <div data-carro-achado></div>
        </div>
        <fieldset class="grupo" data-carro-novo>
          <legend>Carro</legend>
          <div class="linha-campos tres">
            ${campo('marca', 'Marca', '', { ph: 'Peugeot' })}
            ${campo('modelo', 'Modelo', '', { ph: '208' })}
            ${campo('ano', 'Ano', '', { tipo: 'text', ph: '2019', extra: ' inputmode="numeric" maxlength="4"', opcional: false })}
          </div>
        </fieldset>
        <fieldset class="grupo" data-cliente-grupo>
          <legend>Cliente</legend>
          <div data-cliente-achado></div>
          <div class="linha-campos" data-cliente-campos>
            ${campo('cliente_nome', 'Nome', '', { ph: 'Nome do cliente', extra: ' autocomplete="off"' })}
            ${campo('cliente_tel', 'Telemóvel', '', { tipo: 'tel', ph: '912 345 678', extra: ' autocomplete="off" inputmode="tel"' })}
          </div>
          <div class="sugestoes" data-cliente-sugestoes></div>
        </fieldset>
        ${escolhaServico('')}
        ${area('descricao', 'O que se passa', '', { ph: 'O que o cliente disse, luzes acesas, ruídos.', opcional: true, linhas: 3 })}
        <div class="linha-campos">
          ${campo('entrada', 'Chegou', paraInput(agoraTexto()), { tipo: 'datetime-local' })}
          ${campo('previsto', 'Prometido para', '', { tipo: 'date', opcional: true })}
        </div>
        ${campo('km', 'Quilómetros', carro ? carro.km : '', { ph: '84 200', opcional: true, extra: ' inputmode="numeric"' })}
        <p class="campo"><span class="erro-campo" data-erro-form hidden></span></p>
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${icone('plus')}Dar entrada</button></div></footer>
    </form>`;
  }

  function ligarEntrada() {
    const f = $('[data-form="entrada"]', painel);
    const ctx = { carro: null, cliente: null };
    const mat = f.matricula;

    const mostrarCliente = () => {
      const achado = $('[data-cliente-achado]', f), campos = $('[data-cliente-campos]', f);
      if (ctx.cliente) {
        const cs = idx.carrosDoCliente.get(ctx.cliente.id) || [];
        achado.innerHTML = `<div class="achado">${icone('user')}<p><strong>${esc(ctx.cliente.nome)}</strong><span>${esc(telFormatar(ctx.cliente.telemovel)) || 'sem telemóvel'}${cs.length ? `, ${cs.length} ${cs.length === 1 ? 'carro' : 'carros'}` : ''}</span></p>${ctx.carro ? '' : '<button class="btn texto pequeno" type="button" data-trocar-cliente>Trocar</button>'}</div>`;
        campos.hidden = true;
        $('[data-cliente-sugestoes]', f).innerHTML = '';
      } else {
        achado.innerHTML = '';
        campos.hidden = false;
      }
    };
    const procurar = () => {
      const k = matChave(mat.value);
      ctx.carro = k.length >= 4 ? idx.carroPorMat.get(k) || null : null;
      const zona = $('[data-carro-achado]', f);
      const naOficina = ctx.carro && (idx.trabalhosDoCarro.get(ctx.carro.id) || []).find((t) => t.estado !== 'entregue');
      if (ctx.carro) {
        const v = (idx.trabalhosDoCarro.get(ctx.carro.id) || []).length;
        zona.innerHTML = `<div class="achado">${icone('car')}<p><strong>${esc(nomeCarro(ctx.carro))}${ctx.carro.ano ? ', ' + esc(ctx.carro.ano) : ''}</strong><span>Já é cliente. ${v ? `${v} ${v === 1 ? 'visita' : 'visitas'}` : 'Sem visitas'}${naOficina ? `, e está na oficina agora (${esc(ESTADOS[naOficina.estado].nome.toLowerCase())}).` : '.'}</span></p></div>`;
        ctx.cliente = clienteDe(ctx.carro) || null;
        if (!f.km.value) f.km.value = ctx.carro.km || '';
      } else {
        zona.innerHTML = k.length >= 6 ? '<p class="ajuda" style="color:var(--ink-soft);font-size:.9375rem">Carro novo: preencha a marca e o cliente.</p>' : '';
        if (ctx.cliente && ctx.clienteDoCarro) ctx.cliente = null;
      }
      ctx.clienteDoCarro = !!ctx.carro;
      $('[data-carro-novo]', f).hidden = !!ctx.carro;
      mostrarCliente();
    };
    const sugerir = () => {
      if (ctx.cliente) return;
      const nome = sem(f.cliente_nome.value.trim()), tel = soDigitos(f.cliente_tel.value);
      const caixa = $('[data-cliente-sugestoes]', f);
      if (nome.length < 2 && tel.length < 3) { caixa.innerHTML = ''; return; }
      const l = st.clientes.filter((c) => (nome.length >= 2 && sem(c.nome).includes(nome)) || (tel.length >= 3 && soDigitos(c.telemovel).includes(tel))).slice(0, 5);
      caixa.innerHTML = l.length ? `<p>É um destes clientes?</p>${l.map((c) => `<button class="sugestao" type="button" data-escolher-cliente="${c.id}">${icone('user')}<strong>${esc(c.nome)}</strong><span>${esc(telFormatar(c.telemovel))}</span></button>`).join('')}` : '';
    };

    mat.addEventListener('input', procurar);
    mat.addEventListener('blur', () => { mat.value = matFormatar(mat.value); });
    f.cliente_nome.addEventListener('input', sugerir);
    f.cliente_tel.addEventListener('input', sugerir);
    f.addEventListener('click', (e) => {
      const esc_ = e.target.closest('[data-escolher-cliente]');
      if (esc_) { ctx.cliente = idx.cliente.get(esc_.dataset.escolherCliente); mostrarCliente(); }
      if (e.target.closest('[data-trocar-cliente]')) { ctx.cliente = null; mostrarCliente(); f.cliente_nome.focus(); }
    });
    if (mat.value) procurar();

    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const erro = $('[data-erro-form]', f);
      const falha = (msg, el) => { erro.textContent = msg; erro.hidden = false; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } };
      $$('[aria-invalid]', f).forEach((el) => el.removeAttribute('aria-invalid'));
      erro.hidden = true;
      const matricula = matFormatar(mat.value);
      if (matChave(matricula).length < 4) return falha('Escreva a matrícula do carro.', mat);
      const naOficina = ctx.carro && (idx.trabalhosDoCarro.get(ctx.carro.id) || []).find((t) => t.estado !== 'entregue');
      if (naOficina && !f.dataset.confirmado) {
        f.dataset.confirmado = '1';
        return falha(`Este carro já está na oficina (${ESTADOS[naOficina.estado].nome.toLowerCase()}). Carregue outra vez em Dar entrada para abrir um segundo trabalho.`);
      }
      const ops = [];
      const agora = agoraTexto();
      let cliente = ctx.cliente;
      if (!ctx.carro && !cliente) {
        const nome = f.cliente_nome.value.trim();
        if (!nome) return falha('Escreva o nome do cliente, ou escolha um que já exista.', f.cliente_nome);
        cliente = { id: novoId(), nome, telemovel: soDigitos(f.cliente_tel.value) || f.cliente_tel.value.trim(), email: '', nif: '', notas: '', criado_em: agora };
        ops.push({ op: 'criar', tabela: 'clientes', id: cliente.id, dados: cliente });
      }
      let carro = ctx.carro;
      const km = soDigitos(f.km.value);
      if (!carro) {
        carro = { id: novoId(), cliente_id: cliente ? cliente.id : '', matricula, marca: f.marca.value.trim(), modelo: f.modelo.value.trim(), ano: soDigitos(f.ano.value), km, notas: '', criado_em: agora };
        ops.push({ op: 'criar', tabela: 'carros', id: carro.id, dados: carro });
      } else if (km && km !== carro.km) {
        ops.push({ op: 'atualizar', tabela: 'carros', id: carro.id, dados: { km } });
      }
      const servico = (f.querySelector('input[name="servico"]:checked') || {}).value || '';
      const t = {
        id: novoId(), carro_id: carro.id, servico, descricao: f.descricao.value.trim(), estado: 'espera',
        entrada: deInput(f.entrada.value) || agora, inicio: '', pronto: '', entregue: '', previsto: f.previsto.value || '', notas: '', criado_em: agora,
      };
      ops.push({ op: 'criar', tabela: 'trabalhos', id: t.id, dados: t });
      fecharPainel();
      st.faixa = 'espera';
      if (vistaAtual() !== 'oficina') location.hash = '#oficina';
      gravar(ops, `${matricula} deu entrada.`);
    });
  }

  // --- Um trabalho
  function painelTrabalho({ id }) {
    const t = idx.trabalho.get(id);
    if (!t) { toast('Este trabalho já não existe.'); return ''; }
    const c = carroDe(t), cl = clienteDe(c), tp = tempos(t);
    const prox = seguinte(t.estado);
    const i = ORDEM.indexOf(t.estado);
    const etapa = (k, nome, quandoTxt) => {
      const n = ORDEM.indexOf(k);
      const cls = n < i || (n === i && k === 'entregue') ? 'feita' : n === i ? 'agora' : '';
      return `<li class="etapa ${cls}"><span class="bola" aria-hidden="true"></span><strong>${nome}</strong><span>${quandoTxt ? esc(quandoTxt) : '&nbsp;'}</span></li>`;
    };
    const cls = t.estado === 'curso' ? 'pronto' : t.estado === 'pronto' ? 'escuro' : 'primario';
    return `<form class="painel-forma" data-form="trabalho" data-id="${t.id}" novalidate>
      ${cabecaPainel(esc(nomeCarro(c)), esc(t.servico || 'Serviço por definir'), `<div style="margin-bottom:10px">${placa(c && c.matricula, true)}</div>`)}
      <div class="painel-corpo" tabindex="-1">
        <ol class="etapas" aria-label="Estado: ${ESTADOS[t.estado].nome}">
          ${etapa('espera', 'Chegou', quando(t.entrada))}
          ${etapa('curso', 'Começou', quando(t.inicio))}
          ${etapa('pronto', 'Pronto', quando(t.pronto))}
          ${etapa('entregue', 'Entregue', quando(t.entregue))}
        </ol>
        <dl class="duracoes">
          <div><dt>À espera</dt><dd>${tp.espera != null ? esc(duracaoUtil(tp.espera)) : '-'}</dd></div>
          <div><dt>Em trabalho</dt><dd>${tp.trabalho != null ? esc(duracaoUtil(tp.trabalho)) : '-'}</dd></div>
          <div><dt>Na oficina</dt><dd>${tp.oficina != null ? esc(duracaoUtil(tp.oficina)) : '-'}</dd></div>
        </dl>
        <p class="duracoes-nota">Em horas de abertura${tp.concluido ? '' : ', a contar'}.${tp.calendario != null && tp.calendario >= DIA ? ` No calendário: ${esc(duracao(tp.calendario))}.` : ''}</p>
        ${atrasado(t) ? `<p class="prazo atraso">${icone('warning')}Prometido para ${esc(quando(t.previsto, false))}.</p>` : ''}

        <div class="contacto">
          <div class="quem"><strong>${cl ? esc(cl.nome) : 'Sem cliente'}</strong><span>${cl && cl.telemovel ? esc(telFormatar(cl.telemovel)) : 'sem telemóvel'}</span></div>
          ${cl && cl.telemovel ? `<a class="btn pequeno" href="tel:${esc(soDigitos(cl.telemovel))}">${icone('phone')}Ligar</a>` : ''}
          ${cl ? `<button class="btn texto pequeno" type="button" data-abrir="cliente" data-id="${cl.id}">Ficha do cliente</button>` : ''}
          ${c ? `<button class="btn texto pequeno" type="button" data-abrir="carro" data-id="${c.id}">Ficha do carro</button>` : ''}
        </div>

        ${escolhaServico(t.servico)}
        ${area('descricao', 'O que se passa', t.descricao, { opcional: true })}
        ${area('notas', 'Notas da oficina', t.notas, { opcional: true, ph: 'Peças, o que foi feito, o que falta.' })}

        <fieldset class="grupo">
          <legend>Horas</legend>
          <label class="campo"><span>Estado</span><select name="estado">${ORDEM.map((e) => `<option value="${e}"${e === t.estado ? ' selected' : ''}>${ESTADOS[e].nome}</option>`).join('')}</select></label>
          <div class="linha-campos">
            ${campo('entrada', 'Chegou', paraInput(t.entrada), { tipo: 'datetime-local' })}
            ${campo('inicio', 'Começou', paraInput(t.inicio), { tipo: 'datetime-local' })}
            ${campo('pronto', 'Pronto', paraInput(t.pronto), { tipo: 'datetime-local' })}
            ${campo('entregue', 'Entregue', paraInput(t.entregue), { tipo: 'datetime-local' })}
          </div>
          ${campo('previsto', 'Prometido para', t.previsto ? String(t.previsto).slice(0, 10) : '', { tipo: 'date', opcional: true })}
        </fieldset>
        <p><button class="btn perigo pequeno" type="button" data-apagar-trabalho>${icone('trash')}Apagar este trabalho</button></p>
      </div>
      <footer class="painel-pe">
        <button class="btn" type="submit">Guardar</button>
        <div class="direita">${prox ? `<button class="btn ${cls}" type="button" data-avancar="${t.id}">${ESTADOS[t.estado].acao}</button>` : ''}</div>
      </footer>
    </form>`;
  }

  function dadosTrabalho(f, t) {
    const d = {
      servico: (f.querySelector('input[name="servico"]:checked') || {}).value || t.servico || '',
      descricao: f.descricao.value.trim(), notas: f.notas.value.trim(), estado: f.estado.value,
      entrada: deInput(f.entrada.value), inicio: deInput(f.inicio.value), pronto: deInput(f.pronto.value), entregue: deInput(f.entregue.value),
      previsto: f.previsto.value || '',
    };
    // Mudou o estado à mão: carimba as horas que faltam até lá.
    const n = ORDEM.indexOf(d.estado);
    ORDEM.slice(1, n + 1).forEach((e) => { const k = CARIMBO_DE[e]; if (!d[k]) d[k] = agoraTexto(); });
    return d;
  }

  function ligarTrabalho() {
    const f = $('[data-form="trabalho"]', painel);
    const t = idx.trabalho.get(f.dataset.id);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = dadosTrabalho(f, t);
      const mudou = Object.keys(d).filter((k) => (t[k] || '') !== d[k]);
      fecharPainel();
      if (mudou.length) gravar([{ op: 'atualizar', tabela: 'trabalhos', id: t.id, dados: d }], 'Guardado.');
    });
    $('[data-apagar-trabalho]', f).addEventListener('click', () => {
      const c = carroDe(t);
      if (!confirm(`Apagar este trabalho${c ? ' do ' + c.matricula : ''}? Sai também da sheet.`)) return;
      fecharPainel();
      gravar([{ op: 'apagar', tabela: 'trabalhos', id: t.id }], 'Trabalho apagado.');
    });
  }

  function avancar(id) {
    const t = idx.trabalho.get(id);
    if (!t) return;
    const prox = seguinte(t.estado);
    if (!prox) return;
    const dados = { estado: prox, [CARIMBO_DE[prox]]: agoraTexto() };
    // Se ficou algo por carimbar (ex.: marcar pronto sem ter começado), usa a hora de agora.
    if (prox === 'pronto' && !t.inicio) dados.inicio = t.entrada || agoraTexto();
    // Dentro do painel, guarda também o que foi escrito.
    if (painelAtual && painelAtual.tipo === 'trabalho' && painelAtual.id === id) {
      const f = $('[data-form="trabalho"]', painel);
      Object.assign(dados, { ...dadosTrabalho(f, t), ...dados });
      fecharPainel();
    }
    const c = carroDe(t);
    const msg = { curso: 'começou', pronto: 'está pronto', entregue: 'foi entregue' }[prox];
    gravar([{ op: 'atualizar', tabela: 'trabalhos', id, dados }], `${c ? c.matricula : 'O carro'} ${msg}.`);
  }

  // --- Cliente
  function painelCliente({ id } = {}) {
    const c = id ? idx.cliente.get(id) : null;
    const carros = c ? idx.carrosDoCliente.get(c.id) || [] : [];
    const hist = c ? trabalhosDoCliente(c.id) : [];
    return `<form class="painel-forma" data-form="cliente" data-id="${c ? c.id : ''}" novalidate>
      ${cabecaPainel(c ? esc(c.nome) : 'Novo cliente', c ? `${hist.length} ${hist.length === 1 ? 'visita' : 'visitas'}${hist[0] ? ', a última ' + esc(quando(hist[0].entrada, false)) : ''}` : '')}
      <div class="painel-corpo" tabindex="-1">
        ${c && c.telemovel ? `<p><a class="btn pequeno" href="tel:${esc(soDigitos(c.telemovel))}">${icone('phone')}Ligar ${esc(telFormatar(c.telemovel))}</a></p>` : ''}
        <div class="grupo">
          ${campo('nome', 'Nome', c ? c.nome : '', { obrig: true, foco: !c })}
          <div class="linha-campos">
            ${campo('telemovel', 'Telemóvel', c ? telFormatar(c.telemovel) : '', { tipo: 'tel', ph: '912 345 678', extra: ' inputmode="tel"' })}
            ${campo('nif', 'NIF', c ? c.nif : '', { opcional: true, extra: ' inputmode="numeric" maxlength="9"' })}
          </div>
          ${campo('email', 'Email', c ? c.email : '', { tipo: 'email', opcional: true })}
          ${area('notas', 'Notas', c ? c.notas : '', { opcional: true, linhas: 2 })}
        </div>
        ${c ? `
        <section class="grupo"><h3 class="titulo-grupo">Carros</h3>
          ${carros.length ? `<div class="lista-carros">${carros.map((k) => `<button type="button" data-abrir="carro" data-id="${k.id}">${placa(k.matricula)}<span class="c-info"><strong>${esc(nomeCarro(k))}</strong><span>${[k.ano, k.km ? Number(k.km).toLocaleString('pt-PT') + ' km' : ''].filter(Boolean).join(', ')}</span></span>${icone('caret-right')}</button>`).join('')}</div>` : '<p class="historico-vazio">Sem carros.</p>'}
          <p><button class="btn pequeno" type="button" data-abrir="carro" data-cliente="${c.id}">${icone('plus')}Juntar carro</button></p>
        </section>
        <section class="grupo"><h3 class="titulo-grupo">Visitas</h3>${historicoHtml(hist, true)}</section>
        <p><button class="btn perigo pequeno" type="button" data-apagar-cliente>${icone('trash')}Apagar cliente</button></p>` : ''}
        <p class="campo"><span class="erro-campo" data-erro-form hidden></span></p>
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${c ? 'Guardar' : 'Criar cliente'}</button></div></footer>
    </form>`;
  }

  function ligarCliente() {
    const f = $('[data-form="cliente"]', painel);
    const c = f.dataset.id ? idx.cliente.get(f.dataset.id) : null;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = f.nome.value.trim();
      const erro = $('[data-erro-form]', f);
      if (!nome) { erro.textContent = 'Escreva o nome do cliente.'; erro.hidden = false; f.nome.setAttribute('aria-invalid', 'true'); f.nome.focus(); return; }
      const d = { nome, telemovel: soDigitos(f.telemovel.value) || f.telemovel.value.trim(), nif: soDigitos(f.nif.value), email: f.email.value.trim(), notas: f.notas.value.trim() };
      fecharPainel();
      if (c) gravar([{ op: 'atualizar', tabela: 'clientes', id: c.id, dados: d }], 'Cliente guardado.');
      else { const id = novoId(); gravar([{ op: 'criar', tabela: 'clientes', id, dados: { ...d, criado_em: agoraTexto() } }], `${nome} foi criado.`); }
    });
    const apagar = $('[data-apagar-cliente]', f);
    if (apagar) apagar.addEventListener('click', () => {
      const carros = idx.carrosDoCliente.get(c.id) || [];
      if (carros.length) {
        const erro = $('[data-erro-form]', f);
        erro.textContent = `${c.nome} tem ${carros.length === 1 ? 'um carro' : carros.length + ' carros'}. Passe-${carros.length === 1 ? 'o' : 'os'} para outro cliente ou apague-${carros.length === 1 ? 'o' : 'os'} primeiro.`;
        erro.hidden = false;
        return;
      }
      if (!confirm(`Apagar ${c.nome}? Sai também da sheet.`)) return;
      fecharPainel();
      gravar([{ op: 'apagar', tabela: 'clientes', id: c.id }], 'Cliente apagado.');
    });
  }

  // --- Carro
  function painelCarro({ id, cliente: clienteId } = {}) {
    const k = id ? idx.carro.get(id) : null;
    const hist = k ? idx.trabalhosDoCarro.get(k.id) || [] : [];
    const dono = k ? k.cliente_id : clienteId || '';
    const clientes = [...st.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    const naOficina = hist.find((t) => t.estado !== 'entregue');
    return `<form class="painel-forma" data-form="carro" data-id="${k ? k.id : ''}" novalidate>
      ${cabecaPainel(k ? esc(nomeCarro(k)) : 'Novo carro', k ? `${hist.length} ${hist.length === 1 ? 'visita' : 'visitas'}` : '', k ? `<div style="margin-bottom:10px">${placa(k.matricula, true)}</div>` : '')}
      <div class="painel-corpo" tabindex="-1">
        ${k ? (naOficina
          ? `<p><button class="btn pequeno" type="button" data-abrir="trabalho" data-id="${naOficina.id}"><span class="ponto" data-estado="${naOficina.estado}" aria-hidden="true"></span>Na oficina: ${esc(ESTADOS[naOficina.estado].nome.toLowerCase())}</button></p>`
          : `<p><button class="btn pequeno primario" type="button" data-abrir="entrada" data-carro="${k.id}">${icone('plus')}Dar entrada a este carro</button></p>`) : ''}
        <div class="grupo">
          ${campo('matricula', 'Matrícula', k ? k.matricula : '', { classe: 'campo-matricula', ph: 'AA-00-AA', obrig: true, foco: !k, extra: ' autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12"' })}
          <div class="linha-campos tres">
            ${campo('marca', 'Marca', k ? k.marca : '')}
            ${campo('modelo', 'Modelo', k ? k.modelo : '')}
            ${campo('ano', 'Ano', k ? k.ano : '', { extra: ' inputmode="numeric" maxlength="4"' })}
          </div>
          ${campo('km', 'Quilómetros', k ? k.km : '', { opcional: true, extra: ' inputmode="numeric"' })}
          <label class="campo"><span>Cliente</span><select name="cliente_id"><option value="">Sem cliente</option>${clientes.map((c) => `<option value="${c.id}"${c.id === dono ? ' selected' : ''}>${esc(c.nome)}${c.telemovel ? ' (' + esc(telFormatar(c.telemovel)) + ')' : ''}</option>`).join('')}</select></label>
          ${area('notas', 'Notas', k ? k.notas : '', { opcional: true, linhas: 2 })}
        </div>
        ${k ? `<section class="grupo"><h3 class="titulo-grupo">Visitas</h3>${historicoHtml(hist)}</section>
        <p><button class="btn perigo pequeno" type="button" data-apagar-carro>${icone('trash')}Apagar carro</button></p>` : ''}
        <p class="campo"><span class="erro-campo" data-erro-form hidden></span></p>
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">${k ? 'Guardar' : 'Criar carro'}</button></div></footer>
    </form>`;
  }

  function ligarCarro() {
    const f = $('[data-form="carro"]', painel);
    const k = f.dataset.id ? idx.carro.get(f.dataset.id) : null;
    const erro = $('[data-erro-form]', f);
    f.matricula.addEventListener('blur', () => { f.matricula.value = matFormatar(f.matricula.value); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const matricula = matFormatar(f.matricula.value);
      const outro = idx.carroPorMat.get(matChave(matricula));
      if (matChave(matricula).length < 4) { erro.textContent = 'Escreva a matrícula.'; erro.hidden = false; f.matricula.focus(); return; }
      if (outro && (!k || outro.id !== k.id)) { erro.textContent = `Já existe um carro com a matrícula ${outro.matricula}.`; erro.hidden = false; f.matricula.focus(); return; }
      const d = { matricula, marca: f.marca.value.trim(), modelo: f.modelo.value.trim(), ano: soDigitos(f.ano.value), km: soDigitos(f.km.value), cliente_id: f.cliente_id.value, notas: f.notas.value.trim() };
      fecharPainel();
      if (k) gravar([{ op: 'atualizar', tabela: 'carros', id: k.id, dados: d }], 'Carro guardado.');
      else gravar([{ op: 'criar', tabela: 'carros', id: novoId(), dados: { ...d, criado_em: agoraTexto() } }], `${matricula} foi criado.`);
    });
    const apagar = $('[data-apagar-carro]', f);
    if (apagar) apagar.addEventListener('click', () => {
      const n = (idx.trabalhosDoCarro.get(k.id) || []).length;
      if (!confirm(n ? `Apagar ${k.matricula} e as suas ${n === 1 ? 'uma visita' : n + ' visitas'}? Saem também da sheet.` : `Apagar ${k.matricula}? Sai também da sheet.`)) return;
      fecharPainel();
      gravar([
        ...(idx.trabalhosDoCarro.get(k.id) || []).map((t) => ({ op: 'apagar', tabela: 'trabalhos', id: t.id })),
        { op: 'apagar', tabela: 'carros', id: k.id },
      ], 'Carro apagado.');
    });
  }

  // --- Ligação à Google Sheet
  function painelLigacao() {
    const l = ler('ig.ligacao', {});
    const url = l.apiUrl || CFG.apiUrl || '';
    const precisaPin = st.codigoErro === 'pin' || st.codigoErro === 'sem-pin';
    return `<form class="painel-forma" data-form="ligacao" novalidate>
      ${cabecaPainel('Ligação à Google Sheet', 'A sheet INOVACAR Pontos guarda tudo, em três abas próprias.')}
      <div class="painel-corpo">
        ${precisaPin ? `<p class="estado-ligacao erro">${esc(st.erro)}</p>` : ''}
        <div class="grupo">
          ${campo('apiUrl', 'URL da aplicação web', url, { tipo: 'url', ph: 'https://script.google.com/macros/s/.../exec', foco: !url, ajuda: CFG.apiUrl ? 'Já vem do ficheiro config.js. Só muda se escrever outro aqui.' : '' })}
          ${campo('pin', 'PIN', l.pin || '', { tipo: 'password', foco: !!url, extra: ' autocomplete="current-password"', ajuda: 'O PIN escrito no Apps Script. Fica só neste aparelho.' })}
        </div>
        <p class="estado-ligacao" data-estado-ligacao hidden></p>
        <section class="grupo">
          <h3 class="titulo-grupo">Como ligar (uma vez)</h3>
          <ol class="passos">
            <li>Em <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a>, crie um projeto novo e cole o ficheiro <code>apps-script/Codigo.gs</code>.</li>
            <li>No topo do ficheiro, troque <code>mude-este-pin</code> por um PIN seu.</li>
            <li>Implementar, Nova implementação, Aplicação Web. Executar como: Eu. Acesso: Qualquer pessoa.</li>
            <li>Autorize o acesso à sheet e copie o URL que acaba em <code>/exec</code> para aqui.</li>
          </ol>
        </section>
        ${url ? '<p><button class="btn perigo pequeno" type="button" data-usar-demo>Desligar e ver a demonstração</button></p>' : ''}
      </div>
      <footer class="painel-pe"><div class="direita"><button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="submit">Testar e ligar</button></div></footer>
    </form>`;
  }

  function ligarLigacao() {
    const f = $('[data-form="ligacao"]', painel);
    const estado = $('[data-estado-ligacao]', f);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const apiUrl = f.apiUrl.value.trim(), pin = f.pin.value;
      const btn = $('button[type="submit"]', f);
      const mostra = (txt, cls) => { estado.textContent = txt; estado.className = 'estado-ligacao ' + (cls || ''); estado.hidden = false; };
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(apiUrl)) return mostra('O URL deve começar por https://script.google.com/macros/s/ e acabar em /exec.', 'erro');
      if (!pin) return mostra('Escreva o PIN.', 'erro');
      btn.setAttribute('aria-busy', 'true');
      mostra('A testar...');
      const antes = ler('ig.ligacao', {});
      guardar('ig.ligacao', { apiUrl, pin });
      try {
        const j = await chamar({ action: 'listar' });
        mostra(`Ligado. ${j.clientes.length} clientes, ${j.carros.length} carros e ${j.trabalhos.length} trabalhos na sheet.`, 'ok');
        if (antes.apiUrl !== apiUrl) { st.pendentes = []; guardar('ig.pendentes', []); }
        st.erro = null; st.codigoErro = null; st.carregado = false;
        setTimeout(() => { fecharPainel(); carregar(); }, 700);
      } catch (err) {
        guardar('ig.ligacao', antes);
        mostra(err.codigo === 'pin' ? 'PIN errado. Confirme o PIN no topo do Apps Script.' : err.message || 'Não foi possível ligar. Confirme o URL /exec e que o acesso é Qualquer pessoa.', 'erro');
      } finally {
        btn.removeAttribute('aria-busy');
      }
    });
    const demoBtn = $('[data-usar-demo]', f);
    if (demoBtn) demoBtn.addEventListener('click', () => {
      if (CFG.apiUrl) { toast('O URL vem do config.js: tire-o de lá para ver a demonstração.'); return; }
      guardar('ig.ligacao', {});
      st.pendentes = []; guardar('ig.pendentes', []);
      st.erro = null; st.carregado = false;
      fecharPainel();
      carregar();
    });
  }

  function ligarPainel(tipo) {
    ({ entrada: ligarEntrada, trabalho: ligarTrabalho, cliente: ligarCliente, carro: ligarCarro, ligacao: ligarLigacao }[tipo] || (() => {}))();
  }

  // ---------------------------------------------------------------- toast
  let tToast;
  function toast(msg) {
    const el = $('[data-toast]');
    el.innerHTML = `${icone('check')}<span>${esc(msg)}</span>`;
    el.hidden = false;
    clearTimeout(tToast);
    tToast = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // ---------------------------------------------------------------- eventos
  document.addEventListener('click', (e) => {
    const abrir = e.target.closest('[data-abrir]');
    if (abrir) {
      e.preventDefault();
      abrirPainel(abrir.dataset.abrir, { id: abrir.dataset.id, carroId: abrir.dataset.carro, cliente: abrir.dataset.cliente });
      return;
    }
    const linha = e.target.closest('[data-abrir-linha]');
    if (linha) { abrirPainel(linha.dataset.abrirLinha, { id: linha.dataset.id }); return; }
    const av = e.target.closest('[data-avancar]');
    if (av) { avancar(av.dataset.avancar); return; }
    if (e.target.closest('[data-fechar]')) { fecharPainel(); return; }
    const fx = e.target.closest('[data-faixa]');
    if (fx) { st.faixa = fx.dataset.faixa; desenhar(); return; }
    const pr = e.target.closest('[data-periodo]');
    if (pr) { st.periodo = pr.dataset.periodo; desenhar(); return; }
    if (e.target.closest('[data-acao="recarregar"]')) { st.erro = null; carregar(); }
  });
  document.addEventListener('keydown', (e) => {
    const linha = e.target.closest && e.target.closest('[data-abrir-linha]');
    if (linha && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirPainel(linha.dataset.abrirLinha, { id: linha.dataset.id }); }
    if (e.key === '/' && !painel.open && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      const b = $('[data-busca]');
      if (b) { e.preventDefault(); b.focus(); }
    }
  });
  document.addEventListener('input', (e) => {
    const b = e.target.closest('[data-busca]');
    if (b) { st.busca[b.dataset.busca] = b.value; desenhar(); }
  });
  window.addEventListener('hashchange', () => { fecharPainel(); desenhar(); $('[data-conteudo]').focus({ preventScroll: true }); window.scrollTo(0, 0); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carregar({ silencioso: true }); });
  window.addEventListener('online', () => enviar());

  // O tempo corre: os cartões dizem há quanto tempo, por isso redesenha-se de minuto a minuto.
  setInterval(() => { if (!painel.open && !(document.activeElement && document.activeElement.matches('[data-busca]'))) desenhar(); }, 60000);
  setInterval(() => { if (document.visibilityState === 'visible' && !painel.open) carregar({ silencioso: true }); }, Math.max(20, CFG.atualizarCada || 60) * 1000);

  // ---------------------------------------------------------------- arranque
  $('[data-abrir="ligacao"]').innerHTML = icone('gear');
  $$('[data-icone]').forEach((el) => { el.outerHTML = icone(el.dataset.icone); });
  const cache = ler('ig.cache', null);
  if (!emDemo() && cache && cache.url === ligacao().apiUrl) {
    Object.assign(st, { clientes: cache.clientes || [], carros: cache.carros || [], trabalhos: cache.trabalhos || [], carregado: true });
    indexar();
  }
  desenhar();
  if (!emDemo() && !ligacao().pin) abrirPainel('ligacao');
  else carregar();
})();
