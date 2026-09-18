const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = 3000;
// MIDDLEWARE

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const conexion = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'pifortress'
});

conexion.connect((error) => {
    if (error) {
        console.error(
            '❌ Error en la base de datos:',
            error.message
        );
        return;
    }
    console.log('✅ Conexión exitosa a HeidiSQL');
});

app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'index.html')
    );
});

app.post('/verificar', (req, res) => {
    const {
        Nombre_usuario,
        Correo_electronico,
        Clave
    } = req.body;
    const queryUsuario = `
        SELECT
            Id_usuario,
            Nombre_usuario,
            Cargo,
            Correo_electronico,
            Clave,
            Uid_tarjeta
        FROM usuarios
        WHERE Nombre_usuario = ?
          AND Correo_electronico = ?
          AND Clave = ?
    `;
    conexion.query(
        queryUsuario,
        [
            Nombre_usuario,
            Correo_electronico,
            Clave
        ],
        (err, usuarios) => {
            if (err) {
                console.error(
                    '❌ Error al consultar usuarios:',
                    err
                );
                return res.status(500).json({
                    valido: false,
                    error: 'Error del servidor'
                });
            }
            if (usuarios.length === 0) {
                return res.json({
                    valido: false,
                    mensaje:'Los datos ingresados no coinciden'
                });
            }
            const usuario = usuarios[0];
            const queryDispositivo = `
                SELECT
                    Uid_tarjeta,
                    Id_usuario,
                    Habilitado
                FROM dispositivos
                WHERE Uid_tarjeta = ?
                  AND Id_usuario = ?
            `;
            conexion.query(
                queryDispositivo,
                [
                    usuario.Uid_tarjeta,
                    usuario.Id_usuario
                ],
                (err, dispositivos) => {
                    if (err) {
                        console.error(
                            '❌ Error al consultar dispositivos:',
                            err
                        );
                        return res.status(500).json({
                            valido: false,
                            error: 'Error del servidor'
                        });
                    }
                    if (dispositivos.length === 0) {
                        return res.json({
                            valido: false,
                            mensaje:
                                'El dispositivo no está autorizado'
                        });
                    }
                    const dispositivo =
                        dispositivos[0];
                    if (
                        dispositivo.Habilitado !== 'True'
                    ) {
                        return res.json({
                            valido: false,
                            mensaje:'El dispositivo está deshabilitado'
                        });
                    }
                    return res.json({
                        valido: true,
                        usuario: {
                            Id_usuario: usuario.Id_usuario,
                            Nombre_usuario: usuario.Nombre_usuario,
                            Cargo: usuario.Cargo,
                            Correo_electronico: usuario.Correo_electronico
                        }
                    });
                }
            );
        }
    );
});

app.get('/registros', (req, res) => {

    const {
        dia,
        usuario,
        cambios
    } = req.query;

    let query = `
        SELECT
            u.Nombre_usuario AS Nombre,
            r.Fecha,
            r.Horario_apertura,
            r.Horario_cierre,
            r.Cambios,
            r.Uid_tarjeta
        FROM registro r
        LEFT JOIN usuarios u
            ON r.Uid_tarjeta = u.Uid_tarjeta
        WHERE 1 = 1
    `;

    const params = [];
    if (dia) {
        query += `
            AND r.Fecha = ?
        `;
        params.push(dia);

    }
    if (usuario) {
        query += `
            AND u.Nombre_usuario LIKE ?
        `;

        params.push(
            `%${usuario}%`
        );
    }
    if (cambios) {
        query += `
            AND r.Cambios LIKE ?
        `;
        params.push(
            `%${cambios}%`
        );
    }

    query += `
        ORDER BY
            r.Fecha DESC,
            r.Horario_apertura DESC
    `;

    conexion.query(
        query,
        params,
        (err, resultados) => {
            if (err) {
                console.error(
                    '❌ Error al obtener registros:',
                    err
                );

                return res.status(500).json({
                    error:
                        'Error en la base de datos'
                });
            }
            res.json(resultados);

        }
    );

});

app.listen(PORT, () => {
    console.log(
        `✅ Servidor corriendo en http://localhost:${PORT}`
    );
});

// Ejecutar "node index.js" para iniciar el  servidor. Ejecutar "http://localhost:3000" o Crtl + C dos veces para apagarlo.