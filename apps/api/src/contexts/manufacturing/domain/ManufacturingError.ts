export const ManufacturingError = {
  entidadeFaltando: 'entidade de manufatura não provisionada',
  centroNaoEncontrado: 'centro de trabalho não encontrado',
  semRascunho: 'nenhum rascunho de roteiro para publicar',
  operacaoPublicada:
    'operação publicada não pode ser editada: abra uma nova revisão (abrir_revisao_roteiro) e edite o rascunho',
  revisaoJaAberta:
    'revisão já aberta: o modelo já tem operações em rascunho — edite-as e publique (publicar_roteiro)',
  semRoteiroPublicado:
    'modelo sem roteiro publicado para clonar: crie as operações direto em rascunho (definir_operacao)',
} as const
