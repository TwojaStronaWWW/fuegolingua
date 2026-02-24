document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Navigation ---
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // --- Smooth Scrolling ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            navLinks.classList.remove('active'); // Close mobile menu on click
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // --- Contact Form Handling ---
    const contactForm = document.getElementById('contactForm');
    const formStatus = document.getElementById('formStatus');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;

            submitBtn.disabled = true;
            submitBtn.innerText = 'Wysyłanie...';
            formStatus.innerHTML = '';

            fetch('assets/php/contact.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    formStatus.innerHTML = '<p class="success">' + data.message + '</p>';
                    contactForm.reset();
                } else {
                    formStatus.innerHTML = '<p class="error">' + data.message + '</p>';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                let errorMsg = 'Wystąpił błąd podczas wysyłania wiadomości.';
                if (error.message) {
                    errorMsg += ' (Szczegóły: ' + error.message + ')';
                }
                formStatus.innerHTML = '<p class="error">' + errorMsg + '<br>Upewnij się, że strona otwarta jest na serwerze z obsługą PHP, a nie bezpośrednio z pliku.</p>';
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            });
        });
    }

    // --- Lead Recovery System (15 minute timer) ---
    const LEAD_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
    const SESSION_KEY = 'fuego_lead_recovered';

    // Check if we already recovered this lead in this session
    if (!sessionStorage.getItem(SESSION_KEY)) {
        console.log('Lead recovery timer started: 15 minutes');
        
        setTimeout(() => {
            triggerLeadRecovery();
        }, LEAD_TIMEOUT);
    }

    function triggerLeadRecovery() {
        // Double check session storage just in case
        if (sessionStorage.getItem(SESSION_KEY)) return;

        console.log('Triggering lead recovery...');
        
        fetch('assets/php/lead_recovery.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'action=recover_lead'
        })
        .then(response => response.json())
        .then(data => {
            console.log('Lead recovery response:', data);
            if (data.success) {
                // Mark as recovered so we don't send again this session
                sessionStorage.setItem(SESSION_KEY, 'true');
            }
        })
        .catch(error => {
            console.error('Lead recovery error:', error);
        });
    }
});
