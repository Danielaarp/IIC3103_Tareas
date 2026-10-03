# Reflexión
Durante el desarrollo de las Tareas 1 y 2 pude adquirir diversos aprendizajes que considero muy relevantes, tanto desde el punto de vista técnico como desde una perspectiva más general sobre el desarrollo de aplicaciones modernas.
Uno de los principales aprendizajes estuvo relacionado con los distintos métodos de autenticación utilizados por los servicios externos. Personalmente, la autenticación siempre ha sido un tema que me ha costado comprender, especialmente al momento de llevar los conceptos a una implementación concreta. Por esta razón, trabajar con distintos mecanismos de OAuth me permitió entender de mejor manera cómo funcionan estos procesos, qué información debe mantenerse en el backend y cómo se gestionan elementos como los tokens, callbacks y distintos tipos de registro de clientes.

Otro aprendizaje importante fue comprender cómo se construye un agente basado en un modelo de lenguaje y herramientas externas. Antes de realizar esta tarea tenía una noción bastante más superficial de cómo funcionaban estos sistemas. Implementar el loop del agente, entregarle herramientas disponibles y procesar las llamadas que realiza el modelo me permitió comprender mucho mejor su funcionamiento interno. También pude observar de manera práctica cómo las instrucciones entregadas al modelo mediante el prompt influyen directamente en su comportamiento, en las herramientas que decide utilizar y en la manera en que interactúa con el usuario.
Aspectos que me gustaron de la tarea

Uno de los aspectos que más me gustó fue la integración mediante MCP. Actualmente existe un gran interés por el desarrollo de agentes de inteligencia artificial y esta tarea me permitió comprender de forma mucho más concreta cómo estos agentes pueden conectarse con servicios externos y utilizar herramientas reales.
Me pareció especialmente interesante que un mismo agente pudiera interactuar con servicios de vuelos, hoteles y clima, utilizando las herramientas disponibles dependiendo de la solicitud realizada por el usuario. Esto hizo que el proyecto se sintiera cercano a aplicaciones reales que actualmente están comenzando a utilizarse en distintas industrias.

En general, me gustó que la tarea no consistiera únicamente en consumir una API o implementar funcionalidades independientes, sino que obligara a integrar varios componentes dentro de un mismo sistema.
Dificultades encontradas y cómo las resolví

Una de las principales dificultades apareció al intentar que el agente ejecutara correctamente las tools que realizaban acciones, particularmente las herramientas relacionadas con reservas y cancelaciones.

Había definido que antes de ejecutar una herramienta de este tipo el agente debía pedir una confirmación explícita al usuario. Sin embargo, apareció un error difícil de detectar: luego de que el usuario entregaba la confirmación, la acción no se procesaba correctamente y finalmente la herramienta nunca era ejecutada.

Este problema me tomó bastante tiempo, principalmente porque al comienzo no era claro en qué parte del flujo se producía el error. Para encontrar la causa agregué distintos logs en el código, siguiendo paso a paso el comportamiento del agente, las llamadas generadas por el modelo y la información que se almacenaba entre mensajes. Gracias a esto pude identificar que el problema estaba relacionado con la forma en que se procesaba la confirmación del usuario y cómo se recuperaba posteriormente la acción que debía ejecutarse.

Finalmente, la solución consistió en conservar la llamada pendiente asociada a la acción y ejecutarla una vez recibida la confirmación correspondiente, en lugar de depender de que el modelo volviera a reconstruir correctamente la misma operación.

Otra dificultad importante estuvo relacionada con el manejo del contexto del modelo. Inicialmente estaba enviando todo el historial de la conversación al LLM. Esto funcionaba correctamente mientras el chat era corto, pero a medida que aumentaba la cantidad de mensajes se alcanzaba el límite permitido por el servicio y la conversación inevitablemente terminaba fallando.

Para resolverlo separé el historial completo almacenado en la base de datos del contexto que efectivamente se envía al modelo. De esta forma, la aplicación continúa conservando todos los mensajes del chat, pero el LLM recibe únicamente una cantidad limitada de mensajes recientes. Esto permitió mantener conversaciones más largas sin superar el límite permitido.

## Conceptos y tecnologías más interesantes

El concepto que me resultó más interesante fue Model Context Protocol (MCP).
La posibilidad de que distintos servicios expongan herramientas de una manera relativamente estandarizada y que posteriormente un modelo de lenguaje pueda decidir cuáles utilizar dependiendo de la solicitud del usuario me pareció especialmente relevante.
Esta integración me ayudó a comprender que un agente conversacional no tiene por qué limitarse únicamente a generar texto, sino que puede interactuar con sistemas externos, consultar información y ejecutar acciones reales.
Comentarios y reflexión final
En términos generales, considero que esta tarea fue muy entretenida, interesante y con un gran aporte de conocimiento.
Actualmente muchas empresas, particularmente aquellas que desarrollan productos SaaS, están explorando distintas formas de potenciar sus productos y servicios mediante inteligencia artificial. Dentro de este contexto, los agentes conversacionales representan un área de interés importante, ya que permiten crear experiencias mucho más dinámicas y personalizadas para los usuarios.
Una tendencia que considero especialmente relevante es la búsqueda de soluciones cada vez más personalizadas. En este sentido, poder conectar un agente con distintas aplicaciones y servicios externos permite que este deje de ser solamente una interfaz conversacional y pase a convertirse en una herramienta capaz de utilizar información y funcionalidades específicas para resolver necesidades concretas.
Por esta razón, considero que el proyecto fue una buena aproximación a tecnologías que probablemente tendrán una presencia cada vez mayor en el desarrollo de software. Además de aprender conceptos técnicos específicos como OAuth, MCP, gRPC y el funcionamiento de un agente, la tarea me permitió entender cómo estas tecnologías pueden combinarse para construir aplicaciones de inteligencia artificial más completas y útiles.