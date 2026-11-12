const xlsx = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function actualizarDatos() {
  console.log("⏳ Leyendo el nuevo Excel...");
  const workbook = xlsx.readFile('public/data/NOMBRE_DE_TU_NUEVO_EXCEL.xlsx'); 
  // ⚠️ CAMBIA 'NOMBRE_DE_TU_NUEVO_EXCEL.xlsx' por el nombre real de tu archivo nuevo

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Iniciar transacción segura

    // --- 1. ACTUALIZAR TITULADOS ---
    console.log("🔄 Actualizando Titulados...");
    const sheetTit = workbook.Sheets['Titulados'];
    const dataTit = xlsx.utils.sheet_to_json(sheetTit);

    for (const fila of dataTit) {
      // El ID del Excel es la llave única
      const idOriginal = String(fila.id); 
      
      // Limpiamos el objeto (quitamos el id del Excel para mapearlo a nuestro esquema)
      const { id, ...datos } = fila;

      // Aquí hacemos el UPSERT (Insertar o Actualizar)
      // Nota: Asumo que tu tabla se llama 'titulados' y tiene una columna 'id_excel' o similar.
      // Si usas un UUID generado por Postgres, debes buscar por otro campo (como el email).
      
      // Ejemplo de consulta SQL (debes adaptarla a las columnas exactas de tu tabla en db/schema.sql):
      const query = `
        INSERT INTO titulados (
          id_excel, edad, genero, formacion_complementaria, nivel_realizado, 
          lugar_realizado, financiamiento, programa, interes_posgrado, area_interes
          -- ... agrega el resto de columnas de tu tabla
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id_excel) DO UPDATE SET
          edad = EXCLUDED.edad,
          genero = EXCLUDED.genero,
          area_interes = EXCLUDED.area_interes
          -- ... actualiza el resto de columnas
      `;

      const values = [
        idOriginal, datos.edad, datos.genero, datos.formacion_complementaria, 
        datos.nivel_realizado, datos.lugar_realizado, datos.financiamiento, 
        datos.programa, datos.interes_posgrado, datos.area_interes
        // ... agrega el resto de valores
      ];

      await client.query(query, values);
    }

    console.log("✅ Titulados actualizados sin duplicar.");

    // --- 2. ACTUALIZAR EMPLEADORES ---
    console.log("🔄 Actualizando Empleadores...");
    // ... (repetir el mismo proceso para la hoja 'Empleadores')

    await client.query('COMMIT'); // Guardar cambios
    console.log("🎉 ¡Base de datos actualizada con éxito!");

  } catch (error) {
    await client.query('ROLLBACK'); // Si algo falla, no se guarda nada
    console.error("❌ Error, se canceló la actualización:", error);
  } finally {
    client.release();
    pool.end();
  }
}

actualizarDatos();