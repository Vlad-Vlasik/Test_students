// --- КОНФІГУРАЦІЯ (ЗАПОВНЮЄТЬСЯ ПІСЛЯ СЕРВЕРНОГО ЗАПИТУ) ---
let TEST_CONFIG = {};
let studentData = {};
let violationCount = 0;
let isTestActive = false;

// --- API ШЛЯХИ ---
// !!! ВИПРАВЛЕНО: Додано префікс '/test_project' для роботи з локальною папкою Laragon/XAMPP !!!
const API_START = '/test_project/backend/api/start_test.php';
const API_LOG = '/test_project/backend/api/log_violation.php';
const API_SUBMIT = '/test_project/backend/api/submit_test.php';

// --- ЕЛЕМЕНТИ DOM ---
const startBtn = document.getElementById('start-test-btn');
const initialScreen = document.getElementById('initial-screen');
const testContent = document.getElementById('test-content');
const studentNameInput = document.getElementById('student-name');
const studentClassInput = document.getElementById('student-class');
const errorMessage = document.getElementById('error-message');
const blockerScreen = document.getElementById('blocker-screen');

// Елементи модального вікна (результати)
const resultModal = document.getElementById('result-modal');
const modalStudentName = document.getElementById('modal-student-name');
const modalScore = document.getElementById('modal-score');
const modalCorrectCount = document.getElementById('modal-correct-count');
const modalViolations = document.getElementById('modal-violations');
const modalMessage = document.getElementById('modal-message');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalTitle = document.getElementById('modal-title');


// =========================================================================
// ЧАСТИНА 1: СТАРТ ТЕСТУ ТА ЗВ'ЯЗОК З СЕРВЕРОМ
// =========================================================================

/**
 * 1. Відправляє ім'я та клас на сервер.
 * 2. Сервер генерує рандомний варіант і повертає HTML та конфігурацію.
 */
startBtn.addEventListener('click', async () => {
    const name = studentNameInput.value.trim();
    const studentClass = studentClassInput.value.trim();

    if (!name || !studentClass) {
        errorMessage.textContent = "Будь ласка, введіть ім'я та клас.";
        return;
    }
    errorMessage.textContent = '';
    
    // Зберігаємо дані учня
    studentData = { name, studentClass };
    initialScreen.innerHTML = '<h2>Завантаження Вашого Варіанту...</h2>';

    try {
        // !!! ВИКОРИСТАННЯ ВИПРАВЛЕНОГО ШЛЯХУ API_START !!!
        const response = await fetch(API_START, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(studentData)
        });

        if (!response.ok) {
             const errorText = await response.text();
             // Оновлено повідомлення для відображення статусу
             throw new Error(`Помилка сервера при генерації тесту. Статус: ${response.status}. Деталі: ${errorText.substring(0, 100)}...`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        // 1. Збереження конфігурації тесту, отриманої від сервера
        TEST_CONFIG = {
            testId: data.test_id,
            mode: data.mode, 
            maxViolations: data.max_violations
        };
        
        // 2. Вбудовування згенерованого HTML у клієнт
        testContent.innerHTML = data.html_content; 
        
        // 3. Перехід до тесту
        initialScreen.classList.add('hidden-screen');
        testContent.classList.remove('hidden-screen');
        
        // 4. Активація контролю
        activateTestControl();

    } catch (error) {
        console.error("Помилка старту тесту:", error);
        initialScreen.innerHTML = `<h2>Помилка: ${error.message}</h2><button onclick="window.location.reload()">Спробувати знову</button>`;
    }
});


// =========================================================================
// ЧАСТИНА 2: КОНТРОЛЬ ТА ПОРУШЕННЯ
// =========================================================================

/** Встановлює слухачі подій для контролю фокусу та повноекранного режиму. */
function activateTestControl() {
    isTestActive = true;
    enterFullscreen();
    
    // Блокування орієнтації (працює не на всіх пристроях/браузерах)
    if (screen.orientation && screen.orientation.lock) {
         screen.orientation.lock('portrait').catch(e => console.log("Не вдалося заблокувати орієнтацію:", e));
    }

    // Активація контролю фокусу
    document.addEventListener('visibilitychange', handleVisibilityChange, false);
    
    // Встановлення слухача для форми
    const quizForm = document.getElementById('quiz-form');
    if (quizForm) {
        quizForm.addEventListener('submit', handleSubmit);
    }
}

/** Вмикає повноекранний режим */
function enterFullscreen() {
    const element = document.documentElement;
    const requestMethod = element.requestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen || element.msRequestFullscreen;
    if (requestMethod) {
        requestMethod.call(element);
    }
}

/**
 * Логіка реакції на втрату фокусу, залежно від TEST_CONFIG.mode.
 */
function handleVisibilityChange() {
    if (!isTestActive) return;
    const violationCounterDisplay = document.getElementById('violation-counter');

    if (document.visibilityState === 'hidden') {
        violationCount++;
        
        // Надсилання логу порушення на сервер
        sendViolationToServer('Tab_Hidden');
        if (violationCounterDisplay) {
            violationCounterDisplay.textContent = `Спроб виходу: ${violationCount} (Макс: ${TEST_CONFIG.maxViolations})`;
        }

        blockerScreen.classList.remove('hidden-screen');

        // Реакція на порушення, залежно від режиму
        switch (TEST_CONFIG.mode) {
            case 'AUTO_SUBMIT':
                isTestActive = false;
                document.getElementById('blocker-message').textContent = 'ПОРУШЕННЯ! Тест автоматично відправлено на перевірку.';
                // Надсилаємо примусово, але з прапором forced=true
                handleSubmit(null, true); 
                break;
                
            case 'AUTO_FAIL':
                isTestActive = false;
                document.getElementById('blocker-message').textContent = 'ПОРУШЕННЯ! Тест автоматично анульовано (оцінка 1).';
                // Надсилаємо примусово, але з прапором forced=true
                handleSubmit(null, true); 
                break;

            case 'BLOCK_PERM':
                if (violationCount > TEST_CONFIG.maxViolations) {
                    isTestActive = false;
                    document.getElementById('blocker-message').textContent = 'ТЕСТ БЛОКОВАНО! Зверніться до викладача.';
                    sendViolationToServer('Test_Blocked_Perm');
                } else {
                    document.getElementById('blocker-message').textContent = `УВАГА! Ви покинули вкладку. Залишилося спроб: ${TEST_CONFIG.maxViolations - violationCount}`;
                }
                break;

            case 'BLOCK_SCREEN':
            default:
                document.getElementById('blocker-message').textContent = `Ви покинули вкладку. Поверніться, щоб продовжити. Порушень: ${violationCount}`;
                break;
        }
    } else { // 'visible'
        if (isTestActive && (TEST_CONFIG.mode !== 'BLOCK_PERM' || violationCount <= TEST_CONFIG.maxViolations)) {
            blockerScreen.classList.add('hidden-screen');
        }
    }
}

/** Надсилає лог порушення на сервер */
function sendViolationToServer(reason) {
    const logData = {
        test_id: TEST_CONFIG.testId,
        student_name: studentData.name,
        class: studentData.studentClass,
        event_type: reason,
        timestamp: new Date().toISOString(),
        violation_count: violationCount
    };

    // !!! ВИКОРИСТАННЯ ВИПРАВЛЕНОГО ШЛЯХУ API_LOG !!!
    fetch(API_LOG, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
    })
    .catch(error => console.error("Помилка логування порушення:", error));
}

// =========================================================================
// ЧАСТИНА 3: ЗАВЕРШЕННЯ ТА ОЦІНЮВАННЯ
// =========================================================================

/**
 * Збирає відповіді та відправляє на сервер для оцінювання.
 * @param {Event} event Подія відправки форми.
 * @param {boolean} forced Чи був тест відправлений примусово (через списування).
 */
async function handleSubmit(event, forced = false) {
    if (event) event.preventDefault(); 

    // Вимикаємо контроль і приховуємо блокувальник
    isTestActive = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    blockerScreen.classList.add('hidden-screen');

    const quizForm = document.getElementById('quiz-form');
    if (!quizForm) return;

    // Збір відповідей
    const formData = new FormData(quizForm);
    const answers = {};
    for (const [name, value] of formData.entries()) {
        if (name.startsWith('q')) {
            // Ключ: q0, q1, q2... Значення: 0, 1, 2, 3 (індекс обраної відповіді)
            answers[name] = value; 
        }
    }

    const finalData = {
        test_id: TEST_CONFIG.testId,
        student_name: studentData.name,
        class: studentData.studentClass,
        answers: answers, 
        total_violations: violationCount,
        forced_submit: forced 
    };

    // Приховуємо форму та показуємо екран очікування
    testContent.innerHTML = '<div class="container"><h2>Обробка результатів на сервері...</h2></div>';


    try {
        // !!! ВИКОРИСТАННЯ ВИПРАВЛЕНОГО ШЛЯХУ API_SUBMIT !!!
        const response = await fetch(API_SUBMIT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalData)
        });

        if (!response.ok) {
             const errorText = await response.text();
             throw new Error(`HTTP error! Status: ${response.status}. Деталі: ${errorText.substring(0, 100)}...`);
        }

        const data = await response.json();
        
        showResultsModal(
            studentData.name, 
            data.score_12.toString() || "N/A", 
            data.correct_count.toString() || "N/A",
            finalData.total_violations, 
            data.message || ""
        );

    } catch (error) {
        console.error("Помилка відправки результатів:", error);
        showResultsModal(
            studentData.name, 
            "Помилка", 
            "N/A",
            finalData.total_violations, 
            `Не вдалося отримати оцінку від сервера: ${error.message}`
        );
    }
}

/** Відображає модальне вікно з фінальною оцінкою. */
function showResultsModal(name, score_12, correct_count, violations, message) {
    modalStudentName.textContent = name;
    modalScore.textContent = score_12; 
    modalCorrectCount.textContent = correct_count;
    modalViolations.textContent = violations;
    modalMessage.textContent = message;
    
    // Логіка кольору оцінки
    if (score_12 === 'Анульовано' || score_12 === '1' || score_12 === '2') {
        modalScore.style.color = 'darkred';
        modalTitle.textContent = 'Тест Завершено (Анульовано)!';
    } else {
        const numericScore = parseInt(score_12);
        modalScore.style.color = (numericScore >= 10) ? 'green' : (numericScore >= 7) ? 'orange' : 'red';
        modalTitle.textContent = 'Результати Тестування';
    }

    testContent.classList.add('hidden-screen');
    resultModal.classList.remove('hidden-screen'); 
}


// --- Ініціалізація та обробники ---
closeModalBtn.addEventListener('click', () => {
    window.location.reload(); 
});