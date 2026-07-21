/**
 * Resuelve variables en un template de WhatsApp.
 * Las variables tienen formato {{campo}} — se reemplazan
 * con los valores provistos o se dejan como placeholder.
 *
 * Ejemplo:
 *   resolveWhatsappTemplate("Hola {{cliente.nombre}}", { "cliente.nombre": "Juan" })
 *   → "Hola Juan"
 */
export function resolveWhatsappTemplate(
  cuerpo: string,
  vars: Record<string, string>,
): string {
  return cuerpo.replace(/\{\{([^}]+)\}\}/g, (_, campo) => {
    const key = campo.trim()
    const val = vars[key]
    // Si el valor existe y no es vacío, reemplaza; si no, deja el placeholder
    return (val !== undefined && val !== '') ? val : `{{${key}}}`
  })
}

/**
 * Convierte el formato WhatsApp básico a HTML para la burbuja de preview:
 * - *texto* → <strong>texto</strong>
 * - _texto_ → <em>texto</em>
 * - Saltos de línea → <br>
 */
export function whatsappToHtml(text: string): string {
  return text
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}
