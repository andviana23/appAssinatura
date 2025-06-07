document.addEventListener('DOMContentLoaded', function() {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h1>Sistema Barbershop</h1>
        <p>Aplicação carregada com sucesso!</p>
        <button onclick="window.location.href='/login'">
          Fazer Login
        </button>
      </div>
    `;
  }
});