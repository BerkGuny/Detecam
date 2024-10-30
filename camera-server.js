const WebSocket = require('ws');
const { spawn } = require('child_process');

// WebSocket sunucusunu başlat
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
    console.log('Client connected');

    ws.on('message', function incoming(message) {
        console.log('Received:', message);
        if (message === 'start-camera') {
            // ffmpeg'i kullanarak kamerayı başlat (Windows için)
            const ffmpeg = spawn('ffmpeg', [
                '-f', 'dshow',
                '-i', `video="YOUR_CAMERA_NAME"`, // Kamera adınızı buraya girin
                '-f', 'mjpeg',
                'pipe:1',
            ]);

            ffmpeg.stdout.on('data', function (data) {
                ws.send(data); // Kamera verisini WebSocket üzerinden gönder
            });

            ffmpeg.stderr.on('data', function (data) {
                console.error(`stderr: ${data}`);
            });

            ffmpeg.on('close', function (code) {
                console.log(`ffmpeg process exited with code ${code}`);
            });

            // WebSocket bağlantısı koptuğunda ffmpeg'i durdur
            ws.on('close', function () {
                ffmpeg.kill('SIGINT');
            });
        }
    });
});

console.log('Camera server is running on ws://localhost:8080');
