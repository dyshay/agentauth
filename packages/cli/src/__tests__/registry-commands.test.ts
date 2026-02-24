import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RegistryManager } from '@xagentauth/core'

let testDir: string

async function createMockPackage(name: string): Promise<string> {
  const pkgDir = join(testDir, name.replace('/', '__'))
  await mkdir(join(pkgDir, 'src'), { recursive: true })

  await writeFile(join(pkgDir, 'agentauth.json'), JSON.stringify({
    name,
    version: '1.0.0',
    description: `Test ${name} challenge`,
    author: 'test-user',
    dimensions: ['reasoning'],
    difficulties: ['easy', 'medium'],
    entry: 'src/index.ts',
    agentauth_version: '>=1.0.0',
    keywords: ['test'],
  }))

  await writeFile(join(pkgDir, 'src', 'index.ts'), 'export default {}')
  return pkgDir
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'agentauth-cli-test-'))
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('CLI registry commands (logic)', () => {
  it('add: installs a valid package', async () => {
    const registryDir = join(testDir, '.agentauth')
    const manager = new RegistryManager(registryDir)
    await manager.init()

    const pkgDir = await createMockPackage('@test/my-challenge')
    const installed = await manager.install(pkgDir)

    expect(installed.manifest.name).toBe('@test/my-challenge')
    expect(installed.manifest.version).toBe('1.0.0')
  })

  it('list: returns installed packages', async () => {
    const registryDir = join(testDir, '.agentauth')
    const manager = new RegistryManager(registryDir)
    await manager.init()

    await manager.install(await createMockPackage('@test/pkg-a'))
    await manager.install(await createMockPackage('@test/pkg-b'))

    const packages = await manager.list()
    expect(packages).toHaveLength(2)
  })

  it('search: filters packages by query', async () => {
    const registryDir = join(testDir, '.agentauth')
    const manager = new RegistryManager(registryDir)
    await manager.init()

    await manager.install(await createMockPackage('@test/chess-puzzle'))
    await manager.install(await createMockPackage('@test/math-quiz'))

    const results = await manager.search('chess')
    expect(results).toHaveLength(1)
    expect(results[0].manifest.name).toBe('@test/chess-puzzle')
  })

  it('publish: validates a package', async () => {
    const manager = new RegistryManager(join(testDir, '.agentauth'))
    const pkgDir = await createMockPackage('@test/valid-pkg')

    const result = await manager.validatePackage(pkgDir)
    expect(result.valid).toBe(true)
  })
})
