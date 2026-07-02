import { LocaleStrings } from '@/contexts/email/adapters/out/templates/types'

export const ptBR: LocaleStrings = {
  greeting: (name: string) => `Olá ${name},`,
  footer: 'Esta é uma mensagem automática do AEX. Por favor, não responda a este e-mail.',
  buttonFallback: 'Se o botão acima não funcionar, copie e cole este link no seu navegador:',
}
