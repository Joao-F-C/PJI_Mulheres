/* ============================================================
   PROJETO ATHENA — SISTEMA DE INVENTÁRIO GLOBAL
   Compartilhado entre TODAS as salas.
   Usa localStorage para persistir os itens ao trocar de página.
   Basta incluir <script src="inventario.js"></script> em cada sala
   e chamar Inventario.iniciar() no carregamento.
   ============================================================ */

const Inventario = (function () {

    // Chave usada no localStorage
    const CHAVE = 'athena_inventario';

    // Catálogo de itens possíveis do jogo.
    // 'icone' é desenhado apenas com CSS/HTML (sem emojis nem imagens).
    const CATALOGO = {
        livro:      { nome: 'Livro Antigo',        classe: 'item-livro' },
        bilhete:    { nome: 'Bilhete Rasgado',     classe: 'item-bilhete' },
        chave:      { nome: 'Chave Magnética',     classe: 'item-chave' },
        pendrive:   { nome: 'Pendrive',            classe: 'item-pendrive' },
        cartao:     { nome: 'Cartão de Acesso',    classe: 'item-cartao' },
        senha:      { nome: 'Senha Anotada',       classe: 'item-senha' },
        documento:  { nome: 'Documento Secreto',   classe: 'item-documento' }
    };

    // Lista interna dos itens coletados (ids)
    let itens = [];

    /* --------------------------------------------------------
       PERSISTÊNCIA
    -------------------------------------------------------- */
    function carregar() {
        const salvo = localStorage.getItem(CHAVE);
        itens = salvo ? JSON.parse(salvo) : [];
    }

    function salvar() {
        localStorage.setItem(CHAVE, JSON.stringify(itens));
    }

    /* --------------------------------------------------------
       CRIAÇÃO DA INTERFACE (barra lateral)
    -------------------------------------------------------- */
    function criarInterface() {
        // Evita duplicar se já existir
        if (document.getElementById('inventario-lateral')) return;

        const painel = document.createElement('aside');
        painel.id = 'inventario-lateral';
        painel.innerHTML = `
            <div class="inv-cabecalho">
                <span class="inv-titulo">INVENTÁRIO</span>
                <button class="inv-toggle" id="inv-toggle">›</button>
            </div>
            <div class="inv-slots" id="inv-slots"></div>
        `;
        document.body.appendChild(painel);

        // Botão para expandir/recolher o inventário
        document.getElementById('inv-toggle').addEventListener('click', () => {
            painel.classList.toggle('recolhido');
            const btn = document.getElementById('inv-toggle');
            btn.textContent = painel.classList.contains('recolhido') ? '‹' : '›';
        });

        renderizar();
    }

    /* --------------------------------------------------------
       RENDERIZAÇÃO DOS SLOTS
    -------------------------------------------------------- */
    function renderizar() {
        const slots = document.getElementById('inv-slots');
        if (!slots) return;
        slots.innerHTML = '';

        itens.forEach(id => {
            const dados = CATALOGO[id];
            if (!dados) return;

            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            slot.title = dados.nome;
            slot.innerHTML = `
                <div class="inv-icone ${dados.classe}"></div>
                <span class="inv-nome">${dados.nome}</span>
            `;

            // Ao clicar no item, mostra detalhes (som + destaque)
            slot.addEventListener('click', () => {
                if (typeof tocarSom === 'function') tocarSom('inventario');
                slot.classList.add('inv-selecionado');
                setTimeout(() => slot.classList.remove('inv-selecionado'), 600);
            });

            slots.appendChild(slot);
        });

        // Preenche slots vazios para manter o visual do grid
        const vazios = Math.max(0, 6 - itens.length);
        for (let i = 0; i < vazios; i++) {
            const vazio = document.createElement('div');
            vazio.className = 'inv-slot inv-vazio';
            slots.appendChild(vazio);
        }
    }

    /* --------------------------------------------------------
       ADICIONAR ITEM (com animação + som + notificação)
    -------------------------------------------------------- */
    function adicionar(id) {
        if (!CATALOGO[id]) {
            console.warn('Item desconhecido:', id);
            return false;
        }
        if (itens.includes(id)) return false; // já possui

        itens.push(id);
        salvar();
        renderizar();

        // Som de coleta
        if (typeof tocarSom === 'function') tocarSom('inventario');

        // Notificação animada
        mostrarNotificacao(CATALOGO[id].nome);

        // Faz o último slot "pulsar"
        const slots = document.querySelectorAll('.inv-slot:not(.inv-vazio)');
        const ultimo = slots[slots.length - 1];
        if (ultimo) {
            ultimo.classList.add('inv-novo');
            setTimeout(() => ultimo.classList.remove('inv-novo'), 800);
        }
        return true;
    }

    /* --------------------------------------------------------
       NOTIFICAÇÃO FLUTUANTE "Item adicionado"
    -------------------------------------------------------- */
    function mostrarNotificacao(nome) {
        const notif = document.createElement('div');
        notif.className = 'inv-notificacao';
        notif.innerHTML = `
            <strong>Item coletado</strong>
            <span>${nome}</span>
        `;
        document.body.appendChild(notif);

        // Anima entrada e remove após alguns segundos
        requestAnimationFrame(() => notif.classList.add('visivel'));
        setTimeout(() => {
            notif.classList.remove('visivel');
            setTimeout(() => notif.remove(), 500);
        }, 2500);
    }

    /* --------------------------------------------------------
       CONSULTAS E UTILIDADES
    -------------------------------------------------------- */
    function possui(id) {
        return itens.includes(id);
    }

    function remover(id) {
        itens = itens.filter(i => i !== id);
        salvar();
        renderizar();
    }

    function limpar() {
        itens = [];
        localStorage.removeItem(CHAVE);
        renderizar();
    }

    /* --------------------------------------------------------
       INICIALIZAÇÃO
    -------------------------------------------------------- */
    function iniciar() {
        carregar();
        criarInterface();
    }

    // API pública do módulo
    return {
        iniciar,
        adicionar,
        remover,
        possui,
        limpar
    };

})();

/* ============================================================
   ESTILO DO INVENTÁRIO (injetado via JS para funcionar em
   todas as salas sem precisar duplicar CSS)
   ============================================================ */
(function injetarEstiloInventario() {
    const css = `
    #inventario-lateral {
        position: fixed;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
        width: 200px;
        z-index: 40;
        background: rgba(10, 14, 26, 0.55);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(0, 240, 255, 0.3);
        border-right: none;
        border-radius: 16px 0 0 16px;
        box-shadow: -5px 0 30px rgba(0, 240, 255, 0.15);
        transition: transform 0.4s ease;
        font-family: 'Rajdhani', sans-serif;
        color: #e8f7ff;
    }
    #inventario-lateral.recolhido {
        transform: translateY(-50%) translateX(170px);
    }
    .inv-cabecalho {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(0, 240, 255, 0.2);
    }
    .inv-titulo {
        font-family: 'Orbitron', sans-serif;
        font-size: 0.8rem;
        letter-spacing: 2px;
        color: #00f0ff;
        text-shadow: 0 0 8px #00f0ff;
    }
    .inv-toggle {
        background: transparent;
        border: 1px solid #00f0ff;
        color: #00f0ff;
        border-radius: 6px;
        width: 26px;
        height: 26px;
        cursor: pointer;
        font-size: 1rem;
        transition: 0.3s;
    }
    .inv-toggle:hover {
        background: #00f0ff;
        color: #05060a;
        box-shadow: 0 0 10px #00f0ff;
    }
    .inv-slots {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 12px;
    }
    .inv-slot {
        aspect-ratio: 1;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        cursor: pointer;
        transition: 0.3s;
        position: relative;
        overflow: hidden;
    }
    .inv-slot:not(.inv-vazio):hover {
        border-color: #ff2bd6;
        box-shadow: 0 0 12px #ff2bd6;
        transform: scale(1.05);
    }
    .inv-vazio { cursor: default; opacity: 0.4; }
    .inv-nome {
        font-size: 0.6rem;
        text-align: center;
        line-height: 1;
        opacity: 0.8;
    }
    .inv-novo { animation: inv-pulsar 0.8s ease; }
    @keyframes inv-pulsar {
        0%   { transform: scale(1); box-shadow: 0 0 0 #00f0ff; }
        50%  { transform: scale(1.2); box-shadow: 0 0 25px #00f0ff; }
        100% { transform: scale(1); }
    }
    .inv-selecionado { box-shadow: 0 0 18px #ff2bd6 !important; }

    /* Ícones desenhados com CSS (sem imagens) */
    .inv-icone {
        width: 34px; height: 34px;
        position: relative;
    }
    .item-livro    { background: linear-gradient(135deg,#7b2fff,#00f0ff); border-radius:3px 5px 5px 3px; box-shadow: inset -6px 0 rgba(0,0,0,.3); }
    .item-bilhete  { background:#e8f7ff; transform:rotate(-6deg); border-radius:2px; box-shadow:inset 0 -10px rgba(0,0,0,.1); }
    .item-chave    { background:#00f0ff; width:14px; height:34px; border-radius:8px; box-shadow:0 0 10px #00f0ff; }
    .item-pendrive { background:#ff2bd6; width:16px; height:30px; border-radius:4px; box-shadow:0 0 10px #ff2bd6; }
    .item-cartao   { background:linear-gradient(135deg,#00f0ff,#7b2fff); border-radius:4px; width:34px; height:22px; }
    .item-senha    { background:#e8f7ff; border-radius:2px; width:34px; height:24px; box-shadow:inset 0 6px rgba(0,240,255,.4); }
    .item-documento{ background:#e8f7ff; border-radius:2px; width:28px; height:34px; box-shadow:inset 0 8px rgba(255,43,214,.3); }

    /* Notificação de coleta */
    .inv-notificacao {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translate(-50%, 60px);
        background: rgba(10,14,26,0.9);
        backdrop-filter: blur(10px);
        border: 1px solid #00f0ff;
        border-radius: 12px;
        padding: 12px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 60;
        opacity: 0;
        transition: 0.5s;
        box-shadow: 0 0 25px rgba(0,240,255,0.4);
    }
    .inv-notificacao.visivel { transform: translate(-50%,0); opacity: 1; }
    .inv-notificacao strong {
        font-family:'Orbitron',sans-serif;
        color:#00f0ff; font-size:0.75rem; letter-spacing:2px;
    }
    .inv-notificacao span { font-size:0.95rem; }

    /* Responsividade */
    @media (max-width: 768px) {
        #inventario-lateral { width: 150px; }
        #inventario-lateral.recolhido { transform: translateY(-50%) translateX(122px); }
        .inv-nome { font-size: 0.5rem; }
    }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();
