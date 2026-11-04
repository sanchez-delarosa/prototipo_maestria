# Explicación del paper: arquitectura de repetición espaciada para el aprendizaje de procedimientos

## Introducción

El documento propone algo más ambicioso que un sistema tradicional de tarjetas: un **planificador de aprendizaje para procedimientos**, capaz de decidir:

- qué problema de física conviene practicar;
- cuándo debe practicarse;
- qué habilidad probablemente causó un error;
- cuándo está preparado el estudiante para avanzar;
- cómo evitar una acumulación excesiva de repasos.

La idea central es combinar:

- repetición espaciada;
- prerrequisitos;
- problemas que ejercitan varias habilidades;
- inferencia probabilística;
- control de la carga diaria.

---

## 1. ¿Cuál es el problema que intenta resolver?

En una tarjeta convencional, la relación es sencilla:

> Una tarjeta → un dato → una respuesta.

Por ejemplo:

> ¿Cuál es la capital de Francia?

Si el estudiante falla, sabemos exactamente qué dato no recordó.

En física ocurre algo diferente. Para resolver un problema de caída libre, el estudiante puede necesitar:

- interpretar el enunciado;
- elegir un sistema de referencia;
- utilizar ecuaciones de movimiento acelerado;
- despejar una variable;
- manejar unidades;
- sustituir correctamente los valores.

Por tanto:

> Un problema → varias habilidades → una sola respuesta observable.

Si el estudiante falla, el sistema solamente observa el resultado final. No sabe directamente cuál habilidad produjo el error.

Además, las habilidades tienen dependencias. Antes de estudiar tiro parabólico, por ejemplo, conviene dominar:

- vectores;
- movimiento rectilíneo;
- movimiento acelerado.

El documento intenta resolver simultáneamente cinco preguntas:

1. ¿Cuánto recuerda el estudiante de cada habilidad?
2. ¿Qué probabilidad tiene de resolver cierto problema?
3. Si falla, ¿qué habilidad fue probablemente responsable?
4. ¿Cuándo está preparado para aprender una habilidad nueva?
5. ¿Qué conjunto de problemas aprovecha mejor una sesión limitada?

---

## 2. La idea general del sistema

El sistema mantiene, para cada habilidad $$k$$, dos cantidades principales:

- $\hat S_k$: su **estabilidad**, es decir, qué tan lentamente se olvida;
- $\hat L_k$: el momento efectivo de su último repaso.

Con estas cantidades calcula el recuerdo estimado:

$$
\hat R_k(t)=\exp\left(-\frac{t-\hat L_k}{\hat S_k}\right)
$$

Esta ecuación significa que el recuerdo disminuye exponencialmente con el tiempo.

En términos generales:

- una estabilidad pequeña produce un olvido rápido;
- una estabilidad grande produce un olvido lento;
- un repaso exitoso aumenta la estabilidad;
- un fallo puede reducirla;
- ver la solución después de responder eleva nuevamente el recuerdo inmediato.

El sistema no guarda simplemente una etiqueta binaria de:

> Aprendido / no aprendido.

En su lugar, mantiene una estimación continua, entre 0 y 1, de la probabilidad de recuperar cada habilidad.

---

## 3. El conocimiento se representa como un grafo

El temario se modela como un **grafo dirigido acíclico**:

$$
G=(V,E)
$$

En este grafo:

- cada nodo representa una habilidad;
- cada arista representa una relación de prerrequisito;
- una flecha $$A\rightarrow B$$ significa que $$A$$ es prerrequisito de $$B$$.

Por ejemplo:

$$
\text{MRU}\rightarrow\text{MUA}\rightarrow\text{caída libre}
$$

El dominio completo considerado en el documento contiene:

- 15 unidades;
- 168 subtemas;
- 279 dependencias entre subtemas;
- 21 niveles de profundidad.

Sin embargo, el prototipo utiliza solamente:

- 13 subtemas de cinemática;
- 33 plantillas de problemas.

El nivel de subtema es importante porque una unidad completa, como “aplicaciones de las leyes de Newton”, es demasiado amplia para representarse mediante una sola memoria.

La unidad básica del modelo no es necesariamente un concepto abstracto, sino una **habilidad procedimental identificable**, por ejemplo:

- convertir unidades;
- descomponer vectores;
- usar la ecuación de posición;
- calcular el tiempo de vuelo;
- calcular el alcance horizontal.

---

## 4. Arquitectura general del sistema

El documento separa cinco clases de información.

### 4.1. Dominio $$D$$

Contiene:

- el grafo de habilidades;
- los pesos que relacionan los problemas con las habilidades;
- el banco de plantillas de problemas.

### 4.2. Parámetros del modelo $$\theta$$

Describen cómo se supone que aprenden y olvidan los estudiantes:

- estabilidad inicial;
- ganancia tras un acierto;
- penalización tras un fallo;
- probabilidad de descuido;
- probabilidad de adivinanza.

### 4.3. Parámetros pedagógicos $$\phi$$

Representan decisiones tomadas por el diseñador del sistema:

- retención objetivo;
- número de actividades por sesión;
- nivel de consolidación necesario para un prerrequisito;
- cantidad máxima de temas nuevos;
- fracción de la sesión reservada al mantenimiento.

### 4.4. Estado del estudiante $$\sigma$$

Contiene lo que el sistema cree actualmente sobre el estudiante:

- qué habilidades han sido introducidas;
- cuál es la estabilidad de cada habilidad;
- cuándo ocurrió su último repaso efectivo;
- qué habilidades ya fueron actualizadas durante la sesión.

### 4.5. Historial $$H$$

Es la bitácora de lo que realmente ocurrió:

- introducciones de habilidades;
- problemas presentados;
- respuestas del estudiante;
- cambios de parámetros;
- modificaciones del dominio.

La decisión arquitectónica más importante es:

> El historial es la fuente de verdad; el estado del estudiante es una reconstrucción derivada del historial.

Esto permite recalibrar posteriormente el modelo y reconstruir lo que el sistema habría creído utilizando parámetros diferentes.

También hace que sus decisiones sean auditables.

---

## 5. ¿Cómo sabe cuánto ejercita un problema cada habilidad?

El sistema utiliza una **matriz Q fraccional**.

Para un problema principal $$j$$, el peso de una habilidad $$k$$ se define como:

$$
w_{jk}=
\begin{cases}
1, & k=j,\\
w_{\text{pre}}, & k\in\operatorname{Pre}(j),\\
0, & \text{en otro caso}.
\end{cases}
$$

La habilidad principal recibe un peso de:

$$
w_{jk}=1
$$

Los prerrequisitos reciben un peso menor, por ejemplo:

$$
w_{\text{pre}}=0.5
$$

De esta manera, un problema de caída libre podría ejercitar:

- caída libre, con peso $$1$$;
- movimiento uniformemente acelerado, con peso $$0.5$$.

La intuición es que utilizar una habilidad como herramienta también ayuda a repasarla, pero no con la misma intensidad que practicarla como objetivo principal.

El valor $$0.5$$ es, por ahora, un supuesto que tendría que validarse o estimarse utilizando datos reales.

---

## 6. El modelo de olvido

La ecuación básica del recuerdo es:

$$
\hat R_k(t)=e^{-(t-\hat L_k)/\hat S_k}
$$

Esta ecuación representa la probabilidad estimada de recuperar la habilidad $$k$$ en el momento $$t$$.

La estabilidad $$\hat S_k$$ tiene una interpretación concreta:

- después de $$0.105\hat S_k$$ días, el recuerdo cae aproximadamente al 90%;
- después de $$0.693\hat S_k$$ días, cae aproximadamente al 50%;
- después de $$\hat S_k$$ días, cae a $$e^{-1}\approx37\%$$.

Si el objetivo es repasar cuando el recuerdo llegue a un nivel $$r^*$$, el intervalo correspondiente es:

$$
I_k=\hat S_k\ln\left(\frac{1}{r^*}\right)
$$

Supongamos que:

$$
\hat S_k=8.2
$$

y que la retención objetivo es:

$$
r^*=0.7
$$

Entonces:

$$
I_k=8.2\ln\left(\frac{1}{0.7}\right)\approx2.9\text{ días}
$$

Esto significa que una habilidad recién introducida debería repasarse aproximadamente tres días después si se desea conservar una retención estimada del 70%.

---

## 7. ¿Cómo predice si el estudiante resolverá un problema?

Un problema puede exigir varias habilidades.

El modelo supone que todas deben recuperarse correctamente para poder resolverlo.

Primero calcula:

$$
\hat\Pi_j(t)=
\prod_{k\in Q(j)}
\hat R_k(t)^{w_{jk}}
$$

Esta cantidad representa la probabilidad estimada de recuperar conjuntamente todos los componentes necesarios para resolver el problema.

Después incorpora dos fuentes de ruido:

- $s$: probabilidad de descuido;
- $g$: probabilidad de adivinanza o acierto accidental.

La probabilidad final de responder correctamente es:

$$
\hat P_j(t)
=
(1-s)\hat\Pi_j(t)
+
g\left(1-\hat\Pi_j(t)\right)
$$

Con valores como:

$$
s=0.05
$$

y:

$$
g=0.02
$$

el modelo nunca predice probabilidades menores que 2% ni mayores que 95%.

De esta manera evita afirmar que un resultado es completamente seguro o imposible.

### Ejemplo

Supongamos que un problema de caída libre requiere:

- caída libre, con $$R=0.64$$ y peso $$1$$;
- movimiento acelerado, con $$R=0.79$$ y peso $$0.5$$.

Entonces:

$$
\Pi
=
0.64^1(0.79)^{0.5}
\approx0.57
$$

Antes de considerar los descuidos y los aciertos accidentales, el estudiante tendría aproximadamente 57% de probabilidad de recuperar todos los componentes necesarios.

---

## 8. ¿Qué ocurre después de un acierto?

Si el estudiante responde correctamente, la estabilidad se actualiza de acuerdo con:

$$
\hat S_k
\leftarrow
\hat S_k
\left[
1+w_{jk}G(1-\hat R_k)
\right]
$$

Esta ecuación captura el llamado **efecto del esfuerzo de recuperación**.

Esto significa que:

- si $$\hat R_k\approx1$$, la habilidad estaba fresca y la ganancia es pequeña;
- si $$\hat R_k$$ era bajo y el estudiante acertó, la ganancia es grande;
- si la habilidad solamente era un prerrequisito, la ganancia se reduce mediante $$w_{jk}$$.

Esto evita que la práctica masiva inmediatamente después de aprender produzca un crecimiento artificial de la estabilidad.

Practicar algo que todavía se recuerda perfectamente aporta poco a la memoria de largo plazo.

Con los parámetros ilustrativos:

$$
G=7.2
$$

y:

$$
r^*=0.7
$$

si siempre se repasa justo cuando el recuerdo llega a 70%, la estabilidad se multiplica aproximadamente por:

$$
1+7.2(1-0.7)=3.16
$$

Por tanto, los intervalos crecerían aproximadamente de la siguiente manera:

- 2.9 días;
- 9.2 días;
- 29.2 días;
- 92.3 días;
- 291.6 días.

Esta progresión representa la esencia de la repetición espaciada: cada recuperación exitosa permite posponer más el siguiente repaso.

---

## 9. El salto del recuerdo

Después de intentar un problema, el estudiante puede ver la solución.

Por eso el recuerdo inmediato aumenta incluso cuando la respuesta fue incorrecta:

$$
\hat R_k^+
=
\hat R_k+w_{jk}(1-\hat R_k)
$$

Para el tema principal:

$$
w_{jk}=1
$$

Por tanto:

$$
\hat R_k^+=1
$$

El tema principal vuelve momentáneamente a un nivel de recuerdo completo.

Para un prerrequisito con peso $$w_{jk}=0.5$$, el recuerdo recorre la mitad del camino que le faltaba para llegar a 1.

Por ejemplo, si:

$$
\hat R_k=0.6
$$

y:

$$
w_{jk}=0.5
$$

entonces:

$$
\hat R_k^+
=
0.6+0.5(1-0.6)
=
0.8
$$

Esta distinción permite separar dos variables:

- **recuerdo inmediato**, que aumenta por haber visto la solución;
- **estabilidad de largo plazo**, que puede aumentar tras un acierto o disminuir tras un fallo.

---

## 10. ¿Cómo asigna la responsabilidad después de un fallo?

Ésta es una de las contribuciones más interesantes del modelo.

Cuando un problema involucra varias habilidades y el estudiante falla, el sistema no castiga todas las habilidades por igual.

En su lugar, calcula la probabilidad de que cada componente no haya sido recuperado, dado el fallo observado:

$$
b_k=P(o_k=0\mid y=0)
$$

La expresión completa es:

$$
b_k=
\frac{
\left(1-\hat R_k^{w_{jk}}\right)(1-g)
}{
\hat\Pi_j s+
\left(1-\hat\Pi_j\right)(1-g)
}
$$

La interpretación es la siguiente:

- una habilidad con recuerdo bajo recibe más responsabilidad;
- una habilidad con recuerdo alto recibe menos responsabilidad;
- si todas las habilidades parecían muy sólidas, el fallo puede atribuirse más al descuido;
- varias habilidades pueden recibir responsabilidad simultáneamente.

Los valores de $$b_k$$ no tienen que sumar 1 porque no representan causas mutuamente excluyentes.

Es posible que dos o más componentes hayan fallado al mismo tiempo.

Después, la estabilidad se reduce mediante:

$$
\hat S_k
\leftarrow
\max\left[
S_{\min},
\hat S_k(1-\lambda b_k)
\right]
$$

Aquí:

- $b_k$ representa la responsabilidad probabilística atribuida a la habilidad;
- $\lambda$ controla la severidad de la penalización;
- $_{\min}$ impide que la estabilidad caiga por debajo de un valor mínimo.

Si una habilidad recibe responsabilidad total, pierde una fracción $$\lambda$$ de su estabilidad.

Si recibe responsabilidad parcial, la reducción es proporcionalmente menor.

### ¿Qué significa realmente esta responsabilidad?

El modelo no identifica con certeza la causa cognitiva del error.

Se trata de una **atribución probabilística basada en el estado previo del modelo**.

Por ejemplo, si la habilidad de caída libre estaba muy débil y la de movimiento acelerado parecía relativamente estable, un fallo en un problema de caída libre se atribuiría principalmente a la primera.

Esto es razonable, pero no demuestra que ésa haya sido la causa real.

---

## 11. Una sola actualización de estabilidad por habilidad al día

El sistema permite que una habilidad modifique su estabilidad solamente una vez por sesión.

La justificación es que, después del primer intento y de ver la solución:

- el recuerdo inmediato queda cerca de 1;
- los siguientes aciertos del día miden práctica inmediata, no retención;
- los siguientes fallos pueden reflejar atención, fatiga o errores momentáneos.

Por tanto, repetir diez veces una misma habilidad durante una sesión no hace que su estabilidad se multiplique diez veces.

Esta regla protege al modelo contra:

- la práctica masiva;
- la sobreestimación del aprendizaje;
- la evidencia excesivamente correlacionada dentro de una sesión.

---

## 12. Control de la carga de mantenimiento

Cada habilidad introducida genera una obligación futura: habrá que repasarla cuando su recuerdo disminuya.

La carga diaria aproximada se calcula mediante:

$$
L=
\sum_{k:\iota_k=1}
\min\left(
1,
\frac{f}{
\hat S_k\ln(1/r^*)
}
\right)
$$

Como el intervalo esperado de una habilidad es:

$$
I_k=\hat S_k\ln\left(\frac{1}{r^*}\right)
$$

su demanda media es aproximadamente:

$$
\frac{1}{I_k}
$$

repasos diarios.

Esto permite evitar un problema frecuente en los sistemas de repetición espaciada:

> Introducir demasiados temas al principio y quedar posteriormente atrapado en una acumulación de repasos vencidos.

Las habilidades maduras tienen una estabilidad mayor y consumen cada vez menos espacio en las sesiones.

De esta manera, el sistema libera gradualmente capacidad para introducir contenido nuevo.

---

## 13. ¿Cuándo puede introducirse una habilidad nueva?

Una habilidad nueva puede admitirse solamente si se cumplen dos condiciones.

### 13.1. Condición académica

Todos sus prerrequisitos deben estar:

- introducidos;
- suficientemente estables;
- actualmente por encima de la retención objetivo.

Formalmente, todos los prerrequisitos $$p$$ deben cumplir:

$$
\hat S_p\ge S_{\text{listo}}
$$

y:

$$
\hat R_p(t)\ge r^*
$$

Esto evita que el sistema avance apoyándose en conocimientos recién vistos, pero todavía frágiles.

### 13.2. Condición de capacidad

La carga actual, sumada a la carga de los temas nuevos, no puede superar cierta fracción del presupuesto diario:

$$
L+m+1\le\rho U
$$

Aquí:

- $L$ es la carga de mantenimiento actual;
- $m$ representa la carga asociada con otros temas nuevos;
- $U$ es el presupuesto de actividades;
- $\rho$ es la fracción máxima del presupuesto que puede comprometerse.

Por tanto, el sistema realiza simultáneamente dos preguntas:

> ¿El estudiante está preparado académicamente?

y

> ¿Tenemos capacidad futura para mantener este nuevo aprendizaje?

Ésta es una diferencia importante respecto de muchos programas de repetición espaciada, donde la introducción de contenido nuevo no considera explícitamente la deuda futura de repaso.

---

## 14. ¿Cómo elige los problemas de la sesión?

El sistema identifica primero las habilidades vencidas:

$$
D=
\left\{
k:\hat R_k(t)<r^*
\right\}
$$

Después les asigna una prioridad:

$$
\pi_k=1-\hat R_k(t)
$$

Cuanto menor sea el recuerdo, mayor será la prioridad.

A continuación, el sistema valora un conjunto de problemas $$A$$ mediante:

$$
V(A)=
\sum_{k\in D}
\pi_k
\left[
1-
\prod_{j\in A}
(1-w_{jk})
\right]
$$

Esta función mide cuánta “masa de olvido” queda cubierta por los problemas elegidos.

Un problema integrador puede ser preferible porque:

- practica su tema principal;
- repasa uno o varios prerrequisitos;
- ocupa un solo lugar dentro de la sesión.

La función es **submodular**, lo que significa que tiene rendimientos decrecientes.

Después de cubrir ampliamente una habilidad, agregar otro problema que cubra exactamente lo mismo aporta menos valor.

Por esa razón puede utilizarse un algoritmo voraz:

1. empezar con una sesión vacía;
2. calcular qué problema produce la mayor ganancia marginal;
3. agregar ese problema;
4. recalcular las ganancias;
5. repetir el proceso hasta completar el presupuesto.

Para el objetivo matemático $$V$$, este procedimiento garantiza al menos:

$$
1-\frac{1}{e}\approx0.63
$$

del valor del conjunto óptimo, bajo un límite de tamaño.

No obstante, esta garantía se refiere a la función matemática de cobertura, no al aprendizaje real del estudiante.

---

## 15. Orden de una sesión

El algoritmo diario sigue tres fases.

### Fase 1. Repasar habilidades vencidas

Se eligen problemas que cubran de la forma más eficiente posible las habilidades cuyo recuerdo está por debajo del objetivo.

### Fase 2. Introducir habilidades nuevas

Se introducen nuevas habilidades si:

- sus prerrequisitos están consolidados;
- existe suficiente capacidad futura para mantenerlas.

### Fase 3. Realizar repasos adelantados

Si todavía quedan espacios disponibles, se utilizan para repasar habilidades que aún no están vencidas, pero cuyo recuerdo es relativamente bajo.

Así, el sistema intenta equilibrar:

- recordar;
- avanzar;
- aprovechar los espacios disponibles.

---

## 16. ¿Cómo se estiman los parámetros?

Los parámetros centrales son:

$$
\varphi=
\left(
\hat S_0,
G,
\lambda
\right)
$$

donde:

- $\hat S_0$ es la estabilidad inicial;
- $G$ es la ganancia tras un acierto;
- $\lambda$ es la severidad de la penalización tras un fallo.

Estos parámetros se estiman minimizando la log-verosimilitud negativa:

$$
\operatorname{NLL}(\varphi)
=
-\sum_{i,n}
\left[
y_{in}\ln\hat P_{in}(\varphi)
+
(1-y_{in})
\ln\left(
1-\hat P_{in}(\varphi)
\right)
\right]
$$

Esto busca los parámetros que hubieran asignado la mayor probabilidad posible a las respuestas realmente observadas.

Cada parámetro requiere patrones de datos distintos:

- $\hat S_0$ se identifica observando el primer repaso después de diferentes intervalos;
- $G$ se identifica observando cómo cambia el rendimiento después de aciertos espaciados;
- $\lambda$ se identifica observando el rendimiento posterior a los fallos.

Por eso un piloto real no debería utilizar desde el principio una política completamente uniforme.

Necesita variación deliberada en los intervalos para distinguir los efectos de cada parámetro.

---

## 17. Ejemplo completo del funcionamiento

El documento utiliza la siguiente secuencia de prerrequisitos:

$$
\text{MRU}
\rightarrow
\text{MUA}
\rightarrow
\text{caída libre}
$$

El funcionamiento sería aproximadamente el siguiente:

1. Se introduce MRU porque no tiene prerrequisitos.
2. MUA todavía no puede introducirse porque MRU no tiene suficiente estabilidad.
3. Después de un acierto espaciado, la estabilidad de MRU aumenta.
4. MUA se vuelve admisible.
5. Practicar MUA también fortalece parcialmente MRU.
6. Más adelante se introduce caída libre.
7. Si el estudiante falla en caída libre, el sistema calcula qué parte de la responsabilidad corresponde a caída libre y cuál corresponde a MUA.
8. El sistema reduce principalmente la estabilidad de la habilidad más sospechosa.
9. Como el estudiante ve la solución, el recuerdo inmediato vuelve a aumentar.
10. Debido a la reducción de estabilidad, la habilidad volverá a vencer relativamente pronto.

Esto produce un comportamiento pedagógicamente razonable:

> Acabas de verlo, así que probablemente puedes hacerlo ahora. Sin embargo, como fallaste, necesito comprobarlo nuevamente dentro de poco tiempo.

---

## 18. ¿Qué muestran las simulaciones?

Según el documento, la evaluación utilizó:

- un grafo de 168 subtemas;
- 300 estudiantes simulados por política;
- un estudiante simulado cuya memoria verdadera seguía supuestos distintos de los utilizados por el modelo;
- como métrica, la probabilidad de resolver un problema nuevo 30 días después del curso.

Los resultados reportados indican que:

- el sistema supera a Anki SM-2 en la métrica global por aproximadamente $$+0.090$$ o $$+0.047$$, dependiendo del supuesto sobre las bases débiles;
- el sistema introduce más temas, aproximadamente 106 frente a 71;
- Anki deja menos temas vistos, pero más temas individualmente dominados;
- la práctica espaciada supera en aproximadamente $$+0.20$$ a la enseñanza bloqueada;
- si el grafo contiene dependencias falsas, la ventaja desaparece o puede invertirse.

La interpretación correcta no es simplemente:

> El sistema es mejor que Anki.

Una interpretación más precisa sería la siguiente:

- el sistema parece optimizar mejor el equilibrio entre cobertura y retención bajo las condiciones de la simulación;
- Anki puede producir un mayor dominio en un conjunto más pequeño de temas;
- la ventaja depende fuertemente de que el grafo de prerrequisitos sea correcto.

---

## 19. Aportaciones principales

### 19.1. Extender la repetición espaciada a procedimientos

El sistema no trata cada ejercicio como una tarjeta independiente.

Reconoce que un problema puede requerir varias habilidades relacionadas.

### 19.2. Separar recuerdo y estabilidad

Después de un fallo, el recuerdo inmediato puede aumentar porque se mostró la solución, mientras que la estabilidad disminuye porque el desempeño reveló fragilidad.

### 19.3. Asignar probabilísticamente la responsabilidad

Un fallo en un problema compuesto se reparte probabilísticamente entre sus componentes, en lugar de penalizar todas las habilidades por igual.

### 19.4. Controlar explícitamente la deuda futura

Antes de introducir un tema, el sistema estima si podrá mantenerlo sin saturar las sesiones futuras.

### 19.5. Seleccionar problemas integradores

La cobertura submodular permite elegir ejercicios que repasan varias habilidades vencidas simultáneamente.

### 19.6. Mantener una arquitectura auditable

Al conservar un historial inmutable, el estado puede reconstruirse y los parámetros pueden recalibrarse sin perder los datos originales.

---

## 20. Limitaciones importantes

### 20.1. Los parámetros proceden de simulaciones

Los valores de estabilidad, ganancia y severidad del fallo todavía no proceden de estudiantes reales.

Por eso, los intervalos resultantes pueden ser demasiado optimistas.

### 20.2. El grafo no ha sido validado completamente

Las dependencias fueron anotadas manualmente y requieren validación docente.

Además, existen discrepancias entre la figura del grafo y la lista formal de aristas.

### 20.3. Supuesto de independencia entre habilidades

El producto de probabilidades supone que recuperar una habilidad es independiente de recuperar otra.

En la práctica pueden existir factores comunes, como:

- fatiga;
- comprensión del lenguaje;
- atención;
- motivación;
- dificultad algebraica.

### 20.4. Un mismo peso para todos los prerrequisitos

Utilizar:

$$
w_{\text{pre}}=0.5
$$

para todos los casos es una simplificación fuerte.

Algunos problemas utilizan intensamente un prerrequisito, mientras que otros apenas lo requieren.

### 20.5. Una estabilidad inicial común

Dos habilidades pueden tener niveles de dificultad y tasas de olvido muy diferentes.

También es posible que distintos estudiantes comiencen con diferentes niveles de estabilidad.

### 20.6. Sólo observa respuestas correctas o incorrectas

El sistema todavía no utiliza información como:

- pasos intermedios;
- tipos específicos de errores algebraicos;
- tiempo de respuesta;
- solicitudes de pistas;
- confianza declarada;
- concepciones erróneas.

### 20.7. La asignación de responsabilidad depende de la calibración

Si una habilidad parece fuerte solamente porque el modelo la sobreestima, puede recibir poca responsabilidad aunque haya sido la verdadera causa del fallo.

### 20.8. La garantía matemática no es una garantía educativa

La garantía aproximada del 63% se refiere a la optimización de la función de cobertura creada por el modelo.

No significa que el aprendizaje humano alcanzará al menos el 63% del máximo posible.

### 20.9. Falta validación en el aula

El documento propone realizar un estudio real con:

- diseño intra-sujeto;
- condiciones contrabalanceadas;
- prueba diferida a 30 días.

Hasta que se realice una evaluación de este tipo, no puede asegurarse que las ventajas observadas en las simulaciones se reproduzcan con estudiantes reales.

---

## 21. Lectura crítica

Conceptualmente, el documento presenta una estructura sólida.

Su principal virtud es que cada componente responde a un problema específico:

- el grafo controla la secuencia de aprendizaje;
- la curva de olvido controla el momento del repaso;
- la matriz Q representa problemas que requieren varias habilidades;
- la inferencia bayesiana maneja la ambigüedad de los fallos;
- el control de carga evita la saturación;
- la cobertura submodular aprovecha los ejercicios integradores;
- el historial permite auditoría y recalibración.

El punto más vulnerable no parece ser una ecuación particular, sino la **calidad de la representación del dominio**.

Si las habilidades están mal divididas o las relaciones de prerrequisito son falsas, las inferencias posteriores también se deterioran.

El propio experimento donde la ventaja desaparece con cadenas de prerrequisitos incorrectas respalda esta preocupación.

También conviene distinguir tres afirmaciones de diferente fuerza:

1. **La arquitectura es coherente:** sí, sus componentes encajan matemáticamente.
2. **La simulación ofrece evidencia de viabilidad:** sí, dentro de sus supuestos.
3. **El sistema mejora el aprendizaje real:** todavía no está demostrado.

---

## 22. Resumen en una frase

> El documento diseña un tutor de repetición espaciada que modela cada procedimiento como una memoria individual dentro de un grafo de prerrequisitos, interpreta probabilísticamente los aciertos y fallos en problemas que requieren varias habilidades y selecciona los ejercicios diarios para equilibrar retención, avance y carga futura.

En términos todavía más sencillos:

> El sistema intenta decidir qué problema debe resolver hoy cada estudiante para reforzar el mayor número posible de habilidades, sin avanzar demasiado pronto ni generar una cantidad inmanejable de repasos futuros.