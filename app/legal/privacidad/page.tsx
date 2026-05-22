export const metadata = {
  title: 'Política de Privacidad — GymDex',
}

export default function PrivacidadPage() {
  return (
    <article className="prose prose-zinc max-w-none">
      <h1>Política de Privacidad</h1>
      <p className="text-zinc-500 text-sm">Última actualización: mayo de 2026</p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        GymDex es una plataforma de gestión de membresías para gimnasios, desarrollada y
        operada por Hernan Rodriguez (<a href="mailto:her.rodri44@gmail.com">her.rodri44@gmail.com</a>).
        En el marco de la Ley 25.326 de Protección de los Datos Personales (Argentina),
        GymDex actúa como <strong>encargado de tratamiento</strong>: procesa datos por cuenta
        de cada gimnasio cliente, quien es el <strong>responsable del tratamiento</strong> de
        los datos de sus socios.
      </p>

      <h2>2. Datos que se recopilan</h2>
      <p>A través de la plataforma se procesan los siguientes datos personales:</p>
      <ul>
        <li>Nombre completo y número de documento (DNI) de los socios del gimnasio.</li>
        <li>Teléfono, email y fecha de nacimiento (opcionales, según lo que cargue el gimnasio).</li>
        <li>Registros de asistencia (fecha y hora de ingreso al gimnasio).</li>
        <li>
          Estado de membresía e historial de registro de pagos (asentados de forma estrictamente
          manual por el administrador del gimnasio; GymDex no procesa, intermedia ni valida
          transacciones financieras o monetarias de ningún tipo).
        </li>
        <li>Datos de cuenta de administradores del gimnasio (nombre, email).</li>
      </ul>

      <h2>3. Finalidad del tratamiento</h2>
      <p>
        Los datos se usan <strong>exclusivamente</strong> para que el gimnasio pueda gestionar
        sus membresías, controlar el acceso de sus socios y llevar un registro de asistencia y
        pagos. GymDex no utiliza estos datos para ningún fin ajeno a la prestación del servicio.
      </p>

      <h2>4. No compartimos datos con terceros</h2>
      <p>
        GymDex no vende, alquila ni comparte los datos personales de los socios con terceros,
        ni los utiliza con fines publicitarios o comerciales propios. El único caso en que los
        datos pueden ser accedidos por terceros es el de los proveedores de infraestructura
        (Supabase y Vercel), que alojan los servidores y bases de datos de la plataforma bajo
        sus propias políticas de seguridad y privacidad.
      </p>

      <h2>5. Almacenamiento, seguridad y transferencia internacional</h2>
      <p>
        Los datos se almacenan en servidores de Supabase (base de datos PostgreSQL con
        Row-Level Security habilitado) y se sirven a través de Vercel. Ambas plataformas
        aplican cifrado en tránsito (TLS) y en reposo. El acceso a los datos está restringido
        por rol: cada gimnasio solo puede ver sus propios datos.
      </p>
      <p>
        Al utilizar la plataforma, el gimnasio y sus usuarios consienten la transferencia
        internacional de datos a los servidores de los proveedores mencionados (ubicados en el
        exterior), los cuales cumplen con estándares internacionales de protección de datos.
      </p>

      <h2>6. Derechos del titular (ARCO)</h2>
      <p>
        De acuerdo con la Ley 25.326, los titulares de los datos tienen derecho a acceder,
        rectificar, cancelar y oponerse al tratamiento de sus datos personales. Para ejercer
        estos derechos, el socio debe dirigirse al gimnasio del que es miembro, quien es el
        responsable del tratamiento. El gimnasio puede solicitar a GymDex la modificación o
        eliminación de los datos en cualquier momento escribiendo a{' '}
        <a href="mailto:her.rodri44@gmail.com">her.rodri44@gmail.com</a>.
      </p>
      <p>
        Se informa que la <strong>AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA</strong>, Órgano
        de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos
        que se interpongan con relación al incumplimiento de las normas sobre protección de
        datos personales.
      </p>

      <h2>7. Retención de datos</h2>
      <p>
        Los datos se conservan mientras el gimnasio mantenga activa su cuenta en GymDex.
        Ante la baja del servicio, los datos son eliminados de los servidores en un plazo
        razonable, salvo obligación legal en contrario.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Para consultas sobre esta política o el tratamiento de datos personales:{' '}
        <a href="mailto:her.rodri44@gmail.com">her.rodri44@gmail.com</a>
      </p>
    </article>
  )
}
