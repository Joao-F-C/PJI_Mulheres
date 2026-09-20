/* ============================================================
   ARQUIVO 03 — ESTAÇÃO LAMARR, 1940
   Sala de rádio física: equipamentos clicáveis, close-up lateral.
   Versão: varredura às cegas + fragmentos arrastáveis.
   ============================================================ */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- constantes de rádio ---------- */
const K_SNR = 900, K_RISCO = 90, G_ANALIS = 40;
const RUIDO = 18, SIGMA = 5, LIMIAR = 33, JAM_DBU = 95, SNR_MIN = 40;
const DERIVA = 0.35, CICLO_JAM = 3;

const CANAIS = [
  { rot:'A', tag:'CH-A', khz:3450, mod:'am',   dig:'4', pot:340 },
  { rot:'B', tag:'CH-B', khz:2200, mod:'none', dig:'7', pot:0   },
  { rot:'C', tag:'CH-C', khz:1180, mod:'fm',   dig:'9', pot:260 },
  { rot:'D', tag:'CH-D', khz:620,  mod:'cw',   dig:'1', pot:120 },
  { rot:'E', tag:'CH-E', khz:6890, mod:'cw',   dig:'1', pot:200 },
  { rot:'F', tag:'CH-F', khz:4100, mod:'none', dig:'3', pot:0   }
];

const ATIVOS    = CANAIS.map((c,i) => c.pot > 0 ? i : -1).filter(i => i >= 0);
const ORDEM_F   = ['CH-D','CH-C','CH-A','CH-E'];
const CODIGO    = ORDEM_F.map(t => CANAIS.find(c => c.tag === t).dig).join(''); // 1941
const COFRE     = '88';
const COFRE_ORD = 'DCAE';

/* alvos da varredura às cegas */
const ALVOS = ORDEM_F.map(t => CANAIS.find(c => c.tag === t));
const TOL   = 70;   // kHz de tolerância na trava
const PERTO = 900;  // kHz onde o calor começa

const DICAS = [
  'O mural traz as bandas prováveis. O medidor de calor sobe quando o dial se aproxima.',
  'Ganho fixo do analisador: o que muda o SNR é a potência real da portadora.',
  'Dois dos seis canais nunca saem do piso de ruído — o dial nunca vai travar neles.',
  'A gaveta pede o número de teclas de um piano e a ordem dos canais ativos por frequência crescente.'
];

const BOOT = [
  '  T E L E T I P O   E R I S  —  v2.14',
  '  ------------------------------------',
  '  setor .................. ESTAÇÃO LAMARR',
  '  ano .................... 1940',
  '  medidor de interceptação ...... ATIVO',
  '  analisador de espectro ........ ONLINE',
  '  jammer hostil ................. MÓVEL',
  '  integridade do arquivo ... 23% CORROMPIDO',
  '',
  '  > 4 algarismos. 2 tentativas.',
  '  > não seja triangulado.'
];

/* ---------- estado ---------- */
const CHAVE = 'eris.sala3';
const LIMPO = () => ({
  risco:0, travadas:[], tentTrava:3, digitos:{}, varreduras:{},
  tentativas:0, dicas:0, travado:false, cristais:false, cofreErros:0,
  jam:ATIVOS[Math.floor(Math.random()*ATIVOS.length)], jamVisto:false,
  acoes:0, inicio:Date.now(), concluida:false, colapsos:0
});
let S = LIMPO();

const salvar = () => { try{ localStorage.setItem(CHAVE, JSON.stringify(S)); }catch(e){} };
function carregar(){
  try{
    const d = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if(d) S = Object.assign(LIMPO(), d, { travado:false, concluida:false });
    if(!Array.isArray(S.travadas)) S.travadas = [];
    if(S.tentTrava == null) S.tentTrava = 3;
  }catch(e){}
}

/* ---------- física ---------- */
const calcSNR = (pot,g) => (K_SNR*pot)/(g*g);
function gauss(){ let u=0; while(!u) u=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*Math.random()); }
const varrer = (pot,g,jam) =>
  jam ? Math.round(JAM_DBU + Math.abs(gauss())*8)
      : Math.max(0, Math.round(RUIDO + (pot*.9)/(g*g/100) + gauss()*SIGMA));
const tolerancia = () => S.cristais ? TOL * 2 : TOL;

/* ---------- ciclos / jammer ---------- */
function acao(){
  S.acoes++;
  addRisco(DERIVA);
  if(S.acoes % CICLO_JAM === 0){
    const outros = ATIVOS.filter(i => i !== S.jam);
    S.jam = outros[Math.floor(Math.random()*outros.length)];
    S.jamVisto = false;
    nota('DESLOCAMENTO DE JAMMER\n\nA fonte hostil trocou de canal.', 2600);
    tocar('aviso');
  }
  renderBarra(); salvar();
}

/* ============================================================
   BARRA / MEDIDOR ANALÓGICO
   ============================================================ */
function addRisco(v){
  S.risco = clamp(S.risco + v, 0, 100);
  renderBarra(); salvar();
  if(v > 4) flash();
  if(S.risco >= 100) colapso();
}

function renderBarra(){
  const ang = -78 + (S.risco / 100) * 156;
  const ned = $('#medNeedle');
  if(ned) ned.style.transform = `rotate(${ang}deg)`;

  const t = $('#medTxt');
  if(t){
    t.textContent = S.risco.toFixed(0) + '%';
    t.className = S.risco > 70 ? 'erro' : S.risco > 40 ? 'aviso' : '';
  }

  const cc = $('#chipCanal');
  if(cc) cc.textContent = 'TRAVAS · ' + (S.travadas?.length || 0) + '/' + ALVOS.length;
  const cj = $('#chipJam');
  if(cj) cj.textContent = 'JAMMER · ' + (S.jamVisto ? CANAIS[S.jam].rot : '?');
  const ci = $('#chipCiclo');
  if(ci) ci.textContent = 'CICLO · ' + (CICLO_JAM - (S.acoes % CICLO_JAM));

  document.body.classList.toggle('critico', S.risco > 70);
}

function renderVu(pot){
  const vu = $('.vu');
  if(!vu) return;
  vu.classList.toggle('alto', pot > 250);
  $('#vuTxt').textContent = pot ? Math.round(pot/3) + ' dBu' : 'piso de ruído';
  $('#vuGraf').innerHTML = '<i></i>'.repeat(clamp(Math.round((pot||10)/28), 1, 10));
}

function flash(){
  document.body.classList.add('flash');
  setTimeout(() => document.body.classList.remove('flash'), 240);
}

/* ============================================================
   EQUIPAMENTOS  →  CLOSE-UP
   ============================================================ */
const MODULOS = {
  receptor: ['BANCO DE RECEPTORES',    'tplReceptor', initReceptor],
  terminal: ['ANALISADOR DE ESPECTRO', 'tplTerminal', initTerminal],
  cristais: ['GAVETA DE CRISTAIS',     'tplCristais', initCristais],
  mural:    ['MURAL DE SINAIS',        'tplMural',    null],
  porta:    ['PAINEL DA PORTA',        'tplPorta',    initPorta]
};

function aproximar(nome, eq){
  const [tit, tpl, init] = MODULOS[nome];
  $('#painelTit').textContent = tit;
  $('#painelCorpo').replaceChildren($('#' + tpl).content.cloneNode(true));
  $('#painel').hidden = false;
  $('#painel').scrollTop = 0;
  eq && eq.classList.add('visitado');
  tocar('abrir');
  init && init();
}

const recuar = () => { $('#painel').hidden = true; };

/* ============================================================
   RECEPTOR — varredura às cegas
   ============================================================ */
function initReceptor(){
  const dial = $('#dial'), out = $('#dialTxt');
  const mexer = () => { out.textContent = dial.value + ' kHz'; pintarCalor(+dial.value); };
  dial.oninput = mexer;
  mexer();

  $('#tentTxt').textContent = S.tentTrava;
  $('#btnTravar').onclick = travar;
  $('#btnDecodificar').onclick = decodificar;
  pintarFragmentos();
  previa();
}

const restantes = () => ALVOS.filter(a => !S.travadas.some(t => t.tag === a.tag));

function pintarCalor(khz){
  const alvos = restantes();
  const d = alvos.length ? Math.min(...alvos.map(a => Math.abs(a.khz - khz))) : Infinity;
  const nivel = d <= tolerancia() ? 'quente' : d <= PERTO ? 'morno' : 'frio';
  const barra = $('#barraCalor');
  if(barra) barra.dataset.calor = nivel;
  const txt = $('#calorTxt');
  if(txt) txt.textContent = !alvos.length ? 'BANDA VARRIDA' : nivel.toUpperCase();
}

function travar(){
  const fb = $('#fbLer'), khz = +$('#dial').value;
  if(!restantes().length)
    return msg(fb, '⚠ Todas as portadoras já estão travadas.', 'aviso');

  const alvo = restantes().find(a => Math.abs(a.khz - khz) <= tolerancia());
  addRisco(2); acao();
  if(S.risco >= 100) return;

  if(!alvo){
    S.tentTrava--;
    $('#tentTxt').textContent = Math.max(S.tentTrava, 0);
    tocar('falha'); tremer($('#barraCalor')); salvar();

    if(S.tentTrava <= 0){
      S.travadas = []; S.digitos = {}; S.tentTrava = 3; salvar();
      pintarFragmentos(); previa(); pintarCalor(khz);
      $('#tentTxt').textContent = 3;
      nota('TRAVA FRIA\n\nO receptor perdeu o engate. Fragmentos realocados.', 3200);
      return msg(fb, '✖ Trava fria demais. Todas as portadoras foram perdidas.', 'erro');
    }
    return msg(fb, `✖ Nada engatou em ${khz} kHz. Tentativas restantes: <b>${S.tentTrava}</b>`, 'erro');
  }

  const snr = calcSNR(alvo.pot, G_ANALIS);
  S.travadas.push({ tag:alvo.tag, khz:alvo.khz, dig:alvo.dig, snr:Math.round(snr) });
  S.digitos[alvo.tag] = alvo.dig;
  S.tentTrava = 3; salvar(); tocar('acerto');

  $('#tentTxt').textContent = 3;
  pintarCalor(khz); pintarFragmentos(); previa(); renderVu(alvo.pot);
  msg(fb, `✔ Portadora travada em <b>${alvo.khz} kHz</b> · SNR ${Math.round(snr)} dB ·
    fragmento <b>${alvo.dig}</b> adicionado à lista.`, 'ok');
}

/* ---- lista arrastável ---- */
let arrastado = null;

function pintarFragmentos(){
  const ul = $('#fragmentos');
  if(!ul) return;
  ul.replaceChildren();

  if(!S.travadas.length){
    ul.innerHTML = '<li class="vazio">nenhuma portadora travada</li>';
    return;
  }

  S.travadas.forEach((f, i) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.i = i;
    li.innerHTML = `<span>FRAGMENTO <b>${f.dig}</b></span>
                    <span class="hz">${f.khz} kHz · ${f.snr} dB</span>`;
    li.ondragstart = () => { arrastado = i; li.classList.add('arrastando'); };
    li.ondragend   = () => { arrastado = null;
      $$('#fragmentos li').forEach(x => x.classList.remove('arrastando','alvo')); };
    li.ondragover  = e => { e.preventDefault(); li.classList.add('alvo'); };
    li.ondragleave = () => li.classList.remove('alvo');
    li.ondrop = e => {
      e.preventDefault();
      if(arrastado === null || arrastado === i) return;
      const [m] = S.travadas.splice(arrastado, 1);
      S.travadas.splice(i, 0, m);
      salvar(); pintarFragmentos(); previa(); tocar('clique');
    };
    ul.appendChild(li);
  });
}

function previa(){
  const pr = $('#prevRisco'), ps = $('#prevSnr'), py = $('#prevSync');
  if(!pr) return;
  const n = S.travadas.length;

  pr.textContent = n + '/' + ALVOS.length;
  pr.className = n === ALVOS.length ? 'ok' : n ? 'aviso' : '';

  if(!n){ ps.textContent = py.textContent = '—'; ps.className = py.className = ''; return; }

  const media = S.travadas.reduce((a,f) => a + f.snr, 0) / n;
  ps.textContent = media.toFixed(0) + ' dB';
  ps.className = media < SNR_MIN ? 'erro' : 'ok';

  const cresc = S.travadas.every((f,i) => !i || f.khz > S.travadas[i-1].khz);
  py.textContent = n < 2 ? 'parcial' : (cresc ? 'CASADO' : 'DESCOMPASSO');
  py.className = n < 2 ? '' : (cresc ? 'ok' : 'erro');
}

function decodificar(){
  const fb = $('#fbLer');
  if(S.travadas.length < ALVOS.length)
    return msg(fb, `✖ Faltam portadoras: ${S.travadas.length}/${ALVOS.length}.`, 'erro');

  addRisco(3); acao();
  if(S.risco >= 100) return;

  const cresc = S.travadas.every((f,i) => !i || f.khz > S.travadas[i-1].khz);
  if(!cresc){
    addRisco(4); tocar('falha'); tremer($('#fragmentos'));
    return msg(fb, '✖ ORDEM INVÁLIDA — o rolo lê em frequência crescente. Reordene.', 'erro');
  }

  tocar('acerto');
  msg(fb, `✔ CADEIA CRUZADA → <b>${S.travadas.map(f => f.dig).join('')}</b>.
    Leve a sequência ao painel da porta.`, 'ok');
}

/* ============================================================
   ANALISADOR DE ESPECTRO
   ============================================================ */
function initTerminal(){
  const tb = $('#logDbu');
  Object.entries(S.varreduras).forEach(([rot, arr]) =>
    arr.forEach(v => { linhaLog(tb, rot, v); barraCrt(v); }));
  $('#btnVarrer').onclick = executarVarredura;
}

function executarVarredura(){
  const tela = $('#dbuTela');
  if(!S.travadas.length) return tela.textContent = 'SEM TRAVA';

  const f = S.travadas[S.travadas.length - 1];
  const idx = CANAIS.findIndex(c => c.tag === f.tag);
  const ehJam = idx === S.jam;
  const dbu = varrer(CANAIS[idx].pot, G_ANALIS, ehJam);
  if(ehJam) S.jamVisto = true;

  tela.textContent = dbu + ' dBu';
  (S.varreduras[CANAIS[idx].rot] || (S.varreduras[CANAIS[idx].rot] = [])).push(dbu);
  linhaLog($('#logDbu'), CANAIS[idx].rot, dbu, true);
  barraCrt(dbu);
  addRisco(2); acao(); renderVu(CANAIS[idx].pot);
}

function linhaLog(tb, rot, dbu, topo){
  if(!tb) return;
  const vazio = tb.querySelector('td[colspan]');
  if(vazio) vazio.closest('tr').remove();
  const estado = dbu > JAM_DBU ? ['erro','✖ JAMMER']
               : dbu > LIMIAR  ? ['ok','● PORTADORA']
               : ['erro','○ piso de ruído'];
  tb.insertAdjacentHTML(topo ? 'afterbegin' : 'beforeend',
    `<tr><td><b>${rot}</b></td><td>${G_ANALIS}</td><td>${dbu}</td>
     <td class="${estado[0]}">${estado[1]}</td></tr>`);
}

function barraCrt(dbu){
  const box = $('#oscBarras');
  if(!box) return;
  const b = document.createElement('i');
  b.style.height = clamp(dbu / 120 * 100, 3, 100) + '%';
  b.className = dbu > JAM_DBU ? 'jam' : dbu > LIMIAR ? 'ativa' : '';
  box.appendChild(b);
  while(box.children.length > 30) box.firstChild.remove();
}

/* ============================================================
   GAVETA DE CRISTAIS
   ============================================================ */
function initCristais(){
  const parc = $('#parcialCofre'), vid = $('#vidasCofre'), fb = $('#fbCofre');

  const pintar = () => {
    parc.innerHTML = '<span class="parcial-rot">TRAVA DUPLA DO ROLO PERFURADO</span>' +
      `<span class="slot ${S.cristais?'cheio':''}"><small>teclas</small>
         <b>${S.cristais?COFRE:'??'}</b></span>
       <span class="slot ${S.cristais?'cheio':''}"><small>ordem</small>
         <b>${S.cristais?COFRE_ORD:'????'}</b></span>`;
    const restam = 2 - (S.cofreErros % 2);
    vid.innerHTML = 'FORÇAMENTOS ANTES DO ALARME: ' +
      `<b class="${restam===1?'erro':'ok'}">` + '◆'.repeat(restam) + '◇'.repeat(2-restam) + '</b>';
  };
  pintar();

  if(S.cristais){
    $('#cofre').disabled = $('#cofreOrd').disabled = $('#btnCofre').disabled = true;
    return msg(fb, '✔ Gaveta aberta. Faixa de engate do dial ampliada.', 'ok');
  }

  const tentar = () => {
    const v = $('#cofre').value.trim();
    const o = $('#cofreOrd').value.trim().toUpperCase();
    if(!/^\d{2}$/.test(v) || !/^[A-F]{4}$/.test(o))
      return msg(fb, '✖ Dois algarismos e quatro rótulos de canal.', 'erro');

    if(v === COFRE && o === COFRE_ORD){
      S.cristais = true; S.cofreErros = 0; salvar();
      tocar('acerto'); destravarCristais(); pintar();
      $('#cofre').disabled = $('#cofreOrd').disabled = $('#btnCofre').disabled = true;
      return msg(fb, '✔ O rolo girou. Faixa de engate do dial ampliada.', 'ok');
    }

    S.cofreErros++; addRisco(4); acao(); salvar();
    tocar('falha'); tremer($('#cofre')); tremer($('#cofreOrd')); pintar();

    if(S.cofreErros % 2 === 0){
      addRisco(7);
      nota('ALARME DA GAVETA\n\nO mecanismo emitiu um pulso na banda.', 3000);
      return msg(fb, '✖ Dois forçamentos. +7% de interceptação.', 'erro');
    }
    msg(fb, '✖ Não cede. Antheil usou um piano — conte as teclas. '
          + 'A ordem segue a frequência crescente dos canais ativos.', 'erro');
  };

  $('#btnCofre').onclick = tentar;
  ['#cofre','#cofreOrd'].forEach(sel =>
    $(sel).onkeydown = e => { if(e.key === 'Enter') tentar(); });
}

function destravarCristais(){
  const eq = $('#eqCristais');
  if(!eq) return;
  eq.classList.remove('trancado');
  eq.classList.add('aberta');
}

/* ============================================================
   PORTA
   ============================================================ */
function initPorta(){
  $('#parcial').innerHTML = '<span class="parcial-rot">ALGARISMOS RECUPERADOS</span>' +
    ORDEM_F.map(t => {
      const c = CANAIS.find(x => x.tag === t), v = S.digitos[t];
      return `<span class="slot ${v?'cheio':''}"><small>${c.khz} kHz</small>
                <b>${v || '?'}</b></span>`;
    }).join('');
  renderVidas();
  $('#btnAbrir').onclick = conferirSenha;
  $('#senha').onkeydown = e => { if(e.key === 'Enter') conferirSenha(); };
}

function renderVidas(){
  const v = $('#vidas');
  if(!v) return;
  const restam = 2 - (S.tentativas % 2);
  v.innerHTML = 'TENTATIVAS ANTES DA PURGA: ' +
    `<b class="${restam===1?'erro':'ok'}">` + '◆'.repeat(restam) + '◇'.repeat(2-restam) + '</b>';
}

function conferirSenha(){
  const fb = $('#fbPorta');
  if($('#senha').value.trim() === CODIGO){ recuar(); return vitoria(); }

  S.tentativas++; addRisco(9); acao(); tocar('falha');
  tremer($('#senha')); renderVidas();
  msg(fb, `✖ CÓDIGO REJEITADO (falha ${S.tentativas % 2 || 2}/2)`, 'erro');
  if(S.risco >= 100) return;

  if(S.tentativas % 2 === 0){
    S.digitos = {}; S.varreduras = {}; S.travadas = []; S.tentTrava = 3;
    salvar(); recuar();
    telaFim('purga', 'JAMMING TOTAL',
      'Duas falhas. O inimigo saturou a banda: perdi todos os fragmentos e o log de varreduras.');
  }
}

/* ============================================================
   FIM / REINÍCIO
   ============================================================ */
function colapso(){
  S.colapsos++;
  recuar(); tocar('colapso');
  telaFim('risco', 'POSIÇÃO TRIANGULADA',
    'Sua portadora ficou exposta tempo demais. A estação foi localizada.');
}

function telaFim(tipo, tit, txt){
  S.travado = true;
  document.body.classList.add('travado');
  $('#fimCard').className = 'fim-card ' + tipo;
  $('#fimTit').textContent = tit;
  $('#fimTxt').textContent = txt;
  $('#fimStats').innerHTML = `
    <div><span>interceptação</span><b>${S.risco.toFixed(0)}%</b></div>
    <div><span>fragmentos</span><b>${S.travadas.length}/${ALVOS.length}</b></div>
    <div><span>dicas</span><b>${S.dicas}</b></div>
    <div><span>colapsos</span><b>${S.colapsos}</b></div>`;
  $('#btnContinuar').hidden = tipo === 'risco';
  $('#fim').hidden = false;
  salvar();
}

function reiniciarSala(){
  try{ localStorage.removeItem(CHAVE); }catch(e){}
  const colapsos = S.colapsos;
  S = LIMPO(); S.colapsos = colapsos;
  $$('.eris').forEach(e => e.remove());
  $$('.equip').forEach(h => h.classList.remove('visitado'));
  const eq = $('#eqCristais');
  if(eq){ eq.classList.add('trancado'); eq.classList.remove('aberta'); }
  recuar();
  $('#fim').hidden = true;
  $('#btnReiniciar').textContent = 'REINICIAR SALA';
  document.body.classList.remove('travado');
  renderBarra(); renderVu(0); salvar();
  nota('ESTAÇÃO REINICIADA\n\nBanda limpa. Jammer reposicionado.', 2800);
  tocar('abrir');
}

function continuarFim(){
  S.travado = false;
  document.body.classList.remove('travado');
  $('#fim').hidden = true;
  renderBarra();
}

function vitoria(){
  if(S.concluida) return;
  S.concluida = true;

  const min = Math.floor((Date.now() - S.inicio) / 60000);
  const rank = S.risco < 25 && !S.dicas && !S.colapsos ? 'FANTASMA'
             : S.risco < 50 ? 'DISCRETO'
             : S.risco < 80 ? 'DETECTÁVEL' : 'EXPOSTO';

  try{
    const prog = JSON.parse(localStorage.getItem('eris.progresso') || '{}');
    prog.sala3 = { ok:true, risco:S.risco, dicas:S.dicas, minutos:min, rank,
                   colapsos:S.colapsos };
    localStorage.setItem('eris.progresso', JSON.stringify(prog));
  }catch(e){}

  tocar('vitoria');
  const led = $('#portaLed');
  if(led) led.setAttribute('fill', '#7ef2a1');
  $('#fimCard').className = 'fim-card vitoria';
  $('#fimTit').textContent = 'PORTA DESTRAVADA';
  $('#fimTxt').textContent =
    `ARQUIVO 03 RESTAURADO — ${CODIGO}. Ano do depósito da patente de comunicação secreta.\n`
    + 'Hedy Lamarr e George Antheil: 88 frequências, um rolo de pianola, nenhuma royalty.';
  $('#fimStats').innerHTML = `
    <div><span>interceptação final</span><b>${S.risco.toFixed(0)}%</b></div>
    <div><span>tempo</span><b>${min} min</b></div>
    <div><span>dicas</span><b>${S.dicas}</b></div>
    <div><span>avaliação</span><b>${rank}</b></div>`;
  $('#btnContinuar').hidden = true;
  $('#btnReiniciar').textContent = 'JOGAR NOVAMENTE';
  $('#fim').hidden = false;
  document.body.classList.add('travado');
}

/* ============================================================
   UTIL
   ============================================================ */
const msg = (el, txt, cls) => { if(el){ el.className = 'fb ' + cls; el.innerHTML = txt; } };

function nota(txt, ms){
  const d = document.createElement('div');
  d.className = 'eris'; d.textContent = txt;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

function tremer(el){
  if(!el) return;
  el.classList.remove('tremer'); void el.offsetWidth; el.classList.add('tremer');
}

function poeira(){
  const box = $('#poeira');
  if(!box) return;
  for(let i = 0; i < 30; i++){
    const p = document.createElement('i');
    p.style.cssText =
      `left:${Math.random()*100}%;top:${Math.random()*100}%;
       animation-duration:${10+Math.random()*16}s;
       animation-delay:-${Math.random()*16}s;
       transform:scale(${.4+Math.random()});`;
    box.appendChild(p);
  }
}

function bootSeq(){
  const el = $('#bootTxt');
  if(!el) return;
  let li = 0, ci = 0;
  const t = setInterval(() => {
    if(li >= BOOT.length){
      clearInterval(t);
      setTimeout(() => {
        $('#boot').classList.add('sai');
        setTimeout(() => { const b = $('#boot'); b && b.remove(); }, 800);
      }, 700);
      return;
    }
    const linha = BOOT[li];
    if(ci === 0) el.textContent += '\n';
    el.textContent += linha[ci] || '';
    if(++ci > linha.length){ li++; ci = 0; if(linha.trim()) tocar('tick'); }
  }, 12);
}

/* áudio procedural — timbres de válvula */
let AC = null;
const PRESETS = {
  clique:[720,.05,'square',.05],  tick:[1200,.03,'square',.03],
  abrir:[290,.18,'sine',.07],     acerto:[590,.24,'triangle',.09],
  aviso:[380,.32,'sine',.08],     falha:[110,.38,'sawtooth',.09],
  colapso:[62,.95,'sawtooth',.12],vitoria:[470,.75,'triangle',.11]
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

  $$('.equip').forEach(h => h.onclick = () => {
    if(S.travado) return;
    aproximar(h.dataset.est, h);
  });

  if(S.cristais) destravarCristais();

  $('#painelFechar').onclick = recuar;
  document.addEventListener('keydown', e => { if(e.key === 'Escape') recuar(); });

  $('#btnDica').onclick = () => {
    if(S.travado) return;
    if(S.dicas >= DICAS.length) return nota('Sem mais dicas disponíveis.', 2200);
    addRisco(12);
    nota(`DICA ${S.dicas + 1}/${DICAS.length}\n\n${DICAS[S.dicas++]}`, 7000);
    salvar();
  };

  $('#btnReset').onclick = () => {
    if(confirm('Reiniciar a estação? Interceptação, fragmentos e cristais serão perdidos.'))
      reiniciarSala();
  };
  $('#btnReiniciar').onclick = reiniciarSala;
  $('#btnContinuar').onclick = continuarFim;

  renderBarra(); renderVu(0);
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', iniciar)
  : iniciar();
