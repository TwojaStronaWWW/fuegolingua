<?php
declare(strict_types=1);

/**
 * Proxy dla zachowania kompatybilności wstecznej — deleguje do bezpiecznego endpointu /api/contact.php (ISO 27001 & RODO)
 */
require_once __DIR__ . '/../../api/contact.php';
