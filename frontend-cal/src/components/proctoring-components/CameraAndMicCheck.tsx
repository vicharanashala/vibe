import { useEffect, useState } from 'react';

const CameraAndMicCheck = () => {
    const [cameraAvailable, setCameraAvailable] = useState(false);
    const [micAvailable, setMicAvailable] = useState(false);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const videoInput = devices.some(device => device.kind === 'videoinput');
            const audioInput = devices.some(device => device.kind === 'audioinput');

            setCameraAvailable(videoInput);
            setMicAvailable(audioInput);

            if (!videoInput) {
                alert('Camera not found');
            }
            if (!audioInput) {
                alert('Microphone not found');
            }
        });
    }, []);

    return (
        <div>
            <h1>Camera and Microphone Check</h1>
            <p>Camera: {cameraAvailable ? 'Available' : 'Not Available'}</p>
            <p>Microphone: {micAvailable ? 'Available' : 'Not Available'}</p>
        </div>
    );
};

export default CameraAndMicCheck;