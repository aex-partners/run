// Custo médio ponderado, GLOBAL por insumo (não por depósito). Domínio PURO: sem I/O.
//
//   custoMedio' = (saldo × custoMedio + qtdEntrada × custoEntrada) / (saldo + qtdEntrada)
//
// Quantidades e custos vivem SEMPRE na unidade de CONSUMO (a que a ficha técnica usa).
// A conversão de unidade de compra -> consumo acontece no `compras` (domain/CustoNota.ts),
// antes de o movimento chegar aqui.

export interface EstadoCusto {
  saldo: number
  custoMedio: number
}

// SÓ estes dois tipos de movimento mudam o custo médio. Todo o resto move quantidade ao
// médio vigente. É a regra que sustenta o modelo inteiro: se uma perda ou uma contagem
// mexesse no médio, o custo do produto passaria a depender de erro de estoque.
const TIPOS_QUE_CUSTEIAM = new Set(['entrada_nota', 'inventario_abertura'])

export function custeia(tipo: string): boolean {
  return TIPOS_QUE_CUSTEIAM.has(tipo)
}

// Entrada COM custo (nota ou inventário de abertura): pondera.
export function aplicarEntrada(estado: EstadoCusto, qtdEntrada: number, custoEntrada: number): EstadoCusto {
  // Entrada de quantidade zero ou negativa não é entrada. Não mexe em nada.
  if (!(qtdEntrada > 0)) return estado

  const saldoNovo = estado.saldo + qtdEntrada

  // Saldo zerado ou NEGATIVO: ponderar contra ele daria 0/0, ou um médio negativo /
  // explodido. A entrada DEFINE o médio, e o saldo segue sendo corrigido para cima.
  if (estado.saldo <= 0) return { saldo: saldoNovo, custoMedio: custoEntrada }

  // Aqui saldo > 0 e qtdEntrada > 0, logo saldoNovo > 0: divisão sempre segura.
  return {
    saldo: saldoNovo,
    custoMedio: (estado.saldo * estado.custoMedio + qtdEntrada * custoEntrada) / saldoNovo,
  }
}

// Todo movimento que NÃO custeia: move a quantidade (com sinal) e preserva o médio.
// Saída maior que o saldo é PERMITIDA: o saldo fica negativo. Bloquear travaria a
// fábrica; esconder mentiria. Quem avisa é o RegistrarMovimentoService (erro suave).
export function aplicarMovimentoSemCusto(estado: EstadoCusto, qtd: number): EstadoCusto {
  return { saldo: estado.saldo + qtd, custoMedio: estado.custoMedio }
}
