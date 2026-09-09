/* ============================================================
   ARQUIVO 02 — LABORATÓRIO CURIE
   ============================================================ */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------- FÍSICA ---------------- */
const K = 900, FUNDO = 18, SIGMA = 5;
const LIMIAR = FUNDO + 3 * SIGMA;   // 33 cpm
const LUZ_MIN = 40, D_TERM = 40;

const AMOSTRAS = [
  { rot:'A', el:'Rn', z:86, em:'gama', dig:'9', atv:340 },
  { rot:'B', el:'Bi', z:83, em:'none', dig:'4', atv:0   },
  { rot:'C', el:'Ra', z:88, em:'beta', dig:'8', atv:260 },
  { rot:'D', el:'Po', z:84, em:'alfa', dig:'1', atv:120 },
  { rot:'E', el:'At', z:85, em:'alfa', dig:'8', atv:200 }
];

const ORDEM_Z = ['Po','At','Rn','Ra'];
const CODIGO  = ORDEM_Z.map(e => AMOSTRAS.find(a => a.el === e).dig).join(''); // 1898
const COFRE   = '84';

const ATENUACAO = {
  nenhuma:{alfa:1,beta:1,gama:1,none:1},
  papel:{alfa:.02,beta:.9,gama:1,none:1},
  aluminio:{alfa:0,beta:.05,gama:.85,none:1},
  chumbo:{alfa:0,beta:0,gama:.03,none:1}
};
const OPACIDADE = { nenhuma:1, papel:.85, aluminio:.4, chumbo:0 };

const DICAS = [
  'O mural tem três tabelas. Você precisa das três — não só da que parece óbvia.',
  'Descubra o tipo de emissão antes de blindar. Blindagem errada é dose desperdiçada ou leitura cega.',
  'Uma das cinco amostras nunca ultrapassa o fundo do Geiger. Ela não entra no código.',
  'Ordene as amostras ativas por número atômico crescente e leia os algarismos na sequência.'
];

const BOOT = [
  'ERIS v2.14 — carregando ARQUIVO 02…',
  'setor: LABORATÓRIO CURIE ....... [OK]',
  'dosímetro pessoal ............... [ATIVO]',
  'contador Geiger–Müller .......... [ONLINE]',
  'integridade do arquivo .......... [12% CORROMPIDO]',
  '',
  '> recupere 4 algarismos. sobreviva à dose.'
];

/* ---------------- ESTADO ---------------- */
const CHAVE = 'eris.sala2';
const LIMPO = () => ({
  dose:0, frasco:null, blindagem:'nenhuma', digitos:{}, contagens:{},
  tentativas:0, dicas:0, travado:false, armario:false, cofreErros:0,
  inicio:Date.now(), concluida:false, colapsos:0
});

let S = LIMPO();

const salvar = () => { try{ localStorage.setItem(CHAVE, JSON.stringify(S)); }catch(e){} };
const carregar = () => {
  try{
    const d = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if(d) S = Object.assign(LIMPO(), d, { travado:false, concluida:false });
  }catch(e){}
};

/* ---------------- CÁLCULOS ---------------- */
const calcDose = (atv,d,b,em) => (K*atv)/(d*d) * ATENUACAO[b][em];
const calcLuz  = (atv,d,b)    => (K*atv)/(d*d) * OPACIDADE[b];
function gauss(){ let u=0; while(!u) u=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*Math.random()); }
const contar = (atv,d) => Math.max(0, Math.round(FUNDO + (atv*.9)/(d*d/100) + gauss()*SIGMA));

/* ============================================================
   HUD
   ============================================================ */
function addDose(v){
  S.dose = clamp(S.dose + v, 0, 100);
  renderHud(); salvar();
  if(v > 4) flash();
  if(S.dose >= 100) colapso();
}

function renderHud(){
  const f = $('#doseFill');
  f.style.width = S.dose + '%';
  f.className = 'dose-fill' + (S.dose > 75 ? ' alta' : S.dose > 45 ? ' med' : '');
  $('#doseTxt').textContent = S.dose.toFixed(0) + '%';
  $('#doseTxt').className = 'dose-txt' + (S.dose > 75 ? ' erro' : S.dose > 45 ? ' aviso' : '');
  $('#hudSel').textContent = 'amostra: ' + (S.frasco === null ? '—' : AMOSTRAS[S.frasco].rot);
  document.body.classList.toggle('critico', S.dose > 75);
}

function geigerHud(atv){
  const g = $('#geiger');
  const t = $('.geiger-txt', g);
  g.classList.toggle('ativo', !!atv);
  g.classList.toggle('alto', atv > 250);
  t.textContent = atv ? Math.round(atv/3) + ' un/s' : 'silêncio (fundo)';
  $('#geigerGraf').innerHTML =
    '<i></i>'.repeat(clamp(Math.round((atv||10)/28), 1, 12));
}

function flash(){
  document.body.classList.add('flash');
  setTimeout(() => document.body.classList.remove('flash'), 240);
}

/* ============================================================
   MÓDULOS
   ============================================================ */
const MODULOS = {
  bancada:  ['BANCADA DE AMOSTRAS',    'tplBancada',  initBancada],
  terminal: ['TERMINAL ERIS · GEIGER', 'tplTerminal', initTerminal],
  armario:  ['ARMÁRIO DE BLINDAGEM',   'tplArmario',  initArmario],
  mural:    ['MURAL DE DADOS',         'tplMural',    null],
  porta:    ['PAINEL DA PORTA',        'tplPorta',    initPorta]
};

function abrirEstacao(nome, hs){
  const [tit, tpl, init] = MODULOS[nome];
  $('#modTitulo').textContent = tit;
  $('#modCorpo').replaceChildren($('#' + tpl).content.cloneNode(true));
  $('#overlay').hidden = false;
  hs && hs.classList.add('visitado');
  tocar('abrir');
  init && init();
}
const fecharModulo = () => $('#overlay').hidden = true;

/* ---------------- BANCADA ---------------- */
function initBancada(){
  const box = $('#frascos');
  box.replaceChildren();

  AMOSTRAS.forEach((a,i) => {
    const b = document.createElement('button');
    b.className = 'frasco';
    b.setAttribute('aria-label', 'Frasco ' + a.rot);
    b.innerHTML =
      `<span class="brilho"></span><span class="liquido"></span>
       <span class="tag">${a.el}·${a.z}</span>
       <span class="dig">${a.dig}</span>
       <span class="rotulo">${a.rot}</span>`;
    if(S.digitos[a.el]) b.classList.add('lido','revelado');
    if(S.frasco === i)  b.classList.add('sel');
    b.onclick = () => { 
      $$('.frasco').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel'); S.frasco = i;
      renderHud(); geigerHud(a.atv); previa(); tocar('clique');
    };
    box.appendChild(b);
  });

  $('#dist').oninput = e => { $('#outD').textContent = e.target.value; previa(); };

  $$('#blindagens button').forEach(b => {
    b.disabled = !S.armario && b.dataset.b !== 'nenhuma';
    b.classList.toggle('ativo', b.dataset.b === S.blindagem);
    b.onclick = () => {
      $$('#blindagens button').forEach(x => x.classList.remove('ativo'));
      b.classList.add('ativo'); S.blindagem = b.dataset.b;
      previa(); tocar('clique');
    };
  });

  $('#btnLer').onclick = lerAmostra;
  previa();
}

/* Prévia: mostra o custo antes de agir — recompensa quem raciocina */
function previa(){
  const pd = $('#prevDose'), pl = $('#prevLuz');
  if(!pd) return;
  if(S.frasco === null){ pd.textContent = pl.textContent = '—'; return; }
  const a = AMOSTRAS[S.frasco], d = +$('#dist').value;
  const dose = calcDose(a.atv, d, S.blindagem, a.em);
  const lux  = calcLuz(a.atv, d, S.blindagem);
  pd.textContent = '+' + dose.toFixed(1) + '%';
  pd.className = dose > 12 ? 'erro' : dose > 5 ? 'aviso' : 'ok';
  pl.textContent = lux.toFixed(0) + ' un';
  pl.className = lux < LUZ_MIN ? 'erro' : 'ok';
}

function lerAmostra(){
  const fb = $('#fbLer');
  if(S.frasco === null) return msg(fb, '✖ Nenhuma amostra selecionada.', 'erro');

  const a = AMOSTRAS[S.frasco], d = +$('#dist').value, b = S.blindagem;
  const custo = calcDose(a.atv, d, b, a.em), lux = calcLuz(a.atv, d, b);
  addDose(custo);
  if(S.dose >= 100) return;

  const el = $$('.frasco')[S.frasco];

  if(lux < LUZ_MIN){
    tocar('falha');
    return msg(fb, `✖ ILEGÍVEL — fluxo ${lux.toFixed(0)} un. (mínimo ${LUZ_MIN}).<br>
      Aproxime-se ou use blindagem menos densa. Dose: +${custo.toFixed(1)}%`, 'erro');
  }

  el.classList.add('revelado');

  if(a.atv === 0){
    tocar('aviso');
    return msg(fb, `⚠ Gravação legível: <b>${a.el}·${a.z}</b> · algarismo <b>${a.dig}</b>.<br>
      O Geiger nunca a distinguiu do fundo — amostra inerte, fora do código.
      Dose: +${custo.toFixed(1)}%`, 'aviso');
  }

  S.digitos[a.el] = a.dig;
  el.classList.add('lido'); salvar(); tocar('acerto');
  msg(fb, `✔ <b>${a.el}</b> (Z=${a.z}, emissão ${a.em}) → algarismo <b>${a.dig}</b> registrado.<br>
    Dose: +${custo.toFixed(1)}% · lidas: ${Object.keys(S.digitos).length}/4`, 'ok');
}

/* ---------------- TERMINAL ---------------- */
function initTerminal(){
  const tb = $('#logCpm');
  Object.entries(S.contagens).forEach(([rot, arr]) =>
    arr.forEach(c => { linhaLog(tb, rot, c); barraOsc(c); }));
  $('#btnContar').onclick = executarContagem;
}

function executarContagem(){
  if(S.frasco === null) return $('#cpmTela').textContent = 'SEM AMOSTRA';

  const a = AMOSTRAS[S.frasco], btn = $('#btnContar');
  btn.disabled = true;
  let t = 5;
  $('#cpmTela').textContent = 'medindo… ' + t + 's';
  $('#cpmTela').classList.add('medindo');

  const timer = setInterval(() => {
    t--; tocar('tick');
    if(t > 0) return $('#cpmTela').textContent = 'medindo… ' + t + 's';
    clearInterval(timer);
    btn.disabled = false;
    $('#cpmTela').classList.remove('medindo');

    const cpm = contar(a.atv, D_TERM);
    $('#cpmTela').textContent = cpm + ' cpm';
    (S.contagens[a.rot] || (S.contagens[a.rot] = [])).push(cpm);
    linhaLog($('#logCpm'), a.rot, cpm, true);
    barraOsc(cpm);
    addDose(2); geigerHud(a.atv);
  }, 1000);
}

function linhaLog(tb, rot, cpm, topo){
  const vazio = tb.querySelector('td[colspan]');
  if(vazio) vazio.closest('tr').remove();
  const ativa = cpm > LIMIAR;
  tb.insertAdjacentHTML(topo ? 'afterbegin' : 'beforeend',
    `<tr><td><b>${rot}</b></td><td>${D_TERM} cm</td><td>${cpm}</td>
     <td class="${ativa?'ok':'erro'}">${ativa?'● ATIVA':'○ dentro do fundo'}</td></tr>`);
}

function barraOsc(cpm){
  const box = $('#oscBarras');
  if(!box) return;
  const b = document.createElement('i');
  b.style.height = clamp(cpm / 120 * 100, 3, 100) + '%';
  b.className = cpm > LIMIAR ? 'ativa' : '';
  box.appendChild(b);
  while(box.children.length > 28) box.firstChild.remove();
}

/* ---------------- ARMÁRIO ---------------- */
function initArmario(){
  const parc = $('#parcialCofre'), vid = $('#vidasCofre'), fb = $('#fbCofre');

  const pintar = () => {
    parc.innerHTML = '<span class="parcial-rot">TRAVA MECÂNICA</span>' +
      `<span class="slot ${S.armario?'cheio':''}"><small>Z</small><b>${S.armario?COFRE:'??'}</b></span>`;
    const restam = 3 - (S.cofreErros % 3);
    vid.innerHTML = 'FORÇAMENTOS ANTES DO ALARME: ' +
      `<b class="${restam===1?'erro':restam===2?'aviso':'ok'}">` +
      '◆'.repeat(restam) + '◇'.repeat(3-restam) + '</b>';
  };
  pintar();

  if(S.armario){
    $('#cofre').disabled = $('#btnCofre').disabled = true;
    return msg(fb, '✔ Gaveta já aberta. Blindagens liberadas.', 'ok');
  }

  const tentar = () => {
    const v = $('#cofre').value.trim();
    if(!/^\d{2}$/.test(v)) return msg(fb, '✖ A placa aceita dois algarismos.', 'erro');

    if(v === COFRE){
      S.armario = true; S.cofreErros = 0; salvar();
      tocar('acerto'); destravarArmario(); pintar();
      $('#btnCofre').disabled = $('#cofre').disabled = true;
      return msg(fb, '✔ Gaveta cedeu. PAPEL, ALUMÍNIO e CHUMBO disponíveis na bancada.', 'ok');
    }

    S.cofreErros++; addDose(3); salvar();
    tocar('falha'); tremer($('#cofre')); pintar();

    if(S.cofreErros % 3 === 0){
      addDose(5);
      eris('ALARME DA GAVETA\n\nTrês forçamentos. Dose adicional aplicada.', 3000);
      return msg(fb, '✖ Mecanismo reage: purga de pressão. +5% de dose.', 'erro');
    }
    msg(fb, '✖ Não cede. O elemento homenageia a Polônia — consulte a tabela de Z.', 'erro');
  };

  $('#btnCofre').onclick = tentar;
  $('#cofre').onkeydown = e => { if(e.key === 'Enter') tentar(); };
}


function destravarArmario(){
  const hs = $('#hsArmario');
  hs.classList.remove('bloqueado');
  hs.classList.add('aberto');
  $('#objTrava').textContent = '✔';
}

/* ---------------- PORTA ---------------- */
function initPorta(){
  $('#parcial').innerHTML = '<span class="parcial-rot">ALGARISMOS RECUPERADOS</span>' +
    ORDEM_Z.map(e => {
      const a = AMOSTRAS.find(x => x.el === e), v = S.digitos[e];
      return `<span class="slot ${v?'cheio':''}"><small>Z=${a.z}</small><b>${v || '?'}</b></span>`;
    }).join('');

  renderVidas();
  $('#btnAbrir').onclick = conferirSenha;
  $('#senha').onkeydown = e => { if(e.key === 'Enter') conferirSenha(); };
}
function renderVidas(){
  const v = $('#vidas');
  if(!v) return;
  const restam = 3 - (S.tentativas % 3);
  v.innerHTML = 'TENTATIVAS ANTES DA PURGA: ' +
    '<b class="' + (restam === 1 ? 'erro' : restam === 2 ? 'aviso' : 'ok') + '">' +
    '◆'.repeat(restam) + '◇'.repeat(3 - restam) + '</b>';
}

function conferirSenha(){
  const fb = $('#fbPorta');
  if($('#senha').value.trim() === CODIGO){ fecharModulo(); return vitoria(); }

  S.tentativas++; addDose(6); tocar('falha');
  tremer($('#senha')); renderVidas();
  msg(fb, `✖ CÓDIGO REJEITADO (falha ${S.tentativas % 3 || 3}/3)`, 'erro');
  if(S.dose >= 100) return;

  if(S.tentativas % 3 === 0){
    S.digitos = {}; salvar(); fecharModulo();
    telaFim('purga', 'PURGA DE MEMÓRIA — ERIS',
      'Três falhas consecutivas. Apaguei todos os algarismos recuperados.');
  }
}

/* ============================================================
   FIM DE JOGO / REINÍCIO
   ============================================================ */
function colapso(){
  S.colapsos++;
  fecharModulo(); tocar('colapso');
  telaFim('dose', 'DOSE LETAL — 100%',
    'Seu dosímetro saturou. Descontaminação de emergência acionada.');
}

function telaFim(tipo, tit, txt){
  S.travado = true;
  document.body.classList.add('travado');

  $('#fimCard').className = 'fim-card ' + tipo;
  $('#fimTit').textContent = tit;
  $('#fimTxt').textContent = txt;
  $('#fimStats').innerHTML = `
    <div><span>dose</span><b>${S.dose.toFixed(0)}%</b></div>
    <div><span>algarismos</span><b>${Object.keys(S.digitos).length}/4</b></div>
    <div><span>dicas</span><b>${S.dicas}</b></div>
    <div><span>colapsos</span><b>${S.colapsos}</b></div>`;

  // "continuar" só existe na purga; na dose letal o reinício é obrigatório
  $('#btnContinuar').hidden = tipo === 'dose';
  $('#fim').hidden = false;
  salvar();
}

function reiniciarSala(){
  try{ localStorage.removeItem(CHAVE); }catch(e){}
  const colapsos = S.colapsos;
  S = LIMPO();
  S.colapsos = colapsos;
  $$('.eris').forEach(e => e.remove());
  $$('.hotspot').forEach(h => h.classList.remove('visitado'));
  $('#hsArmario').classList.add('bloqueado');
  $('#hsArmario').classList.remove('aberto');
  $('#objTrava').textContent = '🔒';
  fecharModulo();
  $('#fim').hidden = true;
  document.body.classList.remove('travado');
  renderHud(); geigerHud(0); salvar();
  eris('SALA REINICIADA\n\nDosímetro zerado. Amostras reembaladas.', 2800);
  tocar('abrir');
}

function continuarFim(){
  S.travado = false;
  document.body.classList.remove('travado');
  $('#fim').hidden = true;
  renderHud();
}

function vitoria(){
  if(S.concluida) return;
  S.concluida = true;

  const min = Math.floor((Date.now() - S.inicio) / 60000);
  const rank = S.dose < 30 && !S.dicas && !S.colapsos ? 'IMPECÁVEL'
             : S.dose < 55 ? 'CAUTELOSO'
             : S.dose < 80 ? 'ACEITÁVEL' : 'TEMERÁRIO';

  try{
    localStorage.setItem('eris.progresso', JSON.stringify({
      sala2:{ ok:true, dose:S.dose, dicas:S.dicas, minutos:min, rank,
              colapsos:S.colapsos, contaminado:['caderno-curie'] }
    }));
  }catch(e){}

  tocar('vitoria');
  $('#fimCard').className = 'fim-card vitoria';
  $('#fimTit').textContent = 'PORTA DESTRAVADA';
  $('#fimTxt').textContent =
    `ARQUIVO 02 RESTAURADO — ${CODIGO}. Ano do anúncio do polônio e do rádio.\n`
    + 'O caderno de laboratório permanece contaminado: não pode ir à Sala 3.';
  $('#fimStats').innerHTML = `
    <div><span>dose final</span><b>${S.dose.toFixed(0)}%</b></div>
    <div><span>tempo</span><b>${min} min</b></div>
    <div><span>dicas</span><b>${S.dicas}</b></div>
    <div><span>avaliação</span><b>${rank}</b></div>`;
  $('#btnContinuar').hidden = true;
  $('#btnReiniciar').textContent = '↺ JOGAR NOVAMENTE';
  $('#fim').hidden = false;
  document.body.classList.add('travado');
}

/* ============================================================
   UTIL
   ============================================================ */
const msg = (el, txt, cls) => { el.className = 'fb ' + cls; el.innerHTML = txt; };

function eris(txt, ms){
  const d = document.createElement('div');
  d.className = 'eris'; d.textContent = txt;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

function tremer(el){
  if(!el) return;
  el.classList.remove('tremer');
  void el.offsetWidth;
  el.classList.add('tremer');
}

/* poeira radioativa flutuante */
function poeira(){
  const box = $('#poeira');
  for(let i = 0; i < 34; i++){
    const p = document.createElement('i');
    p.style.cssText =
      `left:${Math.random()*100}%;top:${Math.random()*100}%;
       animation-duration:${8+Math.random()*14}s;
       animation-delay:-${Math.random()*14}s;
       transform:scale(${.4+Math.random()});`;
    box.appendChild(p);
  }
}

/* boot datilografado */
function bootSeq(){
  const el = $('#bootTxt');
  let li = 0, ci = 0;
  const t = setInterval(() => {
    if(li >= BOOT.length){
      clearInterval(t);
      setTimeout(() => {
        $('#boot').classList.add('sai');
        setTimeout(() => $('#boot').remove(), 700);
      }, 650);
      return;
    }
    const linha = BOOT[li];
    if(ci === 0) el.textContent += '\n';
    el.textContent += linha[ci] || '';
    if(++ci > linha.length){ li++; ci = 0; if(linha) tocar('tick'); }
  }, 14);
}

/* áudio procedural */
let AC = null;
const PRESETS = {
  clique:[880,.04,'square',.05], tick:[1400,.03,'square',.035],
  abrir:[330,.16,'sine',.07],    acerto:[660,.22,'triangle',.09],
  aviso:[420,.3,'sine',.08],     falha:[130,.35,'sawtooth',.09],
  colapso:[70,.9,'sawtooth',.12],vitoria:[520,.7,'triangle',.11]
};
function tocar(n){
  const p = PRESETS[n]; if(!p) return;
  try{
    if(!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const [f,dur,tipo,vol] = p;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + dur);
    o.connect(g).connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  }catch(e){}
}

/* ============================================================
   BOOT
   ============================================================ */
function iniciar(){
  carregar(); poeira(); bootSeq();

  $$('.hotspot').forEach(h => h.onclick = () => {
    if(S.travado) return;
    if(h.classList.contains('bloqueado'))
      return eris('ARMÁRIO TRANCADO\n\nUm número de prótons libera a gaveta.', 2600);
    abrirEstacao(h.dataset.est, h);
  });

  if(S.armario) destravarArmario();

  $('#modFechar').onclick = fecharModulo;
  $('#overlay').onclick = e => { if(e.target === $('#overlay')) fecharModulo(); };
  document.addEventListener('keydown', e => { if(e.key === 'Escape') fecharModulo(); });

  $('#btnDica').onclick = () => {
    if(S.travado) return;
    if(S.dicas >= DICAS.length) return eris('Sem mais dicas disponíveis.', 2200);
    addDose(8);
    eris(`DICA ${S.dicas + 1}/${DICAS.length}\n\n${DICAS[S.dicas++]}`, 7000);
    salvar();
  };

  $('#btnReset').onclick = () => {
    if(confirm('Reiniciar a sala? Dose, algarismos e blindagens serão perdidos.'))
      reiniciarSala();
  };
  $('#btnReiniciar').onclick = reiniciarSala;
  $('#btnContinuar').onclick = continuarFim;

  renderHud(); geigerHud(0);
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', iniciar)
  : iniciar();
