import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { ChallengeManifestSchema, RegistryIndexSchema } from './schema.js'
import type { ChallengeManifest, InstalledPackage, RegistryIndex } from './types.js'

export class RegistryManager {
  private rootDir: string
  private indexPath: string
  private packagesDir: string

  constructor(rootDir?: string) {
    this.rootDir = rootDir ?? join(process.cwd(), '.agentauth')
    this.indexPath = join(this.rootDir, 'index.json')
    this.packagesDir = join(this.rootDir, 'packages')
  }

  async init(): Promise<void> {
    await mkdir(this.packagesDir, { recursive: true })
    if (!existsSync(this.indexPath)) {
      await this.writeIndex({ version: '1.0.0', packages: {} })
    }
  }

  async readIndex(): Promise<RegistryIndex> {
    if (!existsSync(this.indexPath)) {
      return { version: '1.0.0', packages: {} }
    }
    const raw = await readFile(this.indexPath, 'utf-8')
    return RegistryIndexSchema.parse(JSON.parse(raw))
  }

  private async writeIndex(index: RegistryIndex): Promise<void> {
    await writeFile(this.indexPath, JSON.stringify(index, null, 2))
  }

  async install(sourceDir: string): Promise<InstalledPackage> {
    const manifestPath = join(sourceDir, 'agentauth.json')
    const raw = await readFile(manifestPath, 'utf-8')
    const manifest = ChallengeManifestSchema.parse(JSON.parse(raw))

    const targetDir = join(this.packagesDir, manifest.name)
    await mkdir(targetDir, { recursive: true })
    await cp(sourceDir, targetDir, { recursive: true })

    const installed: InstalledPackage = {
      manifest,
      installed_at: new Date().toISOString(),
      path: targetDir,
    }

    const index = await this.readIndex()
    index.packages[manifest.name] = installed
    await this.writeIndex(index)

    return installed
  }

  async uninstall(name: string): Promise<boolean> {
    const index = await this.readIndex()
    const pkg = index.packages[name]
    if (!pkg) return false

    await rm(pkg.path, { recursive: true, force: true })
    delete index.packages[name]
    await this.writeIndex(index)
    return true
  }

  async list(): Promise<InstalledPackage[]> {
    const index = await this.readIndex()
    return Object.values(index.packages)
  }

  async search(query: string): Promise<InstalledPackage[]> {
    const all = await this.list()
    const q = query.toLowerCase()
    return all.filter((pkg) =>
      pkg.manifest.name.toLowerCase().includes(q) ||
      pkg.manifest.description.toLowerCase().includes(q) ||
      pkg.manifest.keywords?.some((k) => k.toLowerCase().includes(q))
    )
  }

  async get(name: string): Promise<InstalledPackage | null> {
    const index = await this.readIndex()
    return index.packages[name] ?? null
  }

  async validatePackage(sourceDir: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []
    const manifestPath = join(sourceDir, 'agentauth.json')

    if (!existsSync(manifestPath)) {
      return { valid: false, errors: ['Missing agentauth.json manifest'] }
    }

    try {
      const raw = await readFile(manifestPath, 'utf-8')
      const parsed = JSON.parse(raw)
      const result = ChallengeManifestSchema.safeParse(parsed)

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push(`${issue.path.join('.')}: ${issue.message}`)
        }
        return { valid: false, errors }
      }

      const entryPath = join(sourceDir, result.data.entry)
      if (!existsSync(entryPath)) {
        errors.push(`Entry file not found: ${result.data.entry}`)
        return { valid: false, errors }
      }

      return { valid: true, errors: [] }
    } catch (err) {
      errors.push(`Failed to parse agentauth.json: ${err instanceof Error ? err.message : 'unknown error'}`)
      return { valid: false, errors }
    }
  }
}
