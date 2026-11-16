<?php

/**
 * Helpers globales de seguridad y utilidades comunes.
 */

function get_csrf_token(): string
{
    // El token vive por sesion y se reutiliza en todas las acciones sensibles del
    // modulo para que el cliente no pueda forjar una peticion valida sin la sesion del
    // usuario autenticado.
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return (string)$_SESSION['csrf_token'];
}

function csrf_input(): string
{
    $token = htmlspecialchars(get_csrf_token(), ENT_QUOTES, 'UTF-8');
    return '<input type="hidden" name="csrf_token" value="' . $token . '">';
}

function validate_csrf(): bool
{
    // Solo validamos CSRF en POST; el resto de solicitudes se consideran seguras para
    // este flujo (por ejemplo, carga inicial del formulario).
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        return true;
    }

    $token = (string)($_POST['csrf_token'] ?? '');
    return $token !== '' && hash_equals((string)($_SESSION['csrf_token'] ?? ''), $token);
}

