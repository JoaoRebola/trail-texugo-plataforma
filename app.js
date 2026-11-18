/* Trail do Texugo — Plataforma de gestão.
   Página simples (sem servidor próprio) que fala com o Supabase.
   Tudo o que aqui se publica aparece na app sem ser preciso uma versão nova. */
'use strict';

const cfg = window.TEXUGO || {};
const emTeste = !!window.ModoTeste?.ativo;   // "Experimentar em modo teste": dados de exemplo, nada é gravado
const sb = emTeste ? window.ModoTeste.cliente
  : (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase)
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
if (emTeste) window.ModoTeste.mostrarFaixa();

const $ = s => document.querySelector(s);
const ecra = $('#ecra');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dataHora = d => d ? new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

let eu = null;          // { email, nome, papel }
let edicao = null;      // dados da edição (trail_config.dados)
const historico = [];
let pararAtual = null;  // função para parar câmara / temporizadores do ecrã atual

function toast(msg, erro = false) {
  const t = $('#aviso');
  t.textContent = msg; t.className = 'toast' + (erro ? ' erro' : ''); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, erro ? 6000 : 3000);
}
const falha = e => { console.error(e); toast(e?.message || 'Algo correu mal. Tenta outra vez.', true); };

async function q(promessa) {
  const { data, error } = await promessa;
  if (error) throw error;
  return data;
}

function ir(nome, ...args) {
  if (pararAtual) { try { pararAtual(); } catch {} pararAtual = null; }
  // recarregar o mesmo ecrã (ex.: depois de aprovar) não cria um passo extra no "voltar"
  if (historico.length && historico[historico.length - 1][0] === nome) historico.pop();
  historico.push([nome, args]);
  $('#voltar').hidden = historico.length <= 1;
  window.scrollTo({ top: 0 });
  ecra.style.animation = 'none'; void ecra.offsetWidth; ecra.style.animation = '';
  Promise.resolve().then(() => (ECRAS[nome] || ECRAS.inicio)(...args)).catch(falha);
}
$('#voltar').onclick = () => {
  historico.pop();
  const [nome, args] = historico.pop() || ['inicio', []];
  ir(nome, ...args);
};

const pode = (...papeis) => eu && papeis.includes(eu.papel);
const registo = (acao, detalhe = '') => sb.from('trail_registo').insert({ acao, detalhe: String(detalhe).slice(0, 300) }).then(() => {});

/* ---------------------------------------------------------------- CSV */
function lerCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const primeira = texto.split(/\r?\n/)[0] || '';
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';'
    : (primeira.match(/\t/g) || []).length > (primeira.match(/,/g) || []).length ? '\t' : ',';
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some(x => x.trim() !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo); if (linha.some(x => x.trim() !== '')) linhas.push(linha);
  return linhas;
}
const semAcentos = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function coluna(cabecalho, ...nomes) {
  const c = cabecalho.map(semAcentos);
  for (const n of nomes) { const i = c.findIndex(x => x === n); if (i >= 0) return i; }
  for (const n of nomes) { const i = c.findIndex(x => x.includes(n)); if (i >= 0) return i; }
  return -1;
}
function dataISO(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function descarregarCSV(nome, linhas) {
  const txt = '﻿' + linhas.map(l => l.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' })); a.download = nome; a.click();
}

/* ---------------------------------------------------------------- Entrada */
async function arrancar() {
  if (!sb) {
    ecra.innerHTML = `<div class="entrada-login"><img src="texugo.png" alt=""><h1>Falta ligar ao <em>Supabase</em></h1>
      <p class="nota">Preenche o ficheiro <b>config.js</b> com o endereço e a chave pública do projeto (ver Supabase/LEIA-ME.md).</p>
      <button class="btn contorno" id="teste">🧪 Experimentar em modo teste</button></div>`;
    $('#teste').onclick = () => window.ModoTeste.entrar();
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return ECRAS.login();
  const email = session.user.email.toLowerCase();
  const g = await sb.from('trail_gestores').select('*').eq('email', email).maybeSingle();
  if (!g.data) {
    ecra.innerHTML = `<div class="entrada-login"><img src="texugo.png" alt=""><h1>Ainda não tens <em>acesso.</em></h1>
      <p class="nota">A conta <b>${esc(email)}</b> entrou, mas ainda não é gestora. Pede a um administrador para te juntar em "Gestores".</p>
      <button class="btn contorno" id="sair">Sair</button></div>`;
    $('#sair').onclick = () => sb.auth.signOut().then(() => location.reload());
    return;
  }
  eu = g.data;
  $('#quem').innerHTML = `${esc(eu.nome || eu.email)}<br><small>${esc(eu.papel)}</small>`;
  edicao = (await q(sb.from('trail_config').select('dados').eq('id', 1).single())).dados || {};
  ir('inicio');
}

const ECRAS = {};

ECRAS.login = () => {
  ecra.innerHTML = `<div class="entrada-login">
    <img src="texugo.png" alt="">
    <p class="sobre">Plataforma da organização</p>
    <h1>Liberta o teu <em>Texugo.</em></h1>
    <div class="cartao" style="text-align:left">
      <label>Email</label><input id="em" type="email" autocomplete="email">
      <label>Palavra-passe</label><input id="pw" type="password" autocomplete="current-password">
      <div class="linha" style="margin-top:16px">
        <button class="btn cresce" id="entrar">Entrar</button>
        <button class="btn contorno" id="criar">Criar conta</button>
      </div>
      <p class="nota" style="margin-top:14px"><a href="#" id="esqueci">Esqueci-me da palavra-passe</a></p>
    </div>
    <p class="nota">Só os gestores registados pela organização conseguem gerir.</p>
    <button class="btn contorno" id="teste" style="margin-top:8px">🧪 Experimentar em modo teste</button>
    <p class="nota" style="font-size:12px">Abre a plataforma com dados de exemplo, sem conta. Nada é gravado nem chega à app.</p></div>`;
  $('#teste').onclick = () => window.ModoTeste.entrar();
  const em = () => $('#em').value.trim(), pw = () => $('#pw').value;
  $('#entrar').onclick = () => sb.auth.signInWithPassword({ email: em(), password: pw() })
    .then(({ error }) => error ? toast('Email ou palavra-passe errados.', true) : arrancar());
  $('#pw').onkeydown = e => { if (e.key === 'Enter') $('#entrar').click(); };
  $('#criar').onclick = () => {
    if (pw().length < 8) return toast('A palavra-passe tem de ter pelo menos 8 caracteres.', true);
    sb.auth.signUp({ email: em(), password: pw(), options: { emailRedirectTo: location.href.split('#')[0] } })
      .then(({ error }) => error ? falha(error) : toast('Conta criada. Confirma o email que te enviámos e depois entra.'));
  };
  $('#esqueci').onclick = e => {
    e.preventDefault();
    if (!em()) return toast('Escreve primeiro o teu email.', true);
    sb.auth.resetPasswordForEmail(em(), { redirectTo: location.href.split('#')[0] })
      .then(({ error }) => error ? falha(error) : toast('Enviámos-te um email para mudares a palavra-passe.'));
  };
};

sb?.auth.onAuthStateChange(evento => {
  if (evento === 'PASSWORD_RECOVERY') {
    const nova = prompt('Escreve a nova palavra-passe (mínimo 8 caracteres):');
    if (nova && nova.length >= 8) sb.auth.updateUser({ password: nova }).then(({ error }) => error ? falha(error) : toast('Palavra-passe mudada.'));
  }
});

/* ---------------------------------------------------------------- Início */
ECRAS.inicio = async () => {
  const [pend, sos] = await Promise.all([
    sb.from('trail_avisos').select('id,criado_por', { count: 'exact' }).eq('estado', 'pendente'),
    sb.from('trail_sos').select('id', { count: 'exact', head: true }).eq('resolvido', false),
  ]);
  const paraAprovar = (pend.data || []).filter(a => a.criado_por !== eu.email).length;
  const nSos = sos.count || 0;
  const nChat = (await sb.from('trail_chat').select('id', { count: 'exact', head: true }).eq('da_org', false).eq('lida', false)).count || 0;
  const b = (ecraNome, ic, titulo, sub, extra = '', classe = '') =>
    `<button class="botao-grande ${classe}" data-ir="${ecraNome}"><span class="ic">${ic}</span><b>${titulo}</b><small>${sub}</small>${extra}</button>`;
  const gestor = pode('admin', 'gestor');
  ecra.innerHTML = `
    <p class="sobre">${esc(edicao.nome || 'Trail do Texugo')}</p>
    <h1>O que queres <em>fazer?</em></h1>
    <div class="grelha">
      ${gestor ? b('comunicado', '📢', 'Escrever comunicado', 'Aviso na app com notificação', '', 'destaque') : ''}
      ${gestor ? b('aprovar', '✅', 'Aprovar', 'Comunicados de outros gestores', paraAprovar ? `<span class="contador">${paraAprovar}</span>` : '') : ''}
      ${b('rececao', '🎫', 'Receção de atletas', 'Ler QR e entregar dorsal/kit')}
      ${b('posto', '⛰️', 'Posto de controlo', 'Registar passagens no dia')}
      ${b('sos', '🆘', 'Pedidos de ajuda', 'SOS enviados pela app', nSos ? `<span class="contador">${nSos}</span>` : '', nSos ? 'perigo' : '')}
      ${b('chat', '💬', 'Chat com atletas', 'Semana da prova e dia da prova', nChat ? `<span class="contador">${nChat}</span>` : '', nChat ? 'destaque' : '')}
      ${b('inscritos', '👟', 'Inscritos', 'Importar lista da Stop&Go')}
      ${gestor ? b('edicao', '🗓️', 'Edição da prova', 'Datas, inscrições, percursos') : ''}
      ${gestor ? b('resultados', '🏁', 'Resultados', 'Importar classificações') : ''}
      ${gestor ? b('fotos', '📸', 'Fotografias', 'Carregar e marcar dorsais') : ''}
      ${b('voluntarios', '🤝', 'Voluntários', 'Postos, turnos e contactos')}
      ${gestor ? b('patrocinadores', '⭐', 'Parceiros', 'Logótipos na app') : ''}
      ${gestor ? b('comunicados', '🗂️', 'Todos os comunicados', 'Publicados, agendados, arquivo') : ''}
      ${gestor ? b('inquerito', '💬', 'Opinião dos atletas', 'Respostas ao inquérito') : ''}
      ${b('registo', '🧾', 'Registo de atividade', 'Quem fez o quê e quando')}
      ${pode('admin') ? b('gestores', '🔑', 'Gestores', 'Quem tem acesso') : ''}
      ${b('sair', '🚪', 'Sair', esc(eu.email))}
    </div>`;
  ecra.querySelectorAll('[data-ir]').forEach(x => x.onclick = () => ir(x.dataset.ir));
};
ECRAS.sair = () => sb.auth.signOut().then(() => location.reload());

/* ---------------------------------------------------------------- Comunicados */
const CATEGORIAS = { geral: 'Comunicado', prova: 'A prova', inscricoes: 'Inscrições', comunidade: 'Comunidade', urgente: 'URGENTE' };
const MODELOS = [
  { n: 'Inscrições abertas', c: 'inscricoes', t: 'As inscrições estão abertas! 🦡', x: 'Já podes garantir o teu dorsal para o Trail do Texugo. As vagas são limitadas — não deixes para a última.\n\nInscrições na Stop&Go (toca na ligação).' },
  { n: 'Últimos dorsais', c: 'inscricoes', t: 'Últimos dorsais disponíveis', x: 'Restam poucos dorsais. Se ainda estás a pensar, este é o momento.' },
  { n: 'Levantamento de dorsais', c: 'prova', t: 'Levantamento de dorsais', x: 'O secretariado está aberto:\n• Sábado, 15:00–19:00 — Adega de Redondo\n• Domingo, a partir das 06:30 — Aldeia da Serra d\'Ossa\n\nLeva o QR da app (O meu dorsal) para seres atendido num instante.' },
  { n: 'Meteorologia', c: 'urgente', t: 'Aviso meteorológico', x: 'Prevê-se chuva e frio para a manhã da prova. O casaco impermeável passa a ser material obrigatório em todas as distâncias.' },
  { n: 'Alteração de percurso', c: 'urgente', t: 'Alteração de percurso', x: 'Por razões de segurança, o percurso foi alterado entre o km X e o km Y. Segue sempre a marcação e as indicações dos voluntários.' },
  { n: 'Fotografias disponíveis', c: 'prova', t: 'As fotografias já estão na app 📸', x: 'Procura-te pelo número do dorsal em Pós-prova → Fotos. Obrigado a todos os fotógrafos voluntários!' },
  { n: 'Obrigado', c: 'comunidade', t: 'Obrigado, família Texugo!', x: 'Mais uma edição para a memória. Obrigado a cada atleta, voluntário, parceiro e a toda a gente de Redondo. Até para o ano!' },
  { n: 'Voluntários precisam-se', c: 'comunidade', t: 'Precisamos de ti!', x: 'Estamos a reunir a equipa de voluntários para a próxima edição. Marcação de trilhos, abastecimentos, secretariado… há lugar para todos. Escreve para trailtexugo@gmail.com.' },
];

function previa(a) {
  const urg = a.categoria === 'urgente';
  return `<div class="previa"><div class="ecra-tel">
    <div class="not"><small>🦡 Trail do Texugo · agora</small><b>${esc(a.titulo || 'Título')}</b>${esc((a.texto || '').slice(0, 90))}</div>
    ${a.imagem_url ? `<img src="${esc(a.imagem_url)}" alt="">` : ''}
    <span class="etq ${urg ? 'vermelho' : ''}">${esc(CATEGORIAS[a.categoria] || '')}</span>
    <h3>${esc(a.titulo || 'Título')}</h3><p>${esc(a.texto || '')}</p>
    ${a.link ? `<span class="btn peq">Abrir ligação</span>` : ''}
  </div></div>`;
}

ECRAS.comunicado = (existente = null) => {
  const a = existente || { titulo: '', texto: '', categoria: 'geral', imagem_url: '', link: '', publicar_em: null };
  ecra.innerHTML = `
    <p class="sobre">Comunicado</p><h1>Escrever <em>comunicado.</em></h1>
    ${existente ? '' : `<p class="nota">Começa por um modelo pronto ou escreve de raiz.</p>
    <div class="linha">${MODELOS.map((m, i) => `<button class="btn contorno peq" data-m="${i}">${esc(m.n)}</button>`).join('')}</div>`}
    <div class="cartao">
      <label>Tipo</label>
      <select id="cat">${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <label>Título</label><input id="tit" maxlength="90">
      <label>Texto</label><textarea id="txt" maxlength="3000"></textarea>
      <label>Ligação (opcional)</label><input id="lnk" placeholder="https://…">
      <label>Imagem (opcional)</label><input id="img" placeholder="Endereço de imagem, ou carrega uma"><input id="imgf" type="file" accept="image/*" style="margin-top:6px">
      <label>Enviar quando?</label>
      <select id="quando"><option value="">Logo que for aprovado</option><option value="data">Num dia e hora</option></select>
      <input id="data" type="datetime-local" hidden style="margin-top:6px">
    </div>
    <h2>Assim fica na <em>app</em></h2><div id="prev"></div>
    <div class="linha"><button class="btn" id="guardar">${existente ? 'Guardar alterações' : 'Enviar para aprovação'}</button></div>
    <p class="nota">Todos os comunicados são aprovados por <b>outro gestor</b> antes de chegarem aos telemóveis. Os urgentes podem ser publicados de imediato por um administrador.</p>`;
  const campos = () => ({
    categoria: $('#cat').value, titulo: $('#tit').value.trim(), texto: $('#txt').value.trim(),
    link: $('#lnk').value.trim() || null, imagem_url: $('#img').value.trim() || null,
    publicar_em: $('#quando').value === 'data' && $('#data').value ? new Date($('#data').value).toISOString() : null,
  });
  const atualizar = () => $('#prev').innerHTML = previa(campos());
  const preencher = x => {
    $('#cat').value = x.categoria; $('#tit').value = x.titulo; $('#txt').value = x.texto;
    $('#lnk').value = x.link || ''; $('#img').value = x.imagem_url || '';
    if (x.publicar_em) { $('#quando').value = 'data'; $('#data').hidden = false; $('#data').value = new Date(x.publicar_em).toISOString().slice(0, 16); }
    atualizar();
  };
  preencher(a);
  ecra.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const m = MODELOS[b.dataset.m]; preencher({ categoria: m.c, titulo: m.t, texto: m.x }); });
  ecra.querySelectorAll('input,textarea,select').forEach(x => x.oninput = atualizar);
  $('#quando').onchange = () => { $('#data').hidden = $('#quando').value !== 'data'; atualizar(); };
  $('#imgf').onchange = async () => {
    const f = $('#imgf').files[0]; if (!f) return;
    try { $('#img').value = await carregarImagem(f, 'comunicados'); atualizar(); } catch (e) { falha(e); }
  };
  $('#guardar').onclick = async () => {
    const c = campos();
    if (!c.titulo || !c.texto) return toast('Falta o título ou o texto.', true);
    try {
      if (existente) {
        await q(sb.from('trail_avisos').update({ ...c, estado: 'pendente', aprovado_por: null, publicado_em: null }).eq('id', existente.id));
        await registo('alterou comunicado', c.titulo);
        toast('Alterações guardadas. Voltou para aprovação.');
      } else {
        await q(sb.from('trail_avisos').insert({ ...c, estado: 'pendente' }));
        await registo('escreveu comunicado', c.titulo);
        toast('Enviado para aprovação de outro gestor.');
      }
      ir('comunicados');
    } catch (e) { falha(e); }
  };
};

async function carregarImagem(f, pasta, maxMb = 8) {
  if (f.size > maxMb * 1024 * 1024) throw new Error(`Ficheiro demasiado grande (máx. ${maxMb} MB).`);
  const nome = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${(f.name.split('.').pop() || 'jpg').toLowerCase()}`;
  await q(sb.storage.from('trail-fotos').upload(nome, f, { contentType: f.type, upsert: false }));
  return sb.storage.from('trail-fotos').getPublicUrl(nome).data.publicUrl;
}

ECRAS.aprovar = async () => {
  const lista = await q(sb.from('trail_avisos').select('*').eq('estado', 'pendente').order('criado_em'));
  ecra.innerHTML = `<p class="sobre">Duas aprovações</p><h1>Comunicados para <em>aprovar.</em></h1>
    ${lista.length ? '' : '<div class="vazio">Nada para aprovar. 🦡</div>'}<div id="l"></div>`;
  lista.forEach(a => {
    const meu = a.criado_por === eu.email;
    const podeJa = !meu || (a.categoria === 'urgente' && pode('admin'));
    const d = document.createElement('div'); d.className = 'cartao';
    d.innerHTML = `<div class="linha"><span class="etq ${a.categoria === 'urgente' ? 'vermelho' : ''}">${esc(CATEGORIAS[a.categoria])}</span>
      <span class="nota">por ${esc(a.criado_por)} · ${dataHora(a.criado_em)}${a.publicar_em ? ' · agendado para ' + dataHora(a.publicar_em) : ''}</span></div>
      ${previa(a)}
      <div class="linha">${podeJa ? '<button class="btn verde" data-a="ok">Aprovar e publicar</button>' : '<span class="nota">Escrito por ti — tem de ser outro gestor a aprovar.</span>'}
      <button class="btn contorno" data-a="editar">Editar</button><button class="btn contorno" data-a="apagar">Apagar</button></div>`;
    d.querySelector('[data-a=ok]')?.addEventListener('click', async () => {
      if (!confirm('Publicar este comunicado? Os telemóveis recebem uma notificação.')) return;
      try { await q(sb.rpc('trail_aprovar_aviso', { p_id: a.id })); toast('Publicado!'); ir('aprovar'); } catch (e) { falha(e); }
    });
    d.querySelector('[data-a=editar]').onclick = () => ir('comunicado', a);
    d.querySelector('[data-a=apagar]').onclick = async () => {
      if (!confirm('Apagar este comunicado?')) return;
      try { await q(sb.from('trail_avisos').delete().eq('id', a.id)); await registo('apagou comunicado', a.titulo); ir('aprovar'); } catch (e) { falha(e); }
    };
    $('#l').appendChild(d);
  });
};

ECRAS.comunicados = async () => {
  const lista = await q(sb.from('trail_avisos').select('*').order('criado_em', { ascending: false }).limit(200));
  const agora = Date.now();
  const estado = a => a.estado === 'pendente' ? '<span class="etq cinza">À espera de aprovação</span>'
    : a.estado === 'arquivado' ? '<span class="etq cinza">Arquivado</span>'
    : a.publicar_em && new Date(a.publicar_em) > agora ? `<span class="etq">Agendado ${dataHora(a.publicar_em)}</span>` : '<span class="etq verde">Na app</span>';
  ecra.innerHTML = `<p class="sobre">Comunicados</p><h1>Todos os <em>comunicados.</em></h1>
    <button class="btn" id="novo">+ Novo comunicado</button>
    <div class="tabela cartao"><table><tr><th>Título</th><th>Estado</th><th>Quem</th><th></th></tr>
    ${lista.map(a => `<tr><td><b>${esc(a.titulo)}</b><br><span class="nota">${esc(CATEGORIAS[a.categoria])} · ${dataHora(a.criado_em)}</span></td>
      <td>${estado(a)}</td><td class="nota">${esc(a.criado_por)}${a.aprovado_por ? '<br>✔ ' + esc(a.aprovado_por) : ''}</td>
      <td><button class="btn contorno peq" data-e="${a.id}">Editar</button> ${a.estado === 'publicado' ? `<button class="btn contorno peq" data-r="${a.id}">Retirar</button>` : ''}</td></tr>`).join('')}
    </table></div>`;
  $('#novo').onclick = () => ir('comunicado');
  ecra.querySelectorAll('[data-e]').forEach(b => b.onclick = () => ir('comunicado', lista.find(a => a.id === b.dataset.e)));
  ecra.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
    if (!confirm('Retirar este comunicado da app?')) return;
    try { await q(sb.from('trail_avisos').update({ estado: 'arquivado' }).eq('id', b.dataset.r)); await registo('retirou comunicado', b.dataset.r); ir('comunicados'); } catch (e) { falha(e); }
  });
};

/* ---------------------------------------------------------------- Edição */
const PERCURSOS_BASE = [
  { km: '10', nome: 'Iniciação', frase: 'O primeiro passo', partida: '09:45', desnivel: '—', limite: 'Sem limite', barreira: 'Sem barreira', abastecimentos: '1 posto', gpx: '', competitivo: false },
  { km: '15', nome: 'Trail Sprint / Jovem', frase: 'A serra à tua medida', partida: '09:30', desnivel: '1 197 m', limite: 'Sem limite global', barreira: '', abastecimentos: '3 postos', gpx: '', competitivo: true },
  { km: '30', nome: 'Trail Longo', frase: 'Mais longe. Mais Texugo.', partida: '09:00', desnivel: '2 079 m', limite: '8 horas', barreira: '', abastecimentos: '5 postos', gpx: '', competitivo: true },
  { km: '46', nome: 'Ultra Trail', frase: 'O teu lado mais selvagem', partida: '08:30', desnivel: '2 865 m', limite: '9 horas', barreira: '', abastecimentos: '7 postos', gpx: '', competitivo: true },
];
const PROGRAMA_BASE = [
  { titulo: 'Sábado', subtitulo: 'Levanta a tua aventura.', momentos: [{ hora: '15:00–19:00', texto: 'Secretariado e levantamento de dorsais', local: 'Adega de Redondo' }] },
  { titulo: 'Domingo', subtitulo: 'Do primeiro passo à meta.', momentos: [
    { hora: '06:30', texto: 'Abertura do secretariado', local: "Aldeia da Serra d'Ossa" }, { hora: '08:30', texto: 'Partida · Ultra', local: '' },
    { hora: '09:00', texto: 'Partida · Longo', local: '' }, { hora: '09:30', texto: 'Partida · Sprint', local: '' },
    { hora: '09:45', texto: 'Partida · Iniciação', local: '' }, { hora: '13:00', texto: 'Entrega de prémios', local: '' }] },
];

ECRAS.edicao = () => {
  const d = { modo: 'auto', inscricoes: 'a_anunciar', ...edicao };
  let percursos = JSON.parse(JSON.stringify(d.percursos?.length ? d.percursos : PERCURSOS_BASE));
  let programa = JSON.parse(JSON.stringify(d.programa?.length ? d.programa : PROGRAMA_BASE));
  const local = iso => iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Lisbon' }).slice(0, 16).replace(' ', 'T') : '';
  ecra.innerHTML = `
    <p class="sobre">Edição da prova</p><h1>A próxima <em>edição.</em></h1>
    <p class="nota">Enquanto isto não for preenchido, a app mostra a edição de 2026 como referência.</p>
    <div class="cartao">
      <div class="linha"><div class="cresce"><label>Ano da edição</label><input id="ed" value="${esc(d.edicao || '')}" placeholder="2027"></div>
      <div class="cresce"><label>Nome</label><input id="nome" value="${esc(d.nome || '')}" placeholder="Trail do Texugo 2027"></div></div>
      <label>Dia e hora da primeira partida</label><input id="data" type="datetime-local" value="${local(d.data_prova)}">
      <label>Inscrições</label>
      <select id="insc">${[['a_anunciar', 'A anunciar'], ['brevemente', 'Abrem brevemente (com data)'], ['abertas', 'Abertas'], ['esgotadas', 'Esgotadas'], ['fechadas', 'Fechadas']]
        .map(([k, v]) => `<option value="${k}" ${d.inscricoes === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <label>Abertura das inscrições</label><input id="abre" type="datetime-local" value="${local(d.inscricoes_abertura)}">
      <label>Ligação das inscrições (Stop&Go)</label><input id="link" value="${esc(d.link_inscricao || '')}" placeholder="https://stopandgo.net/events/…">
      <label>Regulamento (PDF)</label><input id="reg" value="${esc(d.link_regulamento || '')}">
      <label>Classificações em direto</label><input id="dir" value="${esc(d.link_direto || '')}">
      <label>Resultados finais</label><input id="res" value="${esc(d.link_resultados || '')}">
      <label>Telefone de emergência da organização (botão SOS)</label><input id="tel" value="${esc(d.telefone_emergencia || '')}" placeholder="9xx xxx xxx">
      <label>O que a app mostra no Início</label>
      <select id="modo">${[['auto', 'Automático pela data da prova'], ['antes', 'Preparação (antes da prova)'], ['dia', 'Dia da prova (direto)'], ['depois', 'Pós-prova (resultados e fotos)']]
        .map(([k, v]) => `<option value="${k}" ${d.modo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    </div>
    <h2>Percursos</h2><div id="percs"></div><button class="btn contorno peq" id="maisp">+ Percurso</button>
    <h2>Programa</h2><div id="prog"></div><button class="btn contorno peq" id="maisd">+ Dia</button>
    <div class="linha" style="margin-top:24px"><button class="btn" id="guardar">Guardar e publicar na app</button></div>`;
  const campoP = (i, k, rot, larg = '') => `<div class="cresce" ${larg}><label>${rot}</label><input data-p="${i}" data-k="${k}" value="${esc(percursos[i][k] ?? '')}"></div>`;
  const desenharP = () => {
    $('#percs').innerHTML = percursos.map((p, i) => `<div class="cartao"><div class="linha">
      ${campoP(i, 'km', 'Km', 'style="max-width:90px"')}${campoP(i, 'nome', 'Nome')}${campoP(i, 'frase', 'Frase')}</div><div class="linha">
      ${campoP(i, 'partida', 'Partida')}${campoP(i, 'desnivel', 'Desnível +')}${campoP(i, 'limite', 'Tempo máximo')}</div><div class="linha">
      ${campoP(i, 'barreira', 'Barreira horária')}${campoP(i, 'abastecimentos', 'Abastecimentos')}</div>
      <div class="linha">${campoP(i, 'gpx', 'Ligação do GPX')}<label class="btn contorno peq" style="align-self:flex-end;margin:0;cursor:pointer">📍 Carregar GPX<input type="file" accept=".gpx,application/gpx+xml" data-g="${i}" hidden></label></div>
      <p class="ajuda" style="margin:4px 0 0;color:var(--cinza,#a7adb2);font-size:13px">A app descarrega o GPX e usa-o no mapa 3D sem rede. Os pontos de passagem (waypoints) do GPX aparecem como postos.</p>
      <div class="linha" style="margin-top:8px"><label style="margin:0"><input type="checkbox" data-c="${i}" ${p.competitivo !== false ? 'checked' : ''}> Competitivo</label>
      <span class="espaco" style="flex:1"></span><button class="btn contorno peq" data-x="${i}">Remover</button></div></div>`).join('');
    $('#percs').querySelectorAll('[data-p]').forEach(x => x.oninput = () => percursos[x.dataset.p][x.dataset.k] = x.value);
    $('#percs').querySelectorAll('[data-c]').forEach(x => x.onchange = () => percursos[x.dataset.c].competitivo = x.checked);
    $('#percs').querySelectorAll('[data-x]').forEach(x => x.onclick = () => { percursos.splice(+x.dataset.x, 1); desenharP(); });
    $('#percs').querySelectorAll('[data-g]').forEach(x => x.onchange = async () => {
      const f = x.files[0]; if (!f) return;
      try {
        const txt = await f.text();
        const n = (txt.match(/<(trkpt|rtept)[\s>]/g) || []).length, w = (txt.match(/<wpt[\s>]/g) || []).length;
        if (n < 10) throw new Error('Este ficheiro não parece um GPX com traçado.');
        const ficheiro = new File([f], f.name.replace(/[^\w.-]+/g, '-') || 'percurso.gpx', { type: 'application/gpx+xml' });
        percursos[x.dataset.g].gpx = await carregarImagem(ficheiro, 'gpx', 15);
        desenharP();
        alert(`GPX carregado: ${n} pontos${w ? ` e ${w} postos` : ' (sem postos marcados)'}. Carrega em "Guardar e publicar na app".`);
      } catch (e) { falha(e); }
    });
  };
  const desenharD = () => {
    $('#prog').innerHTML = programa.map((dia, i) => `<div class="cartao"><div class="linha">
      <div class="cresce"><label>Dia</label><input data-d="${i}" data-k="titulo" value="${esc(dia.titulo)}"></div>
      <div class="cresce"><label>Frase</label><input data-d="${i}" data-k="subtitulo" value="${esc(dia.subtitulo)}"></div></div>
      ${dia.momentos.map((m, j) => `<div class="linha"><div style="max-width:120px"><label>Hora</label><input data-m="${i}.${j}" data-k="hora" value="${esc(m.hora)}"></div>
        <div class="cresce"><label>O quê</label><input data-m="${i}.${j}" data-k="texto" value="${esc(m.texto)}"></div>
        <div class="cresce"><label>Onde</label><input data-m="${i}.${j}" data-k="local" value="${esc(m.local || '')}"></div></div>`).join('')}
      <div class="linha" style="margin-top:8px"><button class="btn contorno peq" data-mm="${i}">+ Momento</button><button class="btn contorno peq" data-xd="${i}">Remover dia</button></div></div>`).join('');
    $('#prog').querySelectorAll('[data-d]').forEach(x => x.oninput = () => programa[x.dataset.d][x.dataset.k] = x.value);
    $('#prog').querySelectorAll('[data-m]').forEach(x => x.oninput = () => { const [i, j] = x.dataset.m.split('.'); programa[i].momentos[j][x.dataset.k] = x.value; });
    $('#prog').querySelectorAll('[data-mm]').forEach(x => x.onclick = () => { programa[x.dataset.mm].momentos.push({ hora: '', texto: '', local: '' }); desenharD(); });
    $('#prog').querySelectorAll('[data-xd]').forEach(x => x.onclick = () => { programa.splice(+x.dataset.xd, 1); desenharD(); });
  };
  desenharP(); desenharD();
  $('#maisp').onclick = () => { percursos.push({ km: '', nome: '', frase: '', partida: '', desnivel: '', limite: '', barreira: '', abastecimentos: '', gpx: '', competitivo: true }); desenharP(); };
  $('#maisd').onclick = () => { programa.push({ titulo: '', subtitulo: '', momentos: [{ hora: '', texto: '', local: '' }] }); desenharD(); };
  $('#guardar').onclick = async () => {
    const iso = v => v ? new Date(v).toISOString() : '';
    const dados = {
      ...edicao,
      edicao: $('#ed').value.trim(), nome: $('#nome').value.trim(), data_prova: iso($('#data').value),
      inscricoes: $('#insc').value, inscricoes_abertura: iso($('#abre').value),
      link_inscricao: $('#link').value.trim(), link_regulamento: $('#reg').value.trim(),
      link_direto: $('#dir').value.trim(), link_resultados: $('#res').value.trim(),
      telefone_emergencia: $('#tel').value.trim(), modo: $('#modo').value,
      percursos: percursos.filter(p => p.km && p.nome),
      programa: programa.map(dia => ({ ...dia, momentos: dia.momentos.filter(m => m.hora || m.texto) })).filter(dia => dia.titulo),
    };
    if (!dados.edicao) return toast('Falta o ano da edição.', true);
    if (!confirm('Publicar estas informações na app?')) return;
    try {
      await q(sb.from('trail_config').update({ dados, atualizado_em: new Date().toISOString(), atualizado_por: eu.email }).eq('id', 1));
      await registo('alterou a edição', `${dados.nome} · inscrições: ${dados.inscricoes}`);
      edicao = dados; toast('Publicado. A app atualiza sozinha.'); ir('inicio');
    } catch (e) { falha(e); }
  };
};

/* ---------------------------------------------------------------- Inscritos */
ECRAS.inscritos = async () => {
  const ed = edicao.edicao || '';
  ecra.innerHTML = `<p class="sobre">Edição ${esc(ed || '—')}</p><h1>Os <em>inscritos.</em></h1>
    ${ed ? '' : '<div class="cartao">Primeiro define o ano da edição em "Edição da prova".</div>'}
    <div class="numeros" id="nums"></div>
    ${pode('admin', 'gestor') ? `<div class="cartao"><b>Importar lista da Stop&Go</b>
      <p class="nota">No Excel da Stop&Go: Ficheiro → Guardar como → <b>CSV</b>. As colunas são reconhecidas pelo nome (Dorsal, Nome, Data de nascimento, Email, Telefone, Prova/Percurso, Escalão, Clube, Género, T-shirt, Contacto de emergência). Quem já existe é atualizado; o check-in não se perde.</p>
      <input type="file" id="csv" accept=".csv,.txt"></div><div id="previa"></div>` : ''}
    <div class="linha"><input id="procura" class="cresce" placeholder="Procurar por nome ou dorsal"><button class="btn contorno peq" id="exp">Exportar</button></div>
    <div class="cartao tabela" id="lista"></div>`;
  let todos = [];
  const carregar = async () => {
    todos = ed ? await q(sb.from('trail_inscritos').select('dorsal,nome,percurso,clube,email,telefone,tamanho_tshirt,checkin_em,checkin_por').eq('edicao', ed).order('dorsal').limit(5000)) : [];
    const feitos = todos.filter(i => i.checkin_em).length;
    const porPerc = {}; todos.forEach(i => porPerc[i.percurso || '—'] = (porPerc[i.percurso || '—'] || 0) + 1);
    $('#nums').innerHTML = `<div class="numero"><b>${todos.length}</b><span>inscritos</span></div>
      <div class="numero"><b>${feitos}</b><span>dorsais levantados</span><div class="barra"><i style="width:${todos.length ? feitos / todos.length * 100 : 0}%"></i></div></div>
      ${Object.entries(porPerc).map(([p, n]) => `<div class="numero"><b>${n}</b><span>${esc(p)}</span></div>`).join('')}`;
    desenhar();
  };
  const desenhar = () => {
    const f = semAcentos($('#procura').value);
    const l = todos.filter(i => !f || semAcentos(i.nome).includes(f) || String(i.dorsal) === f).slice(0, 400);
    $('#lista').innerHTML = l.length ? `<table><tr><th>Dorsal</th><th>Nome</th><th>Percurso</th><th>Levantou</th></tr>
      ${l.map(i => `<tr><td><b>${i.dorsal}</b></td><td>${esc(i.nome)}<br><span class="nota">${esc(i.clube)}</span></td><td>${esc(i.percurso)}</td>
      <td>${i.checkin_em ? `<span class="etq verde">${dataHora(i.checkin_em)}</span>` : '<span class="etq cinza">Não</span>'}</td></tr>`).join('')}</table>`
      : '<div class="vazio">Sem inscritos.</div>';
  };
  $('#procura').oninput = desenhar;
  $('#exp').onclick = () => descarregarCSV(`inscritos-${ed}.csv`, [['Dorsal', 'Nome', 'Percurso', 'Clube', 'Email', 'Telefone', 'T-shirt', 'Levantou'],
    ...todos.map(i => [i.dorsal, i.nome, i.percurso, i.clube, i.email, i.telefone, i.tamanho_tshirt, i.checkin_em ? dataHora(i.checkin_em) : ''])]);
  $('#csv')?.addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const linhas = lerCSV(await f.text()); if (linhas.length < 2) return toast('O ficheiro está vazio.', true);
    const cab = linhas[0];
    const col = {
      dorsal: coluna(cab, 'dorsal', 'bib', 'numero', 'n.º', 'nº'), nome: coluna(cab, 'nome completo', 'nome', 'name'),
      apelido: coluna(cab, 'apelido', 'sobrenome'), nascimento: coluna(cab, 'data de nascimento', 'nascimento', 'data nasc', 'birth'),
      email: coluna(cab, 'email', 'e-mail'), telefone: coluna(cab, 'telemovel', 'telefone', 'phone', 'contacto'),
      percurso: coluna(cab, 'percurso', 'prova', 'distancia', 'evento'), escalao: coluna(cab, 'escalao', 'categoria', 'category'),
      clube: coluna(cab, 'clube', 'equipa', 'team'), genero: coluna(cab, 'genero', 'sexo', 'gender'),
      tamanho_tshirt: coluna(cab, 't-shirt', 'tshirt', 'tamanho', 'camisola'), contacto_emergencia: coluna(cab, 'emergencia', 'sos'),
    };
    if (col.dorsal < 0 || col.nome < 0) return toast('Não encontrei as colunas "Dorsal" e "Nome".', true);
    const v = (l, k) => col[k] >= 0 ? (l[col[k]] || '').trim() : '';
    const regs = linhas.slice(1).map(l => ({
      edicao: ed, dorsal: parseInt(v(l, 'dorsal'), 10), nome: [v(l, 'nome'), v(l, 'apelido')].filter(Boolean).join(' '),
      nascimento: dataISO(v(l, 'nascimento')), email: v(l, 'email').toLowerCase() || null, telefone: v(l, 'telefone') || null,
      percurso: v(l, 'percurso'), escalao: v(l, 'escalao'), clube: v(l, 'clube'), genero: v(l, 'genero'),
      tamanho_tshirt: v(l, 'tamanho_tshirt'), contacto_emergencia: v(l, 'contacto_emergencia'),
    })).filter(r => r.dorsal > 0 && r.nome);
    const reconhecidas = Object.entries(col).filter(([, i]) => i >= 0).map(([k, i]) => `${k} ← "${esc(cab[i])}"`).join(', ');
    $('#previa').innerHTML = `<div class="cartao"><b>${regs.length} atletas prontos a importar</b>
      <p class="nota">Colunas reconhecidas: ${reconhecidas}</p>
      <div class="tabela"><table><tr><th>Dorsal</th><th>Nome</th><th>Nascimento</th><th>Percurso</th></tr>
      ${regs.slice(0, 6).map(r => `<tr><td>${r.dorsal}</td><td>${esc(r.nome)}</td><td>${esc(r.nascimento || '—')}</td><td>${esc(r.percurso)}</td></tr>`).join('')}</table></div>
      <button class="btn" id="imp" style="margin-top:12px">Importar ${regs.length} atletas</button></div>`;
    $('#imp').onclick = async () => {
      try {
        for (let i = 0; i < regs.length; i += 500)
          await q(sb.from('trail_inscritos').upsert(regs.slice(i, i + 500), { onConflict: 'edicao,dorsal', ignoreDuplicates: false }));
        await registo('importou inscritos', `${regs.length} atletas (${f.name})`);
        toast(`${regs.length} atletas importados.`); $('#previa').innerHTML = ''; carregar();
      } catch (er) { falha(er); }
    };
  });
  carregar().catch(falha);
};

/* ---------------------------------------------------------------- Câmara (QR) */
async function abrirCamara(video, aoLer) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play();
  const detetor = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
  const tela = document.createElement('canvas'); const ctx = tela.getContext('2d', { willReadFrequently: true });
  let ativo = true, ultimo = '', ultimoT = 0;
  const ciclo = async () => {
    if (!ativo) return;
    try {
      let txt = null;
      if (detetor) { const r = await detetor.detect(video); txt = r[0]?.rawValue; }
      else if (window.jsQR && video.videoWidth) {
        tela.width = video.videoWidth; tela.height = video.videoHeight; ctx.drawImage(video, 0, 0);
        txt = window.jsQR(ctx.getImageData(0, 0, tela.width, tela.height).data, tela.width, tela.height)?.data;
      }
      if (txt && (txt !== ultimo || Date.now() - ultimoT > 4000)) { ultimo = txt; ultimoT = Date.now(); aoLer(txt); }
    } catch {}
    setTimeout(ciclo, 250);
  };
  ciclo();
  return () => { ativo = false; stream.getTracks().forEach(t => t.stop()); };
}
function lerQrTexugo(txt) {
  const p = String(txt).split('|');
  if (p[0] !== 'TEXUGO' || p.length < 4) return null;
  return { edicao: p[1], dorsal: parseInt(p[2], 10), codigo: p[3] };
}
function bip(bom) {
  try {
    const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = bom ? 880 : 220; o.connect(g); g.connect(a.destination); g.gain.value = .15;
    o.start(); o.stop(a.currentTime + (bom ? .12 : .4));
    navigator.vibrate?.(bom ? 60 : [80, 60, 80]);
  } catch {}
}

/* ---------------------------------------------------------------- Receção */
ECRAS.rececao = () => {
  const ed = edicao.edicao || '';
  ecra.innerHTML = `<p class="sobre">Secretariado · ${esc(ed)}</p><h1>Receção de <em>atletas.</em></h1>
    <div class="scanner"><video id="v" muted></video><div class="mira"></div></div>
    <div id="res"></div>
    <div class="linha" style="margin-top:12px"><input id="dorsal" class="cresce" inputmode="numeric" placeholder="Ou escreve o n.º de dorsal"><button class="btn" id="ok">Confirmar</button></div>
    <div class="numeros" style="margin-top:14px" id="nums"></div>
    <p class="nota">O QR está na app do atleta, em "O meu dorsal". Cada dorsal só pode ser levantado uma vez — a segunda leitura aparece a amarelo.</p>`;
  const mostrar = r => {
    const cls = r.resultado === 'ok' ? 'ok' : r.resultado === 'ja_feito' ? 'ja' : 'erro';
    const msg = { ok: 'Entregar dorsal e kit ✔', ja_feito: `Já levantado ${dataHora(r.checkin_em)} por ${esc(r.checkin_por || '')}`, nao_existe: 'Dorsal não existe nesta edição', codigo_invalido: 'QR inválido para este dorsal' }[r.resultado];
    $('#res').innerHTML = `<div class="resultado ${cls}"><div class="dorsal">#${r.dorsal}</div><div class="nome">${esc(r.nome || '')}</div>
      <div>${esc(r.percurso || '')}${r.tshirt ? ' · T-shirt ' + esc(r.tshirt) : ''}</div><div style="margin-top:8px;font-weight:800">${msg}</div></div>`;
    bip(r.resultado === 'ok');
    contar();
  };
  const fazer = async (dorsal, codigo = null) => {
    try { const r = await q(sb.rpc('trail_fazer_checkin', { p_edicao: ed, p_dorsal: dorsal, p_codigo: codigo })); mostrar(r[0]); }
    catch (e) { falha(e); }
  };
  const contar = async () => {
    const [t, f] = await Promise.all([
      sb.from('trail_inscritos').select('id', { count: 'exact', head: true }).eq('edicao', ed),
      sb.from('trail_inscritos').select('id', { count: 'exact', head: true }).eq('edicao', ed).not('checkin_em', 'is', null)]);
    $('#nums').innerHTML = `<div class="numero"><b>${f.count || 0}</b><span>de ${t.count || 0} levantados</span>
      <div class="barra"><i style="width:${t.count ? (f.count / t.count * 100) : 0}%"></i></div></div>`;
  };
  $('#ok').onclick = () => { const n = parseInt($('#dorsal').value, 10); if (n) { fazer(n); $('#dorsal').value = ''; } };
  $('#dorsal').onkeydown = e => { if (e.key === 'Enter') $('#ok').click(); };
  contar();
  abrirCamara($('#v'), txt => {
    const x = lerQrTexugo(txt);
    if (!x) { bip(false); return toast('Este QR não é de um dorsal do Texugo.', true); }
    if (x.edicao !== ed) { bip(false); return toast(`QR da edição ${x.edicao}, não da ${ed}.`, true); }
    fazer(x.dorsal, x.codigo);
  }).then(parar => pararAtual = parar).catch(() => toast('Sem acesso à câmara. Usa o n.º de dorsal.', true));
};

/* ---------------------------------------------------------------- Posto de controlo */
ECRAS.posto = () => {
  const ed = edicao.edicao || '';
  const guardado = JSON.parse(localStorage.getItem('texugo-posto') || '{}');
  ecra.innerHTML = `<p class="sobre">Dia da prova · ${esc(ed)}</p><h1>Posto de <em>controlo.</em></h1>
    <div class="cartao"><div class="linha">
      <div class="cresce"><label>Nome do posto</label><input id="posto" value="${esc(guardado.posto || '')}" placeholder="Ex.: São Gens"></div>
      <div style="max-width:110px"><label>Km</label><input id="km" value="${esc(guardado.km || '')}"></div>
      <div style="max-width:170px"><label>Tipo</label><select id="tipo">${[['passagem', 'Passagem'], ['partida', 'Partida'], ['meta', 'Meta'], ['abandono', 'Abandono']]
        .map(([k, v]) => `<option value="${k}" ${guardado.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div></div>
    <div class="linha"><input id="dorsal" class="cresce" inputmode="numeric" placeholder="N.º de dorsal" style="font-size:26px;font-weight:900"><button class="btn" id="ok">Registar</button></div>
    <p class="nota">Dica: podes escrever vários dorsais separados por espaço.</p>
    <details class="cartao"><summary>Ler QR com a câmara</summary><div class="scanner" style="margin-top:12px"><video id="v" muted></video><div class="mira"></div></div></details>
    <div id="res"></div><h2>Últimos registos</h2><div class="cartao tabela" id="ult"></div>`;
  const cfgPosto = () => {
    const c = { posto: $('#posto').value.trim(), km: $('#km').value.trim(), tipo: $('#tipo').value };
    localStorage.setItem('texugo-posto', JSON.stringify(c)); return c;
  };
  const registar = async dorsais => {
    const c = cfgPosto(); if (!c.posto) return toast('Escreve o nome do posto.', true);
    try {
      await q(sb.from('trail_passagens').insert(dorsais.map(d => ({ edicao: ed, dorsal: d, posto: c.posto, km: c.km, tipo: c.tipo }))));
      bip(true); $('#res').innerHTML = `<div class="resultado ok"><div class="dorsal">${dorsais.map(d => '#' + d).join(' ')}</div><div>${esc(c.tipo)} · ${esc(c.posto)}</div></div>`;
      ultimos();
    } catch (e) { bip(false); falha(e); }
  };
  const ultimos = async () => {
    const l = await q(sb.from('trail_direto').select('*').eq('edicao', ed).order('hora', { ascending: false }).limit(25));
    $('#ult').innerHTML = l.length ? `<table><tr><th>Hora</th><th>Dorsal</th><th>Atleta</th><th>Posto</th></tr>${l.map(p => `<tr><td>${new Date(p.hora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</td>
      <td><b>${p.dorsal}</b></td><td>${esc(p.nome)}</td><td>${esc(p.posto)} <span class="etq ${p.tipo === 'abandono' ? 'vermelho' : p.tipo === 'meta' ? 'verde' : 'cinza'}">${esc(p.tipo)}</span></td></tr>`).join('')}</table>`
      : '<div class="vazio">Ainda sem registos.</div>';
  };
  $('#ok').onclick = () => {
    const ds = $('#dorsal').value.split(/[\s,;]+/).map(x => parseInt(x, 10)).filter(x => x > 0);
    if (ds.length) { registar(ds); $('#dorsal').value = ''; $('#dorsal').focus(); }
  };
  $('#dorsal').onkeydown = e => { if (e.key === 'Enter') $('#ok').click(); };
  ultimos().catch(falha);
  let parar = null;
  ecra.querySelector('details').ontoggle = ev => {
    if (ev.target.open && !parar) abrirCamara($('#v'), txt => { const x = lerQrTexugo(txt); if (x) registar([x.dorsal]); })
      .then(p => { parar = p; pararAtual = p; }).catch(() => toast('Sem acesso à câmara.', true));
  };
};

/* ---------------------------------------------------------------- SOS */
ECRAS.sos = async () => {
  ecra.innerHTML = `<p class="sobre">Segurança</p><h1>Pedidos de <em>ajuda.</em></h1>
    <p class="nota">Atualiza sozinho a cada 15 segundos. Um som avisa quando chega um pedido novo.</p><div id="l"></div>`;
  let vistos = null;
  const carregar = async () => {
    const l = await q(sb.from('trail_sos').select('*').order('criado_em', { ascending: false }).limit(60));
    const novos = l.filter(s => !s.resolvido).map(s => s.id);
    if (vistos && novos.some(id => !vistos.includes(id))) { bip(false); bip(false); }
    vistos = novos;
    $('#l').innerHTML = l.length ? l.map(s => `<div class="cartao sos ${s.resolvido ? 'resolvido' : ''}">
      <div class="linha"><b style="font-size:20px">${s.dorsal ? '#' + s.dorsal : 'Sem dorsal'} ${esc(s.nome)}</b><span class="espaco" style="flex:1"></span><span class="nota">${dataHora(s.criado_em)}</span></div>
      <p>${esc(s.mensagem)}</p>
      <div class="linha">${s.lat ? `<a class="btn peq" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}">📍 Ver no mapa</a>` : '<span class="etq cinza">Sem localização</span>'}
      ${s.telefone ? `<a class="btn contorno peq" href="tel:${esc(s.telefone)}">Ligar</a>` : ''}
      ${s.resolvido ? `<span class="etq verde">Resolvido por ${esc(s.resolvido_por || '')}</span>` : `<button class="btn verde peq" data-r="${s.id}">Marcar resolvido</button>`}</div></div>`).join('')
      : '<div class="vazio">Nenhum pedido de ajuda. 🦡</div>';
    ecra.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
      try { await q(sb.from('trail_sos').update({ resolvido: true, resolvido_por: eu.email }).eq('id', b.dataset.r)); await registo('resolveu SOS', b.dataset.r); carregar(); } catch (e) { falha(e); }
    });
  };
  await carregar().catch(falha);
  const t = setInterval(() => carregar().catch(() => {}), 15000);
  pararAtual = () => clearInterval(t);
};

/* ---------------------------------------------------------------- Chat com atletas */
ECRAS.chat = async (aberta = null) => {
  const RAPIDAS = ['Recebido! Estamos a verificar.', 'Já vamos a caminho. Fica onde estás.', 'Segue as fitas laranja até ao próximo posto.',
    'Dirige-te ao posto de abastecimento mais próximo.', 'Liga-nos para o número de emergência da prova.', 'Obrigado! Boa prova 🦡'];
  ecra.innerHTML = `<p class="sobre">Semana da prova</p><h1>Chat com <em>atletas.</em></h1>
    <p class="nota">Aberto na app 7 dias antes até 2 dias depois da prova. Atualiza sozinho e apita quando chega mensagem nova.</p>
    <div class="chat-grelha"><div id="convs" class="chat-convs"></div><div id="fio" class="chat-fio"></div></div>`;
  let ultimoId = 0, primeira = true;
  const nomeConv = m => m ? `${m.dorsal ? '#' + m.dorsal + ' ' : ''}${m.nome || 'Atleta sem dorsal na app'}` : '';
  const carregar = async () => {
    const msgs = await q(sb.from('trail_chat').select('*').order('id', { ascending: false }).limit(1500));
    const maxId = msgs.reduce((a, m) => Math.max(a, m.id), 0);
    if (!primeira && msgs.some(m => m.id > ultimoId && !m.da_org)) { bip(false); }
    ultimoId = maxId; primeira = false;
    const porConv = {};
    msgs.forEach(m => (porConv[m.conversa] ||= []).push(m));
    const convs = Object.entries(porConv).map(([c, l]) => ({ c, l: l.slice().reverse(), ult: l[0], nl: l.filter(m => !m.da_org && !m.lida).length,
      atleta: l.find(m => !m.da_org) })).sort((a, b) => (b.nl > 0) - (a.nl > 0) || b.ult.id - a.ult.id);
    $('#convs').innerHTML = convs.length ? convs.map(v => `<button class="chat-conv ${v.c === aberta ? 'ativa' : ''}" data-c="${esc(v.c)}">
        <b>${esc(nomeConv(v.atleta))}</b>${v.nl ? `<span class="contador">${v.nl}</span>` : ''}
        <small>${v.ult.da_org ? 'Tu: ' : ''}${esc(v.ult.texto.slice(0, 70))}</small><small class="nota">${dataHora(v.ult.criado_em)}</small></button>`).join('')
      : '<div class="vazio">Ainda não há mensagens. 🦡</div>';
    $('#convs').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { aberta = b.dataset.c; carregar().catch(falha); });
    const v = convs.find(x => x.c === aberta);
    if (!v) { $('#fio').innerHTML = convs.length ? '<div class="vazio">Escolhe uma conversa.</div>' : ''; return; }
    const loc = v.l.filter(m => m.lat).pop();
    $('#fio').innerHTML = `<div class="linha"><b style="font-size:18px">${esc(nomeConv(v.atleta))}</b><span class="espaco" style="flex:1"></span>
        ${loc ? `<a class="btn peq" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}">📍 Última localização</a>` : ''}</div>
      <div class="chat-msgs" id="msgs">${v.l.map(m => `<div class="chat-msg ${m.da_org ? 'org' : 'atl'}">${esc(m.texto)}
        <small>${m.da_org ? esc((m.autor || '').split('@')[0]) + ' · ' : ''}${dataHora(m.criado_em)}${m.lat ? ' · 📍' : ''}</small></div>`).join('')}</div>
      <div class="chat-rapidas">${RAPIDAS.map((r, i) => `<button class="btn contorno peq" data-q="${i}">${esc(r)}</button>`).join('')}</div>
      <form id="resp" class="linha"><input id="txt" class="cresce" maxlength="1000" placeholder="Responder a ${esc(nomeConv(v.atleta))}…" autocomplete="off"><button class="btn">Enviar</button></form>`;
    const caixa = $('#msgs'); caixa.scrollTop = caixa.scrollHeight;
    if (v.nl) await sb.from('trail_chat').update({ lida: true }).eq('conversa', aberta).eq('da_org', false).eq('lida', false);
    const enviar = async texto => {
      if (!texto.trim()) return;
      await q(sb.from('trail_chat').insert({ edicao: v.ult.edicao, conversa: aberta, dorsal: v.atleta?.dorsal ?? null, nome: v.atleta?.nome || '',
        da_org: true, autor: eu.email, texto: texto.trim().slice(0, 1000) }));
      await carregar();
    };
    $('#fio').querySelectorAll('[data-q]').forEach(b => b.onclick = () => enviar(RAPIDAS[b.dataset.q]).catch(falha));
    $('#resp').onsubmit = e => { e.preventDefault(); const t = $('#txt').value; $('#txt').value = ''; enviar(t).catch(falha); };
  };
  await carregar().catch(falha);
  // não atualiza enquanto se escreve uma resposta (para não apagar o texto)
  const t = setInterval(() => { if (!$('#txt')?.value) carregar().catch(() => {}); }, 8000);
  pararAtual = () => clearInterval(t);
};

/* ---------------------------------------------------------------- Resultados */
ECRAS.resultados = async () => {
  const ed = edicao.edicao || '';
  const n = await sb.from('trail_resultados').select('id', { count: 'exact', head: true }).eq('edicao', ed);
  ecra.innerHTML = `<p class="sobre">Pós-prova · ${esc(ed)}</p><h1>As <em>classificações.</em></h1>
    <div class="numeros"><div class="numero"><b>${n.count || 0}</b><span>resultados na app</span></div></div>
    <div class="cartao"><b>Importar classificações (CSV)</b>
    <p class="nota">Exporta da Stop&Go para Excel e guarda como CSV. Colunas reconhecidas: Posição/Classificação, Dorsal, Nome, Prova/Percurso, Tempo, Escalão, Posição no escalão, Clube. Ao importar, os resultados desta edição são substituídos.</p>
    <input type="file" id="csv" accept=".csv,.txt"></div><div id="prev"></div>
    <p class="nota">Com os resultados na app, cada atleta pode gerar o seu diploma de finisher.</p>`;
  $('#csv').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const linhas = lerCSV(await f.text()); const cab = linhas[0] || [];
    const col = { posicao: coluna(cab, 'posicao', 'classificacao', 'pos', 'class'), dorsal: coluna(cab, 'dorsal', 'bib'), nome: coluna(cab, 'nome', 'name'),
      percurso: coluna(cab, 'percurso', 'prova', 'distancia'), tempo: coluna(cab, 'tempo', 'time', 'tempo oficial'),
      escalao: coluna(cab, 'escalao', 'categoria'), posicao_escalao: coluna(cab, 'pos. escalao', 'posicao escalao', 'class. escalao', 'pos escalao'), clube: coluna(cab, 'clube', 'equipa') };
    if (col.dorsal < 0 || col.nome < 0 || col.tempo < 0) return toast('Faltam colunas: Dorsal, Nome e Tempo são obrigatórias.', true);
    const v = (l, k) => col[k] >= 0 ? (l[col[k]] || '').trim() : '';
    const regs = linhas.slice(1).map((l, i) => ({ edicao: ed, dorsal: parseInt(v(l, 'dorsal'), 10), nome: v(l, 'nome'), percurso: v(l, 'percurso'), tempo: v(l, 'tempo'),
      posicao: parseInt(v(l, 'posicao'), 10) || i + 1, escalao: v(l, 'escalao'), posicao_escalao: parseInt(v(l, 'posicao_escalao'), 10) || 0, clube: v(l, 'clube') }))
      .filter(r => r.dorsal > 0 && r.nome && r.tempo);
    $('#prev').innerHTML = `<div class="cartao"><b>${regs.length} resultados</b><div class="tabela"><table><tr><th>Pos.</th><th>Dorsal</th><th>Nome</th><th>Percurso</th><th>Tempo</th></tr>
      ${regs.slice(0, 8).map(r => `<tr><td>${r.posicao}</td><td>${r.dorsal}</td><td>${esc(r.nome)}</td><td>${esc(r.percurso)}</td><td>${esc(r.tempo)}</td></tr>`).join('')}</table></div>
      <button class="btn" id="imp" style="margin-top:12px">Publicar ${regs.length} resultados na app</button></div>`;
    $('#imp').onclick = async () => {
      if (!confirm('Substituir os resultados desta edição?')) return;
      try {
        await q(sb.from('trail_resultados').delete().eq('edicao', ed));
        for (let i = 0; i < regs.length; i += 500) await q(sb.from('trail_resultados').insert(regs.slice(i, i + 500)));
        await registo('publicou resultados', `${regs.length} (${f.name})`); toast('Resultados publicados.'); ir('resultados');
      } catch (er) { falha(er); }
    };
  };
};

/* ---------------------------------------------------------------- Fotografias */
ECRAS.fotos = async () => {
  const ed = edicao.edicao || '';
  ecra.innerHTML = `<p class="sobre">Pós-prova · ${esc(ed)}</p><h1>As <em>fotografias.</em></h1>
    <div class="cartao"><b>Carregar fotografias</b>
      <label>Dorsais que aparecem (separados por espaço) — opcional</label><input id="ds" placeholder="123 456">
      <label>Legenda — opcional</label><input id="leg" placeholder="Subida a São Gens">
      <label>Fotografias</label><input type="file" id="fs" accept="image/*" multiple>
      <p class="nota" id="prog"></p></div>
    <h2>Na app</h2><div class="fotos" id="g"></div>`;
  const carregar = async () => {
    const l = await q(sb.from('trail_fotos').select('*').eq('edicao', ed).order('criado_em', { ascending: false }).limit(300));
    $('#g').innerHTML = l.length ? l.map(f => `<figure><img src="${esc(f.url)}" loading="lazy" alt=""><figcaption>
      <input data-d="${f.id}" value="${esc((f.dorsais || []).join(' '))}" placeholder="dorsais" style="padding:6px;border-radius:8px;font-size:12px">
      <button class="btn contorno peq" data-x="${f.id}" style="margin-top:4px">Apagar</button></figcaption></figure>`).join('') : '<div class="vazio">Ainda sem fotografias.</div>';
    $('#g').querySelectorAll('[data-d]').forEach(x => x.onchange = async () => {
      const dorsais = x.value.split(/[\s,;]+/).map(n => parseInt(n, 10)).filter(n => n > 0);
      try { await q(sb.from('trail_fotos').update({ dorsais }).eq('id', x.dataset.d)); toast('Dorsais guardados.'); } catch (e) { falha(e); }
    });
    $('#g').querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
      if (!confirm('Apagar esta fotografia da app?')) return;
      try { await q(sb.from('trail_fotos').delete().eq('id', b.dataset.x)); carregar(); } catch (e) { falha(e); }
    });
  };
  $('#fs').onchange = async e => {
    const fs = [...e.target.files]; const dorsais = $('#ds').value.split(/[\s,;]+/).map(n => parseInt(n, 10)).filter(n => n > 0);
    let ok = 0;
    for (const f of fs) {
      $('#prog').textContent = `A carregar ${ok + 1} de ${fs.length}…`;
      try { const url = await carregarImagem(f, `fotos/${ed}`); await q(sb.from('trail_fotos').insert({ edicao: ed, url, dorsais, legenda: $('#leg').value.trim() })); ok++; }
      catch (er) { falha(er); }
    }
    $('#prog').textContent = `${ok} fotografias carregadas.`; await registo('carregou fotografias', `${ok}`); carregar();
  };
  carregar().catch(falha);
};

/* ---------------------------------------------------------------- Voluntários */
ECRAS.voluntarios = async () => {
  const ed = edicao.edicao || '';
  ecra.innerHTML = `<p class="sobre">A equipa · ${esc(ed)}</p><h1>Os <em>voluntários.</em></h1>
    ${pode('admin', 'gestor') ? `<div class="cartao"><div class="linha">
      <div class="cresce"><label>Nome</label><input id="n"></div><div class="cresce"><label>Telefone</label><input id="t" inputmode="tel"></div></div>
      <div class="linha"><div class="cresce"><label>Posto / tarefa</label><input id="p" placeholder="Abastecimento São Gens"></div>
      <div class="cresce"><label>Turno</label><input id="tu" placeholder="Domingo 07:00–13:00"></div></div>
      <button class="btn" id="add" style="margin-top:12px">Juntar voluntário</button></div>` : ''}
    <div class="linha"><input id="f" class="cresce" placeholder="Procurar"><button class="btn contorno peq" id="exp">Exportar</button></div>
    <div class="cartao tabela" id="l"></div>`;
  let todos = [];
  const carregar = async () => {
    todos = await q(sb.from('trail_voluntarios').select('*').eq('edicao', ed).order('posto').order('nome'));
    desenhar();
  };
  const desenhar = () => {
    const f = semAcentos($('#f').value);
    const l = todos.filter(v => !f || semAcentos(v.nome + ' ' + v.posto).includes(f));
    $('#l').innerHTML = l.length ? `<table><tr><th>Posto</th><th>Nome</th><th>Turno</th><th></th></tr>${l.map(v => `<tr><td><b>${esc(v.posto)}</b></td>
      <td>${esc(v.nome)}<br><a href="tel:${esc(v.telefone)}">${esc(v.telefone)}</a></td><td>${esc(v.turno)}</td>
      <td>${pode('admin', 'gestor') ? `<button class="btn contorno peq" data-x="${v.id}">✕</button>` : ''}</td></tr>`).join('')}</table>` : '<div class="vazio">Ainda sem voluntários.</div>';
    $('#l').querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
      if (!confirm('Remover este voluntário?')) return;
      try { await q(sb.from('trail_voluntarios').delete().eq('id', b.dataset.x)); carregar(); } catch (e) { falha(e); }
    });
  };
  $('#f').oninput = desenhar;
  $('#exp').onclick = () => descarregarCSV(`voluntarios-${ed}.csv`, [['Posto', 'Nome', 'Telefone', 'Turno', 'Notas'], ...todos.map(v => [v.posto, v.nome, v.telefone, v.turno, v.notas])]);
  $('#add')?.addEventListener('click', async () => {
    const r = { edicao: ed, nome: $('#n').value.trim(), telefone: $('#t').value.trim(), posto: $('#p').value.trim(), turno: $('#tu').value.trim() };
    if (!r.nome) return toast('Falta o nome.', true);
    try { await q(sb.from('trail_voluntarios').insert(r)); ['#n', '#t'].forEach(s => $(s).value = ''); carregar(); } catch (e) { falha(e); }
  });
  carregar().catch(falha);
};

/* ---------------------------------------------------------------- Parceiros */
ECRAS.patrocinadores = async () => {
  ecra.innerHTML = `<p class="sobre">Na app</p><h1>Os nossos <em>parceiros.</em></h1>
    <div class="cartao"><label>Nome</label><input id="n"><label>Logótipo</label><input type="file" id="logo" accept="image/*">
      <label>Site (opcional)</label><input id="l" placeholder="https://…"><button class="btn" id="add" style="margin-top:12px">Juntar parceiro</button></div>
    <div id="lista"></div>`;
  const carregar = async () => {
    const l = await q(sb.from('trail_patrocinadores').select('*').order('ordem'));
    $('#lista').innerHTML = l.map((p, i) => `<div class="cartao linha"><img src="${esc(p.logo_url)}" alt="" style="width:90px;height:60px;object-fit:contain;background:#fff;border-radius:10px;padding:6px">
      <div class="cresce"><b>${esc(p.nome)}</b><br><span class="nota">${esc(p.link || '')}</span></div>
      <button class="btn contorno peq" data-sobe="${i}">↑</button>
      <button class="btn contorno peq" data-at="${p.id}" data-v="${p.ativo}">${p.ativo ? 'Esconder' : 'Mostrar'}</button>
      <button class="btn contorno peq" data-x="${p.id}">Apagar</button></div>`).join('') || '<div class="vazio">Sem parceiros.</div>';
    $('#lista').querySelectorAll('[data-at]').forEach(b => b.onclick = () => q(sb.from('trail_patrocinadores').update({ ativo: b.dataset.v !== 'true' }).eq('id', b.dataset.at)).then(carregar, falha));
    $('#lista').querySelectorAll('[data-x]').forEach(b => b.onclick = () => confirm('Apagar?') && q(sb.from('trail_patrocinadores').delete().eq('id', b.dataset.x)).then(carregar, falha));
    $('#lista').querySelectorAll('[data-sobe]').forEach(b => b.onclick = async () => {
      const i = +b.dataset.sobe; if (i === 0) return;
      [l[i - 1], l[i]] = [l[i], l[i - 1]];
      try { for (let k = 0; k < l.length; k++) await q(sb.from('trail_patrocinadores').update({ ordem: k }).eq('id', l[k].id)); carregar(); } catch (e) { falha(e); }
    });
  };
  $('#add').onclick = async () => {
    const f = $('#logo').files[0]; const nome = $('#n').value.trim();
    if (!nome || !f) return toast('Falta o nome ou o logótipo.', true);
    try {
      const logo_url = await carregarImagem(f, 'parceiros');
      await q(sb.from('trail_patrocinadores').insert({ nome, logo_url, link: $('#l').value.trim() || null, ordem: 999 }));
      await registo('juntou parceiro', nome); ir('patrocinadores');
    } catch (e) { falha(e); }
  };
  carregar().catch(falha);
};

/* ---------------------------------------------------------------- Inquérito */
ECRAS.inquerito = async () => {
  const ed = edicao.edicao || '';
  const l = await q(sb.from('trail_inquerito').select('*').eq('edicao', ed).order('criado_em', { ascending: false }).limit(1000));
  const media = l.length ? (l.reduce((s, x) => s + x.nota, 0) / l.length).toFixed(1) : '—';
  const voltam = l.length ? Math.round(l.filter(x => x.voltaria).length / l.length * 100) + '%' : '—';
  ecra.innerHTML = `<p class="sobre">Pós-prova · ${esc(ed)}</p><h1>A opinião dos <em>atletas.</em></h1>
    <div class="numeros"><div class="numero"><b>${l.length}</b><span>respostas</span></div><div class="numero"><b>${media}★</b><span>nota média</span></div>
      <div class="numero"><b>${voltam}</b><span>dizem que voltam</span></div></div>
    <button class="btn contorno peq" id="exp" style="margin-top:12px">Exportar</button>
    ${l.map(x => `<div class="cartao"><b>${'★'.repeat(x.nota)}${'☆'.repeat(5 - x.nota)}</b> <span class="nota">${dataHora(x.criado_em)}</span>
      ${x.gostou ? `<p>👍 ${esc(x.gostou)}</p>` : ''}${x.melhorar ? `<p>🔧 ${esc(x.melhorar)}</p>` : ''}</div>`).join('')}`;
  $('#exp').onclick = () => descarregarCSV(`inquerito-${ed}.csv`, [['Data', 'Nota', 'Gostou', 'Melhorar', 'Voltaria'], ...l.map(x => [dataHora(x.criado_em), x.nota, x.gostou, x.melhorar, x.voltaria ? 'Sim' : 'Não'])]);
};

/* ---------------------------------------------------------------- Registo */
ECRAS.registo = async () => {
  const l = await q(sb.from('trail_registo').select('*').order('quando', { ascending: false }).limit(300));
  ecra.innerHTML = `<p class="sobre">Transparência</p><h1>Registo de <em>atividade.</em></h1>
    <div class="cartao tabela"><table><tr><th>Quando</th><th>Quem</th><th>O quê</th></tr>
    ${l.map(r => `<tr><td class="nota">${dataHora(r.quando)}</td><td>${esc(r.quem)}</td><td><b>${esc(r.acao)}</b><br><span class="nota">${esc(r.detalhe)}</span></td></tr>`).join('')}</table></div>`;
};

/* ---------------------------------------------------------------- Gestores */
ECRAS.gestores = async () => {
  const l = await q(sb.from('trail_gestores').select('*').order('papel').order('nome'));
  ecra.innerHTML = `<p class="sobre">Acessos</p><h1>Os <em>gestores.</em></h1>
    <div class="cartao"><div class="linha"><div class="cresce"><label>Email</label><input id="e" type="email"></div><div class="cresce"><label>Nome</label><input id="n"></div>
      <div><label>Papel</label><select id="p"><option value="gestor">Gestor</option><option value="rececao">Receção / postos</option><option value="admin">Administrador</option></select></div></div>
      <button class="btn" id="add" style="margin-top:12px">Dar acesso</button>
      <p class="nota">A pessoa cria a conta em "Criar conta" com este email. <b>Gestor</b>: tudo exceto gestores. <b>Receção / postos</b>: só receção, postos, inscritos, SOS e voluntários. <b>Administrador</b>: tudo.</p></div>
    <div class="cartao tabela"><table><tr><th>Nome</th><th>Email</th><th>Papel</th><th></th></tr>
    ${l.map(g => `<tr><td>${esc(g.nome)}</td><td>${esc(g.email)}</td><td><span class="etq">${esc(g.papel)}</span></td>
      <td>${g.email !== eu.email ? `<button class="btn contorno peq" data-x="${esc(g.email)}">Retirar</button>` : ''}</td></tr>`).join('')}</table></div>
    ${l.filter(g => g.papel === 'admin').length < 2 ? '<p class="nota">⚠️ Convém haver pelo menos 2 administradores.</p>' : ''}`;
  $('#add').onclick = async () => {
    const g = { email: $('#e').value.trim().toLowerCase(), nome: $('#n').value.trim(), papel: $('#p').value };
    if (!g.email.includes('@')) return toast('Email inválido.', true);
    try { await q(sb.from('trail_gestores').upsert(g)); await registo('deu acesso', `${g.email} (${g.papel})`); ir('gestores'); } catch (e) { falha(e); }
  };
  ecra.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    if (!confirm(`Retirar o acesso a ${b.dataset.x}?`)) return;
    try { await q(sb.from('trail_gestores').delete().eq('email', b.dataset.x)); await registo('retirou acesso', b.dataset.x); ir('gestores'); } catch (e) { falha(e); }
  });
};

arrancar().catch(falha);
