function TestApp() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <h1 className="text-2xl font-bold mb-4">Sistema Funcionando</h1>
      <p>Teste básico para verificar se o React está carregando corretamente.</p>
      <div className="mt-4">
        <a href="/login" className="text-blue-600 underline">Ir para Login</a>
      </div>
    </div>
  );
}

export default TestApp;