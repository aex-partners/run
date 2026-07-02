import { execFile } from 'node:child_process'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { PieceInstaller } from '@/contexts/plugins/application/ports/out/PieceInstaller'

// Driven adapter implementing the PieceInstaller out-port. Runs
// `npm install/uninstall @activepieces/piece-*` into a dedicated `.pieces/` dir
// (to avoid polluting the main project), with an in-flight lock to dedupe
// concurrent installs of the same package. Mirrors the source `piece-installer.ts`.
const PIECES_DIR = process.env.PIECES_DIR || join(process.cwd(), '.pieces')

export class NpmPieceInstaller implements PieceInstaller {
  private readonly locks = new Map<string, Promise<void>>()

  async install(pieceName: string): Promise<void> {
    const fullName = normalize(pieceName)
    if (await isInstalled(fullName)) return

    const existing = this.locks.get(fullName)
    if (existing) return existing

    const promise = this.doInstall(fullName)
    this.locks.set(fullName, promise)
    try {
      await promise
    } finally {
      this.locks.delete(fullName)
    }
  }

  async uninstall(pieceName: string): Promise<void> {
    const fullName = normalize(pieceName)
    await ensurePiecesDir()
    await run(['uninstall', fullName])
  }

  private async doInstall(fullName: string): Promise<void> {
    await ensurePiecesDir()
    await run(['install', fullName, '--save', '--legacy-peer-deps'], { npm_config_yes: 'true' })
  }
}

function normalize(pieceName: string): string {
  return pieceName.startsWith('@activepieces/') ? pieceName : `@activepieces/piece-${pieceName}`
}

async function isInstalled(fullName: string): Promise<boolean> {
  try {
    await access(join(PIECES_DIR, 'node_modules', ...fullName.split('/')))
    return true
  } catch {
    return false
  }
}

async function ensurePiecesDir(): Promise<void> {
  await mkdir(PIECES_DIR, { recursive: true })
  const pkgPath = join(PIECES_DIR, 'package.json')
  try {
    await access(pkgPath)
  } catch {
    await writeFile(
      pkgPath,
      JSON.stringify({ name: 'aex-pieces', version: '1.0.0', private: true, dependencies: {} }, null, 2),
    )
  }
}

function run(args: string[], extraEnv: Record<string, string> = {}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    execFile(
      'npm',
      args,
      { cwd: PIECES_DIR, timeout: 180_000, env: { ...process.env, ...extraEnv } },
      (error) => {
        if (error) reject(new Error(`npm ${args[0]} failed: ${error.message}`))
        else resolve()
      },
    )
  })
}
