/* Trail do Texugo — Modo teste da plataforma.
   Imita o Supabase dentro do próprio navegador, com dados de exemplo.
   Nada sai deste telemóvel/computador: não grava na base de dados verdadeira, a app não vê nada,
   e tudo volta ao início ao carregar em "Sair do modo teste". */
'use strict';

(function () {
  const CHAVE_ATIVO = 'texugoTeste', CHAVE_DADOS = 'texugoTesteDados';
  const EU = { email: 'teste@traildotexugo.pt', nome: 'Modo teste', papel: 'admin' };
  const ED = '2027';

  const agora = () => new Date().toISOString();
  const haMin = m => new Date(Date.now() - m * 60000).toISOString();
  const codigo = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(16).slice(2));

  function dadosIniciais() {
    const nomes = ['Ana Rosado', 'Bruno Calado', 'Carla Mendes', 'Diogo Bilro', 'Elsa Caeiro', 'Filipe Galego', 'Gonçalo Pinto',
      'Helena Charrua', 'Inês Mestre', 'João Pereira', 'Joana Bonito', 'Luís Grilo', 'Marta Ramalho', 'Miguel Raposo', 'Nuno Simões',
      'Patrícia Lopes', 'Pedro Fialho', 'Rita Bexiga', 'Rui Valente', 'Sara Vidigal', 'Sérgio Pataca', 'Sofia Lagarto', 'Tiago Serrano',
      'Vera Calvinho', 'Vítor Mira', 'André Correia', 'Beatriz Lobo', 'Carlos Brito', 'Daniela Faria', 'Eduardo Grave'];
    const percursos = ['Caminhada 10K', 'Trail Sprint 15K', 'Trail Longo 30K', 'Ultra Trail 46K'];
    const clubes = ['NAR', '', 'Os Amigos do Trail', 'GD Estremoz', '', 'Évora Runners', ''];
    const tamanhos = ['S', 'M', 'L', 'XL', 'M'];
    const inscritos = nomes.map((nome, i) => ({
      id: i + 1, edicao: ED, dorsal: 101 + i, nome, nascimento: `19${70 + (i * 7) % 30}-0${1 + i % 9}-1${i % 10}`,
      email: nome.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(' ', '.') + '@exemplo.pt',
      telefone: '91' + String(2345670 + i * 13), percurso: percursos[i % 4], escalao: i % 3 ? 'Sénior' : 'Veterano',
      clube: clubes[i % clubes.length], genero: i % 2 ? 'M' : 'F', tamanho_tshirt: tamanhos[i % 5],
      contacto_emergencia: 'Familiar 96' + String(1000000 + i * 37), notas: '', codigo: codigo(),
      checkin_em: i < 11 ? haMin(90 - i * 6) : null, checkin_por: i < 11 ? 'rececao@exemplo.pt' : null, importado_em: haMin(4000),
    }));
    const p = (dorsal, posto, km, tipo, min) => ({ edicao: ED, dorsal, posto, km, tipo, hora: haMin(min), registado_por: 'posto@exemplo.pt' });
    const passagens = [p(102, 'Partida', '0', 'partida', 75), p(103, 'Partida', '0', 'partida', 75), p(104, 'Partida', '0', 'partida', 75),
      p(102, 'São Gens', '8', 'passagem', 30), p(103, 'São Gens', '8', 'passagem', 26), p(104, 'Ermida', '14', 'passagem', 9),
      p(107, 'Ermida', '14', 'abandono', 5)].map((x, i) => ({ id: i + 1, ...x }));
    return {
      seq: 1000,
      trail_gestores: [EU, { email: 'ana@exemplo.pt', nome: 'Ana (exemplo)', papel: 'gestor' }, { email: 'rececao@exemplo.pt', nome: 'Receção (exemplo)', papel: 'rececao' }]
        .map(g => ({ ...g, criado_em: haMin(9000) })),
      trail_config: [{ id: 1, dados: { edicao: ED, nome: 'Trail do Texugo 2027', inscricoes: 'brevemente', modo: 'auto' }, atualizado_em: haMin(600), atualizado_por: EU.email }],
      trail_avisos: [
        { id: uuid(), titulo: 'Inscrições abrem a 1 de dezembro', texto: 'Marca na agenda: as inscrições para a edição de 2027 abrem dia 1 de dezembro às 21h, na Stop&Go.', categoria: 'inscricoes', imagem_url: null, link: null, estado: 'pendente', publicar_em: null, criado_por: 'ana@exemplo.pt', aprovado_por: null, criado_em: haMin(40), publicado_em: null },
        { id: uuid(), titulo: 'Obrigado, texugos!', texto: 'Mais de 600 atletas na Serra d\'Ossa. Até para o ano!', categoria: 'comunidade', imagem_url: null, link: null, estado: 'publicado', publicar_em: null, criado_por: 'ana@exemplo.pt', aprovado_por: EU.email, criado_em: haMin(30000), publicado_em: haMin(29990) },
        { id: uuid(), titulo: 'Resultados disponíveis', texto: 'As classificações já estão na app, no separador Pós-prova.', categoria: 'prova', imagem_url: null, link: null, estado: 'publicado', publicar_em: null, criado_por: EU.email, aprovado_por: 'ana@exemplo.pt', criado_em: haMin(31000), publicado_em: haMin(30900) },
      ],
      trail_inscritos: inscritos,
      trail_passagens: passagens,
      trail_resultados: [],
      trail_fotos: [{ id: 1, edicao: ED, url: 'texugo.png', dorsais: [102, 103], legenda: 'Foto de exemplo', criado_em: haMin(50), criado_por: EU.email }],
      trail_patrocinadores: [
        { id: 1, nome: 'Câmara Municipal de Redondo (exemplo)', logo_url: '', link: null, ordem: 1, ativo: true },
        { id: 2, nome: 'Patrocinador de exemplo', logo_url: '', link: null, ordem: 2, ativo: true },
      ],
      trail_voluntarios: [
        { id: 1, edicao: ED, nome: 'Manuel (exemplo)', telefone: '963000111', posto: 'São Gens', turno: '08:00–13:00', notas: '' },
        { id: 2, edicao: ED, nome: 'Teresa (exemplo)', telefone: '963000222', posto: 'Ermida', turno: '08:30–14:00', notas: 'Leva o carro' },
        { id: 3, edicao: ED, nome: 'Paulo (exemplo)', telefone: '963000333', posto: 'Meta', turno: 'Todo o dia', notas: '' },
      ],
      trail_sos: [
        { id: 1, dorsal: 104, nome: 'Diogo Bilro', telefone: '912345709', lat: 38.6905, lon: -7.5530, mensagem: 'Torci o tornozelo depois da Ermida', criado_em: haMin(3), resolvido: false, resolvido_por: null },
        { id: 2, dorsal: 107, nome: 'Helena Charrua', telefone: '912345761', lat: 38.6950, lon: -7.5620, mensagem: 'Pedido de ajuda pela app', criado_em: haMin(25), resolvido: true, resolvido_por: EU.email },
      ],
      trail_inquerito: [
        { id: 1, edicao: ED, nota: 5, gostou: 'Os abastecimentos e a paisagem!', melhorar: '', voltaria: true, criado_em: haMin(20000) },
        { id: 2, edicao: ED, nota: 4, gostou: 'Marcação do percurso', melhorar: 'Mais casas de banho na partida', voltaria: true, criado_em: haMin(19000) },
        { id: 3, edicao: ED, nota: 5, gostou: 'Ambiente da meta', melhorar: 'Estacionamento', voltaria: true, criado_em: haMin(18000) },
      ],
      trail_registo: [
        { id: 1, quem: EU.email, acao: 'entrou em modo teste', detalhe: 'dados de exemplo', quando: agora() },
        { id: 2, quem: 'ana@exemplo.pt', acao: 'criou comunicado', detalhe: 'Inscrições abrem a 1 de dezembro', quando: haMin(40) },
      ],
    };
  }

  let db;
  try { db = JSON.parse(sessionStorage.getItem(CHAVE_DADOS)); } catch { db = null; }
  if (!db) db = dadosIniciais();
  const guardar = () => { try { sessionStorage.setItem(CHAVE_DADOS, JSON.stringify(db)); } catch {} };

  const PADROES = {
    trail_avisos: () => ({ id: uuid(), texto: '', categoria: 'geral', imagem_url: null, link: null, estado: 'pendente', publicar_em: null, criado_por: EU.email, aprovado_por: null, criado_em: agora(), publicado_em: null }),
    trail_registo: () => ({ quem: EU.email, detalhe: '', quando: agora() }),
    trail_inscritos: () => ({ codigo: codigo(), checkin_em: null, checkin_por: null, importado_em: agora(), percurso: '', clube: '', tamanho_tshirt: '' }),
    trail_passagens: () => ({ km: '', tipo: 'passagem', hora: agora(), registado_por: EU.email }),
    trail_fotos: () => ({ dorsais: [], legenda: '', criado_em: agora(), criado_por: EU.email }),
    trail_gestores: () => ({ nome: '', papel: 'gestor', criado_em: agora() }),
    trail_patrocinadores: () => ({ logo_url: '', link: null, ordem: 0, ativo: true }),
  };
  const CHAVES = { trail_inscritos: ['edicao', 'dorsal'], trail_resultados: ['edicao', 'dorsal'], trail_gestores: ['email'], trail_config: ['id'] };

  function tabela(nome) {
    if (nome === 'trail_direto') {
      return db.trail_passagens.map(p => {
        const i = db.trail_inscritos.find(x => x.edicao === p.edicao && x.dorsal === p.dorsal);
        return { edicao: p.edicao, dorsal: p.dorsal, nome: i?.nome || '', percurso: i?.percurso || '', posto: p.posto, km: p.km, tipo: p.tipo, hora: p.hora };
      });
    }
    if (nome === 'trail_avisos_publicos') return db.trail_avisos.filter(a => a.estado === 'publicado');
    return (db[nome] = db[nome] || []);
  }
  const novo = (nome, linha) => {
    const base = PADROES[nome] ? PADROES[nome]() : {};
    const r = { ...base, ...linha };
    if (r.id == null && nome !== 'trail_gestores') r.id = ++db.seq;
    return r;
  };

  function consulta(nome) {
    let acao = 'select', valores = null, opcoes = {}, contar = false, soContar = false, um = null;
    const filtros = [], ordens = []; let limite = null;
    const b = {
      select(_c, o = {}) { if (acao === 'select') { contar = !!o.count; soContar = !!o.head; } return b; },
      eq(k, v) { filtros.push(r => r[k] === v || String(r[k]) === String(v)); return b; },
      neq(k, v) { filtros.push(r => r[k] !== v); return b; },
      not(k, op, v) { filtros.push(r => op === 'is' && v === null ? r[k] != null : r[k] !== v); return b; },
      is(k, v) { filtros.push(r => (v === null ? r[k] == null : r[k] === v)); return b; },
      in(k, l) { filtros.push(r => l.includes(r[k])); return b; },
      order(k, o = {}) { ordens.push([k, o.ascending !== false]); return b; },
      limit(n) { limite = n; return b; },
      single() { um = 'single'; return b; },
      maybeSingle() { um = 'maybe'; return b; },
      insert(v) { acao = 'insert'; valores = v; return b; },
      update(v) { acao = 'update'; valores = v; return b; },
      delete() { acao = 'delete'; return b; },
      upsert(v, o = {}) { acao = 'upsert'; valores = v; opcoes = o; return b; },
      then(ok, erro) { return Promise.resolve().then(executar).then(ok, erro); },
    };
    const passa = r => filtros.every(f => f(r));
    function executar() {
      const t = tabela(nome);
      if (acao === 'insert') {
        const l = (Array.isArray(valores) ? valores : [valores]).map(v => novo(nome, v));
        t.push(...l); guardar(); return { data: l, error: null };
      }
      if (acao === 'upsert') {
        const chave = opcoes.onConflict ? opcoes.onConflict.split(',').map(s => s.trim()) : (CHAVES[nome] || ['id']);
        for (const v of (Array.isArray(valores) ? valores : [valores])) {
          const i = t.findIndex(r => chave.every(k => String(r[k]) === String(v[k])));
          if (i >= 0) t[i] = { ...t[i], ...v }; else t.push(novo(nome, v));
        }
        guardar(); return { data: null, error: null };
      }
      if (acao === 'update') {
        t.forEach((r, i) => { if (passa(r)) t[i] = { ...r, ...valores }; });
        guardar(); return { data: null, error: null };
      }
      if (acao === 'delete') {
        const ficam = t.filter(r => !passa(r)); t.length = 0; t.push(...ficam);
        guardar(); return { data: null, error: null };
      }
      let l = t.filter(passa).map(r => JSON.parse(JSON.stringify(r)));
      if (ordens.length) l.sort((a, b2) => {
        for (const [k, asc] of ordens) {
          const x = a[k] ?? '', y = b2[k] ?? '';
          if (x < y) return asc ? -1 : 1; if (x > y) return asc ? 1 : -1;
        }
        return 0;
      });
      const total = l.length;
      if (limite != null) l = l.slice(0, limite);
      if (um) {
        if (um === 'single' && !l.length) return { data: null, error: { message: 'Não encontrado (modo teste)' } };
        return { data: l[0] || null, error: null };
      }
      return { data: soContar ? null : l, error: null, count: contar ? total : null };
    }
    return b;
  }

  async function rpc(nome, a = {}) {
    if (nome === 'trail_aprovar_aviso') {
      const av = db.trail_avisos.find(x => x.id === a.p_id);
      if (!av) return { data: null, error: { message: 'Comunicado não existe' } };
      if (av.criado_por === EU.email && av.categoria !== 'urgente') return { data: null, error: { message: 'Tem de ser aprovado por outro gestor' } };
      Object.assign(av, { estado: 'publicado', aprovado_por: EU.email, publicado_em: agora() });
      db.trail_registo.push(novo('trail_registo', { acao: 'aprovou comunicado', detalhe: av.titulo }));
      guardar(); return { data: null, error: null };
    }
    if (nome === 'trail_fazer_checkin') {
      const i = db.trail_inscritos.find(x => x.edicao === String(a.p_edicao) && x.dorsal === Number(a.p_dorsal));
      const linha = r => ({ resultado: r, dorsal: i ? i.dorsal : a.p_dorsal, nome: i?.nome || '', percurso: i?.percurso || '', tshirt: i?.tamanho_tshirt || '', checkin_em: i?.checkin_em || null, checkin_por: i?.checkin_por || null });
      if (!i) return { data: [linha('nao_existe')], error: null };
      if (a.p_codigo && a.p_codigo !== i.codigo) return { data: [linha('codigo_invalido')], error: null };
      if (i.checkin_em) return { data: [linha('ja_feito')], error: null };
      i.checkin_em = agora(); i.checkin_por = EU.email;
      db.trail_registo.push(novo('trail_registo', { acao: 'check-in', detalhe: '#' + i.dorsal + ' ' + i.nome }));
      guardar(); return { data: [linha('ok')], error: null };
    }
    return { data: null, error: null };
  }

  const ficheiros = {};
  const cliente = {
    from: consulta,
    rpc,
    auth: {
      getSession: async () => ({ data: { session: { user: { email: EU.email } } } }),
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => { sair(); return { error: null }; },
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async (nome, f) => { ficheiros[nome] = URL.createObjectURL(f); return { data: { path: nome }, error: null }; },
        getPublicUrl: nome => ({ data: { publicUrl: ficheiros[nome] || 'texugo.png' } }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
  };

  function sair() {
    sessionStorage.removeItem(CHAVE_ATIVO); sessionStorage.removeItem(CHAVE_DADOS);
    location.href = location.pathname;
  }

  window.ModoTeste = {
    ativo: sessionStorage.getItem(CHAVE_ATIVO) === '1',
    cliente,
    entrar() { sessionStorage.setItem(CHAVE_ATIVO, '1'); sessionStorage.removeItem(CHAVE_DADOS); location.reload(); },
    sair,
    recomecar() { sessionStorage.removeItem(CHAVE_DADOS); location.reload(); },
    mostrarFaixa() {
      const f = document.createElement('div');
      f.className = 'faixa-teste';
      f.innerHTML = `<span>🧪 <b>MODO TESTE</b> · dados de exemplo, nada é gravado nem chega à app</span>
        <button type="button" id="teste-recomecar">Recomeçar</button><button type="button" id="teste-sair">Sair</button>`;
      document.body.prepend(f);
      f.querySelector('#teste-recomecar').onclick = () => window.ModoTeste.recomecar();
      f.querySelector('#teste-sair').onclick = () => window.ModoTeste.sair();
    },
  };
})();
