# SuperAdmin
Un usuario con el rol de SuperAdmin al logearse, podra ver una pagina de seleccion de gimnacios, al seleccionar un gimnacio, se redirigira a la pagina de ese gimnacio, donde podra ver las siguientes opciones:
- Ver los socios del gimnacio
- Ver los admins del gimnacio
- Ver los planes del gimanacio
- Ver el Dashboard del gimnacio (esta es la pagina por default al seleccionar un gimnacio)

En todas estas paginas el superadmin tiene acceso a todas las funcionalidades.

# Admin
Un usuario con el rol de Admin al logearse, si solo tiene un gimnacio asignado, se redirigira directamente a la pagina de ese gimnacio (el dashboard del gimnacio). Si tiene mas de un gimnacio asignado, se redirigira a la pagina de seleccion de gimnacios, donde podra seleccionar el gimnacio al que desea ingresar. Solo vera en la lista los gimacios que tiene asignados. Al seleccionar un gimnacio, se redirigira a la pagina de ese gimnacio.
Al entrar al Dashboard, el admin podra ver una barra de navegacion con las siguientes opciones:
- Dashboard (esta es la pagina por default al seleccionar un gimnacio)
- Socios
- Planes
- Fichaje
- Y una seccion donde podra ver su perfil, ver la Configuracion del gimnacio y cerrar sesion (puede ser un dropdown o algo similar)

## Dashboard
En el dashboard, el admin podra ver un resumen de la actividad del gimnacio, como por ejemplo:
- Cantidad de socios activos
- Cantidad de socios inactivos
- Cantidad de socios que han fichado en la semana
- Cantidad de socios que ya han pagado su subscripcion en el mes
- Cantidad de socios que no han pagado su subscripcion en el mes
- Socios que tienen 0 o menos creditos (que estan accediendo al gimnacio con los creditos extra permitidos en la configuracion del gimnacio) 
- Y cualquier otra estadistica relevante que se pueda mostrar en un dashboard.
Los puntos relacionados a los pagos pueden verse usando un grafico de barras o algo similar, para mostrar la cantidad de socios que han pagado y no han pagado en el mes.
Otro grafico que se podra mostrar es la cantidad de socios por mes que han fichado al menos 1 vez. Asi se podra ver la tendencia de fichajes a lo largo del tiempo.
Todo esto organizado de una manera clara y visualmente atractiva, para que el admin pueda entender rapidamente la situacion del gimnacio.

## Socios
En la seccion de socios, el admin podra ver una lista de todos los socios del gimnacio, con la siguiente informacion:
- Nombre completo
- Email
- Telefono
- Fecha de nacimiento
- Fecha de alta
- Ultimo fichaje (fecha y hora del ultimo fichaje del socio)
- Plan (nombre del plan al que esta suscripto el socio)
- Creditos restantes (si el plan es de creditos, se mostrara la cantidad de creditos restantes del socio, si el plan es libre, se mostrara un icono o algo similar para indicar que el socio tiene acceso ilimitado)
- Estado de pago (si el socio ha pagado su subscripcion del mes actual o no)
- Acciones (editar, eliminar, ver detalles)
Al hacer click en un socio, se podra ver mas detalles del socio, como por ejemplo su historial de fichajes, historial de pagos, y cualquier 
otra informacion relevante. Desde esta seccion el admin tambien podra editar la informacion del socio, eliminarlo o cambiar su  
estado (activo o inactivo).
Tambien podra crear nuevos socios, asignarles un plan y registrar su pago, modificar la cantidad de creditos restantes (si aplica), 
y cambiar el estado de pago.
Una funcionalidad importante es poder filtrar por los que no han pagado todavia su subscripcion del mes, para poder enviarles un recordatorio o 
tomar alguna accion al respecto.
El admin podra buscar socios por nombre, email o telefono, y tambien podra filtrar por estado (activo o inactivo) y por el estado de pago. 
En la lista de socios, se podra ordenar por cualquier columna, para facilitar la busqueda y organizacion de los socios.

## Planes
En la seccion de planes, el admin podra ver una lista de todos los planes del gimnacio, con la siguiente informacion:
- Nombre del plan
- Tipo de plan (libre o de creditos)
- Precio
- Acciones (editar, eliminar, ver detalles)

## Fichaje
En la seccion de fichaje, el admin podra ver un formulario para registrar un fichaje manual. 
El formulario tendra un campo de busqueda para buscar al socio por DNI, o nombre completo.
Cuando admin empieza a tipear el campo de busqueda, se iran mostrando sugerencias de socios que coincidan con lo que se esta escribiendo, para facilitar la busqueda.
Una vez que el admin selecciona al socio, se mostrara la siguiente informacion del socio:
- Nombre completo
- DNI
- Creditos restantes (si el plan es de creditos)

Y un boton para registrar el fichaje. Al hacer click en el boton, se registrara el fichaje del socio, se descontara un credito si el plan es de creditos, 
y se mostrara un mensaje de exito o error dependiendo del resultado de la operacion.

## Configuracion del gimnacio
Un admin podra acceder a la configuracion del gimnacio desde el menu de navegacion. En esta seccion, el admin podra modificar la informacion del gimnacio, como por ejemplo:
- Nombre del gimnacio
- Direccion
- Telefono
- Email
- Horarios de apertura y cierre
- Y cualquier otra informacion relevante del gimnacio.
Tambien podra configurar la cantidad de creditos extra permitidos, esto le permite a socios poder entrar al gimnacio igual 
aunque no tengan creditos restantes, pero solo una cantidad limitada de veces al mes. 
Esto es util para evitar que socios se queden sin acceso al gimnacio por no tener creditos, pero al mismo tiempo limitar el abuso 
de esta funcionalidad. Aveces los socios tardan en pagar 1 o 2 semanas, y los gimnacios querran permitirles seguir entrando al gimnacio y mandarles
un recordatorio para que paguen su subscripcion, pero no querran permitir que entren al gimnacio sin pagar por un periodo prolongado de tiempo.

# Perfil del socio
El socio podra logearse a su cuenta, por default haremos que su usuario sea su email y su contraseña sea su DNI.
Al logearse, el socio podra ver su perfil, donde se mostrara la siguiente informacion:
- Nombre completo
- Email
- Telefono
- Fecha de nacimiento
- Fecha de alta
- Ultimo fichaje (fecha y hora del ultimo fichaje del socio)
- Plan (nombre del plan al que esta suscripto el socio)
- Creditos restantes (si el plan es de creditos, se mostrara la cantidad de creditos restantes del socio, si el plan es libre, 
se mostrara un icono o algo similar para indicar que el socio tiene acceso ilimitado)
- Estado de pago (si el socio ha pagado su subscripcion del mes actual o no)

Mas adelante, podremos agregar la funcionalidad para que el socio pueda editar su informacion, cambiar su plan, registrar su pago, etc. 
Tambien una intergacion con MercadoPago para que el socio pueda pagar su subscripcion directamente desde su perfil, y asi actualizar automaticamente su estado de pago 
y evitar que el admin tenga que hacerlo manualmente.
Pero por ahora, el perfil del socio sera solo de visualizacion, para que el socio pueda ver su informacion y su estado actual.