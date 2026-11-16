<?php
// Esta vista reutiliza el parcial del texto para una herramienta ligera sin el flujo
// completo de documento; la logica del procesamiento sigue en el frontend.
require __DIR__ . '/../partials/justificador_texto.php';
?>
<script src="public/js/justificador_texto_core.js?v=<?= filemtime(__DIR__ . '/../../public/js/justificador_texto_core.js') ?>" defer></script>
