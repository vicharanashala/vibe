# Spec Delta

## Purpose

How the v3 student app gets a proctored lesson ready (camera, microphone and proctoring models), shows students accurate progress while it does, keeps downloaded models on the device, reports failures plainly, and lets students run diagnostics and clear saved files to fix problems themselves.

## ADDED Requirements

### Requirement: Setup checklist while a proctored lesson gets ready
While a strict-mode lesson is blocked because proctoring isn't ready, the app SHALL show a setup checklist instead of a bare spinner. Each entry SHALL show one status: waiting, checking the device, downloading, ready, failed or stalled. When every entry is ready, the checklist SHALL close and the lesson SHALL continue as it does today.

#### Scenario: Everything ready
- **WHEN** the camera is on and every model the lesson needs has loaded
- **THEN** the checklist closes, and the lesson is no longer dimmed

#### Scenario: Study mode
- **WHEN** a student opens a lesson in study mode
- **THEN** no checklist appears and no proctoring model is downloaded

### Requirement: The checklist lists what the lesson needs
The checklist SHALL list the camera, the microphone (when the lesson uses it), and each proctoring check the lesson enables that needs a model. Checks the lesson doesn't enable SHALL NOT appear.

#### Scenario: First proctored lesson
- **WHEN** a student opens a strict-mode lesson with face count and voice detection on, and nothing is saved on the device yet
- **THEN** the checklist shows camera, microphone, face detection and voice detection, each with its own status, until all are ready

#### Scenario: Only the camera is needed
- **WHEN** a lesson enables only the camera check
- **THEN** the checklist shows only the camera and lists no models

### Requirement: Accurate download progress
While a model downloads, its entry SHALL show the megabytes downloaded, the total and a percentage, all based on the bytes actually received. When the total size is unknown, the entry SHALL show megabytes downloaded with an indeterminate bar, never an invented percentage. A model made of several files SHALL show combined progress across all its files.

#### Scenario: Known size
- **WHEN** a 4 MB model has received 1 MB
- **THEN** its entry shows "1.0 of 4.0 MB" and 25%

#### Scenario: Unknown size
- **WHEN** the server does not report a model file's size
- **THEN** its entry shows the megabytes received so far and an indeterminate bar

### Requirement: Models are saved on the device
After a proctoring model and its runtime files download successfully, the app SHALL save them on the device, and later lessons SHALL load them from there without downloading again. An entry loaded from the device SHALL say it is saved on this device. A saved file that is unreadable or incomplete SHALL be discarded and downloaded again, not used. The model files SHALL match the version of the library the app runs, so an update on the model host can't break a working app.

#### Scenario: Second lesson
- **WHEN** a student whose models were saved in an earlier lesson opens another proctored lesson
- **THEN** each model entry says "Saved on this device" and becomes ready without downloading

#### Scenario: Damaged saved file
- **WHEN** a saved model file can't be read
- **THEN** the app downloads that model again, shows its progress, and the lesson still gets ready

#### Scenario: No space to save
- **WHEN** the device refuses to store a downloaded model
- **THEN** the model still loads for this lesson, and its entry says it couldn't be saved and will download again next time

### Requirement: Failed downloads are reported, not waited on forever
When a model fails to load, its entry SHALL show "Failed" with a plain reason (such as an unreachable model host, a missing browser feature or an interrupted download) and offer to try again. The checklist SHALL stay open with the failure shown, instead of leaving the lesson waiting indefinitely. Face recognition SHALL NOT show "Checking it's you…" while its model has not loaded.

#### Scenario: Model host blocked
- **WHEN** a student's network blocks the model host and the voice model can't be fetched
- **THEN** the voice entry shows "Failed: couldn't reach the model server", with Try again and Run diagnostics

#### Scenario: Face recognition model fails
- **WHEN** the face recognition model can't load
- **THEN** the checklist shows face recognition as failed instead of "Checking it's you…"

#### Scenario: Try again
- **WHEN** a student presses Try again on a failed entry
- **THEN** only that entry restarts loading, and the entries already ready stay ready

### Requirement: Stalled downloads are reported
When a download receives no data for 20 seconds, its entry SHALL show "Stalled" with Try again, without cancelling a download that resumes.

#### Scenario: Slow network
- **WHEN** a download receives no data for 20 seconds
- **THEN** its entry shows "Stalled", and returns to showing progress if data starts arriving again

### Requirement: Camera and microphone problems are explained
The camera and microphone entries SHALL distinguish:
- access denied by the student or the browser
- no camera or microphone found
- the device in use by another app
- a camera that doesn't support what the lesson asks for

Each SHALL come with its own plain-language fix. A denied permission SHALL explain how to allow it in the browser's site settings.

#### Scenario: Camera busy
- **WHEN** the camera is in use by another application
- **THEN** the camera entry says another app is using it and asks the student to close that app, then try again

#### Scenario: No microphone
- **WHEN** the lesson needs the microphone and the device has none
- **THEN** the microphone entry says no microphone was found

### Requirement: Run diagnostics
The setup checklist SHALL offer "Run diagnostics". The same checks SHALL be available at any time from a "Check my device" pane, opened from the account menu, the profile page or a strict-mode lesson's header, and on a "Check my device" page.

#### Scenario: Before starting a lesson
- **WHEN** a student opens "Check my device" from their profile
- **THEN** the same checks run there without opening a lesson

#### Scenario: During a lesson
- **WHEN** a student in a strict-mode lesson whose setup is complete presses "Check my device" in the lesson header
- **THEN** the checks open in a side pane, and the student stays on the lesson

### Requirement: What diagnostics check
Diagnostics SHALL check the browser's support for what proctoring needs (WebGL, WebAssembly, background workers, audio processing, on-device storage), camera and microphone permission and devices, whether each model host can be reached and how fast, available storage, which models are saved on the device, and whether the app's offline files are installed. Each result SHALL be pass, warning or fail, with a plain explanation and a suggested fix.

#### Scenario: Unsupported browser
- **WHEN** a student's browser lacks WebAssembly or WebGL
- **THEN** diagnostics marks it failed and suggests an up-to-date Chrome, Edge or Firefox

#### Scenario: Model host unreachable
- **WHEN** a model host doesn't respond
- **THEN** diagnostics names the host as unreachable, and suggests another network or turning off an ad blocker or VPN for this site

### Requirement: Diagnostics report stays with the student
The student SHALL be able to copy the full report as text to send to support. Diagnostics SHALL NOT send anything to ViBe's servers, and SHALL NOT record or keep any image or sound.

#### Scenario: Copy report
- **WHEN** a student presses Copy report
- **THEN** a text report with every check, its result, the browser and its version is copied, with no image, sound or personal data beyond what the student can see on screen

### Requirement: Students can clear saved files and retry
The checklist and the "Check my device" page SHALL offer:
- "Download models again": deletes the saved proctoring models and downloads them fresh.
- "Clear app files and reload": deletes the app's own cached files and offline support, then reloads.
- "Reload".

Clearing SHALL affect only ViBe's own saved files on this site: never the student's sign-in, settings or other websites. The page SHALL say what each option removes before it runs.

#### Scenario: Download again
- **WHEN** a student presses "Download models again"
- **THEN** the saved models are removed, each model entry shows a fresh download with progress, and the student stays signed in

#### Scenario: Clear app files
- **WHEN** a student presses "Clear app files and reload" and confirms
- **THEN** the app's cached files and offline support are removed, the page reloads, and the student is still signed in
