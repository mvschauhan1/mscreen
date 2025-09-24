// --- IMPORTANT: Paste your Pexels API Key here ---
const pexelsApiKey = 'kvdJ40N3zriQrKtu1NV86lDp3rYIRJXz2eLBW6mo1qd6bsK8vuZ1zQr5';


const imageContainer = document.getElementById('image-container');
const privacyOverlay = document.getElementById('privacy-overlay');
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

let images = []; // We will now make sure this array is consistent
let currentIndex = 0;
let timerId;
let gapTimerId = null;
let isBlackAndWhite = false;
let isPaused = true; // Set to true to start in a paused state
let cachedImages = []; // This is now a temporary variable for managing data
const cacheSize = 25;
let runCounter = 0;
let currentRunId = 0;

let db;
const DB_NAME = 'screensaver_db';
const STORE_NAME = 'photos';

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
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

async function fetchAndCacheImages() {
    try {
        const response = await fetch(`https://api.pexels.com/v1/curated?per_page=${cacheSize}`, {
            headers: { Authorization: pexelsApiKey }
        });
        const data = await response.json();
        const newImages = data.photos.map(photo => ({ id: null, url: photo.src.original }));
        
        // This is a temp array for the purpose of this function
        const userImages = images.filter(img => img.id !== null);
        const pexelsImages = images.filter(img => img.id === null);

        const uniquePexels = newImages.filter(newImg => !pexelsImages.some(existingImg => existingImg.url === newImg.url));
        
        images = shuffle([...userImages, ...pexelsImages, ...uniquePexels]);
    } catch (error) {
        console.error(error);
        // This error message will be displayed until the user starts the screensaver
        imageContainer.innerHTML = '<p style="color:white;text-align:center;padding-top:50vh;">Error fetching images. Please check your API key.</p>';
    }
}

function startScreensaver() {
    if (images.length === 0) {
        // Handle case where no images (user uploaded or Pexels) are available
        imageContainer.innerHTML = '<p style="color:white;text-align:center;padding-top:50vh;">No images available. Please upload some or check your internet connection.</p>';
        return;
    }
    isPaused = false;
    // mark a new run to invalidate previous async actions
    currentRunId = ++runCounter;
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
    
    let imageUrl;
    // ✅ Use the 'images' array for consistency
    if (Math.random() < 0.2 && images.length > 5) {
        fetchNewImageAndDisplay();
        return;
    } else {
        // ✅ Use the 'images' array for consistency
        const randomIndex = Math.floor(Math.random() * images.length);
        imageUrl = images[randomIndex].url;
    }
    
    const newImage = new Image();
    newImage.src = imageUrl;
    newImage.classList.add('active');

    if (isBlackAndWhite) {
        newImage.classList.add('black-and-white');
    }
    
    const effect = Math.random();
    if (effect < 0.33) {
        newImage.classList.add('zoom-in-animation');
    } else if (effect < 0.66) {
        newImage.classList.add('zoom-out-animation');
    }
    
    imageContainer.appendChild(newImage);

    // This line is now consistent
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

    // If user paused while we were preparing the next image, bail out now
    if (isPaused) return;

    timerId = setTimeout(() => {
        imageContainer.style.opacity = 0;
        // store inner gap timer so we can cancel it when stopping
        gapTimerId = setTimeout(() => {
            imageContainer.style.opacity = 1;
            gapTimerId = null;
            if (!isPaused) showNextImage();
        }, gapTime);
        timerId = null;
    }, photoDisplayTime);
}

// And in fetchNewImageAndDisplay as well
async function fetchNewImageAndDisplay() {
    const thisRunId = currentRunId;
    try {
        const response = await fetch('https://api.pexels.com/v1/curated?per_page=1', {
            headers: { Authorization: pexelsApiKey }
        });
        const data = await response.json();
        if (thisRunId !== currentRunId) return; // cancelled
        const newImageUrl = data.photos[0].src.original;
        // ✅ Add to the 'images' array
        images.push({ id: null, url: newImageUrl });
        if (thisRunId !== currentRunId) return;
        showNextImageWithUrl(newImageUrl);
    } catch (error) {
        console.error("Failed to fetch new random image.");
        if (thisRunId !== currentRunId) return;
        showNextImage();
    }
}

function showNextImageWithUrl(url) {
    if (isPaused) return;
    const thisRunId = currentRunId;
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
    
    const newImage = new Image();
    newImage.src = url;
    newImage.classList.add('active');
    if (isBlackAndWhite) {
        newImage.classList.add('black-and-white');
    }
    
    const effect = Math.random();
    if (effect < 0.33) {
        newImage.classList.add('zoom-in-animation');
    } else if (effect < 0.66) {
        newImage.classList.add('zoom-out-animation');
    }
    
    imageContainer.appendChild(newImage);
    if (thisRunId !== currentRunId) return;
    showNextImage();
}

function toggleScreensaver() {
    if (isPaused) {
        // ✅ MOVE THE FULLSCREEN REQUEST TO THE TOP
        const element = document.documentElement;
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) { /* Firefox */
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) { /* IE/Edge */
            element.msRequestFullscreen();
        }
        
        // Now, proceed with the rest of the UI changes
        privacyOverlay.style.display = 'none';
        controlsPanel.style.opacity = 0; // Hide the panel
        controlsPanel.style.pointerEvents = 'none'; // Make it unclickable
        
        startStopButton.textContent = 'Stop';
        startScreensaver();
    } else {
        isPaused = true;
        // Clear any running timers
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }
        if (gapTimerId) {
            clearTimeout(gapTimerId);
            gapTimerId = null;
        }
        // Invalidate any in-flight async operations
        currentRunId = ++runCounter;
        // Clear displayed images immediately
        imageContainer.innerHTML = '';
        privacyOverlay.style.display = 'block';
        startStopButton.textContent = 'Start';
        controlsPanel.style.opacity = 1; // Show the panel
        controlsPanel.style.pointerEvents = 'auto'; // Make it clickable
        
        // Exit full-screen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { /* Firefox */
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE/Edge */
            document.msExitFullscreen();
        }
    }
}

async function renderGallery() {
    photoGallery.innerHTML = '';
    const userPhotos = await getImagesFromDB();
    if (userPhotos.length === 0) {
        photoGallery.innerHTML = '<p style="color:white;text-align:center;">You have no photos uploaded yet.</p>';
        return;
    }
    userPhotos.forEach(photo => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `<img src="${photo.url}" alt="Uploaded Photo">
                          <button class="delete-button" data-id="${photo.id}">x</button>`;
        photoGallery.appendChild(item);
    });
}

// --- Event Listeners ---

startStopButton.addEventListener('click', toggleScreensaver);

// Toggle screensaver when clicking outside the controls panel and gallery.
// This preserves the UX of clicking the background to start/stop, but prevents
// accidental toggles when interacting with UI elements.
document.addEventListener('click', (event) => {
    if (event.detail === 1) {
        // If the click target is inside the controls panel or the gallery overlay, ignore it
        if (controlsPanel.contains(event.target) || galleryOverlay.contains(event.target)) return;
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
        // ✅ Now that we have user photos, override the 'images' array completely
        images = shuffle(userImages);
        
        if (!isPaused) {
            startScreensaver();
        }
    }
});

viewPhotosButton.addEventListener('click', async () => {
    // Fully stop the screensaver before opening gallery
    isPaused = true;
    if (timerId) {
        clearTimeout(timerId);
        timerId = null;
    }
    if (gapTimerId) {
        clearTimeout(gapTimerId);
        gapTimerId = null;
    }
    // Invalidate in-flight async work
    currentRunId = ++runCounter;
    // Clear displayed images immediately
    imageContainer.innerHTML = '';
    galleryOverlay.style.display = 'flex';
    controlsPanel.style.opacity = 0;
    controlsPanel.style.pointerEvents = 'none';
    await renderGallery();
});

closeGalleryButton.addEventListener('click', () => {
    galleryOverlay.style.display = 'none';
    if (!isPaused) {
        startScreensaver();
    } else {
        controlsPanel.style.opacity = 1;
        controlsPanel.style.pointerEvents = 'auto';
    }
});

clearPhotosButton.addEventListener('click', async () => {
    await clearDatabase();
    images = [];
    await fetchAndCacheImages(); // ✅ Call fetch to get the Pexels fallback
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

document.getElementById('color-toggle').addEventListener('click', () => {
    isBlackAndWhite = !isBlackAndWhite;
    document.getElementById('color-toggle').textContent = isBlackAndWhite ? 'Color Mode' : 'Black & White';
    const activeImage = imageContainer.querySelector('.active');
    if (activeImage) {
        if (isBlackAndWhite) {
            activeImage.classList.add('black-and-white');
        } else {
            activeImage.classList.remove('black-and-white');
        }
    }
});


async function initializeApp() {
    await openDatabase();
    const userImages = await getImagesFromDB();
    if (userImages.length > 0) {
        images = userImages; // ✅ Set images to be ONLY the user photos
    } else {
        // ✅ If no user photos, then get Pexels images
        await fetchAndCacheImages();
    }
    startStopButton.textContent = 'Start';
}

initializeApp();

// Add these listeners to your script.js file

displayModeSelect.addEventListener('change', () => {
    console.log('Display mode changed to:', displayModeSelect.value); // Added for debugging
    if (displayModeSelect.value === 'manual') {
        // Clear the inline display so the CSS rule (.control-group { display: flex }) applies
        manualDisplayGroup.style.display = '';
    } else {
        manualDisplayGroup.style.display = 'none';
    }
    // This part of your existing code is correct for restarting the screensaver.
    if (!isPaused) {
        startScreensaver();
    }
});

intervalModeSelect.addEventListener('change', () => {
    console.log('Interval mode changed to:', intervalModeSelect.value); // Added for debugging
    if (intervalModeSelect.value === 'manual') {
        // Clear the inline display so the CSS rule (.control-group { display: flex }) applies
        manualIntervalGroup.style.display = '';
    } else {
        manualIntervalGroup.style.display = 'none';
    }
    // This part of your existing code is correct for restarting the screensaver.
    if (!isPaused) {
        startScreensaver();
    }
});

// Ensure manual control groups reflect the current select values on initial load
displayModeSelect.dispatchEvent(new Event('change'));
intervalModeSelect.dispatchEvent(new Event('change'));
