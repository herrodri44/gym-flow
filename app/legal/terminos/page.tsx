export const metadata = {
  title: 'Términos y Condiciones — GymDex',
}

export default function TerminosPage() {
  return (
    <article className="prose prose-zinc max-w-none">
      <h1>Términos y Condiciones de Uso</h1>
      <p className="text-zinc-500 text-sm">Última actualización: mayo de 2026</p>

      <p>
        El presente documento regula la relación entre <strong>GymDex</strong> (en adelante,
        "la Plataforma") y el gimnasio cliente (en adelante, "el Cliente") que accede y utiliza
        el servicio. Al aceptar estos términos, el representante del gimnasio declara tener
        facultades para obligar a la organización.
      </p>

      <h2>1. Descripción del servicio</h2>
      <p>
        GymDex es una plataforma de gestión interna para gimnasios que permite registrar socios,
        controlar asistencia mediante fichaje, gestionar membresías y planes, y llevar un registro
        manual de pagos. El servicio se presta a través de una aplicación web accesible en{' '}
        <strong>gymdex.com.ar</strong>.
      </p>

      <h2>2. Exención de responsabilidad por cobros y pagos</h2>
      <p>
        GymDex es un <strong>sistema de registro interno</strong>. La plataforma no procesa,
        intermedia, retiene ni audita pagos de ningún tipo. El registro del estado de pago de
        un socio (pagado, pendiente, vencido) es ingresado manualmente por el personal del
        gimnasio y su veracidad es <strong>responsabilidad exclusiva del Cliente</strong>.
        GymDex no se responsabiliza por errores, omisiones o discrepancias en los registros
        de cobros generados por el uso de la plataforma, ni interviene en la relación fiscal
        o comercial entre el gimnasio y sus socios.
      </p>

      <h2>3. Continuidad del servicio — Fase piloto</h2>
      <p>
        El servicio se encuentra actualmente en <strong>fase de desarrollo y piloto</strong>.
        GymDex no garantiza disponibilidad continua (24/7) ni un tiempo de actividad mínimo.
        Pueden ocurrir interrupciones temporales por mantenimiento, actualizaciones o fallas
        de infraestructura ajenas a la Plataforma (incluyendo, pero no limitado a, caídas en
        los servicios de AWS, Supabase, Vercel o proveedores de conectividad a internet del
        Cliente). GymDex no se responsabiliza por los inconvenientes operativos o logísticos
        que pudieran derivarse de una caída del sistema durante este período.
      </p>

      <h2>4. Limitación de responsabilidad económica</h2>
      <p>
        En ningún caso GymDex será responsable por daños indirectos, incidentales, especiales,
        punitivos o consecuentes, incluyendo de forma enunciativa pero no limitativa:{' '}
        <strong>pérdida de ganancias (lucro cesante)</strong>, pérdida de datos, interrupción
        del negocio o reclamos de terceros (socios del gimnasio), derivados del uso o de la
        imposibilidad de usar la plataforma.
      </p>

      <h2>5. Propiedad de los datos</h2>
      <p>
        Los datos cargados en la plataforma (socios, membresías, pagos, asistencias) son
        propiedad del Cliente. GymDex tiene derecho a alojarlos en sus servidores{' '}
        <strong>únicamente para la prestación del servicio</strong> y se compromete a no
        utilizarlos para ningún otro fin. Ante la baja del servicio, el Cliente puede solicitar
        la exportación y eliminación de sus datos en un formato estándar.
      </p>

      <h2>6. Confidencialidad</h2>
      <p>
        GymDex y su equipo se comprometen a mantener estricta confidencialidad sobre la
        información comercial del gimnasio y los datos personales de sus socios, no pudiendo
        revelarlos ni utilizarlos para ningún fin ajeno a la prestación del servicio. Esta
        obligación se mantiene vigente incluso después de la terminación de la relación
        contractual.
      </p>

      <h2>7. Uso aceptable</h2>
      <p>El Cliente se compromete a:</p>
      <ul>
        <li>Usar la plataforma únicamente para los fines descritos en el punto 1.</li>
        <li>
          No intentar acceder a datos de otros gimnasios clientes ni vulnerar las medidas de
          seguridad del sistema.
        </li>
        <li>
          Mantener la confidencialidad de las credenciales de acceso de sus administradores.
        </li>
        <li>
          Cargar únicamente datos de personas que hayan dado su consentimiento expreso para
          ser registradas en el sistema, deslindando a GymDex de cualquier reclamo por uso
          indebido de datos de terceros.
        </li>
      </ul>

      <h2>8. Modificaciones del servicio</h2>
      <p>
        GymDex se reserva el derecho de modificar, suspender o discontinuar el servicio en
        cualquier momento, notificando al Cliente con una anticipación razonable salvo en casos
        de fuerza mayor o actualizaciones críticas de seguridad.
      </p>

      <h2>9. Legislación aplicable y Jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Cualquier controversia
        derivada del presente contrato será sometida a los tribunales ordinarios de la Ciudad
        de San Luis, Provincia de San Luis, renunciando a cualquier otro fuero o jurisdicción
        que pudiera corresponder.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Para consultas sobre estos términos:{' '}
        <a href="mailto:her.rodri44@gmail.com">her.rodri44@gmail.com</a>
      </p>
    </article>
  )
}
