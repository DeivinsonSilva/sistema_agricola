document.addEventListener('DOMContentLoaded', () => {
    const headerPlaceholder = document.querySelector('#header-placeholder');
    const footerPlaceholder = document.querySelector('#footer-placeholder');

    // Carrega o cabeçalho
    if (headerPlaceholder) {
        fetch('_header.html')
            .then(response => response.text())
            .then(data => {
                headerPlaceholder.innerHTML = data;
                inicializarHeader();
            });
    }

    // Carrega o rodapé
    if (footerPlaceholder) {
        fetch('_footer.html')
            .then(response => response.text())
            .then(data => {
                footerPlaceholder.innerHTML = data;
            });
    }
});

function inicializarHeader() {
    // Verifica se está logado
    const token = localStorage.getItem('authToken');
    if (!token) {
        // Se estiver em qualquer página que não seja a de login/setup, redireciona
        if (!window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('setup.html')) {
            window.location.href = 'index.html';
        }
        return;
    }
    
    // Pega informações do usuário
    const user = JSON.parse(localStorage.getItem('userInfo'));

    // Atualiza o nome do usuário
    const userNameElement = document.getElementById('header-user-name');
    if (userNameElement && user) {
        userNameElement.textContent = user.nome;
    }

    // Lógica do botão de logout
    const logoutButton = document.getElementById('header-logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (confirm('Você tem certeza que deseja sair?')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                window.location.href = 'index.html';
            }
        });
    }
    
    // Mostra links de admin se o usuário for Admin
    if (user && user.tipo === 'Admin') {
        const nav = document.querySelector('.main-nav');
        const adminLinksHtml = `
            <a href="gerenciar_fazendas.html" data-navlink="/gerenciar_fazendas.html">Fazendas</a>
            <a href="gerenciar_servicos.html" data-navlink="/gerenciar_servicos.html">Serviços</a>
            <a href="gerenciar_trabalhadores.html" data-navlink="/gerenciar_trabalhadores.html">Trabalhadores</a>
            <a href="gerenciar_usuarios.html" data-navlink="/gerenciar_usuarios.html">Usuários</a>
            <a href="gerenciar_banco.html" data-navlink="/gerenciar_banco.html">Banco</a>
        `;
        nav.innerHTML += adminLinksHtml;
    }
    
    // Marca o link de navegação da página atual como "ativo"
    const currentPagePath = window.location.pathname;
    const navLinks = document.querySelectorAll('.main-nav a');
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('data-navlink');
        if (currentPagePath.endsWith(linkPath)) {
            link.classList.add('active');
        }
    });
}