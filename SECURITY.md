# Política de seguridad

## Reportar una vulnerabilidad

Si encontrás una vulnerabilidad de seguridad en Worklog Hub, **no abras un Issue público**.

Escribí directamente a: **tobiaslongstaff@gmail.com**

Incluí en el reporte:
- Descripción del problema
- Pasos para reproducirlo
- Impacto potencial estimado
- Versión o commit afectado, si lo sabés

Voy a responder dentro de las 72 horas hábiles. Si se confirma la vulnerabilidad, coordinaremos el fix y el disclosure de forma responsable antes de publicar.

---

## Alcance

Áreas relevantes para reportes de seguridad en este proyecto:

| Área | Ejemplo de problema |
|---|---|
| API keys y tokens | Exposición de `OPENAI_API_KEY`, ngrok authtoken, u otras credenciales en logs, respuestas o archivos versionados |
| MCP / túnel HTTP | Acceso no autorizado al servidor MCP expuesto vía ngrok |
| Ejecución de procesos locales | Inyección de comandos en la generación de CLI para agentes |
| Persistencia local | Acceso o modificación de la SQLite sin autorización esperada |
| Primer arranque | Escritura insegura de configuración inicial en rutas del sistema |

---

## Qué no entra en scope

- Vulnerabilidades en dependencias de terceros (reportarlas al proyecto correspondiente)
- Ataques que requieran acceso físico al dispositivo del usuario
- Configuraciones inseguras elegidas explícitamente por el usuario (ej: exponer el puerto sin autenticación en una red no confiable)

---

## Versiones soportadas

El proyecto está en desarrollo activo. Solo se atienden reportes sobre la versión más reciente del branch `main`.
