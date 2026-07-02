import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { PluginId } from '@/contexts/plugins/domain/ids'
import { PluginStatus } from '@/contexts/plugins/domain/PluginStatus'
import { PluginSource } from '@/contexts/plugins/domain/PluginSource'
import { PluginInstalling } from '@/contexts/plugins/domain/events/PluginInstalling'
import { PluginInstalled } from '@/contexts/plugins/domain/events/PluginInstalled'
import { PluginInstallFailed } from '@/contexts/plugins/domain/events/PluginInstallFailed'
import { PluginUninstalled } from '@/contexts/plugins/domain/events/PluginUninstalled'
import { PluginEnabled } from '@/contexts/plugins/domain/events/PluginEnabled'
import { PluginDisabled } from '@/contexts/plugins/domain/events/PluginDisabled'
import { PluginConfigured } from '@/contexts/plugins/domain/events/PluginConfigured'

interface PluginProps {
  name: string
  description: string | null
  version: string
  author: string | null
  icon: string | null
  category: string | null
  manifest: string | null
  pieceName: string | null
  authType: string | null
  source: PluginSource
  sourceUrl: string | null
  status: PluginStatus
  config: JsonObject
  installedAt: Date | null
  installedBy: string | null
  updatedAt: Date
}

export interface RehydratePluginProps {
  id: PluginId
  name: string
  description: string | null
  version: string
  author: string | null
  icon: string | null
  category: string | null
  manifest: string | null
  pieceName: string | null
  authType: string | null
  source: PluginSource
  sourceUrl: string | null
  status: PluginStatus
  config: JsonObject
  installedAt: Date | null
  installedBy: string | null
  updatedAt: Date
}

export interface CatalogUpsertProps {
  name: string
  description: string | null
  version: string
  category: string | null
  pieceName: string
  authType: string | null
  icon: string | null
  source: PluginSource
  manifest: string | null
  now: Date
}

// Outcome of `beginInstall`: `started` is false when the plugin is already
// installed or installing (a no-op, mirroring the source early-return) so the use
// case knows NOT to kick off the package install again.
export interface BeginInstallOutcome {
  started: boolean
}

// AGGREGATE. The install-lifecycle of a catalogued plugin. Every transition is
// PURE: it guards the current state, mutates in-memory props, bumps updatedAt and
// records an event. All IO (npm install/uninstall, persistence, event dispatch)
// lives in the use cases / adapters. Mirrors the source `plugin-service.ts`
// (installPlugin / uninstallPlugin / configurePlugin / setPluginStatus) and the
// `piece-registry.ts` catalog upsert.
export class Plugin extends AggregateRoot<PluginId> {
  private constructor(
    id: PluginId,
    private props: PluginProps,
  ) {
    super(id)
  }

  // Rehydrate from persistence (no events, no re-validation of stored data).
  static rehydrate(input: RehydratePluginProps): Plugin {
    return new Plugin(input.id, {
      name: input.name,
      description: input.description,
      version: input.version,
      author: input.author,
      icon: input.icon,
      category: input.category,
      manifest: input.manifest,
      pieceName: input.pieceName,
      authType: input.authType,
      source: input.source,
      sourceUrl: input.sourceUrl,
      status: input.status,
      config: input.config,
      installedAt: input.installedAt,
      installedBy: input.installedBy,
      updatedAt: input.updatedAt,
    })
  }

  // Catalog sync: create a brand-new `available` plugin row from a catalog entry.
  // Mirrors the insert branch of `syncPieceCatalog`.
  static fromCatalog(id: PluginId, input: CatalogUpsertProps): Plugin {
    return new Plugin(id, {
      name: input.name,
      description: input.description,
      version: input.version,
      author: null,
      icon: input.icon,
      category: input.category,
      manifest: input.manifest,
      pieceName: input.pieceName,
      authType: input.authType,
      source: input.source,
      sourceUrl: null,
      status: 'available',
      config: {},
      installedAt: null,
      installedBy: null,
      updatedAt: input.now,
    })
  }

  get name(): string {
    return this.props.name
  }
  get description(): string | null {
    return this.props.description
  }
  get version(): string {
    return this.props.version
  }
  get author(): string | null {
    return this.props.author
  }
  get icon(): string | null {
    return this.props.icon
  }
  get category(): string | null {
    return this.props.category
  }
  get manifest(): string | null {
    return this.props.manifest
  }
  get pieceName(): string | null {
    return this.props.pieceName
  }
  get authType(): string | null {
    return this.props.authType
  }
  get source(): PluginSource {
    return this.props.source
  }
  get sourceUrl(): string | null {
    return this.props.sourceUrl
  }
  get status(): PluginStatus {
    return this.props.status
  }
  get config(): JsonObject {
    return this.props.config
  }
  get installedAt(): Date | null {
    return this.props.installedAt
  }
  get installedBy(): string | null {
    return this.props.installedBy
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }

  // PURE. Refresh catalog metadata while PRESERVING status/config/install info.
  // Mirrors the update branch of `syncPieceCatalog`.
  applyCatalogMetadata(input: CatalogUpsertProps): void {
    this.props.name = input.name
    this.props.description = input.description
    this.props.version = input.version
    this.props.category = input.category
    this.props.pieceName = input.pieceName
    this.props.authType = input.authType
    this.props.icon = input.icon
    this.props.source = input.source
    if (input.manifest) this.props.manifest = input.manifest
    this.props.updatedAt = input.now
  }

  // PURE transition: available/disabled/error -> installing. Returns `started:
  // false` when already installed or installing (no-op early-return), or fails
  // when the plugin carries no piece package to install.
  beginInstall(userId: string, now: Date): Result<BeginInstallOutcome> {
    if (this.props.status === 'installed' || this.props.status === 'installing') {
      return ok({ started: false })
    }
    if (!this.props.pieceName) return fail('Plugin has no piece name')

    this.props.status = 'installing'
    this.props.installedBy = userId
    this.props.updatedAt = now
    this.addEvent(new PluginInstalling(this.id.value, this.props.pieceName, userId, now))
    return ok({ started: true })
  }

  // PURE transition: installing -> installed (package install succeeded).
  completeInstall(now: Date): void {
    this.props.status = 'installed'
    this.props.installedAt = now
    this.props.updatedAt = now
    this.addEvent(new PluginInstalled(this.id.value, this.props.pieceName ?? '', now))
  }

  // PURE transition: installing -> error (package install failed; retry allowed).
  failInstall(reason: string, now: Date): void {
    this.props.status = 'error'
    this.props.updatedAt = now
    this.addEvent(new PluginInstallFailed(this.id.value, reason, now))
  }

  // PURE transition: reset to `available`, clearing config + install metadata.
  // Mirrors `uninstallPlugin` (always resets regardless of current status).
  uninstall(now: Date): void {
    this.props.status = 'available'
    this.props.installedAt = null
    this.props.installedBy = null
    this.props.config = {}
    this.props.updatedAt = now
    this.addEvent(new PluginUninstalled(this.id.value, now))
  }

  // PURE. Replace the configuration bag. Mirrors `configurePlugin`.
  configure(config: JsonObject, now: Date): void {
    this.props.config = config
    this.props.updatedAt = now
    this.addEvent(new PluginConfigured(this.id.value, now))
  }

  // PURE transition: toggle installed <-> disabled. Rejects toggling a plugin
  // that is not installed (available/installing), mirroring `setPluginStatus`.
  setEnabled(enabled: boolean, now: Date): Result<void> {
    if (this.props.status === 'available' || this.props.status === 'installing') {
      return fail('Cannot toggle a plugin that is not installed')
    }
    this.props.status = enabled ? 'installed' : 'disabled'
    this.props.updatedAt = now
    this.addEvent(enabled ? new PluginEnabled(this.id.value, now) : new PluginDisabled(this.id.value, now))
    return ok(undefined)
  }
}
