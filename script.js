// --- IMPORTANT: Paste your Pexels API Key here ---
const pexelsApiKey = 'kvdJ40N3zriQrKtu1NV86lDp3rYIRJXz2eLBW6mo1qd6bsK8vuZ1zQr5';

// --- DOM Elements ---
const imageContainer = document.getElementById('image-container');
const meditationTextContainer = document.getElementById('meditation-text');
const overlay = document.getElementById('overlay');
const controlsPanel = document.getElementById('controls-panel');
const displayModeSelect = document.getElementById('display-mode');
const manualDisplayGroup = document.getElementById('manual-display-group');
const intervalModeSelect = document.getElementById('interval-mode');
const manualIntervalGroup = document.getElementById('manual-interval-group');
const uploadButton = document.getElementById('upload-button');
const photoUploadInput = document.getElementById('photo-upload');
const startStopButton = document.getElementById('start-stop-button');
const viewPhotosButton = document.getElementById('view-photos-button');
const clearPhotosButton = document.getElementById('clear-photos-button');
const galleryOverlay = document.getElementById('gallery-overlay');
const closeGalleryButton = document.getElementById('close-gallery-button');
const photoGallery = document.getElementById('photo-gallery');
const meditationToggleButton = document.getElementById('meditation-toggle-button');
const meditationWordInput = document.getElementById('meditation-word');
const breathingDurationInput = document.getElementById('breathing-duration');
const polaroidToggle = document.getElementById('polaroid-toggle');
const blackAndWhiteToggle = document.getElementById('color-toggle');

// --- Global State Variables ---
let images = []; // Holds all images: user-uploaded and Pexels.
let currentIndex = 0;
let timerId = null;
let gapTimerId = null;
let isBlackAndWhite = false;
let isPaused = true;
const cacheSize = 25;
let runCounter = 0;
let isFetchingImages = false;
let isMeditationMode = false;
let meditationAnimationId;
let db;
const DB_NAME = 'screensaver_db';
const STORE_NAME = 'photos';
let wakeLock = null;

// --- IndexedDB Functions ---
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        
        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database opened successfully");
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            console.log("Object store created");
        };
    });
}

function addImagesToDB(files) {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    files.forEach(file => {
        store.add({ blob: file });
    });

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            console.log("Images added to IndexedDB");
            resolve();
        };
        transaction.onerror = (event) => reject(event.target.error);
    });
}

function getImagesFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error("Database not open.");
            resolve([]);
            return;
        }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => {
            const items = event.target.result;
            const dataUrls = items.map(item => ({
                id: item.id,
                url: URL.createObjectURL(item.blob)
            }));
            resolve(dataUrls);
        };

        request.onerror = (event) => reject(event.target.error);
    });
}

function clearDatabase() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

function deleteImageFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

// --- Screensaver Logic ---
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[currentIndex], array[randomIndex]];
    }
    return array;
}

async function fetchAndCacheImages() {
    if (isFetchingImages) return;
    isFetchingImages = true;

    try {
        const response = await fetch(`https://api.pexels.com/v1/curated?per_page=${cacheSize}`, {
            headers: { Authorization: pexelsApiKey }
        });
        const data = await response.json();
        
        const newImages = data.photos.map(photo => ({ id: null, url: photo.src.original }));
        
        const uniquePexels = newImages.filter(newImg => !images.some(existingImg => existingImg.url === newImg.url));
        
        images = shuffle([...images, ...uniquePexels]);
    } catch (error) {
        console.error(error);
        imageContainer.innerHTML = '<p style="color:white;text-align:center;padding-top:50vh;">Error fetching images. Please check your API key.</p>';
    } finally {
        isFetchingImages = false;
    }
}

function startScreensaver() {
    if (images.length === 0) {
        imageContainer.innerHTML = '<p style="color:white;text-align:center;padding-top:50vh;">No images available. Please upload some or check your internet connection.</p>';
        return;
    }
    isPaused = false;
    runCounter++;
    showNextImage();
}

function showNextImage() {
    if (isPaused) return;
    if (timerId) {
        clearTimeout(timerId);
        timerId = null;
    }
    if (gapTimerId) {
        clearTimeout(gapTimerId);
        gapTimerId = null;
    }

    const oldImage = imageContainer.querySelector('.active');
    if (oldImage) {
        oldImage.classList.remove('active');
        setTimeout(() => oldImage.remove(), 1000);
    }
    
    const hasUserPhotos = images.some(img => img.id !== null);
    if (!hasUserPhotos) {
        const remainingPexelsImages = images.slice(currentIndex).filter(img => img.id === null);
        if (remainingPexelsImages.length < 5 && !isFetchingImages) {
            fetchAndCacheImages();
        }
    }
    
    const imageUrl = images[currentIndex].url;
    
    // Create the image element first
    const newImage = new Image();
    newImage.src = imageUrl;
    newImage.alt = "Screensaver Image";
    
    // Apply special effects directly to the image
    if (isBlackAndWhite) {
        newImage.classList.add('black-and-white');
    }
    
    const effect = Math.random();
    if (effect < 0.33) {
        newImage.classList.add('zoom-in-animation');
    } else if (effect < 0.66) {
        newImage.classList.add('zoom-out-animation');
    }

    let finalElement;
    if (polaroidToggle.checked) {
        // Wrap the image in a div for the polaroid effect
        const wrapper = document.createElement('div');
        wrapper.classList.add('polaroid');
        wrapper.appendChild(newImage);
        finalElement = wrapper;
    } else {
        finalElement = newImage;
    }
    
    // Add the active class to the final element being appended
    finalElement.classList.add('active');

    imageContainer.appendChild(finalElement);

    currentIndex = (currentIndex + 1) % images.length;
    
    let photoDisplayTime;
    let gapTime;

    if (displayModeSelect.value === 'random') {
        const minPhotoTime = 9000;
        const maxPhotoTime = 18000;
        photoDisplayTime = Math.floor(Math.random() * (maxPhotoTime - minPhotoTime + 1) + minPhotoTime);
    } else {
        const manualDisplayInput = document.getElementById('manual-display-time');
        photoDisplayTime = parseInt(manualDisplayInput.value) * 1000;
    }

    if (intervalModeSelect.value === 'random') {
        const minGapTime = 12000;
        const maxGapTime = 20000;
        gapTime = Math.floor(Math.random() * (maxGapTime - minGapTime + 1) + minGapTime);
    } else {
        const manualIntervalInput = document.getElementById('manual-interval-time');
        gapTime = parseInt(manualIntervalInput.value) * 1000;
    }

    if (isPaused) return;

    timerId = setTimeout(() => {
        imageContainer.style.opacity = 0;
        gapTimerId = setTimeout(() => {
            imageContainer.style.opacity = 1;
            gapTimerId = null;
            if (!isPaused) showNextImage();
        }, gapTime);
        timerId = null;
    }, photoDisplayTime);
}

// --- Meditation Mode Logic ---
function startMeditationMode() {
    isPaused = false;
    imageContainer.style.display = 'none';
    meditationTextContainer.style.display = 'block';

    const word = meditationWordInput.value || 'Breathe';
    meditationTextContainer.textContent = word;

    const duration = parseInt(breathingDurationInput.value, 10);
    document.documentElement.style.setProperty('--breathing-duration', `${duration}s`);
    meditationTextContainer.style.animation = `breathing-animation ${duration}s ease-in-out infinite`;
}

// --- Core Screensaver Toggle Function ---
async function toggleScreensaver() {
    if (isPaused) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("Wake Lock acquired successfully.");
        } catch (err) {
            console.error(`Wake Lock request failed: ${err.name}, ${err.message}`);
        }

        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
        
        overlay.style.display = 'none';
        controlsPanel.style.opacity = 0;
        controlsPanel.style.pointerEvents = 'none';
        
        startStopButton.textContent = 'Stop';

        if (isMeditationMode) {
            startMeditationMode();
        } else {
            startScreensaver();
        }
    } else {
        isPaused = true;
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }
        if (gapTimerId) {
            clearTimeout(gapTimerId);
            gapTimerId = null;
        }
        if (meditationAnimationId) {
            clearInterval(meditationAnimationId);
            meditationAnimationId = null;
            meditationTextContainer.style.animation = '';
        }

        runCounter++;
        imageContainer.innerHTML = '';
        imageContainer.style.display = 'block';
        meditationTextContainer.style.display = 'none';
        
        overlay.style.display = 'block';
        startStopButton.textContent = 'Start';
        controlsPanel.style.opacity = 1;
        controlsPanel.style.pointerEvents = 'auto';
        
        if (wakeLock !== null) {
            try {
                await wakeLock.release();
                wakeLock = null;
                console.log("Wake Lock released successfully.");
            } catch (err) {
                console.error(`Wake Lock release failed: ${err.name}, ${err.message}`);
            }
        }

        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// --- Gallery Logic ---
async function renderGallery() {
    photoGallery.innerHTML = '';
    const userPhotos = await getImagesFromDB();
    if (userPhotos.length === 0) {
        photoGallery.innerHTML = '<p style="color:white;text-align:center;">You have no photos uploaded yet.</p>';
        return;
    }
    const isPolaroidActive = polaroidToggle.checked;

    userPhotos.forEach(photo => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        
        if (isPolaroidActive) {
            item.classList.add('polaroid');
        }
        
        item.innerHTML = `<img src="${photo.url}" alt="Uploaded Photo">
                          <button class="delete-button" data-id="${photo.id}">x</button>`;
        photoGallery.appendChild(item);
    });
}

// --- Event Listeners ---
startStopButton.addEventListener('click', toggleScreensaver);

meditationToggleButton.addEventListener('click', () => {
    isMeditationMode = !isMeditationMode;
    meditationToggleButton.textContent = isMeditationMode ? 'Exit Meditation Mode' : 'Toggle Meditation Mode';
    meditationToggleButton.classList.toggle('active', isMeditationMode);
    startStopButton.textContent = isMeditationMode ? 'Start Meditation' : 'Start';
});

// Added event listener for touch, mouse, and device motion
document.addEventListener('touchstart', (event) => {
    if (!isPaused) {
        toggleScreensaver();
    }
}, { passive: true });

const movementThreshold = 10;
let lastAcceleration = { x: 0, y: 0, z: 0 };
window.addEventListener('devicemotion', (event) => {
    if (!isPaused && event.accelerationIncludingGravity) {
        const { x, y, z } = event.accelerationIncludingGravity;
        const dx = Math.abs(x - lastAcceleration.x);
        const dy = Math.abs(y - lastAcceleration.y);
        const dz = Math.abs(z - lastAcceleration.z);

        if (dx > movementThreshold || dy > movementThreshold || dz > movementThreshold) {
            toggleScreensaver();
        }
        lastAcceleration = { x, y, z };
    }
});

// For desktop, the screensaver will now only exit on a deliberate click.
// The too-sensitive mousemove listener has been removed.
document.addEventListener('click', (event) => {
    if (event.detail === 1) {
        if (controlsPanel.contains(event.target) || galleryOverlay.contains(event.target) || overlay.contains(event.target)) return;
        toggleScreensaver();
    }
});

uploadButton.addEventListener('click', () => {
    photoUploadInput.click();
});

photoUploadInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        await addImagesToDB(Array.from(files));
        const userImages = await getImagesFromDB();
        images = shuffle(userImages);
        
        if (!isPaused) {
            toggleScreensaver();
        }
    }
});

viewPhotosButton.addEventListener('click', async () => {
    isPaused = true;
    if (timerId) {
        clearTimeout(timerId);
        timerId = null;
    }
    if (gapTimerId) {
        clearTimeout(gapTimerId);
        gapTimerId = null;
    }
    runCounter++;
    imageContainer.innerHTML = '';
    galleryOverlay.style.display = 'flex';
    controlsPanel.style.opacity = 0;
    controlsPanel.style.pointerEvents = 'none';
    await renderGallery();
});

closeGalleryButton.addEventListener('click', () => {
    galleryOverlay.style.display = 'none';
    if (!isPaused) {
        toggleScreensaver();
    } else {
        controlsPanel.style.opacity = 1;
        controlsPanel.style.pointerEvents = 'auto';
    }
});

clearPhotosButton.addEventListener('click', async () => {
    await clearDatabase();
    images = [];
    await fetchAndCacheImages();
});

photoGallery.addEventListener('click', async (event) => {
    if (event.target.classList.contains('delete-button')) {
        const id = parseInt(event.target.dataset.id);
        await deleteImageFromDB(id);
        const userImages = await getImagesFromDB();
        const pexelsImages = images.filter(img => img.id === null);
        images = shuffle([...userImages, ...pexelsImages]);
        renderGallery();
    }
});

polaroidToggle.addEventListener('change', () => {
    renderGallery();
});

blackAndWhiteToggle.addEventListener('click', () => {
    isBlackAndWhite = !isBlackAndWhite;
    blackAndWhiteToggle.textContent = isBlackAndWhite ? 'Color Mode' : 'Black & White';
    const activeImage = imageContainer.querySelector('.active');
    if (activeImage) {
        if (isBlackAndWhite) {
            activeImage.classList.add('black-and-white');
        } else {
            activeImage.classList.remove('black-and-white');
        }
    }
});

document.addEventListener('visibilitychange', async () => {
    if (!isPaused && document.visibilityState === 'hidden') {
        toggleScreensaver();
    }
    if (wakeLock !== null && document.visibilityState === 'visible') {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("Wake Lock re-acquired.");
        } catch (err) {
            console.error(`Wake Lock re-acquisition failed: ${err.name}, ${err.message}`);
        }
    }
});

async function initializeApp() {
    await openDatabase();
    const userImages = await getImagesFromDB();
    if (userImages.length > 0) {
        images = userImages;
    } else {
        await fetchAndCacheImages();
    }
    startStopButton.textContent = 'Start';
}

initializeApp();

displayModeSelect.addEventListener('change', () => {
    if (displayModeSelect.value === 'manual') {
        manualDisplayGroup.style.display = 'flex';
    } else {
        manualDisplayGroup.style.display = 'none';
    }
    if (!isPaused) {
        toggleScreensaver();
    }
});

intervalModeSelect.addEventListener('change', () => {
    if (intervalModeSelect.value === 'manual') {
        manualIntervalGroup.style.display = 'flex';
    } else {
        manualIntervalGroup.style.display = 'none';
    }
    if (!isPaused) {
        toggleScreensaver();
    }
});

displayModeSelect.dispatchEvent(new Event('change'));
intervalModeSelect.dispatchEvent(new Event('change'));
