import { describe, expect, it } from 'vitest'

import { appendSignature, extractVariables, markdownToHtml, renderTemplate } from './templates'

describe('Email Templates Logic', () => {
  const sampleVars = {
    nombre: 'María García',
    empresa: 'Acme Studio',
    email: 'maria.garcia@acme.com',
    sender_name: 'Pol Gubau',
  }

  const sampleSignature = '<div>Firma</div>'

  describe('renderTemplate', () => {
    it('should replace variables correctly', () => {
      const template = 'Hola {{nombre}}, ¿cómo está {{empresa}}?'
      const result = renderTemplate(template, sampleVars)
      expect(result).toBe('Hola María García, ¿cómo está Acme Studio?')
    })

    it('should handle missing variables by leaving them as-is', () => {
      const template = 'Hola {{nombre}}, tu id es {{id_inexistente}}'
      const result = renderTemplate(template, sampleVars)
      expect(result).toBe('Hola María García, tu id es {{id_inexistente}}')
    })

    it('should handle spaces inside braces', () => {
      const template = 'Hola {{  nombre  }}'
      const result = renderTemplate(template, sampleVars)
      expect(result).toBe('Hola María García')
    })

    it('should leave placeholders untouched for null/undefined values', () => {
      expect(renderTemplate('{{a}} {{b}}', { a: null, b: undefined })).toBe('{{a}} {{b}}')
    })
  })

  describe('appendSignature', () => {
    it('should append signature if provided', () => {
      const html = '<p>Contenido</p>'
      const result = appendSignature(html, sampleSignature)
      expect(result).toContain(html)
      expect(result).toContain(sampleSignature)
      expect(result).toContain('class="email-signature"')
    })

    it('should return original html if signature is null or empty', () => {
      const html = '<p>Contenido</p>'
      expect(appendSignature(html, null)).toBe(html)
      expect(appendSignature(html, '')).toBe(html)
    })
  })

  describe('markdownToHtml', () => {
    it('should convert basic markdown to html', () => {
      const result = markdownToHtml('Hola **mundo**')
      expect(result).toContain('<strong>mundo</strong>')
      expect(result).toContain('<p>')
    })

    it('should convert single newlines to line breaks', () => {
      const result = markdownToHtml('Línea 1\nLínea 2')
      expect(result).toContain('<br>')
    })

    it('should pass raw HTML through untouched (legacy templates)', () => {
      const result = markdownToHtml('<p>Hola <a href="https://x.com">link</a></p>')
      expect(result).toContain('<a href="https://x.com">link</a>')
    })

    it('should render markdown links', () => {
      const result = markdownToHtml('[doscientos](https://doscientos.es)')
      expect(result).toContain('href="https://doscientos.es"')
    })

    it('should work after variable interpolation', () => {
      const html = markdownToHtml(renderTemplate('Hola **{{nombre}}**', sampleVars))
      expect(html).toContain('<strong>María García</strong>')
    })
  })

  describe('extractVariables', () => {
    it('should extract all variables from a string', () => {
      const template = 'Hola {{nombre}}, bienvenido a {{empresa}}. Contacto: {{email}}'
      const vars = extractVariables(template)
      expect(vars).toEqual(['nombre', 'empresa', 'email'])
    })

    it('should handle empty strings', () => {
      expect(extractVariables('')).toEqual([])
    })

    it('should not duplicate variables', () => {
      const template = '{{nombre}} {{nombre}}'
      expect(extractVariables(template)).toEqual(['nombre'])
    })
  })
})
