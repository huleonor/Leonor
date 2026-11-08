/*
 * Configuração da gestão da INOVACAR.
 *
 * apiUrl: o URL /exec da Aplicação Web do Apps Script (apps-script/Codigo.gs).
 *   Pode ficar aqui para toda a equipa, ou ser colado em cada aparelho na engrenagem.
 *   O PIN nunca fica neste ficheiro: cada aparelho escreve-o uma vez.
 *   Vazio: a página abre em modo de demonstração, com dados só neste navegador.
 */
window.GESTAO = {
  apiUrl: '',

  // Horário de abertura: os tempos contam só as horas em que a oficina está aberta.
  horario: { dias: [1, 2, 3, 4, 5], abre: '09:00', fecha: '18:30' },

  // Os serviços do site, pela mesma ordem.
  servicos: [
    'Manutenção e mudança de óleo',
    'Travões',
    'Diagnóstico de avarias',
    'Bateria e arranque',
    'Suspensão e direção',
    'Embraiagem e caixa de velocidades',
    'Motor e correia de distribuição',
    'Pré-inspeção e mecânica geral',
    'Outro',
  ],

  // Atualiza os dados da sheet de tanto em tanto (segundos), com a página à vista.
  atualizarCada: 60,
};
