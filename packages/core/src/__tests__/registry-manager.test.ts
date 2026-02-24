import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RegistryManager } from '../registry/manager.js'

let testDir: string
let registryDir: string
let manager: RegistryManager

async function createMockPackage(name: string, opts?: { missingManifest?: boolean; missingEntry?: boolean; invalidManifest?: boolean }): Promise<string> {
  const pkgDir = join(testDir, name.replace('/', '__'))
  await mkdir(join(pkgDir, 'src'), { recursive: true })

  if (!opts?.missingManifest) {
    const manifest = opts?.invalidManifest
      ? { name: 'invalid' } // missing scope
      : {
          name,
          version: '1.0.0',
          description: `Test ${name} challenge`,
          author: 'test-user',
          dimensions: ['reasoning'],
          difficulties: ['easy', 'medium'],
          entry: 'src/index.ts',
          agentauth_version: '>=1.0.0',
          keywords: ['test', name.split('/').pop()],
        }
    await writeFile(join(pkgDir, 'agentauth.json'), JSON.stringify(manifest))
  }

  if (!opts?.missingEntry) {
    await writeFile(join(pkgDir, 'src', 'index.ts'), 'export default {}')
  }

  return pkgDir
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'agentauth-test-'))
  registryDir = join(testDir, '.agentauth')
  manager = new RegistryManager(registryDir)
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('RegistryManager', () => {
  describe('init', () => {
    it('creates .agentauth directory and index.json', async () => {
      await manager.init()
      const index = await manager.readIndex()
      expect(index.version).toBe('1.0.0')
      expect(Object.keys(index.packages)).toHaveLength(0)
    })
  })

  describe('install', () => {
    it('installs a valid package and updates index', async () => {
      await manager.init()
      const pkgDir = await createMockPackage('@community/chess-puzzle')
      const installed = await manager.install(pkgDir)

      expect(installed.manifest.name).toBe('@community/chess-puzzle')
      expect(installed.manifest.version).toBe('1.0.0')

      const index = await manager.readIndex()
      expect(index.packages['@community/chess-puzzle']).toBeDefined()
    })
  })

  describe('list', () => {
    it('returns all installed packages', async () => {
      await manager.init()
      await manager.install(await createMockPackage('@community/chess-puzzle'))
      await manager.install(await createMockPackage('@community/math-quiz'))

      const packages = await manager.list()
      expect(packages).toHaveLength(2)
    })

    it('returns empty array when no packages installed', async () => {
      await manager.init()
      const packages = await manager.list()
      expect(packages).toHaveLength(0)
    })
  })

  describe('search', () => {
    it('searches by name', async () => {
      await manager.init()
      await manager.install(await createMockPackage('@community/chess-puzzle'))
      await manager.install(await createMockPackage('@community/math-quiz'))

      const results = await manager.search('chess')
      expect(results).toHaveLength(1)
      expect(results[0].manifest.name).toBe('@community/chess-puzzle')
    })

    it('searches by keyword', async () => {
      await manager.init()
      await manager.install(await createMockPackage('@community/chess-puzzle'))

      const results = await manager.search('chess-puzzle')
      expect(results).toHaveLength(1)
    })

    it('returns empty for no matches', async () => {
      await manager.init()
      await manager.install(await createMockPackage('@community/chess-puzzle'))

      const results = await manager.search('nonexistent')
      expect(results).toHaveLength(0)
    })
  })

  describe('uninstall', () => {
    it('removes package and updates index', async () => {
      await manager.init()
      await manager.install(await createMockPackage('@community/chess-puzzle'))

      const removed = await manager.uninstall('@community/chess-puzzle')
      expect(removed).toBe(true)

      const packages = await manager.list()
      expect(packages).toHaveLength(0)
    })

    it('returns false for unknown package', async () => {
      await manager.init()
      const removed = await manager.uninstall('@community/nonexistent')
      expect(removed).toBe(false)
    })
  })

  describe('get', () => {
    it('returns installed package by name', async () => {
      await manager.init()
      await manager.install(await createMockPackage('@community/chess-puzzle'))

      const pkg = await manager.get('@community/chess-puzzle')
      expect(pkg).not.toBeNull()
      expect(pkg!.manifest.name).toBe('@community/chess-puzzle')
    })

    it('returns null for unknown package', async () => {
      await manager.init()
      const pkg = await manager.get('@community/nonexistent')
      expect(pkg).toBeNull()
    })
  })

  describe('validatePackage', () => {
    it('validates a correct package', async () => {
      const pkgDir = await createMockPackage('@community/chess-puzzle')
      const result = await manager.validatePackage(pkgDir)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('catches missing manifest', async () => {
      const pkgDir = await createMockPackage('@community/missing', { missingManifest: true })
      const result = await manager.validatePackage(pkgDir)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Missing agentauth.json')
    })

    it('catches invalid manifest schema', async () => {
      const pkgDir = await createMockPackage('@community/invalid', { invalidManifest: true })
      const result = await manager.validatePackage(pkgDir)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('catches missing entry file', async () => {
      const pkgDir = await createMockPackage('@community/no-entry', { missingEntry: true })
      const result = await manager.validatePackage(pkgDir)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Entry file not found')
    })
  })
})
