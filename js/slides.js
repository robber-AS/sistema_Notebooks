// Slide Navigation
let currentSlide = 1;
const totalSlides = 15;

const slides = document.querySelectorAll('.slide');
const indicators = document.querySelectorAll('.indicator');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const currentSlideEl = document.getElementById('currentSlide');
const totalSlidesEl = document.getElementById('totalSlides');

totalSlidesEl.textContent = totalSlides;

function updateSlide() {
    // Update slides
    slides.forEach(slide => {
        slide.classList.remove('active');
        if (parseInt(slide.dataset.slide) === currentSlide) {
            slide.classList.add('active');
        }
    });
    
    // Update indicators
    indicators.forEach(indicator => {
        indicator.classList.remove('active');
        if (parseInt(indicator.dataset.slide) === currentSlide) {
            indicator.classList.add('active');
        }
    });
    
    // Update counter
    currentSlideEl.textContent = currentSlide;
    
    // Update buttons
    prevBtn.disabled = currentSlide === 1;
    nextBtn.disabled = currentSlide === totalSlides;
}

// Event Listeners
prevBtn.addEventListener('click', () => {
    if (currentSlide > 1) {
        currentSlide--;
        updateSlide();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentSlide < totalSlides) {
        currentSlide++;
        updateSlide();
    }
});

// Indicator clicks
indicators.forEach(indicator => {
    indicator.addEventListener('click', () => {
        currentSlide = parseInt(indicator.dataset.slide);
        updateSlide();
    });
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        if (currentSlide < totalSlides) {
            currentSlide++;
            updateSlide();
        }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentSlide > 1) {
            currentSlide--;
            updateSlide();
        }
    } else if (e.key === 'Home') {
        currentSlide = 1;
        updateSlide();
    } else if (e.key === 'End') {
        currentSlide = totalSlides;
        updateSlide();
    }
});

// Touch support
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, false);

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0 && currentSlide < totalSlides) {
            // Swipe left - next slide
            currentSlide++;
            updateSlide();
        } else if (diff < 0 && currentSlide > 1) {
            // Swipe right - previous slide
            currentSlide--;
            updateSlide();
        }
    }
}

// Initialize
updateSlide();
