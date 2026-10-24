# Vivero Emma

Panel de gestión para Vivero Emma, construido con Nuxt 4 y Nuxt UI 4.

## Desarrollo

Instala las dependencias y ejecuta el servidor local:

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:3000`.

## Secciones del panel

- Resumen de ventas e inventario
- Ventas, productos, clientes, compras, proveedores y precios por maceta
- Facturas/tickets internos, ubicaciones y zonas
- Categorías, vendedores, premios y embalaje
- Usuarios, accesos y configuración

El panel requiere iniciar sesión con el correo y la contraseña de una cuenta existente en `users` con rol `admin`, `encargado` o `vendedor`. La contraseña debe estar guardada como hash bcrypt (compatible con los formatos `$2a$`, `$2b$` y `$2y$`); el panel nunca almacena ni devuelve la contraseña. Los roles se comprueban en el servidor tanto al iniciar sesión como en cada API protegida. Configura `JWT_SECRET` con una clave aleatoria de al menos 32 caracteres para firmar sesiones. La sesión dura 8 horas y se conserva en una cookie firmada con `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` en producción. El servidor vuelve a consultar el usuario y su rol vigente al validar cada sesión.

La gestión de usuarios (incluidos cambios de rol y contraseña) y las operaciones administrativas sobre productos requieren rol `admin`. El resumen consolidado del dashboard también está restringido a `admin`; `encargado` y `vendedor` acceden a las demás rutas protegidas permitidas por el panel. Las acciones críticas registran quién actuó, la entidad, sus estados anterior/nuevo, la IP de la petición y la fecha en `audit_logs`.

En las ventas nuevas, el vendedor se establece en el servidor con el nombre de la cuenta autenticada. Se puede añadir un cliente desde el formulario de venta; el servidor busca primero un cliente activo con el mismo nombre y solo crea uno si no existe, todo dentro de la transacción de la venta.

El login permite hasta 5 intentos fallidos por correo durante 15 minutos; al alcanzar el límite bloquea nuevos intentos durante 15 minutos. Este control usa PostgreSQL y requiere aplicar `server/migrations/0002_auth_login_limits.sql` antes de desplegar la actualización.

El backend usa Drizzle ORM con PostgreSQL y la conexión `DATABASE_URL` (o `DIRECT_URL`). Las consultas de gestión se paginan en el servidor (20 registros por página, máximo 100) y permiten buscar y filtrar archivados. Productos, clientes, proveedores, usuarios, ubicaciones, zonas y listas de precios se archivan/restauran en lugar de borrarse físicamente; las ventas se cancelan y sus líneas anteriores se conservan al editar. Las compras y ventas actualizan el inventario dentro de transacciones, y las plantas pueden tener un precio por tamaño de maceta con stock compartido. Los productos nuevos reciben un SKU persistente automático. Los tickets PDF son comprobantes internos no fiscales, preparados para compartir desde dispositivos compatibles. Las secciones sin una tabla correspondiente todavía muestran datos de demostración.

Las migraciones aditivas de `server/migrations/0001_business_archive.sql`, `server/migrations/0002_auth_login_limits.sql`, `server/migrations/0003_soft_deletes.sql` y `server/migrations/0004_security_audit.sql` deben ejecutarse en orden antes de habilitar las funciones correspondientes. La última agrega el rol `vendedor`, la tabla de auditoría y sus índices. Estas migraciones no eliminan tablas, columnas ni registros. Este repositorio versiona migraciones SQL en `server/migrations`; aplicar los cambios a una base de datos es un paso operativo explícito y no se ejecuta durante el build.

Pinia comparte en memoria los datos recientes del catálogo y del borrador de venta. El borrador se conserva en `sessionStorage` mientras la pestaña siga abierta, pero solo incluye identificadores de producto/cliente, tamaños, cantidades y campos operativos; no guarda datos personales ni precios. Los precios, el stock y las ventas persistidas siempre se vuelven a consultar o validar contra PostgreSQL al guardar.

## Producción

```bash
pnpm build
pnpm preview
```

### Despliegue de prueba en Netlify

El proyecto incluye la configuración de compilación de Netlify y usa el preset de Netlify de Nitro. Netlify instala las dependencias con pnpm y compila con `pnpm build`. En las variables de entorno del sitio agrega los secretos de runtime (no los incluyas en el repositorio ni en archivos `.env` versionados):

- `NUXT_JWT_SECRET`: clave aleatoria de al menos 32 caracteres.
- `NUXT_DATABASE_URL`: conexión PostgreSQL existente; preferí la URL del pooler si el proveedor la ofrece.

Estas variables deben estar disponibles para las funciones en producción y para el contexto de deploy preview. La configuración local usa `JWT_SECRET` y `DATABASE_URL` (o `DIRECT_URL`) desde `.env`. El build no requiere secretos; las rutas de gestión permiten escrituras autenticadas mediante el panel. El proyecto puede desplegarse en un sitio Netlify una vez conectados el repositorio, la base y las variables de entorno.
