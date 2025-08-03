import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import * as core from '@actions/core'

import * as cfg from './config.js'
import * as git from './git.js'
import * as markdown from './markdown.js'
import * as stars from './stars.js'
import * as template from './template.js'

import packageInfo from '../package.json'

import type { GeneratedFile } from './types.js'

export async function main() {
  core.info(`${packageInfo.name} v${packageInfo.version}`)

  const config = await cfg.resolve()

  core.debug(`Resolved configuration: ${JSON.stringify(config)}`)

  const files: GeneratedFile[] = []

  await git.setup(config)
  await git.pull(config.git.pullFlags)
  await git.status()

  const response = await stars.getStars(config)

  if (config.stars.source === 'api') {
    await git.add(config.stars.filename)
    await git.status()
  }

  const vars = stars.resolveResponse(response, config)

  template.compile(
    readFileSync(config.template.overall.path, 'utf8'),
    config.template.overall.name,
  )
  let rendered = template.render(vars)
  files.push({
    filename: config.output.overall_filename,
    data: await markdown.generate(rendered),
  })

  template.compile(
    readFileSync(config.template.language.path, 'utf8'),
    config.template.language.name,
  )
  for (const language of vars.languages) {
    rendered = template.render({
      repos: vars.byLanguage[language],
      language: language,
    })
    files.push({
      filename: config.output.language_filepattern.replace('%s', language),
      data: await markdown.generate(rendered),
    })
  }

  core.debug('Rendered template')

  // Security check: ensure that each filename would end up in the git repository so that
  // we do not chance writing something out of tree.
  for (const file of files) {
    const filename = resolvePath(file.filename)

    if (!filename.startsWith(git.root)) {
      throw new Error(`${filename} outside of git repo`)
    }

    const parent = dirname(filename)

    if (parent !== git.root) {
      mkdirSync(dirname(filename), { recursive: true })
    }

    if (file.data) {
      writeFileSync(file.filename, file.data)
    }

    await git.add(filename)
  }

  await git.status()
  await git.commit(config.git.commitMessage)
  await git.status()
  await git.push()
  await git.status()
}

export async function run(): Promise<void> {
  try {
    await main()
  } catch (error) {
    core.setFailed(`#run: ${error}`)

    if (error instanceof Error && error.stack) {
      core.error(error.stack)
    }
  }
}

const catchAll = (info: string) => {
  core.setFailed(`#catchAll: ${info}`)
  core.error(info)
}

process.on('unhandledRejection', catchAll)
process.on('uncaughtException', catchAll)

run().catch(core.error)
