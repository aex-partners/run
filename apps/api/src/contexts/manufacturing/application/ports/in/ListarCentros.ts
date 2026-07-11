import { RoteiroCentroView } from '@/contexts/manufacturing/application/ports/in/ObterRoteiro'

export interface ListarCentros {
  execute(): Promise<RoteiroCentroView[]>
}
