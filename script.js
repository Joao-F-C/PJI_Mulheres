/* ============================================================
   PROJETO ATHENA — SCRIPT GLOBAL
   Carregado em TODAS as páginas (index e salas).

   Expõe globalmente:
     - Audio Athena  -> window.tocarSom(nome)
     - Progresso     -> window.Progresso
   E inicializa a tela inicial APENAS se ela existir na página.

   IMPORTANTE: todo bloco é protegido por verificação de existência
   dos elementos, evitando erros ao rodar dentro das salas.
   ============================================================ */

'use strict';

/* ============================================================
   1. SISTEMA DE SOM
   Gera os efeitos proceduralmente com a Web Audio API.
   Assim o jogo funciona SEM arquivos .mp3 e SEM internet.
   Se existir o arquivo em assets/sons/, ele tem prioridade.
   ============================================================ */
const AudioAthena = (function () {

    const CHAVE_MUDO = 'athena_mudo';

    let contexto  = null;   // AudioContext (criado no 1º gesto do usuário)
    let ganhoMest = null;   // volume master
    let mudo      = localStorage.getItem(CHAVE_MUDO) === 'true';

    // Cache de arquivos de áudio já testados
    const cacheArquivos = {};

    /* -------- Inicializa o AudioContext (precisa de gesto do usuário) -------- */
    function inicializar() {
        if (contexto) return contexto;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;

        contexto  = new AC();
        ganhoMest = contexto.createGain();
        ganhoMest.gain.value = mudo ? 0 : 0.5;
        ganhoMest.connect(contexto.destination);
        return contexto;
    }

    /* -------- Gerador de tom básico -------- */
    function tom({ freq = 440, freqFinal = null, tipo = 'sine',
                   duracao = 0.15, volume = 0.3, atraso = 0 }) {
        if (!contexto || mudo) return;

        const inicio = contexto.currentTime + atraso;
        const osc    = contexto.createOscillator();
        const ganho  = contexto.createGain();

        osc.type = tipo;
        osc.frequency.setValueAtTime(freq, inicio);

        // Varredura de frequência (efeito de "slide")
        if (freqFinal !== null) {
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(freqFinal, 1), inicio + duracao
            );
        }

        // Envelope ADSR simplificado (evita estalos)
        ganho.gain.setValueAtTime(0, inicio);
        ganho.gain.linearRampToValueAtTime(volume, inicio + 0.01);
        ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);

        osc.connect(ganho);
        ganho.connect(ganhoMest);
        osc.start(inicio);
        osc.stop(inicio + duracao + 0.02);
    }

    /* -------- Gerador de ruído (para porta, whoosh, erro) -------- */
    function ruido({ duracao = 0.3, volume = 0.2, freqFiltro = 800, atraso = 0 }) {
        if (!contexto || mudo) return;

        const inicio   = contexto.currentTime + atraso;
        const amostras = Math.floor(contexto.sampleRate * duracao);
        const buffer   = contexto.createBuffer(1, amostras, contexto.sampleRate);
        const dados    = buffer.getChannelData(0);

        for (let i = 0; i < amostras; i++) {
            dados[i] = Math.random() * 2 - 1;
        }

        const fonte  = contexto.createBufferSource();
        const filtro = contexto.createBiquadFilter();
        const ganho  = contexto.createGain();

        fonte.buffer      = buffer;
        filtro.type       = 'lowpass';
        filtro.frequency.setValueAtTime(freqFiltro, inicio);
        filtro.frequency.exponentialRampToValueAtTime(120, inicio + duracao);

        ganho.gain.setValueAtTime(volume, inicio);
        ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);

        fonte.connect(filtro);
        filtro.connect(ganho);
        ganho.connect(ganhoMest);
        fonte.start(inicio);
    }

    /* -------- Biblioteca de efeitos -------- */
    const efeitos = {
        // Clique curto e seco
        clique: () => tom({ freq: 900, freqFinal: 500, tipo: 'square', duracao: 0.07, volume: 0.15 }),

        // Hover discreto
        hover: () => tom({ freq: 1400, tipo: 'sine', duracao: 0.05, volume: 0.06 }),

        // Computador ligando (arpejo ascendente)
        computador: () => {
            [261, 329, 392, 523].forEach((f, i) =>
                tom({ freq: f, tipo: 'triangle', duracao: 0.35, volume: 0.18, atraso: i * 0.09 })
            );
        },

        // Acerto (arpejo maior)
        acerto: () => {
            [523, 659, 784, 1046].forEach((f, i) =>
                tom({ freq: f, tipo: 'sine', duracao: 0.4, volume: 0.22, atraso: i * 0.08 })
            );
        },

        // Erro (dois tons graves descendentes)
        erro: () => {
            tom({ freq: 200, freqFinal: 90, tipo: 'sawtooth', duracao: 0.25, volume: 0.2 });
            tom({ freq: 150, freqFinal: 70, tipo: 'square', duracao: 0.3, volume: 0.12, atraso: 0.1 });
        },

        // Porta pneumática abrindo
        porta: () => {
            ruido({ duracao: 1.2, volume: 0.25, freqFiltro: 1200 });
            tom({ freq: 80, freqFinal: 200, tipo: 'sine', duracao: 1.0, volume: 0.15 });
        },

        // Página de livro virando
        livro: () => ruido({ duracao: 0.22, volume: 0.13, freqFiltro: 3500 }),

        // Item coletado (dois tons cristalinos)
        inventario: () => {
            tom({ freq: 880, tipo: 'sine', duracao: 0.12, volume: 0.18 });
            tom({ freq: 1320, tipo: 'sine', duracao: 0.22, volume: 0.14, atraso: 0.08 });
        },

        // Transição / whoosh
        transicao: () => {
            ruido({ duracao: 0.8, volume: 0.18, freqFiltro: 2500 });
            tom({ freq: 400, freqFinal: 60, tipo: 'sine', duracao: 0.8, volume: 0.12 });
        },

        // Digitação de terminal
        tecla: () => tom({ freq: 1200 + Math.random() * 400, tipo: 'square', duracao: 0.03, volume: 0.06 }),

        // Alerta da ERIS
        alerta: () => {
            for (let i = 0; i < 3; i++) {
                tom({ freq: 660, tipo: 'square', duracao: 0.12, volume: 0.16, atraso: i * 0.2 });
            }
        }
    };

    /* -------- API pública: tocarSom -------- */
    function tocarSom(nome) {
        if (mudo) return;
        inicializar();

        // Retoma o contexto se o navegador o suspendeu
        if (contexto && contexto.state === 'suspended') {
            contexto.resume().catch(() => {});
        }

        // 1) Tenta usar arquivo real, se existir
        if (cacheArquivos[nome] !== false) {
            if (!cacheArquivos[nome]) {
                const audio = new Audio(`assets/sons/${nome}.mp3`);
                audio.volume = 0.6;
                audio.play()
                    .then(() => { cacheArquivos[nome] = audio; })
                    .catch(() => {
                        // Arquivo ausente: marca e cai no som procedural
                        cacheArquivos[nome] = false;
                        if (efeitos[nome]) efeitos[nome]();
                    });
                return;
            }
            // Já validado: reinicia o clone para permitir sobreposição
            const clone = cacheArquivos[nome].cloneNode();
            clone.volume = 0.6;
            clone.play().catch(() => {});
            return;
        }

        // 2) Som procedural
        if (efeitos[nome]) efeitos[nome]();
    }

    /* -------- Mudo -------- */
    function alternarMudo() {
        mudo = !mudo;
        localStorage.setItem(CHAVE_MUDO, String(mudo));
        if (ganhoMest) {
            ganhoMest.gain.value = mudo ? 0 : 0.5;
        }
        // Silencia também as músicas em <audio>
        document.querySelectorAll('audio').forEach(a => { a.muted = mudo; });
        return mudo;
    }

    function estaMudo() { return mudo; }

    return { tocarSom, alternarMudo, estaMudo, inicializar };
})();

// Disponibiliza globalmente (usado pelas salas e pelo inventario.js)
window.tocarSom  = AudioAthena.tocarSom;
window.AudioAthena = AudioAthena;

/* ============================================================
   2. PROGRESSO DO JOGO (persistência entre páginas)
   ============================================================ */
const Progresso = (function () {

    const CHAVE = 'athena_progresso';

    const PADRAO = {
        salaAtual: 1,
        salasConcluidas: [],
        flags: {},              // ex.: { sala1_logado: true }
        inicioEm: null
    };

    let dados = carregar();

    function carregar() {
        try {
            const salvo = JSON.parse(localStorage.getItem(CHAVE));
            return salvo ? { ...PADRAO, ...salvo } : { ...PADRAO };
        } catch {
            return { ...PADRAO };
        }
    }

    function salvar() {
        try {
            localStorage.setItem(CHAVE, JSON.stringify(dados));
        } catch { /* modo privado pode bloquear */ }
    }

    return {
        /** Retorna uma cópia dos dados */
        obter: () => ({ ...dados }),

        /** Define a sala atual */
        definirSala(n) { dados.salaAtual = n; salvar(); },

        /** Marca uma sala como concluída */
        concluirSala(n) {
            if (!dados.salasConcluidas.includes(n)) dados.salasConcluidas.push(n);
            dados.salaAtual = n + 1;
            salvar();
        },

        /** Grava/lê flags arbitrárias (estado dos enigmas) */
        setFlag(chave, valor) { dados.flags[chave] = valor; salvar(); },
        getFlag(chave)        { return dados.flags[chave]; },

        /** Existe jogo em andamento? */
        temProgresso() {
            return dados.inicioEm !== null &&
                   (dados.salaAtual > 1 || Object.keys(dados.flags).length > 0);
        },

        /** Inicia um jogo novo (zera tudo) */
        iniciarNovo() {
            dados = { ...PADRAO, flags: {}, salasConcluidas: [], inicioEm: Date.now() };
            salvar();
            localStorage.removeItem('athena_inventario');
        },

        /** Página da sala atual */
        paginaAtual() {
            const n = Math.min(dados.salaAtual, 5);
            return n >= 5 ? 'sala-final.html' : `sala${n}.html`;
        },

        /** Apaga todo o progresso */
        limpar() {
            localStorage.removeItem(CHAVE);
            localStorage.removeItem('athena_inventario');
            dados = { ...PADRAO };
        }
    };
})();

window.Progresso = Progresso;

/* ============================================================
   3. UTILITÁRIOS GLOBAIS
   ============================================================ */

/** Alterna tela cheia (usado na tela inicial e nas salas) */
function alternarTelaCheia() {
    const doc = document.documentElement;
    if (!document.fullscreenElement) {
        (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc).catch(() => {});
    } else {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
    }
}
window.alternarTelaCheia = alternarTelaCheia;

/** Sons de hover em botões (aplicado em qualquer página) */
function ativarSomHover() {
    document.querySelectorAll('.btn-neon, .btn-icone, .tecla, .so-app')
        .forEach(el => el.addEventListener('mouseenter', () => AudioAthena.tocarSom('hover')));
}

/* ============================================================
   4. INICIALIZAÇÃO DA TELA INICIAL
   Só executa se os elementos da index existirem.
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

    ativarSomHover();

    const telaInicial = document.getElementById('tela-inicial');
    if (!telaInicial) return; // Estamos em uma sala: encerra aqui.

    iniciarParticulas();
    iniciarDigitacao();
    iniciarMusicaAmbiente();
    iniciarModais();
    iniciarControles();
    iniciarBotoesJogo();
});

/* ============================================================
   4.1 PARTÍCULAS (Canvas)
   ============================================================ */
function iniciarParticulas() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respeita a preferência de menos animação
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let particulas = [];
    let largura = 0;
    let altura  = 0;
    let animando = true;

    // Ajusta ao devicePixelRatio para não ficar borrado em telas retina
    function ajustarCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        largura = window.innerWidth;
        altura  = window.innerHeight;
        canvas.width  = largura * dpr;
        canvas.height = altura * dpr;
        canvas.style.width  = largura + 'px';
        canvas.style.height = altura + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    class Particula {
        constructor() { this.reiniciar(true); }

        reiniciar() {
            this.x     = Math.random() * largura;
            this.y     = Math.random() * altura;
            this.raio  = Math.random() * 1.8 + 0.4;
            this.velX  = (Math.random() - 0.5) * 0.35;
            this.velY  = (Math.random() - 0.5) * 0.35;
            this.cor   = Math.random() > 0.5 ? '0, 240, 255' : '255, 43, 214';
            this.alpha = Math.random() * 0.5 + 0.15;
            // Faz o brilho oscilar suavemente
            this.fase  = Math.random() * Math.PI * 2;
            this.pulso = Math.random() * 0.02 + 0.01;
        }

        atualizar() {
            this.x += this.velX;
            this.y += this.velY;
            this.fase += this.pulso;

            // Rebate nas bordas
            if (this.x < 0 || this.x > largura) this.velX *= -1;
            if (this.y < 0 || this.y > altura)  this.velY *= -1;
        }

        desenhar() {
            const a = this.alpha * (0.6 + 0.4 * Math.sin(this.fase));
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.raio, 0, Math.PI * 2);
            ctx.fillStyle   = `rgba(${this.cor}, ${a})`;
            ctx.shadowBlur  = 8;
            ctx.shadowColor = `rgba(${this.cor}, 0.9)`;
            ctx.fill();
        }
    }

    function criarParticulas() {
        particulas = [];
        // Menos partículas em telas pequenas (performance no celular)
        const base = largura < 600 ? 22 : 14;
        const qtd  = Math.min(110, Math.floor(largura / base));
        for (let i = 0; i < qtd; i++) particulas.push(new Particula());
    }

    // Linhas conectando partículas próximas (efeito de rede)
    function desenharConexoes() {
        if (largura < 700) return; // pesado em telas pequenas
        const limite = 120;
        ctx.shadowBlur = 0;

        for (let i = 0; i < particulas.length; i++) {
            for (let j = i + 1; j < particulas.length; j++) {
                const dx = particulas[i].x - particulas[j].x;
                const dy = particulas[i].y - particulas[j].y;
                const dist = Math.hypot(dx, dy);

                if (dist < limite) {
                    ctx.beginPath();
                    ctx.moveTo(particulas[i].x, particulas[i].y);
                    ctx.lineTo(particulas[j].x, particulas[j].y);
                    ctx.strokeStyle = `rgba(0, 240, 255, ${(1 - dist / limite) * 0.12})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animar() {
        if (!animando) return;
        ctx.clearRect(0, 0, largura, altura);
        desenharConexoes();
        particulas.forEach(p => { p.atualizar(); p.desenhar(); });
        requestAnimationFrame(animar);
    }

    // Pausa a animação quando a aba perde o foco (economiza bateria)
    document.addEventListener('visibilitychange', () => {
        animando = !document.hidden;
        if (animando) animar();
    });

    // Debounce no resize
    let timerResize;
    window.addEventListener('resize', () => {
        clearTimeout(timerResize);
        timerResize = setTimeout(() => { ajustarCanvas(); criarParticulas(); }, 200);
    });

    ajustarCanvas();
    criarParticulas();

    if (reduzir) {
        // Desenha um quadro estático
        particulas.forEach(p => p.desenhar());
    } else {
        animar();
    }
}

/* ============================================================
   4.2 EFEITO DE DIGITAÇÃO
   ============================================================ */
function iniciarDigitacao() {
    const el = document.getElementById('typing');
    if (!el) return;

    const frases = [
        'Recupere a história das mulheres na ciência...',
        'ERIS apagou os arquivos. Você é a última esperança.',
        'Inicie a missão. Restaure o conhecimento.'
    ];

    let iFrase = 0;
    let iChar  = 0;
    let apagando = false;

    function ciclo() {
        const frase = frases[iFrase];

        if (!apagando) {
            el.textContent = frase.substring(0, ++iChar);
            if (iChar === frase.length) {
                apagando = true;
                setTimeout(ciclo, 2200); // pausa lendo a frase completa
                return;
            }
        } else {
            el.textContent = frase.substring(0, --iChar);
            if (iChar === 0) {
                apagando = false;
                iFrase = (iFrase + 1) % frases.length;
                setTimeout(ciclo, 400);
                return;
            }
        }

        // Velocidade levemente irregular = mais humano
        const delay = apagando ? 25 : 55 + Math.random() * 45;
        setTimeout(ciclo, delay);
    }

    ciclo();
}

/* ============================================================
   4.3 MÚSICA AMBIENTE
   ============================================================ */
function iniciarMusicaAmbiente() {
    const musica = document.getElementById('musica-ambiente');
    if (!musica) return;

    musica.volume = 0.35;
    musica.muted  = AudioAthena.estaMudo();

    // Autoplay é bloqueado: inicia no primeiro gesto do usuário
    function destravar() {
        AudioAthena.inicializar();
        musica.play().catch(() => {});
        document.removeEventListener('pointerdown', destravar);
        document.removeEventListener('keydown', destravar);
    }

    document.addEventListener('pointerdown', destravar);
    document.addEventListener('keydown', destravar);
}

/* ============================================================
   4.4 MODAIS (com foco acessível e tecla Esc)
   ============================================================ */
function iniciarModais() {
    const modais = {
        'btn-como-jogar': document.getElementById('modal-como-jogar'),
        'btn-creditos':   document.getElementById('modal-creditos')
    };

    let modalAberto = null;
    let focoAnterior = null;

    function abrir(modal) {
        if (!modal) return;
        focoAnterior = document.activeElement;
        modal.hidden = false;
        modal.classList.add('ativo');
        modalAberto = modal;
        AudioAthena.tocarSom('clique');

        // Move o foco para o primeiro botão do modal
        const foco = modal.querySelector('button');
        if (foco) setTimeout(() => foco.focus(), 60);
    }

    function fechar() {
        if (!modalAberto) return;
        modalAberto.classList.remove('ativo');
        modalAberto.hidden = true;
        modalAberto = null;
        AudioAthena.tocarSom('clique');
        if (focoAnterior) focoAnterior.focus();
    }

    // Botões que abrem
    Object.entries(modais).forEach(([idBotao, modal]) => {
        const botao = document.getElementById(idBotao);
        if (botao && modal) botao.addEventListener('click', () => abrir(modal));
    });

    // Botões que fecham
    document.querySelectorAll('.fechar-modal')
        .forEach(b => b.addEventListener('click', fechar));

    // Clique no fundo escuro fecha
    Object.values(modais).forEach(modal => {
        if (!modal) return;
        modal.addEventListener('click', e => { if (e.target === modal) fechar(); });
    });

    // Esc fecha + Tab fica preso dentro do modal (focus trap)
    document.addEventListener('keydown', e => {
        if (!modalAberto) return;

        if (e.key === 'Escape') {
            fechar();
            return;
        }

        if (e.key === 'Tab') {
            const focaveis = modalAberto.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
            if (!focaveis.length) return;

            const primeiro = focaveis[0];
            const ultimo   = focaveis[focaveis.length - 1];

            if (e.shiftKey && document.activeElement === primeiro) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primeiro.focus();
            }
        }
    });
}

/* ============================================================
   4.5 CONTROLES (som / tela cheia)
   ============================================================ */
function iniciarControles() {
    const btnSom = document.getElementById('btn-som');
    const btnFull = document.getElementById('btn-tela-cheia');

    if (btnSom) {
        // Sincroniza o estado visual com o localStorage
        btnSom.setAttribute('aria-pressed', String(!AudioAthena.estaMudo()));

        btnSom.addEventListener('click', () => {
            const mudo = AudioAthena.alternarMudo();
            btnSom.setAttribute('aria-pressed', String(!mudo));
            if (!mudo) AudioAthena.tocarSom('clique');
        });
    }

    if (btnFull) {
        btnFull.addEventListener('click', () => {
            AudioAthena.tocarSom('clique');
            alternarTelaCheia();
        });
    }

    // Atalhos de teclado
    document.addEventListener('keydown', e => {
        if (e.key === 'm' || e.key === 'M') btnSom?.click();
        if (e.key === 'f' || e.key === 'F') alternarTelaCheia();
    });
}

/* ============================================================
   4.6 BOTÕES INICIAR / CONTINUAR + TRANSIÇÃO
   ============================================================ */
function iniciarBotoesJogo() {
    const btnIniciar   = document.getElementById('btn-iniciar');
    const btnContinuar = document.getElementById('btn-continuar');

    // Mostra "Continuar" apenas se houver progresso salvo
    if (btnContinuar && Progresso.temProgresso()) {
        btnContinuar.hidden = false;
        const dados = Progresso.obter();
        btnContinuar.querySelector('.btn-txt').textContent =
            `Continuar — Sala ${Math.min(dados.salaAtual, 5)}`;
    }

    if (btnIniciar) {
        btnIniciar.addEventListener('click', () => {
            // Se já existe progresso, confirma antes de apagar
            if (Progresso.temProgresso()) {
                const ok = confirm('Isso vai apagar seu progresso atual. Começar do zero?');
                if (!ok) return;
            }
            Progresso.iniciarNovo();
            executarTransicao('sala1.html');
        });
    }

    if (btnContinuar) {
        btnContinuar.addEventListener('click', () => {
            executarTransicao(Progresso.paginaAtual());
        });
    }
}

/* ============================================================
   4.7 TRANSIÇÃO CINEMATOGRÁFICA
   ============================================================ */
function executarTransicao(destino) {
    const transicao   = document.getElementById('transicao');
    const elTexto     = document.getElementById('transicao-texto');
    const elBarra     = document.getElementById('barra');
    const elWrapper   = document.getElementById('barra-wrapper');
    const elPorcento  = document.getElementById('transicao-porcentagem');
    const elLogs      = document.getElementById('transicao-logs');

    // Fallback: se a UI de transição não existir, navega direto
    if (!transicao || !elBarra) {
        window.location.href = destino;
        return;
    }

    AudioAthena.tocarSom('transicao');

    transicao.hidden = false;
    transicao.classList.add('ativo');

    const mensagens = [
        'Inicializando Sistema Athena...',
        'Conectando ao Laboratório Central...',
        'Contornando firewall da ERIS...',
        'Carregando Laboratório...'
    ];

    // Logs falsos de terminal (puro clima)
    const logs = [
        '> athena_core.sys ......... OK',
        '> criptografia AES-512 .... OK',
        '> bypass eris_guard ....... OK',
        '> montando ambiente 3D .... OK',
        '> texturas do laboratório . OK',
        '> arquivos históricos ..... CORROMPIDOS',
        '> iniciando recuperação ...',
        '> canal seguro estabelecido'
    ];

    let iMsg = 0;
    let iLog = 0;
    let progresso = 0;
    let finalizado = false;

    elTexto.textContent = mensagens[0];

    // Troca as mensagens principais
    const timerMsg = setInterval(() => {
        if (++iMsg < mensagens.length) elTexto.textContent = mensagens[iMsg];
    }, 1100);

    // Imprime os logs um a um
    const timerLog = setInterval(() => {
        if (!elLogs || iLog >= logs.length) return;
        const linha = document.createElement('div');
        linha.textContent = logs[iLog++];
        elLogs.appendChild(linha);
        elLogs.scrollTop = elLogs.scrollHeight;
        AudioAthena.tocarSom('tecla');
    }, 480);

    // Anima a barra de progresso
    const timerBarra = setInterval(() => {
        // Avanço irregular para parecer carregamento real
        progresso += Math.random() * 7 + 2;

        if (progresso >= 100 && !finalizado) {
            finalizado = true;
            progresso = 100;
            clearInterval(timerBarra);
            clearInterval(timerMsg);
            clearInterval(timerLog);

            elTexto.textContent = 'Acesso concedido.';
            AudioAthena.tocarSom('acerto');

            setTimeout(() => { window.location.href = destino; }, 900);
        }

        const valor = Math.floor(progresso);
        elBarra.style.width = valor + '%';
        if (elPorcento) elPorcento.textContent = valor + '%';
        if (elWrapper)  elWrapper.setAttribute('aria-valuenow', String(valor));
    }, 190);
}

window.executarTransicao = executarTransicao;
