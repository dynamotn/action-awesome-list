import nunjucks, { Template } from 'nunjucks'

import type { TemplateLanguageVars, TemplateOverallVars } from './types.js'

const environment = new nunjucks.Environment()
let template: Template

export const compile = (templateString: string, name: string): void => {
  template = new Template(templateString, environment, name, true)
}

export const render = (data: TemplateLanguageVars | TemplateOverallVars): string => {
  if (!template) {
    throw 'template is not compiled'
  }

  return template.render(data)
}
