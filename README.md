# Mi Despensa v3 - consumo automatico de calorias

PWA para controlar el stock de nevera/armario y registrar nutricion al consumir alimentos.

## Cambio principal de esta version

La aplicacion diferencia expresamente entre **Consumir** y **Eliminar / descartar**:

- **Consumir**: resta unidades del inventario y registra kcal, proteinas, hidratos y grasas en el dia actual.
- **Eliminar / producto malo o caducado**: resta unidades del inventario, registra el movimiento como `Descarte` y **no suma calorias**.
- **Eliminar ficha del producto**: borra el producto del inventario y tampoco registra calorias.

## Como se calculan las calorias

Cada producto puede guardar:

- kcal por 100 g/ml
- proteinas por 100 g/ml
- hidratos por 100 g/ml
- grasas por 100 g/ml
- contenido de una unidad (por ejemplo, `125 g` para un yogur)

Al pulsar **Consumir**, la app abre una confirmacion donde puedes indicar:

1. cuantas unidades salen del stock;
2. en que comida lo has consumido (Desayuno, Comida, Cena o Snacks);
3. cuantos gramos/ml has consumido realmente.

Si se conoce el contenido de una unidad, la cantidad se precarga automaticamente. Ejemplo: 2 yogures de 125 g -> 250 g.

La formula utilizada es:

`nutriente consumido = valor por 100 x cantidad consumida / 100`

## Nutricion diaria

En la seccion **Comidas** aparece ahora un bloque **Consumido hoy** con:

- kcal acumuladas
- proteina
- hidratos
- grasas
- lista de alimentos retirados y consumidos durante el dia

Los platos creados manualmente siguen funcionando de forma independiente.

## Escaneo

Al escanear un producto se consulta Open Food Facts. Cuando la informacion existe, la app intenta rellenar:

- nombre y marca
- imagen
- valores nutricionales
- peso/volumen del envase para usarlo como contenido por unidad

Si algun dato falta, puede editarse manualmente.

## Actualizar en GitHub Pages

1. Sustituye los archivos de tu repositorio por los de este ZIP.
2. Haz commit/push a `main`.
3. GitHub Pages publicara la nueva version.
4. Si el iPhone mantiene una version antigua, cierra la PWA y vuelve a abrirla. El Service Worker usa ahora una cache nueva.

Los datos existentes siguen usando las mismas claves de inventario y comidas. Los productos ya guardados se conservan; solo tendran vacio el nuevo campo `contenido por unidad` hasta que lo edites.

## Copia de seguridad

La exportacion JSON incluye ahora inventario, historial, platos y consumos nutricionales.


## Cambio v4 - stock real por gramos y mililitros
- Los productos con contenido conocido ya no se vacían al consumir una parte del envase.
- Cada producto almacena `stockAmount`, que representa la cantidad física disponible.
- Ejemplo: caldo de 1 L -> 1000 ml. Consumir 250 ml deja 750 ml.
- Ejemplo: pepinillos de 350 g. Consumir 80 g deja 270 g.
- Añadir un envase suma automáticamente su contenido completo al stock real.
- El descarte resta g/ml del stock pero nunca añade calorías.
- Los productos antiguos se migran automáticamente usando `cantidad de envases x contenido por envase`, cuando ese dato existe.
- Open Food Facts se consulta también para intentar obtener la cantidad neta del envase (`product_quantity`, unidad y `quantity`).

## Cambio v5 - escaneo mediante fotografía
- El botón de escaneo abre la cámara del dispositivo para sacar una fotografía del código de barras.
- La imagen se procesa automáticamente en el propio navegador; no se usa vídeo en directo.
- La app intenta decodificar la foto original y variantes de contraste/umbral para mejorar la lectura.
- Solo se aceptan EAN-13, EAN-8 o UPC-A cuyo dígito de control sea válido.
- Si la lectura es válida, el código se usa automáticamente para buscar el producto.
- Si la lectura falla o el checksum no es correcto, se pide repetir la foto y no se consulta ningún código dudoso.
- La introducción manual queda únicamente como método de respaldo.


## v7 - captura y lectura reforzada para iPhone
- El botón de escaneo abre el selector de cámara dentro del mismo gesto del usuario, evitando bloqueos de Safari.
- `capture="environment"` solicita la cámara trasera en iPhone/iPad.
- La foto se analiza automáticamente después de capturarla.
- Se prueban múltiples recortes, escalados, contrastes, umbrales y rotaciones.
- Se combinan BarcodeDetector cuando está disponible, ZXing y html5-qrcode.
- Como último respaldo, OCR lee los dígitos impresos debajo de las barras.
- Ningún resultado se acepta si no supera el checksum EAN-13, EAN-8 o UPC-A.
