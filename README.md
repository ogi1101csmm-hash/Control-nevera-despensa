# Mi Despensa v2

PWA para controlar nevera/armario y calcular las calorías de las comidas.

## Inventario
- Escaneo de EAN/UPC con cámara.
- Nombre, marca, imagen y nutrición desde Open Food Facts cuando están disponibles.
- Nevera / Armario.
- Entradas y consumos de varias unidades.
- Stock mínimo, caducidad, buscador e historial.

## Comidas
1. Abre **Comidas > Crear nueva comida**.
2. Pon un nombre al plato.
3. Añade productos del inventario.
4. Indica la cantidad realmente usada en gramos o mililitros.
5. La app calcula automáticamente:
   - kcal totales
   - proteínas
   - hidratos
   - grasas
   - kcal aportadas por cada ingrediente
6. Guarda el plato para consultarlo después.

Si un producto no tiene información nutricional, edita su ficha y rellena sus valores por 100 g/ml.

## GitHub Pages
1. Crea un repositorio.
2. Sube todos estos archivos a la raíz.
3. `Settings > Pages > Deploy from a branch`.
4. Rama `main`, carpeta `/(root)`.
5. Abre la URL con Safari y usa `Compartir > Añadir a pantalla de inicio`.

## Actualizar desde una versión anterior
Puedes sustituir los archivos del repositorio por los de este ZIP. El inventario ya guardado utiliza las mismas claves de almacenamiento, por lo que seguirá apareciendo en el mismo iPhone/navegador. Los productos antiguos simplemente tendrán vacíos los nuevos campos nutricionales hasta que los edites o vuelvas a consultar sus datos.

## Nota sobre nutrición
Las kcal y macronutrientes dependen de la información almacenada para cada producto. Los datos de bases colaborativas o etiquetas pueden contener errores o faltar; revísalos si necesitas precisión.

## Copias
La exportación JSON incluye inventario, historial y comidas.
