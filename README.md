# Prototipo: repaso por habilidades

Aplicación web en HTML, CSS y JavaScript sin dependencias. Tiene dos paneles:

- **Lo que ve el estudiante**: ejemplos resueltos de temas nuevos, problemas de repaso y retroalimentación con la solución paso a paso.
- **Lo que hace el sistema**: la predicción del modelo antes de cada respuesta, la actualización de Ŝ y R̂ con las fórmulas y los números, el grafo con el recuerdo estimado de cada habilidad, el plan del día explicado paso a paso, la bitácora y los parámetros editables.

El botón **Pasa un día** adelanta el reloj. Ŝ no cambia con el tiempo; sólo baja R̂ = e^(−Δt/Ŝ). Luego el sistema arma la sesión del día siguiente.

## Cómo abrirlo

Los navegadores no dejan leer archivos JSON cuando la página se abre con doble clic. Hay que servir la carpeta:

```bash
cd prototipo
python -m http.server
# abrir http://localhost:8000
```

El progreso se guarda en el navegador (localStorage). **Reiniciar** lo borra.

## Archivos

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de los dos paneles |
| `estilos.css` | Estilos (tema claro y oscuro) |
| `motor.js` | El modelo: memoria, observación, culpa, admisión, cobertura voraz, paso del tiempo y evaluador de fórmulas de las plantillas |
| `app.js` | Interfaz y eventos |
| `datos/grafo.json` | Las 13 habilidades y sus prerrequisitos |
| `datos/preguntas.json` | 33 plantillas de problemas paramétricos |

## Agregar preguntas o habilidades

Cada plantilla de `preguntas.json` genera números nuevos en cada intento:

```json
{
  "id": "MUA4-a", "habilidad": "MUA4",
  "enunciado": "Un auto parte del reposo con aceleración constante de {a} m/s². ¿Qué velocidad tiene a los {t} s?",
  "variables": {"a": [1, 6, 0.5], "t": [2, 12, 1]},
  "respuesta": "a*t", "unidad": "m/s",
  "pasos": ["v = v₀ + a·t, con v₀ = 0.", "v = {a}·{t} = {respuesta} m/s."]
}
```

- `variables`: `[mínimo, máximo, paso]` o `{"valores": [...]}`.
- `derivadas` (opcional): valores intermedios calculados en orden, útiles para los pasos.
- `respuesta`: expresión con `+ - * / ^`, paréntesis, `sqrt`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan` (en grados), `abs`, `min`, `max` y la constante `g = 9.8`.
- `tolerancia` (opcional): error relativo aceptado; por defecto 0.02.
- `"tipo": "opcion"` con `opciones` y `correcta` para preguntas de opción múltiple.

Para agregar una habilidad, añádela a `grafo.json` con sus prerrequisitos (que deben aparecer antes en la lista) y escribe al menos una plantilla para ella.

## El modelo

Es el mismo modelo del simulador y del artículo, con una diferencia: aquí cada día es una sesión, así que la carga de mantenimiento cuenta repasos por día.

- Memoria: R̂ = exp(−(t − L̂)/Ŝ).
- Predicción: P̂ = (1 − s)·Π + g·(1 − Π), con Π = ∏ R̂^w.
- Acierto: Ŝ ← Ŝ·[1 + w·G·(1 − R̂)].
- Fallo: b = (1 − R̂^w)/(1 − Π), Ŝ ← max(Ŝ_min, Ŝ·(1 − λ·b)). En Parámetros se puede activar la versión de la culpa que incluye s y g.
- Salto: R̂ ← R̂ + w·(1 − R̂).
- Admisión: cada prerrequisito con Ŝ ≥ S_listo y R̂ ≥ r*, y carga + 1 ≤ ρ·U.
- Sesión: cobertura voraz de lo vencido, después temas nuevos y después repasos adelantados.

Ŝ₀ = 8.2, G = 7.2 y λ = 0.13 son los valores estimados en la simulación del grafo de subtemas. S_listo es 12 (no 7 como en la simulación) para que un tema nuevo no habilite a sus dependientes el mismo día en que se introduce.
