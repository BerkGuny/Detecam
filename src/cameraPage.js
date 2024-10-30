document.addEventListener('DOMContentLoaded', function() {
    const imageElement = document.getElementById('camera-image');
    const azureFunctionUrl = 'http://localhost:7071/api/fonksiyonum-kameram';
    const containerelectronSasToken = ' ';
    const processedelectronSasToken = ' ';
    let fetchInterval;
    let pollingInterval;
    let processedBlobsCache = new Set();
    let sidebarMode = 'classes';
    let selectedClass = null;
    let parameters = {};
    let isReceivingFrames = true;
    let currentImage;

    const colorMap = {
        blue: 'rgba(0, 0, 255, 0.1)',
        green: 'rgba(0, 255, 0, 0.1)',
        red: 'rgba(255, 0, 0, 0.1)',
        yellow: 'rgba(255, 255, 0, 0.1)',
        black: 'rgba(0, 0, 0, 0.1)',
        white: 'rgba(255, 255, 255, 0.1)'
    };

    function manageButtonsVisibility(isImagePresent, isReceivingFrames = true) {
        const displayValue = isImagePresent ? 'inline' : 'none';
        document.getElementById('continue-frame').style.display = isReceivingFrames ? 'none' : 'inline';
        document.getElementById('zoom-in').style.display = displayValue;
        document.getElementById('zoom-out').style.display = displayValue;
        document.getElementById('sharpen').style.display = displayValue;
        document.getElementById('detect').style.display = displayValue;
        document.getElementById('stop-frame').style.display = isReceivingFrames ? displayValue : 'none';
    }

    function resetParameters() {
        parameters = {};
        console.log('Parameters have been reset');
    }

    function showSidebar(detectedClasses) {
        if (sidebarMode !== 'classes') return;
        const sidebar = document.getElementById('sidebar');
        const sidebarContent = document.getElementById('sidebar-content');
        const classNames = detectedClasses.split('_').filter(cls => cls && !cls.match(/processed|^\d+$/));
        classNames.push('Others');
        sidebarContent.innerHTML = 'Detected Classes:<br>' + classNames.map(cls => `<span class="class-name">${cls}</span>`).join('<br>');
        sidebar.style.width = '250px';
        sidebarMode = 'classes';
    }

    function showClassOptions(className) {
        selectedClass = className;
        const sidebarContent = document.getElementById('sidebar-content');
        document.getElementById('sidebar-title').innerText = className;
        sidebarContent.innerHTML = `
            <div class="class-option">Color</div>
            <div class="class-option">Blur</div>
            <div class="class-option">Zoom In</div>
            <div class="class-option">Reset</div> 
        `;
        sidebarMode = 'options';
    }

    function showColorOptions() {
        const sidebarContent = document.getElementById('sidebar-content');
        sidebarContent.innerHTML = `
            <div class="color-option" style="color: blue;">Blue</div>
            <div class="color-option" style="color: green;">Green</div>
            <div class="color-option" style="color: red;">Red</div>
            <div class="color-option" style="color: yellow;">Yellow</div>
            <div class="color-option" style="color: black;">Black</div>
            <div class="color-option" style="color: white;">White</div>
            <div class="class-option">Reset</div>
        `;
    }

    function applyColorToClass(color) {
        console.log(`Applying color ${color} to class ${selectedClass}`);
        if (!parameters[selectedClass]) {
            parameters[selectedClass] = { color: 'none', blur: false, sharpen: false, zoom: false, rects: [] };
        }
        parameters[selectedClass].color = color;
        console.log(`Updated parameters: ${JSON.stringify(parameters)}`);
    }

    function resetClassParameters() {
        console.log(`Resetting parameters for class ${selectedClass}`);
        if (parameters[selectedClass]) {
            parameters[selectedClass] = { color: 'none', blur: false, sharpen: false, zoom: false, rects: [] };
        }
        console.log(`Updated parameters: ${JSON.stringify(parameters)}`);
    }
    

    function applyBlurToClass() {
        console.log(`Applying blur to class ${selectedClass}`);
        if (!parameters[selectedClass]) {
            parameters[selectedClass] = { color: 'none', blur: false, sharpen: false, zoom: false, rects: [] };
        }
        parameters[selectedClass].blur = true;
        console.log(`Updated parameters: ${JSON.stringify(parameters)}`);
    }

    function applyZoomToClass(zoomIn = true) {
        console.log(`Applying ${zoomIn ? 'zoom in' : 'zoom out'} to class ${selectedClass}`);
        if (!parameters[selectedClass]) {
            parameters[selectedClass] = { color: 'none', blur: false, sharpen: false, zoom: false, rects: [] };
        }
        parameters[selectedClass].zoom = zoomIn;
        console.log(`Updated parameters: ${JSON.stringify(parameters)}`);
    }

    function parseBlobName(blobName) {
        const regex = /processed(?:_(face|human)_\d+_\d+_\d+_\d+)+/g;
        const matches = [...blobName.matchAll(regex)];
        const rects = [];
        matches.forEach(match => {
            const parts = match[0].split('_');
            for (let i = 1; i < parts.length; i += 5) {
                const className = parts[i];
                const x = parseInt(parts[i + 1], 10);
                const y = parseInt(parts[i + 2], 10);
                const width = parseInt(parts[i + 3], 10) - x;
                const height = parseInt(parts[i + 4], 10) - y;
                rects.push({ className, x, y, width, height });
            }
        });
        return rects;
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.style.width = '0';
        sidebarMode = 'classes';
        selectedClass = null;
    }

    function fetchAndDisplayImage() {
        const userPassword = window.api.getUserPassword();
        const prefix = `${userPassword}_camera_id_`;
        const listBlobsUrl = `https://storageelectron.blob.core.windows.net/containerelectron?restype=container&comp=list&prefix=${prefix}&${containerelectronSasToken}`;

        console.log(`Fetching blobs from URL: ${listBlobsUrl}`);

        fetch(listBlobsUrl)
            .then(response => response.text())
            .then(str => {
                console.log('Response from list blobs:', str);
                return (new window.DOMParser()).parseFromString(str, "text/xml");
            })
            .then(data => {
                const blobs = Array.from(data.querySelectorAll('Blob'))
                    .map(blob => blob.querySelector('Name').textContent)
                    .filter(name => name.startsWith(`${userPassword}_`) && name.endsWith('.jpg'))
                    .map(name => `https://storageelectron.blob.core.windows.net/containerelectron/${name}?${containerelectronSasToken}`)
                    .slice(-1);

                console.log(`Blobs found: ${blobs.length}`, blobs);

                if (blobs.length > 0) {
                    imageElement.src = blobs[0];
                    imageElement.onload = () => {
                        currentImage = imageElement.cloneNode(true);
                        applyParams(imageElement); // Apply parameters after loading the image
                    };
                    manageButtonsVisibility(true, isReceivingFrames);
                } else {
                    console.log('No new images found.');
                    manageButtonsVisibility(false);
                }
            })
            .catch(error => {
                console.error('Failed to list blobs:', error);
                manageButtonsVisibility(false);
            });
    }

    function applyParams(imageElement) {
        console.log('Inside applyParams');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = imageElement.width;
        canvas.height = imageElement.height;
        context.drawImage(imageElement, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const rectangles = Object.values(parameters).flatMap(param => param.rects);

        Object.keys(parameters).forEach(className => {
            const params = parameters[className];
            console.log(`Applying params for ${className}: ${JSON.stringify(params)}`);

            if (params.color !== 'none') {
                console.log('Color is not none');
                const color = colorMap[params.color];
                const [r, g, b, a] = color.replace(/[^\d,]/g, '').split(',').map(Number);
                console.log('Map looked, color:', { r, g, b, a });

                const rects = params.rects || [];
                if (className === 'Others') {
                    console.log('Applying color to non-rectangle areas');
                    for (let y = 0; y < canvas.height; y++) {
                        for (let x = 0; x < canvas.width; x++) {
                            let insideRect = false;
                            rectangles.forEach(rect => {
                                if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) {
                                    insideRect = true;
                                }
                            });
                            if (!insideRect) {
                                const index = (y * canvas.width + x) * 4;
                                data[index] = Math.round(data[index] * (1 - a) + r * a);
                                data[index + 1] = Math.round(data[index + 1] * (1 - a) + g * a);
                                data[index + 2] = Math.round(data[index + 2] * (1 - a) + b * a);
                            }
                        }
                    }
                } else {
                    console.log('Applying color to rectangles');
                    rects.forEach(rect => {
                        console.log(`Applying color rgba(${r}, ${g}, ${b}, ${a}) to rectangle: ${JSON.stringify(rect)}`);
                        for (let y = rect.y; y < rect.y + rect.height; y++) {
                            for (let x = rect.x; x < rect.x + rect.width; x++) {
                                const index = (y * canvas.width + x) * 4;
                                data[index] = Math.round(data[index] * (1 - a) + r * a);
                                data[index + 1] = Math.round(data[index + 1] * (1 - a) + g * a);
                                data[index + 2] = Math.round(data[index + 2] * (1 - a) + b * a);
                            }
                        }
                    });
                }
            }

            if (params.blur) {
                console.log('Applying blur');
                const weights = [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9];
                const side = Math.round(Math.sqrt(weights.length));
                const halfSide = Math.floor(side / 2);

                for (let y = halfSide; y < canvas.height - halfSide; y++) {
                    for (let x = halfSide; x < canvas.width - halfSide; x++) {
                        let r = 0, g = 0, b = 0;
                        for (let ky = -halfSide; ky <= halfSide; ky++) {
                            for (let kx = -halfSide; kx <= halfSide; kx++) {
                                const i = ((y + ky) * canvas.width + (x + kx)) * 4;
                                const weight = weights[(ky + halfSide) * side + (kx + halfSide)];
                                r += data[i] * weight;
                                g += data[i + 1] * weight;
                                b += data[i + 2] * weight;
                            }
                        }
                        const i = (y * canvas.width + x) * 4;
                        data[i] = Math.min(Math.max(r, 0), 255);
                        data[i + 1] = Math.min(Math.max(g, 0), 255);
                        data[i + 2] = Math.min(Math.max(b, 0), 255);
                    }
                }
            }

            if (params.zoom) {
                console.log('Applying zoom');
                const scale = 2; // Zoom in by 2 times
                const zoomCanvas = document.createElement('canvas');
                const zoomContext = zoomCanvas.getContext('2d');
                zoomCanvas.width = canvas.width * scale;
                zoomCanvas.height = canvas.height * scale;
                zoomContext.scale(scale, scale);
                zoomContext.drawImage(canvas, 0, 0);
                imageElement.src = zoomCanvas.toDataURL();
            }
        });

        context.putImageData(imageData, 0, 0);
        imageElement.src = canvas.toDataURL();
        console.log('Finished applying parameters');
    }

    async function fetchProcessedImages() {
        const listBlobsUrl = `https://storageelectron.blob.core.windows.net/processedelectron?restype=container&comp=list&${processedelectronSasToken}`;

        console.log(`Fetching processed images from URL: ${listBlobsUrl}`);

        try {
            const response = await fetch(listBlobsUrl);
            const str = await response.text();
            console.log('Response from processed blobs:', str);
            const xmlData = (new window.DOMParser()).parseFromString(str, "text/xml");

            const blobs = Array.from(xmlData.querySelectorAll('Blob'))
                .map(blob => blob.querySelector('Name').textContent)
                .filter(name => name.endsWith('_processed.jpg') || name.includes('processed'))
                .map(name => `https://storageelectron.blob.core.windows.net/processedelectron/${name}?${processedelectronSasToken}`)
                .filter(name => !processedBlobsCache.has(name));

            console.log(`Processed blobs found: ${blobs.length}`, blobs);

            if (blobs.length > 0) {
                blobs.forEach((blob, index) => {
                    setTimeout(() => {
                        console.log(`Processed blob name: ${blob} at ${new Date().toLocaleTimeString()}`);
                        processedBlobsCache.add(blob);
                        imageElement.src = blob;
                        const rects = parseBlobName(blob);
                        Object.keys(parameters).forEach(key => {
                            parameters[key].rects = []; // Clear old rectangles for all classes
                        });
                        rects.forEach(rect => {
                            if (!parameters[rect.className]) {
                                parameters[rect.className] = { color: 'none', blur: false, sharpen: false, zoom: false, rects: [] };
                            }
                            parameters[rect.className].rects.push(rect);
                        });
                        imageElement.onload = () => applyParams(imageElement); // Apply parameters after loading the image
                        manageButtonsVisibility(true, isReceivingFrames);
                        const detectedClassesMatch = blob.match(/processed(.*?)\d+\./);
                        if (detectedClassesMatch) {
                            const detectedClasses = detectedClassesMatch[1];
                            showSidebar(detectedClasses);
                        }
                    }, index * 500); // 0.5 second gap between each request
                });
            } else {
                console.error('No new processed images found.');
                manageButtonsVisibility(false);
            }
        } catch (error) {
            console.error('Failed to list processed blobs:', error);
            manageButtonsVisibility(false);
        }
    }

    function triggerAzureFunction() {
        console.log('Triggering Azure Function to process blobs...');

        return fetch(azureFunctionUrl, { method: 'POST' })
            .then(response => {
                console.log('Azure Function response status:', response.status);
                if (!response.ok) {
                    throw new Error('Failed to trigger Azure Function');
                }
                return response.json();
            })
            .then(data => {
                console.log('Azure Function triggered, response:', data);
            })
            .catch(error => {
                console.error('Failed to trigger Azure Function:', error);
            });
    }

    function startPollingForProcessedImages() {
        console.log('Starting to poll for processed images...');
        pollingInterval = setInterval(fetchProcessedImages, 200);
    }

    document.getElementById('detect').addEventListener('click', function() {
        console.log('Detect button clicked, switching to processed images.');
        clearInterval(fetchInterval);

        // Reset parameters
        resetParameters();

        // Trigger Azure Function and start fetching processed images concurrently
        Promise.all([triggerAzureFunction(), new Promise(resolve => {
            startPollingForProcessedImages();
            resolve();
        })])
        .then(() => console.log('Both processes started concurrently'))
        .catch(error => console.error('Error in starting processes concurrently:', error));
    });

    document.getElementById('stop-frame').addEventListener('click', function() {
        clearInterval(fetchInterval);
        clearInterval(pollingInterval);
        isReceivingFrames = false;
        manageButtonsVisibility(true, isReceivingFrames);
    });

    document.getElementById('continue-frame').addEventListener('click', function() {
        if (!isReceivingFrames) {
            fetchInterval = setInterval(fetchAndDisplayImage, 1000);
            isReceivingFrames = true;
            manageButtonsVisibility(true, isReceivingFrames);
        }
    });

    document.getElementById('close-sidebar').addEventListener('click', function() {
        closeSidebar();
    });

    document.getElementById('sidebar').addEventListener('click', function(event) {
        if (event.target.classList.contains('class-name')) {
            showClassOptions(event.target.textContent);
        } else if (event.target.classList.contains('class-option')) {
            if (event.target.textContent === 'Color') {
                showColorOptions();
            } else if (event.target.textContent === 'Blur') {
                applyBlurToClass();
            } else if (event.target.textContent === 'Sharpen') {
                applySharpenToClass();
            } else if (event.target.textContent === 'Zoom In') {
                applyZoomToClass(true);
            }
            else if (event.target.textContent === 'Reset') { // Reset fonksiyonalitesi eklendi
                resetClassParameters();
            }
        } else if (event.target.classList.contains('color-option')) {
            applyColorToClass(event.target.textContent.toLowerCase());
        }
    });

    document.getElementById('zoom-in').addEventListener('click', function() {
        if (!isReceivingFrames && currentImage) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = currentImage.width * 1.5;
            canvas.height = currentImage.height * 1.5;
            context.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
            imageElement.src = canvas.toDataURL();
        }
    });

    document.getElementById('sharpen').addEventListener('click', function() {
        if (!isReceivingFrames && currentImage) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = currentImage.width;
            canvas.height = currentImage.height;
            context.drawImage(currentImage, 0, 0);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const kernel = [
                0, -1, 0,
                -1, 4, -1,
                0, -1, 0
            ];
            const half = Math.floor(Math.sqrt(kernel.length) / 2);

            for (let y = half; y < canvas.height - half; y++) {
                for (let x = half; x < canvas.width - half; x++) {
                    let r = 0, g = 0, b = 0;
                    for (let ky = -half; ky <= half; ky++) {
                        for (let kx = -half; kx <= half; kx++) {
                            const i = ((y + ky) * canvas.width + (x + kx)) * 4;
                            const k = kernel[(ky + half) * Math.sqrt(kernel.length) + (kx + half)];
                            r += data[i] * k;
                            g += data[i + 1] * k;
                            b += data[i + 2] * k;
                        }
                    }
                    const i = (y * canvas.width + x) * 4;
                    data[i] = Math.min(Math.max(r, 0), 255);
                    data[i + 1] = Math.min(Math.max(g, 0), 255);
                    data[i + 2] = Math.min(Math.max(b, 0), 255);
                }
            }

            context.putImageData(imageData, 0, 0);
            imageElement.src = canvas.toDataURL();
        }
    });

    // Start fetching images initially and at regular intervals
    fetchInterval = setInterval(fetchAndDisplayImage, 1000);
});
