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

  // A GUARDA DE COMPLETUDE. Uma revisão é o roteiro COMPLETO, e `PublicarRoteiro` promove SÓ os
  // rascunhos — então publicar um rascunho que não contém todas as operações da rev publicada
  // APAGA as que faltam do custo, em silêncio. O caso natural é "adicionar uma operação": criar
  // um rascunho novo (sem id) não toca em nenhuma linha publicada, a guarda de `publicada` não
  // dispara, e o publish seguinte deixaria a revisão nova com APENAS a operação adicionada.
  revisaoIncompleta: (faltando: string[], revPublicada: number): string =>
    `a nova revisão não contém ${faltando.join(', ')}, que ${faltando.length === 1 ? 'está' : 'estão'} na rev ${revPublicada} publicada. ` +
    'Use abrir_revisao_roteiro para clonar o roteiro publicado e editar o rascunho, ' +
    'ou passe substituirTudo=true se a intenção é realmente substituir o roteiro inteiro.',

  // `codigo` é a IDENTIDADE ESTÁVEL da operação dentro do modelo: é por ele que a linha da ficha
  // técnica (operacao_codigo) diz qual operação consome cada insumo, atravessando as revisões.
  // Reescrevê-lo num update RE-IDENTIFICA a operação e ORFANA todas as atribuições que apontam
  // para o código antigo — em silêncio, porque a atribuição pendurada só vira erro (soft) na
  // próxima explosão. O código é imutável depois de criado.
  codigoImutavel: (atual: string, novo: string): string =>
    `codigo da operação é imutável: "${atual}" não pode virar "${novo}". ` +
    'O codigo é a identidade ESTÁVEL da operação no modelo e as linhas da ficha técnica ' +
    '(operacao_codigo) apontam para ele. Para uma operação diferente, crie outra linha ' +
    '(definir_operacao sem id).',
} as const
