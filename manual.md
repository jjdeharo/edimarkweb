# Manual de EdiMarkWeb
![EdiMarkWev](logo_100px.png)

Este editor te permite escribir en **Markdown** y ver el resultado **HTML** en tiempo real, con soporte completo para fórmulas **LaTeX** y gestión de múltiples documentos en pestañas.

## Índice

* [Gestión de documentos (pestañas)](#gestión-de-documentos-pestañas).
* [Interfaz principal](#interfaz-principal).
* [Barra de herramientas](#barra-de-herramientas).
* [Previsualización interactiva](#previsualización-interactiva).
* [Acciones principales](#acciones-principales).
* [Atajos de teclado](#atajos-de-teclado).
* [Ejemplos de fórmulas con LaTeX](#ejemplos-de-fórmulas-con-latex).

---

## Gestión de documentos (pestañas)

La aplicación te permite trabajar con varios documentos a la vez utilizando un sistema de pestañas.

* **Crear pestañas**. Pulsa el botón `+` a la derecha de la barra de pestañas o usa el atajo `Ctrl+T` para crear un nuevo documento.
* **Cambiar de pestaña**. Haz clic en cualquier pestaña para ver su contenido. También puedes usar `Ctrl+Tab` para ciclar entre ellas (`Ctrl+Shift+Tab` para ir en sentido inverso).
* **Renombrar pestañas**. Haz doble clic sobre el nombre de una pestaña para editarlo. El nuevo nombre se usará como sugerencia al guardar el archivo.
* **Cerrar pestañas**. Pulsa la `X` que aparece en cada pestaña o usa el atajo `Ctrl+W`. Si hay cambios sin guardar, la aplicación te pedirá confirmación.
* **Cambios sin guardar**. Un punto rojo (`●`) junto al nombre del documento indica que hay cambios pendientes de guardar. El punto desaparece cuando guardas el archivo.
* **Autoguardado**. Cada pestaña guarda su contenido automáticamente en la memoria del navegador para evitar pérdidas accidentales.

---

## Interfaz principal

* **Paneles de edición**. La vista principal se divide en un panel de escritura (Markdown) a la izquierda y uno de previsualización (HTML) a la derecha.
* **Cambiar de diseño**. Puedes alternar entre tres vistas con el botón de diseño (`layout`) en la cabecera o con el atajo `Ctrl+L`.
    * **Vista dual**. Muestra ambos paneles.
    * **Vista de editor**. Muestra solo el panel de Markdown.
    * **Vista de previsualización**. Muestra solo el panel de previsualización.
* **Ajustar tamaño del texto**. Usa el selector desplegable en la cabecera o los atajos `Ctrl` + `+` y `Ctrl` + `-` para cambiar el tamaño de la letra en ambos paneles.

---

## Barra de herramientas

Usa los botones de la barra superior para aplicar formatos de manera rápida.

* **Estilos básicos**. Negrita, cursiva, títulos, citas y listas.
* **Insertar elementos**.
    * **Enlaces**. Al pulsar el botón se abrirá un diálogo. Si tenías texto seleccionado, se usará como texto del enlace.
    * **Imágenes, tablas y bloques de código**.
* **Fórmulas LaTeX**. Tienes botones para insertar fórmulas en línea (ej: `$E=mc^2$`) o en bloque.

---

## Previsualización interactiva

El panel de previsualización no es solo para ver, también puedes interactuar con él.

* **Editar texto**. Puedes hacer clic y editar directamente el contenido en el panel de previsualización. Los cambios se reflejarán en el panel de Markdown.
* **Abrir enlaces**. Mantén pulsada la tecla `Ctrl` (o `Cmd` en Mac) y haz clic en cualquier enlace para abrirlo en una nueva pestaña del navegador.

---

## Acciones principales

* **Abrir (`Ctrl+O`)**. Carga un archivo `.md` o `.html` desde tu ordenador en una nueva pestaña.
* **Guardar (`Ctrl+S`)**. Abre un diálogo para guardar el documento actual como un archivo `.md` o `.html`. El nombre de la pestaña se usará como sugerencia.
* **Borrar todo**. Limpia el contenido del editor de la pestaña activa y pide confirmación para eliminar también la copia de seguridad del navegador.
* **Imprimir (`Ctrl+P`)**. Imprime el contenido de la previsualización.
* **Cambiar tema**. Alterna entre el modo claro y oscuro.

---

## Atajos de teclado

| Acción | Atajo (Windows/Linux) | Atajo (macOS) |
| :--- | :--- | :--- |
| **Formato** | | |
| Negrita | `Ctrl` + `B` | `Cmd` + `B` |
| Cursiva | `Ctrl` + `I` | `Cmd` + `I` |
| **Gestión de documentos** | | |
| Nueva pestaña | `Ctrl` + `T` | `Cmd` + `T` |
| Cerrar pestaña | `Ctrl` + `W` | `Cmd` + `W` |
| Cambiar de pestaña | `Ctrl` + `Tab` | `Cmd` + `Tab` |
| Guardar | `Ctrl` + `S` | `Cmd` + `S` |
| Imprimir | `Ctrl` + `P` | `Cmd` + `P` |
| Abrir manual | `Ctrl` + `H` | `Cmd` + `H` |
| **Interfaz** | | |
| Cambiar diseño | `Ctrl` + `L` | `Cmd` + `L` |
| Aumentar tamaño | `Ctrl` + `+` | `Cmd` + `+` |
| Reducir tamaño | `Ctrl` + `-` | `Cmd` + `-` |

---

## Ejemplos de fórmulas con LaTeX

### Fórmula de segundo grado

Para resolver una ecuación de segundo grado como $ax^2 + bx + c = 0$, se utiliza la siguiente fórmula:

$$
x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}
$$

### Matriz

Ejemplo de una matriz de 2x2:

$$
A = \begin{pmatrix}
a_{11} & a_{12} \\
a_{21} & a_{22}
\end{pmatrix}
$$
