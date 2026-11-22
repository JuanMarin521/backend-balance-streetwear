# Balance Streetwear backend

Backend server-side de Balance Streetwear construido con Astro, TypeScript y
Supabase. Astro conserva el enrutamiento HTTP y `src/server` organiza el
backend por capas para mantener los controladores pequeños y desacoplados de
la persistencia.

## Arquitectura

```text
src/
  pages/api/                 # Adaptadores de rutas Astro; no contienen lógica
  server/
    config/                 # Configuración y variables de entorno
    controllers/             # Entrada HTTP: request -> caso de uso -> response
    exceptions/              # Errores públicos y códigos estables
    middlewares/             # Manejo HTTP, parsing y respuestas de error
    repositories/            # Adaptadores de Supabase y acceso a datos
    routes/v1/               # Contrato versionado de rutas del backend
    services/                # Casos de uso y reglas de aplicación
    types/                   # Contratos compartidos del servidor
    utils/                   # Funciones puras reutilizables
    validators/              # Contratos Zod de entrada
  lib/
    domain/                  # Compatibilidad y reglas puras del dominio
    payments/                # Puerto y adaptador del proveedor de pagos
    supabase/                # Implementaciones existentes de persistencia
```

El flujo recomendado es:

```text
Astro page route -> route v1 -> controller -> service -> repository -> Supabase
                                             \-> payment adapter
```

Las páginas de `src/pages/api` son deliberadamente delgadas porque Astro es
el límite HTTP. No se crea un servidor Express paralelo. `dist/` y
`node_modules/` son artefactos generados y no forman parte de la arquitectura
fuente.

## Contratos actuales

- `POST /api/checkout/session`: reserva stock y crea la sesión de pago.
- `POST /api/payments/webhook`: verifica e idempotentiza eventos del proveedor.
- `GET /api/inventory`: devuelve disponibilidad pública limitada.
- `GET|POST|PATCH /api/admin/inventory`: administra productos y variantes.
- `GET|PATCH /api/admin/orders`: consulta y transiciona órdenes.

Los precios, el stock y las autorizaciones se resuelven en servidor. Las
credenciales de Supabase service-role y de pagos nunca se exponen al cliente.

## Verificación

```text
npm install
npm run typecheck
npm test
npm run build
```

La migración `supabase/migrations/0001_init.sql` todavía debe aplicarse y
probarse contra un proyecto Supabase real antes de declarar el sistema listo
para producción.
