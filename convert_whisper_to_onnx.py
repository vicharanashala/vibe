# convert_whisper_to_onnx.py

def create_whisper_onnx():
    """
    Converts the openai/whisper-base model to ONNX format using Hugging Face Optimum.
    """
    try:
        from optimum.exporters.onnx import main_export
    except ImportError:
        print("Optimum library not found. Please install it with ONNX export support:")
        print("pip install optimum[exporters]")
        return

    model_name = "openai/whisper-base"
    output_dir = "whisper_onnx" # Directory to save the ONNX model files
    task = "automatic-speech-recognition"

    print(f"Starting ONNX export for model: {model_name}...")
    print(f"Output directory: {output_dir}")
    print(f"Task: {task}")

    try:
        main_export(
            model_name_or_path=model_name,
            output=output_dir,
            task=task,
            no_post_process=False, # Default, but explicit for clarity
            trust_remote_code=False # Default, but explicit for security
            # Other parameters can be added if needed, e.g., opset, device
        )
        print(f"ONNX export completed successfully. Model saved in {output_dir}")
    except Exception as e:
        print(f"An error occurred during ONNX export: {e}")
        # For more detailed debugging, one might add:
        # import traceback
        # print(traceback.format_exc())

if __name__ == "__main__":
    create_whisper_onnx()
