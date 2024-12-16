import React, { useState, useEffect } from "react";
import FacePoseDetector from "./FacePoseDetector";
import VoiceActivityDetection from "./VoiceActivityDetection";
import { FilesetResolver } from "@mediapipe/tasks-vision";
import HandsDetection from "./HandsDetection";


const ParentComponent = () => {
    const [filesetResolver, setFilesetResolver] = useState(null);
    const [audioFilesetResolver, setAudioFilesetResolver] = useState(null);

    useEffect(() => {
        const initializeFilesetResolver = async () => {
            const resolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
            )
            const audioResolver = await FilesetResolver.forAudioTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm"
                );
            setAudioFilesetResolver(audioResolver);
            setFilesetResolver(resolver);
        };

        initializeFilesetResolver();
    }, []);
    if (!(filesetResolver && audioFilesetResolver)) {
        return <div>Loading...</div>; // Wait until the resolver is initialized.
    }

    return (
        <div>
            <FacePoseDetector filesetResolver={filesetResolver} />
            <HandsDetection filesetResolver={filesetResolver} />
            <VoiceActivityDetection filesetResolver={audioFilesetResolver} />
        </div>
    );
};

export default ParentComponent;
