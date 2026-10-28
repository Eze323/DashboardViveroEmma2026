export interface ManagementRow {
  id: string
  [key: string]: string | number | boolean
}

export interface ManagementField {
  key: string
  label: string
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'select'
  options?: Array<string | { label: string, value: string }>
  format?: 'currency'
  required?: boolean
  readonly?: boolean
  help?: string
}

export interface ManagementModule {
  title: string
  description: string
  singular: string
  icon: string
  fields: ManagementField[]
  rows: ManagementRow[]
}

export type ViveroSection = 'ventas' | 'productos' | 'clientes' | 'categorias' | 'proveedores' | 'vendedores' | 'facturas' | 'premios' | 'embalaje' | 'accesos' | 'configuracion' | 'compras' | 'precios-proveedor' | 'precios-maceta' | 'ubicaciones' | 'zonas'

export const viveroModules: Record<ViveroSection, ManagementModule> = {
  'ventas': {
    title: 'Ventas',
    description: 'Consulta y registra las ventas del vivero.',
    singular: 'venta',
    icon: 'i-lucide-shopping-bag',
    fields: [
      { key: 'fecha', label: 'Fecha', type: 'date', required: true },
      { key: 'vendedor', label: 'Vendedor', required: true },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Completada', 'Pendiente'] }
    ],
    rows: [
      { id: 'V-1048', fecha: '2026-10-15', cliente: 'María López', vendedor: 'Lucía Pérez', medio: 'Transferencia', total: 48500, estado: 'Pagada' },
      { id: 'V-1047', fecha: '2026-10-15', cliente: 'Juan García', vendedor: 'Tomás Ruiz', medio: 'Efectivo', total: 23900, estado: 'Pagada' },
      { id: 'V-1046', fecha: '2026-10-14', cliente: 'Flor de Abril', vendedor: 'Lucía Pérez', medio: 'Débito', total: 67200, estado: 'Pendiente' }
    ]
  },
  'productos': {
    title: 'Productos e inventario',
    description: 'Administra el catálogo, los precios y el stock disponible.',
    singular: 'producto',
    icon: 'i-lucide-flower-2',
    fields: [
      { key: 'nombre', label: 'Producto', required: true },
      { key: 'categoria', label: 'Categoría', type: 'select', required: true },
      { key: 'sku', label: 'SKU automático', readonly: true, help: 'Se asigna y guarda automáticamente al crear el producto.' },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'precioCompra', label: 'Costo de compra', type: 'number', format: 'currency', required: true },
      { key: 'stock', label: 'Stock', type: 'number', required: true },
      { key: 'potSize', label: 'Tamaño de maceta base' },
      { key: 'precio', label: 'Precio de venta', type: 'number', format: 'currency', required: true },
      { key: 'imageUrl', label: 'URL de imagen' },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Publicado', 'Borrador'] }
    ],
    rows: [
      { id: 'P-0201', nombre: 'Monstera deliciosa', categoria: 'Plantas', sku: 'PLA-0201', stock: 18, precio: 18500, estado: 'Publicado' },
      { id: 'P-0202', nombre: 'Maceta terracota N° 18', categoria: 'Macetas', sku: 'MAC-0118', stock: 7, precio: 9200, estado: 'Publicado' },
      { id: 'P-0203', nombre: 'Sustrato universal 10 L', categoria: 'Sustratos', sku: 'SUS-0010', stock: 0, precio: 6500, estado: 'Sin stock' }
    ]
  },
  'clientes': {
    title: 'Clientes',
    description: 'Mantén organizada la información y el historial de tus clientes.',
    singular: 'cliente',
    icon: 'i-lucide-users',
    fields: [
      { key: 'nombre', label: 'Nombre', required: true },
      { key: 'email', label: 'Correo electrónico', type: 'email' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'localidad', label: 'Dirección' },
      { key: 'taxId', label: 'CUIT / DNI' },
      { key: 'ivaCondition', label: 'Condición frente al IVA' },
      { key: 'fiscalAddress', label: 'Domicilio fiscal' }
    ],
    rows: [
      { id: 'C-0301', nombre: 'María López', email: 'maria@example.com', telefono: '11 4567-3210', localidad: 'San Isidro', compras: 12, estado: 'Activo' },
      { id: 'C-0302', nombre: 'Juan García', email: 'juan@example.com', telefono: '11 3456-7890', localidad: 'Olivos', compras: 4, estado: 'Activo' },
      { id: 'C-0303', nombre: 'Flor de Abril', email: 'hola@flordeabril.com', telefono: '11 5678-1234', localidad: 'Tigre', compras: 7, estado: 'Activo' }
    ]
  },
  'categorias': {
    title: 'Categorías',
    description: 'Organiza los productos para encontrarlos rápidamente.',
    singular: 'categoría',
    icon: 'i-lucide-folders',
    fields: [
      { key: 'nombre', label: 'Nombre', required: true },
      { key: 'descripcion', label: 'Descripción' },
      { key: 'productos', label: 'Productos', type: 'number' },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Activa', 'Inactiva'] }
    ],
    rows: [
      { id: 'CAT-01', nombre: 'Plantas', descripcion: 'Plantas de interior y exterior', productos: 42, estado: 'Activa' },
      { id: 'CAT-02', nombre: 'Macetas', descripcion: 'Macetas y accesorios', productos: 28, estado: 'Activa' },
      { id: 'CAT-03', nombre: 'Sustratos', descripcion: 'Tierra, compost y fertilizantes', productos: 16, estado: 'Activa' }
    ]
  },
  'proveedores': {
    title: 'Proveedores',
    description: 'Centraliza los contactos y el estado de tus proveedores.',
    singular: 'proveedor',
    icon: 'i-lucide-truck',
    fields: [
      { key: 'nombre', label: 'Proveedor', required: true },
      { key: 'contacto', label: 'Contacto' },
      { key: 'email', label: 'Correo electrónico', type: 'email' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'rubro', label: 'Rubro' },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Activo', 'Pendiente', 'Inactivo'] }
    ],
    rows: [
      { id: 'PRO-11', nombre: 'Viveros del Sur', contacto: 'Carolina Méndez', email: 'ventas@viverosdelsur.com', telefono: '11 4000-1122', rubro: 'Plantas', estado: 'Activo' },
      { id: 'PRO-12', nombre: 'Tierra Noble', contacto: 'Pedro Ríos', email: 'pedidos@tierranoble.com', telefono: '11 4000-3344', rubro: 'Sustratos', estado: 'Activo' },
      { id: 'PRO-13', nombre: 'Barro & Forma', contacto: 'Ana Suárez', email: 'hola@barroyforma.com', telefono: '11 4000-5566', rubro: 'Macetas', estado: 'Pendiente' }
    ]
  },
  'compras': {
    title: 'Compras e inventario',
    description: 'Registra compras a proveedores y actualiza el stock compartido de la planta.',
    singular: 'compra',
    icon: 'i-lucide-truck',
    fields: [
      { key: 'productoId', label: 'Producto', type: 'select', required: true },
      { key: 'proveedorId', label: 'Proveedor', type: 'select', required: true },
      { key: 'cantidad', label: 'Cantidad', type: 'number', required: true },
      { key: 'precio', label: 'Costo unitario', type: 'number', format: 'currency', required: true },
      { key: 'fecha', label: 'Fecha y hora', type: 'datetime-local', required: true }
    ],
    rows: []
  },
  'precios-proveedor': {
    title: 'Precios de proveedores',
    description: 'Mantén el historial de costos por producto y proveedor.',
    singular: 'precio de proveedor',
    icon: 'i-lucide-tags',
    fields: [
      { key: 'productoId', label: 'Producto', type: 'select', required: true },
      { key: 'proveedorId', label: 'Proveedor', type: 'select', required: true },
      { key: 'precio', label: 'Costo unitario', type: 'number', format: 'currency', required: true },
      { key: 'desde', label: 'Válido desde', type: 'datetime-local' },
      { key: 'hasta', label: 'Válido hasta', type: 'datetime-local' }
    ],
    rows: []
  },
  'precios-maceta': {
    title: 'Precios por tamaño de maceta',
    description: 'Configura el precio de cada planta por tamaño. El stock se comparte entre tamaños y la venta guarda la medida elegida.',
    singular: 'precio por tamaño',
    icon: 'i-lucide-ruler',
    fields: [
      { key: 'productoId', label: 'Planta', type: 'select', required: true },
      { key: 'medida', label: 'Tamaño de maceta', required: true, help: 'Ej.: chica, 3 L, 5 L.' },
      { key: 'precio', label: 'Precio de venta', type: 'number', format: 'currency', required: true }
    ],
    rows: []
  },
  'ubicaciones': {
    title: 'Ubicaciones',
    description: 'Administra ubicaciones y áreas de seguimiento del vivero.',
    singular: 'ubicación',
    icon: 'i-lucide-map-pin',
    fields: [
      { key: 'nombre', label: 'Nombre', required: true },
      { key: 'area', label: 'Área' },
      { key: 'monitoreada', label: 'Monitoreada', type: 'select', options: ['Sí', 'No'] },
      { key: 'x', label: 'Posición X', type: 'number' },
      { key: 'y', label: 'Posición Y', type: 'number' },
      { key: 'estado', label: 'Estado', required: true }
    ],
    rows: []
  },
  'zonas': {
    title: 'Zonas',
    description: 'Configura las zonas del plano del vivero.',
    singular: 'zona',
    icon: 'i-lucide-map',
    fields: [
      { key: 'nombre', label: 'Nombre', required: true },
      { key: 'x', label: 'Posición X', type: 'number', required: true },
      { key: 'y', label: 'Posición Y', type: 'number', required: true },
      { key: 'ancho', label: 'Ancho', type: 'number', required: true },
      { key: 'alto', label: 'Alto', type: 'number', required: true },
      { key: 'color', label: 'Color', required: true }
    ],
    rows: []
  },
  'vendedores': {
    title: 'Vendedores',
    description: 'Consulta el equipo comercial y su actividad.',
    singular: 'vendedor',
    icon: 'i-lucide-contact-round',
    fields: [
      { key: 'nombre', label: 'Nombre', required: true },
      { key: 'email', label: 'Correo electrónico', type: 'email' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'ventas', label: 'Ventas del mes', type: 'number' },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo'] }
    ],
    rows: [
      { id: 'VEN-01', nombre: 'Lucía Pérez', email: 'lucia@viveroemma.com', telefono: '11 4000-1001', ventas: 38, estado: 'Activo' },
      { id: 'VEN-02', nombre: 'Tomás Ruiz', email: 'tomas@viveroemma.com', telefono: '11 4000-1002', ventas: 31, estado: 'Activo' },
      { id: 'VEN-03', nombre: 'Sofía Castro', email: 'sofia@viveroemma.com', telefono: '11 4000-1003', ventas: 24, estado: 'Activo' }
    ]
  },
  'facturas': {
    title: 'Facturas',
    description: 'Revisa los comprobantes y su estado de emisión.',
    singular: 'factura',
    icon: 'i-lucide-receipt-text',
    fields: [
      { key: 'fecha', label: 'Fecha', type: 'date', required: true },
      { key: 'cliente', label: 'Cliente', required: true },
      { key: 'tipo', label: 'Comprobante', type: 'select', options: ['Factura A', 'Factura B', 'Factura C', 'Ticket'] },
      { key: 'total', label: 'Total', type: 'number', format: 'currency', required: true },
      { key: 'numero', label: 'Número' },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Emitida', 'Pendiente', 'Anulada'] }
    ],
    rows: [
      { id: 'FC-0001048', fecha: '2026-10-15', cliente: 'María López', tipo: 'Factura B', total: 48500, numero: '0004-00001048', estado: 'Emitida' },
      { id: 'FC-0001047', fecha: '2026-10-15', cliente: 'Juan García', tipo: 'Ticket', total: 23900, numero: '0004-00001047', estado: 'Emitida' },
      { id: 'FC-0001046', fecha: '2026-10-14', cliente: 'Flor de Abril', tipo: 'Factura A', total: 67200, numero: '0004-00001046', estado: 'Pendiente' }
    ]
  },
  'premios': {
    title: 'Premios',
    description: 'Administra los beneficios disponibles para clientes frecuentes.',
    singular: 'premio',
    icon: 'i-lucide-gift',
    fields: [
      { key: 'nombre', label: 'Premio', required: true },
      { key: 'puntos', label: 'Puntos necesarios', type: 'number', required: true },
      { key: 'stock', label: 'Stock', type: 'number' },
      { key: 'vigencia', label: 'Vigencia hasta', type: 'date' },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Activo', 'Pausado', 'Agotado'] }
    ],
    rows: [
      { id: 'PRE-01', nombre: 'Descuento del 10%', puntos: 500, stock: 50, vigencia: '2026-12-31', estado: 'Activo' },
      { id: 'PRE-02', nombre: 'Maceta artesanal', puntos: 900, stock: 12, vigencia: '2026-12-31', estado: 'Activo' },
      { id: 'PRE-03', nombre: 'Asesoría de jardinería', puntos: 1200, stock: 3, vigencia: '2026-11-30', estado: 'Activo' }
    ]
  },
  'embalaje': {
    title: 'Embalaje',
    description: 'Controla los materiales de empaque y sus niveles de reposición.',
    singular: 'material',
    icon: 'i-lucide-package',
    fields: [
      { key: 'nombre', label: 'Material', required: true },
      { key: 'unidad', label: 'Unidad' },
      { key: 'stock', label: 'Stock disponible', type: 'number' },
      { key: 'minimo', label: 'Stock mínimo', type: 'number' },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Disponible', 'Reponer', 'Agotado'] }
    ],
    rows: [
      { id: 'EMB-01', nombre: 'Caja para plantas M', unidad: 'unidades', stock: 86, minimo: 30, estado: 'Disponible' },
      { id: 'EMB-02', nombre: 'Papel kraft', unidad: 'rollos', stock: 4, minimo: 8, estado: 'Reponer' },
      { id: 'EMB-03', nombre: 'Bolsa compostable', unidad: 'paquetes', stock: 0, minimo: 5, estado: 'Agotado' }
    ]
  },
  'accesos': {
    title: 'Usuarios y accesos',
    description: 'Gestiona los usuarios del panel y sus perfiles de acceso.',
    singular: 'usuario',
    icon: 'i-lucide-shield-check',
    fields: [
      { key: 'nombre', label: 'Nombre', required: true },
      { key: 'email', label: 'Correo electrónico', type: 'email', required: true },
      {
        key: 'rol',
        label: 'Rol',
        type: 'select',
        required: true,
        options: [
          { label: 'Administrador', value: 'admin' },
          { label: 'Encargado', value: 'encargado' },
          { label: 'Vendedor', value: 'vendedor' }
        ]
      },
      { key: 'password', label: 'Contraseña', type: 'password', help: 'Mínimo 12 caracteres. Déjala vacía al editar para conservar la actual.' }
    ],
    rows: [
      { id: 'USR-01', nombre: 'Vivero Emma', email: 'admin@viveroemma.com', rol: 'Administrador', ultimoAcceso: 'Hoy, 09:42', estado: 'Activo' },
      { id: 'USR-02', nombre: 'Lucía Pérez', email: 'lucia@viveroemma.com', rol: 'Encargado', ultimoAcceso: 'Ayer, 17:16', estado: 'Activo' },
      { id: 'USR-03', nombre: 'Tomás Ruiz', email: 'tomas@viveroemma.com', rol: 'Vendedor', ultimoAcceso: 'Invitación enviada', estado: 'Invitación pendiente' }
    ]
  },
  'configuracion': {
    title: 'Configuración',
    description: 'Preferencias generales del vivero y del panel de gestión.',
    singular: 'preferencia',
    icon: 'i-lucide-settings-2',
    fields: [
      { key: 'opcion', label: 'Preferencia', required: true },
      { key: 'valor', label: 'Valor', required: true },
      { key: 'detalle', label: 'Descripción' }
    ],
    rows: [
      { id: 'CFG-01', opcion: 'Nombre comercial', valor: 'Vivero Emma', detalle: 'Nombre en comprobantes y comunicaciones' },
      { id: 'CFG-02', opcion: 'Moneda', valor: 'ARS', detalle: 'Pesos argentinos' },
      { id: 'CFG-03', opcion: 'Stock mínimo', valor: '5 unidades', detalle: 'Avisar cuando un producto alcance este nivel' }
    ]
  }
}
