/* ============================================================
   PROJETO ATHENA — SALA 1 (ADA LOVELACE)
   Lógica do enigma, terminal, objetos e progressão.
   ============================================================ */
(() => {
'use strict';

/* ============================================================
   1. ESTADO
   ============================================================ */
const CONFIG = {
    SENHA_LOGIN : 'AAL',        // iniciais de Augusta Ada Lovelace
    CODIGO_PORTA: '1843',       // ano das Notas sobre a Máquina Analítica
    PROX_SALA   : 'sala2.html',
    MENU        : 'index.html',
    CHAVE_SAVE  : 'athena_sala1'
};

const estado = {
    tempo        : 0,
    timerId      : null,
    autenticado  : false,
    codigoRevelado: false,
    tentativas   : 0,
    dicaIndice   : 0,
    itens        : new Set(),      // pistas coletadas
    vistos       : new Set(),      // objetos investigados
    etapas       : { pista:false, login:false, codigo:false, porta:false },
    som          : true,
    concluida    : false
};

const $  = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

/* ============================================================
   2. ÁUDIO (Web Audio API — sem arquivos externos)
   ============================================================ */
let ctxAudio = null;
function audioCtx() {
    if (!ctxAudio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctxAudio = new AC();
    }
    return ctxAudio;
}

/** Toca um bipe sintetizado. */
function bip(freq = 440, dur = 0.08, tipo = 'square', vol = 0.05) {
    if (!estado.som) return;
    const ac = audioCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();

    const osc = ac.createOscillator();
    const gan = ac.createGain();
    osc.type = tipo;
    osc.frequency.value = freq;
    gan.gain.setValueAtTime(vol, ac.currentTime);
    gan.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(gan).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
}

const SOM = {
    clique  : () => bip(520, .05, 'square', .04),
    tecla   : () => bip(680, .04, 'square', .05),
    erro    : () => { bip(180, .16, 'sawtooth', .06); setTimeout(() => bip(120, .22, 'sawtooth', .06), 130); },
    acerto  : () => { [660, 880, 1180].forEach((f, i) => setTimeout(() => bip(f, .12, 'triangle', .05), i * 90)); },
    achou   : () => { bip(880, .09, 'triangle', .05); setTimeout(() => bip(1320, .14, 'triangle', .05), 90); },
    ligar   : () => { bip(220, .1, 'sine', .05); setTimeout(() => bip(440, .2, 'sine', .04), 100); },
    porta   : () => { bip(90, .5, 'sine', .07); setTimeout(() => bip(300, .4, 'sine', .04), 200); },
    negado  : () => bip(140, .25, 'sawtooth', .06)
};

/* ============================================================
   3. UTILITÁRIOS DE UI
   ============================================================ */
/** Abre um modal (remove hidden + adiciona .ativo). */
function abrirModal(el) {
    if (!el) return;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('ativo'));
    const foco = el.querySelector('button, input, [tabindex]');
    if (foco) setTimeout(() => foco.focus(), 60);
}

/** Fecha um modal. */
function fecharModal(el) {
    if (!el) return;
    el.classList.remove('ativo');
    setTimeout(() => { el.hidden = true; }, 350);
}

/** Exibe a legenda narrativa na base da tela. */
let legendaTimer = null;
function narrar(texto, ms = 4200) {
    const box = $('#legenda');
    const txt = $('#legenda-txt');
    if (!box || !txt) return;

    txt.innerHTML = texto;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('visivel'));

    clearTimeout(legendaTimer);
    legendaTimer = setTimeout(() => {
        box.classList.remove('visivel');
        setTimeout(() => { box.hidden = true; }, 400);
    }, ms);
}

/** Marca uma etapa do HUD como concluída e a seguinte como atual. */
const ORDEM_ETAPAS = ['pista', 'login', 'codigo', 'porta'];
function concluirEtapa(nome) {
    if (estado.etapas[nome]) return;
    estado.etapas[nome] = true;
    atualizarEtapas();
    salvar();
}

function atualizarEtapas() {
    const proxima = ORDEM_ETAPAS.find(e => !estado.etapas[e]);
    $$('.etapa').forEach(li => {
        const nome = li.dataset.etapa;
        li.classList.toggle('feita', !!estado.etapas[nome]);
        li.classList.toggle('atual', nome === proxima);
    });
}

/** Adiciona item ao "inventário" da sala. */
function coletar(id, rotulo) {
    if (estado.itens.has(id)) return false;
    estado.itens.add(id);
    SOM.achou();
    narrar(`<strong>Item obtido:</strong> ${rotulo}`);
    // Integração opcional com inventario.js
    if (window.Inventario?.adicionar) {
        window.Inventario.adicionar({ id, rotulo, sala: 1 });
    }
    salvar();
    return true;
}

/* ============================================================
   4. PERSISTÊNCIA
   ============================================================ */
function salvar() {
    try {
        localStorage.setItem(CONFIG.CHAVE_SAVE, JSON.stringify({
            tempo: estado.tempo,
            autenticado: estado.autenticado,
            codigoRevelado: estado.codigoRevelado,
            tentativas: estado.tentativas,
            itens: [...estado.itens],
            vistos: [...estado.vistos],
            etapas: estado.etapas,
            concluida: estado.concluida
        }));
    } catch (_) { /* modo privado: ignora */ }
}

function carregar() {
    try {
        const raw = localStorage.getItem(CONFIG.CHAVE_SAVE);
        if (!raw) return;
        const d = JSON.parse(raw);
        estado.tempo          = d.tempo ?? 0;
        estado.autenticado    = !!d.autenticado;
        estado.codigoRevelado = !!d.codigoRevelado;
        estado.tentativas     = d.tentativas ?? 0;
        estado.itens          = new Set(d.itens ?? []);
        estado.vistos         = new Set(d.vistos ?? []);
        estado.etapas         = { ...estado.etapas, ...(d.etapas ?? {}) };
        aplicarEstadoSalvo();
    } catch (_) { /* dado corrompido: começa limpo */ }
}

function aplicarEstadoSalvo() {
    atualizarEtapas();

    if (estado.autenticado) {
        destrancarSistema(true);
        $('#armario')?.classList.remove('trancado');
    }
    if (estado.itens.has('credencial')) {
        $('#livro-pista')?.classList.add('lido');
    }
    if (estado.itens.has('bilhete')) {
        $('#lixeira')?.classList.add('vazia');
    }
    if (estado.codigoRevelado) {
        $('#porta')?.classList.add('destravada');
        $('#painel-texto') && ($('#painel-texto').textContent = 'CÓDIGO PENDENTE');
        $('#msg-extra') && ($('#msg-extra').hidden = false);
    }
    estado.vistos.forEach(nome => {
        $$('.objeto').find(o => o.dataset.nome === nome)?.classList.add('visto');
    });
    $('#teclado-tentativas') &&
        ($('#teclado-tentativas').textContent = `Tentativas: ${estado.tentativas}`);
}

/* ============================================================
   5. INTRO
   ============================================================ */
function iniciarIntro() {
    const intro = $('#intro-sala');
    const btn   = $('#intro-pular');

    const entrar = () => {
        intro?.classList.add('saindo');
        setTimeout(() => { if (intro) intro.hidden = true; }, 900);
        iniciarTimer();
        narrar('Você está no <strong>laboratório de Ada Lovelace</strong>. Investigue os objetos clicando neles.', 6000);
    };

    btn?.addEventListener('click', () => { SOM.clique(); entrar(); });
    // Fallback: entra sozinha após 9s se ninguém clicar
    setTimeout(() => { if (intro && !intro.hidden) entrar(); }, 9000);
}

/* ============================================================
   6. TIMER E RELÓGIO
   ============================================================ */
function fmt(seg) {
    const m = String(Math.floor(seg / 60)).padStart(2, '0');
    const s = String(seg % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function iniciarTimer() {
    if (estado.timerId) return;
    const el = $('#hud-timer');
    estado.timerId = setInterval(() => {
        if (estado.concluida) return;
        estado.tempo++;
        if (el) el.textContent = fmt(estado.tempo);
        if (estado.tempo % 15 === 0) salvar();
    }, 1000);
}

function iniciarRelogio() {
    const visor = $('#relogio-visor');
    if (!visor) return;
    const tick = () => {
        const d = new Date();
        visor.textContent =
            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    setInterval(tick, 20000);
}

/* ============================================================
   7. OBJETOS DO CENÁRIO
   ============================================================ */
function marcarVisto(el) {
    const nome = el.dataset.nome;
    if (!nome || estado.vistos.has(nome)) return;
    estado.vistos.add(nome);
    el.classList.add('visto');
    salvar();
}

function iniciarObjetos() {
    const tooltip = $('#tooltip');

    $$('.objeto').forEach(obj => {
        // ----- Tooltip -----
        const mostrar = e => {
            if (!tooltip || !obj.dataset.nome) return;
            if (document.body.classList.contains('sem-tooltip')) return;
            tooltip.textContent = obj.dataset.nome;
            tooltip.classList.add('visivel');
            mover(e);
        };
        const mover = e => {
            if (!tooltip) return;
            const x = e.clientX ?? 0, y = e.clientY ?? 0;
            tooltip.style.left = `${Math.min(x + 16, innerWidth - 200)}px`;
            tooltip.style.top  = `${Math.max(y - 34, 8)}px`;
        };
        const esconder = () => tooltip?.classList.remove('visivel');

        obj.addEventListener('mouseenter', mostrar);
        obj.addEventListener('mousemove', mover);
        obj.addEventListener('mouseleave', esconder);
        obj.addEventListener('focus', esconder);

        // ----- Clique -----
        obj.addEventListener('click', e => {
            e.stopPropagation();
            interagir(obj);
        });
        obj.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                interagir(obj);
            }
        });
    });

    // Livros da estante (fora do fluxo de .objeto)
    $$('.livro').forEach(livro => {
        livro.addEventListener('click', e => {
            e.stopPropagation();
            if (livro.id === 'livro-pista') abrirLivroPista();
            else {
                SOM.clique();
                narrar(`<strong>${livro.dataset.titulo}</strong> — nada de útil entre as páginas.`);
            }
        });
        livro.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); livro.click(); }
        });
    });
}

/** Roteia o clique de cada objeto interativo. */
function interagir(obj) {
    marcarVisto(obj);

    if (obj.id === 'computador') return ligarComputador();
    if (obj.id === 'quadro')     return (SOM.clique(), abrirModal($('#modal-quadro')));
    if (obj.id === 'armario')    return abrirArmario();
    if (obj.id === 'lixeira')    return revirarLixeira();
    if (obj.id === 'porta')      return; // o painel tem seu próprio botão

    // Objetos apenas descritivos
    const msg = obj.dataset.msg;
    if (msg) { SOM.clique(); narrar(msg); }
}

/* ---------- Computador ---------- */
function ligarComputador() {
    const pc = $('#computador');
    if (!pc.classList.contains('ligado')) {
        pc.classList.add('ligado');
        SOM.ligar();
        narrar('Sistema <strong>ATHENA OS</strong> iniciado.');
    } else {
        SOM.clique();
    }
    abrirModal($('#janela-so'));
    setTimeout(() => $('#terminal-input')?.focus(), 400);
}

/* ---------- Armário ---------- */
function abrirArmario() {
    const arm = $('#armario');
    if (arm.classList.contains('aberto')) {
        narrar('O armário já está aberto. Só ferramentas de manutenção.');
        return;
    }
    if (!estado.autenticado) {
        SOM.negado();
        arm.classList.add('negado');
        setTimeout(() => arm.classList.remove('negado'), 450);
        narrar('<strong>Trancado.</strong> A fechadura pede autenticação no sistema.');
        return;
    }
    arm.classList.remove('trancado');
    arm.classList.add('aberto');
    SOM.acerto();
    narrar('Armário destravado. Dentro: um pendrive de backup e ferramentas.');
    coletar('pendrive', 'Pendrive de backup');
}

/* ---------- Lixeira ---------- */
function revirarLixeira() {
    const lix = $('#lixeira');
    if (estado.itens.has('bilhete')) {
        SOM.clique();
        narrar('Só papel picado. O bilhete já está com você.');
        return;
    }
    lix.classList.add('vazia');
    coletar('bilhete', 'Bilhete rasgado');
    abrirModal($('#modal-bilhete'));
}

/* ---------- Livro-pista ---------- */
const PAGINAS_LIVRO = [
    {
        esq: `<h4>Notes by A.A.L.</h4>
              <p><em>Notas sobre o Motor Analítico de Charles Babbage,
              traduzidas e ampliadas por sua tradutora.</em></p>
              <p>A máquina não pode originar nada. Ela executa apenas o
              que lhe é ordenado — e essa ordem é o que chamo de
              <em>programa</em>.</p>`,
        dir: `<h4>Nota A</h4>
              <p>Toda a estrutura das operações precisa ser descrita antes
              de a máquina começar a girar.</p>
              <p>Assino estas notas apenas com as iniciais, por prudência:
              três letras bastam para quem precisa me encontrar.</p>`
    },
    {
        esq: `<h4>Nota G</h4>
              <p>Descrevo aqui a sequência de operações necessárias ao
              cálculo dos <em>números de Bernoulli</em>.</p>
              <p>É a primeira vez que instruções são escritas para uma
              máquina que ainda não existe.</p>`,
        dir: `<h4>Anotação à margem</h4>
              <p>Rabiscado a lápis, com letra apressada:</p>
              <p>"Credencial da estação — minhas iniciais completas,
              em maiúsculas: <span class="destaque">AAL</span>."</p>
              <p><em>Augusta Ada Lovelace.</em></p>`
    },
    {
        esq: `<h4>Folha solta</h4>
              <p>Um pedaço de papel dobrado entre as páginas finais.</p>
              <p>"O ano em que estas notas foram publicadas abre a porta
              da estação. Quatro dígitos."</p>`,
        dir: `<h4>Selo</h4>
              <p>Marca da editora e a inscrição:</p>
              <p><em>Taylor's Scientific Memoirs — Londres.</em></p>
              <p>O ano do selo foi <strong>raspado</strong>. Só os arquivos
              do computador ainda o guardam.</p>`
    }
];

let paginaAtual = 0;

function abrirLivroPista() {
    SOM.clique();
    paginaAtual = 0;
    renderLivro();
    abrirModal($('#modal-livro'));

    $('#livro-pista')?.classList.add('lido');
    if (coletar('credencial', 'Credencial <strong>AAL</strong>')) {
        concluirEtapa('pista');
        narrar('Você anotou a credencial: <strong>AAL</strong>. Use no terminal com <code>login AAL</code>.', 6500);
    }
}

function renderLivro() {
    const p = PAGINAS_LIVRO[paginaAtual];
    const esq = $('#pagina-esq'), dir = $('#pagina-dir');
    if (!p || !esq || !dir) return;

    esq.innerHTML = p.esq;
    dir.innerHTML = p.dir;
    [esq, dir].forEach(el => {
        el.classList.remove('virando');
        void el.offsetWidth;          // força reflow para reiniciar a animação
        el.classList.add('virando');
    });

    $('#livro-paginacao') &&
        ($('#livro-paginacao').textContent = `${paginaAtual + 1} / ${PAGINAS_LIVRO.length}`);
    $('#pagina-prev') && ($('#pagina-prev').disabled = paginaAtual === 0);
    $('#pagina-next') && ($('#pagina-next').disabled = paginaAtual === PAGINAS_LIVRO.length - 1);
}

function virarPagina(d) {
    const nova = paginaAtual + d;
    if (nova < 0 || nova >= PAGINAS_LIVRO.length) return;
    paginaAtual = nova;
    SOM.tecla();
    renderLivro();
}

/* ============================================================
   8. SISTEMA OPERACIONAL
   ============================================================ */
function trocarApp(nome) {
    $$('.so-app').forEach(b => b.classList.toggle('ativo', b.dataset.app === nome));
    $$('.so-view').forEach(v => v.classList.toggle('ativo', v.dataset.view === nome));

    if (nome === 'terminal') setTimeout(() => $('#terminal-input')?.focus(), 120);
    if (nome === 'mensagens') {
        const b = $('#badge-msg');
        if (b) b.hidden = true;
    }
    SOM.clique();
}

function iniciarSO() {
    $$('.so-app').forEach(b => b.addEventListener('click', () => trocarApp(b.dataset.app)));
    $$('.area-icone').forEach(b => b.addEventListener('click', () => trocarApp(b.dataset.abrir)));
    $('#fechar-so')?.addEventListener('click', () => { SOM.clique(); fecharModal($('#janela-so')); });

    // Clique fora fecha
    $('#janela-so')?.addEventListener('click', e => {
        if (e.target.id === 'janela-so') fecharModal($('#janela-so'));
    });

    // Arquivos
    $$('.arquivo').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('bloqueado')) {
                SOM.negado();
                narrar('Arquivo bloqueado. Autentique-se no terminal primeiro.');
                return;
            }
            abrirArquivo(btn.dataset.arquivo, true);
        });
    });

    // Configurações
    $('#config-som')?.addEventListener('change', e => setSom(e.target.checked));
    $('#config-scan')?.addEventListener('change', e =>
        document.body.classList.toggle('sem-scan', !e.target.checked));
    $('#config-tooltip')?.addEventListener('change', e =>
        document.body.classList.toggle('sem-tooltip', !e.target.checked));
    $('#config-reiniciar')?.addEventListener('click', reiniciarSala);

    iniciarTerminal();
}

/** Libera arquivos e atualiza status após o login. */
function destrancarSistema(silencioso = false) {
    estado.autenticado = true;

    $('#so-status')?.classList.add('autenticado');
    $('#so-status') && ($('#so-status').textContent = 'SESSÃO: A.A.LOVELACE');
    $('#terminal-prompt') && ($('#terminal-prompt').textContent = 'ada@eris:~$');
    $('#arquivos-aviso') && ($('#arquivos-aviso').innerHTML =
        'Acesso concedido. Use <code>open &lt;arquivo&gt;</code> ou clique nos arquivos abaixo.');

    $$('.arquivo').forEach(a => a.classList.remove('bloqueado'));
    $('#armario')?.classList.remove('trancado');

    concluirEtapa('login');
    if (!silencioso) SOM.acerto();
    salvar();
}

/* ---------- Conteúdo dos arquivos ---------- */
const ARQUIVOS = {
    'ada_algoritmo.dat': [
        ['ok',  '// ada_algoritmo.dat — restaurado'],
        ['',    'ROTINA: cálculo de números de Bernoulli'],
        ['',    'ENTRADA: cartões perfurados (ausentes)'],
        ['',    'AUTOR: A. A. Lovelace'],
        ['aviso','Primeiro algoritmo registrado da história.']
    ],
    'notas_maquina.txt': [
        ['ok',  '// notas_maquina.txt'],
        ['',    '"A Máquina Analítica não tem pretensão alguma'],
        ['',    ' de originar coisas. Ela pode fazer o que'],
        ['',    ' soubermos ordenar que ela faça."'],
        ['',    '— Nota G']
    ],
    'bernoulli.log': [
        ['ok',  '// bernoulli.log'],
        ['',    'seq B1..B7 ... calculada'],
        ['',    'publicação das notas ... ANO REDIGIDO'],
        ['erro','Campo de data corrompido pela ERIS.'],
        ['aviso','Tente: open codigo_porta.enc']
    ]
};

function abrirArquivo(nome, viaClique = false) {
    if (!estado.autenticado) {
        escrever('erro', 'Permissão negada. Autentique-se com: login <senha>');
        return;
    }

    if (nome === 'codigo_porta.enc') return revelarCodigo(viaClique);

    const conteudo = ARQUIVOS[nome];
    if (!conteudo) {
        escrever('erro', `open: '${nome}': arquivo não encontrado.`);
        return;
    }

    if (viaClique) trocarApp('terminal');
    escrever('eco', `$ open ${nome}`);
    conteudo.forEach(([cls, txt], i) =>
        setTimeout(() => escrever(cls, txt), i * 90));

    $$('.arquivo').forEach(a => {
        if (a.dataset.arquivo === nome) a.classList.add('lido');
    });
    SOM.tecla();
}

function revelarCodigo(viaClique = false) {
    if (viaClique) trocarApp('terminal');
    escrever('eco', '$ open codigo_porta.enc');
    escrever('aviso', 'Descriptografando...');

    setTimeout(() => {
        escrever('ok', 'Decodificado com sucesso.');
        escrever('', 'REGISTRO: publicação das Notas sobre a');
        escrever('', 'Máquina Analítica, com o primeiro algoritmo.');
        escrever('destaque', 'ANO: 1843');
        escrever('aviso', 'Este ano é o código de 4 dígitos da porta.');

        if (!estado.codigoRevelado) {
            estado.codigoRevelado = true;
            concluirEtapa('codigo');
            coletar('codigo', 'Código da porta (4 dígitos)');

            $('#porta')?.classList.add('destravada');
            $('#painel-texto') && ($('#painel-texto').textContent = 'CÓDIGO PENDENTE');

            const extra = $('#msg-extra');
            if (extra) { extra.hidden = false; const b = $('#badge-msg'); if (b) { b.hidden = false; b.textContent = '1'; } }

            SOM.acerto();
            narrar('Código recuperado: <strong>1843</strong>. Vá até a porta e digite no teclado.', 7000);
        }
        $$('.arquivo').forEach(a => {
            if (a.dataset.arquivo === 'codigo_porta.enc') a.classList.add('lido');
        });
        salvar();
    }, 900);
}

/* ---------- Terminal ---------- */
const historico = [];
let histIdx = -1;

function escrever(classe, texto) {
    const saida = $('#terminal-saida');
    if (!saida) return;
    const div = document.createElement('div');
    if (classe) div.className = classe;
    div.textContent = texto;
    saida.appendChild(div);
    $('#terminal')?.scrollTo({ top: 9e9, behavior: 'smooth' });
}

const COMANDOS = {
    help() {
        escrever('ok', 'Comandos disponíveis:');
        [
            'help                 — esta lista',
            'login <senha>        — autentica a sessão',
            'list                 — lista arquivos',
            'open <arquivo>       — abre e decodifica',
            'scan                 — varre dados corrompidos',
            'whoami               — sessão atual',
            'clear                — limpa a tela',
            'exit                 — desliga o computador'
        ].forEach(l => escrever('', '  ' + l));
    },

    login(arg) {
        if (!arg) return escrever('erro', 'Uso: login <senha>');
        if (estado.autenticado) return escrever('aviso', 'Sessão já autenticada.');

        if (arg.trim().toUpperCase() === CONFIG.SENHA_LOGIN) {
            escrever('ok', 'Credencial aceita. Bem-vinda de volta, Ada.');
            escrever('', 'Diretório /registros desbloqueado.');
            destrancarSistema();
            narrar('Acesso concedido. Agora use <code>list</code> e abra os arquivos.', 6000);
        } else {
            escrever('erro', `Credencial inválida: '${arg}'`);
            escrever('aviso', 'A senha está escondida no laboratório.');
            SOM.erro();
        }
    },

    list() {
        if (!estado.autenticado) {
            escrever('erro', 'Permissão negada. Faça login primeiro.');
            return;
        }
        escrever('ok', '/registros/ada:');
        Object.keys(ARQUIVOS).forEach(f => escrever('', `  ${f}`));
        escrever('erro', '  codigo_porta.enc   [CRIPTOGRAFADO]');
    },

    open(arg) {
        if (!arg) return escrever('erro', 'Uso: open <arquivo>');
        abrirArquivo(arg.trim());
    },

    scan() {
        escrever('aviso', 'Varrendo o sistema...');
        const linhas = [
            ['', 'nó 01 ......... íntegro'],
            ['', 'nó 02 ......... íntegro'],
            ['erro', 'nó 03 ......... CORROMPIDO (registros de Ada)'],
            ['', 'nó 04 ......... íntegro'],
            ['aviso', estado.autenticado
                ? 'Recuperação parcial possível: open codigo_porta.enc'
                : 'Autenticação necessária para recuperar dados.']
        ];
        linhas.forEach(([c, t], i) => setTimeout(() => escrever(c, t), 350 + i * 260));
    },

    whoami() {
        escrever(estado.autenticado ? 'ok' : 'aviso',
            estado.autenticado ? 'a.a.lovelace (acesso total)' : 'anônimo (acesso restrito)');
    },

    clear() {
        const s = $('#terminal-saida');
        if (s) s.innerHTML = '';
    },

    exit() {
        escrever('aviso', 'Encerrando sessão...');
        setTimeout(() => fecharModal($('#janela-so')), 500);
    },

    eris() {
        escrever('erro', 'ERIS: "Eu vejo cada comando que você digita."');
    },

    ada() {
        escrever('ok', '"A imaginação é a faculdade descobridora." — A.A.L.');
    }
};

function executar(linha) {
    const bruto = linha.trim();
    escrever('eco', `${$('#terminal-prompt')?.textContent ?? '$'} ${bruto}`);
    if (!bruto) return;

    historico.push(bruto);
    histIdx = historico.length;

    const [cmd, ...resto] = bruto.split(/\s+/);
    const fn = COMANDOS[cmd.toLowerCase()];

    if (fn) fn(resto.join(' '));
    else {
        escrever('erro', `comando não reconhecido: '${cmd}'`);
        escrever('aviso', "Digite 'help' para ver a lista.");
    }
}

function iniciarTerminal() {
    const input = $('#terminal-input');
    if (!input) return;

    escrever('ok', 'ATHENA OS v2.15 — núcleo sob controle da ERIS');
    escrever('aviso', "Sessão anônima. Digite 'help' para começar.");
    escrever('', '');

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            executar(input.value);
            input.value = '';
            SOM.tecla();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (histIdx > 0) input.value = historico[--histIdx] ?? '';
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx < historico.length - 1) input.value = historico[++histIdx] ?? '';
            else { histIdx = historico.length; input.value = ''; }
            return;
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const parcial = input.value.toLowerCase();
            const achou = Object.keys(COMANDOS).find(c => c.startsWith(parcial) && parcial);
            if (achou) input.value = achou + ' ';
        }
    });

    $('#terminal')?.addEventListener('click', () => input.focus());
}

/* ============================================================
   9. TECLADO DA PORTA
   ============================================================ */
let digitados = '';

function pintarVisor(estadoVisor = '') {
    const v = $('#teclado-visor');
    if (!v) return;
    const chars = digitados.padEnd(4, '-').split('');
    v.textContent = chars.join(' ');
    v.classList.remove('erro', 'ok');
    if (estadoVisor) v.classList.add(estadoVisor);
}

function iniciarTeclado() {
    $('#abrir-teclado')?.addEventListener('click', e => {
        e.stopPropagation();
        if ($('#porta')?.classList.contains('aberta')) return;
        SOM.clique();
        digitados = '';
        pintarVisor();
        abrirModal($('#modal-teclado'));
        if (!estado.codigoRevelado) {
            narrar('A trava pede 4 dígitos. Você ainda não sabe o código.');
        }
    });

    $$('.tecla').forEach(t => {
        t.addEventListener('click', () => {
            const v = t.textContent.trim();
            SOM.tecla();
            if (t.classList.contains('tecla-limpar')) { digitados = ''; return pintarVisor(); }
            if (t.classList.contains('tecla-ok'))     return confirmarCodigo();
            if (digitados.length < 4) { digitados += v; pintarVisor(); }
            if (digitados.length === 4) setTimeout(confirmarCodigo, 220);
        });
    });

    $('#fechar-teclado')?.addEventListener('click', () => {
        SOM.clique();
        fecharModal($('#modal-teclado'));
    });

    // Digitação pelo teclado físico
    document.addEventListener('keydown', e => {
        if ($('#modal-teclado')?.hidden) return;
        if (/^[0-9]$/.test(e.key) && digitados.length < 4) {
            digitados += e.key; pintarVisor(); SOM.tecla();
            if (digitados.length === 4) setTimeout(confirmarCodigo, 220);
        }
        if (e.key === 'Backspace') { digitados = digitados.slice(0, -1); pintarVisor(); }
        if (e.key === 'Enter') confirmarCodigo();
    });
}

function confirmarCodigo() {
    if (digitados.length < 4) {
        pintarVisor('erro');
        SOM.erro();
        return;
    }

    estado.tentativas++;
    $('#teclado-tentativas') &&
        ($('#teclado-tentativas').textContent = `Tentativas: ${estado.tentativas}`);

    if (digitados === CONFIG.CODIGO_PORTA) {
        pintarVisor('ok');
        SOM.acerto();
        salvar();
        setTimeout(() => { fecharModal($('#modal-teclado')); abrirPorta(); }, 700);
    } else {
        pintarVisor('erro');
        SOM.erro();
        setTimeout(() => { digitados = ''; pintarVisor(); }, 700);
        narrar('<strong>Código incorreto.</strong> O ano está nos arquivos do computador.');
        salvar();
    }
}

/* ============================================================
   10. ABERTURA DA PORTA E CONCLUSÃO
   ============================================================ */
function abrirPorta() {
    const porta = $('#porta');
    porta?.classList.remove('trancada');
    porta?.classList.add('aberta');
    $('#painel-texto') && ($('#painel-texto').textContent = 'LIBERADA');

    const flash = $('#flash-luz');
    flash?.classList.add('ativo');
    setTimeout(() => flash?.classList.remove('ativo'), 600);

    SOM.porta();
    concluirEtapa('porta');
    narrar('<strong>Porta liberada.</strong> Arquivo de Ada Lovelace recuperado.', 5000);

    setTimeout(mostrarConclusao, 2600);
}

function mostrarConclusao() {
    estado.concluida = true;
    clearInterval(estado.timerId);

    $('#stat-tempo')      && ($('#stat-tempo').textContent      = fmt(estado.tempo));
    $('#stat-itens')      && ($('#stat-itens').textContent      = estado.itens.size);
    $('#stat-tentativas') && ($('#stat-tentativas').textContent = estado.tentativas);

    abrirModal($('#conclusao-sala'));
    salvar();

    if (window.Progresso?.concluirSala) window.Progresso.concluirSala(1, estado.tempo);
}

/* ============================================================
   11. HUD — DICAS E CONTROLES
   ============================================================ */
const DICAS = [
    'Comece pela <strong>estante</strong>. Um dos livros tem um marcador brilhante.',
    'A credencial são as <strong>iniciais</strong> de Ada — três letras maiúsculas.',
    'Ligue o <strong>computador</strong> na mesa, abra o Terminal e digite <code>login AAL</code>.',
    'Autenticado? Use <code>list</code> e depois <code>open codigo_porta.enc</code>.',
    'O código da porta é o <strong>ano</strong> em que Ada publicou suas notas: <strong>1843</strong>.'
];

/** Escolhe a dica de acordo com o progresso real do jogador. */
function dicaContextual() {
    if (!estado.itens.has('credencial')) return DICAS[0];
    if (!estado.autenticado)             return DICAS[2];
    if (!estado.codigoRevelado)          return DICAS[3];
    return DICAS[4];
}

function iniciarHUD() {
    // Dica
    $('#btn-dica')?.addEventListener('click', () => {
        SOM.clique();
        const texto = dicaContextual();
        $('#dica-texto') && ($('#dica-texto').innerHTML = texto);
        abrirModal($('#modal-dica'));

        // Destaca o objeto relacionado à dica
        const alvo = !estado.itens.has('credencial') ? '#livro-pista'
                   : !estado.autenticado            ? '#computador'
                   : !estado.codigoRevelado         ? '#computador'
                   : '#porta';
        const el = $(alvo);
        if (el) {
            el.classList.add('destacado');
            setTimeout(() => el.classList.remove('destacado'), 4000);
        }
    });
    $('#fechar-dica')?.addEventListener('click', () => {
        SOM.clique(); fecharModal($('#modal-dica'));
    });

    // Som
    $('#btn-som-sala')?.addEventListener('click', () => {
        setSom(!estado.som);
        SOM.clique();
    });

    // Tela cheia
    $('#btn-full-sala')?.addEventListener('click', () => {
        SOM.clique();
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
    });

    // Menu
    $('#btn-menu')?.addEventListener('click', () => {
        if (confirm('Voltar ao menu? Seu progresso nesta sala fica salvo.')) {
            salvar();
            location.href = CONFIG.MENU;
        }
    });

    // Avançar
    $('#ir-sala2')?.addEventListener('click', () => {
        SOM.clique();
        $('#transicao-porta')?.classList.add('ativo');
        setTimeout(() => { location.href = CONFIG.PROX_SALA; }, 900);
    });

    atualizarEtapas();
}

function setSom(ligado) {
    estado.som = ligado;
    const btn = $('#btn-som-sala');
    btn?.setAttribute('aria-pressed', String(ligado));
    const chk = $('#config-som');
    if (chk) chk.checked = ligado;

    const musica = $('#musica-sala');
    if (musica) {
        if (ligado) musica.play?.().catch(() => {});
        else musica.pause?.();
    }
}

/* ============================================================
   12. FECHAMENTO DE MODAIS
   ============================================================ */
function iniciarFechamentos() {
    const pares = [
        ['#fechar-quadro',  '#modal-quadro'],
        ['#fechar-bilhete', '#modal-bilhete'],
        ['#fechar-livro',   '#modal-livro']
    ];
    pares.forEach(([btn, modal]) => {
        $(btn)?.addEventListener('click', () => { SOM.clique(); fecharModal($(modal)); });
    });

    $('#pagina-prev')?.addEventListener('click', () => virarPagina(-1));
    $('#pagina-next')?.addEventListener('click', () => virarPagina(1));

    // Clique no fundo fecha o modal
    ['#modal-livro', '#modal-quadro', '#modal-bilhete', '#modal-teclado', '#modal-dica']
        .forEach(sel => {
            const m = $(sel);
            m?.addEventListener('click', e => { if (e.target === m) fecharModal(m); });
        });

    // ESC fecha o modal aberto no topo
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const abertos = ['#modal-dica', '#modal-teclado', '#modal-bilhete',
                         '#modal-quadro', '#modal-livro', '#janela-so']
            .map($).filter(m => m && !m.hidden);
        if (abertos.length) fecharModal(abertos[0]);
    });

    // Setas viram páginas do livro
    document.addEventListener('keydown', e => {
        if ($('#modal-livro')?.hidden) return;
        if (e.key === 'ArrowLeft')  virarPagina(-1);
        if (e.key === 'ArrowRight') virarPagina(1);
    });
}

/* ============================================================
   13. REINICIAR
   ============================================================ */
function reiniciarSala() {
    if (!confirm('Reiniciar a Sala 1? Todo o progresso desta sala será perdido.')) return;
    try { localStorage.removeItem(CONFIG.CHAVE_SAVE); } catch (_) {}
    location.reload();
}

/* ============================================================
   14. BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    iniciarObjetos();
    iniciarSO();
    iniciarTeclado();
    iniciarHUD();
    iniciarFechamentos();
    iniciarRelogio();

    carregar();
    iniciarIntro();

    // Destrava o áudio no primeiro gesto do usuário
    const liberar = () => {
        audioCtx()?.resume?.();
        document.removeEventListener('click', liberar);
    };
    document.addEventListener('click', liberar);

    window.addEventListener('beforeunload', salvar);
});

})();
